/**
 * Server-only build: runs esbuild for the Express server, skipping the Vite
 * client build. Used by the validation runner so the check completes quickly
 * without timing out on a full client+server build.
 */

import { build as esbuild } from "esbuild";
import { rm, readFile, copyFile } from "fs/promises";

/** CJS bundles cannot use import.meta.url — strip the ESM dirname shim (esbuild injects __dirname). */
function cjsImportMetaDirnamePlugin() {
  return {
    name: "cjs-import-meta-dirname",
    setup(build: import("esbuild").PluginBuild) {
      build.onLoad({ filter: /\.ts$/ }, async (args) => {
        let contents = await readFile(args.path, "utf8");
        if (!contents.includes("import.meta.url")) {
          return null;
        }
        contents = contents.replace(
          /const __dirname = path\.dirname\(fileURLToPath\(import\.meta\.url\)\);\r?\n/g,
          "// __dirname provided by esbuild CJS bundle\n",
        );
        return { contents, loader: "ts" as const };
      });
    },
  };
}

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildServer() {
  await rm("dist", { recursive: true, force: true });

  console.log("building server (client skipped)...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    plugins: [cjsImportMetaDirnamePlugin()],
    minify: true,
    external: externals,
    logLevel: "info",
  });

  try {
    await copyFile("server/seed-data.sql", "dist/seed-data.sql");
    console.log("copied seed-data.sql to dist/");
  } catch {
    console.log("no seed-data.sql to copy (optional)");
  }

  console.log("server build complete.");
}

buildServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
