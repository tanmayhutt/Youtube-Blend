import { cn } from "@/lib/utils";

interface MarqueeProps {
  text: string;
  className?: string;
  repeat?: number;
}

export const Marquee = ({ text, className, repeat = 10 }: MarqueeProps) => {
  const content = Array(repeat).fill(text).join(" • ");
  
  return (
    <div className={cn("overflow-hidden whitespace-nowrap bg-primary text-primary-foreground border-y-[4px] border-border py-3 flex relative z-10 shadow-[var(--shadow-card)]", className)}>
      <div className="animate-marquee inline-block font-black uppercase text-xl md:text-3xl tracking-widest px-4 shrink-0">
        {content}
      </div>
      <div className="animate-marquee inline-block font-black uppercase text-xl md:text-3xl tracking-widest px-4 shrink-0" aria-hidden="true">
        {content}
      </div>
    </div>
  );
};
