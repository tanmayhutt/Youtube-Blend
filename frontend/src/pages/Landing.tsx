import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Youtube, Users, BarChart3, Lock, Zap, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Marquee } from "@/components/Marquee";
import { Circle, Squiggle, Star, Pill } from "@/components/Geometry";
import { Footer } from "@/components/Footer";
import { initiateLogin, isAuthenticated, saveTokens } from "@/lib/auth";
import { motion } from "framer-motion";

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
    <div className="min-h-screen bg-background bg-halftone relative overflow-hidden">
      {/* Header */}
      <header className="border-b-[4px] border-border bg-card relative z-20">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size={32} className="rounded" />
            <h1 className="text-xl font-bold text-foreground">Youtube Blend</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="/privacy" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </header>

      <Marquee text="DISCOVER YOUR YOUTUBE PERSONALITY" className="bg-primary text-primary-foreground py-3 border-y-[4px] border-border w-[105%] -ml-[2.5%] mt-4" />

      {/* Hero Section */}
      <main className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto py-24 md:py-32 relative">
          <Star className="top-10 left-10 text-background hidden md:block" />
          <Squiggle className="bottom-20 right-10 hidden md:block" />
          <Circle className="top-32 -right-20 hidden lg:block" />
          <Pill className="top-20 -left-20 hidden lg:block" />
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center space-y-8"
          >
            {/* Main Headline */}
            <div className="space-y-4 relative">
              <h1 className="text-6xl md:text-8xl lg:text-[8rem] font-black tracking-tighter text-foreground uppercase leading-[0.9]">
                Welcome to
                <br />
                <span className="text-primary text-outline text-background inline-block mt-4 transition-transform duration-300">Youtube Blend</span>
              </h1>
              <div className="bg-card border-[3px] border-border p-6 shadow-[var(--shadow-card)] max-w-2xl mx-auto space-y-4 text-left">
                <h3 className="font-black text-xl uppercase border-b-2 border-border pb-2">Purpose of this Application</h3>
                <p className="text-lg font-bold leading-relaxed">
                  Youtube Blend is a fun social tool that lets you compare your YouTube taste with friends. 
                  Youtube Blend requests your Google user data (specifically, your public YouTube subscriptions and saved videos) in order to compare them with your friends, generate a compatibility score, and explore what makes your viewing habits unique.
                </p>
              </div>
            </div>

            {/* CTA Button */}
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleLogin}
                disabled={isLoading}
                size="lg"
                className="px-8 py-8 text-lg"
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
            <p className="text-sm font-bold bg-white/90 inline-block px-4 py-2 border-[2px] border-border shadow-[var(--shadow-button)]">
              Read-only access • No data stored • Secure OAuth 2.0
            </p>
          </motion.div>
        </div>

        <Marquee text="COMPARE • BLEND • DISCOVER" className="bg-secondary text-secondary-foreground py-4 border-y-[4px] border-border w-[105%] -ml-[2.5%] mb-20 shadow-[var(--shadow-card)]" />

        {/* Features Grid */}
        <div className="py-24 relative">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-12 text-center">How Youtube Blend Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                icon={Users}
                title="Connect Your Account"
                description="Sign in securely with your Google account. We only read your public YouTube data—nothing is modified."
              />
              <FeatureCard
                icon={BarChart3}
                title="Generate a Comparison Link"
                description="Create a unique link to share with friends. It expires in 2 hours for maximum privacy."
              />
              <FeatureCard
                icon={Zap}
                title="See Your Compatibility"
                description="Get a fun compatibility score, discover common interests, music taste, and what makes you different!"
              />
            </div>
          </div>
        </div>

        {/* Trust & Security Section */}
        <div className="py-24 relative mb-12">
          <Star className="bottom-10 right-20 text-background hidden md:block" />
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-12 text-center">We Respect Your Privacy</h2>
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
  <div className="p-6 border-[4px] border-border bg-card shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4 hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all z-10 relative">
    <div className="w-16 h-16 flex items-center justify-center border-[4px] border-border bg-primary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-full -mt-12">
      <Icon className="w-8 h-8 text-white" />
    </div>
    <h3 className="text-2xl font-black text-foreground uppercase">{title}</h3>
    <p className="font-bold text-foreground/80 leading-relaxed">{description}</p>
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
  <div className="flex gap-4 p-4 border-[4px] border-border bg-card shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] transition-transform">
    <div className="flex-shrink-0">
      <div className="w-12 h-12 flex items-center justify-center border-[3px] border-border bg-secondary shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-full">
        <Icon className="w-6 h-6 text-foreground" />
      </div>
    </div>
    <div>
      <h3 className="font-black text-foreground text-xl uppercase">{title}</h3>
      <p className="font-bold text-foreground/80 mt-1">{description}</p>
    </div>
  </div>
);

export default Landing;
