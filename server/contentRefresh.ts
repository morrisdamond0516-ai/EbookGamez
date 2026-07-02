import { db } from "./storage";
import { contentRefreshLog, dynamicContent } from "../shared/schema";
import { eq, desc } from "drizzle-orm";

const OPENAI_API_KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://production.api.replit.com/v1beta2";

const VERIFIED_GAMING_IMAGES = [
  "https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1556438064-2d7646166914?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1551103782-8ab07afd45c1?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1511882150382-421056c89033?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1625805866449-3589fe3f71a3?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1592155931584-901ac15763e3?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1600861194942-f883de0dfe96?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1589241062272-c0a000072dfa?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1516822003754-cca485356ecb?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1593642634367-d91a135587b5?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1563207153-f403bf289096?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800",
  "https://images.unsplash.com/photo-1614294149010-950b698f72c0?auto=format&fit=crop&q=80&w=800",
];

function replaceWithVerifiedImages(items: any[]): any[] {
  return items.map((item: any, i: number) => {
    if (item.image && item.image.includes("unsplash.com")) {
      item.image = VERIFIED_GAMING_IMAGES[i % VERIFIED_GAMING_IMAGES.length];
    }
    return item;
  });
}

async function aiResearch(prompt: string): Promise<string> {
  const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are a gaming industry research assistant. Return ONLY valid JSON with no markdown formatting, no code blocks, no explanation text. Just raw JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI research failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function refreshDownloads(): Promise<{ count: number; details: string }> {
  const prompt = `Research the most popular and trending downloadable video games as of ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}. 

Return a JSON array of 15 games. Mix of free-to-play and paid. Include recent releases and enduring favorites that people are actively downloading NOW.

Each object must have these exact fields:
{
  "id": "slug-format",
  "title": "Game Name",
  "developer": "Studio Name",
  "description": "2-3 sentence compelling description mentioning latest updates/seasons/features",
  "image": "https://images.unsplash.com/photo-RELEVANT-GAMING-IMAGE?auto=format&fit=crop&q=80&w=800",
  "platforms": ["PC", "PlayStation", "Xbox", etc],
  "requirements": { "os": "...", "cpu": "...", "ram": "...", "storage": "..." },
  "officialUrl": "https://official-download-link",
  "category": "Genre",
  "players": "Player count estimate",
  "rating": 4.5,
  "isFree": true/false,
  "tags": ["tag1", "tag2", "tag3"]
}

Use realistic Unsplash gaming/tech images. Include games like: whatever is currently #1 on Steam, latest Call of Duty, current Fortnite season, GTA (V or VI if released), Minecraft latest, Roblox, Valorant, Apex Legends, League of Legends, Elden Ring/latest FromSoft, any major 2026 releases, popular indie hits, and whatever is trending on Twitch/YouTube gaming right now.

Return ONLY the JSON array, no other text.`;

  const result = await aiResearch(prompt);
  const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const downloads = replaceWithVerifiedImages(JSON.parse(cleaned));

  await db.delete(dynamicContent).where(eq(dynamicContent.section, "downloads"));
  await db.insert(dynamicContent).values({
    section: "downloads",
    contentJson: JSON.stringify(downloads),
    refreshedAt: new Date(),
  });

  return { count: downloads.length, details: downloads.map((d: any) => d.title).join(", ") };
}

async function refreshGuides(): Promise<{ count: number; details: string }> {
  const prompt = `Research the most searched and trending gaming guide topics as of ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}.

Return a JSON array of 8 comprehensive gaming guides. Focus on what gamers are ACTUALLY searching for right now — meta changes, new seasons, trending strategies, new game releases.

Each object must have these exact fields:
{
  "id": "slug-format-title",
  "title": "Full Guide Title with Year",
  "game": "Game Name",
  "category": "Settings|Tier List|Money Guide|Map Guide|Tutorial|Best Of|Build Guide|Strategy",
  "excerpt": "2-3 sentence compelling description of what the guide covers",
  "image": "https://images.unsplash.com/photo-RELEVANT-IMAGE?auto=format&fit=crop&q=80&w=800",
  "readTime": "X min",
  "views": "XXK",
  "date": "${new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}",
  "tags": ["tag1", "tag2", "tag3"],
  "featured": true/false,
  "trending": true/false,
  "content": [
    { "heading": "Section Title", "body": "Detailed 200-400 word section with real, actionable advice. Include specific numbers, settings, strategies, tier rankings etc. Write like a knowledgeable gamer sharing expert tips." },
    ... (4-6 sections per guide)
  ]
}

Cover a MIX of popular games: Fortnite (current season/meta), Minecraft (latest update builds), Valorant (current agent meta/settings), Roblox (top games right now), GTA Online (current money methods), Apex Legends (current tier list), any major new 2026 releases, and one trending indie/viral game.

Make the content genuinely useful and detailed — real settings numbers, real strategy advice, real tier rankings based on current meta. Each guide should have 4-6 content sections with 200-400 words each.

Return ONLY the JSON array, no other text.`;

  const result = await aiResearch(prompt);
  const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const guides = replaceWithVerifiedImages(JSON.parse(cleaned));

  await db.delete(dynamicContent).where(eq(dynamicContent.section, "guides"));
  await db.insert(dynamicContent).values({
    section: "guides",
    contentJson: JSON.stringify(guides),
    refreshedAt: new Date(),
  });

  return { count: guides.length, details: guides.map((g: any) => g.title).join(", ") };
}

async function refreshGamesMetadata(): Promise<{ count: number; details: string }> {
  const prompt = `Research the most popular and trending HTML5 browser games as of ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}. These are games playable directly in a web browser, often found on sites like CrazyGames, Poki, or GameDistribution.

Return a JSON array of 20 trending browser games. Include the types of games people are playing in browsers right now.

Each object must have these exact fields:
{
  "id": "slug-format",
  "title": "Game Name",
  "category": "Action|Puzzle|Racing|Sports|Simulation|Tower Defense|Stickman|Idle & Clicker|Adventure|Merge|.io",
  "tags": ["tag1", "tag2", "tag3"],
  "featured": true/false,
  "hot": true/false,
  "isNew": true/false,
  "trendScore": 1-10,
  "description": "Brief 1-sentence description"
}

Focus on games that are genuinely popular in browser gaming right now — .io games, action shooters, racing games, puzzle games, idle clickers, merge games, etc. Include both well-known titles and trending newcomers.

Return ONLY the JSON array, no other text.`;

  const result = await aiResearch(prompt);
  const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const games = JSON.parse(cleaned);

  await db.delete(dynamicContent).where(eq(dynamicContent.section, "games_metadata"));
  await db.insert(dynamicContent).values({
    section: "games_metadata",
    contentJson: JSON.stringify(games),
    refreshedAt: new Date(),
  });

  return { count: games.length, details: games.map((g: any) => g.title).join(", ") };
}

export async function runContentRefresh(sections?: string[]): Promise<{
  results: Record<string, { status: string; count: number; details: string }>;
}> {
  const targetSections = sections || ["downloads", "guides", "games_metadata"];
  const results: Record<string, { status: string; count: number; details: string }> = {};

  for (const section of targetSections) {
    const [logEntry] = await db.insert(contentRefreshLog).values({
      section,
      status: "running",
    }).returning();

    try {
      let result: { count: number; details: string };

      switch (section) {
        case "downloads":
          result = await refreshDownloads();
          break;
        case "guides":
          result = await refreshGuides();
          break;
        case "games_metadata":
          result = await refreshGamesMetadata();
          break;
        default:
          throw new Error(`Unknown section: ${section}`);
      }

      await db.update(contentRefreshLog)
        .set({ status: "completed", itemsUpdated: result.count, details: result.details })
        .where(eq(contentRefreshLog.id, logEntry.id));

      results[section] = { status: "completed", count: result.count, details: result.details };
      console.log(`[ContentRefresh] ${section}: Updated ${result.count} items`);
    } catch (error: any) {
      await db.update(contentRefreshLog)
        .set({ status: "error", error: error.message })
        .where(eq(contentRefreshLog.id, logEntry.id));

      results[section] = { status: "error", count: 0, details: error.message };
      console.error(`[ContentRefresh] ${section} failed:`, error.message);
    }
  }

  return { results };
}

export async function getDynamicContent(section: string): Promise<any | null> {
  const [row] = await db.select()
    .from(dynamicContent)
    .where(eq(dynamicContent.section, section))
    .orderBy(desc(dynamicContent.refreshedAt))
    .limit(1);

  if (!row) return null;

  const data = replaceWithVerifiedImages(JSON.parse(row.contentJson));

  return {
    data,
    refreshedAt: row.refreshedAt,
  };
}

export async function getRefreshHistory(limit = 20): Promise<any[]> {
  return db.select()
    .from(contentRefreshLog)
    .orderBy(desc(contentRefreshLog.createdAt))
    .limit(limit);
}

export function startMonthlyScheduler() {
  console.log("[ContentRefresh] Auto-refresh is PAUSED (cost savings mode). Use admin panel to refresh manually when needed.");
}
