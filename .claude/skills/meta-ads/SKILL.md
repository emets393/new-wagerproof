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
- Page **922824830922715** ("WagerProof"); no Instagram account linked yet (runs FB + Audience Network until one is added to `config.json`)
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
node client/meta.mjs bootstrap --platform ios|android [--budget <usd>] [--name "<adset>"] [--active]
node client/meta.mjs build <dir> --platform ios|android [--adset <id>] [--budget <usd>] [--active]
node client/meta.mjs list [ads]
node client/meta.mjs report [days]
node client/meta.mjs activate <adId> [more...]
node client/meta.mjs pause <adId> [more...]
node client/meta.mjs rename <id> "<new name>"
```

## How to ship a batch
1. `node client/meta.mjs check` — confirm "WagerProof Ad Account v3" + token OK.
2. Drop creative files (`.mp4/.mov` or `.png/.jpg`) in one folder.
3. `node client/meta.mjs build <folder> --platform ios` — creates a campaign + ad set (or `--adset <id>` to add to an existing one), one ad per file, **PAUSED** by default. Run again with `--platform android` for Android. Ad names: `Concept_<PLAT>_MMDD`.
4. Review previews, then `node client/meta.mjs activate <adId> ...` (or `build ... --active`).
5. `node client/meta.mjs report 3` for spend/CPI.

## Conventions
- Objective `OUTCOME_APP_PROMOTION`, optimization `APP_INSTALLS`, CTA `INSTALL_MOBILE_APP`, ABO (budget on ad set). Editable in `config.json`.
- Per-platform: iOS sets `is_skadnetwork_attribution` (required for iOS14+); Android does not. Store URL / app id / OS come from `config.app[platform]`.
- Naming: campaign `{PLAT} | Scale | AppPromo | Main`, ads `Concept_<iOS|AND>_MMDD`.
- Node 18+ (global fetch/FormData/Blob), no `npm install`. Video thumbnails auto-pulled from Meta after transcoding.
- Add `instagramActorId` to `config.json` to enable Instagram placements.
