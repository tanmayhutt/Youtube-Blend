import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChannelCard } from "@/components/ChannelCard";
import { VideoCard } from "@/components/VideoCard";
import { Badge } from "@/components/ui/badge";
import { Youtube, Link as LinkIcon, LogOut, Loader2, Copy, Check, TrendingUp, Video, Music, List } from "lucide-react";
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
      title: "Signed Out",
      description: "You have been successfully logged out",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading your profile...</p>
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
            <h2 className="text-3xl font-bold text-foreground">Start a Comparison</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Generate a unique link to compare your YouTube preferences with friends. Share it, and get instant compatibility results.
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
                <p className="text-sm text-muted-foreground">
                  Share this link with a friend. When they sign in, you'll both see your compatibility results.
                </p>
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
        </Card>

        <Separator className="my-8" />

        {/* User Data with Tabs */}
        <div className="animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-2">Your YouTube Universe</h2>
            <p className="text-muted-foreground">Browse your subscriptions, videos, and more</p>
          </div>

          {userData && (
            <Tabs defaultValue="subscriptions" className="w-full">
              <TabsList className="grid w-full grid-cols-4 md:grid-cols-5 mb-8">
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
                <TabsTrigger value="playlists" className="flex items-center gap-1 text-xs md:text-sm">
                  <List className="w-4 h-4" />
                  <span className="hidden sm:inline">Playlists</span>
                </TabsTrigger>
                <TabsTrigger value="genres" className="flex items-center gap-1 text-xs md:text-sm">
                  <Music className="w-4 h-4" />
                  <span className="hidden sm:inline">Genres</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="subscriptions" className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-xl font-semibold">Your Subscriptions</h3>
                    <Badge variant="secondary">{userData.subscriptions?.length || 0}</Badge>
                  </div>
                  {userData.subscriptions && userData.subscriptions.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {userData.subscriptions.map((sub: any, index: number) => (
                        <ChannelCard key={index} title={sub.title} logoUrl={sub.logo_url} channelId={sub.channel_id} />
                      ))}
                    </div>
                  ) : (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground">No subscriptions found</p>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="videos" className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-xl font-semibold">Your Saved Videos</h3>
                    <Badge variant="secondary">{userData.saved_videos?.length || 0}</Badge>
                  </div>
                  {userData.saved_videos && userData.saved_videos.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {userData.saved_videos.map((video: any, index: number) => (
                        <VideoCard key={index} title={video.title} thumbnailUrl={video.thumbnail_url} videoId={video.video_id} />
                      ))}
                    </div>
                  ) : (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground">No saved videos found</p>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="music" className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-xl font-semibold">Your Music</h3>
                    <Badge variant="secondary">{userData.music_listened?.length || 0}</Badge>
                  </div>
                  {userData.music_listened && userData.music_listened.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {userData.music_listened.map((music: any, index: number) => (
                        <VideoCard key={index} title={music.title} thumbnailUrl={music.thumbnail_url} videoId={music.video_id} />
                      ))}
                    </div>
                  ) : (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground">No music found</p>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="playlists" className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-xl font-semibold">Your Playlists</h3>
                    <Badge variant="secondary">{userData.playlists?.length || 0}</Badge>
                  </div>
                  {userData.playlists && userData.playlists.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {userData.playlists.map((playlist: any, index: number) => (
                        <VideoCard key={index} title={playlist.title} thumbnailUrl={playlist.thumbnail_url} playlistId={playlist.playlist_id} />
                      ))}
                    </div>
                  ) : (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground">No playlists found</p>
                    </Card>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="genres" className="space-y-6">
                <div className="space-y-6">
                  {userData.subscription_genres && userData.subscription_genres.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Channel Genres</h3>
                      <div className="flex flex-wrap gap-2">
                        {userData.subscription_genres.map((genre: string, index: number) => (
                          <Badge key={index} variant="outline">{genre}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {userData.video_genres && userData.video_genres.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Video Genres</h3>
                      <div className="flex flex-wrap gap-2">
                        {userData.video_genres.map((genre: string, index: number) => (
                          <Badge key={index} variant="outline">{genre}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
