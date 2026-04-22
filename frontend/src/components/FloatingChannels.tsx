import { useEffect, useRef } from "react";
import { ChannelCard } from "./ChannelCard";

interface FloatingChannelsProps {
  channels: any[];
  title: string;
}

export const FloatingChannels = ({ channels, title }: FloatingChannelsProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || channels.length === 0) return;

    const items = containerRef.current.querySelectorAll("[data-channel-item]");
    const itemCount = items.length;
    const radius = 120;
    const centerX = containerRef.current.clientWidth / 2;
    const centerY = 150;

    items.forEach((item: any, index: number) => {
      const angle = (index / itemCount) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      (item as HTMLElement).style.setProperty("--rotate", `${angle}rad`);
      (item as HTMLElement).style.position = "absolute";
      (item as HTMLElement).style.left = `${x}px`;
      (item as HTMLElement).style.top = `${y}px`;
      (item as HTMLElement).style.transform = "translate(-50%, -50%)";

      // Stagger animation
      (item as HTMLElement).style.animation = `float 6s ease-in-out infinite`;
      (item as HTMLElement).style.animationDelay = `${index * 0.1}s`;
    });
  }, [channels]);

  if (channels.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-20px); }
        }
        @keyframes orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        ref={containerRef}
        className="relative w-full rounded-lg border border-red-500/20 bg-gradient-to-br from-red-500/5 to-orange-500/5 p-8"
        style={{ height: "350px", overflow: "hidden" }}
      >
        {channels.slice(0, 8).map((channel: any, index: number) => (
          <div
            key={index}
            data-channel-item
            className="absolute transition-all duration-300 hover:scale-110"
            style={{
              animation: `float 6s ease-in-out infinite`,
              animationDelay: `${index * 0.1}s`,
            }}
          >
            <ChannelCard title={channel.title} logoUrl={channel.logo_url} channelId={channel.channel_id} />
          </div>
        ))}

        {/* Floating text in center */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-2">
            <p className="text-2xl font-bold text-red-600/20">{channels.length}</p>
            <p className="text-xs text-muted-foreground/50">Channels</p>
          </div>
        </div>
      </div>
    </div>
  );
};
