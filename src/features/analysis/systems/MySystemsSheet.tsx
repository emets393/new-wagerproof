import * as React from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Sport } from '@/features/analysis/sportAdapters';
import {
  sinceSavedLabel,
  sportLabel,
  verdictLabel,
  type SavedSystemRow,
} from './analysisSystemsService';
import {
  useDeleteSystem,
  useMySystems,
  useRenameSystem,
  useSetSystemPublic,
} from './useAnalysisSystems';

interface MySystemsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefer listing this sport; user can expand to all. */
  currentSport: Sport;
  onApply: (row: SavedSystemRow) => void;
}

/** Sheet listing the user's saved systems — current sport first, with an All sports toggle. */
export function MySystemsSheet({
  open,
  onOpenChange,
  currentSport,
  onApply,
}: MySystemsSheetProps) {
  const [scope, setScope] = React.useState<'current' | 'all'>('current');
  const sportFilter = scope === 'all' ? 'all' : currentSport;
  const { data: systems, isLoading } = useMySystems(sportFilter, { enabled: open });
  const renameMutation = useRenameSystem();
  const setPublicMutation = useSetSystemPublic();
  const deleteMutation = useDeleteSystem();

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState('');

  React.useEffect(() => {
    if (!open) {
      setEditingId(null);
      setEditName('');
      setScope('current');
    }
  }, [open]);

  const commitRename = (row: SavedSystemRow) => {
    const trimmed = editName.trim();
    if (trimmed.length > 0 && trimmed !== row.name) {
      renameMutation.mutate({ sport: row.sport, id: row.id, name: trimmed });
    }
    setEditingId(null);
    setEditName('');
  };

  const confirmDelete = (row: SavedSystemRow) => {
    if (!window.confirm(`Delete "${row.name}"? This can't be undone.`)) return;
    deleteMutation.mutate(
      { sport: row.sport, id: row.id },
      {
        onSuccess: () => toast.success('System deleted', { duration: 2000 }),
        onError: () => toast.error("Couldn't delete system", { duration: 2500 }),
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-black/5 px-5 py-4 dark:border-white/10">
          <div className="flex items-center justify-between pr-6">
            <SheetTitle className="text-lg font-extrabold">My Systems</SheetTitle>
          </div>
          <div className="mt-3 flex gap-2">
            <ScopeChip
              active={scope === 'current'}
              onClick={() => setScope('current')}
              label={sportLabel(currentSport)}
            />
            <ScopeChip active={scope === 'all'} onClick={() => setScope('all')} label="All sports" />
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !systems || systems.length === 0 ? (
            <p className="px-2 py-10 text-center text-sm leading-relaxed text-muted-foreground">
              You haven&apos;t saved any systems yet. Build a filter and tap Save System.
            </p>
          ) : (
            <div className="space-y-2.5">
              {systems.map((row) => (
                <div
                  key={`${row.sport}-${row.id}`}
                  className="flex items-center gap-2 rounded-2xl border border-black/6 bg-black/[0.025] p-3 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    disabled={editingId === row.id}
                    onClick={() => onApply(row)}
                  >
                    {editingId === row.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename(row);
                          if (e.key === 'Escape') {
                            setEditingId(null);
                            setEditName('');
                          }
                        }}
                        onBlur={() => commitRename(row)}
                        autoFocus
                        maxLength={60}
                        className="h-8 rounded-lg text-sm font-bold"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="truncate text-[15px] font-bold">{row.name}</div>
                    )}
                    <div className="mt-0.5 text-xs font-semibold text-muted-foreground">
                      {scope === 'all' ? `${sportLabel(row.sport)} · ` : ''}
                      {verdictLabel(row.verdict)}
                      {row.verdict ? ' · ' : ''}
                      {(row.bet_type || '').toUpperCase()}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {sinceSavedLabel(row.since_saved)}
                    </div>
                  </button>

                  <div className="flex flex-col items-center gap-0.5">
                    <Switch
                      checked={row.is_public}
                      onCheckedChange={(v) =>
                        setPublicMutation.mutate({ sport: row.sport, id: row.id, isPublic: v })
                      }
                    />
                    <span className="text-[9px] font-semibold text-muted-foreground">Share</span>
                  </div>

                  <div className="flex items-center">
                    <button
                      type="button"
                      aria-label={`Rename ${row.name}`}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setEditingId(row.id);
                        setEditName(row.name);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${row.name}`}
                      className="rounded-lg p-1.5 text-muted-foreground hover:text-red-500"
                      onClick={() => confirmDelete(row)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ScopeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-black/[0.05] text-muted-foreground hover:text-foreground dark:bg-white/[0.08]',
      )}
    >
      {label}
    </button>
  );
}
