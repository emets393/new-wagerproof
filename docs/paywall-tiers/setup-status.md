# Billing setup status

Verified September 15, 2026 UTC. The new catalog is prepared alongside the live catalog. It is **not ready for rollout**. No backend deployment, purchase, subscription review submission, or customer migration has been performed. Internal TestFlight 3.6.3 (381) was uploaded in the subsequent purchasing QA pass. The subsequent placement integration pass was built and tested locally.

## Completed

| System | Verified result |
| --- | --- |
| RevenueCat project | WagerProof `proj9c91e695` |
| Entitlements | Created Standard `entl0217148381` and Premium `entl22c7fbd7a2`; preserved existing Pro `entl1acf95b090` |
| Offering | Created `wagerproof_tiers_v1` / `ofrng7420d56fce`, non-current, with `tiered_catalog_ready: true`, `tiered_hosted_web_ready: true`, and `tiered_web_ready: false` |
| Hosted mobile checkout | Production Purchase Link `https://pay.rev.cat/sjaluffkdnitjajl/`, tied to the new tier offering and production Web Billing app. All six prices and the live payment form verified without charging |
| Packages | All six tier/period packages exist; each contains exactly its Apple, Google Play, web production, and web sandbox product |
| Apple | Six new subscriptions in existing group `default`; all 175 territories available and priced, including future territories. All six read back as `READY_TO_SUBMIT`; not submitted or approved |
| Google Play | Monthly/yearly base plans saved for `wp_tiers_standard`, `wp_tiers_premium`, and `wp_tiers_pro`. All six are `DRAFT`, with prices and availability in all 173 explicit regions plus future/other-region configuration |
| Web production | Six new products created with the requested recurring USD prices, matching tier entitlements, and package attachments |
| Web sandbox | Six matching products created with identical recurring USD prices and attachments |
| iOS placements | Active, first-priority rule `e-ClhzcQQy` maps `onboarding`, `generic_feature`, `tier_upgrade_premium`, and `tier_upgrade_pro` to the new offering |
| Web placement | Inactive rule `gxnB9Oc2V3` maps `tiered_web_checkout` to the new offering |
| Placement code | Native resolves before renderer selection; web resolves for the signed-in account and rechecks before purchase. No direct tiered catalog lookup or cached-offer override |

Every new product grants only its matching entitlement. Code resolves cumulative tier access. Exact product and package IDs are in [products.json](products.json).

### Prices

All amounts below are saved and verified through RevenueCat's store-state API, including **both** Web Billing apps. Apple prices were equalized from USD across all 175 territories. Google regional prices were generated from USD in Play Console. Store products still require submission/activation and rollout checks before sale.

| Tier | App monthly saved | App yearly saved | Web monthly saved | Web yearly saved |
| --- | ---: | ---: | ---: | ---: |
| Standard | $19.99 | $199.99 | $13.99 | $139.99 |
| Premium | $29.99 | $299.99 | $20.99 | $209.99 |
| Pro | $79.99 | $359.99 | $55.99 | $251.99 |

### Targeting restrictions

- iOS: App Store app `app450d144c7c` and exact app version `3.6.3`, with no account attribute requirement. This is a new internal-only TestFlight version; the public version remains 3.6.2.
- Web: production app `appff2fe0e0af` or sandbox app `app94a5d45dff`, and the same QA attribute. Mobile version targeting cannot establish web eligibility.
- The iOS rule is active above the Default Rule; the web rule remains inactive. Both retain `hardPaywall` as the fallback for other placements. No customer QA attributes were changed.
- No Android tiered rule exists yet. Create it only with a verified compatible Android implementation/version.
- The live catch-all Default Rule must remain the final live rule. When eventually activating QA targeting, verify its ordering above that catch-all, or matching customers will never reach the QA rule.

## Existing subscribers and app versions

The final audit verified all 16 pre-existing products are still attached to `WagerProof Pro`. The Pro entitlement now has 24 products: the original 16 plus eight new Pro products across four app configurations. Standard and Premium each have eight new products.

The project current offering remains `hardPaywall` / `ofrng87bbce436f`. The existing active rule `zomkUbI3EY` retains its original onboarding assignment and fallback. Existing offerings, store products, prices, subscription-change paths, and the Supabase webhook were not edited. The native renderer is enabled for version-only iOS QA. The web checkout code flag is enabled locally, but its live deployment and readiness metadata remain pending. This catalog setup has not changed customers' access or the offer served to old app versions.

