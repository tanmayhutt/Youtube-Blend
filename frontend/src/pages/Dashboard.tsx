import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChannelCard } from "@/components/ChannelCard";
import { VideoCard } from "@/components/VideoCard";
import { Badge } from "@/components/ui/badge";
import { FloatingChannels } from "@/components/FloatingChannels";
import { MusicShowcase } from "@/components/MusicShowcase";
import { Youtube, Link as LinkIcon, LogOut, Loader2, Copy, Check, TrendingUp, Video, Music, List, ChevronDown, RefreshCw, Users, Disc3, Play } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { authClient, clearTokens, isAuthenticated, saveTokens } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const Dashboard = () => {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedGenres, setExpandedGenres] = useState(false);
  const [expandedVideos, setExpandedVideos] = useState(false);
  const [expandedPlaylists, setExpandedPlaylists] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Sync user data from YouTube (full fetch on first sync, incremental on subsequent)
  const syncUserData = async () => {
    setSyncing(true);
    try {
      const response = await authClient.post("/data/sync");
      console.log(`✅ ${response.data.sync_type} sync completed`);
      setUserData({
        subscriptions: response.data.subscriptions,
        subscription_genres: response.data.subscription_genres,
        saved_videos: response.data.saved_videos,
        music_listened: response.data.music_listened,
        video_genres: response.data.video_genres,
        playlists: response.data.playlists,
      });
      toast({
        title: `${response.data.sync_type} Sync Complete`,
        description: response.data.message,
      });
    } catch (error: any) {
      console.error("❌ Error syncing data:", error);
      toast({
        title: "Sync Failed",
        description: error.response?.data?.detail || "Failed to sync your YouTube data",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

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

    console.log("✅ User authenticated, checking cached data");

    const fetchData = async () => {
      try {
        const response = await authClient.get("/data/me");
        console.log("✅ Data response received", { cached: response.data.cached });

        // If no cached data, immediately trigger full sync
        if (!response.data.cached) {
          console.log("⏳ No cached data found, doing FULL sync from YouTube...");
          setLoading(false);
          await syncUserData();
        } else {
          // Set cached data and show it immediately
          console.log("✅ Showing cached data, checking for changes in background...");
          setUserData(response.data);
          setLoading(false);

          // Trigger incremental sync in background to check for changes
          console.log("📡 Syncing in background to check for changes...");
          syncUserData().catch(err => console.error("Background sync error:", err));
        }
      } catch (error: any) {
        console.error("❌ Error fetching user data:", error);
        setLoading(false);
        toast({
          title: "Error",
          description: error.response?.data?.detail || "Failed to load your data",
          variant: "destructive",
        });
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
      title: "Signed Out",
      description: "You have been successfully logged out",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <div>
            <p className="text-lg font-medium text-foreground mb-2">Loading your YouTube data...</p>
            <p className="text-sm text-muted-foreground">This can take a few seconds as we process your subscriptions, saved videos, and music history.</p>
          </div>
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
            <div className="flex items-center gap-2">
              <Logo size={28} className="rounded" />
              <h1 className="text-lg font-bold text-foreground">YouTube Blend</h1>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-2 text-sm">
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Action Card */}
        <Card className="mb-12 p-8 border-border/50">
          <div className="text-center space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-foreground">Your YouTube Profile</h2>
              <p className="text-sm text-muted-foreground">Last synced: {userData?.last_synced_at ? new Date(userData.last_synced_at).toLocaleDateString() : 'Never'}</p>
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              <Button
                onClick={syncUserData}
                disabled={syncing}
                size="lg"
                className="text-base px-8 py-6"
              >
                {syncing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2" />
                    Sync YouTube Data
                  </>
                )}
              </Button>

              <div className="border-l border-border"></div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Compare with Friends</h3>
                <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
                  Generate a unique link to compare your YouTube preferences with friends.
                </p>

                {!shareLink ? (
                  <Button
                    onClick={handleGenerateLink}
                    disabled={generatingLink}
                    size="lg"
                    className="text-base px-8 py-6"
                  >
                    {generatingLink ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating Link...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="w-5 h-5 mr-2" />
                        Create Comparison Link
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
                        className="flex-1 px-4 py-3 rounded-lg bg-background border border-border text-sm font-mono"
                      />
                      <Button onClick={handleCopyLink} className="gap-2">
                        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <Button
                      onClick={() => setShareLink(null)}
                      variant="outline"
                      size="sm"
                    >
                      Create Another Link
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Separator className="my-8" />

        {/* Quick Stats */}
        {userData && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Quick Stats</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/20">
                <div className="text-2xl font-bold text-red-600">{userData.subscriptions?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-2">Subscriptions</p>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
                <div className="text-2xl font-bold text-purple-600">{userData.music_listened?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-2">Music Tracks</p>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
                <div className="text-2xl font-bold text-blue-600">{userData.saved_videos?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-2">Saved Videos</p>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
                <div className="text-2xl font-bold text-green-600">{userData.playlists?.length || 0}</div>
                <p className="text-xs text-muted-foreground mt-2">Playlists</p>
              </Card>
            </div>
          </div>
        )}

        <Separator className="my-8" />

        {/* Section-based Accordion Layout */}
        {userData && (
          <div className="space-y-4">
            <h2 className="text-3xl font-bold mb-6 bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
              Your YouTube Universe
            </h2>

            <Accordion type="single" collapsible className="space-y-2">
              {/* Music Section */}
              {userData.music_listened && userData.music_listened.length > 0 && (
                <AccordionItem value="music" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Music className="w-5 h-5 text-purple-600" />
                      <span className="font-semibold">Music Tracks</span>
                      <Badge variant="secondary">{userData.music_listened.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <MusicShowcase musicTracks={userData.music_listened} />
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Channels Section */}
              {userData.subscriptions && userData.subscriptions.length > 0 && (
                <AccordionItem value="channels" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-red-600" />
                      <span className="font-semibold">Your Channels</span>
                      <Badge variant="secondary">{userData.subscriptions.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <FloatingChannels channels={userData.subscriptions} title="" />
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Saved Videos Section */}
              {userData.saved_videos && userData.saved_videos.length > 0 && (
                <AccordionItem value="videos" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Video className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold">Saved Videos</span>
                      <Badge variant="secondary">{userData.saved_videos.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {userData.saved_videos
                        .slice(0, expandedVideos ? undefined : 12)
                        .map((video: any, index: number) => (
                          <VideoCard key={index} title={video.title} thumbnailUrl={video.thumbnail_url} videoId={video.video_id} />
                        ))}
                    </div>
                    {(userData.saved_videos?.length || 0) > 12 && (
                      <Button
                        onClick={() => setExpandedVideos(!expandedVideos)}
                        variant="outline"
                        className="w-full gap-2"
                      >
                        {expandedVideos ? (
                          <>
                            Show Less
                            <ChevronDown className="w-4 h-4 transform rotate-180" />
                          </>
                        ) : (
                          <>
                            Show All {userData.saved_videos?.length} Videos
                            <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Playlists Section */}
              {userData.playlists && userData.playlists.length > 0 && (
                <AccordionItem value="playlists" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <List className="w-5 h-5 text-green-600" />
                      <span className="font-semibold">Your Playlists</span>
                      <Badge variant="secondary">{userData.playlists.length}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {userData.playlists
                        .slice(0, expandedPlaylists ? undefined : 12)
                        .map((playlist: any, index: number) => (
                          <VideoCard key={index} title={playlist.title} thumbnailUrl={playlist.thumbnail_url} playlistId={playlist.playlist_id} />
                        ))}
                    </div>
                    {(userData.playlists?.length || 0) > 12 && (
                      <Button
                        onClick={() => setExpandedPlaylists(!expandedPlaylists)}
                        variant="outline"
                        className="w-full gap-2"
                      >
                        {expandedPlaylists ? (
                          <>
                            Show Less
                            <ChevronDown className="w-4 h-4 transform rotate-180" />
                          </>
                        ) : (
                          <>
                            Show All {userData.playlists?.length} Playlists
                            <ChevronDown className="w-4 h-4" />
                          </>
                        )}
                      </Button>
                    )}
                  </AccordionContent>
                </AccordionItem>
              )}

              {/* Genres Section */}
              {(() => {
                const uniqueGenres = new Set([...(userData.subscription_genres || []), ...(userData.video_genres || [])]);
                return uniqueGenres.size > 0 && (
                  <AccordionItem value="genres" className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Disc3 className="w-5 h-5 text-amber-600" />
                        <span className="font-semibold">Favorite Genres</span>
                        <Badge variant="secondary">{uniqueGenres.size}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                      <p className="text-sm text-muted-foreground">These genres define your YouTube taste across your subscriptions and saved content.</p>
                      <div className="flex flex-wrap gap-3">
                        {Array.from(uniqueGenres)
                          .sort()
                          .slice(0, expandedGenres ? undefined : 20)
                          .map((genre: any, index: number) => (
                            <Badge key={index} variant="outline" className="capitalize px-4 py-2 text-sm border-2 rounded-full">
                              {String(genre).replace(/_/g, " ")}
                            </Badge>
                          ))}
                      </div>
                      {uniqueGenres.size > 20 && (
                        <Button
                          onClick={() => setExpandedGenres(!expandedGenres)}
                          variant="outline"
                          className="w-full gap-2"
                        >
                          {expandedGenres ? (
                            <>
                              Show Less
                              <ChevronDown className="w-4 h-4 transform rotate-180" />
                            </>
                          ) : (
                            <>
                              Show All {uniqueGenres.size} Genres
                              <ChevronDown className="w-4 h-4" />
                            </>
                          )}
                        </Button>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })()}
            </Accordion>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
