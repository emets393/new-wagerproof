import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CreateAgentFormState, Sport, US_TIMEZONES } from '@/types/agent';

interface Props {
  state: CreateAgentFormState;
  onAutoGenerateChange: (value: boolean) => void;
  onAutoGenerateTimeChange: (value: string) => void;
  onAutoGenerateTimezoneChange: (value: string) => void;
}

const SPORT_COLORS: Record<Sport, string> = {
  nfl: '#013369',
  cfb: '#C41E3A',
  nba: '#1D428A',
  ncaab: '#FF6B00',
  mlb: '#0F766E',
};

export function Screen6_Review({ state, onAutoGenerateChange, onAutoGenerateTimeChange, onAutoGenerateTimezoneChange }: Props) {
  const gradientStops = state.preferred_sports.length
    ? state.preferred_sports.map((sport) => SPORT_COLORS[sport])
    : ['#3B82F6', '#14B8A6'];

  const topBorder = `linear-gradient(90deg, ${gradientStops.join(', ')})`;
  const backgroundWash = `linear-gradient(180deg, ${gradientStops[0]}24 0%, ${gradientStops[Math.min(1, gradientStops.length - 1)]}14 38%, transparent 78%)`;

  return (
    <Card className="overflow-hidden border-white/10 bg-white/70 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl dark:bg-white/[0.05]">
      <CardHeader>
        <CardTitle className="text-base">Review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative overflow-hidden rounded-[28px] border border-border/50 bg-background shadow-[0_16px_40px_-28px_rgba(15,23,42,0.4)]">
          <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundImage: topBorder }} />
          <div className="absolute inset-0" style={{ backgroundImage: backgroundWash }} />
          <div className="relative p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Agent Summary</p>
            <p className="text-lg font-semibold mt-3 flex items-center gap-2">
              <span>{state.avatar_emoji || '🤖'}</span>
              <span>{state.name || 'Unnamed Agent'}</span>
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/70 p-4 backdrop-blur-md">
          <p className="text-sm text-muted-foreground mb-2">Sports</p>
          <div className="flex flex-wrap gap-2">
            {state.preferred_sports.map((sport) => (
              <Badge key={sport} variant="outline" className="uppercase border-primary/20 bg-primary/10">{sport}</Badge>
            ))}
            {!state.preferred_sports.length ? <p className="text-sm text-muted-foreground">None selected</p> : null}
          </div>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/70 p-4 backdrop-blur-md">
          <p className="text-sm text-muted-foreground mb-1">Archetype</p>
          <p className="font-medium">{state.archetype || 'Custom (no preset)'}</p>
        </div>

        <div className="rounded-3xl border border-border/50 bg-background/70 p-4 backdrop-blur-md space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-generate" className="font-medium">Auto-generate picks</Label>
              <p className="text-xs text-muted-foreground mt-1">Generate picks daily without manual trigger.</p>
            </div>
            <Switch id="auto-generate" checked={state.auto_generate} onCheckedChange={onAutoGenerateChange} />
          </div>

          {state.auto_generate && (
            <>
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <div>
                  <Label htmlFor="auto-generate-time" className="font-medium">Preferred Time</Label>
                  <p className="text-xs text-muted-foreground mt-1">When to generate picks each day.</p>
                </div>
                <Input
                  id="auto-generate-time"
                  type="time"
                  value={state.auto_generate_time}
                  onChange={(e) => onAutoGenerateTimeChange(e.target.value)}
                  className="w-32"
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <div>
                  <Label htmlFor="auto-generate-timezone" className="font-medium">Timezone</Label>
                  <p className="text-xs text-muted-foreground mt-1">Timezone for the preferred time.</p>
                </div>
                <select
                  id="auto-generate-timezone"
                  value={state.auto_generate_timezone}
                  onChange={(e) => onAutoGenerateTimezoneChange(e.target.value)}
                  className="w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {US_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
