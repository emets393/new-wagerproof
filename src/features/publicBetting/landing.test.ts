import { describe, expect, it } from 'vitest';
import { pickLandingSport } from './landing';

describe('pickLandingSport', () => {
  it('opens on NFL in October when the NFL board has rows', () => {
    expect(pickLandingSport(['nba', 'cfb', 'nfl'], new Date('2026-10-20T18:00:00Z'))).toBe('nfl');
  });

  it('falls through to CFB when October has no NFL rows', () => {
    expect(pickLandingSport(['nba', 'cfb'], new Date('2026-10-20T18:00:00Z'))).toBe('cfb');
  });

  it('opens on NBA once football is over', () => {
    expect(pickLandingSport(['nba', 'ncaab'], new Date('2027-03-15T18:00:00Z'))).toBe('nba');
  });

  it('returns all when the board is empty', () => {
    expect(pickLandingSport([], new Date('2026-07-15T18:00:00Z'))).toBe('all');
  });
});
