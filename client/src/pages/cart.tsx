import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { 
  ShoppingCart, 
  Trash2, 
  ArrowLeft, 
  ArrowRight,
  Loader2,
  Package,
  Tag,
  Check,
  ShieldCheck,
  Zap,
  RefreshCw,
  Lock
} from "lucide-react";
import { trackBeginCheckout } from "@/lib/analytics";

interface CartItem {
  id: number;
  title: string;
  author: string;
  price: number;
  coverUrl: string;
  purchaseType?: 'download' | 'read_online' | 'bundle';
}

export default function Cart() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [promoCode, setPromoCode] = useState(() => localStorage.getItem("ebgz_promo") || "");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscountRate, setPromoDiscountRate] = useState(0);
  const [promoEmail, setPromoEmail] = useState("");
  const [promoValidating, setPromoValidating] = useState(false);

  // Auto-apply any saved promo code on mount (e.g. EBGZOWNER stored from a previous session)
  useEffect(() => {
    const saved = localStorage.getItem("ebgz_promo");
    if (!saved) return;
    fetch("/api/promo/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: saved }),
    })
      .then(r => r.json())
      .then(result => {
        if (result.valid) {
          setPromoApplied(true);
          setPromoDiscountRate(result.discount);
          setPromoCode(saved.toUpperCase().trim());
        } else {
          // Saved code is no longer valid — clear it
          localStorage.removeItem("ebgz_promo");
          setPromoCode("");
        }
      })
      .catch(() => {});
  }, []);
  const [showExitPopup, setShowExitPopup] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("ebgz_cart_exit_shown");
    if (alreadyShown) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && cartItems.length > 0 && !showExitPopup) {
        setShowExitPopup(true);
        sessionStorage.setItem("ebgz_cart_exit_shown", "1");
      }
    };
    document.addEventListener("mouseleave", handleMouseLeave);
    return () => document.removeEventListener("mouseleave", handleMouseLeave);
  }, [cartItems.length, showExitPopup]);

  useEffect(() => {
    const loadCart = () => {
      const cart = JSON.parse(localStorage.getItem("cart") || "[]");
      setCartItems(cart);
    };
    
    loadCart();
    window.addEventListener("cartUpdated", loadCart);
    return () => window.removeEventListener("cartUpdated", loadCart);
  }, []);

  const removeFromCart = (id: number) => {
    const updatedCart = cartItems.filter(item => item.id !== id);
    setCartItems(updatedCart);
    localStorage.setItem("cart", JSON.stringify(updatedCart));
    window.dispatchEvent(new Event("cartUpdated"));
    
    toast({
      title: "Removed from cart",
      description: "Item has been removed from your cart.",
    });
  };

  const clearCart = () => {
    setCartItems([]);
    localStorage.setItem("cart", JSON.stringify([]));
    window.dispatchEvent(new Event("cartUpdated"));
    
    toast({
      title: "Cart cleared",
      description: "All items have been removed from your cart.",
    });
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    
    setIsCheckingOut(true);
    const total = cartItems.reduce((sum, item) => sum + item.price, 0);
    trackBeginCheckout(cartItems, total);
    
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: cartItems, promoCode: promoCode || undefined }),
      });

      if (!response.ok) {
        throw new Error("Failed to create checkout session");
      }

      const { url } = await response.json();
      
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
      setIsCheckingOut(false);
    }
  };

  const isFirstTimeCode = promoCode.toUpperCase().trim() === "WELCOME10";

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    if (isFirstTimeCode && (!promoEmail.trim() || !promoEmail.includes("@"))) {
      toast({ title: "Email required", description: "Please enter your email to apply the promo code.", variant: "destructive" });
      return;
    }
    setPromoValidating(true);
    try {
      const resp = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoCode, email: promoEmail }),
      });
      const result = await resp.json();
      if (result.valid) {
        const upperCode = promoCode.toUpperCase().trim();
        setPromoApplied(true);
        setPromoDiscountRate(result.discount);
        setPromoCode(upperCode);
        localStorage.setItem("ebgz_promo", upperCode);
        toast({ title: "Promo code applied!", description: `${Math.round(result.discount * 100)}% discount has been added to your order.` });
      } else {
        setPromoApplied(false);
        toast({ title: "Code not valid", description: result.reason || "Please check your code and try again.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not validate promo code. Try again.", variant: "destructive" });
    } finally {
      setPromoValidating(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoApplied(false);
    setPromoDiscountRate(0);
    setPromoCode("");
    setPromoEmail("");
    localStorage.removeItem("ebgz_promo");
  };

  const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
  const discount = promoApplied ? subtotal * promoDiscountRate : 0;
  const total = subtotal - discount;

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {isCheckingOut && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-white text-xl font-display">Preparing Secure Checkout...</p>
          <p className="text-white/60 text-sm font-serif">You'll be redirected to Stripe shortly</p>
        </div>
      )}
      <Navbar />
      
      <div className="container mx-auto px-4 py-24">
        <div className="flex items-center gap-4 mb-8">
          <ShoppingCart className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-display text-white">Your Cart</h1>
          {cartItems.length > 0 && (
            <span className="text-muted-foreground font-serif">({cartItems.length} items)</span>
          )}
        </div>

        {cartItems.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24 border border-dashed border-white/10 rounded-lg bg-white/5"
          >
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-6 opacity-50" />
            <h2 className="text-2xl font-display text-white mb-4">Your cart is empty</h2>
            <p className="text-muted-foreground font-serif mb-8">
              Browse our catalog and add some books to get started.
            </p>
            <Link href="/catalog">
              <Button className="bg-primary text-black hover:bg-primary/90 font-display">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Browse Catalog
              </Button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <AnimatePresence>
                {cartItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-card/50 border border-white/10 rounded-lg p-4 flex gap-4"
                  >
                    <img 
                      src={item.coverUrl} 
                      alt={item.title}
                      className="w-20 h-28 object-cover rounded"
                    />
                    <div className="flex-1">
                      <Link href={`/book/${item.id}`}>
                        <h3 className="font-display text-lg text-white hover:text-primary transition-colors cursor-pointer">
                          {item.title}
                        </h3>
                      </Link>
                      <p className="text-sm text-muted-foreground font-serif italic">
                        by {item.author}
                      </p>
                      {item.purchaseType && (
                        <span className={`inline-block text-xs px-2 py-0.5 rounded mt-1 ${
                          item.purchaseType === 'bundle' ? 'bg-amber-500/20 text-amber-400' :
                          item.purchaseType === 'read_online' ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/70'
                        }`}>
                          {item.purchaseType === 'bundle' ? 'Read + Download Bundle' :
                           item.purchaseType === 'read_online' ? 'Online Reading (1 Year)' : 'Digital Download'}
                        </span>
                      )}
                      <p className="text-primary font-display text-xl mt-2">
                        ${item.price.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromCart(item.id)}
                      className="text-muted-foreground hover:text-red-500"
                      data-testid={`button-remove-${item.id}`}
                      aria-label="Remove from cart"
                    >
                      <Trash2 className="h-5 w-5" aria-hidden="true" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>

              <div className="flex justify-between pt-4">
                <Link href="/catalog">
                  <Button variant="ghost" className="text-muted-foreground hover:text-white">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Continue Shopping
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  onClick={clearCart}
                  className="text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Cart
                </Button>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-card/50 border border-white/10 rounded-lg p-6 sticky top-24">
                <h2 className="font-display text-xl text-primary mb-6">Order Summary</h2>
                
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-muted-foreground font-serif">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  {promoApplied && (
                    <div className="flex justify-between text-emerald-400 font-serif">
                      <span className="flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {promoCode} (-{Math.round(promoDiscountRate * 100)}%)
                      </span>
                      <span>-${discount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator className="bg-white/10" />
                  <div className="flex justify-between font-display text-xl">
                    <span className="text-white">Total</span>
                    <span className="text-primary">${total.toFixed(2)}</span>
                  </div>
                </div>

                {!promoApplied ? (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground font-serif mb-2">Have a promo code?</p>
                    <div className="space-y-2">
                      <Input
                        placeholder="Enter code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="bg-black/30 border-white/10 font-serif text-sm uppercase"
                        data-testid="input-promo-code"
                      />
                      {isFirstTimeCode && (
                        <Input
                          type="email"
                          placeholder="Your email (to verify first-time use)"
                          value={promoEmail}
                          onChange={(e) => setPromoEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                          className="bg-black/30 border-white/10 font-serif text-sm"
                          data-testid="input-promo-email"
                        />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleApplyPromo}
                        disabled={promoValidating}
                        className="border-primary/30 text-primary hover:bg-primary/10 w-full"
                        data-testid="button-apply-promo"
                      >
                        {promoValidating ? "Checking..." : "Apply Code"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-emerald-400 text-sm flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      {promoCode} applied — {Math.round(promoDiscountRate * 100)}% off!
                    </span>
                    <button
                      onClick={handleRemovePromo}
                      className="text-xs text-muted-foreground hover:text-white"
                      data-testid="button-remove-promo"
                    >
                      Remove
                    </button>
                  </div>
                )}

                <Button 
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                  className="w-full bg-primary text-black hover:bg-primary/90 font-display text-lg py-6"
                  data-testid="button-checkout"
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      Proceed to Checkout
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground font-serif">
                    <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>256-bit SSL encrypted checkout</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground font-serif">
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Instant digital delivery</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground font-serif">
                    <RefreshCw className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>30-day satisfaction guarantee</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground font-serif">
                    <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                    <span>Powered by Stripe — trusted by millions</span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground text-center mt-4 space-y-1">
                  <p>
                    <a href="/refund-policy" className="text-primary/70 underline hover:text-primary">Refund Policy</a>
                    {" | "}
                    <a href="/terms-of-service" className="text-primary/70 underline hover:text-primary">Terms</a>
                    {" | "}
                    <a href="/privacy-policy" className="text-primary/70 underline hover:text-primary">Privacy</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showExitPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowExitPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-stone-900 border border-primary/30 rounded-xl p-8 max-w-md w-full text-center shadow-2xl"
              data-testid="cart-exit-popup"
            >
              <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Tag className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-display text-2xl text-white mb-2">Wait — Don't Forget!</h2>
              <p className="text-muted-foreground font-serif mb-4">
                Use code <span className="text-primary font-bold">WELCOME10</span> at checkout for <span className="text-white font-bold">10% off</span> your first order.
              </p>
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    setPromoCode("WELCOME10");
                    localStorage.setItem("ebgz_promo", "WELCOME10");
                    setShowExitPopup(false);
                    toast({ title: "Code applied!", description: "WELCOME10 has been added. Enter your email to verify." });
                  }}
                  className="w-full bg-primary text-black hover:bg-primary/90 font-display text-lg py-5"
                  data-testid="button-exit-apply-code"
                >
                  Apply WELCOME10 & Stay
                </Button>
                <button
                  onClick={() => setShowExitPopup(false)}
                  className="text-sm text-muted-foreground hover:text-white transition-colors font-serif"
                >
                  No thanks, I'll continue browsing
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
