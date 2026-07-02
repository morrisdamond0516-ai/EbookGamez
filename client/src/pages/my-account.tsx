import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { User, BookOpen, Download, ShoppingBag, LogOut, CreditCard, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Navbar } from "@/components/layout/navbar";

function getCustomerToken() {
  return localStorage.getItem("ebgz_customer_token");
}

function getCustomerInfo() {
  try {
    const data = localStorage.getItem("ebgz_customer");
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export default function MyAccount() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const token = getCustomerToken();
  const customerInfo = getCustomerInfo();

  useEffect(() => {
    if (!token) {
      setLocation("/login");
    }
  }, [token, setLocation]);

  const { data: purchaseData, isLoading } = useQuery({
    queryKey: ["/api/customer/purchases"],
    queryFn: async () => {
      const res = await fetch("/api/customer/purchases", {
        headers: { "x-customer-token": token! },
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem("ebgz_customer_token");
          localStorage.removeItem("ebgz_customer");
          setLocation("/login");
          return null;
        }
        throw new Error("Failed to load purchases");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const handleLogout = () => {
    localStorage.removeItem("ebgz_customer_token");
    localStorage.removeItem("ebgz_customer");
    toast({ title: "Signed out", description: "You have been logged out." });
    setLocation("/");
  };

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (bookId: number, format: "epub" | "pdf") => {
    if (!token) {
      toast({ title: "Error", description: "Unable to verify purchase.", variant: "destructive" });
      return;
    }
    setDownloadingId(`${bookId}-${format}`);
    try {
      const response = await fetch(`/api/books/${bookId}/download?format=${format}`, {
        headers: { "x-customer-token": token },
      });
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
      toast({ title: "Download Error", description: error.message, variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  if (!token) return null;

  const orders = purchaseData?.orders || [];
  const subscription = purchaseData?.subscription;
  const readingAccess = purchaseData?.readingAccess || [];

  const purchasedBookIds = new Set<number>();
  orders.forEach((o: any) => o.items?.forEach((i: any) => purchasedBookIds.add(i.bookId)));

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Navbar />
      <div className="container mx-auto px-4 pt-28 pb-16 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-display text-white" data-testid="text-account-title">My Account</h1>
              <p className="text-white/60 mt-1">{customerInfo?.email}</p>
            </div>
            <Button variant="outline" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4 mr-2" />Sign Out
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-card border border-border rounded-xl p-5 text-center">
              <ShoppingBag className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-white" data-testid="text-order-count">{orders.length}</div>
              <div className="text-white/50 text-sm">Orders</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 text-center">
              <BookOpen className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-white" data-testid="text-book-count">{purchasedBookIds.size}</div>
              <div className="text-white/50 text-sm">Books Purchased</div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 text-center">
              <CreditCard className="h-8 w-8 text-primary mx-auto mb-2" />
              <div className="text-2xl font-bold text-white" data-testid="text-sub-status">
                {subscription?.status === "active" ? "Active" : "None"}
              </div>
              <div className="text-white/50 text-sm">Subscription</div>
            </div>
          </div>

          {subscription && subscription.status === "active" && (
            <div className="bg-card border border-primary/30 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-3 mb-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-display text-white">Reading Pass</h2>
                <span className="bg-green-500/20 text-green-400 text-xs px-2 py-1 rounded-full">Active</span>
              </div>
              <p className="text-white/60 text-sm">
                Your subscription renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="text-xl font-display text-white mb-4 flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Purchase History
            </h2>

            {isLoading ? (
              <div className="text-center py-8 text-white/50">Loading your purchases...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-white/20 mx-auto mb-4" />
                <p className="text-white/50 mb-4">You haven't made any purchases yet.</p>
                <Link href="/catalog">
                  <Button data-testid="button-browse-catalog">Browse Catalog</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order: any) => (
                  <div key={order.id} className="border border-border rounded-lg p-4" data-testid={`order-${order.id}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-white font-medium">Order #{order.id}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          order.status === "completed" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                        }`}>
                          {order.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-white/50 text-sm">
                        <Clock className="h-3 w-3" />
                        {new Date(order.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right text-white/50 text-sm mb-2">Total: ${order.total}</div>

                    {order.items?.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-3 py-2 border-t border-border/50">
                        {item.book?.coverUrl && (
                          <img
                            src={item.book.coverUrl}
                            alt={item.title}
                            className="w-10 h-14 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{item.title}</p>
                          <div className="flex items-center gap-2 text-white/50 text-xs">
                            <span>${item.price}</span>
                            <span className="capitalize">{item.purchaseType?.replace("_", " ")}</span>
                          </div>
                        </div>
                        {item.book && (
                          <div className="flex items-center gap-1">
                            <Link href={`/read/book/${item.book.id}`}>
                              <Button variant="ghost" size="sm" className="text-primary" data-testid={`button-read-${item.book.id}`}>
                                <BookOpen className="h-4 w-4 mr-1" />Read
                              </Button>
                            </Link>
                            {(item.purchaseType === "download" || item.purchaseType === "bundle") && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-emerald-400"
                                  onClick={() => handleDownload(item.book.id, "epub")}
                                  disabled={downloadingId === `${item.book.id}-epub`}
                                  data-testid={`button-dl-epub-${item.book.id}`}
                                >
                                  {downloadingId === `${item.book.id}-epub` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                                  EPUB
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-blue-400"
                                  onClick={() => handleDownload(item.book.id, "pdf")}
                                  disabled={downloadingId === `${item.book.id}-pdf`}
                                  data-testid={`button-dl-pdf-${item.book.id}`}
                                >
                                  {downloadingId === `${item.book.id}-pdf` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                                  PDF
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
