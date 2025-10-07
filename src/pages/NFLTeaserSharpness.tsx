import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { supabase } from '@/integrations/supabase/client';
import {
  ResponsiveContainer,
  ScatterChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  Scatter,
} from 'recharts';

interface SharpnessRow {
  team_id: number;
  team_name: string;
  ou_bias_2025: number;
  ou_sharpness_2025: number;
  games_ou_2025: number;
  ou_sharpness_hist_18_24: number | null;
  // spread fields for alternate chart
  spread_bias_2025?: number;
  spread_sharpness_2025?: number;
}

export default function NFLTeaserSharpness() {
  const [rows, setRows] = useState<SharpnessRow[]>([]);
  const [logos, setLogos] = useState<Record<number, string>>({});
  const [showHist, setShowHist] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [mode, setMode] = useState<'ou' | 'spread'>('ou');
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: vErr } = await (supabase as any)
          .from('public.v_nfl_spread_bias_sharpness_2025')
          .select('*');
        if (vErr) {
          console.error('Error loading sharpness view:', vErr);
          setError(vErr.message);
        } else {
          console.log('Sharpness rows loaded:', data?.length);
          setRows((data || []) as SharpnessRow[]);
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

  const histAvg = useMemo(() => {
    const vals = rows.map(r => r.ou_sharpness_hist_18_24).filter((v): v is number => typeof v === 'number');
    if (vals.length === 0) return undefined;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [rows]);

  const targetBand = useMemo(() => {
    if (rows.length === 0) return 5;
    const sorted = [...rows].map(r => r.ou_sharpness_2025).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return Math.min(median, 5);
  }, [rows]);

  const teamsData = rows.map(r => ({
    ...r,
    logo: logos[r.team_id] || getNFLTeamLogo(r.team_name),
    initials: r.team_name?.split(' ').map(p => p[0]).join('').slice(0, 3) || 'TM',
    size: Math.max(28, Math.min(64, 28 + (r.games_ou_2025 || 0) * 1.2)),
  }));

  // Reuse NFL logo mapping from NFL page
  const getNFLTeamLogo = (teamName: string): string => {
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
  };

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
      <Card className="p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">NFL Teaser Sharpness (Weeks 1–5 2025)</h1>
          <div className="space-x-2">
            <div className="inline-flex rounded-full overflow-hidden border">
              <button onClick={() => setMode('ou')} className={`px-3 py-2 text-sm ${mode==='ou'?'bg-blue-600 text-white':'bg-white text-gray-700'}`}>Over/Under</button>
              <button onClick={() => setMode('spread')} className={`px-3 py-2 text-sm ${mode==='spread'?'bg-blue-600 text-white':'bg-white text-gray-700'}`}>Spread</button>
            </div>
            <Button onClick={exportAsPNG}>Export PNG</Button>
            <Toggle pressed={showHist} onPressedChange={setShowHist}>Show Historical Line</Toggle>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-600">{error}</div>
        )}

        <div ref={chartRef}>
          <ResponsiveContainer width="100%" height={600}>
            <ScatterChart margin={{ top: 20, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey={mode==='ou' ? 'ou_bias_2025' : 'spread_bias_2025'}
                label={{ value: mode==='ou' ? 'Average O/U Bias (+ OVER lean | − UNDER lean)' : 'Average Spread Bias (+ Favorites | − Underdogs)', position: 'bottom' }}
              />
              <YAxis
                type="number"
                dataKey={mode==='ou' ? 'ou_sharpness_2025' : 'spread_sharpness_2025'}
                label={{ value: mode==='ou' ? 'Average |O/U Error| (lower = sharper)' : 'Average |Spread Error| (lower = sharper)', angle: -90, position: 'left' }}
              />
              {/* Safe zone band */}
              <ReferenceLine y={targetBand} stroke="#16a34a" strokeOpacity={0.15} strokeWidth={40} />
              {/* Center line */}
              <ReferenceLine x={0} strokeDasharray="4 4" />
              {/* Historical average */}
              {showHist && histAvg !== undefined && (
                <ReferenceLine y={histAvg} strokeDasharray="4 4" strokeOpacity={0.6} />
              )}
              <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: any, n: string) => [v, n]} />
              <Scatter data={teamsData} shape={renderLogoPoint} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        <p className="text-sm text-center mt-4 text-gray-500">
          Green band marks teams closest to zero bias and low error — safest teaser targets. Logo size scales with 2025 sample size (Weeks 1–5).
        </p>
      </Card>
    </div>
  );
}


