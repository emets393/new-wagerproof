# Current backend status

The September 16 backend deployment is complete for entitlement and agent/leaderboard access. See [deployment and compatibility verification](backend-release-20260916.md), which supersedes source-only backend notes below and identifies the public research-feed and purchase-testing boundaries.

# Tiered paywall experiment

## Current display names

The customer-facing tiers are **Premium**, **Premium Plus**, and **Pro**. Native paywalls, feature gates, current-plan labels, developer previews, and web UI use these names. Historical setup notes below use the old marketing names. Billing IDs, prices, ranks, placement IDs, URL values, and entitlement mappings have not changed:

| Display name | Internal tier | Permanent RevenueCat entitlement |
| --- | --- | --- |
| Premium | `standard` | `WagerProof Standard` |
| Premium Plus | `premium` | `WagerProof Premium` |
| Pro | `pro` | `WagerProof Pro` |

Store-managed and RevenueCat-hosted checkout product labels are separate remote configuration; this source change does not rename those remote labels.


## Status

Native SwiftUI and web previews, cumulative access policies, contextual upgrade routing, and an undeployed server migration are implemented alongside the existing paywalls. **The RevenueCat catalog, six Apple subscriptions, six Google Play base plans, and all six web products in both production and sandbox are created and priced. New store subscriptions cover all supported countries, including future territories. Apple reports `READY_TO_SUBMIT`; Google plans remain `DRAFT`. App-level country expansion is a next-release step. Version-only iOS 3.6.3 checkout and a dedicated production RevenueCat hosted web link are enabled for testing; the default paywall remains legacy. No existing subscription access has changed.**

Verified September 15, 2026 UTC: RevenueCat MCP can manage the catalog and create Apple drafts through saved credentials. Its targeting write scope and Google Play service-account write permissions are missing, but the signed-in WagerProof Chrome profile allowed dashboard setup. The browser connector's other Chrome profile is a different RevenueCat account. See [setup-status.md](setup-status.md) for completed changes, exact IDs, and remaining work.

## Confirmed feature anchors

| Tier | Included features | Count |
| --- | --- | ---: |
| Standard | Game data/matchups, WagerProof predictions, prediction markets, Discord | 4 |
| Premium | Everything in Standard, plus Outliers, Player Props, Parlay God, Cheat Sheets | 8 |
| Pro | Everything in Premium, plus personal agents, agent picks/autopilot, full agent leaderboard | 11 |

Pro copy promises up to 30 saved agents and 8 active **in the native office**. The existing web/backend allowance remains 10 active; the native office has 8 desks. This pass does not reduce existing limits. No unlimited-picks claim: the legacy generator enforces 3 generations/day, and generation workers also limit picks per run. Existing WagerBot/Connect AI Pro checks remain intact.

## Access and legacy subscribers

### RevenueCat is the source of truth

Use existing store products and RevenueCat entitlements to preserve access. Do not introduce a separately maintained grandfathered-account registry. All legacy App Store, Google Play, and web products retain their existing Pro entitlement and renewal terms. New Standard/Premium products grant only their matching entitlements; new Pro products grant the existing Pro entitlement. Lifetime purchases retain lifetime access. Normal subscription expiration rules remain in effect.

`subscription_tier_access` is a derived, rebuildable RevenueCat cache for database authorization, not an independently administered subscription system. Its tier and new-catalog history must come from verified RevenueCat data. No manual enrollment or legacy-account backfill is required for this design.

Keep existing offerings and old-client package mappings intact. Offer the tiered catalog only through compatible app versions and the eligible web flow. Native and web now resolve offerings through RevenueCat placements before rendering or purchasing. Dashboard audience rules and local readiness flags both apply; direct tiered offering-ID lookups are removed. Web Billing does not send an app version, so mobile-version targeting alone cannot protect web purchases.

Store levels govern subscription changes, not feature authorization. On Apple, evaluate the existing subscription group and place equivalent legacy full-access products at the Pro service level. Do not create a separate legacy/new group just to hide downgrade options: separate groups allow concurrent billed subscriptions. On Google Play, keep existing subscriptions/base plans intact and model new benefit tiers as separate subscriptions with monthly/yearly base plans.

