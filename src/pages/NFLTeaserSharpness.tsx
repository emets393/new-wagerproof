import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { collegeFootballSupabase } from '@/integrations/supabase/college-football-client';
import { useTheme } from '@/contexts/ThemeContext';
import {
  ResponsiveContainer,
  ScatterChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ReferenceArea,
  Scatter,
} from 'recharts';

interface SharpnessRow {
  team_id: number;
  team_name: string;
  ou_bias_2025: number;
  ou_sharpness_2025: number;
  games_ou_2025: number;
  // spread fields for alternate chart
  spread_bias_2025?: number;
  spread_sharpness_2025?: number;
}

export default function NFLTeaserSharpness() {
  const { theme } = useTheme();
  const [rows, setRows] = useState<SharpnessRow[]>([]);
  const [logos, setLogos] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mode, setMode] = useState<'ou' | 'spread'>('ou');
  const chartRef = useRef<HTMLDivElement>(null);
  const [matchups, setMatchups] = useState<Array<{ label: string; teams: [string, string] }>>([]);
  const [selectedMatchup, setSelectedMatchup] = useState<string>('');
  const [maxWeek, setMaxWeek] = useState<number>(5);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        // Prefer RPC (works regardless of underlying schema exposure)
        const { data, error: rpcErr } = await (collegeFootballSupabase as any)
          .rpc('get_nfl_teaser_sharpness');
        if (rpcErr) {
          console.warn('RPC get_nfl_teaser_sharpness failed, falling back to direct view select:', rpcErr.message);
          const { data: vdata, error: vErr } = await (collegeFootballSupabase as any)
            .from('v_nfl_spread_bias_sharpness_2025')
            .select('team_id,team_name,ou_bias_2025,ou_sharpness_2025,spread_bias_2025,spread_sharpness_2025,games_ou_2025');
          if (vErr) {
            console.error('Error loading sharpness view:', vErr);
            setError(vErr.message);
          } else {
            console.log('Sharpness rows loaded (view):', vdata?.length);
            const loadedRows = (vdata || []) as SharpnessRow[];
            setRows(loadedRows);
            // Calculate max week from games_ou_2025 column
            if (loadedRows.length > 0) {
              const maxGames = Math.max(...loadedRows.map(r => r.games_ou_2025 || 0));
              setMaxWeek(maxGames);
            }
          }
        } else {
          console.log('Sharpness rows loaded (rpc):', data?.length);
          const loadedRows = (data || []) as SharpnessRow[];
          setRows(loadedRows);
          // Calculate max week from games_ou_2025 column
          if (loadedRows.length > 0) {
            const maxGames = Math.max(...loadedRows.map(r => r.games_ou_2025 || 0));
            setMaxWeek(maxGames);
          }
        }
        // Load upcoming matchups for filter
        const { data: games, error: gamesErr } = await (collegeFootballSupabase as any)
          .from('nfl_input_values_view')
          .select('away_team,home_team')
          .limit(200);
        if (!gamesErr && games) {
          const seen = new Set<string>();
          const list: Array<{ label: string; teams: [string, string] }> = [];
          (games as any[]).forEach(g => {
            const away: string = g.away_team;
            const home: string = g.home_team;
            const label = `${away} @ ${home}`;
            if (seen.has(label)) return;
            seen.add(label);
            list.push({ label, teams: [away, home] });
          });
          setMatchups(list);
        }
        // Temporarily skip team mapping fetch (404 in this environment).
        // We'll render initials when a logo is missing.
      } catch (e: any) {
        console.error('Unexpected error loading data', e);
        setError(e?.message || 'Unexpected error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const targetBand = useMemo(() => {
    if (rows.length === 0) return 5;
    const sorted = [...rows].map(r => r.ou_sharpness_2025).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return Math.min(median, 5);
  }, [rows]);

  // X-axis ticks every 2 units, symmetric around 0 based on current mode and data extent
  const xScale = useMemo(() => {
    const xs = rows
      .map(r => (mode === 'ou' ? r.ou_bias_2025 : (r.spread_bias_2025 as number | undefined)))
      .filter((n): n is number => typeof n === 'number' && isFinite(n));
    if (xs.length === 0) {
      return { min: -8, max: 8, ticks: [-8, -6, -4, -2, 0, 2, 4, 6, 8] };
    }
    const minVal = Math.min(...xs);
    const maxVal = Math.max(...xs);
    const maxAbs = Math.max(Math.abs(minVal), Math.abs(maxVal));
    const roundDown2 = (v: number) => Math.floor(v / 2) * 2;
    const roundUp2 = (v: number) => Math.ceil(v / 2) * 2;
    const min = roundDown2(-maxAbs);
    const max = roundUp2(maxAbs);
    const ticks: number[] = [];
    for (let t = min; t <= max; t += 2) ticks.push(t);
    return { min, max, ticks };
  }, [rows, mode]);

  // Y-axis dynamic domain with ticks every 2, starting at 0
  const yScale = useMemo(() => {
    const ys = rows
      .map(r => (mode === 'ou' ? r.ou_sharpness_2025 : (r.spread_sharpness_2025 as number | undefined)))
      .filter((n): n is number => typeof n === 'number' && isFinite(n));
    if (ys.length === 0) {
      return { min: 0, max: 12, ticks: [0, 2, 4, 6, 8, 10, 12] };
    }
    const maxVal = Math.max(...ys);
    const roundUp2 = (v: number) => Math.ceil(v / 2) * 2;
    // Ensure at least 6 so the safe zone [0,6] is visible, but keep tight to data
    const max = Math.max(6, roundUp2(maxVal + 0.5));
    const ticks: number[] = [];
    for (let t = 0; t <= max; t += 2) ticks.push(t);
    return { min: 0, max, ticks };
  }, [rows, mode]);

  // Hoisted function (declaration) so it is available before use in teamsData
  function getNFLTeamLogo(teamName: string): string {
    // Handle known full-name alias used in the view
    if (teamName === 'Las Vegas Raiders') {
      return 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png';
    }
    const logoMap: { [key: string]: string } = {
      'Arizona': 'https://a.espncdn.com/i/teamlogos/nfl/500/ari.png',
      'Atlanta': 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png',
      'Baltimore': 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png',
      'Buffalo': 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
      'Carolina': 'https://a.espncdn.com/i/teamlogos/nfl/500/car.png',
      'Chicago': 'https://a.espncdn.com/i/teamlogos/nfl/500/chi.png',
      'Cincinnati': 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png',
      'Cleveland': 'https://a.espncdn.com/i/teamlogos/nfl/500/cle.png',
      'Dallas': 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png',
      'Denver': 'https://a.espncdn.com/i/teamlogos/nfl/500/den.png',
      'Detroit': 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png',
      'Green Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png',
      'Houston': 'https://a.espncdn.com/i/teamlogos/nfl/500/hou.png',
      'Indianapolis': 'https://a.espncdn.com/i/teamlogos/nfl/500/ind.png',
      'Jacksonville': 'https://a.espncdn.com/i/teamlogos/nfl/500/jax.png',
      'Kansas City': 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
      'Las Vegas Raiders': 'https://a.espncdn.com/i/teamlogos/nfl/500/lv.png',
      'LA Chargers': 'https://a.espncdn.com/i/teamlogos/nfl/500/lac.png',
      'LA Rams': 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png',
      'Miami': 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png',
      'Minnesota': 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png',
      'New England': 'https://a.espncdn.com/i/teamlogos/nfl/500/ne.png',
      'New Orleans': 'https://a.espncdn.com/i/teamlogos/nfl/500/no.png',
      'NY Giants': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyg.png',
      'NY Jets': 'https://a.espncdn.com/i/teamlogos/nfl/500/nyj.png',
      'Philadelphia': 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png',
      'Pittsburgh': 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png',
      'San Francisco': 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png',
      'Seattle': 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png',
      'Tampa Bay': 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png',
      'Tennessee': 'https://a.espncdn.com/i/teamlogos/nfl/500/ten.png',
      'Washington': 'https://a.espncdn.com/i/teamlogos/nfl/500/wsh.png',
    };
    return logoMap[teamName] || '/placeholder.svg';
  }

  const teamsData = rows.map(r => ({
    ...r,
    logo: logos[r.team_id] || getNFLTeamLogo(r.team_name),
    initials: r.team_name?.split(' ').map(p => p[0]).join('').slice(0, 3) || 'TM',
    size: Math.max(28, Math.min(64, 28 + (r.games_ou_2025 || 0) * 1.2)),
  }));

  // Normalize team names from matchup list to view team_name
  function normalizeMatchTeam(name: string): string {
    if (name === 'Las Vegas') return 'Las Vegas Raiders';
    return name;
  }

  const filteredData = useMemo(() => {
    if (!selectedMatchup) return teamsData;
    const m = matchups.find(m => m.label === selectedMatchup);
    if (!m) return teamsData;
    const a = normalizeMatchTeam(m.teams[0]);
    const h = normalizeMatchTeam(m.teams[1]);
    return teamsData.filter(d => d.team_name === a || d.team_name === h);
  }, [teamsData, selectedMatchup, matchups]);


  const renderLogoPoint = (props: any) => {
    const { cx, cy, payload } = props;
    const size = payload.size || 32;
    const half = size / 2;
    if (payload.logo) {
      return <image x={cx - half} y={cy - half} href={payload.logo} width={size} height={size} />;
    }
    // Fallback circle with initials
    return (
      <g>
        <circle cx={cx} cy={cy} r={half} fill="#0ea5e9" stroke="white" strokeWidth={2} />
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={Math.max(10, size / 3)} fill="white" fontWeight="bold">
          {payload.initials}
        </text>
      </g>
    );
  };

  const exportAsPNG = () => {
    // Simple approach: rely on browser screenshot or future enhancement with html2canvas
    window.print();
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Card className="p-6 max-w-7xl mx-auto bg-slate-50 dark:bg-muted/20 border-border shadow-sm">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => window.history.back()} className="text-sm px-3 py-2 rounded border bg-background hover:bg-muted text-foreground border-border">← Back</button>
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">NFL Teaser Sharpness (Weeks 1–{maxWeek} 2025)</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2">
            <div className="inline-flex rounded-full overflow-hidden border border-border">
              <button onClick={() => setMode('ou')} className={`px-3 py-2 text-sm transition-colors ${mode==='ou'?'bg-primary text-primary-foreground':'bg-background text-foreground hover:bg-muted'}`}>Over/Under</button>
              <button onClick={() => setMode('spread')} className={`px-3 py-2 text-sm transition-colors ${mode==='spread'?'bg-primary text-primary-foreground':'bg-background text-foreground hover:bg-muted'}`}>Spread</button>
            </div>
            <div className="inline-flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter by Matchups</span>
              <select
                className="text-sm border border-border rounded px-2 py-1 bg-background text-foreground"
                value={selectedMatchup}
                onChange={e => setSelectedMatchup(e.target.value)}
              >
                <option value="">All</option>
                {matchups.map(m => (
                  <option key={m.label} value={m.label}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600">{error}</div>
        )}

        <div ref={chartRef} className="overflow-x-auto">
          <ResponsiveContainer width="100%" height={600} minWidth={800}>
            <ScatterChart margin={{ top: 20, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'hsl(0 0% 20%)' : 'hsl(0 0% 91%)'} />
              {/* Safe zone rectangle: x in [-6, 6], y in [0, 6] */}
              <ReferenceArea x1={-6} x2={6} y1={0} y2={6} fill="#16a34a" fillOpacity={0.12} stroke="#16a34a" strokeOpacity={0.25} />
              <XAxis
                type="number"
                dataKey={mode==='ou' ? 'ou_bias_2025' : 'spread_bias_2025'}
                label={{ value: mode==='ou' ? 'Average O/U Bias' : 'Average Spread Bias', position: 'bottom', style: { fontWeight: 'bold', fill: theme === 'dark' ? 'hsl(0 0% 96%)' : 'hsl(0 0% 10%)' } }}
                domain={[xScale.min, xScale.max]}
                ticks={xScale.ticks}
                tick={{ fill: theme === 'dark' ? 'hsl(0 0% 96%)' : 'hsl(0 0% 10%)' }}
                axisLine={{ stroke: theme === 'dark' ? 'hsl(0 0% 20%)' : 'hsl(0 0% 91%)' }}
                tickLine={{ stroke: theme === 'dark' ? 'hsl(0 0% 20%)' : 'hsl(0 0% 91%)' }}
              />
              <YAxis
                type="number"
                dataKey={mode==='ou' ? 'ou_sharpness_2025' : 'spread_sharpness_2025'}
                label={{ value: mode==='ou' ? 'Average O/U Error' : 'Average Absolute Spread Error', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontWeight: 'bold', fill: theme === 'dark' ? 'hsl(0 0% 96%)' : 'hsl(0 0% 10%)' } }}
                domain={[yScale.min, yScale.max]}
                ticks={yScale.ticks}
                tick={{ fill: theme === 'dark' ? 'hsl(0 0% 96%)' : 'hsl(0 0% 10%)' }}
                axisLine={{ stroke: theme === 'dark' ? 'hsl(0 0% 20%)' : 'hsl(0 0% 91%)' }}
                tickLine={{ stroke: theme === 'dark' ? 'hsl(0 0% 20%)' : 'hsl(0 0% 91%)' }}
              />
              {/* Center line */}
              <ReferenceLine x={0} strokeDasharray="4 4" stroke={theme === 'dark' ? 'hsl(0 0% 45%)' : 'hsl(0 0% 65%)'} />
              <RechartsTooltip 
                cursor={{ strokeDasharray: '3 3' }} 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover p-3 border border-border rounded shadow-lg">
                        <p className="font-semibold text-popover-foreground">{data.team_name}</p>
                        <p className="text-sm text-popover-foreground">
                          Bias: {data[mode === 'ou' ? 'ou_bias_2025' : 'spread_bias_2025']?.toFixed(2)}
                        </p>
                        <p className="text-sm text-popover-foreground">
                          Sharpness: {data[mode === 'ou' ? 'ou_sharpness_2025' : 'spread_sharpness_2025']?.toFixed(2)}
                        </p>
                        <p className="text-sm text-popover-foreground">Games: {data.games_ou_2025}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Scatter data={filteredData} shape={renderLogoPoint} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <p className="text-sm text-center mt-4 text-muted-foreground">
          Green band marks teams closest to zero bias and low error — safest teaser targets.
        </p>

        {/* Reading guide */}
        {mode === 'spread' ? (
          <div className="mt-6 text-sm text-foreground space-y-2">
            <div className="font-semibold">🏈 Spread Sharpness — How to Read</div>
            <div>
              <span className="font-medium">X-Axis (Average Spread Bias):</span>
              <div className="ml-4 text-muted-foreground">→ Right = Underrated — teams covering more often than expected.</div>
              <div className="ml-4 text-muted-foreground">→ Left = Overvalued — teams failing to cover consistently.</div>
              <div className="ml-4 text-muted-foreground">(Closer to the center means lines are more accurate.)</div>
            </div>
            <div>
              <span className="font-medium">Y-Axis (Average Spread Error):</span>
              <div className="ml-4 text-muted-foreground">↓ Lower = Sharper — Vegas is tight on this team.</div>
              <div className="ml-4 text-muted-foreground">↑ Higher = Looser — spreads miss by more on average.</div>
            </div>
            <div className="italic text-muted-foreground">Bottom-right = ideal zone → underrated teams with sharp, consistent lines.</div>
          </div>
        ) : (
          <div className="mt-6 text-sm text-foreground space-y-2">
            <div className="font-semibold">📊 Over/Under Sharpness — How to Read</div>
            <div>
              <span className="font-medium">X-Axis (Average O/U Bias):</span>
              <div className="ml-4 text-muted-foreground">→ Right = Overs hit more often — totals set too low.</div>
              <div className="ml-4 text-muted-foreground">→ Left = Unders hit more often — totals set too high.</div>
              <div className="ml-4 text-muted-foreground">(Center = balanced totals market.)</div>
            </div>
            <div>
              <span className="font-medium">Y-Axis (Average O/U Error):</span>
              <div className="ml-4 text-muted-foreground">↓ Lower = Sharper totals — Vegas is close on the number.</div>
              <div className="ml-4 text-muted-foreground">↑ Higher = Less predictable totals — larger misses on average.</div>
            </div>
            <div className="italic text-muted-foreground">Bottom-center = most efficient zone → totals market is sharp and unbiased.</div>
          </div>
        )}
      </Card>
    </div>
  );
}


