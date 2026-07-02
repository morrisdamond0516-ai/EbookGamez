import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function seedProductionData() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Always ensure the owner account exists with the correct password
    const ownerPassword = process.env.OWNER_ACCOUNT_PASSWORD || process.env.ADMIN_PASSWORD;
    if (ownerPassword) {
      const hash = await bcrypt.hash(ownerPassword, 10);
      await pool.query(
        `INSERT INTO customers (email, password_hash, name, created_at)
         VALUES ('owner@ebookgamez.com', $1, 'Site Owner', NOW())
         ON CONFLICT (email) DO UPDATE SET password_hash = $1`,
        [hash]
      );
      console.log("[Seed] owner@ebookgamez.com account ensured");
    }

    const { rows } = await pool.query("SELECT COUNT(*)::int as count FROM books");
    const bookCount = rows[0].count;
    
    if (bookCount > 0) {
      console.log(`Database already has ${bookCount} books — skipping seed`);
      return;
    }
    
    console.log("Empty database detected — seeding production data...");
    
    const seedFile = path.join(__dirname, "seed-data.sql");
    let seedSql: string | null = null;
    
    if (fs.existsSync(seedFile)) {
      seedSql = fs.readFileSync(seedFile, "utf-8");
    } else {
      const altPath = path.join(process.cwd(), "server", "seed-data.sql");
      if (fs.existsSync(altPath)) {
        seedSql = fs.readFileSync(altPath, "utf-8");
      }
    }
    
    if (!seedSql) {
      console.log("No seed-data.sql found — skipping seed");
      return;
    }
    
    const statements = seedSql.split("\n").filter(line => 
      line.trim().startsWith("INSERT INTO") || line.trim().startsWith("SELECT pg_catalog")
    );
    
    let inserted = 0;
    for (const stmt of statements) {
      try {
        const normalized = stmt.replace(
          /INSERT INTO public\.books VALUES/i,
          "INSERT INTO public.books (id, title, author, genre, category, price, rating, cover_url, description, created_at, visible) VALUES",
        );
        await pool.query(normalized);
        inserted++;
      } catch (err: any) {
        if (!err.message.includes("duplicate key")) {
          console.error(`Seed error: ${err.message}`);
        }
      }
    }
    
    console.log(`Seeded ${inserted} records successfully`);
  } catch (err: any) {
    console.error("Seed check error:", err.message);
  } finally {
    await pool.end();
  }
}
