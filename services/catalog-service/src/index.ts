import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { db } from "./db";
import { lenses } from "./db/schema";
import { eq } from "drizzle-orm";

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "SuiLens Catalog Service",
          version: "1.0.0",
          description: "API for browsing camera lenses available for rental",
        },
      },
    })
  )
  .get("/api/lenses", async () => {
    return db.select().from(lenses);
  }, {
    detail: { summary: "List all lenses", tags: ["Lenses"] },
  })
  .get("/api/lenses/:id", async ({ params, set }) => {
    const results = await db
      .select()
      .from(lenses)
      .where(eq(lenses.id, params.id));
    if (!results[0]) {
      set.status = 404;
      return { error: "Lens not found" };
    }
    return results[0];
  }, {
    params: t.Object({ id: t.String({ format: "uuid" }) }),
    detail: { summary: "Get lens by ID", tags: ["Lenses"] },
  })
  .get("/health", () => ({ status: "ok", service: "catalog-service" }), {
    detail: { summary: "Health check", tags: ["Health"] },
  })
  .listen(3001);

console.log(`Catalog Service running on port ${app.server?.port}`);
