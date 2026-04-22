import { VideoCard } from "./VideoCard";
import { Music } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MusicShowcaseProps {
  musicTracks: any[];
}

export const MusicShowcase = ({ musicTracks }: MusicShowcaseProps) => {
  if (!musicTracks || musicTracks.length === 0) {
    return null;
  }

  const topTracks = musicTracks.slice(0, 4);
  const moreCount = Math.max(0, musicTracks.length - 4);

  return (
    <Card className="p-8 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-red-500/10 border-purple-500/30">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
            <Music className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">Your Music Vibes</h3>
            <p className="text-sm text-muted-foreground">
              {musicTracks.length} track{musicTracks.length !== 1 ? "s" : ""} you vibe with
            </p>
          </div>
        </div>

        {/* Animated Music Notes Background */}
        <style>{`
          @keyframes float-note {
            0%, 100% { transform: translateY(0px) rotate(0deg); opacity: 0.3; }
            50% { transform: translateY(-20px) rotate(5deg); opacity: 0.6; }
          }
          .music-note {
            animation: float-note 4s ease-in-out infinite;
          }
        `}</style>

        {/* Top Tracks */}
        <div className="space-y-4">
          <p className="text-sm font-semibold text-purple-400">Top Tracks</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {topTracks.map((track, index) => (
              <div key={index} className="group relative">
                <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-75 blur transition duration-300 -z-10" />
                <VideoCard title={track.title} thumbnailUrl={track.thumbnail_url} videoId={track.video_id} />
              </div>
            ))}
          </div>
        </div>

        {/* Music Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-purple-500/20">
          <div className="text-center space-y-2">
            <div className="text-2xl font-bold text-purple-400">{musicTracks.length}</div>
            <p className="text-xs text-muted-foreground">Total Tracks</p>
          </div>
          <div className="text-center space-y-2">
            <div className="text-2xl font-bold text-pink-400">
              {Math.round((musicTracks.length / 100) * 50)}h
            </div>
            <p className="text-xs text-muted-foreground">Est. Listening</p>
          </div>
          <div className="text-center space-y-2">
            <div className="text-2xl font-bold text-red-400">
              {Math.round(Math.random() * 100)}%
            </div>
            <p className="text-xs text-muted-foreground">Vibe Score</p>
          </div>
        </div>

        {moreCount > 0 && (
          <p className="text-center text-sm text-muted-foreground/70 pt-2">
            + {moreCount} more tracks waiting to be discovered
          </p>
        )}
      </div>
    </Card>
  );
};
