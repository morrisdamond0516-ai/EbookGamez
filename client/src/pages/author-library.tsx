import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, Search, Library, Eye, Filter } from "lucide-react";

interface LibraryBook {
  id: number;
  title: string;
  genre: string;
  author: string;
  coverUrl: string | null;
  description: string | null;
  hasContent: boolean;
  wordCount: number;
  chapterCount: number;
  source: "classic" | "author" | "uploaded";
  status: string;
}

export default function AuthorLibrary() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "classic" | "author" | "uploaded">("all");

  useEffect(() => {
    const token = localStorage.getItem("ebgz_admin_token");
    if (token) {
      fetch("/api/admin/verify", { headers: { "x-admin-token": token } })
        .then(r => r.json())
        .then(data => { if (data.authenticated) setIsAuthenticated(true); })
        .catch(() => {});
    }
  }, []);

  const handleLogin = async () => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("ebgz_admin_token", data.token);
      setIsAuthenticated(true);
    }
  };

  const { data: books = [], isLoading } = useQuery<LibraryBook[]>({
    queryKey: ["/api/admin/author-library"],
    queryFn: async () => {
      const token = localStorage.getItem("ebgz_admin_token");
      const r = await fetch("/api/admin/author-library", {
        headers: { "x-admin-token": token || "" },
      });
      if (!r.ok) throw new Error("Failed to fetch");
      return r.json();
    },
    enabled: isAuthenticated,
  });

  const genres = [...new Set(books.map(b => b.genre))].sort();

  const filtered = books.filter(b => {
    if (genreFilter !== "all" && b.genre !== genreFilter) return false;
    if (sourceFilter !== "all" && b.source !== sourceFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return b.title.toLowerCase().includes(q) || b.genre.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
    }
    return true;
  });

  const classicCount = books.filter(b => b.source === "classic").length;
  const authorCount = books.filter(b => b.source === "author").length;
  const uploadedCount = books.filter(b => b.source === "uploaded").length;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Card className="w-96 bg-card/50 border-white/10">
          <CardContent className="pt-6 space-y-4">
            <h2 className="text-xl font-display text-primary text-center">Author Library</h2>
            <p className="text-sm text-muted-foreground text-center">Admin access required</p>
            <Input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              data-testid="input-admin-password"
            />
            <Button onClick={handleLogin} className="w-full" data-testid="button-login">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="sm" data-testid="button-back-admin">
              <ArrowLeft className="w-4 h-4 mr-1" /> Admin
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Library className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-display text-primary" data-testid="heading-author-library">Author Library</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-auto">
            Private reading room for classics, author submissions, and uploaded works
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, genre, or author..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-white/5 border-white/10"
              data-testid="input-search-library"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
              {([
                ["all", `All (${books.length})`],
                ["classic", `Classics (${classicCount})`],
                ["author", `Author Works (${authorCount})`],
                ["uploaded", `Uploaded (${uploadedCount})`],
              ] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => setSourceFilter(val as any)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    sourceFilter === val
                      ? "bg-primary text-black shadow-sm"
                      : "text-muted-foreground hover:text-white"
                  }`}
                  data-testid={`button-filter-${val}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Select value={genreFilter} onValueChange={setGenreFilter}>
            <SelectTrigger className="w-48 bg-white/5 border-white/10" data-testid="select-genre-filter">
              <SelectValue placeholder="All Genres" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Genres</SelectItem>
              {genres.map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-muted-foreground">Loading library...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Library className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">No books found matching your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(book => (
              <Card key={book.id} className="bg-card/30 border-white/10 hover:border-primary/30 transition-colors overflow-hidden" data-testid={`card-library-book-${book.id}`}>
                <div className="flex gap-3 p-4">
                  {book.coverUrl ? (
                    <img
                      src={book.coverUrl}
                      alt={book.title}
                      className="w-20 h-28 object-cover rounded-md flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-28 bg-primary/10 rounded-md flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-8 h-8 text-primary/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2 mb-1" title={book.title}>
                      {book.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-1">{book.author}</p>
                    <Badge variant="outline" className="text-[10px] border-white/10 mb-2">
                      {book.genre}
                    </Badge>
                    <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                      <Badge
                        className={`text-[10px] ${
                          book.source === "classic" ? "bg-amber-900/50 text-amber-300" :
                          book.source === "author" ? "bg-blue-900/50 text-blue-300" :
                          "bg-green-900/50 text-green-300"
                        }`}
                      >
                        {book.source === "classic" ? "Classic" : book.source === "author" ? "Author" : "Uploaded"}
                      </Badge>
                      {book.status === "idea" && (
                        <Badge className="text-[10px] bg-yellow-900/50 text-yellow-300">Idea</Badge>
                      )}
                      {book.hasContent && (
                        <span>{book.wordCount.toLocaleString()} words</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="px-4 pb-3">
                  {book.hasContent ? (
                    <Link href={`/read/${book.id}`}>
                      <Button size="sm" className="w-full bg-primary/20 text-primary hover:bg-primary/30" data-testid={`button-read-${book.id}`}>
                        <Eye className="w-3 h-3 mr-1" /> Read
                      </Button>
                    </Link>
                  ) : (
                    <Button size="sm" className="w-full" variant="outline" disabled data-testid={`button-no-content-${book.id}`}>
                      No Content Yet
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
