import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { optimizedSrc } from "@/components/ui/book-card";

interface OldBook {
  id: number;
  title: string;
  genre: string;
  price: string;
  coverUrl: string;
  description: string;
  visible: boolean;
  createdAt: string;
}

interface NewDraft {
  id: number;
  title: string;
  genre: string;
  suggestedPrice: string;
  coverUrl: string | null;
  status: string;
  wordCount: number;
  chapterCount: number;
  chapters: string[];
  excerpt: string;
}

interface BlockerPair {
  oldBook: OldBook;
  newDraft: NewDraft;
}

export default function RewriteBlockers() {
  const hasToken = typeof window !== "undefined" && !!localStorage.getItem("ebgz_admin_token");
  if (!hasToken) {
    window.location.href = "/";
    return null;
  }

  const adminToken = localStorage.getItem("ebgz_admin_token") || "";
  const queryClient = useQueryClient();
  const [expandedPair, setExpandedPair] = useState<number | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<number>>(new Set());

  const { data: pairs, isLoading, refetch } = useQuery<BlockerPair[]>({
    queryKey: ["/api/books/rewrite-blockers"],
    queryFn: async () => {
      const res = await fetch("/api/books/rewrite-blockers", {
        headers: { "x-admin-token": adminToken },
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const hideOldMutation = useMutation({
    mutationFn: async (bookId: number) => {
      const res = await fetch("/api/admin/books/toggle-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ bookIds: [bookId], visible: false }),
      });
      if (!res.ok) throw new Error("Failed to hide book");
      return res.json();
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
    },
  });

  const handleHideOld = async (bookId: number) => {
    setProcessingIds(prev => new Set([...prev, bookId]));
    try {
      await hideOldMutation.mutateAsync(bookId);
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(bookId); return s; });
    }
  };

  const handleHideAllOld = async () => {
    if (!pairs || pairs.length === 0) return;
    for (const pair of pairs) {
      if (pair.oldBook.visible) {
        await handleHideOld(pair.oldBook.id);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="text-xl animate-pulse" data-testid="text-loading">Loading rewrite blockers...</div>
      </div>
    );
  }

  if (!pairs || pairs.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center gap-4">
        <div className="text-2xl font-bold text-green-400" data-testid="text-no-blockers">No Rewrite Blockers</div>
        <p className="text-gray-400">All rewrites are clear to publish.</p>
        <a href="/admin" className="text-amber-400 hover:underline" data-testid="link-back-admin">Back to Admin</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-amber-400" data-testid="text-page-title">
              Rewrite Blockers
            </h1>
            <p className="text-gray-400 mt-1 text-sm" data-testid="text-summary">
              {pairs.length} rewrite{pairs.length !== 1 ? 's' : ''} blocked — the new version can't publish because the old version has the same title
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleHideAllOld}
              className="px-4 py-2 bg-red-900/60 hover:bg-red-800 text-red-200 rounded text-sm font-semibold transition-colors"
              data-testid="button-hide-all-old"
            >
              Hide All Old Versions
            </button>
            <a href="/admin" className="px-4 py-2 bg-gray-800 rounded hover:bg-gray-700 text-sm" data-testid="link-back-admin">
              Back to Admin
            </a>
          </div>
        </div>

        <div className="space-y-6">
          {pairs.map((pair, idx) => {
            const isExpanded = expandedPair === idx;
            const oldHidden = !pair.oldBook.visible;

            return (
              <div
                key={idx}
                className={`border rounded-xl overflow-hidden bg-gray-900/80 ${oldHidden ? 'border-green-800/50' : 'border-red-900/50'}`}
                data-testid={`card-pair-${idx}`}
              >
                <div
                  className="p-4 cursor-pointer hover:bg-gray-800/30 flex items-center justify-between"
                  onClick={() => setExpandedPair(isExpanded ? null : idx)}
                  data-testid={`button-toggle-pair-${idx}`}
                >
                  <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
                    <span className="text-amber-400 font-bold">#{idx + 1}</span>
                    <span className="text-white font-semibold truncate max-w-md">
                      {pair.oldBook.title}
                    </span>
                    <span className="text-xs px-2 py-1 bg-gray-700 rounded whitespace-nowrap">
                      {pair.oldBook.genre}
                    </span>
                    {oldHidden ? (
                      <span className="text-xs px-2 py-1 bg-green-900/60 text-green-300 rounded font-semibold">Old Hidden — Ready to Publish</span>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-red-900/60 text-red-300 rounded font-semibold">Blocked</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-2">
                    <div className="flex -space-x-3">
                      {pair.oldBook.coverUrl && (
                        <img src={optimizedSrc(pair.oldBook.coverUrl, 80)} alt="Old" className="w-8 h-11 object-cover rounded border-2 border-red-900" />
                      )}
                      {pair.newDraft.coverUrl && (
                        <img src={optimizedSrc(pair.newDraft.coverUrl, 80)} alt="New" className="w-8 h-11 object-cover rounded border-2 border-green-900" />
                      )}
                    </div>
                    <span className="text-gray-400 text-2xl">{isExpanded ? '−' : '+'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-800">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                      <div className={`p-5 ${oldHidden ? 'opacity-40' : ''} border-b md:border-b-0 md:border-r border-gray-800`}>
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xs px-2 py-1 bg-red-900/60 text-red-300 rounded font-bold">OLD VERSION (Published)</span>
                          <span className="text-xs text-gray-500">Book #{pair.oldBook.id}</span>
                          {oldHidden && <span className="text-xs text-green-400 font-semibold">HIDDEN</span>}
                        </div>

                        <div className="flex gap-4">
                          {pair.oldBook.coverUrl && (
                            <img
                              src={optimizedSrc(pair.oldBook.coverUrl, 200)}
                              alt={pair.oldBook.title}
                              className="w-28 h-40 object-cover rounded-lg shadow-lg flex-shrink-0"
                              data-testid={`img-old-cover-${pair.oldBook.id}`}
                            />
                          )}
                          <div className="flex-1 min-w-0 space-y-2">
                            <h3 className="text-sm font-bold text-white leading-tight" data-testid={`text-old-title-${pair.oldBook.id}`}>
                              {pair.oldBook.title}
                            </h3>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div className="bg-gray-800/50 p-1.5 rounded">
                                <span className="text-gray-400">Price:</span> <span className="text-white">${pair.oldBook.price}</span>
                              </div>
                              <div className="bg-gray-800/50 p-1.5 rounded">
                                <span className="text-gray-400">Genre:</span> <span className="text-white">{pair.oldBook.genre}</span>
                              </div>
                              <div className="bg-gray-800/50 p-1.5 rounded col-span-2">
                                <span className="text-gray-400">Created:</span> <span className="text-white">{new Date(pair.oldBook.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            {pair.oldBook.description && (
                              <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{pair.oldBook.description}</p>
                            )}
                          </div>
                        </div>

                        {!oldHidden && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleHideOld(pair.oldBook.id); }}
                            disabled={processingIds.has(pair.oldBook.id)}
                            className="w-full mt-4 py-2.5 bg-red-900/50 hover:bg-red-800 text-red-200 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                            data-testid={`button-hide-old-${pair.oldBook.id}`}
                          >
                            {processingIds.has(pair.oldBook.id) ? 'Hiding...' : `Hide Old Version (Book #${pair.oldBook.id})`}
                          </button>
                        )}
                      </div>

                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xs px-2 py-1 bg-green-900/60 text-green-300 rounded font-bold">NEW REWRITE (Draft)</span>
                          <span className="text-xs text-gray-500">Draft #{pair.newDraft.id}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${pair.newDraft.status === 'ready' ? 'bg-amber-900/50 text-amber-300' : 'bg-gray-700 text-gray-300'}`}>
                            {pair.newDraft.status}
                          </span>
                        </div>

                        <div className="flex gap-4">
                          {pair.newDraft.coverUrl ? (
                            <img
                              src={optimizedSrc(pair.newDraft.coverUrl, 200)}
                              alt={pair.newDraft.title}
                              className="w-28 h-40 object-cover rounded-lg shadow-lg flex-shrink-0 ring-2 ring-green-700"
                              data-testid={`img-new-cover-${pair.newDraft.id}`}
                            />
                          ) : (
                            <div className="w-28 h-40 bg-gray-800 rounded-lg flex items-center justify-center text-xs text-gray-500 flex-shrink-0">
                              No Cover Yet
                            </div>
                          )}
                          <div className="flex-1 min-w-0 space-y-2">
                            <h3 className="text-sm font-bold text-white leading-tight" data-testid={`text-new-title-${pair.newDraft.id}`}>
                              {pair.newDraft.title}
                            </h3>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              <div className="bg-gray-800/50 p-1.5 rounded">
                                <span className="text-gray-400">Price:</span> <span className="text-white">${pair.newDraft.suggestedPrice || 'TBD'}</span>
                              </div>
                              <div className="bg-gray-800/50 p-1.5 rounded">
                                <span className="text-gray-400">Words:</span> <span className="text-white font-semibold text-green-400">{pair.newDraft.wordCount.toLocaleString()}</span>
                              </div>
                              <div className="bg-gray-800/50 p-1.5 rounded">
                                <span className="text-gray-400">Chapters:</span> <span className="text-white">{pair.newDraft.chapterCount}</span>
                              </div>
                              <div className="bg-gray-800/50 p-1.5 rounded">
                                <span className="text-gray-400">Genre:</span> <span className="text-white">{pair.newDraft.genre}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {pair.newDraft.chapters.length > 0 && (
                          <div className="mt-3">
                            <h4 className="text-xs font-semibold text-amber-400 mb-1">Chapters ({pair.newDraft.chapterCount}):</h4>
                            <ul className="text-xs text-gray-300 space-y-0.5 max-h-32 overflow-y-auto">
                              {pair.newDraft.chapters.map((ch, i) => (
                                <li key={i} className="bg-gray-800/30 p-1 px-2 rounded truncate">{ch}</li>
                              ))}
                              {pair.newDraft.chapterCount > 20 && (
                                <li className="text-gray-500 italic p-1">... and {pair.newDraft.chapterCount - 20} more</li>
                              )}
                            </ul>
                          </div>
                        )}

                        {pair.newDraft.excerpt && (
                          <div className="mt-3">
                            <h4 className="text-xs font-semibold text-purple-400 mb-1">Content Preview:</h4>
                            <p className="text-xs text-gray-400 leading-relaxed bg-gray-800/30 p-2 rounded max-h-24 overflow-y-auto whitespace-pre-wrap">
                              {pair.newDraft.excerpt}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 p-4 bg-gray-900/60 rounded-xl border border-gray-800 text-sm text-gray-400">
          <p className="font-semibold text-gray-300 mb-2">How this works:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Each row shows an <span className="text-red-400">old published version</span> next to its <span className="text-green-400">new rewrite</span></li>
            <li>The new rewrite can't publish because a book with the same title already exists in the store</li>
            <li>Click "Hide Old Version" to remove the old one from the store — the new rewrite will then publish on the next bulk publish cycle</li>
            <li>Hidden books aren't deleted — they're just no longer visible to customers</li>
          </ul>
        </div>
      </div>
    </div>
  );
}