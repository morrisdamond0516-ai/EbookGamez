import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { runMigrations } from 'stripe-replit-sync';
import { getStripeSync } from "./stripeClient";
import { WebhookHandlers } from "./webhookHandlers";
import { resumePendingJobs, isGenerationActive, getActiveGenerationCount, resumeInterruptedDrafts, autoResumeBulkGeneration, autoResumeTargetedOrBulk, autoResumeIllustrations, autoResumeBulkPublish, demotePublishedWithoutReachableCover, queueIllustrations } from "./contentStudio";
import { isStartupAutoResumeDisabled } from "./startupFlags";
import { startMonthlyScheduler } from "./contentRefresh";
import { seedProductionData } from "./seedProduction";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { getObjStoreBucketName, createObjStoreReadStream, uploadFileToObjStore } from "./objectStorage";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runStartupCleanup() {
  try {
    const workspace = "/home/runner/workspace";
    let totalFreed = 0;

    const cacheDir = path.join(workspace, ".cache");
    if (fs.existsSync(cacheDir)) {
      try {
        const size = parseInt(execSync(`du -sb "${cacheDir}" 2>/dev/null`).toString().split("\t")[0] || "0");
        execSync(`rm -rf "${cacheDir}" 2>/dev/null || true`, { timeout: 30000 });
        totalFreed += size;
        console.log(`[Startup Cleanup] Cleared build cache: ${formatBytes(size)}`);
      } catch {}
    }

    try {
      execSync(`find /tmp -maxdepth 1 -type f -name "*.tmp" -delete 2>/dev/null`, { timeout: 10000 });
      execSync(`rm -rf /tmp/logs/*.log 2>/dev/null`, { timeout: 10000 });
      console.log(`[Startup Cleanup] Cleared temp/log files`);
    } catch {}

    const assetDir = path.join(workspace, "attached_assets");
    if (fs.existsSync(assetDir)) {
      try {
        const files = fs.readdirSync(assetDir);
        const filesByBase: Record<string, { name: string; size: number; mtime: number }[]> = {};
        for (const file of files) {
          const match = file.match(/^(.+?)_\d+\.(png|jpg|jpeg|webp)$/i);
          const base = match ? match[1] : file;
          const stat = fs.statSync(path.join(assetDir, file));
          if (!filesByBase[base]) filesByBase[base] = [];
          filesByBase[base].push({ name: file, size: stat.size, mtime: stat.mtimeMs });
        }
        let removed = 0;
        for (const [, group] of Object.entries(filesByBase)) {
          if (group.length <= 1) continue;
          group.sort((a, b) => b.mtime - a.mtime);
          for (let i = 1; i < group.length; i++) {
            if (group[i].size === group[0].size) {
              try { fs.unlinkSync(path.join(assetDir, group[i].name)); removed++; } catch {}
            }
          }
        }
        if (removed > 0) console.log(`[Startup Cleanup] Removed ${removed} duplicate asset files`);
      } catch {}
    }

    console.log(`[Startup Cleanup] Complete`);
  } catch (err) {
    console.error("[Startup Cleanup] Error:", err);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const app = express();
app.set("trust proxy", 1);

function setupShutdownGuard() {
  const handleShutdown = (signal: string) => {
    if (isGenerationActive()) {
      console.log(`[Shutdown Guard] ${signal} received but ${getActiveGenerationCount()} generation(s) active. Delaying shutdown...`);
      const checkInterval = setInterval(() => {
        if (!isGenerationActive()) {
          console.log(`[Shutdown Guard] All generations complete. Shutting down now.`);
          clearInterval(checkInterval);
          process.exit(0);
        } else {
          console.log(`[Shutdown Guard] Still waiting for ${getActiveGenerationCount()} generation(s) to complete...`);
        }
      }, 5000);
      setTimeout(() => {
        console.log(`[Shutdown Guard] Max wait time (10 minutes) exceeded. Forcing shutdown.`);
        clearInterval(checkInterval);
        process.exit(1);
      }, 600000);
    } else {
      console.log(`[Shutdown Guard] ${signal} received. No active generations. Shutting down.`);
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

setupShutdownGuard();

let memoryLogInterval: ReturnType<typeof setInterval> | null = null;
function startMemoryMonitor() {
  if (memoryLogInterval) return;
  memoryLogInterval = setInterval(() => {
    const mem = process.memoryUsage();
    const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
    const rssMB = Math.round(mem.rss / 1024 / 1024);
    const activeGens = getActiveGenerationCount();
    if (heapMB > 300 || activeGens > 0) {
      console.log(`[Memory] Heap: ${heapMB}MB, RSS: ${rssMB}MB, Active generations: ${activeGens}`);
    }
    if (heapMB > 800) {
      console.warn(`[Memory] WARNING: Heap usage critically high at ${heapMB}MB — risk of OOM crash`);
      if (typeof global.gc === 'function') {
        console.log(`[Memory] Forcing garbage collection...`);
        global.gc();
      }
    }
  }, 30000);
}
startMemoryMonitor();

const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required for Stripe integration. ' +
      'Please create a PostgreSQL database first.'
    );
  }

  try {
    console.log('Initializing Stripe schema...');
    await runMigrations({ 
      databaseUrl
    });
    console.log('Stripe schema ready');

    const stripeSync = await getStripeSync();

    const isDeployed = process.env.REPLIT_DEPLOYMENT === '1';
    if (isDeployed) {
      console.log('Setting up managed webhook...');
      const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const webhookResult = await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`);
      console.log(`Webhook configured:`, webhookResult);
    } else {
      console.log('[Dev] Skipping webhook URL update — production webhook URL preserved');
    }

    console.log('Syncing Stripe data...');
    stripeSync.syncBackfill()
      .then(() => {
        console.log('Stripe data synced');
      })
      .catch((err: any) => {
        console.error('Error syncing Stripe data:', err);
      });

    const { initializeSubscriptionPlans } = await import('./subscriptionService');
    initializeSubscriptionPlans()
      .then(() => console.log('Subscription plans initialized/migrated'))
      .catch((err: any) => console.error('Error initializing subscription plans:', err));
  } catch (error) {
    console.error('Failed to initialize Stripe:', error);
    throw error;
  }
}

app.post(
  '/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).json({ error: 'Missing stripe-signature' });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        const errorMsg = 'STRIPE WEBHOOK ERROR: req.body is not a Buffer. ' +
          'This means express.json() ran before this webhook route. ' +
          'FIX: Move this webhook route registration BEFORE app.use(express.json()) in your code.';
        console.error(errorMsg);
        return res.status(500).json({ error: 'Webhook processing error' });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Webhook error:', error.message);

      if (error.message && error.message.includes('payload must be provided as a string or a Buffer')) {
        const helpfulMsg = 'STRIPE WEBHOOK ERROR: Payload is not a Buffer. ' +
          'This usually means express.json() parsed the body before the webhook handler. ' +
          'FIX: Ensure the webhook route is registered BEFORE app.use(express.json()).';
        console.error(helpfulMsg);
      }

      res.status(400).json({ error: 'Webhook processing error' });
    }
  }
);

app.use(compression());

app.use(
  express.json({
    limit: '50mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

app.get('/img/:width/*', async (req, res) => {
  try {
    const sharp = (await import('sharp')).default;
    const width = parseInt(req.params.width);
    if (isNaN(width) || width < 50 || width > 2000) return res.status(400).send("Invalid width");
    const imagePath = req.params[0];
    if (!imagePath) return res.status(400).send("No path");
    
    if (imagePath.includes('..') || path.isAbsolute(imagePath)) return res.status(400).send("Invalid path");
    const ext = path.extname(imagePath).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) return res.status(400).send("Invalid file type");
    
    const allowedBase = path.resolve('uploads');
    const localPath = path.resolve(imagePath);
    if (!localPath.startsWith(allowedBase + path.sep)) return res.status(403).send("Forbidden");
    if (!fs.existsSync(localPath)) return res.status(404).send("Not found");
    
    const acceptWebp = req.headers.accept?.includes('image/webp');
    const format = acceptWebp ? 'webp' : 'jpeg';
    const quality = width <= 400 ? 75 : 80;
    
    res.set({
      'Content-Type': format === 'webp' ? 'image/webp' : 'image/jpeg',
      'Cache-Control': 'public, max-age=2592000, immutable',
      'Vary': 'Accept',
    });
    
    const transform = sharp(localPath).resize(width, undefined, { fit: 'inside', withoutEnlargement: true });
    if (format === 'webp') {
      transform.webp({ quality });
    } else {
      transform.jpeg({ quality, mozjpeg: true });
    }
    transform.pipe(res).on('error', () => { if (!res.headersSent) res.status(500).end(); });
  } catch (err: any) {
    if (!res.headersSent) res.status(500).send("Image processing error");
  }
});

// Serve uploaded files statically, with Object Storage fallback for covers
app.use('/uploads/covers', express.static('uploads/covers', { maxAge: '7d' }), async (req, res, next) => {
  try {
    const coverPath = req.path.startsWith('/') ? req.path.slice(1) : req.path;
    if (!coverPath) return next();

    const { serveCoverWithFallback } = await import("./coverProxy");
    if (await serveCoverWithFallback(coverPath, res)) return;

    const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const bucketName = publicPaths.split(",").filter(s => s.trim())[0]?.split("/")[1];
    if (!bucketName) return res.status(404).send("Cover not found");

    const { Storage } = await import("@google-cloud/storage");
    const storageClient = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: "http://127.0.0.1:1106/token",
        type: "external_account",
        credential_source: {
          url: "http://127.0.0.1:1106/credential",
          format: { type: "json", subject_token_field_name: "access_token" },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });
    const file = storageClient.bucket(bucketName).file(`public/covers/${coverPath}`);
    const [exists] = await file.exists();
    if (!exists) return res.status(404).send("Cover not found");

    const ext = coverPath.split('.').pop()?.toLowerCase();
    const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'application/octet-stream';
    res.set({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    });
    file.createReadStream().pipe(res);
  } catch (err: any) {
    console.error("Upload cover fallback error:", err.message);
    if (!res.headersSent) next();
  }
});
app.use('/uploads', express.static('uploads', { maxAge: '7d' }));
app.use('/exports', express.static('exports', { maxAge: '1d' }));

const COVER_DISK_CACHE_DIR = path.join(process.cwd(), "cache", "covers");
fs.mkdirSync(COVER_DISK_CACHE_DIR, { recursive: true });

app.get('/objstore/covers/*', async (req, res) => {
  try {
    const coverPath = req.params[0];
    if (!coverPath) return res.status(400).send("No cover path");

    const widthParam = req.query.w ? parseInt(req.query.w as string) : 0;
    const wantResize = widthParam >= 50 && widthParam <= 2000;
    const acceptWebp = req.headers.accept?.includes('image/webp');

    const { getSharedStorageClient, getObjStoreBucketName, resetSharedStorageClient } = await import("./objectStorage");

    async function gcsWithRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
      let lastErr: any;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          return await fn();
        } catch (err: any) {
          lastErr = err;
          const isAuth = err.message?.includes("Authentication timed out") || err.message?.includes("ETIMEDOUT") || err.message?.includes("ECONNRESET") || err.message?.includes("socket hang up");
          if (isAuth) {
            console.warn(`[Cover] Auth/network error for ${label} (attempt ${attempt}/3): ${err.message} — resetting client`);
            resetSharedStorageClient();
          }
          if (!isAuth || attempt === 3) throw err;
          await new Promise(r => setTimeout(r, 800 * attempt));
        }
      }
      throw lastErr;
    }

    const bucketName = getObjStoreBucketName();

    // Local dev without GCS: proxy from production
    if (!bucketName) {
      const { serveCoverWithFallback } = await import("./coverProxy");
      if (await serveCoverWithFallback(coverPath, res)) return;
      return res.status(404).send("Cover not found");
    }

    if (wantResize) {
      const format = acceptWebp ? 'webp' : 'jpeg';
      const safeName = coverPath.replace(/[^a-zA-Z0-9._-]/g, "_");
      const cacheKey = `${widthParam}-${safeName}.${format}`;
      const cachePath = path.join(COVER_DISK_CACHE_DIR, cacheKey);

      if (fs.existsSync(cachePath)) {
        res.set({
          'Content-Type': format === 'webp' ? 'image/webp' : 'image/jpeg',
          'Cache-Control': 'public, max-age=2592000, immutable',
          'X-Cover-Cache': 'HIT',
        });
        return fs.createReadStream(cachePath).pipe(res);
      }

      const storageClient = getSharedStorageClient();
      const file = storageClient.bucket(bucketName).file(`public/covers/${coverPath}`);
      const [exists] = await gcsWithRetry(() => file.exists(), coverPath);
      if (!exists) return res.status(404).send("Cover not found");

      const sharp = (await import('sharp')).default;
      const quality = widthParam <= 400 ? 75 : 80;

      res.set({
        'Content-Type': format === 'webp' ? 'image/webp' : 'image/jpeg',
        'Cache-Control': 'public, max-age=2592000, immutable',
        'Vary': 'Accept',
        'X-Cover-Cache': 'MISS',
      });

      const transform = sharp().resize(widthParam, undefined, { fit: 'inside', withoutEnlargement: true });
      if (format === 'webp') {
        transform.webp({ quality });
      } else {
        transform.jpeg({ quality, mozjpeg: true });
      }

      const writeStream = fs.createWriteStream(cachePath);
      const readStream = getSharedStorageClient().bucket(bucketName).file(`public/covers/${coverPath}`).createReadStream();
      readStream.on('error', (err: any) => {
        console.error(`[Cover] Read stream error for ${coverPath}:`, err.message);
        if (!res.headersSent) res.status(500).end();
      });

      const sharpStream = readStream.pipe(transform);
      sharpStream.on('error', () => {
        fs.unlink(cachePath, () => {});
        if (!res.headersSent) res.status(500).end();
      });
      sharpStream.pipe(writeStream);
      sharpStream.pipe(res);
      writeStream.on('error', () => fs.unlink(cachePath, () => {}));

    } else {
      const storageClient = getSharedStorageClient();
      const file = storageClient.bucket(bucketName).file(`public/covers/${coverPath}`);
      const [exists] = await gcsWithRetry(() => file.exists(), coverPath);
      if (!exists) return res.status(404).send("Cover not found");
      const [metadata] = await gcsWithRetry(() => file.getMetadata(), coverPath);
      const ext = coverPath.split('.').pop()?.toLowerCase();
      const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : metadata.contentType || 'application/octet-stream';
      res.set({
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      });
      getSharedStorageClient().bucket(bucketName).file(`public/covers/${coverPath}`).createReadStream().pipe(res);
    }
  } catch (err: any) {
    console.error("Object storage cover error:", err.message);
    if (!res.headersSent) res.status(500).send("Error loading cover");
  }
});

// Serve illustration images from Replit Object Storage.
// New illustrations are uploaded here at generation time; old local-path illustrations
// are migrated in the background by migrateIllustrationFiles() at startup.
app.get('/objstore/illustrations/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename) return res.status(400).send("No filename");

    const localPath = path.join(process.cwd(), "uploads", "illustrations", filename);
    if (fs.existsSync(localPath)) {
      res.set({
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=2592000, immutable",
      });
      return res.sendFile(localPath);
    }

    const { getSharedStorageClient, getObjStoreBucketName } = await import("./objectStorage");
    const bucketName = getObjStoreBucketName();
    if (!bucketName) {
      console.warn(`[IllustServe] Not in local uploads and object storage not configured: ${filename}`);
      return res.status(404).send("Illustration not found");
    }

    const storageClient = getSharedStorageClient();
    const file = storageClient.bucket(bucketName).file(`public/illustrations/${filename}`);
    const [exists] = await file.exists();
    if (!exists) {
      console.warn(`[IllustServe] Not found in GCS: public/illustrations/${filename}`);
      return res.status(404).send("Illustration not found");
    }
    res.set({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=2592000, immutable",
    });
    const readStream = file.createReadStream();
    readStream.on('error', (err: any) => {
      console.error(`[IllustServe] Stream error for ${filename}:`, err.message);
      if (!res.headersSent) res.status(500).end();
    });
    readStream.pipe(res);
  } catch (err: any) {
    console.error("[IllustServe] Error:", err.message);
    if (!res.headersSent) res.status(500).send("Error loading illustration");
  }
});

// Serve coloring book pages from Replit Object Storage.
// Pages are uploaded to GCS at generation time; this route streams them back.
app.get('/objstore/coloring-pages/:draftId/:filename', async (req, res) => {
  try {
    const { draftId, filename } = req.params;
    if (!draftId || !filename) return res.status(400).send("Missing params");

    const { getSharedStorageClient, getObjStoreBucketName } = await import("./objectStorage");
    const bucketName = getObjStoreBucketName();
    if (!bucketName) return res.status(500).send("Object storage not configured");

    const storageClient = getSharedStorageClient();
    const remotePath = `public/coloring-pages/${draftId}/${filename}`;
    const file = storageClient.bucket(bucketName).file(remotePath);
    const [exists] = await file.exists();
    if (!exists) {
      // Fallback: try local file
      const localPath = path.join(process.cwd(), "uploads", "coloring-pages", draftId, filename);
      if (fs.existsSync(localPath)) {
        res.set("Content-Type", "image/png");
        res.sendFile(localPath);
        return;
      }
      console.warn(`[ColorPageServe] Not found: ${remotePath}`);
      return res.status(404).send("Coloring page not found");
    }
    res.set({
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=2592000, immutable",
    });
    const readStream = file.createReadStream();
    readStream.on('error', (err: any) => {
      console.error(`[ColorPageServe] Stream error for ${remotePath}:`, err.message);
      if (!res.headersSent) res.status(500).end();
    });
    readStream.pipe(res);
  } catch (err: any) {
    console.error("[ColorPageServe] Error:", err.message);
    if (!res.headersSent) res.status(500).send("Error loading coloring page");
  }
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

let _fixLocalCoverPathsRunning = false;

async function fixLocalCoverPaths() {
  if (_fixLocalCoverPathsRunning) {
    console.log("[Startup] fixLocalCoverPaths already running — skipping overlapping run");
    return;
  }
  _fixLocalCoverPathsRunning = true;
  const startedAt = Date.now();
  try {
    const { ensureCoverPersisted, isLocalWorkspaceMode } = await import("./coverStorage");
    const pg = await import("pg");
    const client = new pg.default.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    const localWorkspace = isLocalWorkspaceMode();

    // Sample rate for re-verifying already-migrated (/objstore/covers/) rows on each
    // restart, to catch drift (e.g. accidental deletion from the bucket) without
    // paying the full object-storage existence-check cost for every row every time.
    // Genuinely un-migrated (/uploads/covers/) rows are always fully processed.
    // In Cursor/local dev, always verify /objstore/ URLs so we heal to /uploads/ when the file is on disk.
    const ALREADY_MIGRATED_SAMPLE_RATE = 0.05;
    const needsVerification = (url: string | null | undefined) =>
      !!url && (
        url.startsWith("/uploads/covers/") ||
        (localWorkspace && url.startsWith("/objstore/covers/")) ||
        Math.random() < ALREADY_MIGRATED_SAMPLE_RATE
      );

    // Upload local cover files to object storage and normalize book paths
    const booksResult = await client.query(
      `SELECT id, title, cover_url FROM books
       WHERE cover_url LIKE '/uploads/covers/%' OR cover_url LIKE '/objstore/covers/%'`
    );
    let booksFixed = 0;
    let booksSkipped = 0;
    {
      const CONCURRENCY = 40;
      const queue = booksResult.rows.filter((book) => {
        if (needsVerification(book.cover_url)) return true;
        booksSkipped++;
        return false;
      });
      const worker = async () => {
        while (queue.length > 0) {
          const book = queue.shift();
          if (!book) break;
          const persisted = await ensureCoverPersisted(book.cover_url);
          if (persisted && persisted !== book.cover_url) {
            await client.query("UPDATE books SET cover_url = $1 WHERE id = $2", [persisted, book.id]);
            booksFixed++;
            console.log(`[Startup] Book #${book.id} cover -> ${persisted}`);
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    }
    if (booksFixed > 0) {
      console.log(`[Startup] Migrated ${booksFixed} book cover URL(s) to object storage`);
    }

    // Migrate draft cover + background URLs; heal published drafts from catalog when needed
    const draftsResult = await client.query(
      `SELECT de.id, de.title, de.cover_url, de.background_url, de.status,
              (SELECT b.cover_url FROM books b WHERE LOWER(TRIM(b.title)) = LOWER(TRIM(de.title)) LIMIT 1) AS book_cover_url
       FROM draft_ebooks de
       WHERE de.cover_url IS NOT NULL
          OR de.background_url IS NOT NULL
          OR de.status = 'published'`
    );

    let draftsFixed = 0;
    let draftsSkipped = 0;
    {
      const CONCURRENCY = 40;
      const queue = [...draftsResult.rows];
      const worker = async () => {
        while (queue.length > 0) {
          const draft = queue.shift();
          if (!draft) break;
          let coverUrl = draft.cover_url as string | null;
          let backgroundUrl = draft.background_url as string | null;
          let verified = false;

          if (coverUrl && needsVerification(coverUrl)) {
            const healed = await ensureCoverPersisted(coverUrl);
            if (healed) coverUrl = healed;
            verified = true;
          }
          if (backgroundUrl && needsVerification(backgroundUrl)) {
            const healed = await ensureCoverPersisted(backgroundUrl);
            if (healed) backgroundUrl = healed;
            verified = true;
          }

          if (draft.status === "published") {
            if (!coverUrl && backgroundUrl) {
              coverUrl = backgroundUrl;
            }
            if (!coverUrl && !backgroundUrl && draft.book_cover_url) {
              const healed = await ensureCoverPersisted(draft.book_cover_url);
              if (healed) coverUrl = healed;
              verified = true;
            }
          }

          if (!verified) {
            draftsSkipped++;
          }

          if (coverUrl !== draft.cover_url || backgroundUrl !== draft.background_url) {
            await client.query(
              "UPDATE draft_ebooks SET cover_url = $1, background_url = $2 WHERE id = $3",
              [coverUrl, backgroundUrl, draft.id]
            );
            draftsFixed++;
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    }
    if (draftsFixed > 0) {
      console.log(`[Startup] Fixed ${draftsFixed} draft_ebooks cover URL(s)`);
    }

    await client.end();
    console.log(
      `[Startup] fixLocalCoverPaths completed in ${Date.now() - startedAt}ms ` +
      `(${booksResult.rows.length} books [${booksSkipped} already-migrated skipped], ` +
      `${draftsResult.rows.length} drafts [${draftsSkipped} already-migrated skipped])`
    );
  } catch (err: any) {
    console.error("[Startup] Error fixing local cover paths:", err.message);
  } finally {
    _fixLocalCoverPathsRunning = false;
  }
}

// Background migration: upload existing local illustration files to object storage
// and update content references in draft_ebooks and books tables.
// Runs asynchronously after startup — does NOT block the server.
// Safe to run multiple times (skips files already in object storage).
async function migrateIllustrationFiles(_batchSize = 5000) {
  try {
    const bucketName = getObjStoreBucketName();
    if (!bucketName) { console.log("[IllustMigration] Object storage not configured, skipping"); return; }

    const pg = await import("pg");
    const client = new pg.default.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    // Step 1: Fast single-query DB path rewrite — replaces ALL local paths in one statement
    const dbResult = await client.query(
      `UPDATE draft_ebooks
       SET content = REPLACE(content, '/uploads/illustrations/', '/objstore/illustrations/')
       WHERE content LIKE '%/uploads/illustrations/%'`
    );
    const dbUpdated = dbResult.rowCount ?? 0;
    if (dbUpdated > 0) {
      console.log(`[IllustMigration] DB paths updated: ${dbUpdated} drafts rewritten to /objstore/illustrations/ URLs`);
    } else {
      console.log("[IllustMigration] DB already clean — checking GCS completeness...");
    }

    // Step 2: Collect all illustration filenames referenced via /objstore/ and upload any missing to GCS
    const { rows } = await client.query(
      "SELECT content FROM draft_ebooks WHERE content LIKE '%/objstore/illustrations/%'"
    );
    const filenames = new Set<string>();
    for (const row of rows) {
      const matches = [...(row.content || "").matchAll(/\/objstore\/illustrations\/(illust-[^\s|"\]]+\.png)/g)];
      for (const m of matches) filenames.add(m[1]);
    }
    await client.end();

    const { getSharedStorageClient } = await import("./objectStorage");
    const storageClient = getSharedStorageClient();
    const bucket = storageClient.bucket(bucketName);

    const allFiles = [...filenames];
    console.log(`[IllustMigration] Ensuring ${allFiles.length} illustration files are in object storage...`);

    // Use a single GCS list call instead of N individual file.exists() calls.
    // Previously: 2,184 individual exists() calls at concurrency 3 → slow, and any
    // network hiccup caused false "missing" detections that triggered auto-heal
    // (marker reset + regeneration queue), forcing unnecessary image re-generation.
    // Now: one bucket.getFiles() list operation builds the full set in one round trip.
    let gcsFileSet = new Set<string>();
    try {
      const [gcsFiles] = await bucket.getFiles({ prefix: "public/illustrations/" });
      for (const f of gcsFiles) {
        const parts = f.name.split("/");
        gcsFileSet.add(parts[parts.length - 1]); // just the filename
      }
    } catch (listErr: any) {
      console.error("[IllustMigration] GCS list failed, skipping completeness check:", listErr.message);
      return;
    }

    let uploaded = 0, alreadyInCloud = 0, failed = 0;
    const missingFromGcs = new Set<string>();

    // Only make GCS API calls for files we need to upload (local file exists, not in GCS)
    // or truly verify missing (no local copy and not in list). This avoids N exists() calls.
    for (const fname of allFiles) {
      const localPath = path.join(process.cwd(), "uploads", "illustrations", fname);
      const inGcs = gcsFileSet.has(fname);
      if (inGcs) { alreadyInCloud++; continue; }
      // Not in GCS — upload from local if available, otherwise mark missing
      if (!fs.existsSync(localPath)) {
        missingFromGcs.add(fname);
        continue;
      }
      try {
        const remotePath = `public/illustrations/${fname}`;
        const buf = fs.readFileSync(localPath);
        await bucket.file(remotePath).save(buf, { contentType: "image/png", resumable: false });
        uploaded++;
      } catch (e: any) {
        failed++;
        console.error(`[IllustMigration] Upload failed ${fname}:`, e.message);
      }
    }
    console.log(`[IllustMigration] Done: ${uploaded} uploaded to GCS, ${alreadyInCloud} already existed, ${missingFromGcs.size} missing from GCS, ${failed} errors.`);

    // Auto-heal: reset markers for any illustration files that are genuinely gone from GCS,
    // then queue illustration-only regeneration so the server self-heals on every restart.
    // Auto-heal can burn large image API spend on restart. Require explicit opt-in.
    if (process.env.ENABLE_ILLUST_AUTO_HEAL !== "true") {
      console.log(
        `[IllustMigration] Auto-heal DISABLED (set ENABLE_ILLUST_AUTO_HEAL=true to allow). ${missingFromGcs.size} missing file(s) will not trigger regen.`,
      );
      return;
    }
    if (isStartupAutoResumeDisabled()) {
      console.log(
        `[IllustMigration] Auto-heal skipped (local dev / DISABLE_STARTUP_AUTO_RESUME) — ${missingFromGcs.size} file(s) not in GCS will NOT trigger regen`,
      );
      return;
    }
    if (missingFromGcs.size > 0) {
      console.log(`[IllustMigration] Auto-heal: resetting ${missingFromGcs.size} missing illustration markers and queuing regeneration...`);
      try {
        const pg2 = await import("pg");
        const healClient = new pg2.default.Client({ connectionString: process.env.DATABASE_URL });
        await healClient.connect();

        // Find which drafts reference these missing filenames
        const affectedDraftIds = new Set<number>();
        const { rows: allDraftRows } = await healClient.query(
          "SELECT id, content FROM draft_ebooks WHERE content LIKE '%/objstore/illustrations/%'"
        );
        for (const row of allDraftRows) {
          for (const fname of missingFromGcs) {
            if ((row.content || "").includes(`/objstore/illustrations/${fname}`)) {
              affectedDraftIds.add(row.id);
            }
          }
        }

        if (affectedDraftIds.size > 0) {
          // Build one combined regex replace per affected draft
          for (const row of allDraftRows) {
            if (!affectedDraftIds.has(row.id)) continue;
            let content: string = row.content || "";
            let changed = false;
            for (const fname of missingFromGcs) {
              if (!content.includes(`/objstore/illustrations/${fname}`)) continue;
              const escaped = fname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const before = content;
              content = content.replace(
                new RegExp(`\\[(?:ILLUSTRATION|IMAGE|COMIC PANEL):\\s*/objstore/illustrations/${escaped}(?:\\s*\\|[^\\]]+)?\\]`, "gi"),
                "[ILLUSTRATION: high-quality illustration needed here]"
              );
              if (content !== before) changed = true;
            }
            if (changed) {
              await healClient.query("UPDATE draft_ebooks SET content = $1 WHERE id = $2", [content, row.id]);
            }
          }
          console.log(`[IllustMigration] Auto-heal: reset markers in ${affectedDraftIds.size} drafts. Queuing illustration regeneration...`);
          await healClient.end();

          // Queue illustration regeneration (non-blocking — server is already up by the time this runs)
          const ids = Array.from(affectedDraftIds);
          queueIllustrations(ids);
          console.log(`[IllustMigration] Auto-heal: queued ${ids.length} books for illustration regeneration.`);
        } else {
          await healClient.end();
          console.log("[IllustMigration] Auto-heal: no drafts reference missing files — nothing to queue.");
        }
      } catch (healErr: any) {
        console.error("[IllustMigration] Auto-heal error:", healErr.message);
      }
    }
  } catch (err: any) {
    console.error("[IllustMigration] Fatal error:", err.message);
  }
}

// Background migration: upload any locally-existing coloring page files to GCS,
// then auto-heal any coloring books whose pages are missing from GCS entirely.
// Runs asynchronously after startup — safe to run multiple times.
async function migrateColoringPageFiles() {
  try {
    const bucketName = getObjStoreBucketName();
    if (!bucketName) { console.log("[ColorMigration] Object storage not configured, skipping"); return; }

    const { Storage } = await import("@google-cloud/storage");
    const storageClient = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: "http://127.0.0.1:1106/token",
        type: "external_account",
        credential_source: {
          url: "http://127.0.0.1:1106/credential",
          format: { type: "json", subject_token_field_name: "access_token" },
        },
        universe_domain: "googleapis.com",
      },
      projectId: "",
    });

    // Step 1: Upload any local files that aren't in GCS yet
    let uploaded = 0, alreadyExisted = 0, uploadFailed = 0;
    const coloringBaseDir = path.join(process.cwd(), "uploads", "coloring-pages");
    if (fs.existsSync(coloringBaseDir)) {
      const draftDirs = fs.readdirSync(coloringBaseDir).filter(d =>
        fs.statSync(path.join(coloringBaseDir, d)).isDirectory()
      );
      for (const draftId of draftDirs) {
        const dirPath = path.join(coloringBaseDir, draftId);
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith(".png"));
        for (const filename of files) {
          const remotePath = `public/coloring-pages/${draftId}/${filename}`;
          try {
            const gcsFile = storageClient.bucket(bucketName).file(remotePath);
            const [exists] = await gcsFile.exists();
            if (exists) { alreadyExisted++; continue; }
            const buffer = fs.readFileSync(path.join(dirPath, filename));
            await gcsFile.save(buffer, { contentType: "image/png" });
            uploaded++;
          } catch (e: any) {
            console.warn(`[ColorMigration] Failed ${remotePath}: ${e.message}`);
            uploadFailed++;
          }
        }
      }
      console.log(`[ColorMigration] Local upload: ${uploaded} uploaded, ${alreadyExisted} already in GCS, ${uploadFailed} errors`);
    } else {
      console.log("[ColorMigration] No local coloring pages directory — skipping local upload step");
    }

    // Step 2: Auto-heal — find coloring book drafts whose page-001.png is missing from GCS
    // and queue regeneration so the server self-heals after restarts.
    const pg2 = await import("pg");
    const healClient = new pg2.default.Client({ connectionString: process.env.DATABASE_URL });
    await healClient.connect();
    const { rows: coloringDrafts } = await healClient.query(
      `SELECT id, title FROM draft_ebooks
       WHERE genre ILIKE '%coloring%'
         AND status IN ('published', 'ready', 'draft')
         AND (content IS NOT NULL AND length(content) > 100)`
    );
    await healClient.end();

    if (coloringDrafts.length === 0) {
      console.log("[ColorMigration] No coloring book drafts found — nothing to heal");
      return;
    }

    // Check GCS for each draft's first page (proxy for all 30 pages)
    const missingDraftIds: number[] = [];
    const CONCURRENCY = 10;
    let ci = 0;
    async function colorWorker() {
      while (ci < coloringDrafts.length) {
        const draft = coloringDrafts[ci++];
        const firstPage = `public/coloring-pages/${draft.id}/page-001.png`;
        try {
          const [exists] = await storageClient.bucket(bucketName).file(firstPage).exists();
          if (!exists) {
            console.log(`[ColorMigration] Missing GCS pages for coloring book ID ${draft.id}: "${draft.title}"`);
            missingDraftIds.push(draft.id);
          }
        } catch (e: any) {
          console.warn(`[ColorMigration] GCS check failed for draft ${draft.id}: ${e.message}`);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, colorWorker));

    if (missingDraftIds.length > 0) {
      console.warn(`[ColorMigration] ${missingDraftIds.length} coloring book(s) missing GCS pages (IDs: ${missingDraftIds.join(", ")}). Use the admin panel to regenerate.`);
    } else {
      console.log("[ColorMigration] All coloring book pages present in GCS");
    }
  } catch (err: any) {
    console.error("[ColorMigration] Fatal:", err.message);
  }
}

(async () => {
  await seedProductionData();
  // Run cover-path migration in background — does not block server startup.
  // Guarded against overlapping runs via _fixLocalCoverPathsRunning.
  setTimeout(() => fixLocalCoverPaths().catch(e => console.error("[Startup] Unhandled fixLocalCoverPaths error:", e.message)), 5000);
  // Run illustration migration in background — does not block server startup
  setTimeout(() => migrateIllustrationFiles(5000).catch(e => console.error("[IllustMigration] Unhandled:", e.message)), 8000);
  setTimeout(() => migrateColoringPageFiles().catch(e => console.error("[ColorMigration] Unhandled:", e.message)), 12000);
  await initStripe();
  
  // Serve ads.txt explicitly before all routes so it's always reachable at the root
  app.get("/ads.txt", (_req, res) => {
    const adsPath = path.resolve(__dirname, "public", "ads.txt");
    if (fs.existsSync(adsPath)) {
      res.type("text/plain").sendFile(adsPath);
    } else {
      // Fallback: serve inline so it never 404s even if the build file is missing
      res.type("text/plain").send(
        "google.com, pub-1093119401125313, DIRECT, f08c47fec0942fa0\n"
      );
    }
  });

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error("[Express Error Handler]", err);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "127.0.0.1",
    },
    () => {
      const url = `http://127.0.0.1:${port}`;
      if (process.env.NODE_ENV === "development") {
        console.log("");
        console.log("  ===================================================");
        console.log("  App is running — open this in your browser:");
        console.log(`  ${url}`);
        console.log(`  AI Studio: ${url}/content-studio`);
        console.log(`  Admin:     ${url}/admin`);
        console.log("  ===================================================");
        console.log("  Keep this terminal open while you use the app.");
        console.log("  (Stripe errors below are OK for local dev.)");
        console.log("");
      } else {
        log(`serving on port ${port}`);
      }
      
      runStartupCleanup();
      startMonthlyScheduler();
      
      setTimeout(async () => {
        if (isStartupAutoResumeDisabled()) {
          console.log(
            "[Startup] Auto-resume PAUSED (DISABLE_STARTUP_AUTO_RESUME or NODE_ENV=development). " +
              "Use Content Studio buttons to run generation manually. Set ENABLE_STARTUP_AUTO_RESUME=true to restore Replit-style boot behavior.",
          );
          return;
        }
        try {
          const resumed = await resumePendingJobs();
          if (resumed > 0) {
            log(`Resumed ${resumed} pending generation jobs`);
          }
          const draftResumed = await resumeInterruptedDrafts();
          if (draftResumed > 0) {
            log(`Auto-resuming ${draftResumed} interrupted draft(s)`);
          }
          await demotePublishedWithoutReachableCover();
          await autoResumeTargetedOrBulk();
          await autoResumeIllustrations();
          await autoResumeBulkPublish();
        } catch (err) {
          console.error('Error resuming pending jobs:', err);
        }
      }, 5000);
    },
  );
})();
