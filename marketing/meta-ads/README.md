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

## Account facts
| | |
|---|---|
| Ad account | `act_2206204643248135` (WagerProof Ad Account v3) |
| Business | `762004099805747` (WagerProof Main Business Portfolio) |
| Page | `922824830922715` (WagerProof) |
| iOS / Android apps | TODO in config.json |

⚠️ The signed-in Meta user also has access to Honeydew, Orbital Focus, and other
accounts. This client is hard-locked to the account in `config.json` — keep it that way.
