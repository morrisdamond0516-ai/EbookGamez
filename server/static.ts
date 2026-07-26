import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { injectCanonical } from "./seoUtils";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html — inject the correct canonical before serving
  const indexPath = path.resolve(distPath, "index.html");
  app.use("*", (req, res) => {
    const raw = fs.readFileSync(indexPath, "utf-8");
    const html = injectCanonical(raw, req.originalUrl);
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });
}
