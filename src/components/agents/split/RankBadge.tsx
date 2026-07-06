import { Medal, Trophy } from 'lucide-react';

const TOP_COLORS: Record<number, string> = {
  1: '#FFD700',
  2: '#C0C0C0',
  3: '#CD7F32',
};

/** Leaderboard rank: gold/silver/bronze icon with a glow halo, number for 4+. */
export function RankBadge({ rank }: { rank: number }) {
  const color = TOP_COLORS[rank];

  if (!color) {
    return (
      <span className="grid w-7 shrink-0 place-items-center font-mono text-xs font-bold text-muted-foreground">
        {rank}
      </span>
    );
  }

  const Icon = rank === 1 ? Trophy : Medal;
  return (
    <span
      className="grid w-7 shrink-0 place-items-center"
      style={{ filter: `drop-shadow(0 0 6px ${color}66)` }}
    >
      <Icon className="h-[18px] w-[18px]" style={{ color }} />
    </span>
  );
}
