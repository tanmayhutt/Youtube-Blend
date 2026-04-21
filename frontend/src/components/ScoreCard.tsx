import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

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
    <Card className="p-6 bg-card border-border hover:border-primary transition-all duration-300 animate-fade-in">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-muted-foreground capitalize">
            {label.replace(/_/g, " ")}
          </span>
          <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
            {score.toFixed(1)}%
          </span>
        </div>
        <Progress value={score} className="h-2" />
      </div>
    </Card>
  );
};
