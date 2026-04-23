import { useState } from "react";
import { VideoCard } from "./VideoCard";
import { Music, ChevronDown } from "lucide-react";
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

  // Sort by most recent/most engaged (API returns in order of engagement)
  // If play_count exists, use it; otherwise keep API order (which is most relevant first)
  const sortedTracks = [...musicTracks].sort((a, b) => {
    // If both have play_count, sort by it (descending)
    if (a.play_count !== undefined && b.play_count !== undefined) {
      return b.play_count - a.play_count;
    }
    // Otherwise keep original order (most relevant from API)
    return 0;
  });

  const displayTracks = expandedMusic ? sortedTracks : sortedTracks.slice(0, 4);
  const hiddenCount = Math.max(0, sortedTracks.length - 4);

  return (
    <Card className="p-8 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-red-500/10 border-purple-500/30 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
          <Music className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-foreground">Your Music Vibes</h3>
          <p className="text-sm text-muted-foreground">
            {sortedTracks.length} track{sortedTracks.length !== 1 ? "s" : ""} you vibe with
          </p>
        </div>
      </div>

      {/* Music Tracks Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {displayTracks.map((track, index) => (
          <div key={index} className="group">
            <VideoCard title={track.title} thumbnailUrl={track.thumbnail_url} videoId={track.video_id} />
          </div>
        ))}
      </div>

      {/* Music Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-purple-500/20">
        <div className="text-center space-y-2">
          <div className="text-2xl font-bold text-purple-400">{sortedTracks.length}</div>
          <p className="text-xs text-muted-foreground">Total Tracks</p>
        </div>
        <div className="text-center space-y-2">
          <div className="text-2xl font-bold text-pink-400">
            {Math.round((sortedTracks.length / 100) * 50)}h
          </div>
          <p className="text-xs text-muted-foreground">Est. Listening</p>
        </div>
        <div className="text-center space-y-2">
          <div className="text-2xl font-bold text-red-400">🔥</div>
          <p className="text-xs text-muted-foreground">Trending</p>
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
