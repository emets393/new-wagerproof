---
name: meta-ads
description: >-
  Ship and manage WagerProof's Meta (Facebook/Instagram) app-install ad
  campaigns for iOS and Android. Use whenever the user wants to launch, upload,
  build, list, pause, enable, rename, budget, or pull performance for their
  Meta/Facebook/Instagram ads — e.g. "ship these ads to Meta", "launch the new
  video ads on iOS", "how are my Facebook ads doing", "pause the parlay ad",
  "what's my Meta spend / CPI". NOT for Apple Search Ads.
---

# WagerProof Meta Ads (Facebook / Instagram)

WagerProof runs Meta app-promotion ads via a zero-dependency, **platform-aware**
Node client in this repo. Use the client — do **not** hand-build in Ads Manager
or guess Graph endpoints.

## Where things live
- Client CLI: `marketing/meta-ads/client/meta.mjs` (run from `marketing/meta-ads/`)
- Config / source of truth: `marketing/meta-ads/config.json`
- Setup + strategy: `marketing/meta-ads/README.md`
- Token: `marketing/meta-ads/.env` → `META_ACCESS_TOKEN=...` (ads_management scope; **gitignored**)

## Account facts
- Ad account **act_2206204643248135** ("WagerProof Ad Account v3"), business **762004099805747** (WagerProof Main Business Portfolio)
- Page **922824830922715** ("WagerProof"), linked Instagram **17841439542265349** (@wagerproof_ai) — runs FB + Instagram + Audience Network
- **SAFETY: the client is hard-locked to the account in `config.json`. The signed-in Meta user also has access to Honeydew, Orbital Focus, and other accounts — never repoint it. Run `check` before shipping.**

## Apps
- iOS: Meta App ID `935005752525075`, App Store `id6757089957` ("WagerProof: Sports Research AI"), SKAN on.
- Android: Meta App ID `935005752525075`, package `com.wagerproof.mobile`.

## Last setup step
`config.json` is filled (apps, copy, account with billing confirmed). The only thing left is the token:
```
echo 'META_ACCESS_TOKEN=EAA...' > marketing/meta-ads/.env   # System User token, ads_management, assigned to act_2206204643248135
node client/meta.mjs check
```

## Commands (run from `marketing/meta-ads/`)
```
node client/meta.mjs check                                   # verify token, account, page, configured apps
node client/meta.mjs upload <file>                           # upload one image/video
node client/meta.mjs bootstrap --platform ios|android [--optimize purchase] [--cbo] [--budget <usd>] [--name "<adset>"] [--active]
node client/meta.mjs build <dir> --platform ios|android [--optimize purchase] [--adset <id>] [--budget <usd>] [--active]
node client/meta.mjs clone <adId> [more...] --to <adsetId> [--active]   # reuse a proven creative (keeps its social proof)
node client/meta.mjs list [ads]
node client/meta.mjs report [days]                            # legacy summary — CANNOT see subscribes
node client/meta.mjs view [funnel|creative|money|all] [days] [--level ad|adset|campaign] [--campaign <id>] [--since <d>] [--until <d>]
node client/meta.mjs activate <adId> [more...]
node client/meta.mjs pause <adId> [more...]
node client/meta.mjs rename <id> "<new name>"
```

## How to ship a batch
1. `node client/meta.mjs check` — confirm "WagerProof Ad Account v3" + token OK.
2. Drop creative files (`.mp4/.mov` or `.png/.jpg`) in one folder.
3. `node client/meta.mjs build <folder> --platform ios` — creates a campaign + ad set (or `--adset <id>` to add to an existing one), one ad per file, **PAUSED** by default. Run again with `--platform android` for Android. Ad names: `Concept_<PLAT>_MMDD`.
4. Review previews, then `node client/meta.mjs activate <adId> ...` (or `build ... --active`).
5. `node client/meta.mjs view funnel 3 --level campaign` for the funnel.

## Reading performance — use `view`, never `report`
`report` reads only the `actions` insight field. **App subscribes are not in `actions`** —
they are in the separate `conversions` field as `subscribe_mobile_app`. So `report` shows 0
subscribes forever, no matter how well a subscribe campaign is doing.

