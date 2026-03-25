import { useState, useEffect } from "react";
import { useAuth } from "@/App";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Settings as SettingsIcon, Key, Shield, Database, Rss, Server,
  Copy, Check, Loader2, Trash2, RefreshCw, Book, Terminal, Code, Mail, Send, Zap
} from "lucide-react";

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copyToClipboard = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative rounded border border-border bg-background group">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border text-[10px] text-muted-foreground">
        <span>{lang}</span>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          data-testid="copy-code"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono-ioc overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();

  // API key state
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [otxKey, setOtxKey] = useState("");

  // Expand/collapse API docs
  const [showApiDocs, setShowApiDocs] = useState(false);

  // SMTP state
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFromEmail, setSmtpFromEmail] = useState("");
  const [smtpFromName, setSmtpFromName] = useState("OpenCTI Threat Advisory");

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
      setSmtpHost(settingsData.smtpHost || "");
      setSmtpPort(String(settingsData.smtpPort || 587));
      setSmtpSecure(settingsData.smtpSecure || false);
      setSmtpUser(settingsData.smtpUser || "");
      setSmtpPass(settingsData.smtpPass || "");
      setSmtpFromEmail(settingsData.smtpFromEmail || "");
      setSmtpFromName(settingsData.smtpFromName || "OpenCTI Threat Advisory");
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

  const smtpTestMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/settings/smtp-test");
      return res.json();
    },
    onSuccess: (data) => toast({ title: "SMTP OK", description: data.message }),
    onError: (e: any) => toast({ title: "SMTP Test Failed", description: e.message, variant: "destructive" }),
  });

  const saveSmtpSettings = () => {
    updateSettingsMut.mutate({
      smtpHost,
      smtpPort: parseInt(smtpPort) || 587,
      smtpSecure,
      smtpUser,
      smtpPass,
      smtpFromEmail,
      smtpFromName,
    });
  };

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

  const baseUrl = window.location.origin;
  const exampleKey = apiKey || "octi_your_api_key_here";

  return (
    <div className="space-y-6 max-w-3xl mx-auto" data-testid="settings-page">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <SettingsIcon size={20} className="text-primary" />
          Settings
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Platform configuration and administration</p>
      </div>

      {/* API Configuration — key + docs combined */}
      <div className="rounded border border-border bg-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center">
            <Key size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">API Access</h2>
            <p className="text-[10px] text-muted-foreground">Manage your API key and integrate with external tools</p>
          </div>
        </div>

        {/* API Key generation / display */}
        {apiKey ? (
          <div className="flex items-center gap-2 mb-4">
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
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors mb-4"
            data-testid="generate-key"
          >
            {generateMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
            Generate API Key
          </button>
        )}

        {/* Auth note */}
        <div className="rounded border border-primary/20 bg-primary/5 p-3 flex items-start gap-2.5 mb-4">
          <Shield size={14} className="text-primary mt-0.5 shrink-0" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            All API v1 endpoints require the <code className="font-mono-ioc bg-background px-1 py-0.5 rounded text-[10px]">X-API-Key</code> header.
            Requests without a valid key return 401/403.
          </p>
        </div>

        {/* Expandable API docs */}
        <button
          onClick={() => setShowApiDocs(!showApiDocs)}
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
          data-testid="toggle-api-docs"
        >
          <Book size={12} />
          {showApiDocs ? "Hide" : "Show"} API Endpoints Documentation
          <svg
            className={`w-3 h-3 transition-transform ${showApiDocs ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showApiDocs && (
          <div className="mt-4 space-y-5 pt-4 border-t border-border">
            {/* Endpoint: indicators */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">GET</span>
                <code className="text-xs font-mono-ioc">/api/v1/indicators</code>
              </div>
              <p className="text-xs text-muted-foreground mb-2">List all indicators. Supports filtering by type, search query, and pagination.</p>
              <div className="text-[10px] text-muted-foreground mb-1.5">Query parameters: type, search, limit (default 50), offset</div>
              <CodeBlock code={`curl -H "X-API-Key: ${exampleKey}" \\\n  "${baseUrl}/api/v1/indicators?type=ip&limit=10"`} />
            </div>

            {/* Endpoint: lookup */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">GET</span>
                <code className="text-xs font-mono-ioc">/api/v1/lookup</code>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                Look up a specific IOC. Returns matches from the database and, if none found, searches security news.
              </p>
              <div className="text-[10px] text-muted-foreground mb-1.5">Query parameters: query (required)</div>
              <CodeBlock code={`curl -H "X-API-Key: ${exampleKey}" \\\n  "${baseUrl}/api/v1/lookup?query=8.8.8.8"`} />
            </div>

            {/* Endpoint: feeds */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">GET</span>
                <code className="text-xs font-mono-ioc">/api/v1/feeds</code>
              </div>
              <p className="text-xs text-muted-foreground mb-2">List all configured threat feeds with their status and IOC counts.</p>
              <CodeBlock code={`curl -H "X-API-Key: ${exampleKey}" \\\n  "${baseUrl}/api/v1/feeds"`} />
            </div>

            {/* Response example */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Terminal size={14} className="text-primary" />
                <span className="text-xs font-semibold">Response Example</span>
              </div>
              <CodeBlock
                lang="json"
                code={JSON.stringify({
                  query: "8.8.8.8",
                  type: "ip",
                  results: [
                    {
                      id: 1,
                      type: "ip",
                      value: "8.8.8.8",
                      source: "blocklist-de",
                      severity: "medium",
                      confidence: 70,
                      tags: ["blocklist-de"],
                      description: "Blocklist.de: Attack source",
                    }
                  ],
                  total: 1,
                  news: [],
                }, null, 2)}
              />
            </div>
          </div>
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

      {/* Email Server (SMTP) */}
      <div className="rounded border border-border bg-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center">
            <Mail size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Email Server (SMTP)</h2>
            <p className="text-[10px] text-muted-foreground">Configure SMTP to send threat advisory reports to subscribers</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">SMTP Host</label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.gmail.com"
                className="w-full px-3 py-2 rounded border border-border bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-smtp-host"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Port</label>
              <input
                type="text"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
                placeholder="587"
                className="w-full px-3 py-2 rounded border border-border bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-smtp-port"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Username / Email</label>
              <input
                type="text"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="alerts@yourcompany.com"
                className="w-full px-3 py-2 rounded border border-border bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-smtp-user"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Password / App Password</label>
              <input
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded border border-border bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-smtp-pass"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">From Email</label>
              <input
                type="text"
                value={smtpFromEmail}
                onChange={(e) => setSmtpFromEmail(e.target.value)}
                placeholder="noreply@yourcompany.com"
                className="w-full px-3 py-2 rounded border border-border bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-smtp-from"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">From Name</label>
              <input
                type="text"
                value={smtpFromName}
                onChange={(e) => setSmtpFromName(e.target.value)}
                placeholder="OpenCTI Threat Advisory"
                className="w-full px-3 py-2 rounded border border-border bg-background text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="input-smtp-from-name"
              />
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs">Use TLS/SSL</span>
              <span className="text-[10px] text-muted-foreground">(port 465 = SSL, port 587 = STARTTLS)</span>
            </div>
            <button
              onClick={() => setSmtpSecure(!smtpSecure)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                smtpSecure ? "bg-primary" : "bg-muted"
              }`}
              data-testid="toggle-smtp-secure"
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                  smtpSecure ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={saveSmtpSettings}
              disabled={updateSettingsMut.isPending || !smtpHost}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              data-testid="save-smtp"
            >
              {updateSettingsMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Save SMTP Settings
            </button>
            <button
              onClick={() => smtpTestMut.mutate()}
              disabled={smtpTestMut.isPending || !smtpHost}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-xs font-medium hover:bg-accent disabled:opacity-50 transition-colors"
              data-testid="test-smtp"
            >
              {smtpTestMut.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Test Connection
            </button>
          </div>
          <div className="rounded border border-primary/15 bg-primary/5 p-3 mt-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Gmail users:</strong> Use <code className="font-mono-ioc bg-background px-1 py-0.5 rounded text-[10px]">smtp.gmail.com</code> with port 587.
              Generate an App Password at <span className="text-primary">myaccount.google.com/apppasswords</span> instead of using your account password.
            </p>
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
