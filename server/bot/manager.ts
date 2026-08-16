import { makeWASocket, Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState, type WASocket, type WAMessage } from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import P from "pino";
import fs from "node:fs/promises";
import path from "node:path";
import { updateSession } from "../db";
import { commandLabel, handleGroupParticipantsUpdate, handleIncomingMessage } from "./commands";

const PHONE = (process.env.BOT_PHONE ?? "5534991286637").replace(/\D/g, "");
const SESSION_DIR = path.resolve(process.env.BOT_SESSION_DIR ?? ".bot-session");

type BotState = {
  sock?: WASocket;
  status: "disconnected" | "connecting" | "connected" | "needs_pairing";
  qrDataUrl?: string;
  pairingCode?: string;
  pairingIssuedAt?: number;
  pairingExpiresAt?: number;
  pending?: Promise<string | undefined>;
  lastError?: string;
  connecting?: Promise<void>;
  pairingReady?: Promise<void>;
  pairingReadyResolve?: () => void;
  registered?: boolean;
  reconnectAttempts?: number;
  reconnectTimer?: ReturnType<typeof setTimeout>;
};

const PAIRING_CODE_TTL_MS = 60_000;
const GLOBAL_RUNTIME_KEY = "__GGZN_BOT_RUNTIME__";
type GlobalRuntime = { state: BotState };
const globalRuntime = globalThis as typeof globalThis & { [GLOBAL_RUNTIME_KEY]?: GlobalRuntime };
const state = (globalRuntime[GLOBAL_RUNTIME_KEY] ??= { state: { status: "disconnected" } }).state;
export function pairingCodeIsActive(expiresAt?: number, now = Date.now()) { return Boolean(expiresAt && expiresAt > now); }
export function issuePairingCode(code: string, now = Date.now()) { return { pairingCode: code, pairingIssuedAt: now, pairingExpiresAt: now + PAIRING_CODE_TTL_MS }; }
export function singleFlight<T>(holder: { pending?: Promise<T> }, task: () => Promise<T>) { if (!holder.pending) holder.pending = task().finally(() => { holder.pending = undefined; }); return holder.pending; }
export function shouldRetryConnection(code: number | undefined, registered: boolean, attempts: number) {
  if (code === DisconnectReason.loggedOut || code === 401) return false;
  if (code === 440 && (!registered || attempts >= 3)) return false;
  return true;
}

async function ensureSessionDir() {
  await fs.mkdir(SESSION_DIR, { recursive: true });
}

export function getBotState() {
  return { phone: PHONE, status: state.status, qrDataUrl: state.qrDataUrl, pairingCode: state.pairingCode, pairingIssuedAt: state.pairingIssuedAt, pairingExpiresAt: state.pairingExpiresAt, lastError: state.lastError };
}

export async function startBot() {
  if (state.connecting) return state.connecting;
  if (state.sock && ["connecting", "connected", "needs_pairing"].includes(state.status)) return;

  state.connecting = (async () => {
    await ensureSessionDir();
    state.status = "connecting";
    await updateSession(PHONE, "connecting");
    const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    state.registered = authState.creds.registered;
    state.pairingReady = new Promise<void>((resolve) => { state.pairingReadyResolve = resolve; });
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
      auth: authState,
      version,
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
        state.pairingReadyResolve?.();
        await updateSession(PHONE, "needs_pairing");
      }
      if (connection === "open") {
        state.reconnectAttempts = 0;
        state.status = "connected";
        state.registered = true;
        state.pairingReadyResolve?.();
        state.qrDataUrl = undefined;
        state.pairingCode = undefined;
        state.pairingIssuedAt = undefined;
        state.pairingExpiresAt = undefined;
        state.lastError = undefined;
        await updateSession(PHONE, "connected");
      }
      if (connection === "close") {
        state.sock = undefined;
        const code = (lastDisconnect?.error as { output?: { statusCode?: number }; message?: string } | undefined)?.output?.statusCode;
        state.lastError = `connection closed: ${code ?? "unknown"}`;
        console.warn(`[GGZN] connection closed code=${code ?? "unknown"}`);
        state.pairingReadyResolve?.();
        const attempts = state.reconnectAttempts ?? 0;
        const shouldReconnect = shouldRetryConnection(code, Boolean(state.registered), attempts);
        state.status = shouldReconnect ? "disconnected" : "needs_pairing";
        await updateSession(PHONE, state.status, `connection closed: ${code ?? "unknown"}`);
        if (shouldReconnect) {
          state.reconnectAttempts = attempts + 1;
          const delay = code === 440 ? Math.min(3000 * state.reconnectAttempts, 9000) : 2500;
          state.reconnectTimer = setTimeout(() => { state.reconnectTimer = undefined; void startBot(); }, delay);
        }
      }
    });
    sock.ev.on("group-participants.update", async (event) => {
      try {
        await handleGroupParticipantsUpdate(sock, event);
      } catch (error) {
        console.error("[GGZN] group participant event error", error);
      }
    });
    sock.ev.on("messages.upsert", async ({ messages }) => {
      await Promise.allSettled(messages.map(async (message) => {
        const startedAt = performance.now();
        const jid = message.key.remoteJid;
        const command = commandLabel(message) ?? "unknown";
        console.info(`[GGZN][message][received] command=${command} jid=${jid ?? "unknown"}`);
        try {
          if (jid && !message.key.fromMe) void sock.readMessages([message.key]).catch(() => undefined);
          await handleIncomingMessage(sock, message);
        } catch (error) {
          console.error("[GGZN] message handler error", error);
        } finally {
          const elapsed = Math.round(performance.now() - startedAt);
          console.info(`[GGZN][message][processed] ${elapsed}ms command=${command} jid=${jid ?? "unknown"}`);
          if (elapsed > 250) console.info(`[GGZN][latency] ${elapsed}ms command=${command} jid=${jid ?? "unknown"}`);
        }
      }));
    });
  })().finally(() => { state.connecting = undefined; });
  return state.connecting;
}

export async function requestPairingCode() {
  return singleFlight(state, async () => {
    if (state.pairingCode && pairingCodeIsActive(state.pairingExpiresAt)) return state.pairingCode;
    state.pairingCode = undefined;
    state.pairingIssuedAt = undefined;
    state.pairingExpiresAt = undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!state.sock || state.status === "disconnected") await startBot();
    if (!state.sock) throw new Error("Sessão do bot ainda não está disponível");
    if (state.registered || state.status === "connected") return undefined;
    await Promise.race([
      state.pairingReady ?? Promise.resolve(),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Socket não ficou pronto para código de conexão")), 15000)),
    ]);
    try {
      state.qrDataUrl = undefined;
      const code = await state.sock.requestPairingCode(PHONE);
      Object.assign(state, issuePairingCode(code));
      state.status = "needs_pairing";
      await updateSession(PHONE, "needs_pairing");
      return code;
    } catch (error) {
      if (attempt === 1) throw error;
      state.sock = undefined;
      state.status = "disconnected";
      state.pairingCode = undefined;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    }
    return undefined;
  });
}

export function getPhone() { return PHONE; }
