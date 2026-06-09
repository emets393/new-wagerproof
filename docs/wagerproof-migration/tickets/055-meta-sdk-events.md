# Ticket #055 — Meta SDK attribution events not bridged

**Status:** open
**Filed by:** b08-implementer-2026-05-21
**Filed:** 2026-05-21
**Affects screen / file:** `wagerproof-mobile/app/(modals)/secret-settings.tsx` (Meta SDK Events row) + `react-native-fbsdk-next` integration → `wagerproof_ios_native/Wagerproof/Features/Settings/SecretSettingsView.swift`

## What we couldn't ship in scope

The RN secret settings screen exposes a "Meta SDK Events" row (lines 518–525) that opens a debug sheet (`MetaTestSheetContext.openSheet`) showing the Facebook SDK's event queue. RN also forwards Facebook attribution to RevenueCat by calling `Purchases.setFBAnonymousID(...)` at SDK init. The Swift port does neither.

## Why

The native build doesn't yet link `FBSDKCoreKit` / `FBSDKLoginKit`. Adding the SPM package + Info.plist keys (`FacebookAppID`, `FacebookClientToken`, `FacebookDisplayName`) is a self-contained chunk of work that belongs in a dedicated Meta integration batch.

## Impact

iOS-native installs and purchases won't attribute back to Meta ad campaigns through the SDK path. RevenueCat's own integration with Meta still works (the `setFBAnonymousID` plumbing is the *additional* signal RevenueCat correlates against), so attribution is degraded but not eliminated.

## Acceptance criteria

- `FBSDKCoreKit` linked via SPM.
- App init calls `Settings.shared.appID = …` + `ApplicationDelegate.shared.application(…, didFinishLaunchingWithOptions: …)`.
- `RevenueCatService.bootstrap` calls `Purchases.shared.attribution.setFBAnonymousID(AppEvents.shared.anonymousID)` to match RN's flow.
- Secret settings "Meta SDK Events" row added, opening a debug sheet that lists the Meta event queue.

## Linked code

- `SecretSettingsView.diagnosticsSection` currently lacks the Meta row.
- `RevenueCatService.bootstrap` currently lacks the `setFBAnonymousID` call.

## Notes

Tracked separately from #052 because the Meta integration is its own dependency surface.
