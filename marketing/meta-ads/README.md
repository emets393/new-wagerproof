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

## Meta Ads MCP connector (Claude)

The official Meta connector (`https://mcp.facebook.com/ads`, added via Claude
Settings → Connectors) is a **second, independent path** into the same ad
accounts. Use it for reporting and one-off edits; the CLI above stays the
shipping path for creative upload and batch builds.

**The connector has no account lock.** Scope is granted once at Facebook-Login
time and there is no account switcher afterward, so every request must name the
ad account explicitly.

| Ad account | Name | Business | Use it? |
|---|---|---|---|
| `2206204643248135` | WagerProof Ad Account **v3** | `762004099805747` WagerProof Main Business Portfolio | ✅ **canonical — live, spending** |
| `16556569` | WagerProof Ad Account | `1093098979696321` WagerProof **Old** | ❌ dormant, zero spend |
| `1414931413409228` | Emet Soler | *(personal)* | ❌ |

⚠️ **The two WagerProof accounts differ by one token (`v3`).** That near-collision
is how the connector got pointed at the wrong account on first setup. Always pass
`2206204643248135` and confirm the returned name ends in **v3** before any write
(`ads_create_campaign`, `ads_update_entity`, `ads_activate_entity`, budget changes).

Re-scoping the grant, if ever needed: removing the connector in Claude does **not**
revoke the Facebook-side authorization — also remove it at
`facebook.com/settings?tab=business_tools` (Settings → Security → Business
Integrations), or the portfolio picker won't reappear on reconnect.
