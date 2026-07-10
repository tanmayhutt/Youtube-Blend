import { cn } from "@/lib/utils";

export const Circle = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={cn("absolute w-24 h-24 drop-shadow-[4px_4px_0_rgba(0,0,0,1)] animate-float", className)}>
    <circle cx="50" cy="50" r="46" fill="hsl(var(--primary))" stroke="hsl(var(--border))" strokeWidth="6" />
  </svg>
);

export const Squiggle = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 50" className={cn("absolute w-32 h-12 drop-shadow-[4px_4px_0_rgba(0,0,0,1)] animate-float-delayed", className)}>
    <path d="M10,25 Q30,5 50,25 T90,25 T130,25 T170,25" fill="none" stroke="hsl(var(--border))" strokeWidth="8" strokeLinecap="round" />
  </svg>
);

export const Star = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={cn("absolute w-16 h-16 drop-shadow-[4px_4px_0_rgba(0,0,0,1)] animate-float", className)}>
    <polygon points="50,5 61,38 95,38 67,59 78,92 50,71 22,92 33,59 5,38 39,38" fill="#FFF" stroke="hsl(var(--border))" strokeWidth="6" strokeLinejoin="round" />
  </svg>
);

export const Pill = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 40" className={cn("absolute w-28 h-12 drop-shadow-[4px_4px_0_rgba(0,0,0,1)] animate-float-delayed", className)}>
    <rect x="5" y="5" width="90" height="30" rx="15" fill="hsl(var(--background))" stroke="hsl(var(--border))" strokeWidth="6" />
  </svg>
);
