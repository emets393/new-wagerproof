import * as React from 'react';
import { cn } from '@/lib/utils';
import { PickResult, Sport } from '@/types/agent';
import {
  getNFLTeamColors,
  getCFBTeamColors,
  getNBATeamColors,
  getNCAABTeamColors,
  getMLBTeamColors,
} from '@/utils/teamColors';
import { espnMlb500LogoUrlFromAbbrev } from '@/utils/mlbTeamLogos';
import { getNFLTeamLogo } from '@/features/games/api/nflGames';

// =====================================================================
// Web port of the iOS AgentPickTicket "boarding-pass" cardstock
// (wagerproof-ios-native/.../Agents/Components/AgentPickTicket.swift):
// a dark navy card with a perforated tear line — circular notches punched
// into both edges (real holes, via a CSS mask, so the surface shows
// through) plus a dashed rule. Shared by AgentPickCard + AgentParlayCard.
// =====================================================================

const NOTCH_RADIUS = 9;

/** Cardstock gradient — matches the iOS ticket fill (Color(hex: 0x141927→0x0D101A)). */
export const TICKET_TOP = '#141927';
export const TICKET_BOTTOM = '#0D101A';

interface AgentTicketShellProps {
  /** Y (px from the top) of the perforation line + edge notches. */
  tear: number;
  onClick?: () => void;
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * The boarding-pass cardstock. Cuts two edge notches at `tear` with a
 * two-layer radial-gradient mask (`mask-composite: intersect` keeps the
 * card opaque everywhere except the union of the two notch circles), and
 * draws the dashed tear line at the same Y.
 */
export function AgentTicketShell({
  tear,
  onClick,
  interactive,
  className,
  children,
}: AgentTicketShellProps) {
  const notch = `radial-gradient(circle ${NOTCH_RADIUS}px at %X% ${tear}px, transparent ${NOTCH_RADIUS}px, #000 ${NOTCH_RADIUS + 0.5}px)`;
  const maskImage = `${notch.replace('%X%', '0')}, ${notch.replace('%X%', '100')}`;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        'agent-ticket relative overflow-hidden rounded-[22px] bg-gradient-to-b from-[#fffdf8] to-[#f3efe5] text-left text-slate-950 shadow-[0_8px_24px_rgba(50,42,28,0.12),0_1px_3px_rgba(50,42,28,0.10)] dark:from-[#141927] dark:to-[#0D101A] dark:text-white dark:shadow-[0_4px_14px_rgba(0,0,0,0.28)]',
        interactive && 'cursor-pointer transition-transform duration-200 hover:scale-[1.005] active:scale-[0.995]',
        className,
      )}
      style={{
        WebkitMaskImage: maskImage,
        maskImage,
        WebkitMaskComposite: 'source-in',
        maskComposite: 'intersect',
      }}
    >
      {/* Hairline top-lit rim (the iOS ticket's .strokeBorder(.white.opacity(0.07))). */}
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[22px] border border-stone-300/80 dark:border-white/[0.07]" />
      {/* Dashed perforation across the tear line. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[18px] right-[18px] border-t border-dashed border-stone-400/50 dark:border-white/15"
        style={{ top: tear }}
      />
      {children}
    </div>
  );
}

/** Measures a top section's height so the tear/notches land on its bottom edge. */
export function useTicketTear(fallback: number) {
  const topRef = React.useRef<HTMLDivElement>(null);
  const [tear, setTear] = React.useState(fallback);

  React.useLayoutEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const measure = () => setTear(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { topRef, tear };
}

// ---------------------------------------------------------------------
// Status (WIN / LOSS / PUSH / PENDING) — parity with AgentPick.ticketStatus.
// ---------------------------------------------------------------------

export const TICKET_STATUS: Record<PickResult, { text: string; color: string }> = {
  won: { text: 'WIN', color: '#22C55E' },
  lost: { text: 'LOSS', color: '#EF4444' },
  push: { text: 'PUSH', color: '#EAB308' },
  pending: { text: 'PENDING', color: '#94A3B8' },
};

export function TicketStatusPill({ result }: { result: PickResult }) {
  const status = TICKET_STATUS[result];
  return (
    <span
      className="rounded-lg px-2 py-1 text-[11px] font-black uppercase tracking-wide"
      style={{ color: status.color, backgroundColor: `${status.color}29` }}
    >
      {status.text}
    </span>
  );
}

/** One market/odds/units "stamp" in the ticket stub. */
export function TicketStamp({
  label,
  value,
  align = 'left',
  tint,
}: {
  label: string;
  value: string;
  align?: 'left' | 'center' | 'right';
  tint?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-0.5',
        align === 'center' && 'items-center text-center',
        align === 'right' && 'items-end text-right',
      )}
    >
      <span className="text-[12px] font-medium text-slate-500 dark:text-white/45">{label}</span>
      <span
        className="truncate font-mono text-[17px] font-semibold text-slate-900 dark:text-slate-100"
        style={tint ? { color: tint } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

/** 5-dot confidence meter; filled dots use the agent accent. */
export function TicketConfidence({ confidence, accent }: { confidence: number; accent: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-white/45">Confidence</span>
      <div className="flex items-center gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="h-[7px] w-[7px] rounded-full bg-stone-300 dark:bg-white/15"
            style={i < confidence ? { backgroundColor: accent } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Sport glyph + team identity (colors/abbrev) used by the route row.
// ---------------------------------------------------------------------

/** Lightweight line glyphs for ticket sport identity. Deliberately SVG—not
 * emoji—so shape, color, and rendering stay consistent across platforms. */
export function TicketSportIcon({ sport, className }: { sport: Sport; className?: string }) {
  if (sport === 'nfl' || sport === 'cfb') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden><path d="M4.5 15.5c-2.2-2.2.8-7.8 4-11 3.2-3.2 8.8-6.2 11-4 2.2 2.2-.8 7.8-4 11-3.2 3.2-8.8 6.2-11 4Z" transform="translate(0 4) scale(.82)"/><path d="m9 10 5 5m-3.8-6.2 5 5M12 9.8l-2 2m4.2.2-2 2"/></svg>;
  }
  if (sport === 'nba' || sport === 'ncaab') {
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden><circle cx="12" cy="12" r="9"/><path d="M3.5 9.5c5.8.2 10.8 4.2 13 9.3M20.5 14.5C14.7 14.3 9.7 10.3 7.5 5M12 3c-2.2 5.3-2.2 12.7 0 18"/></svg>;
  }
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden><circle cx="12" cy="12" r="9"/><path d="M8.2 4.1c1.2 2.2 1.2 4.4 0 6.2S7 14.4 8.2 19.9M15.8 4.1c-1.2 2.2-1.2 4.4 0 6.2s1.2 4.1 0 9.6"/><path d="m7.5 7 1.8.8m-2 2.2 1.8.8m7.4-3.8-1.8.8m2 2.2-1.8.8"/></svg>;
}

/** Team brand color pair from the same registries the game cards use. */
export function teamColorPair(name: string, sport: Sport, mlbAbbr?: string): { primary: string; secondary: string } {
  switch (sport) {
    case 'nfl':
      return getNFLTeamColors(name);
    case 'cfb':
      return getCFBTeamColors(name);
    case 'nba':
      return getNBATeamColors(name);
    case 'ncaab':
      return getNCAABTeamColors(name);
    case 'mlb':
      return getMLBTeamColors(mlbAbbr ?? name);
    default:
      return { primary: '#1F2937', secondary: '#6B7280' };
  }
}

// NBA tricodes whose ESPN logo slug differs from the lowercased tricode.
const NBA_ESPN_SLUG: Record<string, string> = {
  GSW: 'gs',
  NOP: 'no',
  NYK: 'ny',
  SAS: 'sa',
  UTA: 'utah',
  WAS: 'wsh',
};

/**
 * ESPN logo URL for a team where we can resolve one synchronously — MLB and NBA
 * (by abbrev) and NFL (by city name, with a nickname-strip retry). Broken URLs
 * fall back to the initials disc via the <img> onError. CFB/NCAAB return null
 * (ESPN college logos are keyed by numeric team id, which we can't derive from
 * a name here) and render the initials disc.
 */
export function resolveTicketLogo(name: string, sport: Sport, abbr: string): string | null {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  if (sport === 'mlb') return espnMlb500LogoUrlFromAbbrev(abbr);
  if (sport === 'nba') {
    const code = abbr.trim().toUpperCase();
    const slug = NBA_ESPN_SLUG[code] ?? code.toLowerCase();
    return `https://a.espncdn.com/i/teamlogos/nba/500/${slug}.png`;
  }
  if (sport === 'nfl') {
    const direct = getNFLTeamLogo(trimmed);
    if (direct && direct !== '/placeholder.svg') return direct;
    // LOGO_MAP is keyed by city — drop the nickname (last word) and retry so
    // "Kansas City Chiefs" still resolves via "Kansas City".
    const words = trimmed.split(/\s+/);
    if (words.length > 1) {
      const cityLogo = getNFLTeamLogo(words.slice(0, -1).join(' '));
      if (cityLogo && cityLogo !== '/placeholder.svg') return cityLogo;
    }
  }
  return null;
}

/** A team avatar disc for the ticket route row: the real ESPN logo on a light
 *  plate when available (falls back on 404), else the abbreviation over a
 *  team-colored gradient — the flat (non-glass) avatar the iOS ticket uses. */
export function TicketTeamDisc({
  code,
  primary,
  secondary,
  logoUrl,
  size = 34,
}: {
  code: string;
  primary: string;
  secondary: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = React.useState(false);
  const showLogo = !!logoUrl && !failed;

  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
      style={{
        width: size,
        height: size,
        background: showLogo
          ? `radial-gradient(circle at 35% 30%, ${primary}45, transparent 76%), rgba(255,255,255,0.07)`
          : `linear-gradient(135deg, ${primary}, ${secondary})`,
        border: `1.5px solid ${primary}55`,
      }}
    >
      {showLogo ? (
        <img
          src={logoUrl as string}
          alt={code}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-[72%] w-[72%] object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
        />
      ) : (
        <span className="font-extrabold text-white" style={{ fontSize: size * 0.32 }}>
          {code}
        </span>
      )}
    </span>
  );
}
