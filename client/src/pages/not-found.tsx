import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
      <h1 className="text-xl font-semibold text-foreground mb-2">Page Not Found</h1>
      <p className="text-sm text-muted-foreground mb-6">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <button
        onClick={() => setLocation("/dashboard")}
        className="px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
