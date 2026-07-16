/**
 * Kick off overnight pipeline on the RUNNING dev server (no Content Studio buttons needed).
 *   npm run overnight:start
 *
 * Keep `npm run dev` running — the pipeline runs inside that process.
 */
import "./load-env.ts";
import fs from "fs";
import path from "path";

const BASE = process.env.OVERNIGHT_BASE_URL || `http://127.0.0.1:${process.env.PORT || "5000"}`;
const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error("ADMIN_PASSWORD missing from .env");
  process.exit(1);
}

async function login(): Promise<string> {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status}) — is npm run dev running on ${BASE}?`);
  const data = await res.json();
  if (!data.token) throw new Error("No admin token returned");
  return data.token as string;
}

const token = await login();
const res = await fetch(`${BASE}/api/content-studio/overnight-pipeline`, {
  method: "POST",
  headers: { "x-admin-token": token },
});
const body = await res.json();
if (!res.ok) {
  console.error("Failed:", body);
  process.exit(1);
}

const logLine = `[${new Date().toISOString()}] ${body.message}\n`;
const logPath = path.join(process.cwd(), "overnight-pipeline.log");
fs.appendFileSync(logPath, logLine);
console.log(body.message);
console.log(`\nLog: ${logPath}`);
console.log("Keep the dev server terminal open overnight.");
console.log("Watch server logs for [Overnight] lines, or poll GET /api/content-studio/overnight-status");
