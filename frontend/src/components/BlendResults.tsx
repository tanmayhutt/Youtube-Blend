import { VideoCard } from "./VideoCard";
import { ChannelCard } from "./ChannelCard";
import { Badge } from "@/components/ui/badge";
import { Music, Video, List, TrendingUp } from "lucide-react";

interface BlendResultsProps {
  data: any;
  title: string;
}

export const BlendResults = ({ data, title }: BlendResultsProps) => {
  return (
    <div className="space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-foreground">{title}</h2>
        <div className="h-1 w-20 bg-gradient-to-r from-primary to-accent mx-auto rounded-full"></div>
      </div>

      {data.subscriptions && data.subscriptions.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold text-foreground">Subscriptions</h3>
            <Badge variant="secondary">{data.subscriptions.length}</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {data.subscriptions.map((sub: any, index: number) => (
              <ChannelCard
                key={index}
                title={sub.title}
                logoUrl={sub.logo_url}
                channelId={sub.channel_id}
              />
            ))}
          </div>
        </section>
      )}

      {data.subscription_genres && data.subscription_genres.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold text-foreground">Genres</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.subscription_genres.map((genre: string, index: number) => (
              <Badge key={index} variant="outline" className="border-primary text-foreground hover:bg-primary hover:text-primary-foreground transition-colors duration-300">
                {genre}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {data.saved_videos && data.saved_videos.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold text-foreground">Saved Videos</h3>
            <Badge variant="secondary">{data.saved_videos.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.saved_videos.map((video: any, index: number) => (
              <VideoCard
                key={index}
                title={video.title}
                thumbnailUrl={video.thumbnail_url}
                videoId={video.video_id}
              />
            ))}
          </div>
        </section>
      )}

      {data.music_listened && data.music_listened.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold text-foreground">Music Listened</h3>
            <Badge variant="secondary">{data.music_listened.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.music_listened.map((music: any, index: number) => (
              <VideoCard
                key={index}
                title={music.title}
                thumbnailUrl={music.thumbnail_url}
                videoId={music.video_id}
              />
            ))}
          </div>
        </section>
      )}

      {data.playlists && data.playlists.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <List className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold text-foreground">Playlists</h3>
            <Badge variant="secondary">{data.playlists.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.playlists.map((playlist: any, index: number) => (
              <VideoCard
                key={index}
                title={playlist.title}
                thumbnailUrl={playlist.thumbnail_url}
                playlistId={playlist.playlist_id}
              />
            ))}
          </div>
        </section>
      )}

      {data.video_genres && data.video_genres.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold text-foreground">Video Genres</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.video_genres.map((genre: string, index: number) => (
              <Badge key={index} variant="outline" className="border-primary text-foreground hover:bg-primary hover:text-primary-foreground transition-colors duration-300">
                {genre}
              </Badge>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
