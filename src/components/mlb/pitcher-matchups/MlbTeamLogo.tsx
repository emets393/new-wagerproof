import React from 'react';
import { espnMlb500LogoUrlFromAbbrev } from '@/utils/mlbTeamLogos';

interface MlbTeamLogoProps {
  abbrev: string;
  name: string;
  size?: 'sm' | 'md';
}

export function MlbTeamLogo({ abbrev, name, size = 'md' }: MlbTeamLogoProps) {
  const dim = size === 'sm' ? 'h-6 w-6' : 'h-8 w-8 sm:h-9 sm:w-9';

  return (
    <img
      src={espnMlb500LogoUrlFromAbbrev(abbrev)}
      alt=""
      className={`${dim} object-contain shrink-0`}
      onError={e => {
        const el = e.currentTarget;
        if (el.getAttribute('data-logo-fb') === '1') {
          el.style.display = 'none';
          return;
        }
        el.setAttribute('data-logo-fb', '1');
        el.src = espnMlb500LogoUrlFromAbbrev(abbrev === 'AZ' ? 'ARI' : abbrev);
      }}
      aria-hidden
      title={name}
    />
  );
}
