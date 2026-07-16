import "./load-env.ts";
import { normalizeActivityBookContent } from "../shared/activityBookContent.ts";

const BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";
const login = await fetch(`${BASE}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
});
const { token } = (await login.json()) as { token: string };

for (const id of [359, 525]) {
  const d = (await (
    await fetch(`${BASE}/api/content-studio/drafts/${id}`, { headers: { "x-admin-token": token } })
  ).json()) as { content: string; genre: string };
  const norm = normalizeActivityBookContent(d.content);
  const markers = [...norm.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)];
  const resolved = markers.filter((m) => m[1].trim().startsWith("/"));
  const withBracketInCaption = markers.filter((m) => m[1].includes("]"));
  const brokenRegex = markers.filter((m) => {
    const full = m[0];
    const re = /\[ILLUSTRATION:\s*(.+?)\]/i;
    const m2 = full.match(re);
    return !m2 || !m2[1].includes("/objstore/");
  });
  console.log(`#${id} genre=${d.genre} markers=${markers.length} resolved=${resolved.length}`);
  console.log(`  bracket in caption: ${withBracketInCaption.length}, regex issues: ${brokenRegex.length}`);
  if (brokenRegex[0]) console.log(`  sample issue: ${brokenRegex[0][0].slice(0, 120)}`);
}
