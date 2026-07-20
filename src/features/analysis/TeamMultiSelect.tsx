import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ChevronDown, Search, X } from 'lucide-react';

export type TeamOption = { id: string; name: string; logo?: string };

/** Multi-select team / opponent dropdown used by NFL / CFB / MLB Historical Analysis. */
export function TeamMultiSelect({
  label,
  options,
  value,
  onChange,
  emptyLabel = 'Any team',
}: {
  label: string;
  options: TeamOption[];
  value: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return options;
    return options.filter(
      (o) => o.id.toLowerCase().includes(qq) || o.name.toLowerCase().includes(qq),
    );
  }, [options, q]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((t) => t !== id) : [...value, id]);
  };

  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {value.map((t) => {
            const opt = options.find((o) => o.id === t);
            return (
              <Badge key={t} variant="secondary" className="gap-1 pr-1 text-[10px]">
                {opt?.logo ? (
                  <img
                    src={opt.logo}
                    alt=""
                    className="w-3.5 h-3.5"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                ) : null}
                {t}
                <button type="button" onClick={() => toggle(t)} aria-label={`Remove ${t}`}>
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-8 w-full justify-between text-xs"
        onClick={() => setOpen((o) => !o)}
      >
        {value.length ? `${value.length} selected` : emptyLabel}
        <ChevronDown className={`w-3.5 h-3.5 ${open ? 'rotate-180' : ''}`} />
      </Button>
      {open && (
        <div className="mt-1 rounded-md border bg-popover p-2 max-h-48 overflow-y-auto space-y-1">
          <div className="relative mb-1">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter list…"
              className="h-8 pl-7 text-xs"
            />
          </div>
          {filtered.map((o) => (
            <label
              key={o.id}
              className="flex items-center gap-2 text-xs px-1 py-1 rounded hover:bg-accent cursor-pointer"
            >
              <Checkbox checked={value.includes(o.id)} onCheckedChange={() => toggle(o.id)} />
              {o.logo ? (
                <img
                  src={o.logo}
                  alt=""
                  className="w-4 h-4"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                  }}
                />
              ) : null}
              {o.id !== o.name && <span className="font-medium shrink-0">{o.id}</span>}
              <span className="text-muted-foreground truncate">{o.name}</span>
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground py-2 text-center">No matches</p>
          )}
        </div>
      )}
    </div>
  );
}
