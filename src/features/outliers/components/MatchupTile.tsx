// One Today's Matchups tile: away logo · time · home logo, the whole thing a
// deep-link into the unified /games page. Each side carries a soft radial glow
// in that team's primary color so the grid reads as a wall of matchups at a
// glance. See specs/outliers_spec.md §4d.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface MatchupTileData {
  key: string;
  href: string;
  awayAbbr: string;
  homeAbbr: string;
  awayLogoUrl: string | null;
  homeLogoUrl: string | null;
  awayColors: { primary: string; secondary: string };
  homeColors: { primary: string; secondary: string };
  awayInitials: string;
  homeInitials: string;
  /** "Today" or a weekday abbreviation. */
  dayLabel: string;
  /** "5:40 PM" (ET). */
  timeLabel: string;
  /** League tag, shown only when the grid spans more than one sport. */
  sportLabel?: string;
  /** Kickoff/first-pitch epoch ms, for ordering a merged multi-sport slate. */
  startMs: number | null;
}

function TeamMark({
  logoUrl,
  initials,
  colors,
  label,
}: {
  logoUrl: string | null;
  initials: string;
  colors: { primary: string; secondary: string };
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(logoUrl) && !failed;
  useEffect(() => {
    setFailed(false);
  }, [logoUrl]);

  return (
    <div className="relative flex min-w-0 flex-col items-center gap-1">
      <div
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full"
        style={{
          background: showLogo
            ? 'hsl(var(--background))'
            : `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
        }}
      >
        {showLogo ? (
          <img
            src={logoUrl as string}
            alt={label}
            loading="lazy"
            className="h-full w-full object-contain p-0.5"
            onError={() => setFailed(true)}
          />
        ) : (
          <span className="text-[11px] font-bold text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.35)]">
            {initials}
          </span>
        )}
      </div>
      <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
    </div>
  );
}

/** Team-colored wash anchored to one edge, sitting under the tile content. */
function EdgeGlow({ color, side }: { color: string; side: 'left' | 'right' }) {
  const anchor = side === 'left' ? '0%' : '100%';
  return (
    <span
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-y-0 w-3/5 opacity-20 transition-opacity duration-200',
        'group-hover:opacity-40 dark:opacity-30 dark:group-hover:opacity-50',
        side === 'left' ? 'left-0' : 'right-0',
      )}
      style={{
        background: `radial-gradient(125% 100% at ${anchor} 50%, ${color} 0%, transparent 72%)`,
      }}
    />
  );
}

export function MatchupTile({ data }: { data: MatchupTileData }) {
  return (
    <Link
      to={data.href}
      className={cn(
        'group relative flex h-[92px] items-center justify-between overflow-hidden rounded-2xl px-4',
        'border border-black/5 bg-[#F8FAFC] transition-colors hover:border-black/10',
        'dark:border-white/10 dark:bg-[#141414] dark:hover:border-white/20',
      )}
    >
      <EdgeGlow color={data.awayColors.primary} side="left" />
      <EdgeGlow color={data.homeColors.primary} side="right" />

      <TeamMark
        logoUrl={data.awayLogoUrl}
        initials={data.awayInitials}
        colors={data.awayColors}
        label={data.awayAbbr}
      />
      <div className="relative flex flex-col items-center px-1 text-center">
        {data.sportLabel && (
          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground/70">
            {data.sportLabel}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground">{data.dayLabel}</span>
        <span className="text-xs font-semibold text-foreground">{data.timeLabel}</span>
      </div>
      <TeamMark
        logoUrl={data.homeLogoUrl}
        initials={data.homeInitials}
        colors={data.homeColors}
        label={data.homeAbbr}
      />
    </Link>
  );
}
