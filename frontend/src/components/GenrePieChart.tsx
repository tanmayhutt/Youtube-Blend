import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

interface GenrePieChartProps {
  genres: string[];
  title: string;
}

export const GenrePieChart = ({ genres, title }: GenrePieChartProps) => {
  const genreData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    genres.forEach((g) => {
      counts[g] = (counts[g] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [genres]);

  const total = genreData.reduce((sum, item) => sum + item.count, 0);

  // Colors for pie chart
  const colors = [
    "#ff4444",
    "#ff6b35",
    "#ff8c42",
    "#ffaa4a",
    "#ff5252",
    "#ff7070",
    "#ff9999",
    "#ffb3b3",
  ];

  let currentAngle = 0;
  const slices = genreData.map((item, index) => {
    const sliceAngle = (item.count / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    const radius = 80;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = 100 + radius * Math.cos(startRad);
    const y1 = 100 + radius * Math.sin(startRad);
    const x2 = 100 + radius * Math.cos(endRad);
    const y2 = 100 + radius * Math.sin(endRad);

    const largeArc = sliceAngle > 180 ? 1 : 0;

    const pathData = [
      `M 100 100`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `Z`,
    ].join(" ");

    return {
      path: pathData,
      color: colors[index % colors.length],
      ...item,
      percentage: ((item.count / total) * 100).toFixed(1),
    };
  });

  if (genreData.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="flex items-center justify-center">
          <svg viewBox="0 0 200 200" className="w-40 h-40">
            {slices.map((slice, index) => (
              <g key={index}>
                <path d={slice.path} fill={slice.color} stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
              </g>
            ))}
            {/* Center circle */}
            <circle cx="100" cy="100" r="40" fill="#0a0a0a" />
          </svg>
        </div>

        {/* Legend */}
        <div className="space-y-3">
          {slices.map((slice, index) => (
            <div key={index} className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <div className="flex-grow min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{slice.name}</p>
                <p className="text-xs text-muted-foreground">{slice.percentage}%</p>
              </div>
              <Badge variant="secondary" className="text-xs">
                {slice.count}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
