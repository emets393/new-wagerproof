import { describe, expect, it } from 'vitest';
import { getNBATeamLogo } from '@/features/games/api/nbaGames';
import { getNBATeamColors } from '@/utils/teamColors';
import { canonicalNbaName } from './nbaNames';

const GRAY = '#6B7280';

describe('canonicalNbaName', () => {
  it('turns a nickname into a name the color table knows', () => {
    expect(getNBATeamColors('Celtics').primary).toBe(GRAY);
    expect(getNBATeamColors(canonicalNbaName('Celtics')).primary).toBe('#007A33');
    expect(getNBATeamColors(canonicalNbaName('Lakers')).primary).toBe('#552583');
    expect(getNBATeamLogo(canonicalNbaName('Lakers'), [])).toContain('lal.png');
    expect(getNBATeamColors(canonicalNbaName('76ers')).primary).toBe('#006BB6');
    expect(getNBATeamColors(canonicalNbaName('Trail Blazers')).primary).toBe('#E03A3E');
  });

  it('covers every nickname on the board', () => {
    const nicknames = [
      'Celtics',
      'Pistons',
      '76ers',
      'Knicks',
      'Thunder',
      'Spurs',
      'Hawks',
      'Magic',
      'Bucks',
      'Wizards',
      'Timberwolves',
      'Heat',
      'Bulls',
      'Raptors',
      'Hornets',
      'Nets',
      'Pacers',
      'Pelicans',
      'Jazz',
      'Grizzlies',
      'Mavericks',
      'Rockets',
      'Warriors',
      'Lakers',
      'Suns',
      'Trail Blazers',
      'Kings',
      'Clippers',
    ];
    for (const name of nicknames) {
      expect(getNBATeamColors(canonicalNbaName(name)).primary, name).not.toBe(GRAY);
    }
  });
});
