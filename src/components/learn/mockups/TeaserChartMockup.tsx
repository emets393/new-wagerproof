import { Card } from '@/components/ui/card';
import { mockTeaserData } from '@/data/learnMockData';
import {
  ResponsiveContainer,
  ScatterChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Scatter,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';

export function TeaserChartMockup() {
  const data = mockTeaserData.map(t => ({
    x: t.ou_bias_2025,
    y: t.ou_sharpness_2025,
    name: t.team_name
  }));

  return (
    <Card className="p-6 bg-slate-50 dark:bg-muted/20 border-border shadow-lg opacity-95 max-w-5xl mx-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">NFL Teaser Sharpness</h2>
          <div className="flex gap-2">
            <button className="px-4 py-2 text-sm rounded-full bg-blue-600 hover:bg-blue-700 text-white">
              Over/Under
            </button>
            <button className="px-4 py-2 text-sm rounded-full bg-background border border-border">
              Spread
            </button>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 80%)" />
            
            {/* Safe zone rectangle */}
            <ReferenceArea 
              x1={-6} 
              x2={6} 
              y1={0} 
              y2={6} 
              fill="#16a34a" 
              fillOpacity={0.12} 
              stroke="#16a34a" 
              strokeOpacity={0.25} 
            />
            
            <XAxis
              type="number"
              dataKey="x"
              domain={[-8, 8]}
              ticks={[-8, -6, -4, -2, 0, 2, 4, 6, 8]}
              label={{ value: 'Average O/U Bias', position: 'bottom', style: { fontWeight: 'bold' } }}
            />
            
            <YAxis
              type="number"
              dataKey="y"
              domain={[0, 8]}
              ticks={[0, 2, 4, 6, 8]}
              label={{ value: 'Average O/U Error', angle: -90, position: 'insideLeft', style: { fontWeight: 'bold' } }}
            />
            
            <ReferenceLine x={0} strokeDasharray="4 4" stroke="hsl(0 0% 50%)" />
            
            <Scatter 
              data={data} 
              fill="#3b82f6"
              shape={(props: any) => {
                const { cx, cy, payload } = props;
                return (
                  <g>
                    <circle cx={cx} cy={cy} r={16} fill="#3b82f6" opacity={0.8} />
                    <text 
                      x={cx} 
                      y={cy + 4} 
                      textAnchor="middle" 
                      fontSize={10} 
                      fill="white" 
                      fontWeight="bold"
                    >
                      {payload.name?.substring(0, 3).toUpperCase()}
                    </text>
                  </g>
                );
              }}
            />
          </ScatterChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="border-t pt-4 mt-4">
          <div className="text-sm font-semibold mb-2">Key Zones:</div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded">
              <div className="font-bold text-green-900 dark:text-green-100 mb-1">🟢 Green Zone</div>
              <div className="text-green-800 dark:text-green-200">Best teaser targets</div>
            </div>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded">
              <div className="font-bold text-blue-900 dark:text-blue-100 mb-1">🔵 Low Error</div>
              <div className="text-blue-800 dark:text-blue-200">Predictable outcomes</div>
            </div>
            <div className="p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded">
              <div className="font-bold text-red-900 dark:text-red-100 mb-1">🔴 High Error</div>
              <div className="text-red-800 dark:text-red-200">Avoid for teasers</div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

