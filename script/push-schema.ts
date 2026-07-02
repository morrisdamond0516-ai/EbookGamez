/**
 * Non-interactive schema push for local setup.
 * Use when `drizzle-kit push` cannot run in a TTY (CI, IDE terminals).
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { pushSchema } from "drizzle-kit/api";
import pg from "pg";
import * as schema from "../shared/schema";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const db = drizzle(pool, { schema });

async function legacyUsersTableExists(): Promise<boolean> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'`,
    );
    return result.rowCount !== null && result.rowCount > 0;
  } finally {
    client.release();
  }
}

try {
  const skipUsers = await legacyUsersTableExists();
  const schemaToPush = skipUsers
    ? (() => {
        const { users: _users, ...rest } = schema;
        return rest;
      })()
    : schema;

  if (skipUsers) {
    console.log("Existing legacy `users` table detected — skipping (app uses `customers` for auth).");
  }

  console.log("Pushing database schema...");
  const result = await pushSchema(schemaToPush, db);

  if (result.statementsToExecute.length === 0) {
    console.log("Schema is already up to date.");
  } else {
    console.log(`Applying ${result.statementsToExecute.length} statement(s)...`);
    if (result.warnings.length > 0) {
      console.warn("Warnings:", result.warnings.join("\n"));
    }
    if (result.hasDataLoss) {
      console.warn("This push includes statements that may cause data loss.");
    }
    await result.apply();
    console.log("Schema applied successfully.");
  }
} catch (err) {
  console.error("Failed to push schema:", err);
  process.exit(1);
} finally {
  await pool.end();
}
