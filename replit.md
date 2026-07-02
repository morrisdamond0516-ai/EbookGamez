# EbookGamez - Ebooks & Games Platform

## Overview
EbookGamez is a digital platform offering ebooks and games, designed with four main revenue streams: HTML5 games (via GameDistribution with ad revenue), a download hub for major game titles (with affiliate opportunities), SEO-optimized gaming guides, and an AI-generated ebook store with Stripe payments. The platform features a classic library aesthetic, a dark theme, an admin dashboard, and an AI Content Studio for ebook generation, aiming to provide a comprehensive and engaging digital entertainment experience.

## User Preferences
Preferred communication style: Simple, everyday language.
When OpenAI image generation API budget is exceeded, the system notifies with clear error messages. Per user preference, system prompts user when API fails instead of creating alternative fallback images.
CRITICAL: Never auto-generate covers with default overlay text. When generating new ebooks, always ask the user which AI cover style to use. Covers are created separately via Cover Review page with user-selected styles.
Content generation uses industry-standard chapter lengths by genre (e.g., thriller 1500-2500 words/chapter, fantasy 3000-5000, romance 2000-3000). Chapter count is dynamic based on what the story needs, not a fixed number. Content must read like published bestsellers with captivating stories, rich dialogue, and meaningful prose.
CRITICAL: Never restrict or limit the AI's creative output. Let the art take its course — no word caps, no "concise" instructions. Rich, full prose always.
All ebooks that have NOT gone through the multi-author system need full rewrite — detected by absence of 'Story Architect' or 'Technique Map' markers in outline/content. Pre-system stubs are wiped and rewritten from scratch through the current multi-author pipeline.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS with a dark library aesthetic theme, shadcn/ui, Radix UI
- **Animations**: Framer Motion
- **Build Tool**: Vite
- **Performance**: Route-level code splitting via React.lazy/Suspense, API caching, static asset caching, gzip/brotli compression via `compression` middleware, server-side pagination on `/api/books` (24 books per page, backward-compatible — no `page` param returns full array for admin pages).

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **API Style**: REST endpoints
- **Compression**: gzip/brotli
- **Generation Shutdown Guard**: Delays server shutdown during active content generation to prevent API cost wastage.

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL
- **Schema**: Defined in `shared/schema.ts`
- **Validation**: Zod schemas
- **Database Indexes**: 14 indexes on frequently-queried columns.
- **Migrations**: Drizzle Kit

### Project Structure
- **Monorepo**: `client/` (React), `server/` (Express), `shared/` (common code).
- **Type Safety**: Shared TypeScript types across client and server.

### UI/UX Decisions
- **Aesthetic**: Classic library theme with dark mode and specific typography.
- **AI-Powered Cover Design**: Utilizes AI for generation with various styles ("Vivid Painterly Pro", "Atmospheric Cinema", "Cinematic via OpenAI", "Replit Cinematic", "DALL-E 3 Vivid"), AI Creative Director for concepts, and AI-powered typography selection and analysis.
- **Cover Review Screen**: Displays ebooks with management tools. `draft_ebooks.cover_url` and `background_url` are kept in sync with the `books` table (objstore paths) via `fixLocalCoverPaths()` at startup.

### Customer Content Authorization
- **Session-based identity**: All content endpoints (`/api/books/:id/check-access`, `/api/books/:id/draft-id`, `/api/books/:id/download`, `/api/content-studio/drafts/:id/read`) derive identity from verified session headers only — never from caller-supplied email/bookId params.
- **Order access tokens**: Short-lived (1 hour) server-issued tokens (`x-order-token` header) allow logged-in customers who just paid to access their downloads. Issued via `POST /api/orders/session/:sessionId/token` (rate-limited, requires customer session whose email matches the order). In-memory Map in `server/routes.ts`.
- **Guest checkout UX**: Guests who purchase without an account see a "payment confirmed" screen on `/checkout-success` and are directed to log in or create an account with the purchase email to access downloads. Order details are never disclosed without authentication.
- **Reader authorization**: `drafts/:id/read` derives the authoritative `bookId` from a server-side title match (draft→books table) — client-supplied `bookId` is ignored for auth to prevent spoofing.
- **Webhook-only order creation**: Orders are created exclusively via `checkout.session.completed` Stripe webhook (`server/checkoutHandler.ts`), not via client-initiated session lookups.

