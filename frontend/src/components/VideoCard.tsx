import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";

interface VideoCardProps {
  title: string;
  thumbnailUrl?: string;
  videoId?: string;
  playlistId?: string;
  channelId?: string;
}

export const VideoCard = ({ title, thumbnailUrl, videoId, playlistId, channelId }: VideoCardProps) => {
  const openYouTubeLink = () => {
    let url = "";
    if (videoId) {
      url = `https://www.youtube.com/watch?v=${videoId}`;
    } else if (playlistId) {
      url = `https://www.youtube.com/playlist?list=${playlistId}`;
    } else if (channelId) {
      url = `https://www.youtube.com/channel/${channelId}`;
    }
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <Card
      className="group overflow-hidden bg-card border-border hover:border-primary cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_hsl(0_100%_50%/0.3)]"
      onClick={openYouTubeLink}
    >
      <div className="relative aspect-video overflow-hidden bg-secondary">
        <img
          src={thumbnailUrl || "https://via.placeholder.com/320x180?text=No+Thumbnail"}
          alt={title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
          <Play className="w-12 h-12 text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-lg" />
        </div>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors duration-300">
          {title}
        </p>
      </div>
    </Card>
  );
};
