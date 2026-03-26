import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { db } from "./db";
import { orders } from "./db/schema";
import { eq } from "drizzle-orm";
import { publishEvent } from "./events";

const CATALOG_SERVICE_URL =
  process.env.CATALOG_SERVICE_URL || "http://localhost:3001";

interface CatalogLens {
  id: string;
  modelName: string;
  manufacturerName: string;
  dayPrice: string;
}

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "SuiLens Order Service",
          version: "1.0.0",
          description: "API for creating and managing lens rental orders",
        },
      },
    })
  )
  .post(
    "/api/orders",
    async ({ body, set }) => {
      const lensResponse = await fetch(
        `${CATALOG_SERVICE_URL}/api/lenses/${body.lensId}`,
      );
      if (!lensResponse.ok) {
        set.status = 404;
        return { error: "Lens not found" };
      }
      const lens = (await lensResponse.json()) as CatalogLens;

      const start = new Date(body.startDate);
      const end = new Date(body.endDate);
      const days = Math.ceil(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (days <= 0) {
        set.status = 400;
        return { error: "End date must be after start date" };
      }
      const totalPrice = (days * parseFloat(lens.dayPrice)).toFixed(2);

      const [order] = await db
        .insert(orders)
        .values({
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          lensId: body.lensId,
          lensSnapshot: {
            modelName: lens.modelName,
            manufacturerName: lens.manufacturerName,
            dayPrice: lens.dayPrice,
          },
          startDate: start,
          endDate: end,
          totalPrice,
        })
        .returning();
      if (!order) {
        set.status = 500;
        return { error: "Failed to create order" };
      }

      await publishEvent("order.placed", {
        orderId: order.id,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        lensName: lens.modelName,
      });

      set.status = 201;
      return order;
    },
    {
      body: t.Object({
        customerName: t.String(),
        customerEmail: t.String({ format: "email" }),
        lensId: t.String({ format: "uuid" }),
        startDate: t.String(),
        endDate: t.String(),
      }),
      detail: { summary: "Create a rental order", tags: ["Orders"] },
    },
  )
  .get("/api/orders", async () => db.select().from(orders), {
    detail: { summary: "List all orders", tags: ["Orders"] },
  })
  .get("/api/orders/:id", async ({ params, set }) => {
    const results = await db
      .select()
      .from(orders)
      .where(eq(orders.id, params.id));
    if (!results[0]) {
      set.status = 404;
      return { error: "Order not found" };
    }
    return results[0];
  }, {
    params: t.Object({ id: t.String({ format: "uuid" }) }),
    detail: { summary: "Get order by ID", tags: ["Orders"] },
  })
  .get("/health", () => ({ status: "ok", service: "order-service" }), {
    detail: { summary: "Health check", tags: ["Health"] },
  })
  .listen(3002);

console.log(`Order Service running on port ${app.server?.port}`);
