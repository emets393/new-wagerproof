import { describe, it, expect } from 'vitest';
import {
  parsePitcherAgainstTeam,
  resolveMlbTeamPhrase,
  rewriteMlbPitcherAgainstTeamOps,
} from './mlbNlPitcherTeamRewrite';

const CATALOG = ['Cristopher Sánchez', 'Sixto Sánchez', 'Zack Wheeler', 'Yoshinobu Yamamoto'];

describe('parsePitcherAgainstTeam', () => {
  it('parses pitcher-subject against team', () => {
    expect(parsePitcherAgainstTeam('Christopher Sanchez against the Dodgers')).toEqual({
      pitcherPhrase: 'Christopher Sanchez',
      teamPhrase: 'Dodgers',
    });
    expect(parsePitcherAgainstTeam('Cristopher Sánchez vs LAD')).toEqual({
      pitcherPhrase: 'Cristopher Sánchez',
      teamPhrase: 'LAD',
    });
  });
  it('rejects non pitcher-vs-team shapes', () => {
    expect(parsePitcherAgainstTeam('facing Christopher Sanchez')).toBeNull();
    expect(parsePitcherAgainstTeam('home dogs against the Dodgers')).toBeNull();
    expect(parsePitcherAgainstTeam('teams that have won 5 straight against a team off a loss')).toBeNull();
  });
});

describe('resolveMlbTeamPhrase', () => {
  it('resolves nicknames and abbrs', () => {
    expect(resolveMlbTeamPhrase('Dodgers')).toBe('LAD');
    expect(resolveMlbTeamPhrase('LAD')).toBe('LAD');
    expect(resolveMlbTeamPhrase('Yankees')).toBe('NYY');
    expect(resolveMlbTeamPhrase('Athletics')).toBe('ATH');
  });
});

describe('rewriteMlbPitcherAgainstTeamOps', () => {
  it('moves mistaken oppSpNames to spNames and keeps opponents', () => {
    const ops = rewriteMlbPitcherAgainstTeamOps(
      'Christopher Sanchez against the Dodgers',
      [
        { op: 'set', dimension: 'opponents', value: ['LAD'] },
        { op: 'set', dimension: 'oppSpNames', value: ['Christopher Sanchez'] },
      ],
      CATALOG,
    );
    expect(ops).toEqual([
      { op: 'set', dimension: 'spNames', value: ['Cristopher Sánchez'] },
      { op: 'set', dimension: 'opponents', value: ['LAD'] },
    ]);
  });

  it('does not rewrite facing-pitcher sentences', () => {
    const input = [
      { op: 'set' as const, dimension: 'oppSpNames', value: ['Cristopher Sánchez'] },
    ];
    expect(rewriteMlbPitcherAgainstTeamOps('facing Cristopher Sánchez', input, CATALOG)).toEqual(input);
  });
});
