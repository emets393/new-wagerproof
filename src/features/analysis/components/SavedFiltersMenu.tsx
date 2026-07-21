import * as React from 'react';
import { Bookmark, BookmarkPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const MAX_SAVED = 25;

interface SavedRow {
  id: string;
  name: string;
  bet_type: string;
  filters: Record<string, unknown>;
}

/**
 * Saved-filter popover: restore / delete / save-current against the per-sport
 * `{sport}_analysis_saved_filters` table (main auth project). 25-row cap, RLS auth.uid()=user_id.
 */
export function SavedFiltersMenu({
  table,
  betType,
  buildSnapshot,
  onRestore,
}: {
  table: string;
  betType: string;
  /** the current snapshot to persist (adapter-shaped). */
  buildSnapshot: () => Record<string, unknown>;
  onRestore: (filters: Record<string, unknown>, betType: string) => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = React.useState(false);
  const [saved, setSaved] = React.useState<SavedRow[]>([]);
  const [saveName, setSaveName] = React.useState('');

  const loadSaved = React.useCallback(async () => {
    if (!user) {
      setSaved([]);
      return;
    }
    const { data } = await supabase.from(table).select('*').order('created_at', { ascending: false });
    setSaved((data as SavedRow[]) || []);
  }, [user, table]);

  React.useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const saveCurrent = async () => {
    if (!user || !saveName.trim()) return;
    const { error } = await supabase
      .from(table)
      .insert({ user_id: user.id, name: saveName.trim(), bet_type: betType, filters: buildSnapshot() });
    if (error) {
      toast.error(error.message, { duration: 3000 });
      return;
    }
    setSaveName('');
    toast.success('Filter saved', { duration: 2000 });
    loadSaved();
  };

  const deleteSaved = async (id: string) => {
    await supabase.from(table).delete().eq('id', id);
    loadSaved();
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-all duration-200 active:scale-95',
            saved.length > 0
              ? 'border-black/5 bg-white/60 text-foreground hover:bg-white/80 dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]'
              : 'border-black/5 bg-white/60 text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-white/[0.06]',
          )}
        >
          <Bookmark className="h-4 w-4" />
          Saved
          {saved.length > 0 && <span className="tabular-nums text-muted-foreground">{saved.length}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Saved filters
        </div>
        {saved.length === 0 ? (
          <p className="pb-2 text-xs text-muted-foreground">
            Nothing saved yet — name the current setup below to track it this season.
          </p>
        ) : (
          <div className="mb-2 max-h-60 space-y-0.5 overflow-y-auto">
            {saved.map((s) => (
              <div
                key={s.id}
                className="group flex items-center gap-1 rounded-xl transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
              >
                <button
                  type="button"
                  onClick={() => {
                    onRestore(s.filters, s.bet_type);
                    setOpen(false);
                  }}
                  className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-[13px] font-medium"
                >
                  {s.name}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${s.name}`}
                  className="mr-1 rounded-full p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                  onClick={() => deleteSaved(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 border-t border-black/5 pt-2.5 dark:border-white/10">
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Name this filter"
            className="h-8 rounded-full text-xs"
            onKeyDown={(e) => e.key === 'Enter' && saveCurrent()}
          />
          <Button
            size="sm"
            className="h-8 shrink-0 rounded-full"
            onClick={saveCurrent}
            disabled={!saveName.trim() || saved.length >= MAX_SAVED}
          >
            <BookmarkPlus className="mr-1 h-3.5 w-3.5" /> Save
          </Button>
        </div>
        {saved.length >= MAX_SAVED && (
          <p className="mt-1 text-[10px] text-muted-foreground">25 saved max — delete one to add more.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
