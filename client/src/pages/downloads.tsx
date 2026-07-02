import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ExternalLink, Monitor, Cpu, HardDrive, Wifi, Shield, Download, ChevronRight, Search, Star, TrendingUp, Users, Gamepad2 } from "lucide-react";

interface GameDownload {
  id: string;
  title: string;
  developer: string;
  description: string;
  image: string;
  platforms: string[];
  requirements: { os: string; cpu: string; ram: string; storage: string };
  officialUrl: string;
  category: string;
  players: string;
  rating: number;
  isFree: boolean;
  tags: string[];
}

const DOWNLOAD_GAMES: GameDownload[] = [
  {
    id: "fortnite",
    title: "Fortnite",
    developer: "Epic Games",
    description: "Battle Royale, Zero Build, Creative, and LEGO Fortnite — the ultimate free-to-play experience with constant updates, live events, and crossovers with Marvel, Star Wars, and more.",
    image: "https://images.unsplash.com/photo-1589241062272-c0a000072dfa?auto=format&fit=crop&q=80&w=800",
    platforms: ["PC", "PlayStation", "Xbox", "Switch", "Mobile"],
    requirements: { os: "Windows 10 64-bit", cpu: "Intel i5-7300U / AMD Ryzen 3 3300U", ram: "8 GB", storage: "26 GB" },
    officialUrl: "https://www.fortnite.com/download",
    category: "Battle Royale",
    players: "350M+",
    rating: 4.5,
    isFree: true,
    tags: ["Battle Royale", "Building", "Multiplayer"],
  },
  {
    id: "roblox",
    title: "Roblox",
    developer: "Roblox Corporation",
    description: "The ultimate platform where millions of experiences are created by users. Play, create, and share with friends across any device. Home to Adopt Me, Brookhaven, Blox Fruits, and thousands more.",
    image: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?auto=format&fit=crop&q=80&w=800",
    platforms: ["PC", "Mac", "Xbox", "Mobile", "VR"],
    requirements: { os: "Windows 7 / macOS 10.13", cpu: "1.6 GHz processor", ram: "1 GB", storage: "20 MB + games" },
    officialUrl: "https://www.roblox.com/download",
    category: "Platform",
    players: "200M+ monthly",
    rating: 4.3,
    isFree: true,
    tags: ["Social", "Creative", "Multiplayer"],
  },
  {
    id: "minecraft",
    title: "Minecraft",
    developer: "Mojang Studios",
    description: "The world's best-selling video game. Build anything you can imagine in Creative mode, survive dangerous mobs in Survival mode, or join massive multiplayer servers. Now with Trails & Tales update.",
    image: "https://images.unsplash.com/photo-1563207153-f403bf289096?auto=format&fit=crop&q=80&w=800",
    platforms: ["PC", "Mac", "PlayStation", "Xbox", "Switch", "Mobile"],
    requirements: { os: "Windows 10 64-bit", cpu: "Intel i5-4690 / AMD A10-7800", ram: "8 GB", storage: "4 GB" },
    officialUrl: "https://www.minecraft.net/download",
    category: "Sandbox",
    players: "300M+ sold",
    rating: 4.8,
    isFree: false,
    tags: ["Sandbox", "Survival", "Creative"],
  },
  {
    id: "valorant",
    title: "Valorant",
    developer: "Riot Games",
    description: "A 5v5 character-based tactical FPS where precise gunplay meets unique agent abilities. Features competitive ranked mode, team deathmatch, and regular new agents and maps.",
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=800",
    platforms: ["PC", "Console (2025)"],
    requirements: { os: "Windows 10 64-bit", cpu: "Intel i3-4150 / AMD Ryzen 3 1200", ram: "4 GB", storage: "23 GB" },
    officialUrl: "https://playvalorant.com/download",
    category: "Tactical FPS",
    players: "30M+ monthly",
    rating: 4.6,
    isFree: true,
    tags: ["FPS", "Tactical", "Competitive"],
  },
  {
    id: "apex-legends",
    title: "Apex Legends",
    developer: "Respawn Entertainment",
    description: "A free-to-play hero shooter where legendary competitors battle for glory in the Outlands. Features unique Legend abilities, fast-paced combat, and innovative ping communication system.",
    image: "https://images.unsplash.com/photo-1614294149010-950b698f72c0?auto=format&fit=crop&q=80&w=800",
    platforms: ["PC", "PlayStation", "Xbox", "Switch"],
    requirements: { os: "Windows 10 64-bit", cpu: "Intel i3-6300 / AMD FX-4350", ram: "6 GB", storage: "75 GB" },
    officialUrl: "https://www.ea.com/games/apex-legends",
    category: "Battle Royale",
    players: "100M+",
    rating: 4.4,
    isFree: true,
    tags: ["FPS", "Battle Royale", "Hero Shooter"],
  },
  {
    id: "gta-v",
    title: "GTA V / GTA Online",
    developer: "Rockstar Games",
    description: "Los Santos: a sprawling metropolis full of self-help gurus, starlets and fading celebrities. GTA Online offers an ever-evolving world of heists, races, businesses, and chaos with friends.",
    image: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=800",
    platforms: ["PC", "PlayStation", "Xbox"],
    requirements: { os: "Windows 10 64-bit", cpu: "Intel i5-3470 / AMD FX-8350", ram: "8 GB", storage: "110 GB" },
    officialUrl: "https://www.rockstargames.com/gta-v",
    category: "Open World",
    players: "200M+ sold",
    rating: 4.7,
    isFree: false,
    tags: ["Open World", "Action", "Multiplayer"],
  },
  {
    id: "call-of-duty-warzone",
    title: "Call of Duty: Warzone",
    developer: "Activision",
    description: "The ultimate free-to-play Battle Royale experience. Drop into massive maps, loot weapons, and fight to be the last squad standing. Features Resurgence, Battle Royale, and Plunder modes.",
    image: "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&q=80&w=800",
    platforms: ["PC", "PlayStation", "Xbox"],
    requirements: { os: "Windows 10 64-bit", cpu: "Intel i5-6600K / AMD Ryzen 5 1400", ram: "12 GB", storage: "125 GB" },
    officialUrl: "https://www.callofduty.com/warzone",
    category: "Battle Royale",
    players: "100M+",
    rating: 4.2,
    isFree: true,
    tags: ["FPS", "Battle Royale", "Military"],
  },
  {
    id: "league-of-legends",
    title: "League of Legends",
    developer: "Riot Games",
    description: "The world's most popular MOBA. Choose from 160+ champions and compete in 5v5 strategic team battles. Features ranked play, ARAM, and rotating game modes with a thriving esports scene.",
    image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&q=80&w=800",
    platforms: ["PC", "Mac"],
    requirements: { os: "Windows 10 64-bit", cpu: "Intel i3-530 / AMD A6-3650", ram: "4 GB", storage: "16 GB" },
    officialUrl: "https://www.leagueoflegends.com",
    category: "MOBA",
    players: "150M+ monthly",
    rating: 4.5,
    isFree: true,
    tags: ["MOBA", "Strategy", "Competitive"],
  },
  {
    id: "counter-strike-2",
    title: "Counter-Strike 2",
    developer: "Valve",
    description: "The #1 most-played PC game in 2026. CS2 delivers the ultimate competitive FPS experience with responsive tick-rate technology, overhauled maps, and dynamic smoke grenades. The definitive tactical shooter.",
    image: "https://images.unsplash.com/photo-1542751110-97427bbecf20?auto=format&fit=crop&q=80&w=800",
    platforms: ["PC"],
    requirements: { os: "Windows 10 64-bit", cpu: "Intel i5-7500 / AMD Ryzen 5 1600", ram: "8 GB", storage: "85 GB" },
    officialUrl: "https://www.counter-strike.net",
    category: "Tactical FPS",
    players: "#1 PC MAU",
    rating: 4.6,
    isFree: true,
    tags: ["FPS", "Competitive", "Tactical"],
  },
  {
    id: "crimson-desert",
    title: "Crimson Desert",
    developer: "Pearl Abyss",
    description: "One of 2026's biggest new releases. An open-world action RPG set in the war-torn continent of Pywel with stunning real-time combat, cinematic storytelling, and a massive explorable world.",
    image: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800",
    platforms: ["PC", "PlayStation", "Xbox"],
    requirements: { os: "Windows 10 64-bit", cpu: "Intel i7-9700K / AMD Ryzen 7 3700X", ram: "16 GB", storage: "100 GB" },
    officialUrl: "https://www.crimsondesert.com",
    category: "Action RPG",
    players: "New Release",
    rating: 4.7,
    isFree: false,
    tags: ["RPG", "Open World", "Action"],
  },
  {
    id: "slay-the-spire-2",
    title: "Slay the Spire 2",
    developer: "Mega Crit",
    description: "The highly anticipated sequel to the genre-defining roguelike deckbuilder. Features new classes, deeper strategy, and 4-player co-op for the first time. Currently in Early Access.",
    image: "https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&q=80&w=800",
    platforms: ["PC"],
    requirements: { os: "Windows 10 64-bit", cpu: "Intel i5-6600 / AMD Ryzen 3 3100", ram: "8 GB", storage: "8 GB" },
    officialUrl: "https://store.steampowered.com/app/2868840/Slay_the_Spire_2/",
    category: "Roguelike",
    players: "Early Access",
    rating: 4.9,
    isFree: false,
    tags: ["Deckbuilder", "Roguelike", "Co-op"],
  },
  {
    id: "marathon",
    title: "Marathon",
    developer: "Bungie",
    description: "Bungie's new extraction shooter set in a sci-fi universe. Compete as Runners in a mysterious alien world, collect loot, and escape. A fresh take on competitive PvP from the makers of Destiny and Halo.",
    image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&q=80&w=800",
    platforms: ["PC", "PlayStation", "Xbox"],
    requirements: { os: "Windows 10 64-bit", cpu: "Intel i7-8700K / AMD Ryzen 7 2700X", ram: "16 GB", storage: "60 GB" },
    officialUrl: "https://www.bungie.net/marathon",
    category: "Extraction Shooter",
    players: "New Release",
    rating: 4.4,
    isFree: true,
    tags: ["FPS", "Extraction", "Sci-Fi"],
  },
];

