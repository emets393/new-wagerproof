import { ArrowUpDown, Lock } from 'lucide-react';
import { SegmentedControl } from '@/components/ios';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check } from 'lucide-react';
import { GAMES_SPORTS, SPORT_LABELS, type GamesSport, type GamesSortKey } from '../types';

interface SortOption {
  value: GamesSortKey;
  label: string;
  locked?: boolean;
}

interface SportPickerProps {
  sport: GamesSport;
  onSportChange: (sport: GamesSport) => void;
  sortKey: GamesSortKey;
  onSortChange: (key: GamesSortKey) => void;
  isFreemiumUser: boolean;
}

/**
 * iOS Games-tab picker bar: segmented sport control + sort menu button
 * sharing one floating glass capsule.
 */
export function SportPicker({
  sport,
  onSportChange,
  sortKey,
  onSortChange,
  isFreemiumUser,
}: SportPickerProps) {
  // Spread/O-U value sorts are Pro features, same gating as the legacy pages.
  const sortOptions: SortOption[] = [
    { value: 'time', label: 'Time' },
    { value: 'ml', label: 'Win Prob' },
    ...(sport !== 'mlb' ? [{ value: 'spread' as const, label: 'Spread Value', locked: isFreemiumUser }] : []),
    { value: 'ou', label: 'O/U Value', locked: isFreemiumUser },
  ];

  return (
    <div className="flex items-center gap-1.5">
      <SegmentedControl
        layoutId="games-sport-picker"
        size="sm"
        className="min-w-0 flex-1 overflow-x-auto scrollbar-transparent"
        options={GAMES_SPORTS.map((s) => ({ value: s, label: SPORT_LABELS[s] }))}
        value={sport}
        onChange={onSportChange}
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
          {sortOptions.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              disabled={opt.locked}
              onClick={() => onSortChange(opt.value)}
              className="gap-2 rounded-lg"
            >
              <span className="flex-1">{opt.label}</span>
              {opt.locked ? (
                <Lock className="h-3 w-3 text-muted-foreground" />
              ) : (
                opt.value === sortKey && <Check className="h-3.5 w-3.5 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
