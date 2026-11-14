import type { ReactNode } from 'react';
import { getNFLTeamLogo } from '@/features/games/api/nflGames';

export type LogWeek = {
  label: string;
  margin: number;
  /** What he actually did that week. The bar is this number. */
  actual?: number;
  season?: number;
  week?: number;
  opponent?: string;
  line?: number;
  home?: boolean;
};

function signed(margin: number) {
  if (margin > 0) return `+${margin}`;
  if (margin < 0) return `\u2212${Math.abs(margin)}`;
  return '0';
}

function lineText(line: number) {
  return line.toFixed(1);
}

function groupsOf(weeks: LogWeek[]): { season: number | null; weeks: LogWeek[] }[] {
  const groups: { season: number | null; weeks: LogWeek[] }[] = [];
  for (const week of weeks) {
    const season = week.season ?? null;
    const last = groups[groups.length - 1];
    if (!last || last.season !== season) groups.push({ season, weeks: [week] });
    else last.weeks.push(week);
  }
  return groups;
}

function columnKey(week: LogWeek, suffix = '') {
  return `${week.season ?? ''}-${week.week ?? week.label}-${week.opponent ?? ''}${suffix}`;
}

function amount(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function Caption({ week }: { week: LogWeek }) {
  return (
    <>
      <span className="log-wk">{week.label}</span>
      {week.opponent ? (
        <span className="log-opp">
          <img src={getNFLTeamLogo(week.opponent)} alt="" />
          <span>{week.home === false ? '@ ' : ''}{week.opponent}</span>
        </span>
      ) : null}
      <span className="log-line">{week.line != null ? lineText(week.line) : signed(week.margin)}</span>
    </>
  );
}

export function GameLog({
  weeks,
  hero,
  note,
}: {
  weeks: LogWeek[];
  hero?: ReactNode;
  note?: ReactNode;
}) {
  const hasActual = weeks.some((week) => week.actual != null);
  const max = hasActual
    ? Math.max(...weeks.map((week) => Math.max(week.actual ?? 0, week.line ?? 0)), 1)
    : Math.max(...weeks.map((week) => Math.abs(week.margin)), 1);
  const groups = groupsOf(weeks);
  const split = groups.length > 1;
  return (
    <>
      {hero}
      <div className="log-seasons">
        {groups.map((group) => {
          const columns = `repeat(${group.weeks.length},1fr)`;
          return (
            <div className="log-season" key={group.season ?? 'log'} style={{ flex: group.weeks.length }}>
              {split && group.season != null ? <div className="log-year">{group.season}</div> : null}
              {hasActual ? (
                <div className="log-bars" style={{ gridTemplateColumns: columns }}>
                  {group.weeks.map((week) => {
                    const actual = week.actual ?? 0;
                    const tone = week.margin > 0 ? 'pos' : week.margin < 0 ? 'neg' : 'nil';
                    const height = actual <= 0 ? '0%' : `${Math.max(6, (actual / max) * 100).toFixed(1)}%`;
                    const mark = week.line != null ? `${Math.min(100, (week.line / max) * 100).toFixed(1)}%` : null;
                    return (
                      <div
                        className="log-col"
                        key={columnKey(week)}
                        title={week.line != null ? `${amount(actual)} on a line of ${lineText(week.line)}` : amount(actual)}
                      >
                        <div className={`log-val ${tone}`}>{amount(actual)}</div>
                        <div className="log-track">
                          <i className={tone} style={{ height }} />
                          {mark ? <span className="log-mark" style={{ bottom: mark }} /> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="log-plot">
                  <div className="log-zero" />
                  <div className="cols" style={{ gridTemplateColumns: columns }}>
                    {group.weeks.map((week) => {
                      const height = `${Math.min(50, (Math.abs(week.margin) / max) * 50).toFixed(1)}px`;
                      const up = week.margin > 0;
                      return (
                        <div className="col" key={columnKey(week)}>
                          <div className="up">{up ? <i style={{ height }} /> : null}</div>
                          <div className="zl" />
                          <div className="dn">{up ? null : <i style={{ height }} />}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="wklabels" style={{ gridTemplateColumns: columns }}>
                {group.weeks.map((week) => (
                  <span key={columnKey(week, '-label')}>
                    <Caption week={week} />
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {hasActual ? (
        <p className="note">The colored number is what he did. Green cleared that week&apos;s line, red missed it. The mark on the bar, and the grey number under the opponent, are the line.</p>
      ) : null}
      {note ? <p className="note">{note}</p> : null}
    </>
  );
}
