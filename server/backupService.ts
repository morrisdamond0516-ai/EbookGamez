import { Storage } from "@google-cloud/storage";
import fs from "fs";
import path from "path";
import { db } from "./storage";
import { draftEbooks } from "@shared/schema";
import { eq } from "drizzle-orm";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function getBucketName(): string {
  const publicPaths = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
  const paths = publicPaths.split(",").filter(p => p.trim());
  if (paths.length === 0) {
    throw new Error("No object storage bucket configured");
  }
  const bucketName = paths[0].split("/")[1];
  return bucketName;
}

export interface BackupMetadata {
  id: number;
  title: string;
  genre: string;
  topic?: string;
  content?: string;
  suggestedPrice?: string;
  backedUpAt: string;
}

export async function backupCover(draftId: number, coverBuffer: Buffer, metadata: BackupMetadata): Promise<string> {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeTitle = (metadata.title || "untitled").replace(/[^a-zA-Z0-9]/g, "-").substring(0, 50);
  const objectPath = `backups/covers/${draftId}/${timestamp}_${safeTitle}.png`;
  
  const file = bucket.file(objectPath);
  await file.save(coverBuffer, {
    contentType: "image/png",
    metadata: {
      metadata: {
        draftId: String(draftId),
        title: metadata.title,
        genre: metadata.genre,
        backedUpAt: metadata.backedUpAt,
      }
    }
  });
  
  console.log(`[Backup] Cover saved: ${objectPath}`);
  return objectPath;
}

export async function backupEbookData(draftId: number): Promise<string> {
  const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
  if (!draft) {
    throw new Error(`Draft ${draftId} not found`);
  }
  
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeTitle = (draft.title || "untitled").replace(/[^a-zA-Z0-9]/g, "-").substring(0, 50);
  const objectPath = `backups/data/${draftId}/${timestamp}_${safeTitle}.json`;
  
  const backupData = {
    id: draft.id,
    title: draft.title,
    genre: draft.genre,
    topic: draft.topic,
    outline: draft.outline,
    content: draft.content,
    suggestedPrice: draft.suggestedPrice,
    coverUrl: draft.coverUrl,
    backgroundUrl: draft.backgroundUrl,
    status: draft.status,
    backedUpAt: new Date().toISOString(),
  };
  
  const file = bucket.file(objectPath);
  await file.save(JSON.stringify(backupData, null, 2), {
    contentType: "application/json",
    metadata: {
      metadata: {
        draftId: String(draftId),
        title: draft.title || "",
        genre: draft.genre || "",
        backedUpAt: new Date().toISOString(),
      }
    }
  });
  
  console.log(`[Backup] Ebook data saved: ${objectPath}`);
  return objectPath;
}

