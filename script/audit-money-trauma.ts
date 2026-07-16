import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks, books } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import {
  countResolvedIllustrationMarkers,
  countUnprocessedIllustrationMarkers,
} from "../shared/activityBookContent";

const titleMatch = "%Money Trauma%";
const drafts = await db
  .select()
  .from(draftEbooks)
  .where(sql`lower(${draftEbooks.title}) like lower(${titleMatch})`);

for (const d of drafts) {
  const content = d.content || "";
  const resolved = countResolvedIllustrationMarkers(content);
  const pending = countUnprocessedIllustrationMarkers(content);
  const allIllust = [...content.matchAll(/\[ILLUSTRATION:\s*(.+?)\]/gi)];
  const pathMarkers = allIllust.filter((m) => {
    const p = m[1].trim();
    return p.startsWith("/") || p.startsWith("http");
  });
  const textMarkers = allIllust.filter((m) => {
    const p = m[1].trim();
    return !p.startsWith("/") && !p.startsWith("http");
  });

  const [catalog] = await db
    .select()
    .from(books)
    .where(sql`lower(${books.title}) like lower(${titleMatch})`);

  console.log(`\n=== Draft #${d.id} ===`);
  console.log(`status: ${d.status} | published_at: ${d.publishedAt}`);
  console.log(`title: ${d.title}`);
  console.log(`content length: ${content.length}`);
  console.log(`resolved image URLs in content: ${resolved}`);
  console.log(`pending text markers: ${pending}`);
  console.log(`catalog #${catalog?.id} visible=${catalog?.visible} source_draft=${catalog?.sourceDraftId}`);

  console.log("\nFirst 3 RESOLVED (image paths):");
  for (const m of pathMarkers.slice(0, 3)) {
    console.log(`  ${m[0].slice(0, 140)}`);
  }

  console.log("\nFirst 3 PENDING (text-only):");
  for (const m of textMarkers.slice(0, 3)) {
    console.log(`  ${m[0].slice(0, 140)}`);
  }

  // Check if any resolved paths point to missing files
  let missingFiles = 0;
  let checked = 0;
  const fs = await import("fs");
  const path = await import("path");
  for (const m of pathMarkers.slice(0, 20)) {
    const src = m[1].trim().split(" | ")[0].trim();
    if (!src.startsWith("/uploads/")) continue;
    checked++;
    const fp = path.join(process.cwd(), src.replace(/^\//, ""));
    if (!fs.existsSync(fp)) missingFiles++;
  }
  console.log(`\nLocal file check (first ${checked} /uploads paths): ${missingFiles} missing on disk`);
}
