import { useState } from 'react';
import { AlertCircle, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WidgetCard } from '@/components/ios';
import debug from '@/utils/debug';
import { getNFLTeamLogo, type NFLPrediction, type NFLTeamMapping } from '../../../api/nflGames';
import type { GameFeedItem } from '../../../types';
import { useNflLineMovement } from './useNflLineMovement';

const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');

    return `${month}/${day} (${displayHours}:${displayMinutes}${ampm})`;
  } catch (error) {
    debug.error('Error formatting timestamp:', error);
    return timestamp;
  }
};

// Team logo from the feed's nfl_team_mapping extras, falling back to the
// adapter's static ESPN logo map (which is what the mapping rows carry anyway).
const logoFor = (teamMappings: NFLTeamMapping[], team: string): string => {
  const mapping = teamMappings.find(
    (m) =>
      m.city_and_name === team ||
      m.team_name === team ||
      (m.city_and_name ? m.city_and_name.startsWith(team) : false)
  );
  return mapping?.logo_url || getNFLTeamLogo(team);
};

interface NflLineMovementSectionProps {
  game: GameFeedItem;
  extras: Record<string, unknown>;
}

/**
 * Line Movement, ported from GameDetailsModal's NFL block: home/away toggle,
 * spread history chart, and O/U history chart from nfl_betting_lines.
 */
