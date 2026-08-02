import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { injectCanonical, injectOpenGraph, extractBookId, injectBookOpenGraph, extractEbookSlug, injectEbookLandingMeta, injectProductAppJsonLd, injectEbooksJsonLd, toSlug, type EbookLandingData } from "./seoUtils";
import { db } from "./storage";
import { books, bookReviews } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const rawPage = await vite.transformIndexHtml(url, template);
      const withCanonical = injectCanonical(rawPage, req.originalUrl);
      let page = injectOpenGraph(withCanonical, req.originalUrl);
      page = injectProductAppJsonLd(page, req.originalUrl);
      page = injectEbooksJsonLd(page, req.originalUrl);

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
            page = injectBookOpenGraph(page, book);
          }
        } catch {
          // Non-fatal: fall back to generic tags.
        }
      }

      // For ebook landing pages (/ebooks/b/:slug), inject Book+Product JSON-LD + per-book meta.
      const ebookSlug = extractEbookSlug(req.originalUrl);
      if (ebookSlug !== null) {
        try {
          const toSlugFn = (t: string) =>
            t.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
          const allVisible = await db.select({
            id: books.id,
            title: books.title,
            author: books.author,
            genre: books.genre,
            price: books.price,
            rating: books.rating,
            coverUrl: books.coverUrl,
            description: books.description,
          }).from(books).where(eq(books.visible, true));
          const book = allVisible.find(b => toSlugFn(b.title) === ebookSlug);
          if (book) {
            const [rev] = await db.select({ count: sql<number>`count(*)` }).from(bookReviews).where(eq(bookReviews.bookId, book.id));
            const reviewCount = Number(rev?.count ?? 0);
            page = injectEbookLandingMeta(page, { ...book, reviewCount } as EbookLandingData);
          }
        } catch {
          // Non-fatal: fall back to generic tags.
        }
      }

      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
