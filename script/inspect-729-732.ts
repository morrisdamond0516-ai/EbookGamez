import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { inArray } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { coverFilenameFromUrl } from "../server/coverStorage";

const ids = [729, 730, 731, 732];
const rows = await db
  .select({
    id: draftEbooks.id,
    title: draftEbooks.title,
    genre: draftEbooks.genre,
    status: draftEbooks.status,
    coverStyleId: draftEbooks.coverStyleId,
    coverUrl: draftEbooks.coverUrl,
    backgroundUrl: draftEbooks.backgroundUrl,
    overlayApproved: draftEbooks.overlayApproved,
  })
  .from(draftEbooks)
  .where(inArray(draftEbooks.id, ids));

for (const r of rows.sort((a, b) => a.id - b.id)) {
  const urls = [r.coverUrl, r.backgroundUrl].filter(Boolean) as string[];
  const files = urls.map((u) => {
    const f = coverFilenameFromUrl(u);
    const local = f ? path.join(process.cwd(), "uploads", "covers", f) : null;
    return { url: u, exists: local ? fs.existsSync(local) : false, local };
  });
  console.log(`\n#${r.id} ${r.title}`);
  console.log(`  status=${r.status} style=${r.coverStyleId} overlay=${r.overlayApproved}`);
  console.log(`  cover=${r.coverUrl}`);
  console.log(`  bg=${r.backgroundUrl}`);
  for (const f of files) console.log(`  file ok=${f.exists} ${f.local}`);
}
