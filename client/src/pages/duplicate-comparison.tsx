import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface BookMember {
  id: number;
  title: string;
  genre: string;
  price: string;
  coverUrl: string;
  createdAt: string;
  draftId: number | null;
  wordCount: number;
  excerpt: string;
  chapters: string[];
  dialogue: string[];
  hasSubtitle?: boolean;
}

interface PairComparison {
  bookIdA: number;
  bookIdB: number;
  matchType: string;
  sameDraft: boolean;
  sameCover: boolean;
  contentSimilarity: number;
}

interface DuplicateGroup {
  books: BookMember[];
  comparisons: PairComparison[];
  groupSeverity: string;
  hasSameDraft: boolean;
  hasSameCover: boolean;
}

const severityConfig: Record<string, { label: string; color: string; border: string }> = {
  SAME_DRAFT: { label: 'Same Draft Source', color: 'bg-red-900/60 text-red-300', border: 'border-red-900/50' },
  NEAR_IDENTICAL: { label: 'Near Identical Content', color: 'bg-red-900/40 text-red-300', border: 'border-red-800/50' },
  VERY_SIMILAR: { label: 'Very Similar Content', color: 'bg-yellow-900/40 text-yellow-300', border: 'border-yellow-800/50' },
  DIFFERENT_CONTENT: { label: 'Similar Titles, Different Content', color: 'bg-green-900/40 text-green-300', border: 'border-green-800/50' },
};

