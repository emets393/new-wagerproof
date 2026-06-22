import { ChevronDown, Lock, Sparkles, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { StarButton } from '@/components/StarButton';
import { HighValueBadge } from '@/components/HighValueBadge';

type ConvictionSummary = {
  card?: string;
  conviction?: string;
  mammoth?: boolean;
};

type CFBDryRunSlateCardContentProps = {
  prediction: any;
  isLocked: boolean;
  adminModeEnabled: boolean;
  highValueBadge?: any;
  awayTeamColors: { primary: string; secondary: string };
  homeTeamColors: { primary: string; secondary: string };
  onOpenDetails: () => void;
  onOpenPayload: () => void;
};

const formatSpread = (spread: number | null | undefined): string => {
  if (spread === null || spread === undefined || Number.isNaN(Number(spread))) return '-';
  const value = Number(spread);
  return value > 0 ? `+${value}` : String(value);
};

const formatMoneyline = (ml: number | null | undefined): string => {
  if (ml === null || ml === undefined || Number.isNaN(Number(ml))) return '-';
  const value = Number(ml);
  return value > 0 ? `+${value}` : String(value);
};

const formatTotal = (total: number | null | undefined): string => {
  if (total === null || total === undefined || Number.isNaN(Number(total))) return '-';
  return Number.isInteger(Number(total)) ? String(total) : Number(total).toFixed(1);
};

const formatKickoff = (kickoff?: string | null): { date: string; time: string } => {
  if (!kickoff) return { date: 'TBD', time: 'TBD' };
  const date = new Date(kickoff);
  if (Number.isNaN(date.getTime())) return { date: 'TBD', time: 'TBD' };
  return {
    date: date.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }).toUpperCase(),
    time: `${date.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })} ET`,
  };
};

const convictionLabel = (entry: ConvictionSummary): string => {
  const market = (entry.card || '').replace(/_/g, ' ');
  const label = entry.mammoth || entry.conviction === 'mammoth'
    ? 'Mammoth'
    : entry.conviction === 'high'
      ? 'Strong'
      : entry.conviction || 'Lean';
  return `${label}: ${market || 'Pick'}`;
};

const convictionClass = (entry: ConvictionSummary): string => {
  if (entry.mammoth || entry.conviction === 'mammoth') return 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30';
  if (entry.conviction === 'high') return 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 border-yellow-500/30';
  if (entry.conviction === 'med') return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
  if (entry.conviction === 'low') return 'bg-amber-700/15 text-amber-700 dark:text-amber-300 border-amber-700/30';
  return 'bg-muted text-muted-foreground border-border';
};