Compatibility boundary: an existing full-access subscriber remains fully supported on old versions because the Pro entitlement identifier stays unchanged. A new lower-tier subscriber on an old Pro-only client is a separate unresolved rollout case. Do not attach the Pro entitlement to lower-tier products as a workaround. Likewise, full access after an intentional switch from a legacy plan to Standard/Premium is not guaranteed by product mappings; retaining that benefit would need a separate explicit RevenueCat access policy. Neither case is solved by store subscription ranks alone.

- Every active `WagerProof Pro` entitlement remains highest-tier access, including existing monthly, yearly, lifetime, and promotional products. Do not reassign those products to lower entitlements.
- A higher entitlement always wins when entitlements overlap. Server reconciliation probes stored, lowercase, and historical uppercase RevenueCat identities. Native lower-tier reconciliation also consults that server result before applying access.
- Additional restrictions apply only to customers with dedicated new-catalog products or Standard/Premium entitlement history. Installing the update or opening a preview does not enroll an existing user. Legacy free previews retain their existing behavior. This preserves subscription benefits, not a new perpetual grant after cancellation/expiration.
- Standard satisfies the app's paid-access/onboarding checks. Premium gates cover Props and Outliers, their detail screens, advanced tool routes, Parlay God, and Cheat Sheets. Agents/picks/leaderboard remain Pro. Search and embedded agent-consensus surfaces respect the new cohort.
- Contextual upgrade sheets default to Pro and omit insufficient plans: Props offers Premium/Pro; Agents offers Pro. Web links preserve the minimum tier in the URL.
- `profiles.subscription_active` retains its **legacy Pro meaning**. Any-paid access comes from the new explicit tier. This avoids old agent RPCs interpreting every paid plan as Pro.
- `subscription_tier_access` is server-written, self-readable, and not client-writable. The migration adds restrictive pick-read/agent-create policies and cohort guards to existing agent permission helpers. Existing free and legacy subscriber paths remain intact.
- The migration and edge changes are source-only. Premium research datasets served through the secondary/public data project still need a server authorization audit before paid rollout; UI gates alone do not protect those raw feeds. Expo/Android tier parity is also a separate rollout prerequisite if the same new products are offered there.

## Open the previews

### Device onboarding test build, September 15

- Built, signed, installed, and launched on the paired iPhone 14 Pro. The running process was confirmed after launch.
- The DEBUG-only `-enableTieredOnboardingPreview` launch argument persists the device-local `tieredOnboardingPreview` setting. With it enabled, the actual `PostOnboardingPaywall` host renders the new non-purchasing design. A Developer setting named **New onboarding paywall preview** can turn it off. Release builds ignore this setting.
- Onboarding has no X or swipe dismissal. In-app tiered sheets retain the X, verified by opening/dismissing Standard's Premium upgrade sheet. Real tiered onboarding also forces `allowClose: false`, independently of legacy offering close metadata.
- The countdown is centered in a ZStack, independent of the left-aligned logo and optional right-hand close button.
- The phone was launched directly into the onboarding host using `-uiScreenshotMode customPaywall` for immediate review. Force-quit and reopen to return to the normal app; the onboarding preview setting stays enabled. No customer onboarding profile was reset.
- Live purchases and targeting remain disabled. This device build is for design/flow testing, not end-to-end billing verification.

### Responsive web layout, September 15

- At widths of 960px or more, plans and Continue occupy the left column. The feature comparison, membership card, and reviews scroll independently on the right. Continue is directly below the options.
- Smaller widths retain the single-column flow and fixed checkout footer.
- Verified in Chromium at 1440x1000 and 390x844: right-panel wheel scroll reached 700px while page scroll stayed zero and plans/Continue stayed fixed; neither viewport had horizontal overflow. Web production build and 34 focused billing/placement/access tests passed.
- Screenshots: `output/playwright/tiered-desktop.png`, `output/playwright/tiered-mobile.png`. Web changes are local, not deployed.

### Next: current plan and upgrades (not implemented yet)

Show the verified current tier separately from the selected offer, with an **Already included** grouping and a clear **Adds with Premium/Pro** grouping. Standard should see Premium/Pro upgrades, Premium should see Pro, and Pro should see full-access status and subscription management. Label legacy subscribers **Pro · Existing plan** without presenting new-catalog prices as their renewal amount. Billing-period changes and downgrades belong in subscription management until the store/web change paths are tested; the upgrade flow must not create duplicate subscriptions.

