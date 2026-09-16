# RevenueCat placement setup

Status, September 15, 2026 UTC: iOS rule `e-ClhzcQQy` (**App version 3.6.3**) is active and ordered before the Default Rule. It requires only App Store app `app450d144c7c` and exact marketing version `3.6.3`; there is no account attribute requirement. Its four mobile placements map to `wagerproof_tiers_v1`. Other versions retain the unchanged legacy default. The current offering remains `hardPaywall`.

Web rule `gxnB9Oc2V3` is prepared for production checkout, scoped only to the production and sandbox Web Billing apps. The QA attribute condition has been removed. Activate it above the catch-all Default Rule after the release PR merges. The website checkout flag and `tiered_web_ready` are enabled; the legacy fallback remains `hardPaywall`. **Mobile browser checkout now goes directly to RevenueCat's hosted production Purchase Link**, independently of that website placement. `tiered_hosted_web_ready` is true and `tiered_hosted_web_url` identifies the new offering's dedicated link. Build 381 ignores those new keys and stays hidden; the updated native code is required. No customer attributes or subscription entitlements were changed. See [setup-status.md](setup-status.md).

## Placement identifiers

| Identifier | Use | Current source state |
| --- | --- | --- |
| `onboarding` | End-of-onboarding purchase screen | Already requested by legacy native and Expo flows |
| `generic_feature` | Settings and general in-app upgrades | Already requested by legacy native and Expo flows |
| `tier_upgrade_premium` | Outliers, Props, Parlay God, Cheat Sheets | Native gate resolves this placement before selecting its renderer |
| `tier_upgrade_pro` | Agents, agent picks, leaderboard | Native gate resolves this placement before selecting its renderer |
| `tiered_web_checkout` | Browser checkout for the new plans | Web resolves this placement for the authenticated customer, then rechecks at checkout |

Keep the existing `agent_feature` identifier available for compatibility. Start all new-tier placements with `wagerproof_tiers_v1`; separate offerings are optional when their products or metadata actually differ. Filter inadequate tiers in the UI using the existing minimum-tier requirement.

Create placement assignments through **Monetization tools > Targeting > Create a new rule > Add Placement**. Identifiers must match code exactly. Keep **for all other cases** set to the existing legacy offering, including old clients requesting `.current`. The project default also stays legacy. Explicit **No Offering** returns nil and must be handled without substituting a purchase screen. [Placements](https://www.revenuecat.com/docs/tools/targeting/placements)

## Audience and rollout

Confirm the WagerProof project has RevenueCat Pro or Enterprise access to Targeting. Create an inactive rule scoped to the specific App and a compatible unreleased marketing version, then test it in TestFlight against the production version. Rules match top to bottom; inspect existing Experiments too, since experiment enrollment takes precedence. App version means marketing version, not build number. Web Billing sends no app version and needs a separate eligibility flow. [Targeting](https://www.revenuecat.com/docs/tools/targeting)

Keep active legacy Pro customers out of acquisition paywalls by checking RevenueCat entitlements. Placements choose an offer; they do not grant or revoke access. Existing product-to-Pro attachments stay unchanged. [Entitlements](https://www.revenuecat.com/docs/getting-started/entitlements)

Optional audience attributes belong in RevenueCat, not a separate account registry. If an attribute determines the current session's offer, sync attributes and offerings before displaying it. Attributes must not substitute for verified purchase entitlements. [Custom attributes](https://www.revenuecat.com/docs/tools/targeting/custom-attributes)

## Implemented routing

- `RevenueCatService.offering(forPlacement:)` syncs pending attributes and offerings, checks that the SDK identity did not change, and returns the SDK placement result. A missing offerings response is a fetch error; an intentional nil placement is No Offering. Neither path substitutes `.current` or a separately cached offering.
- Native onboarding resolves `onboarding` while retaining `post_onboarding` as its analytics source. In-app gates resolve `generic_feature`, `agent_feature`, `tier_upgrade_premium`, or `tier_upgrade_pro` as appropriate.
- Both native hosts choose the renderer **after** placement resolution. A legacy offer uses its existing renderer. The tiered offer requires the local rollout flag and `tiered_catalog_ready`; otherwise it shows an unavailable state. Existing Pro subscribers are excluded from acquisition screens outside explicit previews.
- `TieredPaywallView` accepts the resolved Offering and keeps its original Package objects. It never reads `.all[offeringID]`. Minimum-tier filtering and exact package/product validation remain in place. No Offering dismisses onboarding or shows a closeable empty state in-app; network errors offer retry without another offering fallback.
- Web `/plans/tiers` calls `getCurrentOfferingForPlacement("tiered_web_checkout", { currency: "USD" })` for the authenticated SDK identity. Sign-out/account changes invalidate pending results. A nil, legacy, unready, or mismatched offer cannot buy a tiered plan. The legacy web paywall is unchanged.
- Web re-resolves the placement on Continue and passes the original verified Package to purchase. It does not reconstruct packages or fetch tiered packages from the global catalog.
- Mobile browser checkout appends the authenticated RevenueCat customer ID to `https://pay.rev.cat/sjaluffkdnitjajl/` and requests USD. It omits `package_id` so the hosted selector displays all six web options. SDK identity must match the signed-in Supabase UUID. Returning to the app forces a fresh CustomerInfo fetch before granting access. This route needs neither website authentication nor a website deployment. The independent website route still validates `origin` for attribution.
- `tiered_paywall_qa` remains a RevenueCat-managed customer attribute. The app does not self-enroll customers from preview mode, a URL, or an existing subscription. Native uses the SDK's attribute-sync method; web awaits attribute writes before the fresh placement request.
- The native renderer, catalog-ready flag, version-only iOS rule, and hosted checkout metadata are enabled. The website placement is prepared for activation after the release PR merges. Explicit design previews remain available without purchasing.

## Verification and remaining release checks

Focused tests cover native renderer selection (legacy, nil, disabled/unready tiers), web nil/legacy results, original Package attribution, account changes and sign-out during fetch, attribute/fetch failures, USD selection, and allowed browser origins. Existing price and entitlement regression tests also pass. Build results and remaining rollout boundaries are in [setup-status.md](setup-status.md).

Live QA still needs eligible/noneligible accounts, old marketing versions, intentional No Offering, sandbox purchases, and rollback against the actual rules before public rollout. New lower-tier accounts on old Pro-only apps remain a separate compatibility prerequisite. These tests do not require a new subscriber registry.

## Android parity verified September 16

Android now uses `awaitSyncAttributesAndOfferingsIfNeeded` and rejects a RevenueCat identity change while fetching. Neither `RevenueCatService`, `RevenueCatStore`, `PaywallScreen`, nor `PostOnboardingPaywall` substitutes a current/cached offering for a null placement. RevenueCat's SDK-managed fallback for an unassigned placement still applies. An explicit No Offering skips onboarding, while failures expose retry/skip. The five `RevenueCatPlacementTest` cases verify the distinction against the actual SDK.

Android production browser checkout remains disabled pending Google External Content Links enrollment and transaction reporting. Hosted-link metadata alone cannot enable it. See the September 16 section of `setup-status.md`.
