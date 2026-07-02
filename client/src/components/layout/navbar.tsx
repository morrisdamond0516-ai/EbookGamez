import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { ShoppingBag, Search, Menu, Lock, LogOut, Tag, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ADMIN_TOKEN_KEY = "ebgz_admin_token";

async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin/verify", {
      headers: { "x-admin-token": token },
    });
    const data = await res.json();
    return data.authenticated === true;
  } catch {
    return false;
  }
}

export function Navbar() {
  const [cartCount, setCartCount] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [, navigate] = useLocation();
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = () => {
    const q = searchQuery.trim();
    if (q) {
      navigate(`/catalog?search=${encodeURIComponent(q)}`);
      setSearchQuery("");
    }
  };

  useEffect(() => {
    const updateCartCount = () => {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]");
      setCartCount(cart.length);
    };
    
    updateCartCount();
    window.addEventListener("cartUpdated", updateCartCount);
    return () => window.removeEventListener("cartUpdated", updateCartCount);
  }, []);

  const [isCustomerLoggedIn, setIsCustomerLoggedIn] = useState(!!localStorage.getItem("ebgz_customer_token"));

  useEffect(() => {
    const checkCustomer = () => setIsCustomerLoggedIn(!!localStorage.getItem("ebgz_customer_token"));
    window.addEventListener("storage", checkCustomer);
    return () => window.removeEventListener("storage", checkCustomer);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (token) {
      verifyAdminToken(token).then((valid) => {
        if (valid) {
          setShowAdmin(true);
        } else {
          localStorage.removeItem(ADMIN_TOKEN_KEY);
          setShowAdmin(false);
        }
      });
    }
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginPassword }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        setShowAdmin(true);
        setShowLoginDialog(false);
        setLoginPassword("");
        setLoginError("");
      } else {
        setLoginError("Incorrect password");
      }
    } catch {
      setLoginError("Login failed. Try again.");
    }
    setLoginLoading(false);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (token) {
      await fetch("/api/admin/logout", {
        method: "POST",
        headers: { "x-admin-token": token },
      }).catch(() => {});
    }
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    // Also purge any legacy raw-password key from prior versions
    localStorage.removeItem("ebgz_admin_pw");
    setShowAdmin(false);
  };

  const handleLogoClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    tapCount.current += 1;

    if (tapTimer.current) clearTimeout(tapTimer.current);

    if (tapCount.current >= 5) {
      tapCount.current = 0;
      if (showAdmin) {
        handleLogout();
      } else {
        setShowLoginDialog(true);
      }
      return;
    }

    tapTimer.current = setTimeout(() => {
      if (tapCount.current === 1) {
        window.location.href = "/";
      }
      tapCount.current = 0;
    }, 2000);
  }, [showAdmin]);

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-white/10">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <a href="/" onClick={handleLogoClick} className="flex items-center hover:opacity-80 transition-opacity select-none">
            <span className="font-display text-2xl md:text-3xl text-primary tracking-widest">
              EBOOKGAME<span className="italic text-white relative" style={{ fontFamily: "'Playfair Display', serif", textShadow: '0 0 8px rgba(201, 169, 113, 0.5)' }}>Z</span>
            </span>
          </a>

          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-foreground/80 hover:text-primary transition-colors font-serif">Home</Link>
            <Link href="/catalog" className="text-foreground/80 hover:text-primary transition-colors font-serif">Catalog</Link>
            <Link href="/games" className="text-foreground/80 hover:text-primary transition-colors font-serif">Games</Link>
            <Link href="/downloads" className="text-foreground/80 hover:text-primary transition-colors font-serif">Downloads</Link>
            <Link href="/guides" className="text-foreground/80 hover:text-primary transition-colors font-serif">Guides</Link>
            <Link href="/subscription" className="text-emerald-400 hover:text-emerald-300 transition-colors font-serif">Reading Pass</Link>
            <Link href="/about" className="text-foreground/80 hover:text-primary transition-colors font-serif">About</Link>
            {showAdmin && (
              <>
                <Link href="/admin" className="text-primary/70 hover:text-primary transition-colors font-serif border border-primary/30 px-3 py-1 rounded-sm text-sm hover:bg-primary/10">Admin</Link>
                <Link href="/content-studio" className="text-primary/70 hover:text-primary transition-colors font-serif border border-primary/30 px-3 py-1 rounded-sm text-sm hover:bg-primary/10">AI Studio</Link>
                <button onClick={handleLogout} className="text-stone-500 hover:text-red-400 transition-colors" aria-label="Logout">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex relative">
              <Input 
                placeholder="Search library..." 
                className="w-64 bg-black/20 border-white/10 focus:border-primary/50 text-sm pl-4 pr-10 font-serif"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                data-testid="input-navbar-search"
              />
              <button onClick={handleSearch} className="absolute right-3 top-2.5" data-testid="button-navbar-search" aria-label="Search">
                <Search className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" aria-hidden="true" />
              </button>
            </div>
            

            <Link href={isCustomerLoggedIn ? "/my-account" : "/login"}>
              <Button variant="ghost" size="icon" className="text-foreground hover:text-primary hover:bg-white/5" data-testid="button-account-nav" aria-label={isCustomerLoggedIn ? "My account" : "Sign in"}>
                <User className="h-5 w-5" aria-hidden="true" />
              </Button>
            </Link>

            <Link href="/cart">
              <Button variant="ghost" size="icon" className="text-foreground hover:text-primary hover:bg-white/5 relative" aria-label="Shopping cart">
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Button>
            </Link>

            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-background border-l border-white/10">
                  <div className="flex flex-col space-y-6 mt-10">
                    <div className="relative">
                      <Input 
                        placeholder="Search library..." 
                        className="w-full bg-black/20 border-white/10 focus:border-primary/50 text-sm pl-4 pr-10 font-serif"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                        data-testid="input-mobile-search"
                      />
                      <button onClick={handleSearch} className="absolute right-3 top-2.5" aria-label="Search">
                        <Search className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" aria-hidden="true" />
                      </button>
                    </div>
                    <Link href="/" className="text-xl font-serif text-foreground hover:text-primary">Home</Link>
                    <Link href="/catalog" className="text-xl font-serif text-foreground hover:text-primary">Catalog</Link>
                    <Link href="/games" className="text-xl font-serif text-foreground hover:text-primary">Games</Link>
                    <Link href="/downloads" className="text-xl font-serif text-foreground hover:text-primary">Downloads</Link>
                    <Link href="/guides" className="text-xl font-serif text-foreground hover:text-primary">Guides</Link>
                    <Link href="/subscription" className="text-xl font-serif text-emerald-400 hover:text-emerald-300">Reading Pass</Link>
                    <Link href="/about" className="text-xl font-serif text-foreground hover:text-primary">About</Link>
                    <Link href={isCustomerLoggedIn ? "/my-account" : "/login"} className="text-xl font-serif text-foreground hover:text-primary" data-testid="link-mobile-account">
                      {isCustomerLoggedIn ? "My Account" : "Sign In"}
                    </Link>
                    {showAdmin && (
                      <>
                        <Link href="/admin" className="text-xl font-serif text-primary hover:text-primary/80">Admin Dashboard</Link>
                        <Link href="/content-studio" className="text-xl font-serif text-primary hover:text-primary/80">AI Content Studio</Link>
                        <button onClick={handleLogout} className="text-left text-xl font-serif text-red-400 hover:text-red-300">Logout</button>
                      </>
                    )}
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </nav>

      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-md bg-stone-900 border-stone-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-300 font-serif">
              <Lock className="h-5 w-5" /> Admin Login
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-4">
            <Input
              type="password"
              placeholder="Enter admin password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="bg-stone-800 border-stone-600 text-white"
              autoFocus
              data-testid="input-admin-password"
            />
            {loginError && <p className="text-red-400 text-sm">{loginError}</p>}
            <Button type="submit" disabled={loginLoading || !loginPassword} className="w-full bg-amber-700 hover:bg-amber-600 text-white" data-testid="button-admin-login">
              {loginLoading ? "Verifying..." : "Login"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
