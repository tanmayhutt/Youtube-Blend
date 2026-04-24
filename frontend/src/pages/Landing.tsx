import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Youtube, Users, BarChart3, Lock, Zap, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { initiateLogin, isAuthenticated, saveTokens } from "@/lib/auth";

const Landing = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      saveTokens({ access_token: accessToken, refresh_token: refreshToken });
      window.history.replaceState({}, document.title, "/");
    }

    if (isAuthenticated() || (accessToken && refreshToken)) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await initiateLogin();
    } catch (error) {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={32} className="rounded" />
            <h1 className="text-xl font-bold text-foreground">YouTube Blend</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto py-24 md:py-32">
          <div className="text-center space-y-8">
            {/* Main Headline */}
            <div className="space-y-4">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground">
                What's Your
                <br />
                <span className="bg-gradient-to-r from-red-600 to-orange-500 bg-clip-text text-transparent">YouTube Personality?</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Discover how your YouTube taste aligns with friends. Get a compatibility score, find common channels, music taste, and explore what makes your viewing habits unique. 🎬
              </p>
            </div>

            {/* CTA Button */}
            <div className="flex gap-4 justify-center pt-4">
              <Button
                onClick={handleLogin}
                disabled={isLoading}
                size="lg"
                className="px-8 py-6 bg-red-600 hover:bg-red-700 text-white text-base rounded-lg transition-all duration-200"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Connecting to Google...
                  </>
                ) : (
                  <>
                    <Youtube className="w-5 h-5 mr-2" />
                    Sign in with Google
                  </>
                )}
              </Button>
            </div>

            {/* Trust Message */}
            <p className="text-sm text-muted-foreground">
              Read-only access to your YouTube data • No personal data stored • Secure OAuth 2.0
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="py-24 border-t border-border/50">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center">✨ How YouTube Blend Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                icon={Users}
                title="🔐 Connect Your Account"
                description="Sign in securely with your Google account. We only read your public YouTube data—nothing is modified."
              />
              <FeatureCard
                icon={BarChart3}
                title="🔗 Generate a Comparison Link"
                description="Create a unique link to share with friends. It expires in 2 hours for maximum privacy."
              />
              <FeatureCard
                icon={Zap}
                title="🎯 See Your Compatibility"
                description="Get a fun compatibility score, discover common interests, music taste, and what makes you different!"
              />
            </div>
          </div>
        </div>

        {/* Trust & Security Section */}
        <div className="py-24 border-t border-border/50 mb-12">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-12 text-center">🛡️ We Respect Your Privacy</h2>
            <div className="space-y-6">
              <TrustItem icon={Lock} title="Read-Only Access" description="We only access your public subscriptions and saved videos. No data is modified or stored permanently." />
              <TrustItem icon={Zap} title="No Account Required" description="Results are temporary. Your comparison link expires after 2 hours for your privacy." />
              <TrustItem icon={Users} title="No Data Sharing" description="Your YouTube data is never shared with third parties or used for advertising." />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

const FeatureCard = ({
  icon: Icon,
  title,
  description
}: {
  icon: any;
  title: string;
  description: string;
}) => (
  <div className="space-y-3">
    <div className="w-12 h-12 rounded-lg bg-red-600/10 flex items-center justify-center">
      <Icon className="w-6 h-6 text-red-600 dark:text-red-500" />
    </div>
    <h3 className="text-lg font-semibold text-foreground">{title}</h3>
    <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
  </div>
);

const TrustItem = ({
  icon: Icon,
  title,
  description
}: {
  icon: any;
  title: string;
  description: string;
}) => (
  <div className="flex gap-4 p-4 rounded-lg border border-border/50 hover:border-border transition-colors">
    <div className="flex-shrink-0">
      <Icon className="w-6 h-6 text-red-600 dark:text-red-500 mt-1" />
    </div>
    <div>
      <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      <p className="text-muted-foreground text-sm mt-1">{description}</p>
    </div>
  </div>
);

export default Landing;
