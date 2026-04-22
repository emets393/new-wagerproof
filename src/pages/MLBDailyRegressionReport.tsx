import React, { useState } from 'react';
import { useMLBRegressionReport } from '@/hooks/useMLBRegressionReport';
import { useMLBBucketAccuracy } from '@/hooks/useMLBBucketAccuracy';
import { MLB_FALLBACK_BY_NAME } from '@/utils/mlbTeamLogos';
import type {
  PitcherRegression, BattingRegression, BullpenFatigue,
  SuggestedPick, YesterdayRecap, AccuracyBucket,
  BetTypeAccuracy, PerfectStorm, WeatherParkFlag, ModelAccuracy,
  CumulativeRecord, CumulativeBucket,
} from '@/hooks/useMLBRegressionReport';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertCircle, Clock, TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  Target, Flame, Thermometer, Wind, BarChart3, Trophy, Zap, Shield,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, Legend,
} from 'recharts';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

function severityColor(severity: string) {
  if (severity === 'severe') return 'text-red-400';
  if (severity === 'moderate') return 'text-amber-400';
  return 'text-green-400';
}

function severityBg(severity: string) {
  if (severity === 'severe') return 'bg-red-500/10 border-red-500/30';
  if (severity === 'moderate') return 'bg-amber-500/10 border-amber-500/30';
  return 'bg-green-500/10 border-green-500/30';
}

function confidenceBadge(conf: string) {
  if (conf === 'high') return <Badge className="bg-green-600 text-white">HIGH</Badge>;
  return <Badge className="bg-amber-600 text-white">MODERATE</Badge>;
}

function winPctColor(pct: number) {
  if (pct >= 65) return '#22c55e';
  if (pct >= 55) return '#eab308';
  if (pct >= 50) return '#f97316';
  return '#ef4444';
}

function betTypeLabel(bt: string) {
  const labels: Record<string, string> = {
    full_ml: 'Full Game ML', full_ou: 'Full Game O/U',
    f5_ml: 'F5 ML', f5_ou: 'F5 O/U',
  };
  return labels[bt] || bt;
}

// ── Section Components ──────────────────────────────────────────

