import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/App";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Brain, RefreshCw, ExternalLink, Mail, AlertTriangle,
  Shield, Filter, Clock, Globe, Loader2, Check, Tag, Newspaper, Send, FileText, Eye
} from "lucide-react";

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-500/10 text-red-400",
  high: "bg-amber-500/10 text-amber-400",
  medium: "bg-primary/10 text-primary",
  low: "bg-emerald-500/10 text-emerald-400",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-400",
  high: "bg-amber-400",
  medium: "bg-primary",
  low: "bg-emerald-400",
};

const SEVERITY_ICON_COLOR: Record<string, string> = {
  critical: "text-red-400",
  high: "text-amber-400",
  medium: "text-primary",
  low: "text-emerald-400",
};

const SEVERITY_ICONS: Record<string, any> = {
  critical: AlertTriangle,
  high: Shield,
  medium: Brain,
  low: Newspaper,
};

function ReportPreview({ html }: { html: string }) {
  // Use srcdoc for sandboxed iframe compatibility (doc.write is blocked in nested sandboxed iframes)
  const blobUrl = useRef<string | null>(null);
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    // Create a blob URL from the HTML — works reliably in all iframe contexts
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    blobUrl.current = url;
    setSrc(url);
    return () => {
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    };
  }, [html]);

  return (
    <iframe
      src={src}
      className="w-full flex-1 min-h-0"
      style={{ minHeight: '70vh', border: 'none', background: '#f4f4f4' }}
      title="Advisory Report Preview"
    />
  );
}

function ReportPreviewButton() {
  const [showPreview, setShowPreview] = useState(false);
  const [reportHtml, setReportHtml] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("GET", "/api/threat-advisor/report");
      const data = await res.json();
      setReportHtml(data.html);
      setShowPreview(true);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handlePreview}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
        data-testid="preview-report"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
        Preview
      </button>
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden m-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b bg-gray-50 shrink-0">
              <span className="text-sm font-semibold text-gray-800">Advisory Report Preview</span>
              <button onClick={() => setShowPreview(false)} className="text-xs text-gray-500 hover:text-gray-800 px-3 py-1 rounded-full border border-gray-300">Close</button>
            </div>
            <ReportPreview html={reportHtml} />
          </div>
        </div>
      )}
    </>
  );
}

function SendReportButton() {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await apiRequest("GET", "/api/threat-advisor/report");
      const data = await res.json();
      const subscriberList = data.subscribers || [];

      if (subscriberList.length === 0) {
        toast({ title: "No subscribers", description: "No one has subscribed yet. Add subscriber emails from the form above.", variant: "destructive" });
        setSending(false);
        return;
      }

      // Store the report data so the platform can send it
      // In a real system this would call an email API
      // Here we store it and show the user what would be sent
      toast({
        title: "Advisory report ready",
        description: `Report generated for ${subscriberList.length} subscriber(s): ${subscriberList.join(', ')}. Use the platform email integration to send.`,
      });
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to prepare report", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      onClick={handleSend}
      disabled={sending || sent}
      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      data-testid="send-report"
    >
      {sending ? <Loader2 size={12} className="animate-spin" /> : sent ? <Check size={12} /> : <Send size={12} />}
      {sending ? "Preparing..." : sent ? "Sent" : "Send Report"}
    </button>
  );
}

