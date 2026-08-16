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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
export type BotMember = typeof botMembers.$inferSelect;
export type BotSession = typeof botSessions.$inferSelect;
