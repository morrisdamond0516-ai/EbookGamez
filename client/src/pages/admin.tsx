import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, CheckCircle, Loader2, DollarSign, Tag, BookOpen, Search, Package, ArrowUpRight, ArrowUp, ArrowDown, Edit, Trash2, X, Copy, BarChart3, Users, TrendingUp, AlertTriangle, CreditCard, HardDrive, RefreshCw, Wrench, Library, Lock, Unlock, Clock, Download, ShieldCheck, Shield, XCircle, Info, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/navbar";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AreaChart, Area, BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Mock AI categories and pricing logic
const GENRES = ["Self Improvement", "Personal Development", "Psychology", "Business", "Productivity", "Mindset", "Classic", "Cinema", "History", "Black History"];

interface UploadedBook {
  id: string;
  title: string;
  author: string;
  genre: string;
  category: string;
  price: number;
  description: string;
  coverUrl: string;
  status: "Draft" | "Published";
  date: string;
  subscriberExclusiveUntil: string | null;
}

interface EditingBook {
  id: number;
  title: string;
  author: string;
  genre: string;
  category: string;
  price: string;
  description: string;
  coverUrl: string;
}

export default function AdminDashboard() {
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("ebgz_admin_token");
  if (!hasToken) {
    window.location.href = "/";
    return null;
  }
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<{
    title: string;
    genre: string;
    suggestedPrice: number;
    reasoning: string;
  } | null>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [sessionVerified, setSessionVerified] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingCounts } = useQuery<{ authors: number; affiliates: number }>({
    queryKey: ["/api/admin/pending-counts"],
    queryFn: async () => {
      const token = localStorage.getItem("ebgz_admin_token") || "";
      const res = await fetch("/api/admin/pending-counts", { headers: { "x-admin-token": token } });
      if (!res.ok) return { authors: 0, affiliates: 0 };
      return res.json();
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    async function verifyAndRefreshSession() {
      const token = localStorage.getItem("ebgz_admin_token") || "";
      const verifyRes = await fetch("/api/admin/verify", {
        headers: { "x-admin-token": token },
      });
      const verifyData = await verifyRes.json();
      if (verifyData.authenticated) {
        setSessionVerified(true);
        return;
      }
      setSessionVerified(true);
    }
    verifyAndRefreshSession();
  }, []);

  const { data: booksData = [] } = useQuery({
    queryKey: ["admin-books"],
    queryFn: async () => {
      const adminToken = localStorage.getItem("ebgz_admin_token") || "";
      const response = await fetch("/api/books", {
        headers: { "x-admin-token": adminToken },
      });
      if (!response.ok) throw new Error("Failed to fetch books");
      return response.json();
    },
  });

  const createBookMutation = useMutation({
    mutationFn: async (bookData: any) => {
      const adminToken = localStorage.getItem("ebgz_admin_token") || "";
      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify(bookData),
      });
      if (!response.ok) throw new Error("Failed to publish book");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
  });

  const [editingBook, setEditingBook] = useState<EditingBook | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const updateBookMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const adminToken = localStorage.getItem("ebgz_admin_token") || "";
      const response = await fetch(`/api/books/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update book");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      setIsEditModalOpen(false);
      setEditingBook(null);
      toast({
        title: "Book Updated",
        description: "The book has been updated successfully.",
      });
    },
  });

  const deleteBookMutation = useMutation({
    mutationFn: async (id: number) => {
      const adminToken = localStorage.getItem("ebgz_admin_token") || "";
      const response = await fetch(`/api/books/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken },
      });
      if (!response.ok) throw new Error("Failed to delete book");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast({
        title: "Book Deleted",
        description: "The book has been removed from the store.",
      });
    },
  });

  const handleEditBook = (book: any) => {
    setEditingBook({
      id: book.id,
      title: book.title,
      author: book.author,
      genre: book.genre,
      category: book.category,
      price: book.price,
      description: book.description || "",
      coverUrl: book.coverUrl,
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingBook) return;
    updateBookMutation.mutate({
      id: editingBook.id,
      data: {
        title: editingBook.title,
        author: editingBook.author,
        genre: editingBook.genre,
        category: editingBook.category,
        price: editingBook.price,
        description: editingBook.description,
        coverUrl: editingBook.coverUrl,
      },
    });
  };

  const handleDeleteBook = (id: number) => {
    if (confirm("Are you sure you want to delete this book?")) {
      deleteBookMutation.mutate(id);
    }
  };

  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(new Set());
  const [exclusiveDays, setExclusiveDays] = useState(30);
  const [exclusiveFilter, setExclusiveFilter] = useState<"all" | "exclusive" | "non-exclusive">("all");

  const toggleBookSelection = (bookId: string) => {
    setSelectedBookIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) {
        next.delete(bookId);
      } else {
        next.add(bookId);
      }
      return next;
    });
  };

  const setExclusiveMutation = useMutation({
    mutationFn: async ({ bookIds, days }: { bookIds: number[]; days: number }) => {
      const token = localStorage.getItem("ebgz_admin_token") || "";
      const response = await fetch("/api/admin/books/set-exclusive", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ bookIds, days }),
      });
      if (!response.ok) throw new Error("Failed to set exclusive status");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      setSelectedBookIds(new Set());
      toast({
        title: "Exclusive Status Set",
        description: data.message,
      });
    },
  });

  const clearExclusiveMutation = useMutation({
    mutationFn: async (bookIds: number[]) => {
      const token = localStorage.getItem("ebgz_admin_token") || "";
      const response = await fetch("/api/admin/books/clear-exclusive", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ bookIds }),
      });
      if (!response.ok) throw new Error("Failed to clear exclusive status");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-books"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
      setSelectedBookIds(new Set());
      toast({
        title: "Exclusive Status Cleared",
        description: data.message,
      });
    },
  });

  const handleSetExclusive = () => {
    const ids = Array.from(selectedBookIds).map((id) => parseInt(id));
    setExclusiveMutation.mutate({ bookIds: ids, days: exclusiveDays });
  };

  const handleClearExclusive = () => {
    const ids = Array.from(selectedBookIds).map((id) => parseInt(id));
    clearExclusiveMutation.mutate(ids);
  };

  const uploads: UploadedBook[] = booksData.map((book: any) => ({
    id: book.id.toString(),
    title: book.title,
    author: book.author || "Unknown Author",
    genre: book.genre,
    category: book.category,
    price: parseFloat(book.price),
    description: book.description || "",
    coverUrl: book.coverUrl,
    status: "Published" as const,
    date: new Date(book.createdAt).toLocaleDateString(),
    subscriberExclusiveUntil: book.subscriberExclusiveUntil || null,
  }));

  const filteredUploads = uploads.filter((book) => {
    if (exclusiveFilter === "all") return true;
    const isExclusive = !!(book.subscriberExclusiveUntil && new Date(book.subscriberExclusiveUntil) > new Date());
    return exclusiveFilter === "exclusive" ? isExclusive : !isExclusive;
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      startAnalysis(droppedFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      startAnalysis(e.target.files[0]);
    }
  };

  const startAnalysis = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setAnalyzing(true);
    setProgress(0);
    setAnalysisResult(null);

    // Progress animation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // Upload file to server for cover extraction
      const formData = new FormData();
      formData.append('file', uploadedFile);
      
      const response = await fetch('/api/upload/ebook', {
        method: 'POST',
        body: formData,
      });
      
      clearInterval(interval);
      setProgress(100);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to process ebook');
      }
      
      const result = await response.json();
      
      const mockGenre = GENRES[Math.floor(Math.random() * GENRES.length)];
      const mockPrice = (Math.random() * (25 - 8) + 8).toFixed(2);
      
      setAnalysisResult({
        title: result.title || uploadedFile.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
        genre: mockGenre,
        suggestedPrice: parseFloat(mockPrice),
        reasoning: `Based on similar ${mockGenre} titles and current market trends for digital editions.`
      });
      setCoverUrl(result.coverUrl || "");
      setAuthorName("");
      setAnalyzing(false);
      
      toast({
        title: "Analysis Complete",
        description: "Cover extracted from first page. Review and publish when ready.",
      });
    } catch (error: any) {
      clearInterval(interval);
      setAnalyzing(false);
      setFile(null);
      toast({
        title: "Error Processing File",
        description: error.message || "Failed to extract cover. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePublish = async () => {
    if (analysisResult) {
      if (!coverUrl.trim()) {
        toast({
          title: "Cover Required",
          description: "Please enter a cover image URL before publishing.",
          variant: "destructive",
        });
        return;
      }
      
      try {
        await createBookMutation.mutateAsync({
          title: analysisResult.title,
          author: authorName.trim() || "Unknown Author",
          genre: analysisResult.genre,
          category: mapGenreToCategory(analysisResult.genre),
          price: analysisResult.suggestedPrice.toString(),
          rating: "4.5",
          coverUrl: coverUrl.trim(),
          description: `A ${analysisResult.genre} ebook`,
        });
        
        toast({
          title: "Ebook Published!",
          description: `${analysisResult?.title} is now live in the store.`,
        });
        
        setFile(null);
        setAnalysisResult(null);
        setCoverUrl("");
        setAuthorName("");
      } catch (error) {
        console.error("Error publishing book:", error);
        toast({
          title: "Error",
          description: "Failed to publish ebook. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const mapGenreToCategory = (genre: string): string => {
    const genreToCategoryMap: Record<string, string> = {
      "Self Improvement": "Nonfiction (Information-Driven)",
      "Personal Development": "Nonfiction (Information-Driven)",
      "Psychology": "Nonfiction (Information-Driven)",
      "Business": "Nonfiction (Information-Driven)",
      "Productivity": "Nonfiction (Information-Driven)",
      "Mindset": "Spiritual & Inspirational",
      "Classic": "Fiction (Story-Driven)",
      "Cinema": "Entertainment & Lifestyle",
    };
    return genreToCategoryMap[genre] || "Nonfiction (Information-Driven)";
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Navbar />
      
      <div className="container mx-auto px-4 py-24">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-display text-white mb-2">Publisher Dashboard</h1>
            <p className="text-muted-foreground font-serif">Upload manuscripts and manage your digital library.</p>
          </div>
          <div className="flex gap-2">
            <a href="/admin/duplicates" data-testid="link-duplicate-finder">
              <Button variant="outline" className="border-red-500/30 hover:bg-red-500/10 text-red-300 font-serif">
                <Copy className="mr-2 h-4 w-4" />
                Duplicate Finder
              </Button>
            </a>
            <a href="/admin/rewrite-blockers" data-testid="link-rewrite-blockers">
              <Button variant="outline" className="border-orange-500/30 hover:bg-orange-500/10 text-orange-300 font-serif">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Rewrite Blockers
              </Button>
            </a>
            <a href="/admin/orphan-covers" data-testid="link-orphan-covers">
              <Button variant="outline" className="border-amber-500/30 hover:bg-amber-500/10 text-amber-300 font-serif">
                <Trash2 className="mr-2 h-4 w-4" />
                Orphan Covers (Review)
              </Button>
            </a>
            <a href="/admin/analytics" data-testid="link-site-analytics">
              <Button variant="outline" className="border-green-500/30 hover:bg-green-500/10 text-green-300 font-serif">
                <BarChart3 className="mr-2 h-4 w-4" />
                Site Analytics
              </Button>
            </a>
            <a href="/admin/author-library" data-testid="link-author-library">
              <Button variant="outline" className="border-purple-500/30 hover:bg-purple-500/10 text-purple-300 font-serif">
                <Library className="mr-2 h-4 w-4" />
                Author Library
              </Button>
            </a>
            <a href="/admin/epub-export" data-testid="link-epub-export">
              <Button variant="outline" className="border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-300 font-serif">
                <Package className="mr-2 h-4 w-4" />
                Export Hub
              </Button>
            </a>
            <a href="/admin/quality-scan" data-testid="link-quality-scan">
              <Button variant="outline" className="border-violet-500/30 hover:bg-violet-500/10 text-violet-300 font-serif">
                <Shield className="mr-2 h-4 w-4" />
                Quality Scan
              </Button>
            </a>
            <Button variant="outline" className="border-white/10 hover:bg-white/5 font-serif">
              <Package className="mr-2 h-4 w-4" />
              Inventory
            </Button>
          </div>
        </div>

        <Tabs defaultValue="upload" className="space-y-8">
          <TabsList className="bg-white/5 border border-white/10 w-full md:w-auto">
            <TabsTrigger value="upload" className="font-serif px-8 data-[state=active]:bg-primary data-[state=active]:text-black">Upload New</TabsTrigger>
            <TabsTrigger value="inventory" className="font-serif px-8 data-[state=active]:bg-primary data-[state=active]:text-black">My Uploads ({uploads.length})</TabsTrigger>
            <TabsTrigger value="developer" className="font-serif px-8 data-[state=active]:bg-primary data-[state=active]:text-black">Developer</TabsTrigger>
            <TabsTrigger value="subscriptions" className="font-serif px-8 data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
              <BarChart3 className="w-4 h-4 mr-1" /> Subscriptions
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="font-serif px-8 data-[state=active]:bg-orange-600 data-[state=active]:text-white">
              <Wrench className="w-4 h-4 mr-1" /> Maintenance
            </TabsTrigger>
            <TabsTrigger value="reviews" className="font-serif px-8 data-[state=active]:bg-blue-600 data-[state=active]:text-white">
              Reviews
            </TabsTrigger>
            <TabsTrigger value="authors" className="font-serif px-8 data-[state=active]:bg-violet-600 data-[state=active]:text-white relative">
              Authors
              {(pendingCounts?.authors ?? 0) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 animate-pulse">
                  {pendingCounts!.authors}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="affiliates" className="font-serif px-8 data-[state=active]:bg-cyan-600 data-[state=active]:text-white relative">
              Affiliates
              {(pendingCounts?.affiliates ?? 0) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 animate-pulse">
                  {pendingCounts!.affiliates}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Upload Section */}
              <section>
                <Card className="bg-white/5 border-white/10 h-full">
                  <CardHeader>
                    <CardTitle className="font-display text-xl text-primary">New Submission</CardTitle>
                    <CardDescription className="font-serif">Drag and drop your PDF file here.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div 
                      className={`
                        border-2 border-dashed rounded-lg h-64 flex flex-col items-center justify-center transition-all duration-300
                        ${isDragging ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/30 hover:bg-white/5"}
                      `}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <AnimatePresence mode="wait">
                        {!file ? (
                          <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            className="text-center p-6"
                          >
                            <div className="w-16 h-16 bg-black/30 rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                              <Upload className="h-8 w-8" />
                            </div>
                            <p className="text-lg font-serif mb-2">Drag file to upload</p>
                            <p className="text-sm text-muted-foreground mb-4">or</p>
                            <label htmlFor="file-upload">
                              <Button variant="outline" className="cursor-pointer border-primary/50 text-primary hover:bg-primary/10" asChild>
                                <span>Browse Files</span>
                              </Button>
                              <input 
                                id="file-upload" 
                                type="file" 
                                className="hidden" 
                                accept=".pdf" 
                                onChange={handleFileSelect}
                              />
                            </label>
                          </motion.div>
                        ) : (
                          <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center w-full max-w-xs"
                          >
                            <FileText className="h-16 w-16 text-primary mx-auto mb-4" />
                            <p className="font-display text-lg truncate mb-2">{file.name}</p>
                            <p className="text-sm text-muted-foreground font-serif">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            
                            {analyzing && (
                              <div className="mt-6 space-y-2">
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>Analyzing content...</span>
                                  <span>{progress}%</span>
                                </div>
                                <Progress value={progress} className="h-1 bg-white/10" />
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </CardContent>
                </Card>
              </section>

              {/* Analysis Results Section */}
              <section>
                <AnimatePresence>
                  {analysisResult && !analyzing && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <Card className="bg-card/50 border-primary/30 shadow-lg shadow-primary/5">
                        <CardHeader className="border-b border-white/5 pb-4">
                          <div className="flex items-center gap-2 text-primary mb-1">
                            <CheckCircle className="h-5 w-5" />
                            <span className="text-sm font-bold uppercase tracking-widest">Analysis Complete</span>
                          </div>
                          <CardTitle className="font-display text-2xl">{analysisResult.title}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                          
                          {/* Suggested Genre */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <Label className="text-muted-foreground flex items-center gap-2">
                                <Tag className="h-4 w-4" /> Suggested Genre
                              </Label>
                              <div className="flex flex-wrap gap-2">
                                <Badge className="bg-primary text-black text-sm px-3 py-1 hover:bg-primary/90">
                                  {analysisResult.genre}
                                </Badge>
                                <Badge variant="outline" className="border-white/10 text-muted-foreground hover:text-white cursor-pointer">
                                  + Add Tag
                                </Badge>
                              </div>
                            </div>

                            {/* Suggested Price */}
                            <div className="space-y-2">
                              <Label className="text-muted-foreground flex items-center gap-2">
                                <DollarSign className="h-4 w-4" /> Market Price Suggestion
                              </Label>
                              <div className="flex items-center gap-3">
                                <Input 
                                  type="number" 
                                  defaultValue={analysisResult.suggestedPrice} 
                                  className="text-xl font-display w-32 bg-black/20 border-primary/30 focus:border-primary text-primary" 
                                />
                                <span className="text-xs text-muted-foreground italic max-w-[150px]">
                                  {analysisResult.reasoning}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Author and Cover Image */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <Label className="text-muted-foreground flex items-center gap-2">
                                Author Name
                              </Label>
                              <Input 
                                type="text" 
                                placeholder="Enter author name"
                                value={authorName}
                                onChange={(e) => setAuthorName(e.target.value)}
                                className="bg-black/20 border-white/10 focus:border-primary" 
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-muted-foreground flex items-center gap-2">
                                Cover Image URL <span className="text-red-400">*</span>
                              </Label>
                              <Input 
                                type="url" 
                                placeholder="https://example.com/cover.jpg"
                                value={coverUrl}
                                onChange={(e) => setCoverUrl(e.target.value)}
                                className="bg-black/20 border-white/10 focus:border-primary" 
                              />
                            </div>
                          </div>

                          {/* Cover Preview - Shows extracted PDF cover or manual URL */}
                          <div className="space-y-2">
                            <Label className="text-muted-foreground flex items-center gap-2">
                              {coverUrl && coverUrl.startsWith('/uploads/') ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-green-400" />
                                  Cover Extracted from PDF
                                </>
                              ) : coverUrl ? (
                                'Cover Preview'
                              ) : (
                                'No Cover Yet'
                              )}
                            </Label>
                            <div className="flex gap-4 items-start">
                              <div 
                                className={`w-40 h-56 bg-black/20 rounded-lg overflow-hidden border-2 ${
                                  coverUrl ? 'border-primary/50 shadow-lg shadow-primary/10' : 'border-white/10 border-dashed'
                                } flex items-center justify-center`}
                                data-testid="cover-preview-container"
                              >
                                {coverUrl ? (
                                  <img 
                                    src={coverUrl} 
                                    alt="Cover preview" 
                                    className="w-full h-full object-cover"
                                    data-testid="cover-preview-image"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140" fill="%23333"><rect width="100%" height="100%"/><text x="50%" y="50%" fill="%23666" text-anchor="middle" dy=".3em">Invalid URL</text></svg>';
                                    }}
                                  />
                                ) : (
                                  <div className="text-center p-4">
                                    <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-xs text-muted-foreground">Upload a PDF to extract cover</p>
                                  </div>
                                )}
                              </div>
                              {coverUrl && coverUrl.startsWith('/uploads/') && (
                                <div className="flex-1 space-y-2">
                                  <p className="text-sm text-green-400/80 font-serif">
                                    Cover automatically extracted from the first page of your PDF.
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    You can replace it by entering a different URL in the field above.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Description / Summary */}
                          <div className="space-y-2">
                            <Label className="text-muted-foreground flex items-center gap-2">
                              <BookOpen className="h-4 w-4" /> Auto-Generated Summary
                            </Label>
                            <div className="bg-black/20 p-4 rounded-md border border-white/5 text-sm font-serif leading-relaxed text-white/80">
                              Based on our scan, this appears to be a definitive work in the <strong>{analysisResult.genre}</strong> category. 
                              The narrative structure aligns with bestsellers in this genre. We recommend highlighting the cinematic elements 
                              in the marketing copy.
                            </div>
                          </div>

                          <div className="pt-4 flex gap-4">
                            <Button 
                              onClick={handlePublish} 
                              disabled={!coverUrl.trim()}
                              className="flex-1 bg-primary text-black hover:bg-primary/90 font-display text-lg py-6 disabled:opacity-50"
                            >
                              Publish to Store
                            </Button>
                            <Button variant="outline" onClick={() => setFile(null)} className="border-white/10 text-muted-foreground hover:text-white">
                              Discard
                            </Button>
                          </div>

                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                  
                  {!analysisResult && !analyzing && (
                    <div className="h-full flex flex-col items-center justify-center border border-dashed border-white/5 rounded-lg bg-white/[0.02] p-8 text-center text-muted-foreground">
                      <Search className="h-12 w-12 mb-4 opacity-20" />
                      <p className="font-serif text-lg">Waiting for manuscript...</p>
                      <p className="text-sm opacity-50">Upload a file to see AI categorization in action.</p>
                    </div>
                  )}
                </AnimatePresence>
              </section>
            </div>
          </TabsContent>
          
          <TabsContent value="inventory">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="font-display text-xl text-primary">Your Library</CardTitle>
                <CardDescription className="font-serif">All uploaded and categorized ebooks.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-serif text-muted-foreground whitespace-nowrap">Filter:</Label>
                    <Select value={exclusiveFilter} onValueChange={(v) => setExclusiveFilter(v as typeof exclusiveFilter)}>
                      <SelectTrigger className="w-[200px] bg-black/20 border-white/10" data-testid="select-exclusive-filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" data-testid="option-filter-all">All Books</SelectItem>
                        <SelectItem value="exclusive" data-testid="option-filter-exclusive">Exclusive Only</SelectItem>
                        <SelectItem value="non-exclusive" data-testid="option-filter-non-exclusive">Non-Exclusive Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-xs text-muted-foreground font-serif" data-testid="text-filtered-count">
                    Showing {filteredUploads.length} of {uploads.length} book{uploads.length === 1 ? "" : "s"}
                  </span>
                </div>
                {selectedBookIds.size > 0 && (
                  <div className="flex flex-wrap items-center gap-3 p-4 bg-primary/10 border border-primary/30 rounded-lg" data-testid="exclusive-bulk-actions">
                    <span className="text-sm font-serif text-primary">
                      {selectedBookIds.size} book{selectedBookIds.size > 1 ? "s" : ""} selected
                    </span>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Days:</Label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={exclusiveDays}
                        onChange={(e) => setExclusiveDays(Math.max(1, parseInt(e.target.value) || 30))}
                        className="w-20 h-8 bg-black/20 border-white/10 text-sm"
                        data-testid="input-exclusive-days"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSetExclusive}
                      disabled={setExclusiveMutation.isPending}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-serif"
                      data-testid="button-set-exclusive"
                    >
                      {setExclusiveMutation.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Lock className="mr-1 h-3 w-3" />
                      )}
                      Set Exclusive
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleClearExclusive}
                      disabled={clearExclusiveMutation.isPending}
                      className="border-white/20 hover:bg-white/10 font-serif"
                      data-testid="button-clear-exclusive"
                    >
                      {clearExclusiveMutation.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Unlock className="mr-1 h-3 w-3" />
                      )}
                      Clear Exclusive
                    </Button>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/10 hover:bg-white/5">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={filteredUploads.length > 0 && filteredUploads.every((b) => selectedBookIds.has(b.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedBookIds(new Set(filteredUploads.map((b) => b.id)));
                            } else {
                              setSelectedBookIds(new Set());
                            }
                          }}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead className="text-primary font-display">Title</TableHead>
                      <TableHead className="text-primary font-display">Genre</TableHead>
                      <TableHead className="text-primary font-display">Price</TableHead>
                      <TableHead className="text-primary font-display">Exclusive</TableHead>
                      <TableHead className="text-primary font-display">Status</TableHead>
                      <TableHead className="text-primary font-display">Date Added</TableHead>
                      <TableHead className="text-right text-primary font-display">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUploads.length === 0 && (
                      <TableRow className="border-white/10">
                        <TableCell colSpan={8} className="text-center text-muted-foreground font-serif py-8" data-testid="text-no-books">
                          No books match the current filter.
                        </TableCell>
                      </TableRow>
                    )}
                    {filteredUploads.map((book) => {
                      const isExclusive = book.subscriberExclusiveUntil && new Date(book.subscriberExclusiveUntil) > new Date();
                      const exclusiveDate = book.subscriberExclusiveUntil ? new Date(book.subscriberExclusiveUntil) : null;
                      return (
                        <TableRow key={book.id} className={`border-white/10 hover:bg-white/5 transition-colors ${selectedBookIds.has(book.id) ? "bg-primary/5" : ""}`}>
                          <TableCell>
                            <Checkbox
                              checked={selectedBookIds.has(book.id)}
                              onCheckedChange={() => toggleBookSelection(book.id)}
                              data-testid={`checkbox-book-${book.id}`}
                            />
                          </TableCell>
                          <TableCell className="font-serif font-medium">{book.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="border-white/20 text-muted-foreground">{book.genre}</Badge>
                          </TableCell>
                          <TableCell className="font-mono">${book.price.toFixed(2)}</TableCell>
                          <TableCell data-testid={`status-exclusive-${book.id}`}>
                            {isExclusive ? (
                              <div className="flex flex-col gap-0.5">
                                <Badge className="bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border-amber-500/20 w-fit">
                                  <Lock className="mr-1 h-3 w-3" />
                                  Exclusive
                                </Badge>
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Until {exclusiveDate!.toLocaleDateString()}
                                </span>
                              </div>
                            ) : book.subscriberExclusiveUntil && exclusiveDate ? (
                              <Badge variant="outline" className="border-white/10 text-muted-foreground/50 w-fit">
                                Expired
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/40 text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">
                              {book.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-serif text-sm">{book.date}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="hover:text-primary"
                                onClick={() => handleEditBook(booksData.find((b: any) => b.id.toString() === book.id))}
                                data-testid={`button-edit-${book.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                className="hover:text-red-500"
                                onClick={() => handleDeleteBook(parseInt(book.id))}
                                data-testid={`button-delete-${book.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="developer" className="space-y-8">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="font-display text-xl text-primary">Download Source Code</CardTitle>
                <CardDescription className="font-serif">Download the complete application code for reference or study.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-black/20 rounded-lg border border-white/10">
                    <h3 className="font-display text-lg text-primary mb-2">Original Code (TypeScript/JavaScript)</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      The complete application including React frontend, Express backend, and all configuration files.
                    </p>
                    <ul className="text-xs text-muted-foreground mb-4 space-y-1">
                      <li>• React + TypeScript frontend</li>
                      <li>• Express + Node.js backend</li>
                      <li>• Drizzle ORM + PostgreSQL</li>
                      <li>• All fonts and config files</li>
                    </ul>
                    <a 
                      href="/downloads/ebookgamez_full_code.zip" 
                      download
                      className="inline-flex items-center justify-center rounded-md bg-primary text-black px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Download Full Code (.zip)
                    </a>
                  </div>

                  <div className="p-6 bg-black/20 rounded-lg border border-white/10">
                    <h3 className="font-display text-lg text-primary mb-2">Python Reference Code</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      The cover generation logic translated to Python for easier study if you're more familiar with Python.
                    </p>
                    <ul className="text-xs text-muted-foreground mb-4 space-y-1">
                      <li>• Cover text overlay logic</li>
                      <li>• AI image generation prompts</li>
                      <li>• Color extraction algorithms</li>
                      <li>• Style generation system</li>
                    </ul>
                    <a 
                      href="/downloads/python_cover_code.zip" 
                      download
                      className="inline-flex items-center justify-center rounded-md bg-primary text-black px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Download Python Code (.zip)
                    </a>
                  </div>
                </div>

                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-amber-200 text-sm">
                    <strong>Note:</strong> The Python code is a reference translation for study purposes. 
                    The actual application runs on TypeScript/JavaScript. The Python version shows the same 
                    logic and algorithms in a format that may be easier to understand if you're more familiar with Python.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscriptions" className="space-y-8">
            <SubscriptionAnalytics />
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-8">
            <SystemMaintenance />
          </TabsContent>

          <TabsContent value="reviews" className="space-y-8">
            <ReviewsManagement />
          </TabsContent>

          <TabsContent value="authors" className="space-y-8">
            <AuthorSubmissionsManagement />
          </TabsContent>

          <TabsContent value="affiliates" className="space-y-8">
            <AffiliateApplicationsManagement />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-card border-white/10 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-primary">Edit Book</DialogTitle>
          </DialogHeader>
          
          {editingBook && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Title</Label>
                  <Input
                    value={editingBook.title}
                    onChange={(e) => setEditingBook({ ...editingBook, title: e.target.value })}
                    className="bg-black/20 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Author</Label>
                  <Input
                    value={editingBook.author}
                    onChange={(e) => setEditingBook({ ...editingBook, author: e.target.value })}
                    className="bg-black/20 border-white/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Genre</Label>
                  <Select 
                    value={editingBook.genre} 
                    onValueChange={(value) => setEditingBook({ ...editingBook, genre: value })}
                  >
                    <SelectTrigger className="bg-black/20 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((genre) => (
                        <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingBook.price}
                    onChange={(e) => setEditingBook({ ...editingBook, price: e.target.value })}
                    className="bg-black/20 border-white/10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Cover Image URL</Label>
                <Input
                  value={editingBook.coverUrl}
                  onChange={(e) => setEditingBook({ ...editingBook, coverUrl: e.target.value })}
                  className="bg-black/20 border-white/10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground">Description</Label>
                <Textarea
                  value={editingBook.description}
                  onChange={(e) => setEditingBook({ ...editingBook, description: e.target.value })}
                  className="bg-black/20 border-white/10 min-h-[100px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsEditModalOpen(false)}
              className="border-white/10"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateBookMutation.isPending}
              className="bg-primary text-black hover:bg-primary/90"
            >
              {updateBookMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReviewsManagement() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const resp = await fetch("/api/admin/reviews", { headers: { "x-admin-token": token || "" } });
      if (resp.ok) {
        const data = await resp.json();
        setReviews(data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this review?")) return;
    const token = localStorage.getItem("admin_token");
    const resp = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE", headers: { "x-admin-token": token || "" } });
    if (resp.ok) {
      toast({ title: "Review deleted" });
      setReviews(prev => prev.filter(r => r.id !== id));
    } else {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
  };

  if (loading) return <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  return (
    <Card className="bg-card/50 border-white/10">
      <CardHeader>
        <CardTitle className="font-display text-primary">Customer Reviews ({reviews.length})</CardTitle>
        <CardDescription className="font-serif">Manage reviews left by visitors. Delete spam or inappropriate reviews.</CardDescription>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <p className="text-muted-foreground text-center py-8 font-serif">No reviews yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead>Book</TableHead>
                <TableHead>Reviewer</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews.map((r: any) => (
                <TableRow key={r.id} className="border-white/10">
                  <TableCell className="font-serif text-sm max-w-[200px] truncate">{r.bookTitle || `Book #${r.bookId}`}</TableCell>
                  <TableCell className="font-serif text-sm">{r.displayName}</TableCell>
                  <TableCell>
                    <span className="text-primary font-bold">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  </TableCell>
                  <TableCell className="font-serif text-sm text-muted-foreground max-w-[250px] truncate">{r.comment || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10" data-testid={`button-delete-review-${r.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function AuthorSubmissionsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("ebgz_admin_token");
    fetch("/api/admin/author-submissions", { headers: { "x-admin-token": token || "" } })
      .then(r => r.ok ? r.json() : [])
      .then(setSubmissions)
      .finally(() => setLoading(false));
  }, []);

  const updateStatus = async (id: number, status: string) => {
    const token = localStorage.getItem("ebgz_admin_token");
    const res = await fetch(`/api/admin/author-submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token || "" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast({ title: `Author ${status}` });
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-counts"] });
    }
  };

  if (loading) return <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  return (
    <Card className="bg-card/50 border-white/10">
      <CardHeader>
        <CardTitle className="font-display text-primary">Author Submissions ({submissions.length})</CardTitle>
        <CardDescription className="font-serif">Review and approve author applications.</CardDescription>
      </CardHeader>
      <CardContent>
        {submissions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8 font-serif">No submissions yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Genre</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((s: any) => (
                <TableRow key={s.id} className="border-white/10">
                  <TableCell className="font-serif text-sm">{s.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.email}</TableCell>
                  <TableCell className="text-sm">{s.genre}</TableCell>
                  <TableCell>
                    <Badge className={s.status === "approved" ? "bg-emerald-600" : s.status === "rejected" ? "bg-red-600" : "bg-amber-600"}>{s.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="flex gap-1">
                    {s.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs" onClick={() => updateStatus(s.id, "approved")} data-testid={`button-approve-author-${s.id}`}>Approve</Button>
                        <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 text-xs" onClick={() => updateStatus(s.id, "rejected")} data-testid={`button-reject-author-${s.id}`}>Reject</Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function AffiliateApplicationsManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("ebgz_admin_token");
    fetch("/api/admin/affiliate-applications", { headers: { "x-admin-token": token || "" } })
      .then(r => r.ok ? r.json() : [])
      .then(setApplications)
      .finally(() => setLoading(false));
  }, []);

  const updateStatus = async (id: number, status: string) => {
    const token = localStorage.getItem("ebgz_admin_token");
    const referralCode = status === "approved" ? "REF" + Math.random().toString(36).substring(2, 8).toUpperCase() : undefined;
    const res = await fetch(`/api/admin/affiliate-applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token || "" },
      body: JSON.stringify({ status, referralCode }),
    });
    if (res.ok) {
      toast({ title: `Affiliate ${status}` });
      setApplications(prev => prev.map(a => a.id === id ? { ...a, status, referralCode: referralCode || a.referralCode } : a));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-counts"] });
    }
  };

  if (loading) return <div className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  return (
    <Card className="bg-card/50 border-white/10">
      <CardHeader>
        <CardTitle className="font-display text-primary">Affiliate Applications ({applications.length})</CardTitle>
        <CardDescription className="font-serif">Review affiliate program applications. Approved affiliates get a referral code.</CardDescription>
      </CardHeader>
      <CardContent>
        {applications.length === 0 ? (
          <p className="text-muted-foreground text-center py-8 font-serif">No applications yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-white/10">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Referral Code</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.map((a: any) => (
                <TableRow key={a.id} className="border-white/10">
                  <TableCell className="font-serif text-sm">{a.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.email}</TableCell>
                  <TableCell className="text-sm text-muted-foreground truncate max-w-[120px]">{a.website || "—"}</TableCell>
                  <TableCell>
                    <Badge className={a.status === "approved" ? "bg-emerald-600" : a.status === "rejected" ? "bg-red-600" : "bg-amber-600"}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-primary">{a.referralCode || "—"}</TableCell>
                  <TableCell className="flex gap-1">
                    {a.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs" onClick={() => updateStatus(a.id, "approved")} data-testid={`button-approve-affiliate-${a.id}`}>Approve</Button>
                        <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 text-xs" onClick={() => updateStatus(a.id, "rejected")} data-testid={`button-reject-affiliate-${a.id}`}>Reject</Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function SystemMaintenance() {
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<"export" | "import" | "export-books" | "import-books" | "verify-illustrations" | "repair-illustrations" | "price-drafts" | "price-all" | null>(null);
  const [auditResults, setAuditResults] = useState<any>(null);
  const [auditRunning, setAuditRunning] = useState(false);
  const adminToken = localStorage.getItem("ebgz_admin_token") || "";
  const headers = { "x-admin-token": adminToken, "Content-Type": "application/json" };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/system-stats", { headers });
      if (res.ok) setStats(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  const runCleanup = async (targets: string[], label: string) => {
    setCleaning(label);
    try {
      const res = await fetch("/api/admin/cleanup", {
        method: "POST",
        headers,
        body: JSON.stringify({ targets }),
      });
      const data = await res.json();
      if (data.success) {
        const summary = Object.entries(data.results).map(([k, v]: any) => `${k}: ${v.freed} ${v.status}`).join(", ");
        toast({ title: "Cleanup Complete", description: summary });
        fetchStats();
      } else {
        toast({ title: "Error", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setCleaning(null);
  };

  const cleanupItems = [
    { key: "build_cache", label: "Build Cache", desc: "Bundler and dependency cache files", icon: HardDrive, stat: stats?.cache },
    { key: "dist", label: "Build Output", desc: "Compiled build artifacts (rebuilt on next start)", icon: FileText, stat: stats?.dist },
    { key: "tmp_files", label: "Temp & Log Files", desc: "Temporary files and old log files", icon: Trash2, stat: stats?.tmp },
    { key: "duplicate_assets", label: "Duplicate Covers", desc: "Duplicate cover images in attached assets", icon: Copy, stat: stats?.attachedAssets },
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-xl text-orange-400 flex items-center gap-2">
                <Wrench className="h-5 w-5" /> System Maintenance
              </CardTitle>
              <CardDescription className="font-serif mt-1">Clean up caches, temporary files, and duplicates to free up space and keep things running smooth.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={fetchStats} disabled={loading} className="border-white/20" data-testid="button-refresh-stats">
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => runCleanup(["build_cache", "dist", "tmp_files", "duplicate_assets"], "all")}
                disabled={cleaning !== null}
                className="bg-orange-600 hover:bg-orange-500 text-white"
                data-testid="button-clean-all"
              >
                {cleaning === "all" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Clean Everything
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {cleanupItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="bg-white/5 rounded-lg p-4 border border-white/10 flex items-start justify-between" data-testid={`card-cleanup-${item.key}`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-2 rounded-lg bg-orange-500/10">
                      <Icon className="h-5 w-5 text-orange-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-white">{item.label}</h4>
                      <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                      {item.stat && (
                        <p className="text-xs text-orange-300 mt-1 font-mono">
                          {item.stat.label}{item.stat.count !== undefined ? ` (${item.stat.count} files)` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => runCleanup([item.key], item.key)}
                    disabled={cleaning !== null}
                    className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 shrink-0"
                    data-testid={`button-clean-${item.key}`}
                  >
                    {cleaning === item.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-500 mt-4">Note: Clearing the build cache or build output is safe — they are automatically rebuilt when the app starts. Browser cookies are managed by your browser's settings, not the server.</p>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-display text-xl text-green-400 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Site Audit
              </CardTitle>
              <CardDescription className="font-serif mt-1">Scan the entire catalog for issues — missing covers, bad pricing, duplicate titles, unprocessed illustrations, and more.</CardDescription>
            </div>
            <Button
              size="sm"
              onClick={async () => {
                setAuditRunning(true);
                try {
                  const res = await fetch("/api/admin/site-audit", { headers });
                  const data = await res.json();
                  if (data.success) {
                    setAuditResults(data);
                    if (data.stats.errors === 0 && data.stats.warnings === 0) {
                      toast({ title: "All Clear!", description: `Scanned ${data.stats.totalBooks} books — no issues found.` });
                    } else {
                      toast({ title: "Audit Complete", description: `Found ${data.stats.errors} errors and ${data.stats.warnings} warnings across ${data.stats.totalBooks} books.`, variant: "destructive" });
                    }
                  } else {
                    toast({ title: "Audit Failed", description: data.error, variant: "destructive" });
                  }
                } catch (err: any) {
                  toast({ title: "Error", description: err.message, variant: "destructive" });
                }
                setAuditRunning(false);
              }}
              disabled={auditRunning}
              className="bg-green-700 hover:bg-green-600 text-white shrink-0"
              data-testid="button-run-audit"
            >
              {auditRunning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
              {auditRunning ? "Scanning..." : "Run Audit"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!auditResults && !auditRunning && (
            <p className="text-sm text-gray-400 text-center py-6">Click "Run Audit" to scan your entire catalog for issues. Takes about 5–10 seconds.</p>
          )}
          {auditRunning && (
            <div className="flex items-center justify-center gap-3 py-8 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin text-green-400" />
              <span className="text-sm">Scanning {auditResults?.stats?.totalBooks ?? "all"} books...</span>
            </div>
          )}
          {auditResults && !auditRunning && (
            <div className="space-y-4">
              {/* Top stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-400">{auditResults.stats.errors}</p>
                  <p className="text-xs text-gray-400 mt-1">Errors</p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-400">{auditResults.stats.warnings}</p>
                  <p className="text-xs text-gray-400 mt-1">Warnings</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white">{auditResults.stats.totalBooks}</p>
                  <p className="text-xs text-gray-400 mt-1">Books</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-white">{auditResults.stats.totalSubscribers}</p>
                  <p className="text-xs text-gray-400 mt-1">Active Subscribers</p>
                </div>
              </div>

              {/* Performance score + section breakdown */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`px-3 py-1 rounded-full border font-bold text-sm ${
                  auditResults.stats.perfScore >= 80 ? "bg-green-500/10 border-green-500/30 text-green-400" :
                  auditResults.stats.perfScore >= 50 ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" :
                  "bg-red-500/10 border-red-500/30 text-red-400"
                }`}>
                  Perf Score: {auditResults.stats.perfScore}/100
                </span>
                {["Catalog", "Links", "Customers", "Performance"].map(section => {
                  const count = auditResults.issues.filter((i: any) => i.section === section).length;
                  return (
                    <span key={section} className={`px-2 py-1 rounded-full border font-medium ${count === 0 ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-white/5 border-white/10 text-gray-300"}`}>
                      {section}: {count === 0 ? "✓" : count}
                    </span>
                  );
                })}
                <a
                  href="https://pagespeed.web.dev/analysis?url=https%3A%2F%2Febookgamez.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 font-medium hover:bg-blue-500/20 transition-colors"
                >
                  ↗ Google PageSpeed
                </a>
              </div>

              {auditResults.issues.length === 0 ? (
                <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <CheckCircle className="h-6 w-6 text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-300">Everything looks great!</p>
                    <p className="text-xs text-gray-400 mt-0.5">No issues found across books, links, orders, or subscriptions.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {["Catalog", "Links", "Customers", "Performance"].map(section => {
                    const sectionIssues = auditResults.issues.filter((i: any) => i.section === section);
                    if (sectionIssues.length === 0) return null;
                    const sectionColors: Record<string, string> = { Catalog: "text-amber-400", Links: "text-blue-400", Customers: "text-purple-400", Performance: "text-cyan-400" };
                    return (
                      <div key={section}>
                        <h4 className={`text-xs font-bold uppercase tracking-widest mb-2 ${sectionColors[section]}`}>{section}</h4>
                        <div className="space-y-2">
                          {sectionIssues.map((issue: any, i: number) => (
                            <div
                              key={i}
                              className={`flex items-start gap-3 rounded-lg p-3 border ${
                                issue.severity === "error" ? "bg-red-500/10 border-red-500/20" :
                                issue.severity === "warning" ? "bg-yellow-500/10 border-yellow-500/20" :
                                "bg-blue-500/10 border-blue-500/20"
                              }`}
                              data-testid={`audit-issue-${section}-${i}`}
                            >
                              {issue.severity === "error" ? <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" /> :
                               issue.severity === "warning" ? <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" /> :
                               <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-xs font-semibold uppercase tracking-wider ${
                                    issue.severity === "error" ? "text-red-400" :
                                    issue.severity === "warning" ? "text-yellow-400" : "text-blue-400"
                                  }`}>{issue.category}</span>
                                  <span className="text-xs bg-white/10 rounded px-1.5 py-0.5 text-gray-300">{issue.count} affected</span>
                                </div>
                                <p className="text-sm text-gray-200 mt-0.5">{issue.message}</p>
                                {issue.ids && issue.ids.length > 0 && issue.ids.length <= 15 && (
                                  <p className="text-xs text-gray-500 mt-1 font-mono break-all">IDs: {issue.ids.join(", ")}</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="text-[10px] text-gray-500 mt-2">Last scanned: {new Date(auditResults.runAt).toLocaleString()} · {auditResults.stats.totalOrders} completed orders checked</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="font-display text-xl text-blue-400 flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5" /> Database Sync (Dev ↔ Production)
          </CardTitle>
          <CardDescription className="font-serif mt-1">Sync draft ebooks between development and production databases via cloud storage.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-4 border border-white/10" data-testid="card-sync-export">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-2 rounded-lg bg-blue-500/10">
                  <Upload className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm text-white">Export Drafts</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Save all draft ebooks from this environment to cloud storage for syncing.</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  setSyncing("export");
                  try {
                    const res = await fetch("/api/admin/export-drafts", { method: "POST", headers });
                    const data = await res.json();
                    if (data.success) {
                      toast({ title: "Export Started", description: `Exporting ${data.totalDrafts} drafts in ${data.totalChunks} chunks to cloud storage. This runs in the background — check server logs for progress.` });
                    } else {
                      toast({ title: "Export Failed", description: data.error, variant: "destructive" });
                    }
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  }
                  setSyncing(null);
                }}
                disabled={syncing !== null}
                className="w-full mt-3 bg-blue-600 hover:bg-blue-500 text-white"
                data-testid="button-export-drafts"
              >
                {syncing === "export" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Export Drafts to Cloud
              </Button>
            </div>

            <div className="bg-white/5 rounded-lg p-4 border border-white/10" data-testid="card-sync-import">
              <div className="flex items-start gap-3">
                <div className="mt-1 p-2 rounded-lg bg-green-500/10">
                  <Package className="h-5 w-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-sm text-white">Import Drafts</h4>
                  <p className="text-xs text-gray-400 mt-0.5">Load draft ebooks from cloud storage into this environment's database.</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  setSyncing("import");
                  try {
                    const res = await fetch("/api/admin/import-drafts", { method: "POST", headers });
                    const data = await res.json();
                    if (data.success) {
                      toast({ title: "Import Started", description: `Importing ${data.total} drafts from ${data.totalChunks} chunks. This runs in the background — check server logs for progress.` });
                    } else {
                      toast({ title: "Import Failed", description: data.error, variant: "destructive" });
                    }
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  }
                  setSyncing(null);
                }}
                disabled={syncing !== null}
                className="w-full mt-3 bg-green-600 hover:bg-green-500 text-white"
                data-testid="button-import-drafts"
              >
                {syncing === "import" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Package className="h-4 w-4 mr-1" />}
                Import Drafts from Cloud
              </Button>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-4">Workflow: Export from development first, then Import on the published site. Existing drafts will be updated with the latest data.</p>

          <div className="mt-4 pt-4 border-t border-white/10">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-emerald-400" /> Published Books Sync
            </h3>
            <p className="text-xs text-gray-400 mb-3">Sync the published <strong>books</strong> catalog between dev and production (separate from drafts). Run Export on dev, then Import on the live site to close the book count gap.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                size="sm"
                onClick={async () => {
                  setSyncing("export-books");
                  try {
                    const res = await fetch("/api/admin/export-published-books", { method: "POST", headers });
                    const data = await res.json();
                    if (data.success) {
                      toast({ title: "Books Export Started", description: `Exporting ${data.totalBooks} published books in ${data.totalChunks} chunks to cloud. Check server logs for progress.` });
                    } else {
                      toast({ title: "Export Failed", description: data.error, variant: "destructive" });
                    }
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  }
                  setSyncing(null);
                }}
                disabled={syncing !== null}
                className="bg-blue-600 hover:bg-blue-500 text-white"
                data-testid="button-export-books"
              >
                {syncing === "export-books" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Export Books to Cloud
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  setSyncing("import-books");
                  try {
                    const res = await fetch("/api/admin/import-published-books", { method: "POST", headers });
                    const data = await res.json();
                    if (data.success) {
                      toast({ title: "Books Import Started", description: `Importing ${data.total} books from ${data.totalChunks} chunks. Check server logs for progress.` });
                    } else {
                      toast({ title: "Import Failed", description: data.error, variant: "destructive" });
                    }
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  }
                  setSyncing(null);
                }}
                disabled={syncing !== null}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                data-testid="button-import-books"
              >
                {syncing === "import-books" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Package className="h-4 w-4 mr-1" />}
                Import Books from Cloud
              </Button>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/10">
            <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
              <Search className="h-4 w-4 text-rose-400" /> Illustration GCS Verification
            </h3>
            <p className="text-xs text-gray-400 mb-3">Scan all illustration references in the database and verify they actually exist in cloud storage. Use this to diagnose broken images in production.</p>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={async () => {
                  setSyncing("verify-illustrations");
                  try {
                    const res = await fetch("/api/admin/illustrations/verify-gcs", { headers });
                    const data = await res.json();
                    if (data.missing === 0) {
                      toast({ title: "All Illustrations OK", description: data.message });
                    } else {
                      toast({ title: `${data.missing} Illustrations Missing from GCS`, description: data.message, variant: "destructive" });
                    }
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  }
                  setSyncing(null);
                }}
                disabled={syncing !== null}
                className="bg-rose-700 hover:bg-rose-600 text-white"
                data-testid="button-verify-illustrations"
              >
                {syncing === "verify-illustrations" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                Verify
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  setSyncing("repair-illustrations");
                  try {
                    const res = await fetch("/api/admin/illustrations/repair-gcs", { method: "POST", headers });
                    const data = await res.json();
                    if (data.error) {
                      toast({ title: "Repair Failed", description: data.error, variant: "destructive" });
                    } else {
                      const variant = data.missingLocally > 0 ? "destructive" : "default";
                      toast({ title: `Repair Complete: ${data.repaired} uploaded`, description: data.message, variant });
                    }
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  }
                  setSyncing(null);
                }}
                disabled={syncing !== null}
                className="bg-orange-700 hover:bg-orange-600 text-white"
                data-testid="button-repair-illustrations"
              >
                {syncing === "repair-illustrations" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                Repair (Upload Local → GCS)
              </Button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-amber-400" /> Smart Pricing
            </h3>
            <p className="text-xs text-gray-400 mb-3">Recalculate all ebook prices based on word count, genre, chapter count, and category. Prices are also auto-calculated when publishing.</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={async () => {
                  setSyncing("price-drafts");
                  try {
                    const res = await fetch("/api/admin/recalculate-prices", {
                      method: "POST",
                      headers: { ...headers, "Content-Type": "application/json" },
                      body: JSON.stringify({ scope: "drafts" }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      toast({ title: "Prices Updated", description: `Recalculated prices for ${data.updated} draft ebooks.` });
                    } else {
                      toast({ title: "Error", description: data.error, variant: "destructive" });
                    }
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  }
                  setSyncing(null);
                }}
                disabled={syncing !== null}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white"
                data-testid="button-reprice-drafts"
              >
                {syncing === "price-drafts" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <DollarSign className="h-4 w-4 mr-1" />}
                Reprice Drafts
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  setSyncing("price-all");
                  try {
                    const res = await fetch("/api/admin/recalculate-prices", {
                      method: "POST",
                      headers: { ...headers, "Content-Type": "application/json" },
                      body: JSON.stringify({ scope: "all" }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      toast({ title: "All Prices Updated", description: `Recalculated prices for ${data.updated} ebooks (drafts + published).` });
                    } else {
                      toast({ title: "Error", description: data.error, variant: "destructive" });
                    }
                  } catch (err: any) {
                    toast({ title: "Error", description: err.message, variant: "destructive" });
                  }
                  setSyncing(null);
                }}
                disabled={syncing !== null}
                className="flex-1 bg-orange-600 hover:bg-orange-500 text-white"
                data-testid="button-reprice-all"
              >
                {syncing === "price-all" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <DollarSign className="h-4 w-4 mr-1" />}
                Reprice All (+ Published)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SubscriptionAnalytics() {
  const [days, setDays] = useState(30);
  const [initLoading, setInitLoading] = useState(false);
  const [drillDown, setDrillDown] = useState<{ month: string; type: "new" | "cancelled" } | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const adminToken = localStorage.getItem("ebgz_admin_token") || "";

  const { data: analytics, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/subscription/analytics", days],
    queryFn: async () => {
      const res = await fetch(`/api/subscription/analytics?days=${days}`, {
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  const handleInitPlans = async () => {
    setInitLoading(true);
    try {
      const res = await fetch("/api/subscription/init-plans", {
        method: "POST",
        headers: { "x-admin-token": adminToken, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Subscription plans created in Stripe!" });
        refetch();
      } else {
        toast({ title: data.error || "Failed to initialize plans", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to initialize plans", variant: "destructive" });
    } finally {
      setInitLoading(false);
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const res = await fetch(`/api/subscription/analytics/csv?months=${mrrMonths}`, {
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) { toast({ title: "Failed to export CSV", variant: "destructive" }); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `subscription-analytics-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Failed to export CSV", variant: "destructive" });
    } finally {
      setExportingCsv(false);
    }
  };

  const { data: drillDownData = [], isLoading: drillDownLoading } = useQuery<any[]>({
    queryKey: ["/api/subscription/subscriber-detail", drillDown?.month, drillDown?.type],
    queryFn: async () => {
      if (!drillDown) return [];
      const res = await fetch(`/api/subscription/subscriber-detail?month=${encodeURIComponent(drillDown.month)}&type=${drillDown.type}`, {
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!drillDown,
  });

  const { data: plans = [] } = useQuery<any[]>({
    queryKey: ["/api/subscription/plans"],
    queryFn: async () => {
      const res = await fetch("/api/subscription/plans");
      if (!res.ok) throw new Error("Failed to fetch plans");
      return res.json();
    },
  });

  const mrrMonths = days <= 30 ? 6 : days <= 60 ? 9 : 12;
  const { data: mrrHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/subscription/mrr-history", mrrMonths],
    queryFn: async () => {
      const res = await fetch(`/api/subscription/mrr-history?months=${mrrMonths}`, {
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) throw new Error("Failed to fetch MRR history");
      return res.json();
    },
  });

  const { data: subscriberHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/subscription/subscriber-history", mrrMonths],
    queryFn: async () => {
      const res = await fetch(`/api/subscription/subscriber-history?months=${mrrMonths}`, {
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) throw new Error("Failed to fetch subscriber history");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display text-primary">Subscription Analytics</h2>
          <p className="text-sm text-muted-foreground">Last {days} days</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="bg-black/20 border border-white/10 rounded px-3 py-1.5 text-sm"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <Button onClick={handleExportCsv} disabled={exportingCsv} variant="outline" className="border-white/20 text-sm" data-testid="button-export-csv">
            {exportingCsv ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Export CSV
          </Button>
          {plans.length === 0 && (
            <Button onClick={handleInitPlans} disabled={initLoading} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-init-plans">
              {initLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
              Initialize Stripe Plans
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Users className="w-4 h-4" /> Active Subscribers
            </div>
            <div className="text-3xl font-bold" data-testid="text-total-subscribers">{analytics?.totalSubscribers || 0}</div>
            <div className="text-xs text-muted-foreground mt-1" data-testid="text-subscriber-breakdown">
              {analytics?.monthlySubscribers || 0} monthly · {analytics?.annualSubscribers || 0} annual
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="w-4 h-4" /> MRR (Monthly Recurring)
            </div>
            <div className="text-3xl font-bold text-emerald-400" data-testid="text-monthly-revenue">${analytics?.monthlyRevenue || "0.00"}</div>
            <div className="text-xs text-muted-foreground mt-1" data-testid="text-mrr-breakdown">
              ${analytics?.monthlySubRevenue || "0.00"} monthly · ${analytics?.annualSubMRR || "0.00"} from annual
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="w-4 h-4" /> ARR (Annual Recurring)
            </div>
            <div className="text-3xl font-bold text-emerald-400" data-testid="text-arr">${analytics?.annualRecurringRevenue || "0.00"}</div>
            <div className="text-xs text-muted-foreground mt-1">From annual subscribers</div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <TrendingUp className="w-4 h-4" /> Conversion Rate
            </div>
            <div className="text-3xl font-bold">{analytics?.conversionRate || "0"}%</div>
            <div className="text-xs text-muted-foreground mt-1">{analytics?.newSubscriptions || 0} subscribed / {analytics?.pricingPageViews || 0} visited</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <AlertTriangle className="w-4 h-4" /> Churn Rate
            </div>
            <div className="text-3xl font-bold text-amber-400">{analytics?.churnRate || "0"}%</div>
            <div className="text-xs text-muted-foreground mt-1">{analytics?.cancellations || 0} cancellations</div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <ArrowUp className="w-4 h-4 text-emerald-400" /> Upgrades
            </div>
            <div className="text-3xl font-bold text-emerald-400" data-testid="text-upgrades">{analytics?.upgrades || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">tier upgrades this period</div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <ArrowDown className="w-4 h-4 text-amber-400" /> Downgrades
            </div>
            <div className="text-3xl font-bold text-amber-400" data-testid="text-downgrades">{analytics?.downgrades || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">tier downgrades this period</div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10" data-testid="card-mrr-trend">
        <CardHeader>
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            MRR Growth Trend
          </CardTitle>
          <CardDescription>Monthly recurring revenue over the last {mrrMonths} months</CardDescription>
        </CardHeader>
        <CardContent>
          {mrrHistory.length > 0 && mrrHistory.some(d => d.totalMRR > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={mrrHistory} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradMonthly" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradAnnual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                  labelStyle={{ color: "#e5e7eb", fontWeight: 600 }}
                  itemStyle={{ color: "#d1d5db" }}
                  formatter={(value: any) => [`$${value.toFixed(2)}`, undefined]}
                />
                <Legend wrapperStyle={{ paddingTop: 12, fontSize: 13 }} />
                <Area type="monotone" dataKey="monthlyMRR" name="Monthly Subs MRR" stroke="#10b981" strokeWidth={2} fill="url(#gradMonthly)" dot={false} data-testid="chart-area-monthly" />
                <Area type="monotone" dataKey="annualMRR" name="Annual Subs MRR" stroke="#6366f1" strokeWidth={2} fill="url(#gradAnnual)" dot={false} data-testid="chart-area-annual" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm" data-testid="text-mrr-empty">
              No revenue data yet — MRR trend will appear once you have subscribers.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10" data-testid="card-subscriber-trend">
        <CardHeader>
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <Users className="w-5 h-5 text-sky-400" />
            Subscriber Growth Trend
          </CardTitle>
          <CardDescription>New subscribers and cancellations over the last {mrrMonths} months — click a bar to see who joined or cancelled</CardDescription>
        </CardHeader>
        <CardContent>
          {subscriberHistory.length > 0 && subscriberHistory.some(d => d.newSubscribers > 0 || d.cancellations > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={subscriberHistory} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                onClick={(data) => {
                  if (data?.activePayload?.[0]) {
                    const month = data.activeLabel as string;
                    const clickedKey = data.activePayload[0].dataKey as string;
                    const type = clickedKey === "newSubscribers" ? "new" : "cancelled";
                    setDrillDown({ month, type });
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#9ca3af", fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                  labelStyle={{ color: "#e5e7eb", fontWeight: 600 }}
                  itemStyle={{ color: "#d1d5db" }}
                />
                <Legend wrapperStyle={{ paddingTop: 12, fontSize: 13 }} />
                <Bar dataKey="newSubscribers" name="New Subscribers" fill="#38bdf8" radius={[4, 4, 0, 0]} data-testid="chart-bar-new" />
                <Bar dataKey="cancellations" name="Cancellations" fill="#f87171" radius={[4, 4, 0, 0]} data-testid="chart-bar-cancellations" />
                <Line dataKey="net" name="Net Change" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3, fill: "#a78bfa" }} type="monotone" data-testid="chart-line-net" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm" data-testid="text-subscriber-trend-empty">
              No subscriber activity yet — growth trend will appear once subscribers join or cancel.
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!drillDown} onOpenChange={(open) => { if (!open) setDrillDown(null); }}>
        <DialogContent className="max-w-lg bg-background border-white/10">
          <DialogHeader>
            <DialogTitle className="font-serif">
              {drillDown?.type === "new" ? "New Subscribers" : "Cancellations"} — {drillDown?.month}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            {drillDownLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : drillDownData.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No records for this month.</p>
            ) : (
              <div className="space-y-1">
                {drillDownData.map((row: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 rounded hover:bg-white/5 text-sm" data-testid={`drill-row-${i}`}>
                    <span className="text-foreground">{row.email}</span>
                    <span className="text-muted-foreground text-xs">{new Date(row.date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDrillDown(null)} className="border-white/20">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-lg font-serif">Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.tierDistribution && Object.keys(analytics.tierDistribution).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(analytics.tierDistribution as Record<string, any>)
                  .sort(([, a], [, b]) => {
                    const aTotal = typeof a === "object" ? a.total : a;
                    const bTotal = typeof b === "object" ? b.total : b;
                    return bTotal - aTotal;
                  })
                  .map(([tier, counts]: [string, any]) => {
                  const total = analytics.totalSubscribers || 1;
                  const tierTotal = typeof counts === "object" ? counts.total : counts;
                  const monthly = typeof counts === "object" ? counts.monthly : tierTotal;
                  const annual = typeof counts === "object" ? counts.annual : 0;
                  const pct = ((tierTotal / total) * 100);
                  const monthlyPct = tierTotal > 0 ? (monthly / tierTotal) * pct : 0;
                  const annualPct = tierTotal > 0 ? (annual / tierTotal) * pct : 0;
                  return (
                    <div key={tier} data-testid={`tier-row-${tier.toLowerCase()}`}>
                      <div className="flex justify-between text-sm mb-1">
                        <span data-testid={`text-tier-name-${tier.toLowerCase()}`}>{tier} Pass</span>
                        <span data-testid={`text-tier-count-${tier.toLowerCase()}`}>{tierTotal} ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${monthlyPct}%` }}
                          title={`${monthly} monthly`}
                        />
                        <div
                          className="h-full bg-violet-500 transition-all"
                          style={{ width: `${annualPct}%` }}
                          title={`${annual} annual`}
                        />
                      </div>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground" data-testid={`text-tier-split-${tier.toLowerCase()}`}>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                          {monthly} monthly
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="inline-block w-2 h-2 rounded-full bg-violet-500" />
                          {annual} annual
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-4 pt-2 border-t border-white/10 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-500" /> Monthly</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-violet-500" /> Annual</span>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No subscribers yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-lg font-serif">Usage Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-black/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{analytics?.totalReads || 0}</div>
                <div className="text-xs text-muted-foreground">Total Reads</div>
              </div>
              <div className="bg-black/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold">{analytics?.totalDownloads || 0}</div>
                <div className="text-xs text-muted-foreground">Total Downloads</div>
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div>Avg reads/subscriber: {analytics?.avgReadsPerSubscriber || "0"}</div>
              <div>Avg downloads/subscriber: {analytics?.avgDownloadsPerSubscriber || "0"}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-lg font-serif">Tier Interest (Clicks)</CardTitle>
          <CardDescription>Which tiers are customers clicking on most</CardDescription>
        </CardHeader>
        <CardContent>
          {analytics?.tierClicks && Object.keys(analytics.tierClicks).length > 0 ? (
            <div className="grid grid-cols-5 gap-4">
              {["lite", "reader", "value", "premium", "vip"].map(tier => (
                <div key={tier} className="bg-black/20 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold">{analytics.tierClicks[tier] || 0}</div>
                  <div className="text-xs text-muted-foreground capitalize">{tier}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No tier click data yet</p>
          )}
        </CardContent>
      </Card>

      {analytics?.phase2Reminder?.phase2Ready && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-lg font-serif text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Phase 2 Reminder — It's Time to Optimize!
            </CardTitle>
            <CardDescription className="text-amber-200/70">
              {analytics.phase2Reminder.daysSinceLaunch} days since your first subscriber
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {analytics.phase2Reminder.suggestions.map((s: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <ArrowUpRight className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {analytics?.phase2Reminder && !analytics.phase2Reminder.phase2Ready && analytics.phase2Reminder.launchDate && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">
              Phase 2 optimization reminder will appear after 60 days of subscriber data.
              Currently at {analytics.phase2Reminder.daysSinceLaunch} days.
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-lg font-serif">Recent Events</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics?.recentEvents && analytics.recentEvents.length > 0 ? (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {analytics.recentEvents.map((event: any) => (
                <div key={event.id} className="flex items-center justify-between text-sm py-1 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{event.eventType.replace(/_/g, " ")}</Badge>
                    {event.customerEmail && <span className="text-muted-foreground">{event.customerEmail}</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No events recorded yet</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-lg font-serif">Current Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {plans.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="border-white/10">
                  <TableHead>Tier</TableHead>
                  <TableHead>Monthly</TableHead>
                  <TableHead>Annual</TableHead>
                  <TableHead>Reads/Month</TableHead>
                  <TableHead>Downloads/Month</TableHead>
                  <TableHead>Stripe Price ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan: any) => (
                  <TableRow key={plan.id} className="border-white/10">
                    <TableCell className="font-medium">{plan.name} Pass</TableCell>
                    <TableCell>${plan.monthlyPrice}/mo</TableCell>
                    <TableCell>{plan.annualPrice ? `$${plan.annualPrice}/yr` : "—"}</TableCell>
                    <TableCell>{plan.readsPerMonth >= 99999 ? "Unlimited" : plan.readsPerMonth}</TableCell>
                    <TableCell>{plan.downloadsPerMonth}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{plan.stripePriceId || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">No subscription plans created yet</p>
              <Button onClick={handleInitPlans} disabled={initLoading} className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-init-plans-2">
                {initLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
                Create Plans in Stripe
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}