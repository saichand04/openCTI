import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/App";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield, Database, Rss, AlertTriangle, RefreshCw, Activity,
  TrendingUp, TrendingDown, Search, Clock
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

// Mini sparkline SVG
function Sparkline({ data, color = "hsl(160 75% 45%)" }: { data: number[]; color?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const h = 32;
  const w = 80;
  const range = max - min || 1;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polygon points={areaPoints} fill={`${color}`} opacity="0.12" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="sparkline-path" />
    </svg>
  );
}

// KPI card
function KpiCard({ title, value, subtitle, sparkData, trend, icon: Icon, color }: {
  title: string; value: string | number; subtitle: string; sparkData: number[];
  trend?: { value: string; up: boolean }; icon: any; color?: string;
}) {
  return (
    <div className="rounded border border-border bg-card p-5 glow-card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-muted/60 flex items-center justify-center">
            <Icon size={16} className="text-muted-foreground" />
          </div>
          <div>
            <div className="text-xs font-medium text-foreground">{title}</div>
            <div className="text-[10px] text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        <Sparkline data={sparkData} color={color} />
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold tabular-nums">{value}</span>
        {trend && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${trend.up ? "text-emerald-500" : "text-red-400"}`}>
            {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "hsl(0 65% 55%)",
  high: "hsl(38 85% 55%)",
  medium: "hsl(160 75% 45%)",
  low: "hsl(200 70% 55%)",
};

// Sankey-style Attack Surface Threat Exposure
function SankeyChart({ stats }: { stats: any }) {
  const sev = stats?.bySeverity || {};
  const total = Object.values(sev).reduce((s: number, v: any) => s + (v as number), 0) as number;
  const critical = (sev.critical || 0) as number;
  const high = (sev.high || 0) as number;
  const low = (sev.low || 0) as number;
  const medium = (sev.medium || 0) as number;

  // Categories for right side
  const info = 0;
  const exploited = critical;
  const mediumCat = medium + high + low;

  const W = 700;
  const H = 220;
  const leftX = 30;
  const midX = W / 2 - 40;
  const rightX = W - 110;
  const boxW = 80;
  const boxH = 44;

  // Vertical positions
  const leftY = H / 2 - boxH / 2;
  const midYs = [20, H / 2 - boxH / 2, H - boxH - 20];
  const rightYs = [20, H / 2 - boxH / 2, H - boxH - 20];

  // Generate a curved path between two boxes
  function curvePath(x1: number, y1: number, h1: number, x2: number, y2: number, h2: number, thickness: number, offset1: number, offset2: number) {
    const startY = y1 + h1 / 2 + offset1 * 12;
    const endY = y2 + h2 / 2 + offset2 * 12;
    const cp1x = x1 + (x2 - x1) * 0.4;
    const cp2x = x1 + (x2 - x1) * 0.6;
    return `M ${x1} ${startY - thickness / 2}
            C ${cp1x} ${startY - thickness / 2}, ${cp2x} ${endY - thickness / 2}, ${x2} ${endY - thickness / 2}
            L ${x2} ${endY + thickness / 2}
            C ${cp2x} ${endY + thickness / 2}, ${cp1x} ${startY + thickness / 2}, ${x1} ${startY + thickness / 2} Z`;
  }

  const flowThickness = (val: number) => Math.max(2, Math.min(18, (val / Math.max(total, 1)) * 40));

  return (
    <div className="rounded border border-border bg-card p-5 glow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Attack Surface Threat Exposure</h2>
        <span className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">View more</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 220 }}>
        <defs>
          <linearGradient id="flow-grad-1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(200 80% 55%)" />
            <stop offset="100%" stopColor="hsl(340 70% 60%)" />
          </linearGradient>
          <linearGradient id="flow-grad-2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(340 70% 60%)" />
            <stop offset="100%" stopColor="hsl(270 65% 58%)" />
          </linearGradient>
        </defs>

        {/* Flows: left to mid */}
        <path d={curvePath(leftX + boxW, leftY, boxH, midX, midYs[0], boxH, flowThickness(critical), -1, 0)} fill="url(#flow-grad-1)" opacity="0.4" />
        <path d={curvePath(leftX + boxW, leftY, boxH, midX, midYs[1], boxH, flowThickness(high), 0, 0)} fill="url(#flow-grad-1)" opacity="0.35" />
        <path d={curvePath(leftX + boxW, leftY, boxH, midX, midYs[2], boxH, flowThickness(low), 1, 0)} fill="url(#flow-grad-1)" opacity="0.3" />

        {/* Flows: mid to right */}
        <path d={curvePath(midX + boxW, midYs[0], boxH, rightX, rightYs[0], boxH, flowThickness(mediumCat) * 0.6, 0, -0.5)} fill="url(#flow-grad-2)" opacity="0.35" />
        <path d={curvePath(midX + boxW, midYs[0], boxH, rightX, rightYs[2], boxH, flowThickness(exploited) * 0.5, 0, 0)} fill="url(#flow-grad-2)" opacity="0.3" />
        <path d={curvePath(midX + boxW, midYs[1], boxH, rightX, rightYs[0], boxH, flowThickness(mediumCat) * 0.4, 0, 0.5)} fill="url(#flow-grad-2)" opacity="0.3" />
        <path d={curvePath(midX + boxW, midYs[1], boxH, rightX, rightYs[1], boxH, flowThickness(info), 0, 0)} fill="url(#flow-grad-2)" opacity="0.25" />
        <path d={curvePath(midX + boxW, midYs[2], boxH, rightX, rightYs[0], boxH, flowThickness(low), 0, 0)} fill="url(#flow-grad-2)" opacity="0.25" />

        {/* Left box: Total Attack */}
        <rect x={leftX} y={leftY} width={boxW} height={boxH} rx="4" fill="hsl(200 80% 55%)" />
        <text x={leftX + boxW / 2} y={leftY + 18} textAnchor="middle" fill="white" fontSize="16" fontWeight="700">{total}</text>
        <text x={leftX + boxW / 2} y={leftY + 34} textAnchor="middle" fill="white" fontSize="9" opacity="0.85">Total Attack</text>

        {/* Mid boxes: Critical, High, Low */}
        {[
          { y: midYs[0], val: critical, label: "Critical", color: "hsl(340 70% 60%)" },
          { y: midYs[1], val: high, label: "High", color: "hsl(340 70% 60%)" },
          { y: midYs[2], val: low, label: "Low", color: "hsl(340 70% 60%)" },
        ].map((b) => (
          <g key={b.label}>
            <rect x={midX} y={b.y} width={boxW} height={boxH} rx="4" fill={b.color} />
            <text x={midX + boxW / 2} y={b.y + 18} textAnchor="middle" fill="white" fontSize="16" fontWeight="700">{b.val}</text>
            <text x={midX + boxW / 2} y={b.y + 34} textAnchor="middle" fill="white" fontSize="9" opacity="0.85">{b.label}</text>
          </g>
        ))}

        {/* Right boxes: Medium, Info, Exploited */}
        {[
          { y: rightYs[0], val: mediumCat, label: "Medium", color: "hsl(270 65% 58%)" },
          { y: rightYs[1], val: info, label: "Info", color: "hsl(270 65% 58%)" },
          { y: rightYs[2], val: exploited, label: "Exploited", color: "hsl(270 65% 58%)" },
        ].map((b) => (
          <g key={b.label}>
            <rect x={rightX} y={b.y} width={boxW} height={boxH} rx="4" fill={b.color} />
            <text x={rightX + boxW / 2} y={b.y + 18} textAnchor="middle" fill="white" fontSize="16" fontWeight="700">{b.val}</text>
            <text x={rightX + boxW / 2} y={b.y + 34} textAnchor="middle" fill="white" fontSize="9" opacity="0.85">{b.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboard/stats"],
  });

  const fetchAllMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/feeds/fetch-all"),
    onSuccess: async (res) => {
      const data = await res.json();
      const successes = data.results?.filter((r: any) => r.status === "success").length || 0;
      toast({ title: "Feeds refreshed", description: `${successes} of ${data.totalFeeds} feeds updated` });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-80 rounded lg:col-span-2" />
          <Skeleton className="h-80 rounded" />
        </div>
      </div>
    );
  }

  const sourceData = stats?.bySource
    ? Object.entries(stats.bySource).map(([name, count]) => ({ name: name.replace(/-/g, ' '), count }))
    : [];

  const sparkGen = (base: number) => Array.from({ length: 8 }, () => Math.max(0, base + Math.floor(Math.random() * base * 0.4 - base * 0.2)));

  const sevData = stats?.bySeverity
    ? Object.entries(stats.bySeverity).map(([name, value]) => ({ name, value, fill: SEVERITY_COLORS[name] || "hsl(155 6% 50%)" }))
    : [];

  return (
    <div className="space-y-5" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        {user?.role === "admin" && (
          <button
            onClick={() => fetchAllMut.mutate()}
            disabled={fetchAllMut.isPending}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            data-testid="fetch-all-btn"
          >
            <RefreshCw size={14} className={fetchAllMut.isPending ? "animate-spin" : ""} />
            {fetchAllMut.isPending ? "Fetching..." : "Fetch All Feeds"}
          </button>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total IOCs"
          value={stats?.totalIocs?.toLocaleString() || "0"}
          subtitle="All sources"
          sparkData={sparkGen(stats?.totalIocs || 100)}
          trend={{ value: "Active", up: true }}
          icon={Database}
          color="hsl(160 75% 45%)"
        />
        <KpiCard
          title="Active Sources"
          value={stats?.activeSources || 0}
          subtitle={`of ${stats?.totalFeeds || 0} feeds`}
          sparkData={sparkGen(stats?.activeSources || 5)}
          trend={{ value: `${stats?.enabledFeeds || 0} enabled`, up: true }}
          icon={Rss}
          color="hsl(200 70% 55%)"
        />
        <KpiCard
          title="Threat Level"
          value={stats?.bySeverity?.critical || 0}
          subtitle="Critical severity"
          sparkData={sparkGen(stats?.bySeverity?.critical || 10)}
          trend={{ value: "Critical", up: false }}
          icon={AlertTriangle}
          color="hsl(0 65% 55%)"
        />
        <KpiCard
          title="Searches"
          value={stats?.recentSearches?.length || 0}
          subtitle="Recent queries"
          sparkData={sparkGen(stats?.recentSearches?.length || 3)}
          icon={Search}
          color="hsl(280 60% 60%)"
        />
      </div>

      {/* Sankey chart */}
      <SankeyChart stats={stats} />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area chart */}
        <div className="rounded border border-border bg-card p-5 lg:col-span-2 glow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold">IOCs by Source</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Distribution across all active feeds</p>
            </div>
            <Activity size={16} className="text-muted-foreground" />
          </div>
          {sourceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={sourceData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(160 75% 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(160 75% 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(155 6% 50%)" }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(155 6% 50%)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(160 12% 8%)", border: "1px solid hsl(160 10% 13%)", borderRadius: "4px", fontSize: "12px", color: "hsl(155 12% 88%)" }}
                  labelStyle={{ color: "hsl(155 6% 50%)" }}
                />
                <Area type="monotone" dataKey="count" stroke="hsl(160 75% 45%)" fill="url(#areaGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-sm text-muted-foreground">
              Fetch feeds to see data
            </div>
          )}
        </div>

        {/* Severity pie */}
        <div className="rounded border border-border bg-card p-5 glow-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold">By Severity</h2>
              <p className="text-xs text-muted-foreground mt-0.5">IOC distribution</p>
            </div>
            <Shield size={16} className="text-muted-foreground" />
          </div>
          {sevData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={sevData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {sevData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(160 12% 8%)", border: "1px solid hsl(160 10% 13%)", borderRadius: "4px", fontSize: "12px", color: "#ffffff" }}
                    itemStyle={{ color: "#ffffff" }}
                    labelStyle={{ color: "#ffffff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-3 mt-2">
                {sevData.map((s) => (
                  <div key={s.name} className="flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.fill }} />
                    <span className="capitalize text-muted-foreground">{s.name}</span>
                    <span className="font-medium tabular-nums">{s.value as number}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
              No data yet
            </div>
          )}
        </div>
      </div>

      {/* Recent indicators */}
      <div className="rounded border border-border bg-card p-5 glow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Recent Indicators</h2>
          <Clock size={16} className="text-muted-foreground" />
        </div>
        {stats?.recentIndicators?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium">Value</th>
                  <th className="text-left py-2 pr-4 font-medium">Type</th>
                  <th className="text-left py-2 pr-4 font-medium">Source</th>
                  <th className="text-left py-2 pr-4 font-medium">Severity</th>
                  <th className="text-left py-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentIndicators.slice(0, 8).map((ind: any) => (
                  <tr key={ind.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4 font-mono-ioc truncate max-w-[240px]" title={ind.value}>{ind.value}</td>
                    <td className="py-2 pr-4">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">{ind.type}</span>
                    </td>
                    <td className="py-2 pr-4 text-muted-foreground">{ind.source}</td>
                    <td className="py-2 pr-4">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        ind.severity === "critical" ? "bg-red-500/10 text-red-400" :
                        ind.severity === "high" ? "bg-amber-500/10 text-amber-400" :
                        ind.severity === "medium" ? "bg-primary/10 text-primary" :
                        "bg-emerald-500/10 text-emerald-400"
                      }`}>
                        {ind.severity}
                      </span>
                    </td>
                    <td className="py-2 tabular-nums">{ind.confidence}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No indicators yet. Click "Fetch All Feeds" to load threat data.
          </div>
        )}
      </div>
    </div>
  );
}
