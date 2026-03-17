import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Loader2, AlertTriangle, Globe, FileText,
  ExternalLink, Hash, Server, Link2, ShieldAlert, Newspaper
} from "lucide-react";

const TYPE_ICONS: Record<string, any> = {
  ip: Server,
  url: Link2,
  domain: Globe,
  hash_md5: Hash,
  hash_sha1: Hash,
  hash_sha256: Hash,
  cve: ShieldAlert,
};

export default function Lookup() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any>(null);

  const lookupMut = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("GET", `/api/lookup?query=${encodeURIComponent(q)}`);
      return res.json();
    },
    onSuccess: (data) => setResults(data),
    onError: (e: any) => toast({ title: "Lookup failed", description: e.message, variant: "destructive" }),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    lookupMut.mutate(query.trim());
  };

  const TypeIcon = results?.type ? (TYPE_ICONS[results.type] || Search) : Search;

  return (
    <div className="space-y-5" data-testid="lookup-page">
      <div className="text-center">
        <h1 className="text-xl font-semibold">IOC Lookup</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Search any indicator — IP, domain, URL, hash, or CVE. If not found locally, we search top security news.
        </p>
      </div>

      {/* Centered, rounded search box like Google */}
      <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter IP, domain, URL, hash, or CVE..."
          className="w-full pl-12 pr-28 py-3.5 rounded-full border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow font-mono-ioc"
          data-testid="lookup-input"
        />
        <button
          type="submit"
          disabled={lookupMut.isPending || !query.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          data-testid="lookup-submit"
        >
          {lookupMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          Search
        </button>
      </form>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="rounded border border-border bg-card p-4 flex items-center gap-3 glow-card">
            <div className="w-10 h-10 rounded bg-primary/10 flex items-center justify-center">
              <TypeIcon size={18} className="text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Detected type: <span className="text-primary font-medium">{results.type}</span></div>
              <div className="text-sm font-mono-ioc mt-0.5 truncate max-w-lg">{results.query}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-lg font-bold tabular-nums">{results.total}</div>
              <div className="text-[10px] text-muted-foreground">local matches</div>
            </div>
          </div>

          {/* Local results */}
          {results.results?.length > 0 && (
            <div className="rounded border border-border bg-card p-5">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText size={14} className="text-primary" />
                Database Matches ({results.total})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="text-left py-2 pr-3 font-medium">Value</th>
                      <th className="text-left py-2 pr-3 font-medium">Source</th>
                      <th className="text-left py-2 pr-3 font-medium">Severity</th>
                      <th className="text-left py-2 pr-3 font-medium">Confidence</th>
                      <th className="text-left py-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.results.slice(0, 20).map((ind: any, i: number) => (
                      <tr key={i} className="border-b border-border/50 last:border-0">
                        <td className="py-2 pr-3 font-mono-ioc truncate max-w-[200px]" title={ind.value}>{ind.value}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{ind.source}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            ind.severity === "critical" ? "bg-red-500/10 text-red-400" :
                            ind.severity === "high" ? "bg-amber-500/10 text-amber-400" :
                            ind.severity === "medium" ? "bg-primary/10 text-primary" :
                            "bg-emerald-500/10 text-emerald-400"
                          }`}>
                            {ind.severity}
                          </span>
                        </td>
                        <td className="py-2 pr-3 tabular-nums">{ind.confidence}%</td>
                        <td className="py-2 text-muted-foreground text-xs truncate max-w-[200px]">{ind.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* News results */}
          {results.news?.length > 0 && (
            <div className="rounded border border-primary/20 bg-card p-5 glow-card">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Newspaper size={14} className="text-primary" />
                News & Community Results
                <span className="text-xs text-muted-foreground font-normal">
                  — Not found in local DB, showing results from HackerNews & Reddit
                </span>
              </h3>
              <div className="grid gap-3">
                {results.news.map((n: any, i: number) => (
                  <a
                    key={i}
                    href={n.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 rounded border border-border hover:border-primary/30 hover:bg-accent/30 transition-colors group"
                    data-testid={`news-result-${i}`}
                  >
                    <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      {n.source?.includes("Reddit") ? <Globe size={14} className="text-primary" /> : <Newspaper size={14} className="text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">{n.title}</div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span>{n.source}</span>
                        {n.points != null && <span>{n.points} pts</span>}
                        {n.comments != null && <span>{n.comments} comments</span>}
                        {n.date && <span>{new Date(n.date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <ExternalLink size={14} className="text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* No results at all */}
          {results.total === 0 && (!results.news || results.news.length === 0) && (
            <div className="rounded border border-border bg-card p-8 text-center">
              <AlertTriangle size={24} className="text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-medium mb-1">No results found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                "{results.query}" was not found in local IOC database or security news platforms.
                Try fetching feeds first or check the indicator format.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!results && !lookupMut.isPending && (
        <div className="rounded border border-border bg-card p-10 text-center max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Search size={24} className="text-primary" />
          </div>
          <h3 className="text-sm font-semibold mb-2">Search Any IOC</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Enter an IP address, domain, URL, file hash (MD5/SHA1/SHA256), or CVE ID.
            Results are checked against all loaded feeds. If no match is found, we
            automatically search HackerNews, Reddit security communities, and other platforms.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {["8.8.8.8", "CVE-2024-1234", "example.com", "d41d8cd98f00b204e9800998ecf8427e"].map((ex) => (
              <button
                key={ex}
                onClick={() => { setQuery(ex); lookupMut.mutate(ex); }}
                className="px-2.5 py-1 rounded-full border border-border text-[11px] font-mono-ioc text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                data-testid={`example-${ex}`}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