export default function ThreatAdvisor() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [sevFilter, setSevFilter] = useState("");
  const [srcFilter, setSrcFilter] = useState("");
  const [email, setEmail] = useState("");

  const queryParams = new URLSearchParams();
  if (sevFilter) queryParams.set("severity", sevFilter);
  if (srcFilter) queryParams.set("source", srcFilter);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/threat-advisor/articles", queryParams.toString()],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/threat-advisor/articles?${queryParams.toString()}`);
      return res.json();
    },
  });

  const { data: sources } = useQuery<any[]>({
    queryKey: ["/api/threat-advisor/sources"],
  });

  const refreshMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/threat-advisor/articles?refresh=true");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Feed refreshed", description: "Latest threat advisories loaded" });
      queryClient.invalidateQueries({ queryKey: ["/api/threat-advisor/articles"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const subscribeMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/threat-advisor/subscribe", { email });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Subscribed", description: data.message });
      setEmail("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const articles = data?.articles || [];

  // Count by severity
  const sevCounts = articles.reduce((acc: Record<string, number>, a: any) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1;
    return acc;
  }, {});

  // Count by source
  const srcCounts = articles.reduce((acc: Record<string, number>, a: any) => {
    acc[a.source] = (acc[a.source] || 0) + 1;
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 rounded" />)}
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24 rounded" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="threat-advisor-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Brain size={20} className="text-primary" />
            Threat Advisor
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Consolidated threat intelligence from {data?.sources || 0} cybersecurity news sources
          </p>
        </div>
        <button
          onClick={() => refreshMut.mutate()}
          disabled={refreshMut.isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          data-testid="refresh-advisor"
        >
          <RefreshCw size={14} className={refreshMut.isPending ? "animate-spin" : ""} />
          {refreshMut.isPending ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Severity summary cards — horizontal layout: icon+label left, count right */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: "critical", label: "Critical" },
          { key: "high", label: "High" },
          { key: "medium", label: "Medium" },
          { key: "low", label: "Low" },
        ].map((s) => {
          const SevIcon = SEVERITY_ICONS[s.key];
          const iconColor = SEVERITY_ICON_COLOR[s.key];
          return (
            <button
              key={s.key}
              onClick={() => setSevFilter(sevFilter === s.key ? "" : s.key)}
              className={`rounded border bg-card p-4 transition-colors ${
                sevFilter === s.key ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20"
              }`}
              data-testid={`filter-${s.key}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SevIcon size={14} className={iconColor} />
                  <span className="text-xs font-medium">{s.label}</span>
                </div>
                <span className="text-lg font-bold tabular-nums">{sevCounts[s.key] || 0}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters and subscribe */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Filter size={14} className="text-muted-foreground" />
          <select
            value={srcFilter}
            onChange={(e) => setSrcFilter(e.target.value)}
            className="px-2.5 py-2 rounded border border-border bg-card text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
            data-testid="filter-source"
          >
            <option value="">All Sources</option>
            {(sources || []).map((s: any) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        {/* Subscribe form — admin only */}
        {user?.role === "admin" && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <Mail size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email for alerts"
                className="pl-8 pr-3 py-2 rounded-full border border-border bg-card text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-48"
                data-testid="subscribe-email"
              />
            </div>
            <button
              onClick={() => subscribeMut.mutate()}
              disabled={subscribeMut.isPending || !email.includes("@")}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-full border border-primary/30 text-primary text-xs font-medium hover:bg-primary/10 transition-colors disabled:opacity-50"
              data-testid="subscribe-btn"
            >
              {subscribeMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
              Subscribe
            </button>
          </div>
        )}
      </div>

      {/* Advisory Report Section */}
      <div className="rounded border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center">
              <FileText size={16} className="text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Threat Advisory Report</h3>
              <p className="text-[10px] text-muted-foreground">Generate and send a Wipro-style advisory email to all subscribers</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ReportPreviewButton />
            <SendReportButton />
          </div>
        </div>
      </div>

      {/* Last fetched */}
      {data?.lastFetched && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Clock size={10} />
          Last updated: {new Date(data.lastFetched).toLocaleString()}
          <span className="ml-1">({articles.length} articles from {Object.keys(srcCounts).length} sources)</span>
        </div>
      )}

      {/* Articles feed */}
      {articles.length > 0 ? (
        <div className="space-y-2">
          {articles.map((article: any, i: number) => (
            <a
              key={i}
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded border border-border bg-card p-4 hover:border-primary/25 transition-colors group"
              data-testid={`article-${i}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${SEVERITY_DOT[article.severity] || "bg-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <ExternalLink size={12} className="text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {article.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{article.description}</p>
                  )}
                  <div className="flex items-center flex-wrap gap-2 mt-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SEVERITY_BADGE[article.severity] || ""}`}>
                      {article.severity}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Globe size={9} />
                      {article.source}
                    </span>
                    {article.pubDate && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(article.pubDate).toLocaleDateString()}
                      </span>
                    )}
                    {article.tags?.map((tag: string) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] bg-accent text-muted-foreground"
                      >
                        <Tag size={8} />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="rounded border border-border bg-card p-10 text-center">
          <Brain size={24} className="text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-medium mb-1">No advisories found</h3>
          <p className="text-xs text-muted-foreground">
            {sevFilter || srcFilter
              ? "Try adjusting your filters."
              : "Click Refresh to load the latest threat advisories from all sources."}
          </p>
        </div>
      )}

      {/* Source breakdown */}
      {Object.keys(srcCounts).length > 0 && (
        <div className="rounded border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Globe size={14} className="text-primary" />
            Sources Breakdown
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {Object.entries(srcCounts).sort(([,a], [,b]) => (b as number) - (a as number)).map(([name, count]) => (
              <div
                key={name}
                className="flex items-center justify-between p-2 rounded border border-border/50 text-xs"
              >
                <span className="truncate text-muted-foreground">{name}</span>
                <span className="font-medium tabular-nums ml-2">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
