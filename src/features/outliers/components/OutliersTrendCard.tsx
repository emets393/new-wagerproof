// Web port of the iOS OutliersTrendCard
// (wagerproof-ios-native/Wagerproof/Features/Outliers/Components/OutliersTrendCard.swift).
// Fixed 300x240 compact carousel card; click opens a dialog with the full
// breakdown (all rows + all betting lines) — the web stand-in for the iOS
// detail bottom sheet.
import { useState } from 'react';
import {
  Circle,
  Globe,
  Home,
  Moon,
  PawPrint,
  Plane,
  PlusCircle,
  Star,
  Sun,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  getCFBTeamColors,
  getCFBTeamInitials,
  getMLBTeamColors,
  getNFLTeamColors,
} from '@/utils/teamColors';
import { espnMlb500LogoUrlFromAbbrev } from '@/utils/mlbTeamLogos';
import type {
  OutliersTrendsBettingLine,
  OutliersTrendsCard as TrendCardModel,
  OutliersTrendsCardRow,
  OutliersTrendsGame,
  OutliersTrendsSport,
} from '../types';

const NFL_SHIELD_URL = 'https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png';

/** Compact cards show at most this many rows; the rest preview as footer % chips. */
const COMPACT_ROW_CAP = 3;
const FOOTER_PREVIEW_CAP = 3;

// Trend-card team keys are NFL abbreviations, but teamColors.ts keys off city
// names — bridge here (ESPN slug rides along for the logo URL).
const NFL_ABBR_META: Record<string, { name: string; slug: string }> = {
  ARI: { name: 'Arizona', slug: 'ari' },
  ATL: { name: 'Atlanta', slug: 'atl' },
  BAL: { name: 'Baltimore', slug: 'bal' },
  BUF: { name: 'Buffalo', slug: 'buf' },
  CAR: { name: 'Carolina', slug: 'car' },
  CHI: { name: 'Chicago', slug: 'chi' },
  CIN: { name: 'Cincinnati', slug: 'cin' },
  CLE: { name: 'Cleveland', slug: 'cle' },
  DAL: { name: 'Dallas', slug: 'dal' },
  DEN: { name: 'Denver', slug: 'den' },
  DET: { name: 'Detroit', slug: 'det' },
  GB: { name: 'Green Bay', slug: 'gb' },
  HOU: { name: 'Houston', slug: 'hou' },
  IND: { name: 'Indianapolis', slug: 'ind' },
  JAX: { name: 'Jacksonville', slug: 'jax' },
  JAC: { name: 'Jacksonville', slug: 'jax' },
  KC: { name: 'Kansas City', slug: 'kc' },
  LV: { name: 'Las Vegas', slug: 'lv' },
  LAC: { name: 'LA Chargers', slug: 'lac' },
  LA: { name: 'LA Rams', slug: 'lar' },
  LAR: { name: 'LA Rams', slug: 'lar' },
  MIA: { name: 'Miami', slug: 'mia' },
  MIN: { name: 'Minnesota', slug: 'min' },
  NE: { name: 'New England', slug: 'ne' },
  NO: { name: 'New Orleans', slug: 'no' },
  NYG: { name: 'NY Giants', slug: 'nyg' },
  NYJ: { name: 'NY Jets', slug: 'nyj' },
  PHI: { name: 'Philadelphia', slug: 'phi' },
  PIT: { name: 'Pittsburgh', slug: 'pit' },
  SF: { name: 'San Francisco', slug: 'sf' },
  SEA: { name: 'Seattle', slug: 'sea' },
  TB: { name: 'Tampa Bay', slug: 'tb' },
  TEN: { name: 'Tennessee', slug: 'ten' },
  WAS: { name: 'Washington', slug: 'wsh' },
  WSH: { name: 'Washington', slug: 'wsh' },
};

// MARK: - Heat colors (iOS trendColor)

function heatColor(pct: number): string | null {
  if (pct > 0.75) return '#22C55E';
  if (pct >= 0.6) return '#F59E0B';
  return null;
}

function heatBg(pct: number): string {
  const color = heatColor(pct);
  if (color === '#22C55E') return 'rgba(34,197,94,0.14)';
  if (color === '#F59E0B') return 'rgba(245,158,11,0.14)';
  return 'rgba(128,128,128,0.14)';
}

