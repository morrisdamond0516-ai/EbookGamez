import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GRAND_OPENING_END = new Date("2026-07-26T23:59:59");

interface Particle {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  type: "confetti" | "ribbon";
  delay: number;
  duration: number;
  swayX: number;
}

const COLORS = [
  "#c9a971", "#f59e0b", "#ef4444", "#3b82f6", "#10b981",
  "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#ffffff",
];

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: -10 - Math.random() * 20,
    rotation: Math.random() * 720 - 360,
    scale: 0.5 + Math.random() * 1,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    type: Math.random() > 0.4 ? "confetti" : "ribbon",
    delay: Math.random() * 1.5,
    duration: 2.5 + Math.random() * 2,
    swayX: (Math.random() - 0.5) * 30,
  }));
}

export function GrandOpeningBanner() {
  const [show, setShow] = useState(() => {
    if (new Date() > GRAND_OPENING_END) return false;
    if (typeof window !== "undefined" && (window.location.pathname.startsWith("/admin") || window.location.pathname.startsWith("/read/"))) return false;
    const lastShown = localStorage.getItem("ebgz_grand_shown_at");
    if (lastShown) {
      const hoursSince = (Date.now() - parseInt(lastShown)) / (1000 * 60 * 60);
      if (hoursSince < 24) return false;
    }
    return true;
  });

  const particles = useMemo(() => (show ? createParticles(80) : []), [show]);

  useEffect(() => {
    if (!show) return;
    localStorage.setItem("ebgz_grand_shown_at", String(Date.now()));
    const timer = setTimeout(() => setShow(false), 5000);
    return () => clearTimeout(timer);
  }, [show]);

  useEffect(() => {
    document.documentElement.style.setProperty("--banner-height", "0px");
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="fixed inset-0 z-[200] pointer-events-none"
          data-testid="grand-opening-splash"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          <div className="absolute inset-0 overflow-hidden">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                initial={{
                  x: `${p.x}vw`,
                  y: `${p.y}vh`,
                  rotate: 0,
                  scale: 0,
                }}
                animate={{
                  y: `${110 + Math.random() * 20}vh`,
                  x: `${p.x + p.swayX}vw`,
                  rotate: p.rotation,
                  scale: p.scale,
                }}
                transition={{
                  duration: p.duration,
                  delay: p.delay,
                  ease: "easeOut",
                }}
                style={{
                  position: "absolute",
                  width: p.type === "ribbon" ? "4px" : "10px",
                  height: p.type === "ribbon" ? "28px" : "10px",
                  backgroundColor: p.color,
                  borderRadius: p.type === "confetti" ? "2px" : "1px",
                }}
              />
            ))}
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }}
              className="text-center"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <h1
                  className="text-5xl sm:text-7xl md:text-8xl font-display tracking-wider"
                  style={{
                    background: "linear-gradient(135deg, #c9a971 0%, #f5d89a 30%, #c9a971 50%, #f5d89a 70%, #c9a971 100%)",
                    backgroundSize: "200% 200%",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    filter: "drop-shadow(0 0 30px rgba(201,169,113,0.5))",
                    animation: "shimmer 3s ease-in-out infinite",
                  }}
                >
                  GRAND
                </h1>
                <h1
                  className="text-5xl sm:text-7xl md:text-8xl font-display tracking-wider -mt-2"
                  style={{
                    background: "linear-gradient(135deg, #f5d89a 0%, #c9a971 30%, #f5d89a 50%, #c9a971 70%, #f5d89a 100%)",
                    backgroundSize: "200% 200%",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    filter: "drop-shadow(0 0 30px rgba(201,169,113,0.5))",
                    animation: "shimmer 3s ease-in-out infinite",
                  }}
                >
                  OPENING
                </h1>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.6 }}
              >
                <div className="mt-4 flex items-center justify-center gap-3">
                  <div className="h-px w-16 bg-gradient-to-r from-transparent to-primary/60" />
                  <p className="text-lg md:text-xl text-white/80 font-serif">
                    Welcome to EbookGamez
                  </p>
                  <div className="h-px w-16 bg-gradient-to-l from-transparent to-primary/60" />
                </div>
                <p className="text-sm text-white/50 font-serif mt-2">
                  545+ ebooks &bull; 40+ free games &bull; gaming guides & more
                </p>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
