import "./load-env.ts";
import { db } from "../server/storage";
import { books, draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";

const [b682] = await db.select().from(books).where(eq(books.id, 682));
const [d682] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 682));
console.log("book 682:", b682 ? `${b682.title} genre=${b682.genre}` : "none");
console.log("draft 682:", d682 ? `${d682.title} genre=${d682.genre} status=${d682.status}` : "none");

const BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";
const login = await fetch(`${BASE}/api/admin/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ password: process.env.ADMIN_PASSWORD }),
});
const { token } = (await login.json()) as { token: string };

for (const id of [682, 609]) {
  const r = await fetch(`${BASE}/api/books/${id}`);
  if (r.ok) {
    const b = await r.json();
    console.log(`prod book ${id}:`, b.title?.slice(0, 50), b.genre);
  }
}

// read endpoint content sample
const read = await fetch(`${BASE}/api/content-studio/drafts/682/read?bookId=609`, {
  headers: { "x-admin-token": token },
});
if (read.ok) {
  const data = (await read.json()) as { content?: string };
  const n = (data.content?.match(/\[ILLUSTRATION:/gi) || []).length;
  console.log("prod read draft 682 markers:", n);
}
