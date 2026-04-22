import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlendResults } from "@/components/BlendResults";
import { ScoreCard } from "@/components/ScoreCard";
import { Youtube, Heart, TrendingUp, Music, Video, Home, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { authClient, saveTokens, clearTokens, isAuthenticated } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const CompareFinalise = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check authentication first
    if (!isAuthenticated()) {
      setError("Please log in to view comparison results");
      setLoading(false);
      toast({
        title: "Authentication Required",
        description: "Please log in to continue",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    const runComparison = async () => {
      try {
        // Use GET request (POST also works for backwards compatibility)
        const response = await authClient.get(`/compare/run/${id}`);
        setComparisonData(response.data.results);
      } catch (err: any) {
        setError(err.response?.data?.detail || "Failed to load comparison results");
        toast({
          title: "Error",
          description: "Could not load comparison results",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      runComparison();
    }
  }, [id, navigate, toast]);

  const getMatchMessage = (score: number) => {
    if (score >= 80) return {
      text: "Excellent Match",
      desc: "You share significant YouTube interests with very similar viewing preferences"
    };
    if (score >= 60) return {
      text: "Good Match",
      desc: "You have substantial common ground with overlapping content interests"
    };
    if (score >= 40) return {
      text: "Moderate Match",
      desc: "You share some interests, but also bring different perspectives to content"
    };
    if (score >= 20) return {
      text: "Limited Match",
      desc: "Your viewing preferences are quite different, offering opportunities for discovery"
    };
    return {
      text: "Minimal Match",
      desc: "Your YouTube interests are quite distinct, which can lead to interesting recommendations"
    };
  };

  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };

  const handleNewComparison = () => {
    clearTokens();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">Calculating compatibility...</p>
        </div>
      </div>
    );
  }

  if (error || !comparisonData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <Youtube className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Something Went Wrong</h1>
          <p className="text-muted-foreground">{error || "Could not load comparison"}</p>
          <Button onClick={() => navigate("/")} className="mt-4">
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  const matchMessage = comparisonData.scores?.overall
    ? getMatchMessage(comparisonData.scores.overall)
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Logo size={28} className="rounded" />
              <h1 className="text-lg font-bold text-foreground">Comparison Results</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBackToDashboard} className="gap-2 text-sm">
                <Home className="w-4 h-4" />
                Dashboard
              </Button>
              <Button onClick={handleNewComparison} className="gap-2 text-sm">
                New Comparison
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="animate-fade-in">
          {/* Match Score Card */}
          {matchMessage && (
            <Card className="mb-12 p-8 text-center border-border/50">
              <div className="space-y-6">
                <div>
                  <h2 className="text-4xl font-bold text-foreground mb-2">
                    {matchMessage.text}
                  </h2>
                  <p className="text-muted-foreground max-w-2xl mx-auto">
                    {matchMessage.desc}
                  </p>
                </div>
                <div className="pt-6 border-t border-border/50">
                  <div className="text-5xl font-bold text-red-600 dark:text-red-500">
                    {comparisonData.scores.overall.toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Compatibility Score</p>
                </div>
              </div>
            </Card>
          )}

          {/* Detailed Results Tabs */}
          <Tabs defaultValue="scores" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-8">
              <TabsTrigger value="scores" className="flex items-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4" />
                Scores
              </TabsTrigger>
              <TabsTrigger value="common" className="flex items-center gap-2 text-sm">
                <Heart className="w-4 h-4" />
                Common
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2 text-sm">
                <Video className="w-4 h-4" />
                Details
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scores" className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground">Score Breakdown</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(comparisonData.scores).map(([key, value]: [string, any]) => (
                  <ScoreCard key={key} label={key} score={value} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="common">
              {(comparisonData.common_subscriptions?.length > 0 ||
                comparisonData.common_saved_videos?.length > 0 ||
                comparisonData.common_music_listened?.length > 0) ? (
                <BlendResults
                  data={{
                    subscriptions: comparisonData.common_subscriptions,
                    saved_videos: comparisonData.common_saved_videos,
                    music_listened: comparisonData.common_music_listened,
                    subscription_genres: comparisonData.common_subscription_genres,
                    video_genres: comparisonData.common_video_genres,
                  }}
                  title="What You Both Love"
                />
              ) : (
                <Card className="p-12 text-center">
                  <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-2xl font-bold mb-2">No Common Content Yet!</p>
                  <p className="text-muted-foreground">
                    This is your chance to introduce each other to amazing new content 🎬
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="details">
              <BlendResults
                data={comparisonData}
                title="Complete Comparison Details"
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default CompareFinalise;
