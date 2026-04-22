import { ChannelCard } from "./ChannelCard";

interface FloatingChannelsProps {
  channels: any[];
  title: string;
}

export const FloatingChannels = ({ channels, title }: FloatingChannelsProps) => {
  if (channels.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
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
        {channels.slice(0, 15).map((channel: any, index: number) => (
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
      {channels.length > 15 && (
        <p className="text-xs text-muted-foreground text-center pt-2">+{channels.length - 15} more channels</p>
      )}
    </div>
  );
};
