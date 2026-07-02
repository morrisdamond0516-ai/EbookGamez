import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";
import * as fs from "fs";
import { books, draftEbooks } from "../shared/schema";

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  const pubBooks = await db.select({ coverUrl: books.coverUrl }).from(books);
  const drafts = await db.select({ coverUrl: draftEbooks.coverUrl, backgroundUrl: draftEbooks.backgroundUrl }).from(draftEbooks);

  const usedFiles = new Set<string>();

  for (const b of pubBooks) {
    if (b.coverUrl?.startsWith("/uploads/covers/")) {
      usedFiles.add(b.coverUrl.replace("/uploads/covers/", ""));
    }
  }
  for (const d of drafts) {
    if (d.coverUrl?.startsWith("/uploads/covers/")) {
      usedFiles.add(d.coverUrl.replace("/uploads/covers/", ""));
    }
    if (d.backgroundUrl?.startsWith("/uploads/covers/")) {
      usedFiles.add(d.backgroundUrl.replace("/uploads/covers/", ""));
    }
  }

  const allFiles = fs.readdirSync("./uploads/covers").filter((f: string) =>
    f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg")
  );
  const orphaned = allFiles.filter((f: string) => !usedFiles.has(f));

  console.log("Total files on disk:", allFiles.length);
  console.log("Referenced by DB:", usedFiles.size);
  console.log("Orphaned (safe to delete):", orphaned.length);

  let orphanSize = 0;
  let usedSize = 0;
  for (const f of allFiles) {
    const stat = fs.statSync("./uploads/covers/" + f);
    if (usedFiles.has(f)) usedSize += stat.size;
    else orphanSize += stat.size;
  }
  console.log("Orphaned size:", (orphanSize / 1024 / 1024 / 1024).toFixed(2) + " GB");
  console.log("Used size:", (usedSize / 1024 / 1024 / 1024).toFixed(2) + " GB");

  fs.writeFileSync("./uploads/orphaned-covers.json", JSON.stringify(orphaned));
  console.log("Orphan list saved to ./uploads/orphaned-covers.json");

  await pool.end();
}

main().catch(console.error);
