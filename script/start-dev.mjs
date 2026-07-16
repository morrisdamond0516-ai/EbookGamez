/**
 * Start the API in development. Only Windows gets --use-system-ca
 * (OpenAI TLS). Replit/Linux Node rejects that flag in NODE_OPTIONS.
 */
import { spawn } from "child_process";
import process from "process";

const env = { ...process.env, NODE_ENV: process.env.NODE_ENV || "development" };

if (process.platform === "win32") {
  const parts = [env.NODE_OPTIONS, "--use-system-ca"].filter(Boolean);
  env.NODE_OPTIONS = [...new Set(parts.join(" ").split(/\s+/).filter(Boolean))].join(" ");
}

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", "--import", "./script/load-env.ts", "server/index.ts"],
  { stdio: "inherit", env, shell: process.platform === "win32" },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
