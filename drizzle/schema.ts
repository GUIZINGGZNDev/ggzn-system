import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const botGroups = mysqlTable("bot_groups", {
  id: int("id").autoincrement().primaryKey(),
  jid: varchar("jid", { length: 191 }).notNull().unique(),
  name: varchar("name", { length: 191 }).notNull().default("Grupo sem nome"),
  activePrefix: varchar("activePrefix", { length: 8 }).notNull().default("!"),
  prefixes: text("prefixes").notNull().default("! ,/ ,# ,."),
  disabledCommands: text("disabledCommands").notNull().default("[]"),
  rules: varchar("rules", { length: 16383 }).notNull().default("[]"),
  autoReplies: varchar("autoReplies", { length: 16383 }).notNull().default("[]"),
  joinMessages: varchar("joinMessages", { length: 8191 }).notNull().default("{}"),
  featureConfig: varchar("featureConfig", { length: 16383 }).notNull().default("{}"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const botReminders = mysqlTable("bot_reminders", {
  id: int("id").autoincrement().primaryKey(),
  taskUid: varchar("taskUid", { length: 65 }).unique(),
  chatJid: varchar("chatJid", { length: 191 }).notNull(),
  senderJid: varchar("senderJid", { length: 191 }).notNull(),
  text: varchar("text", { length: 1000 }).notNull(),
  status: mysqlEnum("status", ["pending", "sent", "cancelled"]).notNull().default("pending"),
  dueAt: timestamp("dueAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const botMembers = mysqlTable("bot_members", {
  id: int("id").autoincrement().primaryKey(),
  groupJid: varchar("groupJid", { length: 191 }).notNull(),
  userJid: varchar("userJid", { length: 191 }).notNull(),
  role: mysqlEnum("role", ["owner", "admin", "moderator", "member"]).notNull().default("member"),
  displayName: varchar("displayName", { length: 191 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  groupMemberUnique: uniqueIndex("bot_members_group_user_unique").on(table.groupJid, table.userJid),
}));

export const botSessions = mysqlTable("bot_sessions", {
  id: int("id").autoincrement().primaryKey(),
  phone: varchar("phone", { length: 32 }).notNull().unique(),
  status: mysqlEnum("status", ["disconnected", "connecting", "connected", "needs_pairing"]).notNull().default("disconnected"),
  lastConnectedAt: timestamp("lastConnectedAt"),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type BotGroup = typeof botGroups.$inferSelect;
export type BotReminder = typeof botReminders.$inferSelect;
export type BotRule = { id: string; text: string; enabled: boolean };
export type AutoReply = { trigger: string; response: string; enabled: boolean };
export type JoinMessages = {
  welcome: { enabled: boolean; text: string };
  farewell: { enabled: boolean; text: string };
};
export type FeatureConfig = {
  slowmodeSeconds: number;
  antiFlood: boolean;
  blockLinks: boolean;
  logs: boolean;
  warnings: Record<string, string[]>;
};
export type BotMember = typeof botMembers.$inferSelect;
export type BotSession = typeof botSessions.$inferSelect;
