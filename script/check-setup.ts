/**
 * Validates local dev prerequisites and prints next steps.
 */
import "./load-env.ts";
import pg from "pg";

const required = ["DATABASE_URL", "ADMIN_PASSWORD", "STRIPE_SECRET_KEY", "STRIPE_PUBLISHABLE_KEY"] as const;
const recommended = ["OPENAI_API_KEY", "SESSION_SECRET"] as const;

let ok = true;

console.log("EbookGamez setup check\n");

for (const key of required) {
  if (!process.env[key]) {
    console.error(`✗ Missing required env var: ${key}`);
    ok = false;
  } else {
    console.log(`✓ ${key}`);
  }
}

for (const key of recommended) {
  if (!process.env[key]) {
    console.warn(`! Recommended env var not set: ${key}`);
  } else {
    console.log(`✓ ${key}`);
  }
}

if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.includes("localhost:1106") && process.env.OPENAI_API_KEY) {
  console.warn(
    "! AI_INTEGRATIONS_OPENAI_BASE_URL points at Replit sidecar (localhost:1106). " +
      "For local dev, remove that line from .env — OPENAI_API_KEY will use api.openai.com directly.",
  );
}

if (process.env.OPENAI_API_KEY) {
  try {
    const probe = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    });
    if (probe.status === 401 || probe.status === 200) {
      console.log("✓ OpenAI API reachable");
    } else {
      console.warn(`! OpenAI API returned HTTP ${probe.status}`);
    }
  } catch (err: any) {
    const tlsIssue = /certificate|UNABLE_TO_VERIFY/i.test(err?.message || "") || err?.cause?.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE";
    if (tlsIssue) {
      console.error(
        "✗ OpenAI API blocked by Windows TLS certificate verification. " +
          "Run dev with: npm run dev (uses NODE_OPTIONS=--use-system-ca).",
      );
      ok = false;
    } else {
      console.warn(`! OpenAI API probe failed: ${err?.message || err}`);
    }
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("\nCannot check database without DATABASE_URL.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: databaseUrl });
try {
  await client.connect();
  console.log("\n✓ Database connection");

  const tables = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('books', 'customers', 'subscription_plans')`,
  );
  const found = new Set(tables.rows.map((r) => r.tablename));
  const needed = ["books", "customers", "subscription_plans"];

  for (const table of needed) {
    if (found.has(table)) {
      console.log(`✓ Table: ${table}`);
    } else {
      console.error(`✗ Missing table: ${table}`);
      ok = false;
    }
  }

  if (!ok) {
    console.log("\nRun: npm run db:setup");
  } else {
    console.log("\nSetup looks good. Start the app with: npm run dev");
    console.log("Then open: http://127.0.0.1:" + (process.env.PORT || "5000"));
  }
} catch (err: any) {
  console.error("\n✗ Database connection failed:", err.message);
  console.log("\nEnsure PostgreSQL is running and DATABASE_URL in .env is correct.");
  console.log("Example: postgresql://postgres:YOUR_PASSWORD@localhost:5432/ebookgamez");
  process.exit(1);
} finally {
  await client.end();
}

process.exit(ok ? 0 : 1);
