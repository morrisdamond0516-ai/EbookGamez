/**
 * Reset drafts 729–732 from failed → draft and resume content generation
 * with the fixed streaming outline + provider backup path.
 */
import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { inArray } from "drizzle-orm";
import { generateContentForDraft } from "../server/contentStudio";

const IDS = [729, 730, 731, 732];

const rows = await db
  .select({
    id: draftEbooks.id,
    title: draftEbooks.title,
    status: draftEbooks.status,
    coverUrl: draftEbooks.coverUrl,
    backgroundUrl: draftEbooks.backgroundUrl,
  })
  .from(draftEbooks)
  .where(inArray(draftEbooks.id, IDS));

console.log("Before reset:");
for (const r of rows.sort((a, b) => a.id - b.id)) {
  console.log(
    `  #${r.id} ${r.title} status=${r.status} cover=${!!(r.coverUrl || r.backgroundUrl)}`,
  );
}

await db
  .update(draftEbooks)
  .set({ status: "draft" })
  .where(inArray(draftEbooks.id, IDS));

console.log("\nReset to draft. Starting content gen one at a time...\n");

let consecutiveTransport = 0;
for (const id of IDS) {
  const row = rows.find((r) => r.id === id);
  console.log(`\n======== Generating #${id} ${row?.title || ""} ========`);
  try {
    await generateContentForDraft(id);
    consecutiveTransport = 0;
    console.log(`OK: #${id}`);
  } catch (err: any) {
    const msg = err?.message || String(err);
    const transport =
      err?.name === "TransportAbortError" ||
      /connection error|fetch failed|socket|UND_ERR/i.test(msg);
    console.error(`FAIL: #${id}:`, msg);
    if (transport) {
      consecutiveTransport++;
      if (consecutiveTransport >= 2) {
        console.error(
          "Stopped after 2 consecutive transport failures — diagnose before more API spend.",
        );
        process.exit(1);
      }
    } else {
      consecutiveTransport = 0;
    }
  }
}

console.log("\nDone.");
process.exit(0);
