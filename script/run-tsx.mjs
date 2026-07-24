/**
 * Run a tsx script with Windows OpenAI TLS fix (--use-system-ca).
 * Replit/Linux: no special flag (Node rejects it in NODE_OPTIONS there).
 *
 *   node script/run-tsx.mjs script/audit-illustration-scene-fit.ts --draft 725
 */
import { spawn } from "child_process";
import process from "process";

const scriptArgs = process.argv.slice(2);
if (scriptArgs.length === 0) {
  console.error("Usage: node script/run-tsx.mjs <script.ts> [args...]");
  process.exit(1);
}

const env = { ...process.env };
if (process.platform === "win32") {
  const parts = [env.NODE_OPTIONS, "--use-system-ca"].filter(Boolean);
  env.NODE_OPTIONS = [...new Set(parts.join(" ").split(/\s+/).filter(Boolean))].join(" ");
}

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", "--import", "./script/load-env.ts", ...scriptArgs],
  { stdio: "inherit", env, shell: process.platform === "win32" },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
