import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mockAnalyticsSummary, mockAnalyticsTeams } from '@/data/learnMockData';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';

export function AnalyticsFiltersMockup() {
  const homeAwayData = [
    { name: 'Home Win', value: mockAnalyticsSummary.homeWinPercentage, color: '#16a34a' },
    { name: 'Away Win', value: mockAnalyticsSummary.awayWinPercentage, color: '#dc2626' }
  ];

  const coverData = [
    { name: 'Home Cover', value: mockAnalyticsSummary.homeCoverPercentage, color: '#16a34a' },
    { name: 'Away Cover', value: mockAnalyticsSummary.awayCoverPercentage, color: '#dc2626' }
  ];

  return (
    <div className="space-y-6 opacity-95 max-w-6xl mx-auto">
      {/* Summary Donuts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-base font-semibold">Win/Loss</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={homeAwayData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={1}
                  cornerRadius={6}
                  dataKey="value"
                  label={({ value }) => `${value.toFixed(0)}%`}
                >
                  {homeAwayData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-base font-semibold">Home/Away Cover</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={coverData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={1}
                  cornerRadius={6}
                  dataKey="value"
                  label={({ value }) => `${value.toFixed(0)}%`}
                >
                  {coverData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Team Performance Table */}
      <Card className="bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Individual Team Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left text-sm font-semibold p-3">Team</th>
                  <th className="text-left text-sm font-semibold p-3">Games</th>
                  <th className="text-left text-sm font-semibold p-3">Win %</th>
                  <th className="text-left text-sm font-semibold p-3">Cover %</th>
                  <th className="text-left text-sm font-semibold p-3">Over %</th>
                </tr>
              </thead>
              <tbody>
                {mockAnalyticsTeams.map((team, index) => (
                  <tr key={index} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded"></div>
                        <span className="text-sm font-medium">{team.teamName}</span>
                      </div>
                    </td>
                    <td className="p-3 text-sm">{team.games}</td>
                    <td className="p-3 text-sm font-semibold">{team.winPercentage}%</td>
                    <td className="p-3 text-sm font-semibold">{team.coverPercentage}%</td>
                    <td className="p-3 text-sm font-semibold">{team.overPercentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Filters Section (Simplified) */}
      <Card className="bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Season Range: 2018 - 2025</label>
            <div className="h-2 bg-muted rounded-full w-full"></div>
          </div>
          
          <div>
            <label className="text-sm font-medium mb-2 block">Week Range: 1 - 18</label>
            <div className="h-2 bg-muted rounded-full w-full"></div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Day of Week</label>
            <div className="h-10 bg-background border border-border rounded-md flex items-center px-3">
              <span className="text-sm text-muted-foreground">Any day</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Temperature Range: -10°F - 110°F</label>
            <div className="h-2 bg-muted rounded-full w-full"></div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="default" size="sm" className="text-white">
              Clear Filters
            </Button>
            <div className="px-3 py-2 bg-slate-100 dark:bg-muted/40 rounded-md border border-border">
              <div className="text-xs text-muted-foreground">Total Games</div>
              <div className="font-bold text-foreground">{mockAnalyticsSummary.totalGames}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

