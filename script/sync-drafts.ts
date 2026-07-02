/**
 * Sync draft_ebooks (full book text) from production into local PostgreSQL.
 * Requires ADMIN_PASSWORD in .env to match production admin password.
 *
 * Run: npm run sync:drafts
 */
import pg from "pg";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { draftEbooks, books } from "../shared/schema";
import { eq, inArray } from "drizzle-orm";

const PRODUCTION_BASE = process.env.SYNC_BASE_URL || "https://ebookgamez.com";
const CONCURRENCY = 4;

async function productionFetch(path: string, init: RequestInit = {}, token?: string) {
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers["x-admin-token"] = token;
  return fetch(`${PRODUCTION_BASE}${path}`, { ...init, headers });
}

async function loginAdmin(): Promise<string> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error("ADMIN_PASSWORD is not set in .env");
  const res = await productionFetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    throw new Error(`Production admin login failed (${res.status}). Ensure ADMIN_PASSWORD matches production.`);
  }
  const data = await res.json();
  if (!data.token) throw new Error("No admin token returned from production");
  return data.token;
}

type DraftListItem = {
  id: number;
  title: string;
  genre: string;
  topic?: string;
  contentWordCount?: number;
  publishedBookId?: number | null;
  status: string;
};

type DraftFull = DraftListItem & {
  description?: string | null;
  outline?: string | null;
  content?: string | null;
  coverUrl?: string | null;
  cover_url?: string | null;
  backgroundUrl?: string | null;
  background_url?: string | null;
  pdfUrl?: string | null;
  pdf_url?: string | null;
  suggestedPrice?: string | null;
  suggested_price?: string | null;
  coverStyleId?: string | null;
  cover_style_id?: string | null;
  overlayApproved?: boolean;
  overlay_approved?: boolean;
  createdAt?: string;
  created_at?: string;
};

function localCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Keep /objstore/ URLs from production — they are served from cloud storage.
  // Only normalize legacy paths that already point at local uploads.
  return url;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const token = await loginAdmin();
console.log("Logged in to production admin");

const localBookRows = await db.select({ id: books.id }).from(books);
const localBookIds = new Set(localBookRows.map((b) => b.id));
console.log(`Local catalog: ${localBookIds.size} book(s)`);

const listRes = await productionFetch("/api/content-studio/drafts?status=published", {}, token);
if (!listRes.ok) throw new Error(`Failed to list drafts: ${listRes.status}`);
const draftsList = (await listRes.json()) as DraftListItem[];

const toSync = draftsList.filter((d) => {
  const words = d.contentWordCount ?? 0;
  if (words <= 100) return false;
  if (d.publishedBookId != null) return localBookIds.has(d.publishedBookId);
  return true;
});
console.log(`Syncing ${toSync.length} draft(s) matched to local books`);

let imported = 0;
let updated = 0;
let failed = 0;

for (let i = 0; i < toSync.length; i += CONCURRENCY) {
  const batch = toSync.slice(i, i + CONCURRENCY);
  await Promise.all(
    batch.map(async (item) => {
      try {
        const res = await productionFetch(`/api/content-studio/drafts/${item.id}`, {}, token);
        if (!res.ok) {
          console.warn(`  FAIL draft ${item.id}: HTTP ${res.status}`);
          failed++;
          return;
        }
        const draft = (await res.json()) as DraftFull;
        if (!draft.content || draft.content.length < 100) {
          failed++;
          return;
        }

        const coverUrl = localCoverUrl(draft.coverUrl ?? draft.cover_url);
        const backgroundUrl = localCoverUrl(draft.backgroundUrl ?? draft.background_url);

        const values = {
          title: draft.title,
          genre: draft.genre,
          topic: draft.topic || draft.title,
          description: draft.description ?? null,
          outline: draft.outline ?? null,
          content: draft.content,
          coverUrl,
          backgroundUrl,
          pdfUrl: draft.pdfUrl ?? draft.pdf_url ?? null,
          suggestedPrice: draft.suggestedPrice ?? draft.suggested_price ?? null,
          status: draft.status || "published",
          coverStyleId: draft.coverStyleId ?? draft.cover_style_id ?? null,
          overlayApproved: draft.overlayApproved ?? draft.overlay_approved ?? false,
        };

        const existing = await db
          .select({ id: draftEbooks.id })
          .from(draftEbooks)
          .where(eq(draftEbooks.id, draft.id))
          .limit(1);

        if (existing.length > 0) {
          await db.update(draftEbooks).set(values).where(eq(draftEbooks.id, draft.id));
          updated++;
        } else {
          await db.execute(sql`
            INSERT INTO draft_ebooks (
              id, title, genre, topic, description, outline, content,
              cover_url, background_url, pdf_url, suggested_price, status,
              cover_style_id, overlay_approved, created_at
            ) VALUES (
              ${draft.id}, ${values.title}, ${values.genre}, ${values.topic},
              ${values.description}, ${values.outline}, ${values.content},
              ${coverUrl}, ${backgroundUrl}, ${values.pdfUrl}, ${values.suggestedPrice},
              ${values.status}, ${values.coverStyleId}, ${values.overlayApproved},
              ${draft.createdAt ?? draft.created_at ?? new Date().toISOString()}
            )
            ON CONFLICT (id) DO UPDATE SET
              title = EXCLUDED.title,
              genre = EXCLUDED.genre,
              topic = EXCLUDED.topic,
              description = EXCLUDED.description,
              outline = EXCLUDED.outline,
              content = EXCLUDED.content,
              cover_url = EXCLUDED.cover_url,
              background_url = EXCLUDED.background_url,
              pdf_url = EXCLUDED.pdf_url,
              suggested_price = EXCLUDED.suggested_price,
              status = EXCLUDED.status,
              cover_style_id = EXCLUDED.cover_style_id,
              overlay_approved = EXCLUDED.overlay_approved
          `);
          imported++;
        }
      } catch (err: any) {
        console.warn(`  FAIL draft ${item.id}: ${err.message}`);
        failed++;
      }
    }),
  );

  if ((i + CONCURRENCY) % 40 === 0 || i + CONCURRENCY >= toSync.length) {
    console.log(`Progress: ${Math.min(i + CONCURRENCY, toSync.length)}/${toSync.length} (imported ${imported}, updated ${updated}, failed ${failed})`);
  }
}

await db.execute(sql`SELECT setval('draft_ebooks_id_seq', (SELECT COALESCE(MAX(id), 1) FROM draft_ebooks), true)`);

console.log(`\nDone. Imported: ${imported}, Updated: ${updated}, Failed: ${failed}`);
await pool.end();
