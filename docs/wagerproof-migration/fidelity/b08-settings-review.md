# B08 Settings + Modals + RevenueCat Paywall + Pro Gating — Reviewer Verdict

**Reviewer:** b08-reviewer-2026-05-21 (independent, fresh context)
**Date:** 2026-05-21
**Verdict:** **FAIL**
**Build:** ✅ `** BUILD SUCCEEDED **` (iPhone 16 Pro simulator, Debug)

## Scope reviewed

RN sources (read end-to-end):
- `wagerproof-mobile/app/(drawer)/(tabs)/settings.tsx` (930 lines)
- `wagerproof-mobile/app/(drawer)/settings.tsx` (re-export)
- `wagerproof-mobile/app/(modals)/_layout.tsx`
- `wagerproof-mobile/app/(modals)/delete-account.tsx`
- `wagerproof-mobile/app/(modals)/discord.tsx`
- `wagerproof-mobile/app/(modals)/ios-widget.tsx`
- `wagerproof-mobile/app/(modals)/secret-settings.tsx`
- `wagerproof-mobile/components/DeleteAccountBottomSheet.tsx`
- `wagerproof-mobile/components/ReviewRequestModal.tsx`
- `wagerproof-mobile/components/RevenueCatPaywall.tsx`
- `wagerproof-mobile/components/CustomerCenter.tsx`
- `wagerproof-mobile/components/ProContentSection.tsx`
- `wagerproof-mobile/components/ProFeatureGate.tsx`
- `wagerproof-mobile/components/LockedGameCard.tsx`
- `wagerproof-mobile/components/LockedOverlay.tsx`
- `wagerproof-mobile/contexts/SettingsContext.tsx`
- `wagerproof-mobile/contexts/RevenueCatContext.tsx`
- `wagerproof-mobile/contexts/AdminModeContext.tsx`
- `wagerproof-mobile/services/revenuecat.ts`
- `wagerproof-mobile/services/notificationService.ts`
- `wagerproof-mobile/hooks/useProAccess.ts`
- `wagerproof-mobile/hooks/useIsAdmin.ts`

Swift targets (read end-to-end):
- `Features/Settings/SettingsView.swift` (712 lines)
- `Features/Settings/DeleteAccountView.swift`
- `Features/Settings/DiscordView.swift`
- `Features/Settings/IosWidgetView.swift`
- `Features/Settings/SecretSettingsView.swift`
- `Features/Settings/SettingsFixtures.swift`
- `Features/Settings/Sheets/DeleteAccountBottomSheet.swift`
- `Features/Settings/Sheets/ReviewRequestModal.swift`
- `Features/Paywall/RevenueCatPaywallView.swift`
- `Features/Paywall/CustomerCenterView.swift`
- `Features/Paywall/ProContentSection.swift`
- `Features/Paywall/ProFeatureGate.swift`
- `Features/Paywall/LockedGameCard.swift`
- `Features/Paywall/LockedOverlay.swift`
- `WagerproofKit/Sources/WagerproofStores/{SettingsStore, RevenueCatStore, AdminModeStore, ProAccessStore}.swift`
- `WagerproofKit/Sources/WagerproofServices/{RevenueCatService, NotificationService}.swift`
- `Wagerproof/App/WagerproofApp.swift`
- `Wagerproof/Features/Navigation/MainTabView.swift`

## Issues

### 1. Missing inline `// FIDELITY-WAIVER #NNN` markers (FAIL — hard rule #2)

REBUILD_PLAN hard rule #2 requires BOTH a ticket file AND an inline `// FIDELITY-WAIVER #NNN: <reason>` annotation in the Swift code for every waivered gap. The b08-settings.md fidelity table cites six waivers (`⚠️ #050`, `#051`, `#052`, `#053`, `#054`, `#055`) but the corresponding inline markers are absent:

- **Ticket #050** (Thinking Sprite picker): no inline marker in `Features/Settings/SettingsView.swift`. The fidelity row at `settings.tsx:438–445` is silently omitted.
- **Ticket #051** (Push token format): `WagerproofServices/NotificationService.swift:26` uses prose "See ticket #051 for the long-term migration plan" — not the canonical `// FIDELITY-WAIVER #051:` form. Acceptable as a soft reference but the grep-waivers script keys on the canonical form.
- **Ticket #052** (Paywall Mixpanel events): no inline marker in `Features/Paywall/RevenueCatPaywallView.swift` or anywhere in the Settings/Paywall trees.
- **Ticket #053** (Secret Settings WagerBot actions): no inline marker in `Features/Settings/SecretSettingsView.swift` for the three omitted rows.
- **Ticket #054** (Account delete RPC): `Features/Settings/DeleteAccountView.swift:129` uses prose "see ticket #054" — not the canonical `// FIDELITY-WAIVER #054:` form.
- **Ticket #055** (Meta SDK events): no inline marker in `Features/Settings/SecretSettingsView.swift` where the omitted "Meta SDK Events" action belongs.

The `grep-waivers.sh` script exits 0 because it only fails when an inline marker exists without a ticket — it does not enforce the reverse direction, so the script passes vacuously. The REBUILD_PLAN hard rule is still violated.