- Native: Settings, double-tap App Version, then **Developer > Test Tiered Paywall**. This always opens the isolated design preview without starting purchases or signing out the account.
- Simulator launch: `xcrun simctl launch --terminate-running-process D69B4254-398D-4806-921B-56411888C597 com.wagerproof.mobile -uiScreenshotMode tieredPaywall`
- Append `-tieredPreviewAnchor 0.43 -tieredPreviewTier standard` for locked Premium badges; use `0.61` with `premium` for Pro badges and the tier card, or `1` for the bottom section.
- Test actual gates with `-uiScreenshotMode propsLoaded -tieredTestAccess standard` or `-uiScreenshotMode agentsLoaded -tieredTestAccess premium`. `-tieredTestAccess legacy` uses the existing Pro fixture. In screenshot mode, contextual sheets use non-purchasing preview prices.
- Web: `/plans/tiers?period=monthly`. Tier and period remain in the URL. The preview route is marked `noindex,nofollow`.
- Local web server: `npm run dev -- --host 127.0.0.1 --port 5180 --strictPort`, then open `http://127.0.0.1:5180/plans/tiers`.

## Catalog

All amounts are USD. Web prices use 70% of the in-app amount, rounded to the nearest cent.

| Tier | App monthly | App yearly | Web monthly | Web yearly |
| --- | ---: | ---: | ---: | ---: |
| Standard | $19.99 | $199.99 | $13.99 | $139.99 |
| Premium | $29.99 | $299.99 | $20.99 | $209.99 |
| Pro | $79.99 | $359.99 | $55.99 | $251.99 |

The reference calls the first two tiers Premium and Premium+. This experiment uses the requested Standard and Premium names. Pro is selected by default and carries a “Most popular” tag on monthly billing. Native USD yearly Premium and Pro show crossed-out reference prices of $719.88 ($59.99 × 12) and $1,559.88 ($129.99 × 12), with rounded savings of 58% and 77% against $299.99 and $359.99. Both the strike-through and badge use the same comparison baseline in preview and live checkout. Other native currencies compare the localized annual price against twelve matching-currency monthly payments, rather than reusing USD reference amounts. The Early Bird label is removed. Web crossed-out prices continue to compare the browser offer with the in-app price; this native display update does not change web or store billing amounts. Explicit preview or browser tier selections are preserved. The native header reuses PicksExpiryPill and the persisted three-hour PicksExpiryService deadline. Closing or minimizing starts its existing Live Activity; purchase, restore, and verified browser checkout clear it. Existing paid customers are excluded from the hold except in explicit preview mode.

Each new product grants only its matching tier entitlement. Existing products keep their existing Pro attachment; do not attach Standard/Premium entitlements to legacy products. Cumulative access is resolved in code.

See [products.json](products.json) for verified RevenueCat IDs, Apple and Google Play identifiers, production/sandbox web product IDs, package identifiers, saved prices, and per-platform status. Its status is `worldwide_store_prices_configured_rollout_pending`. Apple has 175 priced/available territories; each Google plan has 173 explicit priced regions plus enabled future/other-region configuration.

## Finish billing setup

See [RevenueCat placement setup](revenuecat-placements.md) for exact identifiers, targeting rules, implemented routing, and the live QA checks needed before activating this catalog.

