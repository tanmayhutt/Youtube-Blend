import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";

interface ScoreCardProps {
  label: string;
  score: number;
}

export const ScoreCard = ({ label, score }: ScoreCardProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <Card className="p-6 bg-card border-[3px] border-border hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all duration-200">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-black text-muted-foreground capitalize flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            {label.replace(/_/g, " ")}
          </span>
          <span className={`text-2xl font-black ${getScoreColor(score)}`}>
            {score.toFixed(1)}%
          </span>
        </div>
        <Progress value={score} className="h-3 border-[2px] border-border" />
      </div>
    </Card>
  );
};
