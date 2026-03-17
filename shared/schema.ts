import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  provider: text("provider").notNull().default("email"), // email, google, github, microsoft
  avatarUrl: text("avatar_url"),
  apiKey: text("api_key"),
  role: text("role").notNull().default("user"), // "admin" or "user"
  password: text("password"), // only for local admin login
  createdAt: text("created_at").notNull(),
});

export const feeds = pgTable("feeds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  category: text("category").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  lastFetched: text("last_fetched"),
  iocCount: integer("ioc_count").notNull().default(0),
  status: text("status").notNull().default("idle"),
  errorMessage: text("error_message"),
  isCustom: boolean("is_custom").notNull().default(false),
  addedBy: text("added_by"),
});

export const indicators = pgTable("indicators", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  value: text("value").notNull(),
  source: text("source").notNull(),
  severity: text("severity").notNull().default("medium"),
  confidence: integer("confidence").notNull().default(50),
  tags: text("tags").array(),
  firstSeen: text("first_seen").notNull(),
  lastSeen: text("last_seen").notNull(),
  description: text("description"),
  metadata: text("metadata"),
  active: boolean("active").notNull().default(true),
});

export const searches = pgTable("searches", {
  id: serial("id").primaryKey(),
  query: text("query").notNull(),
  type: text("type").notNull(),
  resultCount: integer("result_count").notNull().default(0),
  timestamp: text("timestamp").notNull(),
});

export const stats = pgTable("stats", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertFeedSchema = createInsertSchema(feeds).omit({ id: true });
export const insertIndicatorSchema = createInsertSchema(indicators).omit({ id: true });
export const insertSearchSchema = createInsertSchema(searches).omit({ id: true });
export const insertStatSchema = createInsertSchema(stats).omit({ id: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Feed = typeof feeds.$inferSelect;
export type InsertFeed = z.infer<typeof insertFeedSchema>;
export type Indicator = typeof indicators.$inferSelect;
export type InsertIndicator = z.infer<typeof insertIndicatorSchema>;
export type Search = typeof searches.$inferSelect;
export type InsertSearch = z.infer<typeof insertSearchSchema>;
export type Stat = typeof stats.$inferSelect;
export type InsertStat = z.infer<typeof insertStatSchema>;
