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
}

export default function NFLTeaserSharpness() {
  const [rows, setRows] = useState<SharpnessRow[]>([]);
  const [logos, setLogos] = useState<Record<number, string>>({});
  const [showHist, setShowHist] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await (supabase as any)
        .from('v_nfl_spread_bias_sharpness_2025')
        .select('team_id, team_name, ou_bias_2025, ou_sharpness_2025, games_ou_2025, ou_sharpness_hist_18_24');
      if (!error && data) setRows(data as SharpnessRow[]);

      const { data: mapData } = await (supabase as any)
        .from('nfl_team_mapping')
        .select('team_id, logo_url');
      const map: Record<number, string> = {};
      (mapData || []).forEach((r: any) => { map[r.team_id] = r.logo_url; });
      setLogos(map);
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
    logo: logos[r.team_id] || '',
    size: Math.max(28, Math.min(64, 28 + (r.games_ou_2025 || 0) * 1.2)),
  }));

  const renderLogoPoint = (props: any) => {
    const { cx, cy, payload } = props;
    const size = payload.size || 32;
    const half = size / 2;
    return (
      <image x={cx - half} y={cy - half} href={payload.logo} width={size} height={size} />
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
            <Button onClick={exportAsPNG}>Export PNG</Button>
            <Toggle pressed={showHist} onPressedChange={setShowHist}>Show Historical Line</Toggle>
          </div>
        </div>

        <div ref={chartRef}>
          <ResponsiveContainer width="100%" height={600}>
            <ScatterChart margin={{ top: 20, right: 20, left: 10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="ou_bias_2025" name="O/U Bias" label={{ value: 'Average O/U Bias (+ OVER lean | − UNDER lean)', position: 'bottom' }} />
              <YAxis type="number" dataKey="ou_sharpness_2025" name="O/U Sharpness" label={{ value: 'Average |O/U Error| (lower = sharper)', angle: -90, position: 'left' }} />
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


