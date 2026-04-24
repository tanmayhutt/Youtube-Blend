import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Youtube } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const CompareJoin = () => {
  const { id } = useParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const joinComparison = async () => {
      try {
        // Backend will redirect directly to Google OAuth
        // We need to follow the redirect, so we'll redirect the window directly
        // The backend endpoint returns a 302 redirect to Google OAuth
        window.location.href = `${API_BASE}/compare/join/${id}`;
      } catch (err: any) {
        console.error("Error joining comparison:", err);
        setError(err.message || "Invalid or expired comparison link");
      }
    };

    if (id) {
      joinComparison();
    }
  }, [id]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <Youtube className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Invalid Link</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
          <p className="text-xs text-muted-foreground/60 mt-4">Comparison links expire after 2 hours for security</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
        <div>
          <p className="text-lg font-medium text-foreground mb-2">Setting things up...</p>
          <p className="text-sm text-muted-foreground">Redirecting to secure Google Sign-In so we can access your YouTube data.</p>
        </div>
      </div>
    </div>
  );
};

export default CompareJoin;
