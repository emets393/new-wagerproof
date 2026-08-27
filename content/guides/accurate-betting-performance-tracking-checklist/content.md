## Download the research log

[Download the WagerProof research log template as CSV](/guides/accurate-betting-performance-tracking-checklist/wagerproof-research-log-template-v1.csv). The two included rows are fictional and clearly marked `EXAMPLE_ONLY`. Delete them before using the file.

The template preserves the fields needed to reproduce a decision rather than only its result.

## Record the market as it existed

Save league, event, market, side, period, line, price, sportsbook, timestamp, and time zone. A note that says only "Team A spread" cannot be audited later. Include settlement details when books can grade the same-looking market differently.

Use one row per decision. If the line changes and you make a new decision, add a row rather than overwriting the old state.

## Separate research, action, and result

The log has separate fields for the model probability, model version, rule version, research cutoff, decision, stake, closing reference, and graded result. That separation prevents later information from leaking into the original rationale.

Record passes as well as actions when they came from a defined screening rule. Otherwise the record can hide how often a model produced an apparent signal that failed a final check.

## Use consistent unit and result rules

A unit is a reporting convention, not a safety mechanism. Define it before the sample and do not enlarge it after losses. Preserve the actual currency stake privately when needed for reconciliation, while public analysis can use units.

Track wins, losses, and pushes separately. Net profit or loss should include the actual price rather than assuming every win returns one unit. Decide whether fees, exchange commissions, and promotions are included, then state that policy.

## Calculate common metrics without hiding the denominator

For a stated sample:

- `Hit rate = wins / (wins + losses)` when pushes are excluded and disclosed
- `ROI = net profit or loss / total staked`
- `Average price = a clearly named price representation`, not a casual average of American odds
- `Positive CLV share = records with positive CLV / records with a valid closing reference`

Every percentage should travel with its denominator. A 60% hit rate over five resolved records is not equivalent evidence to 60% over five hundred comparable records.

## Keep calibration, CLV, and return distinct

Probability calibration asks whether forecasts behave like their stated probabilities across a suitable sample. [Closing line value](/blog/closing-line-value-sports-betting/) asks whether the recorded entry price compares favorably with a defined later reference. ROI reports realized net return relative to stake.

These measures can disagree. A short sample can have good CLV and negative results, or a winning record with poor price quality. Do not choose only the measure that flatters the period.

## Version every process change

When a model, input, filter, agent setting, or selection threshold changes, create a new version. Keep the previous rows intact. Write why the change occurred and whether it was planned before seeing the latest results.

This is especially important for saved historical Systems. Editing the rule after a losing stretch and displaying only the new version erases the evidence needed to judge the process.

## Review in fixed windows

Choose a weekly or monthly review cadence. Break results down by sport, market type, price range, model version, and decision rule only when the groups were defined or are labeled exploratory. Report missing closing prices and unresolved events rather than dropping them.

Ask four different questions:

1. Was the input data complete at the cutoff?
2. Were the probability forecasts calibrated?
3. Did the process capture competitive prices?
4. What realized result occurred after variance?

The record becomes more useful when it can answer an uncomfortable question without being rewritten.

## Protect the person behind the spreadsheet

Tracking can improve transparency, but constant checking can also intensify chasing behavior. Set time and money limits before a session, do not increase stakes to repair a metric, and use the [responsible research guide](/guides/responsible-sports-betting-research/) when the process stops feeling controlled.
