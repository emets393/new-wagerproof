# WagerProof — Meta Ads

Zero-dependency, platform-aware Node client for shipping and managing WagerProof's
Meta (Facebook/Instagram) app-install ads on iOS and Android. See
`.claude/skills/meta-ads/SKILL.md` for the agent quick reference; this is the
human setup + strategy.

## Status
`config.json` is filled: iOS + Android apps (Meta App ID `935005752525075`), copy,
and the account `act_2206204643248135` (billing confirmed). Only the token is left.

## Setup
```
echo 'META_ACCESS_TOKEN=EAA...' > marketing/meta-ads/.env   # System User token, ads_management, assigned to the account
cd marketing/meta-ads
node client/meta.mjs check
```

## ⚠️ App-event optimization is blocked (as of 2026-07-31)

Meta refuses every downfunnel optimization event for this app — verified by probing
all eight event types against the Graph API:

| Event | Meta's answer |
|---|---|
| `PURCHASE`, `START_TRIAL`, `ADD_TO_CART`, `LEAD` | "not actively logged by your app" |
| `SUBSCRIBE`, `COMPLETE_REGISTRATION`, `CONTENT_VIEW`, `INITIATED_CHECKOUT` | "set up app events in Events Manager first" |

So no purchase/subscribe campaign can be created until the event pipeline is repaired.
Two independent breakages, from the account's monthly signal:

| Month | Spend | Installs | Registrations | Purchases |
|---|---|---|---|---|
| Mar 19–31 | $1,742 | 318 | 204 | **66** |
| Apr | $9,461 | 994 | 541 | 14 |
| May | $4,859 | 750 | 382 | **0** |
| Jul | $809 | **2** | **1** | 0 |

1. **RevenueCat → Meta purchase events died ~May 1.** Installs and registrations kept
   flowing that month, so this is the RevenueCat Facebook integration, not the app.
   Check the WagerProof project's Facebook integration in the RevenueCat dashboard.
2. **iOS app events died ~June.** Auto-logging had been force-disabled in code; fixed in
   #71 / #80 and shipped in 3.5.9 (build 91, 2026-07-28). Needs App Store adoption before
   Meta sees volume again.

Until both are fixed, `--optimize purchase` will fail at ad-set creation, and the running
install campaign is also flying blind — it reported 2 installs on $809 while serving 1,028
link clicks and 125 app-store visits.

### The one exception: Subscribe exists on the *web* pixel
Dataset `1731090704521232` is healthy and actively logs `Subscribe`, `InitiateCheckout`,
`ViewContent`, `CompleteRegistration` and `PageView` — roughly **3 Subscribes/week**. So a
Subscribe-optimized campaign *is* creatable, but only as `--platform web`: an `OUTCOME_SALES`
campaign converting on the pixel at wagerproof.bet, which bills through RevenueCat Web,
not Apple. It is a different funnel from app installs — don't conflate the two.

### CORRECTION 2026-08-02: app SUBSCRIBE works, and the "$9,534 for $153" claim was a misread

This section previously said `--optimize subscribe` was disabled for app platforms because
SUBSCRIBE "is never sent," citing a 2026-04 campaign that supposedly burned $9,534 for 5
purchases / $153 (0.02 ROAS). **That number came from reading the wrong insights field.**

App subscriptions do not appear in `actions`. They appear in the separate **`conversions`**
field as `subscribe_mobile_app`. Read correctly, that campaign's real result was:

| Campaign | via `actions` (the old, wrong read) | via `conversions` (actual) |
|---|---|---|
| `iOS App Promotion Testing - Copy` — $9,534, SUBSCRIBE-optimized | 5 purchases / $153 | **107 `subscribe_mobile_app` @ $89.11** |
| `iOS App Promotion Testing` — $4,500, PURCHASE-optimized | 75 purchases / $4,899 | 4 `subscribe_mobile_app` |

Each campaign reports strongly on the event it optimized for, so the two are not directly
comparable — but the SUBSCRIBE campaign plainly produced 107 subscribes, not 5.

As of 2026-08-02 the eligibility block is also gone: the pixel has logged **26 Subscribe
events between Jul 6 and Aug 2** (server-side from RevenueCat — they predate the web
PageView stream, which only starts 7/26), and Meta now offers SUBSCRIBE in the optimization
picker. Live campaign: `iOS | Scale | AppPromo | Subscribe` (`120252435988190666`).

Known constraint, not a blocker: exiting learning needs 50 conversions/7 days. At $150/day
that implies a ~$21 CPA, well under what this account achieves, so the ad set will run
Learning Limited indefinitely. Budget it as an experiment with a kill number.

`--optimize subscribe` on an app platform is still behind `--force` in the client — the
guard is now a speed bump rather than a prohibition. **Use `view` to read the result,
never `report`** (see below); `report` reads `actions` only and will show 0 subscribes forever.

## Shipping ads
```
node client/meta.mjs build /path/to/creatives --platform ios     # PAUSED, new campaign+adset, one ad per file
node client/meta.mjs build /path/to/creatives --platform android
node client/meta.mjs list ads
node client/meta.mjs activate <adId> <adId> ...
node client/meta.mjs report 3
```
- Add to an existing ad set: `build <dir> --platform ios --adset <ADSET_ID>`.
- Ship live immediately: add `--active`.

