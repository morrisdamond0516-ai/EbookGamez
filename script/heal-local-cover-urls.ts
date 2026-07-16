/**
 * Heal draft/book cover URLs for Cursor/local dev:
 * - Rewrite /objstore/covers/ → /uploads/covers/ when the file exists on disk
 * - Report drafts with URLs but missing files (need regeneration)
 *
 * Run: npm run heal:local-covers
 */
import "./load-env.ts";
import pg from "pg";
import { ensureCoverPersisted, coverFilenameFromUrl, coverFileExistsLocally, isLocalWorkspaceMode } from "../server/coverStorage";

if (!isLocalWorkspaceMode()) {
  console.log("GCS is configured — this script is for local/Cursor workspaces only.");
  process.exit(0);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

let healed = 0;
let missing = 0;
let ok = 0;

async function healTable(table: "draft_ebooks" | "books", idCol: string) {
  const urlCol = table === "draft_ebooks" ? "cover_url, background_url" : "cover_url";
  const rows = await client.query(
    table === "draft_ebooks"
      ? `SELECT id, title, cover_url, background_url FROM draft_ebooks
         WHERE cover_url LIKE '/objstore/covers/%' OR background_url LIKE '/objstore/covers/%'
            OR cover_url LIKE '/uploads/covers/%' OR background_url LIKE '/uploads/covers/%'`
      : `SELECT id, title, cover_url FROM books
         WHERE cover_url LIKE '/objstore/covers/%' OR cover_url LIKE '/uploads/covers/%'`,
  );

  for (const row of rows.rows) {
    const urls: Array<{ field: string; value: string | null }> =
      table === "draft_ebooks"
        ? [
            { field: "cover_url", value: row.cover_url },
            { field: "background_url", value: row.background_url },
          ]
        : [{ field: "cover_url", value: row.cover_url }];

    let newCover = row.cover_url as string | null;
    let newBg = row.background_url as string | null;
    let changed = false;

    for (const { field, value } of urls) {
      if (!value) continue;
      const filename = coverFilenameFromUrl(value);
      if (!filename) continue;

      if (coverFileExistsLocally(value)) {
        const fixed = await ensureCoverPersisted(value);
        if (fixed && fixed !== value) {
          if (field === "cover_url") newCover = fixed;
          else newBg = fixed;
          changed = true;
          healed++;
          console.log(`  healed #${row.id} ${row.title} ${field}: ${value} → ${fixed}`);
        } else {
          ok++;
        }
      } else {
        missing++;
        console.warn(`  MISSING file for #${row.id} ${row.title} (${field}): ${filename}`);
      }
    }

    if (changed && table === "draft_ebooks") {
      await client.query("UPDATE draft_ebooks SET cover_url = $1, background_url = $2 WHERE id = $3", [
        newCover,
        newBg,
        row.id,
      ]);
    } else if (changed) {
      await client.query("UPDATE books SET cover_url = $1 WHERE id = $2", [newCover, row.id]);
    }
  }
}

console.log("=== Healing draft covers ===");
await healTable("draft_ebooks", "id");
console.log("\n=== Healing catalog book covers ===");
await healTable("books", "id");

console.log(`\nDone: ${healed} URL(s) healed, ${ok} already correct, ${missing} missing file(s)`);
await client.end();
