import { pgTable, text, timestamp, uuid, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// First-touch acquisition data captured in the browser before signup.
const attributionField = z.string().trim().max(500).nullable().optional();

export const signupSourceSchema = z.object({
  utm_source: attributionField,
  utm_medium: attributionField,
  utm_campaign: attributionField,
  utm_term: attributionField,
  utm_content: attributionField,
  ref: attributionField,
  referrer: attributionField,
  landing_path: attributionField,
  captured_at: attributionField,
});

export type SignupSource = z.infer<typeof signupSourceSchema>;

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), 
  email: text("email"),
  full_name: text("full_name"),
  avatar_url: text("avatar_url"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  last_active_at: timestamp("last_active_at", { withTimezone: true }),
  signup_source: jsonb("signup_source").$type<SignupSource>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Current subscription of each user (see supabase_setup.sql, section 6). No row, or a status
// that grants no access, means no access: there is no free plan. A single plan unlocks everything,
// so the row only tracks whether the user has access. Written by the server only.
export const subscriptions = pgTable("subscriptions", {
  user_id: uuid("user_id").primaryKey(),
  status: text("status").notNull(),
  provider: text("provider", { enum: ["whop", "manual"] }).default("manual").notNull(),
  current_period_end: timestamp("current_period_end", { withTimezone: true }),
  cancel_at_period_end: boolean("cancel_at_period_end").default(false).notNull(),
  whop_membership_id: text("whop_membership_id").unique(),
  whop_user_id: text("whop_user_id"),
  /** Whop billing portal of the membership (cancel, change card). */
  manage_url: text("manage_url"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;

// Admin-editable LLM prompt sets (see supabase_setup.sql, section 7).
export const aiPipelines = pgTable("ai_pipelines", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  model: text("model").notNull(),
  system_prompt: text("system_prompt").notNull(),
  data_prompt: text("data_prompt").notNull(),
  instructions_prompt: text("instructions_prompt").notNull(),
  output_format_prompt: text("output_format_prompt").notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updated_by: uuid("updated_by"),
});

export const insertProfileSchema = createInsertSchema(profiles, {
  email: z.string().email(),
  full_name: z.string().min(2).max(100).optional(),
});

export const updateProfileSchema = insertProfileSchema.partial();

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
