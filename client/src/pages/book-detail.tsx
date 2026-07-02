import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { optimizedSrc as optimizedCoverSrc, getExclusiveDaysLeft } from "@/components/ui/book-card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Star, 
  Download, 
  ShoppingCart, 
  BookOpen, 
  User, 
  Calendar,
  Loader2,
  MessageSquare,
  ThumbsUp,
  Send,
  Eye,
  X,
  Lock,
  Shield,
  Zap,
  RefreshCw,
  Tag,
  Check
} from "lucide-react";
import { getAuthHeaders, handleAuthError, clearSubscriptionAuth } from "@/lib/subscription-auth";
import { trackViewItem, trackBeginCheckout, trackAddToCart } from "@/lib/analytics";
import FlipbookPreview from "@/components/flipbook-preview";

interface Book {
  id: number;
  title: string;
  author: string;
  price: string;
  rating: string;
  coverUrl: string;
  genre: string;
  category: string;
  description?: string;
  createdAt: string;
}

interface Review {
  id: number;
  bookId: number;
  visitorId: string;
  displayName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface ReviewsData {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
}

function getVisitorId() {
  let id = localStorage.getItem("ebgz_visitor_id");
  if (!id) {
    id = "v_" + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem("ebgz_visitor_id", id);
  }
  return id;
}

function StarRatingInput({ value, onChange, size = "lg" }: { value: number; onChange: (v: number) => void; size?: "sm" | "lg" }) {
  const [hover, setHover] = useState(0);
  const starSize = size === "lg" ? "h-8 w-8" : "h-5 w-5";

  return (
    <div className="flex items-center gap-1" data-testid="star-rating-input">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star)}
          className="transition-transform hover:scale-110"
          data-testid={`button-star-${star}`}
          aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
        >
          <Star
            className={`${starSize} transition-colors ${
              star <= (hover || value)
                ? "fill-amber-400 text-amber-400"
                : "text-gray-600"
            }`}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-2 text-amber-400 font-display text-lg">{value}/5</span>
      )}
    </div>
  );
}

