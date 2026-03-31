import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  real,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;

export const contactsTable = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 30 }).notNull(),
  notes: text("notes").default(""),
  alertEnabled: boolean("alert_enabled").default(true).notNull(),
  isOnline: boolean("is_online").default(false).notNull(),
  lastSeen: timestamp("last_seen"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Contact = typeof contactsTable.$inferSelect;

export const contactFavoritesTable = pgTable("contact_favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ContactFavorite = typeof contactFavoritesTable.$inferSelect;

export const contactGroupsTable = pgTable("contact_groups", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ContactGroup = typeof contactGroupsTable.$inferSelect;

export const contactGroupMembersTable = pgTable("contact_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => contactGroupsTable.id, { onDelete: "cascade" }),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
});

export type ContactGroupMember = typeof contactGroupMembersTable.$inferSelect;

export const activitySessionsTable = pgTable("activity_sessions", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  durationMinutes: integer("duration_minutes").default(0).notNull(),
});

export type ActivitySession = typeof activitySessionsTable.$inferSelect;

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  lastMessage: text("last_message").default(""),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  unreadCount: integer("unread_count").default(0).notNull(),
});

export type Conversation = typeof conversationsTable.$inferSelect;

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isIncoming: boolean("is_incoming").default(true).notNull(),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export type Message = typeof messagesTable.$inferSelect;

export const viewOnceMediaTable = pgTable("view_once_media", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => contactsTable.id, { onDelete: "cascade" }),
  mediaType: varchar("media_type", { length: 20 }).default("image").notNull(),
  url: text("url").default("").notNull(),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
});

export type ViewOnceMedia = typeof viewOnceMediaTable.$inferSelect;

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").default(""),
  type: varchar("type", { length: 50 }).default("info").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Notification = typeof notificationsTable.$inferSelect;

export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  price: real("price").notNull(),
  period: varchar("period", { length: 20 }).default("month").notNull(),
  features: jsonb("features").$type<string[]>().default([]).notNull(),
  contactLimit: integer("contact_limit").default(5).notNull(),
  isPopular: boolean("is_popular").default(false).notNull(),
});

export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;

export const userSubscriptionsTable = pgTable("user_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => subscriptionPlansTable.id),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserSubscription = typeof userSubscriptionsTable.$inferSelect;

export const userSettingsTable = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  notificationsEnabled: boolean("notifications_enabled").default(true).notNull(),
  onlineAlerts: boolean("online_alerts").default(true).notNull(),
  offlineAlerts: boolean("offline_alerts").default(false).notNull(),
  reportFrequency: varchar("report_frequency", { length: 20 }).default("daily").notNull(),
  dndEnabled: boolean("dnd_enabled").default(false).notNull(),
});

export type UserSettings = typeof userSettingsTable.$inferSelect;

export const dndRulesTable = pgTable("dnd_rules", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  startTime: varchar("start_time", { length: 10 }).notNull(),
  endTime: varchar("end_time", { length: 10 }).notNull(),
  label: varchar("label", { length: 100 }).default("Do Not Disturb").notNull(),
});

export type DndRule = typeof dndRulesTable.$inferSelect;

export const keywordAlertsTable = pgTable("keyword_alerts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  keyword: varchar("keyword", { length: 100 }).notNull(),
  severity: varchar("severity", { length: 20 }).default("medium").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type KeywordAlert = typeof keywordAlertsTable.$inferSelect;

export const geofenceZonesTable = pgTable("geofence_zones", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  radius: real("radius").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type GeofenceZone = typeof geofenceZonesTable.$inferSelect;
