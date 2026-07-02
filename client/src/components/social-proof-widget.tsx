import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Eye, ShoppingCart, Users, Flame } from "lucide-react";
import { useLocation } from "wouter";

const HIDDEN_PATHS = [
  "/admin", "/content-studio", "/batch-cover-review", "/read/",
  "/login", "/signup", "/checkout/success", "/subscription/success",
];

function truncate(s: string, max = 34) {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function readerLabel(name: string | null | undefined, isLive: boolean): string {
  if (name && name.trim().length > 0) return name.trim();
  return isLive ? "A potential buyer" : "A reader";
}

interface Stats {
  visitors_week: number;
  visitors_month: number;
  read_sessions_total: number;
  read_sessions_today: number;
  reading_now: number;
  checkout_now: number;
  checkout_today: number;
  published_books: number;
}

interface BookEvent {
  activity_type: "reading" | "viewing";
  title: string;
  is_live: boolean;
  customer_first_name?: string | null;
}

interface SocialProofData {
  stats: Stats;
  books: BookEvent[];
}

interface Notification {
  icon: typeof BookOpen;
  text: string;
  isLive: boolean;
  key: number;
}

function buildMessages(data: SocialProofData, fallbackTitles: string[]): Notification[] {
  const s = data.stats;
  const books = data.books;
  const msgs: Omit<Notification, "key">[] = [];

  // --- LIVE right-now messages (highest priority) ---
  if (Number(s.checkout_now) > 0) {
    msgs.push({ icon: ShoppingCart, isLive: true,
      text: "Someone is at the payment screen right now" });
  }
  if (Number(s.reading_now) > 0) {
    msgs.push({ icon: BookOpen, isLive: true,
      text: `${s.reading_now} ${Number(s.reading_now) === 1 ? "person is" : "people are"} reading right now` });
  }

  // Live book-level activity
  books.filter(b => b.is_live).forEach(b => {
    if (b.activity_type === "reading") {
      msgs.push({ icon: BookOpen, isLive: true,
        text: `${readerLabel(b.customer_first_name, true)} is reading "${truncate(b.title)}" right now` });
    } else {
      msgs.push({ icon: Eye, isLive: true,
        text: `${readerLabel(b.customer_first_name, true)} is looking at "${truncate(b.title)}" right now` });
    }
  });

  // --- Today stats ---
  if (Number(s.read_sessions_today) > 0) {
    msgs.push({ icon: BookOpen, isLive: false,
      text: `${s.read_sessions_today} ${Number(s.read_sessions_today) === 1 ? "reading session" : "reading sessions"} started today` });
  }
  if (Number(s.checkout_today) > 0) {
    msgs.push({ icon: ShoppingCart, isLive: false,
      text: `${s.checkout_today} ${Number(s.checkout_today) === 1 ? "person" : "people"} checked out our plans today` });
  }

  // Recent non-live book activity
  books.filter(b => !b.is_live).slice(0, 6).forEach(b => {
    if (b.activity_type === "reading") {
      msgs.push({ icon: BookOpen, isLive: false,
        text: `${readerLabel(b.customer_first_name, false)} recently finished a session with "${truncate(b.title)}"` });
    } else {
      msgs.push({ icon: Eye, isLive: false,
        text: `${readerLabel(b.customer_first_name, false)} is browsing "${truncate(b.title)}" this week` });
    }
  });

  // --- Broader stats (always available as long-tail) ---
  if (Number(s.visitors_week) > 0) {
    msgs.push({ icon: Users, isLive: false,
      text: `${s.visitors_week} readers visited our library this week` });
  }
  if (Number(s.visitors_month) > 0) {
    msgs.push({ icon: Users, isLive: false,
      text: `${s.visitors_month} people explored EbookGamez this month` });
  }
  if (Number(s.read_sessions_total) > 0) {
    msgs.push({ icon: Flame, isLive: false,
      text: `${s.read_sessions_total}+ reading sessions on EbookGamez and counting` });
  }
  if (Number(s.published_books) > 0) {
    msgs.push({ icon: Flame, isLive: false,
      text: `${s.published_books} titles ready to read — dive in today` });
  }

  // --- Fallback catalog titles when nothing else available ---
  if (msgs.length < 4 && fallbackTitles.length > 0) {
    const picks = [...fallbackTitles].sort(() => Math.random() - 0.5).slice(0, 4);
    picks.forEach(title => {
      msgs.push({ icon: Eye, isLive: false,
        text: `"${truncate(title)}" is available to read now` });
    });
  }

  return msgs.map((m, i) => ({ ...m, key: i }));
}

export function SocialProofWidget() {
  const [location] = useLocation();
  const [notification, setNotification] = useState<Notification | null>(null);

  const messagesRef = useRef<Notification[]>([]);
  const usedRef = useRef<Set<number>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counterRef = useRef(0);
  const fallbackTitlesRef = useRef<string[]>([]);

  const hidden = HIDDEN_PATHS.some(p => location.startsWith(p));

  const { data } = useQuery<SocialProofData>({
    queryKey: ["/api/social-proof"],
    queryFn: () => fetch("/api/social-proof").then(r => r.json()),
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 2,
    enabled: !hidden,
  });

  const { data: allBooks } = useQuery<{ id: number; title: string }[]>({
    queryKey: ["/api/books"],
    queryFn: () => fetch("/api/books").then(r => r.json()),
    staleTime: 1000 * 60 * 10,
    enabled: !hidden,
  });

  useEffect(() => {
    if (allBooks && Array.isArray(allBooks)) {
      fallbackTitlesRef.current = allBooks
        .filter((b: any) => b.visible !== false && b.title)
        .map((b: any) => b.title as string);
    }
  }, [allBooks]);

  useEffect(() => {
    if (data && data.stats) {
      messagesRef.current = buildMessages(data, fallbackTitlesRef.current);
      usedRef.current = new Set(); // reset rotation when fresh data arrives
    }
  }, [data]);

  useEffect(() => {
    if (hidden) return;

    const showNext = () => {
      const pool = messagesRef.current;
      if (!pool.length) {
        timerRef.current = setTimeout(showNext, 4000);
        return;
      }

      // Rotate without repeating until all shown
      let available = pool.filter(m => !usedRef.current.has(m.key));
      if (!available.length) {
        usedRef.current = new Set();
        available = pool;
      }

      // Prioritise live messages
      const live = available.filter(m => m.isLive);
      const chosen = live.length > 0 ? pickRandom(live) : pickRandom(available);
      usedRef.current.add(chosen.key);
      counterRef.current += 1;

      setNotification({ ...chosen, key: counterRef.current });

      timerRef.current = setTimeout(() => {
        setNotification(null);
        timerRef.current = setTimeout(showNext, pickRandom([7000, 8000, 10000, 11000]));
      }, 5000);
    };

    const initial = setTimeout(showNext, pickRandom([6000, 8000, 10000]));
    return () => {
      clearTimeout(initial);
      if (timerRef.current) clearTimeout(timerRef.current);
      setNotification(null);
    };
  }, [hidden, location]);

  if (hidden) return null;

  const Icon = notification?.icon ?? BookOpen;

  return (
    <div className="fixed bottom-6 left-4 z-40 max-w-[300px] pointer-events-none">
      <AnimatePresence mode="wait">
        {notification && (
          <motion.div
            key={notification.key}
            initial={{ opacity: 0, x: -60, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -40, y: 10 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="flex items-start gap-3 p-3 rounded-xl border border-[#d4af37]/25 backdrop-blur-md shadow-2xl pointer-events-auto cursor-default bg-[#0e0d0b]/92"
          >
            <div className="mt-0.5 flex-shrink-0 rounded-full p-1.5 bg-[#d4af37]/15 border border-[#d4af37]/20">
              <Icon className="h-3.5 w-3.5 text-[#d4af37]" />
            </div>
            <div className="min-w-0">
              <p className="text-white/85 text-xs leading-snug font-serif">
                {notification.text.split(/(\d[\d,+]*\+?)/).map((part, i) =>
                  /^\d[\d,+]*\+?$/.test(part)
                    ? <span key={i} className="text-[#d4af37] font-bold text-sm">{part}</span>
                    : part
                )}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className={`absolute inline-flex h-full w-full rounded-full bg-[#d4af37] opacity-60 ${notification.isLive ? "animate-ping" : ""}`} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#d4af37]" />
                </span>
                <span className="text-white/30 text-[10px] font-serif tracking-wide">
                  {notification.isLive ? "Right now" : "Live activity"}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
