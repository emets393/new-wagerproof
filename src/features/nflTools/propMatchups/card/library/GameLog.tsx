import type { ReactNode } from 'react';
import { getNFLTeamLogo } from '@/features/games/api/nflGames';

export type LogWeek = {
  label: string;
  margin: number;
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

function Caption({ week }: { week: LogWeek }) {
  if (!week.opponent) {
    return (
      <>
        {week.label}
        <br />
        {signed(week.margin)}
      </>
    );
  }
  return (
    <>
      <img src={getNFLTeamLogo(week.opponent)} alt="" />
      {week.home === false ? '@' : 'vs'} {week.opponent}
      <br />
      {week.line != null ? lineText(week.line) : signed(week.margin)}
      <br />
      {week.label}
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
  const max = Math.max(...weeks.map((week) => Math.abs(week.margin)), 1);
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
      {note ? <p className="note">{note}</p> : null}
    </>
  );
}
