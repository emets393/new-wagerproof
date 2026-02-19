import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { getConditionalParams, PersonalityParams, Sport } from '@/types/agent';

interface Props {
  params: PersonalityParams;
  selectedSports: Sport[];
  onParamChange: <K extends keyof PersonalityParams>(key: K, value: PersonalityParams[K]) => void;
}

export function Screen4_DataAndConditions({ params, selectedSports, onParamChange }: Props) {
  const conditional = getConditionalParams(selectedSports);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Data & Conditions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Trust Polymarket</Label>
            <span className="text-xs text-muted-foreground">{params.trust_polymarket}/5</span>
          </div>
          <Slider min={1} max={5} step={1} value={[params.trust_polymarket]} onValueChange={(arr) => onParamChange('trust_polymarket', arr[0] as any)} />
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="font-medium">Skip weak slates</p>
            <p className="text-xs text-muted-foreground">Avoid low-quality card days automatically.</p>
          </div>
          <Switch checked={params.skip_weak_slates} onCheckedChange={(v) => onParamChange('skip_weak_slates', v as any)} />
        </div>

        {conditional.showPublicBetting && (
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">Fade public betting</p>
              <p className="text-xs text-muted-foreground">Prioritize contrarian opportunities.</p>
            </div>
            <Switch checked={!!params.fade_public} onCheckedChange={(v) => onParamChange('fade_public', v as any)} />
          </div>
        )}

        {conditional.showWeather && (
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">Weather impacts totals</p>
              <p className="text-xs text-muted-foreground">Apply stronger weather adjustments on totals.</p>
            </div>
            <Switch checked={!!params.weather_impacts_totals} onCheckedChange={(v) => onParamChange('weather_impacts_totals', v as any)} />
          </div>
        )}

        {conditional.showBackToBacks && (
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="font-medium">Fade back-to-backs</p>
              <p className="text-xs text-muted-foreground">Penalty on teams in poor rest spots.</p>
            </div>
            <Switch checked={!!params.fade_back_to_backs} onCheckedChange={(v) => onParamChange('fade_back_to_backs', v as any)} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
