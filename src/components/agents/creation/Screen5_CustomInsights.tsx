import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CustomInsights } from '@/types/agent';

interface Props {
  insights: CustomInsights;
  onInsightChange: <K extends keyof CustomInsights>(key: K, value: CustomInsights[K]) => void;
}

function InsightField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  onChange: (val: string | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value.trim().length ? e.target.value : null)}
        placeholder={placeholder}
      />
    </div>
  );
}

export function Screen5_CustomInsights({ insights, onInsightChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Custom Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <InsightField
          label="Betting philosophy"
          placeholder="Describe the approach this agent should follow."
          value={insights.betting_philosophy}
          onChange={(v) => onInsightChange('betting_philosophy', v)}
        />

        <InsightField
          label="Perceived edges"
          placeholder="What edge should this agent try to exploit?"
          value={insights.perceived_edges}
          onChange={(v) => onInsightChange('perceived_edges', v)}
        />

        <InsightField
          label="Avoid situations"
          placeholder="What spots should this agent avoid?"
          value={insights.avoid_situations}
          onChange={(v) => onInsightChange('avoid_situations', v)}
        />

        <InsightField
          label="Target situations"
          placeholder="What spots should this agent prioritize?"
          value={insights.target_situations}
          onChange={(v) => onInsightChange('target_situations', v)}
        />
      </CardContent>
    </Card>
  );
}
