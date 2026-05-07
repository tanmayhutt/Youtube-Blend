import { useState } from "react";
import { ChannelCard } from "./ChannelCard";
import { Button } from "@/components/ui/button";

interface FloatingChannelsProps {
  channels: any[];
  title: string;
}

const DEFAULT_VISIBLE = 15;

export const FloatingChannels = ({ channels, title }: FloatingChannelsProps) => {
  const [expanded, setExpanded] = useState(false);

  if (channels.length === 0) {
    return null;
  }

  const visibleChannels = expanded ? channels : channels.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = Math.max(channels.length - visibleChannels.length, 0);

  return (
    <div className="space-y-4">
      {title ? <h3 className="text-lg font-semibold text-foreground">{title}</h3> : null}
      <style>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .channel-item {
          animation: fadeInScale 0.5s ease-out forwards;
        }
      `}</style>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {visibleChannels.map((channel: any, index: number) => (
          <div
            key={index}
            className="channel-item transition-all duration-300 hover:scale-105 hover:shadow-lg"
            style={{
              animationDelay: `${index * 0.05}s`,
            }}
          >
            <ChannelCard title={channel.title} logoUrl={channel.logo_url} channelId={channel.channel_id} />
          </div>
        ))}
      </div>
      {channels.length > DEFAULT_VISIBLE && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show fewer channels" : `Show ${hiddenCount} more channels`}
        </Button>
      )}
    </div>
  );
};
