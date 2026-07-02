import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Download, ArrowRight, BookOpen, Loader2, LogIn } from "lucide-react";
import { trackPurchase } from "@/lib/analytics";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface OrderItem {
  id: number;
  title: string;
  price: string;
  bookId: number;
  purchaseType?: string;
}

interface OrderData {
  order: {
    id: number;
    customerEmail: string;
    status: string;
    total: string;
    createdAt: string;
  };
  items: OrderItem[];
}

function getPurchaseType(item: OrderItem): 'download' | 'read_online' | 'bundle' {
  if (item.purchaseType === 'bundle') return 'bundle';
  if (item.purchaseType === 'read_online') return 'read_online';
  if (item.purchaseType === 'download') return 'download';
  if (item.title.includes("Read + Download") || item.title.includes("Read Online + Download")) return 'bundle';
  if (item.title.includes("Online Reading")) return 'read_online';
  return 'download';
}

function getPurchaseLabel(type: 'download' | 'read_online' | 'bundle'): string {
  if (type === 'bundle') return 'Read Online + Download';
  if (type === 'read_online') return '1-Year Online Reading';
  return 'Digital Download';
}

export default function CheckoutSuccess() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const sessionId = params.get("session_id");
  const { toast } = useToast();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const customerToken = typeof window !== "undefined" ? localStorage.getItem("ebgz_customer_token") : null;

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify([]));
    window.dispatchEvent(new Event("cartUpdated"));
  }, []);

  // Only attempt to fetch order details if the user is already logged in.
  // Guest buyers are directed to log in or create an account to access their purchase.
  const { data: orderData, isLoading, isError } = useQuery<OrderData>({
    queryKey: ["order", sessionId],
    queryFn: async () => {
      if (!sessionId || !customerToken) throw new Error("Not authenticated");
      // POST to claim a short-lived order access token using the customer's verified identity.
      const response = await fetch(`/api/orders/session/${sessionId}/token`, {
        method: "POST",
        headers: { "x-customer-token": customerToken },
      });
      if (!response.ok) {
        const status = response.status;
        // Tag the error with the HTTP status so retry logic can inspect it
        const err: any = new Error("Order not ready yet");
        err.status = status;
        throw err;
      }
      const data = await response.json();
      if (data.orderToken) {
        localStorage.setItem("ebgz_order_token", data.orderToken);
      }
      return { order: data.order, items: data.items };
    },
    enabled: !!sessionId && !!customerToken,
    // Only retry transient errors (404 = webhook not yet fired).
    // Auth/access errors (401, 403) or server errors (500) should not be retried.
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false;
      if (error?.status === 500) return false;
      return failureCount < 6;
    },
    retryDelay: (attempt) => Math.min(1000 * (attempt + 1), 5000),
  });

  useEffect(() => {
    if (orderData?.order?.customerEmail && orderData.order.customerEmail !== 'unknown@email.com') {
      localStorage.setItem("reader_email", orderData.order.customerEmail);
    }
  }, [orderData]);

  useEffect(() => {
    if (!orderData) return;
    const dedupKey = `ebgz_conv_tracked_${orderData.order.id}`;
    if (localStorage.getItem(dedupKey)) return;
    localStorage.setItem(dedupKey, "1");
    trackPurchase({
      id: orderData.order.id,
      total: orderData.order.total,
      customerEmail: orderData.order.customerEmail,
      items: orderData.items,
    });
  }, [orderData]);

  const handleDownload = async (bookId: number, format: "epub" | "pdf" = "epub") => {
    if (!sessionId) {
      toast({ title: "Error", description: "Unable to verify purchase. Please contact support.", variant: "destructive" });
      return;
    }

    setDownloadingId(bookId);
    try {
      const headers: Record<string, string> = {};
      const customerToken = localStorage.getItem("ebgz_customer_token");
      if (customerToken) headers["x-customer-token"] = customerToken;
      const orderToken = localStorage.getItem("ebgz_order_token");
      if (orderToken) headers["x-order-token"] = orderToken;
      const response = await fetch(`/api/books/${bookId}/download?format=${format}`, { headers });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: "Download failed" }));
        throw new Error(errData.error || "Download failed");
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") || "";
      const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
      const filename = filenameMatch ? filenameMatch[1] : `ebook-${bookId}.${format}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({ title: "Download Started", description: `Your ${format.toUpperCase()} is downloading.` });
    } catch (error: any) {
      console.error("Download error:", error);
      toast({ title: "Download Error", description: error.message, variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const hasReadItems = orderData?.items?.some(item => {
    const pt = getPurchaseType(item);
    return pt === 'read_online' || pt === 'bundle';
  });

  const hasDownloadItems = orderData?.items?.some(item => {
    const pt = getPurchaseType(item);
    return pt === 'download' || pt === 'bundle';
  });

  return (
    <div className="min-h-screen bg-background text-foreground font-body flex flex-col">
      <Navbar />
      
      <div className="flex-1 container mx-auto px-4 py-32">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl mx-auto text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8"
          >
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </motion.div>

          <h1 className="text-4xl md:text-5xl font-display text-white mb-4" data-testid="text-checkout-title">
            Thank You for Your Purchase!
          </h1>

          {!customerToken ? (
            /* Guest buyer: payment confirmed but no active session — direct to log in */
            <>
              <p className="text-lg text-muted-foreground font-serif mb-8" data-testid="text-checkout-message">
                Your payment was received and your order is confirmed. A receipt has been sent to your email.
              </p>
              <div className="bg-card/50 border border-white/10 rounded-lg p-8 mb-8">
                <LogIn className="h-10 w-10 text-primary mx-auto mb-4" />
                <h2 className="font-display text-xl text-white mb-3">Access Your Books</h2>
                <p className="text-muted-foreground font-serif mb-6">
                  Log in or create an account using the email address you purchased with to download and read your ebooks.
                </p>
                <Link href="/my-account">
                  <Button className="bg-primary text-black hover:bg-primary/90 w-full sm:w-auto" data-testid="button-login-to-access">
                    <LogIn className="mr-2 h-4 w-4" />
                    Log In to Access Your Books
                  </Button>
                </Link>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/catalog">
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" data-testid="button-browse-more">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Browse More Books
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="ghost" className="text-muted-foreground hover:text-white" data-testid="button-return-home">
                    Return to Home
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            /* Logged-in customer: show full order details */
            <>
              <p className="text-lg text-muted-foreground font-serif mb-8" data-testid="text-checkout-message">
                Your order has been confirmed.
                {hasDownloadItems && " Your ebooks are ready for download."}
                {hasReadItems && " Your online reading access is now active."}
                {orderData?.order?.customerEmail && (
                  <> A confirmation has been sent to <span className="text-primary">{orderData.order.customerEmail}</span>.</>
                )}
              </p>

              <div className="bg-card/50 border border-white/10 rounded-lg p-8 mb-8">
                <div className="flex items-center justify-center gap-3 mb-6">
                  <BookOpen className="h-6 w-6 text-primary" />
                  <h2 className="font-display text-xl text-primary">Your Purchases</h2>
                </div>
                
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground font-serif">Loading your order...</span>
                  </div>
                ) : isError ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground font-serif mb-4">
                      Your payment was received. You can access your purchase from your account library.
                    </p>
                    <Link href="/my-account">
                      <Button className="bg-primary text-black hover:bg-primary/90" data-testid="button-goto-library">
                        <BookOpen className="mr-2 h-4 w-4" />
                        Go to My Library
                      </Button>
                    </Link>
                  </div>
                ) : orderData?.items && orderData.items.length > 0 ? (
                  <div className="space-y-4 mb-6">
                    {orderData.items.map((item) => {
                      const purchaseType = getPurchaseType(item);
                      const cleanTitle = item.title
                        .replace(" (Digital Download)", "")
                        .replace(" (1-Year Online Reading)", "")
                        .replace(" (Read Online + Download)", "")
                        .replace(" (Online Reading)", "")
                        .replace(" (Read + Download)", "");
                      const canDownload = purchaseType === 'download' || purchaseType === 'bundle';
                      const canRead = purchaseType === 'read_online' || purchaseType === 'bundle';

                      return (
                        <div
                          key={item.id}
                          className="bg-black/20 rounded-lg p-4"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="text-left flex-1">
                              <h3 className="font-display text-white" data-testid={`text-item-title-${item.bookId}`}>{cleanTitle}</h3>
                              <div className="flex items-center gap-2 mt-1">
                                <span className={`inline-block text-xs px-2 py-0.5 rounded ${
                                  purchaseType === 'bundle' ? 'bg-amber-500/20 text-amber-400' :
                                  purchaseType === 'read_online' ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white/70'
                                }`}>
                                  {getPurchaseLabel(purchaseType)}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  ${parseFloat(item.price).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {canRead && (
                              <Link href={`/read/book/${item.bookId}`} className="flex-1">
                                <Button
                                  size="sm"
                                  className="w-full bg-primary text-black hover:bg-primary/90"
                                  data-testid={`button-read-${item.bookId}`}
                                >
                                  <BookOpen className="mr-2 h-4 w-4" />
                                  Read Now
                                </Button>
                              </Link>
                            )}
                            {canDownload && (
                              <div className={`flex gap-2 ${canRead ? '' : 'flex-1'}`}>
                                <Button
                                  size="sm"
                                  onClick={() => handleDownload(item.bookId, "epub")}
                                  disabled={downloadingId === item.bookId}
                                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                                  data-testid={`button-download-epub-${item.bookId}`}
                                >
                                  {downloadingId === item.bookId ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="mr-2 h-4 w-4" />
                                  )}
                                  EPUB
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleDownload(item.bookId, "pdf")}
                                  disabled={downloadingId === item.bookId}
                                  className="bg-blue-600 text-white hover:bg-blue-500"
                                  data-testid={`button-download-pdf-${item.bookId}`}
                                >
                                  {downloadingId === item.bookId ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Download className="mr-2 h-4 w-4" />
                                  )}
                                  PDF
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground font-serif mb-6">
                    Your payment was received. Visit your library to access your purchases.
                  </p>
                )}

                {orderData?.order && (
                  <div className="border-t border-white/10 pt-4 mt-4">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Order #</span>
                      <span className="font-mono" data-testid="text-order-id">{orderData.order.id}</span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground mt-2">
                      <span>Total</span>
                      <span className="font-display text-primary" data-testid="text-order-total">
                        ${parseFloat(orderData.order.total).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {hasReadItems && orderData?.order?.customerEmail && (
                  <p className="text-xs text-green-400/80 mt-4">
                    Your reading access email: {orderData.order.customerEmail} — saved automatically for future visits.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/catalog">
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10" data-testid="button-browse-more">
                    <BookOpen className="mr-2 h-4 w-4" />
                    Browse More Books
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="ghost" className="text-muted-foreground hover:text-white" data-testid="button-return-home">
                    Return to Home
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </>
          )}
        </motion.div>
      </div>
      <Footer />
    </div>
  );
}
