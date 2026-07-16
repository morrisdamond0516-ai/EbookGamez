import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { sql } from "drizzle-orm";

const rows = await db
  .select({ id: draftEbooks.id, title: draftEbooks.title, status: draftEbooks.status, genre: draftEbooks.genre, content: draftEbooks.content })
  .from(draftEbooks)
  .where(sql`${draftEbooks.content} IS NOT NULL AND ${draftEbooks.content} LIKE '%[ILLUSTRATION:%'`);

const wouldAutoResume: Array<{ id: number; status: string; pending: number; resolved: number; title: string }> = [];
for (const d of rows) {
  const textMarkers = [...(d.content || "").matchAll(/\[ILLUSTRATION:\s*(.+?)\]/gi)].filter((m) => {
    const src = m[1].trim();
    return !(src.startsWith("/") || src.startsWith("http"));
  });
  if (textMarkers.length === 0) continue;
  const resolved = (d.content!.match(/\[ILLUSTRATION:\s*\/(?:uploads|objstore)\/illustrations\//g) || []).length;
  wouldAutoResume.push({
    id: d.id,
    status: d.status || "",
    pending: textMarkers.length,
    resolved,
    title: (d.title || "").slice(0, 50),
  });
}

console.log(`autoResumeIllustrations would target ${wouldAutoResume.length} books on next server start:\n`);
for (const b of wouldAutoResume.sort((a, b) => a.id - b.id)) {
  console.log(`  #${b.id} [${b.status}] pending=${b.pending} resolved=${b.resolved} — ${b.title}`);
}
