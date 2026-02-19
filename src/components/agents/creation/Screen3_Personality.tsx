import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { PersonalityParams } from '@/types/agent';

interface Props {
  params: PersonalityParams;
  onParamChange: <K extends keyof PersonalityParams>(key: K, value: PersonalityParams[K]) => void;
}

function ScaleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs text-muted-foreground">{value}/5</span>
      </div>
      <Slider min={1} max={5} step={1} value={[value]} onValueChange={(arr) => onChange(arr[0])} />
    </div>
  );
}

export function Screen3_Personality({ params, onParamChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Personality</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ScaleField label="Risk tolerance" value={params.risk_tolerance} onChange={(v) => onParamChange('risk_tolerance', v as any)} />
        <ScaleField label="Underdog lean" value={params.underdog_lean} onChange={(v) => onParamChange('underdog_lean', v as any)} />
        <ScaleField label="Confidence threshold" value={params.confidence_threshold} onChange={(v) => onParamChange('confidence_threshold', v as any)} />
        <ScaleField label="Trust model" value={params.trust_model} onChange={(v) => onParamChange('trust_model', v as any)} />

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="font-medium">Chase value</p>
            <p className="text-xs text-muted-foreground">Prefer prices with stronger expected value edges.</p>
          </div>
          <Switch checked={params.chase_value} onCheckedChange={(v) => onParamChange('chase_value', v as any)} />
        </div>
      </CardContent>
    </Card>
  );
}
