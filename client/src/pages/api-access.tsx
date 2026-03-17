import { useState } from "react";
import { useAuth } from "@/App";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Key, Copy, Check, Code, Terminal, Book,
  Shield, Loader2, ExternalLink
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

export default function ApiAccess() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

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

  const generateMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/keys/generate", { userId: user?.id || 1 });
      return res.json();
    },
    onSuccess: (data) => {
      setApiKey(data.apiKey);
      toast({ title: "API key generated", description: "Store it securely — it won't be shown again in full." });
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

  const baseUrl = window.location.origin;
  const exampleKey = apiKey || "octi_your_api_key_here";

  return (
    <div className="space-y-6 max-w-3xl mx-auto" data-testid="api-page">
      <div>
        <h1 className="text-xl font-semibold">API Access</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Integrate OpenCTI into your SIEM, SOAR, or custom security workflows.
        </p>
      </div>

      {/* API Key section */}
      <div className="rounded border border-border bg-card p-5 glow-card">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center">
            <Key size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Your API Key</h2>
            <p className="text-[10px] text-muted-foreground">Used for all API v1 endpoints via X-API-Key header</p>
          </div>
        </div>

        {apiKey ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2.5 rounded border border-border bg-background font-mono-ioc text-xs truncate">
              {apiKey}
            </div>
            <button
              onClick={copyKey}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded border border-border text-xs font-medium hover:bg-accent transition-colors shrink-0"
              data-testid="copy-key"
            >
              {keyCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {keyCopied ? "Copied" : "Copy"}
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

      {/* Endpoints documentation */}
      <div className="rounded border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Book size={16} className="text-primary" />
          <h2 className="text-sm font-semibold">API Endpoints</h2>
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">GET</span>
              <code className="text-xs font-mono-ioc">/api/v1/indicators</code>
            </div>
            <p className="text-xs text-muted-foreground mb-2">List all indicators. Supports filtering by type, search query, and pagination.</p>
            <div className="text-[10px] text-muted-foreground mb-1.5">Query parameters: type, search, limit (default 50), offset</div>
            <CodeBlock code={`curl -H "X-API-Key: ${exampleKey}" \\\n  "${baseUrl}/api/v1/indicators?type=ip&limit=10"`} />
          </div>

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

          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400">GET</span>
              <code className="text-xs font-mono-ioc">/api/v1/feeds</code>
            </div>
            <p className="text-xs text-muted-foreground mb-2">List all configured threat feeds with their status and IOC counts.</p>
            <CodeBlock code={`curl -H "X-API-Key: ${exampleKey}" \\\n  "${baseUrl}/api/v1/feeds"`} />
          </div>
        </div>
      </div>

      {/* Response example */}
      <div className="rounded border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Terminal size={16} className="text-primary" />
          <h2 className="text-sm font-semibold">Response Example</h2>
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

      {/* Authentication note */}
      <div className="rounded border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <Shield size={16} className="text-primary mt-0.5 shrink-0" />
        <div>
          <h3 className="text-xs font-semibold mb-1">Authentication</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            All API v1 endpoints require the <code className="font-mono-ioc bg-background px-1 py-0.5 rounded text-[10px]">X-API-Key</code> header.
            Requests without a valid key return 401/403. Generate your key above to get started.
          </p>
        </div>
      </div>
    </div>
  );
}
