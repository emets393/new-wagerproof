# Research: parlay calculator

September 28, 2026, America/Chicago. New article with an interactive tool, unpublished draft pending review. Canonical https://wagerproof.bet/guides/parlay-calculator/. lastTestedAt is the date the calculator was exercised in a headless browser (390px and 1440px, light and dark).

## Keyword and intent decision

Targets supplied by the user (Ahrefs, US): "parlay calculator" about 53K/mo, "betting odds calculator" / "odds calculator" about 39K, plus "parlay odds calculator", "how to calculate parlay odds", "parlay payout calculator" and "fair odds calculator". Not re-pulled in this run. Overlapping queries are not additive and volume is not expected traffic.

The query is tool intent, so the working calculator renders above the article (and above the hero) and is usable on a phone without scrolling past the header. "Parlay Calculator" leads the H1, SEO title and first sentence. The odds-conversion section and per-leg conversions serve the "odds calculator" intent. The no-vig section serves "fair odds calculator" and is the differentiator versus typical payout-only calculators.

Intent boundaries: implied-probability-vs-true-probability owns single-market no-vig math and the worksheet; this page links to it instead of repeating the method. No existing guide, redirect or migration target uses a parlay-calculator slug. A same-game parlay strategy draft exists on an unmerged codex branch (1fe61fdf); this page mentions SGP correlation only as a caveat.

## Math (verified against src/lib/parlay-math.js, unit-tested in src/lib/parlay-math.test.ts)

- American to decimal: negative A gives 1 + 100/|A|; positive A gives 1 + A/100. American values strictly between -100 and +100 are rejected. Fractional N/D gives 1 + N/D. Auto-detect: slash = fractional, leading sign = American, unsigned 100 or more = American, other unsigned numbers = decimal.
- Decimal to American: D of 2.00 or more gives (D - 1) x 100; below 2.00 gives -100/(D - 1). Rounded half away from zero, matching src/features/parlayGod/engine.ts americanText().
- Parlay decimal = product of active (non-void) leg decimals. Payout = stake x decimal, profit = payout - stake, rounded to the cent only for display. Implied probability = 1 / decimal.
- No-vig leg probability: proportional normalization, (1/d) / (1/d + 1/d_other). Fair parlay probability = product of leg fair probabilities (independence assumption). EV at stake = stake x (p_fair x D - 1). "Vig you're paying" = 1 - p_fair x D, the expected loss per dollar under the no-vig estimate.

Worked numbers used on the page (all reproduced by the calculator display):

| Case | Decimal | American | $10 payout | Profit | Implied | Fair | EV at $10 | Vig |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| -110, -110, +150 (default) | 9.1116 | +811 | $91.12 | $81.12 | 10.98% | n/a | n/a | n/a |
| same, others -110, -110, -170 | 9.1116 | +811 | $91.12 | $81.12 | 10.98% | 9.71% (+930, 10.2963, $102.96) | -$1.15 | 11.51% |
| -110 single (other -110) | 1.9091 | -110 | $19.09 | $9.09 | 52.38% | 50.00% (+100) | -$0.45 | 4.55% |
| -110 x2 (others -110) | 3.6446 | +264 | $36.45 | $26.45 | 27.44% | 25.00% (+300) | -$0.89 | 8.88% |
| -110 x3 (others -110) | 6.9579 | +596 | $69.58 | $59.58 | 14.37% | 12.50% (+700) | -$1.30 | 13.03% |
| -110 x4 (others -110) | 13.2833 | +1228 | $132.83 | $122.83 | 7.53% | 6.25% (+1500) | -$1.70 | 16.98% |
| -110, +150 (one -110 leg pushed) | 4.7727 | +377 | $47.73 | $37.73 | 20.95% | n/a | n/a | n/a |

Round robin by 2s on the default legs at $10 each: 36.4463 + 2 x 47.7273 = $131.90 returned on $30 if all three legs win.

Conversions: 5/2 = 3.50 = +250 = 28.57%; 10/11 = 1.9091 = -110; 2.50 = +150 = 40.00%; 1.80 = -125 = 55.56%.

Note on the brief: an earlier spec value (-110/-110/+150 = 6.9587) was wrong; 6.9579 is three -110 legs. The default example is 9.1116. The brief's "10.97%" implied probability rounds to 10.98% (0.109751).

## Fact sources and claim boundaries

- FanDuel Sportsbook House Rules (Colorado), fetched 2026-09-28. Section 19 "Parlays, Round Robins and Teasers": "If one or more selections in a parlay are void then the remaining selections will determine the outcome of the wager, with the odds re-calculated accordingly. If all selections except one are void, the parlays will be settled as a straight at the applicable odds. The above also applies to all Same Game Parlay bets." Correlated selections are not permitted "unless explicitly offered by FanDuel Sportsbook, e.g., as a Same Game Parlay bet". Odds Boost section: "if any selection within the bet is void, the entire Odds Boost will be void". Rugby league section: a whole-number line that lands exactly is refunded and "deemed an excluded leg for the purpose of any applicable parlay, which will be recalculated excluding that leg." The page says "in some sports" for that push rule because we only found it stated sport by sport.
- "Most U.S. books handle pushes the same way" is general industry practice, stated with "most" and paired with an instruction to check the reader's own book. We did not verify DraftKings or BetMGM rule text (their rules pages render client-side). Do not claim a specific second book.
- 1-800-MY-RESET: NCPG's National Problem Gambling Helpline, call, text or chat, confirmed on 1800myreset.org 2026-09-28. Matches the site footer.

## Claims deliberately not made

- No claim that the no-vig estimate is the true probability; proportional normalization is named and caveated.
- No claim about how any specific book prices same-game parlays or rounds parlay payouts.
- No profit claims for WagerProof; the product paragraph describes model probabilities beside lines and says models are often wrong.
- Examples are fictional prices, not picks.

## Assets

Hero and social images are built from a real headless-Chrome screenshot of this page's calculator. See public/guides/parlay-calculator/asset-provenance.md.
