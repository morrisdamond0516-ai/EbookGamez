/**
 * Emergency stop: halt content + illustration generation on production.
 * Usage: npx tsx --env-file=.env script/emergency-stop-prod-gen.ts [https://ebookgamez.com]
 */
const url = (process.argv[2] || "https://ebookgamez.com").replace(/\/$/, "");
const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error("ADMIN_PASSWORD not set");
  process.exit(1);
}

const login = await fetch(`${url}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password }),
  signal: AbortSignal.timeout(15000),
});
if (!login.ok) {
  console.error("Login failed", login.status, (await login.text()).slice(0, 200));
  process.exit(1);
}
const { token } = (await login.json()) as { token?: string };
if (!token) {
  console.error("No token returned");
  process.exit(1);
}
const headers = { "Content-Type": "application/json", "x-admin-token": token };

for (const path of [
  "/api/content-studio/stop-content-gen",
  "/api/content-studio/stop-regeneration",
]) {
  const r = await fetch(`${url}${path}`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(15000),
  });
  console.log(path, r.status, await r.text());
}

const status = await fetch(`${url}/api/content-studio/content-gen-status`, {
  headers,
  signal: AbortSignal.timeout(15000),
});
console.log("content-gen-status", status.status, await status.text());

try {
  const illust = await fetch(`${url}/api/content-studio/illustration-progress`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  console.log("illustration-progress", illust.status, await illust.text());
} catch {
  console.log("illustration-progress endpoint unavailable");
}

process.exit(0);