Before release, test a new lower-tier account on an old Pro-only client, including accounts created on the web. Keeping the old offering intact protects acquisition routing, but does not solve old-client handling of a lower-tier account. Never attach Pro to Standard/Premium as a workaround. Existing legacy subscribers retain full access while their original entitlement is active; an intentional future switch to a lower-tier product is a separate access-policy decision.

## Required next steps

1. **Expand app distribution with the next release.** The user selected all supported countries, including future store territories. New subscription availability and localized prices are complete. App-level availability remains unchanged until the next release: Apple availability changes affect the current app, and Google production countries apply to current and future releases. On release day, select all countries in App Store Connect > Pricing and Availability and Play Console > Production > Countries / regions. Play's current production release `95 (3.6.1)` is verified as US-only. Do not confuse worldwide subscription configuration with worldwide app distribution.
2. Verify Apple subscription group service levels before submitting the six `READY_TO_SUBMIT` products. All six now reuse the exact review screenshot from the approved legacy monthly/yearly subscriptions, as requested; live checks verified matching file size and checksum. Store state also includes localizations, privacy URL, and review notes. Keep existing full-access products at the highest service level and preserve their renewal prices.
3. Google benefit metadata is saved and verified for all three tiers. Activate the six saved base plans only when rollout prerequisites are met. All monthly/yearly prices and regional availability are saved; no plan was activated in this pass.
4. Configure and test web subscription-change paths among the **new** products. Preserve existing legacy paths and guard against duplicate subscriptions during upgrade/checkout.
5. Placement-aware native/web selection, No Offering handling, attribute synchronization, and minimum-tier filtering are implemented. Verify the inactive rules with QA accounts and the intended app versions before activation. See [revenuecat-placements.md](revenuecat-placements.md).
6. Finish server authorization, deploy/test the derived RevenueCat cache and updated resolvers/webhook in the correct order, and verify identity reconciliation. The backend changes in this workspace remain undeployed. No separate grandfathered-account registry is needed.
7. Exercise sandbox purchase/restore, renewals, expiry/refunds, pending payments, tier changes, old-client compatibility, browser/mobile identity, and rollback. Then choose the release audience and activate readiness flags/rules. Live checkout remains disabled until these checks pass.

## Access and tooling

- RevenueCat MCP created the catalog and Apple drafts through saved store credentials. Apple async operations all completed successfully; drafts were read back from the store.
- The MCP credential lacks `project_configuration:targeting_rules:read_write`. The Google Play service account cannot create/update products without Manage store presence permission. These are provider permission limits, not automatic approval-review rejections.
- Those permissions are **not required from the user to continue through the signed-in dashboards**. The WagerProof dashboard was found in Chrome's `honeydewcook.com` profile and used for targeting, web products, and Google subscriptions/base plans. The extension-connected `Chris` profile showed a different RevenueCat account.
- RevenueCat's API rejected Web Billing product creation as unsupported. Products were successfully created using its dashboard, then attached and verified using MCP.
- Raw before/after receipts and async operation results are stored in the gitignored `.context/billing-setup/` directory. No secret credentials were copied into these documents.

## Initial verification (superseded by the activation follow-ups below)

- Subsequent simulator QA: [September 15 report](simulator-qa-20260915.md). All six plan combinations, contextual gates, legacy fixture access, deterministic offering failures, and Lock Screen Live Activity checked. Fixed a missing Outliers preview dependency. Forty focused automated tests and isolated SQL assertions passed; no purchase or live rollout is claimed.

- All six Apple products report `READY_TO_SUBMIT`, 175 available/priced territories, future territories enabled, and the exact USD prices above. The inspected legacy Apple monthly product's prices and availability are unchanged from the pre-write snapshot.
- All six Google base plans report `DRAFT`, exact USD prices, 173 priced explicit regions with new-subscriber availability, and enabled future/other-region availability. No legacy Google product was edited.
- All twelve web products report store status `ok`; all USD amounts match the manifest.
- All six packages contain exactly the four intended product IDs.
- All 16 original Pro product mappings remain present; Standard/Premium contain only their matching new products.
- Both new targeting rules read back as inactive with the intended app/attribute/version/placement conditions. The original live rule remains unchanged.
- Native `TieredPaywallConfiguration.enabled` is now true for the internal QA build. Web `TIERED_CHECKOUT_ENABLED` remains false. RevenueCat placement enrollment is still required.
- Placement integration: 34 focused JavaScript tests and six Swift policy tests pass. Native iPhone 17 Pro Max simulator build and web production build pass. The built native app was installed and its non-purchasing tiered preview launched successfully.
- Repository-wide TypeScript checking still reports unrelated errors; none were reported in the changed placement/paywall/service files. The focused Swift policy suite uses the exact source/test files in an isolated package; it is not a full iOS XCTest run.
- Live QA targeting and sandbox purchase behavior remain untested against the inactive dashboard rules. No live rollout was enabled.

