import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, botGroups, botMembers, botSessions, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

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
};

function parseJson<T>(value: string, fallback: T): T {
  try {
    const parsed = JSON.parse(value);
    return parsed as T;
  } catch {
    return fallback;
  }
}

export async function getOrCreateGroup(jid: string, name = "Grupo sem nome"): Promise<GroupConfig> {
  const db = await getDb();
  if (!db) return { jid, name, activePrefix: "!", prefixes: ["!", "/", "#", "."], disabledCommands: [] };
  await db.insert(botGroups).values({ jid, name }).onDuplicateKeyUpdate({ set: { name } });
  const rows = await db.select().from(botGroups).where(eq(botGroups.jid, jid)).limit(1);
  const row = rows[0];
  return {
    jid,
    name: row?.name ?? name,
    activePrefix: row?.activePrefix ?? "!",
    prefixes: row ? parseJson<string[]>(row.prefixes, ["!", "/", "#", "."]) : ["!", "/", "#", "."],
    disabledCommands: row ? parseJson<string[]>(row.disabledCommands, []) : [],
  };
}

export async function updateGroupConfig(jid: string, patch: Partial<{ name: string; activePrefix: string; prefixes: string[]; disabledCommands: string[] }>) {
  const db = await getDb();
  if (!db) return;
  await db.insert(botGroups).values({
    jid,
    name: patch.name ?? "Grupo sem nome",
    activePrefix: patch.activePrefix ?? "!",
    prefixes: JSON.stringify(patch.prefixes ?? ["!", "/", "#", "."]),
    disabledCommands: JSON.stringify(patch.disabledCommands ?? []),
  }).onDuplicateKeyUpdate({
    set: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.activePrefix !== undefined ? { activePrefix: patch.activePrefix } : {}),
      ...(patch.prefixes !== undefined ? { prefixes: JSON.stringify(patch.prefixes) } : {}),
      ...(patch.disabledCommands !== undefined ? { disabledCommands: JSON.stringify(patch.disabledCommands) } : {}),
    },
  });
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