// MARK: - Row text / dimension parsing (iOS rowDisplayText + trendDimension)

function rowDisplayText(text: string): string {
  return text.replace(/ \(\d{1,3}%\)$/, '');
}

/** "Lost 10 of last 10 road games (100%)" -> "road games" ("" when unstructured). */
function trendDimension(text: string): string {
  const lower = text.toLowerCase();
  const marker = ' of last ';
  const idx = lower.indexOf(marker);
  if (idx === -1) return '';
  let context = lower.slice(idx + marker.length).trim();
  const paren = context.lastIndexOf('(');
  if (paren !== -1) context = context.slice(0, paren).trim();
  // Drop the leading sample-count token ("10 road games" -> "road games").
  const parts = context.split(/\s+/);
  if (parts.length > 0 && /^\d+$/.test(parts[0])) {
    context = parts.slice(1).join(' ');
  }
  return context.trim();
}

function RowIcon({ text, pct }: { text: string; pct: number }) {
  const color = heatColor(pct) ?? undefined;
  const cls = cn('h-3.5 w-3.5 shrink-0', !color && 'text-muted-foreground');
  const style = color ? { color } : undefined;
  const dim = trendDimension(text);

  const seriesMatch = dim.match(/series g(\d)/);
  if (seriesMatch) {
    return (
      <span
        className={cn(
          'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-current text-[8px] font-black leading-none',
          !color && 'text-muted-foreground'
        )}
        style={style}
      >
        {seriesMatch[1]}
      </span>
    );
  }

  // Order matters: "non-" negations before their base; home/road before the
  // generic fallback. Mirrors the iOS rowIcon(for:) branch order.
  let Icon = Circle;
  if (dim.startsWith('non-division')) Icon = Globe;
  else if (dim.startsWith('non-primetime')) Icon = Sun;
  else if (dim.includes('road') || dim === 'away' || dim.startsWith('away ')) Icon = Plane;
  else if (dim.includes('home')) Icon = Home;
  else if (dim.includes('underdog')) Icon = PawPrint;
  else if (dim.includes('favorite') || dim.includes('favourite')) Icon = Star;
  else if (dim.includes('division')) Icon = Users;
  else if (dim.includes('primetime') || dim.includes('night')) Icon = Moon;
  else if (dim.includes('day game')) Icon = Sun;
  else if (dim.startsWith('vs')) Icon = Users;

  if (Icon === Circle) {
    // Fallback (incl. generic "games"): small filled dot, like the iOS bullet.
    return (
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
        <Circle className={cn('h-1.5 w-1.5 fill-current', !color && 'text-muted-foreground')} style={style} />
      </span>
    );
  }
  return <Icon className={cls} style={style} />;
}

// MARK: - Kickoff formatting (date over time, ET)

function kickoffParts(kickoff: string | null | undefined): { date: string; time: string } | null {
  if (!kickoff) return null;
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return null;
  try {
    const dateText = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
      month: 'numeric',
      day: 'numeric',
    })
      .format(date)
      .replace(',', '');
    const timeText = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
    return { date: dateText, time: timeText };
  } catch {
    return null;
  }
}

// MARK: - Avatar

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
}

function teamVisuals(
  sport: OutliersTrendsSport,
  teamKey: string,
): { colors: { primary: string; secondary: string }; initials: string; logoUrl: string | null } {
  if (sport === 'ncaaf') {
    // CFB team keys are full team names (no abbreviations in the slate table).
    return {
      colors: getCFBTeamColors(teamKey),
      initials: getCFBTeamInitials(teamKey),
      logoUrl: null,
    };
  }
  if (sport === 'mlb') {
    return {
      colors: getMLBTeamColors(teamKey),
      initials: teamKey.toUpperCase().slice(0, 3),
      logoUrl: espnMlb500LogoUrlFromAbbrev(teamKey),
    };
  }
  const meta = NFL_ABBR_META[teamKey.toUpperCase()];
  return {
    colors: meta ? getNFLTeamColors(meta.name) : { primary: '#6B7280', secondary: '#9CA3AF' },
    initials: teamKey.toUpperCase().slice(0, 3),
    logoUrl: meta ? `https://a.espncdn.com/i/teamlogos/nfl/500/${meta.slug}.png` : null,
  };
}

function LogoImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

function SubjectAvatar({
  card,
  sport,
  size = 36,
}: {
  card: TrendCardModel;
  sport: OutliersTrendsSport;
  size?: number;
}) {
  if (card.subjectKind === 'referee') {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full bg-green-500/[0.12] p-1.5"
        style={{ width: size, height: size }}
      >
        <LogoImage src={NFL_SHIELD_URL} alt="NFL" className="h-full w-full object-contain" />
      </div>
    );
  }

  if (card.subjectKind === 'player') {
    // Initials underneath; headshot layers on top and self-hides on load error.
    return (
      <div
        className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted"
        style={{ width: size, height: size }}
      >
        <span className="text-[11px] font-bold text-muted-foreground">
          {initialsFrom(card.subjectName)}
        </span>
        {card.headshotUrl && (
          <LogoImage
            src={card.headshotUrl}
            alt={card.subjectName}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </div>
    );
  }

  // Team + coach: tinted team-color disc with logo (when resolvable) over initials.
  const teamKey = card.teamAbbr ?? card.subjectName;
  const { colors, initials, logoUrl } = teamVisuals(sport, teamKey);
  return (
    <div
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
      }}
    >
      <span className="text-[11px] font-bold text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.35)]">
        {initials}
      </span>
      {logoUrl && (
        <LogoImage
          src={logoUrl}
          alt={teamKey}
          className="absolute inset-0 h-full w-full object-contain p-1"
        />
      )}
    </div>
  );
}

// MARK: - Betting line chips

function BettingLineChip({
  line,
  showBookName,
}: {
  line: OutliersTrendsBettingLine;
  showBookName: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-muted/35 p-2">
      <div className="min-w-0 flex-1">
        {line.label && (
          <div className="truncate text-[9px] font-bold uppercase leading-tight text-muted-foreground">
            {line.label}
          </div>
        )}
        <div className="flex items-baseline gap-1">
          <span className="truncate text-xs font-bold text-foreground">{line.lineText}</span>
          {line.oddsText && (
            <span className="text-xs font-semibold text-primary">{line.oddsText}</span>
          )}
        </div>
      </div>
      {showBookName && line.bookName && (
        <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
          @ {line.bookName}
        </span>
      )}
    </div>
  );
}

