import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "../shared/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

const draftId = 729;
const file = "ai-bg-atmospheric-cinema-1783742279009.png";
const local = path.join(process.cwd(), "uploads", "covers", file);
if (!fs.existsSync(local)) {
  console.error("Missing file:", local);
  process.exit(1);
}

const url = `/uploads/covers/${file}`;
await db
  .update(draftEbooks)
  .set({
    backgroundUrl: url,
    coverUrl: url,
    coverStyleId: "atmospheric-cinema",
    overlayApproved: false,
  })
  .where(eq(draftEbooks.id, draftId));

const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
console.log("Restored:", {
  id: d.id,
  title: d.title,
  coverUrl: d.coverUrl,
  backgroundUrl: d.backgroundUrl,
  coverStyleId: d.coverStyleId,
});
