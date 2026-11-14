import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DuelRow } from './DuelRow';
import { pickPropBook } from './BookMark';
import { DeVontaSmithCard } from './DeVontaSmithCard';

const css = readFileSync(new URL('./prop-cards.css', import.meta.url), 'utf8');

describe('prop card css', () => {
  it('scopes the reference rules and leaves the app tokens alone', () => {
    expect(css).toContain('.prop-cards .row.duel');
    expect(css).toContain('.prop-cards .chip.off');
    expect(css).toContain('.dark .prop-cards');
    expect(css).toContain('hsl(var(--primary))');
    expect(css).toContain('--pc-leak: #10B981');
    expect(css).toContain('--pc-radius: 26px');
    expect(css).not.toMatch(/:root\s*\{/);
    expect(css).not.toContain('prefers-color-scheme');
    expect(css).not.toContain('data-theme');
    expect(css).not.toContain('base64');
    expect(css).not.toContain('var(--leak)');
    expect(css).not.toContain('var(--card)');
  });
});

describe('DeVonta Smith card', () => {
  const html = renderToStaticMarkup(<DeVontaSmithCard />);

  it('uses the reference markup and the reference numbers', () => {
    expect(html).toContain('data-prop-card="devonta-smith"');
    expect(html).toContain('class="prop-cards"');
    expect(html).toContain('class="chip off"');
    expect(html).toContain('indoors — suppressed');
    expect(html).toContain('58.5');
    expect(html).toContain('65.8');
    expect(html).toContain('+7.3');
    expect(html).toContain('a wash');
    expect(html).toContain('16th of 32');
    expect(html).toContain('2nd of 32');
    expect(html).toContain('18th of 32');
    expect(html).toContain('30th of 32');
    expect(html).toContain('class="win nil"');
    expect(html).not.toContain('class="axis duel-ax"');
    expect(html).toContain('how often Dallas plays that coverage');
    expect(html).toContain('A first read is the receiver');
    expect(html).toContain('class="sec"');
    expect(html).toContain('viewBox="0 0 336 336"');
    expect(html).toContain('class="wheel-layout"');
    expect(html).toContain('class="wheel-readout"');
    expect(html).toContain('What Dallas sits in');
    expect(html).toContain('static.www.nfl.com/image/upload/f_auto,q_auto/league/vj2fz8veorg1k5qthnjm');
    expect(html).toContain('class="wheel-tag"');
    expect(html).toContain('class="wheel-leads"');
    expect(html).toContain('alt="DraftKings"');
    expect(html).toContain('/sportsbooks/draftkings.png');
    expect(html).not.toContain('duckduckgo.com');
    expect(html).not.toContain('fanduel.com');
    expect(html).toContain('Philadelphia at Dallas');
    expect(html).toContain('Cover 6');
    expect(html).toContain('no routes on file');
    expect(html).toContain('2.37');
    expect(html).not.toContain('width="336"');
    expect(html).not.toContain('best_over');
    expect(html).not.toMatch(/\bOver\b/);
    expect(html).not.toMatch(/\bUnder\b/);
  });
});

describe('pickPropBook', () => {
  it('uses DraftKings, then FanDuel', () => {
    expect(pickPropBook(['fanduel', 'draftkings'])).toBe('draftkings');
    expect(pickPropBook(['betmgm', 'fanduel'])).toBe('fanduel');
    expect(pickPropBook(['betmgm'])).toBeNull();
  });
});

describe('DuelRow', () => {
  it('names a wash and does not put a mark on the bar', () => {
    const html = renderToStaticMarkup(
      <DuelRow
        label="Out"
        detail="12.0% of his tree"
        tone="nil"
        side="defense"
        winner="a wash"
        value={'\u22120.3 yds'}
        rank="18th of 32"
        reach={5}
      />,
    );
    expect(html).toContain('class="row duel"');
    expect(html).toContain('class="win nil"');
    expect(html).toContain('a wash');
    expect(html).toContain('18th of 32');
    expect(html).not.toContain('class="tip"');
  });
});
