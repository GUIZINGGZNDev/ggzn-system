import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerBotRoutes } from "../bot/routes";
import { getConnectedSocket, startBot } from "../bot/manager";
import { getPendingReminderByTaskUid, markReminderSent } from "../db";
import { sdk } from "./sdk";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerBotRoutes(app);
  app.post("/api/scheduled/botReminder", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const reminder = await getPendingReminderByTaskUid(user.taskUid);
      if (!reminder) return res.json({ ok: true, skipped: "already-delivered-or-missing" });
      const sock = getConnectedSocket();
      if (!sock) return res.status(503).json({ error: "bot-not-connected" });
      await sock.sendMessage(reminder.chatJid, { text: `⏰ LEMBRETE GGZN\n${reminder.text}` });
      await markReminderSent(reminder.id);
      return res.json({ ok: true, reminderId: reminder.id });
    } catch (error) {
      return res.status(500).json({ error: String(error), timestamp: new Date().toISOString() });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    void startBot().catch((error) => console.error("[GGZN] startup failed", error));
  });
}

startServer().catch(console.error);
