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
      className="group p-3 cursor-pointer transition-all duration-200 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none bg-card"
      onClick={openChannel}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-secondary border-[3px] border-border group-hover:border-primary transition-all duration-200">
          <img
            src={logoUrl || "https://via.placeholder.com/88?text=Channel"}
            alt={title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <p className="text-xs font-black text-foreground text-center line-clamp-2 uppercase tracking-tight">
          {title}
        </p>
      </div>
    </Card>
  );
};
