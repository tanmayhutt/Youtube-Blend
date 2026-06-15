import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChannelCard } from "@/components/ChannelCard";
import { VideoCard } from "@/components/VideoCard";
import { Badge } from "@/components/ui/badge";
import { FloatingChannels } from "@/components/FloatingChannels";
import { MusicShowcase } from "@/components/MusicShowcase";
import { Youtube, Link as LinkIcon, LogOut, Loader2, Copy, Check, TrendingUp, Video, Music, List, ChevronDown, RefreshCw, Users, Disc3, Settings } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { authClient, clearTokens, isAuthenticated, saveTokens } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";

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
  const [activeSection, setActiveSection] = useState<string>("channels");
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
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
        last_synced_at: response.data.last_synced_at,
      });

      // Show warning if quota exceeded
      if (response.data.warning === 'quotaExceeded') {
        toast({
          title: "⚠️ API Quota Exceeded",
          description: response.data.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: `${response.data.sync_type} Sync Complete`,
          description: response.data.message,
        });
      }
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
        setUserProfile(response.data.profile || null);
        setUserId(response.data.user_id || null);

        // If no cached data, immediately trigger full sync
        if (!response.data.cached) {
          console.log("⏳ No cached data found, doing FULL sync from YouTube...");
          setLoading(false);
          await syncUserData();
        } else {
          // Set cached data and show it immediately
          console.log("✅ Showing cached data");
          setUserData(response.data);
          setLoading(false);

          // QUOTA OPTIMIZATION: Removed automatic background sync
          // Users can manually click "Refresh" button if they want fresh data
          // This prevents quota waste from repeated auto-syncs
          console.log("💡 Background sync disabled to conserve API quota. Click 'Refresh' to sync manually.");
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

  useEffect(() => {
    if (!userData) return;

    const sections: string[] = [];
    if (userData.subscriptions?.length) sections.push("channels");
    if (userData.music_listened?.length) sections.push("music");
    if (userData.saved_videos?.length) sections.push("videos");
    if (userData.playlists?.length) sections.push("playlists");

    const uniqueGenres = new Set([...(userData.subscription_genres || []), ...(userData.video_genres || [])]);
    if (uniqueGenres.size > 0) sections.push("genres");

    if (!sections.includes(activeSection)) {
      setActiveSection(sections[0] || "channels");
    }
  }, [activeSection, userData]);

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

  const uniqueGenres = new Set([...(userData?.subscription_genres || []), ...(userData?.video_genres || [])]);
  const profileName = userProfile?.name || userProfile?.email || (userId ? `User ${userId.slice(-6)}` : "Unknown user");
  const profileEmail = userProfile?.name && userProfile?.email ? userProfile.email : null;
  const profileInitial = profileName ? profileName.charAt(0).toUpperCase() : "U";

  const navSections = [
    {
      key: "channels",
      label: "Channels",
      count: userData?.subscriptions?.length || 0,
      icon: Users,
      enabled: (userData?.subscriptions?.length || 0) > 0,
    },
    {
      key: "music",
      label: "Music",
      count: userData?.music_listened?.length || 0,
      icon: Music,
      enabled: (userData?.music_listened?.length || 0) > 0,
    },
    {
      key: "videos",
      label: "Videos",
      count: userData?.saved_videos?.length || 0,
      icon: Video,
      enabled: (userData?.saved_videos?.length || 0) > 0,
    },
    {
      key: "playlists",
      label: "Playlists",
      count: userData?.playlists?.length || 0,
      icon: List,
      enabled: (userData?.playlists?.length || 0) > 0,
    },
    {
      key: "genres",
      label: "Genres",
      count: uniqueGenres.size,
      icon: Disc3,
      enabled: uniqueGenres.size > 0,
    },
  ].filter((section) => section.enabled);

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
      <header className="border-b border-white/10 bg-background/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size={28} className="rounded" />
              <h1 className="text-lg font-semibold tracking-tight text-foreground/90">Blend</h1>
            </div>
            <div className="flex items-center gap-6">
              {userData?.last_synced_at && (
                <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                  <RefreshCw className="w-3 h-3 opacity-70" />
                  <span>Synced {formatRelativeTime(userData.last_synced_at)}</span>
                </div>
              )}
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 text-sm">
                  {userProfile?.picture ? (
                    <img
                      src={userProfile.picture}
                      alt={profileName}
                      className="w-6 h-6 rounded-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center">
                      {profileInitial}
                    </div>
                  )}
                  <span className="hidden sm:inline">{profileName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex items-center gap-2">
                    {userProfile?.picture ? (
                      <img
                        src={userProfile.picture}
                        alt={profileName}
                        className="w-8 h-8 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground text-xs font-semibold flex items-center justify-center">
                        {profileInitial}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold">{profileName}</p>
                      {profileEmail && (
                        <p className="text-xs text-muted-foreground">{profileEmail}</p>
                      )}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings (soon)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Action Card */}
        <Card className="mb-12 p-10 bg-card/40 backdrop-blur-md border-white/10 shadow-2xl overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50"></div>
          <div className="relative text-center space-y-8">
            <div className="space-y-2">
              <h2 className="text-4xl font-semibold tracking-tight text-foreground/90">Your Analytical Profile</h2>
              <p className="text-sm text-muted-foreground/80 max-w-lg mx-auto">Generate comprehensive insights into your viewing habits and synchronize your latest YouTube data.</p>
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
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

              <div className="w-px bg-white/10 hidden sm:block mx-2"></div>

              <div>
                <h3 className="text-lg font-medium text-foreground/90 mb-3">Compare Profiles</h3>
                <p className="text-sm text-muted-foreground/80 max-w-md mx-auto mb-6">
                  Generate a unique link to measure your YouTube taste compatibility with others.
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

        <Separator className="my-10 bg-white/5" />

        {/* Quick Stats */}
        {userData && (
          <div className="mb-12">
            <h2 className="text-xl font-semibold tracking-tight mb-6 text-foreground/90">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-6 bg-card/20 backdrop-blur-sm border-white/10 hover:bg-card/40 transition-colors">
                <div className="text-3xl font-light text-foreground/90">{userData.subscriptions?.length || 0}</div>
                <p className="text-xs text-muted-foreground/70 mt-2 font-medium tracking-wide uppercase">Subscriptions</p>
              </Card>
              <Card className="p-6 bg-card/20 backdrop-blur-sm border-white/10 hover:bg-card/40 transition-colors">
                <div className="text-3xl font-light text-foreground/90">{userData.music_listened?.length || 0}</div>
                <p className="text-xs text-muted-foreground/70 mt-2 font-medium tracking-wide uppercase">Music Tracks</p>
              </Card>
              <Card className="p-6 bg-card/20 backdrop-blur-sm border-white/10 hover:bg-card/40 transition-colors">
                <div className="text-3xl font-light text-foreground/90">{userData.saved_videos?.length || 0}</div>
                <p className="text-xs text-muted-foreground/70 mt-2 font-medium tracking-wide uppercase">Saved Videos</p>
              </Card>
              <Card className="p-6 bg-card/20 backdrop-blur-sm border-white/10 hover:bg-card/40 transition-colors">
                <div className="text-3xl font-light text-foreground/90">{userData.playlists?.length || 0}</div>
                <p className="text-xs text-muted-foreground/70 mt-2 font-medium tracking-wide uppercase">Playlists</p>
              </Card>
            </div>
          </div>
        )}

        <Separator className="my-10 bg-white/5" />

        {/* Full-Width Navbar-Style Sections */}
        {userData && (
          <div>
            <h2 className="text-2xl font-semibold tracking-tight mb-8 text-foreground/90">
              Detailed Analysis
            </h2>

            <div className="mb-8">
              <div className="flex gap-2 overflow-x-auto pb-3 border-b border-border/60">
                {navSections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.key;
                  return (
                    <Button
                      key={section.key}
                      variant={isActive ? "default" : "outline"}
                      onClick={() => setActiveSection(section.key)}
                      className="gap-2 whitespace-nowrap"
                      aria-current={isActive ? "page" : undefined}
                    >
                      <Icon className="w-4 h-4" />
                      {section.label}
                      <Badge variant={isActive ? "secondary" : "outline"} className="ml-1">
                        {section.count}
                      </Badge>
                    </Button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Switch sections here instead of scrolling.</p>
            </div>

            <div>
              {/* Music Section */}
              {activeSection === "music" && userData.music_listened && userData.music_listened.length > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-purple-200 dark:border-purple-900/50">
                    <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Music className="w-7 h-7 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold">Music Tracks</h3>
                      <p className="text-sm text-muted-foreground">All your favorite music</p>
                    </div>
                    <Badge className="text-lg px-4 py-2">{userData.music_listened.length}</Badge>
                  </div>
                  <Card className="p-8 border-l-4 border-l-purple-600">
                    <MusicShowcase musicTracks={userData.music_listened} />
                  </Card>
                </div>
              )}

              {/* Channels Section */}
              {activeSection === "channels" && userData.subscriptions && userData.subscriptions.length > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-red-200 dark:border-red-900/50">
                    <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <Users className="w-7 h-7 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold">Your Channels</h3>
                      <p className="text-sm text-muted-foreground">Subscriptions and channels you follow</p>
                    </div>
                    <Badge className="text-lg px-4 py-2">{userData.subscriptions.length}</Badge>
                  </div>
                  <Card className="p-8 border-l-4 border-l-red-600">
                    <FloatingChannels channels={userData.subscriptions} title="" />
                  </Card>
                </div>
              )}

              {/* Saved Videos Section */}
              {activeSection === "videos" && userData.saved_videos && userData.saved_videos.length > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-blue-200 dark:border-blue-900/50">
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Video className="w-7 h-7 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold">Saved Videos</h3>
                      <p className="text-sm text-muted-foreground">Your library of saved videos</p>
                    </div>
                    <Badge className="text-lg px-4 py-2">{userData.saved_videos.length}</Badge>
                  </div>
                  <Card className="p-8 border-l-4 border-l-blue-600">
                    <div className="space-y-4">
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
                    </div>
                  </Card>
                </div>
              )}

              {/* Playlists Section */}
              {activeSection === "playlists" && userData.playlists && userData.playlists.length > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-green-200 dark:border-green-900/50">
                    <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <List className="w-7 h-7 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold">Your Playlists</h3>
                      <p className="text-sm text-muted-foreground">All your created and saved playlists</p>
                    </div>
                    <Badge className="text-lg px-4 py-2">{userData.playlists.length}</Badge>
                  </div>
                  <Card className="p-8 border-l-4 border-l-green-600">
                    <div className="space-y-4">
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
                    </div>
                  </Card>
                </div>
              )}

              {/* Genres Section */}
              {activeSection === "genres" && uniqueGenres.size > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-amber-200 dark:border-amber-900/50">
                    <div className="p-4 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                      <Disc3 className="w-7 h-7 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold">Favorite Genres</h3>
                      <p className="text-sm text-muted-foreground">Your taste across your subscriptions and saved content</p>
                    </div>
                    <Badge className="text-lg px-4 py-2">{uniqueGenres.size}</Badge>
                  </div>
                  <Card className="p-8 border-l-4 border-l-amber-600">
                    <div className="space-y-4">
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
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Dashboard;
