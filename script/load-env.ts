/**
 * Load .env and override Windows/system DATABASE_URL (e.g. stale Neon from Replit).
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// Windows only: help child processes avoid OpenAI TLS leaf errors.
// Do not set on Linux/Replit — Node rejects --use-system-ca in NODE_OPTIONS there.
if (
  process.platform === "win32" &&
  !process.env.NODE_OPTIONS?.includes("use-system-ca")
) {
  process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, "--use-system-ca"]
    .filter(Boolean)
    .join(" ");
}
