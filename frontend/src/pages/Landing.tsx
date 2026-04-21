import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Youtube, Sparkles, Users, TrendingUp, Play, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
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
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/20 via-transparent to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-accent/15 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "0.5s" }} />
      </div>

      {/* Grid Pattern Overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}
      />

      <div className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-5xl mx-auto space-y-16">
          
          {/* Hero Section */}
          <div className="text-center space-y-8 animate-fade-in">
            {/* Logo Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 backdrop-blur-sm">
              <Logo size={20} className="rounded" />
              <span className="text-sm font-medium text-primary">Discover Your YouTube DNA</span>
            </div>

            {/* Main Title */}
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight">
                <span className="text-foreground">YouTube</span>
                <br />
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-glow inline-block">
                  Blend
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light">
                Compare your YouTube taste with friends and discover your compatibility score
              </p>
            </div>

            {/* CTA Button */}
            <div className="pt-4">
              <Button
                onClick={handleLogin}
                disabled={isLoading}
                size="lg"
                className="text-lg px-10 py-7 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-2xl transition-all duration-300 shadow-[0_0_40px_hsl(var(--primary)/0.3)] hover:shadow-[0_0_60px_hsl(var(--primary)/0.5)] hover:scale-105 disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Youtube className="w-5 h-5 mr-2" />
                    Connect YouTube
                  </>
                )}
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                Read-only access to your subscriptions & likes
              </p>
            </div>
          </div>

          {/* Features Section */}
          <div className="grid md:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <FeatureCard
              icon={<Users className="w-8 h-8" />}
              title="Invite Friends"
              description="Share a unique link and see how your tastes compare"
              delay={0}
            />
            <FeatureCard
              icon={<TrendingUp className="w-8 h-8" />}
              title="Deep Analysis"
              description="AI-powered insights into your viewing patterns"
              delay={100}
            />
            <FeatureCard
              icon={<Sparkles className="w-8 h-8" />}
              title="Find Common Ground"
              description="Discover channels and videos you'll both love"
              delay={200}
            />
          </div>

          {/* Stats/Social Proof */}
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 py-8 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <StatItem value="10K+" label="Blends Created" />
            <StatItem value="98%" label="Accuracy" />
            <StatItem value="Free" label="Forever" />
          </div>
        </div>
      </div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
};

const FeatureCard = ({ icon, title, description, delay }: { icon: React.ReactNode; title: string; description: string; delay: number }) => (
  <div 
    className="group relative p-6 rounded-2xl bg-card/50 border border-border/50 backdrop-blur-sm transition-all duration-500 hover:border-primary/50 hover:bg-card/80"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="relative space-y-4">
      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-foreground">{title}</h3>
      <p className="text-muted-foreground leading-relaxed">{description}</p>
    </div>
  </div>
);

const StatItem = ({ value, label }: { value: string; label: string }) => (
  <div className="text-center">
    <div className="text-3xl md:text-4xl font-bold text-foreground">{value}</div>
    <div className="text-sm text-muted-foreground uppercase tracking-wider">{label}</div>
  </div>
);

export default Landing;
