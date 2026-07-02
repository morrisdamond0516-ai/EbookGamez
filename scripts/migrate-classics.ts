import { Storage } from "@google-cloud/storage";
import fs from "fs";
import path from "path";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
const CLASSICS_DIR = path.join(process.cwd(), "uploads", "covers", "classics");

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

async function main() {
  const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
  const bucketName = publicPaths.split(",").filter(s => s.trim())[0]?.split("/")[1];
  if (!bucketName) throw new Error("No bucket");
  const bucket = storage.bucket(bucketName);
  
  const files = fs.readdirSync(CLASSICS_DIR);
  console.log(`Found ${files.length} classic covers`);
  
  for (const filename of files) {
    const localPath = path.join(CLASSICS_DIR, filename);
    const objectPath = `public/covers/classics/${filename}`;
    const file = bucket.file(objectPath);
    const [exists] = await file.exists();
    if (exists) { console.log(`EXISTS: ${filename}`); continue; }
    
    const buffer = fs.readFileSync(localPath);
    await file.save(buffer, { contentType: filename.endsWith('.jpg') ? 'image/jpeg' : 'image/png' });
    console.log(`UPLOADED: ${filename}`);
  }
  console.log("Done!");
}
main().catch(err => { console.error(err); process.exit(1); });
