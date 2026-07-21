import { ArrowUpDown, Check } from 'lucide-react';
import { SegmentedControl } from '@/components/ios';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  TRENDS_SORT_LABELS,
  TRENDS_SPORTS,
  TRENDS_SPORT_LABELS,
  type TrendsSortKey,
  type TrendsSportFilter,
} from '../types';

const SPORT_OPTIONS: { value: TrendsSportFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...TRENDS_SPORTS.map((s) => ({ value: s as TrendsSportFilter, label: TRENDS_SPORT_LABELS[s] })),
];

const SORT_KEYS: TrendsSortKey[] = ['time', 'ou', 'side'];

interface TrendsSportPickerProps {
  sport: TrendsSportFilter;
  onSportChange: (sport: TrendsSportFilter) => void;
  sortKey: TrendsSortKey;
  onSortChange: (key: TrendsSortKey) => void;
}

/**
 * Feed header control: segmented league filter (with an All slot, since this
 * tool merges every league into one slate) plus the sort menu.
 */
export function TrendsSportPicker({
  sport,
  onSportChange,
  sortKey,
  onSortChange,
}: TrendsSportPickerProps) {
  return (
    <div className="flex items-center gap-1.5">
      <SegmentedControl
        layoutId="trends-sport-picker"
        size="sm"
        className="min-w-0 flex-1 overflow-x-auto scrollbar-transparent"
        options={SPORT_OPTIONS}
        value={sport}
        // Wrapped rather than passed bare: a Dispatch<SetStateAction<T>> would
        // let T infer as a function type and collapse the generic to `string`.
        onChange={(v) => onSportChange(v)}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Sort games"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/5 bg-white/60 text-muted-foreground backdrop-blur-xl hover:text-foreground dark:border-white/10 dark:bg-white/[0.06]"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="rounded-2xl">
          {SORT_KEYS.map((key) => (
            <DropdownMenuItem
              key={key}
              onClick={() => onSortChange(key)}
              className="gap-2 rounded-lg"
            >
              <span className="flex-1">{TRENDS_SORT_LABELS[key]}</span>
              {key === sortKey && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
