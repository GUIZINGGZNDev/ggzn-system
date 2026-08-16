import type { Express } from "express";
import { getBotState, getPhone, startBot } from "./manager";

export function isPairingMaintenance() { return process.env.BOT_PAIRING_MAINTENANCE !== "false"; }

function isOwnerRequest(req: Parameters<Express["get"]>[1] extends never ? never : any) {
  return req.headers["x-ggzn-owner-token"] === process.env.JWT_SECRET;
}

function pairingMaintenanceResponse(res: any) {
  res.status(503).json({ error: "Conexão temporariamente pausada após recusas do WhatsApp. Migre para a API oficial ou reative o transporte após diagnóstico." });
}

export function publicPairingPayload(code: string | undefined, botState: { phone: string; status: string; pairingExpiresAt?: number }) {
  return { name: "GGZN SYSTEM", phone: botState.phone, status: botState.status, pairingCode: code ?? null, expiresAt: botState.pairingExpiresAt ?? null, warning: "O código numérico está desativado nesta versão; use somente o QR privado quando o transporte for reativado." };
}

export function registerBotRoutes(app: Express) {
  app.get("/api/bot/status", (_req, res) => {
    const state = getBotState();
    res.json({ name: "GGZN SYSTEM", phone: state.phone, status: state.status, lastError: state.lastError });
  });

  app.get("/api/bot/pairing", async (_req, res) => {
    if (isPairingMaintenance()) { pairingMaintenanceResponse(res); return; }
    res.status(410).json({ error: "Código numérico desativado. Use exclusivamente o QR privado em /api/bot/qr." });
  });

  app.get("/api/bot/qr", async (req, res) => {
    if (isPairingMaintenance()) { pairingMaintenanceResponse(res); return; }
    if (!isOwnerRequest(req)) {
      res.status(403).json({ error: "QR protegido: apenas o proprietário pode visualizar a conexão." });
      return;
    }
    try {
      await startBot();
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const botState = getBotState();
        if (botState.qrDataUrl) {
          res.json({ name: "GGZN SYSTEM", phone: getPhone(), status: botState.status, qrDataUrl: botState.qrDataUrl, warning: "QR temporário: escaneie imediatamente e não compartilhe." });
          return;
        }
        if (botState.status === "connected") {
          res.status(409).json({ error: "O número do bot já está conectado." });
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      res.status(504).json({ error: "QR ainda não foi emitido; tente novamente em alguns segundos." });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao gerar QR" });
    }
  });

  app.post("/api/bot/start", async (_req, res) => {
    try { await startBot(); res.json({ success: true, ...getBotState() }); }
    catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Falha ao iniciar bot" }); }
  });
}
