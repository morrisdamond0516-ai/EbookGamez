import "./load-env.ts";

const BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";

async function adminToken() {
  const login = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
  });
  const { token } = (await login.json()) as { token: string };
  return token;
}

const token = await adminToken();
const draft = (await (
  await fetch(`${BASE}/api/content-studio/drafts/359`, { headers: { "x-admin-token": token } })
).json()) as { title: string; genre: string };

const listRes = await fetch(`${BASE}/api/books?limit=500`);
const listData = (await listRes.json()) as { books?: Array<{ id: number; title: string; genre: string; sourceDraftId?: number }> };
const books = listData.books || (listData as unknown as Array<{ id: number; title: string; genre: string; sourceDraftId?: number }>);

const matches = books.filter((b) => b.title === draft.title || b.sourceDraftId === 359);
console.log("draft #359:", draft.title, "genre=", draft.genre);
console.log("catalog matches:", matches);

for (const b of matches) {
  const preview = await fetch(`${BASE}/api/books/${b.id}/preview`);
  const prev = (await preview.json()) as { content?: string; genre?: string; error?: string };
  const c = prev.content || "";
  const resolved = (c.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
  console.log(`\nbook #${b.id} genre=${b.genre} preview status=${preview.status}`);
  console.log(`  preview resolved illus: ${resolved}, content len=${c.length}`);
  if (resolved === 0) {
    const sample = c.split("\n").slice(0, 15).join("\n");
    console.log("  preview start:\n", sample.slice(0, 500));
  }

  const draftIdRes = await fetch(`${BASE}/api/books/${b.id}/draft-id`, {
    headers: { "x-admin-token": token },
  });
  const draftIdData = await draftIdRes.json();
  console.log(`  draft-id endpoint:`, draftIdRes.status, draftIdData);

  if (draftIdData.draftId) {
    const d2 = (await (
      await fetch(`${BASE}/api/content-studio/drafts/${draftIdData.draftId}`, {
        headers: { "x-admin-token": token },
      })
    ).json()) as { content?: string; genre?: string };
    const c2 = d2.content || "";
    const r2 = (c2.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
    console.log(`  readable draft #${draftIdData.draftId} genre=${d2.genre} resolved=${r2}`);
  }
}
