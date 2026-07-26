import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { injectCanonical, injectOpenGraph, extractBookId, injectBookOpenGraph } from "./seoUtils";
import { db } from "./storage";
import { books } from "@shared/schema";
import { eq } from "drizzle-orm";

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
  app.use("*", async (req, res) => {
    const raw = fs.readFileSync(indexPath, "utf-8");
    const withCanonical = injectCanonical(raw, req.originalUrl);
    let html = injectOpenGraph(withCanonical, req.originalUrl);

    // For individual book pages, fetch book data and inject book-specific OG tags.
    const bookId = extractBookId(req.originalUrl);
    if (bookId !== null) {
      try {
        const [book] = await db.select({
          id: books.id,
          title: books.title,
          description: books.description,
          coverUrl: books.coverUrl,
        }).from(books).where(eq(books.id, bookId)).limit(1);
        if (book) {
          html = injectBookOpenGraph(html, book);
        }
      } catch {
        // Non-fatal: fall back to generic tags.
      }
    }

    res.status(200).set({ "Content-Type": "text/html" }).end(html);
  });
}