1. Deploy and verify the tier-access migration before deploying the updated webhook/resolver/agent edge functions. Complete the Premium data-source authorization audit. Exercise legacy aliases, renewal, expiry, refund, overlapping plans, and access during outages in staging.
2. Six Apple drafts reuse the existing `default` subscription group. Verify/assign service levels with equivalent legacy full-access products at Pro level. Do not modify existing subscriber prices.
3. Worldwide subscription availability and localized prices are saved. Google benefit metadata is saved and verified. All six new Apple products now reuse the exact legacy monthly/yearly review screenshot, verified by checksum. Verify Apple tier ordering, then submit/review and activate the new products when rollout prerequisites pass. Expand **app-level** distribution to all supported countries with the next release; changing it early would also expand the current version. Play's current production release is US-only. See the release steps and official references in [setup-status.md](setup-status.md).
4. RevenueCat registration, entitlements, and product attachments are complete. Keep one matching entitlement per product; cumulative access is resolved in code. All 16 original products remain attached to the existing Pro entitlement.
5. All six Web Billing products are created, priced, and attached in both production and sandbox. Configure and test subscription-change paths among the new products; leave existing change paths unchanged. The existing RevenueCat web SDK and payment processors remain in use.
6. The non-current offering `wagerproof_tiers_v1` is created with six packages: `standard_monthly`, `standard_yearly`, `premium_monthly`, `premium_yearly`, `pro_monthly`, and `pro_yearly`. Each maps to four registered products: Apple, Google Play, web production, and web sandbox. Apple/Google catalog registration does not mean those store products are ready to purchase. Native catalog readiness is enabled for internal TestFlight QA; web readiness remains false. The version-only iOS 3.6.3 rule is active; the web placement rule remains inactive; Android routing awaits a compatible implementation/version.
7. Verify sandbox purchase, cancellation, pending purchase, restore, upgrade/downgrade, expiration, existing subscribers, and cross-device/browser account identity. The web sign-in must use the same WagerProof account as mobile.
8. For public rollout, only after those checks, set offering metadata `tiered_catalog_ready: true` and `tiered_web_ready: true`, set `TieredPaywallConfiguration.enabled = true` in Swift, and set `TIERED_CHECKOUT_ENABLED = true` in the web page. These flags do not themselves implement feature access.

Native checkout only accepts exact offering/package/product matches. It refreshes customer info and checks the selected entitlement before finalizing. Restore and browser return require an active tier entitlement. The hard paywall retains an unavailable-catalog escape.

The native browser button opens the dedicated RevenueCat hosted Purchase Link with the authenticated RevenueCat user ID in the path and USD currency. It displays all six web options without a website sign-in. It requires the US StoreKit storefront, an exact USD in-app price match, and hosted-link readiness metadata. Returning from the browser forces a network refresh of entitlements. Build 381 retains its disabled website route; the updated build consumes the separate hosted-link metadata. The independent website checkout continues to validate its own packages and prices.

## Visual implementation

- Native SwiftUI ScrollView, plan radio cards, billing toggle, included and locked feature rows, cumulative tier card, horizontal review cards, restore, sign-out, legal links, renewal disclosure, and copyright. Web mirrors this, except the review cards are a responsive grid rather than a carousel — two 320px cards clipped inside the 600px column.
- The fixed Continue/browser footer uses a gradient-masked native material blur. Reduce Transparency uses a solid surface. Tier animations honor Reduce Motion.
- Generated jade/mint lightning and loop artwork uses WagerProof's `#22C55E` palette. Both final PNGs are stored in native assets and `public/paywall/`.
- The web artwork is a blurred backdrop pinned to the **viewport** (`.tiered-paywall:before`), not to the 600px reading column. Scoped to the column it rendered as a floating banner with black rails on desktop. Native keeps its own 280pt header treatment, which already spans the phone's full width.
- Rating snapshot: US iTunes lookup on September 14, 2026 returned 4.73514 from 185 ratings, displayed as 4.7. **The rating count is deliberately not shown on either platform** — the block is a fractional five-star row, `4.7 out of 5`, and an `App Store rating` label. Short review excerpts come from WagerProof's own App Store listing. Refresh the score before launch.
- Feature descriptions describe existing WagerProof research tools rather than promising the reference app's arbitrage and middle-betting products.

## Validation

Placement integration pass: native and web builds passed; 34 focused JavaScript tests and six Swift policy tests passed. The new simulator build was installed and the tiered design preview launched. The version-only iOS test rule is active; purchase/restore verification and web targeting remain pending. See [setup-status.md](setup-status.md).

Latest polish/access pass:

- 23 Vitest checks pass for prices, entitlement priority, cohort enrollment, expired entitlements, alias reconciliation, and outage behavior. Run `npx vitest run src/features/tieredPaywall supabase/functions/shared/entitlements.test.ts`.
- 3 native XCTest policy tests pass. They were run against the exact model/test sources in an isolated Swift package to avoid unrelated iOS-only package dependencies on the host.
- The migration and SQL assertions pass in a disposable local Supabase Postgres container with `supabase/tests/fixtures/subscription_tier_access.sql`. Verified lower-tier denial, legacy access, self-only reads, and blocked client tier updates. This is a focused policy test, not a full production migration rehearsal.
- Deno checks pass for shared entitlements, agent-authorized-action-v1, the webhook, and resolve-my-entitlement. The older generate-avatar-picks endpoint still has 7 pre-existing type errors in its generation/prompt code; no clean full edge-function check is claimed.
- Simulator: Standard Props opens a Premium/Pro offer; Premium Agents opens a Pro-only offer; the legacy Pro fixture still opens its populated agent office. These are runtime checks with fixture subscriptions, not live purchases.

