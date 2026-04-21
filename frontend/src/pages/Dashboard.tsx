import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BlendResults } from "@/components/BlendResults";
import { Youtube, Link as LinkIcon, LogOut, Loader2, Copy, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { authClient, clearTokens, isAuthenticated, saveTokens } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("Dashboard mounted. Current URL:", window.location.href);
    
    // Extract tokens from URL if present (OAuth redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get("access_token");
    const refreshToken = urlParams.get("refresh_token");

    if (accessToken && refreshToken) {
      console.log("✅ Tokens found in URL, saving to localStorage");
      saveTokens({ access_token: accessToken, refresh_token: refreshToken });
      // Clean up URL
      window.history.replaceState({}, document.title, "/dashboard");
      console.log("✅ URL cleaned, tokens saved");
    } else {
      console.log("ℹ️ No tokens in URL params");
    }

    if (!isAuthenticated()) {
      console.log("❌ Not authenticated, redirecting to landing page");
      toast({
        title: "Authentication Required",
        description: "Please log in to continue",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    console.log("✅ User authenticated, fetching data");

    const fetchData = async () => {
      try {
        const response = await authClient.get("/data/me");
        console.log("✅ User data fetched successfully");
        setUserData(response.data);
      } catch (error: any) {
        console.error("❌ Error fetching user data:", error);
        toast({
          title: "Error",
          description: error.response?.data?.detail || "Failed to load your data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate, toast]);

  const handleGenerateLink = async () => {
    setGeneratingLink(true);
    try {
      const response = await authClient.get("/compare/generate_link");
      setShareLink(response.data.link);
      toast({
        title: "Link Generated!",
        description: "Share this link with a friend to compare your YouTube tastes",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to generate link",
        variant: "destructive",
      });
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (shareLink) {
      navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Link copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogout = () => {
    clearTokens();
    navigate("/");
    toast({
      title: "Logged Out",
      description: "See you next time!",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-lg text-muted-foreground">Loading your YouTube universe...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size={32} className="rounded-lg" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                YouTube Blend
              </h1>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Action Card */}
        <Card className="mb-12 p-8 bg-gradient-to-br from-primary/10 via-accent/5 to-background border-primary/20 animate-scale-in">
          <div className="text-center space-y-6">
            <h2 className="text-3xl font-bold">Ready to Compare?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Generate a shareable link and discover how your YouTube taste matches with friends
            </p>
            
            {!shareLink ? (
              <Button
                onClick={handleGenerateLink}
                disabled={generatingLink}
                size="lg"
                className="text-lg px-8 py-6 shadow-lg hover:shadow-[0_0_40px_hsl(var(--primary)/0.4)]"
              >
                {generatingLink ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-5 h-5 mr-2" />
                    Generate Comparison Link
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-4 max-w-2xl mx-auto">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 px-4 py-3 rounded-lg bg-background border border-border text-sm"
                  />
                  <Button onClick={handleCopyLink} className="gap-2">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Share this link with a friend. When they login, you'll both see the comparison results!
                </p>
                <Button
                  onClick={() => setShareLink(null)}
                  variant="outline"
                  size="sm"
                >
                  Generate New Link
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Separator className="my-8" />

        {/* User Data */}
        <div className="animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">Your YouTube Universe</h2>
            <p className="text-muted-foreground">Here's what makes your taste unique</p>
          </div>
          {userData && <BlendResults data={userData} title="" />}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
