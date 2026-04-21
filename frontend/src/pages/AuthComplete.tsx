import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { saveTokens } from "@/lib/auth";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL as string;

const AuthComplete = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("AuthComplete mounted, URL:", window.location.href);
    console.log("API_BASE:", API_BASE);
    
    const code = searchParams.get("code");
    const next = searchParams.get("next");

    console.log("Code from URL:", code ? "Present" : "Missing");
    console.log("Next param:", next);

    if (!code) {
      console.error("Missing authorization code");
      setError("Missing authorization code");
      setLoading(false);
      return;
    }

    if (!API_BASE) {
      console.error("VITE_API_URL is not set");
      setError("API URL not configured. Please check environment variables.");
      setLoading(false);
      return;
    }

    const exchangeCode = async () => {
      try {
        console.log("Exchanging code for token...");
        const response = await axios.post(`${API_BASE}/auth/exchange`, { code });
        console.log("Token exchange successful");
        const { access_token, user_id } = response.data;

        // Save tokens (using user_id as a pseudo refresh token for now)
        saveTokens({ access_token, refresh_token: user_id });
        console.log("Tokens saved to localStorage");

        // Redirect to next or dashboard
        const redirectPath = next || "/dashboard";
        console.log("Redirecting to:", redirectPath);
        navigate(redirectPath, { replace: true });
      } catch (err: any) {
        console.error("Token exchange failed:", err);
        console.error("Error details:", err.response?.data);
        setError(err.response?.data?.detail || err.message || "Authentication failed. Please try again.");
        setLoading(false);
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Authentication Error</h1>
          <p className="text-muted-foreground max-w-md">{error}</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
            <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
          </div>
          <p className="text-lg text-muted-foreground">Completing authentication...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthComplete;
