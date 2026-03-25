import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import type { InsertIndicator } from "@shared/schema";
import nodemailer from "nodemailer";

// Settings storage (in-memory)
let platformSettings: Record<string, any> = {
  authGoogle: true,
  authGithub: true,
  authMicrosoft: true,
  signupEnabled: true,
  dataRetentionMonths: 3,
  otxApiKey: process.env.OTX_API_KEY || "",
  lastPurge: null,
  nextPurge: null,
  // SMTP email settings
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: parseInt(process.env.SMTP_PORT || "587"),
  smtpSecure: process.env.SMTP_SECURE === "true" || false,
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFromEmail: process.env.SMTP_FROM || "",
  smtpFromName: process.env.SMTP_FROM_NAME || "OpenCTI Threat Advisory",
};

async function fetchAndParseFeed(slug: string, url: string, category: string): Promise<InsertIndicator[]> {
  const now = new Date().toISOString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'OpenCTI/2.0' } });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const lines = text.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('"id"'));
    const indicators: InsertIndicator[] = [];
    const maxItems = 500;

    switch (slug) {
      case 'urlhaus': {
        for (const line of lines.slice(0, maxItems)) {
          if (line.startsWith('#') || line.startsWith('"id"')) continue;
          const parts = line.split('","').map(s => s.replace(/"/g, ''));
          if (parts.length >= 6 && parts[2]) {
            indicators.push({ type: 'url', value: parts[2], source: slug, severity: parts[3] === 'online' ? 'high' : 'medium', confidence: 80, tags: parts[6] ? parts[6].split(',').map(t => t.trim()).filter(Boolean) : null, firstSeen: parts[1] || now, lastSeen: now, description: `URLhaus: ${parts[5] || 'malware_download'} (${parts[3] || 'unknown'})`, active: true });
          }
        }
        break;
      }
      case 'feodotracker': case 'blocklist-de': case 'et-compromised': case 'cinsscore': {
        const sevMap: Record<string, string> = { feodotracker: 'critical', 'blocklist-de': 'medium', 'et-compromised': 'high', cinsscore: 'medium' };
        const descMap: Record<string, string> = { feodotracker: 'Feodo: Botnet C2', 'blocklist-de': 'Blocklist.de: Attack source', 'et-compromised': 'ET: Compromised IP', cinsscore: 'CINSscore: Bad IP' };
        for (const line of lines.slice(0, maxItems)) {
          const ip = line.trim();
          if (ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
            indicators.push({ type: 'ip', value: ip, source: slug, severity: sevMap[slug] || 'medium', confidence: slug === 'feodotracker' ? 90 : 70, tags: [slug], firstSeen: now, lastSeen: now, description: descMap[slug] || slug, active: true });
          }
        }
        break;
      }
      case 'sslbl': {
        for (const line of lines.slice(0, maxItems)) {
          if (line.startsWith('#') || line.startsWith('Firstseen')) continue;
          const parts = line.split(',');
          if (parts.length >= 2 && parts[1]) {
            indicators.push({ type: 'ip', value: parts[1].trim(), source: slug, severity: 'high', confidence: 85, tags: ['ssl', 'c2'], firstSeen: parts[0] || now, lastSeen: now, description: `SSLBL: ${parts[4] || 'C2 SSL cert'}`, active: true });
          }
        }
        break;
      }
      case 'threatfox': {
        for (const line of lines.slice(0, maxItems)) {
          if (line.startsWith('#') || line.startsWith('"first')) continue;
          const parts = line.split('","').map(s => s.replace(/"/g, ''));
          if (parts.length >= 6 && parts[2]) {
            let type = 'url';
            const iocType = (parts[3] || '').toLowerCase();
            if (iocType.includes('ip')) type = 'ip'; else if (iocType.includes('domain')) type = 'domain'; else if (iocType.includes('md5')) type = 'hash_md5'; else if (iocType.includes('sha256')) type = 'hash_sha256';
            const conf = parseInt(parts[9]) || 50;
            indicators.push({ type, value: parts[2].split(':')[0] || parts[2], source: slug, severity: conf >= 90 ? 'critical' : conf >= 70 ? 'high' : 'medium', confidence: conf, tags: [parts[7] || 'malware'], firstSeen: parts[0] || now, lastSeen: now, description: `ThreatFox: ${parts[7] || 'Malware'}`, active: true });
          }
        }
        break;
      }
      case 'c2-intel': {
        for (const line of lines.slice(0, maxItems)) {
          if (line.startsWith('#') || line.startsWith('ip') || line.startsWith('first')) continue;
          const parts = line.split(',');
          const ip = (parts[0] || '').trim();
          if (ip && /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
            indicators.push({ type: 'ip', value: ip, source: slug, severity: 'critical', confidence: 85, tags: ['c2'], firstSeen: now, lastSeen: now, description: 'C2 IntelFeeds: C2 server', active: true });
          }
        }
        break;
      }
      case 'openphish': case 'digitalside': {
        for (const line of lines.slice(0, maxItems)) {
          const url = line.trim();
          if (url && url.startsWith('http')) {
            indicators.push({ type: 'url', value: url, source: slug, severity: 'high', confidence: slug === 'openphish' ? 85 : 75, tags: [slug === 'openphish' ? 'phishing' : 'malware'], firstSeen: now, lastSeen: now, description: slug === 'openphish' ? 'OpenPhish: Phishing URL' : 'DigitalSide: Malware URL', active: true });
          }
        }
        break;
      }
      case 'malwarebazaar': {
        for (const line of lines.slice(0, maxItems)) {
          if (line.startsWith('#') || line.startsWith('"first')) continue;
          const parts = line.split('","').map(s => s.replace(/"/g, ''));
          if (parts.length >= 6 && parts[1]) {
            indicators.push({ type: 'hash_sha256', value: parts[1], source: slug, severity: 'critical', confidence: 90, tags: [parts[8] || 'malware'], firstSeen: parts[0] || now, lastSeen: now, description: `MalwareBazaar: ${parts[8] || 'Malware'} (${parts[6] || 'unknown'})`, active: true });
          }
        }
        break;
      }
      case 'disposable-email': {
        for (const line of lines.slice(0, maxItems)) {
          const domain = line.trim();
          if (domain && !domain.startsWith('#') && domain.includes('.')) {
            indicators.push({ type: 'domain', value: domain, source: slug, severity: 'low', confidence: 95, tags: ['disposable'], firstSeen: now, lastSeen: now, description: 'Disposable email domain', active: true });
          }
        }
        break;
      }
      case 'otx-alienvault': {
        const otxKey = platformSettings.otxApiKey || '';
        if (!otxKey) break;
        const otxRes = await fetch('https://otx.alienvault.com/api/v1/pulses/subscribed?limit=10&page=1', {
          headers: { 'X-OTX-API-KEY': otxKey, 'User-Agent': 'OpenCTI/3.0' },
          signal: controller.signal,
        });
        if (!otxRes.ok) throw new Error(`OTX API ${otxRes.status}`);
        const otxData = await otxRes.json();
        for (const pulse of (otxData.results || [])) {
          for (const ind of (pulse.indicators || []).slice(0, 50)) {
            let type = 'unknown';
            if (ind.type === 'IPv4' || ind.type === 'IPv6') type = 'ip';
            else if (ind.type === 'domain' || ind.type === 'hostname') type = 'domain';
            else if (ind.type === 'URL') type = 'url';
            else if (ind.type === 'FileHash-MD5') type = 'hash_md5';
            else if (ind.type === 'FileHash-SHA1') type = 'hash_sha1';
            else if (ind.type === 'FileHash-SHA256') type = 'hash_sha256';
            else if (ind.type === 'CVE') type = 'cve';
            else if (ind.type === 'email') type = 'email';
            if (type !== 'unknown') {
              indicators.push({
                type, value: ind.indicator, source: 'otx-alienvault',
                severity: 'high', confidence: 80,
                tags: pulse.tags?.slice(0, 5) || ['otx'],
                firstSeen: ind.created || now, lastSeen: now,
                description: `OTX Pulse: ${pulse.name || 'Unknown'}`,
                active: true,
              });
            }
          }
        }
        break;
      }
      default: {
        for (const line of lines.slice(0, maxItems)) {
          const val = line.trim();
          if (!val) continue;
          let type = category;
          if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(val)) type = 'ip';
          else if (val.startsWith('http')) type = 'url';
          else if (/^[a-f0-9]{64}$/i.test(val)) type = 'hash_sha256';
          else if (/^[a-f0-9]{40}$/i.test(val)) type = 'hash_sha1';
          else if (/^[a-f0-9]{32}$/i.test(val)) type = 'hash_md5';
          else if (val.includes('.') && !val.includes('/')) type = 'domain';
          indicators.push({ type, value: val, source: slug, severity: 'medium', confidence: 60, tags: null, firstSeen: now, lastSeen: now, description: `From ${slug}`, active: true });
        }
      }
    }
    return indicators;
  } catch (error: any) { throw new Error(`Failed to fetch ${slug}: ${error.message}`); }
}

// Search news platforms for IOC context
async function searchNewsForIOC(query: string): Promise<any[]> {
  const results: any[] = [];
  try {
    // HackerNews Algolia API
    const hnRes = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=5`, { signal: AbortSignal.timeout(10000) });
    if (hnRes.ok) {
      const hn = await hnRes.json();
      for (const hit of (hn.hits || [])) {
        results.push({ title: hit.title, url: hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`, source: "Hacker News", date: hit.created_at, points: hit.points, comments: hit.num_comments });
      }
    }
  } catch {}
  try {
    // Reddit security subreddits
    const redditRes = await fetch(`https://www.reddit.com/r/netsec+cybersecurity+malware+hacking/search.json?q=${encodeURIComponent(query)}&sort=relevance&t=year&limit=5`, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'OpenCTI/2.0' } });
    if (redditRes.ok) {
      const reddit = await redditRes.json();
      for (const post of (reddit?.data?.children || [])) {
        const d = post.data;
        results.push({ title: d.title, url: `https://reddit.com${d.permalink}`, source: "Reddit r/" + d.subreddit, date: new Date(d.created_utc * 1000).toISOString(), points: d.score, comments: d.num_comments });
      }
    }
  } catch {}
  return results;
}