**Required action:** add `// FIDELITY-WAIVER #050: …` through `#055: …` annotations at the exact code locations where each gap exists, per hard rule #2.

### 2. Parity screenshots are placeholders, not real PNGs (FAIL — hard rule #6 + reviewer brief #9)

REBUILD_PLAN hard rule #6 and reviewer brief check #9 require three real PNGs (`empty.png`, `loaded.png`, `error.png`) under `docs/wagerproof-migration/parity/<screen>/` for each ported surface. The seven B08 directories contain only `.placeholder` files plus a `README.md` explaining the screenshot harness wiring was deferred:

- `parity/settings/` — `default.png.placeholder`, `interactive.png.placeholder`, `loaded.png.placeholder` (no real PNGs).
- `parity/delete-account/` — same.
- `parity/discord-modal/` — same.
- `parity/ios-widget/` — same.
- `parity/secret-settings/` — same.
- `parity/paywall/` — same.
- `parity/customer-center/` — same.

Earlier batches (`b01-auth`, `b02-onboarding`, `b05-picks`, `b07-scoreboard`) ship real `empty.png` / `loaded.png` / `error.png` files. B08 must match that bar before sign-off. `parity/settings/README.md` documents the deferral but does not satisfy the hard rule.

**Required action:** add screenshot harness targets per the `parity/settings/README.md` plan (`.settings`, `.settingsFree`, `.settingsPro`, `.deleteAccount`, `.secretSettings`, `.discordLocked`, `.discordUnlocked`, `.iosWidgetPicks`, `.iosWidgetFades`, `.iosWidgetMarket`, `.paywallLoading`, `.paywallLoaded`, `.customerCenter`), wire the existing `SettingsFixtures.swift` into a mounted view, capture, and commit the PNGs.

### 3. RevenueCatStore + AdminModeStore double-initialized in `WagerproofApp` (minor, soft)

`Wagerproof/App/WagerproofApp.swift:27-30` declares `@State private var revenueCatStore = RevenueCatStore()` and `@State private var adminModeStore = AdminModeStore()` with their default initializers, then `init()` (lines 43-47) creates a SECOND set of instances and overwrites via `_revenueCatStore = State(initialValue: rc)` and `_adminModeStore = State(initialValue: admin)`. The replacement is needed so `proAccessStore` can wrap the same instances as the environment-injected ones, but the first allocation is then discarded. Functionally correct but wasteful. Consider removing the property initializers and only assigning in `init()` for clarity.

### 4. Off-table SF Symbol substitution (minor)

`08-screen-native-spec.md` §7 SF Symbol swaps prescribes `app.connected.to.app.below.fill` for the RN `robot-outline` icon (WagerBot Suggestions row). `Features/Settings/SettingsView.swift:282` uses `bubble.left.fill` instead. The spec rule (08-spec §A.6) is "Off-table swaps without a row added to the table fail." A `bubble.left.fill` icon does not signal "robot / AI" as cleanly as the prescribed symbol. Either revert to the prescribed `app.connected.to.app.below.fill` or update the SF Symbol swap table in `08-screen-native-spec.md` §7 with justification.

### 5. Spec divergence: `.confirmationDialog` vs `.alert` for Logout (soft, justified)

08-spec §7 prescribes `.confirmationDialog("Logout?", isPresented:)` for the Log Out action; `Features/Settings/SettingsView.swift:103-110` uses `.alert("Logout", isPresented:)` with a destructive Logout button. RN uses `Alert.alert(...)`, so `.alert` is byte-closer to RN. Reviewer brief rule #6 lists `.alert` for confirmations as a valid native primitive. Acceptable, but the 08-spec text should be updated to reflect the reviewer-blessed primitive.

### 6. Spot-check pass — confirmed wiring (no issues)

