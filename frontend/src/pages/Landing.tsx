import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Youtube, Sparkles, Users, Play, Loader2, Flame, Zap, Heart } from "lucide-react";
import { Logo } from "@/components/Logo";
import { initiateLogin, isAuthenticated, saveTokens } from "@/lib/auth";

const Landing = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [funMessages] = useState([
    "Are your playlists compatible? 🎵",
    "Let's find your YouTube soulmate 💫",
    "Time to settle the great taste debate 🎬",
    "Your viewing habits revealed 👀",
    "From your subscriptions to your soul 🎯"
  ]);
  const [currentMessage, setCurrentMessage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % funMessages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [funMessages.length]);

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
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-red-500/20 via-transparent to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-orange-500/15 via-transparent to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "0.5s" }} />
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
            {/* Playful Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 backdrop-blur-sm">
              <Flame className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-600 dark:text-red-400">
                {funMessages[currentMessage]}
              </span>
            </div>

            {/* Main Title */}
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight">
                <span className="text-foreground">YouTube</span>
                <br />
                <span className="bg-gradient-to-r from-red-500 via-orange-500 to-red-500 bg-clip-text text-transparent animate-glow inline-block">
                  Blend
                </span>
              </h1>
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto font-light leading-relaxed">
                Stop wondering if your friend's taste is <span className="italic">actually</span> as bad as you think. Compare YouTube profiles, get compatibility scores, and settle the great debate once and for all. 🎬
              </p>
            </div>

            {/* CTA Button */}
            <div className="pt-4 space-y-4">
              <Button
                onClick={handleLogin}
                disabled={isLoading}
                size="lg"
                className="text-lg px-10 py-7 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-2xl transition-all duration-300 shadow-[0_0_40px_rgb(220_38_38/0.3)] hover:shadow-[0_0_60px_rgb(220_38_38/0.5)] hover:scale-105 disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Vibing with Google...
                  </>
                ) : (
                  <>
                    <Youtube className="w-5 h-5 mr-2" />
                    Start Blending
                  </>
                )}
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                We only peek at your subscriptions & likes (read-only) • No sketchy stuff • Seriously
              </p>
            </div>
          </div>

          {/* Features Section - Actually Fun */}
          <div className="grid md:grid-cols-3 gap-6 animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <CreativeCard
              emoji="🔗"
              title="Share a Link"
              description="Send your blend code to a friend. They won't know what hit 'em."
              delay={0}
            />
            <CreativeCard
              emoji="⚡"
              title="Get Scored"
              description="Our algorithm judges your compatibility with brutal honesty (0-100%)"
              delay={100}
            />
            <CreativeCard
              emoji="🎯"
              title="Discover Common Ground"
              description="Find channels you'll both love. Or argue why you shouldn't."
              delay={200}
            />
          </div>

          {/* Testimonials/Vibes */}
          <div className="grid md:grid-cols-3 gap-4 py-8 animate-fade-in" style={{ animationDelay: "0.4s" }}>
            <VibCard stat="97%" desc="Never admit they were right" />
            <VibCard stat="Free" desc="Because we're not monsters" />
            <VibCard stat="0.5s" desc="To regret sharing" />
          </div>

          {/* Fun disclaimer */}
          <div className="text-center text-sm text-muted-foreground italic">
            Results not responsible for friendships lost over Anime vs. Documentary debates
          </div>
        </div>
      </div>

      {/* Bottom Gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
};

const CreativeCard = ({ emoji, title, description, delay }: { emoji: string; title: string; description: string; delay: number }) => (
  <div
    className="group relative p-6 rounded-2xl bg-card/50 border border-red-500/20 backdrop-blur-sm transition-all duration-500 hover:border-red-500/50 hover:bg-card/80 hover:shadow-lg"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="relative space-y-4">
      <div className="text-4xl group-hover:scale-110 transition-transform duration-300 inline-block">
        {emoji}
      </div>
      <div>
        <h3 className="text-lg font-bold text-foreground group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">{title}</h3>
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      </div>
    </div>
  </div>
);

const VibCard = ({ stat, desc }: { stat: string; desc: string }) => (
  <div className="p-4 rounded-xl bg-card/50 border border-border/50 text-center hover:border-red-500/30 transition-colors">
    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stat}</div>
    <div className="text-xs text-muted-foreground mt-1">{desc}</div>
  </div>
);
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