export function CFBDryRunSlateCardContent({
  prediction,
  isLocked,
  adminModeEnabled,
  highValueBadge,
  awayTeamColors,
  homeTeamColors,
  onOpenDetails,
  onOpenPayload,
}: CFBDryRunSlateCardContentProps) {
  const kickoff = formatKickoff(prediction.kickoff || prediction.start_time);
  const convictionSummary = Array.isArray(prediction.conviction_summary) ? prediction.conviction_summary : [];

  return (
    <CardContent className="space-y-4 px-3 pb-4 pt-3 sm:px-4 sm:pt-4">
      <StarButton
        gameId={prediction.game_id || prediction.id}
        gameType="cfb"
        gameData={{
          awayTeam: prediction.away_team,
          homeTeam: prediction.home_team,
          awayLogo: prediction.away_logo,
          homeLogo: prediction.home_logo,
          gameDate: kickoff.date,
          gameTime: kickoff.time,
          rawGameDate: prediction.kickoff,
          awaySpread: prediction.away_spread,
          homeSpread: prediction.home_spread,
          awayMl: prediction.away_ml,
          homeMl: prediction.home_ml,
          overLine: prediction.over_line,
          homeTeamColors,
          awayTeamColors,
        }}
      />

      {adminModeEnabled && (
        <Button
          size="sm"
          variant="outline"
          className="absolute right-12 top-2 z-10 bg-purple-500/90 text-white hover:bg-purple-600"
          onClick={onOpenPayload}
        >
          <Sparkles className="mr-1 h-4 w-4" />
          AI Payload
        </Button>
      )}

      {highValueBadge && (
        <div className="flex justify-center -mt-2">
          <HighValueBadge
            pick={highValueBadge.recommended_pick}
            confidence={highValueBadge.confidence}
            tooltipText={highValueBadge.tooltip_text}
          />
        </div>
      )}

      <div className="text-center">
        <div className="text-sm font-semibold text-muted-foreground">{kickoff.date}</div>
        <div className="text-xs font-semibold text-muted-foreground">{kickoff.time}</div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamBlock
          team={prediction.away_team}
          abbr={prediction.away_abbr}
          rank={prediction.away_rank}
          logo={prediction.away_logo}
          colors={awayTeamColors}
        />
        <div className="text-2xl font-black text-muted-foreground">@</div>
        <TeamBlock
          team={prediction.home_team}
          abbr={prediction.home_abbr}
          rank={prediction.home_rank}
          logo={prediction.home_logo}
          colors={homeTeamColors}
        />
      </div>

      <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <OddsColumn spread={prediction.away_spread} moneyline={prediction.away_ml} align="left" />
          <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-center text-xs font-black">
            O/U {formatTotal(prediction.over_line)}
          </div>
          <OddsColumn spread={prediction.home_spread} moneyline={prediction.home_ml} align="right" />
        </div>
      </div>

      {(prediction.pred_away_score !== null || prediction.pred_home_score !== null) && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-muted-foreground">Predicted Score</span>
          <span className="text-sm font-black">
            {prediction.away_abbr || 'Away'} {formatTotal(prediction.pred_away_score)} · {prediction.home_abbr || 'Home'} {formatTotal(prediction.pred_home_score)}
          </span>
        </div>
      )}

      {convictionSummary.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {convictionSummary.map((entry, index) => (
            <Badge key={`${entry.card}-${index}`} variant="outline" className={convictionClass(entry)}>
              {convictionLabel(entry)}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex justify-center pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={onOpenDetails}
          disabled={isLocked}
          className="text-xs"
          title={isLocked ? 'Subscribe to view details' : ''}
        >
          {isLocked ? (
            <>
              <Lock className="mr-1 h-4 w-4" />
              Upgrade to View Details
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-4 w-4" />
              Show 7 Prediction Cards
            </>
          )}
        </Button>
      </div>
    </CardContent>
  );
}

function TeamBlock({
  team,
  abbr,
  rank,
  logo,
  colors,
}: {
  team: string;
  abbr?: string;
  rank?: number | null;
  logo?: string;
  colors: { primary: string; secondary: string };
}) {
  return (
    <div className="min-w-0 text-center">
      <div
        className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full border-2 bg-background shadow-lg"
        style={{ borderColor: colors.primary }}
      >
        {logo ? (
          <img src={logo} alt={team} className="h-full w-full object-contain p-1" />
        ) : (
          <span className="text-sm font-black">{abbr || team.slice(0, 3).toUpperCase()}</span>
        )}
      </div>
      <div className="flex items-center justify-center gap-1">
        <span className="truncate text-base font-black">{abbr || team}</span>
        {rank && <Badge className="h-5 px-1.5 text-[10px]">#{rank}</Badge>}
      </div>
      <div className="truncate text-[11px] font-medium text-muted-foreground">{team}</div>
    </div>
  );
}

function OddsColumn({ spread, moneyline, align }: { spread: number | null; moneyline: number | null; align: 'left' | 'right' }) {
  return (
    <div className={`space-y-1 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <div className="text-lg font-black text-foreground">{formatMoneyline(moneyline)}</div>
      <div className="text-sm font-bold text-muted-foreground">{formatSpread(spread)}</div>
    </div>
  );
}
