import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlendResults } from "@/components/BlendResults";
import { ScoreCard } from "@/components/ScoreCard";
import { ChannelCard } from "@/components/ChannelCard";
import { VideoCard } from "@/components/VideoCard";
import { Badge } from "@/components/ui/badge";
import { ThreeJsVisualization } from "@/components/ThreeJsVisualization";
import { FloatingChannels } from "@/components/FloatingChannels";
import { MusicShowcase } from "@/components/MusicShowcase";
import { Youtube, TrendingUp, Music, Video, Home, Loader2, List } from "lucide-react";
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
          {/* Match Score Card with 3D Visualization */}
          {matchMessage && (
            <Card className="mb-12 p-8 text-center border-border/50">
              <div className="space-y-6">
                {/* 3D Visualization */}
                <ThreeJsVisualization score={comparisonData.scores.overall} className="mb-6" />

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
            <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 mb-8 overflow-x-auto">
              <TabsTrigger value="scores" className="flex items-center gap-1 text-xs md:text-sm">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Scores</span>
              </TabsTrigger>
              <TabsTrigger value="common" className="flex items-center gap-1 text-xs md:text-sm">
                <Music className="w-4 h-4" />
                <span className="hidden sm:inline">Common</span>
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="flex items-center gap-1 text-xs md:text-sm">
                <TrendingUp className="w-4 h-4" />
                <span className="hidden sm:inline">Channels</span>
              </TabsTrigger>
              <TabsTrigger value="videos" className="flex items-center gap-1 text-xs md:text-sm">
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">Videos</span>
              </TabsTrigger>
              <TabsTrigger value="music" className="flex items-center gap-1 text-xs md:text-sm">
                <Music className="w-4 h-4" />
                <span className="hidden sm:inline">Music</span>
              </TabsTrigger>
              <TabsTrigger value="genres" className="flex items-center gap-1 text-xs md:text-sm">
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Genres</span>
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

            <TabsContent value="common" className="space-y-8">
              <h2 className="text-3xl font-bold text-foreground mb-2">What You Both Love</h2>

              {(comparisonData.common_subscriptions?.length > 0 ||
                comparisonData.common_saved_videos?.length > 0 ||
                comparisonData.common_music_listened?.length > 0) ? (
                <div className="space-y-8">
                  {/* Emphasize Common Music */}
                  {comparisonData.common_music_listened && comparisonData.common_music_listened.length > 0 && (
                    <MusicShowcase musicTracks={comparisonData.common_music_listened} />
                  )}

                  {/* Common Floating Channels */}
                  {comparisonData.common_subscriptions && comparisonData.common_subscriptions.length > 0 && (
                    <FloatingChannels channels={comparisonData.common_subscriptions} title="Common Favorite Channels" />
                  )}

                  {/* Common Videos */}
                  {comparisonData.common_saved_videos && comparisonData.common_saved_videos.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Videos You Both Saved</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {comparisonData.common_saved_videos.map((video: any, index: number) => (
                          <VideoCard key={index} title={video.title} thumbnailUrl={video.thumbnail_url} videoId={video.video_id} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-2xl font-bold mb-2">No Common Content Yet</p>
                  <p className="text-muted-foreground text-sm">
                    This is your chance to introduce each other to amazing new content
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="subscriptions" className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground">Subscriptions</h2>
              {(comparisonData.subscriptions?.length > 0 || comparisonData.user_2_subscriptions?.length > 0) ? (
                <div className="space-y-8">
                  {comparisonData.subscriptions?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Your Subscriptions ({comparisonData.subscriptions.length})</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {comparisonData.subscriptions.map((sub: any, index: number) => (
                          <ChannelCard key={index} title={sub.title} logoUrl={sub.logo_url} channelId={sub.channel_id} />
                        ))}
                      </div>
                    </div>
                  )}
                  {comparisonData.user_2_subscriptions?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Their Subscriptions ({comparisonData.user_2_subscriptions.length})</h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {comparisonData.user_2_subscriptions.map((sub: any, index: number) => (
                          <ChannelCard key={index} title={sub.title} logoUrl={sub.logo_url} channelId={sub.channel_id} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-sm">No subscription data available</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="videos" className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground">Saved Videos</h2>
              {(comparisonData.saved_videos?.length > 0 || comparisonData.user_2_saved_videos?.length > 0) ? (
                <div className="space-y-8">
                  {comparisonData.saved_videos?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Your Saved Videos ({comparisonData.saved_videos.length})</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {comparisonData.saved_videos.map((video: any, index: number) => (
                          <VideoCard key={index} title={video.title} thumbnailUrl={video.thumbnail_url} videoId={video.video_id} />
                        ))}
                      </div>
                    </div>
                  )}
                  {comparisonData.user_2_saved_videos?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Their Saved Videos ({comparisonData.user_2_saved_videos.length})</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {comparisonData.user_2_saved_videos.map((video: any, index: number) => (
                          <VideoCard key={index} title={video.title} thumbnailUrl={video.thumbnail_url} videoId={video.video_id} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-sm">No saved videos available</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="music" className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground">Music</h2>
              {(comparisonData.music_listened?.length > 0 || comparisonData.user_2_music_listened?.length > 0) ? (
                <div className="space-y-8">
                  {comparisonData.music_listened?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Your Music ({comparisonData.music_listened.length})</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {comparisonData.music_listened.map((music: any, index: number) => (
                          <VideoCard key={index} title={music.title} thumbnailUrl={music.thumbnail_url} videoId={music.video_id} />
                        ))}
                      </div>
                    </div>
                  )}
                  {comparisonData.user_2_music_listened?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-foreground mb-4">Their Music ({comparisonData.user_2_music_listened.length})</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {comparisonData.user_2_music_listened.map((music: any, index: number) => (
                          <VideoCard key={index} title={music.title} thumbnailUrl={music.thumbnail_url} videoId={music.video_id} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <Music className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground text-sm">No music data available</p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="genres" className="space-y-8">
              <h2 className="text-2xl font-bold text-foreground">Your Interests</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {comparisonData.subscription_genres?.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Your Channel Interests</h3>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(comparisonData.subscription_genres)).map((genre: string, index: number) => (
                        <Badge key={index} variant="secondary" className="capitalize">
                          {genre.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {comparisonData.user_2_subscription_genres?.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Their Channel Interests</h3>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(comparisonData.user_2_subscription_genres)).map((genre: string, index: number) => (
                        <Badge key={index} variant="outline" className="capitalize">
                          {genre.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {(comparisonData.video_genres?.length > 0 || comparisonData.user_2_video_genres?.length > 0) && (
                <div className="mt-6 pt-6 border-t">
                  <h2 className="text-xl font-bold text-foreground mb-6">Video Content Interests</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {comparisonData.video_genres?.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Your Video Interests</h3>
                        <div className="flex flex-wrap gap-2">
                          {Array.from(new Set(comparisonData.video_genres)).map((genre: string, index: number) => (
                            <Badge key={index} variant="secondary" className="capitalize">
                              {genre.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {comparisonData.user_2_video_genres?.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Their Video Interests</h3>
                        <div className="flex flex-wrap gap-2">
                          {Array.from(new Set(comparisonData.user_2_video_genres)).map((genre: string, index: number) => (
                            <Badge key={index} variant="outline" className="capitalize">
                              {genre.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default CompareFinalise;
