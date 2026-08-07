import { cn } from '@/lib/utils';
import type { NflPropPlayerPage } from '../types';
import { kickoffShort } from '../format';

/** Compact hero — smaller ring, name + chips tight under it. */
export function OrbitHero({
  page,
  teamPrimary,
  teamSecondary,
}: {
  page: NflPropPlayerPage;
  teamPrimary: string;
  teamSecondary: string;
}) {
  const kick = kickoffShort(page.kickoff);
  const vsChip = kick ? `vs ${page.opponent} · ${kick}` : `vs ${page.opponent}`;

  return (
    <div className="relative z-10 flex flex-col items-center text-center">
      <div
        className="relative mb-3 h-[112px] w-[112px] rounded-full md:h-[128px] md:w-[128px]"
        style={{
          boxShadow: `0 0 0 2px ${teamSecondary}55, 0 0 28px ${teamPrimary}80, 0 0 56px ${teamPrimary}40`,
        }}
      >
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 210deg, ${teamPrimary}, ${teamSecondary}, ${teamPrimary})`,
            padding: 3,
            mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMask:
              'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
        <div className="absolute inset-[3px] overflow-hidden rounded-full bg-background/80">
          {page.headshot_url ? (
            <img
              src={page.headshot_url}
              alt={page.player_name}
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-muted-foreground">
              {page.player_name
                .split(' ')
                .map((p) => p[0])
                .join('')
                .slice(0, 2)}
            </div>
          )}
        </div>
      </div>

      <h1 className="text-xl font-black tracking-tight md:text-2xl">{page.player_name}</h1>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
        <Chip>
          {page.position} · {page.team}
        </Chip>
        <Chip>{vsChip}</Chip>
        <Chip tone={page.is_home ? 'home' : 'away'}>{page.is_home ? 'Home' : 'Away'}</Chip>
      </div>

      {page.game_label && (
        <p className="mt-1.5 max-w-sm text-[12px] text-muted-foreground">{page.game_label}</p>
      )}
    </div>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: 'home' | 'away';
}) {
  return (
    <span
      className={cn(
        'rounded-full border border-black/5 bg-white/70 px-2.5 py-1 text-[11px] font-bold backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.08]',
        tone === 'home' && 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300',
        tone === 'away' && 'border-sky-500/30 text-sky-700 dark:text-sky-300'
      )}
    >
      {children}
    </span>
  );
}
