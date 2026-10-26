# NCAAB public-betting splits

Ticket and money percentages from Action Network for Division I college basketball, with the
consensus close, the opener, first-half and final scores — one payload per slate date.

```
fetch_ncaab.py --seasons 2024 2025     AN START-year labels; writes data/ncaab_splits.parquet
ncaab_study.py                         the battery -> data/NCAAB_STUDY_RUN.txt
```

Port of `../nba-splits/`. Same frame, same `derive()` placeholder rule, same within-slate-date
permutation null. Neither the parquet nor the response cache (`data/an_cache/`, ~900MB) is in
git; both rebuild from `fetch_ncaab.py` in about 8 minutes from cold.

**11,276 completed games, 2024-25 and 2025-26** (spread gradable 10,201, totals 10,602,
moneyline 10,082). Orientation guard: home covers 50.1% / 48.7%.

**Going forward, the live capture is `research/action-splits/snapshot_action.py`**, which
already requests the `ncaab` slug hourly into `action_public_splits`. It starts filling the
day the first November line posts.

## Two things to know before reading anything here

**1. There is no earlier history.** Action Network serves no `bet_info` for any college game
before 2024-25 — probed November, January and March of 2019-20 through 2023-24, all empty.
Lines and scores exist for those years; percentages do not. Two seasons is what there is.

**2. The AN "crowd" takes the points on big college spreads, and that is real.** On NCAAB
spreads of 15+ the ticket majority sits on the UNDERDOG in 87% of games, while the moneyline
majority sits on the favourite in 97%. The same feed's hand-paste-verified CFB rows show the
identical shape (21+ point spreads: favourite 24%, under 7: favourite 60-67%), and the archive
reproduces our own live pre-tip captures exactly on 85 CFB/NBA games (100% within 5 points,
zero mirror flips). So it is not an orientation bug and not an archive artifact: Action
Network's user base is bet-tracking app users, and on a 20-point college line they take the
dog. Read "crowd" as "AN users", never as "the betting public".

## ★ VERDICT: no edge in NCAAB betting percentages

| what was tested | result |
|---|---|
| crowd side covers, by lopsidedness (50-55 ... 80%+), spread | 47.8 / 50.8 / 50.4 / 50.4 / 50.7 / 49.0%. corr −0.002. family p=0.35 |
| same, totals | 49.1 / 50.6 / 50.4 / 49.4 / 52.1 / 48.9%. corr −0.003. family p=0.42 |
| money% minus tickets%, spread (tilt by gap, flip either way) | every band 47.8-51.0%, −2.6 to −8.8% ROI. family p=0.40 |
| same, totals | flips in 1.6% of games; all bands −2 to −10% except n=48 |
| totals FLIP → back the money (the one cross-league read, CFB 65% / NFL 79%) | 108-105 (50.7%); 49.4% then 51.6% |
| college cuts: conference / non-conference, power / non-power, postseason, spread size, crowd on home / away / fav / dog, each at 70%+ | best cell 1.9 pts off 50%, family p=0.71 (spread) and 0.42 (totals) |
| short moneylines (±220), flip fade | 57.6% / 54.9% at −0.5% / −3.6% ROI — the price eats it |

The most lopsided crowds (80%+) lose on both markets (49.0% / 48.9%), which is what a market
pricing them looks like, not a fade. The totals-flip read that carries CFB and NFL does not
carry here, consistent with NBA.

## What the data IS good for

Display. The feed is clean, keyed by AN game id, carries first-half points and conference,
and the live table will accumulate the pre-tip arc from opening night. Nothing in it should be
rendered as a signal. Per the cross-league rule, nothing here says anything about CFB or NFL,
where the totals flip is live.