### Subscription Email Authentication
- **Email OTP Verification**: Subscription actions (status check, library checkout, return, download, cancel, usage) require email verification via one-time passcode sent to the subscriber's email.
- **Session Tokens**: After OTP verification, a session token is issued (valid 24 hours) and stored in localStorage. Token is sent via `X-Subscription-Token` header.
- **Rate Limiting**: All subscription endpoints are rate-limited per IP using `express-rate-limit`. OTP endpoints have stricter limits (5 per 15 min), sensitive actions (download, cancel) limited to 10 per 15 min, general subscription routes at 60 per 15 min.
- **Key Files**: `server/subscriptionAuth.ts` (OTP/session logic, rate limiters, auth middleware), `client/src/lib/subscription-auth.ts` (client-side token management).
- **Unprotected Routes**: `plans` (public), `checkout` (leads to Stripe), `track-event` (analytics), `init-plans`/`analytics` (admin-only) remain accessible without OTP but have rate limiting.

### Feature Specifications
- **AI Content Studio**: Generates ebooks, topic ideas, outlines, content, and cover images.
- **Visual-Enhanced Genre System**: Comics, Graphic Novels, Photography Books, Coloring Books, and Art Books use a special generation mode that combines instructional text with AI-generated illustrations (`[ILLUSTRATION: description]` markers). After content generation, a post-processing pipeline generates images via gpt-image-1 for each marker and embeds them inline. Book reader renders these as inline images. Max 30 illustrations per book. Illustrations stored in `uploads/illustrations/`. All illustrations use portrait format (1024×1536) matching book page proportions. Framing instruction leads every prompt to prevent subject cropping. Each URL illustration gets its own dedicated full page in the reader (prevents overflow clipping). IllustrationImage component has onError fallback for broken images. Captions stored inline as pipe-separated value: `[ILLUSTRATION: /path/img.png | Caption text]` — keeps marker + caption atomic for resets and regeneration. Reader splits on ` | ` to render caption below image in 10.5px italic. Workbooks, Activity Books, and Guided Journals use `smallIllustrations` mode: illustrations render at ~355px (18 visual lines, ~237px wide for portrait 2:3 images) so exercises can follow on the same page. WORKBOOK_MAX_VISUAL_LINES = 28 (same as novels); the 18-line illustration + 10 remaining lines fills the page correctly. Admin tools: `GET /api/admin/illustrations/scan-cutoff` (sharp edge-pixel analysis to detect cropped subjects) and `POST /api/admin/illustrations/reset-for-regen` (clears illustration URLs so next generation run regenerates them).
- **Genre-Aware Content Generation**: Incorporates bestselling author techniques via an AI Story Architect and technique maps for rich prose and comprehensive non-fiction.
- **Plot Twists & Depth**: Fiction includes major plot twists, foreshadowing, and distinct character voices; non-fiction is designed as a definitive resource.
- **Bulk Content Writing & Management**: Features for generating, rewriting, downloading, uploading, and editing ebook details.
- **Cloud Backup System**: Automatic backup of finalized covers to Replit Object Storage. Illustration files also stored under `public/illustrations/` and served via `/objstore/illustrations/:filename`. New illustrations upload to GCS at generation time (falls back to local path). `fixLocalCoverPaths()` at startup fixes both `books` and `draft_ebooks` tables — syncing cover_url from books table (title match) and converting background_url local paths to objstore. On-demand migration: `POST /api/admin/illustrations/migrate-objstore`. Helper: `server/objectStorage.ts`.
- **Quality Gate Checklist**: Automated quality analysis (structural and AI-powered dialogue/prose review) for ebooks before publication.
- **Smart Repair Path**: Fixes specific issues in multi-author books to reduce API costs.
- **Final Sweep & Bulk Publish**: Comprehensive quality checks on "ready" books before publishing; failures are demoted to draft.
- **Audit Published Books**: Scans already-published books for quality issues.
- **Chapter Deduplication**: Removes duplicate chapter entries.
- **Duplicate Title Guard**: Prevents publishing books with similar titles.
- **Smart Pricing System**: Auto-prices ebooks based on word count, genre multipliers, and chapter count. Pricing tiers: Coloring/Art books floor $7.99, Illustrated story formats (comics, graphic novels, photography, activity) floor $9.99, all others by word count. Classics fixed at $1.99. Max $14.99. Three-tier purchase: Read Online (35% off download, or $1 off for coloring/art), Download (base), Bundle (30% premium). All percentage-based to scale properly.
- **Content Integrity Rules**: Ensures content generation quality by preventing incremental saves during streaming, managing truncated chapters, and setting token limits.
- **Author Library**: Private admin reading room at `/admin/author-library` for classics, author-created works with content, and uploaded works. Supports search, genre filter, and source filter (Classic/Author/Uploaded). Links to the existing book reader for reading.
- **Classic Books Online Reader**: Provides free online access to public domain classics.
- **Three-Tier Purchase System**: Offers "Read Online," "Download," and "Read + Download Bundle" options for non-classic ebooks, with varying access and pricing.
- **Subscription System (Reading Pass)**: A 5-tier subscription model via Stripe with monthly and annual billing. Lite $4.99/1 download, Reader $8.99/2, Value $12.99/3, Premium $18.99/5, VIP $25.99/8. Annual billing = 2 months free (10 months for 12). Library-style checkout with unlimited reads and download credits, admin analytics and access control.
- **Reading Pass Competitive Features**: (1) "You've Saved $X" tracker — cumulative savings vs individual purchase prices. (2) Rollover credits — unused downloads carry over, capped at plan's monthly allowance. (3) Upgrade nudges — banner when 80%+ downloads used, suggesting next tier. (4) Annual discount — 2 months free on any plan. (5) Subscriber-exclusive books — `subscriberExclusiveUntil` timestamp on books table, badge on book detail and catalog cards, admin endpoints to set/clear exclusivity (`POST /api/admin/books/set-exclusive`, `POST /api/admin/books/clear-exclusive`), auto-set on publish via Content Studio toggle. (6) Free trial — 7-day trial on Value tier for new subscribers.
- **Library Checkout System**: One book at a time — subscribers check out a book to read online, return it to swap for another. Downloads use monthly credits (+ rollover) to keep books permanently. Tracked in `active_checkouts` table.
- **Subscription Access Control**: Gated access to non-classic books based on one-time purchase or active subscription checkout.
- **Subscription Analytics Dashboard**: Tracks key metrics like active subscribers, revenue, churn, usage, and events.
- **Subscription Event Tracking**: Monitors customer interactions for analytics and A/B testing.
- **Built-in Site Analytics**: Custom visitor tracking system with page views, unique visitors, device breakdown, referrer tracking, daily traffic charts, and recent visits. Admin-only dashboard at `/admin/analytics`. Data stored in `page_views` table with indexed columns.
- **WELCOME10 Promo Code**: First-time customer 10% discount. Validated server-side with email. Usage tracked in `promo_usages` table. Admin can view usage via `/api/admin/promo-usage`. Badge in navbar (animated gradient, copies code on click). Exit-intent popup on home page.
- **AI Customer Support Chat**: Floating chat widget (bottom-right) powered by GPT-4o-mini. Knows about EbookGamez products, pricing, and policies. Includes "Schedule a Call" feature for booking appointments during available hours (Tue/Wed/Sun 3-7pm PST, Mon/Thu/Fri/Sat 7:30-9pm PST).
- **Business Address**: P.O. Box 1181, Las Vegas, NV 89125. Shown in footer, about page, contact page, privacy policy, terms of service, and refund policy.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store.

### Payment Processing
- **Stripe Integration**: For payments and recurring subscriptions. Uses `stripe-replit-sync` for webhook processing.

### Third-Party Services
- **Google Fonts**: For typography.
- **OpenAI API**: For DALL-E 3 image generation and GPT-4o vision.
- **Replit AI**: For gpt-image-1 generation and as an alternative content generation provider via an AI Provider Toggle.
- **Replit Object Storage**: For cloud backups.