import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks, books } from "@shared/schema";
import { eq } from "drizzle-orm";

const [d682] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 682));
const [b609] = await db.select().from(books).where(eq(books.id, 609));
const c = d682?.content || "";

console.log("draft 682:", d682?.title?.slice(0, 60));
console.log("book 609:", b609?.title?.slice(0, 60), "sourceDraftId=", b609?.sourceDraftId);

for (const p of ["high-quality illustration", "ILLUSTRATION:", "IMAGE:"]) {
  const n = (c.match(new RegExp(p, "gi")) || []).length;
  if (n) console.log(`  ${p}: ${n}`);
}

const BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";
const login = await fetch(`${BASE}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
});
const { token } = (await login.json()) as { token: string };

for (const id of [682, 609]) {
  const draftRes = await fetch(`${BASE}/api/content-studio/drafts/${id}`, {
    headers: { "x-admin-token": token },
  });
  if (draftRes.ok) {
    const d = (await draftRes.json()) as { content?: string; genre?: string; title?: string };
    const n = (d.content?.match(/\[ILLUSTRATION:/gi) || []).length;
    console.log(`prod draft ${id}: markers=${n} genre=${d.genre}`);
  } else {
    const bookRes = await fetch(`${BASE}/api/books/${id}`);
    if (bookRes.ok) {
      const b = await bookRes.json();
      console.log(`prod book ${id}:`, b.title?.slice(0, 50), "genre", b.genre);
    }
  }
}

const prev = await fetch(`${BASE}/api/books/609/preview`);
const prevData = (await prev.json()) as { content?: string };
const pc = prevData.content || "";
const markers = [...pc.matchAll(/\[ILLUSTRATION:\s*([^\]]+)\]/gi)];
console.log(`\nprod preview book 609: ${markers.length} markers`);
for (const m of markers.slice(0, 5)) console.log(`  ${m[0].slice(0, 100)}`);

// find readable draft for book 609
const draftIdRes = await fetch(`${BASE}/api/books/609/draft-id`, {
  headers: { "x-admin-token": token },
});
console.log("prod book 609 draft-id:", await draftIdRes.json());
