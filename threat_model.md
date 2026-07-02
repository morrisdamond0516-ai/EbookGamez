# Threat Model

## Project Overview

EbookGamez is a production React + Express + PostgreSQL app for selling ebooks and games, managing subscriptions, publishing AI-generated books, and operating an admin-only content studio. The main production entry points are the public website, the Express API in `server/routes.ts`, the Stripe webhook in `server/index.ts`, and the Replit integration routes under `server/replit_integrations/`.

This threat model is production-scoped. Dev-only sandboxes, mockups, and local experimentation paths are out of scope unless production reachability is shown. Assume `NODE_ENV=production` in deployed environments and platform-managed TLS for browser-to-server transport.

## Assets

- **Admin publishing and content-studio controls** — draft ebooks, unpublished content, cover assets, backup tools, typography data, and bulk publishing actions. Compromise lets an attacker modify storefront inventory, destroy work, or trigger paid AI operations.
- **Customer and subscriber data** — customer accounts, reading access, subscription records, checkout ownership, usage events, and email verification state. Compromise exposes personal and business data.
- **Payment and billing state** — Stripe customer IDs, subscription lifecycle events, promo usage, order records, and checkout/session metadata. Compromise can create unauthorized access or billing state changes.
- **AI and third-party service budget** — OpenAI/Replit generation endpoints, support chat completions, illustration jobs, and other server-side AI calls. Abuse can create direct cost and availability impact.
- **Object storage contents** — covers, backups, uploaded files, and other stored assets referenced through `/objects/*` or object-storage helpers. Compromise can expose unpublished assets or allow malicious content hosting.
- **Application secrets and admin credentials** — `ADMIN_PASSWORD`, Stripe secrets, database credentials, and provider API keys. Exposure can lead to full administrative or financial compromise.

## Trust Boundaries

- **Browser to API** — every request from `client/` to the Express server is untrusted and must be authenticated, authorized, and validated server-side.
- **Public to admin boundary** — public catalog, checkout, and subscription flows are intentionally reachable without admin auth; content-studio, backup, analytics, typography, and publishing actions are not.
- **Subscriber/customer to server boundary** — subscriber OTP/session flows and customer sessions are distinct from admin controls and must not grant broader access.
- **Server to Stripe** — webhook calls and checkout/subscription operations cross a third-party trust boundary and must be authenticated before side effects occur.
- **Server to AI providers** — generation routes spend money and can process sensitive unpublished content; only intended callers should be able to trigger them.
- **Server to object storage** — signed upload/download URLs and `/objects/*` access must enforce ownership or explicit public visibility.
- **Server to database** — route handlers and services can directly read or mutate business-critical data; broken access control here becomes full data compromise.

## Scan Anchors

- **Primary production entry points:** `server/index.ts`, `server/routes.ts`
- **Highest-risk code areas:** admin/content-studio routes in `server/routes.ts`, public catalog mutation routes (`/api/books` POST/PUT/DELETE), customer ownership checks on `/api/books/:id/check-access`, `/api/books/:id/draft-id`, `/api/books/:id/download`, order lookup routes under `/api/orders/*`, Stripe webhook handling in `server/webhookHandlers.ts`, subscription auth in `server/subscriptionAuth.ts`, global API response logging in `server/index.ts`, public upload processing at `/api/upload/ebook`, subscriber usage recording at `/api/subscription/use`, and object storage/chat integrations in `server/replit_integrations/`
- **Public surfaces:** catalog, checkout, customer auth, subscription OTP/session routes, checkout-success/order lookup flows, reading/download endpoints that accept customer identifiers, public AI/chat routes such as `/api/customer-chat`, and anonymous upload endpoints such as `/api/upload/ebook`
- **Admin surfaces:** `/api/admin/*`, `/api/content-studio/*`, `/api/backup/*`, `/api/typography-vault/*`, analytics/publishing/quality tooling
- **Client-side hotspots:** admin secrets stored in `localStorage`, and any popup or HTML-building flow that injects book or draft content into `innerHTML`
- **Usually ignore unless proven reachable:** mockups, sandbox-only experiments, local-only utilities, and development artifacts outside production route registration

## Threat Categories

### Spoofing

This project trusts several identities: admins, customers, subscribers, Stripe, and internal services. Production routes that read or mutate admin-only data must require a valid admin session token, and Stripe webhooks must be verified before any subscription or entitlement change happens. Reusable secrets must not be treated as bearer tokens outside the dedicated login flow. Caller-supplied email addresses or checkout identifiers are not proof of customer identity.

### Tampering

The content studio, backup tools, typography vault, publishing flows, catalog mutation routes, and subscription state all perform high-impact writes. The server must not rely on the frontend to hide these actions. Every mutating endpoint must enforce role checks and validate that uploaded files, backup paths, and other inputs stay within intended business rules.

### Information Disclosure

The app stores unpublished drafts, AI-generated content, subscription state, customer records, chat transcripts, order history, and object storage assets. API responses and object download routes must only expose data to authorized callers. Admin-only exports, backups, draft readers, and internal chats must never be readable just because a route is reachable.

### Denial of Service

Several routes trigger expensive AI generation, ZIP creation, illustration work, cover processing, storage operations, and third-party API calls. Public or weakly protected access to these endpoints can create direct cost burn or service degradation. Production endpoints that trigger heavy work must be authenticated, authorized, and rate-limited where appropriate.

Centralized request/response logging is also in scope for data-protection review because logging full API payloads can create a durable copy of credentials and personal data outside the main data store.

### Elevation of Privilege

The main project risk is broken function-level authorization: admin-only routes mixed into a large route file, separate auth patterns for different features, and helper integrations registered globally. The required guarantee is simple: any route that manages unpublished content, storefront inventory, backups, analytics, chat history, or privileged storage must enforce server-side authorization consistently, not only in the UI. Client-rendered book content must not be able to escalate into same-origin script execution.

Secondary state such as subscription usage records must not become alternate proof of entitlement unless they are created only after the primary access checks succeed. Logging systems and operational tooling must not become an unintended privilege-escalation path by storing reusable bearer tokens.
