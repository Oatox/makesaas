import { pgTable, text, timestamp, uuid, boolean, jsonb, bigint, integer, date, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import type { IdeaContent } from "./ideas";
import type { OnboardingProfile } from "./onboarding-profile";

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
  /** Active SaaS (see supabase_setup.sql, section 8); null: the oldest one. */
  current_saas_id: uuid("current_saas_id"),
  /** Onboarding answers as question/answer lines (shared/onboarding-profile.ts), written by the server. */
  onboarding_profile: jsonb("onboarding_profile").$type<OnboardingProfile>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// The SaaS of each member, switched from the sidebar (see supabase_setup.sql, section 8, and
// shared/saas.ts). Product data belongs to one: saas_id, with (saas_id, user_id) referencing
// (id, user_id) so a row can only point to a SaaS of its own user.
export const saas = pgTable("saas", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  name: text("name").notNull(),
  logo_url: text("logo_url"),
  description: text("description"),
  audience: text("audience"),
  /** (idea_id, user_id) references saas_ideas (id, user_id): the idea kept on /lancement. */
  idea_id: uuid("idea_id"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
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

// TikTok accounts tracked on the acquisition page for one SaaS (see supabase_setup.sql, section 9
// and shared/acquisition.ts). Written by the server only; users read their rows and delete accounts.
// Videos and snapshots copy the account's saas_id, to be filtered by SaaS without a join.
// Dates are kept as strings: that is what Supabase returns.
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
const count = (name: string) => bigint(name, { mode: "number" }).default(0).notNull();

export const tiktokAccounts = pgTable("tiktok_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  saas_id: uuid("saas_id").notNull(),
  /** TikTok handle (uniqueId), lowercase, without the @. */
  handle: text("handle").notNull(),
  tiktok_user_id: text("tiktok_user_id"),
  nickname: text("nickname"),
  avatar_url: text("avatar_url"),
  verified: boolean("verified").default(false).notNull(),
  is_private: boolean("is_private").default(false).notNull(),
  followers: count("followers"),
  following: count("following"),
  /** Likes received by all the videos of the account. */
  likes: count("likes"),
  video_count: integer("video_count").default(0).notNull(),
  /** Last successful refresh. */
  synced_at: ts("synced_at"),
  /** Last refresh attempt: refreshes are limited by TIKTOK_SYNC_COOLDOWN_MINUTES from it. */
  sync_attempted_at: ts("sync_attempted_at"),
  /** Why the last refresh failed (French), null once a refresh succeeds. */
  sync_error: text("sync_error"),
  created_at: ts("created_at").defaultNow().notNull(),
});

export const tiktokVideos = pgTable(
  "tiktok_videos",
  {
    account_id: uuid("account_id").notNull(),
    /** TikTok's aweme_id. */
    video_id: text("video_id").notNull(),
    user_id: uuid("user_id").notNull(),
    saas_id: uuid("saas_id").notNull(),
    caption: text("caption"),
    cover_url: text("cover_url"),
    url: text("url").notNull(),
    duration_seconds: integer("duration_seconds"),
    posted_at: ts("posted_at").notNull(),
    views: count("views"),
    likes: count("likes"),
    comments: count("comments"),
    shares: count("shares"),
    saves: count("saves"),
    updated_at: ts("updated_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.account_id, table.video_id] })],
);

/** One snapshot per account and day, for the evolution charts. */
export const tiktokAccountStats = pgTable(
  "tiktok_account_stats",
  {
    account_id: uuid("account_id").notNull(),
    day: date("day").notNull(),
    user_id: uuid("user_id").notNull(),
    saas_id: uuid("saas_id").notNull(),
    followers: bigint("followers", { mode: "number" }).notNull(),
    likes: bigint("likes", { mode: "number" }).notNull(),
    /** Sum of the views of the account's videos known that day. */
    views: bigint("views", { mode: "number" }).notNull(),
    video_count: integer("video_count").notNull(),
  },
  (table) => [primaryKey({ columns: [table.account_id, table.day] })],
);

export type TikTokAccount = typeof tiktokAccounts.$inferSelect;
export type TikTokVideo = typeof tiktokVideos.$inferSelect;
export type TikTokAccountStat = typeof tiktokAccountStats.$inferSelect;

// Payment accounts (Stripe, Whop) connected to the revenue dashboard (see supabase_setup.sql,
// section 10, and shared/revenue.ts). Written by the server only; users read the public columns
// (never encrypted_key nor snapshot) and delete their accounts.
export const revenueConnections = pgTable("revenue_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  /** The SaaS whose revenue this account is: (saas_id, user_id) references saas (id, user_id). */
  saas_id: uuid("saas_id").notNull(),
  provider: text("provider", { enum: ["stripe", "whop"] }).notNull(),
  account_id: text("account_id"),
  account_name: text("account_name"),
  livemode: boolean("livemode").default(true).notNull(),
  key_hint: text("key_hint").notNull(),
  encrypted_key: text("encrypted_key").notNull(),
  snapshot: jsonb("snapshot"),
  last_synced_at: timestamp("last_synced_at", { withTimezone: true, mode: "string" }),
  sync_attempted_at: timestamp("sync_attempted_at", { withTimezone: true, mode: "string" }),
  last_error: text("last_error"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

// Discussions with the coach Gus (see supabase_setup.sql, section 11, and shared/coach.ts). The
// server alone writes the messages; users read them, rename and delete their conversations.
export const coachConversations = pgTable("coach_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  /** (saas_id, user_id) references saas (id, user_id). */
  saas_id: uuid("saas_id").notNull(),
  title: text("title").notNull(),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  /** Time of the last message. */
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const coachMessages = pgTable("coach_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** (conversation_id, user_id) references coach_conversations (id, user_id). */
  conversation_id: uuid("conversation_id").notNull(),
  user_id: uuid("user_id").notNull(),
  role: text("role", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

// Carousels of the content page, for one SaaS (supabase_setup.sql, section 12; document in
// shared/carousel.ts). Members create, edit and delete them from the browser; the server writes the
// generated ones. The document is typed `unknown`: read it with parseCarouselDocument.
export const carousels = pgTable("carousels", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  /** (saas_id, user_id) references saas (id, user_id). */
  saas_id: uuid("saas_id").notNull(),
  title: text("title").notNull(),
  status: text("status", { enum: ["generating", "ready", "failed"] }).default("ready").notNull(),
  /** Topic of a generated carousel; null when created empty. */
  topic: text("topic"),
  document: jsonb("document").$type<unknown>().notNull(),
  /** Why the generation failed, or which images it could not make (French). */
  error: text("error"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export type Carousel = typeof carousels.$inferSelect;

// SaaS ideas proposed on /lancement (supabase_setup.sql, section 13, and shared/ideas.ts): one batch
// per generation, three ideas each. Written by the server only; users read their ideas.
export const saasIdeaBatches = pgTable("saas_idea_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  status: text("status", { enum: ["running", "succeeded", "failed"] }).default("running").notNull(),
  /** What the member asked for to steer the ideas; null when nothing. */
  steer: text("steer"),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const saasIdeas = pgTable("saas_ideas", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull(),
  /** (batch_id, user_id) references saas_idea_batches (id, user_id). */
  batch_id: uuid("batch_id").notNull(),
  /** 0: the idea Gus recommends. */
  position: integer("position").notNull(),
  content: jsonb("content").$type<IdeaContent>().notNull(),
  created_at: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
});

export const insertProfileSchema = createInsertSchema(profiles, {
  email: z.string().email(),
  full_name: z.string().min(2).max(100).optional(),
});

export const updateProfileSchema = insertProfileSchema.partial();

export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
