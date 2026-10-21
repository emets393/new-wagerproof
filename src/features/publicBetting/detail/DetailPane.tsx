import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ios';
import { ProGate } from '@/features/parlayGod/ProGate';
import { sideColors } from '../colors';
import { formatCaptured, formatStart } from '../format';
import {
  MARKET_LABELS,
  PUBLIC_MARKETS,
  SPORT_LABELS,
  type PublicGame,
  type PublicMarket,
} from '../types';
import { DivergenceBar } from '../components/DivergenceBar';
import { LineMoveRail } from '../components/LineMoveRail';
import { TeamMarks } from '../components/TeamMarks';
import { TierChip } from '../components/TierChip';

interface DetailPaneProps {
  game: PublicGame | null;
  market: PublicMarket;
  isLoading: boolean;
}

export function DetailPane({ game, market, isLoading }: DetailPaneProps) {
  const [openMarket, setOpenMarket] = React.useState<PublicMarket>(market);

  React.useEffect(() => {
    setOpenMarket(market);
  }, [market, game?.id]);

  if (!game) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="max-w-xs text-sm text-muted-foreground">
          {isLoading ? 'Loading the board…' : 'Pick a game to see tickets, money, and which way the number moved.'}
        </p>
      </div>
    );
  }

  const present = PUBLIC_MARKETS.filter((item) => game.markets[item]);
  const active = present.includes(openMarket) ? openMarket : present[0];
  const activeTickets = active ? game.markets[active]?.row.tickets : game.tickets;

  return (
    <div className="min-w-0 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-5">
      <div className="flex items-start gap-3">
        <TeamMarks away={game.away} home={game.home} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {SPORT_LABELS[game.sport]}
          </p>
          <h1 className="text-balance text-xl font-bold leading-tight tracking-tight text-foreground">
            {game.away.name} <span className="font-medium text-muted-foreground">@</span> {game.home.name}
          </h1>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {formatStart(game.startTime)}
            {activeTickets !== null && activeTickets !== undefined && (
              <span className="tabular-nums"> · {activeTickets.toLocaleString()} tickets</span>
            )}
          </p>
          <p className="mt-1 text-[12px] font-medium text-muted-foreground">
            Action Network · captured {formatCaptured(game.capturedAt)}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {present.map((item) => (
          <MarketBlock
            key={item}
            game={game}
            market={item}
            expanded={item === active}
            onToggle={() => setOpenMarket(item)}
          />
        ))}
      </div>

      <GlassCard radius={16} className="mt-4 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">👀 How to read this</p>
        <p className="mt-1.5 text-[13px] leading-snug text-foreground/90">
          🎟️ is the share of bets. 💵 is the share of dollars. The line between them is the gap,
          and ➡️ is the move from the open to the current number.
        </p>
      </GlassCard>
    </div>
  );
}

function MarketBlock({
  game,
  market,
  expanded,
  onToggle,
}: {
  game: PublicGame;
  market: PublicMarket;
  expanded: boolean;
  onToggle: () => void;
}) {
  const slot = game.markets[market];
  if (!slot) return null;
  const { read, row } = slot;
  const colors = sideColors(market, game.away, game.home);
  const confirmColor =
    read.moneyTiltSide === 'away' ? colors.away : read.moneyTiltSide === 'home' ? colors.home : colors.away;
  const arrowColor =
    read.movedToward === 'away' ? colors.away : read.movedToward === 'home' ? colors.home : 'currentColor';
  return (
    <GlassCard radius={16} className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-3 text-left"
      >
        <span className="text-[15px] leading-none" aria-hidden>
          {market === 'spread' ? '📐' : market === 'total' ? '🎯' : '💰'}
        </span>
        <span className="text-[14px] font-bold text-foreground">{MARKET_LABELS[market]}</span>
        <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="space-y-3 px-3 pb-3">
          {!read.excluded && read.emphasis !== 'none' && (
            <ProGate title="Market reads" minHeight={36}>
              <TierChip read={read} ringColor={read.category === 'sharp_money' ? confirmColor : undefined} />
            </ProGate>
          )}
          {read.excluded ? (
            <p className="text-[13px] text-muted-foreground">No usable split on this market.</p>
          ) : (
            <>
              <div
                className={cn('space-y-3', read.category === 'sharp_money' && 'rounded-2xl p-2')}
                style={read.category === 'sharp_money' ? { boxShadow: `inset 0 0 0 1px ${confirmColor}` } : undefined}
              >
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
                <LineMoveRail
                  market={market}
                  awayName={game.away.name}
                  homeName={game.home.name}
                  read={read}
                  color={read.category === 'sharp_money' ? confirmColor : arrowColor}
                />
              </div>
              {read.sentence && (
                <ProGate title="Market reads" minHeight={72}>
                  <p className="text-[13px] leading-snug text-foreground">{read.sentence}</p>
                </ProGate>
              )}
            </>
          )}
          {row.tickets !== null && (
            <p className="text-[11px] tabular-nums text-muted-foreground">
              🎟️ {row.tickets.toLocaleString()} tickets on this market
            </p>
          )}
        </div>
      )}
    </GlassCard>
  );
}
