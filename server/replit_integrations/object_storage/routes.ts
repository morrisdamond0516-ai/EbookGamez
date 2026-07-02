import type { Express, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { getObjectAclPolicy } from "./objectAcl";

const uploadUrlRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

/**
 * Register object storage routes for file uploads.
 *
 * This provides routes for the presigned URL upload flow:
 * 1. POST /api/uploads/request-url - Get a presigned URL for uploading (admin only)
 * 2. The client then uploads directly to the presigned URL
 *
 * ACL enforcement:
 * - Public objects are served to anyone.
 * - Private/untagged objects require admin authentication.
 */
export function registerObjectStorageRoutes(
  app: Express,
  isAdminAuthenticated: (req: Request) => boolean
): void {
  const objectStorageService = new ObjectStorageService();

  /**
   * Request a presigned URL for file upload. Admin only.
   *
   * Request body (JSON):
   * {
   *   "name": "filename.jpg",
   *   "size": 12345,
   *   "contentType": "image/jpeg"
   * }
   */
  app.post("/api/uploads/request-url", uploadUrlRateLimit, async (req: Request, res: Response) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({
          error: "Missing required field: name",
        });
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();

      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Serve uploaded objects with ACL enforcement.
   *
   * GET /objects/:objectPath(*)
   *
   * - Public objects (ACL visibility === "public") are served to any requester.
   * - Private objects (or objects with no ACL policy) require admin authentication.
   */
  app.get("/objects/:objectPath(*)", async (req: Request, res: Response) => {
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);

      const aclPolicy = await getObjectAclPolicy(objectFile);
      const isPublic = aclPolicy?.visibility === "public";

      if (!isPublic && !isAdminAuthenticated(req)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error serving object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Object not found" });
      }
      return res.status(500).json({ error: "Failed to serve object" });
    }
  });
}
