/**
 * Compare production (ebookgamez.com) illustration state for drafts #359 vs #525.
 */
import "./load-env.ts";

const BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";
const IDS = [359, 525];

const login = await fetch(`${BASE}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
});
if (!login.ok) throw new Error(`login ${login.status}`);
const { token } = await login.json();

function analyze(content: string) {
  const resolved = (content.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
  const stripped = (content.match(/high-quality illustration needed here/gi) || []).length;
  const pending = [...content.matchAll(/\[ILLUSTRATION:\s*(.+?)\]/gi)].filter((m) => {
    const s = m[1].trim();
    return !(s.startsWith("/") || s.startsWith("http"));
  }).length;
  const files = [...new Set([...content.matchAll(/\/(?:uploads|objstore)\/illustrations\/(illust-[^\s|"\]]+\.png)/gi)].map((m) => m[1]))];
  const objstore = (content.match(/\/objstore\/illustrations\//g) || []).length;
  const uploads = (content.match(/\/uploads\/illustrations\//g) || []).length;
  return { resolved, stripped, pending, files, objstore, uploads };
}

async function probeUrl(url: string): Promise<{ status: number; bytes: number }> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
    const len = parseInt(res.headers.get("content-length") || "0", 10);
    return { status: res.status, bytes: len };
  } catch {
    return { status: 0, bytes: 0 };
  }
}

for (const id of IDS) {
  const res = await fetch(`${BASE}/api/content-studio/drafts/${id}`, {
    headers: { "x-admin-token": token },
  });
  if (!res.ok) {
    console.log(`\n#${id}: fetch failed ${res.status}`);
    continue;
  }
  const d = (await res.json()) as { title?: string; status?: string; content?: string };
  const c = d.content || "";
  const a = analyze(c);
  console.log(`\n#${id} [${d.status}] ${(d.title || "").slice(0, 55)}`);
  console.log(`  resolved=${a.resolved} stripped=${a.stripped} pending=${a.pending} unique_files=${a.files.length}`);
  console.log(`  objstore_refs=${a.objstore} uploads_refs=${a.uploads}`);

  const sample = a.files.slice(0, 5);
  let okObj = 0;
  let okUp = 0;
  let miss = 0;
  for (const fname of sample) {
    const o = await probeUrl(`${BASE}/objstore/illustrations/${encodeURIComponent(fname)}`);
    const u = await probeUrl(`${BASE}/uploads/illustrations/${encodeURIComponent(fname)}`);
    const reachable = o.status === 200 || u.status === 200;
    if (o.status === 200) okObj++;
    if (u.status === 200) okUp++;
    if (!reachable) miss++;
    console.log(`  ${fname}: objstore=${o.status} uploads=${u.status}`);
  }

  // Full probe count (first 45 max)
  let fullOk = 0;
  let fullMiss = 0;
  for (const fname of a.files) {
    const o = await probeUrl(`${BASE}/objstore/illustrations/${encodeURIComponent(fname)}`);
    const u = await probeUrl(`${BASE}/uploads/illustrations/${encodeURIComponent(fname)}`);
    if (o.status === 200 || u.status === 200) fullOk++;
    else fullMiss++;
  }
  console.log(`  ALL files reachable on prod: ${fullOk}/${a.files.length}, missing: ${fullMiss}`);

  if (a.stripped > 0) {
    const idx = c.indexOf("high-quality illustration needed here");
    console.log(`  stripped sample: ${JSON.stringify(c.slice(Math.max(0, idx - 40), idx + 80))}`);
  }
  if (a.resolved === 0 && a.pending === 0 && a.stripped === 0) {
    const ill = [...c.matchAll(/\[ILLUSTRATION:[^\]]+\]/gi)].slice(0, 3);
    console.log(`  illustration markers sample:`, ill.map((m) => m[0].slice(0, 100)));
  }
}
