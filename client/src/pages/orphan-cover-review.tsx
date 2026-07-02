import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface OrphanResponse {
  orphaned: string[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export default function OrphanCoverReview() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [rescued, setRescued] = useState<Set<string>>(new Set());
  const [adminToken, setAdminToken] = useState(localStorage.getItem("ebgz_admin_token") || "");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState(false);

  const needsLogin = !adminToken || authError;

  const handleLogin = async () => {
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem("ebgz_admin_token", data.token);
        setAdminToken(data.token);
        setAuthError(false);
        setPasswordInput("");
      } else {
        setAuthError(true);
      }
    } catch {
      setAuthError(true);
    }
  };

  const { data, isLoading, error, refetch } = useQuery<OrphanResponse>({
    queryKey: ["/api/admin/orphaned-covers", page, adminToken],
    queryFn: async () => {
      const res = await fetch(`/api/admin/orphaned-covers?page=${page}&perPage=50`, {
        headers: { "x-admin-token": adminToken },
      });
      if (res.status === 401) {
        setAuthError(true);
        throw new Error("Unauthorized");
      }
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!adminToken && !authError,
    retry: false,
  });

  const rescueMutation = useMutation({
    mutationFn: async (filenames: string[]) => {
      const res = await fetch("/api/admin/rescue-covers", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ filenames }),
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Rescued ${data.rescued} covers`, description: `${data.remaining} orphans remaining` });
      setRescued(new Set());
      refetch();
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: async (filenames: string[]) => {
      const res = await fetch("/api/admin/delete-specific-orphans", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken },
        body: JSON.stringify({ filenames }),
      });
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: `Deleted ${result.deleted} covers from this page`, description: `${result.remaining} orphans remaining` });
      setRescued(new Set());
      refetch();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/delete-orphaned-covers", {
        method: "DELETE",
        headers: { "x-admin-token": adminToken },
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Deleted ${data.deleted} orphaned covers`, description: `${data.failed} failed` });
      refetch();
    },
  });

  const handleDeleteRestOnPage = () => {
    if (!data?.orphaned) return;
    const toDelete = data.orphaned.filter(f => !rescued.has(f));
    if (toDelete.length === 0) {
      toast({ title: "Nothing to delete", description: "All covers on this page are marked as KEEP" });
      return;
    }
    const msg = rescued.size > 0
      ? `Keep ${rescued.size} cover(s) and delete ${toDelete.length} cover(s) from this page?`
      : `Delete all ${toDelete.length} cover(s) on this page?`;
    if (confirm(msg)) {
      if (rescued.size > 0) {
        rescueMutation.mutate([...rescued], {
          onSuccess: () => {
            deletePageMutation.mutate(toDelete);
          }
        });
      } else {
        deletePageMutation.mutate(toDelete);
      }
    }
  };

  const toggleRescue = (filename: string) => {
    setRescued(prev => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  if (needsLogin) {
    return (
      <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center text-white">
        <div className="bg-white/5 border border-white/10 rounded-lg p-8 w-full max-w-md">
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: "Cinzel, serif" }}>Admin Login</h2>
          <p className="text-gray-400 mb-4">Enter admin password to review orphaned covers.</p>
          <div className="flex gap-2">
            <Input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              placeholder="Admin password"
              className="bg-white/10 border-white/20 text-white"
              data-testid="input-admin-password"
            />
            <Button onClick={handleLogin} data-testid="button-login">Login</Button>
          </div>
          {authError && <p className="text-red-400 text-sm mt-2">Invalid password. Try again.</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "Cinzel, serif" }}>
              Orphaned Cover Review
            </h1>
            <p className="text-gray-400 mt-1">
              {data ? `${data.total} covers not referenced by any book — click to mark as KEEP` : "Loading..."}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleDeleteRestOnPage}
              className="bg-amber-600 hover:bg-amber-700"
              disabled={deletePageMutation.isPending || rescueMutation.isPending || !data?.orphaned?.length}
              data-testid="button-delete-rest-page"
            >
              {rescued.size > 0
                ? `Keep ${rescued.size}, Delete ${(data?.orphaned?.length || 0) - rescued.size} on Page`
                : `Delete All ${data?.orphaned?.length || 0} on Page`}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm(`Delete ALL ${data?.total || 0} remaining orphaned covers across ALL pages? This cannot be undone.`)) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending || !data?.total}
              data-testid="button-delete-all-orphans"
            >
              Delete ALL Orphans ({data?.total || 0})
            </Button>
            <a href="/admin">
              <Button variant="outline" data-testid="link-back-admin">Back to Admin</Button>
            </a>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400">Loading covers...</div>
        ) : !data?.orphaned.length ? (
          <div className="text-center py-20 text-gray-400">No orphaned covers found.</div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {data.orphaned.map((filename) => (
                <div
                  key={filename}
                  className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                    rescued.has(filename) ? "border-green-500 ring-2 ring-green-500/50" : "border-transparent hover:border-amber-500/50"
                  }`}
                  onClick={() => toggleRescue(filename)}
                  data-testid={`cover-${filename}`}
                >
                  <img
                    src={`/uploads/covers/${filename}`}
                    alt={filename}
                    className="w-full aspect-[2/3] object-cover bg-gray-800"
                    loading="lazy"
                  />
                  {rescued.has(filename) && (
                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                      <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        KEEP
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-gray-300 truncate">{filename}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4 mt-8 pb-8">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                data-testid="button-prev-page"
              >
                Previous
              </Button>
              <span className="text-gray-400">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                data-testid="button-next-page"
              >
                Next
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
