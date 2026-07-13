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
import { Marquee } from "@/components/Marquee";
import { Circle, Squiggle, Star, Pill } from "@/components/Geometry";
import { authClient, clearTokens, isAuthenticated, saveTokens } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatRelativeTime } from "@/lib/utils";
import confetti from "canvas-confetti";

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
      console.log(`[SYNC] ${response.data.sync_type} sync completed`);
      setUserData({
        subscriptions: response.data.subscriptions,
        subscription_genres: response.data.subscription_genres,
        saved_videos: response.data.saved_videos,
        music_listened: response.data.music_listened,
        video_genres: response.data.video_genres,
        playlists: response.data.playlists,
        last_synced_at: response.data.last_synced_at,
      });

      // Confetti burst for fun!
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FF0000', '#000000', '#FFFFFF']
      });

      // Show warning if quota exceeded
      if (response.data.warning === 'quotaExceeded') {
        toast({
          title: "API Quota Exceeded",
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
      console.error("[ERROR] Error syncing data:", error);
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
      console.log("[AUTH] Tokens found in URL, saving to localStorage");
      saveTokens({ access_token: accessToken, refresh_token: refreshToken });
      // Clean up URL
      window.history.replaceState({}, document.title, "/dashboard");
      console.log("[AUTH] URL cleaned, tokens saved");
    } else {
      console.log("[AUTH] No tokens in URL params");
    }

    if (!isAuthenticated()) {
      console.log("[AUTH] Not authenticated, redirecting to landing page");
      toast({
        title: "Authentication Required",
        description: "Please log in to continue",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    console.log("[AUTH] User authenticated, checking cached data");

    const fetchData = async () => {
      try {
        const response = await authClient.get("/data/me");
        console.log("[DATA] Data response received", { cached: response.data.cached });
        setUserProfile(response.data.profile || null);
        setUserId(response.data.user_id || null);

        // If no cached data, immediately trigger full sync
        if (!response.data.cached) {
          console.log("[SYNC] No cached data found, doing FULL sync from YouTube...");
          setLoading(false);
          await syncUserData();
        } else {
          // Set cached data and show it immediately
          console.log("[DATA] Showing cached data");
          setUserData(response.data);
          setLoading(false);

          // QUOTA OPTIMIZATION: Removed automatic background sync
          // Users can manually click "Refresh" button if they want fresh data
          // This prevents quota waste from repeated auto-syncs
          console.log("[INFO] Background sync disabled to conserve API quota. Click 'Refresh' to sync manually.");
        }
      } catch (error: any) {
        console.error("[ERROR] Error fetching user data:", error);
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
      
      // Confetti from the sides!
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FF0000', '#000000']
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FF0000', '#000000']
      });

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
    <div className="min-h-screen bg-background bg-halftone relative overflow-hidden">
      {/* Header */}
      <header className="border-b-[4px] border-border bg-card relative z-50 shadow-[var(--shadow-card)]">
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

      <Marquee text="DASHBOARD • ANALYZE YOUR TASTE" className="bg-primary text-primary-foreground py-3 border-y-[4px] border-border w-[105%] -ml-[2.5%] mt-4 shadow-[var(--shadow-card)]" />

      <main className="container mx-auto px-4 py-12 relative z-10">
        <Star className="top-10 right-10 text-background hidden md:block z-0" />
        <Circle className="bottom-40 left-10 hidden lg:block z-0" />

        {/* Action Card */}
        <Card className="mb-12 p-10 bg-card border-[4px] border-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative transition-transform">
          <div className="relative text-center space-y-8 z-10">
            <div className="space-y-2">
              <h2 className="text-5xl md:text-6xl font-black tracking-tight text-foreground uppercase text-outline text-background inline-block">Your Profile</h2>
              <p className="text-lg font-bold text-foreground/80 max-w-lg mx-auto bg-white/90 border-[2px] border-border p-3 shadow-[4px_4px_0_0_rgba(0,0,0,1)] inline-block mt-4">Generate comprehensive insights into your viewing habits and synchronize your latest YouTube data.</p>
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
          <div className="mb-12 relative">
            <Squiggle className="top-10 right-40 hidden md:block z-0" />
            <h2 className="text-4xl font-black tracking-tight mb-8 text-foreground uppercase border-b-[4px] border-border inline-block pb-2">Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Card className="p-6 bg-card border-[4px] border-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all z-10">
                <div className="text-5xl font-black text-foreground">{userData.subscriptions?.length || 0}</div>
                <p className="text-sm text-foreground mt-2 font-bold tracking-widest uppercase bg-primary text-primary-foreground inline-block px-2 py-1">Subscriptions</p>
              </Card>
              <Card className="p-6 bg-card border-[4px] border-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all z-10">
                <div className="text-5xl font-black text-foreground">{userData.music_listened?.length || 0}</div>
                <p className="text-sm text-foreground mt-2 font-bold tracking-widest uppercase bg-secondary inline-block px-2 py-1">Music Tracks</p>
              </Card>
              <Card className="p-6 bg-card border-[4px] border-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all z-10">
                <div className="text-5xl font-black text-foreground">{userData.saved_videos?.length || 0}</div>
                <p className="text-sm text-foreground mt-2 font-bold tracking-widest uppercase bg-primary text-primary-foreground inline-block px-2 py-1">Saved Videos</p>
              </Card>
              <Card className="p-6 bg-card border-[4px] border-border shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[4px_4px_0_0_rgba(0,0,0,1)] transition-all z-10">
                <div className="text-5xl font-black text-foreground">{userData.playlists?.length || 0}</div>
                <p className="text-sm text-foreground mt-2 font-bold tracking-widest uppercase bg-secondary inline-block px-2 py-1">Playlists</p>
              </Card>
            </div>
          </div>
        )}

        <Marquee text="EXPLORE YOUR DATA • ANALYZE" className="bg-primary text-primary-foreground py-2 border-y-[4px] border-border w-[105%] -ml-[2.5%] my-12 shadow-[var(--shadow-card)]" />

        {/* Full-Width Navbar-Style Sections */}
        {userData && (
          <div className="relative mt-8">
            <Pill className="top-0 right-0 hidden md:block z-0" />
            <h2 className="text-4xl font-black tracking-tight mb-8 text-foreground uppercase border-b-[4px] border-border inline-block pb-2">
              Detailed Analysis
            </h2>

            <div className="mb-12">
              <div className="flex gap-4 overflow-x-auto pb-6 border-b-[4px] border-border/60">
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
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b-[4px] border-border">
                    <div className="p-4 bg-primary border-[3px] border-border shadow-[var(--shadow-button)]">
                      <Music className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-3xl font-black uppercase">Music Tracks</h3>
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">All your favorite music</p>
                    </div>
                    <Badge className="text-lg px-4 py-2 border-[3px] border-border rounded-none">{userData.music_listened.length}</Badge>
                  </div>
                  <MusicShowcase musicTracks={userData.music_listened} />
                </div>
              )}

              {/* Channels Section */}
              {activeSection === "channels" && userData.subscriptions && userData.subscriptions.length > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b-[4px] border-border">
                    <div className="p-4 bg-primary border-[3px] border-border shadow-[var(--shadow-button)]">
                      <Users className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-3xl font-black uppercase">Your Channels</h3>
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Subscriptions and channels you follow</p>
                    </div>
                    <Badge className="text-lg px-4 py-2 border-[3px] border-border rounded-none">{userData.subscriptions.length}</Badge>
                  </div>
                  <FloatingChannels channels={userData.subscriptions} title="" />
                </div>
              )}

              {/* Saved Videos Section */}
              {activeSection === "videos" && userData.saved_videos && userData.saved_videos.length > 0 && (
                <div>
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b-[4px] border-border">
                    <div className="p-4 bg-primary border-[3px] border-border shadow-[var(--shadow-button)]">
                      <Video className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-3xl font-black uppercase">Saved Videos</h3>
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Your library of saved videos</p>
                    </div>
                    <Badge className="text-lg px-4 py-2 border-[3px] border-border rounded-none">{userData.saved_videos.length}</Badge>
                  </div>
                  <Card className="p-8 border-[3px] border-border bg-card shadow-[var(--shadow-card)]">
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
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b-[4px] border-border">
                    <div className="p-4 bg-primary border-[3px] border-border shadow-[var(--shadow-button)]">
                      <List className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-3xl font-black uppercase">Your Playlists</h3>
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">All your created and saved playlists</p>
                    </div>
                    <Badge className="text-lg px-4 py-2 border-[3px] border-border rounded-none">{userData.playlists.length}</Badge>
                  </div>
                  <Card className="p-8 border-[3px] border-border bg-card shadow-[var(--shadow-card)]">
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
                  <div className="flex items-center gap-4 mb-6 pb-4 border-b-[4px] border-border">
                    <div className="p-4 bg-primary border-[3px] border-border shadow-[var(--shadow-button)]">
                      <Disc3 className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-3xl font-black uppercase">Favorite Genres</h3>
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Your taste across your subscriptions and saved content</p>
                    </div>
                    <Badge className="text-lg px-4 py-2 border-[3px] border-border rounded-none">{uniqueGenres.size}</Badge>
                  </div>
                  <Card className="p-8 border-[3px] border-border bg-card shadow-[var(--shadow-card)]">
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
