import type { User, InsertUser, Feed, InsertFeed, Indicator, InsertIndicator, Search, InsertSearch, Stat, InsertStat } from "@shared/schema";
import crypto from "crypto";

// Password hashing helpers
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashToVerify = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(hashToVerify, "hex"));
}

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByApiKey(key: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  generateApiKey(userId: number): Promise<string>;
  // Feeds
  getFeeds(): Promise<Feed[]>;
  getFeed(id: number): Promise<Feed | undefined>;
  getFeedBySlug(slug: string): Promise<Feed | undefined>;
  createFeed(feed: InsertFeed): Promise<Feed>;
  updateFeed(id: number, updates: Partial<Feed>): Promise<Feed | undefined>;
  deleteFeed(id: number): Promise<boolean>;
  // Indicators
  getIndicators(filters?: { type?: string; source?: string; severity?: string; search?: string; limit?: number; offset?: number }): Promise<{ items: Indicator[]; total: number }>;
  getIndicator(id: number): Promise<Indicator | undefined>;
  createIndicator(indicator: InsertIndicator): Promise<Indicator>;
  createIndicatorsBatch(indicators: InsertIndicator[]): Promise<number>;
  deleteIndicatorsBySource(source: string): Promise<number>;
  getIndicatorByValue(value: string, type: string): Promise<Indicator | undefined>;
  // Searches
  getSearches(limit?: number): Promise<Search[]>;
  createSearch(search: InsertSearch): Promise<Search>;
  // Stats
  getStat(key: string): Promise<Stat | undefined>;
  setStat(key: string, value: string): Promise<void>;
  getStats(): Promise<Stat[]>;
  // Aggregations
  getIndicatorCountByType(): Promise<Record<string, number>>;
  getIndicatorCountBySeverity(): Promise<Record<string, number>>;
  getIndicatorCountBySource(): Promise<Record<string, number>>;
  getRecentIndicators(limit?: number): Promise<Indicator[]>;
  purgeOldIndicators(cutoffDate: string): Promise<number>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private feeds: Map<number, Feed> = new Map();
  private indicators: Map<number, Indicator> = new Map();
  private searches: Map<number, Search> = new Map();
  private statsMap: Map<string, Stat> = new Map();
  private userId = 1;
  private feedId = 1;
  private indicatorId = 1;
  private searchId = 1;
  private statId = 1;

  constructor() {
    this.seedFeeds();
    // Create admin user (local login only)
    this.createUser({
      email: "admin@opencti.local",
      name: "Administrator",
      provider: "local",
      role: "admin",
      password: process.env.ADMIN_PASSWORD || "admin123",
      createdAt: new Date().toISOString(),
    });
    // Create demo user
    this.createUser({ email: "demo@opencti.local", name: "Demo User", provider: "email", role: "user", createdAt: new Date().toISOString() });
  }

  private seedFeeds() {
    const defaultFeeds: InsertFeed[] = [
      { name: "Abuse.ch URLhaus", slug: "urlhaus", category: "url", url: "https://urlhaus.abuse.ch/downloads/csv_recent/", description: "Malicious URLs used for malware distribution. Updated every 5 minutes.", enabled: true, status: "idle", iocCount: 0, isCustom: false },
      { name: "Abuse.ch Feodo Tracker", slug: "feodotracker", category: "ip", url: "https://feodotracker.abuse.ch/downloads/ipblocklist_recommended.txt", description: "Botnet C2 IP blocklist. Tracks Dridex, Emotet, TrickBot, QakBot.", enabled: true, status: "idle", iocCount: 0, isCustom: false },
      { name: "Abuse.ch SSL Blacklist", slug: "sslbl", category: "ip", url: "https://sslbl.abuse.ch/blacklist/sslipblacklist.csv", description: "SSL certificates associated with botnet C2 servers.", enabled: true, status: "idle", iocCount: 0, isCustom: false },
      { name: "Abuse.ch ThreatFox", slug: "threatfox", category: "mixed", url: "https://threatfox.abuse.ch/export/csv/recent/", description: "IOCs from malware including C2 infrastructure.", enabled: true, status: "idle", iocCount: 0, isCustom: false },
      { name: "Blocklist.de All Attacks", slug: "blocklist-de", category: "ip", url: "https://lists.blocklist.de/lists/all.txt", description: "All IPs reported within the last 48 hours as attack sources.", enabled: true, status: "idle", iocCount: 0, isCustom: false },
      { name: "C2 IntelFeeds", slug: "c2-intel", category: "ip", url: "https://raw.githubusercontent.com/drb-ra/C2IntelFeeds/master/feeds/IPC2s-30day.csv", description: "Command and Control server IP addresses.", enabled: true, status: "idle", iocCount: 0, isCustom: false },
      { name: "OpenPhish", slug: "openphish", category: "url", url: "https://openphish.com/feed.txt", description: "Verified phishing URLs detected by OpenPhish.", enabled: true, status: "idle", iocCount: 0, isCustom: false },
      { name: "DigitalSide Threat-Intel", slug: "digitalside", category: "url", url: "https://raw.githubusercontent.com/davidonzo/Threat-Intel/master/lists/latesturls.txt", description: "OSINT-based malware distribution URLs.", enabled: true, status: "idle", iocCount: 0, isCustom: false },
      { name: "Emerging Threats", slug: "et-compromised", category: "ip", url: "https://rules.emergingthreats.net/blockrules/compromised-ips.txt", description: "Known compromised IPs from ProofPoint.", enabled: true, status: "idle", iocCount: 0, isCustom: false },
      { name: "CINSscore Bad IPs", slug: "cinsscore", category: "ip", url: "https://cinsscore.com/list/ci-badguys.txt", description: "Most active bad IPs from Sentinel IPS.", enabled: true, status: "idle", iocCount: 0, isCustom: false },
      { name: "MalwareBazaar", slug: "malwarebazaar", category: "hash_sha256", url: "https://bazaar.abuse.ch/export/csv/recent/", description: "Recent malware samples with SHA256 hashes.", enabled: true, status: "idle", iocCount: 0, isCustom: false },
      { name: "Disposable Email Domains", slug: "disposable-email", category: "domain", url: "https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf", description: "Known disposable/temporary email domains.", enabled: false, status: "idle", iocCount: 0, isCustom: false },
      { name: "AlienVault OTX", slug: "otx-alienvault", category: "mixed", url: "https://otx.alienvault.com/api/v1/pulses/subscribed", description: "AlienVault Open Threat Exchange - community-driven threat data.", enabled: true, status: "idle", iocCount: 0, isCustom: false },
    ];
    for (const feed of defaultFeeds) this.createFeed(feed);
  }

  // Users
  async getUser(id: number) { return this.users.get(id); }
  async getUserByEmail(email: string) { return Array.from(this.users.values()).find(u => u.email === email); }
  async getUserByApiKey(key: string) { return Array.from(this.users.values()).find(u => u.apiKey === key); }
  async createUser(user: InsertUser): Promise<User> {
    const id = this.userId++;
    const newUser: User = { id, email: user.email, name: user.name ?? null, provider: user.provider ?? "email", avatarUrl: user.avatarUrl ?? null, apiKey: null, role: user.role ?? "user", password: user.password ? hashPassword(user.password) : null, createdAt: user.createdAt };
    this.users.set(id, newUser);
    return newUser;
  }
  async generateApiKey(userId: number): Promise<string> {
    const user = this.users.get(userId);
    if (!user) throw new Error("User not found");
    const key = "octi_" + crypto.randomBytes(24).toString("hex");
    this.users.set(userId, { ...user, apiKey: key });
    return key;
  }

  // Feeds
  async getFeeds() { return Array.from(this.feeds.values()); }
  async getFeed(id: number) { return this.feeds.get(id); }
  async getFeedBySlug(slug: string) { return Array.from(this.feeds.values()).find(f => f.slug === slug); }
  async createFeed(feed: InsertFeed): Promise<Feed> {
    const id = this.feedId++;
    const f: Feed = { id, name: feed.name, slug: feed.slug, category: feed.category, url: feed.url, description: feed.description ?? null, enabled: feed.enabled ?? true, lastFetched: feed.lastFetched ?? null, iocCount: feed.iocCount ?? 0, status: feed.status ?? "idle", errorMessage: feed.errorMessage ?? null, isCustom: feed.isCustom ?? false, addedBy: feed.addedBy ?? null };
    this.feeds.set(id, f);
    return f;
  }
  async updateFeed(id: number, updates: Partial<Feed>) {
    const feed = this.feeds.get(id);
    if (!feed) return undefined;
    const updated = { ...feed, ...updates };
    this.feeds.set(id, updated);
    return updated;
  }
  async deleteFeed(id: number) { return this.feeds.delete(id); }

  // Indicators
  async getIndicators(filters?: { type?: string; source?: string; severity?: string; search?: string; limit?: number; offset?: number }) {
    let items = Array.from(this.indicators.values());
    if (filters?.type) items = items.filter(i => i.type === filters.type);
    if (filters?.source) items = items.filter(i => i.source === filters.source);
    if (filters?.severity) items = items.filter(i => i.severity === filters.severity);
    if (filters?.search) { const s = filters.search.toLowerCase(); items = items.filter(i => i.value.toLowerCase().includes(s) || (i.description && i.description.toLowerCase().includes(s))); }
    const total = items.length;
    items.sort((a, b) => b.id - a.id);
    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 50;
    items = items.slice(offset, offset + limit);
    return { items, total };
  }
  async getIndicator(id: number) { return this.indicators.get(id); }
  async createIndicator(ind: InsertIndicator): Promise<Indicator> {
    const id = this.indicatorId++;
    const i: Indicator = { id, type: ind.type, value: ind.value, source: ind.source, severity: ind.severity ?? "medium", confidence: ind.confidence ?? 50, tags: ind.tags ?? null, firstSeen: ind.firstSeen, lastSeen: ind.lastSeen, description: ind.description ?? null, metadata: ind.metadata ?? null, active: ind.active ?? true };
    this.indicators.set(id, i);
    return i;
  }
  async createIndicatorsBatch(indicators: InsertIndicator[]): Promise<number> {
    let count = 0;
    for (const ind of indicators) { await this.createIndicator(ind); count++; }
    return count;
  }
  async deleteIndicatorsBySource(source: string): Promise<number> {
    let count = 0;
    for (const [id, ind] of this.indicators) { if (ind.source === source) { this.indicators.delete(id); count++; } }
    return count;
  }
  async getIndicatorByValue(value: string, type: string) { return Array.from(this.indicators.values()).find(i => i.value === value && i.type === type); }

  // Searches
  async getSearches(limit = 20) { return Array.from(this.searches.values()).sort((a, b) => b.id - a.id).slice(0, limit); }
  async createSearch(search: InsertSearch): Promise<Search> {
    const id = this.searchId++;
    const s: Search = { id, ...search } as Search;
    this.searches.set(id, s);
    return s;
  }

  // Stats
  async getStat(key: string) { return this.statsMap.get(key); }
  async setStat(key: string, value: string) {
    const existing = this.statsMap.get(key);
    if (existing) { this.statsMap.set(key, { ...existing, value, updatedAt: new Date().toISOString() }); } else { const id = this.statId++; this.statsMap.set(key, { id, key, value, updatedAt: new Date().toISOString() }); }
  }
  async getStats() { return Array.from(this.statsMap.values()); }

  // Aggregations
  async getIndicatorCountByType() { const c: Record<string, number> = {}; for (const i of this.indicators.values()) c[i.type] = (c[i.type] || 0) + 1; return c; }
  async getIndicatorCountBySeverity() { const c: Record<string, number> = {}; for (const i of this.indicators.values()) c[i.severity] = (c[i.severity] || 0) + 1; return c; }
  async getIndicatorCountBySource() { const c: Record<string, number> = {}; for (const i of this.indicators.values()) c[i.source] = (c[i.source] || 0) + 1; return c; }
  async getRecentIndicators(limit = 20) { return Array.from(this.indicators.values()).sort((a, b) => b.id - a.id).slice(0, limit); }

  async purgeOldIndicators(cutoffDate: string): Promise<number> {
    let count = 0;
    for (const [id, ind] of this.indicators) {
      if (ind.firstSeen < cutoffDate) {
        this.indicators.delete(id);
        count++;
      }
    }
    return count;
  }
}

export const storage = new MemStorage();