function GameCard({ game }: { game: GameDownload }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      data-testid={`card-download-${game.id}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.03] border border-white/10 rounded-lg overflow-hidden hover:border-primary/30 transition-all duration-300"
    >
      <div className="relative h-48 overflow-hidden">
        <img src={game.image} alt={game.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        {game.isFree && (
          <span className="absolute top-3 left-3 bg-green-500/90 text-white text-xs font-bold px-3 py-1 rounded-full">
            FREE
          </span>
        )}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-2xl font-display text-white drop-shadow-lg">{game.title}</h3>
          <p className="text-white/60 text-sm font-serif">{game.developer}</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {game.tags.map(tag => (
            <span key={tag} className="text-xs bg-primary/10 text-primary/80 px-2 py-1 rounded-full border border-primary/20">
              {tag}
            </span>
          ))}
        </div>

        <p className="text-white/70 text-sm font-serif leading-relaxed line-clamp-3">
          {game.description}
        </p>

        <div className="flex items-center gap-4 text-xs text-white/50">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {game.players}</span>
          <span className="flex items-center gap-1"><Star className="h-3 w-3 text-primary" /> {game.rating}</span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {game.platforms.map(p => (
            <span key={p} className="text-[10px] bg-white/5 text-white/60 px-2 py-0.5 rounded border border-white/10">
              {p}
            </span>
          ))}
        </div>

        <button
          data-testid={`toggle-specs-${game.id}`}
          onClick={() => setExpanded(!expanded)}
          className="text-primary/70 text-xs hover:text-primary transition-colors flex items-center gap-1 font-serif"
        >
          <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
          {expanded ? "Hide" : "Show"} System Requirements
        </button>

        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-black/30 rounded-md p-3 space-y-2 text-xs border border-white/5"
          >
            <div className="flex items-center gap-2 text-white/60">
              <Monitor className="h-3 w-3 text-primary/60" />
              <span className="text-white/40">OS:</span> {game.requirements.os}
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <Cpu className="h-3 w-3 text-primary/60" />
              <span className="text-white/40">CPU:</span> {game.requirements.cpu}
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <HardDrive className="h-3 w-3 text-primary/60" />
              <span className="text-white/40">RAM:</span> {game.requirements.ram}
            </div>
            <div className="flex items-center gap-2 text-white/60">
              <HardDrive className="h-3 w-3 text-primary/60" />
              <span className="text-white/40">Storage:</span> {game.requirements.storage}
            </div>
          </motion.div>
        )}

        <a
          href={game.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`link-download-${game.id}`}
        >
          <Button className="w-full bg-primary text-black hover:bg-primary/90 font-display gap-2">
            <Download className="h-4 w-4" />
            Official Download
            <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
          </Button>
        </a>

        <div className="flex items-center gap-1.5 text-[10px] text-white/30 justify-center">
          <Shield className="h-3 w-3" />
          Official link — safe and verified
        </div>
      </div>
    </motion.div>
  );
}

export default function Downloads() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: dynamicData } = useQuery({
    queryKey: ["/api/dynamic-content/downloads"],
    queryFn: async () => {
      const res = await fetch("/api/dynamic-content/downloads");
      return res.json();
    },
    staleTime: 1000 * 60 * 60,
  });

  const allGames: GameDownload[] = dynamicData?.data || DOWNLOAD_GAMES;
  const categories = ["all", ...Array.from(new Set(allGames.map(g => g.category)))];

  const filtered = allGames.filter(g => {
    const matchSearch = g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchCat = selectedCategory === "all" || g.category === selectedCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Navbar />

      <section className="relative pt-28 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Gamepad2 className="h-5 w-5 text-primary" />
              <span className="text-primary font-serif text-sm tracking-widest uppercase">Download Hub</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-display text-white mb-4">
              Get the <span className="text-primary">Biggest Games</span>
            </h1>
            <p className="text-white/60 font-serif text-lg mb-8">
              Official download links for the most popular games. Safe, verified, and always up to date.
            </p>

            <div className="relative max-w-md mx-auto">
              <Input
                data-testid="input-search-downloads"
                placeholder="Search games..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-white/5 border-white/10 text-white pl-10 h-12 font-serif"
              />
              <Search className="absolute left-3 top-3.5 h-5 w-5 text-white/30" />
            </div>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {categories.map(cat => (
              <button
                key={cat}
                data-testid={`filter-${cat}`}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-serif transition-all ${
                  selectedCategory === cat
                    ? "bg-primary text-black"
                    : "bg-white/5 text-white/60 hover:bg-white/10 border border-white/10"
                }`}
              >
                {cat === "all" ? "All Games" : cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-20 container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map((game, i) => (
            <motion.div
              key={game.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <GameCard game={game} />
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-white/40 font-serif">
            No games found matching your search.
          </div>
        )}
      </section>

      <section className="py-16 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-6 flex items-start gap-4 max-w-3xl mx-auto">
            <Shield className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-display text-white mb-2">Safe Downloads Only</h3>
              <p className="text-white/50 text-sm font-serif leading-relaxed">
                Every link on this page goes directly to the official game website or store. We never host game files ourselves and we never link to third-party download sites. Your safety comes first.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 border-t border-white/10">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="flex items-center gap-2 mb-10">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-display text-white tracking-wide">GAME DOWNLOAD GUIDES</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 font-serif text-white/60 text-sm leading-relaxed">
            <div>
              <h3 className="text-primary font-display text-base mb-3">How to Download PC Games Safely</h3>
              <p className="mb-4">
                Downloading games for your PC is straightforward when you go through official channels. Every game on this page links directly to the publisher's own website or an authorized digital storefront like the Epic Games Store, Steam, or the game's official launcher. Never download games from unofficial mirror sites or torrents — these are common sources of malware and pirated content that can harm your computer.
              </p>
              <p className="mb-4">
                When you click an official download button, you'll typically receive a small installer file (often under 5 MB). Running this installer connects to the publisher's servers and downloads the full game client, which may range from a few gigabytes to over 100 GB for large titles. Make sure you have enough free disk space before you begin.
              </p>
              <p>
                Most modern PC games require you to create a free account with the publisher — Epic Games, Riot, Activision, or Valve — before you can download or play. This account also serves as your save data backup and friend list hub.
              </p>
            </div>
            <div>
              <h3 className="text-primary font-display text-base mb-3">Understanding System Requirements</h3>
              <p className="mb-4">
                Each game card on this page shows the minimum system requirements you'll need to run that game. These are the bare minimum specs — running a game at minimum requirements usually means lower graphics settings and potentially inconsistent frame rates. For the best experience, aim to exceed the minimum specs where possible.
              </p>
              <p className="mb-4">
                The most important specs to check are your operating system (most modern games require Windows 10 or later), your CPU (processor), your RAM (memory), and your available storage space. Your graphics card (GPU) matters most for games with high-end visual requirements, though many free-to-play games like Fortnite and Valorant are designed to run on a wide range of hardware.
              </p>
              <p>
                If you're unsure about your computer's specs, you can check them by pressing Windows + R, typing "dxdiag" and pressing Enter. The DirectX Diagnostic Tool will show your processor, RAM, and graphics card details.
              </p>
            </div>
            <div>
              <h3 className="text-primary font-display text-base mb-3">Free-to-Play vs. Paid Games</h3>
              <p className="mb-4">
                Several of the most popular games in the world today are completely free to download and play. Fortnite, Apex Legends, Valorant, League of Legends, and Call of Duty: Warzone all follow the free-to-play model, generating revenue through optional cosmetic purchases like character skins, emotes, and battle passes. You never need to spend money to compete or enjoy these games.
              </p>
              <p className="mb-4">
                Paid games like Minecraft and GTA V require a one-time purchase. However, these purchases often come with enormous amounts of content and strong replay value. Minecraft, for example, has sold over 300 million copies and remains one of the most-played games in history thanks to its endless creative freedom and regular free updates.
              </p>
              <p>
                Many paid games also offer free trials or demo versions. Check the official game pages linked from this hub for any available trial options before committing to a purchase.
              </p>
            </div>
            <div>
              <h3 className="text-primary font-display text-base mb-3">Choosing the Right Game for You</h3>
              <p className="mb-4">
                With so many great games available, it can be hard to know where to start. Battle royale games like Fortnite and Apex Legends are great for players who enjoy competitive, fast-paced action and the thrill of being the last team standing. These games have very active communities and constant new content.
              </p>
              <p className="mb-4">
                If you prefer team-based strategy, Valorant and League of Legends offer deep competitive ecosystems with a huge skill ceiling. Minecraft and Roblox appeal to creative players who want to build, explore, and play in user-generated worlds. GTA V gives you an enormous open world with both a rich story mode and a thriving online multiplayer experience.
              </p>
              <p>
                New to gaming? Start with a free-to-play title to learn the ropes without any financial commitment. Fortnite and Roblox are both beginner-friendly and have massive communities of players at all skill levels. Both have extensive tutorial systems and helpful online guides to get you started.
              </p>
            </div>
          </div>

          <div className="mt-14">
            <h3 className="text-xl font-display text-white mb-6 flex items-center gap-2">
              <Star className="h-5 w-5 text-primary" /> Frequently Asked Questions
            </h3>
            <div className="space-y-4">
              {[
                {
                  q: "Are all these games really free?",
                  a: "Most of the games listed here are free to download and play. Some, like Minecraft and GTA V, require a one-time purchase. Games marked FREE on their card can be downloaded and played at no cost, though they may offer optional in-game purchases.",
                },
                {
                  q: "Will these games run on my laptop?",
                  a: "It depends on your laptop's specs. Free-to-play games like Fortnite and Valorant are designed to run on a wide range of hardware, including many mid-range laptops. Check the system requirements shown on each game card. Gaming laptops with dedicated graphics cards will handle all of these games comfortably.",
                },
                {
                  q: "How long does it take to download these games?",
                  a: "Download times vary significantly based on your internet speed and the game's file size. Fortnite is about 26 GB, Valorant about 23 GB, and Apex Legends about 75 GB. On a 100 Mbps connection, a 25 GB game takes roughly 30–35 minutes. Faster connections mean faster downloads.",
                },
                {
                  q: "Can I play these games on a Mac?",
                  a: "Some games support Mac, including Roblox and Minecraft. However, most major PC games — including Fortnite, Valorant, and Call of Duty — are PC-only or have limited Mac support. Check each game's platform information listed in its card.",
                },
                {
                  q: "Are these download links safe?",
                  a: "Yes. Every link goes directly to the official publisher website or authorized store. We manually verify all links and update them if a publisher changes their download page. We never link to third-party sites, mirrors, or file-sharing services.",
                },
              ].map((item, i) => (
                <div key={i} className="bg-card/30 border border-white/10 rounded-lg p-5">
                  <h4 className="font-display text-white text-sm mb-2">{item.q}</h4>
                  <p className="text-white/50 font-serif text-sm leading-relaxed">{item.a}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
