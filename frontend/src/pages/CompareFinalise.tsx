import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompatibilityAvatars } from "@/components/CompatibilityAvatars";
import { ScoreCard } from "@/components/ScoreCard";
import { ChannelCard } from "@/components/ChannelCard";
import { VideoCard } from "@/components/VideoCard";
import { Badge } from "@/components/ui/badge";
import { FloatingChannels } from "@/components/FloatingChannels";
import { MusicShowcase } from "@/components/MusicShowcase";
import { Youtube, TrendingUp, Music, Video, Home, Loader2, List, ChevronDown } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { Marquee } from "@/components/Marquee";
import { Circle, Squiggle, Star, Pill } from "@/components/Geometry";
import { authClient, saveTokens, clearTokens, isAuthenticated } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";
import confetti from "canvas-confetti";

const DataGrid = ({
  viewerData,
  otherData,
  viewerLabel,
  otherLabel,
  renderItem,
  emptyIcon: EmptyIcon,
  emptyText
}: any) => {
  if (!viewerData?.length && !otherData?.length) {
    return (
      <Card className="p-12 text-center bg-card border-[3px] border-border shadow-[var(--shadow-card)]">
        <EmptyIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <p className="text-sm font-bold text-muted-foreground uppercase">{emptyText}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {viewerData?.length > 0 && (
        <div>
          <h3 className="text-xl font-black text-foreground mb-4 uppercase">{viewerLabel} ({viewerData.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {viewerData.map(renderItem)}
          </div>
        </div>
      )}
      {otherData?.length > 0 && (
        <div>
          <h3 className="text-xl font-black text-foreground mb-4 uppercase">{otherLabel} ({otherData.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {otherData.map(renderItem)}
          </div>
        </div>
      )}
    </div>
  );
};

const CompareFinalise = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [comparisonMeta, setComparisonMeta] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [comparisonStatus, setComparisonStatus] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const comparisonLink = id ? `${window.location.origin}/compare/join/${id}` : "";

  const runComparison = async (forceRefresh = false) => {
    if (!id) return;
    if (!forceRefresh) {
      setLoading(true);
    }

    try {
      const url = forceRefresh ? `/compare/run/${id}?refresh=1` : `/compare/run/${id}`;
      const response = await authClient.get(url);
      if (response.data?.results) {
        setComparisonData(response.data.results);
        setComparisonStatus("completed");
        setStatusMessage(null);
        
        // Massive confetti burst for seeing results!
        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.5 },
            colors: ['#FF0000', '#000000', '#FFFFFF']
          });
        }, 500);
      } else if (response.data?.status) {
        setComparisonData(null);
        setComparisonStatus(response.data.status);
        setStatusMessage(response.data.message || null);
      }
      setComparisonMeta(response.data.meta);
      setError(null);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (detail && detail.includes("Comparison is not ready")) {
        setComparisonData(null);
        setComparisonStatus("pending");
        setStatusMessage(detail);
        setError(null);
      } else {
        setError(detail || "Failed to load comparison results");
        setComparisonStatus("error");
        toast({
          title: "Error",
          description: "Could not load comparison results",
          variant: "destructive",
        });
      }
    } finally {
      if (!forceRefresh) {
        setLoading(false);
      }
    }
  };

  const handleRefreshMyData = async () => {
    setRefreshing(true);
    try {
      await authClient.post("/data/sync");
      await runComparison(true);
      toast({
        title: "Data refreshed",
        description: "Your comparison results are updated.",
      });
    } catch (err: any) {
      toast({
        title: "Refresh failed",
        description: err.response?.data?.detail || "Could not refresh your data",
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyLink = () => {
    if (!comparisonLink) return;
    navigator.clipboard.writeText(comparisonLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

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

    if (id) {
      runComparison();
    }
  }, [id, navigate, toast]);

  const getMatchMessage = (score: number) => {
    if (score >= 80) return {
      text: "Exceptional Compatibility",
      desc: "Your YouTube viewing habits and musical tastes are highly aligned, indicating nearly identical content preferences.",
      emoji: ""
    };
    if (score >= 60) return {
      text: "Strong Alignment",
      desc: "You share a significant amount of common ground across multiple categories and genres.",
      emoji: ""
    };
    if (score >= 40) return {
      text: "Moderate Overlap",
      desc: "While you have distinct preferences, there is a measurable intersection in your content libraries.",
      emoji: ""
    };
    if (score >= 20) return {
      text: "Diverse Tastes",
      desc: "Your profiles indicate largely different consumption habits with occasional overlapping interests.",
      emoji: ""
    };
    return {
      text: "Distinct Profiles",
      desc: "Your viewing habits and musical tastes belong to completely different analytical clusters.",
      emoji: ""
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
        <div className="text-center space-y-4 max-w-md">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <div>
            <p className="text-lg font-medium text-foreground mb-2">Analyzing your YouTube libraries...</p>
            <p className="text-sm text-muted-foreground">This can take a few seconds as we compare your subscriptions, videos, and music taste across both accounts.</p>
          </div>
        </div>
      </div>
    );
  }

  if (comparisonStatus === "pending" && !comparisonData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <Youtube className="w-16 h-16 text-muted-foreground mx-auto" />
          <h1 className="text-2xl font-bold">Waiting for the other user</h1>
          <p className="text-muted-foreground">{statusMessage || "They need to finish Google login for this link."}</p>
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={comparisonLink}
                readOnly
                className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-xs"
              />
              <Button onClick={handleCopyLink} variant="outline" size="sm">
                {copiedLink ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button onClick={() => runComparison()} size="sm">
              Check again
            </Button>
          </div>
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
    <div className="min-h-screen bg-background bg-halftone relative overflow-hidden">
      {/* Header */}
      <header className="border-b-[4px] border-border bg-card relative z-50 shadow-[var(--shadow-card)]">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size={28} className="rounded" />
              <h1 className="text-lg font-semibold tracking-tight text-foreground/90 hidden sm:block">Comparison Analysis</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {comparisonMeta && (
                <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
                  <div className="flex items-center gap-1.5">
                    <span className="opacity-60">You:</span>
                    <span className="font-medium text-foreground/80">{formatRelativeTime(comparisonMeta.viewer?.last_synced_at)}</span>
                  </div>
                  <div className="w-px h-3 bg-white/20"></div>
                  <div className="flex items-center gap-1.5">
                    <span className="opacity-60">Them:</span>
                    <span className="font-medium text-foreground/80">{formatRelativeTime(comparisonMeta.other?.last_synced_at)}</span>
                  </div>
                </div>
              )}
              
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleBackToDashboard} className="gap-2 text-sm bg-transparent border-white/10 hover:bg-white/5">
                  <Home className="w-4 h-4" />
                  Dashboard
                </Button>
                <Button onClick={handleNewComparison} className="gap-2 text-sm">
                  New Comparison
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <Marquee text="BLEND YOUR TASTE • DISCOVER YOUR MATCH" className="bg-primary text-primary-foreground py-3 border-y-[4px] border-border w-[105%] -ml-[2.5%] mt-4 shadow-[var(--shadow-card)] relative z-20" />

      <main className="container mx-auto px-4 py-12 relative z-10">
        <Star className="top-20 left-10 text-background hidden md:block z-0" />
        <Circle className="bottom-40 right-10 hidden lg:block z-0" />
        
        <div className="animate-fade-in relative z-10">
          {comparisonMeta && (
            <Card className="mb-8 p-6 bg-card border-[3px] border-border shadow-[var(--shadow-card)] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-black tracking-tight text-foreground uppercase">Data Synchronization</h3>
                <p className="text-xs font-bold text-muted-foreground max-w-xl">
                  Compatibility metrics are based on the latest data snapshots. For the most accurate analysis, ensure both profiles are recently synchronized.
                </p>
              </div>
              <Button onClick={handleRefreshMyData} disabled={refreshing} variant="default" className="gap-2 whitespace-nowrap">
                {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Refresh My Snapshot
              </Button>
            </Card>
          )}
          {/* Match Score Card */}
          {matchMessage && (
            <Card className="mb-12 p-10 text-center bg-card border-[4px] border-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-visible transition-transform mt-8">
              <Squiggle className="-top-12 -right-12 hidden md:block z-20" />
              <div className="relative space-y-8 z-10">
                <CompatibilityAvatars
                  viewerProfile={comparisonMeta?.viewer?.profile}
                  otherProfile={comparisonMeta?.other?.profile}
                  score={comparisonData.scores.overall}
                />
                <div>
                  <h2 className="text-5xl md:text-6xl font-black tracking-tight text-foreground mb-4 uppercase text-outline text-background inline-block">
                    {matchMessage.text}
                  </h2>
                  <p className="text-lg font-bold text-foreground/80 max-w-2xl mx-auto leading-relaxed bg-white/90 border-[2px] border-border p-4 shadow-[4px_4px_0_0_rgba(0,0,0,1)] mt-4">
                    {matchMessage.desc}
                  </p>
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
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Score Breakdown</h2>
                <p className="text-sm text-muted-foreground mb-4">See how well you match across different YouTube categories and interests.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(comparisonData.scores).map(([key, value]: [string, any]) => (
                  <ScoreCard key={key} label={key} score={value} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="common" className="space-y-8">
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-foreground mb-2">What You Both Love</h2>
                <p className="text-muted-foreground">The intersection of your YouTube universes—these are the gems you share together.</p>
              </div>

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
              <div>
                <h2 className="text-3xl font-black text-foreground mb-2 uppercase">Your Channels</h2>
                <p className="text-sm font-bold text-muted-foreground mb-4">See the channels you're following and compare your viewing preferences.</p>
              </div>
              <DataGrid
                viewerData={comparisonData.subscriptions}
                otherData={comparisonData.user_2_subscriptions}
                viewerLabel="Your Subscriptions"
                otherLabel="Their Subscriptions"
                emptyIcon={TrendingUp}
                emptyText="No subscription data available"
                renderItem={(sub: any, index: number) => <ChannelCard key={index} title={sub.title} logoUrl={sub.logo_url} channelId={sub.channel_id} />}
              />
            </TabsContent>

            <TabsContent value="videos" className="space-y-6">
              <div>
                <h2 className="text-3xl font-black text-foreground mb-2 uppercase">Your Saved Videos</h2>
                <p className="text-sm font-bold text-muted-foreground mb-4">Videos you've saved and loved over time.</p>
              </div>
              <DataGrid
                viewerData={comparisonData.saved_videos}
                otherData={comparisonData.user_2_saved_videos}
                viewerLabel="Your Saved Videos"
                otherLabel="Their Saved Videos"
                emptyIcon={Video}
                emptyText="No saved videos available"
                renderItem={(video: any, index: number) => <VideoCard key={index} title={video.title} thumbnailUrl={video.thumbnail_url} videoId={video.video_id} />}
              />
            </TabsContent>

            <TabsContent value="music" className="space-y-6">
              <div>
                <h2 className="text-3xl font-black text-foreground mb-2 uppercase">Your Music Taste</h2>
                <p className="text-sm font-bold text-muted-foreground mb-4">The most-played music from your collection, sorted by listen count.</p>
              </div>
              <DataGrid
                viewerData={comparisonData.music_listened}
                otherData={comparisonData.user_2_music_listened}
                viewerLabel="Your Music"
                otherLabel="Their Music"
                emptyIcon={Music}
                emptyText="No music data available"
                renderItem={(music: any, index: number) => <VideoCard key={index} title={music.title} thumbnailUrl={music.thumbnail_url} videoId={music.video_id} />}
              />
            </TabsContent>

            <TabsContent value="genres" className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Your Interests</h2>
                <p className="text-sm text-muted-foreground mb-4">The genres and categories that define your YouTube personality and taste.</p>
              </div>
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
      <Footer />
    </div>
  );
};

export default CompareFinalise;