function simpleMarkdownToHtml(md: string): string {
  return md
    // Headers
    .replace(/^### (.+)$/gm, '<h4 class="text-base font-semibold mt-4 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-lg font-bold mt-5 mb-2">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-xl font-bold mt-6 mb-2">$1</h2>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-primary/50 pl-4 py-1 my-3 bg-primary/5 rounded-r italic">$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="my-4 border-muted-foreground/20"/>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-foreground">$1</strong>')
    // Bullet points
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="my-2">')
    // Single newlines within paragraphs
    .replace(/\n/g, '<br/>');
}

function NarrativeSection({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  const html = simpleMarkdownToHtml(text);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-primary/20 bg-primary/5">
        <CollapsibleTrigger className="w-full">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" /> AI Analysis Summary
            </CardTitle>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="max-w-none text-sm leading-relaxed">
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function RecapSection({
  recap,
  cumulative,
}: {
  recap: YesterdayRecap[];
  cumulative?: CumulativeRecord | null;
}) {
  if (!recap.length) return null;
  const wins = recap.filter(r => r.result === 'won').length;
  const losses = recap.filter(r => r.result === 'lost').length;
  const pushes = recap.filter(r => r.result === 'push').length;
  const total = wins + losses;
  const pct = total > 0 ? (wins / total * 100).toFixed(1) : '0.0';

  const cum = cumulative?.total;
  const cumUnits = cum?.units_won ?? 0;
  const cumRoi = cum?.roi_pct ?? 0;
  const cumRecord = cum
    ? (cum.pushes > 0
        ? `${cum.wins}-${cum.losses}-${cum.pushes}`
        : `${cum.wins}-${cum.losses}`)
    : null;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
          <Trophy className="h-5 w-5 text-yellow-500" /> Yesterday's Results
          <Badge variant="outline" className="ml-2">
            {wins}-{losses}{pushes ? `-${pushes}P` : ''} ({pct}%)
          </Badge>
        </CardTitle>
        {cumRecord && (
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mt-1">
            <span className="font-medium uppercase tracking-wide">All-time:</span>
            <span className="font-mono text-foreground">{cumRecord}</span>
            <span className={`font-mono font-medium ${cumUnits >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {cumUnits >= 0 ? '+' : ''}{cumUnits.toFixed(2)}u
            </span>
            <span className={`font-mono font-medium ${cumRoi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {cumRoi >= 0 ? '+' : ''}{cumRoi.toFixed(1)}% ROI
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-2 sm:p-6">
        <div className="space-y-2">
          {recap.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/20">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{r.pick}</div>
                <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{r.matchup}</div>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">{r.actual_score}</div>
              <Badge className={`text-[10px] flex-shrink-0 ${r.result === 'won' ? 'bg-green-600' : r.result === 'lost' ? 'bg-red-600' : 'bg-gray-600'}`}>
                {r.result.toUpperCase()}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AccuracyDashboardLive() {
  const { data: accuracy, isLoading } = useMLBBucketAccuracy();
  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }
  if (!accuracy) return null;
  return <AccuracyDashboard accuracy={accuracy as unknown as ModelAccuracy} />;
}

function AccuracyDashboard({ accuracy }: { accuracy: ModelAccuracy }) {
  const betTypes = ['full_ml', 'full_ou', 'f5_ml', 'f5_ou'] as const;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-500" /> Model Accuracy Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {betTypes.map(bt => {
            const data = accuracy[bt];
            if (!data) return null;
            const ov = data.overall as any;
            const { games, wins, win_pct } = ov;
            const roi = ov.roi_pct ?? 0;
            const units = ov.units_won ?? 0;
            return (
              <Card key={bt} className="bg-muted/30">
                <CardContent className="p-3 text-center">
                  <div className="text-xs text-muted-foreground">{betTypeLabel(bt)}</div>
                  <div className="text-2xl font-bold" style={{ color: winPctColor(win_pct) }}>
                    {win_pct}%
                  </div>
                  <div className="text-xs text-muted-foreground">{wins}-{games - wins}</div>
                  <div className={`text-xs font-medium mt-1 ${roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ROI: {roi > 0 ? '+' : ''}{roi}% ({units > 0 ? '+' : ''}{units}u)
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Tabs defaultValue="full_ml">
          <TabsList className="w-full flex gap-1 sm:gap-2 p-1">
            {betTypes.map(bt => (
              <TabsTrigger key={bt} value={bt} className="flex-1 text-[11px] sm:text-xs py-1.5 px-2">
                {bt === 'full_ml' ? 'Full ML' : bt === 'full_ou' ? 'Full O/U' : bt === 'f5_ml' ? 'F5 ML' : 'F5 O/U'}
              </TabsTrigger>
            ))}
          </TabsList>
          {betTypes.map(bt => {
            const data = accuracy[bt];
            if (!data) return null;
            const buckets = data.by_bucket
              .filter(b => b.games >= 3)
              .sort((a, b) => b.win_pct - a.win_pct);

            return (
              <TabsContent key={bt} value={bt}>
                {buckets.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b border-muted/30">
                          <th className="text-left py-2 pr-2 font-medium text-muted-foreground">Bucket</th>
                          <th className="text-center py-2 px-2 font-medium text-muted-foreground">Record</th>
                          <th className="text-center py-2 px-2 font-medium text-muted-foreground">Win%</th>
                          <th className="text-right py-2 pl-2 font-medium text-muted-foreground">ROI%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buckets.map((b, i) => {
                          const label = [b.bucket, b.side, b.fav_dog, b.direction]
                            .filter(Boolean).join(' / ');
                          const bAny = b as any;
                          const roi = bAny.roi_pct ?? 0;
                          return (
                            <tr key={i} className="border-b border-muted/10">
                              <td className="py-2 pr-2 text-left">{label}</td>
                              <td className="py-2 px-2 text-center text-muted-foreground">{b.wins}-{b.games - b.wins}</td>
                              <td className="py-2 px-2 text-center font-medium" style={{ color: winPctColor(b.win_pct) }}>
                                {b.win_pct}%
                              </td>
                              <td className={`py-2 pl-2 text-right font-medium ${roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {roi > 0 ? '+' : ''}{roi}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">No buckets with 3+ games yet</p>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function PicksSection({ picks }: { picks: SuggestedPick[] }) {
  const { data: bucketAccuracy } = useMLBBucketAccuracy();
  const perfectStormOverall = bucketAccuracy?.perfect_storm?.overall;
  if (!picks.length) {
    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5 text-green-500" /> Today's Suggested Picks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No picks meet the confidence threshold for today's slate.</p>
        </CardContent>
      </Card>
    );
  }

  const teamBadge = (name: string | null) => {
    if (!name) return null;
    const key = name.toLowerCase().replace(/\./g, '');
    const fb = MLB_FALLBACK_BY_NAME[key];
    if (!fb) return <span className="text-sm">{name}</span>;
    return (
      <span className="inline-flex items-center gap-1.5">
        <img src={fb.logo_url} alt={fb.team} className="h-5 w-5 object-contain" />
        <span className="text-sm font-medium">{fb.team}</span>
      </span>
    );
  };

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-green-500" /> Today's Suggested Picks
          <Badge variant="outline">{picks.length} plays</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          {picks.map((p, i) => (
            <Card key={i} className={`border ${p.locked ? 'opacity-70 border-muted' : 'border-primary/30'}`}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-bold text-sm sm:text-lg leading-tight">{p.pick}</div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {confidenceBadge(p.confidence_at_suggestion)}
                    <Badge variant="outline" className="text-[10px] sm:text-xs">{p.bet_type === 'full_ml' ? 'FG ML' : p.bet_type === 'full_ou' ? 'FG O/U' : p.bet_type === 'f5_ml' ? 'F5 ML' : 'F5 O/U'}</Badge>
                    {p.locked && <Badge variant="secondary" className="text-[10px]">LOCKED</Badge>}
                  </div>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    {teamBadge(p.away_team)}
                    <span className="text-muted-foreground text-[10px]">@</span>
                    {teamBadge(p.home_team)}
                    {(p as any).game_number >= 2 && <Badge variant="secondary" className="text-[10px]">G2</Badge>}
                  </div>
                  {p.game_time_et && (
                    <span className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(p.game_time_et).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <div className="text-muted-foreground">Edge</div>
                    <div className="font-medium">{p.edge_at_suggestion > 0 ? '+' : ''}{p.edge_at_suggestion}{p.bet_type.includes('ml') ? '%' : ''}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Bucket</div>
                    <div className="font-medium whitespace-pre-line text-center leading-tight">
                      {p.edge_bucket === 'perfect_storm' ? 'Perfect\nStorm' : p.edge_bucket}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Bucket W%</div>
                    {(p.edge_bucket || '').toLowerCase() === 'perfect_storm' ? (
                      perfectStormOverall && perfectStormOverall.games > 0 ? (
                        <div className="font-medium" style={{ color: winPctColor(perfectStormOverall.win_pct) }}>
                          {perfectStormOverall.win_pct}%
                        </div>
                      ) : (
                        <div className="font-medium text-muted-foreground">N/A</div>
                      )
                    ) : (
                      <div className="font-medium" style={{ color: winPctColor(p.bucket_win_pct) }}>
                        {p.bucket_win_pct}%
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-2">{p.reasoning}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Suggested {new Date(p.first_suggested_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PitcherRegressionSection({
  negative, positive
}: { negative: PitcherRegression[]; positive: PitcherRegression[] }) {
  const [showNeg, setShowNeg] = useState(true);
  const [showPos, setShowPos] = useState(true);

  const renderTable = (pitchers: PitcherRegression[], type: 'negative' | 'positive') => (
    <div className="space-y-2">
      {pitchers.map((p: any, i: number) => (
        <div key={i} className={`p-3 rounded-lg border ${severityBg(p.severity)}`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="font-medium text-sm">{p.pitcher_name}</span>
              <span className="text-xs text-muted-foreground ml-1">({p.team_name})</span>
            </div>
            <Badge className={`text-[10px] ${p.severity === 'severe' ? 'bg-red-600' : p.severity === 'moderate' ? 'bg-amber-600' : 'bg-green-600'}`}>
              {p.severity}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mb-2">vs {p.opponent || '-'}</div>
          <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-10 gap-2 text-center text-xs">
            <div>
              <div className="text-muted-foreground cursor-help" title="Earned Run Average — runs allowed per 9 innings">ERA</div>
              <div className="font-mono font-medium">{p.era?.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground cursor-help" title="Expected FIP based on strikeouts, walks, and home runs (removes luck/defense)">xFIP</div>
              <div className="font-mono font-medium">{p.xfip?.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-muted-foreground cursor-help" title="ERA minus xFIP. Positive = overperforming, negative = underperforming">Gap</div>
              <div className={`font-mono font-bold ${severityColor(p.severity)}`}>
                {p.era_minus_xfip > 0 ? '+' : ''}{p.era_minus_xfip?.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground cursor-help" title="Expected weighted On-Base Average allowed — quality of contact allowed">xwOBA</div>
              <div className={`font-mono ${(p.xwoba ?? 0) >= 0.340 ? 'text-red-400' : (p.xwoba ?? 0) <= 0.260 ? 'text-green-400' : ''}`}>
                {p.xwoba?.toFixed(3) || '-'}
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="text-muted-foreground cursor-help" title="Expected ERA based on batted ball quality (more stable than actual ERA)">xERA</div>
              <div className="font-mono">{p.xera?.toFixed(2) || '-'}</div>
            </div>
            <div className="hidden lg:block">
              <div className="text-muted-foreground cursor-help" title="Fielding Independent Pitching — ERA estimate using K, BB, HR only">FIP</div>
              <div className="font-mono">{p.fip?.toFixed(2) || '-'}</div>
            </div>
            <div className="hidden lg:block">
              <div className="text-muted-foreground cursor-help" title="Walks + Hits per IP. Elite: <1.10, Concerning: >1.35">WHIP</div>
              <div className={`font-mono ${(p.whip ?? 0) >= 1.35 ? 'text-red-400' : (p.whip ?? 2) <= 1.10 ? 'text-green-400' : ''}`}>
                {p.whip?.toFixed(2) || '-'}
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="text-muted-foreground cursor-help" title="Strikeout rate — how often pitcher strikes out batter">K%</div>
              <div className="font-mono">{p.k_pct?.toFixed(1) || '-'}%</div>
            </div>
            <div className="hidden lg:block">
              <div className="text-muted-foreground cursor-help" title="Walk rate — control indicator. Higher = worse control">BB%</div>
              <div className={`font-mono ${(p.bb_pct ?? 0) >= 12 ? 'text-red-400' : ''}`}>{p.bb_pct?.toFixed(1) || '-'}%</div>
            </div>
            <div className="hidden lg:block">
              <div className="text-muted-foreground cursor-help" title="xFIP trend over last 3 starts. Positive = worsening, negative = improving">xFIP L3</div>
              <div className={`font-mono ${(p.trend_xfip ?? 0) > 0.3 ? 'text-red-400' : (p.trend_xfip ?? 0) < -0.3 ? 'text-green-400' : ''}`}>
                {p.trend_xfip != null ? (p.trend_xfip > 0 ? '+' : '') + p.trend_xfip.toFixed(2) : '-'}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" /> Starting Pitcher Regression
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {negative.length > 0 && (
          <Collapsible open={showNeg} onOpenChange={setShowNeg}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <span className="font-medium text-red-400">Due for Negative Regression ({negative.length})</span>
              <span className="text-xs text-muted-foreground ml-1">ERA too low vs xFIP — been lucky</span>
              {showNeg ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 overflow-x-auto">
              {renderTable(negative, 'negative')}
            </CollapsibleContent>
          </Collapsible>
        )}

        {positive.length > 0 && (
          <Collapsible open={showPos} onOpenChange={setShowPos}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="font-medium text-green-400">Due for Positive Regression ({positive.length})</span>
              <span className="text-xs text-muted-foreground ml-1">ERA too high vs xFIP — been unlucky</span>
              {showPos ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 overflow-x-auto">
              {renderTable(positive, 'positive')}
            </CollapsibleContent>
          </Collapsible>
        )}

        {!negative.length && !positive.length && (
          <p className="text-sm text-muted-foreground">No significant pitcher regression signals for today's starters.</p>
        )}
      </CardContent>
    </Card>
  );
}

function BattingRegressionSection({
  heatUp, coolDown
}: { heatUp: BattingRegression[]; coolDown: BattingRegression[] }) {

  const renderTable = (teams: BattingRegression[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Team</TableHead>
          <TableHead className="text-right cursor-help" title="Weighted On-Base Average — batting value per plate appearance">wOBA</TableHead>
          <TableHead className="text-right cursor-help" title="Batting Average on Balls In Play. High/low rates signal regression">BABIP</TableHead>
          <TableHead className="text-right cursor-help" title="Expected weighted OBA from contact — quality independent of results">xwOBACon</TableHead>
          <TableHead className="text-right cursor-help" title="wOBA minus xwOBACon. Positive = overperforming, negative = underperforming">Gap</TableHead>
          <TableHead className="text-right cursor-help" title="Hard Hit% — batted balls ≥95 mph exit velocity">HH%</TableHead>
          <TableHead className="text-right cursor-help" title="% of batted balls with ideal exit velo and launch angle">Barrel%</TableHead>
          <TableHead className="text-right cursor-help" title="Average Exit Velocity — average speed of batted balls">EV</TableHead>
          <TableHead className="text-right cursor-help" title="xwOBACon trend over last 5 games. Positive = improving, negative = declining">xwC L5</TableHead>
          <TableHead>Signal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {teams.map((t: any, i: number) => {
          const gap = t.woba_gap;
          const trendXwC = t.trend_xwobacon;
          return (
            <TableRow key={i} className={severityBg(t.severity || 'mild')}>
              <TableCell>
                <div className="font-medium">{t.team_name}</div>
                <div className="text-xs text-muted-foreground">{t.games}G</div>
              </TableCell>
              <TableCell className="text-right font-mono">{t.woba?.toFixed(3) || '-'}</TableCell>
              <TableCell className="text-right font-mono font-bold">{t.babip?.toFixed(3)}</TableCell>
              <TableCell className="text-right font-mono">{t.xwobacon?.toFixed(3) || '-'}</TableCell>
              <TableCell className={`text-right font-mono font-bold ${gap != null ? (gap < -0.03 ? 'text-green-400' : gap > 0.03 ? 'text-red-400' : '') : ''}`}>
                {gap != null ? (gap > 0 ? '+' : '') + gap.toFixed(3) : '-'}
              </TableCell>
              <TableCell className={`text-right font-mono ${(t.hard_hit_pct ?? 0) > 0.38 ? 'text-green-400 font-bold' : (t.hard_hit_pct ?? 1) < 0.30 ? 'text-red-400' : ''}`}>
                {t.hard_hit_pct ? (t.hard_hit_pct * 100).toFixed(1) + '%' : '-'}
              </TableCell>
              <TableCell className={`text-right font-mono ${(t.barrel_pct ?? 0) > 0.08 ? 'text-green-400 font-bold' : (t.barrel_pct ?? 1) < 0.04 ? 'text-red-400' : ''}`}>
                {t.barrel_pct ? (t.barrel_pct * 100).toFixed(1) + '%' : '-'}
              </TableCell>
              <TableCell className={`text-right font-mono ${(t.avg_ev ?? 0) > 87.5 ? 'text-green-400 font-bold' : (t.avg_ev ?? 100) < 84.5 ? 'text-red-400' : ''}`}>
                {t.avg_ev?.toFixed(1) || '-'}
              </TableCell>
              <TableCell className={`text-right font-mono ${(trendXwC ?? 0) > 0.015 ? 'text-green-400' : (trendXwC ?? 0) < -0.015 ? 'text-red-400' : ''}`}>
                {trendXwC != null ? (trendXwC > 0 ? '+' : '') + trendXwC.toFixed(3) : '-'}
              </TableCell>
              <TableCell>
                {t.severity && (
                  <Badge className={t.severity === 'severe' ? 'bg-red-600' : t.severity === 'moderate' ? 'bg-amber-600' : 'bg-green-600'}>
                    {t.severity}
                  </Badge>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" /> Team Batting Regression
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {heatUp.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="font-medium text-green-400">Due to Heat Up ({heatUp.length})</span>
              <span className="text-xs text-muted-foreground">Low BABIP + high contact quality</span>
            </div>
            <div className="overflow-x-auto">{renderTable(heatUp)}</div>
          </div>
        )}

        {coolDown.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-red-400" />
              <span className="font-medium text-red-400">Due to Cool Down ({coolDown.length})</span>
              <span className="text-xs text-muted-foreground">High BABIP + weak contact quality</span>
            </div>
            <div className="overflow-x-auto">{renderTable(coolDown)}</div>
          </div>
        )}

        {!heatUp.length && !coolDown.length && (
          <p className="text-sm text-muted-foreground">No significant batting regression signals today.</p>
        )}
      </CardContent>
    </Card>
  );
}

function BullpenFatigueSection({ bullpens }: { bullpens: BullpenFatigue[] }) {
  if (!bullpens.length) return null;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-purple-500" /> Bullpen Fatigue & Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead className="text-right cursor-help" title="Bullpen innings pitched in the last 3 days. High usage = fatigue risk">IP Last 3d</TableHead>
              <TableHead className="text-right cursor-help" title="Bullpen innings pitched in the last 5 days. Cumulative workload">IP Last 5d</TableHead>
              <TableHead className="text-right cursor-help" title="Expected FIP for bullpen this season — baseline performance">Season xFIP</TableHead>
              <TableHead className="text-right cursor-help" title="Recent xFIP trend. Positive = declining, negative = improving">Trend xFIP</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bullpens.map((b, i) => (
              <TableRow key={i} className={b.flag === 'overworked' ? 'bg-red-500/5' : ''}>
                <TableCell className="font-medium">{b.team_name}</TableCell>
                <TableCell className={`text-right font-mono ${b.bp_ip_last3d >= 13 ? 'text-red-400 font-bold' : ''}`}>
                  {b.bp_ip_last3d?.toFixed(1)}
                </TableCell>
                <TableCell className={`text-right font-mono ${b.bp_ip_last5d >= 22 ? 'text-red-400 font-bold' : ''}`}>
                  {b.bp_ip_last5d?.toFixed(1)}
                </TableCell>
                <TableCell className="text-right font-mono">{b.season_bp_xfip?.toFixed(2) || '-'}</TableCell>
                <TableCell className={`text-right font-mono ${(b.trend_bp_xfip ?? 0) > 0 ? 'text-red-400' : (b.trend_bp_xfip ?? 0) < 0 ? 'text-green-400' : ''}`}>
                  {b.trend_bp_xfip != null ? (b.trend_bp_xfip > 0 ? '+' : '') + b.trend_bp_xfip.toFixed(2) : '-'}
                </TableCell>
                <TableCell>
                  {b.flag === 'overworked'
                    ? <Badge className="bg-red-600">OVERWORKED</Badge>
                    : <Badge className="bg-amber-600">DECLINING</Badge>
                  }
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PerfectStormSection({ storms, record }: { storms: PerfectStorm[]; record?: CumulativeBucket | null }) {
  if (!storms.length) return null;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" /> Perfect Storm Matchups
        </CardTitle>
        {record && (record.wins > 0 || record.losses > 0) && (
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground mt-2">
            <span className="font-medium uppercase tracking-wide">Record:</span>
            <span className="font-mono text-foreground">{record.wins}-{record.losses}-{record.pushes}</span>
            <span className={`font-mono font-medium ${record.units_won >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {record.units_won >= 0 ? '+' : ''}{record.units_won.toFixed(2)}u
            </span>
            <span className={`font-mono font-medium ${record.roi_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {record.roi_pct >= 0 ? '+' : ''}{record.roi_pct.toFixed(1)}% ROI
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {storms.map((s, i) => (
          <Card key={i} className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold">{s.matchup}</span>
                <div className="flex items-center gap-2">
                  <Badge className={s.direction.includes('RUNS') ? 'bg-red-600' : 'bg-blue-600'}>
                    {s.direction}
                  </Badge>
                  <Badge variant="outline">Score: {s.storm_score}/10</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{s.narrative}</p>
              {s.suggested_pick && (
                <div className="mt-3 p-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10">
                  <div className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-2">Suggested Pick</div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-semibold text-sm">{s.suggested_pick.pick}</div>
                      <div className="text-xs text-muted-foreground">{s.suggested_pick.bet_type.replace('_', ' ').toUpperCase()}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-sm font-bold">
                        {s.suggested_pick.edge_at_suggestion >= 0 ? '+' : ''}{s.suggested_pick.edge_at_suggestion.toFixed(2)}% edge
                      </div>
                      <div className="text-xs text-muted-foreground">{s.suggested_pick.confidence_at_suggestion}</div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}

function LRSplitsSection({ splits }: { splits: any[] }) {
  if (!splits || !splits.length) return null;
  const notable = splits.filter((s: any) => s.is_notable);
  const rest = splits.filter((s: any) => !s.is_notable);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Target className="h-5 w-5 text-indigo-500" /> L/R Pitcher Splits
          <span className="text-xs text-muted-foreground font-normal ml-1">How teams perform vs LHP/RHP this season</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-6">
        {notable.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Notable Matchups</div>
            <div className="space-y-2">
              {notable.map((s: any, i: number) => {
                const record = s.f5_ties > 0
                  ? `F5: ${s.f5_wins}-${s.f5_losses}-${s.f5_ties}`
                  : `F5: ${s.f5_wins}-${s.f5_losses}`;
                return (
                  <div key={i} className="flex items-center justify-between gap-2 p-2 sm:p-3 rounded-lg border border-indigo-500/30 bg-indigo-500/5">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{s.team_name} <span className="text-muted-foreground font-normal">{s.facing}</span></div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">vs {s.opponent_sp || s.opponent} ({s.opponent_sp_hand}HP)</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold">{s.avg_f5_runs} F5 R/G</div>
                      <div className={`text-[10px] sm:text-xs font-medium ${(s.f5_win_pct ?? 50) >= 60 ? 'text-green-400' : (s.f5_win_pct ?? 50) <= 40 ? 'text-red-400' : ''}`}>
                        {record} {s.f5_win_pct != null ? `(${s.f5_win_pct}%)` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {rest.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-xs text-muted-foreground">
              <ChevronDown className="h-3 w-3" />
              All splits ({rest.length} more)
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="space-y-1">
                {rest.map((s: any, i: number) => {
                  const record = s.f5_ties > 0
                    ? `F5: ${s.f5_wins}-${s.f5_losses}-${s.f5_ties}`
                    : `F5: ${s.f5_wins}-${s.f5_losses}`;
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 p-2 rounded bg-muted/10 text-xs">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{s.team_name}</span>
                        <span className="text-muted-foreground ml-1">{s.facing}</span>
                        <span className="text-muted-foreground ml-1">vs {s.opponent_sp_hand}HP</span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="font-mono">{s.avg_f5_runs} F5 R/G</span>
                        <span className="text-muted-foreground ml-2">{record}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

function WeatherSection({ flags }: { flags: WeatherParkFlag[] }) {
  if (!flags.length) return null;

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Thermometer className="h-5 w-5 text-cyan-500" /> Weather & Park Impact
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 md:grid-cols-2">
          {flags.map((f, i) => (
            <Card key={i} className="bg-muted/20">
              <CardContent className="p-3">
                <div className="font-medium text-sm">{f.matchup}</div>
                <div className="text-xs text-muted-foreground">{f.venue}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {f.flags.map((fl, j) => (
                    <Badge key={j} variant="outline" className="text-xs">{fl}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ───────────────────────────────────────────────────

export default function MLBDailyRegressionReport() {
  const { data: report, isLoading, error } = useMLBRegressionReport();

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 space-y-4">
        <Skeleton className="h-12 w-96" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load regression report: {String(error)}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>No regression report available for today yet. Reports generate at 9 AM, 11 AM, and 4 PM ET.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-2 sm:px-4 py-4 space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl sm:text-2xl font-bold">MLB Regression Report</h1>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Badge variant="outline" className="flex items-center gap-1 text-[10px] sm:text-xs">
              <Clock className="h-3 w-3" />
              {timeAgo(report.generated_at)}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">v{report.generation_version}</Badge>
          </div>
        </div>
        <p className="text-muted-foreground text-xs sm:text-sm">
          {new Date(report.report_date + 'T12:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          })}
        </p>
      </div>

      {/* AI Narrative */}
      {report.narrative_text && <NarrativeSection text={report.narrative_text} />}

      {/* Yesterday's Recap */}
      <RecapSection recap={report.yesterday_recap} cumulative={report.cumulative_record} />

      {/* Model Accuracy */}
      <AccuracyDashboardLive />

      {/* Suggested Picks */}
      <PicksSection picks={report.suggested_picks} />

      {/* Pitcher Regression */}
      <PitcherRegressionSection
        negative={report.pitcher_negative_regression}
        positive={report.pitcher_positive_regression}
      />

      {/* Batting Regression */}
      <BattingRegressionSection
        heatUp={report.batting_heat_up}
        coolDown={report.batting_cool_down}
      />

      {/* Bullpen Fatigue */}
      <BullpenFatigueSection bullpens={report.bullpen_fatigue} />

      {/* L/R Pitcher Splits */}
      <LRSplitsSection splits={report.lr_splits_today} />

      {/* Perfect Storms */}
      <PerfectStormSection storms={report.perfect_storm_matchups} record={report.perfect_storm_record} />

      {/* Weather & Park */}
      <WeatherSection flags={report.weather_park_flags} />
    </div>
  );
}
