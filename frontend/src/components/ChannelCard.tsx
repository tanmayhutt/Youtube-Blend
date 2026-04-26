import { Card } from "@/components/ui/card";

interface ChannelCardProps {
  title: string;
  logoUrl?: string;
  channelId?: string;
}

export const ChannelCard = ({ title, logoUrl, channelId }: ChannelCardProps) => {
  const openChannel = () => {
    if (channelId) {
      window.open(`https://www.youtube.com/channel/${channelId}`, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Card
      className="group p-2 bg-card border-border hover:border-primary cursor-pointer transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_hsl(0_100%_50%/0.3)] rounded-3xl"
      onClick={openChannel}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-secondary border-2 border-border group-hover:border-primary transition-all duration-300">
          <img
            src={logoUrl || "https://via.placeholder.com/88?text=Channel"}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <p className="text-xs font-medium text-foreground text-center line-clamp-2 group-hover:text-primary transition-colors duration-300">
          {title}
        </p>
      </div>
    </Card>
  );
};