Earlier layout checks and remaining boundaries:

- Debug build succeeded for the required iPhone 17 Pro Max, iOS 26.0, device ID `D69B4254-398D-4806-921B-56411888C597`.
- Installed and launched the built app, inspected native UI, switched monthly/yearly and tiers, verified included/locked rows and the selected web-price preview.
- All six native tier/period combinations were checked through the Simulator accessibility tree. The lower section was rendered with the debug scroll anchor. Swipe-gesture verification remains manual because automated Simulator drag/scroll actions did not move the view.
- Web production bundle succeeded (`npm run build:no-prerender`). Browser inspection verified monthly/yearly prices, tier selection, URL persistence, and disabled preview checkout.
- `npx vitest run src/features/tieredPaywall/billing.test.ts`: nine billing tests, included in the 23 above.
- Repository-wide TypeScript check reports errors in unrelated files; no tiered-paywall file errors were reported. ESLint could not initialize the repository's `@typescript-eslint/no-unused-expressions` rule. Full repository checks are not claimed as passing.
- Product creation and RevenueCat attachments were subsequently verified during billing setup; see [setup-status.md](setup-status.md). No live purchase, deployment, App Store submission, or paid-access activation has been verified.
- Screenshots are saved in `.context/paywall-previews/`: `monthly.png`, `yearly.png`, and `reviews-and-footer.png`.

## Sources

