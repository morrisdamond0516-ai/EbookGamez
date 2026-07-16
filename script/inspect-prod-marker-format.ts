import "./load-env.ts";

const BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";
const login = await fetch(`${BASE}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
});
const { token } = (await login.json()) as { token: string };

for (const id of [359, 525]) {
  const res = await fetch(`${BASE}/api/content-studio/drafts/${id}`, {
    headers: { "x-admin-token": token },
  });
  const d = (await res.json()) as { title?: string; genre?: string; content?: string };
  const c = d.content || "";
  console.log(`\n=== #${id} genre=${d.genre} ===`);

  const markers = [...c.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)];
  console.log(`total markers: ${markers.length}`);
  for (const m of markers.slice(0, 8)) {
    const full = m[0];
    const idx = m.index!;
    const lineStart = c.lastIndexOf("\n", idx) + 1;
    const lineEnd = c.indexOf("\n", idx);
    const line = c.slice(lineStart, lineEnd === -1 ? c.length : lineEnd);
    const prevLineStart = c.lastIndexOf("\n", lineStart - 2) + 1;
    const prevLine = c.slice(prevLineStart, lineStart - 1);
    console.log(`\n  marker: ${full.slice(0, 90)}`);
    console.log(`  on own line: ${line.trim() === full.trim()}`);
    console.log(`  line: ${JSON.stringify(line.slice(0, 120))}`);
    if (prevLine.trim()) console.log(`  prev: ${JSON.stringify(prevLine.slice(0, 80))}`);
  }

  // chapter distribution
  const chapters = [...c.matchAll(/##\s*Chapter\s+(\d+)/gi)];
  for (let i = 0; i < Math.min(chapters.length, 6); i++) {
    const start = chapters[i].index!;
    const end = i + 1 < chapters.length ? chapters[i + 1].index! : c.length;
    const ch = c.slice(start, end);
    const n = (ch.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
    const chNum = chapters[i][1];
    console.log(`  ch${chNum} resolved images: ${n}`);
  }
}
