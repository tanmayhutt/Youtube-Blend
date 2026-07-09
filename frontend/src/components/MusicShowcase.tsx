import { useState } from "react";
import { VideoCard } from "./VideoCard";
import { Music, ChevronDown, Flame } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MusicShowcaseProps {
  musicTracks: any[];
}

export const MusicShowcase = ({ musicTracks }: MusicShowcaseProps) => {
  const [expandedMusic, setExpandedMusic] = useState(false);

  if (!musicTracks || musicTracks.length === 0) {
    return null;
  }

  // Sort by most listened (watch_count = times in playlists + likes)
  const sortedTracks = [...musicTracks].sort((a, b) => {
    const watchsA = a.watch_count || 0;
    const watchsB = b.watch_count || 0;
    return watchsB - watchsA;
  });

  const displayTracks = expandedMusic ? sortedTracks : sortedTracks.slice(0, 4);
  const hiddenCount = Math.max(0, sortedTracks.length - 4);

  return (
    <Card className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-primary border-[3px] border-border shadow-[var(--shadow-button)]">
          <Music className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-2xl font-black tracking-tight text-foreground">Your Music Vibes</h3>
          <p className="text-sm font-bold text-muted-foreground">
            {sortedTracks.length} track{sortedTracks.length !== 1 ? "s" : ""} you vibe with
          </p>
        </div>
      </div>

      {/* Music Tracks Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {displayTracks.map((track, index) => (
          <div key={index} className="group hover:-translate-y-1 hover:translate-x-1 transition-transform">
            <VideoCard title={track.title} thumbnailUrl={track.thumbnail_url} videoId={track.video_id} />
          </div>
        ))}
      </div>

      {/* Music Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t-[3px] border-border mt-4">
        <div className="text-center space-y-2">
          <div className="text-3xl font-black text-foreground">{sortedTracks.length}</div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Tracks</p>
        </div>
        <div className="text-center space-y-2">
          <div className="text-3xl font-black text-foreground">
            {Math.round((sortedTracks.length / 100) * 50)}h
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Est. Listening</p>
        </div>
        <div className="text-center space-y-2">
          <div className="flex justify-center text-primary">
            <Flame className="w-8 h-8 animate-pulse fill-primary" />
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Trending</p>
        </div>
      </div>

      {/* Show More Button */}
      {hiddenCount > 0 && (
        <Button
          onClick={() => setExpandedMusic(!expandedMusic)}
          variant="outline"
          className="w-full gap-2"
        >
          {expandedMusic ? (
            <>
              Show Less
              <ChevronDown className="w-4 h-4 transform rotate-180" />
            </>
          ) : (
            <>
              Show All {sortedTracks.length} Tracks
              <ChevronDown className="w-4 h-4" />
            </>
          )}
        </Button>
      )}
    </Card>
  );
};
