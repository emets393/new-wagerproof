import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  name: string;
  emoji: string;
  color: string;
  onNameChange: (v: string) => void;
  onEmojiChange: (v: string) => void;
  onColorChange: (v: string) => void;
}

const QUICK_EMOJIS = ['🤖', '🧠', '📈', '⚡', '🎯', '🦾', '🔥', '💎'];

export function Screen2_Identity({ name, emoji, color, onNameChange, onEmojiChange, onColorChange }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Identity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Agent Name</Label>
          <Input value={name} onChange={(e) => onNameChange(e.target.value)} placeholder="SharpValue AI" maxLength={50} />
        </div>

        <div className="space-y-2">
          <Label>Emoji</Label>
          <Input value={emoji} onChange={(e) => onEmojiChange(e.target.value)} placeholder="🤖" maxLength={8} />
          <div className="flex flex-wrap gap-2">
            {QUICK_EMOJIS.map((item) => (
              <button
                type="button"
                key={item}
                className="h-9 w-9 rounded border text-lg"
                onClick={() => onEmojiChange(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Primary Color</Label>
          <div className="flex items-center gap-3">
            <Input value={color} onChange={(e) => onColorChange(e.target.value)} placeholder="#6366f1" />
            <input
              aria-label="Color"
              type="color"
              value={color.startsWith('#') ? color : '#6366f1'}
              onChange={(e) => onColorChange(e.target.value)}
              className="h-10 w-12 rounded border bg-transparent p-1"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