`view` has four column presets (defaults: `funnel`, 7d, `--level ad`):
- **`funnel`** — spend, imp, CPM, CTR, visits, vis→ins, inst, CPI, reg, sub, CPS, ins→sub.
  The right default when campaigns run different optimization goals; only the step-by-step
  drop-off compares them fairly.
- **`creative`** — adds plays / hold / p100 / CPC for ranking creatives.
- **`money`** — cost per outcome and payback (CPI, CPR, CPS, ROAS).
- **`all`** — everything.

`sub` and `pur` are separate columns on purpose: `fb_mobile_purchase` is the pre-2026-04
RevenueCat event, `subscribe_mobile_app` the current one; summing them double-counts any
window spanning the cutover. `plays` is `video_play_actions` (starts, not 3-second views —
Meta retired that metric); don't relabel it as a hook rate. Adding a column: extend `METRIC`
+ `VIEWS` in `client/meta.mjs`, and add any `[{action_type, value}]` field to `ARRAY_FIELDS`
or the TOTAL row silently zeroes.

## Downfunnel (purchase/subscribe) — re-probe, don't assume
App-event optimization was blocked account-wide as of 2026-07-31 (Meta rejected every event:
"not actively logged by your app" / "set up app events in Events Manager first"). **That
block has since lifted for SUBSCRIBE** — as of 2026-08-02 the pixel has 26 Subscribe events
since Jul 6 (server-side from RevenueCat) and Meta offers it in the picker. Live campaign:
`iOS | Scale | AppPromo | Subscribe` (`120252435988190666`). `--optimize purchase` may still
fail. **Re-probe before promising anything — don't assume broken, don't assume working.**

**CORRECTED 2026-08-02:** this doc previously said app SUBSCRIBE "is never sent" and cited
$9,534 → $153 (0.02 ROAS). That was a misread of `actions` on a campaign reporting into
`conversions`. Read correctly, `iOS App Promotion Testing - Copy` produced **107
`subscribe_mobile_app` at $89.11 CPA**, not 5 purchases. Do not repeat the old claim.

Real constraint on subscribe ad sets: exiting learning needs 50 conversions/7 days, which at
$150/day implies a ~$21 CPA this account has never hit. Expect Learning Limited indefinitely;
budget it as an experiment with a kill number rather than as the main spend line.

**Subscribe DOES work on `--platform web`.** Pixel `1731090704521232` actively logs Subscribe
(~3/week), so an `OUTCOME_SALES` web campaign converting at wagerproof.bet is creatable today —
it bills through RevenueCat Web, not Apple, and is a different funnel from app installs.
Live example: campaign `120252389505260666` "WEB | Scale | Subscribe | iOS Audience" (PAUSED,
$60/day), built with `remix 120252212377320666 --platform web --optimize subscribe --force`.

## Conventions
- Objective `OUTCOME_APP_PROMOTION`, CTA `INSTALL_MOBILE_APP`. `--optimize installs|purchase|registration`
  chooses the goal (`installs` default = `APP_INSTALLS`; the others are AEO —
  `OFFSITE_CONVERSIONS` + `custom_event_type` + a 7-day click window). ABO by default, `--cbo` for
  campaign budget. Editable in `config.json`.
- Best-performing setup on record: `--optimize purchase --cbo --budget 150`, creative
  `facebookforsportbetting.mp4` (ad `120244159968280666`) — $46 purchase CPA, 1.46 ROAS.
- Per-platform: iOS sets `is_skadnetwork_attribution` (required for iOS14+); Android does not. Store URL / app id / OS come from `config.app[platform]`.
- Naming: campaign `{PLAT} | Scale | AppPromo | {OPT}` (OPT = Installs/Purchase/Reg), ads `Concept_<iOS|AND>_MMDD`.
- Node 18+ (global fetch/FormData/Blob), no `npm install`. Video thumbnails auto-pulled from Meta after transcoding.
- Instagram placements are on: `instagramActorId` is set in `config.json` and `instagram` is in
  `defaults.publisherPlatforms`. Note Meta's Advantage+ placements may auto-expand an ad set beyond
  the configured platforms — check the ad set's actual `targeting` rather than trusting config alone.
