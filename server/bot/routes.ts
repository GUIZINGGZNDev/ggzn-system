import type { Express } from "express";
import { getBotState, getPhone, requestPairingCode, startBot } from "./manager";

export function registerBotRoutes(app: Express) {
  app.get("/api/bot/status", (_req, res) => {
    res.json({ name: "GGZN SYSTEM", ...getBotState() });
  });

  app.get("/api/bot/pairing", async (req, res) => {
    try {
      await startBot();
      const requestedPhone = String(req.query.phone ?? getPhone()).replace(/\D/g, "");
      if (requestedPhone !== getPhone()) {
        res.status(400).json({ error: "Este projeto está configurado para o número principal do bot." });
        return;
      }
      const code = await requestPairingCode();
      res.json({ name: "GGZN SYSTEM", phone: getPhone(), status: getBotState().status, pairingCode: code ?? null, qrDataUrl: getBotState().qrDataUrl ?? null });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao iniciar pareamento" });
    }
  });

  app.post("/api/bot/start", async (_req, res) => {
    try { await startBot(); res.json({ success: true, ...getBotState() }); }
    catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao iniciar bot" }); }
  });
}
