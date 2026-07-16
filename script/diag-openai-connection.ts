/**
 * Diagnose OpenAI connection failures — prints full error cause (not just "Connection error").
 *   npx tsx --import ./script/load-env.ts script/diag-openai-connection.ts
 */
import "./load-env.ts";
import OpenAI from "openai";
import https from "https";
import dns from "dns/promises";

console.log("=== OpenAI connection diagnosis ===\n");
console.log("OPENAI_API_KEY set:", !!process.env.OPENAI_API_KEY, "len:", (process.env.OPENAI_API_KEY || "").length);
console.log("AI_INTEGRATIONS key set:", !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
console.log("AI_INTEGRATIONS base:", process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "(none)");
console.log("NODE_OPTIONS:", process.env.NODE_OPTIONS || "(none)");
console.log("NODE_EXTRA_CA_CERTS:", process.env.NODE_EXTRA_CA_CERTS || "(none)");
console.log("Node version:", process.version);

try {
  const addrs = await dns.lookup("api.openai.com", { all: true });
  console.log("DNS api.openai.com:", addrs.map((a) => a.address).join(", "));
} catch (e: any) {
  console.log("DNS FAIL:", e.message);
}

function dumpErr(label: string, e: any, ms: number) {
  console.log(`\n${label} FAIL in ${ms}ms`);
  console.log("  name:", e?.name);
  console.log("  message:", e?.message);
  console.log("  status:", e?.status);
  console.log("  code:", e?.code);
  console.log("  type:", e?.type);
  const cause = e?.cause;
  if (cause) {
    console.log("  cause.message:", cause?.message);
    console.log("  cause.code:", cause?.code);
    console.log("  cause.errno:", cause?.errno);
    console.log("  cause.syscall:", cause?.syscall);
    console.log("  cause.hostname:", cause?.hostname);
    console.log("  cause.cert?:", cause?.cert ? "present" : "none");
  }
  if (e?.error) console.log("  api.error:", JSON.stringify(e.error).slice(0, 400));
  if (e?.stack) console.log("  stack top:", String(e.stack).split("\n").slice(0, 4).join(" | "));
}

async function tryCall(label: string, client: OpenAI, model: string, maxTokens: number) {
  const t0 = Date.now();
  try {
    const r = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Reply with exactly: OK" }],
      max_completion_tokens: maxTokens,
    });
    console.log(`\n${label} OK in ${Date.now() - t0}ms —`, JSON.stringify(r.choices[0]?.message?.content)?.slice(0, 80));
  } catch (e: any) {
    dumpErr(label, e, Date.now() - t0);
  }
}

const direct = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_KEY ? undefined : process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  timeout: 60_000,
  maxRetries: 0,
});

const replit = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  timeout: 60_000,
  maxRetries: 0,
});

console.log("\n--- HTTPS probe to api.openai.com ---");
await new Promise<void>((resolve) => {
  const req = https.get("https://api.openai.com/v1/models", { timeout: 15000 }, (res) => {
    console.log("HTTPS status:", res.statusCode, "(401/403 without key is fine — TLS worked)");
    res.resume();
    resolve();
  });
  req.on("error", (e: any) => {
    console.log("HTTPS probe FAIL:", e.message, "code:", e.code);
    resolve();
  });
  req.on("timeout", () => {
    console.log("HTTPS probe TIMEOUT");
    req.destroy();
    resolve();
  });
});

await tryCall("direct gpt-4o-mini", direct, "gpt-4o-mini", 20);
await tryCall("direct gpt-5.2 small", direct, "gpt-5.2", 20);
await tryCall("direct gpt-5.2 8k tokens", direct, "gpt-5.2", 8000);

if (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
  await tryCall("replit gpt-4o-mini", replit, "gpt-4o-mini", 20);
  await tryCall("replit gpt-5.2", replit, "gpt-5.2", 20);
} else {
  console.log("\n(Skipping Replit client — no AI_INTEGRATIONS env)");
}

console.log("\n=== Done ===");
