import type { Express } from "express";
import { createServer, type Server } from "http";
import rateLimit from "express-rate-limit";
import { storage, db } from "./storage";
import { insertBookSchema, type InsertOrderItem, draftEbooks, generationJobs, books, bookReviews, readingAccess, pageViews, promoUsages, authorSubmissions, insertAuthorSubmissionSchema, affiliateApplications, insertAffiliateApplicationSchema, customers, orders, orderItems, subscriptions, activeCheckouts, bookRequests, insertBookRequestSchema } from "@shared/schema";
import bcrypt from "bcryptjs";
import { sendPasswordResetEmail, sendWelcomeEmail, sendPurchaseThankYouEmail, sendSubscriptionOTPEmail, sendPlanChangeEmail } from "./emailService";
import { generateOTP, verifyOTP, requireSubscriptionAuth, subscriptionRateLimit, otpRateLimit, sensitiveActionRateLimit, validateSession } from "./subscriptionAuth";
import { z } from "zod";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import multer from "multer";
import path from "path";
import fs from "fs";
import { extractCoverFromFile } from "./pdfProcessor";
import { desc, eq, inArray, sql, isNotNull, isNull, and } from "drizzle-orm";
import * as contentStudio from "./contentStudio";
import * as contentRefresh from "./contentRefresh";
import * as subscriptionService from "./subscriptionService";
import archiver from "archiver";
import unzipper from "unzipper";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerChatRoutes } from "./replit_integrations/chat";
import OpenAI from "openai";
import * as backupService from "./backupService";
import sharp from "sharp";
import epubGenMemory from "epub-gen-memory";
import { generateDistributionEpub } from "./epubGenerator";
import subscriptionSessionRouter from "./subscriptionSessionRoute";
import { registerNewsletterRoutes } from "./newsletter";
const epub = (epubGenMemory as any).default || epubGenMemory;

// Ensure upload directories exist
const uploadDirs = ['uploads/temp', 'uploads/covers', 'uploads/pdfs'];
uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

const upload = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for cover extraction'));
    }
  },
});

// Separate multer instance for ZIP uploads
const uploadZip = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit for bulk uploads
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.zip') {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP files are allowed for bulk uploads'));
    }
  },
});

// Multer instance for reference image uploads
const uploadReferenceImage = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit for images
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images are allowed'));
    }
  },
});

const uploadCoverImage = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images are allowed'));
    }
  },
});

// Helper to safely extract files from ZIP (prevents Zip Slip attacks)
function isSafePath(extractDir: string, entryPath: string): boolean {
  const resolved = path.resolve(extractDir, entryPath);
  return resolved.startsWith(path.resolve(extractDir) + path.sep);
}

import crypto from "crypto";
import { execSync } from "child_process";

const adminSessions = new Set<string>();

function isAdminAuthenticated(req: any): boolean {
  const token = req.headers["x-admin-token"] as string;
  return !!token && adminSessions.has(token);
}

const customerSessions = new Map<string, { customerId: number; email: string }>();

function getCustomerSession(req: any): { customerId: number; email: string } | null {
  const token = req.headers["x-customer-token"] as string;
  if (!token) return null;
  return customerSessions.get(token) || null;
}

// Short-lived order access tokens issued after payment; valid for 1 hour.
// These let a buyer who has no customer account download/read their just-purchased ebooks.
const orderAccessTokens = new Map<string, { customerEmail: string; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  orderAccessTokens.forEach((entry, key) => {
    if (entry.expiresAt < now) orderAccessTokens.delete(key);
  });
}, 5 * 60 * 1000);

function getOrderTokenEmail(req: any): string | null {
  const token = req.headers["x-order-token"] as string;
  if (!token) return null;
  const entry = orderAccessTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    orderAccessTokens.delete(token);
    return null;
  }
  return entry.customerEmail;
}

function getAuthenticatedEmail(req: any): string | null {
  const customerSession = getCustomerSession(req);
  if (customerSession) return customerSession.email;
  const subToken = req.headers["x-subscription-token"] as string;
  if (subToken) {
    const email = validateSession(subToken);
    if (email) return email;
  }
  return getOrderTokenEmail(req);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Register Object Storage routes for cloud backups (admin-gated upload; ACL-enforced download)
  registerObjectStorageRoutes(app, isAdminAuthenticated);

  // ======== AUTH RATE LIMITERS ========

  const adminLoginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Please try again later." },
  });

  const customerLoginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Please try again later." },
  });

  const customerSignupRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many signup attempts. Please try again later." },
  });

  const forgotPasswordRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many password reset requests. Please try again later." },
  });

  const resetPasswordRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many password reset attempts. Please try again later." },
  });

  // ======== CUSTOMER AUTH ROUTES ========

  app.post("/api/customer/signup", customerSignupRateLimit, async (req, res) => {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const existing = await db.select().from(customers).where(eq(customers.email, email.toLowerCase().trim())).limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const [customer] = await db.insert(customers).values({
        email: email.toLowerCase().trim(),
        passwordHash,
        name: name || null,
      }).returning();

      const token = crypto.randomBytes(32).toString("hex");
      const sessionKey = `customer_${customer.id}_${token}`;
      customerSessions.set(sessionKey, { customerId: customer.id, email: customer.email });

      try {
        await sendWelcomeEmail(customer.email, name);
      } catch (e: any) {
        console.log("[CustomerAuth] Welcome email failed:", e.message);
      }

      res.json({ token: sessionKey, customer: { id: customer.id, email: customer.email, name: customer.name } });
    } catch (error: any) {
      console.error("[CustomerAuth] Signup error:", error.message);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.post("/api/customer/login", customerLoginRateLimit, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const [customer] = await db.select().from(customers).where(eq(customers.email, email.toLowerCase().trim())).limit(1);
      if (!customer) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, customer.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const sessionKey = `customer_${customer.id}_${token}`;
      customerSessions.set(sessionKey, { customerId: customer.id, email: customer.email });

      res.json({ token: sessionKey, customer: { id: customer.id, email: customer.email, name: customer.name } });
    } catch (error: any) {
      console.error("[CustomerAuth] Login error:", error.message);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/customer/forgot-password", forgotPasswordRateLimit, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const [customer] = await db.select().from(customers).where(eq(customers.email, email.toLowerCase().trim())).limit(1);
      if (!customer) {
        return res.json({ message: "If an account exists with that email, a reset link has been sent." });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.update(customers)
        .set({ resetToken, resetTokenExpiresAt: expiresAt })
        .where(eq(customers.id, customer.id));

      await sendPasswordResetEmail(customer.email, resetToken);

      res.json({ message: "If an account exists with that email, a reset link has been sent." });
    } catch (error: any) {
      console.error("[CustomerAuth] Forgot password error:", error.message);
      res.status(500).json({ error: "Failed to process request" });
    }
  });

  app.post("/api/customer/reset-password", resetPasswordRateLimit, async (req, res) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ error: "Token and new password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      const [customer] = await db.select().from(customers).where(eq(customers.resetToken, token)).limit(1);
      if (!customer || !customer.resetTokenExpiresAt || customer.resetTokenExpiresAt < new Date()) {
        return res.status(400).json({ error: "Invalid or expired reset link. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      await db.update(customers)
        .set({ passwordHash, resetToken: null, resetTokenExpiresAt: null })
        .where(eq(customers.id, customer.id));

      // Invalidate all existing sessions for this customer so stolen tokens cannot be reused
      for (const [sessionToken, sessionData] of customerSessions.entries()) {
        if (sessionData.customerId === customer.id) {
          customerSessions.delete(sessionToken);
        }
      }

      res.json({ message: "Password has been reset successfully. You can now log in." });
    } catch (error: any) {
      console.error("[CustomerAuth] Reset password error:", error.message);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  app.get("/api/customer/me", async (req, res) => {
    const session = getCustomerSession(req);
    if (!session) {
      return res.status(401).json({ error: "Not logged in" });
    }

    const [customer] = await db.select().from(customers).where(eq(customers.id, session.customerId)).limit(1);
    if (!customer) {
      return res.status(401).json({ error: "Account not found" });
    }

    res.json({ customer: { id: customer.id, email: customer.email, name: customer.name, createdAt: customer.createdAt } });
  });

  app.get("/api/customer/purchases", async (req, res) => {
    const session = getCustomerSession(req);
    if (!session) {
      return res.status(401).json({ error: "Not logged in" });
    }

    try {
      const customerOrders = await db.select().from(orders)
        .where(eq(orders.customerEmail, session.email))
        .orderBy(desc(orders.createdAt));

      const orderIds = customerOrders.map(o => o.id);
      let items: any[] = [];
      if (orderIds.length > 0) {
        items = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));
      }

      const bookIds = [...new Set(items.map(i => i.bookId))];
      let bookDetails: any[] = [];
      if (bookIds.length > 0) {
        bookDetails = await db.select().from(books).where(inArray(books.id, bookIds));
      }

      const access = await db.select().from(readingAccess)
        .where(eq(readingAccess.customerEmail, session.email));

      const sub = await db.select().from(subscriptions)
        .where(eq(subscriptions.customerEmail, session.email))
        .orderBy(desc(subscriptions.createdAt))
        .limit(1);

      res.json({
        orders: customerOrders.map(o => ({
          ...o,
          items: items.filter(i => i.orderId === o.id).map(i => ({
            ...i,
            book: bookDetails.find(b => b.id === i.bookId)
          }))
        })),
        readingAccess: access,
        subscription: sub[0] || null,
      });
    } catch (error: any) {
      console.error("[CustomerAuth] Purchases error:", error.message);
      res.status(500).json({ error: "Failed to fetch purchases" });
    }
  });

  // ======== END CUSTOMER AUTH ROUTES ========

  app.get("/landing", (req, res) => {
    res.type("text/html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EbookGamez - Ebooks, Games, Downloads & Gaming Guides</title>
  <meta name="description" content="EbookGamez is a digital entertainment platform offering 545+ full-length ebooks, free-to-play HTML5 games, PC and console game downloads, and expert gaming guides.">
  <style>body{font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:40px 20px;background:#111;color:#eee;line-height:1.7}h1{color:#d4af37;font-size:2.2em}h2{color:#d4af37;margin-top:30px}a{color:#d4af37}p{font-size:1.1em}.cta{display:inline-block;background:#d4af37;color:#111;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;margin:8px 8px 8px 0}.section{background:#1a1a1a;padding:25px;border-radius:10px;margin:20px 0;border:1px solid #333}.footer{margin-top:40px;padding-top:20px;border-top:1px solid #333;text-align:center;color:#888}</style>
</head>
<body>
  <h1>EbookGamez</h1>
  <p><strong>Your ultimate digital entertainment platform.</strong> Discover 545+ full-length ebooks, play free browser games, download top PC & console titles, and master your favorite games with expert guides.</p>

  <div class="section">
    <h2>Ebook Store — 545+ Full-Length Books</h2>
    <p>Browse our curated library spanning fiction, non-fiction, self-help, romance, thriller, horror, fantasy, science fiction, historical fiction, philosophy, and more. Includes 25 free public domain classics like Pride and Prejudice, Dracula, and The Great Gatsby. Every ebook is available for online reading or EPUB download.</p>
    <p><strong>Pricing:</strong> Individual ebooks from $0.99 to $21.99 based on length and genre. Three purchase options: Read Online, Download, or Bundle (Read + Download).</p>
    <a class="cta" href="https://ebookgamez.com/catalog">Browse Ebook Catalog</a>
  </div>

  <div class="section">
    <h2>Reading Pass Subscription — 5 Tiers</h2>
    <p>Subscribe for unlimited monthly access to our full library:</p>
    <ul>
      <li><strong>Lite Pass</strong> — $4.99/month: Unlimited reads, 1 download</li>
      <li><strong>Reader Pass</strong> — $8.99/month: Unlimited reads, 2 downloads</li>
      <li><strong>Value Pass</strong> — $12.99/month: Unlimited reads, 3 downloads</li>
      <li><strong>Premium Pass</strong> — $18.99/month: Unlimited reads, 5 downloads</li>
      <li><strong>VIP Pass</strong> — $25.99/month: Unlimited reads, 8 downloads</li>
    </ul>
    <a class="cta" href="https://ebookgamez.com/subscription">View Subscription Plans</a>
  </div>

  <div class="section">
    <h2>Play Games — Free HTML5 Browser Games</h2>
    <p>Enjoy hundreds of free-to-play browser games instantly — no downloads required. Action, puzzle, adventure, racing, sports, strategy, and more. Play on any device: desktop, tablet, or mobile.</p>
    <a class="cta" href="https://ebookgamez.com/games">Play Free Games</a>
  </div>

  <div class="section">
    <h2>Download Hub — PC & Console Games</h2>
    <p>Discover and download the latest PC and console game titles. Browse reviews, watch trailers, and find direct download links for today's top gaming titles across all platforms.</p>
    <a class="cta" href="https://ebookgamez.com/downloads">Browse Downloads</a>
  </div>

  <div class="section">
    <h2>Gaming Guides — Expert Tips & Strategies</h2>
    <p>Level up your gameplay with comprehensive gaming guides covering the most popular games of 2026. Our expert walkthroughs, pro settings guides, tier lists, and strategy breakdowns are written for players of all skill levels.</p>

    <h3>Fortnite Guides</h3>
    <p><strong>Best Fortnite Settings for Maximum FPS in 2026:</strong> Optimize your Fortnite performance with pro-level video, audio, keybind, and sensitivity settings. Covers rendering modes, shadow settings, NVIDIA Control Panel tweaks, and the exact mouse DPI and sensitivity ranges used by top competitive players to achieve 240+ FPS consistently.</p>
    <p><strong>Fortnite Chapter 6 Map Guide:</strong> Complete breakdown of every named location, hidden loot spots, NPC locations, and the best landing spots for competitive and casual play. Includes rotation strategy, storm positioning, and how to find hidden chests and supply llamas.</p>

    <h3>Minecraft Guides</h3>
    <p><strong>50 Minecraft House Ideas — Starter to Mansion:</strong> Step-by-step building guides for every skill level. Starter survival houses, medieval castles, modern mansions, underwater bases, hobbit holes, and treehouse designs with material lists and building tips that make any build look professional.</p>
    <p><strong>Minecraft Redstone for Beginners:</strong> Learn redstone from scratch. Covers basic circuits, repeaters, comparators, pistons, and practical builds including automatic sugar cane farms, chicken farms, item sorters, and hidden piston doors with step-by-step instructions.</p>

    <h3>Valorant Guides</h3>
    <p><strong>Best Valorant Crosshair Codes from Pro Players:</strong> Copy the exact crosshair settings from TenZ, Demon1, Aspas, and other top pros. Includes import codes you can paste directly into the game and a breakdown of how to find your own ideal crosshair size, color, and style.</p>
    <p><strong>Valorant Agent Guide — Which Agent Should You Main?:</strong> Find your perfect Valorant agent based on playstyle. Covers every Duelist, Controller, Sentinel, and Initiator with ability tips, best maps, and recommendations for solo queue vs. team play.</p>

    <h3>Roblox & Popular Games</h3>
    <p><strong>Top 25 Roblox Games in 2026:</strong> The most popular Roblox experiences right now, ranked by concurrent players, total visits, and community rating. Covers Blox Fruits, Brookhaven, Adopt Me, Tower of Hell, Murder Mystery 2, and 20 more games with descriptions of what makes each one worth playing.</p>
    <p><strong>Apex Legends Season 22 Tier List:</strong> Every Legend ranked from S-Tier to D-Tier for ranked play, with ability analysis, team synergies, pick rates, and meta commentary after the latest balance patch.</p>

    <h3>Open World & RPG Guides</h3>
    <p><strong>Elden Ring Beginner Guide:</strong> Everything new players need to survive the Lands Between. Best starting classes, when to explore vs. fight bosses, dodge vs. block mechanics, spirit ash summons, and the hidden tips the game never explains — including how to unlock Torrent, where to find the Roundtable Hold, and how to upgrade weapons using Smithing Stones.</p>
    <p><strong>Hogwarts Legacy Complete Guide:</strong> All spells ranked by usefulness, best Talent upgrades, Room of Requirement setup strategy, Demiguise Moon locations for Alohomora upgrades, and hidden secrets most players miss on their first playthrough.</p>
    <p><strong>Baldur's Gate 3 — Best Classes & Builds:</strong> Every class analyzed for beginners, the strongest community-discovered builds including the Paladin/Warlock Padlock and Gloomstalker/Assassin invisible sniper, plus a complete multiclassing guide explaining when dipping is worth it.</p>
    <p><strong>Stardew Valley Complete Guide:</strong> Best crops by season, mining floor priorities, Community Center bundle strategy, romance and gifting guide for every bachelor/bachelorette, and how to set up passive income through the Room of Requirement and shipping box.</p>
    <p><strong>GTA Online Money Guide 2026:</strong> Every money-making method ranked by hourly earnings. Covers Cayo Perico Heist, Agency VIP Contract, Auto Shop Robbery Contracts, Nightclub passive income, and the fastest path from $0 to millionaire for new players.</p>

    <h3>Competitive FPS & Strategy</h3>
    <p><strong>Best Warzone Loadouts:</strong> Current meta weapons and exact attachments for every budget. AR + SMG pairings, perk recommendations, equipment choices, and why UAVs are the best killstreak investment in the game.</p>
    <p><strong>League of Legends Beginner Guide:</strong> Map and lane overview, how to CS (last-hit) correctly, trading fundamentals, warding strategy, champion recommendations for beginners by role, and when you're ready to start playing ranked.</p>
    <p><strong>Overwatch 2 Ranked Climbing Guide:</strong> Why most players are hardstuck and the real habits that cause it. Hero recommendations by rank and role, positioning fundamentals, and communication strategies that actually improve team performance.</p>

    <h3>Hardware & PC Gaming</h3>
    <p><strong>Ultimate Gaming PC Build Guide 2026:</strong> Complete build lists for $800, $1,500, and $3,000+ budgets. Covers the latest RTX 50-series GPUs, AMD Ryzen 3D V-Cache CPUs, DDR5 memory, PCIe 5.0 SSDs, and the most common first-time builder mistakes to avoid.</p>

    <a class="cta" href="https://ebookgamez.com/guides">Read All Gaming Guides</a>
  </div>

  <div class="section">
    <h2>Why EbookGamez?</h2>
    <ul>
      <li>545+ professionally crafted full-length ebooks</li>
      <li>25 free public domain classics</li>
      <li>Secure payments via Stripe</li>
      <li>Instant online reading — no app required</li>
      <li>EPUB downloads for offline reading</li>
      <li>Free browser games — play instantly</li>
      <li>Expert gaming guides and walkthroughs</li>
      <li>Mobile-friendly responsive design</li>
      <li>Affordable subscription plans starting at $2.99/month</li>
    </ul>
  </div>

  <div class="footer">
    <p><strong>EbookGamez</strong> — Ebooks, Games, Downloads & Guides</p>
    <p>Contact: <a href="mailto:ebookgames@yahoo.com">ebookgames@yahoo.com</a></p>
    <p><a href="https://ebookgamez.com">https://ebookgamez.com</a></p>
  </div>
</body>
</html>`);
  });

  app.get("/robots.txt", (req, res) => {
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.type("text/plain").send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/*
Disallow: /api/
Sitemap: https://ebookgamez.com/sitemap.xml

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: Twitterbot
Allow: /
`);
  });

  app.get("/sitemap.xml", async (req, res) => {
    try {
      const allBooks = await storage.getAllBooks({ includeHidden: false });
      const baseUrl = "https://ebookgamez.com";
      const now = new Date().toISOString().split("T")[0];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority><lastmod>${now}</lastmod></url>
  <url><loc>${baseUrl}/catalog</loc><changefreq>daily</changefreq><priority>0.9</priority><lastmod>${now}</lastmod></url>
  <url><loc>${baseUrl}/games</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${now}</lastmod></url>
  <url><loc>${baseUrl}/downloads</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${now}</lastmod></url>
  <url><loc>${baseUrl}/guides</loc><changefreq>weekly</changefreq><priority>0.8</priority><lastmod>${now}</lastmod></url>
  <url><loc>${baseUrl}/subscription</loc><changefreq>monthly</changefreq><priority>0.7</priority><lastmod>${now}</lastmod></url>`;

      for (const book of allBooks) {
        const lastmod = book.createdAt
          ? new Date(book.createdAt).toISOString().split("T")[0]
          : now;
        xml += `\n  <url><loc>${baseUrl}/book/${book.id}</loc><changefreq>monthly</changefreq><priority>0.6</priority><lastmod>${lastmod}</lastmod></url>`;
      }

      xml += `\n</urlset>`;
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.type("application/xml").send(xml);
    } catch (error) {
      res.status(500).send("Error generating sitemap");
    }
  });

  app.post("/api/admin/login", adminLoginRateLimit, (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return res.status(500).json({ error: "Admin password not configured" });
    }
    if (password === adminPassword) {
      const token = crypto.randomBytes(32).toString("hex");
      adminSessions.add(token);
      return res.json({ success: true, token });
    }
    return res.status(401).json({ error: "Invalid password" });
  });

  app.post("/api/admin/logout", (req, res) => {
    const token = req.headers["x-admin-token"] as string;
    if (token) adminSessions.delete(token);
    return res.json({ success: true });
  });

  registerNewsletterRoutes(app, isAdminAuthenticated);

  app.post("/api/track", async (req, res) => {
    try {
      const { path: pagePath, visitorId, referrer, sessionId, customerEmail, prevPath, prevTimeOnPage } = req.body;
      if (!pagePath || !visitorId) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const ua = req.headers["user-agent"] || "";
      const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : /tablet/i.test(ua) ? "tablet" : "desktop";

      // Insert the new page view
      await db.insert(pageViews).values({
        path: pagePath,
        visitorId,
        referrer: referrer || null,
        userAgent: ua.slice(0, 500),
        deviceType,
        sessionId: sessionId || null,
        customerEmail: customerEmail || null,
      });

      // If time spent on previous page was provided, update that record
      if (prevPath && prevTimeOnPage && Number(prevTimeOnPage) > 0 && Number(prevTimeOnPage) < 3600) {
        await db.execute(sql`
          UPDATE page_views SET time_on_page = ${Number(prevTimeOnPage)}
          WHERE id = (
            SELECT id FROM page_views
            WHERE visitor_id = ${visitorId} AND path = ${prevPath}
              AND time_on_page IS NULL
            ORDER BY created_at DESC
            LIMIT 1
          )
        `);
      }

      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: "Tracking failed" });
    }
  });

  // Beacon endpoint — receives exit time for the last page in a session
  app.post("/api/track/exit", async (req, res) => {
    try {
      let body = req.body;
      // sendBeacon sends text/plain with a JSON string
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch { return res.status(400).end(); }
      }
      const { path: pagePath, visitorId, timeOnPage } = body || {};
      if (!pagePath || !visitorId || !timeOnPage) return res.status(400).end();
      const t = Number(timeOnPage);
      if (t < 1 || t > 3600) return res.status(400).end();

      await db.execute(sql`
        UPDATE page_views SET time_on_page = ${t}
        WHERE id = (
          SELECT id FROM page_views
          WHERE visitor_id = ${visitorId} AND path = ${pagePath}
            AND time_on_page IS NULL
          ORDER BY created_at DESC
          LIMIT 1
        )
      `);
      res.status(204).end();
    } catch {
      res.status(500).end();
    }
  });

  // Public feedback endpoint — captures exit-popup and general site feedback
  app.post("/api/feedback", async (req, res) => {
    try {
      const { message, source } = req.body || {};
      if (!message || typeof message !== "string" || message.trim().length < 3) {
        return res.status(400).json({ error: "Feedback message is required" });
      }
      const ua = req.headers["user-agent"] || "";
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
      // Log to server console so admin can review
      console.log(`[Feedback] source=${source || "unknown"} ip=${ip} ua=${ua.slice(0, 80)}\n  >> ${message.trim().slice(0, 1000)}`);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "Could not save feedback" });
    }
  });

  app.get("/api/admin/analytics", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    try {
      const { days = "30" } = req.query;
      const daysNum = Math.min(365, Math.max(1, parseInt(days as string) || 30));
      const since = new Date();
      since.setDate(since.getDate() - daysNum);

      const [
        totalViews,
        uniqueVisitors,
        topPages,
        dailyViews,
        deviceBreakdown,
        topReferrers,
        recentViews,
        purchaseSummary,
        monthlyPurchases,
        recentPurchases,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(pageViews)
          .where(sql`${pageViews.createdAt} >= ${since}`),
        db.select({ count: sql<number>`count(distinct ${pageViews.visitorId})` }).from(pageViews)
          .where(sql`${pageViews.createdAt} >= ${since}`),
        db.select({ 
          path: pageViews.path, 
          views: sql<number>`count(*)`,
          uniqueVisitors: sql<number>`count(distinct ${pageViews.visitorId})`,
          avgTimeOnPage: sql<number>`round(avg(${pageViews.timeOnPage}) filter (where ${pageViews.timeOnPage} is not null and ${pageViews.timeOnPage} > 0))`,
        }).from(pageViews)
          .where(sql`${pageViews.createdAt} >= ${since}`)
          .groupBy(pageViews.path)
          .orderBy(sql`count(*) desc`)
          .limit(20),
        db.select({
          date: sql<string>`to_char(${pageViews.createdAt}, 'YYYY-MM-DD')`,
          views: sql<number>`count(*)`,
          visitors: sql<number>`count(distinct ${pageViews.visitorId})`,
        }).from(pageViews)
          .where(sql`${pageViews.createdAt} >= ${since}`)
          .groupBy(sql`to_char(${pageViews.createdAt}, 'YYYY-MM-DD')`)
          .orderBy(sql`to_char(${pageViews.createdAt}, 'YYYY-MM-DD')`),
        db.select({
          deviceType: pageViews.deviceType,
          count: sql<number>`count(*)`,
        }).from(pageViews)
          .where(sql`${pageViews.createdAt} >= ${since}`)
          .groupBy(pageViews.deviceType),
        db.select({
          referrer: pageViews.referrer,
          count: sql<number>`count(*)`,
        }).from(pageViews)
          .where(sql`${pageViews.createdAt} >= ${since} AND ${pageViews.referrer} IS NOT NULL AND ${pageViews.referrer} != ''`)
          .groupBy(pageViews.referrer)
          .orderBy(sql`count(*) desc`)
          .limit(10),
        db.select({
          path: pageViews.path,
          visitorId: pageViews.visitorId,
          deviceType: pageViews.deviceType,
          referrer: pageViews.referrer,
          timeOnPage: pageViews.timeOnPage,
          createdAt: pageViews.createdAt,
        }).from(pageViews)
          .orderBy(sql`${pageViews.createdAt} desc`)
          .limit(50),
        // Total purchases + revenue in selected period
        db.select({
          count: sql<number>`count(*)`,
          revenue: sql<string>`coalesce(sum(${orders.total}), 0)`,
          uniqueBuyers: sql<number>`count(distinct ${orders.customerEmail})`,
        }).from(orders)
          .where(sql`${orders.status} = 'completed' AND ${orders.createdAt} >= ${since}`),
        // Monthly purchases (last 12 months, regardless of selected period)
        db.select({
          month: sql<string>`to_char(${orders.createdAt}, 'YYYY-MM')`,
          count: sql<number>`count(*)`,
          revenue: sql<string>`coalesce(sum(${orders.total}), 0)`,
        }).from(orders)
          .where(sql`${orders.status} = 'completed' AND ${orders.createdAt} >= now() - interval '12 months'`)
          .groupBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`)
          .orderBy(sql`to_char(${orders.createdAt}, 'YYYY-MM')`),
        // Recent purchases for activity feed
        db.select({
          id: orders.id,
          customerEmail: orders.customerEmail,
          total: orders.total,
          status: orders.status,
          createdAt: orders.createdAt,
        }).from(orders)
          .where(sql`${orders.status} = 'completed'`)
          .orderBy(sql`${orders.createdAt} desc`)
          .limit(20),
      ]);

      // Session-level metrics
      const [pagesPerSessionRow, sessionJourneysRaw] = await Promise.all([
        db.execute(sql`
          SELECT
            round(avg(page_count)::numeric, 1) AS avg_pages_per_session,
            round(avg(total_time)::numeric)     AS avg_session_seconds
          FROM (
            SELECT session_id,
                   count(*)                                    AS page_count,
                   sum(time_on_page) filter (where time_on_page > 0) AS total_time
            FROM page_views
            WHERE session_id IS NOT NULL
              AND created_at >= ${since}
            GROUP BY session_id
          ) s
        `),
        db.execute(sql`
          SELECT
            session_id,
            visitor_id,
            device_type,
            customer_email,
            min(created_at)            AS session_start,
            count(*)                   AS page_count,
            sum(time_on_page) filter (where time_on_page > 0) AS total_time,
            array_agg(path ORDER BY created_at) AS pages
          FROM page_views
          WHERE session_id IS NOT NULL
            AND created_at >= ${since}
          GROUP BY session_id, visitor_id, device_type, customer_email
          ORDER BY session_start DESC
          LIMIT 40
        `),
      ]);

      const ppsRow = pagesPerSessionRow.rows?.[0] as Record<string, unknown> | undefined;
      const sessionJourneys = (sessionJourneysRaw.rows ?? []).map((r: Record<string, unknown>) => ({
        sessionId: String(r.session_id ?? "").slice(0, 8),
        visitorId: String(r.visitor_id ?? "").slice(0, 8),
        deviceType: r.device_type ?? "desktop",
        customerEmail: r.customer_email ?? null,
        sessionStart: r.session_start,
        pageCount: Number(r.page_count ?? 0),
        totalTime: r.total_time ? Number(r.total_time) : null,
        pages: Array.isArray(r.pages) ? r.pages : [],
      }));

      res.json({
        period: `${daysNum} days`,
        totalViews: Number(totalViews[0]?.count ?? 0),
        uniqueVisitors: Number(uniqueVisitors[0]?.count ?? 0),
        avgPagesPerSession: ppsRow?.avg_pages_per_session ? Number(ppsRow.avg_pages_per_session) : null,
        avgSessionSeconds: ppsRow?.avg_session_seconds ? Number(ppsRow.avg_session_seconds) : null,
        topPages,
        dailyViews,
        deviceBreakdown,
        topReferrers,
        recentViews,
        sessionJourneys,
        totalPurchases: Number(purchaseSummary[0]?.count ?? 0),
        totalRevenue: Number(purchaseSummary[0]?.revenue ?? 0),
        uniqueBuyers: Number(purchaseSummary[0]?.uniqueBuyers ?? 0),
        monthlyPurchases: monthlyPurchases.map(m => ({
          month: m.month,
          count: Number(m.count),
          revenue: Number(m.revenue),
        })),
        recentPurchases,
      });
    } catch (error) {
      console.error("Analytics error:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/admin/verify", (req, res) => {
    return res.json({ authenticated: isAdminAuthenticated(req) });
  });

  
  // GET /api/social-proof - Aggregate activity stats + recent book activity
  app.get("/api/social-proof", async (req, res) => {
    try {
      const statsRows = await db.execute(sql`
        SELECT
          COUNT(DISTINCT visitor_id) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')  AS visitors_week,
          COUNT(DISTINCT visitor_id) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS visitors_month,
          COUNT(*) FILTER (WHERE path ~ '^/read/')                                             AS read_sessions_total,
          COUNT(*) FILTER (WHERE path ~ '^/read/' AND created_at >= CURRENT_DATE)             AS read_sessions_today,
          COUNT(*) FILTER (WHERE path ~ '^/read/' AND created_at >= NOW() - INTERVAL '15 minutes') AS reading_now,
          COUNT(*) FILTER (WHERE path IN ('/cart','/checkout','/subscription') AND created_at >= NOW() - INTERVAL '15 minutes') AS checkout_now,
          COUNT(*) FILTER (WHERE path IN ('/cart','/checkout','/subscription') AND created_at >= CURRENT_DATE) AS checkout_today,
          (SELECT COUNT(*) FROM books WHERE visible = true) AS published_books
        FROM page_views
      `);

      const bookRows = await db.execute(sql`
        WITH book_activity AS (
          SELECT
            'reading' AS activity_type,
            b.title,
            MAX(pv.created_at) AS last_seen,
            BOOL_OR(pv.created_at >= NOW() - INTERVAL '15 minutes') AS is_live,
            -- Pick the most recent non-null customer email for this title
            (array_remove(array_agg(pv.customer_email ORDER BY pv.created_at DESC), NULL))[1] AS customer_email
          FROM page_views pv
          JOIN books b ON b.id = CAST(
            NULLIF(regexp_replace(pv.path, '^/read/', ''), '') AS integer
          )
          WHERE pv.path ~ '^/read/[0-9]+'
            AND pv.created_at >= NOW() - INTERVAL '7 days'
            AND b.visible = true AND b.title IS NOT NULL
          GROUP BY b.title

          UNION ALL

          SELECT
            'viewing' AS activity_type,
            b.title,
            MAX(pv.created_at) AS last_seen,
            BOOL_OR(pv.created_at >= NOW() - INTERVAL '15 minutes') AS is_live,
            (array_remove(array_agg(pv.customer_email ORDER BY pv.created_at DESC), NULL))[1] AS customer_email
          FROM page_views pv
          JOIN books b ON b.id = CAST(
            NULLIF(regexp_replace(pv.path, '^/books?/', ''), '') AS integer
          )
          WHERE pv.path ~ '^/books?/[0-9]+'
            AND pv.created_at >= NOW() - INTERVAL '7 days'
            AND b.visible = true AND b.title IS NOT NULL
          GROUP BY b.title
        )
        SELECT
          ba.activity_type,
          ba.title,
          ba.last_seen,
          ba.is_live,
          -- Look up the customer's first name; null if anonymous
          split_part(COALESCE(c.name, ''), ' ', 1) AS customer_first_name
        FROM book_activity ba
        LEFT JOIN customers c ON LOWER(c.email) = LOWER(ba.customer_email)
        ORDER BY ba.last_seen DESC
        LIMIT 20
      `);

      res.json({
        stats: statsRows.rows[0] || {},
        books: bookRows.rows || [],
      });
    } catch (err) {
      res.json({ stats: {}, books: [] });
    }
  });

  // GET /api/books - Get all books with optional filtering and pagination
  app.get("/api/books", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    try {
      const { category, genre, search, page, limit: limitParam } = req.query;
      const includeHidden = isAdminAuthenticated(req);
      
      const filters: any = {
        category: category as string | undefined,
        genre: genre as string | undefined,
        search: search as string | undefined,
        includeHidden,
      };

      if (page) {
        const pageNum = Math.max(1, parseInt(page as string) || 1);
        const perPage = Math.min(100, Math.max(1, parseInt(limitParam as string) || 24));
        filters.limit = perPage;
        filters.offset = (pageNum - 1) * perPage;

        const [allBooks, total] = await Promise.all([
          storage.getAllBooks(filters),
          storage.getBookCount({ category: filters.category, genre: filters.genre, search: filters.search, includeHidden }),
        ]);

        res.json({
          books: allBooks,
          total,
          page: pageNum,
          perPage,
          totalPages: Math.ceil(total / perPage),
        });
      } else {
        const allBooks = await storage.getAllBooks(filters);
        res.json(allBooks);
      }
    } catch (error) {
      console.error("Error fetching books:", error);
      res.status(500).json({ error: "Failed to fetch books" });
    }
  });

  app.post("/api/admin/books/sync-from-dev", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    try {
      const { books: bookList } = req.body as { books: any[] };
      if (!Array.isArray(bookList) || bookList.length === 0) {
        return res.status(400).json({ error: "books array required" });
      }
      let inserted = 0, updated = 0;
      for (const b of bookList) {
        const existing = await db.select({ id: books.id }).from(books).where(eq(books.id, b.id));
        const payload = {
          title: b.title,
          author: b.author,
          genre: b.genre,
          category: b.category,
          price: b.price,
          description: b.description,
          coverUrl: b.cover_url,
          visible: b.visible,
          rating: b.rating,
          subscriberExclusiveUntil: b.subscriber_exclusive_until ? new Date(b.subscriber_exclusive_until) : null,
          createdAt: b.created_at ? new Date(b.created_at) : undefined,
        };
        if (existing.length > 0) {
          await db.update(books).set(payload).where(eq(books.id, b.id));
          updated++;
        } else {
          await db.insert(books).values({ id: b.id, ...payload });
          inserted++;
        }
      }
      res.json({ inserted, updated, total: bookList.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/draft-ebooks/sync-from-dev", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    try {
      const { drafts } = req.body as { drafts: any[] };
      if (!Array.isArray(drafts) || drafts.length === 0) {
        return res.status(400).json({ error: "drafts array required" });
      }
      let inserted = 0, updated = 0;
      for (const d of drafts) {
        const existing = await db.select({ id: draftEbooks.id }).from(draftEbooks).where(eq(draftEbooks.id, d.id));
        const payload: any = {
          title: d.title,
          genre: d.genre,
          topic: d.topic || d.title,
          description: d.description,
          outline: d.outline,
          content: d.content,
          coverUrl: d.cover_url,
          backgroundUrl: d.background_url,
          pdfUrl: d.pdf_url,
          suggestedPrice: d.suggested_price,
          status: d.status,
          coverStyleId: d.cover_style_id,
          overlayApproved: d.overlay_approved === true || d.overlay_approved === 't',
          createdAt: d.created_at ? new Date(d.created_at) : undefined,
          publishedAt: d.published_at ? new Date(d.published_at) : null,
        };
        if (existing.length > 0) {
          await db.update(draftEbooks).set(payload).where(eq(draftEbooks.id, d.id));
          updated++;
        } else {
          await db.insert(draftEbooks).values({ id: d.id, ...payload });
          inserted++;
        }
      }
      res.json({ inserted, updated, total: drafts.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/drafts/:id/toggle-book-visibility", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Admin authentication required" });
    try {
      const draftId = parseInt(req.params.id);
      const [draft] = await db.select({ title: draftEbooks.title }).from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft) return res.status(404).json({ error: "Draft not found" });
      const book = await contentStudio.findCatalogBookForDraft(draftId, draft.title);
      if (!book) {
        return res.status(404).json({
          error: "No catalog book with this exact title. This draft is only marked published in AI Studio — use Move to Ready to clear that.",
          orphanPublished: true,
        });
      }
      const newVisible = !book.visible;
      await db.update(books).set({ visible: newVisible }).where(eq(books.id, book.id));
      res.json({ bookId: book.id, visible: newVisible });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/content-studio/drafts/:id/reset-orphan-published", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      await contentStudio.resetOrphanPublishedDraft(draftId);
      res.json({ success: true, message: "Draft moved to Ready — it was not in the storefront catalog." });
    } catch (error) {
      console.error("Error resetting orphan published draft:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to reset draft" });
    }
  });

  app.post("/api/admin/books/toggle-visibility", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    try {
      const { bookIds, visible } = req.body as { bookIds: number[]; visible: boolean };
      if (!Array.isArray(bookIds) || typeof visible !== "boolean") {
        return res.status(400).json({ error: "bookIds array and visible boolean required" });
      }
      await db.update(books).set({ visible }).where(inArray(books.id, bookIds));
      res.json({ updated: bookIds.length, visible });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/books/toggle-all-visibility", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    try {
      const { visible } = req.body as { visible: boolean };
      if (typeof visible !== "boolean") {
        return res.status(400).json({ error: "visible boolean required" });
      }
      const result = await db.update(books).set({ visible }).returning({ id: books.id });
      res.json({ updated: result.length, visible });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/books/published-titles", async (req, res) => {
    try {
      const rows = await db.select({ id: books.id, title: books.title, coverUrl: books.coverUrl }).from(books);
      res.json(rows);
    } catch (error) {
      console.error("Error fetching published titles:", error);
      res.status(500).json({ error: "Failed to fetch published titles" });
    }
  });

  app.get("/api/books/rewrite-blockers", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    try {
      const pairs = [
        { oldId: 87, newId: 111 },
        { oldId: 320, newId: 419 },
        { oldId: 326, newId: 366 },
        { oldId: 497, newId: 565 },
        { oldId: 521, newId: 311 },
        { oldId: 335, newId: 122 },
        { oldId: 261, newId: 332 },
        { oldId: 401, newId: 385 },
        { oldId: 676, newId: 692 },
      ];

      const oldIds = pairs.map(p => p.oldId);
      const newIds = pairs.map(p => p.newId);

      const oldBooks = await db.select().from(books).where(sql`${books.id} IN ${oldIds}`);
      const newDrafts = await db.select().from(draftEbooks).where(sql`${draftEbooks.id} IN ${newIds}`);

      const oldMap = new Map(oldBooks.map(b => [b.id, b]));
      const newMap = new Map(newDrafts.map(d => [d.id, d]));

      const results = pairs.map(pair => {
        const old = oldMap.get(pair.oldId);
        const draft = newMap.get(pair.newId);
        if (!old || !draft) return null;

        const draftContent = draft.content || "";
        const wordCount = draftContent.split(/\s+/).filter(Boolean).length;
        const chapterMatches = draftContent.match(/^#+ Chapter .+$/gm) || [];
        const excerpt = draftContent.substring(0, 800);

        return {
          oldBook: {
            id: old.id,
            title: old.title,
            genre: old.genre,
            price: old.price,
            coverUrl: old.coverUrl,
            description: old.description,
            visible: old.visible,
            createdAt: old.createdAt,
          },
          newDraft: {
            id: draft.id,
            title: draft.title,
            genre: draft.genre,
            suggestedPrice: draft.suggestedPrice,
            coverUrl: draft.coverUrl,
            status: draft.status,
            wordCount,
            chapterCount: chapterMatches.length,
            chapters: chapterMatches.slice(0, 20).map(c => c.replace(/^#+\s*/, '')),
            excerpt,
          },
        };
      }).filter(Boolean);

      res.json(results);
    } catch (error) {
      console.error("Error fetching rewrite blockers:", error);
      res.status(500).json({ error: "Failed to fetch rewrite blockers" });
    }
  });

  app.get("/api/books/duplicates-comparison", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    try {
      const allBooks = await storage.getAllBooks();

      const adjacency = new Map<number, Set<number>>();
      const matchTypes = new Map<string, string>();

      for (let i = 0; i < allBooks.length; i++) {
        for (let j = i + 1; j < allBooks.length; j++) {
          const result = contentStudio.areTitlesSimilar(allBooks[i].title, allBooks[j].title);
          if (result.similar) {
            if (!adjacency.has(allBooks[i].id)) adjacency.set(allBooks[i].id, new Set());
            if (!adjacency.has(allBooks[j].id)) adjacency.set(allBooks[j].id, new Set());
            adjacency.get(allBooks[i].id)!.add(allBooks[j].id);
            adjacency.get(allBooks[j].id)!.add(allBooks[i].id);
            const pairKey = `${Math.min(allBooks[i].id, allBooks[j].id)}-${Math.max(allBooks[i].id, allBooks[j].id)}`;
            matchTypes.set(pairKey, result.matchType);
          }
        }
      }

      const visited = new Set<number>();
      const clusters: number[][] = [];
      for (const bookId of adjacency.keys()) {
        if (visited.has(bookId)) continue;
        const cluster: number[] = [];
        const stack = [bookId];
        while (stack.length > 0) {
          const current = stack.pop()!;
          if (visited.has(current)) continue;
          visited.add(current);
          cluster.push(current);
          const neighbors = adjacency.get(current);
          if (neighbors) {
            for (const n of neighbors) {
              if (!visited.has(n)) stack.push(n);
            }
          }
        }
        cluster.sort((a, b) => a - b);
        clusters.push(cluster);
      }

      const bookMap = new Map(allBooks.map(b => [b.id, b]));

      const getDraft = async (title: string) => {
        const [draft] = await db.select({
          id: draftEbooks.id,
          content: draftEbooks.content,
        }).from(draftEbooks).where(
          sql`${draftEbooks.title} = ${title} AND ${draftEbooks.content} IS NOT NULL AND length(${draftEbooks.content}) > 100`
        ).limit(1);
        return draft || null;
      };

      const extractDetails = (content: string | null) => {
        if (!content) return { wordCount: 0, excerpt: 'No content available', chapters: [] as string[], dialogue: [] as string[], contentFingerprint: '' };
        const words = content.split(/\s+/).filter((w: string) => w);
        const chapterHeaders = (content.match(/^#+\s+.+$/gm) || []).map((h: string) => h.replace(/^#+\s*/, ''));
        const dialogueRegex = /["\u201C].{15,300}["\u201D]/g;
        const dialogueMatches = content.match(dialogueRegex) || [];
        const dialogueExcerpts = dialogueMatches.slice(0, 5);
        const paragraphs = content.split(/\n\n/).filter((p: string) => p.trim().length > 50 && !p.startsWith('#'));
        const firstParagraphs = paragraphs.slice(0, 3).map((p: string) => p.trim().substring(0, 500));
        const fingerprint = words.slice(0, 500).join(' ');
        return {
          wordCount: words.length,
          excerpt: firstParagraphs.join('\n\n'),
          chapters: chapterHeaders,
          dialogue: dialogueExcerpts,
          contentFingerprint: fingerprint,
        };
      };

      const computeSimilarity = (a: string, b: string) => {
        if (!a || !b) return 0;
        const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3));
        const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3));
        let overlap = 0;
        wordsA.forEach((w: string) => { if (wordsB.has(w)) overlap++; });
        const union = new Set([...wordsA, ...wordsB]).size;
        return union > 0 ? Math.round((overlap / union) * 100) : 0;
      };

      const groupResults = [];
      for (const cluster of clusters) {
        const members = [];
        const draftCache = new Map<number, { id: number; fingerprint: string }>();

        for (const bookId of cluster) {
          const book = bookMap.get(bookId)!;
          const draft = await getDraft(book.title);
          const details = extractDetails(draft?.content || null);
          const hasSubtitle = book.title.includes(':') || book.title.includes('—');
          members.push({
            id: book.id,
            title: book.title,
            genre: book.genre,
            price: book.price,
            coverUrl: book.coverUrl,
            createdAt: book.createdAt,
            draftId: draft?.id || null,
            wordCount: details.wordCount,
            excerpt: details.excerpt,
            chapters: details.chapters,
            dialogue: details.dialogue,
            hasSubtitle,
            contentFingerprint: details.contentFingerprint,
          });
          if (draft) draftCache.set(bookId, { id: draft.id, fingerprint: details.contentFingerprint });
        }

        const comparisons: any[] = [];
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const a = members[i];
            const b = members[j];
            const pairKey = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
            const mt = matchTypes.get(pairKey) || 'UNKNOWN';
            const dA = draftCache.get(a.id);
            const dB = draftCache.get(b.id);
            const sameDraft = !!(dA && dB && dA.id === dB.id);
            const sameCover = a.coverUrl === b.coverUrl;
            const contentSimilarity = sameDraft ? 100 : computeSimilarity(dA?.fingerprint || '', dB?.fingerprint || '');
            comparisons.push({
              bookIdA: a.id, bookIdB: b.id,
              matchType: mt, sameDraft, sameCover, contentSimilarity,
            });
          }
        }

        const worstSimilarity = Math.max(...comparisons.map(c => c.contentSimilarity), 0);
        const hasSameDraft = comparisons.some(c => c.sameDraft);
        const hasSameCover = comparisons.some(c => c.sameCover);

        groupResults.push({
          books: members.map(m => ({ ...m, contentFingerprint: undefined })),
          comparisons,
          groupSeverity: hasSameDraft ? 'SAME_DRAFT'
            : worstSimilarity >= 80 ? 'NEAR_IDENTICAL'
            : worstSimilarity >= 60 ? 'VERY_SIMILAR'
            : 'DIFFERENT_CONTENT',
          hasSameDraft,
          hasSameCover,
        });
      }

      groupResults.sort((a, b) => {
        const order: Record<string, number> = { SAME_DRAFT: 0, NEAR_IDENTICAL: 1, VERY_SIMILAR: 2, DIFFERENT_CONTENT: 3 };
        return (order[a.groupSeverity] ?? 4) - (order[b.groupSeverity] ?? 4);
      });
      res.json(groupResults);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });


  // GET /api/books/:id - Get a specific book by ID
  app.get("/api/books/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid book ID" });
      }
      
      const book = await storage.getBookById(id);
      if (!book) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      res.json(book);
    } catch (error) {
      console.error("Error fetching book:", error);
      res.status(500).json({ error: "Failed to fetch book" });
    }
  });

  app.get("/api/books/:id/draft-id", async (req, res) => {
    try {
      const bookId = parseInt(req.params.id);
      if (isNaN(bookId)) return res.status(400).json({ error: "Invalid book ID" });
      const book = await storage.getBookById(bookId);
      if (!book) return res.status(404).json({ error: "Book not found" });

      const isClassic = book.genre.startsWith("Classic");

      if (!isClassic && !isAdminAuthenticated(req)) {
        const email = getAuthenticatedEmail(req);

        if (!email) return res.status(401).json({ error: "auth_required", message: "Please log in to read this book." });

        const [paidAccess] = await db.select().from(readingAccess)
          .where(sql`${readingAccess.bookId} = ${bookId} AND ${readingAccess.customerEmail} = ${email} AND ${readingAccess.expiresAt} > NOW()`)
          .limit(1);

        if (!paidAccess) {
          const activeCheckout = await subscriptionService.getActiveCheckout(email);
          if (!activeCheckout || activeCheckout.bookId !== bookId) {
            return res.status(403).json({
              error: "access_denied",
              message: "You need to check out this book first before reading it.",
            });
          }
        }
      }

      const draft = await contentStudio.findReadableDraftForCatalogBook(book);
      if (!draft) return res.status(404).json({ error: "No readable content found for this book" });
      res.json({ draftId: draft.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to find draft" });
    }
  });

  app.get("/api/books/:id/check-access", async (req, res) => {
    try {
      const bookId = parseInt(req.params.id);
      if (isNaN(bookId)) return res.status(400).json({ error: "Invalid book ID" });

      const book = await storage.getBookById(bookId);
      if (!book) return res.status(404).json({ error: "Book not found" });

      const isClassic = book.genre.startsWith("Classic");
      if (isClassic) return res.json({ hasAccess: true, accessType: "classic_free", hasDownloadAccess: false });

      const isSubscriberExclusive = subscriptionService.isBookSubscriberExclusive(book);
      const subscriberExclusiveUntil = isSubscriberExclusive && book.subscriberExclusiveUntil ? new Date(book.subscriberExclusiveUntil).toISOString() : null;

      const email = getAuthenticatedEmail(req);
      if (!email) return res.json({ hasAccess: false, accessType: "none", hasDownloadAccess: false, isSubscriberExclusive, subscriberExclusiveUntil });

      let hasDownloadAccess = false;
      const customerOrders = await storage.getOrdersByEmail(email);
      for (const order of customerOrders) {
        if (order.status !== "completed") continue;
        const items = await storage.getOrderItems(order.id);
        const matchingItem = items.find(item => item.bookId === bookId);
        if (matchingItem) {
          const pt = matchingItem.purchaseType || 'download';
          if (pt === 'download' || pt === 'bundle') {
            hasDownloadAccess = true;
          }
        }
      }

      const [paidAccess] = await db.select().from(readingAccess)
        .where(sql`${readingAccess.bookId} = ${bookId} AND ${readingAccess.customerEmail} = ${email} AND ${readingAccess.expiresAt} > NOW()`)
        .limit(1);

      if (paidAccess) return res.json({ hasAccess: true, accessType: "purchased", hasDownloadAccess, isSubscriberExclusive, subscriberExclusiveUntil });

      const subData = await subscriptionService.getSubscriptionWithPlan(email);
      if (subData) {
        const sub = subData.subscription;
        const plan = subData.plan;
        if (sub.currentPeriodStart && sub.currentPeriodEnd) {
          const { start: windowStart, end: windowEnd } = subscriptionService.getMonthlyWindow(sub);
          const usage = await subscriptionService.getUsageForCurrentPeriod(sub.id, windowStart, windowEnd);
          const activeCheckout = await subscriptionService.getActiveCheckout(email);

          const alreadyRead = usage.details.some(u => u.bookId === bookId && u.usageType === "read");
          const periodDownloads = await subscriptionService.getDownloadsForSubscriptionPeriod(sub.id, windowStart, windowEnd);
          const isCheckedOut = activeCheckout?.bookId === bookId;
          const hasOtherCheckout = activeCheckout && activeCheckout.bookId !== bookId;

          const totalDownloadSlots = plan.downloadsPerMonth + (sub.rolloverCredits || 0);

          if (alreadyRead) {
            const canDownload = totalDownloadSlots > 0 && periodDownloads < totalDownloadSlots;
            return res.json({ hasAccess: true, accessType: "subscription_read", canDownload, planName: plan.name, hasDownloadAccess, isCheckedOut, checkedOutBookId: activeCheckout?.bookId, checkedOutBookTitle: null, rolloverCredits: sub.rolloverCredits || 0, isSubscriberExclusive, subscriberExclusiveUntil });
          }

          const downloadsLeft = Math.max(0, totalDownloadSlots - periodDownloads);
          return res.json({
            hasAccess: false,
            accessType: "subscription_available",
            downloadsLeft,
            planName: plan.name,
            canCheckout: !hasOtherCheckout,
            hasDownloadAccess,
            checkedOutBookId: activeCheckout?.bookId || null,
            rolloverCredits: sub.rolloverCredits || 0,
            isSubscriberExclusive,
            subscriberExclusiveUntil,
          });
        }
      }

      if (isSubscriberExclusive) {
        return res.json({ hasAccess: false, accessType: "subscriber_exclusive", hasDownloadAccess: false, isSubscriberExclusive: true, subscriberExclusiveUntil });
      }

      if (hasDownloadAccess) {
        return res.json({ hasAccess: false, accessType: "download_only", hasDownloadAccess: true, isSubscriberExclusive, subscriberExclusiveUntil });
      }

      return res.json({ hasAccess: false, accessType: "none", hasDownloadAccess: false, isSubscriberExclusive, subscriberExclusiveUntil });
    } catch (error) {
      console.error("Error checking access:", error);
      res.status(500).json({ error: "Failed to check access" });
    }
  });

  app.get("/api/books/:id/download", async (req, res) => {
    try {
      const bookId = parseInt(req.params.id);
      const format = (req.query.format as string) || "epub";
      if (isNaN(bookId)) return res.status(400).json({ error: "Invalid book ID" });

      const email = getAuthenticatedEmail(req);

      if (!email) return res.status(401).json({ error: "auth_required", message: "Authentication required to download." });

      const book = await storage.getBookById(bookId);
      if (!book) return res.status(404).json({ error: "Book not found" });

      const customerOrders = await storage.getOrdersByEmail(email);
      let hasPurchased = false;
      for (const order of customerOrders) {
        if (order.status !== "completed") continue;
        const items = await storage.getOrderItems(order.id);
        const matchingItem = items.find(item => item.bookId === bookId);
        if (matchingItem) {
          const pt = matchingItem.purchaseType || 'download';
          if (pt === 'read_online') continue;
          hasPurchased = true;
          break;
        }
      }

      if (!hasPurchased) {
        return res.status(403).json({ error: "No download purchase found for this book. Please purchase the download or bundle option." });
      }

      const [draft] = await db.select({ id: draftEbooks.id, title: draftEbooks.title })
        .from(draftEbooks)
        .where(sql`${draftEbooks.title} = ${book.title} AND ${draftEbooks.content} IS NOT NULL AND length(${draftEbooks.content}) > 100`)
        .limit(1);

      if (!draft) return res.status(404).json({ error: "No downloadable content found for this book" });

      const filename = book.title.replace(/[^a-zA-Z0-9]/g, "-").substring(0, 50) || `ebook-${bookId}`;

      if (format === "pdf") {
        const [draftWithPdf] = await db.select({ pdfUrl: draftEbooks.pdfUrl, content: draftEbooks.content })
          .from(draftEbooks)
          .where(eq(draftEbooks.id, draft.id))
          .limit(1);

        let pdfPath = draftWithPdf?.pdfUrl ? path.join(process.cwd(), draftWithPdf.pdfUrl.replace(/^\//, "")) : null;

        if (!pdfPath || !fs.existsSync(pdfPath)) {
          const pdfUrl = await contentStudio.createPdfFromContent(book.title, draftWithPdf?.content || "");
          pdfPath = path.join(process.cwd(), pdfUrl.replace(/^\//, ""));
          await db.update(draftEbooks).set({ pdfUrl: pdfUrl }).where(eq(draftEbooks.id, draft.id));
        }

        if (pdfPath && fs.existsSync(pdfPath)) {
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
          return res.sendFile(pdfPath);
        }
        return res.status(404).json({ error: "PDF not available for this book" });
      }

      const epubBuffer = await contentStudio.generateEpub(draft.id);
      res.setHeader("Content-Type", "application/epub+zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.epub"`);
      res.send(epubBuffer);
    } catch (error: any) {
      console.error("Customer download error:", error);
      res.status(500).json({ error: "Failed to generate download" });
    }
  });

  app.get("/api/subscription/active-checkout", subscriptionRateLimit, requireSubscriptionAuth, async (req, res) => {
    try {
      const email = (req as any).verifiedEmail || req.query.email as string;
      if (!email) return res.status(400).json({ error: "Email required" });
      const checkout = await subscriptionService.getActiveCheckout(email);
      if (checkout) {
        const book = await storage.getBookById(checkout.bookId);
        return res.json({ hasCheckout: true, bookId: checkout.bookId, bookTitle: book?.title || "Unknown", checkedOutAt: checkout.checkedOutAt });
      }
      return res.json({ hasCheckout: false });
    } catch (error) {
      console.error("Active checkout check error:", error);
      res.status(500).json({ error: "Failed to check active checkout" });
    }
  });

  app.post("/api/subscription/library-checkout", subscriptionRateLimit, requireSubscriptionAuth, async (req, res) => {
    try {
      const email = (req as any).verifiedEmail;
      const { bookId } = req.body;
      if (!email || !bookId) return res.status(400).json({ error: "Email and bookId required" });
      const result = await subscriptionService.checkoutBook(email, bookId);
      if (!result.success) return res.status(403).json({ error: result.error, currentBookId: (result as any).currentBookId });
      res.json({ success: true, alreadyCheckedOut: (result as any).alreadyCheckedOut });
    } catch (error) {
      console.error("Checkout error:", error);
      res.status(500).json({ error: "Failed to checkout book" });
    }
  });

  app.post("/api/subscription/return", subscriptionRateLimit, requireSubscriptionAuth, async (req, res) => {
    try {
      const email = (req as any).verifiedEmail;
      if (!email) return res.status(400).json({ error: "Email required" });
      const result = await subscriptionService.returnBook(email);
      if (!result.success) return res.status(400).json({ error: result.error });
      res.json({ success: true, returnedBookId: result.returnedBookId });
    } catch (error) {
      console.error("Return error:", error);
      res.status(500).json({ error: "Failed to return book" });
    }
  });

  app.post("/api/subscription/download", sensitiveActionRateLimit, requireSubscriptionAuth, async (req, res) => {
    try {
      const email = (req as any).verifiedEmail;
      const { bookId } = req.body;
      if (!email || !bookId) return res.status(400).json({ error: "Email and bookId required" });

      const subData = await subscriptionService.getSubscriptionWithPlan(email);
      if (!subData) return res.status(403).json({ error: "No active subscription" });

      const sub = subData.subscription;
      const plan = subData.plan;
      if (!sub.currentPeriodStart || !sub.currentPeriodEnd) return res.status(403).json({ error: "Invalid subscription period" });

      const { start: windowStart, end: windowEnd } = subscriptionService.getMonthlyWindow(sub);
      const usage = await subscriptionService.getUsageForCurrentPeriod(sub.id, windowStart, windowEnd);
      const alreadyRead = usage.details.some(u => u.bookId === bookId && u.usageType === "read");
      if (!alreadyRead) return res.status(403).json({ error: "You must read this book first before downloading it with your subscription." });

      if (plan.downloadsPerMonth === 0) return res.status(403).json({ error: "Your plan does not include downloads. Upgrade to Value or higher." });

      const result = await subscriptionService.checkAndRecordUsage(email, bookId, "download");
      if (!result.allowed) return res.status(403).json({ error: result.reason });

      res.json({ success: true, remaining: result.remaining });
    } catch (error: any) {
      console.error("Subscription download error:", error);
      res.status(500).json({ error: "Failed to process download" });
    }
  });

  app.get("/api/books/:id/reviews", async (req, res) => {
    try {
      const bookId = parseInt(req.params.id);
      if (isNaN(bookId)) return res.status(400).json({ error: "Invalid book ID" });
      const reviews = await db.select().from(bookReviews).where(eq(bookReviews.bookId, bookId)).orderBy(desc(bookReviews.createdAt));
      const avg = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
      res.json({ reviews, averageRating: Math.round(avg * 10) / 10, totalReviews: reviews.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.post("/api/books/:id/reviews", async (req, res) => {
    try {
      const bookId = parseInt(req.params.id);
      if (isNaN(bookId)) return res.status(400).json({ error: "Invalid book ID" });
      const book = await storage.getBookById(bookId);
      if (!book) return res.status(404).json({ error: "Book not found" });

      const { visitorId, displayName, rating, comment } = req.body;
      if (!visitorId || !displayName || !rating) return res.status(400).json({ error: "Missing required fields" });
      if (rating < 1 || rating > 5) return res.status(400).json({ error: "Rating must be 1-5" });
      if (displayName.trim().length < 1 || displayName.trim().length > 50) return res.status(400).json({ error: "Name must be 1-50 characters" });
      if (comment && comment.length > 1000) return res.status(400).json({ error: "Comment too long (max 1000 chars)" });

      const existing = await db.select().from(bookReviews).where(sql`${bookReviews.bookId} = ${bookId} AND ${bookReviews.visitorId} = ${visitorId}`).limit(1);
      if (existing.length > 0) {
        await db.update(bookReviews).set({ rating, comment: comment || null, displayName: displayName.trim() }).where(eq(bookReviews.id, existing[0].id));
      } else {
        await db.insert(bookReviews).values({ bookId, visitorId, displayName: displayName.trim(), rating, comment: comment || null });
      }

      const allReviews = await db.select().from(bookReviews).where(eq(bookReviews.bookId, bookId));
      const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
      const newRating = Math.round(avg * 10) / 10;
      await db.update(books).set({ rating: newRating.toFixed(2) }).where(eq(books.id, bookId));

      res.json({ success: true, averageRating: newRating, totalReviews: allReviews.length });
    } catch (error) {
      console.error("Review error:", error);
      res.status(500).json({ error: "Failed to save review" });
    }
  });

  app.get("/api/books/:id/suggestions", async (req, res) => {
    try {
      const bookId = parseInt(req.params.id);
      if (isNaN(bookId)) return res.status(400).json({ error: "Invalid book ID" });
      const book = await storage.getBookById(bookId);
      if (!book) return res.status(404).json({ error: "Book not found" });

      const allBooks = await storage.getAllBooks();
      const others = allBooks.filter(b => b.id !== bookId);

      const scored = others.map(b => {
        let score = 0;
        if (b.genre === book.genre) score += 10;
        if (b.category === book.category) score += 3;
        const bookGenreWords = book.genre.toLowerCase().split(/[\s\/]+/);
        const bGenreWords = b.genre.toLowerCase().split(/[\s\/]+/);
        const genreOverlap = bookGenreWords.filter(w => bGenreWords.includes(w)).length;
        score += genreOverlap * 2;
        score += parseFloat(b.rating || "0") * 0.5;
        score += Math.random() * 2;
        return { ...b, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const suggestions = scored.slice(0, 6).map(({ score, ...b }) => b);
      res.json(suggestions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get suggestions" });
    }
  });

  // POST /api/books - Create a new book (admin only)
  app.post("/api/books", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const validatedData = insertBookSchema.parse(req.body);
      const newBook = await storage.createBook(validatedData);
      res.status(201).json(newBook);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid book data", details: error.errors });
      }
      console.error("Error creating book:", error);
      res.status(500).json({ error: "Failed to create book" });
    }
  });

  // PUT /api/books/:id - Update a book (admin only)
  app.put("/api/books/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid book ID" });
      }
      
      const updatedBook = await storage.updateBook(id, req.body);
      if (!updatedBook) {
        return res.status(404).json({ error: "Book not found" });
      }
      
      res.json(updatedBook);
    } catch (error) {
      console.error("Error updating book:", error);
      res.status(500).json({ error: "Failed to update book" });
    }
  });

  app.post("/api/admin/books/:id/reorder", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    try {
      const id = parseInt(req.params.id);
      const { createdAt } = req.body;
      if (isNaN(id) || !createdAt) {
        return res.status(400).json({ error: "Invalid parameters" });
      }
      await db.execute(sql`UPDATE books SET created_at = ${new Date(createdAt)} WHERE id = ${id}`);
      const book = await storage.getBookById(id);
      res.json(book);
    } catch (error) {
      console.error("Error reordering book:", error);
      res.status(500).json({ error: "Failed to reorder book" });
    }
  });

  app.post("/api/admin/books/set-exclusive", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    try {
      const { bookIds, days } = req.body;
      if (!Array.isArray(bookIds) || bookIds.length === 0) {
        return res.status(400).json({ error: "bookIds must be a non-empty array" });
      }
      const exclusiveDays = typeof days === "number" && days > 0 ? days : 30;
      const exclusiveUntil = new Date(Date.now() + exclusiveDays * 24 * 60 * 60 * 1000);
      const updated: number[] = [];
      for (const id of bookIds) {
        const bookId = parseInt(id);
        if (isNaN(bookId)) continue;
        await db.update(books).set({ subscriberExclusiveUntil: exclusiveUntil }).where(eq(books.id, bookId));
        updated.push(bookId);
      }
      res.json({ updated, subscriberExclusiveUntil: exclusiveUntil.toISOString(), message: `Set ${updated.length} book(s) as subscriber-exclusive for ${exclusiveDays} days` });
    } catch (error) {
      console.error("Error setting subscriber exclusive:", error);
      res.status(500).json({ error: "Failed to set subscriber exclusive" });
    }
  });

  app.post("/api/admin/books/clear-exclusive", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    try {
      const { bookIds } = req.body;
      if (!Array.isArray(bookIds) || bookIds.length === 0) {
        return res.status(400).json({ error: "bookIds must be a non-empty array" });
      }
      const cleared: number[] = [];
      for (const id of bookIds) {
        const bookId = parseInt(id);
        if (isNaN(bookId)) continue;
        await db.update(books).set({ subscriberExclusiveUntil: null }).where(eq(books.id, bookId));
        cleared.push(bookId);
      }
      res.json({ cleared, message: `Cleared subscriber-exclusive from ${cleared.length} book(s)` });
    } catch (error) {
      console.error("Error clearing subscriber exclusive:", error);
      res.status(500).json({ error: "Failed to clear subscriber exclusive" });
    }
  });

  // PATCH /api/admin/books/:id/cover-fit - Set cover fit mode for one book
  app.patch("/api/admin/books/:id/cover-fit", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Admin authentication required" });
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid book ID" });
      const { fit } = req.body;
      if (fit !== "cover" && fit !== "contain") return res.status(400).json({ error: "fit must be 'cover' or 'contain'" });
      await db.update(books).set({ coverFit: fit }).where(eq(books.id, id));
      res.json({ id, coverFit: fit });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/admin/books/cover-fit-all - Set cover fit mode for all books at once
  app.post("/api/admin/books/cover-fit-all", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Admin authentication required" });
    try {
      const { fit } = req.body;
      if (fit !== "cover" && fit !== "contain") return res.status(400).json({ error: "fit must be 'cover' or 'contain'" });
      await db.update(books).set({ coverFit: fit });
      res.json({ coverFit: fit, message: `All books set to ${fit}` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ── Page Formatting Tools ──────────────────────────────────────────────────
  // Scan draft_ebooks for content-level formatting issues that hurt page fill:
  //   1. Overly long paragraphs (>300 words, hard for sentence-splitter to fill pages)
  //   2. Orphaned number markers ("2." on its own line, content on the next line)
  // Returns per-book issue counts so the admin can decide which books to fix.

  // ── Genre profile: determines what formatting rules apply to each book ──────
  // skip          — visual/non-prose genres, no text reformatting needed
  // wordThreshold — max words per paragraph before splitting (0 = no splitting)
  // fixOrphans    — join standalone "2." markers back to their content line
  // label         — human-readable description shown in the UI
  function getGenreProfile(genre: string): {
    skip: boolean; wordThreshold: number; fixOrphans: boolean; label: string;
  } {
    const g = (genre || '').toLowerCase();

    // Visual / illustrated — content is mostly markers, no prose splitting
    const VISUAL = ['comics','graphic novel','photography','coloring book','art book','workbook','activity book','guided journal'];
    if (VISUAL.some(v => g.includes(v))) {
      return { skip: true, wordThreshold: 0, fixOrphans: false, label: 'Visual — no text fixes needed' };
    }

    // Dense academic / non-fiction — very long sentences and complex paragraphs
    const ACADEMIC = ['philosophy','academic','science','history','biography','memoir','business','self-help','health','finance','psychology','true crime','travel','politics','religion','education','law','economics','sociology','anthropology'];
    if (ACADEMIC.some(v => g.includes(v))) {
      return { skip: false, wordThreshold: 220, fixOrphans: true, label: 'Academic — split dense paragraphs + fix orphans' };
    }

    // Poetry — no splitting; preserve line structure
    const POETRY = ['poetry','poem','verse','haiku'];
    if (POETRY.some(v => g.includes(v))) {
      return { skip: false, wordThreshold: 0, fixOrphans: true, label: 'Poetry — fix orphans only, preserve line structure' };
    }

    // Fiction (thriller, romance, fantasy, etc.) — moderate paragraphs
    return { skip: false, wordThreshold: 180, fixOrphans: true, label: 'Fiction — split long paragraphs + fix orphans' };
  }

  function scanBookContent(content: string, genre: string): {
    longParagraphs: number; orphanedNumbers: number; totalParagraphs: number;
    hasIssues: boolean; profile: string; skip: boolean;
  } {
    const { skip, wordThreshold, fixOrphans, label } = getGenreProfile(genre);
    if (skip || !content) return { longParagraphs: 0, orphanedNumbers: 0, totalParagraphs: 0, hasIssues: false, profile: label, skip };

    const lines = content.split('\n');
    let longParagraphs = 0, orphanedNumbers = 0, totalParagraphs = 0;
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t) continue;
      if (!t.startsWith('#') && !t.startsWith('-') && !t.startsWith('*')) {
        totalParagraphs++;
        if (wordThreshold > 0 && t.split(/\s+/).length > wordThreshold) longParagraphs++;
      }
      if (fixOrphans && /^\d+\.?\s*$/.test(t) && i + 1 < lines.length && lines[i + 1].trim() !== '') {
        orphanedNumbers++;
      }
    }
    const hasIssues = longParagraphs > 0 || orphanedNumbers > 0;
    return { longParagraphs, orphanedNumbers, totalParagraphs, hasIssues, profile: label, skip };
  }

  function formatBookContent(content: string, genre: string): { formatted: string; changes: number } {
    if (!content) return { formatted: content, changes: 0 };
    const { skip, wordThreshold, fixOrphans } = getGenreProfile(genre);
    if (skip) return { formatted: content, changes: 0 };

    const lines = content.split('\n');
    const result: string[] = [];
    let changes = 0;

    function splitLongPara(para: string, target: number): string[] {
      const sentRe = /[^.!?…]+[.!?…]+["'"\u201d\u2019)\]]*\s*/g;
      const sentences = para.match(sentRe);
      if (!sentences || sentences.length <= 2) return [para];
      const chunks: string[] = [];
      let cur = '';
      let wc = 0;
      for (const s of sentences) {
        const sw = s.trim().split(/\s+/).length;
        if (wc + sw > target && cur) {
          chunks.push(cur.trim());
          cur = s;
          wc = sw;
        } else {
          cur = cur ? cur + ' ' + s : s;
          wc += sw;
        }
      }
      if (cur.trim()) chunks.push(cur.trim());
      return chunks.length > 1 ? chunks : [para];
    }

    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      // Fix orphaned number markers
      if (fixOrphans && /^\d+\.?\s*$/.test(t) && i + 1 < lines.length && lines[i + 1].trim() !== '') {
        result.push(t + ' ' + lines[i + 1].trim());
        i++; changes++;
        continue;
      }
      // Split overly long paragraphs
      if (wordThreshold > 0 && !t.startsWith('#') && !t.startsWith('-') && !t.startsWith('*') && t.split(/\s+/).length > wordThreshold) {
        const parts = splitLongPara(t, wordThreshold);
        if (parts.length > 1) {
          result.push(...parts);
          changes++;
          continue;
        }
      }
      result.push(lines[i]);
    }
    return { formatted: result.join('\n'), changes };
  }

  app.get("/api/admin/format-scan", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Admin authentication required" });
    try {
      const rows = await db.execute(sql`SELECT id, title, genre, status, content FROM draft_ebooks WHERE content IS NOT NULL AND content != '' ORDER BY id DESC`);
      const results = (rows.rows as any[]).map(r => {
        const scan = scanBookContent(r.content || '', r.genre || '');
        return { id: r.id, title: r.title, genre: r.genre, status: r.status, ...scan };
      });
      res.json({ results, total: results.length, withIssues: results.filter((r: any) => r.hasIssues).length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/format-content", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Admin authentication required" });
    try {
      const { draftIds } = req.body as { draftIds: number[] | 'all' };
      let rows: any[];
      if (draftIds === 'all') {
        const r = await db.execute(sql`SELECT id, genre, content FROM draft_ebooks WHERE content IS NOT NULL AND content != ''`);
        rows = r.rows as any[];
      } else {
        if (!Array.isArray(draftIds) || draftIds.length === 0) return res.status(400).json({ error: "draftIds required" });
        const r = await db.execute(sql`SELECT id, genre, content FROM draft_ebooks WHERE id = ANY(${draftIds})`);
        rows = r.rows as any[];
      }
      let processed = 0, skipped = 0, totalChanges = 0;
      for (const row of rows) {
        const { formatted, changes } = formatBookContent(row.content || '', row.genre || '');
        if (changes === 0) { skipped++; continue; }
        await db.execute(sql`UPDATE draft_ebooks SET content = ${formatted} WHERE id = ${row.id}`);
        processed++; totalChanges += changes;
      }
      res.json({ processed, skipped, totalChanges, message: `Formatted ${processed} book(s) with ${totalChanges} fix(es). ${skipped} already clean.` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  // ───────────────────────────────────────────────────────────────────────────

  // DELETE /api/books/:id - Delete a book (admin only for now)
  app.delete("/api/books/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid book ID" });
      }
      
      await storage.deleteBook(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting book:", error);
      res.status(500).json({ error: "Failed to delete book" });
    }
  });

  // POST /api/upload/ebook - Upload ebook and extract cover from first page (admin only)
  const ebookUploadRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many upload requests. Please slow down." },
  });

  const adminAuthMiddleware = (req: any, res: any, next: any) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    next();
  };

  app.post(
    "/api/upload/ebook",
    adminAuthMiddleware,
    ebookUploadRateLimit,
    upload.single('file'),
    async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filePath = req.file.path;
      const originalName = req.file.originalname;
      
      // Extract cover from the first page
      const coverUrl = await extractCoverFromFile(filePath, originalName);
      
      // Clean up the temp file
      fs.unlinkSync(filePath);
      
      // Get title from filename
      const title = path.basename(originalName, path.extname(originalName))
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
      
      res.json({ 
        success: true,
        title,
        coverUrl,
        originalFilename: originalName
      });
    } catch (error: any) {
      console.error("Error processing ebook:", error);
      
      // Clean up temp file if it exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ 
        error: "Failed to process ebook",
        message: error.message 
      });
    }
  });

  // GET /api/stripe/publishable-key - Get Stripe publishable key for frontend
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe publishable key:", error);
      res.status(500).json({ error: "Failed to get Stripe key" });
    }
  });

  // GET /api/stripe/products - List Stripe products
  app.get("/api/stripe/products", async (req, res) => {
    try {
      const products = await storage.listStripeProducts();
      res.json({ data: products });
    } catch (error) {
      console.error("Error listing Stripe products:", error);
      res.status(500).json({ error: "Failed to list products" });
    }
  });

  // GET /api/stripe/prices - List Stripe prices
  app.get("/api/stripe/prices", async (req, res) => {
    try {
      const prices = await storage.listStripePrices();
      res.json({ data: prices });
    } catch (error) {
      console.error("Error listing Stripe prices:", error);
      res.status(500).json({ error: "Failed to list prices" });
    }
  });

  app.post("/api/promo/validate", async (req, res) => {
    try {
      const { code, email } = req.body;
      if (!code) {
        return res.status(400).json({ valid: false, reason: "Code is required" });
      }
      const OWNER_CODE_EXPIRY = new Date("2026-06-19T23:59:59Z");
      const VALID_PROMOS: Record<string, number> = { "WELCOME10": 0.10, "EBGZOWNER": 1.0 };
      // Codes that are unlimited-use (no per-email tracking)
      const UNLIMITED_CODES = new Set(["EBGZOWNER"]);
      const upperCode = code.toUpperCase().trim();
      if (!VALID_PROMOS[upperCode]) {
        return res.json({ valid: false, reason: "Invalid promo code" });
      }
      if (upperCode === "EBGZOWNER" && new Date() > OWNER_CODE_EXPIRY) {
        return res.json({ valid: false, reason: "This code has expired" });
      }
      if (!UNLIMITED_CODES.has(upperCode)) {
        const existing = await db.select().from(promoUsages)
          .where(sql`${promoUsages.customerEmail} = ${email.toLowerCase().trim()} AND ${promoUsages.promoCode} = ${upperCode}`)
          .limit(1);
        if (existing.length > 0) {
          return res.json({ valid: false, reason: "This code has already been used with this email" });
        }
      }
      return res.json({ valid: true, discount: VALID_PROMOS[upperCode] });
    } catch (error) {
      console.error("Promo validation error:", error);
      res.status(500).json({ valid: false, reason: "Server error" });
    }
  });

  app.get("/api/admin/promo-usage", async (req, res) => {
    try {
      const token = req.headers["x-admin-token"] as string;
      if (!token || !adminSessions.has(token)) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const usages = await db.select().from(promoUsages).orderBy(sql`${promoUsages.createdAt} DESC`).limit(100);
      res.json(usages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch promo usage" });
    }
  });

  app.get("/api/admin/genre-audit", async (req, res) => {
    try {
      const token = req.headers["x-admin-token"] as string;
      if (!token || !adminSessions.has(token)) return res.status(401).json({ error: "Unauthorized" });
      
      const visualFirstGenres = contentStudio.getVisualFirstGenres();
      const mismatchedBooks = await db.select({
        id: books.id,
        title: books.title,
        genre: books.genre,
        visible: books.visible,
        author: books.author,
      }).from(books).where(
        sql`${books.genre} IN (${sql.join(visualFirstGenres.map(g => sql`${g}`), sql`, `)})`
      );

      const byGenre: Record<string, typeof mismatchedBooks> = {};
      for (const book of mismatchedBooks) {
        if (!byGenre[book.genre]) byGenre[book.genre] = [];
        byGenre[book.genre].push(book);
      }

      res.json({
        totalMismatched: mismatchedBooks.length,
        visualFirstGenres,
        byGenre,
        summary: `Found ${mismatchedBooks.length} books in visual-first genres (${visualFirstGenres.join(', ')}). These likely contain instructional content instead of genre-appropriate visual content.`
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to run genre audit" });
    }
  });

  app.post("/api/admin/cleanup-descriptions", async (req, res) => {
    try {
      const token = req.headers["x-admin-token"] as string;
      if (!token || !adminSessions.has(token)) return res.status(401).json({ error: "Unauthorized" });
      
      const allBooks = await db.select({ id: books.id, description: books.description, title: books.title }).from(books);
      let updated = 0;
      const changes: { id: number; title: string; oldLen: number; newLen: number }[] = [];
      
      for (const book of allBooks) {
        if (!book.description) continue;
        let desc = book.description;
        const originalLen = desc.length;
        
        desc = desc.replace(/^\*\*['"]?/g, '');
        desc = desc.replace(/['"]?\*\*\s*-\s*/g, '');
        desc = desc.replace(/^['"]([^'"]+)['"]\s*-\s*/g, '$1: ');
        desc = desc.replace(/^An AI-generated ebook about\s*/i, '');
        desc = desc.replace(/^Topic\s+\d+:\s*/i, '');
        desc = desc.replace(/&amp;/g, '&');
        desc = desc.trim();
        
        if (desc.length > 250) {
          const sentenceEnd = desc.lastIndexOf('.', 250);
          if (sentenceEnd > 100) {
            desc = desc.substring(0, sentenceEnd + 1).trim();
          } else {
            desc = desc.substring(0, 250).trim() + '...';
          }
        }
        
        if (desc !== book.description) {
          await db.update(books).set({ description: desc }).where(eq(books.id, book.id));
          updated++;
          changes.push({ id: book.id, title: book.title?.substring(0, 50) || '', oldLen: originalLen, newLen: desc.length });
        }
      }
      
      console.log(`[Cleanup] Updated ${updated} book descriptions`);
      res.json({ success: true, updated, total: allBooks.length, changes: changes.slice(0, 20) });
    } catch (error: any) {
      console.error('[Cleanup] Description cleanup failed:', error?.message);
      res.status(500).json({ error: "Cleanup failed" });
    }
  });

  app.get("/api/admin/reviews", async (req, res) => {
    try {
      const token = req.headers["x-admin-token"] as string;
      if (!token || !adminSessions.has(token)) return res.status(401).json({ error: "Unauthorized" });
      const reviews = await db.select({
        id: bookReviews.id,
        bookId: bookReviews.bookId,
        visitorId: bookReviews.visitorId,
        displayName: bookReviews.displayName,
        rating: bookReviews.rating,
        comment: bookReviews.comment,
        createdAt: bookReviews.createdAt,
        bookTitle: books.title,
      }).from(bookReviews).leftJoin(books, eq(bookReviews.bookId, books.id)).orderBy(desc(bookReviews.createdAt)).limit(200);
      res.json(reviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.delete("/api/admin/reviews/:id", async (req, res) => {
    try {
      const token = req.headers["x-admin-token"] as string;
      if (!token || !adminSessions.has(token)) return res.status(401).json({ error: "Unauthorized" });
      const reviewId = parseInt(req.params.id);
      if (isNaN(reviewId)) return res.status(400).json({ error: "Invalid review ID" });
      const review = await db.select().from(bookReviews).where(eq(bookReviews.id, reviewId)).limit(1);
      if (review.length === 0) return res.status(404).json({ error: "Review not found" });
      const bookId = review[0].bookId;
      await db.delete(bookReviews).where(eq(bookReviews.id, reviewId));
      const remaining = await db.select().from(bookReviews).where(eq(bookReviews.bookId, bookId));
      if (remaining.length > 0) {
        const avg = remaining.reduce((s, r) => s + r.rating, 0) / remaining.length;
        await db.update(books).set({ rating: (Math.round(avg * 10) / 10).toFixed(2) }).where(eq(books.id, bookId));
      } else {
        await db.update(books).set({ rating: "4.50" }).where(eq(books.id, bookId));
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete review" });
    }
  });

  // POST /api/checkout - Create checkout session for cart items
  app.post("/api/checkout", async (req, res) => {
    try {
      const { items, promoCode } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Cart items are required" });
      }

      const OWNER_CODE_EXPIRY = new Date("2026-06-19T23:59:59Z");
      const VALID_PROMOS: Record<string, number> = { "WELCOME10": 0.10, "EBGZOWNER": 1.0 };
      const upperPromo = (promoCode || '').toUpperCase().trim();
      const isOwnerCode = upperPromo === 'EBGZOWNER' && new Date() <= OWNER_CODE_EXPIRY;
      const promoDiscount = upperPromo && VALID_PROMOS[upperPromo] && (upperPromo !== 'EBGZOWNER' || isOwnerCode) ? VALID_PROMOS[upperPromo] : 0;

      const bookIds = items.map((item: any) => parseInt(item.id || item.bookId));
      const validPurchaseTypes = ['download', 'read_online', 'bundle'] as const;
      const purchaseTypes = items.map((item: any) => {
        const pt = item.purchaseType || 'download';
        return validPurchaseTypes.includes(pt) ? pt : 'download';
      });
      const fetchedBooks = await Promise.all(bookIds.map(id => storage.getBookById(id)));
      
      const validItems: { book: NonNullable<typeof fetchedBooks[0]>; purchaseType: string }[] = [];
      fetchedBooks.forEach((book, i) => {
        if (book) validItems.push({ book, purchaseType: purchaseTypes[i] });
      });

      if (validItems.length === 0) {
        return res.status(404).json({ error: "No valid books found" });
      }

      // EBGZOWNER: 100% off test code — bypass Stripe, create order directly
      // Always uses owner@ebookgamez.com regardless of logged-in account,
      // so the success page always works when logged in as that account.
      if (isOwnerCode && promoDiscount === 1.0) {
        const ownerEmail = 'owner@ebookgamez.com';
        const fakeSessionId = `cs_owner_free_${Date.now()}`;
        const order = await storage.createOrder({
          customerEmail: ownerEmail,
          stripeSessionId: fakeSessionId,
          stripePaymentIntentId: null,
          status: 'completed',
          total: '0.00',
        });
        await storage.addOrderItems(validItems.map(({ book, purchaseType }) => ({
          orderId: order.id,
          bookId: book.id,
          price: '0.00',
          title: book.title,
          purchaseType,
        })));
        // Grant reading access for 30 days (matches code expiry)
        const readExpiresAt = new Date(OWNER_CODE_EXPIRY);
        for (const { book, purchaseType } of validItems) {
          if (purchaseType === 'read_online' || purchaseType === 'bundle') {
            await db.insert(readingAccess).values({
              bookId: book.id,
              customerEmail: ownerEmail,
              stripeSessionId: fakeSessionId,
              expiresAt: readExpiresAt,
            });
          }
        }
        return res.json({ url: `/checkout/success?session_id=${fakeSessionId}` });
      }

      const stripe = await getUncachableStripeClient();
      
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const lineItems = validItems.map(({ book, purchaseType }) => {
        const fullPrice = parseFloat(book.price);
        let finalPrice = fullPrice;
        let label = ' (Digital Download)';
        const bookGenre = (book.genre || '').toLowerCase();
        const isVisualFormat = ['coloring', 'art book'].some(v => bookGenre.includes(v));
        if (purchaseType === 'read_online') {
          if (isVisualFormat) {
            finalPrice = Math.max(1.99, fullPrice - 1);
          } else {
            const discounted = Math.round((fullPrice * 0.65) * 100) / 100;
            const cents = Math.round((discounted % 1) * 100);
            finalPrice = cents >= 75 ? Math.floor(discounted) + 0.99 : cents >= 25 ? Math.floor(discounted) + 0.49 : Math.floor(discounted) - 0.01;
            finalPrice = Math.max(1.99, finalPrice);
          }
          label = ' (1-Year Online Reading)';
        } else if (purchaseType === 'bundle') {
          const premium = Math.round((fullPrice * 1.30) * 100) / 100;
          const cents = Math.round((premium % 1) * 100);
          finalPrice = cents >= 75 ? Math.floor(premium) + 0.99 : cents >= 25 ? Math.floor(premium) + 0.49 : Math.floor(premium) - 0.01;
          finalPrice = Math.max(fullPrice + 1, finalPrice);
          label = ' (Read Online + Download)';
        }
        const imageUrl = book.coverUrl
          ? (book.coverUrl.startsWith('http') ? book.coverUrl : `${baseUrl}${book.coverUrl}`)
          : null;
        if (promoDiscount > 0) {
          finalPrice = Math.max(0.50, finalPrice * (1 - promoDiscount));
        }
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: book.title + label,
              description: `by ${book.author}${promoDiscount > 0 ? ` (${Math.round(promoDiscount * 100)}% off with ${upperPromo})` : ''}`,
              ...(imageUrl ? { images: [imageUrl] } : {}),
            },
            unit_amount: Math.round(finalPrice * 100),
          },
          quantity: 1,
        };
      });

      const total = lineItems.reduce((sum, li) => sum + li.price_data.unit_amount, 0) / 100;
      
      const session = await stripe.checkout.sessions.create({
        line_items: lineItems,
        mode: 'payment',
        success_url: `${req.protocol}://${req.get('host')}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.protocol}://${req.get('host')}/cart`,
        after_expiration: {
          recovery: {
            enabled: true,
            allow_promotion_codes: true,
          },
        },
        expires_at: Math.floor(Date.now() / 1000) + 1800,
        // Tag every EbookGamez purchase so it's identifiable in Stripe
        // even when the Stripe account is shared with other businesses.
        payment_intent_data: {
          statement_descriptor_suffix: 'EBOOKGAMEZ',
          metadata: { site: 'ebookgamez.com', business: 'EbookGamez' },
        },
        metadata: {
          site: 'ebookgamez.com',
          business: 'EbookGamez',
          bookIds: validItems.map(vi => vi.book.id).join(','),
          purchaseTypes: validItems.map(vi => vi.purchaseType).join(','),
          total: total.toFixed(2),
          ...(promoDiscount > 0 ? { promoCode: promoCode.toUpperCase() } : {}),
        },
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ error: "Failed to create checkout session" });
    }
  });

  const orderTokenRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please try again later." },
  });

  // POST /api/orders/session/:sessionId/token
  // Issues a short-lived order access token bound to the authenticated customer.
  // Requires a customer session whose email matches the order; admin access also permitted.
  // The Stripe session ID is validated server-side but is NOT treated as a credential —
  // only authenticated callers whose identity matches the order can receive a token.
  app.post("/api/orders/session/:sessionId/token", orderTokenRateLimit, async (req, res) => {
    try {
      const { sessionId } = req.params;
      if (!sessionId || !sessionId.startsWith("cs_")) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      const customerSession = getCustomerSession(req);
      if (!customerSession && !isAdminAuthenticated(req)) {
        return res.status(401).json({ error: "auth_required", message: "Please log in to access your order." });
      }

      const order = await storage.getOrderBySessionId(sessionId);
      if (!order || order.status !== "completed") {
        return res.status(404).json({ error: "Order not found. If you just completed payment, please wait a moment and try again." });
      }

      if (customerSession && customerSession.email.toLowerCase() !== order.customerEmail.toLowerCase()) {
        return res.status(403).json({ error: "Access denied" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      orderAccessTokens.set(token, {
        customerEmail: order.customerEmail,
        expiresAt: Date.now() + 60 * 60 * 1000,
      });

      const orderItems = await storage.getOrderItems(order.id);
      res.json({ orderToken: token, order, items: orderItems });
    } catch (error) {
      console.error("Error issuing order token:", error);
      res.status(500).json({ error: "Failed to process order" });
    }
  });

  // GET /api/orders/session/:sessionId - Get order by Stripe session ID
  // Requires a customer session or order access token. Raw session IDs are not accepted.
  app.get("/api/orders/session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;

      const customerSession = getCustomerSession(req);
      const orderTokenEmail = getOrderTokenEmail(req);
      if (!customerSession && !orderTokenEmail && !isAdminAuthenticated(req)) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const order = await storage.getOrderBySessionId(sessionId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (customerSession && customerSession.email.toLowerCase() !== order.customerEmail.toLowerCase()) {
        return res.status(403).json({ error: "Access denied" });
      }
      if (orderTokenEmail && orderTokenEmail.toLowerCase() !== order.customerEmail.toLowerCase()) {
        return res.status(403).json({ error: "Access denied" });
      }

      const orderItems = await storage.getOrderItems(order.id);
      res.json({ order, items: orderItems });
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  // GET /api/orders/email/:email - Get orders by email
  // Requires the caller to be authenticated as the requested email (or admin).
  app.get("/api/orders/email/:email", async (req, res) => {
    try {
      const { email } = req.params;

      const customerSession = getCustomerSession(req);
      if (!customerSession && !isAdminAuthenticated(req)) {
        return res.status(401).json({ error: "Authentication required" });
      }
      if (customerSession && customerSession.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(403).json({ error: "Access denied" });
      }

      const orders = await storage.getOrdersByEmail(email);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  // ==================== CONTENT STUDIO ROUTES ====================

  // GET /api/content-studio/genres - Get available genres
  app.get("/api/content-studio/genres", (_req, res) => {
    res.json(contentStudio.getAvailableGenres());
  });

  app.get("/api/content-studio/illustration-exempt-ids", (_req, res) => {
    res.json(contentStudio.getIllustrationExemptIds());
  });

  // GET /api/content-studio/drafts - Get all draft ebooks (lightweight - word counts computed in SQL, no content/outline loaded)
  // Supports ?status=active (non-published, for polling) or ?status=published (load once)
  app.get("/api/content-studio/drafts", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const statusFilter = req.query.status as string | undefined;

      let whereClause;
      if (statusFilter === "active") {
        whereClause = sql`${draftEbooks.status} != 'published'`;
      } else if (statusFilter === "published") {
        whereClause = eq(draftEbooks.status, "published");
      }

      const baseColumns = {
        id: draftEbooks.id,
        title: draftEbooks.title,
        genre: draftEbooks.genre,
        topic: draftEbooks.topic,
        description: draftEbooks.description,
        coverUrl: draftEbooks.coverUrl,
        backgroundUrl: draftEbooks.backgroundUrl,
        pdfUrl: draftEbooks.pdfUrl,
        suggestedPrice: draftEbooks.suggestedPrice,
        status: draftEbooks.status,
        coverStyleId: draftEbooks.coverStyleId,
        overlayApproved: draftEbooks.overlayApproved,
        createdAt: draftEbooks.createdAt,
        publishedAt: draftEbooks.publishedAt,
      };

      let drafts;
      if (statusFilter === "published") {
        drafts = await db.select({
          ...baseColumns,
          contentWordCount: sql<number>`CASE WHEN ${draftEbooks.content} IS NULL OR length(${draftEbooks.content}) < 10 THEN 0 ELSE (length(${draftEbooks.content}) - length(replace(${draftEbooks.content}, ' ', '')) + 1) END`.as('content_word_count'),
          contentLen: sql<number>`COALESCE(length(${draftEbooks.content}), 0)`.as('content_len'),
          outlineLen: sql<number>`COALESCE(length(${draftEbooks.outline}), 0)`.as('outline_len'),
          writtenChapterCount: sql<number>`0`.as('written_chapter_count'),
          outlineChapterCount: sql<number>`0`.as('outline_chapter_count'),
          hasTBCMarker: sql<boolean>`false`.as('has_tbc_marker'),
          hasIncompleteMarker: sql<boolean>`false`.as('has_incomplete_marker'),
          hasIllustrations: sql<boolean>`COALESCE(${draftEbooks.content}, '') LIKE '%/objstore/illustrations/%'`.as('has_illustrations'),
        }).from(draftEbooks)
          .where(whereClause)
          .orderBy(desc(draftEbooks.createdAt));
      } else {
        drafts = await db.select({
          ...baseColumns,
          contentWordCount: sql<number>`CASE WHEN ${draftEbooks.content} IS NULL OR length(${draftEbooks.content}) < 10 THEN 0 ELSE (length(${draftEbooks.content}) - length(replace(${draftEbooks.content}, ' ', '')) + 1) END`.as('content_word_count'),
          contentLen: sql<number>`COALESCE(length(${draftEbooks.content}), 0)`.as('content_len'),
          outlineLen: sql<number>`COALESCE(length(${draftEbooks.outline}), 0)`.as('outline_len'),
          writtenChapterCount: sql<number>`regexp_count(E'\n' || COALESCE(${draftEbooks.content}, ''), E'\n#{1,2} chapter ', 1, 'i')`.as('written_chapter_count'),
          outlineChapterCount: sql<number>`regexp_count(E'\n' || COALESCE(${draftEbooks.outline}, ''), E'\n#{1,4}[# *]*chapter[: ]+[0-9]', 1, 'i')`.as('outline_chapter_count'),
          hasTBCMarker: sql<boolean>`lower(COALESCE(${draftEbooks.content}, '')) LIKE '%to be continued%' OR lower(COALESCE(${draftEbooks.content}, '')) LIKE '%the story continues%'`.as('has_tbc_marker'),
          hasIncompleteMarker: sql<boolean>`COALESCE(${draftEbooks.content}, '') LIKE '%[Content generation incomplete for this chapter. Please regenerate this ebook.]%'`.as('has_incomplete_marker'),
          totalIllustrationMarkers: sql<number>`(length(COALESCE(${draftEbooks.content}, '')) - length(replace(COALESCE(${draftEbooks.content}, ''), '[ILLUSTRATION:', ''))) / 14`.as('total_illustration_markers'),
          completedIllustrations: sql<number>`regexp_count(COALESCE(${draftEbooks.content}, ''), '\\[ILLUSTRATION:\\s*(/uploads/|/objstore/)')`.as('completed_illustrations'),
        }).from(draftEbooks)
          .where(whereClause)
          .orderBy(desc(draftEbooks.createdAt));
      }

      const CLASSIC_DRAFT_IDS = Array.from({ length: 25 }, (_, i) => 581 + i);
      const { resolveDisplayCoverUrl } = await import("./coverStorage");

      const catalogIndex =
        statusFilter === "published" ? await contentStudio.loadCatalogBookLinkIndex() : null;

      const enrichedDrafts = drafts.map(draft => {
        const wordCount = Number(draft.contentWordCount) || 0;
        const hasContent = (draft.contentLen || 0) > 100;
        const hasOutline = (draft.outlineLen || 0) > 50;
        const isClassic = CLASSIC_DRAFT_IDS.includes(draft.id);
        const totalMarkers = Number(draft.totalIllustrationMarkers) || 0;
        const completedIll = Number(draft.completedIllustrations) || 0;
        const pendingIllustrations = Math.max(0, totalMarkers - completedIll);
        const wc = Number(draft.writtenChapterCount) || 0;
        const oc = Number(draft.outlineChapterCount) || 0;

        let needsContinuation = false;
        if (!isClassic && wc > 0 && (draft.status === "draft" || draft.status === "idea")) {
          if (draft.hasIncompleteMarker) {
            needsContinuation = true;
          } else if (oc > 0 && wc < oc) {
            needsContinuation = true;
          }
        }

        const catalogBook =
          statusFilter === "published" && catalogIndex
            ? contentStudio.findCatalogBookLinkForDraft(draft.id, draft.title, catalogIndex)
            : null;
        const resolvedCoverUrl = statusFilter === "published"
          ? resolveDisplayCoverUrl(draft.coverUrl, catalogBook?.coverUrl, draft.backgroundUrl)
          : (draft.coverUrl || draft.backgroundUrl || null);

        return {
          id: draft.id,
          title: draft.title,
          genre: draft.genre,
          topic: draft.topic,
          description: draft.description,
          coverUrl: resolvedCoverUrl,
          backgroundUrl: draft.backgroundUrl,
          pdfUrl: draft.pdfUrl,
          suggestedPrice: draft.suggestedPrice,
          status: draft.status,
          coverStyleId: draft.coverStyleId,
          overlayApproved: draft.overlayApproved,
          createdAt: draft.createdAt,
          publishedAt: draft.publishedAt,
          content: hasContent ? "has_content" : "",
          outline: hasOutline ? "has_outline" : null,
          outlineChapterCount: oc,
          writtenChapterCount: wc,
          lastCompleteChapter: wc,
          lastChapterHasContent: !needsContinuation || wc >= wc,
          needsContinuation,
          contentWordCount: wordCount,
          hasTBCMarker: !!draft.hasTBCMarker,
          pendingIllustrations,
          totalIllustrations: totalMarkers,
          hasIllustrations: !!(draft as { hasIllustrations?: boolean }).hasIllustrations,
          bookVisible: catalogBook?.visible !== false,
          publishedBookId: catalogBook?.id ?? null,
          inCatalog: catalogBook != null,
        };
      });
      res.json(enrichedDrafts);
    } catch (error) {
      console.error("Error fetching drafts:", error);
      res.status(500).json({ error: "Failed to fetch drafts" });
    }
  });

  // GET /api/content-studio/jobs - Get all generation jobs
  app.get("/api/content-studio/jobs", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const jobs = await db.select().from(generationJobs).orderBy(desc(generationJobs.createdAt));
      const slimJobs = jobs.map(job => ({
        ...job,
        topics: job.topics?.map(t => t.length > 100 ? t.substring(0, 100) + "..." : t),
      }));
      res.json(slimJobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ error: "Failed to fetch jobs" });
    }
  });

  // POST /api/content-studio/regenerate-title/:id - Regenerate title from stored description
  app.post("/api/content-studio/regenerate-title/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      const result = await contentStudio.regenerateDraftTitle(draftId);
      res.json(result);
    } catch (error: any) {
      console.error("Error regenerating title:", error);
      res.status(500).json({ error: error.message || "Failed to regenerate title" });
    }
  });

  // GET /api/content-studio/ai-provider - Get current AI provider
  app.get("/api/content-studio/ai-provider", (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    res.json({ provider: contentStudio.getContentAIProvider() });
  });

  // POST /api/content-studio/ai-provider - Set AI provider (openai or replit)
  app.post("/api/content-studio/ai-provider", (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    const { provider } = req.body;
    if (provider !== "openai" && provider !== "replit") {
      return res.status(400).json({ error: "Provider must be 'openai' or 'replit'" });
    }
    contentStudio.setContentAIProvider(provider);
    res.json({ provider, message: `AI provider set to ${provider === "replit" ? "Replit AI" : "OpenAI"}` });
  });

  // POST /api/content-studio/custom-create - Create a custom book from description
  app.post("/api/content-studio/custom-create", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { description, genre } = req.body;
      if (!description) {
        return res.status(400).json({ error: "Description is required" });
      }
      const draftId = await contentStudio.createCustomBook(description, genre);
      res.json({ draftId, message: "Custom book creation started" });
    } catch (error) {
      console.error("Error creating custom book:", error);
      res.status(500).json({ error: "Failed to create custom book" });
    }
  });

  // POST /api/content-studio/research-titles - AI market research → cover-first draft placers
  app.post("/api/content-studio/research-titles", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { count = 5, includeCustomerRequests = true, focusNotes } = req.body;
      const result = await contentStudio.researchAndCreateTitlePlacers({
        count: Number(count) || 5,
        includeCustomerRequests: includeCustomerRequests !== false,
        focusNotes,
      });
      res.json({
        ...result,
        message: `Created ${result.createdDraftIds.length} new title placers for Cover Review`,
      });
    } catch (error) {
      console.error("Error researching titles:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to research titles",
      });
    }
  });

  // GET /api/content-studio/book-requests - List customer book request pool (admin)
  app.get("/api/content-studio/book-requests", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const requests = await contentStudio.listBookRequests(status);
      res.json({ requests });
    } catch (error) {
      console.error("Error listing book requests:", error);
      res.status(500).json({ error: "Failed to list book requests" });
    }
  });

  // PATCH /api/content-studio/book-requests/:id - Approve or reject a customer request
  app.patch("/api/content-studio/book-requests/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const id = parseInt(req.params.id, 10);
      const { status, adminNotes } = req.body;
      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ error: "Status must be pending, approved, or rejected" });
      }
      const updated = await contentStudio.updateBookRequestStatus(id, status, adminNotes);
      if (!updated) return res.status(404).json({ error: "Request not found" });
      res.json({ request: updated });
    } catch (error) {
      console.error("Error updating book request:", error);
      res.status(500).json({ error: "Failed to update book request" });
    }
  });

  const bookRequestRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: "Too many book requests. Please try again later." },
  });

  // POST /api/book-requests - Customer suggests a book idea (goes to request pool)
  app.post("/api/book-requests", bookRequestRateLimit, async (req, res) => {
    try {
      const parsed = insertBookRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Request text is required (max 2000 characters)" });
      }
      if (parsed.data.requestText.length > 2000) {
        return res.status(400).json({ error: "Request is too long (max 2000 characters)" });
      }
      const id = await contentStudio.submitBookRequest(parsed.data);
      res.json({ id, message: "Thanks! We'll review your suggestion." });
    } catch (error) {
      console.error("Error submitting book request:", error);
      res.status(500).json({ error: "Failed to submit request" });
    }
  });

  app.get("/api/content-studio/validate-genre/:genre", async (req, res) => {
    try {
      const result = contentStudio.validateGenreForGeneration(decodeURIComponent(req.params.genre));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to validate genre" });
    }
  });

  app.get("/api/content-studio/visual-first-genres", async (_req, res) => {
    res.json({ genres: contentStudio.getVisualFirstGenres() });
  });

  // POST /api/content-studio/generate - Start bulk generation
  app.post("/api/content-studio/generate", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { genre, count = 20, inspired = false } = req.body;
      if (!genre) {
        return res.status(400).json({ error: "Genre is required" });
      }
      const validation = contentStudio.validateGenreForGeneration(genre);
      const jobId = await contentStudio.startBulkGeneration(genre, count, inspired);
      res.json({ 
        jobId, 
        visualEnhanced: validation.visualEnhanced || false,
        message: `Started generating ${count} ${inspired ? 'inspired' : ''} ebooks for ${genre}${validation.visualEnhanced ? ' (visual-enhanced mode — illustrations will be generated)' : ''}` 
      });
    } catch (error) {
      console.error("Error starting generation:", error);
      res.status(500).json({ error: "Failed to start generation" });
    }
  });

  // POST /api/content-studio/generate-all - Generate for all genres
  app.post("/api/content-studio/generate-all", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { countPerGenre = 20, inspired = false } = req.body;
      const genres = contentStudio.getAvailableGenres();
      const jobIds: number[] = [];
      const visualEnhancedGenres: string[] = [];
      
      for (const genre of genres) {
        const validation = contentStudio.validateGenreForGeneration(genre);
        if (validation.visualEnhanced) {
          visualEnhancedGenres.push(genre);
          console.log(`[Genre Guard] "${genre}" will use visual-enhanced mode with illustrations`);
        }
        const jobId = await contentStudio.startBulkGeneration(genre, countPerGenre, inspired);
        jobIds.push(jobId);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      res.json({ 
        jobIds, 
        visualEnhancedGenres,
        message: `Started generating ${countPerGenre} ${inspired ? 'inspired' : ''} ebooks for ${genres.length} genres${visualEnhancedGenres.length > 0 ? `. Visual-enhanced: ${visualEnhancedGenres.join(', ')}` : ''}` 
      });
    } catch (error) {
      console.error("Error starting bulk generation:", error);
      res.status(500).json({ error: "Failed to start bulk generation" });
    }
  });

  // POST /api/content-studio/generate-inspired - Generate ebooks inspired by popular works
  app.post("/api/content-studio/generate-inspired", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { genres, countPerGenre = 2 } = req.body;
      if (!genres || !Array.isArray(genres) || genres.length === 0) {
        return res.status(400).json({ error: "Genres array is required" });
      }
      const jobIds: number[] = [];
      
      for (const genre of genres) {
        const jobId = await contentStudio.startBulkGeneration(genre, countPerGenre, true);
        jobIds.push(jobId);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      res.json({ 
        jobIds,
        message: `Started generating ${countPerGenre} ebooks inspired by popular works for ${genres.length} genres` 
      });
    } catch (error) {
      console.error("Error starting inspired generation:", error);
      res.status(500).json({ error: "Failed to start inspired generation" });
    }
  });

  app.post("/api/content-studio/drafts/:id/push-to-storefront", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });

      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft) return res.status(404).json({ error: "Draft not found" });

      const content = draft.content || "";
      const title = draft.title || draft.topic || "Untitled";
      const genre = draft.genre || "General";
      const words = content.split(/\s+/).length;
      const isColoringBook = genre.toLowerCase().includes("coloring");
      const minWords = isColoringBook ? 100 : 5000;
      if (words < minWords) {
        return res.status(400).json({ error: `Word count ${words} is below minimum ${minWords}. Cannot publish.` });
      }
      if (!isColoringBook) {
        const structScan = await contentStudio.scanContentCompleteness([draftId]);
        const structuralIssues = structScan.length > 0 ? structScan[0].issues : [];
        if (structuralIssues.length > 0) {
          return res.status(400).json({ error: `Structural issues found: ${structuralIssues.join('; ')}`, issues: structuralIssues });
        }
        const dialogueResult = await contentStudio.checkDialogueQuality(content, title, genre, draft.outline || undefined);
        if (!dialogueResult.pass) {
          return res.status(400).json({ error: `Dialogue quality check failed: ${dialogueResult.summary}`, issues: dialogueResult.issues });
        }
      }

      const subscriberExclusive = req.body?.subscriberExclusive === true;
      const bookId = await contentStudio.pushPublishedDraftToStorefront(draftId, { subscriberExclusive });
      res.json({ bookId, subscriberExclusive, message: "Draft is now on the storefront" });
    } catch (error) {
      console.error("Error pushing draft to storefront:", error);
      res.status(400).json({ error: error instanceof Error ? error.message : "Failed to push to storefront" });
    }
  });

  app.post("/api/content-studio/publish/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) {
        return res.status(400).json({ error: "Invalid draft ID" });
      }
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft) return res.status(404).json({ error: "Draft not found" });
      if (draft.status === "published") {
        const catalogBook = await contentStudio.findCatalogBookForDraft(draftId, draft.title);
        if (catalogBook) {
          return res.status(400).json({
            error: `Already in the catalog as book #${catalogBook.id}. Use Unpublish to hide from the storefront.`,
          });
        }
        await contentStudio.resetOrphanPublishedDraft(draftId);
      }
      const [draftAfterReset] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draftAfterReset) return res.status(404).json({ error: "Draft not found" });
      if (draftAfterReset.status !== "ready") {
        return res.status(400).json({
          error: `Only "ready" books can be published. This book is "${draftAfterReset.status}". Run quality checks first.`,
        });
      }
      const content = draftAfterReset.content || "";
      const title = draftAfterReset.title || draftAfterReset.topic || "Untitled";
      const genre = draftAfterReset.genre || "General";
      const words = content.split(/\s+/).length;
      const isColoringBook = genre.toLowerCase().includes("coloring");
      const minWords = isColoringBook ? 100 : 5000;
      if (words < minWords) {
        return res.status(400).json({ error: `Word count ${words} is below minimum ${minWords}. Cannot publish.` });
      }
      if (!isColoringBook) {
        const structScan = await contentStudio.scanContentCompleteness([draftId]);
        const structuralIssues = structScan.length > 0 ? structScan[0].issues : [];
        if (structuralIssues.length > 0) {
          await db.update(draftEbooks).set({ status: "draft" }).where(eq(draftEbooks.id, draftId));
          return res.status(400).json({ error: `Structural issues found: ${structuralIssues.join('; ')}. Demoted to draft.`, issues: structuralIssues });
        }
        const dialogueResult = await contentStudio.checkDialogueQuality(content, title, genre, draftAfterReset.outline || undefined);
        if (!dialogueResult.pass) {
          await db.update(draftEbooks).set({ status: "draft" }).where(eq(draftEbooks.id, draftId));
          return res.status(400).json({ error: `Dialogue quality check failed: ${dialogueResult.summary}. Demoted to draft.`, issues: dialogueResult.issues });
        }
      }
      const subscriberExclusive = req.body?.subscriberExclusive === true;
      const bookId = await contentStudio.publishDraft(draftId, { subscriberExclusive });
      res.json({ bookId, subscriberExclusive, message: "Draft published successfully — passed all quality checks" });
    } catch (error) {
      console.error("Error publishing draft:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to publish draft" });
    }
  });

  // GET /api/content-studio/drafts/:id/read - Get draft content for book reader
  // Authorization is based entirely on server-side lookups — the client-supplied bookId
  // query param is IGNORED for auth; the canonical book is derived from the draft's title.
  app.get("/api/content-studio/drafts/:id/read", async (req, res) => {
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      const [draft] = await db.select({
        id: draftEbooks.id,
        title: draftEbooks.title,
        genre: draftEbooks.genre,
        topic: draftEbooks.topic,
        description: draftEbooks.description,
        content: draftEbooks.content,
        coverUrl: draftEbooks.coverUrl,
        backgroundUrl: draftEbooks.backgroundUrl,
        status: draftEbooks.status,
      }).from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft) return res.status(404).json({ error: "Draft not found" });

      const isClassic = draft.genre?.startsWith("Classic") || false;
      const isAdmin = isAdminAuthenticated(req);

      if (isClassic) {
        // Public: classics are freely readable
      } else if (isAdmin) {
        // Admin: full access to any draft
      } else {
        const catalogBook = await contentStudio.findCatalogBookForDraft(draftId, draft.title);

        if (!catalogBook) {
          return res.status(403).json({ error: "access_denied" });
        }

        const canonicalBookId = catalogBook.id;
        const email = getAuthenticatedEmail(req);
        if (!email) return res.status(401).json({ error: "auth_required" });

        const [paidAccess] = await db.select().from(readingAccess)
          .where(sql`${readingAccess.bookId} = ${canonicalBookId} AND ${readingAccess.customerEmail} = ${email} AND ${readingAccess.expiresAt} > NOW()`)
          .limit(1);

        if (!paidAccess) {
          const subData = await subscriptionService.getSubscriptionWithPlan(email);
          if (!subData) return res.status(403).json({ error: "access_denied" });
          const sub = subData.subscription;
          if (!sub.currentPeriodStart || !sub.currentPeriodEnd) return res.status(403).json({ error: "access_denied" });
          const { start: wStart, end: wEnd } = subscriptionService.getMonthlyWindow(sub);
          const usage = await subscriptionService.getUsageForCurrentPeriod(sub.id, wStart, wEnd);
          const alreadyRead = usage.details.some(u => u.bookId === canonicalBookId && u.usageType === "read");
          if (!alreadyRead) {
            const activeCheckout = await subscriptionService.getActiveCheckout(email);
            if (!activeCheckout || activeCheckout.bookId !== canonicalBookId) {
              return res.status(403).json({ error: "access_denied" });
            }
          }
        }
      }

      res.json({
        ...draft,
        coverUrl: draft.coverUrl || draft.backgroundUrl,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to load draft for reading" });
    }
  });

  app.get("/api/content-studio/drafts/:id", async (req, res) => {
    try {
      if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Admin authentication required" });
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft) return res.status(404).json({ error: "Draft not found" });
      res.json(draft);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch draft" });
    }
  });

  // DELETE /api/content-studio/drafts/:id - Delete a draft
  app.delete("/api/content-studio/drafts/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) {
        return res.status(400).json({ error: "Invalid draft ID" });
      }
      await db.delete(draftEbooks).where(eq(draftEbooks.id, draftId));
      
      // Also cleanup typography vault entry for this draft
      try {
        await backupService.deleteTypographyFromVault(draftId);
      } catch (vaultError) {
        console.log(`Typography vault cleanup skipped for draft ${draftId}:`, vaultError);
      }
      
      res.json({ message: "Draft deleted successfully" });
    } catch (error) {
      console.error("Error deleting draft:", error);
      res.status(500).json({ error: "Failed to delete draft" });
    }
  });

  // DELETE /api/content-studio/drafts/:id/cover - Remove cover image from draft (keeps the draft)
  app.delete("/api/content-studio/drafts/:id/cover", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) {
        return res.status(400).json({ error: "Invalid draft ID" });
      }
      const [existing] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!existing) {
        return res.status(404).json({ error: "Draft not found" });
      }
      const oldCover = existing.coverUrl;
      const oldBg = existing.backgroundUrl;
      await db.update(draftEbooks).set({ coverUrl: null, backgroundUrl: null }).where(eq(draftEbooks.id, draftId));
      for (const imgPath of [oldCover, oldBg]) {
        if (imgPath) {
          try {
            const fullPath = path.join(process.cwd(), imgPath.replace(/^\//, ""));
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
          } catch {}
        }
      }
      try {
        await backupService.deleteTypographyFromVault(draftId);
      } catch {}
      const [updated] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      res.json(updated);
    } catch (error) {
      console.error("Error deleting cover:", error);
      res.status(500).json({ error: "Failed to delete cover" });
    }
  });

  // POST /api/content-studio/drafts/:id/swap-cover - Upload a new image to replace current cover
  app.post("/api/content-studio/drafts/:id/swap-cover", uploadCoverImage.single("image"), async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) {
        return res.status(400).json({ error: "Invalid draft ID" });
      }
      const [existing] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!existing) {
        return res.status(404).json({ error: "Draft not found" });
      }
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }
      const ext = path.extname(req.file.originalname).toLowerCase() || ".png";
      const destFilename = `draft_${draftId}_swap_${Date.now()}${ext}`;
      const destDir = path.join(process.cwd(), "uploads", "covers");
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      const destPath = path.join(destDir, destFilename);
      fs.renameSync(req.file.path, destPath);
      const newUrl = `/uploads/covers/${destFilename}`;
      for (const imgPath of [existing.coverUrl, existing.backgroundUrl]) {
        if (imgPath) {
          try {
            const fullPath = path.join(process.cwd(), imgPath.replace(/^\//, ""));
            if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
          } catch {}
        }
      }
      await db.update(draftEbooks).set({ coverUrl: newUrl, backgroundUrl: newUrl }).where(eq(draftEbooks.id, draftId));
      try {
        await backupService.deleteTypographyFromVault(draftId);
      } catch {}
      const [updated] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      res.json(updated);
    } catch (error) {
      console.error("Error swapping cover:", error);
      res.status(500).json({ error: "Failed to swap cover" });
    }
  });

  // POST /api/content-studio/swap-covers - Swap covers between two drafts
  app.post("/api/content-studio/swap-covers", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIdA, draftIdB } = req.body;
      if (!draftIdA || !draftIdB || draftIdA === draftIdB) {
        return res.status(400).json({ error: "Two different draft IDs are required" });
      }
      const [draftA] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftIdA));
      const [draftB] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftIdB));
      if (!draftA || !draftB) {
        return res.status(404).json({ error: "One or both drafts not found" });
      }
      await db.update(draftEbooks).set({
        coverUrl: draftB.coverUrl,
        backgroundUrl: draftB.backgroundUrl,
        coverStyleId: draftB.coverStyleId,
      }).where(eq(draftEbooks.id, draftIdA));
      await db.update(draftEbooks).set({
        coverUrl: draftA.coverUrl,
        backgroundUrl: draftA.backgroundUrl,
        coverStyleId: draftA.coverStyleId,
      }).where(eq(draftEbooks.id, draftIdB));
      try {
        await backupService.deleteTypographyFromVault(draftIdA);
        await backupService.deleteTypographyFromVault(draftIdB);
      } catch {}
      const [updatedA] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftIdA));
      const [updatedB] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftIdB));
      res.json({ draftA: updatedA, draftB: updatedB, message: "Covers swapped successfully" });
    } catch (error) {
      console.error("Error swapping covers:", error);
      res.status(500).json({ error: "Failed to swap covers" });
    }
  });

  // POST /api/content-studio/reassign-duplicate-covers
  // When resolving duplicates, move rejected covers to suitable coverless ebooks
  // Only moves backgroundUrl (clean, no embedded text) - not coverUrl
  app.post("/api/content-studio/reassign-duplicate-covers", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { chosenIds, rejectedIds } = req.body as { chosenIds: number[]; rejectedIds: number[] };
      if (!rejectedIds || !Array.isArray(rejectedIds) || rejectedIds.length === 0) {
        return res.status(400).json({ error: "rejectedIds array is required" });
      }
      const safeChosenIds = (chosenIds || []).filter((id: any) => typeof id === "number" && Number.isFinite(id));
      const safeRejectedIds = rejectedIds.filter((id: any) => typeof id === "number" && Number.isFinite(id));
      if (safeRejectedIds.length === 0) {
        return res.status(400).json({ error: "No valid rejected IDs provided" });
      }

      const excludeIds = [...safeChosenIds, ...safeRejectedIds];

      const rejected = await db.select().from(draftEbooks).where(inArray(draftEbooks.id, safeRejectedIds));

      const allCoverless = await db.select().from(draftEbooks).where(
        sql`${draftEbooks.coverUrl} IS NULL AND ${draftEbooks.backgroundUrl} IS NULL AND ${draftEbooks.publishedAt} IS NULL AND NOT (${inArray(draftEbooks.id, excludeIds)})`
      );

      const reassigned: Array<{ fromId: number; toId: number; toTitle: string; toGenre: string }> = [];
      const deleted: number[] = [];
      const usedCoverlessIds = new Set<number>();

      const findBestMatch = (rej: typeof rejected[0]) => {
        const rejGenre = (rej.genre || "").toLowerCase();
        const sameGenre = allCoverless.find(c => !usedCoverlessIds.has(c.id) && (c.genre || "").toLowerCase() === rejGenre);
        if (sameGenre) return sameGenre;
        return allCoverless.find(c => !usedCoverlessIds.has(c.id));
      };

      await db.transaction(async (tx) => {
        for (const rej of rejected) {
          if (!rej.backgroundUrl) {
            await tx.delete(draftEbooks).where(eq(draftEbooks.id, rej.id));
            deleted.push(rej.id);
            continue;
          }

          const match = findBestMatch(rej);
          if (match) {
            usedCoverlessIds.add(match.id);
            await tx.update(draftEbooks).set({
              backgroundUrl: rej.backgroundUrl,
              coverUrl: null,
              coverStyleId: rej.coverStyleId || null,
            }).where(eq(draftEbooks.id, match.id));
            reassigned.push({ fromId: rej.id, toId: match.id, toTitle: match.title, toGenre: match.genre });
            await tx.delete(draftEbooks).where(eq(draftEbooks.id, rej.id));
          } else {
            await tx.delete(draftEbooks).where(eq(draftEbooks.id, rej.id));
            deleted.push(rej.id);
          }
        }
      });

      for (const id of [...safeRejectedIds]) {
        try { await backupService.deleteTypographyFromVault(id); } catch {}
      }

      const skipTwoToneStyles = ["experimental-239", "test-style-f", "standalone-scenes", "artistic-painterly"];
      let titleBarsApplied = 0;
      for (const r of reassigned) {
        try {
          const [target] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, r.toId));
          if (target?.backgroundUrl && !skipTwoToneStyles.includes(target.coverStyleId || "")) {
            const bgPath = target.backgroundUrl.replace(/^\//, "");
            const fullPath = path.join(process.cwd(), bgPath);
            if (fs.existsSync(fullPath)) {
              const imageBuffer = fs.readFileSync(fullPath);
              const title = target.title || target.topic || "Untitled";
              const resultBuffer = await contentStudio.applyTwoToneTitleBar(imageBuffer, title);
              const coverDir = "uploads/covers";
              const filename = `twotone-${Date.now()}-${r.toId}.png`;
              const filepath = path.join(coverDir, filename);
              fs.writeFileSync(filepath, resultBuffer);
              const newCoverUrl = `/${filepath}`;
              await db.update(draftEbooks).set({ coverUrl: newCoverUrl }).where(eq(draftEbooks.id, r.toId));
              titleBarsApplied++;
            }
          }
        } catch (titleErr) {
          console.log(`Title bar auto-apply skipped for reassigned ebook ${r.toId}:`, titleErr);
        }
      }

      res.json({
        reassigned,
        deleted,
        titleBarsApplied,
        message: `Reassigned ${reassigned.length} cover(s) to coverless ebooks (genre-matched when possible), deleted ${deleted.length} without suitable match. ${titleBarsApplied > 0 ? `Applied title bars to ${titleBarsApplied} cover(s).` : ""}`
      });
    } catch (error) {
      console.error("Error reassigning duplicate covers:", error);
      res.status(500).json({ error: "Failed to reassign duplicate covers" });
    }
  });

  // POST /api/content-studio/ai-match-cover - Use AI to find the best coverless ebook for a cover image
  app.post("/api/content-studio/ai-match-cover", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { coverId, coverUrl } = req.body as { coverId: number; coverUrl: string };
      if (!coverId || typeof coverId !== "number" || !coverUrl || typeof coverUrl !== "string") {
        return res.status(400).json({ error: "coverId (number) and coverUrl (string) are required" });
      }

      const allCoverless = await db.select().from(draftEbooks).where(
        sql`${draftEbooks.coverUrl} IS NULL AND ${draftEbooks.backgroundUrl} IS NULL AND ${draftEbooks.publishedAt} IS NULL`
      );

      if (allCoverless.length === 0) {
        return res.json({ match: null, message: "No coverless ebooks available to match with." });
      }

      let imageData: string;
      if (coverUrl.startsWith("http://") || coverUrl.startsWith("https://")) {
        imageData = coverUrl;
      } else {
        const localPath = path.join(process.cwd(), coverUrl.startsWith("/") ? coverUrl.slice(1) : coverUrl);
        if (!fs.existsSync(localPath)) {
          return res.status(400).json({ error: "Cover image file not found on server" });
        }
        const buffer = fs.readFileSync(localPath);
        const ext = path.extname(localPath).toLowerCase();
        const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
        imageData = `data:${mime};base64,${buffer.toString("base64")}`;
      }

      const ebookList = allCoverless.map((e, i) => `${i + 1}. ID:${e.id} | Title: "${e.title}" | Genre: ${e.genre || "Unknown"}`).join("\n");

      const OpenAI = (await import("openai")).default;
      const openaiReplit = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openaiReplit.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a book cover art director. Look at this ebook cover image and analyze its visual style, mood, color palette, subject matter, and thematic elements.

Then choose the BEST matching ebook from this list of coverless ebooks. Consider:
- Genre alignment (does the cover's mood match the genre?)
- Thematic fit (do the visual elements relate to the book's title/subject?)
- Tone match (dark/light, serious/playful, etc.)

Available coverless ebooks:
${ebookList}

Respond in JSON format only:
{
  "matchId": <the ID number of the best match>,
  "matchTitle": "<title of the best match>",
  "confidence": "<high/medium/low>",
  "reason": "<2-3 sentence explanation of why this cover fits this ebook>"
}`
              },
              {
                type: "image_url",
                image_url: { url: imageData, detail: "low" }
              }
            ]
          }
        ],
        max_completion_tokens: 300,
      });

      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.json({ match: null, message: "AI could not determine a match." });
      }

      const result = JSON.parse(jsonMatch[0]);
      const matchedEbook = allCoverless.find(e => e.id === result.matchId);
      if (!matchedEbook) {
        return res.json({ match: null, message: "AI suggested an invalid match." });
      }

      res.json({
        match: {
          id: matchedEbook.id,
          title: matchedEbook.title,
          genre: matchedEbook.genre,
          confidence: result.confidence,
          reason: result.reason,
        }
      });
    } catch (error) {
      console.error("Error in AI cover matching:", error);
      res.status(500).json({ error: "AI matching failed. Please try again." });
    }
  });

  // POST /api/content-studio/ai-suggest-title - AI analyzes cover artwork and suggests a new title
  app.post("/api/content-studio/ai-suggest-title", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftId } = req.body as { draftId: number };
      if (!draftId || typeof draftId !== "number") {
        return res.status(400).json({ error: "draftId (number) is required" });
      }

      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft) return res.status(404).json({ error: "Draft not found" });

      const coverUrl = draft.backgroundUrl || draft.coverUrl;
      if (!coverUrl) return res.status(400).json({ error: "No cover image found" });

      let imageData: string;
      if (coverUrl.startsWith("http://") || coverUrl.startsWith("https://")) {
        imageData = coverUrl;
      } else {
        const localPath = path.join(process.cwd(), coverUrl.startsWith("/") ? coverUrl.slice(1) : coverUrl);
        if (!fs.existsSync(localPath)) {
          return res.status(400).json({ error: "Cover image file not found on server" });
        }
        const buffer = fs.readFileSync(localPath);
        const ext = path.extname(localPath).toLowerCase();
        const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
        imageData = `data:${mime};base64,${buffer.toString("base64")}`;
      }

      const OpenAI = (await import("openai")).default;
      const openaiReplit = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const response = await openaiReplit.chat.completions.create({
        model: "gpt-5.2",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a creative book title expert. Analyze this ebook cover artwork carefully — its visual style, mood, color palette, subject matter, symbols, and thematic elements.

Based on what you see in the artwork, suggest 3 compelling new book titles that would work with this cover. Each suggestion should explore a DIFFERENT genre and subject area. Be creative and diverse — the goal is to repurpose this cover for an entirely new book, so don't limit yourself to the obvious interpretation.

For example, a dark atmospheric cover could work for Horror, Thriller, Literary Fiction, Dark Romance, Dystopian Sci-Fi, or even Psychology/Self-Help depending on how you frame the title.

Guidelines:
- Each of the 3 suggestions MUST be a different genre from each other
- Think broadly: fiction AND non-fiction genres are both fair game
- Titles should be original, marketable, and feel like real published books
- Consider how the artwork's mood and visuals could be reinterpreted across genres

Respond in JSON format only:
{
  "suggestions": [
    { "title": "<suggested title>", "genre": "<genre>", "reason": "<1 sentence why this title fits the artwork>" },
    { "title": "<suggested title>", "genre": "<genre>", "reason": "<1 sentence why this title fits the artwork>" },
    { "title": "<suggested title>", "genre": "<genre>", "reason": "<1 sentence why this title fits the artwork>" }
  ]
}`
              },
              {
                type: "image_url",
                image_url: { url: imageData, detail: "low" }
              }
            ]
          }
        ],
        max_completion_tokens: 400,
      });

      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.json({ suggestions: [], message: "AI could not suggest titles." });
      }

      const result = JSON.parse(jsonMatch[0]);
      res.json({ suggestions: result.suggestions || [] });
    } catch (error) {
      console.error("Error in AI title suggestion:", error);
      res.status(500).json({ error: "AI title suggestion failed. Please try again." });
    }
  });

  // POST /api/content-studio/reassign-cover - Reassign a single cover to a specific target ebook
  app.post("/api/content-studio/reassign-cover", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { fromId, toId } = req.body as { fromId: number; toId: number };
      if (!fromId || typeof fromId !== "number" || !toId || typeof toId !== "number") {
        return res.status(400).json({ error: "fromId and toId must be numbers" });
      }

      const [source] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, fromId));
      const [target] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, toId));

      if (!source) return res.status(404).json({ error: "Source ebook not found" });
      if (!target) return res.status(404).json({ error: "Target ebook not found" });
      const sourceCoverPath = source.backgroundUrl || source.coverUrl;
      if (!sourceCoverPath) return res.status(400).json({ error: "Source ebook has no cover to reassign" });
      if (target.backgroundUrl || target.coverUrl) {
        return res.status(400).json({ error: "Target ebook already has a cover" });
      }

      const hasCleanBackground = !!source.backgroundUrl;

      await db.transaction(async (tx) => {
        if (hasCleanBackground) {
          await tx.update(draftEbooks).set({
            backgroundUrl: source.backgroundUrl,
            coverUrl: null,
            coverStyleId: source.coverStyleId || null,
          }).where(eq(draftEbooks.id, toId));
        } else {
          await tx.update(draftEbooks).set({
            backgroundUrl: null,
            coverUrl: source.coverUrl,
            coverStyleId: source.coverStyleId || null,
          }).where(eq(draftEbooks.id, toId));
        }

        await tx.delete(draftEbooks).where(eq(draftEbooks.id, fromId));
      });

      try { await backupService.deleteTypographyFromVault(fromId); } catch {}

      const skipTwoToneStyles = ["experimental-239", "test-style-f", "standalone-scenes", "artistic-painterly"];
      let titleBarApplied = false;
      if (hasCleanBackground && !skipTwoToneStyles.includes(source.coverStyleId || "")) {
        try {
          const bgPath = source.backgroundUrl!.replace(/^\//, "");
          const fullPath = path.join(process.cwd(), bgPath);
          if (fs.existsSync(fullPath)) {
            const imageBuffer = fs.readFileSync(fullPath);
            const title = target.title || target.topic || "Untitled";
            const resultBuffer = await contentStudio.applyTwoToneTitleBar(imageBuffer, title);
            const coverDir = "uploads/covers";
            const filename = `twotone-${Date.now()}-${toId}.png`;
            const filepath = path.join(coverDir, filename);
            fs.writeFileSync(filepath, resultBuffer);
            const newCoverUrl = `/${filepath}`;
            await db.update(draftEbooks).set({ coverUrl: newCoverUrl }).where(eq(draftEbooks.id, toId));
            titleBarApplied = true;
          }
        } catch (titleErr) {
          console.log(`Title bar auto-apply skipped for ${toId}:`, titleErr);
        }
      }

      res.json({
        message: `Cover reassigned from "${source.title}" to "${target.title}"${titleBarApplied ? " with title bar applied" : ""}`,
        fromTitle: source.title,
        toTitle: target.title,
        toId: target.id,
        titleBarApplied,
      });
    } catch (error) {
      console.error("Error reassigning cover:", error);
      res.status(500).json({ error: "Failed to reassign cover" });
    }
  });

  // PATCH /api/content-studio/drafts/:id - Update draft title/price
  app.patch("/api/content-studio/drafts/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) {
        return res.status(400).json({ error: "Invalid draft ID" });
      }
      
      // Check if draft exists
      const [existing] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!existing) {
        return res.status(404).json({ error: "Draft not found" });
      }
      
      const { title, suggestedPrice, genre } = req.body;
      
      // Validate inputs
      if (title !== undefined && (typeof title !== "string" || title.trim().length === 0)) {
        return res.status(400).json({ error: "Title must be a non-empty string" });
      }
      if (suggestedPrice !== undefined) {
        const price = parseFloat(suggestedPrice);
        if (isNaN(price) || price < 0) {
          return res.status(400).json({ error: "Price must be a valid positive number" });
        }
      }
      if (genre !== undefined && (typeof genre !== "string" || genre.trim().length === 0)) {
        return res.status(400).json({ error: "Genre must be a non-empty string" });
      }
      
      const updates: Record<string, any> = {};
      if (title !== undefined) updates.title = title.trim();
      if (suggestedPrice !== undefined) updates.suggestedPrice = suggestedPrice;
      if (genre !== undefined) updates.genre = genre.trim();
      
      // Require at least one field to update
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }
      
      await db.update(draftEbooks).set(updates).where(eq(draftEbooks.id, draftId));
      const [updated] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      res.json(updated);
    } catch (error) {
      console.error("Error updating draft:", error);
      res.status(500).json({ error: "Failed to update draft" });
    }
  });

  // GET /api/content-studio/download-cover/:id - Download cover image with proper headers
  app.get("/api/content-studio/download-cover/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) {
        return res.status(400).json({ error: "Invalid draft ID" });
      }
      
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      const coverUrl = draft?.coverUrl || draft?.backgroundUrl;
      if (!draft || !coverUrl) {
        return res.status(404).json({ error: "Cover not found" });
      }
      
      const coverPath = path.join(process.cwd(), coverUrl.replace(/^\//, ""));
      if (!fs.existsSync(coverPath)) {
        return res.status(404).json({ error: "Cover file not found" });
      }
      
      const filename = `${draft.title.replace(/[^a-zA-Z0-9]/g, '_')}_cover.png`;
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      fs.createReadStream(coverPath).pipe(res);
    } catch (error) {
      console.error("Error downloading cover:", error);
      res.status(500).json({ error: "Failed to download cover" });
    }
  });

  // GET /api/content-studio/download-covers-zip - Download selected covers as ZIP
  app.get("/api/content-studio/download-covers-zip", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const idsParam = req.query.ids as string;
      const format = (req.query.format as string) || "png";
      
      if (!idsParam) {
        return res.status(400).json({ error: "No IDs provided" });
      }
      
      const ids = idsParam.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length === 0) {
        return res.status(400).json({ error: "No valid IDs provided" });
      }
      
      const drafts = await db.select().from(draftEbooks).where(inArray(draftEbooks.id, ids));
      // Check for coverUrl OR backgroundUrl (test covers use backgroundUrl)
      const draftsWithCovers = drafts.filter(d => d.coverUrl || d.backgroundUrl);
      
      if (draftsWithCovers.length === 0) {
        return res.status(404).json({ error: "No covers found for selected drafts" });
      }
      
      const archive = archiver("zip", { zlib: { level: 5 } });
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="ebooks-${format}-${Date.now()}.zip"`);
      
      // Handle archive errors
      archive.on("error", (err) => {
        console.error("Archive error:", err);
      });
      
      archive.pipe(res);
      
      // Create manifest for re-upload matching
      const manifest: Record<string, { id: number; title: string; filename: string }> = {};
      const errors: string[] = [];
      
      for (const draft of draftsWithCovers) {
        try {
          // Use coverUrl first, fallback to backgroundUrl
          const coverUrl = draft.coverUrl || draft.backgroundUrl;
          const coverPath = path.join(process.cwd(), coverUrl!.replace(/^\//, ""));
          if (fs.existsSync(coverPath)) {
            if (format === "epub") {
              // Generate EPUB file with cover and content
              const epubOptions = {
                title: draft.title,
                author: "EbookGamez",
                cover: coverPath,
                lang: "en",
                tocTitle: "Table of Contents",
              };
              
              // Convert content to HTML chapters
              const contentText = draft.content || draft.outline || `A ${draft.genre} book.`;
              const paragraphs = contentText.split(/\n\n+/).filter((p: string) => p.trim());
              const chapters: { title: string; content: string }[] = [];
              
              const chapterPattern = /^(Chapter\s+\d+|Part\s+\d+|Section\s+\d+|#{1,3}\s+)[:\s]*(.*)/i;
              let currentChapter = { title: "Introduction", body: "" };
              
              for (const para of paragraphs) {
                const match = para.match(chapterPattern);
                if (match) {
                  if (currentChapter.body.trim()) {
                    chapters.push({
                      title: currentChapter.title,
                      content: `<div style="font-family: Georgia, serif; line-height: 1.8;">${currentChapter.body}</div>`
                    });
                  }
                  currentChapter = { 
                    title: match[2]?.trim() || match[1].replace(/^#+\s*/, '').trim() || "Chapter", 
                    body: "" 
                  };
                } else {
                  const htmlPara = para.replace(/\n/g, "<br/>")
                    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                    .replace(/\*(.*?)\*/g, "<em>$1</em>")
                    .replace(/^[-*]\s+/gm, "• ");
                  currentChapter.body += `<p style="text-indent: 1.5em; margin-bottom: 1em;">${htmlPara}</p>`;
                }
              }
              
              if (currentChapter.body.trim()) {
                chapters.push({
                  title: currentChapter.title,
                  content: `<div style="font-family: Georgia, serif; line-height: 1.8;">${currentChapter.body}</div>`
                });
              }
              
              if (chapters.length === 0) {
                chapters.push({
                  title: draft.title,
                  content: `<div style="font-family: Georgia, serif; line-height: 1.8;"><h1>${draft.title}</h1><p>A ${draft.genre} book.</p></div>`
                });
              }
              
              const epubBuffer = await epub(epubOptions, chapters);
              const filename = `${draft.title.replace(/[^a-zA-Z0-9]/g, "_")}.epub`;
              archive.append(epubBuffer, { name: filename });
              manifest[filename] = { id: draft.id, title: draft.title, filename };
            } else {
              const ext = format === "jpg" ? "jpg" : format === "webp" ? "webp" : "png";
              const filename = `cover-${draft.id}.${ext}`;
              
              // Convert format if needed
              if (format === "jpg" || format === "webp") {
                let convertedBuffer: Buffer;
                if (format === "jpg") {
                  convertedBuffer = await sharp(coverPath).jpeg({ quality: 90 }).toBuffer();
                } else {
                  convertedBuffer = await sharp(coverPath).webp({ quality: 90 }).toBuffer();
                }
                archive.append(convertedBuffer, { name: filename });
              } else {
                archive.file(coverPath, { name: filename });
              }
              manifest[filename] = { id: draft.id, title: draft.title, filename };
            }
          }
        } catch (itemError) {
          console.error(`Error processing draft ${draft.id} (${draft.title}):`, itemError);
          errors.push(`${draft.id}: ${draft.title}`);
        }
      }
      
      manifest["_errors"] = errors as any;
      archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
      await archive.finalize();
    } catch (error) {
      console.error("Error creating ZIP:", error);
      res.status(500).json({ error: "Failed to create ZIP" });
    }
  });

  // GET /api/content-studio/download-covers-with-titles-zip - Download all covers with titles as ZIP
  app.get("/api/content-studio/download-covers-with-titles-zip", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const drafts = await db.select().from(draftEbooks);
      const draftsWithCovers = drafts.filter(d => d.coverUrl);
      
      if (draftsWithCovers.length === 0) {
        return res.status(404).json({ error: "No covers found" });
      }
      
      const archive = archiver("zip", { zlib: { level: 9 } });
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="covers-with-titles-${Date.now()}.zip"`);
      
      archive.pipe(res);
      
      let titlesList = `Ebook Covers with Titles\nGenerated: ${new Date().toLocaleString()}\n${"═".repeat(60)}\n\n`;
      
      for (const draft of draftsWithCovers) {
        const coverPath = path.join(process.cwd(), draft.coverUrl!.replace(/^\//, ""));
        if (fs.existsSync(coverPath)) {
          const filename = `cover-${draft.id}.png`;
          archive.file(coverPath, { name: filename });
          titlesList += `File: ${filename}\nID: ${draft.id}\nTitle: ${draft.title}\nGenre: ${draft.genre}\nPrice: ${draft.suggestedPrice || "N/A"}\n${"─".repeat(50)}\n\n`;
        }
      }
      
      archive.append(titlesList, { name: "titles.txt" });
      await archive.finalize();
    } catch (error) {
      console.error("Error creating covers with titles ZIP:", error);
      res.status(500).json({ error: "Failed to create ZIP" });
    }
  });

  // GET /api/content-studio/download-covers-with-content-zip - Download all covers with full content as ZIP
  app.get("/api/content-studio/download-covers-with-content-zip", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const drafts = await db.select().from(draftEbooks);
      const draftsWithCovers = drafts.filter(d => d.coverUrl);
      
      if (draftsWithCovers.length === 0) {
        return res.status(404).json({ error: "No covers found" });
      }
      
      const archive = archiver("zip", { zlib: { level: 9 } });
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="covers-with-content-${Date.now()}.zip"`);
      
      archive.pipe(res);
      
      for (const draft of draftsWithCovers) {
        const coverPath = path.join(process.cwd(), draft.coverUrl!.replace(/^\//, ""));
        if (fs.existsSync(coverPath)) {
          const filename = `cover-${draft.id}.png`;
          archive.file(coverPath, { name: filename });
          
          // Create individual content file for each ebook
          const contentFile = `--- EBOOK ${draft.id} ---\nTitle: ${draft.title}\nGenre: ${draft.genre}\nPrice: ${draft.suggestedPrice || "N/A"}\nCover: ${filename}\n\n${"═".repeat(60)}\nCONTENT:\n${"═".repeat(60)}\n\n${draft.content || "(No content yet)"}\n`;
          archive.append(contentFile, { name: `content-${draft.id}.txt` });
        }
      }
      
      await archive.finalize();
    } catch (error) {
      console.error("Error creating covers with content ZIP:", error);
      res.status(500).json({ error: "Failed to create ZIP" });
    }
  });

  // POST /api/content-studio/upload-covers-zip - Upload covers from ZIP
  app.post("/api/content-studio/upload-covers-zip", uploadZip.single("file"), async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const zipPath = req.file.path;
      const extractDir = path.join(process.cwd(), "uploads", "temp-extract-" + Date.now());
      
      await fs.promises.mkdir(extractDir, { recursive: true });
      
      // Safe extraction with path validation (prevents Zip Slip)
      const directory = await unzipper.Open.file(zipPath);
      for (const entry of directory.files) {
        const entryPath = entry.path;
        if (!isSafePath(extractDir, entryPath)) {
          console.warn(`Skipping unsafe path: ${entryPath}`);
          continue;
        }
        const destPath = path.join(extractDir, entryPath);
        await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
        const content = await entry.buffer();
        await fs.promises.writeFile(destPath, content);
      }
      
      // Check for manifest or parse filenames
      let manifest: Record<string, { id: number }> = {};
      const manifestPath = path.join(extractDir, "manifest.json");
      
      if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      }
      
      // Process cover files
      const files = fs.readdirSync(extractDir);
      let updated = 0;
      
      for (const file of files) {
        if (file === "manifest.json") continue;
        if (!file.endsWith(".png") && !file.endsWith(".jpg") && !file.endsWith(".jpeg")) continue;
        
        let draftId: number | null = null;
        
        // Check manifest first
        if (manifest[file]) {
          draftId = manifest[file].id;
        } else {
          // Parse filename: cover-{id}.png
          const match = file.match(/cover-(\d+)\.(png|jpg|jpeg)/i);
          if (match) {
            draftId = parseInt(match[1]);
          }
        }
        
        if (draftId) {
          const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
          if (draft) {
            const sourcePath = path.join(extractDir, file);
            const destFilename = `ai-cover-${Date.now()}-${draftId}.png`;
            const destPath = path.join(process.cwd(), "uploads", "covers", destFilename);
            
            await fs.promises.copyFile(sourcePath, destPath);
            await db.update(draftEbooks).set({ coverUrl: `/uploads/covers/${destFilename}` }).where(eq(draftEbooks.id, draftId));
            updated++;
          }
        }
      }
      
      // Cleanup
      await fs.promises.rm(extractDir, { recursive: true, force: true });
      await fs.promises.unlink(zipPath);
      
      res.json({ updated, message: `Updated ${updated} covers` });
    } catch (error) {
      console.error("Error uploading covers ZIP:", error);
      res.status(500).json({ error: "Failed to process ZIP" });
    }
  });

  // GET /api/content-studio/download-pdfs-zip - Download selected PDFs as ZIP
  app.get("/api/content-studio/download-pdfs-zip", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const idsParam = req.query.ids as string;
      if (!idsParam) {
        return res.status(400).json({ error: "No IDs provided" });
      }
      
      const ids = idsParam.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
      if (ids.length === 0) {
        return res.status(400).json({ error: "No valid IDs provided" });
      }
      
      const drafts = await db.select().from(draftEbooks).where(inArray(draftEbooks.id, ids));
      const draftsWithPdfs = drafts.filter(d => d.pdfUrl);
      
      if (draftsWithPdfs.length === 0) {
        return res.status(404).json({ error: "No PDFs found for selected drafts" });
      }
      
      const archive = archiver("zip", { zlib: { level: 9 } });
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="ebooks-${Date.now()}.zip"`);
      
      archive.pipe(res);
      
      const manifest: Record<string, { id: number; title: string; filename: string }> = {};
      
      for (const draft of draftsWithPdfs) {
        const pdfPath = path.join(process.cwd(), draft.pdfUrl!.replace(/^\//, ""));
        if (fs.existsSync(pdfPath)) {
          const filename = `ebook-${draft.id}.pdf`;
          archive.file(pdfPath, { name: filename });
          manifest[filename] = { id: draft.id, title: draft.title, filename };
        }
      }
      
      archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
      await archive.finalize();
    } catch (error) {
      console.error("Error creating PDFs ZIP:", error);
      res.status(500).json({ error: "Failed to create ZIP" });
    }
  });

  // POST /api/content-studio/upload-pdfs-zip - Upload PDFs from ZIP
  app.post("/api/content-studio/upload-pdfs-zip", uploadZip.single("file"), async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      const zipPath = req.file.path;
      const extractDir = path.join(process.cwd(), "uploads", "temp-extract-" + Date.now());
      
      await fs.promises.mkdir(extractDir, { recursive: true });
      
      // Safe extraction with path validation (prevents Zip Slip)
      const directory = await unzipper.Open.file(zipPath);
      for (const entry of directory.files) {
        const entryPath = entry.path;
        if (!isSafePath(extractDir, entryPath)) {
          console.warn(`Skipping unsafe path: ${entryPath}`);
          continue;
        }
        const destPath = path.join(extractDir, entryPath);
        await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
        const content = await entry.buffer();
        await fs.promises.writeFile(destPath, content);
      }
      
      let manifest: Record<string, { id: number }> = {};
      const manifestPath = path.join(extractDir, "manifest.json");
      
      if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      }
      
      const files = fs.readdirSync(extractDir);
      let updated = 0;
      
      for (const file of files) {
        if (file === "manifest.json") continue;
        if (!file.endsWith(".pdf")) continue;
        
        let draftId: number | null = null;
        
        if (manifest[file]) {
          draftId = manifest[file].id;
        } else {
          const match = file.match(/ebook-(\d+)\.pdf/i);
          if (match) {
            draftId = parseInt(match[1]);
          }
        }
        
        if (draftId) {
          const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
          if (draft) {
            const sourcePath = path.join(extractDir, file);
            const destFilename = `ebook-${Date.now()}-${draftId}.pdf`;
            const destPath = path.join(process.cwd(), "uploads", "pdfs", destFilename);
            
            await fs.promises.copyFile(sourcePath, destPath);
            await db.update(draftEbooks).set({ pdfUrl: `/uploads/pdfs/${destFilename}` }).where(eq(draftEbooks.id, draftId));
            updated++;
          }
        }
      }
      
      await fs.promises.rm(extractDir, { recursive: true, force: true });
      await fs.promises.unlink(zipPath);
      
      res.json({ updated, message: `Updated ${updated} PDFs` });
    } catch (error) {
      console.error("Error uploading PDFs ZIP:", error);
      res.status(500).json({ error: "Failed to process ZIP" });
    }
  });

  app.post("/api/content-studio/publish-all", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const subscriberExclusive = req.body?.subscriberExclusive === true;
      const result = await contentStudio.bulkPublishReady({ subscriberExclusive });
      res.json({
        publishedCount: result.published,
        failedCount: result.failed,
        skippedCount: result.skipped,
        details: result.details,
        message: `Published ${result.published} ebooks. ${result.failed} failed quality gate and were demoted to draft.`,
      });
    } catch (error) {
      console.error("Error in publish-all:", error);
      res.status(500).json({ error: "Failed to publish all drafts" });
    }
  });

  // DELETE /api/content-studio/drafts-all - Delete all drafts
  app.delete("/api/content-studio/drafts-all", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const allDrafts = await db.select().from(draftEbooks);
      await db.delete(draftEbooks);
      res.json({ deletedCount: allDrafts.length, message: `Deleted ${allDrafts.length} drafts` });
    } catch (error) {
      console.error("Error deleting all drafts:", error);
      res.status(500).json({ error: "Failed to delete all drafts" });
    }
  });

  // POST /api/content-studio/regenerate-cover/:id - Regenerate cover for a single draft
  app.post("/api/content-studio/regenerate-cover/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const coverUrl = await contentStudio.regenerateCover(draftId);
      res.json({ success: true, coverUrl, message: "Cover regenerated successfully" });
    } catch (error) {
      console.error("Error regenerating cover:", error);
      res.status(500).json({ error: "Failed to regenerate cover" });
    }
  });

  // POST /api/content-studio/fix-all-covers - Fix all broken/missing covers
  app.post("/api/content-studio/fix-all-covers", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      res.json({ message: "Cover fix job started. This may take a while..." });
      // Run in background
      contentStudio.regenerateAllBrokenCovers()
        .then(result => console.log(`Cover fix complete: ${result.fixed}/${result.processed} fixed`))
        .catch(err => console.error("Cover fix failed:", err));
    } catch (error) {
      console.error("Error starting cover fix:", error);
      res.status(500).json({ error: "Failed to start cover fix" });
    }
  });

  // POST /api/content-studio/update-cover-text/:id - Update text overlay only (no AI regeneration)
  app.post("/api/content-studio/update-cover-text/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const coverUrl = await contentStudio.updateCoverTextOnly(draftId);
      res.json({ success: true, coverUrl, message: "Cover text updated successfully" });
    } catch (error) {
      console.error("Error updating cover text:", error);
      res.status(500).json({ error: "Failed to update cover text" });
    }
  });

  // POST /api/content-studio/update-all-cover-text - Update text on all covers (no AI regeneration)
  app.post("/api/content-studio/update-all-cover-text", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      res.json({ message: "Cover text update job started. This may take a while..." });
      // Run in background
      contentStudio.updateAllCoverText()
        .then(result => console.log(`Cover text update complete: ${result.updated}/${result.processed} updated, ${result.errors} errors`))
        .catch(err => console.error("Cover text update failed:", err));
    } catch (error) {
      console.error("Error starting cover text update:", error);
      res.status(500).json({ error: "Failed to start cover text update" });
    }
  });

  // GET /api/content-studio/cover-styles - Get all available cover style presets
  app.get("/api/content-studio/cover-styles", (_req, res) => {
    try {
      const styles = contentStudio.getCoverStylePresets();
      const primaryStyle = contentStudio.getPrimaryCoverStyle();
      res.json({ 
        styles, 
        primaryStyleId: primaryStyle.id,
        message: "Cover style presets loaded successfully"
      });
    } catch (error) {
      console.error("Error getting cover styles:", error);
      res.status(500).json({ error: "Failed to get cover styles" });
    }
  });

  // POST /api/content-studio/regenerate-cover-with-style/:id - Regenerate cover with specific style
  app.post("/api/content-studio/regenerate-cover-with-style/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const { styleId } = req.body;
      
      if (!styleId) {
        return res.status(400).json({ error: "styleId is required" });
      }
      
      const style = contentStudio.getCoverStyleById(styleId);
      if (!style) {
        return res.status(400).json({ error: `Style "${styleId}" not found` });
      }
      
      const coverUrl = await contentStudio.regenerateCoverWithStyle(draftId, styleId);
      res.json({ success: true, coverUrl, styleId, message: `Cover regenerated with ${style.name} style` });
    } catch (error) {
      console.error("Error regenerating cover with style:", error);
      res.status(500).json({ error: "Failed to regenerate cover with style" });
    }
  });

  // GET /api/content-studio/font-options - Get available fonts and styles for cover preview
  app.get("/api/content-studio/font-options", (_req, res) => {
    res.json({
      titleFonts: contentStudio.AVAILABLE_TITLE_FONTS,
      authorFonts: contentStudio.AVAILABLE_AUTHOR_FONTS,
      stylePresets: contentStudio.TEXT_STYLE_PRESETS,
      coverStylePresets: contentStudio.getCoverStylePresets(),
      effects: [
        // Professional text effects
        "elegant-glow", "gold-emboss", "sharp-shadow", "subtle-outline",
        "neon-glow", "emboss", "vintage", "bold-shadow",
        // Classic effects
        "outline", "shadow", "glow", "elegant", "neon",
        // Simple
        "none"
      ],
      positions: ["top-center", "center", "bottom-center", "top-left", "top-right", "bottom-left", "bottom-right"],
      titleCases: ["uppercase", "titlecase", "original"]
    });
  });

  // POST /api/content-studio/preview-cover - Generate cover preview with specific options
  app.post("/api/content-studio/preview-cover", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const body = req.body;
      const draftId = body.draftId;
      
      // Support both nested options object and flat fields
      const options = body.options || {
        titleFont: body.titleFont || "Playfair Display",
        authorFont: body.authorFont || "Lora",
        effect: body.effect || "shadow",
        position: body.position || "center",
        titleCase: body.titleCase || "titlecase",
      };
      
      // Get draft info
      const [draft] = await db
        .select()
        .from(draftEbooks)
        .where(eq(draftEbooks.id, draftId));
      
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      
      if (!draft.backgroundUrl) {
        return res.status(400).json({ error: "No background image found - please regenerate the cover first" });
      }
      
      const previewBase64 = await contentStudio.generateCoverPreview(
        draft.backgroundUrl,
        draft.title || "Untitled",
        "EbookGamez",
        options
      );
      
      res.json({ preview: previewBase64 });
    } catch (error) {
      console.error("Error generating cover preview:", error);
      res.status(500).json({ error: "Failed to generate cover preview" });
    }
  });

  // POST /api/content-studio/finalize-cover - Apply final options and save cover
  app.post("/api/content-studio/finalize-cover", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftId, options } = req.body;
      
      const coverUrl = await contentStudio.finalizeCoverWithOptions(draftId, options);
      
      res.json({ success: true, coverUrl, message: "Cover finalized successfully" });
    } catch (error) {
      console.error("Error finalizing cover:", error);
      res.status(500).json({ error: "Failed to finalize cover" });
    }
  });

  // POST /api/content-studio/apply-title-bar/:id - Apply two-tone title bar to existing cover
  app.post("/api/content-studio/apply-title-bar/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);

      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));

      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }

      const coverPath = draft.coverUrl || draft.backgroundUrl;
      if (!coverPath) {
        return res.status(400).json({ error: "No cover image found" });
      }

      const fullPath = path.join(process.cwd(), coverPath.replace(/^\//, ""));
      if (!fs.existsSync(fullPath)) {
        return res.status(400).json({ error: "Cover image file not found on disk" });
      }

      const imageBuffer = fs.readFileSync(fullPath);
      const title = draft.title || draft.topic || "Untitled";

      const resultBuffer = await contentStudio.applyTwoToneTitleBar(imageBuffer, title);

      const coverDir = "uploads/covers";
      const filename = `twotone-${Date.now()}-${draftId}.png`;
      const filepath = path.join(coverDir, filename);
      fs.writeFileSync(filepath, resultBuffer);

      const newCoverUrl = `/${filepath}`;
      await db.update(draftEbooks).set({ coverUrl: newCoverUrl }).where(eq(draftEbooks.id, draftId));

      res.json({ success: true, coverUrl: newCoverUrl, message: "Two-tone title bar applied" });
    } catch (error) {
      console.error("Error applying title bar:", error);
      res.status(500).json({ error: "Failed to apply title bar" });
    }
  });

  // POST /api/content-studio/remove-title/:id - Remove title bar/overlay, revert to clean background
  app.post("/api/content-studio/remove-title/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft) return res.status(404).json({ error: "Draft not found" });

      const coverFile = draft.coverUrl || "";
      const bgFile = draft.backgroundUrl || "";
      const isTitled = (f: string) => f.includes("twotone") || f.includes("ai-cover") || f.includes("ai-overlay");

      const coverIsTitled = isTitled(coverFile);
      const bgIsTitled = isTitled(bgFile);

      if (!coverIsTitled && !bgIsTitled) {
        return res.json({ success: false, message: "This cover doesn't appear to have a removable title" });
      }

      if (coverIsTitled && !bgIsTitled && bgFile) {
        await db.update(draftEbooks).set({ coverUrl: null }).where(eq(draftEbooks.id, draftId));
        return res.json({ success: true, message: "Title removed, reverted to clean background" });
      }

      // Both or only background is titled — try to find the original clean ai-bg file on disk
      const coverDir = path.join(process.cwd(), "uploads/covers");
      let restoredBg: string | null = null;

      if (bgIsTitled) {
        // Extract timestamp from twotone filename to find the original bg generated around the same time or earlier
        const twotoneMatch = bgFile.match(/twotone-(\d+)/);
        const twotoneTimestamp = twotoneMatch ? parseInt(twotoneMatch[1]) : 0;

        // Look for ai-bg files for this draft - check files on disk
        const allFiles = fs.readdirSync(coverDir).filter(f => f.startsWith("ai-bg-") && f.endsWith(".png"));
        
        // Find the most recent ai-bg file created BEFORE the twotone was applied
        let bestMatch: { name: string; timestamp: number } | null = null;
        for (const file of allFiles) {
          const tsMatch = file.match(/(\d{13})/);
          if (tsMatch) {
            const fileTs = parseInt(tsMatch[1]);
            if (twotoneTimestamp === 0 || fileTs <= twotoneTimestamp) {
              if (!bestMatch || fileTs > bestMatch.timestamp) {
                bestMatch = { name: file, timestamp: fileTs };
              }
            }
          }
        }

        // Also check for ebook-{id}-cover.png pattern (original covers)
        const ebookCoverFile = `ebook-${draftId}-cover.png`;
        if (fs.existsSync(path.join(coverDir, ebookCoverFile))) {
          restoredBg = `/uploads/covers/${ebookCoverFile}`;
        }

        // Can't reliably match ai-bg files to specific drafts by timestamp alone
        // since many drafts share timestamps. Just clear the titled URLs.
        if (!restoredBg) {
          await db.update(draftEbooks).set({ coverUrl: null, backgroundUrl: null }).where(eq(draftEbooks.id, draftId));
          return res.json({ success: true, message: "Title bar removed. The original background couldn't be auto-recovered — select this cover and regenerate to get a fresh one." });
        }
      }

      const updates: any = { coverUrl: null };
      if (restoredBg) updates.backgroundUrl = restoredBg;
      await db.update(draftEbooks).set(updates).where(eq(draftEbooks.id, draftId));
      res.json({ success: true, message: restoredBg ? "Title removed and original background restored!" : "Title removed" });
    } catch (error) {
      console.error("Error removing title:", error);
      res.status(500).json({ error: "Failed to remove title" });
    }
  });

  // POST /api/content-studio/remove-title-batch - Remove title bars from multiple covers at once
  app.post("/api/content-studio/remove-title-batch", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIds } = req.body;
      const isTitled = (f: string) => f.includes("twotone") || f.includes("ai-cover") || f.includes("ai-overlay");
      const coverDir = path.join(process.cwd(), "uploads/covers");

      let targetIds: number[] = [];
      if (draftIds && Array.isArray(draftIds) && draftIds.length > 0) {
        targetIds = draftIds;
      } else {
        const allDrafts = await db.select({ id: draftEbooks.id, coverUrl: draftEbooks.coverUrl, backgroundUrl: draftEbooks.backgroundUrl }).from(draftEbooks);
        targetIds = allDrafts.filter(d => isTitled(d.coverUrl || "") || isTitled(d.backgroundUrl || "")).map(d => d.id);
      }

      let restored = 0;
      let cleared = 0;
      let skipped = 0;

      for (const id of targetIds) {
        const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, id));
        if (!draft) { skipped++; continue; }

        const coverIsTitled = isTitled(draft.coverUrl || "");
        const bgIsTitled = isTitled(draft.backgroundUrl || "");

        if (!coverIsTitled && !bgIsTitled) { skipped++; continue; }

        if (coverIsTitled && !bgIsTitled && draft.backgroundUrl) {
          await db.update(draftEbooks).set({ coverUrl: null }).where(eq(draftEbooks.id, id));
          restored++;
          continue;
        }

        // Try to find original ebook-{id}-cover.png
        const ebookCoverFile = `ebook-${id}-cover.png`;
        if (fs.existsSync(path.join(coverDir, ebookCoverFile))) {
          await db.update(draftEbooks).set({ coverUrl: null, backgroundUrl: `/uploads/covers/${ebookCoverFile}` }).where(eq(draftEbooks.id, id));
          restored++;
        } else {
          await db.update(draftEbooks).set({ coverUrl: null, backgroundUrl: null }).where(eq(draftEbooks.id, id));
          cleared++;
        }
      }

      res.json({
        success: true,
        total: targetIds.length,
        restored,
        cleared,
        skipped,
        message: `Processed ${targetIds.length} covers: ${restored} restored to clean background, ${cleared} cleared (need regeneration), ${skipped} skipped`
      });
    } catch (error) {
      console.error("Error in batch remove title:", error);
      res.status(500).json({ error: "Failed to remove title bars" });
    }
  });

  // POST /api/content-studio/ai-title-overlay/:id - Use AI to artistically add title to existing cover
  app.post("/api/content-studio/ai-title-overlay/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const mode = req.body?.mode as "main-only" | "full-shrink" | undefined;
      const titleSizePercent = req.body?.titleSizePercent as number | undefined;
      const customMainTitle = req.body?.customMainTitle as string | undefined;
      const customSubtitle = req.body?.customSubtitle as string | undefined;
      const coverUrl = await contentStudio.aiTitleOverlay(draftId, mode, titleSizePercent, customMainTitle, customSubtitle);
      res.json({ coverUrl });
    } catch (error: any) {
      console.error("Error applying AI title overlay:", error);
      res.status(500).json({ error: error?.message || "Failed to apply AI title overlay" });
    }
  });

  // POST /api/content-studio/ai-title-overlay-batch - Apply AI title overlay to multiple covers
  app.post("/api/content-studio/ai-title-overlay-batch", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIds } = req.body;
      if (!Array.isArray(draftIds) || draftIds.length === 0) {
        return res.status(400).json({ error: "Please provide an array of draft IDs" });
      }

      const results: { id: number; success: boolean; coverUrl?: string; error?: string }[] = [];

      for (const draftId of draftIds) {
        try {
          console.log(`[AI Title Overlay Batch] Processing draft ${draftId} (${results.length + 1}/${draftIds.length})`);
          const coverUrl = await contentStudio.aiTitleOverlay(draftId);
          results.push({ id: draftId, success: true, coverUrl });
        } catch (err: any) {
          console.error(`[AI Title Overlay Batch] Failed for draft ${draftId}:`, err?.message);
          results.push({ id: draftId, success: false, error: err?.message || "Unknown error" });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      res.json({
        results,
        message: `AI Title Overlay applied to ${successCount} cover(s)${errorCount > 0 ? `, ${errorCount} failed` : ""}`
      });
    } catch (error: any) {
      console.error("Error in batch AI title overlay:", error);
      res.status(500).json({ error: error?.message || "Failed to apply batch AI title overlay" });
    }
  });

  // POST /api/content-studio/approve-overlay - Mark selected ebooks as overlay approved
  app.post("/api/content-studio/approve-overlay", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIds } = req.body;
      if (!Array.isArray(draftIds) || draftIds.length === 0) {
        return res.status(400).json({ error: "Please provide an array of draft IDs" });
      }
      let updated = 0;
      for (const draftId of draftIds) {
        await db.update(draftEbooks).set({ overlayApproved: true }).where(eq(draftEbooks.id, draftId));
        updated++;
      }
      res.json({ success: true, updated, message: `${updated} cover(s) marked as overlay approved` });
    } catch (error: any) {
      console.error("Error approving overlays:", error);
      res.status(500).json({ error: error?.message || "Failed to approve overlays" });
    }
  });

  // POST /api/content-studio/unapprove-overlay - Remove overlay approval from selected ebooks
  app.post("/api/content-studio/unapprove-overlay", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIds } = req.body;
      if (!Array.isArray(draftIds) || draftIds.length === 0) {
        return res.status(400).json({ error: "Please provide an array of draft IDs" });
      }
      let updated = 0;
      for (const draftId of draftIds) {
        await db.update(draftEbooks).set({ overlayApproved: false }).where(eq(draftEbooks.id, draftId));
        updated++;
      }
      res.json({ success: true, updated, message: `${updated} cover(s) overlay approval removed` });
    } catch (error: any) {
      console.error("Error unapproving overlays:", error);
      res.status(500).json({ error: error?.message || "Failed to unapprove overlays" });
    }
  });

  // POST /api/content-studio/apply-title-bar-batch - Apply two-tone title bar to multiple covers
  app.post("/api/content-studio/apply-title-bar-batch", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIds } = req.body;
      if (!Array.isArray(draftIds) || draftIds.length === 0) {
        return res.status(400).json({ error: "Please provide an array of draft IDs" });
      }

      const results: { id: number; success: boolean; coverUrl?: string; error?: string }[] = [];

      for (const draftId of draftIds) {
        try {
          const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
          if (!draft) { results.push({ id: draftId, success: false, error: "Not found" }); continue; }

          const coverPath = draft.coverUrl || draft.backgroundUrl;
          if (!coverPath) { results.push({ id: draftId, success: false, error: "No cover image" }); continue; }

          const fullPath = path.join(process.cwd(), coverPath.replace(/^\//, ""));
          if (!fs.existsSync(fullPath)) { results.push({ id: draftId, success: false, error: "File not found" }); continue; }

          const imageBuffer = fs.readFileSync(fullPath);
          const title = draft.title || draft.topic || "Untitled";

          const resultBuffer = await contentStudio.applyTwoToneTitleBar(imageBuffer, title);

          const coverDir = "uploads/covers";
          const filename = `twotone-${Date.now()}-${draftId}.png`;
          const filepath = path.join(coverDir, filename);
          fs.writeFileSync(filepath, resultBuffer);

          const newCoverUrl = `/${filepath}`;
          await db.update(draftEbooks).set({ coverUrl: newCoverUrl }).where(eq(draftEbooks.id, draftId));

          results.push({ id: draftId, success: true, coverUrl: newCoverUrl });
        } catch (err: any) {
          results.push({ id: draftId, success: false, error: err?.message || "Unknown error" });
        }
      }

      const successCount = results.filter(r => r.success).length;
      res.json({ success: true, results, message: `Applied title bar to ${successCount}/${draftIds.length} covers` });
    } catch (error) {
      console.error("Error in batch title bar:", error);
      res.status(500).json({ error: "Failed to apply title bars" });
    }
  });

  // POST /api/content-studio/unfinalize-cover/:id - Remove text from cover, restore to background
  app.post("/api/content-studio/unfinalize-cover/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      
      // Get the draft
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      
      if (!draft.backgroundUrl) {
        return res.status(400).json({ error: "No background image found to restore" });
      }
      
      // Reset coverUrl to backgroundUrl (removes text overlay)
      await db.update(draftEbooks)
        .set({ coverUrl: draft.backgroundUrl })
        .where(eq(draftEbooks.id, draftId));
      
      console.log(`[Unfinalize] Reset cover for draft ${draftId} to background image`);
      
      res.json({ 
        success: true, 
        coverUrl: draft.backgroundUrl,
        message: "Cover unfinalized - text removed, restored to background image" 
      });
    } catch (error) {
      console.error("Error unfinalizing cover:", error);
      res.status(500).json({ error: "Failed to unfinalize cover" });
    }
  });

  // POST /api/content-studio/unfinalize-covers - Batch unfinalize multiple covers
  app.post("/api/content-studio/unfinalize-covers", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIds } = req.body;
      
      if (!draftIds || !Array.isArray(draftIds) || draftIds.length === 0) {
        return res.status(400).json({ error: "No draft IDs provided" });
      }
      
      let successCount = 0;
      let failCount = 0;
      
      for (const draftId of draftIds) {
        try {
          const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
          
          if (draft && draft.backgroundUrl) {
            await db.update(draftEbooks)
              .set({ coverUrl: draft.backgroundUrl })
              .where(eq(draftEbooks.id, draftId));
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
        }
      }
      
      console.log(`[Batch Unfinalize] Success: ${successCount}, Failed: ${failCount}`);
      
      res.json({ 
        success: true, 
        successCount,
        failCount,
        message: `Unfinalized ${successCount} covers, ${failCount} failed` 
      });
    } catch (error) {
      console.error("Error batch unfinalizing covers:", error);
      res.status(500).json({ error: "Failed to batch unfinalize covers" });
    }
  });

  // GET /api/content-studio/drafts-with-backgrounds - Get drafts that have background images (ready for preview)
  app.get("/api/content-studio/drafts-with-backgrounds", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;
      
      const bgSelectFields = {
        id: draftEbooks.id,
        title: draftEbooks.title,
        genre: draftEbooks.genre,
        topic: draftEbooks.topic,
        coverUrl: draftEbooks.coverUrl,
        backgroundUrl: draftEbooks.backgroundUrl,
        status: draftEbooks.status,
        coverStyleId: draftEbooks.coverStyleId,
        overlayApproved: draftEbooks.overlayApproved,
        publishedAt: draftEbooks.publishedAt,
        suggestedPrice: draftEbooks.suggestedPrice,
      };

      // Count total drafts with backgrounds
      const totalResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(draftEbooks)
        .where(isNotNull(draftEbooks.backgroundUrl));
      const total = Number(totalResult[0]?.count || 0);
      
      // Get paginated drafts with backgrounds
      const drafts = await db
        .select(bgSelectFields)
        .from(draftEbooks)
        .where(isNotNull(draftEbooks.backgroundUrl))
        .orderBy(desc(draftEbooks.id))
        .limit(limit)
        .offset(offset);
      
      res.json({
        drafts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error("Error fetching drafts with backgrounds:", error);
      res.status(500).json({ error: "Failed to fetch drafts" });
    }
  });

  // POST /api/content-studio/regenerate-all-covers - Regenerate all covers with new AI backgrounds
  app.post("/api/content-studio/regenerate-all-covers", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      res.json({ message: "Cover regeneration job started. This will regenerate all 142 covers with new AI backgrounds..." });
      
      // Run in background
      contentStudio.regenerateAllCovers()
        .then((result: { processed: number; updated: number; errors: number }) => console.log(`Cover regeneration complete:`, result))
        .catch((err: Error) => console.error("Cover regeneration failed:", err));
    } catch (error) {
      console.error("Error starting cover regeneration:", error);
      res.status(500).json({ error: "Failed to start cover regeneration" });
    }
  });

  // POST /api/content-studio/regenerate-backgrounds - Regenerate ONLY backgrounds (no text) for review
  app.post("/api/content-studio/regenerate-backgrounds", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      res.json({ message: "Background regeneration started. Backgrounds will be generated without text for your review..." });
      
      // Run in background
      contentStudio.regenerateAllBackgroundsOnly()
        .then((result) => console.log(`Background regeneration complete:`, result))
        .catch((err: Error) => console.error("Background regeneration failed:", err));
    } catch (error) {
      console.error("Error starting background regeneration:", error);
      res.status(500).json({ error: "Failed to start background regeneration" });
    }
  });

  // POST /api/content-studio/regenerate-background/:id - Regenerate background for single ebook
  app.post("/api/content-studio/regenerate-background/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const result = await contentStudio.regenerateBackgroundOnly(draftId);
      res.json(result);
    } catch (error) {
      console.error("Error regenerating background:", error);
      res.status(500).json({ error: "Failed to regenerate background" });
    }
  });

  // POST /api/content-studio/batch-finalize-covers - Apply text to all backgrounds with custom options
  app.post("/api/content-studio/batch-finalize-covers", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const options = req.body;
      const result = await contentStudio.batchFinalizeCoverWithOptions(options);
      res.json(result);
    } catch (error) {
      console.error("Error batch finalizing covers:", error);
      res.status(500).json({ error: "Failed to batch finalize covers" });
    }
  });

  // POST /api/content-studio/full-ai-auto - Full AI automation for a single draft
  app.post("/api/content-studio/full-ai-auto/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const result = await contentStudio.generateFullAIAuto(draftId);
      res.json(result);
    } catch (error: any) {
      console.error("Error in Full AI Auto:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to generate" });
    }
  });

  // POST /api/content-studio/bulk-full-ai-auto - Bulk Full AI Auto for multiple drafts
  app.post("/api/content-studio/bulk-full-ai-auto", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIds } = req.body;
      if (!Array.isArray(draftIds) || draftIds.length === 0) {
        return res.status(400).json({ error: "draftIds array required" });
      }
      
      // Return immediately and process in background
      res.json({ 
        message: `Starting Full AI Auto for ${draftIds.length} drafts...`,
        draftIds,
        startedAt: new Date().toISOString()
      });
      
      // Process in background
      contentStudio.bulkFullAIAuto(draftIds)
        .then((result) => console.log(`Bulk Full AI Auto complete:`, result))
        .catch((err: Error) => console.error("Bulk Full AI Auto failed:", err));
    } catch (error: any) {
      console.error("Error starting Bulk Full AI Auto:", error);
      res.status(500).json({ error: error?.message || "Failed to start Bulk Full AI Auto" });
    }
  });

  // GET /api/content-studio/ready-for-review - Get all ebooks for cover review
  // Returns all ebooks (both unpublished and published) so covers can be updated
  app.get("/api/content-studio/ready-for-review", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const filter = req.query.filter as string | undefined;
      const selectFields = {
        id: draftEbooks.id,
        title: draftEbooks.title,
        genre: draftEbooks.genre,
        topic: draftEbooks.topic,
        coverUrl: draftEbooks.coverUrl,
        backgroundUrl: draftEbooks.backgroundUrl,
        status: draftEbooks.status,
        coverStyleId: draftEbooks.coverStyleId,
        overlayApproved: draftEbooks.overlayApproved,
        publishedAt: draftEbooks.publishedAt,
      };
      let drafts;
      if (filter === "unpublished") {
        drafts = await db.select(selectFields).from(draftEbooks)
          .where(isNull(draftEbooks.publishedAt))
          .orderBy(desc(draftEbooks.id));
      } else if (filter === "published") {
        drafts = await db.select(selectFields).from(draftEbooks)
          .where(isNotNull(draftEbooks.publishedAt))
          .orderBy(desc(draftEbooks.id));
      } else {
        drafts = await db.select(selectFields).from(draftEbooks)
          .orderBy(desc(draftEbooks.id));
      }
      const { resolveDisplayCoverUrl } = await import("./coverStorage");
      const catalogIndex = await contentStudio.loadCatalogBookLinkIndex();
      const enriched = drafts.map((draft) => {
        const catalogBook = contentStudio.findCatalogBookLinkForDraft(draft.id, draft.title, catalogIndex);
        const resolvedCoverUrl = resolveDisplayCoverUrl(
          draft.coverUrl,
          catalogBook?.coverUrl,
          draft.backgroundUrl,
        );
        return {
          ...draft,
          coverUrl: resolvedCoverUrl,
          inCatalog: catalogBook != null,
          publishedBookId: catalogBook?.id ?? null,
        };
      });
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching drafts for review:", error);
      res.status(500).json({ error: "Failed to fetch drafts" });
    }
  });

  // POST /api/content-studio/sync-cover-to-published/:id - Push updated cover from draft to published book
  app.post("/api/content-studio/sync-cover-to-published/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      if (!draft.publishedAt) {
        return res.status(400).json({ error: "This ebook is not published yet" });
      }
      const coverUrl = draft.coverUrl || draft.backgroundUrl || "";
      if (!coverUrl) {
        return res.status(400).json({ error: "No cover image available to sync" });
      }
      const matchingBooks = await db.select().from(books)
        .where(sql`LOWER(${books.title}) = LOWER(${draft.title})`);
      if (matchingBooks.length === 0) {
        return res.status(404).json({ error: "No published book found matching this draft title" });
      }
      let updatedCount = 0;
      for (const book of matchingBooks) {
        await db.update(books)
          .set({ coverUrl, sourceDraftId: draftId, visible: true })
          .where(eq(books.id, book.id));
        updatedCount++;
      }
      console.log(`[Sync Cover] Updated ${updatedCount} published book(s) for draft ${draftId} "${draft.title}" with cover: ${coverUrl}`);
      res.json({ success: true, updatedCount, coverUrl });
    } catch (error) {
      console.error("Error syncing cover to published:", error);
      res.status(500).json({ error: "Failed to sync cover" });
    }
  });

  // Track regeneration status for user notification
  let regenerationStatus: { 
    running: boolean; 
    lastError?: string; 
    lastResult?: { total: number; generated: number; errors: number };
    startedAt?: string;
    progress?: string;
    errorDetails?: string[];
  } = { running: false };

  // POST /api/content-studio/regenerate-selected-backgrounds - Regenerate backgrounds for selected ebooks with style option
  app.post("/api/content-studio/regenerate-selected-backgrounds", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      console.log("=== REGENERATION REQUEST RECEIVED ===");
      console.log("Request body:", JSON.stringify(req.body));
      
      const { draftIds, useOriginalStyle, modelStyleId, modelStyleIds, titleEmbedSync } = req.body;
      if (!draftIds || !Array.isArray(draftIds) || draftIds.length === 0) {
        console.log("ERROR: No draft IDs provided");
        return res.status(400).json({ error: "No draft IDs provided" });
      }

      if (regenerationStatus.running) {
        console.log("ERROR: Regeneration already in progress");
        return res.status(409).json({
          error: "Cover regeneration is already running. Wait for it to finish before starting another batch.",
          progress: regenerationStatus.progress,
        });
      }
      
      const poolFromBody = Array.isArray(modelStyleIds)
        ? modelStyleIds.filter((id: string) => id && id !== "full-ai-auto")
        : [];
      let finalStyleSelection: string | string[];
      if (poolFromBody.length > 1) {
        finalStyleSelection = poolFromBody;
      } else if (poolFromBody.length === 1) {
        finalStyleSelection = poolFromBody[0];
      } else if (modelStyleId) {
        finalStyleSelection = modelStyleId;
      } else if (useOriginalStyle === true) {
        finalStyleSelection = "replit-cinematic";
      } else if (useOriginalStyle === false) {
        finalStyleSelection = "dalle3-vivid";
      } else {
        console.log("ERROR: No cover style selected");
        return res.status(400).json({
          error: "No cover style selected. Check at least one AI style in Cover Review before regenerating.",
        });
      }

      const styleNames: Record<string, string> = {
        "replit-cinematic": "Replit Cinematic (gpt-image-1)",
        "dalle3-vivid": "DALL-E 3 Vivid",
        "cinematic-openai": "Cinematic via OpenAI (DALL-E 3)"
      };
      const styleLabel = Array.isArray(finalStyleSelection)
        ? `AI smart pick from ${finalStyleSelection.length} styles (${finalStyleSelection.join(", ")})`
        : (styleNames[finalStyleSelection] || finalStyleSelection);
      console.log(`Model style: ${styleLabel}`);
      
      regenerationStatus = { running: true, startedAt: new Date().toISOString(), progress: `0/${draftIds.length}`, errorDetails: [] };
      
      const onProgress = (current: number, total: number, draftTitle: string, success: boolean, errorMsg?: string) => {
        regenerationStatus.progress = `${current}/${total} — ${success ? '✓' : '✗'} ${draftTitle}`;
        if (!success && errorMsg) {
          if (!regenerationStatus.errorDetails) regenerationStatus.errorDetails = [];
          regenerationStatus.errorDetails.push(`${draftTitle}: ${errorMsg.substring(0, 100)}`);
        }
      };
      
      contentStudio.regenerateSelectedBackgrounds(draftIds, finalStyleSelection as any, titleEmbedSync === true, onProgress)
        .then(result => {
          console.log("Batch regeneration complete:", result);
          regenerationStatus = { 
            running: false, 
            lastResult: { total: result.total, generated: result.generated, errors: result.errors },
            lastError: result.lastError,
            errorDetails: regenerationStatus.errorDetails
          };
        })
        .catch(err => {
          const errorMessage = err?.message || String(err);
          console.error("Batch regeneration error:", errorMessage);
          regenerationStatus = { running: false, lastError: errorMessage, errorDetails: regenerationStatus.errorDetails };
        });
      
      res.json({ 
        message: `Starting regeneration of ${draftIds.length} covers with ${styleLabel}`,
        total: draftIds.length 
      });
    } catch (error) {
      console.error("Error starting selected regeneration:", error);
      res.status(500).json({ error: "Failed to start regeneration" });
    }
  });

  // GET /api/content-studio/regeneration-status - Check status of background regeneration
  app.get("/api/content-studio/regeneration-status", (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    res.json(regenerationStatus);
  });

  // POST /api/content-studio/stop-regeneration - Stop any running regeneration
  app.post("/api/content-studio/stop-regeneration", (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    regenerationStatus = { running: false, lastError: "Stopped by user" };
    res.json({ success: true, message: "Regeneration stopped" });
  });

  app.post("/api/content-studio/generate-content/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      const forceRewrite = req.body?.rewrite === true;
      contentStudio.bumpStopEpoch();
      contentStudio.stopContentGeneration();
      if (forceRewrite) {
        console.log(`[Content Gen] FORCE REWRITE requested for draft ${draftId} — clearing content and outline`);
        await db.update(draftEbooks).set({ content: null, outline: null, status: "draft" }).where(eq(draftEbooks.id, draftId));
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
      res.json({ success: true, message: "Content generation started in background..." });
      contentStudio.generateContentForDraft(draftId).catch(err => {
        console.error(`[Content Gen] Background error for draft ${draftId}:`, err);
      });
    } catch (error) {
      console.error("Error generating content:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate content" });
    }
  });

  app.get("/api/content-studio/drafts/:id/sections", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      const [draft] = await db.select({ content: draftEbooks.content }).from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft || !draft.content) return res.json({ sections: [] });
      const sections = contentStudio.parseSectionsFromContent(draft.content).map(s => ({
        type: s.type,
        number: s.number,
        title: s.title,
        wordCount: s.content.split(/\s+/).length,
      }));
      res.json({ sections });
    } catch (error) {
      res.status(500).json({ error: "Failed to parse sections" });
    }
  });

  app.post("/api/content-studio/rewrite-section/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const { sectionNumber } = req.body;
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      if (sectionNumber === undefined || sectionNumber === null || typeof sectionNumber !== "number" || !Number.isInteger(sectionNumber)) return res.status(400).json({ error: "sectionNumber must be an integer" });
      
      res.json({ success: true, message: `Rewriting section ${sectionNumber} in background...` });
      
      contentStudio.rewriteSection(draftId, sectionNumber).then(result => {
        console.log(`[Section Rewrite] Complete for draft ${draftId} section ${sectionNumber}: ${result.wordCount} words`);
      }).catch(err => {
        console.error(`[Section Rewrite] Error for draft ${draftId} section ${sectionNumber}:`, err?.message || err);
      });
    } catch (error) {
      console.error("Error starting section rewrite:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start section rewrite" });
    }
  });

  app.post("/api/content-studio/rewrite-chapters-batch/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const { chapters } = req.body;
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      if (!Array.isArray(chapters) || chapters.length === 0) return res.status(400).json({ error: "chapters array is required" });
      res.json({ success: true, message: `Batch rewriting chapters [${chapters.join(", ")}] in background...` });
      contentStudio.rewriteChapterBatch(draftId, chapters).catch(err => {
        console.error(`[Batch Rewrite] Error for draft ${draftId}:`, err);
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to start batch rewrite" });
    }
  });

  app.post("/api/content-studio/auto-repair-chapters", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIds } = req.body;
      if (!Array.isArray(draftIds) || draftIds.length === 0) return res.status(400).json({ error: "draftIds array is required" });
      res.json({ success: true, message: `Auto-repair started for ${draftIds.length} books (running in background)` });

      (async () => {
        for (const draftId of draftIds) {
          try {
            console.log(`[Auto-Repair] Processing draft ${draftId}...`);
            await contentStudio.repairIncompleteChapters(draftId);
            console.log(`[Auto-Repair] Completed draft ${draftId}`);
          } catch (err: any) {
            console.error(`[Auto-Repair] Error for draft ${draftId}:`, err?.message || err);
          }
        }
        console.log(`[Auto-Repair] All ${draftIds.length} books processed`);
      })();
    } catch (error) {
      res.status(500).json({ error: "Failed to start auto-repair" });
    }
  });

  app.post("/api/content-studio/add-illustration-markers/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      res.json({ success: true, message: `Adding illustration markers to all chapters in background...` });
      contentStudio.addIllustrationMarkersBatch(draftId).catch(err => {
        console.error(`[Add Markers] Error for draft ${draftId}:`, err);
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to start adding markers" });
    }
  });

  app.get("/api/content-studio/scan-completeness", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const idsParam = req.query.ids as string | undefined;
      const draftIds = idsParam ? idsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : undefined;
      const results = await contentStudio.scanContentCompleteness(draftIds);
      res.json({ total_scanned: draftIds?.length || "all", issues_found: results.length, results });
    } catch (error) {
      console.error("Error scanning content completeness:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Scan failed" });
    }
  });

  app.post("/api/content-studio/deduplicate-chapters", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No ebook IDs provided" });
      }
      const results = await contentStudio.deduplicateChapters(ids);
      res.json({ success: true, processed: results.length, results });
    } catch (error) {
      console.error("Error deduplicating chapters:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Deduplication failed" });
    }
  });

  app.post("/api/content-studio/sweep-ready", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      res.json({ success: true, message: "Final sweep started — checking all ready books for structural + dialogue quality..." });
      contentStudio.sweepReadyBooks().then(result => {
        console.log(`[Final Sweep API] Complete: ${result.passed} passed, ${result.failed} failed out of ${result.total}`);
      }).catch(err => {
        console.error("[Final Sweep API] Error:", err);
      });
    } catch (error) {
      console.error("Error starting sweep:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Sweep failed" });
    }
  });

  app.post("/api/content-studio/bulk-publish-ready", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const result = await contentStudio.bulkPublishReady();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error bulk publishing:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Bulk publish failed" });
    }
  });

  app.post("/api/content-studio/verify-genre/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft) return res.status(404).json({ error: "Draft not found" });
      const result = await contentStudio.verifyGenreContent(
        draft.content || "",
        draft.title || draft.topic || "Untitled",
        draft.genre || "General",
        draft.outline || undefined
      );
      res.json({ success: true, draftId, genre: draft.genre, title: draft.title, ...result });
    } catch (error) {
      console.error("Error verifying genre:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Genre verification failed" });
    }
  });

  app.post("/api/content-studio/audit-published", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const result = await contentStudio.auditPublishedBooks();
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error auditing published books:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Audit failed" });
    }
  });

  // POST /api/content-studio/anti-ai-pass/:id - Admin-triggered anti-AI-tells rewrite pass
  app.post("/api/content-studio/anti-ai-pass/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft || !draft.content) return res.status(404).json({ error: "Draft not found or has no content" });
      const { fixedContent, changesCount, patterns } = await contentStudio.runAntiAITellsPass(
        draft.content, draft.title || "Untitled", draft.genre || "General"
      );
      if (changesCount > 0) {
        await db.update(draftEbooks).set({ content: fixedContent }).where(eq(draftEbooks.id, draftId));
      }
      res.json({ success: true, changesCount, patterns, message: changesCount > 0 ? `Rewrote ${changesCount} paragraphs, removing: ${patterns.join(", ")}` : "No AI-tell patterns found — prose already sounds natural." });
    } catch (error) {
      console.error("Anti-AI pass error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Anti-AI pass failed" });
    }
  });

  // ================================================================
  // BULK QUALITY SCAN + CHAPTER REPAIR ENDPOINTS
  // ================================================================

  const AI_TELL_PATTERNS_SCAN = [
    'In conclusion', 'Furthermore', 'Moreover', 'Additionally',
    'It is worth noting', 'It is important to note',
    'Delve into', 'Delve deeper', 'Tapestry', "In today's world",
    'Unleash', 'Empower', 'Navigate the complex', 'Crucially',
    'In summary', 'To summarize', 'In essence', 'Undeniably',
    'Multifaceted', 'Nuanced', 'Leverage', 'Synergy',
    'Paradigm shift', 'At the end of the day', 'Game-changer',
    'Cutting-edge', 'Seamlessly', 'Robust solution', 'Nestled',
    'Shedding light', 'Unpack', 'Groundbreaking', 'Remarkable',
  ];

  function scanTextMetrics(text: string) {
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    if (wordCount < 10) return null;
    const passive = (text.match(/\b(was|were|been|being)\s+\w+ed\b/gi) || []).length;
    const adverbs = (text.match(/\b\w{4,}ly\b/gi) || []).length;
    const aiTellCount = AI_TELL_PATTERNS_SCAN.reduce((n, t) =>
      n + (text.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length, 0);
    const lines = text.split('\n').filter(l => l.trim());
    const dialogueLines = lines.filter(l => {
      const t = l.trim();
      return t.startsWith('"') || t.startsWith('\u201c') || t.startsWith('\u2018');
    });
    const dialoguePct = lines.length ? Math.round(dialogueLines.length / lines.length * 100) : 0;
    const passivePct = Math.round(passive / wordCount * 1000) / 10;
    const adverbPct = Math.round(adverbs / wordCount * 1000) / 10;
    let score = 10;
    const issues: string[] = [];
    if (passivePct > 5) { score -= 2.5; issues.push(`High passive voice (${passivePct}%)`); }
    else if (passivePct > 3) { score -= 1; issues.push(`Elevated passive voice (${passivePct}%)`); }
    if (adverbPct > 2.5) { score -= 2; issues.push(`Adverb overuse (${adverbPct}%)`); }
    else if (adverbPct > 1.5) { score -= 0.8; issues.push(`Elevated adverbs (${adverbPct}%)`); }
    if (aiTellCount > 8) { score -= 3; issues.push(`Many AI-tell phrases (${aiTellCount})`); }
    else if (aiTellCount > 3) { score -= 1.5; issues.push(`AI-tell phrases (${aiTellCount})`); }
    else if (aiTellCount > 0) { score -= 0.5; }
    if (wordCount < 600) { score -= 1; issues.push(`Short chapter (${wordCount} words)`); }
    score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));
    const status = score >= 8 ? 'excellent' : score >= 6 ? 'good' : score >= 4 ? 'needs-work' : 'critical';
    return { wordCount, passivePct, adverbPct, aiTellCount, dialoguePct, score, issues, status };
  }

  function splitIntoChapters(content: string): Array<{num: number, title: string, text: string, startIdx: number, endIdx: number}> {
    const chapterPattern = /(?:^|\n)((?:#{1,3}\s+)?(?:Chapter|CHAPTER)\s+(?:\d+|[IVXivx]+)[^\n]*)/g;
    const matches = [...content.matchAll(chapterPattern)];
    if (matches.length === 0) {
      return [{ num: 1, title: 'Full Content', text: content, startIdx: 0, endIdx: content.length }];
    }
    const chapters: Array<{num: number, title: string, text: string, startIdx: number, endIdx: number}> = [];
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const nextMatch = matches[i + 1];
      const headingText = match[1];
      const headingPos = (match.index ?? 0) + match[0].indexOf(headingText);
      const endPos = nextMatch
        ? (nextMatch.index ?? content.length) + nextMatch[0].indexOf(nextMatch[1])
        : content.length;
      const chapterText = content.slice(headingPos, endPos).trim();
      const title = headingText.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
      chapters.push({ num: i + 1, title, text: chapterText, startIdx: headingPos, endIdx: endPos });
    }
    return chapters;
  }

  // GET /api/admin/bulk-quality-scan
  app.get("/api/admin/bulk-quality-scan", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 60, 200);
      const drafts = await db.select({
        id: draftEbooks.id,
        title: draftEbooks.title,
        genre: draftEbooks.genre,
        content: draftEbooks.content,
      }).from(draftEbooks)
        .where(eq(draftEbooks.status, 'published'))
        .orderBy(desc(draftEbooks.id))
        .limit(limit);

      const results = drafts
        .filter(d => d.content && d.content.length > 1000)
        .map(d => {
          const metrics = scanTextMetrics(d.content!);
          if (!metrics) return null;
          return { draftId: d.id, title: d.title, genre: d.genre, ...metrics };
        })
        .filter(Boolean)
        .sort((a, b) => (a!.score - b!.score));

      res.json({ results, total: results.length, scannedAt: new Date().toISOString() });
    } catch (error) {
      console.error("Bulk quality scan error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Scan failed" });
    }
  });

  // GET /api/admin/chapter-quality/:draftId
  app.get("/api/admin/chapter-quality/:draftId", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.draftId);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft || !draft.content) return res.status(404).json({ error: "Draft not found" });
      const chapters = splitIntoChapters(draft.content);
      const chapterResults = chapters.map(ch => {
        const m = scanTextMetrics(ch.text);
        if (!m) return { num: ch.num, title: ch.title, wordCount: 0, passivePct: 0, adverbPct: 0, aiTellCount: 0, dialoguePct: 0, score: 10, issues: [], status: 'excellent' };
        return { num: ch.num, title: ch.title, ...m };
      });
      res.json({ draftId, title: draft.title, genre: draft.genre, chapters: chapterResults });
    } catch (error) {
      console.error("Chapter quality scan error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Scan failed" });
    }
  });

  // POST /api/admin/repair-preview/:draftId/:chapterNum
  app.post("/api/admin/repair-preview/:draftId/:chapterNum", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.draftId);
      const chapterNum = parseInt(req.params.chapterNum);
      if (isNaN(draftId) || isNaN(chapterNum)) return res.status(400).json({ error: "Invalid params" });
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft || !draft.content) return res.status(404).json({ error: "Draft not found" });
      const chapters = splitIntoChapters(draft.content);
      const chapter = chapters.find(c => c.num === chapterNum);
      if (!chapter) return res.status(404).json({ error: "Chapter not found" });

      const paragraphs = chapter.text.split('\n\n').filter(p => p.trim().length > 80 && !p.trim().startsWith('#'));
      const scoredParas = paragraphs.map(p => {
        const passive = (p.match(/\b(was|were|been|being)\s+\w+ed\b/gi) || []).length;
        const aiTells = AI_TELL_PATTERNS_SCAN.reduce((n, t) =>
          n + (p.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length, 0);
        return { text: p, badScore: passive * 2 + aiTells * 3 };
      });
      const worstParas = [...scoredParas].sort((a, b) => b.badScore - a.badScore).slice(0, 3).filter(p => p.badScore > 0);

      if (worstParas.length === 0) {
        return res.json({ message: "This chapter looks clean — no major issues found.", previews: [], chapterTitle: chapter.title });
      }

      const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const previews = await Promise.all(worstParas.map(async para => {
        const completion = await openaiClient.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: `You are a literary editor polishing published ${draft.genre || 'fiction'} prose. Rewrite the paragraph to sound natural and vivid — like a skilled human author, not an AI. Remove AI-tell phrases (Furthermore, Moreover, Delve, Tapestry, Empower, Leverage, Seamlessly, etc.) and weaken passive constructions into active voice where it strengthens the writing. Preserve the same plot points, character actions, and approximate length. Return ONLY the rewritten paragraph, no commentary or preamble.` },
            { role: "user", content: para.text }
          ],
          temperature: 0.75,
          max_tokens: 700,
        });
        return { original: para.text, rewritten: completion.choices[0]?.message?.content?.trim() || para.text };
      }));

      res.json({ chapterNum, chapterTitle: chapter.title, previews });
    } catch (error) {
      console.error("Repair preview error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Preview failed" });
    }
  });

  // POST /api/admin/apply-chapter-repair/:draftId/:chapterNum
  app.post("/api/admin/apply-chapter-repair/:draftId/:chapterNum", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.draftId);
      const chapterNum = parseInt(req.params.chapterNum);
      if (isNaN(draftId) || isNaN(chapterNum)) return res.status(400).json({ error: "Invalid params" });
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft || !draft.content) return res.status(404).json({ error: "Draft not found" });
      const chapters = splitIntoChapters(draft.content);
      const chapter = chapters.find(c => c.num === chapterNum);
      if (!chapter) return res.status(404).json({ error: "Chapter not found" });

      const { fixedContent: fixedChapter, changesCount, patterns } = await contentStudio.runAntiAITellsPass(
        chapter.text, draft.title || "Untitled", draft.genre || "General"
      );
      if (changesCount === 0) {
        return res.json({ success: true, changesCount: 0, message: "Chapter already looks clean — nothing changed." });
      }
      const newContent = draft.content.slice(0, chapter.startIdx) + fixedChapter + draft.content.slice(chapter.endIdx);
      await db.update(draftEbooks).set({ content: newContent }).where(eq(draftEbooks.id, draftId));
      res.json({ success: true, changesCount, patterns, message: `Chapter repaired: ${changesCount} paragraphs polished` });
    } catch (error) {
      console.error("Chapter repair error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Repair failed" });
    }
  });

  // ================================================================
  // END BULK QUALITY SCAN
  // ================================================================

  // GET /api/content-studio/pro-writing-metrics/:id - On-demand ProWritingAid-style analysis
  app.get("/api/content-studio/pro-writing-metrics/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft || !draft.content) return res.status(404).json({ error: "Draft not found or has no content" });
      // Return cached metrics from outline field if available
      if (draft.outline) {
        const cached = draft.outline.match(/<!-- ProWritingMetrics: ({.*?}) -->/s);
        if (cached) {
          try { return res.json({ ...JSON.parse(cached[1]), cached: true }); } catch {}
        }
      }
      // Otherwise run fresh
      const metrics = await contentStudio.runProWritingMetrics(draft.content, draft.title || "Untitled", draft.genre || "General");
      res.json({ ...metrics, cached: false });
    } catch (error) {
      console.error("Pro-writing metrics error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Metrics failed" });
    }
  });

  app.post("/api/content-studio/check-dialogue/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft || !draft.content) return res.status(404).json({ error: "Draft not found or has no content" });
      const result = await contentStudio.checkDialogueQuality(draft.content, draft.title || "Untitled", draft.genre || "General", draft.outline || undefined);
      res.json({ id: draftId, title: draft.title, ...result });
    } catch (error) {
      console.error("Error checking dialogue:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Dialogue check failed" });
    }
  });

  app.get("/api/content-studio/scan-climax", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const CLASSIC_DRAFT_IDS = Array.from({ length: 25 }, (_, i) => 581 + i);
      const drafts = await db.select().from(draftEbooks);
      const fictionGenres = ["fantasy", "science fiction", "horror", "romance", "mystery", "thriller",
        "historical fiction", "adventure", "dystopian", "fiction", "sci-fi", "supernatural",
        "young adult fiction", "children's fiction", "literary fiction", "short stories"];
      const fictionDrafts = drafts.filter(d => {
        if (CLASSIC_DRAFT_IDS.includes(d.id)) return false;
        if (!d.content || d.content.trim().length < 1000) return false;
        const g = (d.genre || "").toLowerCase();
        return fictionGenres.some(fg => g.includes(fg)) ||
          g.includes("fiction") || g.includes("novel") || g.includes("story");
      });

      res.json({ message: `Scanning ${fictionDrafts.length} fiction books for climax. Check logs for progress.`, total: fictionDrafts.length });

      const results: any[] = [];
      for (const draft of fictionDrafts) {
        try {
          const result = await contentStudio.checkClimaxPresence(
            draft.content!, draft.title || "Untitled", draft.genre || "Fiction"
          );
          results.push({ id: draft.id, title: draft.title, genre: draft.genre, ...result });
          console.log(`[Climax Scan] ${results.length}/${fictionDrafts.length} — "${draft.title}" — score: ${result.score}/10, hasClimax: ${result.hasClimax}`);
        } catch (err: any) {
          results.push({ id: draft.id, title: draft.title, genre: draft.genre, hasClimax: false, score: 0, analysis: `Error: ${err.message}` });
        }
      }

      const noClimax = results.filter(r => !r.hasClimax);
      const weakClimax = results.filter(r => r.hasClimax && r.score < 6);
      console.log(`\n[Climax Scan] === COMPLETE ===`);
      console.log(`[Climax Scan] Total fiction books: ${results.length}`);
      console.log(`[Climax Scan] Strong climax (6+): ${results.filter(r => r.hasClimax && r.score >= 6).length}`);
      console.log(`[Climax Scan] Weak climax (<6): ${weakClimax.length}`);
      console.log(`[Climax Scan] No climax: ${noClimax.length}`);
      if (noClimax.length > 0) {
        console.log(`[Climax Scan] Books missing climax:`);
        noClimax.forEach(r => console.log(`  - [${r.id}] "${r.title}" (${r.genre}) — ${r.analysis}`));
      }
      if (weakClimax.length > 0) {
        console.log(`[Climax Scan] Books with weak climax:`);
        weakClimax.forEach(r => console.log(`  - [${r.id}] "${r.title}" (${r.genre}) — score: ${r.score}/10 — ${r.analysis}`));
      }
    } catch (error) {
      console.error("Error scanning climax:", error);
    }
  });

  app.get("/api/content-studio/climax-results", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const CLASSIC_DRAFT_IDS = Array.from({ length: 25 }, (_, i) => 581 + i);
      const drafts = await db.select().from(draftEbooks);
      const fictionGenres = ["fantasy", "science fiction", "horror", "romance", "mystery", "thriller",
        "historical fiction", "adventure", "dystopian", "fiction", "sci-fi", "supernatural",
        "young adult fiction", "children's fiction", "literary fiction", "short stories"];
      const fictionDrafts = drafts.filter(d => {
        if (CLASSIC_DRAFT_IDS.includes(d.id)) return false;
        if (!d.content || d.content.trim().length < 1000) return false;
        const g = (d.genre || "").toLowerCase();
        return fictionGenres.some(fg => g.includes(fg)) ||
          g.includes("fiction") || g.includes("novel") || g.includes("story");
      });
      res.json({ fictionBookCount: fictionDrafts.length, books: fictionDrafts.map(d => ({ id: d.id, title: d.title, genre: d.genre })) });
    } catch (error) {
      res.status(500).json({ error: "Failed to list fiction books" });
    }
  });

  app.post("/api/content-studio/continue-writing/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      res.json({ success: true, message: "Continue writing started in background..." });
      contentStudio.continueWritingForDraft(draftId).catch(err => {
        console.error(`[Continue Writing] Background error for draft ${draftId}:`, err);
      });
    } catch (error) {
      console.error("Error continuing writing:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to continue writing" });
    }
  });

  app.post("/api/content-studio/generate-missing-content", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      await contentStudio.generateMissingContent();
      res.json({ success: true, message: "Content generation started for all ebooks missing content" });
    } catch (error) {
      console.error("Error starting missing content generation:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start content generation" });
    }
  });

  app.get("/api/content-studio/content-gen-status", (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    res.json(contentStudio.getContentGenProgress());
  });

  app.post("/api/content-studio/stop-content-gen", (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    contentStudio.stopContentGeneration();
    res.json({ success: true, message: "Content generation stopped" });
  });

  app.post("/api/content-studio/append-chapter/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      res.json({ success: true, message: "Generating concluding chapter..." });
      contentStudio.appendConcludingChapter(draftId).catch(err => {
        console.error(`Error appending chapter for draft ${draftId}:`, err);
      });
    } catch (error) {
      console.error("Error starting chapter append:", error);
      res.status(500).json({ error: "Failed to start chapter generation" });
    }
  });

  app.post("/api/content-studio/reset-stuck/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) return res.status(400).json({ error: "Invalid draft ID" });
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      if (!draft) return res.status(404).json({ error: "Draft not found" });
      if (draft.status !== "generating") return res.status(400).json({ error: "Draft is not stuck in generating" });
      await db.update(draftEbooks).set({ status: "draft" }).where(eq(draftEbooks.id, draftId));
      res.json({ success: true, message: "Draft reset to draft status" });
    } catch (error) {
      console.error("Error resetting stuck draft:", error);
      res.status(500).json({ error: "Failed to reset draft" });
    }
  });

  app.post("/api/content-studio/generate-selected-content", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No ebook IDs provided" });
      }
      await contentStudio.generateContentForSelected(ids);
      res.json({ success: true, message: `Content generation started for ${ids.length} selected ebooks` });
    } catch (error) {
      console.error("Error starting selected content generation:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start content generation" });
    }
  });

  app.get("/api/content-studio/importable-books", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const catalogBooks = await db.select().from(books);
      const drafts = await db.select({ title: draftEbooks.title, topic: draftEbooks.topic }).from(draftEbooks);
      const draftTitles = new Set(drafts.map(d => d.title?.toLowerCase().replace(/[^a-z0-9]/g, '')));
      const importedSourceIds = new Set(
        drafts.filter(d => d.topic?.startsWith('imported-from-catalog:')).map(d => parseInt(d.topic!.split(':')[1]))
      );

      const importable = catalogBooks.filter(book => {
        if (importedSourceIds.has(book.id)) return false;
        const normalizedTitle = book.title?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
        return !draftTitles.has(normalizedTitle);
      });

      res.json(importable);
    } catch (error) {
      console.error("Error fetching importable books:", error);
      res.status(500).json({ error: "Failed to fetch importable books" });
    }
  });

  app.post("/api/content-studio/import-book/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const bookId = parseInt(req.params.id);
      if (isNaN(bookId)) return res.status(400).json({ error: "Invalid book ID" });

      const [book] = await db.select().from(books).where(eq(books.id, bookId));
      if (!book) return res.status(404).json({ error: "Book not found" });

      const cleanTitle = book.title?.replace(/^\*+|\*+$/g, '').trim() || 'Untitled';

      const [newDraft] = await db.insert(draftEbooks).values({
        title: cleanTitle,
        genre: book.genre || 'General',
        topic: `imported-from-catalog:${book.id}`,
        coverUrl: book.coverUrl,
        suggestedPrice: book.price ? String(book.price) : '9.99',
        status: 'draft',
        description: book.description,
      }).returning();

      res.json({ success: true, draft: newDraft, message: `"${cleanTitle}" imported to Content Studio for rewriting` });
    } catch (error) {
      console.error("Error importing book:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to import book" });
    }
  });

  app.post("/api/content-studio/rewrite-incomplete-content", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      await contentStudio.rewriteIncompleteContent();
      res.json({ success: true, message: "Rewriting incomplete ebooks started" });
    } catch (error) {
      console.error("Error starting incomplete content rewrite:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start rewrite" });
    }
  });

  app.post("/api/content-studio/rewrite-visual-enhanced", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      await contentStudio.rewriteVisualEnhancedBooks();
      res.json({ success: true, message: "Visual-enhanced genre books rewrite started in background" });
    } catch (error) {
      console.error("Error starting visual-enhanced rewrite:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start visual-enhanced rewrite" });
    }
  });

  app.get("/api/content-studio/illustration-needs", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const needs = await contentStudio.getIllustrationNeeds();
      res.json(needs);
    } catch (error) {
      console.error("Error getting illustration needs:", error);
      res.status(500).json({ error: "Failed to get illustration needs" });
    }
  });

  app.get("/api/content-studio/illustration-progress", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    res.json(contentStudio.getIllustrationProgress());
  });

  app.post("/api/content-studio/illustrations-only", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIds } = req.body;
      if (!Array.isArray(draftIds) || draftIds.length === 0) {
        return res.status(400).json({ error: "draftIds array is required" });
      }
      const ids = draftIds.map(Number);
      try {
        await contentStudio.generateIllustrationsOnly(ids);
        res.json({ success: true, message: `Illustrations-only generation started for ${ids.length} books` });
      } catch (busyErr: any) {
        if (busyErr?.message?.includes("already running")) {
          contentStudio.queueIllustrations(ids);
          res.json({ success: true, queued: true, message: `Bulk is running — queued ${ids.length} books for illustration generation after it completes` });
        } else {
          throw busyErr;
        }
      }
    } catch (error) {
      console.error("Error starting illustrations-only generation:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start illustrations-only generation" });
    }
  });

  // Scan illustration files for edge cut-off using pixel analysis.
  // Uses sharp to extract 20px edge strips from each image and measure brightness.
  // Images with significant dark/coloured content right at the boundary are flagged.
  app.get("/api/admin/illustrations/scan-cutoff", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const rawIds = req.query.draftIds as string | undefined;
      const limitParam = parseInt((req.query.limit as string) || "150");
      const scoreThreshold = parseFloat((req.query.threshold as string) || "18");
      const EDGE_PX = 20;
      const BRIGHT_THRESHOLD = 218; // pixels darker than this count as "content at edge"

      // Fetch books with illustration URLs
      let drafts: { id: number; title: string; genre: string; content: string }[] = [];
      if (rawIds) {
        const ids = rawIds.split(",").map(Number).filter(Boolean);
        drafts = await db.select({ id: draftEbooks.id, title: draftEbooks.title, genre: draftEbooks.genre, content: draftEbooks.content })
          .from(draftEbooks).where(inArray(draftEbooks.id, ids));
      } else {
        drafts = await db.select({ id: draftEbooks.id, title: draftEbooks.title, genre: draftEbooks.genre, content: draftEbooks.content })
          .from(draftEbooks).where(sql`content LIKE '%/uploads/illustrations/%'`).limit(200);
      }

      // Build file→book mapping
      const fileMap: Record<string, { draftId: number; title: string; genre: string }> = {};
      for (const d of drafts) {
        const matches = [...(d.content || "").matchAll(/\[ILLUSTRATION:\s*(\/uploads\/illustrations\/[^\]]+)\]/gi)];
        for (const m of matches) {
          const filePath = m[1].trim();
          const fname = path.basename(filePath);
          fileMap[fname] = { draftId: d.id, title: d.title || "", genre: d.genre || "" };
        }
      }

      const allFiles = Object.keys(fileMap);
      const toScan = allFiles.slice(0, limitParam);
      const results: {
        file: string; draftId: number; title: string; genre: string;
        cutoffScore: number; edges: { top: number; bottom: number; left: number; right: number };
      }[] = [];

      for (const fname of toScan) {
        const fullPath = path.join("uploads/illustrations", fname);
        if (!fs.existsSync(fullPath)) continue;
        try {
          const meta = await sharp(fullPath).metadata();
          const { width, height } = meta;
          if (!width || !height || width < EDGE_PX * 2 || height < EDGE_PX * 2) continue;

          // Extract edge strips and compute mean brightness per channel
          async function edgeBrightness(left: number, top: number, w: number, h: number): Promise<number> {
            const stats = await sharp(fullPath).extract({ left, top, width: w, height: h }).stats();
            return (stats.channels[0].mean + stats.channels[1].mean + (stats.channels[2]?.mean ?? stats.channels[0].mean)) / 3;
          }

          const [topB, bottomB, leftB, rightB] = await Promise.all([
            edgeBrightness(0, 0, width, EDGE_PX),
            edgeBrightness(0, height - EDGE_PX, width, EDGE_PX),
            edgeBrightness(0, 0, EDGE_PX, height),
            edgeBrightness(width - EDGE_PX, 0, EDGE_PX, height),
          ]);

          // Convert brightness to "darkness score" (0=white edge, 100=fully dark edge)
          const darkness = (b: number) => Math.max(0, Math.round((BRIGHT_THRESHOLD - b) / BRIGHT_THRESHOLD * 100));
          const edges = { top: darkness(topB), bottom: darkness(bottomB), left: darkness(leftB), right: darkness(rightB) };
          const cutoffScore = Math.max(edges.top, edges.bottom, edges.left, edges.right);

          if (cutoffScore >= scoreThreshold) {
            results.push({ file: fname, ...fileMap[fname], cutoffScore, edges });
          }
        } catch { /* skip unreadable files */ }
      }

      results.sort((a, b) => b.cutoffScore - a.cutoffScore);
      res.json({
        scanned: toScan.length,
        flagged: results.length,
        threshold: scoreThreshold,
        results,
      });
    } catch (error) {
      console.error("Error scanning illustrations:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Scan failed" });
    }
  });

  // Reset selected illustrations back to text markers so they get regenerated on next run.
  // Replaces [ILLUSTRATION: /uploads/...] with [ILLUSTRATION: regenerate] in specified books.
  app.post("/api/admin/illustrations/reset-for-regen", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIds, filenames } = req.body as { draftIds?: number[]; filenames?: string[] };
      if ((!draftIds || draftIds.length === 0) && (!filenames || filenames.length === 0)) {
        return res.status(400).json({ error: "Provide draftIds or filenames" });
      }

      let targetDrafts: { id: number; title: string; content: string }[] = [];
      if (draftIds && draftIds.length > 0) {
        targetDrafts = await db.select({ id: draftEbooks.id, title: draftEbooks.title, content: draftEbooks.content })
          .from(draftEbooks).where(inArray(draftEbooks.id, draftIds.map(Number)));
      } else {
        // Find books containing the specified filenames
        targetDrafts = await db.select({ id: draftEbooks.id, title: draftEbooks.title, content: draftEbooks.content })
          .from(draftEbooks).where(sql`content LIKE '%/uploads/illustrations/%'`).limit(500);
      }

      let totalReset = 0;
      for (const draft of targetDrafts) {
        let content = draft.content || "";
        let changed = false;
        if (filenames && filenames.length > 0) {
          // Reset only specified filenames (handles both /uploads/ and /objstore/ paths)
          for (const fname of filenames) {
            const before = content;
            const escapedFname = fname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            content = content.replace(
              new RegExp(`\\[ILLUSTRATION:\\s*(?:/uploads/illustrations/|/objstore/illustrations/)${escapedFname}(?:\\s*\\|[^\\]]*)?\\]`, "gi"),
              "[ILLUSTRATION: high-quality illustration needed here]"
            );
            if (content !== before) { changed = true; totalReset++; }
          }
        } else {
          // Reset all illustrations in these books (handles /uploads/, /objstore/, and http paths with optional | caption)
          const before = content;
          content = content.replace(/\[ILLUSTRATION:\s*(?:\/uploads\/illustrations\/|\/objstore\/illustrations\/|https?:\/\/)[^\]|]+(?:\s*\|[^\]]*)?\]/gi,
            "[ILLUSTRATION: high-quality illustration needed here]");
          if (content !== before) {
            totalReset += (before.match(/\[ILLUSTRATION:\s*(?:\/uploads\/illustrations\/|\/objstore\/illustrations\/|https?:\/\/)/gi) || []).length;
            changed = true;
          }
        }
        if (changed) {
          await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, draft.id));
        }
      }

      res.json({ success: true, booksProcessed: targetDrafts.length, illustrationsReset: totalReset,
        message: `Reset ${totalReset} illustrations across ${targetDrafts.length} books. Run illustrations-only generation to regenerate them with the improved prompts.` });
    } catch (error) {
      console.error("Error resetting illustrations:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Reset failed" });
    }
  });

  // Push correct book content to this database (used to sync dev→prod after deploy).
  // Accepts an array of { id, content } objects and saves each to draft_ebooks.
  app.post("/api/admin/drafts/push-content", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { books } = req.body as { books: { id: number; title?: string; genre?: string; topic?: string; description?: string; outline?: string; content: string; coverUrl?: string; backgroundUrl?: string; suggestedPrice?: string; status?: string; coverStyleId?: string }[] };
      if (!Array.isArray(books) || books.length === 0) return res.status(400).json({ error: "Provide books array" });
      const results: { id: number; action: string }[] = [];
      for (const book of books) {
        const id = Number(book.id);
        const [existing] = await db.select({ id: draftEbooks.id }).from(draftEbooks).where(eq(draftEbooks.id, id));
        if (existing) {
          await db.update(draftEbooks).set({ content: book.content }).where(eq(draftEbooks.id, id));
          results.push({ id, action: "updated" });
        } else {
          await db.execute(sql`
            INSERT INTO draft_ebooks (id, title, genre, topic, description, outline, content, cover_url, background_url, suggested_price, status, cover_style_id)
            VALUES (
              ${id},
              ${book.title || "Untitled"},
              ${book.genre || "Non-Fiction"},
              ${book.topic || book.title || "General"},
              ${book.description || null},
              ${book.outline || null},
              ${book.content},
              ${book.coverUrl || null},
              ${book.backgroundUrl || null},
              ${book.suggestedPrice ? book.suggestedPrice.toString() : null},
              ${book.status || "published"},
              ${book.coverStyleId || null}
            )
            ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content
          `);
          results.push({ id, action: "inserted" });
        }
      }
      const inserted = results.filter(r => r.action === "inserted").length;
      const updated = results.filter(r => r.action === "updated").length;
      res.json({ success: true, updated: updated + inserted, inserted, updatedExisting: updated, books: results });
    } catch (error) {
      console.error("Error pushing content:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Push failed" });
    }
  });

  // Add guided prompts (intention, breathing guide, daily calm challenge) to coloring books
  // that promise mindful/guided content in their title but only have bare page descriptions.
  app.post("/api/admin/coloring-books/enrich-prompts", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIds } = req.body as { draftIds: number[] };
      if (!draftIds || draftIds.length === 0) return res.status(400).json({ error: "Provide draftIds array" });
      const results: { id: number; title: string; pagesEnriched: number; error?: string }[] = [];
      for (const id of draftIds) {
        try {
          const [draft] = await db.select({ title: draftEbooks.title }).from(draftEbooks).where(eq(draftEbooks.id, id));
          const { pagesEnriched } = await contentStudio.enrichColoringBookWithPrompts(id);
          results.push({ id, title: draft?.title || "", pagesEnriched });
        } catch (err: any) {
          results.push({ id, title: "", pagesEnriched: 0, error: err.message });
        }
      }
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Enrichment failed" });
    }
  });

  // Scan all draft content for /objstore/illustrations/ URLs that are missing from GCS,
  // reset those markers so they'll be regenerated, then auto-start illustration generation.
  // Returns immediately — regeneration runs in the background.
  app.post("/api/admin/illustrations/recover-missing", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { objStoreExists } = await import("./objectStorage");
      const allAffectedIds = new Set<number>();

      // ── Part 1: Inline illustration markers (workbooks, art books, etc.) ──
      const draftsWithIllust = await db
        .select({ id: draftEbooks.id, title: draftEbooks.title, content: draftEbooks.content })
        .from(draftEbooks)
        .where(sql`content LIKE '%/objstore/illustrations/%'`);

      let missingIllustCount = 0;
      if (draftsWithIllust.length > 0) {
        // Collect unique filenames → which drafts reference them
        const filenameToIds = new Map<string, number[]>();
        const filenameRegex = /\[(?:ILLUSTRATION|IMAGE|COMIC PANEL):\s*\/objstore\/illustrations\/([^\s|\]]+)/gi;
        for (const draft of draftsWithIllust) {
          let m: RegExpExecArray | null;
          filenameRegex.lastIndex = 0;
          while ((m = filenameRegex.exec(draft.content)) !== null) {
            const fn = m[1];
            if (!filenameToIds.has(fn)) filenameToIds.set(fn, []);
            filenameToIds.get(fn)!.push(draft.id);
          }
        }

        // Check GCS for each unique filename in parallel batches
        const allFilenames = Array.from(filenameToIds.keys());
        const missingFilenames = new Set<string>();
        const BATCH = 20;
        for (let i = 0; i < allFilenames.length; i += BATCH) {
          const batch = allFilenames.slice(i, i + BATCH);
          const results = await Promise.all(
            batch.map(fn => objStoreExists(`public/illustrations/${fn}`).then(exists => ({ fn, exists })))
          );
          for (const { fn, exists } of results) {
            if (!exists) missingFilenames.add(fn);
          }
        }

        missingIllustCount = missingFilenames.size;

        if (missingFilenames.size > 0) {
          // Collect affected IDs and reset markers
          const illustAffected = new Set<number>();
          for (const fn of missingFilenames) {
            for (const id of filenameToIds.get(fn) || []) illustAffected.add(id);
          }
          for (const draft of draftsWithIllust) {
            if (!illustAffected.has(draft.id)) continue;
            let content = draft.content;
            for (const fn of missingFilenames) {
              const escaped = fn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              content = content.replace(
                new RegExp(`\\[(?:ILLUSTRATION|IMAGE|COMIC PANEL):\\s*/objstore/illustrations/${escaped}(?:\\s*\\|[^\\]]+)?\\]`, "gi"),
                "[ILLUSTRATION: high-quality illustration needed here]"
              );
            }
            await db.update(draftEbooks).set({ content }).where(eq(draftEbooks.id, draft.id));
            allAffectedIds.add(draft.id);
          }
        }
      }

      // ── Part 2: Coloring book pages ──
      const coloringDrafts = await db
        .select({ id: draftEbooks.id, title: draftEbooks.title })
        .from(draftEbooks)
        .where(sql`genre ILIKE '%coloring%' AND status IN ('published','ready','draft') AND length(content) > 100`);

      let missingColoringBooks = 0;
      if (coloringDrafts.length > 0) {
        const CBATCH = 10;
        let ci = 0;
        async function colorWorker() {
          while (ci < coloringDrafts.length) {
            const draft = coloringDrafts[ci++];
            const firstPage = `public/coloring-pages/${draft.id}/page-001.png`;
            const exists = await objStoreExists(firstPage);
            if (!exists) {
              missingColoringBooks++;
              allAffectedIds.add(draft.id);
            }
          }
        }
        await Promise.all(Array.from({ length: CBATCH }, colorWorker));
      }

      if (allAffectedIds.size === 0) {
        return res.json({
          success: true, affectedBooks: 0, missingFiles: 0,
          message: "All illustrations and coloring pages are present in cloud storage.",
        });
      }

      // Respond immediately — regeneration runs in background
      res.json({
        success: true,
        affectedBooks: allAffectedIds.size,
        missingFiles: missingIllustCount + missingColoringBooks,
        message: `Found issues in ${allAffectedIds.size} book(s) (${missingIllustCount} missing illustration files, ${missingColoringBooks} coloring book(s) with missing pages). Regenerating now — watch the progress bar.`,
      });

      // Kick off regeneration in background
      const ids = Array.from(allAffectedIds);
      (async () => {
        try {
          await contentStudio.generateIllustrationsOnly(ids);
        } catch (busyErr: any) {
          if (busyErr?.message?.includes("already running")) {
            contentStudio.queueIllustrations(ids);
          } else {
            console.error("[IllustRecover] Generation error:", busyErr?.message);
          }
        }
      })();
    } catch (error) {
      console.error("[IllustRecover] Error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Recovery failed" });
    }
  });

  // Admin-triggered batch migration of local illustration files to object storage.
  // Processes up to `batchSize` files per call (default 150). Can be called repeatedly
  // until all files are migrated. Returns progress stats.
  app.post("/api/admin/illustrations/migrate-objstore", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const batchSize = Math.min(parseInt(req.body.batchSize || "150"), 500);
      const { getObjStoreBucketName } = await import("./objectStorage");
      const bucketName = getObjStoreBucketName();
      if (!bucketName) return res.status(500).json({ error: "Object storage not configured" });

      // Illustrations live only in draft_ebooks.content (books table has no content column)
      const draftRows = await db.execute(sql`SELECT id, content FROM draft_ebooks WHERE content LIKE '%/uploads/illustrations/%'`);

      const fileToRefs: Record<string, number[]> = {};
      for (const row of (draftRows.rows as any[])) {
        const matches = [...(row.content || "").matchAll(/\/uploads\/illustrations\/(illust-[^\s|"\]]+\.png)/g)];
        for (const m of matches) {
          const fname = m[1];
          if (!fileToRefs[fname]) fileToRefs[fname] = [];
          if (!fileToRefs[fname].includes(row.id)) fileToRefs[fname].push(row.id);
        }
      }

      const allFilenames = Object.keys(fileToRefs);
      if (allFilenames.length === 0) return res.json({ message: "All illustrations already migrated", uploaded: 0, alreadyInCloud: 0, remaining: 0 });

      const { Storage } = await import("@google-cloud/storage");
      const storageClient = new Storage({
        credentials: {
          audience: "replit", subject_token_type: "access_token",
          token_url: "http://127.0.0.1:1106/token", type: "external_account",
          credential_source: { url: "http://127.0.0.1:1106/credential", format: { type: "json", subject_token_field_name: "access_token" } },
          universe_domain: "googleapis.com",
        } as any,
        projectId: "",
      });
      const bucket = storageClient.bucket(bucketName);

      let uploaded = 0, alreadyInCloud = 0, missingLocally = 0, errors = 0;
      const toProcess = allFilenames.slice(0, batchSize);
      const draftCache: Record<number, string> = {};

      for (const row of (draftRows.rows as any[])) draftCache[row.id] = row.content;

      for (const fname of toProcess) {
        const localPath = path.join(process.cwd(), "uploads", "illustrations", fname);
        const remotePath = `public/illustrations/${fname}`;
        const localUrl = `/uploads/illustrations/${fname}`;
        const objstoreUrl = `/objstore/illustrations/${fname}`;

        if (!fs.existsSync(localPath)) { missingLocally++; continue; }

        try {
          const file = bucket.file(remotePath);
          const [exists] = await file.exists();
          if (!exists) {
            const buf = fs.readFileSync(localPath);
            await file.save(buf, { contentType: "image/png" });
            uploaded++;
          } else { alreadyInCloud++; }

          // Update draft_ebooks references from local path to object storage path
          for (const draftId of fileToRefs[fname]) {
            if (draftCache[draftId]) {
              draftCache[draftId] = draftCache[draftId].replaceAll(localUrl, objstoreUrl);
              await db.execute(sql`UPDATE draft_ebooks SET content = ${draftCache[draftId]} WHERE id = ${draftId}`);
            }
          }
        } catch (e: any) { errors++; console.error(`[IllustMigration] ${fname}:`, e.message); }
      }

      const remaining = allFilenames.length - toProcess.length;
      res.json({
        uploaded, alreadyInCloud, missingLocally, errors,
        processed: toProcess.length, remaining,
        message: remaining > 0
          ? `Batch complete. ${remaining} files still need migration — call again to continue.`
          : "All illustration files migrated to object storage.",
      });
    } catch (error) {
      console.error("Error migrating illustrations:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Migration failed" });
    }
  });

  app.post("/api/admin/illustrations/repair-gcs", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const batchSize = Math.min(parseInt(req.body?.batchSize || "200"), 500);
      const bucketName = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",")[0]?.trim().split("/")[1];
      if (!bucketName) return res.status(500).json({ error: "Object storage not configured" });

      // Find all /objstore/illustrations/ references in draft_ebooks (these should exist in GCS)
      const rows = await db.execute(sql`SELECT content FROM draft_ebooks WHERE content LIKE '%/objstore/illustrations/%'`);
      const filenames = new Set<string>();
      for (const row of (rows.rows as any[])) {
        const matches = [...(row.content || "").matchAll(/\/objstore\/illustrations\/(illust-[^\s|"\]]+\.png)/g)];
        for (const m of matches) filenames.add(m[1]);
      }

      const { Storage } = await import("@google-cloud/storage");
      const storageClient = new Storage({
        credentials: {
          audience: "replit", subject_token_type: "access_token",
          token_url: "http://127.0.0.1:1106/token", type: "external_account",
          credential_source: { url: "http://127.0.0.1:1106/credential", format: { type: "json", subject_token_field_name: "access_token" } },
          universe_domain: "googleapis.com",
        } as any, projectId: "",
      });
      const bucket = storageClient.bucket(bucketName);

      const allFiles = [...filenames].slice(0, batchSize);
      let repaired = 0, alreadyInGcs = 0, missingLocally = 0, errors = 0;

      for (const fname of allFiles) {
        try {
          const gcsPath = `public/illustrations/${fname}`;
          const [exists] = await bucket.file(gcsPath).exists();
          if (exists) { alreadyInGcs++; continue; }
          // Not in GCS — check if local file exists
          const localPath = path.join(process.cwd(), "uploads", "illustrations", fname);
          if (!fs.existsSync(localPath)) { missingLocally++; continue; }
          // Upload local file to GCS
          const buf = fs.readFileSync(localPath);
          await bucket.file(gcsPath).save(buf, { contentType: "image/png" });
          repaired++;
        } catch (e: any) { errors++; console.error(`[IllustRepair] ${fname}:`, e.message); }
      }

      const remaining = filenames.size - allFiles.length;
      res.json({
        repaired, alreadyInGcs, missingLocally, errors,
        processed: allFiles.length, remaining,
        totalReferenced: filenames.size,
        message: missingLocally > 0
          ? `Repaired ${repaired} files. ${missingLocally} are missing from both GCS and local storage — those need illustration regeneration.`
          : remaining > 0
            ? `Repaired ${repaired} files. ${remaining} more files not yet processed — call again to continue.`
            : `Repair complete. Uploaded ${repaired} files to GCS. ${alreadyInGcs} were already there.`,
      });
    } catch (error: any) {
      console.error("[IllustRepair] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/illustrations/verify-gcs", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const bucketName = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",")[0]?.trim().split("/")[1];
      if (!bucketName) return res.status(500).json({ error: "Object storage not configured" });

      const rows = await db.execute(sql`SELECT content FROM draft_ebooks WHERE content LIKE '%/objstore/illustrations/%'`);
      const filenames = new Set<string>();
      for (const row of (rows.rows as any[])) {
        const matches = [...(row.content || "").matchAll(/\/objstore\/illustrations\/(illust-[^\s|"\]]+\.png)/g)];
        for (const m of matches) filenames.add(m[1]);
      }

      const { Storage } = await import("@google-cloud/storage");
      const storageClient = new Storage({
        credentials: {
          audience: "replit", subject_token_type: "access_token",
          token_url: "http://127.0.0.1:1106/token", type: "external_account",
          credential_source: { url: "http://127.0.0.1:1106/credential", format: { type: "json", subject_token_field_name: "access_token" } },
          universe_domain: "googleapis.com",
        } as any, projectId: "",
      });
      const bucket = storageClient.bucket(bucketName);

      let inGcs = 0, missing = 0;
      const missingFiles: string[] = [];
      const allFiles = [...filenames];
      const CONCURRENCY = 20;
      let idx = 0;
      async function worker() {
        while (idx < allFiles.length) {
          const fname = allFiles[idx++];
          try {
            const [exists] = await bucket.file(`public/illustrations/${fname}`).exists();
            if (exists) { inGcs++; } else { missing++; if (missingFiles.length < 20) missingFiles.push(fname); }
          } catch { missing++; }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));

      res.json({
        totalReferenced: allFiles.length,
        inGcs,
        missing,
        missingExamples: missingFiles,
        message: missing === 0
          ? `All ${inGcs} illustration files verified in GCS.`
          : `${missing} of ${allFiles.length} illustration files are missing from GCS. These will show as broken images.`,
      });
    } catch (error: any) {
      console.error("[IllustVerify] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/content-studio/cleanup-excess-markers", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIds } = req.body;
      if (!Array.isArray(draftIds) || draftIds.length === 0) {
        return res.status(400).json({ error: "draftIds array is required" });
      }
      const ids = draftIds.map(Number);
      let cleaned = 0;
      for (const draftId of ids) {
        const [draft] = await db.select({ id: draftEbooks.id, title: draftEbooks.title, content: draftEbooks.content }).from(draftEbooks).where(eq(draftEbooks.id, draftId));
        if (!draft?.content) continue;
        const unprocessedPattern = /\[ILLUSTRATION:\s*(?!\/uploads\/|http)(.+?)\]\n*/gi;
        const matches = [...draft.content.matchAll(unprocessedPattern)];
        if (matches.length === 0) {
          console.log(`[Cleanup] Draft ${draftId} "${draft.title}" — no unprocessed markers`);
          continue;
        }
        const cleanedContent = draft.content.replace(/\n*\[ILLUSTRATION:\s*(?!\/uploads\/|http)(.+?)\]\n*/gi, '\n\n');
        await db.update(draftEbooks).set({ content: cleanedContent }).where(eq(draftEbooks.id, draftId));
        console.log(`[Cleanup] Draft ${draftId} "${draft.title}" — removed ${matches.length} unprocessed markers`);
        cleaned += matches.length;
      }
      res.json({ success: true, message: `Cleaned ${cleaned} unprocessed markers from ${ids.length} books` });
    } catch (error) {
      console.error("Error cleaning markers:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to clean markers" });
    }
  });

  app.post("/api/content-studio/fill-empty-chapters", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { targets } = req.body;
      if (!Array.isArray(targets) || targets.length === 0) {
        return res.status(400).json({ error: "targets array is required: [{bookId, chapters: [chNum,...]}]" });
      }
      const targetList = targets.map((t: any) => ({
        bookId: Number(t.bookId),
        chapters: (t.chapters || []).map(Number),
      }));
      contentStudio.fillEmptyChaptersWithIllustrations(targetList).catch(err => {
        console.error("[Fill Empty Chapters] Background error:", err);
      });
      const totalCh = targetList.reduce((s: number, t: any) => s + t.chapters.length, 0);
      res.json({ success: true, message: `Filling ${totalCh} empty chapters across ${targetList.length} books with 2 illustrations each (running in background)` });
    } catch (error) {
      console.error("Error starting fill empty chapters:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start" });
    }
  });

  app.post("/api/content-studio/repair-illustration-distribution", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIds } = req.body;
      if (!Array.isArray(draftIds) || draftIds.length === 0) {
        return res.status(400).json({ error: "draftIds array is required" });
      }
      const ids = draftIds.map(Number);
      contentStudio.repairIllustrationDistribution(ids).catch(err => {
        console.error("[Illust Repair] Background error:", err);
      });
      res.json({ success: true, message: `Illustration distribution repair started for ${ids.length} books (running in background)` });
    } catch (error) {
      console.error("Error starting illustration repair:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start illustration repair" });
    }
  });

  app.post("/api/content-studio/rewrite-specific-drafts", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { draftIds } = req.body;
      if (!Array.isArray(draftIds) || draftIds.length === 0) {
        return res.status(400).json({ error: "draftIds array is required" });
      }
      await contentStudio.rewriteSpecificDrafts(draftIds.map(Number));
      res.json({ success: true, message: `Rewrite started for ${draftIds.length} books in background` });
    } catch (error) {
      console.error("Error starting targeted rewrite:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to start targeted rewrite" });
    }
  });

  // POST /api/content-studio/upload-reference-image - Upload a reference image for inspiration
  app.post("/api/content-studio/upload-reference-image", uploadReferenceImage.single('image'), async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    let tempFilePath: string | null = null;
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file uploaded" });
      }
      
      tempFilePath = req.file.path;
      const imageBuffer = fs.readFileSync(tempFilePath);
      const imageBase64 = imageBuffer.toString('base64');
      
      // Analyze the reference image
      const analysis = await contentStudio.analyzeReferenceImage(imageBase64);
      
      // Store the analysis for future cover generation
      contentStudio.setStoredReferenceAnalysis(analysis);
      
      res.json({ 
        success: true, 
        message: "Reference image analyzed and stored",
        analysis 
      });
    } catch (error: any) {
      console.error("Error processing reference image:", error?.message || error);
      res.status(500).json({ error: "Failed to analyze reference image" });
    } finally {
      // Clean up temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (e) {
          console.error("Failed to clean up temp file:", e);
        }
      }
    }
  });

  // GET /api/content-studio/reference-analysis - Get the stored reference analysis
  app.get("/api/content-studio/reference-analysis", (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    const analysis = contentStudio.getStoredReferenceAnalysis();
    if (analysis) {
      res.json({ hasReference: true, analysis });
    } else {
      res.json({ hasReference: false });
    }
  });

  // DELETE /api/content-studio/reference-analysis - Clear the stored reference
  app.delete("/api/content-studio/reference-analysis", (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    contentStudio.clearStoredReferenceAnalysis();
    res.json({ success: true, message: "Reference cleared" });
  });

  // POST /api/content-studio/analyze-cover/:id - AI analysis of cover for text detection and typography
  app.post("/api/content-studio/analyze-cover/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      
      const imageUrl = draft.backgroundUrl || draft.coverUrl;
      if (!imageUrl) {
        return res.status(400).json({ error: "No cover image to analyze" });
      }
      
      const analysis = await contentStudio.analyzeCoverImage(
        imageUrl,
        draft.title || draft.topic || "Untitled",
        "EbookGamez",
        draft.genre || "Fiction"
      );
      
      res.json(analysis);
    } catch (error: any) {
      console.error("Error analyzing cover:", error?.message || error);
      res.status(500).json({ error: "Failed to analyze cover" });
    }
  });

  // POST /api/content-studio/complete-content/:id - Complete content for a single ebook
  app.post("/api/content-studio/complete-content/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const result = await contentStudio.completeEbookContent(draftId);
      res.json(result);
    } catch (error) {
      console.error("Error completing ebook content:", error);
      res.status(500).json({ error: "Failed to complete ebook content" });
    }
  });

  // GET /api/admin/epub-export-status - readiness report for all published ebooks
  app.get("/api/admin/epub-export-status", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const rows = await db.execute(sql`
        SELECT
          d.id            AS draft_id,
          b.id            AS book_id,
          d.title,
          b.author,
          d.genre,
          d.description,
          d.content,
          d.cover_url,
          d.background_url,
          d.status
        FROM draft_ebooks d
        LEFT JOIN books b ON lower(b.title) = lower(d.title)
        WHERE d.status = 'published'
           OR (d.status = 'ready' AND d.content IS NOT NULL)
        ORDER BY d.id DESC
        LIMIT 500
      `);

      const result = (rows.rows ?? []).map((r: Record<string, unknown>) => {
        const content = (r.content as string) ?? "";
        const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;
        const hasContent = wordCount >= 100;
        const hasCover = !!(r.cover_url || r.background_url);
        const author = (r.author as string) ?? null;
        const description = (r.description as string) ?? null;
        const genre = (r.genre as string) ?? "";
        const title = (r.title as string) ?? "";

        // Score out of 6: title, author, description, cover, content(3k+), genre
        let score = 0;
        if (title) score++;
        if (author && author !== "EbookGamez") score++;
        if (description && description.length > 20) score++;
        if (hasCover) score++;
        if (hasContent && wordCount >= 3000) score++;
        if (genre) score++;

        return {
          draftId: Number(r.draft_id),
          bookId: r.book_id ? Number(r.book_id) : null,
          title,
          author,
          genre,
          description,
          hasContent,
          wordCount,
          hasCover,
          status: (r.status as string) ?? "",
          score,
        };
      });

      const totalReady = result.filter(b => b.score >= 5).length;
      const totalNeedWork = result.length - totalReady;

      res.json({ books: result, totalReady, totalNeedWork });
    } catch (error) {
      console.error("epub-export-status error:", error);
      res.status(500).json({ error: "Failed to fetch export status" });
    }
  });

  // GET /api/content-studio/download-epub/:id - Download single ebook as distribution-quality EPUB
  app.get("/api/content-studio/download-epub/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const epubBuffer = await generateDistributionEpub(draftId);
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      const filename = draft?.title?.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").substring(0, 60) || `ebook-${draftId}`;
      res.setHeader("Content-Type", "application/epub+zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.epub"`);
      res.send(epubBuffer);
    } catch (error) {
      console.error("Error generating EPUB:", error);
      res.status(500).json({ error: "Failed to generate EPUB" });
    }
  });

  // GET /api/content-studio/download-epubs-zip - Download all ebooks as EPUBs in a ZIP
  app.get("/api/content-studio/download-epubs-zip", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const idsParam = req.query.ids as string | undefined;
      let drafts;
      
      if (idsParam) {
        const ids = idsParam.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));
        drafts = await db.select().from(draftEbooks).where(inArray(draftEbooks.id, ids));
      } else {
        drafts = await db.select().from(draftEbooks).where(
          sql`${draftEbooks.content} IS NOT NULL AND length(${draftEbooks.content}) > 100`,
        );
      }
      
      const draftsWithContent = drafts.filter(d => d.content && d.content.length > 100);
      
      if (draftsWithContent.length === 0) {
        return res.status(404).json({ error: "No ebooks with content found" });
      }
      
      const archive = archiver("zip", { zlib: { level: 9 } });
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="ebooks-epub-${Date.now()}.zip"`);
      
      archive.pipe(res);
      
      for (const draft of draftsWithContent) {
        try {
          const epubBuffer = await generateDistributionEpub(draft.id);
          const filename = draft.title?.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-").substring(0, 60) || `ebook-${draft.id}`;
          archive.append(epubBuffer, { name: `${filename}.epub` });
        } catch (error) {
          console.error(`Failed to generate EPUB for draft ${draft.id}:`, error);
        }
      }
      
      await archive.finalize();
    } catch (error) {
      console.error("Error creating EPUBs ZIP:", error);
      res.status(500).json({ error: "Failed to create EPUBs ZIP" });
    }
  });

  // GET /downloads/:filename - Serve downloadable files
  app.get("/downloads/:filename", (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(process.cwd(), "downloads", filename);
    
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: "File not found" });
    }
    
    res.download(filepath, filename);
  });

  // ============ BACKUP API ENDPOINTS ============
  
  // POST /api/backup/cover/:id - Backup a single cover to cloud storage
  app.post("/api/backup/cover/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      
      if (!draft || !draft.coverUrl) {
        return res.status(404).json({ error: "Draft or cover not found" });
      }
      
      const backupPath = await backupService.backupCoverFromFile(draftId, draft.coverUrl);
      await backupService.backupEbookData(draftId);
      
      res.json({ success: true, backupPath, message: `Cover and data backed up for draft ${draftId}` });
    } catch (error) {
      console.error("Error backing up cover:", error);
      res.status(500).json({ error: "Failed to backup cover" });
    }
  });

  // POST /api/backup/all - Backup all current covers and data
  app.post("/api/backup/all", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const result = await backupService.backupAllCurrentCovers();
      res.json({ 
        success: true, 
        message: `Backed up ${result.backed}/${result.total} ebooks`,
        ...result 
      });
    } catch (error) {
      console.error("Error backing up all covers:", error);
      res.status(500).json({ error: "Failed to backup covers" });
    }
  });

  // GET /api/backup/list - List all backups
  app.get("/api/backup/list", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = req.query.draftId ? parseInt(req.query.draftId as string) : undefined;
      const backups = await backupService.listBackups(draftId);
      res.json(backups);
    } catch (error) {
      console.error("Error listing backups:", error);
      res.status(500).json({ error: "Failed to list backups" });
    }
  });

  // POST /api/backup/restore - Restore a cover from backup
  app.post("/api/backup/restore", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { backupPath, draftId } = req.body;
      if (!backupPath || !draftId) {
        return res.status(400).json({ error: "backupPath and draftId required" });
      }
      
      const newCoverUrl = await backupService.restoreCoverFromBackup(backupPath, draftId);
      res.json({ success: true, coverUrl: newCoverUrl, message: "Cover restored from backup" });
    } catch (error) {
      console.error("Error restoring backup:", error);
      res.status(500).json({ error: "Failed to restore backup" });
    }
  });

  // POST /api/backup/styles - Backup style definitions to cloud
  app.post("/api/backup/styles", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      await backupService.backupStyleDefinitions();
      res.json({ success: true, message: "Style definitions backed up to cloud storage" });
    } catch (error) {
      console.error("Error backing up styles:", error);
      res.status(500).json({ error: "Failed to backup style definitions" });
    }
  });

  // GET /api/cover-styles - Get available cover styles
  app.get("/api/cover-styles", async (_req, res) => {
    try {
      const { COVER_STYLES, CLASSIC_CINEMATIC_STYLE } = await import("./coverStyles");
      res.json({ 
        styles: COVER_STYLES,
        defaultStyle: CLASSIC_CINEMATIC_STYLE,
        protectedStyleId: "classic-cinematic"
      });
    } catch (error) {
      console.error("Error getting cover styles:", error);
      res.status(500).json({ error: "Failed to get cover styles" });
    }
  });

  // GET /api/ai-model-styles - Get available AI model styles for image generation
  app.get("/api/ai-model-styles", async (_req, res) => {
    try {
      const { AI_MODEL_STYLES } = await import("./coverStyles");
      res.json({ 
        styles: AI_MODEL_STYLES,
        defaultStyleId: "replit-cinematic"
      });
    } catch (error) {
      console.error("Error getting AI model styles:", error);
      res.status(500).json({ error: "Failed to get AI model styles" });
    }
  });

  // GET /api/backup/styles - Retrieve style definitions from cloud backup (for recovery after rollback)
  app.get("/api/backup/styles", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const backedUpStyles = await backupService.getBackedUpStyleDefinitions();
      if (backedUpStyles) {
        res.json({ 
          success: true, 
          message: "Style definitions retrieved from cloud backup",
          ...backedUpStyles 
        });
      } else {
        res.status(404).json({ error: "No style definitions backup found in cloud storage" });
      }
    } catch (error) {
      console.error("Error retrieving backed up styles:", error);
      res.status(500).json({ error: "Failed to retrieve style definitions from backup" });
    }
  });

  // ============================================================
  // TYPOGRAPHY VAULT ENDPOINTS - Protected storage for AI-generated styles
  // ============================================================

  // POST /api/typography-vault/generate/:id - Generate and save 12-15 typography options for a cover
  app.post("/api/typography-vault/generate/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const forceRegenerate = req.body?.forceRegenerate === true || req.query.force === "true";
      console.log(`[Typography Vault API] Generating for draft ${draftId}${forceRegenerate ? " [FORCE]" : ""}`);
      
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      
      if (!draft) {
        console.log(`[Typography Vault API] Draft ${draftId} not found`);
        return res.status(404).json({ error: "Draft not found" });
      }
      
      const imageUrl = draft.backgroundUrl || draft.coverUrl;
      if (!imageUrl) {
        console.log(`[Typography Vault API] Draft ${draftId} has no cover image`);
        return res.status(400).json({ error: "No cover image available" });
      }
      
      console.log(`[Typography Vault API] Calling AI for "${draft.title}" (${draft.genre})`);
      
      const result = await contentStudio.generateTypographyOptions(
        draftId,
        imageUrl,
        draft.title || "Untitled",
        "EbookGamez",
        draft.genre || "Fiction",
        draft.topic || draft.outline?.substring(0, 200),
        forceRegenerate
      );
      
      console.log(`[Typography Vault API] Draft ${draftId}: Generated ${result.styleOptions?.length || 0} styles, saved: ${result.savedToVault}`);
      
      res.json({
        success: true,
        draftId,
        coverAnalysis: result.coverAnalysis,
        styleOptions: result.styleOptions,
        savedToVault: result.savedToVault,
      });
    } catch (error: any) {
      console.error(`[Typography Vault API] Error for draft: ${error?.message || error}`);
      res.status(500).json({ error: error.message || "Failed to generate typography options" });
    }
  });

  // POST /api/typography-vault/generate-replit/:id - Generate typography using Replit AI (embedded style thinking)
  app.post("/api/typography-vault/generate-replit/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      console.log(`[Replit Typography API] Generating for draft ${draftId}`);
      
      const [draft] = await db.select().from(draftEbooks).where(eq(draftEbooks.id, draftId));
      
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      
      const imageUrl = draft.backgroundUrl || draft.coverUrl;
      if (!imageUrl) {
        return res.status(400).json({ error: "No cover image available" });
      }
      
      console.log(`[Replit Typography API] Calling Replit AI for "${draft.title}" (${draft.genre})`);
      
      const result = await contentStudio.generateTypographyOptionsReplitStyle(
        draftId,
        imageUrl,
        draft.title || "Untitled",
        "EbookGamez",
        draft.genre || "Fiction",
        draft.topic || draft.outline?.substring(0, 200)
      );
      
      console.log(`[Replit Typography API] Draft ${draftId}: Generated ${result.styleOptions?.length || 0} styles`);
      
      res.json({
        success: true,
        draftId,
        coverAnalysis: result.coverAnalysis,
        styleOptions: result.styleOptions,
        savedToVault: result.savedToVault,
      });
    } catch (error: any) {
      console.error(`[Replit Typography API] Error:`, error?.message || error);
      res.status(500).json({ error: error.message || "Failed to generate Replit typography" });
    }
  });

  // GET /api/typography-vault/:id - Get saved typography options for a draft
  app.get("/api/typography-vault/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const vaultEntry = await backupService.getTypographyFromVault(draftId);
      
      if (!vaultEntry) {
        return res.status(404).json({ error: "No typography styles found in vault" });
      }
      
      res.json({
        success: true,
        ...vaultEntry
      });
    } catch (error: any) {
      console.error("Error getting typography from vault:", error);
      res.status(500).json({ error: error.message || "Failed to get typography styles" });
    }
  });

  // PUT /api/typography-vault/:id/select - Update selected style for a draft
  app.put("/api/typography-vault/:id/select", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const draftId = parseInt(req.params.id);
      const { styleId } = req.body;
      
      if (!styleId) {
        return res.status(400).json({ error: "styleId is required" });
      }
      
      const success = await backupService.updateSelectedTypographyStyle(draftId, styleId);
      
      if (!success) {
        return res.status(404).json({ error: "No typography vault entry found for this draft" });
      }
      
      res.json({ success: true, selectedStyleId: styleId });
    } catch (error: any) {
      console.error("Error updating selected style:", error);
      res.status(500).json({ error: error.message || "Failed to update selected style" });
    }
  });

  // GET /api/typography-vault - List all typography vault entries
  app.get("/api/typography-vault", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const entries = await backupService.listTypographyVault();
      res.json({ success: true, entries });
    } catch (error: any) {
      console.error("Error listing typography vault:", error);
      res.status(500).json({ error: error.message || "Failed to list typography vault" });
    }
  });

  // POST /api/typography-vault/cleanup - Remove orphaned entries (where ebook was deleted)
  app.post("/api/typography-vault/cleanup", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const result = await backupService.cleanupOrphanedTypography();
      res.json({ 
        success: true, 
        message: `Cleaned ${result.cleaned} orphaned entries, kept ${result.kept}`,
        ...result 
      });
    } catch (error: any) {
      console.error("Error cleaning up typography vault:", error);
      res.status(500).json({ error: error.message || "Failed to cleanup typography vault" });
    }
  });

  // POST /api/content-studio/assign-classic-library-239 - Assign classic-library-239 to original 239-253 covers
  app.post("/api/content-studio/assign-classic-library-239", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      console.log("Assigning classic-library-239 to original 239-253 covers...");
      
      // Database IDs for the original 239-253 covers (from replit.md mapping)
      const originalCoverIds = [13, 15, 20, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37];
      
      let updated = 0;
      for (const id of originalCoverIds) {
        const result = await db.update(draftEbooks)
          .set({ coverStyleId: "classic-library-239" })
          .where(eq(draftEbooks.id, id));
        updated++;
      }
      
      console.log(`Assigned classic-library-239 to ${updated} original covers`);
      
      res.json({ 
        success: true, 
        message: `Assigned classic-library-239 to ${updated} original 239-253 covers`,
        ids: originalCoverIds
      });
    } catch (error: any) {
      console.error("Error assigning classic-library-239:", error);
      res.status(500).json({ error: error.message || "Failed to assign classic-library-239" });
    }
  });

  // POST /api/content-studio/migrate-cover-styles - Populate coverStyleId from filename patterns
  app.post("/api/content-studio/migrate-cover-styles", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      console.log("Starting cover style migration from filenames...");
      
      // Get all drafts with background URLs
      const drafts = await db.select().from(draftEbooks);
      
      // Style patterns to look for in filenames
      const stylePatterns = [
        "replit-cinematic",
        "dalle3-vivid", 
        "cinematic-openai",
        "artistic-painterly",
        "artistic-compact",
        "vivid-atmospheric",
        "standalone-scenes",
        "reference-inspired",
        "vivid-painterly-pro",
        "atmospheric-cinema",
        "experimental-239",
        "classic-239",
        "classic-library-239",
        "test-style-a",
        "test-style-b",
        "test-style-c",
        "test-style-d",
        "test-style-e",
        "test-style-f",
        "test-style-g",
        "test-style-h"
      ];
      
      let updated = 0;
      let skipped = 0;
      const results: Array<{id: number; title: string; style: string | null}> = [];
      
      for (const draft of drafts) {
        // Skip if already has a style assigned
        if (draft.coverStyleId) {
          skipped++;
          continue;
        }
        
        const filename = draft.backgroundUrl || draft.coverUrl || "";
        let foundStyle: string | null = null;
        
        // Check for style pattern in filename
        for (const style of stylePatterns) {
          if (filename.includes(style)) {
            foundStyle = style;
            break;
          }
        }
        
        if (foundStyle) {
          await db.update(draftEbooks)
            .set({ coverStyleId: foundStyle })
            .where(eq(draftEbooks.id, draft.id));
          updated++;
          results.push({ id: draft.id, title: draft.title, style: foundStyle });
        }
      }
      
      console.log(`Cover style migration complete: ${updated} updated, ${skipped} skipped (already had style)`);
      
      res.json({ 
        success: true, 
        message: `Updated ${updated} covers with style IDs from filenames`,
        updated,
        skipped,
        results
      });
    } catch (error: any) {
      console.error("Error migrating cover styles:", error);
      res.status(500).json({ error: error.message || "Failed to migrate cover styles" });
    }
  });

  // ==================== SUBSCRIPTION AUTH ROUTES ====================

  app.post("/api/subscription/send-otp", otpRateLimit, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email address is required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const code = generateOTP(normalizedEmail);

      try {
        await sendSubscriptionOTPEmail(normalizedEmail, code);
      } catch (emailError) {
        console.error("[OTP] Failed to send email:", emailError);
        return res.status(500).json({ error: "Failed to send verification email. Please try again." });
      }

      console.log(`[OTP] Verification code sent to ${normalizedEmail}`);
      res.json({ success: true, message: "Verification code sent to your email." });
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      res.status(500).json({ error: "Failed to send verification code" });
    }
  });

  app.post("/api/subscription/verify-otp", otpRateLimit, async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "Email and verification code are required" });
      }

      const result = verifyOTP(email, code);
      if (!result.valid) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, token: result.token });
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      res.status(500).json({ error: "Failed to verify code" });
    }
  });

  // ==================== SUBSCRIPTION ROUTES ====================

  app.get("/api/subscription/plans", async (_req, res) => {
    try {
      const plans = await subscriptionService.getPlans();
      res.json(plans);
    } catch (error: any) {
      console.error("Error fetching plans:", error);
      res.status(500).json({ error: "Failed to fetch plans" });
    }
  });

  app.use(subscriptionSessionRouter);

  app.post("/api/subscription/init-plans", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const plans = await subscriptionService.initializeSubscriptionPlans();
      res.json({ success: true, plans });
    } catch (error: any) {
      console.error("Error initializing plans:", error);
      res.status(500).json({ error: error.message || "Failed to initialize plans" });
    }
  });

  app.post("/api/subscription/checkout", subscriptionRateLimit, async (req, res) => {
    try {
      const { planId, email, billingInterval, promoCode } = req.body;
      if (!planId || !email) return res.status(400).json({ error: "Plan ID and email are required" });

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const session = await subscriptionService.createSubscriptionCheckout(planId, email, baseUrl, billingInterval || "monthly", promoCode || null);
      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating subscription checkout:", error);
      res.status(400).json({ error: error.message || "Failed to create checkout" });
    }
  });

  app.get("/api/subscription/status/:email", subscriptionRateLimit, requireSubscriptionAuth, async (req, res) => {
    try {
      const email = (req as any).verifiedEmail;
      const result = await subscriptionService.getSubscriptionWithPlan(email);
      if (!result) return res.json({ active: false });

      const { start: windowStart, end: windowEnd } = subscriptionService.getMonthlyWindow(result.subscription);
      const usage = await subscriptionService.getUsageForCurrentPeriod(
        result.subscription.id,
        windowStart,
        windowEnd
      );

      const upgradeNudge = await subscriptionService.getUpgradeNudge(email);

      res.json({
        active: true,
        subscription: result.subscription,
        plan: result.plan,
        usage,
        rolloverCredits: result.subscription.rolloverCredits,
        savingsTotalCents: result.subscription.savingsTotalCents,
        billingInterval: result.subscription.billingInterval,
        upgradeNudge,
      });
    } catch (error: any) {
      console.error("Error checking subscription:", error);
      res.status(500).json({ error: "Failed to check subscription" });
    }
  });

  app.post("/api/subscription/switch-interval", sensitiveActionRateLimit, requireSubscriptionAuth, async (req, res) => {
    try {
      const email = (req as any).verifiedEmail;
      const { targetInterval } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });
      if (targetInterval !== "monthly" && targetInterval !== "annual") {
        return res.status(400).json({ error: "targetInterval must be 'monthly' or 'annual'" });
      }
      const result = await subscriptionService.switchBillingInterval(email, targetInterval);
      res.json(result);
    } catch (error: any) {
      console.error("Error switching billing interval:", error);
      res.status(400).json({ error: error.message || "Failed to switch billing interval" });
    }
  });

  app.post("/api/subscription/switch-tier", sensitiveActionRateLimit, requireSubscriptionAuth, async (req, res) => {
    try {
      const email = (req as any).verifiedEmail;
      const { targetPlanId } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });
      if (!targetPlanId || typeof targetPlanId !== "number") {
        return res.status(400).json({ error: "targetPlanId must be a valid plan ID" });
      }
      const beforeData = await subscriptionService.getSubscriptionWithPlan(email);
      const fromPlanName = beforeData?.plan?.name || "Current";
      const billingIntervalBefore = beforeData?.subscription?.billingInterval as "monthly" | "annual" || "monthly";
      const result = await subscriptionService.switchPlanTier(email, targetPlanId);
      res.json(result);
      const plans = await subscriptionService.getPlans();
      const targetPlan = plans.find(p => p.id === targetPlanId);
      if (targetPlan) {
        const newPrice = billingIntervalBefore === "annual" && targetPlan.annualPrice
          ? `$${parseFloat(targetPlan.annualPrice).toFixed(2)}`
          : `$${parseFloat(targetPlan.monthlyPrice).toFixed(2)}`;
        const tierOrderMap: Record<string, number> = { lite: 0, reader: 1, value: 2, premium: 3, vip: 4 };
        const action = (tierOrderMap[targetPlan.tier] || 0) > (tierOrderMap[beforeData?.plan?.tier || ""] || 0) ? "upgraded" : "downgraded";
        sendPlanChangeEmail(email, fromPlanName, targetPlan.name, action, newPrice, billingIntervalBefore, result.currentPeriodEnd).catch(err => {
          console.error("[Email] Failed to send plan change email:", err?.message || err);
        });
      }
    } catch (error: any) {
      console.error("Error switching plan tier:", error);
      res.status(400).json({ error: error.message || "Failed to switch plan tier" });
    }
  });

  app.post("/api/subscription/cancel", sensitiveActionRateLimit, requireSubscriptionAuth, async (req, res) => {
    try {
      const email = (req as any).verifiedEmail;
      if (!email) return res.status(400).json({ error: "Email is required" });

      await subscriptionService.cancelSubscription(email);
      res.json({ success: true, message: "Your subscription will remain active until the end of your current billing period." });
    } catch (error: any) {
      console.error("Error cancelling subscription:", error);
      res.status(400).json({ error: error.message || "Failed to cancel subscription" });
    }
  });

  app.post("/api/subscription/use", subscriptionRateLimit, requireSubscriptionAuth, async (req, res) => {
    try {
      const email = (req as any).verifiedEmail;
      const { bookId: rawBookId, usageType } = req.body;
      if (!email || !rawBookId || !usageType) return res.status(400).json({ error: "Email, bookId, and usageType are required" });
      const bookId = parseInt(String(rawBookId), 10);
      if (isNaN(bookId)) return res.status(400).json({ error: "Invalid bookId" });

      if (usageType !== "read") {
        return res.status(400).json({ error: "Invalid usageType. Only 'read' is accepted at this endpoint." });
      }

      const activeCheckout = await subscriptionService.getActiveCheckout(email);
      if (!activeCheckout || activeCheckout.bookId !== bookId) {
        return res.status(403).json({ error: "You must check out this book before marking it as read." });
      }

      const result = await subscriptionService.checkAndRecordUsage(email, bookId, usageType);
      res.json(result);
    } catch (error: any) {
      console.error("Error recording usage:", error);
      res.status(500).json({ error: "Failed to record usage" });
    }
  });

  app.post("/api/subscription/track-event", subscriptionRateLimit, async (req, res) => {
    try {
      const { eventType, email, planId, metadata } = req.body;
      if (!eventType) return res.status(400).json({ error: "Event type is required" });

      await subscriptionService.trackEvent(eventType, email, planId, undefined, metadata ? JSON.stringify(metadata) : undefined);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error tracking event:", error);
      res.status(500).json({ error: "Failed to track event" });
    }
  });

  app.get("/api/subscription/analytics", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const days = parseInt(req.query.days as string) || 30;
      const analytics = await subscriptionService.getAnalytics(days);
      res.json(analytics);
    } catch (error: any) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/subscription/mrr-history", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const months = parseInt(req.query.months as string) || 12;
      const history = await subscriptionService.getMRRHistory(months);
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching MRR history:", error);
      res.status(500).json({ error: "Failed to fetch MRR history" });
    }
  });

  app.get("/api/subscription/subscriber-history", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const months = parseInt(req.query.months as string) || 12;
      const history = await subscriptionService.getSubscriberHistory(months);
      res.json(history);
    } catch (error: any) {
      console.error("Error fetching subscriber history:", error);
      res.status(500).json({ error: "Failed to fetch subscriber history" });
    }
  });

  app.get("/api/subscription/subscriber-detail", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const month = req.query.month as string;
      const type = req.query.type as string;
      if (!month || !type) return res.status(400).json({ error: "month and type are required" });
      const eventTypes = type === "new"
        ? ["subscription_created"]
        : ["subscription_cancelled", "subscription_ended"];
      const detail = await subscriptionService.getMonthlySubscriberDetail(month, eventTypes);
      res.json(detail);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch subscriber detail" });
    }
  });

  app.get("/api/subscription/analytics/csv", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const months = parseInt(req.query.months as string) || 12;
      const [mrrHistory, subscriberHistory, analytics] = await Promise.all([
        subscriptionService.getMRRHistory(months),
        subscriptionService.getSubscriberHistory(months),
        subscriptionService.getAnalytics(30),
      ]);

      const tierDist = analytics.tierDistribution as Record<string, { total: number; monthly: number; annual: number }>;
      const tierHeaders = Object.keys(tierDist).sort();

      const rows: string[] = [];
      rows.push("Month,Total MRR ($),Monthly MRR ($),Annual MRR ($),New Subscribers,Cancellations,Net Change," +
        tierHeaders.map(t => `${t} Total,${t} Monthly,${t} Annual`).join(","));

      for (let i = 0; i < mrrHistory.length; i++) {
        const m = mrrHistory[i];
        const s = subscriberHistory[i] || { newSubscribers: 0, cancellations: 0, net: 0 };
        const tierCols = tierHeaders.map(t => {
          const td = tierDist[t] || { total: 0, monthly: 0, annual: 0 };
          return `${td.total},${td.monthly},${td.annual}`;
        }).join(",");
        rows.push(`${m.month},${m.totalMRR.toFixed(2)},${m.monthlyMRR.toFixed(2)},${m.annualMRR.toFixed(2)},${s.newSubscribers},${s.cancellations},${s.net},${tierCols}`);
      }

      const csv = rows.join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="subscription-analytics-${new Date().toISOString().split("T")[0]}.csv"`);
      res.send(csv);
    } catch (error: any) {
      console.error("Error generating analytics CSV:", error);
      res.status(500).json({ error: "Failed to generate CSV" });
    }
  });

  app.get("/api/admin/orphaned-covers", (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });

    try {
      const orphanFile = path.join("uploads", "orphaned-covers.json");
      if (!fs.existsSync(orphanFile)) {
        return res.json({ orphaned: [], total: 0 });
      }
      const orphaned: string[] = JSON.parse(fs.readFileSync(orphanFile, "utf-8"));
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.perPage as string) || 50;
      const start = (page - 1) * perPage;
      const slice = orphaned.slice(start, start + perPage);
      res.json({
        orphaned: slice,
        total: orphaned.length,
        page,
        perPage,
        totalPages: Math.ceil(orphaned.length / perPage),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/rescue-covers", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });

    try {
      const { filenames } = req.body as { filenames: string[] };
      if (!filenames || !Array.isArray(filenames)) {
        return res.status(400).json({ error: "filenames array required" });
      }

      const orphanFile = path.join("uploads", "orphaned-covers.json");
      if (!fs.existsSync(orphanFile)) {
        return res.json({ rescued: 0 });
      }
      const orphaned: string[] = JSON.parse(fs.readFileSync(orphanFile, "utf-8"));
      const remaining = orphaned.filter(f => !filenames.includes(f));
      fs.writeFileSync(orphanFile, JSON.stringify(remaining));
      res.json({ rescued: filenames.length, remaining: remaining.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/delete-specific-orphans", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });

    try {
      const { filenames } = req.body as { filenames: string[] };
      if (!filenames || !Array.isArray(filenames)) {
        return res.status(400).json({ error: "filenames array required" });
      }

      const orphanFile = path.join("uploads", "orphaned-covers.json");
      if (!fs.existsSync(orphanFile)) {
        return res.json({ deleted: 0 });
      }
      const orphaned: string[] = JSON.parse(fs.readFileSync(orphanFile, "utf-8"));
      const toDelete = new Set(filenames);
      let deleted = 0;
      let failed = 0;
      for (const filename of filenames) {
        const filePath = path.join("uploads/covers", filename);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deleted++;
          }
        } catch {
          failed++;
        }
      }
      const remaining = orphaned.filter(f => !toDelete.has(f));
      fs.writeFileSync(orphanFile, JSON.stringify(remaining));
      res.json({ deleted, failed, remaining: remaining.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/delete-orphaned-covers", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });

    try {
      const orphanFile = path.join("uploads", "orphaned-covers.json");
      if (!fs.existsSync(orphanFile)) {
        return res.json({ deleted: 0 });
      }
      const orphaned: string[] = JSON.parse(fs.readFileSync(orphanFile, "utf-8"));
      let deleted = 0;
      let failed = 0;
      for (const filename of orphaned) {
        const filePath = path.join("uploads/covers", filename);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            deleted++;
          }
        } catch {
          failed++;
        }
      }
      fs.writeFileSync(orphanFile, JSON.stringify([]));
      res.json({ deleted, failed, total: orphaned.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/system-stats", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const getDirSize = (dir: string): number => {
        try {
          const result = execSync(`du -sb "${dir}" 2>/dev/null`).toString().trim();
          return parseInt(result.split("\t")[0]) || 0;
        } catch { return 0; }
      };
      const countFiles = (dir: string, pattern = "*"): number => {
        try {
          return parseInt(execSync(`find "${dir}" -name "${pattern}" -type f 2>/dev/null | wc -l`).toString().trim()) || 0;
        } catch { return 0; }
      };
      const workspace = "/home/runner/workspace";
      const cacheSize = getDirSize(`${workspace}/.cache`);
      const distSize = getDirSize(`${workspace}/dist`);
      const attachedSize = getDirSize(`${workspace}/attached_assets`);
      const attachedCount = countFiles(`${workspace}/attached_assets`);
      const tmpSize = getDirSize("/tmp");
      const tmpCount = countFiles("/tmp");
      const logCount = countFiles("/tmp/logs");
      res.json({
        cache: { size: cacheSize, label: formatBytes(cacheSize), path: ".cache" },
        dist: { size: distSize, label: formatBytes(distSize), path: "dist" },
        attachedAssets: { size: attachedSize, label: formatBytes(attachedSize), count: attachedCount, path: "attached_assets" },
        tmp: { size: tmpSize, label: formatBytes(tmpSize), count: tmpCount, path: "/tmp" },
        logs: { count: logCount, path: "/tmp/logs" },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/cleanup", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { targets } = req.body;
      if (!targets || !Array.isArray(targets)) return res.status(400).json({ error: "targets array required" });
      const workspace = "/home/runner/workspace";
      const results: Record<string, { freed: string; status: string }> = {};

      for (const target of targets) {
        try {
          switch (target) {
            case "build_cache": {
              const before = parseInt(execSync(`du -sb "${workspace}/.cache" 2>/dev/null`).toString().split("\t")[0] || "0");
              execSync(`rm -rf "${workspace}/.cache"`, { timeout: 30000 });
              results.build_cache = { freed: formatBytes(before), status: "cleared" };
              break;
            }
            case "dist": {
              const before = parseInt(execSync(`du -sb "${workspace}/dist" 2>/dev/null`).toString().split("\t")[0] || "0");
              execSync(`rm -rf "${workspace}/dist"`, { timeout: 30000 });
              results.dist = { freed: formatBytes(before), status: "cleared" };
              break;
            }
            case "tmp_files": {
              const before = parseInt(execSync(`du -sb /tmp 2>/dev/null`).toString().split("\t")[0] || "0");
              execSync(`find /tmp -maxdepth 1 -type f -name "*.tmp" -delete 2>/dev/null; find /tmp -maxdepth 1 -type d -empty -delete 2>/dev/null`, { timeout: 15000 });
              execSync(`rm -rf /tmp/logs/*.log 2>/dev/null`, { timeout: 10000 });
              const after = parseInt(execSync(`du -sb /tmp 2>/dev/null`).toString().split("\t")[0] || "0");
              results.tmp_files = { freed: formatBytes(Math.max(0, before - after)), status: "cleaned" };
              break;
            }
            case "duplicate_assets": {
              const assetDir = `${workspace}/attached_assets`;
              if (fs.existsSync(assetDir)) {
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
                let freedBytes = 0;
                for (const [, group] of Object.entries(filesByBase)) {
                  if (group.length <= 1) continue;
                  group.sort((a, b) => b.mtime - a.mtime);
                  for (let i = 1; i < group.length; i++) {
                    if (group[i].size === group[0].size) {
                      try {
                        fs.unlinkSync(path.join(assetDir, group[i].name));
                        freedBytes += group[i].size;
                        removed++;
                      } catch {}
                    }
                  }
                }
                results.duplicate_assets = { freed: formatBytes(freedBytes), status: `removed ${removed} duplicates` };
              } else {
                results.duplicate_assets = { freed: "0 B", status: "no assets directory" };
              }
              break;
            }
          }
        } catch (err: any) {
          results[target] = { freed: "0 B", status: `error: ${err.message}` };
        }
      }
      res.json({ success: true, results });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/site-audit", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      type AuditIssue = { severity: "error" | "warning" | "info"; section: string; category: string; message: string; count: number; ids?: (number | string)[] };
      const issues: AuditIssue[] = [];

      // ── SECTION 1: CATALOG ───────────────────────────────────────────────────
      const [allBooks, allDrafts, allOrderItems, allOrders, allReadingAccess, allSubscriptions, allActiveCheckouts] = await Promise.all([
        db.select().from(books),
        db.select().from(draftEbooks),
        db.select().from(orderItems),
        db.select().from(orders),
        db.select().from(readingAccess),
        db.select().from(subscriptions),
        db.select().from(activeCheckouts),
      ]);

      const bookIds = new Set(allBooks.map(b => b.id));

      // Build draft content lookup by title (books table content is intentionally empty;
      // actual content lives in draft_ebooks and is served from there by the reader)
      const draftContentByTitle = new Map<string, string>();
      for (const d of allDrafts) {
        if (d.title && d.content) draftContentByTitle.set(d.title.trim().toLowerCase(), d.content);
      }
      const getBookContent = (b: { title: string }) => draftContentByTitle.get(b.title.trim().toLowerCase()) ?? null;

      // Covers
      const missingCover = allBooks.filter(b => !b.coverUrl || b.coverUrl.trim() === "");
      if (missingCover.length) issues.push({ severity: "error", section: "Catalog", category: "Covers", message: "Published books missing cover image", count: missingCover.length, ids: missingCover.map(b => b.id) });

      const localCoverPath = allBooks.filter(b => b.coverUrl && (b.coverUrl.startsWith("/uploads/") || b.coverUrl.startsWith("./uploads/")));
      if (localCoverPath.length) issues.push({ severity: "warning", section: "Catalog", category: "Covers", message: "Books with local (non-cloud) cover paths — will break on redeploy", count: localCoverPath.length, ids: localCoverPath.map(b => b.id) });

      const weirdCoverUrl = allBooks.filter(b => b.coverUrl && !b.coverUrl.startsWith("/objstore/") && !b.coverUrl.startsWith("https://") && !b.coverUrl.startsWith("/uploads/") && !b.coverUrl.startsWith("./uploads/"));
      if (weirdCoverUrl.length) issues.push({ severity: "warning", section: "Catalog", category: "Covers", message: "Books with unrecognized cover URL format", count: weirdCoverUrl.length, ids: weirdCoverUrl.map(b => b.id) });

      // Pricing
      const missingPrice = allBooks.filter(b => !b.price || parseFloat(b.price) <= 0);
      if (missingPrice.length) issues.push({ severity: "error", section: "Catalog", category: "Pricing", message: "Books with no price set", count: missingPrice.length, ids: missingPrice.map(b => b.id) });

      const overpriced = allBooks.filter(b => b.price && parseFloat(b.price) > 14.99 && b.genre !== "Classic");
      if (overpriced.length) issues.push({ severity: "warning", section: "Catalog", category: "Pricing", message: "Books priced above $14.99 (max pricing policy)", count: overpriced.length, ids: overpriced.map(b => b.id) });

      // Metadata
      const missingGenre = allBooks.filter(b => !b.genre || b.genre.trim() === "");
      if (missingGenre.length) issues.push({ severity: "warning", section: "Catalog", category: "Metadata", message: "Books missing genre", count: missingGenre.length, ids: missingGenre.map(b => b.id) });

      const missingDescription = allBooks.filter(b => !b.description || b.description.trim().length < 50);
      if (missingDescription.length) issues.push({ severity: "warning", section: "Catalog", category: "Metadata", message: "Books with missing or very short description (<50 chars)", count: missingDescription.length, ids: missingDescription.map(b => b.id) });

      const missingAuthor = allBooks.filter(b => !b.author || b.author.trim() === "");
      if (missingAuthor.length) issues.push({ severity: "warning", section: "Catalog", category: "Metadata", message: "Books missing author name", count: missingAuthor.length, ids: missingAuthor.map(b => b.id) });

      // Content (uses draft_ebooks content via title lookup — books table content is empty by design)
      const unprocessedIllustrations = allBooks.filter(b => { const c = getBookContent(b); return c && /\[ILLUSTRATION:\s*[^\]]+\]/.test(c) && !/\[ILLUSTRATION:\s*\//.test(c); });
      if (unprocessedIllustrations.length) issues.push({ severity: "error", section: "Catalog", category: "Illustrations", message: "Books with unprocessed illustration markers (image not yet generated)", count: unprocessedIllustrations.length, ids: unprocessedIllustrations.map(b => b.id) });

      const noContent = allBooks.filter(b => { const c = getBookContent(b); return !c || c.trim().length === 0; });
      if (noContent.length) issues.push({ severity: "error", section: "Catalog", category: "Content", message: "Books with completely empty content (no matching draft found)", count: noContent.length, ids: noContent.map(b => b.id) });

      const shortContent = allBooks.filter(b => { const c = getBookContent(b); return c && c.trim().length < 5000 && c.trim().length > 0 && b.genre !== "Classic"; });
      if (shortContent.length) issues.push({ severity: "warning", section: "Catalog", category: "Content", message: "Non-classic books with very short content (<5k chars) — may be stubs", count: shortContent.length, ids: shortContent.map(b => b.id) });

      // Duplicates
      const titleMap = new Map<string, number[]>();
      for (const b of allBooks) {
        const key = b.title.trim().toLowerCase();
        if (!titleMap.has(key)) titleMap.set(key, []);
        titleMap.get(key)!.push(b.id);
      }
      const dupes = [...titleMap.values()].filter(ids => ids.length > 1);
      if (dupes.length) issues.push({ severity: "error", section: "Catalog", category: "Duplicates", message: "Exact duplicate book titles in catalog", count: dupes.reduce((a, b) => a + b.length, 0), ids: dupes.flat() });

      // Drafts
      const orphanedDrafts = allDrafts.filter(d => d.status === "published" && !allBooks.some(b => b.title.toLowerCase() === d.title?.toLowerCase()));
      if (orphanedDrafts.length) issues.push({ severity: "info", section: "Catalog", category: "Drafts", message: "Drafts marked published but no matching book in catalog", count: orphanedDrafts.length });

      // ── SECTION 2: LINK INTEGRITY ────────────────────────────────────────────
      const booksWithContent = allBooks.filter(b => getBookContent(b));
      let brokenIllustrationLinks = 0;
      const brokenIllustIds: number[] = [];
      for (const b of booksWithContent) {
        const content = getBookContent(b)!;
        const matches = content.matchAll(/\[ILLUSTRATION:\s*(\/[^\|\]]+)/g);
        for (const m of matches) {
          const p = m[1].split(" | ")[0].trim();
          // Check for clearly broken patterns (empty path, wrong extension, etc.)
          if (!p || p.length < 5 || (!p.match(/\.(png|jpg|jpeg|webp)/i) && !p.startsWith("/objstore/"))) {
            brokenIllustrationLinks++;
            if (!brokenIllustIds.includes(b.id)) brokenIllustIds.push(b.id);
          }
        }
      }
      if (brokenIllustrationLinks > 0) issues.push({ severity: "warning", section: "Links", category: "Illustrations", message: `Illustration URL entries with unrecognized format`, count: brokenIllustrationLinks, ids: brokenIllustIds });

      const localIllustrationPaths = booksWithContent.filter(b => /\[ILLUSTRATION:\s*\/uploads\/illustrations\//.test(getBookContent(b)!));
      if (localIllustrationPaths.length) issues.push({ severity: "warning", section: "Links", category: "Illustrations", message: "Books with illustration paths still pointing to local /uploads/ (not cloud)", count: localIllustrationPaths.length, ids: localIllustrationPaths.map(b => b.id) });

      const cloudCovers = allBooks.filter(b => b.coverUrl && b.coverUrl.startsWith("/objstore/")).length;
      const totalWithCover = allBooks.filter(b => b.coverUrl && b.coverUrl.trim() !== "").length;
      if (totalWithCover > 0 && cloudCovers < totalWithCover) {
        issues.push({ severity: "info", section: "Links", category: "Covers", message: `${totalWithCover - cloudCovers} of ${totalWithCover} covers are not yet backed up to cloud storage`, count: totalWithCover - cloudCovers });
      }

      // ── SECTION 3: CUSTOMER HEALTH ───────────────────────────────────────────
      // Orders with no items
      const ordersWithItems = new Set(allOrderItems.map(oi => oi.orderId));
      const completedOrders = allOrders.filter(o => o.status === "completed");
      const emptyOrders = completedOrders.filter(o => !ordersWithItems.has(o.id));
      if (emptyOrders.length) issues.push({ severity: "error", section: "Customers", category: "Orders", message: "Completed orders with no line items (revenue not tracked correctly)", count: emptyOrders.length, ids: emptyOrders.map(o => o.id) });

      // Order items referencing deleted books
      const orphanedOrderItems = allOrderItems.filter(oi => !bookIds.has(oi.bookId));
      if (orphanedOrderItems.length) issues.push({ severity: "warning", section: "Customers", category: "Orders", message: "Order line items pointing to books that no longer exist in catalog", count: orphanedOrderItems.length, ids: [...new Set(orphanedOrderItems.map(oi => oi.bookId))] });

      // Reading access pointing to deleted books
      const orphanedAccess = allReadingAccess.filter(ra => !bookIds.has(ra.bookId));
      if (orphanedAccess.length) issues.push({ severity: "warning", section: "Customers", category: "Reading Access", message: "Reading access records for books not in catalog", count: orphanedAccess.length, ids: [...new Set(orphanedAccess.map(ra => ra.bookId))] });

      // Expired reading access (still in table, access is past)
      const now = new Date();
      const expiredAccess = allReadingAccess.filter(ra => ra.expiresAt && new Date(ra.expiresAt) < now);
      if (expiredAccess.length) issues.push({ severity: "info", section: "Customers", category: "Reading Access", message: "Expired reading access records still in database (safe, but can be cleaned up)", count: expiredAccess.length });

      // Active checkouts pointing to deleted books
      const orphanedCheckouts = allActiveCheckouts.filter(c => !c.returnedAt && !bookIds.has(c.bookId));
      if (orphanedCheckouts.length) issues.push({ severity: "error", section: "Customers", category: "Library Checkouts", message: "Open library checkouts for books that no longer exist (subscriber stuck)", count: orphanedCheckouts.length, ids: orphanedCheckouts.map(c => c.id) });

      // Very old open checkouts (30+ days without return)
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const staleCheckouts = allActiveCheckouts.filter(c => !c.returnedAt && new Date(c.checkedOutAt) < thirtyDaysAgo);
      if (staleCheckouts.length) issues.push({ severity: "info", section: "Customers", category: "Library Checkouts", message: "Library checkouts open for 30+ days (subscriber may have forgotten to return)", count: staleCheckouts.length, ids: staleCheckouts.map(c => c.id) });

      // Subscriptions marked active but with expired billing period
      const expiredSubs = allSubscriptions.filter(s => s.status === "active" && s.currentPeriodEnd && new Date(s.currentPeriodEnd) < now);
      if (expiredSubs.length) issues.push({ severity: "error", section: "Customers", category: "Subscriptions", message: "Subscriptions marked active but billing period has expired (may need Stripe sync)", count: expiredSubs.length, ids: expiredSubs.map(s => s.id) });

      // Duplicate active subscriptions per customer
      const subsByEmail = new Map<string, number>();
      for (const s of allSubscriptions.filter(s => s.status === "active")) {
        subsByEmail.set(s.customerEmail, (subsByEmail.get(s.customerEmail) || 0) + 1);
      }
      const dupeSubs = [...subsByEmail.entries()].filter(([, count]) => count > 1);
      if (dupeSubs.length) issues.push({ severity: "error", section: "Customers", category: "Subscriptions", message: "Customers with multiple active subscriptions simultaneously", count: dupeSubs.length, ids: dupeSubs.map(([email]) => email) });

      // Subscriptions with no Stripe ID (not properly linked to Stripe)
      const unlinkedSubs = allSubscriptions.filter(s => s.status === "active" && !s.stripeSubscriptionId);
      if (unlinkedSubs.length) issues.push({ severity: "warning", section: "Customers", category: "Subscriptions", message: "Active subscriptions with no Stripe subscription ID (payment not linked)", count: unlinkedSubs.length, ids: unlinkedSubs.map(s => s.id) });

      // ── SECTION 4: PERFORMANCE ───────────────────────────────────────────────
      // Cover images not in WebP format (WebP is ~30% smaller than JPEG)
      const nonWebpCovers = allBooks.filter(b => b.coverUrl && b.coverUrl.trim() !== "" && !b.coverUrl.toLowerCase().endsWith(".webp") && !b.coverUrl.startsWith("/objstore/"));
      if (nonWebpCovers.length) issues.push({ severity: "info", section: "Performance", category: "Images", message: `${nonWebpCovers.length} covers not in WebP format — converting to WebP reduces file size ~30% and speeds up page loads`, count: nonWebpCovers.length, ids: nonWebpCovers.map(b => b.id) });

      // Books with extremely large content (slow reader load)
      const heavyBooks = allBooks.filter(b => { const c = getBookContent(b); return c && c.length > 300000; });
      if (heavyBooks.length) issues.push({ severity: "warning", section: "Performance", category: "Content Size", message: "Books with content over 300k characters — these load slowly in the reader", count: heavyBooks.length, ids: heavyBooks.map(b => b.id) });

      // Books with very high illustration counts (many image requests = slow reader)
      const illustrationCountMap = allBooks.map(b => ({
        id: b.id,
        count: (getBookContent(b)?.match(/\[ILLUSTRATION:\s*\//g) || []).length,
      }));
      const overloadedIllust = illustrationCountMap.filter(b => b.count > 30);
      if (overloadedIllust.length) issues.push({ severity: "info", section: "Performance", category: "Images", message: "Books with 30+ illustrations — each image is a network request; reader may load slowly on mobile", count: overloadedIllust.length, ids: overloadedIllust.map(b => b.id) });

      // Database: books missing content but published (loads a blank reader page)
      const publishedStubs = allBooks.filter(b => { const c = getBookContent(b); return !c || c.trim().length < 500; });
      if (publishedStubs.length) issues.push({ severity: "warning", section: "Performance", category: "Content", message: "Published books with near-empty content — reader page loads blank or incomplete", count: publishedStubs.length, ids: publishedStubs.map(b => b.id) });

      // Books without a rating (SEO/discovery gap — unrated books rank lower)
      const noRating = allBooks.filter(b => !b.rating || parseFloat(b.rating) === 0);
      if (noRating.length) issues.push({ severity: "info", section: "Performance", category: "SEO", message: "Books with no star rating — ratings improve catalog ranking and conversion", count: noRating.length, ids: noRating.map(b => b.id) });

      // Books with titles over 80 chars (SEO titles should be concise)
      const longTitles = allBooks.filter(b => b.title && b.title.length > 80);
      if (longTitles.length) issues.push({ severity: "info", section: "Performance", category: "SEO", message: "Books with very long titles (>80 chars) — long titles are truncated in search results and social shares", count: longTitles.length, ids: longTitles.map(b => b.id) });

      // Compute performance score (0-100)
      const perfIssues = issues.filter(i => i.section === "Performance");
      const perfScore = Math.max(0, 100 - (perfIssues.filter(i => i.severity === "warning").length * 15) - (perfIssues.filter(i => i.severity === "info").length * 5));

      // ── SUMMARY ──────────────────────────────────────────────────────────────
      const stats = {
        totalBooks: allBooks.length,
        totalOrders: completedOrders.length,
        totalSubscribers: allSubscriptions.filter(s => s.status === "active").length,
        totalIssues: issues.length,
        errors: issues.filter(i => i.severity === "error").length,
        warnings: issues.filter(i => i.severity === "warning").length,
        info: issues.filter(i => i.severity === "info").length,
        perfScore,
        bySection: {
          catalog: issues.filter(i => i.section === "Catalog").length,
          links: issues.filter(i => i.section === "Links").length,
          customers: issues.filter(i => i.section === "Customers").length,
          performance: issues.filter(i => i.section === "Performance").length,
        },
      };

      res.json({ success: true, stats, issues, runAt: new Date().toISOString() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/export-drafts", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const allDrafts = await db.select().from(draftEbooks).orderBy(desc(draftEbooks.createdAt));
      const CHUNK_SIZE = 10;
      const chunks = [];
      for (let i = 0; i < allDrafts.length; i += CHUNK_SIZE) {
        chunks.push(allDrafts.slice(i, i + CHUNK_SIZE));
      }

      const bucketName = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",")[0]?.trim().split("/")[1];
      if (!bucketName) {
        return res.status(500).json({ error: "Object storage not configured" });
      }

      const { Storage } = await import("@google-cloud/storage");
      const gcs = new Storage({
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
      const bucket = gcs.bucket(bucketName);

      res.json({ success: true, totalDrafts: allDrafts.length, totalChunks: chunks.length, status: "started" });

      console.log(`[Sync Export] Starting export of ${allDrafts.length} drafts in ${chunks.length} chunks...`);
      const manifest = {
        exportedAt: new Date().toISOString(),
        totalDrafts: allDrafts.length,
        totalChunks: chunks.length,
        chunkSize: CHUNK_SIZE,
        complete: false,
      };
      await bucket.file("sync/drafts-manifest.json").save(JSON.stringify(manifest), { contentType: "application/json" });

      for (let i = 0; i < chunks.length; i++) {
        await bucket.file(`sync/drafts-chunk-${i}.json`).save(JSON.stringify(chunks[i]), { contentType: "application/json" });
        console.log(`[Sync Export] Uploaded chunk ${i + 1}/${chunks.length} (${chunks[i].length} drafts)`);
      }

      manifest.complete = true;
      await bucket.file("sync/drafts-manifest.json").save(JSON.stringify(manifest), { contentType: "application/json" });
      console.log(`[Sync Export] Complete! ${allDrafts.length} drafts exported.`);
    } catch (error: any) {
      console.error("[Sync Export] Error:", error);
    }
  });

  app.post("/api/admin/export-published-books", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    try {
      const allBooks = await db.select().from(books).orderBy(books.id);
      const CHUNK_SIZE = 50;
      const chunks: (typeof allBooks)[] = [];
      for (let i = 0; i < allBooks.length; i += CHUNK_SIZE) {
        chunks.push(allBooks.slice(i, i + CHUNK_SIZE));
      }

      const bucketName = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",")[0]?.trim().split("/")[1];
      if (!bucketName) {
        return res.status(500).json({ error: "Object storage not configured" });
      }

      const { Storage } = await import("@google-cloud/storage");
      const gcs = new Storage({
        credentials: {
          audience: "replit", subject_token_type: "access_token",
          token_url: "http://127.0.0.1:1106/token", type: "external_account",
          credential_source: { url: "http://127.0.0.1:1106/credential", format: { type: "json", subject_token_field_name: "access_token" } },
          universe_domain: "googleapis.com",
        },
        projectId: "",
      });
      const bucket = gcs.bucket(bucketName);

      res.json({ success: true, totalBooks: allBooks.length, totalChunks: chunks.length, status: "started" });

      console.log(`[Books Export] Exporting ${allBooks.length} books in ${chunks.length} chunks...`);
      const manifest = { exportedAt: new Date().toISOString(), totalBooks: allBooks.length, totalChunks: chunks.length, chunkSize: CHUNK_SIZE, complete: false };
      await bucket.file("sync/books-manifest.json").save(JSON.stringify(manifest), { contentType: "application/json" });

      for (let i = 0; i < chunks.length; i++) {
        await bucket.file(`sync/books-chunk-${i}.json`).save(JSON.stringify(chunks[i]), { contentType: "application/json" });
        console.log(`[Books Export] Chunk ${i + 1}/${chunks.length} (${chunks[i].length} books)`);
      }

      manifest.complete = true;
      await bucket.file("sync/books-manifest.json").save(JSON.stringify(manifest), { contentType: "application/json" });
      console.log(`[Books Export] Complete! ${allBooks.length} books exported.`);
    } catch (error: any) {
      console.error("[Books Export] Error:", error);
    }
  });

  app.post("/api/admin/import-published-books", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Admin authentication required" });
    }
    try {
      const bucketName = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",")[0]?.trim().split("/")[1];
      if (!bucketName) {
        return res.status(500).json({ error: "Object storage not configured" });
      }

      const { Storage } = await import("@google-cloud/storage");
      const gcs = new Storage({
        credentials: {
          audience: "replit", subject_token_type: "access_token",
          token_url: "http://127.0.0.1:1106/token", type: "external_account",
          credential_source: { url: "http://127.0.0.1:1106/credential", format: { type: "json", subject_token_field_name: "access_token" } },
          universe_domain: "googleapis.com",
        },
        projectId: "",
      });
      const bucket = gcs.bucket(bucketName);

      const [manifestBuf] = await bucket.file("sync/books-manifest.json").download();
      const manifest = JSON.parse(manifestBuf.toString());

      if (!manifest.complete) {
        return res.status(400).json({ error: "Export is still in progress. Wait for it to complete before importing." });
      }

      res.json({ success: true, total: manifest.totalBooks, totalChunks: manifest.totalChunks, status: "started" });

      console.log(`[Books Import] Starting import of ${manifest.totalBooks} books from ${manifest.totalChunks} chunks...`);
      let inserted = 0, updated = 0;
      for (let i = 0; i < manifest.totalChunks; i++) {
        const [chunkBuf] = await bucket.file(`sync/books-chunk-${i}.json`).download();
        const bookChunk: any[] = JSON.parse(chunkBuf.toString());
        for (const b of bookChunk) {
          const existing = await db.select({ id: books.id }).from(books).where(eq(books.id, b.id)).limit(1);
          const payload = {
            title: b.title,
            author: b.author,
            genre: b.genre,
            category: b.category,
            price: b.price,
            description: b.description ?? null,
            coverUrl: b.cover_url ?? b.coverUrl,
            visible: b.visible ?? true,
            rating: b.rating ?? "4.50",
            subscriberExclusiveUntil: b.subscriber_exclusive_until ? new Date(b.subscriber_exclusive_until) : (b.subscriberExclusiveUntil ? new Date(b.subscriberExclusiveUntil) : null),
            createdAt: b.created_at ? new Date(b.created_at) : (b.createdAt ? new Date(b.createdAt) : new Date()),
          };
          if (existing.length > 0) {
            await db.update(books).set(payload).where(eq(books.id, b.id));
            updated++;
          } else {
            await db.insert(books).values({ id: b.id, ...payload });
            inserted++;
          }
        }
        console.log(`[Books Import] Chunk ${i + 1}/${manifest.totalChunks} (inserted: ${inserted}, updated: ${updated})`);
      }
      await db.execute(sql`SELECT setval('books_id_seq', (SELECT COALESCE(MAX(id), 1) FROM books), true)`);
      console.log(`[Books Import] Complete! Inserted: ${inserted}, Updated: ${updated}`);
    } catch (error: any) {
      console.error("[Books Import] Error:", error);
    }
  });

  app.post("/api/admin/recalculate-prices", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const scope = (req.body?.scope as string) || "drafts";
      let updated = 0;

      if (scope === "drafts" || scope === "all") {
        const allDrafts = await db.select({
          id: draftEbooks.id,
          title: draftEbooks.title,
          genre: draftEbooks.genre,
          content: draftEbooks.content,
          outline: draftEbooks.outline,
        }).from(draftEbooks).where(sql`${draftEbooks.status} != 'published'`);

        for (const draft of allDrafts) {
          if (!draft.content || draft.content.trim().length < 100) continue;
          const newPrice = contentStudio.calculateEbookPrice({
            content: draft.content,
            genre: draft.genre,
            outline: draft.outline,
            title: draft.title,
          });
          await db.update(draftEbooks).set({ suggestedPrice: newPrice }).where(eq(draftEbooks.id, draft.id));
          updated++;
        }
      }

      if (scope === "published" || scope === "all") {
        const publishedDrafts = await db.select({
          id: draftEbooks.id,
          title: draftEbooks.title,
          genre: draftEbooks.genre,
          content: draftEbooks.content,
          outline: draftEbooks.outline,
        }).from(draftEbooks).where(eq(draftEbooks.status, "published"));

        for (const draft of publishedDrafts) {
          if (!draft.content || draft.content.trim().length < 100) continue;
          const newPrice = contentStudio.calculateEbookPrice({
            content: draft.content,
            genre: draft.genre,
            outline: draft.outline,
            title: draft.title,
          });
          await db.update(draftEbooks).set({ suggestedPrice: newPrice }).where(eq(draftEbooks.id, draft.id));
          updated++;
          const matchingBooks = await db.select({ id: books.id }).from(books)
            .where(sql`LOWER(${books.title}) = LOWER(${draft.title})`);
          for (const book of matchingBooks) {
            await db.update(books).set({ price: newPrice }).where(eq(books.id, book.id));
          }
        }
      }

      res.json({ success: true, updated, scope });
    } catch (error: any) {
      console.error("Recalculate prices error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/sync-status", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const bucketName = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",")[0]?.trim().split("/")[1];
      if (!bucketName) {
        return res.status(500).json({ error: "Object storage not configured" });
      }
      const { Storage } = await import("@google-cloud/storage");
      const gcs = new Storage({
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
      const bucket = gcs.bucket(bucketName);
      const [manifestBuffer] = await bucket.file("sync/drafts-manifest.json").download();
      const manifest = JSON.parse(manifestBuffer.toString());
      res.json({ success: true, manifest });
    } catch (error: any) {
      res.json({ success: false, error: error.message });
    }
  });

  app.post("/api/admin/import-drafts", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const bucketName = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",")[0]?.trim().split("/")[1];
      if (!bucketName) {
        return res.status(500).json({ error: "Object storage not configured" });
      }

      const { Storage } = await import("@google-cloud/storage");
      const gcs = new Storage({
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
      const bucket = gcs.bucket(bucketName);

      const [manifestBuffer] = await bucket.file("sync/drafts-manifest.json").download();
      const manifest = JSON.parse(manifestBuffer.toString());

      if (!manifest.complete) {
        return res.status(400).json({ error: "Export is still in progress. Wait for it to complete before importing." });
      }

      res.json({ success: true, total: manifest.totalDrafts, totalChunks: manifest.totalChunks, status: "started" });

      console.log(`[Sync Import] Starting import of ${manifest.totalDrafts} drafts from ${manifest.totalChunks} chunks...`);
      let imported = 0;
      let updated = 0;
      for (let i = 0; i < manifest.totalChunks; i++) {
        const [chunkBuffer] = await bucket.file(`sync/drafts-chunk-${i}.json`).download();
        const draftsChunk = JSON.parse(chunkBuffer.toString());

        for (const draft of draftsChunk) {
          const existing = await db.select({ id: draftEbooks.id }).from(draftEbooks).where(eq(draftEbooks.id, draft.id)).limit(1);
          if (existing.length > 0) {
            await db.update(draftEbooks).set({
              title: draft.title,
              genre: draft.genre,
              topic: draft.topic,
              description: draft.description,
              outline: draft.outline,
              content: draft.content,
              coverUrl: draft.cover_url || draft.coverUrl,
              backgroundUrl: draft.background_url || draft.backgroundUrl,
              pdfUrl: draft.pdf_url || draft.pdfUrl,
              suggestedPrice: draft.suggested_price || draft.suggestedPrice,
              status: draft.status,
              coverStyleId: draft.cover_style_id || draft.coverStyleId,
              overlayApproved: draft.overlay_approved ?? draft.overlayApproved ?? false,
            }).where(eq(draftEbooks.id, draft.id));
            updated++;
          } else {
            await db.execute(sql`INSERT INTO draft_ebooks (id, title, genre, topic, description, outline, content, cover_url, background_url, pdf_url, suggested_price, status, cover_style_id, overlay_approved, created_at)
              VALUES (${draft.id}, ${draft.title}, ${draft.genre}, ${draft.topic}, ${draft.description || null}, ${draft.outline || null}, ${draft.content || null}, ${draft.cover_url || draft.coverUrl || null}, ${draft.background_url || draft.backgroundUrl || null}, ${draft.pdf_url || draft.pdfUrl || null}, ${draft.suggested_price || draft.suggestedPrice || null}, ${draft.status}, ${draft.cover_style_id || draft.coverStyleId || null}, ${draft.overlay_approved ?? draft.overlayApproved ?? false}, ${draft.created_at || draft.createdAt || new Date().toISOString()})
              ON CONFLICT (id) DO NOTHING`);
            imported++;
          }
        }
        console.log(`[Sync Import] Processed chunk ${i + 1}/${manifest.totalChunks} (imported: ${imported}, updated: ${updated})`);
      }

      await db.execute(sql`SELECT setval('draft_ebooks_id_seq', (SELECT COALESCE(MAX(id), 1) FROM draft_ebooks), true)`);
      console.log(`[Sync Import] Complete! Imported: ${imported}, Updated: ${updated}, Total: ${manifest.totalDrafts}`);
    } catch (error: any) {
      console.error("[Sync Import] Error:", error);
    }
  });

  app.get("/api/dynamic-content/:section", async (req, res) => {
    try {
      const { section } = req.params;
      const content = await contentRefresh.getDynamicContent(section);
      if (!content) {
        return res.json({ data: null, refreshedAt: null });
      }
      res.json(content);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/content-refresh", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const { sections } = req.body;
      res.json({ message: "Content refresh started", status: "running" });
      
      contentRefresh.runContentRefresh(sections).then(result => {
        console.log("[ContentRefresh] Manual refresh completed:", JSON.stringify(result.results));
      }).catch(err => {
        console.error("[ContentRefresh] Manual refresh error:", err.message);
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/content-refresh/history", async (req, res) => {
    if (!isAdminAuthenticated(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const history = await contentRefresh.getRefreshHistory();
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  registerChatRoutes(app, isAdminAuthenticated);

  const customerChatOpenai = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });

  const CUSTOMER_CHAT_SYSTEM = `You are the EbookGamez customer support assistant. You help customers with:
- Finding books in our catalog (545+ ebooks across many genres)
- Purchase questions and order support
- Reading Pass subscription information (5-tier monthly plans)
- Technical support for ebook downloads and reading
- Game-related questions (1000+ free browser games)
- General inquiries about EbookGamez

Key info:
- Email: ebookgames@yahoo.com
- Business address: P.O. Box 1181, Las Vegas, NV 89125
- First-time customers get 10% off with code WELCOME10
- All ebooks are digital products delivered electronically
- Payments processed by Stripe
- Refund requests within 14 days at ebookgames@yahoo.com

If a customer wants to speak with a live agent, let them know they can use the "Schedule a Call" button in this chat to book an appointment during available hours. Available times are:
- Tuesday, Wednesday, Sunday: 3:00 PM - 7:00 PM PST
- Monday, Thursday, Friday, Saturday: 7:30 PM - 9:00 PM PST

Be friendly, helpful, and concise. Keep responses under 150 words unless the customer needs detailed help.`;

  const customerChatHistories = new Map<number, { role: string; content: string }[]>();
  const MAX_CHAT_HISTORY_KEYS = 500;

  const customerChatRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Please slow down." },
  });

  app.post("/api/customer-chat", customerChatRateLimit, async (req, res) => {
    try {
      const { message, conversationId } = req.body;
      if (!message) return res.status(400).json({ error: "Message required" });
      if (typeof message !== "string" || message.length > 2000) {
        return res.status(400).json({ error: "Message too long" });
      }

      let history = customerChatHistories.get(conversationId) || [];
      history.push({ role: "user", content: message });
      if (history.length > 20) history = history.slice(-20);
      if (customerChatHistories.size >= MAX_CHAT_HISTORY_KEYS) {
        const firstKey = customerChatHistories.keys().next().value;
        if (firstKey !== undefined) customerChatHistories.delete(firstKey);
      }
      customerChatHistories.set(conversationId, history);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await customerChatOpenai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: CUSTOMER_CHAT_SYSTEM },
          ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
        stream: true,
        max_completion_tokens: 512,
      });

      let fullResponse = "";
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      history.push({ role: "assistant", content: fullResponse });
      customerChatHistories.set(conversationId, history);

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Customer chat error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Chat error" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Chat failed" });
      }
    }
  });

  app.post("/api/customer-chat/schedule", async (req, res) => {
    try {
      const { name, email, date, time, timezone } = req.body;
      console.log(`[Appointment] ${name} (${email}) scheduled for ${date} at ${time} ${timezone}`);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to schedule" });
    }
  });

  app.get("/api/books/:id/preview", async (req, res) => {
    try {
      const bookId = parseInt(req.params.id);
      if (isNaN(bookId)) return res.status(400).json({ error: "Invalid book ID" });
      const book = await storage.getBookById(bookId);
      if (!book) return res.status(404).json({ error: "Book not found" });

      const [draft] = await db.select({ id: draftEbooks.id, content: draftEbooks.content, title: draftEbooks.title })
        .from(draftEbooks)
        .where(sql`${draftEbooks.title} = ${book.title} AND ${draftEbooks.content} IS NOT NULL AND length(${draftEbooks.content}) > 100`)
        .limit(1);
      if (!draft || !draft.content) return res.status(404).json({ error: "No preview available" });

      const lines = draft.content.split("\n");
      let chapterStart = -1;
      let chapterEnd = lines.length;
      let chapterTitle = "Chapter 1";
      let foundFirst = false;

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        const isChapterHeading = /^#{1,2}\s*\**\s*Chapter\s+\d+/i.test(trimmed) ||
                                  /^#{1,2}\s*\**\s*Part\s+\d+/i.test(trimmed);
        if (isChapterHeading) {
          if (!foundFirst) {
            chapterStart = i;
            chapterTitle = trimmed.replace(/^#+\s*\**\s*/, "").replace(/\**\s*$/, "");
            foundFirst = true;
          } else {
            chapterEnd = i;
            break;
          }
        }
      }

      const hasChapters = foundFirst;

      // Only apply a 5-page cap for genuinely visual/illustration-only genres.
      // Prose fiction & non-fiction books frequently omit explicit chapter headings
      // but still contain full prose — show them without a page limit.
      const VISUAL_GENRES = new Set([
        "Coloring Books", "Art Books", "Art & Design", "Comics", "Graphic Novels",
        "Photography Books", "Activity Books", "Workbooks",
      ]);
      const isVisualGenre = VISUAL_GENRES.has(book.genre ?? "");

      if (!hasChapters && isVisualGenre) {
        // Coloring Books: swap text descriptions for real GCS image URLs so the
        // flipbook renders actual pages instead of prose descriptions.
        if (book.genre === "Coloring Books") {
          const PREVIEW_PAGES = 3;
          let colorContent = "";
          for (let p = 1; p <= PREVIEW_PAGES; p++) {
            const padded = String(p).padStart(3, "0");
            colorContent += `[ILLUSTRATION: /objstore/coloring-pages/${draft.id}/page-${padded}.png | Page ${p}]\n\n`;
          }
          return res.json({
            title: book.title,
            chapterTitle: book.title,
            content: colorContent.trim(),
            totalWords: 0,
            coverUrl: book.coverUrl ?? null,
            genre: book.genre ?? "",
            price: book.price ?? null,
            previewPageLimit: PREVIEW_PAGES,
          });
        }
        // Other visual genres — return up to 400 lines; frontend caps at 5 pages.
        const previewLines = lines.slice(0, 400);
        return res.json({
          title: book.title,
          chapterTitle: book.title,
          content: previewLines.join("\n"),
          totalWords: lines.join(" ").split(/\s+/).length,
          coverUrl: book.coverUrl ?? null,
          genre: book.genre ?? "",
          price: book.price ?? null,
          previewPageLimit: 5,
        });
      }

      if (!hasChapters) {
        // Prose book without explicit chapter markers — show first 6 pages worth.
        const previewLines = lines.slice(0, 500);
        return res.json({
          title: book.title,
          chapterTitle: "Chapter One",
          content: previewLines.join("\n"),
          totalWords: lines.join(" ").split(/\s+/).length,
          coverUrl: book.coverUrl ?? null,
          genre: book.genre ?? "",
          price: book.price ?? null,
          previewPageLimit: 6,
        });
      }

      if (chapterStart === -1) chapterStart = 0;
      const chapterLines = lines.slice(chapterStart + 1, chapterEnd);

      res.json({
        title: book.title,
        chapterTitle,
        content: chapterLines.join("\n"),
        totalWords: chapterLines.join(" ").split(/\s+/).length,
        coverUrl: book.coverUrl ?? null,
        genre: book.genre ?? "",
        price: book.price ?? null,
        previewPageLimit: null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to load preview" });
    }
  });

  app.get("/api/admin/author-library", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const classicGenres = ["Classic Literature", "Classic Adventure", "Classic Drama", "Classic Epic", "Classic Fantasy", "Classic Horror", "Classic Mystery", "Classic Philosophy", "Classic Romance", "Classic Science Fiction"];
      
      const drafts = await db.select({
        id: draftEbooks.id,
        title: draftEbooks.title,
        genre: draftEbooks.genre,
        coverUrl: draftEbooks.coverUrl,
        description: draftEbooks.description,
        status: draftEbooks.status,
        hasContent: sql<boolean>`${draftEbooks.content} IS NOT NULL AND length(${draftEbooks.content}) > 100`.as("has_content"),
        wordCount: sql<number>`COALESCE(array_length(regexp_split_to_array(COALESCE(${draftEbooks.content}, ''), '\\s+'), 1), 0)`.as("word_count"),
      }).from(draftEbooks);

      const result = drafts.map(d => {
        const isClassic = classicGenres.includes(d.genre);
        const source = isClassic ? "classic" as const : d.status === "uploaded" ? "uploaded" as const : "author" as const;
        return {
          id: d.id,
          title: d.title,
          genre: d.genre,
          author: isClassic ? "Public Domain" : "EbookGamez",
          coverUrl: d.coverUrl,
          description: d.description,
          hasContent: d.hasContent,
          wordCount: Number(d.wordCount) || 0,
          chapterCount: 0,
          source,
          status: d.status,
        };
      });

      result.sort((a, b) => a.title.localeCompare(b.title));
      res.json(result);
    } catch (error) {
      console.error("Error fetching author library:", error);
      res.status(500).json({ error: "Failed to fetch library" });
    }
  });

  app.get("/api/admin/pending-counts", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    const [authorCount] = await db.select({ count: sql<number>`count(*)` }).from(authorSubmissions).where(eq(authorSubmissions.status, "pending"));
    const [affiliateCount] = await db.select({ count: sql<number>`count(*)` }).from(affiliateApplications).where(eq(affiliateApplications.status, "pending"));
    res.json({ authors: Number(authorCount.count), affiliates: Number(affiliateCount.count) });
  });

  app.post("/api/author-submissions", async (req, res) => {
    try {
      const parsed = insertAuthorSubmissionSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid submission", details: parsed.error.issues });
      const [submission] = await db.insert(authorSubmissions).values(parsed.data).returning();
      console.log(`[NEW APPLICATION] Author submission from ${parsed.data.name} (${parsed.data.email}) — Review in Admin → Authors tab`);
      res.json({ success: true, id: submission.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to submit application" });
    }
  });

  app.get("/api/admin/author-submissions", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    const subs = await db.select().from(authorSubmissions).orderBy(sql`${authorSubmissions.createdAt} DESC`);
    res.json(subs);
  });

  app.patch("/api/admin/author-submissions/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    const id = parseInt(req.params.id);
    const { status, adminNotes } = req.body;
    await db.update(authorSubmissions).set({ status, adminNotes }).where(sql`${authorSubmissions.id} = ${id}`);
    res.json({ success: true });
  });

  app.post("/api/affiliate-applications", async (req, res) => {
    try {
      const parsed = insertAffiliateApplicationSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: "Invalid application", details: parsed.error.issues });
      const [app_entry] = await db.insert(affiliateApplications).values(parsed.data).returning();
      console.log(`[NEW APPLICATION] Affiliate application from ${parsed.data.name} (${parsed.data.email}) — Review in Admin → Affiliates tab`);
      res.json({ success: true, id: app_entry.id });
    } catch (error) {
      res.status(500).json({ error: "Failed to submit application" });
    }
  });

  app.get("/api/admin/affiliate-applications", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    const apps = await db.select().from(affiliateApplications).orderBy(sql`${affiliateApplications.createdAt} DESC`);
    res.json(apps);
  });

  app.patch("/api/admin/affiliate-applications/:id", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    const id = parseInt(req.params.id);
    const { status, adminNotes, referralCode } = req.body;
    const updates: any = { status };
    if (adminNotes !== undefined) updates.adminNotes = adminNotes;
    if (referralCode !== undefined) updates.referralCode = referralCode;
    await db.update(affiliateApplications).set(updates).where(sql`${affiliateApplications.id} = ${id}`);
    res.json({ success: true });
  });

  // POST /api/admin/receive-cover-file
  // Receives a cover image from dev push-to-production and stores it on this server.
  app.post("/api/admin/receive-cover-file", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { filename, dataBase64 } = req.body;
      if (!filename || typeof filename !== "string" || !dataBase64) {
        return res.status(400).json({ error: "filename and dataBase64 required" });
      }
      const safeName = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
      if (!safeName) return res.status(400).json({ error: "Invalid filename" });
      const buffer = Buffer.from(dataBase64, "base64");
      if (buffer.length === 0) return res.status(400).json({ error: "Empty image data" });
      const { saveCoverFile } = await import("./coverStorage");
      const url = await saveCoverFile(buffer, safeName);
      res.json({ url, filename: safeName });
    } catch (err: any) {
      console.error("[SyncReceive] Cover file error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/receive-draft-sync
  // Receives batches of draft content from the dev environment and upserts them into this
  // database. Matches by title — updates if found, inserts if not.
  app.post("/api/admin/receive-draft-sync", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { drafts } = req.body;
      if (!Array.isArray(drafts) || drafts.length === 0) {
        return res.status(400).json({ error: "No drafts provided" });
      }
      let updated = 0, inserted = 0, errors = 0;

      // Strip null bytes — PostgreSQL rejects \u0000 in text columns
      const clean = (s: string | null | undefined) =>
        s ? s.replace(/\u0000/g, "") : s;

      // Sync the sequence to the current max id before inserting any new rows.
      // Without this, bulk-imported rows can leave the sequence pointing to
      // already-occupied IDs, causing "duplicate key" errors on INSERT.
      try {
        await db.execute(sql`SELECT setval('draft_ebooks_id_seq', COALESCE((SELECT MAX(id) FROM draft_ebooks), 1))`);
      } catch (_) { /* non-fatal — sequence may already be correct */ }

      for (const d of drafts) {
        try {
          if (!d.title || !d.content) { errors++; continue; }
          const title = clean(d.title) as string;
          const content = clean(d.content) as string;
          let coverUrl = clean(d.coverUrl);
          let backgroundUrl = clean(d.backgroundUrl);
          const description = clean(d.description);
          const topic = clean(d.topic) || title;
          const status = d.status ?? "published";

          const [existing] = await db.select({ id: draftEbooks.id })
            .from(draftEbooks)
            .where(eq(draftEbooks.title, title))
            .limit(1);

          let draftId: number;
          if (existing) {
            const patch: Record<string, any> = { content, status };
            if (coverUrl) patch.coverUrl = coverUrl;
            if (backgroundUrl) patch.backgroundUrl = backgroundUrl;
            if (description) patch.description = description;
            if (d.suggestedPrice != null) patch.suggestedPrice = d.suggestedPrice;
            if (status === "published") {
              patch.publishedAt = d.publishedAt ? new Date(d.publishedAt) : sql`COALESCE(${draftEbooks.publishedAt}, NOW())`;
            }
            await db.update(draftEbooks).set(patch).where(eq(draftEbooks.id, existing.id));
            draftId = existing.id;
            updated++;
          } else {
            const [newDraft] = await db.insert(draftEbooks).values({
              title,
              genre: d.genre || "Fiction",
              topic,
              content,
              coverUrl: coverUrl ?? null,
              backgroundUrl: backgroundUrl ?? null,
              status,
              description: description ?? null,
              suggestedPrice: d.suggestedPrice ?? null,
              publishedAt: status === "published" ? (d.publishedAt ? new Date(d.publishedAt) : new Date()) : null,
            }).returning({ id: draftEbooks.id });
            draftId = newDraft.id;
            inserted++;
          }

          // Upsert catalog row so published drafts appear on the storefront (not only AI Studio).
          if (status === "published") {
            try {
              const genre = d.genre || "Fiction";
              const price = d.suggestedPrice ?? "9.99";
              const bookCoverUrl = coverUrl || backgroundUrl || "";
              const bookDesc = description || `An AI-generated ebook about ${topic}`;
              if (!bookCoverUrl) {
                console.warn(`[SyncReceive] No cover URL for "${title}" — skipping catalog upsert`);
              } else {
                await contentStudio.upsertCatalogBookFromPublishedSync({
                  productionDraftId: draftId,
                  devDraftId: typeof d.id === "number" ? d.id : undefined,
                  title,
                  genre,
                  price,
                  coverUrl: bookCoverUrl,
                  description: bookDesc,
                });
              }
            } catch (catalogErr: any) {
              console.error(`[SyncReceive] Catalog upsert failed for "${title}":`, catalogErr.message?.slice(0, 300));
              errors++;
            }
          }
        } catch (err: any) {
          const cause = (err as any).cause?.message || (err as any).cause?.toString() || "";
          const pgCode = (err as any).cause?.code || (err as any).code || "";
          console.error(`[SyncReceive] Error on draft "${d.title}": pgCode=${pgCode} | ${cause || err.message?.slice(0, 300)}`);
          errors++;
        }
      }

      console.log(`[SyncReceive] Done: ${updated} updated, ${inserted} inserted, ${errors} errors`);
      res.json({ updated, inserted, errors });
    } catch (err: any) {
      console.error("[SyncReceive] Fatal error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/admin/push-to-production
  // Pushes dev draft content to a production server (small batches only — avoids OOM).
  const PUSH_TO_PROD_MAX_DRAFTS = 25;

  function isLocalDevUrl(raw: string): boolean {
    try {
      const u = new URL(raw.trim());
      return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1";
    } catch {
      return false;
    }
  }

  app.post("/api/admin/push-to-production", async (req, res) => {
    if (!isAdminAuthenticated(req)) return res.status(401).json({ error: "Unauthorized" });
    try {
      const { productionUrl, mode = "illustrated", draftIds, recentDays = 7 } = req.body;
      if (!productionUrl || typeof productionUrl !== "string") {
        return res.status(400).json({ error: "productionUrl required" });
      }
      const url = productionUrl.trim().replace(/\/$/, "");

      if (isLocalDevUrl(url)) {
        return res.status(400).json({
          error: `Production URL is local (${url}). That only updates this computer — it does NOT change ebookgamez.com. Use https://ebookgamez.com (or your Replit deploy URL).`,
        });
      }

      let whereClause;
      if (mode === "selected") {
        if (!Array.isArray(draftIds) || draftIds.length === 0) {
          return res.status(400).json({ error: "Select at least one draft in the table, then choose “Selected only”." });
        }
        const ids = [...new Set(draftIds.map((id: unknown) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
        if (ids.length === 0) {
          return res.status(400).json({ error: "No valid draft IDs in selection." });
        }
        if (ids.length > PUSH_TO_PROD_MAX_DRAFTS) {
          return res.status(400).json({
            error: `Too many selected (${ids.length}). Maximum ${PUSH_TO_PROD_MAX_DRAFTS} per push — deselect some rows first.`,
          });
        }
        whereClause = and(
          inArray(draftEbooks.id, ids),
          eq(draftEbooks.status, "published"),
          isNotNull(draftEbooks.content),
        );
      } else if (mode === "recent") {
        const days = Math.min(30, Math.max(1, Number(recentDays) || 7));
        whereClause = sql`${draftEbooks.content} IS NOT NULL
          AND ${draftEbooks.status} = 'published'
          AND ${draftEbooks.publishedAt} IS NOT NULL
          AND ${draftEbooks.publishedAt} >= NOW() - (${days}::text || ' days')::interval`;
      } else if (mode === "all") {
        whereClause = sql`${draftEbooks.content} IS NOT NULL AND ${draftEbooks.status} = 'published'`;
      } else if (mode === "prose") {
        whereClause = sql`${draftEbooks.content} IS NOT NULL AND ${draftEbooks.status} = 'published' AND ${draftEbooks.content} NOT LIKE '%/objstore/illustrations/%'`;
      } else {
        whereClause = sql`${draftEbooks.content} LIKE '%/objstore/illustrations/%' AND ${draftEbooks.status} = 'published'`;
      }

      const allDrafts = await db.select({
        id: draftEbooks.id,
        title: draftEbooks.title,
        genre: draftEbooks.genre,
        topic: draftEbooks.topic,
        content: draftEbooks.content,
        coverUrl: draftEbooks.coverUrl,
        backgroundUrl: draftEbooks.backgroundUrl,
        status: draftEbooks.status,
        description: draftEbooks.description,
        suggestedPrice: draftEbooks.suggestedPrice,
        publishedAt: draftEbooks.publishedAt,
      }).from(draftEbooks).where(whereClause);

      if (allDrafts.length === 0) {
        return res.status(400).json({ error: "No drafts matched this sync mode." });
      }
      if (allDrafts.length > PUSH_TO_PROD_MAX_DRAFTS) {
        return res.status(400).json({
          error: `This push would sync ${allDrafts.length} books (max ${PUSH_TO_PROD_MAX_DRAFTS}). Select ${PUSH_TO_PROD_MAX_DRAFTS} or fewer and try again.`,
        });
      }

      // Log in to the production server first — dev session tokens don't work there
      // because sessions are in-memory per process.
      const adminPassword = process.env.ADMIN_PASSWORD;
      if (!adminPassword) throw new Error("ADMIN_PASSWORD env var not set — cannot authenticate with production");

      let prodToken: string;
      try {
        const loginResp = await fetch(`${url}/api/admin/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: adminPassword }),
          signal: AbortSignal.timeout(15000),
        });
        if (!loginResp.ok) {
          const err = await loginResp.text().catch(() => loginResp.statusText);
          throw new Error(`Login failed (HTTP ${loginResp.status}): ${err.slice(0, 200)}`);
        }
        const loginData = await loginResp.json() as { token?: string };
        if (!loginData.token) throw new Error("Production login did not return a token");
        prodToken = loginData.token;
        console.log("[PushToProd] Logged in to production server successfully");
      } catch (loginErr: any) {
        throw new Error(`Cannot log in to production server at ${url}: ${loginErr.message}`);
      }

      const warnings: string[] = [];
      try {
        const probe = await fetch(`${url}/api/admin/receive-cover-file`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-admin-token": prodToken },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(10000),
        });
        if (probe.status === 404) {
          warnings.push(
            "Production is missing the new sync endpoints (404 on receive-cover-file). Push code to GitHub, then git pull + deploy on Replit before pushing again.",
          );
        }
      } catch {
        warnings.push("Could not verify production sync endpoints — deploy latest code if covers/catalog do not update.");
      }

      const { readCoverBytesForSync, toObjstoreCoverUrl } = await import("./coverStorage");
      const uploadedCoverFiles = new Set<string>();
      let coversUploaded = 0;
      let coversMissing = 0;

      for (const draft of allDrafts) {
        if (!draft.coverUrl && !draft.backgroundUrl) {
          coversMissing++;
          continue;
        }
        let hadCoverFile = false;
        for (const coverSrc of [draft.coverUrl, draft.backgroundUrl]) {
          if (!coverSrc) continue;
          const file = await readCoverBytesForSync(coverSrc);
          if (!file || uploadedCoverFiles.has(file.filename)) {
            if (file) hadCoverFile = true;
            continue;
          }
          uploadedCoverFiles.add(file.filename);
          hadCoverFile = true;
          try {
            const coverResp = await fetch(`${url}/api/admin/receive-cover-file`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-admin-token": prodToken },
              body: JSON.stringify({
                filename: file.filename,
                dataBase64: file.buffer.toString("base64"),
              }),
              signal: AbortSignal.timeout(120000),
            });
            if (coverResp.ok) {
              coversUploaded++;
            } else {
              const errText = await coverResp.text().catch(() => "");
              console.warn(`[PushToProd] Cover upload failed for ${file.filename}: ${errText.slice(0, 120)}`);
            }
          } catch (coverErr: any) {
            console.warn(`[PushToProd] Cover upload error for ${file.filename}: ${coverErr.message}`);
          }
        }
        if (!hadCoverFile) coversMissing++;
      }

      const BATCH_SIZE = 5;
      let totalUpdated = 0, totalInserted = 0, totalErrors = 0;

      for (let i = 0; i < allDrafts.length; i += BATCH_SIZE) {
        const batch = allDrafts.slice(i, i + BATCH_SIZE);
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(allDrafts.length / BATCH_SIZE);

        let response: Response;
        try {
          response = await fetch(`${url}/api/admin/receive-draft-sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-admin-token": prodToken },
            body: JSON.stringify({
              drafts: batch.map((d) => ({
                ...d,
                coverUrl: d.coverUrl ? toObjstoreCoverUrl(d.coverUrl) : null,
                backgroundUrl: d.backgroundUrl ? toObjstoreCoverUrl(d.backgroundUrl) : null,
              })),
            }),
            signal: AbortSignal.timeout(120000),
          });
        } catch (fetchErr: any) {
          throw new Error(`Cannot reach production server (batch ${batchNum}/${totalBatches}): ${fetchErr.message}`);
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => response.statusText);
          throw new Error(`Production server error (batch ${batchNum}/${totalBatches}): HTTP ${response.status} — ${errText.slice(0, 200)}`);
        }

        const result = await response.json() as { updated: number; inserted: number; errors: number };
        totalUpdated += result.updated ?? 0;
        totalInserted += result.inserted ?? 0;
        totalErrors += result.errors ?? 0;
        if ((result.errors ?? 0) > 0) {
          warnings.push(`Batch ${batchNum}: ${result.errors} draft(s) failed on production (check production server logs for [SyncReceive]).`);
        }
        console.log(`[PushToProd] Batch ${batchNum}/${totalBatches}: +${result.updated} updated, +${result.inserted} inserted, ${result.errors ?? 0} errors`);
      }

      const verification: { title: string; onStorefront: boolean; hasCover: boolean }[] = [];
      for (const draft of allDrafts) {
        let onStorefront = false;
        let hasCover = false;
        try {
          const vResp = await fetch(
            `${url}/api/books?search=${encodeURIComponent(draft.title)}&limit=20`,
            { signal: AbortSignal.timeout(15000) },
          );
          if (vResp.ok) {
            const vData = await vResp.json() as { books?: { title: string; coverUrl?: string }[] } | { title: string; coverUrl?: string }[];
            const list = Array.isArray(vData) ? vData : vData.books ?? [];
            let match = list.find(
              (b) => b.title.trim().toLowerCase() === draft.title.trim().toLowerCase(),
            );
            if (!match) {
              match = list.find(
                (b) => contentStudio.areTitlesSimilar(draft.title, b.title).similar,
              );
            }
            if (match) {
              onStorefront = true;
              hasCover = !!(match.coverUrl && match.coverUrl.length > 5);
            }
          }
        } catch {
          warnings.push(`Could not verify "${draft.title}" on production storefront.`);
        }
        verification.push({ title: draft.title, onStorefront, hasCover });
        if (!onStorefront) {
          warnings.push(
            `"${draft.title}" is NOT on the production storefront yet — deploy latest code on Replit, then push again (catalog linking now matches similar titles like Replit Publish to Storefront).`,
          );
        } else if (!hasCover) {
          warnings.push(`"${draft.title}" is on the storefront but has no cover URL on production.`);
        }
      }

      const verifiedOnStorefront = verification.filter((v) => v.onStorefront).length;
      const message = `Synced ${allDrafts.length} book(s) (${totalUpdated} draft rows updated, ${totalInserted} new, ${coversUploaded} covers uploaded, ${verifiedOnStorefront}/${allDrafts.length} verified on storefront${totalErrors > 0 ? `, ${totalErrors} sync errors` : ""})`;
      console.log(`[PushToProd] Complete: ${message}`);
      if (warnings.length) console.warn("[PushToProd] Warnings:", warnings.join(" | "));
      res.json({
        totalDrafts: allDrafts.length,
        totalUpdated,
        totalInserted,
        totalErrors,
        coversUploaded,
        coversMissing,
        verification,
        warnings,
        message,
        ok: totalErrors === 0 && verifiedOnStorefront === allDrafts.length && warnings.length === 0,
      });
    } catch (err: any) {
      console.error("[PushToProd] Error:", err.message);
      res.status(500).json({ error: err.message });
    }
  });

  return httpServer;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
