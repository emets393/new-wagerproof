// Web port of the iOS OutliersTrendCard
// (wagerproof-ios-native/Wagerproof/Features/Outliers/Components/OutliersTrendCard.swift).
// Fixed 300x240 compact carousel card; click opens a dialog with the full
// breakdown (all rows + all betting lines) — the web stand-in for the iOS
// detail bottom sheet.
import { useEffect, useState } from 'react';
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
import { NFL_SHIELD_URL, initialsFrom, teamVisuals } from '../teamVisuals';
import type {
  OutliersTrendsBettingLine,
  OutliersTrendsCard as TrendCardModel,
  OutliersTrendsCardRow,
  OutliersTrendsGame,
  OutliersTrendsSport,
} from '../types';

/** Compact cards show at most this many rows; the rest preview as footer % chips. */
const COMPACT_ROW_CAP = 3;
const FOOTER_PREVIEW_CAP = 3;

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
  const [imageFailed, setImageFailed] = useState(false);
  const imageKey =
    card.subjectKind === 'player'
      ? card.headshotUrl ?? card.subjectName
      : `${card.teamAbbr ?? card.subjectName}-${sport}`;

  useEffect(() => {
    setImageFailed(false);
  }, [imageKey]);

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
    const showHeadshot = Boolean(card.headshotUrl) && !imageFailed;
    return (
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted"
        style={{ width: size, height: size }}
      >
        {showHeadshot ? (
          <img
            src={card.headshotUrl as string}
            alt={card.subjectName}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span className="text-[11px] font-bold text-muted-foreground">
            {initialsFrom(card.subjectName)}
          </span>
        )}
      </div>
    );
  }

  // Team + coach: show the real logo when available; initials only as fallback.
  const teamKey = card.teamAbbr ?? card.subjectName;
  const { colors, initials, logoUrl } = teamVisuals(sport, teamKey);
  const showLogo = Boolean(logoUrl) && !imageFailed;

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: showLogo
          ? 'hsl(var(--background))'
          : `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
      }}
    >
      {showLogo ? (
        <img
          src={logoUrl as string}
          alt={teamKey}
          loading="lazy"
          className="h-full w-full object-contain p-1"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="text-[11px] font-bold text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.35)]">
          {initials}
        </span>
      )}
    </div>
  );
}

// MARK: - Book mark + top-right odds chip (Linemate "-186 [DK]")

function BookMark({ line, size = 12 }: { line: OutliersTrendsBettingLine; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (line.bookLogoUrl && !failed) {
    return (
      <img
        src={line.bookLogoUrl}
        alt={line.bookName ?? 'Sportsbook'}
        loading="lazy"
        className="shrink-0 rounded-[3px] object-contain"
        style={{ width: size, height: size }}
        onError={() => setFailed(true)}
      />
    );
  }
  if (line.bookName) {
    return (
      <span className="shrink-0 text-[9px] font-bold uppercase leading-none text-muted-foreground">
        {line.bookName.slice(0, 3)}
      </span>
    );
  }
  return null;
}

/** The primary line's odds + book mark, hoisted into the card header. */
function OddsChip({ line }: { line: OutliersTrendsBettingLine }) {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5">
      <BookMark line={line} />
      <span className="font-mono text-xs font-black tabular-nums text-primary">{line.oddsText}</span>
    </span>
  );
}

// MARK: - Betting line chips

function BettingLineChip({
  line,
  showBookName,
  hideOdds,
}: {
  line: OutliersTrendsBettingLine;
  showBookName: boolean;
  hideOdds: boolean;
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
          {!hideOdds && line.oddsText && (
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

function BettingLinesBlock({
  lines,
  compact,
  hideOdds = false,
}: {
  lines: OutliersTrendsBettingLine[];
  compact: boolean;
  // When the header shows the primary odds chip, inline chips drop odds to avoid
  // showing the same "-110" twice (spec §8) — line text carries the info.
  hideOdds?: boolean;
}) {
  if (lines.length === 0) return null;
  const visible = compact ? lines.slice(0, 2) : lines;
  if (visible.length >= 2) {
    return (
      <div className={cn('flex gap-1.5', !compact && 'flex-wrap')}>
        {visible.map((line) => (
          <BettingLineChip key={line.id} line={line} showBookName={false} hideOdds={hideOdds} />
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {visible.map((line) => (
        <BettingLineChip key={line.id} line={line} showBookName hideOdds={hideOdds} />
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
        <p className={cn('text-xs font-medium leading-tight text-muted-foreground', compact && 'truncate')}>
          {rowDisplayText(row.text)}
        </p>
        {!compact && row.coverageNote && (
          <p className="text-[10px] leading-tight text-muted-foreground/70">{row.coverageNote}</p>
        )}
      </div>
      {/* Fixed-min right column so percentages align vertically across rows. */}
      <span
        className={cn(
          'ml-auto min-w-[2.5rem] shrink-0 text-right font-mono text-xs font-black tabular-nums',
          !color && 'text-muted-foreground',
        )}
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
  // Primary line's odds ride top-right as a book-marked chip (Linemate "-186 [DK]");
  // when present, the inline line chips drop odds to avoid duplication.
  const primaryLine = card.bettingLines.find((l) => Boolean(l.oddsText)) ?? null;

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
          {(primaryLine || kickoff) && (
            <div className="flex shrink-0 flex-col items-end gap-1">
              {primaryLine && <OddsChip line={primaryLine} />}
              {kickoff && (
                <div className="text-[10px] font-semibold leading-tight text-muted-foreground">
                  {kickoff.date} · {kickoff.time}
                </div>
              )}
            </div>
          )}
        </div>

        <BettingLinesBlock lines={card.bettingLines} compact hideOdds={Boolean(primaryLine)} />

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