export function NflLineMovementSection({ game, extras }: NflLineMovementSectionProps) {
  const raw = game.raw as NFLPrediction;
  const teamMappings = (extras.teamMappings as NFLTeamMapping[] | undefined) ?? [];
  const [selectedTeam, setSelectedTeam] = useState<'home' | 'away'>('away');
  const { lineData, loading, error } = useNflLineMovement(raw.training_key);

  const awayTeamColors = game.awayTeam.colors;
  const homeTeamColors = game.homeTeam.colors;

  const chartData = lineData.map((item) => ({
    timestamp: item.as_of_ts,
    displayTime: formatTimestamp(item.as_of_ts),
    homeSpread: item.home_spread,
    awaySpread: item.away_spread,
    overLine: item.over_line,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
          <p className="font-semibold text-card-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.dataKey === 'homeSpread'
                ? `${raw.home_team} Spread: `
                : entry.dataKey === 'awaySpread'
                  ? `${raw.away_team} Spread: `
                  : entry.dataKey === 'overLine'
                    ? 'Over/Under: '
                    : ''}
              {entry.value !== null ? entry.value.toFixed(1) : 'N/A'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <WidgetCard icon={<TrendingUp />} title="Line Movement" className="@xl:col-span-2" contentClassName="space-y-4 text-center">
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : chartData.length === 0 ? (
        <div className="text-sm text-gray-600 dark:text-white/70">
          No line movement data available for this game
        </div>
      ) : (
        <>
          {/* Team Selection Buttons */}
          <div className="flex justify-center space-x-2 mb-4">
            <Button
              variant={selectedTeam === 'away' ? 'default' : 'outline'}
              onClick={() => setSelectedTeam('away')}
              className={`flex items-center space-x-2 px-4 py-2 transition-all duration-200 text-sm ${
                selectedTeam === 'away'
                  ? 'text-white shadow-lg border-0'
                  : 'bg-card hover:bg-muted text-foreground border-border'
              }`}
              style={
                selectedTeam === 'away'
                  ? {
                      backgroundColor: awayTeamColors.primary,
                      backgroundImage: `linear-gradient(135deg, ${awayTeamColors.primary} 0%, ${awayTeamColors.secondary} 100%)`,
                    }
                  : {}
              }
            >
              <img
                src={logoFor(teamMappings, raw.away_team)}
                alt={`${raw.away_team} logo`}
                className="h-5 w-5"
              />
              <span className="font-semibold">{raw.away_team}</span>
            </Button>

            <Button
              variant={selectedTeam === 'home' ? 'default' : 'outline'}
              onClick={() => setSelectedTeam('home')}
              className={`flex items-center space-x-2 px-4 py-2 transition-all duration-200 text-sm ${
                selectedTeam === 'home'
                  ? 'text-white shadow-lg border-0'
                  : 'bg-card hover:bg-muted text-foreground border-border'
              }`}
              style={
                selectedTeam === 'home'
                  ? {
                      backgroundColor: homeTeamColors.primary,
                      backgroundImage: `linear-gradient(135deg, ${homeTeamColors.primary} 0%, ${homeTeamColors.secondary} 100%)`,
                    }
                  : {}
              }
            >
              <img
                src={logoFor(teamMappings, raw.home_team)}
                alt={`${raw.home_team} logo`}
                className="h-5 w-5"
              />
              <span className="font-semibold">{raw.home_team}</span>
            </Button>
          </div>

          {/* Spread Chart */}
          <div className="relative h-64 w-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10 rounded-xl p-4 border border-gray-200 dark:border-white/20">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 40 }}>
                <CartesianGrid
                  strokeDasharray="2 4"
                  stroke="currentColor"
                  strokeOpacity={0.1}
                  vertical={false}
                  className="text-gray-400 dark:text-white/30"
                />
                <XAxis
                  dataKey="displayTime"
                  tick={{ fontSize: 10, fontWeight: 500, fill: 'currentColor' }}
                  axisLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                  tickLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  className="text-gray-600 dark:text-white/70"
                />
                <YAxis
                  tick={{ fontSize: 10, fontWeight: 600, fill: 'currentColor' }}
                  axisLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                  tickLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                  tickFormatter={(value) => value.toFixed(1)}
                  className="text-gray-600 dark:text-white/70"
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="linear"
                  dataKey={selectedTeam === 'away' ? 'awaySpread' : 'homeSpread'}
                  stroke={selectedTeam === 'away' ? awayTeamColors.primary : homeTeamColors.primary}
                  strokeWidth={3}
                  dot={{
                    fill: selectedTeam === 'away' ? awayTeamColors.primary : homeTeamColors.primary,
                    strokeWidth: 2,
                    r: 5,
                    stroke: '#ffffff',
                  }}
                  activeDot={{
                    r: 8,
                    stroke:
                      selectedTeam === 'away' ? awayTeamColors.primary : homeTeamColors.primary,
                    strokeWidth: 3,
                    fill: '#ffffff',
                  }}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="absolute bottom-1 left-0 right-0 text-center">
              <div className="text-xs font-medium text-gray-600 dark:text-white/70">
                Opening:{' '}
                {selectedTeam === 'away'
                  ? chartData[0]?.awaySpread?.toFixed(1) || 'N/A'
                  : chartData[0]?.homeSpread?.toFixed(1) || 'N/A'}{' '}
                | Current:{' '}
                {selectedTeam === 'away'
                  ? chartData[chartData.length - 1]?.awaySpread?.toFixed(1) || 'N/A'
                  : chartData[chartData.length - 1]?.homeSpread?.toFixed(1) || 'N/A'}
              </div>
            </div>
          </div>

          {/* Over/Under Chart */}
          <div className="mt-4">
            <h5 className="text-sm font-semibold text-center text-gray-800 dark:text-white mb-3">
              Over/Under Line Movement
            </h5>
            <div className="relative h-64 w-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10 rounded-xl p-4 border border-gray-200 dark:border-white/20">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 40 }}>
                  <CartesianGrid
                    strokeDasharray="2 4"
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    vertical={false}
                    className="text-gray-400 dark:text-white/30"
                  />
                  <XAxis
                    dataKey="displayTime"
                    tick={{ fontSize: 10, fontWeight: 500, fill: 'currentColor' }}
                    axisLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                    tickLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    className="text-gray-600 dark:text-white/70"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fontWeight: 600, fill: 'currentColor' }}
                    axisLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                    tickLine={{ stroke: 'currentColor', strokeWidth: 1 }}
                    tickFormatter={(value) => value.toFixed(1)}
                    className="text-gray-600 dark:text-white/70"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="linear"
                    dataKey="overLine"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{
                      fill: '#10b981',
                      strokeWidth: 2,
                      r: 5,
                      stroke: '#ffffff',
                    }}
                    activeDot={{
                      r: 8,
                      stroke: '#10b981',
                      strokeWidth: 3,
                      fill: '#ffffff',
                    }}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
              <div className="absolute bottom-1 left-0 right-0 text-center">
                <div className="text-xs font-medium text-gray-600 dark:text-white/70">
                  Opening O/U: {chartData[0]?.overLine?.toFixed(1) || 'N/A'} | Current O/U:{' '}
                  {chartData[chartData.length - 1]?.overLine?.toFixed(1) || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </WidgetCard>
  );
}
