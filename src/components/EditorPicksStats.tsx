import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { calculateTotalUnits, calculateUnits } from '@/utils/unitsCalculation';

interface EditorPick {
  id: string;
  game_type: 'nfl' | 'cfb' | 'nba' | 'ncaab';
  result?: 'won' | 'lost' | 'push' | 'pending' | null;
  best_price?: string | number | null;
  units?: number | null;
  created_at: string;
}

interface EditorPicksStatsProps {
  picks: EditorPick[];
  selectedSport?: string | null;
  onSportChange?: (sport: string | null) => void;
}

export function EditorPicksStats({ picks, selectedSport, onSportChange }: EditorPicksStatsProps) {
  // Filter picks by selected sport
  const filteredPicks = useMemo(() => {
    if (!selectedSport || selectedSport === 'all') {
      return picks;
    }
    return picks.filter(pick => pick.game_type === selectedSport);
  }, [picks, selectedSport]);

  // Calculate record
  const record = useMemo(() => {
    const won = filteredPicks.filter(p => p.result === 'won').length;
    const lost = filteredPicks.filter(p => p.result === 'lost').length;
    const push = filteredPicks.filter(p => p.result === 'push').length;
    return { won, lost, push, total: won + lost + push };
  }, [filteredPicks]);

  // Calculate total units
  const totalUnits = useMemo(() => {
    return calculateTotalUnits(filteredPicks);
  }, [filteredPicks]);

  // Prepare chart data - cumulative units over time
  const chartData = useMemo(() => {
    // Sort picks by created_at
    const sortedPicks = [...filteredPicks]
      .filter(p => p.result && p.result !== 'pending')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let cumulativeUnits = 0;
    const data: Array<{ date: string; units: number; pick: string }> = [];

    sortedPicks.forEach(pick => {
      if (pick.result && pick.result !== 'pending') {
        const calc = calculateUnits(pick.result, pick.best_price, pick.units);
        cumulativeUnits += calc.netUnits;

        const date = new Date(pick.created_at);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        
        data.push({
          date: dateStr,
          units: cumulativeUnits,
          pick: pick.id,
        });
      }
    });

    return data;
  }, [filteredPicks]);

  const handleSportChange = (sport: string) => {
    if (onSportChange) {
      onSportChange(sport === 'all' ? null : sport);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Editor Picks Performance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sport Filter Tabs */}
        <Tabs value={selectedSport || 'all'} onValueChange={handleSportChange}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="nfl">NFL</TabsTrigger>
            <TabsTrigger value="cfb">CFB</TabsTrigger>
            <TabsTrigger value="nba">NBA</TabsTrigger>
            <TabsTrigger value="ncaab">NCAAB</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Record and Units Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Record */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Record</div>
            <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
              {record.won}-{record.lost}
              {record.push > 0 && `-${record.push}`}
            </div>
            {record.total > 0 && (
              <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {((record.won / record.total) * 100).toFixed(1)}% Win Rate
              </div>
            )}
          </div>

          {/* Units */}
          <div className={`bg-gradient-to-br p-4 rounded-lg border ${
            totalUnits.netUnits >= 0
              ? 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800'
              : 'from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800'
          }`}>
            <div className={`text-sm font-medium mb-2 ${
              totalUnits.netUnits >= 0
                ? 'text-green-900 dark:text-green-100'
                : 'text-red-900 dark:text-red-100'
            }`}>
              Units
            </div>
            <div className={`text-3xl font-bold ${
              totalUnits.netUnits >= 0
                ? 'text-green-900 dark:text-green-100'
                : 'text-red-900 dark:text-red-100'
            }`}>
              {totalUnits.netUnits >= 0 ? '+' : ''}{totalUnits.netUnits.toFixed(2)}
            </div>
            <div className={`text-sm mt-1 ${
              totalUnits.netUnits >= 0
                ? 'text-green-700 dark:text-green-300'
                : 'text-red-700 dark:text-red-300'
            }`}>
              {totalUnits.unitsWon.toFixed(2)} won / {totalUnits.unitsLost.toFixed(2)} lost
            </div>
          </div>
        </div>

        {/* Line Chart */}
        {chartData.length > 0 && (
          <div className="mt-6">
            <div className="text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
              Units Accumulated Over Time
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-300 dark:stroke-gray-700" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  stroke="currentColor"
                />
                <YAxis 
                  className="text-xs"
                  stroke="currentColor"
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'var(--background)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [
                    `${value >= 0 ? '+' : ''}${value.toFixed(2)} units`,
                    'Cumulative Units'
                  ]}
                />
                <Line 
                  type="monotone" 
                  dataKey="units" 
                  stroke={totalUnits.netUnits >= 0 ? '#10b981' : '#ef4444'}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {chartData.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No completed picks yet. Results will appear here once picks are graded.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

