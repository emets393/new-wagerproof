import { describe, expect, it } from 'vitest';
import { colorDistance, contrastRatio, sideColors, visibleBarColor } from './colors';
import type { TeamRef } from '@/features/games/types';

function team(name: string, primary: string, secondary: string): TeamRef {
  return { name, abbrev: name.slice(0, 3).toUpperCase(), logoUrl: null, colors: { primary, secondary } };
}

describe('sideColors', () => {
  it('keeps over green and under blue on a total', () => {
    const colors = sideColors('total', team('Over', '#111111', '#ffffff'), team('Under', '#222222', '#ffffff'));
    expect(colors).toEqual({ away: '#10b981', home: '#3b82f6' });
  });

  it('keeps gold and lightens a purple that disappears on the dark card', () => {
    const colors = sideColors(
      'spread',
      team('JMU', '#450084', '#cbb677'),
      team('App State', '#000000', '#ffcd00'),
    );
    expect(colors.home).toBe('#ffcd00');
    expect(colors.away).not.toBe('#450084');
    expect(contrastRatio(colors.away)).toBeGreaterThanOrEqual(4);
    expect(contrastRatio(colors.home)).toBeGreaterThanOrEqual(4);
    expect(colorDistance(colors.away, colors.home)).toBeGreaterThanOrEqual(72);
  });

  it('keeps two dark reds apart after both are lightened enough to read', () => {
    const colors = sideColors(
      'spread',
      team('Oklahoma', '#841617', '#ffffff'),
      team('Mississippi State', '#5d1725', '#c1c6c8'),
    );
    expect(contrastRatio(colors.away)).toBeGreaterThanOrEqual(4);
    expect(contrastRatio(colors.home)).toBeGreaterThanOrEqual(4);
    expect(colorDistance(colors.away, colors.home)).toBeGreaterThanOrEqual(72);
  });

  it('lifts navy and black only as far as the card needs', () => {
    const navy = visibleBarColor('#0c2340');
    const black = visibleBarColor('#000000');
    expect(contrastRatio(navy)).toBeGreaterThanOrEqual(4);
    expect(contrastRatio(black)).toBeGreaterThanOrEqual(4);
    const celtic = visibleBarColor('#007A33');
    expect(contrastRatio(celtic)).toBeGreaterThanOrEqual(4);
    expect(celtic).not.toBe('#007a33');
    expect(visibleBarColor('#ffcd00')).toBe('#ffcd00');
  });
});
