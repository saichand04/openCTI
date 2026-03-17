import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/App";
import { Skeleton } from "@/components/ui/skeleton";
import type { Feed } from "@shared/schema";
import {
  Rss, RefreshCw, Check, X, AlertCircle, Clock, Plus,
  Trash2, ExternalLink, Loader2
} from "lucide-react";

const STATUS_MAP: Record<string, { icon: any; cls: string; label: string }> = {
  success: { icon: Check, cls: "text-emerald-400", label: "Active" },
  error: { icon: AlertCircle, cls: "text-red-400", label: "Error" },
  fetching: { icon: RefreshCw, cls: "text-amber-400 animate-spin", label: "Fetching" },
  idle: { icon: Clock, cls: "text-muted-foreground", label: "Idle" },
};

export default function Feeds() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [newFeed, setNewFeed] = useState({ name: "", url: "", category: "mixed", description: "" });

  const { data: feeds, isLoading } = useQuery<Feed[]>({ queryKey: ["/api/feeds"] });

  const toggleMut = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/feeds/${id}/toggle`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/feeds"] }),
  });

  const fetchOneMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/feeds/${id}/fetch`),
    onSuccess: async (res) => {
      const d = await res.json();
      toast({ title: "Feed fetched", description: `${d.count} IOCs loaded` });
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (e: any) => toast({ title: "Fetch failed", description: e.message, variant: "destructive" }),
  });

  const addFeedMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/feeds", newFeed),
    onSuccess: async (res) => {
      const feed = await res.json();
      toast({ title: "Feed added", description: `${feed.name} is ready to fetch` });
      setNewFeed({ name: "", url: "", category: "mixed", description: "" });
      setShowAdd(false);
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteFeedMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/feeds/${id}`),
    onSuccess: () => {
      toast({ title: "Feed removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
    },
  });

  const fetchAllMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/feeds/fetch-all"),
    onSuccess: async (res) => {
      const d = await res.json();
      toast({ title: "All feeds refreshed", description: `${d.results?.filter((r: any) => r.status === "success").length} succeeded` });
      queryClient.invalidateQueries({ queryKey: ["/api/feeds"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-7 w-48" />
        <div className="grid gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="feeds-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Threat Feeds</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{feeds?.length || 0} sources configured</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === "admin" && (
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-medium hover:bg-accent transition-colors"
              data-testid="add-feed-btn"
            >
              <Plus size={14} /> Add Feed
            </button>
          )}
          <button
            onClick={() => fetchAllMut.mutate()}
            disabled={fetchAllMut.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            data-testid="fetch-all-feeds"
          >
            <RefreshCw size={14} className={fetchAllMut.isPending ? "animate-spin" : ""} />
            Fetch All
          </button>
        </div>
      </div>

      {/* Add feed form */}
      {showAdd && (
        <div className="rounded border border-primary/30 bg-card p-5 glow-card">
          <h3 className="text-sm font-semibold mb-3">Add New Feed</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Feed Name</label>
              <input
                value={newFeed.name}
                onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                placeholder="e.g. AlienVault OTX"
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-feed-name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Feed URL</label>
              <input
                value={newFeed.url}
                onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                placeholder="https://example.com/feed.txt"
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-feed-url"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
              <select
                value={newFeed.category}
                onChange={(e) => setNewFeed({ ...newFeed, category: e.target.value })}
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="select-feed-category"
              >
                <option value="ip">IP Addresses</option>
                <option value="url">URLs</option>
                <option value="domain">Domains</option>
                <option value="hash_sha256">SHA256 Hashes</option>
                <option value="hash_md5">MD5 Hashes</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <input
                value={newFeed.description}
                onChange={(e) => setNewFeed({ ...newFeed, description: e.target.value })}
                placeholder="Optional description"
                className="w-full px-3 py-2 rounded border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-feed-desc"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={() => addFeedMut.mutate()}
              disabled={addFeedMut.isPending || !newFeed.name || !newFeed.url}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              data-testid="submit-add-feed"
            >
              {addFeedMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add Feed
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Feed list */}
      <div className="grid gap-3">
        {feeds?.map((feed) => {
          const st = STATUS_MAP[feed.status] || STATUS_MAP.idle;
          const StIcon = st.icon;
          return (
            <div
              key={feed.id}
              className="rounded border border-border bg-card p-4 flex items-center gap-4 group hover:border-primary/20 transition-colors"
              data-testid={`feed-${feed.slug}`}
            >
              <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center shrink-0">
                <Rss size={16} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{feed.name}</span>
                  {feed.isCustom && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">Custom</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{feed.description || feed.url}</div>
                {feed.errorMessage && (
                  <div className="text-xs text-red-400 mt-0.5 truncate">{feed.errorMessage}</div>
                )}
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium tabular-nums">{feed.iocCount.toLocaleString()}</div>
                  <div className="text-[10px] text-muted-foreground">IOCs</div>
                </div>
                <div className="flex items-center gap-1">
                  <StIcon size={14} className={st.cls} />
                  <span className={`text-xs ${st.cls}`}>{st.label}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => toggleMut.mutate(feed.id)}
                    className={`p-1.5 rounded-md text-xs ${feed.enabled ? "text-emerald-400 hover:bg-emerald-500/10" : "text-muted-foreground hover:bg-accent"}`}
                    title={feed.enabled ? "Disable" : "Enable"}
                    data-testid={`toggle-feed-${feed.id}`}
                  >
                    {feed.enabled ? <Check size={14} /> : <X size={14} />}
                  </button>
                  <button
                    onClick={() => fetchOneMut.mutate(feed.id)}
                    disabled={fetchOneMut.isPending}
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Fetch now"
                    data-testid={`fetch-feed-${feed.id}`}
                  >
                    <RefreshCw size={14} />
                  </button>
                  {feed.isCustom && user?.role === "admin" && (
                    <button
                      onClick={() => deleteFeedMut.mutate(feed.id)}
                      className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10"
                      title="Delete feed"
                      data-testid={`delete-feed-${feed.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <a
                    href={feed.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    title="Open feed URL"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
