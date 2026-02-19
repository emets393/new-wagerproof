import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CreateAgentFormState } from '@/types/agent';

interface Props {
  state: CreateAgentFormState;
  onAutoGenerateChange: (value: boolean) => void;
}

export function Screen6_Review({ state, onAutoGenerateChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Review</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border p-3">
          <p className="text-sm text-muted-foreground">Agent</p>
          <p className="text-lg font-semibold mt-1 flex items-center gap-2">
            <span>{state.avatar_emoji || '🤖'}</span>
            <span>{state.name || 'Unnamed Agent'}</span>
          </p>
        </div>

        <div className="rounded-md border p-3">
          <p className="text-sm text-muted-foreground mb-2">Sports</p>
          <div className="flex flex-wrap gap-2">
            {state.preferred_sports.map((sport) => (
              <Badge key={sport} variant="outline" className="uppercase">{sport}</Badge>
            ))}
            {!state.preferred_sports.length ? <p className="text-sm text-muted-foreground">None selected</p> : null}
          </div>
        </div>

        <div className="rounded-md border p-3">
          <p className="text-sm text-muted-foreground mb-1">Archetype</p>
          <p className="font-medium">{state.archetype || 'Custom (no preset)'}</p>
        </div>

        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label htmlFor="auto-generate" className="font-medium">Auto-generate picks</Label>
            <p className="text-xs text-muted-foreground mt-1">Generate picks daily without manual trigger.</p>
          </div>
          <Switch id="auto-generate" checked={state.auto_generate} onCheckedChange={onAutoGenerateChange} />
        </div>
      </CardContent>
    </Card>
  );
}
