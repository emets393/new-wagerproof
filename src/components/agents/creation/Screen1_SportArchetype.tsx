import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArchetypeId, PersonalityParams, CustomInsights, PresetArchetype, Sport, SPORTS } from '@/types/agent';
import { usePresetArchetypes } from '@/hooks/useAgents';

type CreationPath = 'scratch' | 'preset' | null;

interface Props {
  selectedSports: Sport[];
  selectedArchetype: ArchetypeId | null;
  onSportsChange: (sports: Sport[]) => void;
  onArchetypeChange: (
    archetypeId: ArchetypeId | null,
    personalityParams?: Partial<PersonalityParams>,
    customInsights?: CustomInsights
  ) => void;
}

const PERFORMANCE_ROWS = [
  { label: 'Our Agents', value: '9-12%', direction: 'positive' as const, barWidth: 120, color: '#ff6a00' },
  { label: 'Pro Bettor', value: '2-5%', direction: 'positive' as const, barWidth: 62, color: '#bdbdbd' },
  { label: 'Casual Bettor', value: '-5%', direction: 'negative' as const, barWidth: 38, color: '#8d8d8d' },
];

const ROW_LABEL_WIDTH = 82;
const BASELINE_IN_PLOT = 48;

export function Screen1_SportArchetype({ selectedSports, selectedArchetype, onSportsChange, onArchetypeChange }: Props) {
  const { data: archetypes } = usePresetArchetypes();
  const [path, setPath] = React.useState<CreationPath>(
    selectedArchetype ? 'preset' : selectedSports.length ? 'scratch' : null
  );

  const toggleSport = (sport: Sport) => {
    const exists = selectedSports.includes(sport);
    onSportsChange(exists ? selectedSports.filter((s) => s !== sport) : [...selectedSports, sport]);
  };

  const applyArchetype = (a: PresetArchetype) => {
    onSportsChange(a.recommended_sports);
    onArchetypeChange(a.id, a.personality_params, a.custom_insights);
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">How do you want to start?</h2>
        <p className="text-sm text-muted-foreground">Build a custom strategy or pick a proven preset.</p>
      </div>

      {!path && (
        <>
          <div className="grid md:grid-cols-2 gap-3">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Build from Scratch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Choose sports, then fine-tune every parameter.</p>
                <Button className="w-full" onClick={() => { setPath('scratch'); onArchetypeChange(null); }}>
                  Start Custom
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Use a Preset</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Start with a tuned style and pre-configured sports.</p>
                <Button variant="secondary" className="w-full" onClick={() => { setPath('preset'); onSportsChange([]); onArchetypeChange(null); }}>
                  Choose Preset
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">This Model Wins Across the Board</CardTitle>
              <p className="text-xs text-muted-foreground">Our agents outperform average bettors via disciplined, 24/7 research.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="relative space-y-2">
                <div
                  className="absolute top-0 bottom-0 w-1 rounded"
                  style={{ left: ROW_LABEL_WIDTH + BASELINE_IN_PLOT, backgroundColor: '#9ca3af' }}
                />
                {PERFORMANCE_ROWS.map((row) => (
                  <div key={row.label} className="flex items-center min-h-7 relative">
                    <div className="text-xs font-medium" style={{ width: ROW_LABEL_WIDTH }}>{row.label}</div>
                    <div className="flex-1 relative h-4">
                      <div
                        className="absolute h-3"
                        style={{
                          width: row.barWidth,
                          backgroundColor: row.color,
                          borderRadius: row.direction === 'negative' ? '8px 0 0 8px' : '0 8px 8px 0',
                          left: row.direction === 'negative' ? BASELINE_IN_PLOT - row.barWidth : BASELINE_IN_PLOT,
                        }}
                      />
                    </div>
                    <div className="text-xs font-semibold text-right w-12">{row.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {path === 'scratch' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Sports</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {SPORTS.map((sport) => {
                const selected = selectedSports.includes(sport);
                return (
                  <Button
                    key={sport}
                    type="button"
                    variant={selected ? 'default' : 'outline'}
                    onClick={() => toggleSport(sport)}
                    className="uppercase"
                  >
                    {sport}
                  </Button>
                );
              })}
            </div>
            <Button type="button" variant="ghost" onClick={() => setPath(null)}>
              Change path
            </Button>
          </CardContent>
        </Card>
      )}

      {path === 'preset' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose a Preset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              {(archetypes || []).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => applyArchetype(a)}
                  className={`rounded-lg border p-3 text-left ${selectedArchetype === a.id ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm flex items-center gap-2"><span>{a.emoji}</span>{a.name}</span>
                    {selectedArchetype === a.id ? <Badge>Selected</Badge> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{a.description}</p>
                </button>
              ))}
            </div>
            <Button type="button" variant="ghost" onClick={() => setPath(null)}>
              Change path
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
