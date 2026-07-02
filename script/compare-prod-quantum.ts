import pg from "pg";

const PRODUCTION_BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";

async function loginAdmin(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD not set");
  const res = await fetch(`${PRODUCTION_BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

const token = await loginAdmin();
console.log("Logged in to production\n");

for (const id of [71, 140]) {
  const res = await fetch(`${PRODUCTION_BASE}/api/content-studio/drafts/${id}`, {
    headers: { "x-admin-token": token },
  });
  if (!res.ok) {
    console.log(`Draft #${id}: HTTP ${res.status}`);
    continue;
  }
  const d = await res.json();
  console.log(`Draft #${id}: ${d.title}`);
  console.log(`  coverUrl: ${d.coverUrl || "(none)"}`);
  console.log(`  backgroundUrl: ${d.backgroundUrl || "(none)"}`);
  console.log();
}

const listRes = await fetch(`${PRODUCTION_BASE}/api/content-studio/drafts?status=published`, {
  headers: { "x-admin-token": token },
});
const list = await listRes.json();
const quantum = list.filter((d: { title: string }) => /future of quantum/i.test(d.title));
console.log("Published drafts matching 'future of quantum' on PRODUCTION:");
for (const d of quantum) {
  console.log(`  [#${d.id}] cover=${d.coverUrl || "NONE"} | ${d.title?.slice(0, 60)}`);
}

// Local comparison
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const local = await client.query(`SELECT id, cover_url FROM draft_ebooks WHERE id IN (71,140)`);
console.log("\nLOCAL:");
for (const r of local.rows) console.log(`  #${r.id} cover=${r.cover_url || "NONE"}`);
await client.end();
