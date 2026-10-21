import { describe, expect, it } from 'vitest';
import { differenceCaption } from './DivergenceBar';

describe('differenceCaption', () => {
  it('states how far the money split sits past the tickets', () => {
    expect(
      differenceCaption(83, 17, 64, 36, 'home', 'Tennessee', 'S. Carolina'),
    ).toEqual({
      text: '19% more money than tickets on S. Carolina',
      side: 'home',
      points: 19,
    });
  });

  it('stays quiet when the two splits match', () => {
    expect(differenceCaption(60, 40, 60, 40, null, 'Over', 'Under')).toBeNull();
  });
});
