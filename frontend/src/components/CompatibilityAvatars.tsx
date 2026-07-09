import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CompatibilityAvatarsProps {
  viewerProfile: any;
  otherProfile: any;
  score: number;
  className?: string;
}

export const CompatibilityAvatars = ({ viewerProfile, otherProfile, score, className }: CompatibilityAvatarsProps) => {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Trigger animation shortly after mount
    const timer = setTimeout(() => setAnimate(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const viewerName = viewerProfile?.name || "You";
  const otherName = otherProfile?.name || "Friend";

  const getInitial = (name: string) => name ? name.charAt(0).toUpperCase() : "?";

  return (
    <div className={cn("relative flex justify-center items-center h-40 overflow-hidden", className)}>
      {/* Viewer Avatar (Slides in from Left) */}
      <div 
        className={cn(
          "absolute transition-all duration-700 ease-out z-10 w-24 h-24 rounded-full border-[4px] border-border bg-card shadow-[4px_4px_0_0_#000] flex items-center justify-center overflow-hidden",
          animate ? "translate-x-[-30px]" : "translate-x-[-150px] opacity-0"
        )}
      >
        {viewerProfile?.picture ? (
          <img src={viewerProfile.picture} alt={viewerName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl font-black">{getInitial(viewerName)}</span>
        )}
      </div>

      {/* Score Badge (Fades in Center) */}
      <div 
        className={cn(
          "absolute transition-all duration-1000 delay-300 ease-in-out z-30 flex items-center justify-center w-16 h-16 rounded-full border-[3px] border-border bg-primary text-primary-foreground shadow-[var(--shadow-button)]",
          animate ? "opacity-100 scale-100" : "opacity-0 scale-50"
        )}
      >
        <span className="text-xl font-black">{score.toFixed(0)}%</span>
      </div>

      {/* Other Avatar (Slides in from Right) */}
      <div 
        className={cn(
          "absolute transition-all duration-700 ease-out z-20 w-24 h-24 rounded-full border-[4px] border-border bg-card shadow-[4px_4px_0_0_#000] flex items-center justify-center overflow-hidden mix-blend-normal",
          animate ? "translate-x-[30px]" : "translate-x-[150px] opacity-0"
        )}
      >
        {otherProfile?.picture ? (
          <img src={otherProfile.picture} alt={otherName} className="w-full h-full object-cover" />
        ) : (
          <span className="text-3xl font-black">{getInitial(otherName)}</span>
        )}
      </div>
    </div>
  );
};