## Reading performance: use `view`, not `report`

`report` is the legacy one-line-per-ad summary. It reads only `actions`, so **it cannot see
subscribes** — they live in `conversions` as `subscribe_mobile_app`. Prefer `view`.

```
node client/meta.mjs view [funnel|creative|money|all] [days] [--level ad|adset|campaign]
                          [--campaign <id>] [--since YYYY-MM-DD] [--until YYYY-MM-DD]
```

Defaults: `funnel`, 7 days, `--level ad`. Column sets:

| View | Columns | Use it for |
|---|---|---|
| `funnel` | spend, imp, CPM, CTR, visits, vis→ins, inst, CPI, reg, sub, CPS, ins→sub | Comparing campaigns on different optimization goals. Step-by-step drop-off is the only fair comparison. |
| `creative` | spend, imp, CPM, clicks, CTR, CPC, plays, hold, p100, inst, CPI | Ranking creatives. `hold` = thruplay/plays, `p100` = completions/plays. |
| `money` | spend, inst, CPI, reg, CPR, sub, CPS, pur, rev, ROAS | Cost per outcome and payback. |
| `all` | every column | Everything, wide. |

Notes on the numbers:
- **`sub` reads `conversions:subscribe_mobile_app`; `pur` reads `actions:fb_mobile_purchase`.**
  They are deliberately separate columns. `fb_mobile_purchase` is the pre-2026-04 RevenueCat
  event and `subscribe_mobile_app` the current one — summing them double-counts any window
  spanning the cutover.
- `plays` is `video_play_actions` (video starts, excluding replays). Meta retired
  `video_3_sec_watched_actions`, so this is **not** a 3-second hook rate; don't relabel it as one.
- TOTAL is recomputed from summed raw fields, not averaged across the printed rows —
  averaging a ratio column would weight a $2 ad the same as a $200 one.
- Adding a metric: add an entry to `METRIC` in `client/meta.mjs` (declare the raw insight
  fields it `need`s and how to derive it) and list its key in a `VIEWS` preset. A view only
  requests the fields its columns actually use. If the field returns
  `[{action_type, value}]`, add it to `ARRAY_FIELDS` or the TOTAL row will silently zero out.

### Optimization target
`--optimize installs|purchase|registration` (default `installs`) picks what Meta optimizes
delivery toward. Anything other than `installs` is app-event optimization: it sends
`optimization_goal=OFFSITE_CONVERSIONS` plus a `custom_event_type`, and adds a 7-day
click attribution window so downfunnel events that land days after the click still train
the model. Add `--cbo` to put the budget on the campaign instead of the ad set.

```
node client/meta.mjs bootstrap --platform ios --optimize purchase --cbo --budget 150
node client/meta.mjs clone <winningAdId> --to <newAdSetId>    # reuse a proven creative
```

`clone` reuses the existing creative object rather than re-uploading the video, so the new
ad inherits the original post's likes/comments/shares instead of starting cold. Use it when
the destination is unchanged.

`remix` reuses a proven ad's **video** but builds a fresh creative for a different
destination — e.g. taking an App Store winner and re-pointing it at the web paywall.
Social proof is not inherited; that's the unavoidable cost of changing the link.

```
node client/meta.mjs remix <adId> --platform web --optimize subscribe --force --budget 60
```

### Web conversion campaigns (`--platform web`)
`config.app.web` drives to `landingUrl` and converts on `pixelId` instead of an app store.
Differences the client handles automatically: objective `OUTCOME_SALES`, `promoted_object`
carries `pixel_id` (not `application_id`), `destination_type: WEBSITE`, no SKAN, no
`app_install_state`, and a 1-day view-through window is added alongside the 7-day click
(SKAN app campaigns reject view-through; web doesn't, and the extra signal matters when
conversion volume is this thin).

### The proven configuration
The account's only profitable campaign — "iOS App Promotion Testing", $4,500 → 75
purchases at $60 CPA, 1.09 ROAS — ran: `OFFSITE_CONVERSIONS` / `PURCHASE`, SKAN on, CBO at
$175/day, 7-day click attribution, Advantage audience on, `app_install_state=not_installed`.
Its best creative was **facebookforsportbetting.mp4** (ad `120244159968280666`, creative
`1530882931795377`): $2,598 → 413 installs at $6.29, 56 purchases at $46, **1.46 ROAS**.
`--optimize purchase --cbo` reproduces that setup. Reproduce it, don't reinvent it — but
note it will fail at ad-set creation until the event pipeline above is repaired.

## Account facts
| | |
|---|---|
| Ad account | `act_2206204643248135` (WagerProof Ad Account v3) |
| Business | `762004099805747` (WagerProof Main Business Portfolio) |
| Page | `922824830922715` (WagerProof) |
| iOS / Android apps | TODO in config.json |

⚠️ The signed-in Meta user also has access to Honeydew, Orbital Focus, and other
accounts. This client is hard-locked to the account in `config.json` — keep it that way.
