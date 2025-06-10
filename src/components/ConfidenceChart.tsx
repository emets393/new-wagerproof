
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface ConfidenceChartProps {
  confidence: number;
  teamColors?: string[];
}

const ConfidenceChart = ({ confidence, teamColors = ['#10b981', '#e5e7eb'] }: ConfidenceChartProps) => {
  const data = [
    { name: 'Confidence', value: confidence },
    { name: 'Remaining', value: 100 - confidence }
  ];

  const COLORS = teamColors;

  return (
    <div className="relative w-24 h-24">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={30}
            outerRadius={48}
            startAngle={90}
            endAngle={450}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-foreground">
          {confidence.toFixed(0)}%
        </span>
      </div>
    </div>
  );
};

export default ConfidenceChart;