function BettingLinesBlock({ lines, compact }: { lines: OutliersTrendsBettingLine[]; compact: boolean }) {
  if (lines.length === 0) return null;
  const visible = compact ? lines.slice(0, 2) : lines;
  if (visible.length >= 2) {
    return (
      <div className={cn('flex gap-1.5', !compact && 'flex-wrap')}>
        {visible.map((line) => (
          <BettingLineChip key={line.id} line={line} showBookName={false} />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {visible.map((line) => (
        <BettingLineChip key={line.id} line={line} showBookName />
      ))}
    </div>
  );
}

// MARK: - Trend rows

function TrendRow({ row, compact }: { row: OutliersTrendsCardRow; compact: boolean }) {
  const color = heatColor(row.dominantPct) ?? undefined;
  return (
    <div className="flex items-start gap-1.5">
      <span className="mt-px">
        <RowIcon text={row.text} pct={row.dominantPct} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-xs font-medium text-muted-foreground', compact && 'truncate')}>
          {rowDisplayText(row.text)}
        </p>
        {!compact && row.coverageNote && (
          <p className="text-[10px] text-muted-foreground/70">{row.coverageNote}</p>
        )}
      </div>
      <span
        className={cn('font-mono text-xs font-black tabular-nums', !color && 'text-muted-foreground')}
        style={color ? { color } : undefined}
      >
        {Math.round(row.dominantPct * 100)}%
      </span>
    </div>
  );
}

// MARK: - Subject detail suppression (iOS displaySubjectDetail)

function displaySubjectDetail(card: TrendCardModel): string | null {
  const detail = card.subjectDetail;
  if (!detail) return null;
  if (detail.toLowerCase().includes('career games')) return null;
  if (card.subjectKind === 'team') return null;
  if (card.subjectKind === 'coach' && card.teamAbbr) {
    const abbr = card.teamAbbr.toUpperCase();
    const upper = detail.toUpperCase();
    if (upper === abbr || upper.startsWith(`${abbr} ·`)) return null;
  }
  return detail;
}

// MARK: - Card

interface OutliersTrendCardProps {
  card: TrendCardModel;
  sport: OutliersTrendsSport;
  game?: OutliersTrendsGame;
}

export function OutliersTrendCard({ card, sport, game }: OutliersTrendCardProps) {
  const [expanded, setExpanded] = useState(false);

  const visibleRows = card.rows.slice(0, COMPACT_ROW_CAP);
  const hiddenRows = card.rows.slice(COMPACT_ROW_CAP);
  const previewRows = hiddenRows.slice(0, FOOTER_PREVIEW_CAP);
  const overflowCount = Math.max(0, hiddenRows.length - FOOTER_PREVIEW_CAP);
  const detail = displaySubjectDetail(card);
  const kickoff = kickoffParts(game?.kickoff);

  return (
    <>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={cn(
          'flex h-[240px] w-[300px] shrink-0 flex-col gap-[9px] rounded-2xl p-3 text-left',
          'border border-black/5 bg-[#F8FAFC] transition-colors hover:border-black/10',
          'dark:border-white/10 dark:bg-[#141414] dark:hover:border-white/20'
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <SubjectAvatar card={card} sport={sport} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold text-foreground">
              {card.subjectName} — {card.betTypeLabel}
            </p>
            {detail && <p className="truncate text-[11px] font-medium text-muted-foreground">{detail}</p>}
            <p className="truncate text-xs font-bold text-muted-foreground">{card.matchupLabel}</p>
          </div>
          {kickoff && (
            <div className="shrink-0 text-right text-[10px] font-semibold leading-tight text-muted-foreground">
              <div>{kickoff.date}</div>
              <div>{kickoff.time}</div>
            </div>
          )}
        </div>

        <BettingLinesBlock lines={card.bettingLines} compact />

        <div className="flex flex-col gap-1.5">
          {visibleRows.map((row) => (
            <TrendRow key={row.id} row={row} compact />
          ))}
        </div>

        {/* Footer pinned to the bottom of the fixed-height card */}
        <div className="mt-auto flex flex-col gap-1.5">
          <div className="h-px bg-black/5 dark:bg-white/10" />
          <div className="flex items-center gap-1.5">
            {previewRows.length > 0 ? (
              <>
                <PlusCircle className="h-3.5 w-3.5 shrink-0 text-primary" />
                {previewRows.map((row) => {
                  const color = heatColor(row.dominantPct) ?? undefined;
                  return (
                    <span
                      key={row.id}
                      className={cn(
                        'flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-black tabular-nums',
                        !color && 'text-muted-foreground'
                      )}
                      style={{ backgroundColor: heatBg(row.dominantPct), color }}
                    >
                      {Math.round(row.dominantPct * 100)}%
                    </span>
                  );
                })}
                {overflowCount > 0 && (
                  <span className="text-[10px] font-extrabold text-muted-foreground">+{overflowCount}</span>
                )}
                <span className="flex-1" />
                <span className="shrink-0 text-[11px] font-bold text-primary">More ›</span>
              </>
            ) : (
              <>
                <span className="flex-1" />
                <span className="shrink-0 text-[11px] font-bold text-primary">View breakdown ›</span>
              </>
            )}
          </div>
        </div>
      </button>

      {/* Full breakdown dialog — every trend row and betting line, no caps */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <SubjectAvatar card={card} sport={sport} size={40} />
              <div className="min-w-0 flex-1 text-left">
                <DialogTitle className="text-base font-extrabold">
                  {card.subjectName} — {card.betTypeLabel}
                </DialogTitle>
                <DialogDescription className="text-xs font-semibold">
                  {detail ? `${detail} · ` : ''}
                  {card.matchupLabel}
                  {kickoff ? ` · ${kickoff.date} ${kickoff.time}` : ''}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <BettingLinesBlock lines={card.bettingLines} compact={false} />
            <div className="flex flex-col gap-2">
              {card.rows.map((row) => (
                <TrendRow key={row.id} row={row} compact={false} />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
