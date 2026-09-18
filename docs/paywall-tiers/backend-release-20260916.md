# Backend tier access deployment and legacy compatibility

Verified September 16, 2026. This is a backend deployment, not a public mobile rollout or store purchase certification.

## Deployed

- Main Supabase project: `gnjrklxotmbvnxbnnqgq`.
- Migrations: `20260914180000_subscription_tier_access` and `20260916170000_tiered_leaderboard_access`. Both went through the standard Supabase migration workflow after rollback-only production rehearsals and isolated dry runs showing only the intended migration.
- Ten existing Edge Functions: `resolve-my-entitlement`, `revenuecat-webhook`, `agent-authorized-action-v1`, `generate-avatar-picks`, `request-avatar-picks-generation-v2`, `trigger-v3-run`, `process-agent-generation-job-v2`, `process-agent-generation-job-v3`, `auto-generate-avatar-picks`, and `debug-user-entitlement`. Their existing JWT verification settings were preserved. Deployment used downloaded live sources plus the specific tier changes, preserving production code absent from the checkout.
- Trigger.dev production worker: version **20260916.1**, four tasks, deployment `gzdhez3l`. Existing environment variables were preserved with `--skip-sync-env-vars`.
- Default RevenueCat offering, public rollout rules, store pricing, existing subscriptions, Android browser billing, and app distribution were not changed.

## Access behavior

RevenueCat remains authoritative. `subscription_tier_access` is its server-written derived cache, with no manually maintained grandfathered-account list. Clients can read only their own row and cannot change it or invoke its sync procedure.

| Account | Agent picks, generation, creation, leaderboard |
|---|---|
| New Premium (`standard`) | Denied |
| New Premium Plus (`premium`) | Denied |
| New Pro | Allowed, subject to existing agent limits |
| Existing active Pro products | Existing access preserved |
| Expired/revoked new tier | Denied; cannot regain legacy fallback |

Pro remains the meaning of the existing `hasPremiumAccess` response field. New clients additionally receive `subscriptionTier`, `isTieredCustomer`, and `hasSubscription`. A lower subscription does not receive the Pro entitlement merely to accommodate older clients.

Changes include:

- Resolve stored RevenueCat identity, lowercase account ID, and historical uppercase ID; a failed identity lookup does not prevent finding another active Pro identity.
- Preserve the production webhook fix for expired uppercase bridge grants alongside active lowercase purchases. Persist the identity carrying the winning entitlement.
- Atomically update the tier cache and legacy profile mirror. Retain the derived tiered-cohort flag after transfer/revocation removes RevenueCat entitlement history.
- Preserve legacy outage fallback while preventing a lower plan from becoming Pro through `subscription_active` or a RevenueCat customer ID. Expired cached new plans do not retain Pro.
- Respect billing grace periods and cancellation through the paid expiration date.
- Reconcile both sides of a transfer, which has no `app_user_id`; support anonymous webhook identities and UUID aliases.
- Require webhook authorization, retry failed authoritative reconciliation, and keep RevenueCat's existing Facebook integration as the sole conversion sender.
- Restrict direct authenticated picks/parlay/performance reads, agent insertion, and security-definer feed/consensus/leaderboard APIs for lower tiers. These protections also apply to the MCP's user-scoped Supabase client. This checkout's MCP exposes read-only user tools; future agent-creation tools must call the authorized action endpoint.
- Reject client-supplied admin flags in the legacy generation endpoint. Allow a user to turn an agent off after losing Pro.

## Verification

- **154 focused tests passed**, covering tier resolution, placement/access policy, webhooks, and the agent worker. Ten webhook tests were rerun after the final anonymous-identity correction.
- Core Edge Function typechecks and the worker TypeScript build passed. The older `generate-avatar-picks` implementation retains seven pre-existing type errors in unrelated generation/schema code; deployment bundling passed and its new lower-tier denial was exercised live, including a forged `is_admin: true` input.
- A rollback-only rehearsal on production verified **8,164 existing profiles**, including **616 active subscription mirrors**, retained identical billing fields and agent permissions after the migration. These counts describe database mirrors, not a fresh RevenueCat census.
- Read-only RevenueCat checks sampled 40 active profile mirrors. Eight had currently active Pro entitlements, and all eight remained Pro under the tier-aware parser; 32 were already inactive in RevenueCat. No existing customer was modified by this audit.
- Independently reverified all **16 legacy products** remain attached to `WagerProof Pro` (24 total products including eight new Pro products).
- Two explicitly approved temporary accounts were used for live, signed-in checks. RevenueCat promotional grants exercised Premium, Premium Plus, new Pro, legacy Pro, upgrade, downgrade, and full revocation. Every state resolved from **live** RevenueCat, rather than a preview or outage cache.
- Live checks exercised the entitlement resolver, agent actions, legacy generation with a forged admin flag, V2/V3 generation entry points, direct picks RLS, self-only cache reads, rejected tier writes, the picks feed, and leaderboard.
- Real RevenueCat webhook deliveries updated the QA cache to Pro on upgrade and Premium Plus on revocation **before an app resolver refresh**. Source and destination transfer logic was covered by tests, not a real store receipt transfer.
- Unauthenticated calls to the resolver, agent creation, and webhook returned 401.
- All temporary RevenueCat grants were revoked. Both QA Auth accounts were deleted, with cascading profile/cache removal independently checked. No purchases were made and no customer credentials were saved.

### Compatibility boundaries

Existing subscribers retain the same `WagerProof Pro` identifier and old API behavior. Existing free/legacy database paths are preserved. A newly purchased lower-tier subscription requires a tier-aware app; an old Pro-only client can show its old paywall for that account. No Pro grant is fabricated to work around that limitation.

Player Props and historical/trend research still use the secondary CFB project's anonymous feeds. Anonymous reads of `nfl_prop_player_pages`, `nfl_player_prop_trends`, and `mlb_team_trends` were verified. These remain **client-gated**, because shutting off those feeds would break older apps. This deployment does not claim full server protection of those public datasets. An authenticated data API and a separate compatibility rollout would be needed for that.

Real App Store/Play/Stripe purchases, restore/reinstall behavior on old binaries, and store-managed upgrade/downgrade timing remain release-channel QA. Promotional access tests do not certify payment processing. Mobile builds and public version targeting still need the remaining launch steps.

## Evidence

Local receipts are under `.context/tier-backend-release/`: migration dry runs and deployment logs, `rehearsal-result.json`, per-tier `qa-*.json`, `webhook-upgrade-readback.json`, `webhook-downgrade-readback.json`, `anonymous-smoke.json`, `cleanup-and-migrations.json`, function version snapshots, and worker deployment output. Downloaded pre-deployment source is retained in `live/` for comparison and rollback preparation.

If an incident requires rollback, first stop enrolling new app versions in the tiered offer. Use the saved live function sources and reviewed SQL definitions; do not drop the authoritative cache or restore broad fallback while lower-tier accounts are enrolled.

References: [RevenueCat webhook events](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields), [billing grace periods](https://www.revenuecat.com/docs/subscription-guidance/how-grace-periods-work), [promotional grant/revocation API](https://www.revenuecat.com/docs/api-v2/customer).
