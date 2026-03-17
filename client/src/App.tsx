import { Switch, Route, Router, Link, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Landing from "@/pages/landing";
import Auth from "@/pages/auth";
import Dashboard from "@/pages/dashboard";
import Feeds from "@/pages/feeds";
import Indicators from "@/pages/indicators";
import Lookup from "@/pages/lookup";
import ApiAccess from "@/pages/api-access";
import ThreatAdvisor from "@/pages/threat-advisor";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import {
  LayoutDashboard,
  Rss,
  Database,
  Search,
  Key,
  Sun,
  Moon,
  LogOut,
  Shield,
  Brain,
  Settings as SettingsIcon,
} from "lucide-react";
import { useState, useEffect, createContext, useContext } from "react";
import type { User } from "@shared/schema";

// Auth context
interface AuthCtx {
  user: User | null;
  setUser: (u: User | null) => void;
  logout: () => void;
}
export const AuthContext = createContext<AuthCtx>({
  user: null,
  setUser: () => {},
  logout: () => {},
});
export function useAuth() {
  return useContext(AuthContext);
}

// Logo SVG
function AppLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      aria-label="OpenCTI logo"
      className="shrink-0"
    >
      <path
        d="M16 2L4 8v8c0 7.18 5.12 13.88 12 16 6.88-2.12 12-8.82 12-16V8L16 2z"
        stroke="hsl(160 75% 45%)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="15" r="4" stroke="hsl(160 75% 45%)" strokeWidth="2" />
      <path
        d="M16 11V6M16 24v-5M10 15H6m20 0h-4"
        stroke="hsl(160 75% 45%)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

// Icon-only sidebar matching reference
function IconSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/feeds", icon: Rss, label: "Feeds" },
    { href: "/indicators", icon: Database, label: "IOCs" },
    { href: "/lookup", icon: Search, label: "Lookup" },
    { href: "/threat-advisor", icon: Brain, label: "Advisor" },
    { href: "/api-access", icon: Key, label: "API" },
  ];

  // Add settings nav item for admin users
  if (user?.role === "admin") {
    navItems.push({ href: "/settings", icon: SettingsIcon, label: "Settings" });
  }

  return (
    <aside
      className="w-16 h-screen border-r border-border bg-sidebar flex flex-col items-center shrink-0"
      data-testid="sidebar"
    >
      <div className="flex items-center justify-center h-14 border-b border-sidebar-border w-full">
        <AppLogo size={24} />
      </div>

      <nav className="flex-1 flex flex-col items-center gap-1 pt-4 w-full px-2">
        {navItems.map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== "/dashboard" && location.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`relative w-10 h-10 flex items-center justify-center rounded cursor-pointer transition-colors group ${
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover border border-border text-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-md">
                  {item.label}
                </div>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="pb-4 flex flex-col items-center gap-2">
        <Shield size={16} className="text-sidebar-foreground/40" />
      </div>
    </aside>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <button
      onClick={() => setDark(!dark)}
      className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      data-testid="theme-toggle"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <IconSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-border flex items-center justify-between px-6 shrink-0 bg-background">
          <div className="text-sm text-muted-foreground">
            {user && (
              <span>
                Signed in as <span className="text-foreground font-medium">{user.name || user.email}</span>
                {user.role === "admin" && (
                  <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary">Admin</span>
                )}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {user && (
              <button
                onClick={logout}
                className="p-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Sign out"
                data-testid="logout-btn"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </header>
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ overscrollBehavior: "contain" }}
        >
          <Switch>
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/feeds" component={Feeds} />
            <Route path="/indicators" component={Indicators} />
            <Route path="/lookup" component={Lookup} />
            <Route path="/threat-advisor" component={ThreatAdvisor} />
            <Route path="/api-access" component={ApiAccess} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  const logout = () => {
    setUser(null);
    window.location.hash = "#/";
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      <QueryClientProvider client={queryClient}>
        <Router hook={useHashLocation}>
          <Switch>
            <Route path="/" component={Landing} />
            <Route path="/auth" component={Auth} />
            <Route>{() => <AppLayout />}</Route>
          </Switch>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthContext.Provider>
  );
}

export default App;