- **Build green:** `xcodebuild ... build` ends with `** BUILD SUCCEEDED **` on iPhone 16 Pro simulator (Debug).
- **No `@State` fakes / mock data** in Settings or Paywall feature trees (`grep -rE "@State.*=\s*\["` and `grep -rE "(mock|sample|placeholder)Data"` return empty).
- **Real-store wiring:** `SettingsView` consumes `@Environment(SettingsStore.self)`, `@Environment(RevenueCatStore.self)`, `@Environment(AdminModeStore.self)`, `@Environment(ProAccessStore.self)`. Stores call real `MainSupabase.shared.client` (e.g. `AdminModeStore.checkRole` runs the `has_role` RPC; `NotificationService.registerPushToken` upserts `user_push_tokens`).
- **Backend byte-identity:** every Supabase mutation matches RN — `user_push_tokens` upsert with `onConflict: "user_id,expo_push_token"`, `user_notification_preferences` upsert with `ignoreDuplicates: true`, `has_role` RPC with `_user_id` + `_role: "admin"`, `profiles.select("discord_user_id").eq("user_id", …)`, `profiles.update(onboarding_completed: false)`.
- **RevenueCat SDK calls:** `Purchases.shared.logIn(userId:)`, `Purchases.shared.logOut()`, `Purchases.shared.customerInfo()`, `Purchases.shared.offerings()`, `offerings.currentOffering(forPlacement:)`, `Purchases.shared.restorePurchases()`, `Purchases.shared.syncPurchases()`, `Purchases.shared.customerInfoStream` — all match the RN bridge surface. Trust-downgrade guard preserved (RevenueCatStore.apply refuses untrusted granted→denied).
- **Native primitives per 08-spec:** `Form` + `Section` (insetGrouped via `.scrollContentBackground(.hidden)`), `Toggle` for booleans, `Button(role: .destructive)` for Delete Account, `.alert` for confirmations, `.sheet(item:)` for Discord / iOS Widget / Delete Account, `.fullScreenCover` for Secret Settings, `ContentUnavailableView` for paywall error/empty.
- **Animation tokens:** no raw `.spring(...)` / `.linear` / `.easeInOut` in B08 Swift files.
- **MainTabView integration:** `Features/Navigation/MainTabView.swift:77-81` renders `SettingsView()` (NOT a `ScaffoldPlaceholder` or `ContentUnavailableView`).
- **RevenueCat bootstrap:** `WagerproofApp.swift:83` calls `revenueCatStore.bootstrap()` inside `.task`, mirroring `authStore.start()` lifecycle.
- **Inventory:** 22 rows (lines 136-157) at `status=candidate` with B08 notes citing the relevant tickets. Count matches batch scope.
- **Waivers script:** `scripts/wagerproof-migration/grep-waivers.sh` exits 0 (vacuously — see issue #1).
- **Tickets #050-#055:** each follows `_template.md`, cites the affected RN + Swift files, lists impact + acceptance criteria.

## Required actions for implementer (to flip to PASS)

1. Add canonical `// FIDELITY-WAIVER #050:` … `#055:` inline annotations at every code site where each gap exists. Specifically:
   - `SettingsView.swift` — annotate the absence of the Thinking Sprite row (#050) and the absence of Mixpanel paywall events around the `.sheet(isPresented: $isPaywallPresented)` line (#052).
   - `NotificationService.swift:26` — convert the prose reference into a canonical `// FIDELITY-WAIVER #051: …` marker.
   - `SecretSettingsView.swift` — annotate the three omitted WagerBot rows (#053) and the omitted Meta SDK Events row (#055).
   - `DeleteAccountView.swift:129` — convert the prose reference into a canonical `// FIDELITY-WAIVER #054: …` marker.
2. Wire the screenshot harness per `parity/settings/README.md` and capture the seven directories' `empty.png` / `loaded.png` / `error.png` (or equivalents per the README's naming).
3. (Soft) Resolve the SF Symbol off-table swap for the WagerBot Suggestions row — either revert to `app.connected.to.app.below.fill` or amend 08-spec §7 with the justification.
4. (Soft) Clean up the WagerproofApp double-init of `revenueCatStore` + `adminModeStore` so each store is allocated exactly once.

## Recommendation

**HOLD.** Do NOT flip B08's 22 inventory rows from `candidate` → `reviewed`. Return to implementer for the two blocking actions (inline waiver markers + real parity screenshots). Once both are resolved a follow-up reviewer pass (fresh context) can flip the rows. If the orchestrator chooses to accept the parity-screenshot deferral as a non-blocking documentation gap, the inline-waiver-marker omission still needs to be fixed in code before the inventory flip.

The 22 rows that would be flipped (after fixes) are inventory.overrides.csv lines 136-157:

```
wagerproof-mobile/app/(drawer)/(tabs)/settings.tsx,settings,screen,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/app/(drawer)/settings.tsx,settings (re-export),layout,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/app/(modals)/_layout.tsx,(modals)/_layout,layout,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/app/(modals)/delete-account.tsx,delete-account,screen,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/app/(modals)/discord.tsx,discord,screen,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/app/(modals)/ios-widget.tsx,ios-widget,screen,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/app/(modals)/secret-settings.tsx,secret-settings,screen,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/RevenueCatPaywall.tsx,RevenueCatPaywall,component,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/CustomerCenter.tsx,CustomerCenter,component,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/ProContentSection.tsx,ProContentSection,component,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/ProFeatureGate.tsx,ProFeatureGate,component,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/LockedGameCard.tsx,LockedGameCard,component,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/LockedOverlay.tsx,LockedOverlay,component,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/DeleteAccountBottomSheet.tsx,DeleteAccountBottomSheet,component,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/components/ReviewRequestModal.tsx,ReviewRequestModal,component,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/contexts/SettingsContext.tsx,SettingsContext,store (context),reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/contexts/RevenueCatContext.tsx,RevenueCatContext,store (context),reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/contexts/AdminModeContext.tsx,AdminModeContext,store (context),reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/services/revenuecat.ts,revenuecat,service,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/services/notificationService.ts,notificationService,service,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/hooks/useProAccess.ts,useProAccess,hook,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
wagerproof-mobile/hooks/useIsAdmin.ts,useIsAdmin,hook,reviewed,...,b08-reviewer-2026-05-21,2026-05-21
```

Held back until issues #1 and #2 resolve.
