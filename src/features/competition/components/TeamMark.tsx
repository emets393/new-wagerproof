import * as React from 'react';
import { cn } from '@/lib/utils';
import type { CompSport } from './types';
import { compTeamLogo, teamInitials } from '../teamLogos';

/** ESPN logo with initials fallback — shared across competition surfaces. */
export function TeamMark({
  sport,
  name,
  size = 'md',
}: {
  sport: CompSport;
  name: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = React.useState(false);
  const logo = React.useMemo(() => compTeamLogo(sport, name), [sport, name]);
  React.useEffect(() => {
    setFailed(false);
  }, [logo, name]);

  const box =
    size === 'lg' ? 'h-10 w-10' : size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';
  const text = size === 'lg' ? 'text-[11px]' : size === 'sm' ? 'text-[7px]' : 'text-[9px]';

  if (logo && !failed) {
    return (
      <img
        src={logo}
        alt=""
        className={cn(box, 'shrink-0 object-contain')}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span
      className={cn(
        box,
        text,
        'flex shrink-0 items-center justify-center rounded-full bg-muted font-black text-muted-foreground'
      )}
    >
      {teamInitials(name)}
    </span>
  );
}
