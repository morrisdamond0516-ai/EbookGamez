import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { desc } from "drizzle-orm";
import { parseQualityDeferralFromDescription } from "../shared/qualityDeferralMetadata";

const drafts = await db.select().from(draftEbooks).orderBy(desc(draftEbooks.id));
const deferred = drafts.filter((d) => parseQualityDeferralFromDescription(d.description));
console.log(`Quality "fix later" tags: ${deferred.length}`);
for (const d of deferred.slice(0, 30)) {
  const meta = parseQualityDeferralFromDescription(d.description);
  console.log(
    `#${d.id} ${d.status} ${(d.title || "").slice(0, 48)} | reason=${meta?.reason || "?"} notes=${(meta?.notes || "").slice(0, 60)}`,
  );
}
if (deferred.length > 30) console.log(`... +${deferred.length - 30} more`);
process.exit(0);
