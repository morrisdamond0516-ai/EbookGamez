import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, decimal, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  genre: text("genre").notNull(),
  category: text("category").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("4.5"),
  coverUrl: text("cover_url").notNull(),
  description: text("description"),
  visible: boolean("visible").default(true).notNull(),
  coverFit: text("cover_fit").notNull().default("cover"),
  sourceDraftId: integer("source_draft_id"),
  subscriberExclusiveUntil: timestamp("subscriber_exclusive_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookSchema = createInsertSchema(books).omit({
  id: true,
  createdAt: true,
});

export type InsertBook = z.infer<typeof insertBookSchema>;
export type Book = typeof books.$inferSelect;

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerEmail: text("customer_email").notNull(),
  stripeSessionId: text("stripe_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  status: text("status").notNull().default("pending"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
});

export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  bookId: integer("book_id").notNull().references(() => books.id),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  title: text("title").notNull(),
  purchaseType: text("purchase_type").default("download"),
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type OrderItem = typeof orderItems.$inferSelect;

// Content Studio - Draft Ebooks
export const draftEbooks = pgTable("draft_ebooks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  genre: text("genre").notNull(),
  topic: text("topic").notNull(),
  description: text("description"),
  outline: text("outline"),
  content: text("content"),
  coverUrl: text("cover_url"),
  backgroundUrl: text("background_url"),
  pdfUrl: text("pdf_url"),
  suggestedPrice: decimal("suggested_price", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("pending"),
  coverStyleId: text("cover_style_id"),
  overlayApproved: boolean("overlay_approved").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  publishedAt: timestamp("published_at"),
});

export const insertDraftEbookSchema = createInsertSchema(draftEbooks).omit({
  id: true,
  createdAt: true,
  publishedAt: true,
});

export type InsertDraftEbook = z.infer<typeof insertDraftEbookSchema>;
export type DraftEbook = typeof draftEbooks.$inferSelect;