function StarDisplay({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const starSize = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${starSize} ${
            star <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-gray-600"
          }`}
        />
      ))}
    </div>
  );
}

function ReviewSection({ bookId }: { bookId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const visitorId = getVisitorId();

  const { data: reviewsData, isLoading } = useQuery<ReviewsData>({
    queryKey: ["reviews", bookId],
    queryFn: async () => {
      const res = await fetch(`/api/books/${bookId}/reviews`);
      return res.json();
    },
  });

  useEffect(() => {
    if (reviewsData?.reviews) {
      const mine = reviewsData.reviews.find(r => r.visitorId === visitorId);
      if (mine) {
        setRating(mine.rating);
        setDisplayName(mine.displayName);
        setComment(mine.comment || "");
        setSubmitted(true);
      }
    }
  }, [reviewsData, visitorId]);

  const submitReview = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/books/${bookId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId, displayName: displayName.trim(), rating, comment: comment.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to submit");
      }
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ["reviews", bookId] });
      queryClient.invalidateQueries({ queryKey: ["book", String(bookId)] });
      toast({ title: "Review submitted", description: "Thank you for your feedback!" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const reviews = reviewsData?.reviews || [];
  const avgRating = reviewsData?.averageRating || 0;
  const totalReviews = reviewsData?.totalReviews || 0;

  return (
    <div className="mt-16" data-testid="section-reviews">
      <h2 className="text-2xl font-display text-white mb-2 flex items-center gap-2">
        <MessageSquare className="h-6 w-6 text-primary" />
        Customer Reviews
      </h2>

      {totalReviews > 0 && (
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-display text-amber-400">{avgRating.toFixed(1)}</span>
            <div>
              <StarDisplay rating={avgRating} size="lg" />
              <p className="text-sm text-muted-foreground">{totalReviews} review{totalReviews !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-card/50 border border-white/10 rounded-lg p-6 mb-8">
        <h3 className="text-lg font-display text-white mb-4">
          {submitted ? "Update Your Review" : "Rate This Book"}
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Your Rating</label>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Your Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              maxLength={50}
              className="w-full max-w-sm bg-background border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
              data-testid="input-reviewer-name"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Your Review (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you think of this book?"
              maxLength={1000}
              rows={3}
              className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:border-primary focus:outline-none resize-none"
              data-testid="input-review-comment"
            />
            <p className="text-xs text-muted-foreground mt-1">{comment.length}/1000</p>
          </div>
          <Button
            onClick={() => submitReview.mutate()}
            disabled={rating === 0 || !displayName.trim() || submitReview.isPending}
            className="bg-primary text-black hover:bg-primary/90 font-display"
            data-testid="button-submit-review"
          >
            {submitReview.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {submitted ? "Update Review" : "Submit Review"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : reviews.length > 0 ? (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div key={review.id} className="bg-card/30 border border-white/5 rounded-lg p-5" data-testid={`review-${review.id}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <span className="font-semibold text-white text-sm">{review.displayName}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <StarDisplay rating={review.rating} />
              </div>
              {review.comment && (
                <p className="text-muted-foreground font-serif text-sm leading-relaxed mt-2 pl-11">
                  {review.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-muted-foreground py-8 font-serif italic">
          No reviews yet. Be the first to share your thoughts!
        </p>
      )}
    </div>
  );
}

function SuggestionSection({ bookId }: { bookId: number }) {
  const { data: suggestions, isLoading } = useQuery<Book[]>({
    queryKey: ["suggestions", bookId],
    queryFn: async () => {
      const res = await fetch(`/api/books/${bookId}/suggestions`);
      return res.json();
    },
  });

  if (isLoading || !suggestions || suggestions.length === 0) return null;

  return (
    <div className="mt-16" data-testid="section-suggestions">
      <h2 className="text-2xl font-display text-white mb-6 flex items-center gap-2">
        <ThumbsUp className="h-6 w-6 text-primary" />
        You Might Also Like
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {suggestions.map((book) => (
          <Link key={book.id} href={`/book/${book.id}`}>
            <motion.div
              whileHover={{ y: -4 }}
              className="cursor-pointer group"
              data-testid={`suggestion-${book.id}`}
            >
              <div className="aspect-[2/3] rounded-lg overflow-hidden border border-white/10 mb-2 bg-black">
                <img
                  src={optimizedCoverSrc(book.coverUrl, 300)}
                  alt={book.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <h4 className="text-xs font-semibold text-white line-clamp-2 group-hover:text-primary transition-colors">
                {book.title}
              </h4>
              <div className="flex items-center gap-1 mt-1">
                <StarDisplay rating={parseFloat(book.rating)} />
                <span className="text-xs text-muted-foreground ml-1">${parseFloat(book.price).toFixed(2)}</span>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function BookDetail() {
  const [match, params] = useRoute("/book/:id");
  const { toast } = useToast();
  const [readerEmail, setReaderEmail] = useState(() => localStorage.getItem("reader_email") || "");
  const [emailInput, setEmailInput] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handlePurchasedDownload = async (bookId: number) => {
    const headers: Record<string, string> = {};
    const customerToken = localStorage.getItem("ebgz_customer_token");
    if (customerToken) headers["x-customer-token"] = customerToken;
    const subToken = localStorage.getItem("ebgz_sub_token");
    if (subToken) headers["X-Subscription-Token"] = subToken;
    const orderToken = localStorage.getItem("ebgz_order_token");
    if (orderToken) headers["x-order-token"] = orderToken;
    try {
      const response = await fetch(`/api/books/${bookId}/download?format=epub`, { headers });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Download failed" }));
        toast({ title: "Download Error", description: errData.error || "Download failed", variant: "destructive" });
        return;
      }
      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
      const filename = filenameMatch ? filenameMatch[1] : `ebook-${bookId}.epub`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Download Started", description: "Your EPUB is downloading." });
    } catch {
      toast({ title: "Download Error", description: "Failed to download. Please try again.", variant: "destructive" });
    }
  };

  const { data: book, isLoading, error } = useQuery<Book>({
    queryKey: ["book", params?.id],
    queryFn: async () => {
      const response = await fetch(`/api/books/${params?.id}`);
      if (!response.ok) {
        throw new Error("Book not found");
      }
      return response.json();
    },
    enabled: !!params?.id,
  });

  useEffect(() => {
    if (book) {
      trackViewItem(book);
    }
  }, [book?.id]);

  useEffect(() => {
    if (!book) return;
    const desc = book.description
      || `${book.title} by ${book.author}. A ${book.genre} ebook available to read online or download from EbookGamez.`;
    const truncatedDesc = desc.length > 160 ? desc.slice(0, 157) + "..." : desc;

    document.title = `${book.title} by ${book.author} | EbookGamez`;

    const setMeta = (sel: string, attr: string, val: string) => {
      let el = document.querySelector(sel) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); document.head.appendChild(el); }
      el.setAttribute(attr, val);
    };

    setMeta('meta[name="description"]', "content", truncatedDesc);
    setMeta('meta[property="og:title"]', "content", `${book.title} by ${book.author}`);
    setMeta('meta[property="og:description"]', "content", truncatedDesc);
    setMeta('meta[property="og:url"]', "content", `https://ebookgamez.com/book/${book.id}`);
    if (book.coverUrl) {
      setMeta('meta[property="og:image"]', "content", book.coverUrl.startsWith("http") ? book.coverUrl : `https://ebookgamez.com${book.coverUrl}`);
    }
    setMeta('meta[name="twitter:title"]', "content", `${book.title} by ${book.author}`);
    setMeta('meta[name="twitter:description"]', "content", truncatedDesc);

    return () => {
      document.title = "EbookGamez - Ebooks, Games, Downloads & Gaming Guides";
      setMeta('meta[name="description"]', "content", "EbookGamez is a digital entertainment platform offering 600+ full-length ebooks, free-to-play HTML5 games, PC and console game downloads, and expert gaming guides.");
      setMeta('meta[property="og:title"]', "content", "EbookGamez - Ebooks, Games, Downloads & Gaming Guides");
      setMeta('meta[property="og:description"]', "content", "EbookGamez is a digital entertainment platform offering 600+ full-length ebooks, free-to-play HTML5 games, PC and console game downloads, and expert gaming guides.");
      setMeta('meta[property="og:url"]', "content", "https://ebookgamez.com/");
      setMeta('meta[name="twitter:title"]', "content", "EbookGamez - Ebooks, Games, Downloads & Gaming Guides");
      setMeta('meta[name="twitter:description"]', "content", "EbookGamez is a digital entertainment platform offering 600+ full-length ebooks, free-to-play HTML5 games, PC and console game downloads, and expert gaming guides.");
    };
  }, [book?.id]);

  const isClassic = book?.genre?.startsWith("Classic") || false;

  const { data: accessInfo, refetch: refetchAccess } = useQuery<{
    hasAccess: boolean;
    accessType: string;
    readsLeft?: number;
    downloadsLeft?: number;
    planName?: string;
    canUseRead?: boolean;
    canDownload?: boolean;
    hasDownloadAccess?: boolean;
    isSubscriberExclusive?: boolean;
    subscriberExclusiveUntil?: string | null;
    rolloverCredits?: number;
  }>({
    queryKey: ["book-access", params?.id, readerEmail],
    queryFn: async () => {
      const headers: Record<string, string> = {};
      const customerToken = localStorage.getItem("ebgz_customer_token");
      if (customerToken) headers["x-customer-token"] = customerToken;
      const subToken = localStorage.getItem("ebgz_sub_token");
      if (subToken) headers["X-Subscription-Token"] = subToken;
      const orderToken = localStorage.getItem("ebgz_order_token");
      if (orderToken) headers["x-order-token"] = orderToken;
      const r = await fetch(`/api/books/${params?.id}/check-access`, { headers });
      if (!r.ok) throw new Error("Failed to check access");
      return r.json();
    },
    enabled: !!params?.id && !isClassic,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const handleAuthExpired = () => {
    clearSubscriptionAuth();
    toast({ title: "Session expired", description: "Please verify your email on the subscription page to continue.", variant: "destructive" });
  };

  const handleCheckout = async () => {
    if (!book || !readerEmail) return;
    setSubLoading(true);
    try {
      const r = await fetch("/api/subscription/library-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ email: readerEmail, bookId: book.id }),
      });
      if (r.status === 401) { handleAuthExpired(); return; }
      const body = await r.json().catch(() => ({}));
      if (r.ok) {
        toast({ title: "Book checked out!", description: "You can now read this book. Return it when you're done to check out another." });
        refetchAccess();
      } else {
        toast({ title: "Cannot check out", description: body.error || "Unable to check out this book.", variant: "destructive" });
        refetchAccess();
      }
    } finally {
      setSubLoading(false);
    }
  };

  const handleReturn = async () => {
    if (!readerEmail) return;
    setSubLoading(true);
    try {
      const r = await fetch("/api/subscription/return", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ email: readerEmail }),
      });
      if (r.status === 401) { handleAuthExpired(); return; }
      if (r.ok) {
        toast({ title: "Book returned", description: "You can now check out a new book." });
        refetchAccess();
      } else {
        const body = await r.json().catch(() => ({}));
        toast({ title: "Cannot return", description: body.error || "Unable to return this book.", variant: "destructive" });
      }
    } finally {
      setSubLoading(false);
    }
  };

  const handleSubDownload = async () => {
    if (!book || !readerEmail) return;
    setSubLoading(true);
    try {
      const r = await fetch("/api/subscription/download", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ email: readerEmail, bookId: book.id }),
      });
      if (r.status === 401) { handleAuthExpired(); return; }
      if (r.ok) {
        toast({ title: "Download unlocked", description: "Your download credit has been used. Download link is now available." });
        refetchAccess();
      } else {
        const body = await r.json().catch(() => ({}));
        toast({ title: "Cannot download", description: body.error || "Unable to download this book.", variant: "destructive" });
      }
    } finally {
      setSubLoading(false);
    }
  };

  const saveEmail = () => {
    if (emailInput.trim()) {
      localStorage.setItem("reader_email", emailInput.trim());
      setReaderEmail(emailInput.trim());
    }
  };

  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState(() => localStorage.getItem("ebgz_promo") || "");
  const [promoApplied, setPromoApplied] = useState(false);
  const [promoDiscountRate, setPromoDiscountRate] = useState(0);
  const [promoInput, setPromoInput] = useState(() => localStorage.getItem("ebgz_promo") || "");
  const [promoValidating, setPromoValidating] = useState(false);

  // Auto-apply any saved promo code on mount
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
          setPromoInput(saved.toUpperCase().trim());
        } else {
          localStorage.removeItem("ebgz_promo");
          setPromoCode("");
          setPromoInput("");
        }
      })
      .catch(() => {});
  }, []);

  const isFirstTimeCode = promoInput.toUpperCase().trim() === "WELCOME10";

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoValidating(true);
    try {
      const resp = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoInput }),
      });
      const result = await resp.json();
      if (result.valid) {
        const upper = promoInput.toUpperCase().trim();
        setPromoApplied(true);
        setPromoCode(upper);
        setPromoDiscountRate(result.discount);
        localStorage.setItem("ebgz_promo", upper);
        toast({ title: "Promo applied!", description: `${Math.round(result.discount * 100)}% off your purchase.` });
      } else {
        setPromoApplied(false);
        toast({ title: "Code not valid", description: result.reason || "Please check your code.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not validate code. Try again.", variant: "destructive" });
    } finally {
      setPromoValidating(false);
    }
  };

  const handleRemovePromo = () => {
    setPromoApplied(false);
    setPromoCode("");
    setPromoDiscountRate(0);
    setPromoInput("");
    localStorage.removeItem("ebgz_promo");
  };

  const handleBuyNow = async (purchaseType: 'download' | 'read_online' | 'bundle') => {
    if (!book) return;
    setCheckoutLoading(purchaseType);
    const price = getPrice(purchaseType);
    trackBeginCheckout([{ id: book.id, title: book.title, price, purchaseType }], price);
    
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ items: [{ id: book.id, purchaseType }], promoCode: promoCode || undefined }),
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
      setCheckoutLoading(null);
      toast({
        title: "Error",
        description: "Failed to start checkout. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getPrice = (purchaseType: 'download' | 'read_online' | 'bundle') => {
    if (!book) return 0;
    const fullPrice = parseFloat(book.price);
    const genre = (book.genre || '').toLowerCase();
    const isVisualFormat = ['coloring', 'art book'].some(v => genre.includes(v));
    if (purchaseType === 'read_online') {
      if (isVisualFormat) {
        return Math.max(1.99, fullPrice - 1);
      }
      const discounted = Math.round((fullPrice * 0.65) * 100) / 100;
      const cents = Math.round((discounted % 1) * 100);
      const rounded = cents >= 75 ? Math.floor(discounted) + 0.99 : cents >= 25 ? Math.floor(discounted) + 0.49 : Math.floor(discounted) + 0.99 - 1;
      return Math.max(1.99, rounded);
    }
    if (purchaseType === 'bundle') {
      const premium = Math.round((fullPrice * 1.30) * 100) / 100;
      const cents = Math.round((premium % 1) * 100);
      const rounded = cents >= 75 ? Math.floor(premium) + 0.99 : cents >= 25 ? Math.floor(premium) + 0.49 : Math.floor(premium) + 0.99 - 1;
      return Math.max(fullPrice + 1, rounded);
    }
    return fullPrice;
  };

  const getPurchaseLabel = (purchaseType: string) => {
    if (purchaseType === 'read_online') return 'Online Reading';
    if (purchaseType === 'bundle') return 'Read + Download';
    return 'Download';
  };

  const handleAddToCart = (purchaseType: 'download' | 'read_online' | 'bundle') => {
    if (!book) return;
    
    const cart = JSON.parse(localStorage.getItem("cart") || "[]");
    const existingItem = cart.find((item: any) => item.id === book.id);
    
    if (existingItem) {
      toast({
        title: "Already in cart",
        description: `${book.title} is already in your cart.`,
      });
      return;
    }
    
    cart.push({
      id: book.id,
      title: book.title,
      author: book.author,
      price: getPrice(purchaseType),
      coverUrl: book.coverUrl,
      purchaseType,
    });
    
    localStorage.setItem("cart", JSON.stringify(cart));
    trackAddToCart({ id: book.id, title: book.title, price: getPrice(purchaseType), purchaseType, genre: book.genre });
    
    toast({
      title: "Added to cart",
      description: `${book.title} (${getPurchaseLabel(purchaseType)}) added to your cart.`,
    });
    
    window.dispatchEvent(new Event("cartUpdated"));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-body">
        <Navbar />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="min-h-screen bg-background text-foreground font-body">
        <Navbar />
        <div className="container mx-auto px-4 py-32 text-center">
          <h1 className="text-3xl font-display text-white mb-4">Book Not Found</h1>
          <p className="text-muted-foreground mb-8">The book you're looking for doesn't exist or has been removed.</p>
          <Link href="/catalog">
            <Button variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Catalog
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const price = parseFloat(book.price);
  const rating = parseFloat(book.rating);

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Navbar />

      {checkoutLoading && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-white text-xl font-display">Preparing Secure Checkout...</p>
          <p className="text-white/60 text-sm font-serif">You'll be redirected to Stripe shortly</p>
        </div>
      )}
      
      <div className="container mx-auto px-4 py-24">
        <Link href="/catalog">
          <Button variant="ghost" className="mb-8 text-muted-foreground hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Catalog
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            <div className="aspect-[2/3] rounded-lg overflow-hidden shadow-2xl shadow-black/50 border border-white/10">
              <img 
                src={optimizedCoverSrc(book.coverUrl, 600)} 
                alt={book.title}
                className="w-full h-full object-cover"
              />
            </div>
            <Badge className="absolute top-4 right-4 bg-primary text-black font-serif px-4 py-2">
              {book.genre}
            </Badge>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex flex-col"
          >
            <Badge variant="outline" className="w-fit mb-4 border-white/20 text-muted-foreground">
              {book.category}
            </Badge>
            
            <h1 className="text-4xl md:text-5xl font-display text-white mb-4">
              {book.title}
            </h1>

            {accessInfo?.isSubscriberExclusive && (() => {
              const daysLeft = getExclusiveDaysLeft(accessInfo.subscriberExclusiveUntil);
              const isExpiringSoon = daysLeft !== null && daysLeft <= 3;
              const hasSubscription = accessInfo.accessType === "subscription_read" || accessInfo.accessType === "subscription_available";
              return (
                <div className="space-y-1 mb-3">
                  <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${isExpiringSoon ? "bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/40 animate-pulse" : "bg-gradient-to-r from-purple-500/20 to-amber-500/20 border border-purple-500/40"}`} data-testid="badge-subscriber-exclusive">
                    <svg className={`w-3.5 h-3.5 ${isExpiringSoon ? "text-red-400" : "text-purple-400"}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                    <span className={`text-xs font-medium ${isExpiringSoon ? "text-red-300" : "text-purple-300"}`}>
                      Subscriber Exclusive{daysLeft !== null ? ` · ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left` : ""}
                    </span>
                  </div>
                  {!hasSubscription && daysLeft !== null && (
                    <p className="text-xs text-muted-foreground" data-testid="text-available-soon">
                      Available to all in {daysLeft} {daysLeft === 1 ? "day" : "days"}
                    </p>
                  )}
                </div>
              );
            })()}
            
            <div className="flex items-center gap-2 text-muted-foreground mb-6">
              <User className="h-4 w-4" />
              <span className="font-serif italic text-lg">by {book.author}</span>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-1 text-primary">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`h-5 w-5 ${i < Math.floor(rating) ? "fill-current" : "opacity-30"}`} 
                  />
                ))}
                <span className="ml-2 text-white font-display">{rating.toFixed(1)}</span>
              </div>
            </div>

            <Separator className="bg-white/10 my-6" />

            <div className="mb-8">
              <h3 className="text-lg font-display text-primary mb-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                About This Book
              </h3>
              <p className="text-muted-foreground font-serif leading-relaxed line-clamp-4">
                {book.description || `Discover the captivating world of "${book.title}" by ${book.author}. This ${book.genre.toLowerCase()} masterpiece offers readers an unforgettable journey through beautifully crafted prose and compelling storytelling. Perfect for fans of ${book.category.toLowerCase()} literature.`}
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
              <Calendar className="h-4 w-4" />
              <span>Added {new Date(book.createdAt).toLocaleDateString()}</span>
              <span className="mx-2">|</span>
              <Download className="h-4 w-4" />
              <span>Digital Download (PDF/EPUB)</span>
            </div>

            {!isClassic && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(true)}
                className="mb-8 border-primary/30 text-primary hover:bg-primary/10 font-serif"
                data-testid="button-preview-book"
              >
                <Eye className="h-4 w-4 mr-2" />
                Read Free Preview
              </Button>
            )}

            <div className="mt-auto" id="purchase-section">
              {book.genre.startsWith("Classic") ? (
                <div className="bg-card/50 border border-white/10 rounded-lg p-6 mb-6">
                  <div className="flex items-end justify-between mb-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Price</span>
                      {promoApplied ? (
                        <div className="flex items-baseline gap-2">
                          <p className="text-4xl font-display text-emerald-400">${Math.max(0, price * (1 - promoDiscountRate)).toFixed(2)}</p>
                          <p className="text-xl font-display text-muted-foreground line-through">${price.toFixed(2)}</p>
                        </div>
                      ) : (
                        <p className="text-4xl font-display text-primary">${price.toFixed(2)}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="border-green-500/50 text-green-500">
                      In Stock
                    </Badge>
                  </div>

                  {/* Promo code field */}
                  {!promoApplied ? (
                    <div className="mb-4">
                      <div className="flex gap-2">
                        <Input
                          placeholder="Promo code"
                          value={promoInput}
                          onChange={(e) => setPromoInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                          className="bg-black/30 border-white/10 font-serif text-sm uppercase h-9"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleApplyPromo}
                          disabled={promoValidating || !promoInput.trim()}
                          className="border-primary/30 text-primary hover:bg-primary/10 shrink-0 h-9"
                        >
                          {promoValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 flex items-center justify-between">
                      <span className="text-emerald-400 text-sm flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        {promoCode} — {Math.round(promoDiscountRate * 100)}% off
                      </span>
                      <button onClick={handleRemovePromo} className="text-xs text-muted-foreground hover:text-white">Remove</button>
                    </div>
                  )}

                  <div className="flex gap-4 mb-3">
                    <Button 
                      onClick={() => handleBuyNow('download')}
                      disabled={!!checkoutLoading}
                      className="flex-1 bg-primary text-black hover:bg-primary/90 font-display text-lg py-6"
                      data-testid="button-buy-now"
                    >
                      {checkoutLoading === 'download' ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processing...</> : <><Download className="h-5 w-5 mr-2" /> Buy Download</>}
                    </Button>
                    <Button 
                      onClick={() => handleAddToCart('download')}
                      variant="outline" 
                      className="border-white/20 text-white hover:bg-white/10"
                      data-testid="button-add-to-cart"
                    >
                      <ShoppingCart className="h-5 w-5" />
                    </Button>
                  </div>
                  <Link href={`/read/book/${book.id}`}>
                    <Button className="w-full bg-amber-700 text-white hover:bg-amber-600 font-display text-lg py-5" data-testid="button-read-online">
                      <BookOpen className="h-5 w-5 mr-2" /> Read Online Free
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {/* Promo code field */}
                  {!promoApplied ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Promo code"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                        className="bg-black/30 border-white/10 font-serif text-sm uppercase h-9"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleApplyPromo}
                        disabled={promoValidating || !promoInput.trim()}
                        className="border-primary/30 text-primary hover:bg-primary/10 shrink-0 h-9"
                      >
                        {promoValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
                      </Button>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 flex items-center justify-between">
                      <span className="text-emerald-400 text-sm flex items-center gap-1.5">
                        <Check className="w-4 h-4" />
                        {promoCode} — {Math.round(promoDiscountRate * 100)}% off all prices
                      </span>
                      <button onClick={handleRemovePromo} className="text-xs text-muted-foreground hover:text-white">Remove</button>
                    </div>
                  )}
                  <div className="bg-card/50 border-2 border-amber-500/40 rounded-lg p-5 relative">
                    <Badge className="absolute -top-2.5 left-4 bg-amber-500 text-black text-xs font-bold px-3">
                      BEST VALUE
                    </Badge>
                    <div className="flex items-center justify-between mb-3 mt-1">
                      <div>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-5 w-5 text-amber-400" />
                          <Download className="h-5 w-5 text-amber-400 -ml-1" />
                          <span className="font-display text-white text-lg">Read + Download</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Online reading access + PDF/EPUB to keep forever</p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-display text-amber-400">${getPrice('bundle').toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button 
                        onClick={() => handleBuyNow('bundle')}
                        disabled={!!checkoutLoading}
                        className="flex-1 bg-amber-500 text-black hover:bg-amber-400 font-display py-5"
                        data-testid="button-buy-bundle"
                      >
                        {checkoutLoading === 'bundle' ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Processing...</> : <>Get Both</>}
                      </Button>
                      <Button 
                        onClick={() => handleAddToCart('bundle')}
                        variant="outline" 
                        className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        data-testid="button-cart-bundle"
                      >
                        <ShoppingCart className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card/50 border border-white/10 rounded-lg p-4">
                      <div className="mb-3">
                        <div className="flex items-center gap-2">
                          <Download className="h-4 w-4 text-white" />
                          <span className="font-display text-white">Download</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">PDF & EPUB — keep forever</p>
                        <p className="text-2xl font-display text-white mt-1">${price.toFixed(2)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => handleBuyNow('download')}
                          disabled={!!checkoutLoading}
                          variant="outline"
                          size="sm"
                          className="flex-1 border-white/20 text-white hover:bg-white/10 font-display"
                          data-testid="button-buy-download"
                        >
                          {checkoutLoading === 'download' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buy'}
                        </Button>
                        <Button 
                          onClick={() => handleAddToCart('download')}
                          variant="outline"
                          size="sm"
                          className="border-white/20 text-white hover:bg-white/10"
                          data-testid="button-cart-download"
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="bg-card/50 border border-primary/20 rounded-lg p-4">
                      <div className="mb-3">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-primary" />
                          <span className="font-display text-white">Read Online</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Instant online reading access</p>
                        <div className="flex items-baseline gap-2 mt-1">
                          <p className="text-2xl font-display text-primary">${getPrice('read_online').toFixed(2)}</p>
                          <p className="text-xs text-muted-foreground line-through">${price.toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          onClick={() => handleBuyNow('read_online')}
                          disabled={!!checkoutLoading}
                          size="sm"
                          className="flex-1 bg-primary text-black hover:bg-primary/90 font-display"
                          data-testid="button-buy-read-online"
                        >
                          {checkoutLoading === 'read_online' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buy'}
                        </Button>
                        <Button 
                          onClick={() => handleAddToCart('read_online')}
                          variant="outline"
                          size="sm"
                          className="border-primary/30 text-primary hover:bg-primary/10"
                          data-testid="button-cart-read-online"
                        >
                          <ShoppingCart className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-4 py-3 border-y border-white/5 my-3 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3 text-green-500" />
                  Secure Stripe checkout
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Zap className="h-3 w-3 text-amber-400" />
                  Instant delivery
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <RefreshCw className="h-3 w-3 text-blue-400" />
                  <a href="/refund-policy" className="hover:text-white transition-colors">30-day refund policy</a>
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3 w-3 text-primary" />
                  DRM-free, yours forever
                </span>
              </div>

              {!isClassic && (
                <div className="border border-amber-500/20 rounded-lg p-4 bg-amber-500/5 mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="h-4 w-4 text-amber-400" />
                    <span className="font-display text-amber-300 text-sm">Reading Pass</span>
                  </div>

                  {!readerEmail ? (
                    <div className="space-y-2">
                      <p className="text-xs text-stone-400">Enter your subscriber email to use your Reading Pass credits:</p>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="your@email.com"
                          className="flex-1 bg-black/30 border border-amber-500/20 rounded px-3 py-1.5 text-sm text-white placeholder:text-stone-500 focus:outline-none focus:border-amber-500/50"
                          data-testid="input-reader-email"
                          onKeyDown={(e) => e.key === "Enter" && saveEmail()}
                        />
                        <Button size="sm" onClick={saveEmail} className="bg-amber-600 text-white hover:bg-amber-500 text-xs" data-testid="button-save-email">
                          Verify
                        </Button>
                      </div>
                      <Link href="/subscription">
                        <span className="text-xs text-amber-500/70 hover:text-amber-400 underline cursor-pointer">Don't have a Reading Pass? Get one here</span>
                      </Link>
                    </div>
                  ) : accessInfo?.hasAccess && accessInfo.accessType === "purchased" ? (
                    <div className="space-y-2">
                      <p className="text-xs text-green-400">You purchased access to this book!</p>
                      <div className="flex gap-2">
                        <Link href={`/read/book/${book.id}`} className="flex-1">
                          <Button className="w-full bg-green-700 text-white hover:bg-green-600 text-sm" data-testid="button-read-now">
                            <BookOpen className="h-4 w-4 mr-1" /> Read Now
                          </Button>
                        </Link>
                        {accessInfo.hasDownloadAccess && (
                          <Button 
                            onClick={() => handlePurchasedDownload(book.id)}
                            variant="outline" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-sm" data-testid="button-purchased-download"
                          >
                            <Download className="h-4 w-4 mr-1" /> Download EPUB
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : accessInfo?.hasAccess && accessInfo.accessType === "subscription_read" ? (
                    <div className="space-y-2">
                      {accessInfo.isCheckedOut ? (
                        <>
                          <p className="text-xs text-green-400">This book is checked out to you!</p>
                          <div className="flex gap-2">
                            <Link href={`/read/book/${book.id}`} className="flex-1">
                              <Button className="w-full bg-green-700 text-white hover:bg-green-600 text-sm" data-testid="button-read-now">
                                <BookOpen className="h-4 w-4 mr-1" /> Read Now
                              </Button>
                            </Link>
                            <Button onClick={handleReturn} disabled={subLoading} variant="outline" className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 text-sm" data-testid="button-return-book">
                              {subLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Return Book"}
                            </Button>
                          </div>
                          {accessInfo.canDownload && (
                            <Button onClick={handleSubDownload} disabled={subLoading} variant="outline" className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-sm" data-testid="button-sub-download">
                              <Download className="h-4 w-4 mr-1" /> Use Download Credit to Keep
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="text-xs text-amber-300">You've read this book before. Check it out again to continue reading.</p>
                          <Button onClick={handleCheckout} disabled={subLoading} className="w-full bg-amber-600 text-white hover:bg-amber-500 text-sm" data-testid="button-checkout-again">
                            {subLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BookOpen className="h-4 w-4 mr-1" />}
                            Check Out Again
                          </Button>
                          {accessInfo.canDownload && (
                            <Button onClick={handleSubDownload} disabled={subLoading} variant="outline" className="w-full border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-sm" data-testid="button-sub-download">
                              <Download className="h-4 w-4 mr-1" /> Use Download Credit to Keep
                            </Button>
                          )}
                        </>
                      )}
                      {accessInfo.hasDownloadAccess && (
                        <Button 
                          onClick={() => handlePurchasedDownload(book.id)}
                          variant="outline" className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-sm" data-testid="button-purchased-download"
                        >
                          <Download className="h-4 w-4 mr-1" /> Download EPUB (Purchased)
                        </Button>
                      )}
                    </div>
                  ) : accessInfo?.accessType === "download_only" ? (
                    <div className="space-y-2">
                      <p className="text-xs text-emerald-400">You purchased this book for download!</p>
                      <Button 
                        onClick={() => handlePurchasedDownload(book.id)}
                        className="w-full bg-emerald-700 text-white hover:bg-emerald-600 text-sm" data-testid="button-download-purchased"
                      >
                        <Download className="h-4 w-4 mr-1" /> Download EPUB
                      </Button>
                    </div>
                  ) : accessInfo?.accessType === "subscription_available" ? (
                    <div className="space-y-2">
                      <p className="text-xs text-stone-400">
                        <span className="text-amber-300">{accessInfo.planName}</span> — Library checkout
                      </p>
                      {accessInfo.checkedOutBookId ? (
                        <div className="space-y-2">
                          <p className="text-xs text-orange-400">You have another book checked out. Return it first to check out this one.</p>
                          <Link href={`/book/${accessInfo.checkedOutBookId}`}>
                            <Button variant="outline" className="w-full border-orange-500/30 text-orange-400 hover:bg-orange-500/10 text-sm" data-testid="button-go-to-checkout">
                              Go to Your Checked-Out Book
                            </Button>
                          </Link>
                        </div>
                      ) : (
                        <Button onClick={handleCheckout} disabled={subLoading} className="w-full bg-amber-600 text-white hover:bg-amber-500 text-sm" data-testid="button-checkout-book">
                          {subLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <BookOpen className="h-4 w-4 mr-1" />}
                          Check Out This Book
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-stone-400">No active Reading Pass found for {readerEmail}</p>
                      <div className="flex gap-2">
                        <Link href="/subscription" className="flex-1">
                          <Button className="w-full bg-amber-600 text-white hover:bg-amber-500 text-sm" data-testid="button-get-pass">
                            Get a Reading Pass
                          </Button>
                        </Link>
                        <Button size="sm" variant="outline" className="border-white/20 text-stone-400 text-xs" onClick={() => { localStorage.removeItem("reader_email"); setReaderEmail(""); }} data-testid="button-change-email">
                          Change Email
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="text-xs text-muted-foreground/60 text-center">
                <a href="/refund-policy" className="hover:text-primary/70 transition-colors">Refund Policy</a>
                {" · "}
                <a href="/terms-of-service" className="hover:text-primary/70 transition-colors">Terms</a>
                {" · "}
                <a href="/privacy-policy" className="hover:text-primary/70 transition-colors">Privacy</a>
              </div>
            </div>
          </motion.div>
        </div>

        <ReviewSection bookId={book.id} />
        <SuggestionSection bookId={book.id} />
      </div>

      {showPreview && book && (
        <FlipbookPreview
          bookId={book.id}
          onClose={() => setShowPreview(false)}
          onBuy={() => {
            setShowPreview(false);
            setTimeout(() => document.getElementById("purchase-section")?.scrollIntoView({ behavior: "smooth" }), 150);
          }}
        />
      )}
    </div>
  );
}
