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
      className="group overflow-hidden cursor-pointer transition-all duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
      onClick={openYouTubeLink}
    >
      <div className="relative aspect-video overflow-hidden bg-secondary border-b-[3px] border-border">
        <img
          src={thumbnailUrl || "https://via.placeholder.com/320x180?text=No+Thumbnail"}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-primary/20 transition-all duration-200 flex items-center justify-center">
          <Play className="w-12 h-12 text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </div>
      </div>
      <div className="p-3 bg-background">
        <p className="text-sm font-black text-foreground line-clamp-2 uppercase tracking-tight">
          {title}
        </p>
      </div>
    </Card>
  );
};
