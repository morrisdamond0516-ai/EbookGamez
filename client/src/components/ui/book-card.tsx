import { useState, useEffect } from "react";
import { Star, Download, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

interface BookProps {
  id: string;
  title: string;
  author: string;
  price: number;
  rating: number;
  cover: string;
  genre: string;
  fitMode?: "cover" | "contain";
  subscriberExclusiveUntil?: string | null;
  onBuy: () => void;
}

const CLASSIC_GRADIENTS: Record<string, string> = {
  "Classic Literature": "from-amber-900 via-amber-800 to-yellow-900",
  "Classic Horror": "from-red-950 via-gray-900 to-slate-950",
  "Classic Science Fiction": "from-indigo-950 via-blue-900 to-cyan-950",
  "Classic Mystery": "from-slate-900 via-gray-800 to-zinc-900",
  "Classic Fantasy": "from-purple-950 via-violet-900 to-indigo-950",
  "Classic Adventure": "from-emerald-950 via-teal-900 to-green-950",
  "Classic Romance": "from-rose-950 via-pink-900 to-red-950",
  "Classic Philosophy": "from-stone-800 via-neutral-700 to-stone-900",
  "Classic Epic": "from-amber-950 via-orange-900 to-yellow-950",
  "Classic Drama": "from-fuchsia-950 via-purple-900 to-rose-950",
};

const CLASSIC_ACCENTS: Record<string, string> = {
  "Classic Literature": "text-amber-300",
  "Classic Horror": "text-red-400",
  "Classic Science Fiction": "text-cyan-400",
  "Classic Mystery": "text-gray-300",
  "Classic Fantasy": "text-violet-300",
  "Classic Adventure": "text-emerald-300",
  "Classic Romance": "text-pink-300",
  "Classic Philosophy": "text-stone-300",
  "Classic Epic": "text-amber-400",
  "Classic Drama": "text-fuchsia-300",
};

function ClassicCover({ title, author, genre }: { title: string; author: string; genre: string }) {
  const gradient = CLASSIC_GRADIENTS[genre] || "from-amber-900 via-amber-800 to-yellow-900";
  const accent = CLASSIC_ACCENTS[genre] || "text-amber-300";

  return (
    <div role="img" aria-label={`Cover art for ${title} by ${author}`} className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center p-6 relative overflow-hidden`}>
      <div className="absolute inset-0 opacity-[0.04]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }} />
      <div className="absolute top-3 left-3 right-3 bottom-3 border border-white/10 rounded-sm" />
      <div className="absolute top-5 left-5 right-5 bottom-5 border border-white/5 rounded-sm" />

      <div className="relative z-10 text-center flex flex-col items-center justify-center flex-1 px-2">
        <div className="w-12 h-[1px] bg-white/20 mb-4" />
        <h3
          className={`font-display text-lg md:text-xl leading-tight mb-3 ${accent} drop-shadow-lg`}
          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}
        >
          {title}
        </h3>
        <div className="w-8 h-[1px] bg-white/15 mb-3" />
        <p className="text-white/60 text-xs font-serif italic tracking-wide">{author}</p>
      </div>

      <div className="relative z-10 mt-auto">
        <p className="text-white/20 text-[9px] uppercase tracking-[0.3em] font-display">Public Domain</p>
      </div>
    </div>
  );
}

export function optimizedSrc(src: string, width: number): string {
  if (!src || src.includes("placeholder")) return src;
  if (src.startsWith("/uploads/")) {
    const filePath = src.slice(1);
    return `/img/${width}/${filePath}`;
  }
  if (src.startsWith("/objstore/covers/")) {
    return `${src}?w=${width}`;
  }
  return src;
}

export function getExclusiveDaysLeft(until: string | null | undefined): number | null {
  if (!until) return null;
  const end = new Date(until);
  if (isNaN(end.getTime())) return null;
  const now = new Date();
  if (end <= now) return null;
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function BookCard({ id, title, author, price, rating, cover, genre, fitMode, subscriberExclusiveUntil, onBuy }: BookProps) {
  const [imgError, setImgError] = useState(false);
  useEffect(() => setImgError(false), [cover]);
  const isClassic = genre.startsWith("Classic");
  const isPlaceholder = cover.includes("placeholder");
  const showClassicCover = isClassic && (isPlaceholder || imgError);
  const resolvedFitMode = fitMode || (cover.includes("ai-overlay") ? "contain" : "cover");
  const exclusiveDaysLeft = getExclusiveDaysLeft(subscriberExclusiveUntil);
  const isSubscriberExclusive = exclusiveDaysLeft !== null;
  const isExpiringSoon = exclusiveDaysLeft !== null && exclusiveDaysLeft <= 3;

  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="overflow-hidden bg-card/50 border-white/5 group h-full flex flex-col hover:border-primary/30 transition-colors">
        <Link href={`/book/${id}`}>
          <div className="relative aspect-[3/4] overflow-hidden cursor-pointer bg-black">
            {showClassicCover ? (
              <ClassicCover title={title} author={author} genre={genre} />
            ) : (
              <img
                src={optimizedSrc(cover, 400)}
                alt={title}
                loading="lazy"
                decoding="async"
                width={300}
                height={400}
                onError={() => setImgError(true)}
                className={`${resolvedFitMode === "contain" ? "object-contain" : "object-cover"} w-full h-full transition-transform duration-700 group-hover:scale-105`}
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 gap-2">
               {isClassic && (
                 <Button
                   onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/read/book/${id}`; }}
                   className="w-full bg-amber-600 text-white hover:bg-amber-500 font-serif"
                   data-testid={`button-read-${id}`}
                 >
                   <BookOpen className="h-4 w-4 mr-1" /> Read Online
                 </Button>
               )}
               <Button onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/book/${id}`; }} className="w-full bg-primary text-black hover:bg-primary/90 font-serif">
                 Buy Now
               </Button>
            </div>
            {isSubscriberExclusive && (
              <Badge className={`absolute top-2 left-2 backdrop-blur border text-white font-serif text-[10px] px-1.5 py-0.5 flex items-center gap-1 ${isExpiringSoon ? "bg-gradient-to-r from-red-500/80 to-orange-500/80 border-red-400/40 animate-pulse" : "bg-gradient-to-r from-purple-500/80 to-amber-500/80 border-purple-400/40"}`} data-testid={`badge-exclusive-${id}`}>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                Exclusive · {exclusiveDaysLeft} {exclusiveDaysLeft === 1 ? "day" : "days"} left
              </Badge>
            )}
            <Badge className="absolute top-2 right-2 bg-black/60 backdrop-blur border border-white/10 text-primary font-serif">
              {genre}
            </Badge>
          </div>
        </Link>
        
        <CardContent className="p-4 flex-grow">
          <h3 className="font-display text-base leading-tight mb-1 text-foreground group-hover:text-primary transition-colors line-clamp-3" title={title}>
            {title}
          </h3>
          <p className="text-sm text-muted-foreground font-serif italic mb-2">by {author}</p>
          <div className="flex items-center space-x-1 text-primary/80 text-xs">
            {[...Array(5)].map((_, i) => (
              <Star 
                key={i} 
                className={`h-3 w-3 ${i < Math.floor(rating) ? "fill-current" : "opacity-30"}`} 
              />
            ))}
            <span className="ml-2 text-muted-foreground">({rating})</span>
          </div>
        </CardContent>
        
        <CardFooter className="p-4 pt-0 flex items-center justify-between gap-2 border-t border-white/5 mt-auto bg-black/20">
          <span className="text-xl font-display text-primary shrink-0">${price.toFixed(2)}</span>
          {isClassic ? (
            <Link href={`/read/book/${id}`} className="flex-1 ml-1" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" className="w-full bg-amber-700/80 hover:bg-amber-600 text-white font-serif text-xs py-1 h-8" data-testid={`button-read-card-${id}`}>
                <BookOpen className="h-3 w-3 mr-1" /> Read Free
              </Button>
            </Link>
          ) : (
            <Link href={`/book/${id}`} className="flex-1 ml-1" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" className="w-full bg-primary/90 hover:bg-primary text-black font-serif text-xs py-1 h-8" data-testid={`button-view-card-${id}`}>
                View &amp; Buy
              </Button>
            </Link>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}
