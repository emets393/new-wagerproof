import { describe, expect, it } from 'vitest';
import { canonicalCfbName } from './actionNames';

describe('canonicalCfbName', () => {
  it('expands the Action nicknames that miss cfb_teams', () => {
    expect(canonicalCfbName('S. Alabama')).toBe('South Alabama');
    expect(canonicalCfbName('N. Mexico St')).toBe('New Mexico State');
    expect(canonicalCfbName('Miami (FL)')).toBe('Miami');
    expect(canonicalCfbName('LA-Monroe')).toBe('UL Monroe');
    expect(canonicalCfbName('ND State')).toBe('North Dakota State');
    expect(canonicalCfbName('Oklahoma')).toBe('Oklahoma');
  });
});
