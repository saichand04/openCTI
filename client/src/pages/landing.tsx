import { Link } from "wouter";
import { Shield, Zap, Globe, Search, Rss, Key, ArrowRight, ChevronRight } from "lucide-react";

function HeroGraphic() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      <svg viewBox="0 0 400 360" fill="none" className="w-full h-auto">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(160 75% 45% / 0.08)" strokeWidth="0.5" />
          </pattern>
          <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(160 75% 45%)" />
            <stop offset="100%" stopColor="hsl(140 70% 55%)" />
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(160 75% 45% / 0.2)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <rect width="400" height="360" fill="url(#grid)" />
        <circle cx="200" cy="160" r="120" fill="url(#glow)" />
        <g stroke="hsl(160 75% 45% / 0.2)" strokeWidth="1" strokeDasharray="4 4">
          <line x1="200" y1="160" x2="80" y2="80" />
          <line x1="200" y1="160" x2="320" y2="80" />
          <line x1="200" y1="160" x2="80" y2="260" />
          <line x1="200" y1="160" x2="320" y2="260" />
          <line x1="200" y1="160" x2="60" y2="160" />
          <line x1="200" y1="160" x2="340" y2="160" />
          <line x1="200" y1="160" x2="200" y2="40" />
          <line x1="200" y1="160" x2="200" y2="300" />
        </g>
        {[
          [80, 80], [320, 80], [80, 260], [320, 260],
          [60, 160], [340, 160], [200, 40], [200, 300],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="6" fill="hsl(160 15% 5%)" stroke="hsl(160 75% 45% / 0.5)" strokeWidth="1.5" />
            <circle cx={cx} cy={cy} r="2.5" fill="hsl(160 75% 45%)" className="pulse-dot" style={{ animationDelay: `${i * 0.25}s` }} />
          </g>
        ))}
        <g transform="translate(170, 120)">
          <path
            d="M30 4L6 16v16c0 14.36 10.24 27.76 24 32 13.76-4.24 24-17.64 24-32V16L30 4z"
            fill="hsl(160 15% 5%)"
            stroke="url(#shieldGrad)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <circle cx="30" cy="32" r="8" stroke="url(#shieldGrad)" strokeWidth="2" fill="none" />
          <circle cx="30" cy="32" r="3" fill="hsl(160 75% 45%)" />
        </g>
        <circle cx="200" cy="160" r="80" fill="none" stroke="hsl(160 75% 45% / 0.15)" strokeWidth="1">
          <animate attributeName="r" from="60" to="140" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.4" to="0" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="200" cy="160" r="80" fill="none" stroke="hsl(160 75% 45% / 0.1)" strokeWidth="0.5">
          <animate attributeName="r" from="80" to="160" dur="4s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.3" to="0" dur="4s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}

const features = [
  {
    icon: Globe,
    title: "12+ OSINT Feeds",
    desc: "Aggregate threat data from Abuse.ch, Emerging Threats, OpenPhish, MalwareBazaar, and more.",
  },
  {
    icon: Search,
    title: "IOC Lookup with News",
    desc: "Search any indicator. If not in our database, we search HackerNews, Reddit, and top security platforms.",
  },
  {
    icon: Rss,
    title: "Custom Feed Integration",
    desc: "Add your own threat feeds via URL. Supports CSV, TXT, and structured formats.",
  },
  {
    icon: Key,
    title: "Public REST API",
    desc: "Integrate OpenCTI into your SIEM, SOAR, or custom workflows with API key authentication.",
  },
  {
    icon: Shield,
    title: "Real-time Classification",
    desc: "Auto-detect IOC types (IP, URL, hash, domain, CVE) with severity and confidence scoring.",
  },
  {
    icon: Zap,
    title: "Instant Aggregation",
    desc: "Fetch all feeds with one click. Thousands of IOCs parsed, deduplicated, and ready in seconds.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="hero-grid fixed inset-0 pointer-events-none" />
      <div className="hero-spotlight" />

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 lg:px-12 h-16">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" width="28" height="28" fill="none" aria-label="OpenCTI">
            <path d="M16 2L4 8v8c0 7.18 5.12 13.88 12 16 6.88-2.12 12-8.82 12-16V8L16 2z" stroke="hsl(160 75% 45%)" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="16" cy="15" r="4" stroke="hsl(160 75% 45%)" strokeWidth="2" />
            <path d="M16 11V6M16 24v-5M10 15H6m20 0h-4" stroke="hsl(160 75% 45%)" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
          </svg>
          <span className="font-semibold text-base tracking-tight">OpenCTI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth">
            <span className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer" data-testid="nav-signin">
              Sign in
            </span>
          </Link>
          <Link href="/auth">
            <span className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer" data-testid="nav-signup">
              Get Started <ArrowRight size={14} />
            </span>
          </Link>
        </div>
      </header>

      {/* Hero with spotlight */}
      <section className="relative z-10 pt-16 pb-20 px-6 lg:px-12 overflow-hidden">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-dot" />
              Open Source Threat Intelligence
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold leading-tight mb-4">
              <span className="gradient-text">Unified Threat Intel</span>
              <br />
              From Every Open Source
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed mb-8 max-w-lg">
              Aggregate, correlate, and search threat indicators from 12+ OSINT feeds.
              Lookup any IOC with automatic news fallback from HackerNews and Reddit.
              Full API access for seamless integration.
            </p>
            <div className="flex items-center gap-3">
              <Link href="/auth">
                <span className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer" data-testid="hero-cta">
                  Start Monitoring <ChevronRight size={16} />
                </span>
              </Link>
              <Link href="/auth">
                <span className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-border text-foreground text-sm font-medium hover:bg-accent transition-colors cursor-pointer" data-testid="hero-secondary">
                  View Dashboard
                </span>
              </Link>
            </div>
          </div>
          <HeroGraphic />
        </div>
      </section>

      {/* Features grid */}
      <section className="relative z-10 py-20 px-6 lg:px-12 border-t border-border/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-xl font-semibold mb-2">Built for Security Teams</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Everything you need to aggregate, analyze, and act on open-source threat intelligence.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded border border-border bg-card p-5 hover:border-primary/30 transition-colors glow-card"
                  data-testid={`feature-${f.title.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="w-9 h-9 rounded bg-primary/10 flex items-center justify-center mb-3">
                    <Icon size={18} className="text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="relative z-10 py-12 px-6 lg:px-12 border-t border-border/50">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { val: "12+", label: "OSINT Feeds" },
            { val: "5,000+", label: "IOCs Tracked" },
            { val: "10+", label: "News Sources" },
            { val: "REST", label: "API Access" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-2xl font-bold gradient-text tabular-nums">{s.val}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer - no Perplexity attribution */}
      <footer className="relative z-10 border-t border-border/50 py-8 px-6 lg:px-12">
        <div className="max-w-6xl mx-auto flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg viewBox="0 0 32 32" width="18" height="18" fill="none">
              <path d="M16 2L4 8v8c0 7.18 5.12 13.88 12 16 6.88-2.12 12-8.82 12-16V8L16 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <span>OpenCTI — Open Source Threat Intelligence</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
