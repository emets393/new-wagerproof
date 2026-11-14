import type { CSSProperties, ReactNode } from 'react';
import { getNFLTeamLogo } from '@/features/games/api/nflGames';

type MarkStyle = CSSProperties & { '--tc'?: string };

export function PlayerMark({
  initials,
  color,
  title,
  size = 17,
  photo,
}: {
  initials: string;
  color: string;
  title: string;
  size?: number;
  photo?: string;
}) {
  const style: MarkStyle = { '--tc': color, width: size, height: size };
  return (
    <span className={size > 20 ? 'ph' : 'mk ph'} style={style} title={title}>
      {photo ? <img src={photo} alt="" /> : initials}
    </span>
  );
}

export function TeamMark({
  team,
  title,
  color,
  size = 17,
}: {
  team: string;
  title: string;
  color?: string;
  size?: number;
}) {
  const style: MarkStyle = { width: size, height: size, '--tc': color };
  return (
    <span className={size > 20 ? 'tm' : 'mk tm'} style={style} title={title}>
      <img src={getNFLTeamLogo(team)} alt="" />
    </span>
  );
}

export function OwnerLine({ children }: { children: ReactNode }) {
  return <div className="owner">{children}</div>;
}

export function OwnName({ mark, name }: { mark: ReactNode; name: string }) {
  return (
    <span className="own">
      {mark}
      <b>{name}</b>
    </span>
  );
}
