import { useState, useEffect } from "react";
import { useAuth } from "@/App";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Settings as SettingsIcon, Key, Shield, Database, Rss, Server,
  Copy, Check, Loader2, Trash2, RefreshCw
} from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();

  // API key state
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [otxKey, setOtxKey] = useState("");

  // Load API key
  useQuery({
    queryKey: ["/api/keys", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await apiRequest("GET", `/api/keys/${user.id}`);
      const data = await res.json();
      if (data.apiKey) setApiKey(data.apiKey);
      return data;
    },
    enabled: !!user?.id,
  });

  // Load settings
  const { data: settingsData } = useQuery<Record<string, any>>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings");
      return res.json();
    },
  });

  // Load system info
  const { data: systemInfo } = useQuery<any>({
    queryKey: ["/api/system/info"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/system/info");
      return res.json();
    },
  });

  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData);
      setOtxKey(settingsData.otxApiKey || "");
    }
  }, [settingsData]);

  const generateMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/keys/generate", { userId: user?.id || 1 });
      return res.json();
    },
    onSuccess: (data) => {
      setApiKey(data.apiKey);
      toast({ title: "API key generated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateSettingsMut = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const res = await apiRequest("PATCH", "/api/settings", updates);
      return res.json();
    },
    onSuccess: (data) => {
      setSettings(data);
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const purgeMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/purge");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Purge complete", description: `${data.purged} indicators removed` });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 2000);
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Shield size={32} className="text-muted-foreground mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-1">Admin Access Required</h2>
          <p className="text-sm text-muted-foreground">This page is only accessible to administrators.</p>
        </div>
      </div>
    );
  }

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto" data-testid="settings-page">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <SettingsIcon size={20} className="text-primary" />
          Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Platform configuration and administration</p>
      </div>

      {/* API Configuration */}
      <div className="rounded border border-border bg-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center">
            <Key size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">API Configuration</h2>
            <p className="text-[10px] text-muted-foreground">Manage your API key for v1 endpoints</p>
          </div>
        </div>
        {apiKey ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2.5 rounded border border-border bg-background font-mono-ioc text-xs truncate">
              {apiKey}
            </div>
            <button
              onClick={copyKey}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-full border border-border text-xs font-medium hover:bg-accent transition-colors shrink-0"
              data-testid="copy-key"
            >
              {keyCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {keyCopied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => generateMut.mutate()}
              disabled={generateMut.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-full border border-border text-xs font-medium hover:bg-accent transition-colors shrink-0"
            >
              <RefreshCw size={12} />
              Regenerate
            </button>
          </div>
        ) : (
          <button
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            data-testid="generate-key"
          >
            {generateMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
            Generate API Key
          </button>
        )}
      </div>

      {/* Authentication Providers */}
      <div className="rounded border border-border bg-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center">
            <Shield size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Authentication Providers</h2>
            <p className="text-[10px] text-muted-foreground">Enable or disable login methods</p>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { key: "authGoogle", label: "Google" },
            { key: "authGithub", label: "GitHub" },
            { key: "authMicrosoft", label: "Microsoft" },
            { key: "signupEnabled", label: "User Signup" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2">
              <span className="text-sm">{item.label}</span>
              <button
                onClick={() => updateSettingsMut.mutate({ [item.key]: !settings[item.key] })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  settings[item.key] ? "bg-primary" : "bg-muted"
                }`}
                data-testid={`toggle-${item.key}`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    settings[item.key] ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Data Retention */}
      <div className="rounded border border-border bg-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center">
            <Database size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Data Retention</h2>
            <p className="text-[10px] text-muted-foreground">Configure how long indicator data is retained</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {[3, 6, 12].map((months) => (
              <button
                key={months}
                onClick={() => updateSettingsMut.mutate({ dataRetentionMonths: months })}
                className={`px-4 py-2 rounded-full text-xs font-medium border transition-colors ${
                  settings.dataRetentionMonths === months
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent"
                }`}
                data-testid={`retention-${months}`}
              >
                {months === 12 ? "1 Year" : `${months} Months`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => purgeMut.mutate()}
              disabled={purgeMut.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors disabled:opacity-50"
              data-testid="purge-btn"
            >
              {purgeMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Purge Now
            </button>
          </div>
          {settings.lastPurge && (
            <p className="text-[10px] text-muted-foreground">Last purge: {new Date(settings.lastPurge).toLocaleString()}</p>
          )}
          {settings.nextPurge && (
            <p className="text-[10px] text-muted-foreground">Next scheduled: {new Date(settings.nextPurge).toLocaleString()}</p>
          )}
        </div>
      </div>

      {/* Feed Management */}
      <div className="rounded border border-border bg-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center">
            <Rss size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Feed Management</h2>
            <p className="text-[10px] text-muted-foreground">Configure threat feed API keys</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">AlienVault OTX API Key</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={otxKey}
                onChange={(e) => setOtxKey(e.target.value)}
                placeholder="OTX API Key"
                className="flex-1 px-3 py-2 rounded border border-border bg-background text-xs font-mono-ioc placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-otx-key"
              />
              <button
                onClick={() => updateSettingsMut.mutate({ otxApiKey: otxKey })}
                disabled={updateSettingsMut.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                data-testid="save-otx-key"
              >
                {updateSettingsMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="rounded border border-border bg-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center">
            <Server size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">System Info</h2>
            <p className="text-[10px] text-muted-foreground">Platform status and statistics</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-lg font-bold tabular-nums">{systemInfo?.version || "3.0.0"}</div>
            <div className="text-[10px] text-muted-foreground">Version</div>
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums">{systemInfo?.totalIocs?.toLocaleString() || "0"}</div>
            <div className="text-[10px] text-muted-foreground">Total IOCs</div>
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums">{systemInfo?.totalFeeds || "0"}</div>
            <div className="text-[10px] text-muted-foreground">Total Feeds</div>
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums">{systemInfo?.uptime ? formatUptime(systemInfo.uptime) : "N/A"}</div>
            <div className="text-[10px] text-muted-foreground">Uptime</div>
          </div>
        </div>
      </div>
    </div>
  );
}
