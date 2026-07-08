import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { BookCard } from "@/components/ui/book-card";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, Filter, X, Loader2, Maximize2, Minimize2, Tag } from "lucide-react";
import { useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { CATALOG_CATEGORIES, type Book } from "@/lib/catalog-data";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { BookRequestBanner } from "@/components/book-request-form";

interface ApiBook {
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
  subscriberExclusiveUntil?: string | null;
  coverFit?: string;
}

interface PaginatedResponse {
  books: ApiBook[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

const BOOKS_PER_PAGE = 24;

export default function Catalog() {
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const initialSearch = urlParams.get("search") || "";

  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(() => typeof window !== "undefined" && !!localStorage.getItem("ebgz_admin_token"));
  const [currentPage, setCurrentPage] = useState(1);
  const [allLoadedBooks, setAllLoadedBooks] = useState<Book[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const q = params.get("search") || "";
    if (q && q !== searchQuery) {
      setSearchQuery(q);
    }
  }, [searchString]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(prev => {
        if (prev === searchQuery) return prev;
        setCurrentPage(1);
        setAllLoadedBooks([]);
        return searchQuery;
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  useEffect(() => {
    const check = () => setIsAdmin(!!localStorage.getItem("ebgz_admin_token"));
    check();
    const interval = setInterval(check, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    document.title = "Ebook Catalog - 600+ Books | EbookGamez";
    const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
    if (desc) desc.content = "Browse 600+ full-length ebooks across fiction, non-fiction, romance, thriller, fantasy, self-help, classics, and more. Buy individually or subscribe to our Reading Pass.";
    return () => {
      document.title = "EbookGamez - Ebooks, Games, Downloads & Gaming Guides";
      if (desc) desc.content = "EbookGamez is a digital entertainment platform offering 600+ full-length ebooks, free-to-play HTML5 games, PC and console game downloads, and expert gaming guides.";
    };
  }, []);

  const buildQueryParams = useCallback((page: number) => {
    const params = new URLSearchParams();
    params.set("page", page.toString());
    params.set("limit", BOOKS_PER_PAGE.toString());
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (activeCategory !== "All") params.set("category", activeCategory);
    if (activeSubcategory) params.set("genre", activeSubcategory);
    return params.toString();
  }, [debouncedSearch, activeCategory, activeSubcategory]);
  
  const { data: pageData, isLoading, isError } = useQuery<PaginatedResponse>({
    queryKey: ["books", currentPage, debouncedSearch, activeCategory, activeSubcategory],
    queryFn: async () => {
      const qs = buildQueryParams(currentPage);
      const response = await fetch(`/api/books?${qs}`);
      if (!response.ok) {
        throw new Error("Failed to fetch books");
      }
      return response.json();
    },
  });

  useEffect(() => {
    if (isError) {
      setIsLoadingMore(false);
    }
  }, [isError]);

  const lastAppliedKey = useRef("");
  
  useEffect(() => {
    if (pageData?.books) {
      const dataKey = `${activeCategory}|${activeSubcategory}|${debouncedSearch}|${currentPage}|${pageData.books.map(b => b.id).join(",")}`;
      if (dataKey === lastAppliedKey.current) return;
      lastAppliedKey.current = dataKey;
      
      const newBooks: Book[] = pageData.books.map(book => ({
        id: book.id.toString(),
        title: book.title,
        author: book.author,
        price: parseFloat(book.price),
        rating: parseFloat(book.rating),
        cover: book.coverUrl,
        genre: book.genre,
        category: book.category,
        subscriberExclusiveUntil: book.subscriberExclusiveUntil,
        coverFit: (book.coverFit === "contain" ? "contain" : "cover") as "cover" | "contain",
      }));
      if (currentPage === 1) {
        setAllLoadedBooks(newBooks);
      } else {
        setAllLoadedBooks(prev => {
          const existingIds = new Set(prev.map(b => b.id));
          const deduped = newBooks.filter(b => !existingIds.has(b.id));
          return [...prev, ...deduped];
        });
      }
      setIsLoadingMore(false);
    }
  }, [pageData, currentPage, activeCategory, activeSubcategory, debouncedSearch]);

  const handleBuyBook = async (bookId: string) => {
    window.location.href = `/book/${bookId}`;
  };

  const filteredBooks = allLoadedBooks;

  const totalBooks = pageData?.total ?? 0;
  const totalPages = pageData?.totalPages ?? 1;
  const hasMore = currentPage < totalPages;

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    setCurrentPage(prev => prev + 1);
  };

  const globalFitMode: "cover" | "contain" =
    allLoadedBooks.length > 0 && allLoadedBooks.every(b => b.coverFit === "contain") ? "contain" : "cover";

  const adminToken = typeof window !== "undefined" ? localStorage.getItem("ebgz_admin_token") || "" : "";

  const handleToggleAllFit = async () => {
    const newMode = globalFitMode === "cover" ? "contain" : "cover";
    setAllLoadedBooks(prev => prev.map(b => ({ ...b, coverFit: newMode })));
    try {
      await fetch("/api/admin/books/cover-fit-all", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ fit: newMode }),
      });
    } catch {
      toast({ title: "Error", description: "Failed to save cover fit setting", variant: "destructive" });
    }
  };

  const handleToggleBookFit = async (bookId: string, currentFit: "cover" | "contain") => {
    const newFit = currentFit === "cover" ? "contain" : "cover";
    setAllLoadedBooks(prev => prev.map(b => b.id === bookId ? { ...b, coverFit: newFit } : b));
    try {
      await fetch(`/api/admin/books/${bookId}/cover-fit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ fit: newFit }),
      });
    } catch {
      toast({ title: "Error", description: "Failed to save cover fit setting", variant: "destructive" });
    }
  };

  const handleCategorySelect = (categoryTitle: string) => {
    setActiveCategory(categoryTitle);
    setActiveSubcategory(null);
    setCurrentPage(1);
    setAllLoadedBooks([]);
    lastAppliedKey.current = "";
  };

  const currentCategoryData = CATALOG_CATEGORIES.find(c => c.title === activeCategory);

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Navbar />
      
      <div className="container mx-auto px-4 py-32">
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-display text-white mb-2">
              {activeCategory === "All" ? "Full Catalog" : activeCategory}
            </h1>
            <p className="text-muted-foreground font-serif">
              {activeCategory === "All" 
                ? "Explore our complete collection of digital masterpieces." 
                : `Browsing ${filteredBooks.length} titles in ${activeCategory}`
              }
            </p>
          </div>
          
          <div className="w-full md:w-auto flex flex-col gap-4">
             <div className="flex items-center gap-3">
               <div className="relative flex-1 md:flex-none">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search titles, authors, genres..." 
                    className="pl-10 w-full md:w-80 bg-white/5 border-white/10 text-lg"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
               </div>
               <div
                 className="hidden md:flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2 cursor-pointer hover:bg-primary/15 transition-colors shrink-0"
                 onClick={() => {
                   navigator.clipboard.writeText("WELCOME10");
                   localStorage.setItem("ebgz_promo", "WELCOME10");
                   toast({ title: "Code copied!", description: "WELCOME10 — 10% off your first order" });
                 }}
                 data-testid="promo-banner-catalog"
               >
                 <Tag className="w-3.5 h-3.5 text-primary" />
                 <span className="text-xs text-primary font-serif whitespace-nowrap">First order? <span className="font-bold">WELCOME10</span> = 10% off</span>
               </div>
             </div>
             {isAdmin && (
               <Button
                 variant="outline"
                 onClick={handleToggleAllFit}
                 className="font-serif border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                 data-testid="button-toggle-all-fit"
               >
                 {globalFitMode === "cover" ? <Maximize2 className="mr-2 h-4 w-4" /> : <Minimize2 className="mr-2 h-4 w-4" />}
                 {globalFitMode === "cover" ? "Enlarge All Covers" : "Shrink All Covers"}
               </Button>
             )}
          </div>
        </div>

        {/* Category Navigation */}
        <div className="border-b border-white/10 mb-8 pb-4 overflow-x-auto">
          <div className="flex space-x-2 min-w-max">
            <Button 
              variant={activeCategory === "All" ? "default" : "ghost"}
              onClick={() => handleCategorySelect("All")}
              className={`font-serif ${activeCategory === "All" ? "bg-primary text-black" : "text-muted-foreground hover:text-white"}`}
            >
              All Genres
            </Button>
            {CATALOG_CATEGORIES.map(category => (
              <Button
                key={category.title}
                variant={activeCategory === category.title ? "default" : "ghost"}
                onClick={() => handleCategorySelect(category.title)}
                className={`font-serif whitespace-nowrap ${activeCategory === category.title ? "bg-primary text-black" : "text-muted-foreground hover:text-white"}`}
              >
                {category.title.split(" (")[0]} {/* Truncate for cleaner tabs */}
              </Button>
            ))}
          </div>
        </div>

        {/* Subcategory Filter Chips (Only show if a specific category is selected) */}
        <AnimatePresence>
          {currentCategoryData && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-8 overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 py-2">
                <Badge 
                  variant="outline" 
                  className={`cursor-pointer px-4 py-1.5 text-sm transition-colors ${activeSubcategory === null ? "bg-white/10 text-white border-white/20" : "text-muted-foreground border-white/5 hover:bg-white/5"}`}
                  onClick={() => { setActiveSubcategory(null); setCurrentPage(1); setAllLoadedBooks([]); lastAppliedKey.current = ""; }}
                >
                  View All {currentCategoryData.title.split(" ")[0]}
                </Badge>
                {currentCategoryData.subcategories.map(sub => (
                  <Badge
                    key={sub}
                    variant="outline"
                    className={`cursor-pointer px-4 py-1.5 text-sm transition-colors ${activeSubcategory === sub ? "bg-primary/20 text-primary border-primary/50" : "text-muted-foreground border-white/5 hover:bg-white/5 hover:text-white"}`}
                    onClick={() => { setActiveSubcategory(sub); setCurrentPage(1); setAllLoadedBooks([]); lastAppliedKey.current = ""; }}
                  >
                    {sub}
                  </Badge>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {totalBooks > 0 && (
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-book-count">
            Showing {filteredBooks.length} of {totalBooks} books
          </p>
        )}

        {isLoading && currentPage === 1 ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : filteredBooks.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {filteredBooks.map((book, index) => {
                const fitMode = book.coverFit || "cover";
                return (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 23) * 0.05 }}
                    className="relative group/toggle"
                  >
                    <BookCard {...book} fitMode={fitMode} onBuy={() => handleBuyBook(book.id)} />
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleToggleBookFit(book.id, fitMode);
                        }}
                        className="absolute top-2 left-2 bg-black/60 backdrop-blur border border-white/10 text-white rounded w-6 h-6 flex items-center justify-center hover:bg-black/80 z-50"
                        title="Toggle fit mode"
                        data-testid={`toggle-fit-catalog-${book.id}`}
                      >
                        {fitMode === "cover" ? (
                          <Minimize2 className="w-3 h-3" />
                        ) : (
                          <Maximize2 className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-12">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="border-primary/50 text-primary hover:bg-primary/10 px-8"
                  data-testid="button-load-more"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    `Load More Books (${filteredBooks.length} of ${totalBooks})`
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-24 border border-dashed border-white/10 rounded-lg bg-white/5">
            <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground font-serif text-lg mb-4">No books found matching your current filters.</p>
            <Button 
              variant="outline" 
              className="border-primary/50 text-primary hover:bg-primary/10"
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("All");
                setActiveSubcategory(null);
                setCurrentPage(1);
                setAllLoadedBooks([]);
                lastAppliedKey.current = "";
              }}
            >
              Clear All Filters <X className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <BookRequestBanner />
      <Footer />
    </div>
  );
}