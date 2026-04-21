import { useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import Landing from "./Landing";
import { saveTokens, isAuthenticated } from "@/lib/auth";

const TokenHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const hasAuthParams = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return Boolean(params.get("access_token") && params.get("refresh_token"));
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      try {
        saveTokens({ access_token: accessToken, refresh_token: refreshToken });
      } catch (e) {
        console.error("Failed to save tokens", e);
      }
      // Navigate to dashboard with a clean URL
      navigate("/dashboard", { replace: true });
      return;
    }

    if (isAuthenticated()) {
      navigate("/dashboard", { replace: true });
    }
  }, [location.search, navigate]);

  if (hasAuthParams) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3 text-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-base text-muted-foreground">Finalizing login…</p>
        </div>
      </div>
    );
  }

  return <Landing />;
};

export default TokenHandler;
