# Email setup — EbookGamez & LearnForge

Three channels, each with a clear job:

| Channel | Use for | Cost |
|---------|---------|------|
| **Gmail** (via Cursor MCP) | Partnership outreach (SCORE, SBDC) — **draft first, you approve send** | Free |
| **Yahoo (`ebookgames@yahoo.com`)** | CC on partnership mail; inbox for replies | Free |
| **Resend** | Literary Club welcome + weekly digest to you + broadcasts | Free tier / Replit connector |

---

## 1. Resend on EbookGamez

### Option A — Replit connector (production default)

Connect **Resend** in Replit integrations. Transactional mail (`emailService.ts`) and the Literary Club (`server/newsletter.ts`) both use it automatically.

### Option B — Environment variables (local / Cursor dev)

```env
RESEND_API_KEY=re_...
RESEND_FROM=EbookGamez <onboarding@your-verified-domain.com>
RESEND_AUDIENCE_ID=...
RESEND_REPLY_TO=ebookgames@yahoo.com
PUBLIC_SITE_URL=https://ebookgamez.com
LEARNFORGE_PUBLIC_URL=https://your-learnforge-url
OWNER_NOTIFY_EMAIL=ebookgames@yahoo.com
```

**API routes**

- `POST /api/newsletter/subscribe` — Literary Club signup + welcome email
- `GET /api/newsletter/status` — health check
- `POST /api/admin/outreach/weekly-digest` — owner digest (requires `x-admin-token`)

Use the **same `RESEND_AUDIENCE_ID`** as LearnForge if you want one shared subscriber list.

---

## 2. Gmail + Cursor MCP (one-time OAuth)

Partnership emails: **Gmail**, always **CC `ebookgames@yahoo.com`**.

1. Copy `docs/mcp-gmail.example.json` → `%USERPROFILE%\.cursor\mcp.json` (merge if needed)
2. Restart Cursor
3. Run `npx gmail-mcp-server setup`
4. Prompt: *"Draft the SCORE email from docs/partnership-outreach-emails.md. CC ebookgames@yahoo.com. Do not send."*

---

## 3. In-app Outreach hub

Admin login (5-tap logo → password) → **Outreach** in nav, or `/admin/outreach`:

- Copy partnership templates
- Resend status
- **Email me this week's digest**

LearnForge has the same hub at `/owner/outreach` (Clerk owner login).

---

## 4. Deploy checklist (Replit)

1. Push this repo and redeploy
2. Confirm Resend connector is connected (or set env vars)
3. Set `LEARNFORGE_PUBLIC_URL` if LearnForge is on a different domain
4. Test home page Literary Club signup
5. Test `/admin/outreach` digest button

---

## Signature block

```
Damond Morris
702-379-0396
ebookgames@yahoo.com
```

---

## What we avoid

- Auto-sending SCORE/SBDC mail without your approval
- Paid marketing SaaS with later upsells
- Separate paid email APIs per game play
