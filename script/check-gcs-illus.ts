import "./load-env.ts";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { getSharedStorageClient, getObjStoreBucketName } from "../server/objectStorage";
import fs from "fs";
import path from "path";

const ids = [476, 661, 728, 385];
const bucketName = getObjStoreBucketName();
console.log("bucket:", bucketName || "(not configured)");

for (const id of ids) {
  const [d] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
  if (!d?.content) continue;
  const fnames = [...d.content.matchAll(/\/objstore\/illustrations\/(illust-[^\s|"\]]+\.png)/g)].map((m) => m[1]);
  const uploads = [...d.content.matchAll(/\/uploads\/illustrations\/(illust-[^\s|"\]]+\.png)/g)].map((m) => m[1]);
  console.log(`\n#${id} objstore refs: ${fnames.length}, uploads refs: ${uploads.length}`);
  const sample = fnames.slice(0, 3);
  for (const fname of sample) {
    const local = path.join(process.cwd(), "uploads", "illustrations", fname);
    const localOk = fs.existsSync(local);
    let gcsOk = false;
    if (bucketName) {
      try {
        const client = getSharedStorageClient();
        const [exists] = await client.bucket(bucketName).file(`public/illustrations/${fname}`).exists();
        gcsOk = exists;
      } catch (e: any) {
        gcsOk = false;
        console.log(`  GCS check error for ${fname}: ${e.message?.slice(0, 60)}`);
      }
    }
    console.log(`  ${fname} local=${localOk} gcs=${gcsOk}`);
  }
}
