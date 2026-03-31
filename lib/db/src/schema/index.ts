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

export const whatsappSessionsTable = pgTable("whatsapp_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  phoneNumber: text("phone_number"),
  maskedPhone: varchar("masked_phone", { length: 30 }),
  status: varchar("status", { length: 30 }).default("pending_pairing").notNull(),
  pairingCode: varchar("pairing_code", { length: 20 }),
  pairingCodeExpiresAt: timestamp("pairing_code_expires_at"),
  sessionData: text("session_data"),
  lastError: text("last_error"),
  reconnectAttempts: integer("reconnect_attempts").default(0).notNull(),
  connectedAt: timestamp("connected_at"),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WhatsappSession = typeof whatsappSessionsTable.$inferSelect;
export type InsertWhatsappSession = typeof whatsappSessionsTable.$inferInsert;

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

export const trackerSessionsTable = pgTable("tracker_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  status: varchar("status", { length: 30 }).default("disconnected").notNull(),
  connectionType: varchar("connection_type", { length: 20 }).default("qr").notNull(),
  qrCodeBase64: text("qr_code_base64"),
  cookiesJson: text("cookies_json"),
  localStorageJson: text("local_storage_json"),
  lastError: text("last_error"),
  reconnectAttempts: integer("reconnect_attempts").default(0).notNull(),
  connectedAt: timestamp("connected_at"),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TrackerSession = typeof trackerSessionsTable.$inferSelect;
export type InsertTrackerSession = typeof trackerSessionsTable.$inferInsert;

export const trackerJobsTable = pgTable("tracker_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  phoneNumber: varchar("phone_number", { length: 30 }).notNull(),
  label: varchar("label", { length: 100 }),
  isActive: boolean("is_active").default(true).notNull(),
  lastStatus: varchar("last_status", { length: 20 }).default("unknown").notNull(),
  lastStatusAt: timestamp("last_status_at"),
  pollIntervalSeconds: integer("poll_interval_seconds").default(7).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TrackerJob = typeof trackerJobsTable.$inferSelect;
export type InsertTrackerJob = typeof trackerJobsTable.$inferInsert;

export const activityLogsTable = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  jobId: integer("job_id").notNull().references(() => trackerJobsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  phoneNumber: varchar("phone_number", { length: 30 }).notNull(),
  event: varchar("event", { length: 20 }).notNull(),
  statusText: text("status_text"),
  sessionStartAt: timestamp("session_start_at"),
  sessionEndAt: timestamp("session_end_at"),
  durationSeconds: integer("duration_seconds"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogsTable.$inferSelect;
export type InsertActivityLog = typeof activityLogsTable.$inferInsert;
