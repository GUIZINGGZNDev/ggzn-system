import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { AutoReply, BotReminder, BotRule, FeatureConfig, InsertUser, JoinMessages, botGroups, botMembers, botReminders, botSessions, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
const groupCache = new Map<string, { value: GroupConfig; expiresAt: number }>();
const pendingGroupLoads = new Map<string, Promise<GroupConfig>>();
const GROUP_CACHE_TTL_MS = 15_000;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  } else {
    values.lastSignedIn = new Date();
    updateSet.lastSignedIn = values.lastSignedIn;
  }
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) {
    values.role = user.role ?? "admin";
    updateSet.role = values.role;
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export type GroupConfig = {
  jid: string;
  name: string;
  activePrefix: string;
  prefixes: string[];
  disabledCommands: string[];
  rules: BotRule[];
  autoReplies: AutoReply[];
  joinMessages: JoinMessages;
  featureConfig: FeatureConfig;
};

export const DEFAULT_JOIN_MESSAGES: JoinMessages = {
  welcome: { enabled: true, text: "*BEM-VINDO AO {grupo}!*\nOlá, {mention}! Leia as regras e aproveite o grupo." },
  farewell: { enabled: true, text: "{mention} saiu do grupo. Até a próxima!" },
};
export const DEFAULT_FEATURE_CONFIG: FeatureConfig = { slowmodeSeconds: 0, antiFlood: false, blockLinks: false, logs: false, warnings: {} };

function parseJson<T>(value: string, fallback: T): T {
  try {
    const parsed = JSON.parse(value);
    return parsed as T;
  } catch {
    return fallback;
  }
}

export async function getOrCreateGroup(jid: string, name = "Grupo sem nome"): Promise<GroupConfig> {
  const cached = groupCache.get(jid);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const pending = pendingGroupLoads.get(jid);
  if (pending) return pending;
  const load = (async () => {
    const db = await getDb();
    if (!db) {
      const fallback = { jid, name, activePrefix: "!", prefixes: ["!", "/", "#", ".", "~", "+", ">"], disabledCommands: [], rules: [] as BotRule[], autoReplies: [] as AutoReply[], joinMessages: DEFAULT_JOIN_MESSAGES, featureConfig: DEFAULT_FEATURE_CONFIG };
      groupCache.set(jid, { value: fallback, expiresAt: Date.now() + GROUP_CACHE_TTL_MS });
      return fallback;
    }
    await db.insert(botGroups).values({ jid, name, activePrefix: "!", prefixes: JSON.stringify(["!", "/", "#", ".", "~", "+", ">"]), disabledCommands: JSON.stringify([]), joinMessages: JSON.stringify(DEFAULT_JOIN_MESSAGES), featureConfig: JSON.stringify(DEFAULT_FEATURE_CONFIG) }).onDuplicateKeyUpdate({ set: { name } });
    const rows = await db.select().from(botGroups).where(eq(botGroups.jid, jid)).limit(1);
    const row = rows[0];
    const value = {
      jid,
      name: row?.name ?? name,
      activePrefix: row?.activePrefix ?? "!",
      prefixes: row ? parseJson<string[]>(row.prefixes, ["!", "/", "#", ".", "~", "+", ">"]) : ["!", "/", "#", ".", "~", "+", ">"],
      disabledCommands: row ? parseJson<string[]>(row.disabledCommands, []) : [],
      rules: row ? parseJson<Array<Partial<BotRule>>>(row.rules, []).map((rule) => ({ id: rule.id ?? String(Date.now()), text: rule.text ?? "", enabled: rule.enabled !== false })) : [],
      autoReplies: row ? parseJson<AutoReply[]>(row.autoReplies, []) : [],
      joinMessages: row ? { ...DEFAULT_JOIN_MESSAGES, ...parseJson<Partial<JoinMessages>>(row.joinMessages, {}), welcome: { ...DEFAULT_JOIN_MESSAGES.welcome, ...parseJson<Partial<JoinMessages>>(row.joinMessages, {}).welcome }, farewell: { ...DEFAULT_JOIN_MESSAGES.farewell, ...parseJson<Partial<JoinMessages>>(row.joinMessages, {}).farewell } } : DEFAULT_JOIN_MESSAGES,
      featureConfig: row ? { ...DEFAULT_FEATURE_CONFIG, ...parseJson<Partial<FeatureConfig>>(row.featureConfig, {}) } : DEFAULT_FEATURE_CONFIG,
    };
    groupCache.set(jid, { value, expiresAt: Date.now() + GROUP_CACHE_TTL_MS });
    return value;
  })();
  pendingGroupLoads.set(jid, load);
  try {
    return await load;
  } finally {
    pendingGroupLoads.delete(jid);
  }
}

export async function listBotGroups(): Promise<GroupConfig[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(botGroups);
  return rows.map((row) => ({
    jid: row.jid,
    name: row.name,
    activePrefix: row.activePrefix,
    prefixes: parseJson<string[]>(row.prefixes, ["!", "/", "#", ".", "~", "+", ">"]),
    disabledCommands: parseJson<string[]>(row.disabledCommands, []),
    rules: parseJson<Array<Partial<BotRule>>>(row.rules, []).map((rule) => ({ id: rule.id ?? String(Date.now()), text: rule.text ?? "", enabled: rule.enabled !== false })),
    autoReplies: parseJson<AutoReply[]>(row.autoReplies, []),
    joinMessages: { ...DEFAULT_JOIN_MESSAGES, ...parseJson<Partial<JoinMessages>>(row.joinMessages, {}), welcome: { ...DEFAULT_JOIN_MESSAGES.welcome, ...parseJson<Partial<JoinMessages>>(row.joinMessages, {}).welcome }, farewell: { ...DEFAULT_JOIN_MESSAGES.farewell, ...parseJson<Partial<JoinMessages>>(row.joinMessages, {}).farewell } },
    featureConfig: { ...DEFAULT_FEATURE_CONFIG, ...parseJson<Partial<FeatureConfig>>(row.featureConfig, {}) },
  }));
}

export async function updateGroupConfig(jid: string, patch: Partial<{ name: string; activePrefix: string; prefixes: string[]; disabledCommands: string[]; rules: BotRule[]; autoReplies: AutoReply[]; joinMessages: JoinMessages; featureConfig: FeatureConfig }>) {
  groupCache.delete(jid);
  pendingGroupLoads.delete(jid);
  const db = await getDb();
  if (!db) return;
  await db.insert(botGroups).values({
    jid,
    name: patch.name ?? "Grupo sem nome",
    activePrefix: patch.activePrefix ?? "!",
    prefixes: JSON.stringify(patch.prefixes ?? ["!", "/", "#", ".", "~", "+", ">"]),
    disabledCommands: JSON.stringify(patch.disabledCommands ?? []),
    rules: JSON.stringify(patch.rules ?? []),
    autoReplies: JSON.stringify(patch.autoReplies ?? []),
    joinMessages: JSON.stringify(patch.joinMessages ?? DEFAULT_JOIN_MESSAGES),
    featureConfig: JSON.stringify(patch.featureConfig ?? DEFAULT_FEATURE_CONFIG),
  }).onDuplicateKeyUpdate({
    set: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.activePrefix !== undefined ? { activePrefix: patch.activePrefix } : {}),
      ...(patch.prefixes !== undefined ? { prefixes: JSON.stringify(patch.prefixes) } : {}),
      ...(patch.disabledCommands !== undefined ? { disabledCommands: JSON.stringify(patch.disabledCommands) } : {}),
      ...(patch.rules !== undefined ? { rules: JSON.stringify(patch.rules) } : {}),
      ...(patch.autoReplies !== undefined ? { autoReplies: JSON.stringify(patch.autoReplies) } : {}),
      ...(patch.joinMessages !== undefined ? { joinMessages: JSON.stringify(patch.joinMessages) } : {}),
      ...(patch.featureConfig !== undefined ? { featureConfig: JSON.stringify(patch.featureConfig) } : {}),
    },
  });
}

