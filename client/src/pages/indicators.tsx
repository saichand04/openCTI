import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Database, Search, Filter, ChevronLeft, ChevronRight,
  Server, Globe, Link2, Hash, ShieldAlert
} from "lucide-react";
import type { Indicator } from "@shared/schema";

const TYPE_ICONS: Record<string, any> = {
  ip: Server,
  url: Link2,
  domain: Globe,
  hash_md5: Hash,
  hash_sha1: Hash,
  hash_sha256: Hash,
  cve: ShieldAlert,
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400",
  high: "bg-amber-500/10 text-amber-400",
  medium: "bg-primary/10 text-primary",
  low: "bg-emerald-500/10 text-emerald-400",
};

export default function Indicators() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sevFilter, setSevFilter] = useState("");
  const [page, setPage] = useState(0);
  const limit = 30;

  const queryParams = new URLSearchParams();
  queryParams.set("limit", String(limit));
  queryParams.set("offset", String(page * limit));
  if (search) queryParams.set("search", search);
  if (typeFilter) queryParams.set("type", typeFilter);
  if (sevFilter) queryParams.set("severity", sevFilter);

  const { data, isLoading } = useQuery<{ items: Indicator[]; total: number }>({
    queryKey: ["/api/indicators", `?${queryParams.toString()}`],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/indicators?${queryParams.toString()}`);
      return res.json();
    },
  });

  const totalPages = Math.ceil((data?.total || 0) / limit);

  return (
    <div className="space-y-5" data-testid="indicators-page">
      <div>
        <h1 className="text-xl font-semibold">Indicators of Compromise</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {data?.total?.toLocaleString() || "0"} IOCs across all feeds
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Filter IOCs..."
            className="w-full pl-9 pr-3 py-2 rounded border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            data-testid="ioc-search"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-muted-foreground" />
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
            className="px-2.5 py-2 rounded border border-border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            data-testid="filter-type"
          >
            <option value="">All Types</option>
            <option value="ip">IP</option>
            <option value="url">URL</option>
            <option value="domain">Domain</option>
            <option value="hash_sha256">SHA256</option>
            <option value="hash_md5">MD5</option>
            <option value="hash_sha1">SHA1</option>
          </select>
          <select
            value={sevFilter}
            onChange={(e) => { setSevFilter(e.target.value); setPage(0); }}
            className="px-2.5 py-2 rounded border border-border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            data-testid="filter-severity"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10 rounded" />)}
        </div>
      ) : data?.items?.length ? (
        <div className="rounded border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border bg-muted/20">
                  <th className="text-left py-2.5 px-4 font-medium">Type</th>
                  <th className="text-left py-2.5 px-4 font-medium">Value</th>
                  <th className="text-left py-2.5 px-4 font-medium">Source</th>
                  <th className="text-left py-2.5 px-4 font-medium">Severity</th>
                  <th className="text-left py-2.5 px-4 font-medium">Confidence</th>
                  <th className="text-left py-2.5 px-4 font-medium">Tags</th>
                  <th className="text-left py-2.5 px-4 font-medium">First Seen</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((ind) => {
                  const TIcon = TYPE_ICONS[ind.type] || Database;
                  return (
                    <tr key={ind.id} className="border-b border-border/50 last:border-0 hover:bg-accent/30 transition-colors" data-testid={`ioc-row-${ind.id}`}>
                      <td className="py-2 px-4">
                        <div className="flex items-center gap-1.5">
                          <TIcon size={13} className="text-primary" />
                          <span className="text-[11px] font-medium">{ind.type}</span>
                        </div>
                      </td>
                      <td className="py-2 px-4 font-mono-ioc truncate max-w-[220px]" title={ind.value}>{ind.value}</td>
                      <td className="py-2 px-4 text-muted-foreground text-xs">{ind.source}</td>
                      <td className="py-2 px-4">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SEVERITY_BADGE[ind.severity] || ""}`}>
                          {ind.severity}
                        </span>
                      </td>
                      <td className="py-2 px-4 tabular-nums text-xs">{ind.confidence}%</td>
                      <td className="py-2 px-4">
                        {ind.tags?.slice(0, 2).map((t, i) => (
                          <span key={i} className="inline-block mr-1 px-1.5 py-0.5 rounded text-[10px] bg-accent text-muted-foreground">{t}</span>
                        ))}
                      </td>
                      <td className="py-2 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {ind.firstSeen ? new Date(ind.firstSeen).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
            <span>
              Showing {page * limit + 1}–{Math.min((page + 1) * limit, data.total)} of {data.total.toLocaleString()}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 transition-colors"
                data-testid="prev-page"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 tabular-nums">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 transition-colors"
                data-testid="next-page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded border border-border bg-card p-10 text-center">
          <Database size={24} className="text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-medium mb-1">No indicators found</h3>
          <p className="text-xs text-muted-foreground">
            {search || typeFilter || sevFilter
              ? "Try adjusting your filters."
              : "Fetch feeds from the Feeds page to load threat data."}
          </p>
        </div>
      )}
    </div>
  );
}