- The five attached reference screenshots.
- [WagerProof App Store listing](https://apps.apple.com/us/app/wagerproof-sports-research-ai/id6757089957)
- [Apple review guidelines, payments](https://developer.apple.com/app-store/review/guidelines/#payments)
- [RevenueCat Web Billing product setup](https://www.revenuecat.com/docs/web/web-billing/product-setup)

## Image prompts

Generated with the built-in image generation tool. Final files:

- `wagerproof-ios-native/Wagerproof/Assets.xcassets/TieredPaywallArtwork.imageset/artwork.png`
- `wagerproof-ios-native/Wagerproof/Assets.xcassets/TieredPaywallBolt.imageset/bolt.png`
- Web copies: `public/paywall/tiered-artwork.png` and `public/paywall/tiered-bolt.png`.

Background prompt: Polished 3D abstract artwork for WagerProof's black subscription screen. Wide composition with floating chunky lightning bolts and rounded tubular loops, glossy jade #22C55E, pale mint #BBF7D0, and charcoal metal. Objects at the top and outer edges, dark center and bottom, green rim lighting, black background fading to black. No text, logo, or UI. Blur in native code behind the heading.

Bolt prompt: Single chunky sculptural lightning bolt, glossy jade #22C55E front, emerald bevels, pale mint #BBF7D0 highlights, three-quarter angle, studio lighting, centered with padding, transparent background, no text or logo. The returned asset includes a dark glow background; native and web use screen blending on the black tier card.

## Latest simulator captures

- `.context/paywall-previews/polished-monthly.png`
- `.context/paywall-previews/polished-yearly.png`
- `.context/paywall-previews/polished-standard-features.png`
- `.context/paywall-previews/polished-premium-features.png`
- `.context/paywall-previews/standard-props-upgrade.png`
- `.context/paywall-previews/premium-contextual-paywall.png`
- `.context/paywall-previews/pro-contextual-paywall.png`
- `.context/paywall-previews/legacy-pro-agents.png`


### Purchasing QA build

Internal-only TestFlight **3.6.3 (382)** enables native checkout and direct RevenueCat hosted web checkout for all accounts on that exact app version, without account enrollment. Open **Settings → tap the app version twice → Test Tiered Purchases** to exercise real sandbox checkout without resetting onboarding. **Preview Tiered Design** deliberately never purchases. The purchasing entry is hidden in App Store installations and refuses a legacy, nil, or unready offering.

The iOS test rule is active for version 3.6.3 with no account enrollment required. Existing subscriptions and the default legacy offering are unchanged. See [setup-status.md](setup-status.md) for processing and testing boundaries.


## Hosted browser checkout follow-up

Mobile now opens RevenueCat directly using `tiered_hosted_web_url` and `tiered_hosted_web_ready`. The production selector and payment form were verified with all six discounted prices; no payment was submitted. Website deployment is not a dependency. Nine focused Swift policy tests and the simulator build passed. See [setup-status.md](setup-status.md) for the current TestFlight build and remaining purchase verification.

## Checkout button branding

Native checkout is labeled **Continue with Apple** with the Apple SF Symbol. It invokes the existing App Store subscription purchase, not Apple Pay. Hosted web checkout is labeled **Continue with Stripe · 30% off**, with a small “additional” under “30% off”, using the unmodified white wordmark from [Stripe’s official logo kit](https://stripe.com/newsroom/information). The asset is bundled as `StripeWordmark`; the browser action, URL, eligibility, and prices are unchanged.

The simulator build and yearly/monthly display checks passed for this update. Screenshot: `.context/paywall-pricing-buttons/yearly-annualized.png`. These changes are newer than TestFlight build 383 and require a new build for phone testing.

## Selected tier text and reviews

The selected Premium and Pro plan names use a smooth, static left-to-right gradient with a shadow glow. Color intensity increases from Standard's plain green to Premium's brighter mint/teal and then Pro's vivid, saturated electric green with the strongest glow. Each uses two similar colors to avoid harsh bands, and a single crisp text layer. The tier name in the card below the feature list uses the same treatment. All selected pricing cards use Standard's green, 2-point border; summary cards also share the same static border across tiers. There is no repeating animation or timer driving this effect.

The review scroller contains six attributed excerpts from WagerProof's real US App Store reviews, with 15-point text and room for longer descriptions. The generated, blurred background adds depth behind the cards. See [the asset and final generation prompt](reviews-background-prompt.md).

The picks-expiry pill and Live Activity start only when the onboarding host explicitly passes `showsPicksExpiry: true`. In-app and developer paywall presentations leave it off, regardless of their RevenueCat placement. Onboarding remains non-dismissible; in-app presentations retain their close button.

These changes are local and newer than TestFlight build 383. They do not change any charged subscription prices. The requested rounding increment for crossed-out yearly prices still needs clarification ($10 versus $19); current comparisons remain $719.88 and $1,559.88.

Previous visual captures are in `.context/paywall-glow-previews/`. The text animation shown in `pro-text-glow.mp4` and the earlier border animation have both been superseded by the static text effect.

## Tier artwork and Search trends gates

The paywall summary and every feature unlock card share `TierArtwork`, selecting a standalone bolt and background for the required tier. Standard keeps its original artwork, Premium adds a restrained mint/teal finish, and Pro has richer jade lighting, a soft aura and a few fine electrical arcs. All effects are static. [Saved assets and final prompts](tier-artwork.md) document the built-in image generation outputs.

Search's Historical Trends drawer now requires Premium. `HistoricalAnalysisView` also gates its shared destination, covering direct routes for MLB/NFL/CFB; locked previews do not fetch analysis/saved systems or expose system toolbar actions. `BettingTrendsDetailSheet` now requires Premium at the shared destination, covering Search and game/outlier entry points. Both gates use the existing new-catalog policy, preserving legacy access.

Verification on the designated iPhone 17 Pro Max simulator:

- Standard: Search → Trends shows the Premium card and hides the underlying controls from accessibility.
- Premium: Search → Trends → MLB opens the historical analysis and its filters/data.
- Direct MLB Historical Trends: Standard is locked; legacy Pro remains unlocked.
- Shared MLB situational-trends detail: Standard is locked; Premium sees the records.
- Existing subscription-policy suite: 12 tests passed, including cumulative and legacy access.
- Debug build passed; no new TestFlight build has been uploaded.

Captures are in `.context/tier-art-gates/`. The DEBUG-only `mlbTrendsDetail` screenshot target uses existing MLB fixtures to exercise the shared destination deterministically.

## Native Android parity and gate shimmer

See [Android parity](android-parity.md) for the native port, gate coverage, unchanged billing identifiers, debug previews, and remaining Play billing validation. Gate unlock labels now shimmer on both platforms; iOS respects Reduce Motion and scene activity, Android respects disabled animations and its resumed lifecycle. Tier titles and borders remain static.
