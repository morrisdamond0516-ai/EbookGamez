import { useState, useCallback } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { 
  Gamepad2, Star, TrendingUp, Zap, Brain, Car, Swords, 
  Puzzle, Target, ChevronRight, Maximize2, Minimize2,
  ArrowLeft, Clock, Users, Flame, Play, Shield, Mouse,
  Layers, Map, Trophy, Crown, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";

import thumbWinterClash from "@/assets/game-thumbs/winter-clash-3d.png";
import thumbCityCarStunt from "@/assets/game-thumbs/city-car-stunt.png";
import thumbDeathChase from "@/assets/game-thumbs/death-chase.png";
import thumbBoxingRandom from "@/assets/game-thumbs/boxing-random.png";
import thumbMotoWinter from "@/assets/game-thumbs/moto-x3m-winter.png";
import thumbParkourRace from "@/assets/game-thumbs/parkour-race.png";
import thumbNinjaObby from "@/assets/game-thumbs/ninja-obby.png";
import thumbPoliceTraffic from "@/assets/game-thumbs/police-traffic.png";
import thumbSnowRider from "@/assets/game-thumbs/snow-rider.png";
import thumbSoccerRandom from "@/assets/game-thumbs/soccer-random.png";
import thumbBasketball from "@/assets/game-thumbs/basketball-stars.png";
import thumbUphill from "@/assets/game-thumbs/uphill-rush.png";
import thumbBubble from "@/assets/game-thumbs/bubble-shooter.png";
import thumbChess from "@/assets/game-thumbs/chess-online.png";
import thumbCandy from "@/assets/game-thumbs/candy-rain.png";
import thumbCooking from "@/assets/game-thumbs/cooking-fever.png";
import thumbFireboy from "@/assets/game-thumbs/fireboy-watergirl.png";
import thumbSolitaire from "@/assets/game-thumbs/solitaire-classic.png";
import thumbCutRope from "@/assets/game-thumbs/cut-the-rope.png";
import thumbZombie from "@/assets/game-thumbs/zombie-derby.png";
import thumbMotoX3m from "@/assets/game-thumbs/moto-x3m.png";
import thumbCrossy from "@/assets/game-thumbs/crossy-road.png";

import thumbSubwaySurfers from "@/assets/game-thumbs/subway-surfers.png";
import thumbStickmanHook from "@/assets/game-thumbs/stickman-hook.png";
import thumbTempleRun from "@/assets/game-thumbs/temple-run-2.png";
import thumb8BallPool from "@/assets/game-thumbs/8-ball-pool.png";
import thumbDriftBoss from "@/assets/game-thumbs/drift-boss.png";
import thumbSoccerSkills from "@/assets/game-thumbs/soccer-skills.png";

import thumbFrostDefense from "@/assets/game-thumbs/frost-defense.jpg";
import thumbGoldTowerDefense from "@/assets/game-thumbs/gold-tower-defense.jpg";
import thumbTowerDefense2d from "@/assets/game-thumbs/tower-defense-2d.jpg";
import thumbStickmanKombat from "@/assets/game-thumbs/stickman-kombat.jpg";
import thumbStickmanAssassin from "@/assets/game-thumbs/stickman-assassin.jpg";
import thumbStickmanEscape from "@/assets/game-thumbs/stickman-escape.jpg";
import thumbClickerHero from "@/assets/game-thumbs/clicker-hero.jpg";
import thumbGooGooClicker from "@/assets/game-thumbs/goo-goo-clicker.jpg";
import thumbDanTheMan from "@/assets/game-thumbs/dan-the-man.jpg";
import thumbPixelAdventure from "@/assets/game-thumbs/pixel-adventure.jpg";
import thumb2048Merge from "@/assets/game-thumbs/2048-merge.jpg";
import thumbMergeBlock from "@/assets/game-thumbs/merge-block.jpg";
import thumbJewelsBlitz from "@/assets/game-thumbs/jewels-blitz.jpg";
import thumbAgentsIo from "@/assets/game-thumbs/agents-io.jpg";
import thumbBubbleFightIo from "@/assets/game-thumbs/bubble-fight-io.jpg";
import thumbCarEatsCar from "@/assets/game-thumbs/car-eats-car.jpg";
import thumbCarEatsCarVolcano from "@/assets/game-thumbs/car-eats-car-volcano.jpg";
import thumbWakeUpBox from "@/assets/game-thumbs/wake-up-box.jpg";
import thumbNumberMatch from "@/assets/game-thumbs/number-match.jpg";
import thumbWackyStrike from "@/assets/game-thumbs/wacky-strike.jpg";

interface Game {
  id: string;
  title: string;
  category: string;
  thumbnail: string;
  embedUrl: string;
  width: number;
  height: number;
  tags: string[];
  featured?: boolean;
  hot?: boolean;
  isNew?: boolean;
  popular?: boolean;
  players?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Action: "from-red-900/60 to-orange-900/40",
  Puzzle: "from-blue-900/60 to-cyan-900/40",
  Racing: "from-yellow-900/60 to-amber-900/40",
  Sports: "from-green-900/60 to-emerald-900/40",
  Simulation: "from-purple-900/60 to-violet-900/40",
  "Tower Defense": "from-amber-900/60 to-yellow-900/40",
  Stickman: "from-slate-900/60 to-gray-900/40",
  "Idle & Clicker": "from-emerald-900/60 to-teal-900/40",
  Adventure: "from-indigo-900/60 to-blue-900/40",
  Merge: "from-pink-900/60 to-rose-900/40",
  ".io": "from-cyan-900/60 to-sky-900/40",
};

const CATEGORY_ICONS: Record<string, typeof Gamepad2> = {
  Action: Zap,
  Puzzle: Brain,
  Racing: Car,
  Sports: Target,
  Simulation: Swords,
  "Tower Defense": Shield,
  Stickman: Target,
  "Idle & Clicker": Mouse,
  Adventure: Map,
  Merge: Layers,
  ".io": Users,
};

function GameThumbnail({ game, className = "", iconSize = "h-12 w-12" }: { game: Game; className?: string; iconSize?: string }) {
  const [imgError, setImgError] = useState(false);
  const gradient = CATEGORY_COLORS[game.category] || "from-primary/20 to-primary/5";
  const Icon = CATEGORY_ICONS[game.category] || Gamepad2;

  if (imgError || !game.thumbnail) {
    return (
      <div className={`bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2 ${className}`}>
        <Icon className={`${iconSize} text-white/40`} />
        <span className="text-white/30 text-xs font-serif">{game.category}</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <img
        src={game.thumbnail}
        alt={game.title}
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
        loading="lazy"
      />
    </div>
  );
}

const GAMES: Game[] = [
  {
    id: "subway-surfers",
    title: "Subway Surfers",
    category: "Action",
    thumbnail: thumbSubwaySurfers,
    embedUrl: "https://html5.gamedistribution.com/7e8d8e0e291d41ea88d2ed4fa70c9d52/",
    width: 800, height: 600,
    tags: ["Runner", "Endless", "Arcade"],
    featured: true, hot: true, popular: true, players: "2.1M playing",
  },
  {
    id: "stickman-hook",
    title: "Stickman Hook",
    category: "Action",
    thumbnail: thumbStickmanHook,
    embedUrl: "https://html5.gamedistribution.com/da817c8bf8744ace937a5ea0576a01e5/",
    width: 800, height: 600,
    tags: ["Stickman", "Physics", "Swing"],
    featured: true, hot: true, popular: true, players: "1.4M playing",
  },
  {
    id: "temple-run-2",
    title: "Temple Run 2",
    category: "Action",
    thumbnail: thumbTempleRun,
    embedUrl: "https://html5.gamedistribution.com/d7e4e02a47b7435bab30bb85551a13ec/",
    width: 800, height: 600,
    tags: ["Runner", "Endless", "Adventure"],
    featured: true, hot: true, popular: true, players: "1.8M playing",
  },
  {
    id: "8-ball-pool",
    title: "8 Ball Pool",
    category: "Sports",
    thumbnail: thumb8BallPool,
    embedUrl: "https://html5.gamedistribution.com/e5654e55a0674faa9fd3e4e93c339060/",
    width: 800, height: 600,
    tags: ["Pool", "Billiards", "Multiplayer"],
    featured: true, hot: true, popular: true, players: "980K playing",
  },
  {
    id: "drift-boss",
    title: "Drift Boss",
    category: "Racing",
    thumbnail: thumbDriftBoss,
    embedUrl: "https://html5.gamedistribution.com/77de5d60b29941f0b10b5f71fb8eb86e/",
    width: 800, height: 600,
    tags: ["Drifting", "Racing", "Casual"],
    featured: true, hot: true, popular: true, players: "750K playing",
  },
  {
    id: "soccer-skills-world-cup",
    title: "Soccer Skills World Cup",
    category: "Sports",
    thumbnail: thumbSoccerSkills,
    embedUrl: "https://html5.gamedistribution.com/b4e04a0f3e244cda87a0f7b57e6023c2/",
    width: 800, height: 600,
    tags: ["Soccer", "World Cup", "Skills"],
    featured: true, hot: true, popular: true, players: "620K playing",
  },
  {
    id: "winter-clash-3d",
    title: "Winter Clash 3D",
    category: "Action",
    thumbnail: thumbWinterClash,
    embedUrl: "https://html5.gamedistribution.com/70e909699e6b4f21978261f2764eadb5/",
    width: 800, height: 600,
    tags: ["FPS", "Multiplayer", "3D Shooter"],
    featured: true, hot: true,
  },
  {
    id: "city-car-stunt-4",
    title: "City Car Stunt 4",
    category: "Racing",
    thumbnail: thumbCityCarStunt,
    embedUrl: "https://html5.gamedistribution.com/8c29c6f3430c4dcfb36114782c35ac90/",
    width: 800, height: 600,
    tags: ["3D Racing", "Stunts", "Open World"],
    featured: true, hot: true,
  },
  {
    id: "death-chase",
    title: "Death Chase",
    category: "Racing",
    thumbnail: thumbDeathChase,
    embedUrl: "https://html5.gamedistribution.com/548d37bb149e40d1a3b4e67f94703be3/",
    width: 800, height: 600,
    tags: ["Racing", "Combat", "Action"],
    featured: true, hot: true,
  },
  {
    id: "boxing-random",
    title: "Boxing Random",
    category: "Sports",
    thumbnail: thumbBoxingRandom,
    embedUrl: "https://html5.gamedistribution.com/e8c02771085e4c8b9de3deda5e087e0e/",
    width: 800, height: 600,
    tags: ["Boxing", "2 Player", "Physics"],
    hot: true, isNew: true,
  },
  {
    id: "moto-x3m-winter",
    title: "Moto X3M 4: Winter",
    category: "Racing",
    thumbnail: thumbMotoWinter,
    embedUrl: "https://html5.gamedistribution.com/bcacf81441bd4c7799a622171116ea9d/",
    width: 800, height: 600,
    tags: ["Motorcycle", "Stunts", "Winter"],
    featured: true,
  },
  {
    id: "snow-rider-obby",
    title: "Snow Rider Obby Parkour",
    category: "Action",
    thumbnail: thumbSnowRider,
    embedUrl: "https://html5.gamedistribution.com/1d74e75b8da74767938d3310255b4bd3/",
    width: 800, height: 600,
    tags: ["Parkour", "3D", "Obstacle Course"],
    hot: true, isNew: true,
  },
  {
    id: "ninja-obby-parkour",
    title: "Ninja Obby Parkour",
    category: "Action",
    thumbnail: thumbNinjaObby,
    embedUrl: "https://html5.gamedistribution.com/7366d797ba8649cd8381f587ddcb29de/",
    width: 800, height: 600,
    tags: ["Ninja", "Parkour", "3D"],
    featured: true,
  },
  {
    id: "police-traffic-racer",
    title: "Police Traffic Racer",
    category: "Racing",
    thumbnail: thumbPoliceTraffic,
    embedUrl: "https://html5.gamedistribution.com/8748f54767044b99bc5373fc61596123/",
    width: 800, height: 600,
    tags: ["Police", "3D Racing", "Traffic"],
  },
  {
    id: "parkour-race",
    title: "Parkour Race",
    category: "Action",
    thumbnail: thumbParkourRace,
    embedUrl: "https://html5.gamedistribution.com/09efae2b2ec346bab60b393e6a78fe6e/",
    width: 800, height: 600,
    tags: ["Parkour", "Racing", "Runner"],
  },
  {
    id: "soccer-random",
    title: "Soccer Random",
    category: "Sports",
    thumbnail: thumbSoccerRandom,
    embedUrl: "https://html5.gamedistribution.com/308d826f20034d7b972f25258c8d0a44/",
    width: 800, height: 600,
    tags: ["Soccer", "2 Player", "Physics"],
    isNew: true,
  },
  {
    id: "basketball-stars",
    title: "Basketball Stars",
    category: "Sports",
    thumbnail: thumbBasketball,
    embedUrl: "https://html5.gamedistribution.com/69d78d071f704fa183d75b4114ae40ec/",
    width: 800, height: 600,
    tags: ["Basketball", "Multiplayer", "Sports"],
    featured: true,
  },
  {
    id: "uphill-rush-9",
    title: "Uphill Rush 9",
    category: "Racing",
    thumbnail: thumbUphill,
    embedUrl: "https://html5.gamedistribution.com/61381674e8404f3d97926c04d6bc2856/",
    width: 800, height: 600,
    tags: ["Racing", "Water", "Stunts"],
  },
  {
    id: "bike-racing-3",
    title: "Bike Racing 3",
    category: "Racing",
    thumbnail: thumbMotoX3m,
    embedUrl: "https://html5.gamedistribution.com/063e84a26698466184c700952cb9263b/",
    width: 800, height: 600,
    tags: ["Motorcycle", "Racing", "3D"],
  },
  {
    id: "basket-random",
    title: "Basket Random",
    category: "Sports",
    thumbnail: thumbBasketball,
    embedUrl: "https://html5.gamedistribution.com/bf1268dccb5d43e7970bb3edaa54afc8/",
    width: 800, height: 600,
    tags: ["Basketball", "2 Player", "Physics"],
  },
  {
    id: "crossy-road",
    title: "Crossy Road",
    category: "Action",
    thumbnail: thumbCrossy,
    embedUrl: "https://html5.gamedistribution.com/43c0e65e655b44fcaa3b39b7c4cbb41a/",
    width: 800, height: 600,
    tags: ["Arcade", "Endless", "Casual"],
  },
  {
    id: "zombie-derby",
    title: "Zombie Derby",
    category: "Action",
    thumbnail: thumbZombie,
    embedUrl: "https://html5.gamedistribution.com/86f6db80ae534d7bb9e6bf1e77e8d2a4/",
    width: 800, height: 600,
    tags: ["Zombie", "Driving", "Action"],
  },
  {
    id: "chess-online",
    title: "Chess Online",
    category: "Puzzle",
    thumbnail: thumbChess,
    embedUrl: "https://html5.gamedistribution.com/b068c9fde0034ddfb0e4cd9dd5e0c127/",
    width: 800, height: 600,
    tags: ["Chess", "Strategy", "Board"],
  },
  {
    id: "candy-rain",
    title: "Candy Rain 7",
    category: "Puzzle",
    thumbnail: thumbCandy,
    embedUrl: "https://html5.gamedistribution.com/afad0fc9de0b45a78e1ddd7396cc12c4/",
    width: 800, height: 600,
    tags: ["Match-3", "Puzzle", "Casual"],
  },
  {
    id: "bubble-shooter",
    title: "Bubble Shooter Pro",
    category: "Puzzle",
    thumbnail: thumbBubble,
    embedUrl: "https://html5.gamedistribution.com/d66ec4eb13634c9094e4ef262f52ed6a/",
    width: 800, height: 600,
    tags: ["Bubble", "Shooter", "Casual"],
  },
  {
    id: "fireboy-watergirl",
    title: "Fireboy and Watergirl",
    category: "Puzzle",
    thumbnail: thumbFireboy,
    embedUrl: "https://html5.gamedistribution.com/0f2ee0c86cc3451185c76d43d32e8e3c/",
    width: 800, height: 600,
    tags: ["Co-op", "Puzzle", "Adventure"],
    featured: true,
  },
  {
    id: "cut-the-rope",
    title: "Cut the Rope",
    category: "Puzzle",
    thumbnail: thumbCutRope,
    embedUrl: "https://html5.gamedistribution.com/72c84e7d11164ab8a3637c3d16da6378/",
    width: 800, height: 600,
    tags: ["Physics", "Puzzle", "Casual"],
  },
  {
    id: "solitaire-classic",
    title: "Solitaire Classic",
    category: "Puzzle",
    thumbnail: thumbSolitaire,
    embedUrl: "https://html5.gamedistribution.com/0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d/",
    width: 800, height: 600,
    tags: ["Cards", "Solitaire", "Classic"],
  },
  {
    id: "cooking-fever",
    title: "Cooking Fever",
    category: "Simulation",
    thumbnail: thumbCooking,
    embedUrl: "https://html5.gamedistribution.com/1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d/",
    width: 800, height: 600,
    tags: ["Cooking", "Time Management", "Casual"],
  },

  {
    id: "frost-defense",
    title: "Frost Defense",
    category: "Tower Defense",
    thumbnail: thumbFrostDefense,
    embedUrl: "https://html5.gamedistribution.com/ac7c68ff82a9413197db6b99a8452c10/",
    width: 800, height: 600,
    tags: ["Tower Defense", "Strategy", "Winter"],
    featured: true, isNew: true,
  },
  {
    id: "gold-tower-defense",
    title: "Gold Tower Defense",
    category: "Tower Defense",
    thumbnail: thumbGoldTowerDefense,
    embedUrl: "https://html5.gamedistribution.com/d4ac0ead7ff5403eb3aa6ab620b0b959/",
    width: 800, height: 600,
    tags: ["Tower Defense", "Strategy", "Gacha"],
    hot: true, isNew: true,
  },
  {
    id: "tower-defense-2d",
    title: "Tower Defense 2D",
    category: "Tower Defense",
    thumbnail: thumbTowerDefense2d,
    embedUrl: "https://html5.gamedistribution.com/7f27295d85f24a16b0a9eb5df0f94fb1/",
    width: 800, height: 600,
    tags: ["Tower Defense", "Classic", "Strategy"],
  },

  {
    id: "stickman-kombat-2d",
    title: "Stickman Kombat 2D",
    category: "Stickman",
    thumbnail: thumbStickmanKombat,
    embedUrl: "https://html5.gamedistribution.com/6d3928f393774157a7aed692f08ee011/",
    width: 800, height: 600,
    tags: ["Fighting", "2 Player", "Stickman"],
    featured: true, hot: true,
  },
  {
    id: "stickman-armed-assassin",
    title: "Stickman Armed Assassin",
    category: "Stickman",
    thumbnail: thumbStickmanAssassin,
    embedUrl: "https://html5.gamedistribution.com/787b84ac33264bbc9ab0ce83e7c011f2/",
    width: 960, height: 600,
    tags: ["Shooter", "Action", "Stickman"],
    isNew: true,
  },
  {
    id: "stickman-home-escape",
    title: "Stickman Home Escape",
    category: "Stickman",
    thumbnail: thumbStickmanEscape,
    embedUrl: "https://html5.gamedistribution.com/55603138fa704f8a9f5e524728ba1388/",
    width: 1280, height: 720,
    tags: ["Escape", "Adventure", "Stickman"],
  },

  {
    id: "clicker-hero",
    title: "Clicker Hero",
    category: "Idle & Clicker",
    thumbnail: thumbClickerHero,
    embedUrl: "https://html5.gamedistribution.com/8f137bff27e24f159677fcba28b2d2f4/",
    width: 800, height: 600,
    tags: ["Idle", "Clicker", "RPG"],
    featured: true, hot: true,
  },
  {
    id: "goo-goo-gaga-clicker",
    title: "Goo Goo Gaga Clicker",
    category: "Idle & Clicker",
    thumbnail: thumbGooGooClicker,
    embedUrl: "https://html5.gamedistribution.com/740fca628f4e499d95084c2d3c935acb/",
    width: 800, height: 600,
    tags: ["Clicker", "Casual", "Fun"],
    isNew: true,
  },

  {
    id: "dan-the-man",
    title: "Dan the Man",
    category: "Adventure",
    thumbnail: thumbDanTheMan,
    embedUrl: "https://html5.gamedistribution.com/3d11dfed72a04e00ae9a43ab3fd49bd6/",
    width: 800, height: 600,
    tags: ["Platformer", "Action", "Retro"],
    featured: true, isNew: true,
  },
  {
    id: "pixel-adventure",
    title: "Pixel Adventure",
    category: "Adventure",
    thumbnail: thumbPixelAdventure,
    embedUrl: "https://html5.gamedistribution.com/563ed088b0e0445e9d43f2e32a5510f9/",
    width: 960, height: 640,
    tags: ["Platformer", "Pixel Art", "Arcade"],
  },
  {
    id: "car-eats-car-underwater",
    title: "Car Eats Car: Underwater",
    category: "Adventure",
    thumbnail: thumbCarEatsCar,
    embedUrl: "https://html5.gamedistribution.com/16de13074932401f9f65f4023e586ab4/",
    width: 800, height: 600,
    tags: ["Driving", "Adventure", "Action"],
    hot: true,
  },
  {
    id: "car-eats-car-volcanic",
    title: "Car Eats Car: Volcanic",
    category: "Adventure",
    thumbnail: thumbCarEatsCarVolcano,
    embedUrl: "https://html5.gamedistribution.com/2889b8c611d84c00a3e077ee5bd21bf0/",
    width: 800, height: 600,
    tags: ["Driving", "Adventure", "Action"],
  },
  {
    id: "wake-up-the-box",
    title: "Wake Up the Box",
    category: "Adventure",
    thumbnail: thumbWakeUpBox,
    embedUrl: "https://html5.gamedistribution.com/88d7078602364cfd845f7c2796c456c7/",
    width: 800, height: 600,
    tags: ["Physics", "Puzzle", "Creative"],
  },

  {
    id: "2048-merge-world",
    title: "2048 Merge World",
    category: "Merge",
    thumbnail: thumb2048Merge,
    embedUrl: "https://html5.gamedistribution.com/a8ecea31288d4f6581ae36db798ce9ac/",
    width: 800, height: 600,
    tags: ["Merge", "Numbers", "Casual"],
    featured: true, isNew: true,
  },
  {
    id: "merge-block-raising",
    title: "Merge Block Raising",
    category: "Merge",
    thumbnail: thumbMergeBlock,
    embedUrl: "https://html5.gamedistribution.com/5fc965b3a1534a4aaa1181b98acf7238/",
    width: 800, height: 600,
    tags: ["Merge", "Block", "Casual"],
  },
  {
    id: "jewels-blitz-legends",
    title: "Jewels Blitz Legends",
    category: "Merge",
    thumbnail: thumbJewelsBlitz,
    embedUrl: "https://html5.gamedistribution.com/36cb9c95a60244d4899f6d79210e7f4d/",
    width: 800, height: 600,
    tags: ["Match-3", "Jewels", "Casual"],
    hot: true,
  },
  {
    id: "number-match",
    title: "Number Match",
    category: "Merge",
    thumbnail: thumbNumberMatch,
    embedUrl: "https://html5.gamedistribution.com/dab0bbeebecf4025bbd0da9425ec2b65/",
    width: 800, height: 600,
    tags: ["Numbers", "Match", "Brain"],
  },

  {
    id: "agents-io",
    title: "Agents.io",
    category: ".io",
    thumbnail: thumbAgentsIo,
    embedUrl: "https://html5.gamedistribution.com/9ef3636ea95a4d2486dcfe05bc8393e1/",
    width: 800, height: 600,
    tags: ["Multiplayer", "Action", ".io"],
    featured: true, hot: true, isNew: true,
  },
  {
    id: "bubble-fight-io",
    title: "Bubble Fight IO",
    category: ".io",
    thumbnail: thumbBubbleFightIo,
    embedUrl: "https://html5.gamedistribution.com/1af7162fcd7347c580350c8c34ea5f7b/",
    width: 800, height: 600,
    tags: ["Multiplayer", "Battle", ".io"],
    isNew: true,
  },
  {
    id: "wacky-strike",
    title: "Wacky Strike",
    category: ".io",
    thumbnail: thumbWackyStrike,
    embedUrl: "https://html5.gamedistribution.com/6c30cfc235744ec89ffd1d6658e07b22/",
    width: 800, height: 600,
    tags: ["FPS", "Multiplayer", "Action"],
    hot: true,
  },
];

const CATEGORIES = [
  { id: "all", label: "All Games", icon: Gamepad2 },
  { id: "Action", label: "Action", icon: Zap },
  { id: "Racing", label: "Racing", icon: Car },
  { id: "Sports", label: "Sports", icon: Target },
  { id: "Puzzle", label: "Puzzle", icon: Brain },
  { id: "Tower Defense", label: "Tower Defense", icon: Shield },
  { id: "Stickman", label: "Stickman", icon: Target },
  { id: "Idle & Clicker", label: "Idle & Clicker", icon: Mouse },
  { id: "Adventure", label: "Adventure", icon: Map },
  { id: "Merge", label: "Merge", icon: Layers },
  { id: ".io", label: ".io Games", icon: Users },
  { id: "Simulation", label: "Simulation", icon: Swords },
];

export default function Games() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const filteredGames = selectedCategory === "all" 
    ? GAMES 
    : GAMES.filter(g => g.category === selectedCategory);

  const popularGames = GAMES.filter(g => g.popular);
  const featuredGames = GAMES.filter(g => g.featured && !g.popular);
  const hotGames = GAMES.filter(g => g.hot && !g.popular);

  const playGame = useCallback((game: Game) => {
    setActiveGame(game);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const closeGame = useCallback(() => {
    setActiveGame(null);
    setIsFullscreen(false);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-body flex flex-col">
      <Navbar />

      <main className="flex-1 pt-20">
        <AnimatePresence mode="wait">
          {activeGame ? (
            <motion.div
              key="game-player"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={isFullscreen ? "fixed inset-0 z-[100] bg-black" : "container mx-auto px-4 py-6"}
            >
              <div className={isFullscreen ? "h-full flex flex-col" : ""}>
                <div className={`flex items-center justify-between ${isFullscreen ? "px-4 py-2 bg-black/90" : "mb-4"}`}>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={closeGame}
                      className="text-muted-foreground hover:text-white"
                      data-testid="button-close-game"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back to Games
                    </Button>
                    <span className="text-primary font-display text-lg hidden sm:inline">{activeGame.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="text-muted-foreground hover:text-white"
                    data-testid="button-toggle-fullscreen"
                  >
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </div>

                <div className={`relative ${isFullscreen ? "flex-1" : "aspect-[4/3] max-w-5xl mx-auto"} bg-black rounded-lg overflow-hidden border border-white/10`}>
                  <iframe
                    src={`${activeGame.embedUrl}?gd_sdk_referrer_url=${encodeURIComponent(window.location.href)}`}
                    className="absolute inset-0 w-full h-full"
                    scrolling="none"
                    frameBorder="0"
                    allowFullScreen
                    allow="autoplay; fullscreen"
                    data-testid="iframe-game-player"
                  />
                </div>

                {!isFullscreen && (
                  <div className="max-w-5xl mx-auto mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                      <h2 className="text-2xl font-display text-primary mb-2">{activeGame.title}</h2>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {activeGame.tags.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full font-serif">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="text-muted-foreground font-serif leading-relaxed">
                        Play {activeGame.title} for free right here in your browser. No downloads required.
                        Enjoy this {activeGame.category.toLowerCase()} game and explore our full collection of free online games.
                      </p>
                    </div>

                    <div className="bg-card/50 border border-white/10 rounded-lg p-4">
                      <h3 className="font-display text-primary text-sm mb-3">MORE GAMES YOU'LL LOVE</h3>
                      <div className="space-y-3">
                        {GAMES.filter(g => g.id !== activeGame.id && g.category === activeGame.category).slice(0, 3).map(game => (
                          <button
                            key={game.id}
                            onClick={() => playGame(game)}
                            className="flex items-center gap-3 w-full text-left hover:bg-white/5 rounded-lg p-2 transition-colors"
                            data-testid={`button-related-game-${game.id}`}
                          >
                            <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                              <GameThumbnail game={game} className="w-full h-full" iconSize="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-sm text-white font-serif">{game.title}</p>
                              <p className="text-xs text-muted-foreground">{game.category}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {!isFullscreen && (
                  <div className="max-w-5xl mx-auto mt-8 p-6 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                      <div className="flex-1">
                        <h3 className="font-display text-primary text-lg mb-1">LOVE READING TOO?</h3>
                        <p className="text-muted-foreground font-serif text-sm">
                          Check out our curated collection of ebooks — from thrilling mysteries to epic fantasy adventures.
                        </p>
                      </div>
                      <Link href="/catalog">
                        <Button className="bg-primary text-black hover:bg-primary/90 font-display" data-testid="link-browse-ebooks">
                          Browse Ebooks
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="game-hub"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <section className="relative py-16 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
                <div className="container mx-auto px-4 relative">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-center max-w-3xl mx-auto"
                  >
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <Gamepad2 className="h-8 w-8 text-primary" />
                      <h1 className="text-4xl md:text-6xl font-display text-primary tracking-wider">GAME HUB</h1>
                    </div>
                    <p className="text-lg text-muted-foreground font-serif">
                      Play free online games instantly — no downloads, no installs. 
                      From action-packed adventures to brain-teasing puzzles.
                    </p>
                    <div className="flex items-center justify-center gap-6 mt-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Gamepad2 className="h-4 w-4 text-primary" />
                        <span className="font-serif">{GAMES.length}+ Games</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="font-serif">Instant Play</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="font-serif">Free to Play</span>
                      </span>
                    </div>
                  </motion.div>
                </div>
              </section>

              {popularGames.length > 0 && (
                <section className="container mx-auto px-4 mb-14">
                  <div className="flex items-center gap-3 mb-6">
                    <Crown className="h-6 w-6 text-yellow-400" />
                    <h2 className="text-2xl font-display text-white tracking-wide">MOST POPULAR</h2>
                    <span className="text-xs font-serif text-yellow-400/70 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded-full">
                      Millions Playing Now
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                    {popularGames.map((game, i) => (
                      <motion.button
                        key={game.id}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08 }}
                        onClick={() => playGame(game)}
                        className="group relative overflow-hidden rounded-2xl border-2 border-yellow-500/40 bg-gradient-to-b from-yellow-950/30 to-card/60 hover:border-yellow-400/80 hover:shadow-[0_0_24px_rgba(234,179,8,0.25)] transition-all duration-300 text-left"
                        data-testid={`card-popular-game-${game.id}`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent pointer-events-none" />
                        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                          <span className="bg-yellow-400 text-black text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
                            <Trophy className="h-3 w-3" /> #{i + 1}
                          </span>
                        </div>
                        <div className="aspect-[4/3] relative overflow-hidden rounded-t-xl">
                          <GameThumbnail game={game} className="w-full h-full" iconSize="h-16 w-16" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100 bg-yellow-400 text-black rounded-full p-4 shadow-xl">
                              <Play className="h-8 w-8" />
                            </div>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/60 to-transparent" />
                        </div>
                        <div className="p-4">
                          <h3 className="font-display text-white text-base md:text-lg group-hover:text-yellow-400 transition-colors">{game.title}</h3>
                          <div className="flex items-center justify-between mt-1.5">
                            <p className="text-xs text-muted-foreground font-serif">{game.category}</p>
                            <span className="flex items-center gap-1 text-[10px] text-green-400 font-serif">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                              {game.players}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {game.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="px-1.5 py-0.5 bg-yellow-400/10 text-yellow-400/70 text-[10px] rounded font-serif border border-yellow-400/10">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </section>
              )}

              {hotGames.length > 0 && (
                <section className="container mx-auto px-4 mb-12">
                  <div className="flex items-center gap-2 mb-6">
                    <Flame className="h-5 w-5 text-orange-500" />
                    <h2 className="text-2xl font-display text-white tracking-wide">TRENDING NOW</h2>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {hotGames.map((game, i) => (
                      <motion.button
                        key={game.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        onClick={() => playGame(game)}
                        className="group relative overflow-hidden rounded-xl border border-white/10 bg-card/50 hover:border-primary/50 transition-all duration-300"
                        data-testid={`card-hot-game-${game.id}`}
                      >
                        <div className="aspect-[4/3] relative overflow-hidden">
                          <GameThumbnail game={game} className="w-full h-full" iconSize="h-14 w-14" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-black rounded-full p-3 shadow-lg">
                              <Play className="h-6 w-6" />
                            </div>
                          </div>
                          {game.hot && (
                            <span className="absolute top-2 left-2 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1 shadow-lg">
                              <Flame className="h-3 w-3" /> HOT
                            </span>
                          )}
                          {game.isNew && (
                            <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-bold shadow-lg">
                              NEW
                            </span>
                          )}
                        </div>
                        <div className="p-3">
                          <h3 className="font-display text-white text-sm group-hover:text-primary transition-colors truncate">{game.title}</h3>
                          <p className="text-xs text-muted-foreground font-serif">{game.category}</p>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </section>
              )}

              <section className="container mx-auto px-4 mb-12">
                <div className="flex items-center gap-2 mb-6">
                  <Star className="h-5 w-5 text-primary" />
                  <h2 className="text-2xl font-display text-white tracking-wide">FEATURED GAMES</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {featuredGames.map((game, i) => (
                    <motion.button
                      key={game.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => playGame(game)}
                      className="group relative overflow-hidden rounded-xl border border-white/10 bg-card/50 hover:border-primary/50 transition-all duration-300 text-left"
                      data-testid={`card-featured-game-${game.id}`}
                    >
                      <div className="aspect-video relative overflow-hidden">
                        <GameThumbnail game={game} className="w-full h-full" iconSize="h-16 w-16" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-100 scale-75 bg-primary text-black rounded-full p-4 shadow-lg">
                            <Play className="h-8 w-8" />
                          </div>
                        </div>
                        <div className="absolute top-3 left-3 bg-primary/90 text-black text-xs px-2 py-1 rounded font-display flex items-center gap-1 shadow-lg">
                          <Star className="h-3 w-3" /> FEATURED
                        </div>
                      </div>
                      <div className="p-4">
                        <h3 className="font-display text-white text-lg group-hover:text-primary transition-colors">{game.title}</h3>
                        <p className="text-sm text-muted-foreground font-serif mt-1">{game.category}</p>
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {game.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-white/5 text-muted-foreground text-xs rounded font-serif">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </section>

              <div className="container mx-auto px-4 mb-12">
                <div className="p-6 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="font-display text-primary text-lg mb-1">LOOKING FOR A GREAT READ?</h3>
                      <p className="text-muted-foreground font-serif text-sm">
                        Take a break from gaming and dive into our curated collection of ebooks — bestselling stories across every genre.
                      </p>
                    </div>
                    <Link href="/catalog">
                      <Button className="bg-primary text-black hover:bg-primary/90 font-display whitespace-nowrap" data-testid="link-cta-ebooks">
                        Explore Ebooks
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              <section className="container mx-auto px-4 mb-12">
                <div className="flex items-center gap-2 mb-6">
                  <Puzzle className="h-5 w-5 text-primary" />
                  <h2 className="text-2xl font-display text-white tracking-wide">ALL GAMES</h2>
                </div>

                <div className="flex flex-wrap gap-2 mb-8">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const isActive = selectedCategory === cat.id;
                    const count = cat.id === "all" ? GAMES.length : GAMES.filter(g => g.category === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all font-serif text-sm ${
                          isActive
                            ? "bg-primary/20 border-primary/50 text-primary"
                            : "bg-card/30 border-white/10 text-muted-foreground hover:border-white/20 hover:text-white"
                        }`}
                        data-testid={`button-category-${cat.id}`}
                      >
                        <Icon className="h-4 w-4" />
                        {cat.label}
                        <span className={`text-xs ${isActive ? "text-primary/70" : "text-muted-foreground/50"}`}>({count})</span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredGames.map((game, i) => (
                    <motion.button
                      key={game.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => playGame(game)}
                      className="group relative overflow-hidden rounded-lg border border-white/10 bg-card/50 hover:border-primary/40 transition-all duration-300"
                      data-testid={`card-game-${game.id}`}
                    >
                      <div className="aspect-[4/3] relative overflow-hidden">
                        <GameThumbnail game={game} className="w-full h-full" iconSize="h-8 w-8" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-primary text-black rounded-full p-2 shadow-lg">
                            <Play className="h-4 w-4" />
                          </div>
                        </div>
                        {game.hot && (
                          <span className="absolute top-1.5 left-1.5 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5 shadow">
                            <Flame className="h-2.5 w-2.5" /> HOT
                          </span>
                        )}
                        {game.isNew && (
                          <span className="absolute top-1.5 right-1.5 bg-green-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="p-2.5">
                        <h3 className="font-serif text-white text-xs group-hover:text-primary transition-colors truncate">{game.title}</h3>
                        <p className="text-[10px] text-muted-foreground">{game.category}</p>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </section>

              <section className="container mx-auto px-4 mb-16">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-card/30 border border-white/10 rounded-lg p-6 text-center">
                    <Zap className="h-8 w-8 text-primary mx-auto mb-3" />
                    <h3 className="font-display text-white text-lg mb-2">INSTANT PLAY</h3>
                    <p className="text-sm text-muted-foreground font-serif">No downloads, no installs. Click and play instantly in your browser on any device.</p>
                  </div>
                  <div className="bg-card/30 border border-white/10 rounded-lg p-6 text-center">
                    <TrendingUp className="h-8 w-8 text-primary mx-auto mb-3" />
                    <h3 className="font-display text-white text-lg mb-2">UPDATED WEEKLY</h3>
                    <p className="text-sm text-muted-foreground font-serif">New games added every week. Come back often to discover fresh titles and trending hits.</p>
                  </div>
                  <div className="bg-card/30 border border-white/10 rounded-lg p-6 text-center">
                    <Star className="h-8 w-8 text-primary mx-auto mb-3" />
                    <h3 className="font-display text-white text-lg mb-2">100% FREE</h3>
                    <p className="text-sm text-muted-foreground font-serif">All games are completely free to play. No hidden costs, no subscriptions required.</p>
                  </div>
                </div>
              </section>

              <section className="container mx-auto px-4 mb-16 max-w-5xl">
                <div className="flex items-center gap-2 mb-8">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <h2 className="text-2xl font-display text-white tracking-wide">ABOUT BROWSER GAMING</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 font-serif text-white/60 leading-relaxed text-sm">
                  <div>
                    <h3 className="text-primary font-display text-base mb-3">Why Browser Games Are So Popular</h3>
                    <p className="mb-4">
                      Browser games have exploded in popularity over the past decade because they remove every barrier between a player and fun. There's no waiting for a massive download to finish, no installation wizard to navigate, and no worrying about whether your computer meets system requirements. You visit a page, click a game, and you're playing within seconds.
                    </p>
                    <p>
                      Modern HTML5 technology has made it possible to deliver rich, visually impressive gaming experiences entirely within a web browser. Games like Subway Surfers, Stickman Hook, and Temple Run 2 offer the same addictive gameplay that made them famous on mobile — but accessible to anyone with a browser and an internet connection.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-primary font-display text-base mb-3">Something for Every Player</h3>
                    <p className="mb-4">
                      Our Game Hub is organized across a wide range of categories so you can find exactly what you're in the mood for. Want fast-paced action? Try our shooter and parkour games. Looking for something more relaxed? Our puzzle and merge games offer satisfying brain challenges at your own pace. Competitive players will enjoy our sports titles and multiplayer .io games.
                    </p>
                    <p>
                      Racing fans can choose from physics-based stunts to realistic traffic racers. Sports lovers get basketball, soccer, boxing, and pool. Strategy players can dig into tower defense, clicker games, and chess. There's always something new to discover.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-primary font-display text-base mb-3">Action & Shooting Games</h3>
                    <p className="mb-4">
                      Our action category includes some of the most-played browser games in the world. Winter Clash 3D puts you in an intense snow-themed battlefield where precision and reflexes are everything. Ninja Obby Parkour and Snow Rider Obby challenge you to navigate increasingly difficult obstacle courses with speed and timing. Crossy Road brings the classic frogger concept to life with charming pixel characters.
                    </p>
                    <p>
                      Stickman games offer a unique blend of humor and challenge — from physics-based swinging in Stickman Hook to fighting combat in Stickman Kombat 2D. These games are easy to pick up but hard to master, making them perfect for players of all ages.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-primary font-display text-base mb-3">Racing & Sports Games</h3>
                    <p className="mb-4">
                      The racing category covers everything from realistic traffic environments to wild stunt courses. City Car Stunt 4 lets you pull off incredible jumps and tricks in an open city environment. Death Chase combines racing with combat as you battle opponents across treacherous tracks. Moto X3M Winter brings motorcycle stunting to a snowy landscape full of creative obstacles.
                    </p>
                    <p>
                      For sports fans, Basketball Stars and Basket Random both offer addictive basketball gameplay — one more realistic, one delightfully chaotic. Soccer Random and Soccer Skills World Cup give you the thrill of the beautiful game. Boxing Random offers hilarious two-player physics boxing that never gets old.
                    </p>
                  </div>
                </div>
              </section>

              <section className="container mx-auto px-4 mb-16 max-w-5xl">
                <div className="flex items-center gap-2 mb-8">
                  <Brain className="h-5 w-5 text-primary" />
                  <h2 className="text-2xl font-display text-white tracking-wide">FREQUENTLY ASKED QUESTIONS</h2>
                </div>
                <div className="space-y-4">
                  {[
                    {
                      q: "Do I need to create an account to play games?",
                      a: "No account is needed. All games in our Game Hub are completely free to play without signing up or logging in. Just click on any game and start playing immediately.",
                    },
                    {
                      q: "Will these games work on my phone or tablet?",
                      a: "Most of our HTML5 games are designed to work on mobile browsers as well as desktop. Games built with touch controls are especially well-suited for phones and tablets. A few games with complex keyboard controls play better on a computer.",
                    },
                    {
                      q: "Why do some games take a moment to load?",
                      a: "HTML5 games load their assets (images, sounds, game code) directly in your browser. Games with higher-quality graphics or larger maps may take 10–30 seconds to fully load on first play. Subsequent plays are usually faster since your browser caches the assets.",
                    },
                    {
                      q: "Are these games safe for kids?",
                      a: "Our game library is curated to include fun, family-friendly titles appropriate for players of all ages. Games come from GameDistribution, a trusted publisher network that enforces content standards. We do not include games with graphic violence, adult content, or inappropriate themes.",
                    },
                    {
                      q: "What is the difference between these browser games and games like Fortnite?",
                      a: "Browser games like those in our Game Hub run entirely in your web browser using HTML5 technology — no download required. Games like Fortnite, Minecraft, and Call of Duty are full-scale PC and console games that must be downloaded and installed. They have much larger file sizes, higher system requirements, and require dedicated hardware to run. Our Downloads page provides official links for those larger games.",
                    },
                    {
                      q: "How often are new games added?",
                      a: "We add new games regularly as our library grows. Check back often or use the category filters to explore different genres. Popular and trending games are highlighted at the top of the page.",
                    },
                  ].map((item, i) => (
                    <div key={i} className="bg-card/30 border border-white/10 rounded-lg p-5">
                      <h3 className="font-display text-white text-sm mb-2">{item.q}</h3>
                      <p className="text-white/50 font-serif text-sm leading-relaxed">{item.a}</p>
                    </div>
                  ))}
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}