## Distribution references

- [Apple: Manage availability](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/manage-availability-for-your-app-on-the-app-store): changes take effect immediately, with up to 24 hours to become visible.
- [Google: Distribute app releases](https://support.google.com/googleplay/android-developer/answer/7550024?hl=en): production country targeting includes current and future production releases.

## Store re-audit, September 15, 2026

- Google Console's subscription list counts **active** base plans. The new subscriptions each show zero there because their monthly/yearly plans are **drafts**, not missing. Both rows were verified inside all three subscription detail pages, and independently via live store-state reads.
- Added and saved customer-facing benefits and internal descriptions for Standard, Premium, and Pro. Google confirmed each save; the API read back all three descriptions. Prices, regions, periods, and draft status remain correct.
- Apple: all six products still report `READY_TO_SUBMIT`; exact USD prices, month/year periods, 175 priced/available territories, and tier localizations verified. App Store Connect sign-in is restored; tier ordering remains to verify. At the user's request, replaced all six placeholder review images with the exact image used by the approved legacy monthly/yearly subscriptions. All six upload/finalization operations succeeded and live readbacks match the legacy image: 739,122 bytes, MD5 `7b8934c742cec2c17649727341394940`. Receipt: `.context/billing-setup/legacy-review-screenshots-20260915.json`. This verifies the requested image reuse; the new subscriptions still require Apple review.
- RevenueCat package attachments and entitlement membership rechecked. The current offering is still `hardPaywall`; the tiered offering is non-current with both readiness flags false. All 16 legacy products remain attached to Pro.
- Raw receipt: `.context/billing-setup/store-reaudit-20260915.json`. No subscriptions were activated or submitted, and no legacy product was changed.


## Initial internal purchase QA build, September 15

- Prepared a signed Release archive and uploaded **3.6.3 (381)** using the existing WagerProof App Store API key. Export has `testFlightInternalTestingOnly: true`; this binary cannot be distributed publicly.
- Apple finished processing: build `77bec802-c015-4c4a-9e3c-c12be0aaaf6b` is `VALID`, `INTERNAL_ONLY`, and `IN_BETA_TESTING`. Version 3.6.3 is confirmed through its pre-release version relationship. No export-compliance prompt is pending. The existing Internal Testing group includes this exact build. TestFlight instructions were saved and read back.
- Enabled the native tiered renderer and offering metadata `tiered_catalog_ready`. The offering remains non-current, web checkout remains off, and the existing default rule still serves `hardPaywall`.
- Updated iOS QA rule `e-ClhzcQQy` to exact version 3.6.3, preserving the Apple app and `tiered_paywall_qa = enabled` requirements. It remains **inactive**, pending confirmation of the tester's WagerProof account. No customer attributes were assigned.
- Developer settings now separate **Preview Tiered Design** from **Test Tiered Purchases**. The latter is visible only in Debug/TestFlight, resolves the actual `onboarding` placement, and refuses checkout when the account/version is not enrolled. It does not reset onboarding or override entitlements.
- Six focused Swift policy tests passed, including legacy Pro precedence, cumulative tiers, legacy placement preservation, and intentional No Offering behavior. The exact current model sources match the tested copies. Signed Release archive succeeded with both app and widget at 3.6.3 (381).
- Actual sandbox purchase, cancellation, restore, and RevenueCat entitlement verification remain pending account enrollment and device testing.
- Logs: `.context/tiered-qa-archive.log`, `.context/tiered-qa-upload-api.log`, `.context/tiered-qa-policy-tests.log`.


## Version-only iOS activation follow-up

At the user's request, removed the account attribute requirement from iOS rule `e-ClhzcQQy`, renamed it **App version 3.6.3**, activated it, and verified it is first in both dashboard and API rule order. Conditions are exactly Apple app `app450d144c7c` plus app version `= 3.6.3`. The unchanged Default Rule follows it. All four mobile placements retain the tiered offering; the fallback remains legacy. No subscriber entitlements or customer attributes were changed. The user confirmed the test paywall now works.

Browser checkout remains a separate pending task: native `tiered_web_ready` is false, the web page's checkout flag is enabled locally but not deployed, and the web targeting rule is inactive. Do not expose the browser CTA until its destination and billing environment are working. TestFlight's sandbox does not automatically apply to web payments.


## Real discounted browser checkout preparation

The user explicitly selected **real discounted web payments**. Verified all six production Web Billing products are healthy with exact prices above, and the live database billing mode is production (`get_sandbox_mode` returns false). Enabled the web page checkout flag locally and added Google/Apple sign-in with a return to the selected tier and period. The final OAuth-inclusive production build and all 34 focused regression tests passed. Logs: `.context/tiered-web-live-build.log` and `.context/tiered-web-live-tests.log`.

The live `wagerproof.bet` bundle does not yet include `/plans/tiers` or the new catalog. The authenticated Netlify CLI account does not have the WagerProof site; the WagerProof-profile browser is signed out. Requested the user sign into that Netlify account. Keep `tiered_web_ready` false until the page is deployed and verified. The web rule should target the production Web Billing app and only override `tiered_web_checkout`, retaining the legacy fallback, without requiring account enrollment.

## Direct RevenueCat hosted checkout (supersedes the mobile website dependency)

The user clarified that mobile must open RevenueCat's hosted Web Purchase Link. Created a separate link for `wagerproof_tiers_v1` using production Web Billing app `appff2fe0e0af`. Production base URL: `https://pay.rev.cat/sjaluffkdnitjajl/`. Existing links were not edited. The hosted selector displays all six web prices and feature descriptions; the Pro Monthly payment form shows $55.99 and Stripe live mode. No payment information was entered and no charge was submitted.

Native code appends the signed-in RevenueCat ID only when it exactly matches the authenticated account UUID, requests USD, and leaves package selection to RevenueCat. It refreshes CustomerInfo from the network on returning. The link's repeat purchase setting is **Show the success page**, preventing this acquisition link from intentionally starting a second subscription for an already subscribed customer. Upgrade/change-plan behavior remains a separate release check.

Metadata now contains `tiered_hosted_web_ready: true` and `tiered_hosted_web_url`. Keep `tiered_web_ready: false`: build 381 uses the old website route, while the new keys are consumed only by the updated native code. The default offering, all legacy product mappings, and targeting rules remain unchanged. No website deployment or web placement activation is needed for mobile link-out. Netlify browser access was subsequently restored, but deployment was no longer needed for this fix.

Validation: nine focused Swift policy tests passed, including mismatched/anonymous identity and invalid checkout-link rejection. The iPhone 17 Pro Max simulator build passed. Internal TestFlight **3.6.3 (382)** is uploaded, `VALID`, `INTERNAL_ONLY`, and `IN_BETA_TESTING`. Build ID: `8e243877-6295-407a-9399-3086dc9324a4`. The existing Internal Testing group contains this exact build. Both app/widget archive versions were verified. Logs: `.context/tiered-hosted-archive.log`, `.context/tiered-hosted-upload.log`, and `.context/tiered-hosted-testflight-status.json`. Actual paid purchase and entitlement delivery remain to be exercised on the device.

## Launch preparation, September 16, 2026

This section supersedes earlier draft-plan and tier-ordering notes.

### Completed and verified

- Apple subscription group `21870537`: level 1 contains all five approved legacy subscriptions plus both new Pro subscriptions; level 2 contains Premium Plus monthly/yearly; level 3 contains Premium monthly/yearly. Updated all six new reference/localized names. Product IDs, prices, availability, and legacy localized names were not changed. The new Apple products still require review with the release.
- Google Play: activated monthly and yearly base plans for `wp_tiers_standard`, `wp_tiers_premium`, and `wp_tiers_pro`. Independent RevenueCat store reads confirm all six ACTIVE, with USD prices 19.99/199.99, 29.99/299.99, and 79.99/359.99 and 173 configured regions plus future-region availability. Console counts include the additional other-regions row.
- RevenueCat: renamed the 16 new lower-tier product display names across Apple, Play, production Web Billing, and sandbox Web Billing; renamed the two lower entitlement display names and the tiered offering display name. Permanent entitlement lookup keys and package/product IDs stay unchanged. All 16 legacy products remain attached to Pro. The default offering remains unchanged.
- Web Billing: saved and read back 30 directed change paths among the six new products in **each** of production and sandbox. Higher-tier changes and monthly-to-yearly changes within a tier are upgrades; lower-tier changes and yearly-to-monthly changes within a tier are downgrades. Upgrades are immediate with RevenueCat's unused-time refund; downgrades occur at renewal. All five existing production legacy rules are preserved, with no new legacy-to-lower-tier paths.
- Hosted acquisition link repeat-purchase behavior was reverified as **Show the success page**. No real payment or live customer subscription change was performed.
- Android honors explicit RevenueCat No Offering at service, store, in-app, and onboarding layers. It syncs attributes before resolving a placement, rejects an identity change during the request, preserves cancellation, and distinguishes network failure from No Offering. Onboarding skips an intentional No Offering and provides retry/skip on errors. There is no client-side substitution with current/cached offerings. RevenueCat's own configured placement fallback remains supported.
- iOS refreshes US StoreKit storefront eligibility on foreground and immediately before browser checkout.

### Android external checkout is intentionally not enabled

The Play Console shows WagerProof **not enrolled** in External Content Links. Enrollment was opened for review, but the Terms of Service were not accepted. Google requires enrollment, eligibility/disclosure APIs, and transaction reporting (fees/reporting begin October 1, 2026 under the currently published program).

The Android implementation uses Billing 8.2.1 and provides a native eligibility/token/disclosure flow. A verified transaction-reporting handoff is required before the service can become eligible. That handoff is **not implemented or connected**: `ExternalCheckoutService` is constructed without it, so the production Stripe CTA is hidden. The previous unrestricted ACTION_VIEW checkout route is removed. Debug design previews still display a non-purchasing sample button. Google Play checkout is unchanged. This is safe disabled behavior, **not a completed live Android Stripe integration**.

Remaining to enable Android Stripe: owner review/acceptance and invoicing for Google's program, app approval, a durable token-to-web-transaction reporting integration, and licensed device end-to-end tests. RevenueCat's hosted-link documented metadata only forwards UTM parameters; do not assume an arbitrary token query parameter is automatically reported to Google. The native service deliberately requires the reporting adapter to return the validated hosted URL after accepting the fresh token.

### Blocked Google marketing names

The Console's subscription detail editor repeatedly fails with an unexpected-error message and never loads its form. Activation and API readbacks work. The RevenueCat write operation failed because `rc-service-account@wagerproof.iam.gserviceaccount.com` lacks **Manage store presence**. Its existing app permissions were inspected; no permission was changed. User approval was requested for adding only this permission to `com.wagerproof.mobile`.

Until that is resolved, Google customer-facing names remain Standard/Premium/Pro rather than Premium/Premium Plus/Pro; benefits that reference the old names also need updating. This remains a catalog launch blocker despite the six active base plans.

### Validation and evidence

- iOS simulator build passed on the designated iPhone 17 Pro Max, iOS 26.0.
- Android build and lint passed; 322 app tests and 100 service tests passed (including five new RevenueCat placement regression cases). A test confirmed the SDK returns null when placement data is missing, which is preserved rather than inventing a fallback.
- Updated Android Debug APK installed and launched on Samsung `R5CY436BXVL`, preserving sign-in. No purchase was executed; this is not end-to-end billing certification.
- Receipts: `.context/billing-setup/apple-before-finalize.json`, `apple-after-finalize.json`, `catalog-after-20260916.json`; logs `ios-validation.log`, `android-validation.log`, `android-placement-tests.log`.
- No production app rollout, new public targeting rule, backend entitlement deployment, or real transaction was performed in this step.

### Google permission and names resolved, September 16 follow-up

The user selected Manage store presence for RevenueCat's existing WagerProof service account. The parent Save changes action was still pending; completed that save and confirmation. All three subsequent RevenueCat store-write operations succeeded, and independent reads confirm the customer-facing names Premium, Premium Plus, and Pro and their updated descriptions. Monthly/yearly base plans remain ACTIVE at the same six USD prices. The Google name blocker above is resolved. Receipt: `.context/billing-setup/google-renames-after-permission-20260916.json`.

Also checked Google's Billing Choice page: it displays an enrollment prompt. The existing Android `CustomPaywallView` opens its web checkout directly via `uriHandler.openUri`; working RevenueCat/Stripe checkout does not establish Google program enrollment. No program agreement was accepted and no live web billing or subscriber access was disabled. The earlier Stripe restriction applies to the new local Android tiered paywall, not the published app or website.

## Backend deployment and compatibility verification, September 16

The backend is now deployed. This supersedes the earlier source-only/undeployed notes for the tier cache, resolver, webhook, and agent checks. See [the backend release report](backend-release-20260916.md) for deployment versions, 154 passing tests, the production rollback rehearsal preserving all 8,164 existing profiles, live QA across all tiers and legacy Pro, and cleanup. Research feeds remain client-gated for old-client compatibility; actual store purchases/restores and public app rollout are still pending. Android web billing was not changed in this pass.
