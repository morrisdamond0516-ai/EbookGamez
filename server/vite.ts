import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { injectCanonical, injectOpenGraph, extractBookId, injectBookOpenGraph } from "./seoUtils";
import { db } from "./storage";
import { books } from "@shared/schema";
import { eq } from "drizzle-orm";

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

      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