export async function backupCoverFromFile(draftId: number, coverPath: string): Promise<string | null> {
  try {
    const fullPath = path.join(process.cwd(), coverPath.replace(/^\//, ""));
    if (!fs.existsSync(fullPath)) {
      console.log(`[Backup] Cover file not found: ${fullPath}`);
      return null;
    }
    
    const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
    if (!draft) {
      console.log(`[Backup] Draft ${draftId} not found`);
      return null;
    }
    
    const coverBuffer = fs.readFileSync(fullPath);
    const metadata: BackupMetadata = {
      id: draftId,
      title: draft.title || "Untitled",
      genre: draft.genre || "Unknown",
      topic: draft.topic || undefined,
      content: draft.content || undefined,
      suggestedPrice: draft.suggestedPrice || undefined,
      backedUpAt: new Date().toISOString(),
    };
    
    return await backupCover(draftId, coverBuffer, metadata);
  } catch (error) {
    console.error(`[Backup] Error backing up cover for draft ${draftId}:`, error);
    return null;
  }
}

export async function listBackups(draftId?: number): Promise<Array<{ path: string; metadata: any; createdAt: Date }>> {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  
  const prefix = draftId ? `backups/covers/${draftId}/` : "backups/covers/";
  const [files] = await bucket.getFiles({ prefix });
  
  const backups = await Promise.all(files.map(async (file) => {
    const [metadata] = await file.getMetadata();
    return {
      path: file.name,
      metadata: metadata.metadata || {},
      createdAt: new Date(metadata.timeCreated || Date.now()),
    };
  }));
  
  return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export async function restoreCoverFromBackup(backupPath: string, draftId: number): Promise<string> {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(backupPath);
  
  const [exists] = await file.exists();
  if (!exists) {
    throw new Error(`Backup not found: ${backupPath}`);
  }
  
  const [buffer] = await file.download();
  
  const coverDir = "uploads/covers";
  if (!fs.existsSync(coverDir)) {
    fs.mkdirSync(coverDir, { recursive: true });
  }
  
  const filename = `restored-${draftId}-${Date.now()}.png`;
  const filepath = path.join(coverDir, filename);
  fs.writeFileSync(filepath, buffer);
  
  const newCoverUrl = `/uploads/covers/${filename}`;
  
  await db.update(draftEbooks)
    .set({ coverUrl: newCoverUrl })
    .where(eq(draftEbooks.id, draftId));
  
  console.log(`[Backup] Restored cover for draft ${draftId} from ${backupPath}`);
  return newCoverUrl;
}

export async function backupAllCurrentCovers(): Promise<{ total: number; backed: number; errors: number }> {
  const drafts = await db.select().from(draftEbooks);
  
  let backed = 0;
  let errors = 0;
  
  for (const draft of drafts) {
    if (draft.coverUrl) {
      try {
        await backupCoverFromFile(draft.id, draft.coverUrl);
        await backupEbookData(draft.id);
        backed++;
      } catch (error) {
        console.error(`[Backup] Failed to backup draft ${draft.id}:`, error);
        errors++;
      }
    }
  }
  
  console.log(`[Backup] Complete: ${backed}/${drafts.length} backed up, ${errors} errors`);
  return { total: drafts.length, backed, errors };
}

// Backup style definitions to cloud storage - ensures they survive rollbacks
export async function backupStyleDefinitions(): Promise<void> {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  
  // Import and backup style definitions
  const { COVER_STYLES, STYLE_DEFINITIONS_VERSION } = await import("./coverStyles");
  
  const styleData = {
    version: STYLE_DEFINITIONS_VERSION,
    backedUpAt: new Date().toISOString(),
    styles: COVER_STYLES
  };
  
  const filePath = `backups/config/cover-styles-${STYLE_DEFINITIONS_VERSION}.json`;
  const file = bucket.file(filePath);
  
  await file.save(JSON.stringify(styleData, null, 2), {
    contentType: "application/json",
    metadata: {
      version: STYLE_DEFINITIONS_VERSION
    }
  });
  
  console.log(`[Backup] Style definitions saved: ${filePath}`);
}

// Restore style definitions from cloud backup
export async function getBackedUpStyleDefinitions(): Promise<any> {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  
  const [files] = await bucket.getFiles({ prefix: "backups/config/cover-styles-" });
  
  if (files.length === 0) {
    console.log("[Backup] No style definitions backup found");
    return null;
  }
  
  // Get the most recent backup
  const latestFile = files[files.length - 1];
  const [content] = await latestFile.download();
  
  return JSON.parse(content.toString());
}

// ============================================================
// TYPOGRAPHY VAULT - Protected storage for AI-generated title/author styles
// These survive rollbacks and can only be deleted with explicit permission
// ============================================================

export interface TypographyStyleOption {
  id: string;  // Unique style ID like "style-1", "style-2", etc.
  name: string;  // Human-friendly name like "Elegant Gold", "Bold Modern"
  titleFont: string;
  authorFont: string;
  titleColor: string;
  titleSecondaryColor?: string;  // For gradients/two-tone effects
  authorColor: string;
  titlePosition: "top" | "top-left" | "top-right" | "center" | "bottom" | "bottom-left" | "bottom-right";
  titleAlignment: "left" | "center" | "right";
  authorPosition: "top" | "top-left" | "top-right" | "center" | "bottom" | "bottom-left" | "bottom-right";
  authorAlignment: "left" | "center" | "right";
  titleEffect: string;
  authorEffect: string;
  titleSize: number;  // Scale factor (1.0 = default)
  authorSize: number;
  titleCase: "original" | "uppercase" | "titlecase" | "lowercase";
  authorCase: "original" | "uppercase" | "titlecase" | "lowercase";
  reasoning: string;  // AI's explanation of why this style fits
  aesthetic: string;  // Description: "dark academia", "luxury", "minimalist", etc.
  concept?: string;  // Optional: Deeper explanation of the design concept
  colorTechnique?: string;  // two-tone-gradient, split-tone, glow-halo, etc.
  wordTreatment?: string;  // How individual words are styled differently
}

export interface TypographyVaultEntry {
  draftId: number;
  title: string;
  author: string;
  genre: string;
  coverAnalysis: {
    dominantColors: string[];
    imageStyle: string;
    emptyAreas: string[];
  };
  styleOptions: TypographyStyleOption[];
  selectedStyleId: string | null;  // Which style the user chose
  createdAt: string;
  updatedAt: string;
}

/**
 * Save typography styles to the vault for a specific draft
 * This survives rollbacks and is protected from deletion
 */
export async function saveTypographyToVault(
  draftId: number, 
  entry: Omit<TypographyVaultEntry, "createdAt" | "updatedAt">
): Promise<string> {
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  
  const vaultEntry: TypographyVaultEntry = {
    ...entry,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  const objectPath = `vault/typography/${draftId}/styles.json`;
  const file = bucket.file(objectPath);
  
  await file.save(JSON.stringify(vaultEntry, null, 2), {
    contentType: "application/json",
    metadata: {
      metadata: {
        draftId: String(draftId),
        title: entry.title,
        genre: entry.genre,
        styleCount: String(entry.styleOptions.length),
      }
    }
  });
  
  console.log(`[Typography Vault] Saved ${entry.styleOptions.length} styles for draft ${draftId}`);
  return objectPath;
}

/**
 * Retrieve typography styles from the vault
 */
export async function getTypographyFromVault(draftId: number): Promise<TypographyVaultEntry | null> {
  try {
    const bucketName = getBucketName();
    const bucket = storage.bucket(bucketName);
    
    const objectPath = `vault/typography/${draftId}/styles.json`;
    const file = bucket.file(objectPath);
    
    const [exists] = await file.exists();
    if (!exists) {
      console.log(`[Typography Vault] No styles found for draft ${draftId}`);
      return null;
    }
    
    const [content] = await file.download();
    return JSON.parse(content.toString()) as TypographyVaultEntry;
  } catch (error) {
    console.error(`[Typography Vault] Error reading styles for draft ${draftId}:`, error);
    return null;
  }
}

/**
 * Update the selected style for a draft
 */
export async function updateSelectedTypographyStyle(
  draftId: number, 
  styleId: string
): Promise<boolean> {
  const entry = await getTypographyFromVault(draftId);
  if (!entry) return false;
  
  entry.selectedStyleId = styleId;
  entry.updatedAt = new Date().toISOString();
  
  const bucketName = getBucketName();
  const bucket = storage.bucket(bucketName);
  const objectPath = `vault/typography/${draftId}/styles.json`;
  const file = bucket.file(objectPath);
  
  await file.save(JSON.stringify(entry, null, 2), {
    contentType: "application/json",
  });
  
  console.log(`[Typography Vault] Updated selected style to "${styleId}" for draft ${draftId}`);
  return true;
}

/**
 * List all typography entries in the vault
 */
export async function listTypographyVault(): Promise<Array<{ draftId: number; title: string; styleCount: number; hasSelection: boolean }>> {
  try {
    const bucketName = getBucketName();
    const bucket = storage.bucket(bucketName);
    
    const [files] = await bucket.getFiles({ prefix: "vault/typography/" });
    
    const entries: Array<{ draftId: number; title: string; styleCount: number; hasSelection: boolean }> = [];
    
    for (const file of files) {
      if (file.name.endsWith("/styles.json")) {
        try {
          const [content] = await file.download();
          const entry = JSON.parse(content.toString()) as TypographyVaultEntry;
          entries.push({
            draftId: entry.draftId,
            title: entry.title,
            styleCount: entry.styleOptions.length,
            hasSelection: !!entry.selectedStyleId,
          });
        } catch (e) {
          console.error(`[Typography Vault] Error parsing ${file.name}:`, e);
        }
      }
    }
    
    return entries;
  } catch (error) {
    console.error("[Typography Vault] Error listing entries:", error);
    return [];
  }
}

/**
 * Delete typography from vault - only when the matching ebook is deleted
 * This requires explicit draftId to ensure we're only deleting orphaned entries
 */
export async function deleteTypographyFromVault(draftId: number): Promise<boolean> {
  try {
    const bucketName = getBucketName();
    const bucket = storage.bucket(bucketName);
    
    const objectPath = `vault/typography/${draftId}/styles.json`;
    const file = bucket.file(objectPath);
    
    const [exists] = await file.exists();
    if (!exists) {
      return false;
    }
    
    await file.delete();
    console.log(`[Typography Vault] Deleted styles for draft ${draftId}`);
    return true;
  } catch (error) {
    console.error(`[Typography Vault] Error deleting styles for draft ${draftId}:`, error);
    return false;
  }
}

/**
 * Check if ebook still exists in database, if not, allow vault cleanup
 */
export async function cleanupOrphanedTypography(): Promise<{ cleaned: number; kept: number }> {
  const entries = await listTypographyVault();
  let cleaned = 0;
  let kept = 0;
  
  for (const entry of entries) {
    const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, entry.draftId));
    if (!draft) {
      // Ebook was deleted, safe to remove typography
      await deleteTypographyFromVault(entry.draftId);
      cleaned++;
    } else {
      kept++;
    }
  }
  
  console.log(`[Typography Vault] Cleanup: ${cleaned} orphaned entries removed, ${kept} kept`);
  return { cleaned, kept };
}
