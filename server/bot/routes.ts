import type { Express } from "express";
import { getBotState, getPhone, requestPairingCode, startBot } from "./manager";

export function registerBotRoutes(app: Express) {
  app.get("/api/bot/status", (_req, res) => {
    const state = getBotState();
    res.json({ name: "GGZN SYSTEM", phone: state.phone, status: state.status, lastError: state.lastError });
  });

  app.get("/api/bot/pairing", async (req, res) => {
    const ownerToken = req.headers["x-ggzn-owner-token"];
    if (ownerToken !== process.env.JWT_SECRET) {
      res.status(403).json({ error: "Conexão protegida: apenas o proprietário pode solicitar o código." });
      return;
    }
    try {
      await startBot();
      const requestedPhone = String(req.query.phone ?? getPhone()).replace(/\D/g, "");
      if (requestedPhone !== getPhone()) {
        res.status(400).json({ error: "Este projeto está configurado para o número principal do bot." });
        return;
      }
      const code = await requestPairingCode();
      const botState = getBotState();
      res.json({ name: "GGZN SYSTEM", phone: getPhone(), status: botState.status, pairingCode: code ?? null, qrDataUrl: botState.qrDataUrl ?? null, expiresAt: botState.pairingExpiresAt ?? null, warning: "Código temporário: use imediatamente no número proprietário e nunca compartilhe." });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao iniciar pareamento" });
    }
  });

  app.post("/api/bot/start", async (_req, res) => {
    try { await startBot(); res.json({ success: true, ...getBotState() }); }
    catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao iniciar bot" }); }
  });
}
