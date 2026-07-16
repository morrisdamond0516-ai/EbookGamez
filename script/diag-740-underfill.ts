import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { eq } from "drizzle-orm";
import { scanUnderfilledReaderPages } from "../shared/readerPageSplit";

const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, 740));
const scan = scanUnderfilledReaderPages(d!.content || "", {
  smallIllustrations: true,
  chapterLimit: 16,
});
console.log("issues:", scan.issues);
console.log("details:", JSON.stringify(scan.underfilledPages?.slice?.(0, 8) ?? scan, null, 2).slice(0, 3000));
process.exit(0);