// Content Studio - Generation Jobs
export const generationJobs = pgTable("generation_jobs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  genre: text("genre").notNull(),
  status: text("status").notNull().default("queued"),
  totalItems: integer("total_items").default(0),
  completedItems: integer("completed_items").default(0),
  error: text("error"),
  topics: text("topics").array(),
  lastActivityAt: timestamp("last_activity_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const insertGenerationJobSchema = createInsertSchema(generationJobs).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export type InsertGenerationJob = z.infer<typeof insertGenerationJobSchema>;
export type GenerationJob = typeof generationJobs.$inferSelect;

// Chat/Conversations for AI integrations
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export const dismissedDuplicates = pgTable("dismissed_duplicates", {
  id: serial("id").primaryKey(),
  bookIdA: integer("book_id_a").notNull(),
  bookIdB: integer("book_id_b").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bookReviews = pgTable("book_reviews", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => books.id),
  visitorId: text("visitor_id").notNull(),
  displayName: text("display_name").notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBookReviewSchema = createInsertSchema(bookReviews).omit({
  id: true,
  createdAt: true,
});

export type BookReview = typeof bookReviews.$inferSelect;
export type InsertBookReview = z.infer<typeof insertBookReviewSchema>;

export const readingAccess = pgTable("reading_access", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull().references(() => books.id),
  customerEmail: text("customer_email").notNull(),
  stripeSessionId: text("stripe_session_id"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tier: text("tier").notNull(),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  annualPrice: decimal("annual_price", { precision: 10, scale: 2 }),
  readsPerMonth: integer("reads_per_month").notNull(),
  downloadsPerMonth: integer("downloads_per_month").notNull().default(0),
  stripePriceId: text("stripe_price_id"),
  stripeAnnualPriceId: text("stripe_annual_price_id"),
  stripeProductId: text("stripe_product_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({
  id: true,
  createdAt: true,
});
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  customerEmail: text("customer_email").notNull(),
  planId: integer("plan_id").notNull().references(() => subscriptionPlans.id),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  status: text("status").notNull().default("active"),
  billingInterval: text("billing_interval").notNull().default("monthly"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  rolloverCredits: integer("rollover_credits").notNull().default(0),
  savingsTotalCents: integer("savings_total_cents").notNull().default(0),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
});
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

export const subscriptionUsage = pgTable("subscription_usage", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => subscriptions.id),
  bookId: integer("book_id").notNull().references(() => books.id),
  usageType: text("usage_type").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubscriptionUsageSchema = createInsertSchema(subscriptionUsage).omit({
  id: true,
  createdAt: true,
});
export type InsertSubscriptionUsage = z.infer<typeof insertSubscriptionUsageSchema>;
export type SubscriptionUsage = typeof subscriptionUsage.$inferSelect;

export const activeCheckouts = pgTable("active_checkouts", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => subscriptions.id),
  customerEmail: text("customer_email").notNull(),
  bookId: integer("book_id").notNull().references(() => books.id),
  checkedOutAt: timestamp("checked_out_at").defaultNow().notNull(),
  returnedAt: timestamp("returned_at"),
});

export type ActiveCheckout = typeof activeCheckouts.$inferSelect;

export const subscriptionEvents = pgTable("subscription_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  customerEmail: text("customer_email"),
  planId: integer("plan_id"),
  subscriptionId: integer("subscription_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSubscriptionEventSchema = createInsertSchema(subscriptionEvents).omit({
  id: true,
  createdAt: true,
});
export type InsertSubscriptionEvent = z.infer<typeof insertSubscriptionEventSchema>;
export type SubscriptionEvent = typeof subscriptionEvents.$inferSelect;

export const contentRefreshLog = pgTable("content_refresh_log", {
  id: serial("id").primaryKey(),
  section: text("section").notNull(),
  status: text("status").notNull().default("pending"),
  itemsUpdated: integer("items_updated").default(0),
  details: text("details"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ContentRefreshLog = typeof contentRefreshLog.$inferSelect;

export const dynamicContent = pgTable("dynamic_content", {
  id: serial("id").primaryKey(),
  section: text("section").notNull(),
  contentJson: text("content_json").notNull(),
  refreshedAt: timestamp("refreshed_at").defaultNow().notNull(),
});

export type DynamicContent = typeof dynamicContent.$inferSelect;

export const pageViews = pgTable("page_views", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  visitorId: text("visitor_id").notNull(),
  referrer: text("referrer"),
  userAgent: text("user_agent"),
  country: text("country"),
  deviceType: text("device_type"),
  sessionId: text("session_id"),
  customerEmail: text("customer_email"),
  timeOnPage: integer("time_on_page"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PageView = typeof pageViews.$inferSelect;

export const promoUsages = pgTable("promo_usages", {
  id: serial("id").primaryKey(),
  promoCode: text("promo_code").notNull(),
  customerEmail: text("customer_email").notNull(),
  stripeSessionId: text("stripe_session_id"),
  orderTotal: text("order_total"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PromoUsage = typeof promoUsages.$inferSelect;

export const authorSubmissions = pgTable("author_submissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  bio: text("bio").notNull(),
  genre: text("genre").notNull(),
  sampleWorkUrl: text("sample_work_url"),
  status: text("status").notNull().default("pending"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuthorSubmissionSchema = createInsertSchema(authorSubmissions).omit({ id: true, status: true, adminNotes: true, createdAt: true });
export type InsertAuthorSubmission = z.infer<typeof insertAuthorSubmissionSchema>;
export type AuthorSubmission = typeof authorSubmissions.$inferSelect;

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  passwordHash: true,
  resetToken: true,
  resetTokenExpiresAt: true,
  createdAt: true,
});
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const affiliateApplications = pgTable("affiliate_applications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  website: text("website"),
  socialMedia: text("social_media"),
  audienceSize: text("audience_size"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  referralCode: text("referral_code"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAffiliateApplicationSchema = createInsertSchema(affiliateApplications).omit({ id: true, status: true, referralCode: true, adminNotes: true, createdAt: true });
export type InsertAffiliateApplication = z.infer<typeof insertAffiliateApplicationSchema>;
export type AffiliateApplication = typeof affiliateApplications.$inferSelect;

/** Customer-suggested book ideas awaiting admin approval before AI can use them. */
export const bookRequests = pgTable("book_requests", {
  id: serial("id").primaryKey(),
  customerEmail: text("customer_email"),
  requestText: text("request_text").notNull(),
  suggestedTitle: text("suggested_title"),
  suggestedGenre: text("suggested_genre"),
  status: text("status").notNull().default("pending"),
  source: text("source").notNull().default("customer"),
  draftId: integer("draft_id"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  fulfilledAt: timestamp("fulfilled_at"),
});

export const insertBookRequestSchema = createInsertSchema(bookRequests).omit({
  id: true,
  status: true,
  draftId: true,
  adminNotes: true,
  createdAt: true,
  fulfilledAt: true,
});
export type InsertBookRequest = z.infer<typeof insertBookRequestSchema>;
export type BookRequest = typeof bookRequests.$inferSelect;
