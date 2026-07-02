import { Storage } from "@google-cloud/storage";
import fs from "fs";
import path from "path";
import { Pool } from "pg";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const COVERS_DIR = path.join(process.cwd(), "uploads", "covers");
const BATCH_SIZE = 10;

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function getBucketName(): string {
  const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
  const p = publicPaths.split(",").filter(s => s.trim());
  if (p.length === 0) throw new Error("No PUBLIC_OBJECT_SEARCH_PATHS set");
  return p[0].split("/")[1];
}

async function main() {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const { rows: books } = await pool.query(
    `SELECT id, cover_url FROM books WHERE cover_url LIKE '/uploads/covers/%'`
  );
  console.log(`Found ${books.length} books with local cover URLs`);

  let migrated = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < books.length; i += BATCH_SIZE) {
    const batch = books.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (book: any) => {
      const filename = book.cover_url.replace("/uploads/covers/", "");
      const localPath = path.join(COVERS_DIR, filename);

      if (!fs.existsSync(localPath)) {
        console.log(`SKIP (missing file): ${filename}`);
        skipped++;
        return;
      }

      try {
        const objectPath = `public/covers/${filename}`;
        const file = bucket.file(objectPath);
        const [exists] = await file.exists();
        if (exists) {
          const newUrl = `/objstore/covers/${filename}`;
          await pool.query(`UPDATE books SET cover_url = $1 WHERE id = $2`, [newUrl, book.id]);
          migrated++;
          console.log(`EXISTS+UPDATED [${migrated}/${books.length}]: ${filename}`);
          return;
        }

        const buffer = fs.readFileSync(localPath);
        await file.save(buffer, {
          contentType: "image/png",
          metadata: { metadata: { bookId: String(book.id) } },
        });

        const newUrl = `/objstore/covers/${filename}`;
        await pool.query(`UPDATE books SET cover_url = $1 WHERE id = $2`, [newUrl, book.id]);
        migrated++;
        console.log(`MIGRATED [${migrated}/${books.length}]: ${filename}`);
      } catch (err: any) {
        failed++;
        console.error(`FAILED: ${filename} - ${err.message}`);
      }
    }));
    console.log(`Progress: ${i + batch.length}/${books.length} processed (${migrated} migrated, ${failed} failed, ${skipped} skipped)`);
  }

  console.log(`\nDone! Migrated: ${migrated}, Failed: ${failed}, Skipped: ${skipped}`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
