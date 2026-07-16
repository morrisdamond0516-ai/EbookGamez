/**
 * Run overnight pipeline in this process (works without restarting dev server).
 * Waits until no draft has status=generating, then publishes / writes / illustrates.
 *
 *   npm run overnight:run
 */
import "./load-env.ts";
import fs from "fs";
import path from "path";
import { db } from "../server/storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";
import { runOvernightPipeline } from "../server/contentStudio";

const logPath = path.join(process.cwd(), "overnight-pipeline.log");
function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(logPath, line + "\n");
}

async function waitForDbIdle(maxMs = 12 * 60 * 60 * 1000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const generating = await db
      .select({ id: draftEbooks.id, title: draftEbooks.title })
      .from(draftEbooks)
      .where(eq(draftEbooks.status, "generating"));
    if (generating.length === 0) {
      log("Database idle — no drafts in generating status");
      return;
    }
    log(`Waiting for: ${generating.map((d) => `#${d.id} ${d.title}`).join("; ")}`);
    await new Promise((r) => setTimeout(r, 45000));
  }
  log("Timed out waiting for generating drafts — starting pipeline anyway");
}

log("Overnight runner started — waiting for current server work to finish...");
await waitForDbIdle();
log("Starting runOvernightPipeline()");
await runOvernightPipeline();
log("Overnight runner finished");