export async function registerRoutes(server: Server, app: Express) {
  // Geo cache — declared at top so auto-fetch, manual fetch-all, and geo endpoint can all access it
  let geoCache: { data: any[]; timestamp: number } = { data: [], timestamp: 0 };
  const GEO_CACHE_TTL = 2 * 60 * 1000; // 2 minutes — refresh quickly when new IOCs arrive

  // ============ AUTH ============
  app.post("/api/auth/signup", async (req, res) => {
    const { email, name, provider } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    const existing = await storage.getUserByEmail(email);
    if (existing) return res.status(409).json({ error: "User exists", user: existing });
    const user = await storage.createUser({ email, name: name || email.split('@')[0], provider: provider || "email", createdAt: new Date().toISOString() });
    res.json(user);
  });

  app.post("/api/auth/signin", async (req, res) => {
    const { email, provider } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    let user = await storage.getUserByEmail(email);
    if (!user) {
      user = await storage.createUser({ email, name: email.split('@')[0], provider: provider || "email", createdAt: new Date().toISOString() });
    }
    res.json(user);
  });

  app.post("/api/auth/admin-login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Username and password required" });
    const user = await storage.getUserByEmail(username);
    if (!user || user.role !== "admin") return res.status(401).json({ error: "Invalid credentials" });
    if (user.password !== password) return res.status(401).json({ error: "Invalid credentials" });
    res.json(user);
  });

  // ============ API KEY ============
  app.post("/api/keys/generate", async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "userId required" });
    try {
      const key = await storage.generateApiKey(parseInt(userId));
      res.json({ apiKey: key });
    } catch (e: any) { res.status(404).json({ error: e.message }); }
  });

  app.get("/api/keys/:userId", async (req, res) => {
    const user = await storage.getUser(parseInt(req.params.userId));
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ apiKey: user.apiKey });
  });

  // ============ FEEDS ============
  app.get("/api/feeds", async (_req, res) => { res.json(await storage.getFeeds()); });
  app.get("/api/feeds/:id", async (req, res) => {
    const feed = await storage.getFeed(parseInt(req.params.id));
    if (!feed) return res.status(404).json({ error: "Feed not found" });
    res.json(feed);
  });
  app.patch("/api/feeds/:id/toggle", async (req, res) => {
    const feed = await storage.getFeed(parseInt(req.params.id));
    if (!feed) return res.status(404).json({ error: "Feed not found" });
    res.json(await storage.updateFeed(feed.id, { enabled: !feed.enabled }));
  });

  // Add new custom feed
  app.post("/api/feeds", async (req, res) => {
    const { name, url, category, description } = req.body;
    if (!name || !url) return res.status(400).json({ error: "Name and URL required" });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = await storage.getFeedBySlug(slug);
    if (existing) return res.status(409).json({ error: "Feed with similar name exists" });
    const feed = await storage.createFeed({ name, slug, category: category || 'mixed', url, description: description || '', enabled: true, status: 'idle', iocCount: 0, isCustom: true, addedBy: 'user' });
    res.json(feed);
  });

  app.delete("/api/feeds/:id", async (req, res) => {
    const feed = await storage.getFeed(parseInt(req.params.id));
    if (!feed) return res.status(404).json({ error: "Feed not found" });
    await storage.deleteIndicatorsBySource(feed.slug);
    await storage.deleteFeed(feed.id);
    res.json({ success: true });
  });

  // Fetch single feed
  app.post("/api/feeds/:id/fetch", async (req, res) => {
    const feed = await storage.getFeed(parseInt(req.params.id));
    if (!feed) return res.status(404).json({ error: "Feed not found" });
    await storage.updateFeed(feed.id, { status: "fetching" });
    try {
      const indicators = await fetchAndParseFeed(feed.slug, feed.url, feed.category);
      await storage.deleteIndicatorsBySource(feed.slug);
      const count = await storage.createIndicatorsBatch(indicators);
      await storage.updateFeed(feed.id, { status: "success", lastFetched: new Date().toISOString(), iocCount: count, errorMessage: null });
      res.json({ success: true, count });
    } catch (error: any) {
      await storage.updateFeed(feed.id, { status: "error", errorMessage: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // Fetch ALL enabled feeds
  app.post("/api/feeds/fetch-all", async (_req, res) => {
    const feeds = await storage.getFeeds();
    const enabled = feeds.filter(f => f.enabled);
    const results: any[] = [];
    for (const feed of enabled) {
      await storage.updateFeed(feed.id, { status: "fetching" });
      try {
        const indicators = await fetchAndParseFeed(feed.slug, feed.url, feed.category);
        await storage.deleteIndicatorsBySource(feed.slug);
        const count = await storage.createIndicatorsBatch(indicators);
        await storage.updateFeed(feed.id, { status: "success", lastFetched: new Date().toISOString(), iocCount: count, errorMessage: null });
        results.push({ slug: feed.slug, status: "success", count });
      } catch (error: any) {
        await storage.updateFeed(feed.id, { status: "error", errorMessage: error.message });
        results.push({ slug: feed.slug, status: "error", error: error.message });
      }
    }
    // Clear geo cache so map refreshes with new IPs
    geoCache = { data: [], timestamp: 0 };
    res.json({ results, totalFeeds: enabled.length });
  });

  // ============ INDICATORS ============
  app.get("/api/indicators", async (req, res) => {
    const { type, source, severity, search, limit, offset } = req.query;
    res.json(await storage.getIndicators({ type: type as string, source: source as string, severity: severity as string, search: search as string, limit: limit ? parseInt(limit as string) : 50, offset: offset ? parseInt(offset as string) : 0 }));
  });

  // ============ LOOKUP with news search ============
  app.get("/api/lookup", async (req, res) => {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: "Query required" });
    const q = (query as string).trim();
    let type = 'unknown';
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(q)) type = 'ip';
    else if (q.startsWith('http')) type = 'url';
    else if (/^[a-f0-9]{32}$/i.test(q)) type = 'hash_md5';
    else if (/^[a-f0-9]{40}$/i.test(q)) type = 'hash_sha1';
    else if (/^[a-f0-9]{64}$/i.test(q)) type = 'hash_sha256';
    else if (/^CVE-\d{4}-\d+$/i.test(q)) type = 'cve';
    else if (q.includes('.') && !q.includes('/')) type = 'domain';

    const result = await storage.getIndicators({ search: q, limit: 100 });
    // If no local results, search news
    let newsResults: any[] = [];
    if (result.total === 0) {
      newsResults = await searchNewsForIOC(q);
    }
    await storage.createSearch({ query: q, type, resultCount: result.total, timestamp: new Date().toISOString() });
    res.json({ query: q, type, results: result.items, total: result.total, news: newsResults });
  });

  // Dedicated news search endpoint
  app.get("/api/news/search", async (req, res) => {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: "Query required" });
    const news = await searchNewsForIOC(query as string);
    res.json({ query, results: news });
  });

  // ============ DASHBOARD ============
  app.get("/api/dashboard/stats", async (_req, res) => {
    const feeds = await storage.getFeeds();
    const enabledFeeds = feeds.filter(f => f.enabled);
    const totalIocs = feeds.reduce((sum, f) => sum + f.iocCount, 0);
    const activeSources = feeds.filter(f => f.status === "success").length;
    res.json({
      totalFeeds: feeds.length, enabledFeeds: enabledFeeds.length, activeSources, totalIocs,
      feedsWithErrors: feeds.filter(f => f.status === "error").length,
      byType: await storage.getIndicatorCountByType(),
      bySeverity: await storage.getIndicatorCountBySeverity(),
      bySource: await storage.getIndicatorCountBySource(),
      recentIndicators: await storage.getRecentIndicators(15),
      recentSearches: await storage.getSearches(10),
      feeds: feeds.map(f => ({ id: f.id, name: f.name, slug: f.slug, status: f.status, iocCount: f.iocCount, lastFetched: f.lastFetched, enabled: f.enabled, isCustom: f.isCustom })),
    });
  });

  app.get("/api/searches", async (_req, res) => { res.json(await storage.getSearches(50)); });

  // ============ PUBLIC API (key-auth) ============
  app.get("/api/v1/indicators", async (req, res) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) return res.status(401).json({ error: "API key required. Pass via X-API-Key header." });
    const user = await storage.getUserByApiKey(apiKey);
    if (!user) return res.status(403).json({ error: "Invalid API key" });
    const { type, search, limit, offset } = req.query;
    res.json(await storage.getIndicators({ type: type as string, search: search as string, limit: limit ? parseInt(limit as string) : 50, offset: offset ? parseInt(offset as string) : 0 }));
  });

  app.get("/api/v1/lookup", async (req, res) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) return res.status(401).json({ error: "API key required" });
    const user = await storage.getUserByApiKey(apiKey);
    if (!user) return res.status(403).json({ error: "Invalid API key" });
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: "Query required" });
    const q = (query as string).trim();
    const result = await storage.getIndicators({ search: q, limit: 100 });
    let newsResults: any[] = [];
    if (result.total === 0) newsResults = await searchNewsForIOC(q);
    res.json({ query: q, results: result.items, total: result.total, news: newsResults });
  });

  app.get("/api/v1/feeds", async (req, res) => {
    const apiKey = req.headers['x-api-key'] as string;
    if (!apiKey) return res.status(401).json({ error: "API key required" });
    const user = await storage.getUserByApiKey(apiKey);
    if (!user) return res.status(403).json({ error: "Invalid API key" });
    const feeds = await storage.getFeeds();
    res.json(feeds.map(f => ({ name: f.name, slug: f.slug, category: f.category, iocCount: f.iocCount, status: f.status, lastFetched: f.lastFetched })));
  });

  // ============ THREAT ADVISOR ============
  const THREAT_NEWS_SOURCES = [
    { name: "The Hacker News", slug: "thehackernews", rssUrl: "https://feeds.feedburner.com/TheHackersNews", website: "https://thehackernews.com" },
    { name: "Qualys Blog", slug: "qualys", rssUrl: "https://blog.qualys.com/feed", website: "https://blog.qualys.com" },
    { name: "Rapid7 Blog", slug: "rapid7", rssUrl: "https://blog.rapid7.com/rss/", website: "https://www.rapid7.com/blog/" },
    { name: "CISA Alerts", slug: "cisa", rssUrl: "https://www.cisa.gov/cybersecurity-advisories/all.xml", website: "https://www.cisa.gov" },
    { name: "Securelist (Kaspersky)", slug: "securelist", rssUrl: "https://securelist.com/feed/", website: "https://securelist.com" },
    { name: "ENISA News", slug: "enisa", rssUrl: "https://www.enisa.europa.eu/topics/rss.xml", website: "https://www.enisa.europa.eu" },
    { name: "CyberSecurity News", slug: "cybersecnews", rssUrl: "https://cybersecuritynews.com/feed/", website: "https://cybersecuritynews.com" },
    { name: "SecurityOnline", slug: "securityonline", rssUrl: "https://securityonline.info/feed/", website: "https://securityonline.info" },
    { name: "Techzine EU", slug: "techzine", rssUrl: "https://www.techzine.eu/feed/", website: "https://www.techzine.eu" },
    { name: "AlienVault OTX Pulse", slug: "otx", rssUrl: "https://otx.alienvault.com/api/v1/pulses/subscribed?limit=15&page=1", website: "https://otx.alienvault.com" },
    { name: "BleepingComputer", slug: "bleepingcomputer", rssUrl: "https://www.bleepingcomputer.com/feed/", website: "https://www.bleepingcomputer.com" },
    { name: "Krebs on Security", slug: "krebsonsecurity", rssUrl: "https://krebsonsecurity.com/feed/", website: "https://krebsonsecurity.com" },
  ];

  // Simple XML tag extraction (no external parser needed)
  function extractTag(xml: string, tag: string): string {
    const regex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([^\\]]*?)\\]\\]></${tag}>|<${tag}[^>]*>([^<]*?)</${tag}>`, 'i');
    const match = xml.match(regex);
    return (match?.[1] || match?.[2] || '').trim();
  }

  function extractItems(xml: string): Array<{ title: string; link: string; description: string; pubDate: string }> {
    const items: Array<{ title: string; link: string; description: string; pubDate: string }> = [];
    // Match <item>...</item> or <entry>...</entry>
    const itemRegex = /<(?:item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/(?:item|entry)>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 10) {
      const content = match[1];
      const title = extractTag(content, 'title');
      // For Atom feeds, link might be in href attribute
      let link = extractTag(content, 'link');
      if (!link) {
        const linkMatch = content.match(/<link[^>]+href=["']([^"']+)["']/i);
        link = linkMatch?.[1] || '';
      }
      const description = extractTag(content, 'description') || extractTag(content, 'summary') || extractTag(content, 'content');
      const pubDate = extractTag(content, 'pubDate') || extractTag(content, 'published') || extractTag(content, 'updated') || extractTag(content, 'dc:date');
      if (title) {
        // Strip HTML from description
        const cleanDesc = description.replace(/<[^>]+>/g, '').substring(0, 300);
        items.push({ title, link, description: cleanDesc, pubDate });
      }
    }
    return items;
  }

  // Enrich articles with threat keywords
  function enrichArticle(article: { title: string; description: string }) {
    const text = `${article.title} ${article.description}`.toLowerCase();
    const tags: string[] = [];
    const threatKeywords: Record<string, string[]> = {
      'malware': ['malware', 'trojan', 'ransomware', 'backdoor', 'worm', 'spyware', 'keylogger', 'rootkit'],
      'vulnerability': ['vulnerability', 'cve-', 'zero-day', '0-day', 'exploit', 'rce', 'xss', 'sql injection', 'buffer overflow'],
      'phishing': ['phishing', 'social engineering', 'spear-phishing', 'credential theft'],
      'apt': ['apt', 'advanced persistent threat', 'nation-state', 'threat actor', 'campaign'],
      'ransomware': ['ransomware', 'ransom', 'encryption', 'decryptor'],
      'data-breach': ['data breach', 'data leak', 'exposed', 'compromised data', 'stolen data'],
      'botnet': ['botnet', 'c2', 'command and control', 'c&c'],
      'critical': ['critical', 'emergency', 'urgent', 'severe'],
    };
    for (const [tag, keywords] of Object.entries(threatKeywords)) {
      if (keywords.some(k => text.includes(k))) tags.push(tag);
    }
    let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium';
    if (tags.includes('critical') || tags.includes('ransomware') || tags.includes('apt')) severity = 'critical';
    else if (tags.includes('vulnerability') || tags.includes('malware')) severity = 'high';
    else if (tags.includes('data-breach') || tags.includes('phishing')) severity = 'medium';
    else severity = 'low';
    return { tags: tags.length ? tags : ['general'], severity };
  }

  // In-memory cache for threat advisor articles
  let advisorCache: { articles: any[]; lastFetched: string | null } = { articles: [], lastFetched: null };

  async function fetchThreatAdvisorArticles(): Promise<any[]> {
    const articles: any[] = [];
    const fetchPromises = THREAT_NEWS_SOURCES.map(async (source) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(source.rssUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'OpenCTI/3.0 ThreatAdvisor' },
        });
        clearTimeout(timeout);
        if (!res.ok) return;
        const text = await res.text();
        const items = extractItems(text);
        for (const item of items) {
          const enrichment = enrichArticle(item);
          articles.push({
            source: source.name,
            sourceSlug: source.slug,
            sourceUrl: source.website,
            title: item.title,
            link: item.link,
            description: item.description,
            pubDate: item.pubDate,
            ...enrichment,
          });
        }
      } catch {}
    });
    await Promise.all(fetchPromises);
    // Sort by date (most recent first)
    articles.sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return db - da;
    });
    return articles;
  }

  // List sources
  app.get("/api/threat-advisor/sources", (_req, res) => {
    res.json(THREAT_NEWS_SOURCES.map(s => ({ name: s.name, slug: s.slug, website: s.website })));
  });

  // Fetch all articles
  app.get("/api/threat-advisor/articles", async (req, res) => {
    const { refresh, severity, source: srcFilter } = req.query;
    const now = Date.now();
    const cacheAge = advisorCache.lastFetched ? now - new Date(advisorCache.lastFetched).getTime() : Infinity;
    // Refresh if cache is older than 10 min or force refresh requested
    if (refresh === 'true' || cacheAge > 600000 || advisorCache.articles.length === 0) {
      advisorCache.articles = await fetchThreatAdvisorArticles();
      advisorCache.lastFetched = new Date().toISOString();
    }
    let articles = advisorCache.articles;
    if (severity) articles = articles.filter(a => a.severity === severity);
    if (srcFilter) articles = articles.filter(a => a.sourceSlug === srcFilter);
    res.json({
      articles,
      total: articles.length,
      sources: THREAT_NEWS_SOURCES.length,
      lastFetched: advisorCache.lastFetched,
    });
  });

  // Email notification endpoint (stores subscriber emails in memory)
  const subscribers: Set<string> = new Set();

  app.post("/api/threat-advisor/subscribe", (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: "Valid email required" });
    subscribers.add(email);
    res.json({ success: true, message: `Subscribed ${email} to threat advisories`, totalSubscribers: subscribers.size });
  });

  app.delete("/api/threat-advisor/subscribe", (req, res) => {
    const { email } = req.body;
    subscribers.delete(email);
    res.json({ success: true, message: "Unsubscribed" });
  });

  app.get("/api/threat-advisor/subscribers", (_req, res) => {
    res.json({ subscribers: Array.from(subscribers), total: subscribers.size });
  });

  // Generate HTML advisory email report
  app.get("/api/threat-advisor/report", async (_req, res) => {
    // Ensure we have articles
    if (advisorCache.articles.length === 0) {
      advisorCache.articles = await fetchThreatAdvisorArticles();
      advisorCache.lastFetched = new Date().toISOString();
    }

    const articles = advisorCache.articles;

    // Filter to last 24 hours only
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentArticles = articles.filter(a => {
      if (!a.pubDate) return false;
      try {
        return new Date(a.pubDate).toISOString() >= oneDayAgo;
      } catch { return false; }
    });
    // Fall back to all articles if none are from today
    const reportArticles = recentArticles.length > 0 ? recentArticles : articles.slice(0, 20);

    // Sort by severity (critical first, then high, medium, low)
    const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    reportArticles.sort((a, b) => (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4));

    const criticalArticles = reportArticles.filter(a => a.severity === 'critical');
    const highArticles = reportArticles.filter(a => a.severity === 'high');
    const mediumArticles = reportArticles.filter(a => a.severity === 'medium');
    const lowArticles = reportArticles.filter(a => a.severity === 'low');

    // Pick the top threat for the main advisory
    const topThreat = criticalArticles[0] || highArticles[0] || reportArticles[0];
    if (!topThreat) {
      return res.status(404).json({ error: "No articles available for report" });
    }

    const publishedDate = topThreat.pubDate ? new Date(topThreat.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    const severityColor = topThreat.severity === 'critical' ? '#c0392b' : topThreat.severity === 'high' ? '#e67e22' : '#27ae60';
    const severityLabel = topThreat.severity.charAt(0).toUpperCase() + topThreat.severity.slice(1);

    // Build IOC summary from our loaded indicators
    const indicators = await storage.getIndicators({ limit: 10 });
    const iocSummary = indicators.items.slice(0, 5).map(i => `${i.type.toUpperCase()}: ${i.value}`).join('<br/>');

    // Collect source references
    const sourceLinks = reportArticles.slice(0, 5).map(a => 
      `<a href="${a.link}" style="color: #2980b9; text-decoration: underline;">${a.link}</a>`
    ).join('<br/>');

    // Build recommended actions from tags
    const allTags = new Set<string>();
    reportArticles.slice(0, 20).forEach(a => a.tags?.forEach((t: string) => allTags.add(t)));
    const recommendedActions: string[] = [
      'Ensure all security controls are updated with the mentioned IOCs and blocked.',
      'Verify all system dependencies and avoid installing packages from unknown or suspicious publishers.',
      'Revoke and rotate all potentially exposed CI/CD tokens, API keys, and developer credentials.',
      'Enforce dependency pinning and restrict installation of packages with external URL-based dependencies.',
      'Continuously monitor endpoints for unauthorized exfiltration or WebSocket activity.',
    ];
    if (allTags.has('ransomware')) recommendedActions.push('Review and test backup/restore procedures for all critical systems.');
    if (allTags.has('phishing')) recommendedActions.push('Alert employees about ongoing phishing campaigns and reinforce email security awareness.');
    if (allTags.has('vulnerability')) recommendedActions.push('Prioritize patching for all identified vulnerabilities, especially those with active exploits.');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background:#f4f4f4; font-family: Arial, Helvetica, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="700" cellpadding="0" cellspacing="0" style="background:#ffffff; border: 1px solid #ddd;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1a3a4a, #0d5c3f); padding: 18px 24px;">
              <h2 style="margin:0; color:#2ecc71; font-size:16px; font-weight:bold;">OpenCTI — Cyber Threat Intelligence</h2>
            </td>
          </tr>
          <tr>
            <td style="background:#c0392b; padding: 14px 24px;">
              <h3 style="margin:0; color:#ffffff; font-size:14px; font-weight:bold;">Daily Threat Digest — ${topThreat.title}</h3>
            </td>
          </tr>

          <!-- Metadata Table -->
          <tr>
            <td style="padding: 20px 24px 0;">
              <table width="100%" cellpadding="6" cellspacing="0" style="border: 1px solid #ddd; border-collapse: collapse; font-size: 12px;">
                <tr>
                  <td style="border: 1px solid #ddd; background:#f8f9fa; font-weight:bold; width:20%;">Threat Type</td>
                  <td style="border: 1px solid #ddd; width:30%;">${topThreat.tags?.[0] || 'General Threat'}</td>
                  <td style="border: 1px solid #ddd; background:#f8f9fa; font-weight:bold; width:20%;">Threat Name</td>
                  <td style="border: 1px solid #ddd; width:30%;">${topThreat.title.substring(0, 60)}${topThreat.title.length > 60 ? '...' : ''}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #ddd; background:#f8f9fa; font-weight:bold;">Published Date</td>
                  <td style="border: 1px solid #ddd;">${publishedDate}</td>
                  <td style="border: 1px solid #ddd; background:#f8f9fa; font-weight:bold;">Severity</td>
                  <td style="border: 1px solid #ddd;"><span style="background:${severityColor}; color:#fff; padding:2px 8px; border-radius:3px; font-size:11px; font-weight:bold;">${severityLabel}</span></td>
                </tr>
                <tr>
                  <td style="border: 1px solid #ddd; background:#f8f9fa; font-weight:bold;">Source</td>
                  <td style="border: 1px solid #ddd;">${topThreat.source}</td>
                  <td style="border: 1px solid #ddd; background:#f8f9fa; font-weight:bold;">Impacted Sector</td>
                  <td style="border: 1px solid #ddd;">Global</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Threat Overview -->
          <tr>
            <td style="padding: 16px 24px 0;">
              <table width="100%" cellpadding="8" cellspacing="0" style="border: 1px solid #ddd; border-collapse: collapse; font-size: 12px;">
                <tr>
                  <td style="border: 1px solid #ddd; background:#f8f9fa; font-weight:bold; vertical-align:top; width:20%;">Threat Overview</td>
                  <td style="border: 1px solid #ddd; line-height:1.6;">
                    ${topThreat.description || 'No detailed description available.'}
                    <br/><br/>
                    <strong>Additional intelligence from OpenCTI:</strong> This daily digest consolidates data from ${reportArticles.length} articles across ${new Set(reportArticles.map((a: any) => a.source)).size} cybersecurity news sources.
                    Currently tracking <strong>${criticalArticles.length} critical</strong>, <strong>${highArticles.length} high</strong>, <strong>${mediumArticles.length} medium</strong>, and <strong>${lowArticles.length} low</strong> severity advisories.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Recommended Actions -->
          <tr>
            <td style="padding: 16px 24px 0;">
              <table width="100%" cellpadding="8" cellspacing="0" style="border: 1px solid #ddd; border-collapse: collapse; font-size: 12px;">
                <tr>
                  <td style="border: 1px solid #ddd; background:#f8f9fa; font-weight:bold; vertical-align:top; width:20%;">Recommended Actions</td>
                  <td style="border: 1px solid #ddd; line-height:1.8;">
                    <ul style="margin:0; padding-left:18px;">
                      ${recommendedActions.map(a => `<li>${a}</li>`).join('')}
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Related Threats -->
          <tr>
            <td style="padding: 16px 24px 0;">
              <table width="100%" cellpadding="8" cellspacing="0" style="border: 1px solid #ddd; border-collapse: collapse; font-size: 12px;">
                <tr>
                  <td style="border: 1px solid #ddd; background:#f8f9fa; font-weight:bold; vertical-align:top; width:20%;">Related Threats</td>
                  <td style="border: 1px solid #ddd; line-height:1.8;">
                    ${reportArticles.slice(1, 10).map((a: any) => {
                      const sColor = a.severity === 'critical' ? '#c0392b' : a.severity === 'high' ? '#e67e22' : a.severity === 'medium' ? '#27ae60' : '#3498db';
                      return `<div style="margin-bottom:8px;"><span style="background:${sColor}; color:#fff; padding:1px 6px; border-radius:2px; font-size:10px; font-weight:bold; margin-right:6px;">${a.severity.toUpperCase()}</span> <a href="${a.link}" style="color:#2c3e50; text-decoration:none;">${a.title}</a> <span style="color:#999; font-size:11px;">(${a.source})</span></div>`;
                    }).join('')}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${iocSummary ? `
          <!-- Active IOCs -->
          <tr>
            <td style="padding: 16px 24px 0;">
              <table width="100%" cellpadding="8" cellspacing="0" style="border: 1px solid #ddd; border-collapse: collapse; font-size: 12px;">
                <tr>
                  <td style="border: 1px solid #ddd; background:#f8f9fa; font-weight:bold; vertical-align:top; width:20%;">Active IOCs</td>
                  <td style="border: 1px solid #ddd; font-family: 'Courier New', monospace; font-size: 11px; line-height:1.8;">
                    ${iocSummary}
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- Source References -->
          <tr>
            <td style="padding: 16px 24px 0;">
              <table width="100%" cellpadding="8" cellspacing="0" style="border: 1px solid #ddd; border-collapse: collapse; font-size: 12px;">
                <tr>
                  <td style="border: 1px solid #ddd; background:#f8f9fa; font-weight:bold; vertical-align:top; width:20%;">Source References</td>
                  <td style="border: 1px solid #ddd; line-height:1.8; word-break:break-all;">
                    ${sourceLinks}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 24px;">
              <p style="margin:0; font-size:12px; color:#555;">Regards,<br/><strong>OpenCTI — Cyber Threat Intelligence Team</strong></p>
            </td>
          </tr>
          <tr>
            <td style="background: linear-gradient(135deg, #1a3a4a, #0d5c3f); padding: 12px 24px; text-align:right;">
              <span style="color: #2ecc71; font-size: 12px; font-weight: bold;">OpenCTI</span>
              <span style="color: #ffffff; font-size: 11px; margin-left: 8px;">Open Source Threat Intelligence</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 24px; text-align:right; background:#f8f9fa;">
              <span style="font-size:10px; color:#999;">This report was auto-generated by OpenCTI Threat Advisor</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    res.json({
      html,
      subject: `OpenCTI Daily Advisory — ${new Date().toLocaleDateString()} — ${criticalArticles.length} Critical, ${highArticles.length} High`,
      summary: {
        totalArticles: reportArticles.length,
        critical: criticalArticles.length,
        high: highArticles.length,
        medium: mediumArticles.length,
        low: lowArticles.length,
        topThreat: topThreat.title,
        severity: topThreat.severity,
      },
      subscribers: Array.from(subscribers),
    });
  });

  // ============ SETTINGS ============
  app.get("/api/settings", (_req, res) => {
    res.json(platformSettings);
  });

  app.patch("/api/settings", (req, res) => {
    const updates = req.body;
    platformSettings = { ...platformSettings, ...updates };
    if (updates.dataRetentionMonths) {
      const nextPurge = new Date();
      nextPurge.setDate(nextPurge.getDate() + 1);
      platformSettings.nextPurge = nextPurge.toISOString();
    }
    res.json(platformSettings);
  });

  app.post("/api/settings/purge", async (_req, res) => {
    const retentionMonths = platformSettings.dataRetentionMonths || 3;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - retentionMonths);
    const cutoffStr = cutoff.toISOString();
    const purged = await storage.purgeOldIndicators(cutoffStr);
    platformSettings.lastPurge = new Date().toISOString();
    res.json({ purged, cutoff: cutoffStr });
  });

  // Auto-purge timer
  setInterval(async () => {
    const retentionMonths = platformSettings.dataRetentionMonths || 3;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - retentionMonths);
    await storage.purgeOldIndicators(cutoff.toISOString());
    platformSettings.lastPurge = new Date().toISOString();
  }, 24 * 60 * 60 * 1000);

  // Auto-fetch feeds every 15 minutes
  async function autoFetchAllFeeds() {
    try {
      const feeds = await storage.getFeeds();
      const enabled = feeds.filter(f => f.enabled);
      let totalNew = 0;
      for (const feed of enabled) {
        try {
          await storage.updateFeed(feed.id, { status: "fetching" });
          const indicators = await fetchAndParseFeed(feed.slug, feed.url, feed.category);
          await storage.deleteIndicatorsBySource(feed.slug);
          const count = await storage.createIndicatorsBatch(indicators);
          await storage.updateFeed(feed.id, { status: "success", lastFetched: new Date().toISOString(), iocCount: count, errorMessage: null });
          totalNew += count;
        } catch (error: any) {
          await storage.updateFeed(feed.id, { status: "error", errorMessage: error.message });
        }
      }
      // Clear geo cache so map refreshes with new IPs
      geoCache = { data: [], timestamp: 0 };
      console.log(`[auto-sync] Fetched ${enabled.length} feeds, ${totalNew} indicators`);
    } catch (err) {
      console.error("[auto-sync] Error:", err);
    }
  }

  // Run initial fetch 30 seconds after startup, then every 15 minutes
  setTimeout(() => autoFetchAllFeeds(), 30 * 1000);
  setInterval(() => autoFetchAllFeeds(), 15 * 60 * 1000);

  // ============ GEO THREAT MAP ============
  app.get("/api/dashboard/geo", async (_req, res) => {
    const now = Date.now();
    if (geoCache.data.length > 0 && now - geoCache.timestamp < GEO_CACHE_TTL) {
      return res.json(geoCache.data);
    }

    try {
      const { items } = await storage.getIndicators({ limit: 500 });
      const ipIndicators = items.filter(i => i.type === "ip" && i.value && !i.value.includes(":"));
      const uniqueIps = [...new Set(ipIndicators.map(i => i.value))].slice(0, 100);

      if (uniqueIps.length === 0) {
        geoCache = { data: [], timestamp: now };
        return res.json([]);
      }

      // Batch lookup using ip-api.com (free, up to 100 per request, 15 req/min)
      const batchBody = uniqueIps.map(ip => ({ query: ip, fields: "query,country,countryCode,city,lat,lon,status" }));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const geoRes = await fetch("http://ip-api.com/batch?fields=query,country,countryCode,city,lat,lon,status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batchBody),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const geoResults = await geoRes.json();

      // Map severity from our indicators
      const ipSeverityMap = new Map<string, { severity: string; source: string }>();
      ipIndicators.forEach(i => {
        if (!ipSeverityMap.has(i.value)) {
          ipSeverityMap.set(i.value, { severity: i.severity, source: i.source });
        }
      });

      const mapped = geoResults
        .filter((g: any) => g.status === "success" && g.lat && g.lon)
        .map((g: any) => ({
          ip: g.query,
          lat: g.lat,
          lon: g.lon,
          country: g.country,
          city: g.city || "Unknown",
          severity: ipSeverityMap.get(g.query)?.severity || "medium",
          source: ipSeverityMap.get(g.query)?.source || "unknown",
        }));

      geoCache = { data: mapped, timestamp: now };
      res.json(mapped);
    } catch (err) {
      console.error("Geo lookup error:", err);
      res.json(geoCache.data.length > 0 ? geoCache.data : []);
    }
  });

  // ============ EMAIL / SMTP ============

  // Test SMTP connection
  app.post("/api/settings/smtp-test", async (req, res) => {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFromEmail } = platformSettings;
    if (!smtpHost || !smtpUser) {
      return res.status(400).json({ error: "SMTP host and username are required. Configure them in Settings first." });
    }
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort || 587,
        secure: smtpSecure || false,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
      });
      await transporter.verify();
      res.json({ success: true, message: "SMTP connection verified successfully" });
    } catch (err: any) {
      res.status(400).json({ error: `SMTP connection failed: ${err.message}` });
    }
  });

  // Send advisory report via email
  app.post("/api/threat-advisor/send-report", async (req, res) => {
    const { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFromEmail, smtpFromName } = platformSettings;
    if (!smtpHost || !smtpUser) {
      return res.status(400).json({ error: "SMTP not configured. Go to Settings to set up your email server." });
    }

    const subscriberList = Array.from(subscribers);
    if (subscriberList.length === 0) {
      return res.status(400).json({ error: "No subscribers. Add subscriber emails from the Threat Advisor page first." });
    }

    try {
      // Generate the report HTML
      if (advisorCache.articles.length === 0) {
        advisorCache.articles = await fetchThreatAdvisorArticles();
        advisorCache.lastFetched = new Date().toISOString();
      }
      const articles = advisorCache.articles;
      const topThreat = articles.find(a => a.severity === 'critical') || articles.find(a => a.severity === 'high') || articles[0];
      if (!topThreat) {
        return res.status(404).json({ error: "No articles available for report" });
      }

      // Fetch the full report HTML from our own endpoint
      const reportUrl = `http://127.0.0.1:${process.env.PORT || 5000}/api/threat-advisor/report`;
      const reportRes = await fetch(reportUrl);
      const reportData = await reportRes.json();
      const html = reportData.html;
      const subject = reportData.subject || `OpenCTI Security Advisory — ${topThreat.title}`;

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort || 587,
        secure: smtpSecure || false,
        auth: { user: smtpUser, pass: smtpPass },
        connectionTimeout: 15000,
      });

      // Send to all subscribers
      const results: Array<{ email: string; status: string; error?: string }> = [];
      for (const email of subscriberList) {
        try {
          await transporter.sendMail({
            from: `"${smtpFromName}" <${smtpFromEmail || smtpUser}>`,
            to: email,
            subject,
            html,
          });
          results.push({ email, status: "sent" });
        } catch (err: any) {
          results.push({ email, status: "failed", error: err.message });
        }
      }

      const sent = results.filter(r => r.status === "sent").length;
      const failed = results.filter(r => r.status === "failed").length;
      res.json({ success: true, sent, failed, total: subscriberList.length, results });
    } catch (err: any) {
      res.status(500).json({ error: `Failed to send report: ${err.message}` });
    }
  });

  // ============ SYSTEM INFO ============
  app.get("/api/system/info", async (_req, res) => {
    const feeds = await storage.getFeeds();
    const users = await storage.getUser(1); // just check if we can get users
    const totalIocs = feeds.reduce((sum, f) => sum + f.iocCount, 0);
    res.json({
      version: "3.0.0",
      totalIocs,
      totalFeeds: feeds.length,
      uptime: process.uptime(),
    });
  });
}
