import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { startConsumer } from "./consumer";

export const wsClients = new Set<any>();

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: "SuiLens Notification Service",
          version: "1.0.0",
          description:
            "Service for real-time order notifications via WebSocket",
        },
      },
    })
  )
  .get("/health", () => ({ status: "ok", service: "notification-service" }), {
    detail: { summary: "Health check", tags: ["Health"] },
  })
  .ws("/ws", {
    open(ws) {
      wsClients.add(ws);
      console.log(`WebSocket client connected (total: ${wsClients.size})`);
    },
    close(ws) {
      wsClients.delete(ws);
      console.log(`WebSocket client disconnected (total: ${wsClients.size})`);
    },
    message(_ws, _message) {},
  })
  .listen(3003);

startConsumer().catch(console.error);

console.log(`Notification Service running on port ${app.server?.port}`);
