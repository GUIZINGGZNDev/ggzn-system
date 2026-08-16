import makeWASocket, { Browsers, DisconnectReason, useMultiFileAuthState, type WASocket } from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import P from "pino";
import fs from "node:fs/promises";
import path from "node:path";
import { updateSession } from "../db";
import { commandLabel, handleIncomingMessage } from "./commands";

const PHONE = (process.env.BOT_PHONE ?? "5534991286637").replace(/\D/g, "");
const SESSION_DIR = path.resolve(process.env.BOT_SESSION_DIR ?? ".bot-session");

type BotState = {
  sock?: WASocket;
  status: "disconnected" | "connecting" | "connected" | "needs_pairing";
  qrDataUrl?: string;
  pairingCode?: string;
  lastError?: string;
  connecting?: Promise<void>;
};

const state: BotState = { status: "disconnected" };

async function ensureSessionDir() {
  await fs.mkdir(SESSION_DIR, { recursive: true });
}

export function getBotState() {
  return { phone: PHONE, status: state.status, qrDataUrl: state.qrDataUrl, pairingCode: state.pairingCode, lastError: state.lastError };
}

export async function startBot() {
  if (state.connecting) return state.connecting;
  state.connecting = (async () => {
    await ensureSessionDir();
    state.status = "connecting";
    await updateSession(PHONE, "connecting");
    const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const sock = makeWASocket({
      auth: authState,
      browser: Browsers.ubuntu("GGZN SYSTEM"),
      logger: P({ level: "silent" }),
      printQRInTerminal: false,
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });
    state.sock = sock;
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        state.qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, width: 360 });
        state.status = "needs_pairing";
        await updateSession(PHONE, "needs_pairing");
      }
      if (connection === "open") {
        state.status = "connected";
        state.qrDataUrl = undefined;
        state.pairingCode = undefined;
        state.lastError = undefined;
        await updateSession(PHONE, "connected");
      }
      if (connection === "close") {
        state.sock = undefined;
        const code = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        const shouldReconnect = code !== DisconnectReason.loggedOut;
        state.status = shouldReconnect ? "disconnected" : "needs_pairing";
        await updateSession(PHONE, state.status, `connection closed: ${code ?? "unknown"}`);
        if (shouldReconnect) setTimeout(() => void startBot(), 2500);
      }
    });
    sock.ev.on("messages.upsert", async ({ messages }) => {
      await Promise.allSettled(messages.map(async (message) => {
        const startedAt = performance.now();
        const jid = message.key.remoteJid;
        const command = commandLabel(message) ?? "unknown";
        try {
          if (jid && !message.key.fromMe) void sock.readMessages([message.key]).catch(() => undefined);
          await handleIncomingMessage(sock, message);
        } catch (error) {
          console.error("[GGZN] message handler error", error);
        } finally {
          const elapsed = Math.round(performance.now() - startedAt);
          if (elapsed > 250) console.info(`[GGZN][latency] ${elapsed}ms command=${command} jid=${jid ?? "unknown"}`);
        }
      }));
    });
  })().finally(() => { state.connecting = undefined; });
  return state.connecting;
}

export async function requestPairingCode() {
  if (state.qrDataUrl) return undefined;
  if (!state.sock || state.status === "disconnected") await startBot();
  if (!state.sock) throw new Error("Sessão do bot ainda não está disponível");
  if (state.status === "connected") return undefined;
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const code = await state.sock.requestPairingCode(PHONE);
  state.pairingCode = code;
  state.qrDataUrl = undefined;
  state.status = "needs_pairing";
  await updateSession(PHONE, "needs_pairing");
  return code;
}

export function getPhone() { return PHONE; }
