# Ticket #035 — Polymarket live fallback not ported in B04

## Summary

The Swift `PolymarketService.markets(...)` actor reads from the
`polymarket_markets` cache in Main Supabase. When the cache misses,
the RN service falls back to the live `gamma-api.polymarket.com`
endpoint (`getAllMarketsDataLive` in `services/polymarketService.ts`).
The Swift port returns nil on cache miss; the live fallback is a
follow-up.

## Why

The live fallback path requires:
- Fuzzy team-name matching across NFL/CFB/NBA/NCAAB/MLB mascot maps
  (~200 lines).
- A separate `getPriceHistory` REST call per market token.
- Token extraction from event metadata.

Because `pg_cron` refreshes the cache hourly in production, cache
misses are rare; we accept the small loss of coverage during the cache
warm-up window in exchange for a smaller B04 footprint.

## Acceptance for resolution

- Port `getTeamMascot`, `getLeagueEvents`, `findMatchingEvent`,
  `extractAllMarketsFromEvent`, and `getPriceHistory` to Swift
  (private actor helpers).
- Call the live path from `markets(...)` when cache returns nil.
- Add an integration test confirming a known cache-miss game returns
  data via the live API.
- Remove this waiver comment.

## Affected files

- `wagerproof_ios_native/WagerproofKit/Sources/WagerproofServices/PolymarketService.swift`
