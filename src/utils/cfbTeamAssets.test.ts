import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCfbTeamLogo,
  installCfbTeamAssets,
  lookupCfbTeam,
  normalizeCfbTeamKey,
  resetCfbTeamAssetsForTests,
} from './cfbTeamAssets';
import { teamVisuals } from '@/features/outliers/teamVisuals';

const SAMPLE_TEAMS = [
  {
    team_name: 'Ohio State',
    abbr: 'OSU',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/194.png',
    logo_dark: null,
    color: '#BB0000',
    alt_color: '#666666',
  },
  {
    team_name: "Hawai'i",
    abbr: 'HAW',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/62.png',
    logo_dark: null,
    color: '#024731',
    alt_color: '#C41230',
  },
  {
    team_name: 'San José State',
    abbr: 'SJSU',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/23.png',
    logo_dark: null,
    color: '#0055A2',
    alt_color: '#E5A100',
  },
  {
    team_name: 'Pittsburgh',
    abbr: 'PITT',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/221.png',
    logo_dark: null,
    color: '#003594',
    alt_color: '#FFB81C',
  },
  {
    team_name: 'App State',
    abbr: 'APP',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2026.png',
    logo_dark: null,
    color: '#FFCC00',
    alt_color: '#000000',
  },
  {
    team_name: 'Akron',
    abbr: 'AKR',
    logo: 'https://a.espncdn.com/i/teamlogos/ncaa/500/2006.png',
    logo_dark: null,
    color: '#041E42',
    alt_color: '#A89968',
  },
];

describe('cfbTeamAssets', () => {
  beforeEach(() => {
    resetCfbTeamAssetsForTests();
    installCfbTeamAssets(SAMPLE_TEAMS);
  });

  it('normalizes accents and apostrophes for lookup', () => {
    expect(normalizeCfbTeamKey("Hawai'i")).toBe('hawaii');
    expect(normalizeCfbTeamKey('San José State')).toBe('san jose state');
    expect(lookupCfbTeam('Hawaii')?.teamName).toBe("Hawai'i");
    expect(lookupCfbTeam('San Jose State')?.teamName).toBe('San José State');
  });

  it('expands trailing St to State', () => {
    expect(normalizeCfbTeamKey('North Dakota St')).toBe('north dakota state');
    expect(normalizeCfbTeamKey('Sacramento St')).toBe('sacramento state');
  });

  it('resolves logos by school name and abbr', () => {
    expect(getCfbTeamLogo('Ohio State')).toContain('/194.png');
    expect(getCfbTeamLogo('OSU')).toContain('/194.png');
    expect(getCfbTeamLogo('Akron')).toContain('/2006.png');
  });

  it('resolves common aliases (Pitt, Appalachian State)', () => {
    expect(getCfbTeamLogo('Pitt')).toContain('/221.png');
    expect(getCfbTeamLogo('Appalachian State')).toContain('/2026.png');
  });

  it('seeds FCS opponents missing from cfb_teams (NDSU, Sacramento State)', () => {
    // Supplemental rows merge even when the FBS sample set omits them.
    expect(getCfbTeamLogo('North Dakota State')).toContain('/2449.png');
    expect(getCfbTeamLogo('North Dakota St')).toContain('/2449.png');
    expect(getCfbTeamLogo('NDSU')).toContain('/2449.png');
    expect(lookupCfbTeam('NDSU')?.abbr).toBe('NDSU');

    expect(getCfbTeamLogo('Sacramento State')).toContain('/16.png');
    expect(getCfbTeamLogo('Sacramento St')).toContain('/16.png');
    expect(getCfbTeamLogo('SAC')).toContain('/16.png');
    expect(lookupCfbTeam('SAC')?.teamName).toBe('Sacramento State');
  });

  it('teamVisuals returns CFB logos for teams and coach-style keys', () => {
    // Coach cards store team_abbr as the full school name.
    const team = teamVisuals('ncaaf', 'Ohio State');
    expect(team.logoUrl).toContain('/194.png');
    expect(team.initials).toBe('OSU');
    expect(team.colors.primary).toBe('#BB0000');

    const coachTeam = teamVisuals('ncaaf', 'App State');
    expect(coachTeam.logoUrl).toContain('/2026.png');

    const ndsu = teamVisuals('ncaaf', 'North Dakota St');
    expect(ndsu.logoUrl).toContain('/2449.png');
    expect(ndsu.initials).toBe('NDSU');
  });

  it('falls back to initials when the school is unknown', () => {
    const miss = teamVisuals('ncaaf', 'Some FCS School');
    expect(miss.logoUrl).toBeNull();
    expect(miss.initials.length).toBeGreaterThan(0);
  });
});
