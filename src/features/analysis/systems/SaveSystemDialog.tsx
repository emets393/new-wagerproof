import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { Sport } from '@/features/analysis/sportAdapters';
import {
  isSystemSideMarket,
  isSystemSideSymmetric,
  isSystemTotalMarket,
  verdictBetPhrase,
  type SystemVerdict,
} from './analysisSystemsService';

type Step = 'totals_side' | 'symmetric_side' | 'verdict' | 'name';

interface SaveSystemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sport: Sport;
  betType: string;
  snapshot: Record<string, unknown>;
  patchFilters: (patch: Record<string, unknown>) => void;
  saving: boolean;
  onSave: (args: { name: string; verdict: SystemVerdict; isPublic: boolean }) => void;
}

/**
 * Multi-step "Save this System" dialog.
 * Totals → Over/Under; symmetric side markets → Home/Away/Fav/Dog then ON/AGAINST;
 * otherwise ON/AGAINST → name + share. Never says verdict/RPC/snapshot.
 */
export function SaveSystemDialog({
  open,
  onOpenChange,
  sport,
  betType,
  snapshot,
  patchFilters,
  saving,
  onSave,
}: SaveSystemDialogProps) {
  const isTotals = isSystemTotalMarket(sport, betType);
  const isSide = isSystemSideMarket(sport, betType);

  const [step, setStep] = React.useState<Step>('name');
  const [verdict, setVerdict] = React.useState<SystemVerdict | null>(null);
  const [name, setName] = React.useState('');
  const [isPublic, setIsPublic] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName('');
    setIsPublic(false);
    setVerdict(null);
    if (isTotals) {
      setStep('totals_side');
    } else if (isSide) {
      setStep(isSystemSideSymmetric(sport, snapshot) ? 'symmetric_side' : 'verdict');
    } else {
      setStep('name');
    }
    // Only re-bootstrap when opened / market changes — not on every filter edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, betType, sport]);

  const chooseSymmetricSide = (patch: Record<string, unknown>) => {
    patchFilters(patch);
    setStep('verdict');
  };

  /** Spread markets pin Favorites/Underdogs via spreadSide; ML / RL / team total use favDog. */
  const chooseFavDog = (favDog: 'favorite' | 'underdog') => {
    if (betType === 'fg_spread' || betType === 'h1_spread') {
      chooseSymmetricSide({ spreadSide: favDog });
    } else {
      chooseSymmetricSide({ favDog });
    }
  };

  const chooseVerdict = (v: SystemVerdict) => {
    setVerdict(v);
    setStep('name');
  };

  const confirmationLine = verdict
    ? `We'll track this system's record as if you bet ${verdictBetPhrase(verdict)} once in every game that matches your filters.`
    : '';

  const canSave = name.trim().length > 0 && !!verdict && !saving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold">Save this System</DialogTitle>
        </DialogHeader>

        {step === 'totals_side' && (
          <div className="space-y-3">
            <p className="text-[15px] font-semibold">Which side?</p>
            <OptionButton icon="⬆️" title="The Over" onClick={() => chooseVerdict('over')} />
            <OptionButton icon="⬇️" title="The Under" onClick={() => chooseVerdict('under')} />
          </div>
        )}

        {step === 'symmetric_side' && (
          <div className="space-y-3">
            <p className="text-[15px] font-semibold leading-snug">
              Your filters describe the game — now pick which side to track. Every game has two
              teams. Which side does this system bet?
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <SideChip label="Home teams" onClick={() => chooseSymmetricSide({ side: 'home' })} />
              <SideChip label="Away teams" onClick={() => chooseSymmetricSide({ side: 'away' })} />
              <SideChip label="Favorites" onClick={() => chooseFavDog('favorite')} />
              <SideChip label="Underdogs" onClick={() => chooseFavDog('underdog')} />
            </div>
          </div>
        )}

        {step === 'verdict' && (
          <div className="space-y-3">
            <p className="text-[15px] font-semibold">Which side does this system bet?</p>
            <OptionButton
              icon="⚡"
              title="Bet ON these teams"
              subtitle="Every time a team matches my filters, bet on them."
              onClick={() => chooseVerdict('team')}
            />
            <OptionButton
              icon="🔄"
              title="Bet AGAINST these teams"
              subtitle="Every time a team matches my filters, bet on the other side."
              onClick={() => chooseVerdict('fade')}
            />
          </div>
        )}

        {step === 'name' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                System name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Home dogs off a blowout"
                maxLength={60}
                autoFocus
                className="rounded-xl"
              />
            </div>

            {confirmationLine && (
              <p className="text-[13px] leading-relaxed text-muted-foreground">{confirmationLine}</p>
            )}

            <button
              type="button"
              className="flex w-full items-start gap-3 text-left"
              onClick={() => setIsPublic((v) => !v)}
            >
              <Switch
                checked={isPublic}
                onCheckedChange={setIsPublic}
                onClick={(e) => e.stopPropagation()}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Share to the Systems Leaderboard</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                  {isPublic
                    ? 'On — we score this system after save. Needs 10+ matching games to appear.'
                    : 'Off — private to you only. Turn on to compete on the public board (10+ games).'}
                </span>
              </span>
            </button>

            <Button
              className="h-11 w-full rounded-xl text-[15px] font-bold"
              disabled={!canSave}
              onClick={() => {
                if (!verdict) return;
                onSave({ name: name.trim(), verdict, isPublic });
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save System'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function OptionButton({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon?: string;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border border-black/8 bg-black/[0.03] p-3.5 text-left transition-colors',
        'hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]',
      )}
    >
      {icon ? <span className="text-[22px] leading-none">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold">{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
    </button>
  );
}

function SideChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border border-black/8 px-3 py-4 text-center text-[15px] font-bold transition-colors',
        'hover:bg-black/[0.05] dark:border-white/10 dark:hover:bg-white/[0.08]',
      )}
    >
      {label}
    </button>
  );
}