export async function createReminder(reminder: { chatJid: string; senderJid: string; text: string; dueAt: Date }) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(botReminders).values(reminder);
  return Number(result[0]?.insertId ?? 0);
}

export async function attachReminderTask(id: number, taskUid: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(botReminders).set({ taskUid }).where(eq(botReminders.id, id));
}

export async function getPendingReminderByTaskUid(taskUid: string): Promise<BotReminder | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(botReminders).where(and(eq(botReminders.taskUid, taskUid), eq(botReminders.status, "pending"))).limit(1);
  return rows[0];
}

export async function markReminderSent(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(botReminders).set({ status: "sent" }).where(eq(botReminders.id, id));
}

export async function getMemberRole(groupJid: string, userJid: string) {
  const db = await getDb();
  if (!db) return "member" as const;
  const rows = await db.select().from(botMembers).where(and(eq(botMembers.groupJid, groupJid), eq(botMembers.userJid, userJid))).limit(1);
  return rows[0]?.role ?? "member";
}

export async function upsertMember(groupJid: string, userJid: string, role: "owner" | "admin" | "moderator" | "member", displayName?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(botMembers).values({ groupJid, userJid, role, displayName }).onDuplicateKeyUpdate({ set: { role, displayName } });
}

export async function updateSession(phone: string, status: "disconnected" | "connecting" | "connected" | "needs_pairing", lastError?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(botSessions).values({ phone, status, lastError: lastError ?? null, lastConnectedAt: status === "connected" ? new Date() : null }).onDuplicateKeyUpdate({ set: { status, lastError: lastError ?? null, ...(status === "connected" ? { lastConnectedAt: new Date() } : {}) } });
}

export async function getSession(phone: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(botSessions).where(eq(botSessions.phone, phone)).limit(1);
  return rows[0];
}