export default function DuplicateComparison() {
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("ebgz_admin_token");
  if (!hasToken) {
    window.location.href = "/";
    return null;
  }
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [expandedBook, setExpandedBook] = useState<number | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  const adminToken = localStorage.getItem("ebgz_admin_token") || "";
  const { data: groups, isLoading, refetch } = useQuery<DuplicateGroup[]>({
    queryKey: ["/api/books/duplicates-comparison"],
    queryFn: async () => {
      const res = await fetch("/api/books/duplicates-comparison", {
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) throw new Error("Failed to fetch duplicates");
      return res.json();
    },
  });

  const handleDelete = async (bookId: number) => {
    if (!confirm(`Delete book ID ${bookId}? This cannot be undone.`)) return;
    setDeletingIds(prev => new Set([...prev, bookId]));
    try {
      await fetch(`/api/books/${bookId}`, {
        method: "DELETE",
        headers: { "x-admin-token": adminToken },
      });
      refetch();
    } catch (e) {
      alert("Failed to delete");
    } finally {
      setDeletingIds(prev => { const s = new Set(prev); s.delete(bookId); return s; });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-xl animate-pulse" data-testid="text-loading">Analyzing titles for duplicates...</div>
      </div>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center gap-4">
        <div className="text-2xl font-bold text-green-400" data-testid="text-no-duplicates">No Similar Titles Found</div>
        <p className="text-gray-400">All ebooks in the catalog have unique titles.</p>
        <a href="/admin" className="text-amber-400 hover:underline" data-testid="link-back-admin">Back to Admin</a>
      </div>
    );
  }

  const totalBooks = groups.reduce((sum, g) => sum + g.books.length, 0);
  const dangerGroups = groups.filter(g => g.groupSeverity === 'SAME_DRAFT' || g.groupSeverity === 'NEAR_IDENTICAL').length;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-amber-400" data-testid="text-page-title">
              Duplicate Finder
            </h1>
            <p className="text-gray-400 mt-1" data-testid="text-summary">
              {groups.length} group{groups.length !== 1 ? 's' : ''} with similar titles ({totalBooks} books total){dangerGroups > 0 && ` — ${dangerGroups} need attention`}
            </p>
          </div>
          <a href="/admin" className="px-4 py-2 bg-gray-800 rounded hover:bg-gray-700 text-sm" data-testid="link-back-admin">
            Back to Admin
          </a>
        </div>

        <div className="space-y-6">
          {groups.map((group, gIndex) => {
            const isExpanded = expandedGroup === gIndex;
            const sev = severityConfig[group.groupSeverity] || severityConfig.DIFFERENT_CONTENT;
            return (
              <div
                key={gIndex}
                className={`border rounded-xl overflow-hidden bg-gray-900/80 ${sev.border}`}
                data-testid={`card-group-${gIndex}`}
              >
                <div
                  className="p-4 cursor-pointer hover:bg-gray-800/30 flex items-center justify-between"
                  onClick={() => setExpandedGroup(isExpanded ? null : gIndex)}
                  data-testid={`button-toggle-group-${gIndex}`}
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-amber-400 font-bold text-lg">Group #{gIndex + 1}</span>
                    <span className={`text-xs px-2 py-1 rounded font-semibold ${sev.color}`}>
                      {sev.label}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-700 rounded">
                      {group.books.length} books
                    </span>
                    {group.hasSameDraft && (
                      <span className="text-xs px-2 py-1 bg-red-900/60 text-red-300 rounded">Shared Draft</span>
                    )}
                    {group.hasSameCover && (
                      <span className="text-xs px-2 py-1 bg-red-900/60 text-red-300 rounded">Shared Cover</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-3">
                      {group.books.slice(0, 4).map(book => (
                        <img
                          key={book.id}
                          src={book.coverUrl}
                          alt={book.title}
                          className="w-10 h-14 object-cover rounded border-2 border-gray-800"
                        />
                      ))}
                    </div>
                    <span className="text-gray-400 text-2xl ml-2">{isExpanded ? '−' : '+'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-800">
                    <div className="p-4 bg-gray-800/30 border-b border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-300 mb-3">Cross-Comparisons</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {group.comparisons.map((comp, cIdx) => (
                          <div key={cIdx} className="bg-gray-900/60 rounded p-2 text-xs flex items-center gap-2">
                            <span className="text-white font-semibold">#{comp.bookIdA} vs #{comp.bookIdB}</span>
                            <span className={`px-1.5 py-0.5 rounded ${
                              comp.contentSimilarity >= 80 ? 'bg-red-900/50 text-red-300'
                              : comp.contentSimilarity >= 60 ? 'bg-yellow-900/50 text-yellow-300'
                              : 'bg-green-900/50 text-green-300'
                            }`}>
                              {comp.contentSimilarity}% similar
                            </span>
                            {comp.sameDraft && <span className="text-red-400">Same Draft</span>}
                            {comp.sameCover && <span className="text-red-400">Same Cover</span>}
                            <span className="text-gray-500">
                              {comp.matchType === 'EXACT_TITLE' ? 'Exact' : comp.matchType === 'SAME_BASE_TITLE' ? 'Base Match' : 'Prefix'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={`grid gap-0`} style={{ gridTemplateColumns: `repeat(${Math.min(group.books.length, 4)}, 1fr)` }}>
                      {group.books.map((book, bIdx) => {
                        const bookExpanded = expandedBook === book.id;
                        return (
                          <div
                            key={book.id}
                            className={`p-4 ${bIdx < group.books.length - 1 ? 'border-r border-gray-800' : ''}`}
                          >
                            <div className="flex flex-col items-center gap-3">
                              <div className="relative">
                                <img
                                  src={book.coverUrl}
                                  alt={book.title}
                                  className="w-32 h-44 object-cover rounded-lg shadow-lg"
                                  data-testid={`img-cover-${book.id}`}
                                />
                                <div className="absolute bottom-1 right-1 bg-black/80 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                  ID: {book.id}
                                </div>
                              </div>

                              <h3 className="text-xs font-semibold text-center leading-tight" data-testid={`text-title-${book.id}`}>
                                {book.title}
                              </h3>

                              <div className="w-full grid grid-cols-2 gap-1 text-[10px]">
                                <div className="bg-gray-800/50 p-1.5 rounded">
                                  <span className="text-gray-400">Price:</span> <span className="text-white">${book.price}</span>
                                </div>
                                <div className="bg-gray-800/50 p-1.5 rounded">
                                  <span className="text-gray-400">Words:</span> <span className="text-white">{book.wordCount.toLocaleString()}</span>
                                </div>
                                <div className="bg-gray-800/50 p-1.5 rounded">
                                  <span className="text-gray-400">Draft:</span> <span className="text-white">{book.draftId || 'N/A'}</span>
                                </div>
                                <div className="bg-gray-800/50 p-1.5 rounded">
                                  <span className="text-gray-400">Genre:</span> <span className="text-white">{book.genre}</span>
                                </div>
                              </div>

                              {book.hasSubtitle && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded">Has Subtitle</span>
                              )}

                              <button
                                onClick={() => setExpandedBook(bookExpanded ? null : book.id)}
                                className="text-xs text-amber-400 hover:text-amber-300"
                                data-testid={`button-details-${book.id}`}
                              >
                                {bookExpanded ? 'Hide Details' : 'Show Details'}
                              </button>

                              {bookExpanded && (
                                <div className="w-full space-y-2">
                                  {book.chapters.length > 0 && (
                                    <div>
                                      <h4 className="text-[10px] font-semibold text-amber-400 mb-1">
                                        Chapters ({book.chapters.length}):
                                      </h4>
                                      <ul className="text-[10px] text-gray-300 space-y-0.5 max-h-36 overflow-y-auto">
                                        {book.chapters.map((ch, i) => (
                                          <li key={i} className="bg-gray-800/30 p-1 px-1.5 rounded truncate">{ch}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {book.dialogue && book.dialogue.length > 0 && (
                                    <div>
                                      <h4 className="text-[10px] font-semibold text-blue-400 mb-1">Dialogue:</h4>
                                      <div className="space-y-1 max-h-28 overflow-y-auto">
                                        {book.dialogue.map((d, i) => (
                                          <blockquote key={i} className="text-[10px] text-gray-300 italic bg-gray-800/30 p-1.5 rounded border-l-2 border-blue-500">
                                            {d}
                                          </blockquote>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {book.excerpt && (
                                    <div>
                                      <h4 className="text-[10px] font-semibold text-purple-400 mb-1">Opening:</h4>
                                      <p className="text-[10px] text-gray-400 leading-relaxed bg-gray-800/30 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                                        {book.excerpt}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              <button
                                onClick={(e) => { e.stopPropagation(); handleDelete(book.id); }}
                                disabled={deletingIds.has(book.id)}
                                className="w-full mt-1 py-1.5 bg-red-900/40 hover:bg-red-800 text-red-200 rounded text-xs font-semibold transition-colors disabled:opacity-50"
                                data-testid={`button-delete-${book.id}`}
                              >
                                {deletingIds.has(book.id) ? 'Deleting...' : `Delete ID ${book.id}`}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
