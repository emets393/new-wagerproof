import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ios';
import { ProGate } from '@/features/parlayGod/ProGate';
import { sideColors } from '../colors';
import { formatStart } from '../format';
import { SPORT_LABELS, type PublicGame, type PublicMarket } from '../types';
import { DivergenceBar } from './DivergenceBar';
import { LineMoveRail } from './LineMoveRail';
import { TeamMarks } from './TeamMarks';
import { TierChip } from './TierChip';

interface FeedCardProps {
  game: PublicGame;
  market: PublicMarket;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function SelectionGlow({ color, side }: { color: string; side: 'left' | 'right' }) {
  const anchor = side === 'left' ? '0%' : '100%';
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-y-0 w-1/2 opacity-25 dark:opacity-35',
        side === 'left' ? 'left-0' : 'right-0',
      )}
      style={{
        background: `radial-gradient(120% 100% at ${anchor} 50%, ${color} 0%, transparent 70%)`,
      }}
    />
  );
}

export function FeedCard({ game, market, isSelected, onSelect }: FeedCardProps) {
  const slot = game.markets[market];
  if (!slot || slot.read.excluded) return null;
  const { read } = slot;
  const colors = sideColors(market, game.away, game.home);
  const confirmColor =
    read.moneyTiltSide === 'away' ? colors.away : read.moneyTiltSide === 'home' ? colors.home : colors.away;
  const arrowColor = read.movedToward === 'away' ? colors.away : read.movedToward === 'home' ? colors.home : 'currentColor';

  return (
    <GlassCard
      interactive
      role="button"
      tabIndex={0}
      onClick={() => onSelect(game.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(game.id);
        }
      }}
      className={cn('relative overflow-hidden px-3 py-3 text-left', isSelected && 'ring-1 ring-foreground/25')}
    >
      {isSelected && (
        <>
          <SelectionGlow color={game.away.colors.primary} side="left" />
          <SelectionGlow color={game.home.colors.primary} side="right" />
        </>
      )}
      <div className="relative flex items-center gap-2">
        <TeamMarks away={game.away} home={game.home} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <span className="rounded-full bg-foreground/10 px-1.5 py-0.5">{SPORT_LABELS[game.sport]}</span>
            <span className="truncate font-medium normal-case tracking-normal">{formatStart(game.startTime)}</span>
          </div>
          <div className="truncate text-[14px] font-semibold text-foreground">
            {game.away.name} <span className="font-medium text-muted-foreground">@</span> {game.home.name}
          </div>
        </div>
      </div>

      {read.emphasis !== 'none' && (
        <div className="relative mt-2.5" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <ProGate title="Market reads" minHeight={40}>
            <TierChip read={read} ringColor={read.category === 'sharp_money' ? confirmColor : undefined} />
          </ProGate>
        </div>
      )}

      <div
        className={cn('relative mt-2.5 flex flex-col gap-1.5', read.category === 'sharp_money' && 'rounded-2xl p-2')}
        style={read.category === 'sharp_money' ? { boxShadow: `inset 0 0 0 1px ${confirmColor}` } : undefined}
      >
        <div className="min-w-0 flex-1">
          <DivergenceBar
            betsAway={read.betsAway}
            betsHome={read.betsHome}
            moneyAway={read.moneyAway}
            moneyHome={read.moneyHome}
            awayColor={colors.away}
            homeColor={colors.home}
            moneyTiltSide={read.moneyTiltSide}
            awayLabel={read.sideName.away}
            homeLabel={read.sideName.home}
            awayTeam={market === 'total' ? undefined : game.away}
            homeTeam={market === 'total' ? undefined : game.home}
          />
        </div>
        <LineMoveRail
          market={market}
          awayName={game.away.name}
          homeName={game.home.name}
          read={read}
          color={read.category === 'sharp_money' ? confirmColor : arrowColor}
        />
      </div>
    </GlassCard>
  );
}
