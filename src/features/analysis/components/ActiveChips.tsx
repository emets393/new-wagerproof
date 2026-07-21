import * as React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ActiveChip } from './adapters/types';

/** Closeable active-filter chips + "Reset all". Makes a stuck filter visible. */
export function ActiveChips({
  chips,
  onClear,
  onResetAll,
}: {
  chips: ActiveChip[];
  onClear: (patch: Record<string, unknown>) => void;
  onResetAll: () => void;
}) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] uppercase tracking-wide text-muted-foreground">Active:</span>
      {chips.map((chip, i) => (
        <Badge key={i} variant="secondary" className="gap-1 pr-1 font-normal">
          {chip.label}
          <button
            type="button"
            onClick={() => onClear(chip.patch)}
            className="rounded p-0.5 hover:bg-foreground/15"
            aria-label={`Clear ${chip.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <button
        type="button"
        onClick={onResetAll}
        className="h-6 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        Reset all
      </button>
    </div>
  );
}
