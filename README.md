# EbookGamez

Full-stack ebook and gaming platform (Express + React + PostgreSQL).

## Prerequisites

- **Node.js** 20+ (tested with v24)
- **PostgreSQL** 14+ running locally
- API keys for **OpenAI** and **Stripe** (test keys work for local dev)

## Quick start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL, ADMIN_PASSWORD, OPENAI_API_KEY, and Stripe keys

# 3. Create the database (if it doesn't exist)
# psql -U postgres -c "CREATE DATABASE ebookgamez;"

# 4. Push the database schema
npm run db:setup

# 5. Verify setup
npm run setup:check

# 6. Start dev server (API + React with hot reload)
npm run dev
```

Open **http://127.0.0.1:3000** (or whatever `PORT` is set to in `.env`).

When `npm run dev` succeeds, the terminal prints a box with the full URL — open that link in **Chrome or Edge** (not in PowerShell). Keep the terminal running; closing it stops the app.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + Vite dev server on one port |
| `npm run dev:all` | Start API and Vite on separate ports (legacy) |
| `npm run build` | Production build |
| `npm run start` | Run production build |
| `npm run db:setup` | Create/update database tables (non-interactive) |
| `npm run db:push` | Interactive schema push via drizzle-kit |
| `npm run setup:check` | Validate env vars and database |
| `npm run test` | Run tests |

## Local vs Replit

This app was originally built on Replit. For **local Windows/Mac/Linux** dev:

- **Database**: Use local PostgreSQL via `DATABASE_URL`
- **File uploads**: Served from the `uploads/` folder (no object storage needed)
- **OpenAI**: Set `OPENAI_API_KEY` only — do **not** set `AI_INTEGRATIONS_OPENAI_BASE_URL`
- **Stripe**: Use test mode keys; webhook sync errors on startup are non-fatal in dev
- **Object storage** (`PUBLIC_OBJECT_SEARCH_PATHS`): Only needed in Replit production

## Troubleshooting

**`relation "books" does not exist`** — Run `npm run db:setup`

**`'NODE_ENV' is not recognized`** — Use `npm run dev` (scripts use `cross-env` for Windows)

**Port already in use** — Change `PORT` in `.env` or stop the other process

**Stripe sync errors on startup** — Expected with invalid/test keys; the app still runs

## Deploying to Railway

### 1) Create a Railway project from GitHub

- In Railway, create a new project from this repository.
- Railway will detect Node and use `railway.json`.
- Build command is your package build script, and start command is `npm run start`.

### 2) Add PostgreSQL on Railway

- Add a PostgreSQL service to the same project.
- Copy the generated `DATABASE_URL` into your app service variables.
- If importing production data, restore your backup into this Railway database before cutover.

### 3) Set required environment variables

At minimum, set:

- `NODE_ENV=production`
- `PORT` (Railway injects this automatically; do not hardcode)
- `DATABASE_URL`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`

Optional (only if you use object storage in production):

- `PUBLIC_OBJECT_SEARCH_PATHS`

Do not set local-only values like `HOST=127.0.0.1` in Railway.

### 4) Push schema and backfill draft links

After first deploy (or from Railway shell), run:

```bash
npx tsx script/push-schema.ts
npx tsx script/backfill-book-draft-links.ts
```

### 5) Stripe + domain cutover

- In Stripe, add/update webhook endpoint to:
  - `https://<your-railway-domain>/api/stripe/webhook`
- Test checkout/subscription flows.
- Point your custom domain DNS to Railway once validated.
- Keep Replit as temporary fallback until Railway traffic is stable.
