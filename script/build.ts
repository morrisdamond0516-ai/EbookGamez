import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, copyFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

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

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
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

  console.log("Cleaning large media directories to reduce deployment image size...");
  const largeDirs = ["uploads/illustrations", "uploads/covers", "uploads/ebooks", "uploads/coloring-pages", "uploads/pdfs", "uploads/temp"];
  for (const dir of largeDirs) {
    if (existsSync(dir)) {
      await rm(dir, { recursive: true, force: true });
      await mkdir(dir, { recursive: true });
      console.log(`  cleaned ${dir}/`);
    }
  }
  // Clean attached_assets root files only — preserve subdirectories (e.g. generated_images) which are static assets needed at runtime
  const attachedRoot = "attached_assets";
  if (existsSync(attachedRoot)) {
    const { readdirSync, statSync, unlinkSync } = await import("fs");
    for (const entry of readdirSync(attachedRoot)) {
      const full = `${attachedRoot}/${entry}`;
      if (statSync(full).isFile()) {
        unlinkSync(full);
      }
    }
    console.log(`  cleaned ${attachedRoot}/ root files (subdirs preserved)`);
  }
  console.log("Cleanup complete — empty upload dirs preserved for runtime use");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
