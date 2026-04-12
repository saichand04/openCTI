import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/App";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SiGoogle, SiGithub } from "react-icons/si";

function MicrosoftIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" fill="none">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}
import { Mail, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"user" | "admin">("user");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const { setUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const endpoint = isSignUp ? "/api/auth/signup" : "/api/auth/signin";
      const body: any = { email: email.trim(), provider: "email" };
      if (isSignUp && name.trim()) body.name = name.trim();
      const res = await apiRequest("POST", endpoint, body);
      const data = await res.json();
      const user = data.user || data;
      setUser(user);
      toast({ title: isSignUp ? "Account created" : "Signed in", description: `Welcome, ${user.name || user.email}` });
      setLocation("/dashboard");
    } catch (err: any) {
      if (isSignUp && err.message?.includes("409")) {
        try {
          const res = await apiRequest("POST", "/api/auth/signin", { email: email.trim(), provider: "email" });
          const user = await res.json();
          setUser(user);
          toast({ title: "Signed in", description: `Welcome back, ${user.name || user.email}` });
          setLocation("/dashboard");
          return;
        } catch {}
      }
      toast({ title: "Error", description: err.message || "Authentication failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername.trim() || !adminPassword.trim()) return;
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/admin-login", {
        username: adminUsername.trim(),
        password: adminPassword.trim(),
      });
      const user = await res.json();
      setUser(user);
      toast({ title: "Admin signed in", description: `Welcome, ${user.name || user.email}` });
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Invalid credentials", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: string) => {
    setLoading(true);
    try {
      const demoEmail = `user@${provider === "google" ? "gmail.com" : provider === "github" ? "github.com" : "outlook.com"}`;
      const res = await apiRequest("POST", "/api/auth/signin", { email: demoEmail, provider });
      const user = await res.json();
      setUser(user);
      toast({ title: "Signed in", description: `Welcome via ${provider}` });
      setLocation("/dashboard");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-10 hero-grid relative">
        <div className="relative z-10">
          <button
            onClick={() => setLocation("/")}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-12"
            data-testid="back-home"
          >
            <ArrowLeft size={14} /> Back to home
          </button>
          <div className="flex items-center gap-2.5 mb-8">
            <svg viewBox="0 0 32 32" width="32" height="32" fill="none">
              <path d="M16 2L4 8v8c0 7.18 5.12 13.88 12 16 6.88-2.12 12-8.82 12-16V8L16 2z" stroke="hsl(160 75% 45%)" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="16" cy="15" r="4" stroke="hsl(160 75% 45%)" strokeWidth="2" />
            </svg>
            <span className="font-bold text-lg">OpenCTI</span>
          </div>
          <h2 className="text-2xl font-bold mb-3">
            <span className="gradient-text">Open Source</span>
            <br />
            Threat Intelligence
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
            Aggregate 12+ OSINT feeds, look up any IOC, and integrate via REST API.
            Your unified cyber threat intelligence platform.
          </p>
        </div>
        <div className="relative z-10 text-xs text-muted-foreground">
          Powered by open-source threat feeds
        </div>
      </div>

      {/* Right panel — form */}
      <div className="w-full lg:w-[480px] flex flex-col items-center justify-center px-6 lg:px-12 border-l border-border">
        <div className="w-full max-w-sm">
          <button
            onClick={() => setLocation("/")}
            className="lg:hidden inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft size={14} /> Back
          </button>

          {/* Auth mode toggle */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-muted mb-6">
            <button
              onClick={() => setAuthMode("user")}
              className={`flex-1 px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                authMode === "user" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="tab-user-login"
            >
              User Login
            </button>
            <button
              onClick={() => setAuthMode("admin")}
              className={`flex-1 px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                authMode === "admin" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="tab-admin-login"
            >
              Admin Login
            </button>
          </div>

          {authMode === "admin" ? (
            <>
              <h1 className="text-xl font-semibold mb-1 flex items-center gap-2">
                <ShieldCheck size={20} className="text-primary" />
                Admin Login
              </h1>
              <p className="text-sm text-muted-foreground mb-6">
                Sign in with your administrator credentials
              </p>

              <form onSubmit={handleAdminLogin} className="space-y-3">
                <div>
                  <label htmlFor="admin-username" className="text-xs font-medium text-muted-foreground mb-1 block">Email / Username</label>
                  <input
                    id="admin-username"
                    type="text"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="admin@opencti.local"
                    required
                    className="w-full px-3 py-2.5 rounded border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                    data-testid="input-admin-username"
                  />
                </div>
                <div>
                  <label htmlFor="admin-password" className="text-xs font-medium text-muted-foreground mb-1 block">Password</label>
                  <input
                    id="admin-password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Password"
                    required
                    className="w-full px-3 py-2.5 rounded border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                    data-testid="input-admin-password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !adminUsername.trim() || !adminPassword.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  data-testid="submit-admin-auth"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Sign In as Admin
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold mb-1">
                {isSignUp ? "Create an account" : "Welcome back"}
              </h1>
              <p className="text-sm text-muted-foreground mb-6">
                {isSignUp ? "Sign up to start monitoring threats" : "Sign in to your OpenCTI dashboard"}
              </p>

              {/* OAuth buttons */}
              <div className="space-y-2 mb-6">
                <button
                  onClick={() => handleOAuth("google")}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-full border border-border bg-card hover:bg-accent text-sm font-medium transition-colors"
                  data-testid="oauth-google"
                >
                  <SiGoogle size={16} /> Continue with Google (Demo)
                </button>
                <button
                  onClick={() => handleOAuth("github")}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-full border border-border bg-card hover:bg-accent text-sm font-medium transition-colors"
                  data-testid="oauth-github"
                >
                  <SiGithub size={16} /> Continue with GitHub (Demo)
                </button>
                <button
                  onClick={() => handleOAuth("microsoft")}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-full border border-border bg-card hover:bg-accent text-sm font-medium transition-colors"
                  data-testid="oauth-microsoft"
                >
                  <MicrosoftIcon size={16} /> Continue with Microsoft (Demo)
                </button>
              </div>

              <p className="text-[10px] text-muted-foreground text-center -mt-3 mb-4">
                OAuth buttons create demo accounts. Real OAuth integration coming soon.
              </p>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or continue with email</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Email form */}
              <form onSubmit={handleEmailAuth} className="space-y-3">
                {isSignUp && (
                  <div>
                    <label htmlFor="name" className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                    <input
                      id="name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-3 py-2.5 rounded border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                      data-testid="input-name"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="email" className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full px-3 py-2.5 rounded border border-border bg-card text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-shadow"
                    data-testid="input-email"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                  data-testid="submit-auth"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  {isSignUp ? "Create Account" : "Sign In"}
                </button>
              </form>

              <p className="text-center text-xs text-muted-foreground mt-6">
                {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-primary hover:underline font-medium"
                  data-testid="toggle-auth"
                >
                  {isSignUp ? "Sign in" : "Sign up"}
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
