# Ticket #079 — iOS widget extension target not wired in Swift project

**Status:** open
**Filed by:** B16 implementer
**Filed:** 2026-05-21
**Closed:** —
**Affects screen / file:** `wagerproof-mobile/modules/widget-data-bridge/ios/*` → `wagerproof_ios_native/project.yml` (no widget extension target) + `wagerproof_ios_native/WagerproofKit/Sources/WagerproofServices/TopAgentsWidgetService.swift`

## What we couldn't ship in scope

The RN app ships a native iOS Widget Extension via Expo prebuild — the
`WidgetDataBridgeModule` writes a JSON payload to the App Group, the widget
extension reads it on a timeline refresh. Our Swift `project.yml` only
declares the main `Wagerproof` app target; there is no widget extension
target wired yet. `TopAgentsWidgetService.sync(userId:)` still writes the
exact same payload to the App Group, so the existing Expo-shipped widget
keeps working when a user installs the Swift app over the RN build, but a
clean Swift install has no widget binary on the home screen.

## Why

A WidgetKit extension is its own bundle with its own Info.plist, its own
entitlements, its own Swift source folder, its own `@main` `Widget`
declaration, and a separate provisioning profile. That's a >300-line
project.yml change plus a fresh source tree (`WagerproofWidgetExtension/`)
plus marketing/preview assets — bigger than B16's scope, and orthogonal to
the Top Agent Picks feed itself.

## Impact

- Users on a clean Swift install see no WagerProof widget in the gallery.
- Users upgrading from the RN build keep their existing widget — the App
  Group payload is unchanged, so the binary on their home screen keeps
  rendering. This is the bridge case the waiver covers.
- The in-app "iOS Widget" walkthrough (`IosWidgetView.swift`) still
  describes the widget but doesn't link to a real bundle in the Swift app
  until this ticket is resolved.

## Acceptance criteria

- New `WagerproofWidgetExtension` target declared in `project.yml` with
  `type: app-extension`, `productType: com.apple.product-type.app-extension`,
  and the App Group entitlement.
- Widget reads from `UserDefaults(suiteName: "group.com.wagerproof.mobile")`
  → `widgetPayload` (the key `TopAgentsWidgetService.payloadKey` writes).
- Widget surfaces at least Picks / Fades / Top Agents content types to
  match the RN walkthrough.
- After `TopAgentsWidgetService.sync` writes, the app calls
  `WidgetCenter.shared.reloadAllTimelines()` (importable in the app target
  but not in WagerproofKit/Services since they must stay extension-safe).

## Linked code

- `// FIDELITY-WAIVER #079` in `TopAgentsWidgetService.swift`.
- `IosWidgetView.swift` doc comment references widget bundle.
