# Ticket #080 — TopAgentsWidgetService falls back to .standard UserDefaults

**Status:** open
**Filed by:** B16 implementer
**Filed:** 2026-05-21
**Closed:** —
**Affects screen / file:** `wagerproof_ios_native/WagerproofKit/Sources/WagerproofServices/TopAgentsWidgetService.swift` (`writePayload`, `appGroupDefaults`)

## What we couldn't ship in scope

When the App Group entitlement is unavailable (no widget extension target,
running under tests, etc.), `TopAgentsWidgetService.writePayload` writes to
`UserDefaults.standard` so the data isn't silently lost. The widget
extension can't read `.standard` defaults from another bundle, so this is
strictly a debug/preview fallback — not a working widget.

## Why

The App Group entitlement `group.com.wagerproof.mobile` IS declared in
`Wagerproof.entitlements`, so `UserDefaults(suiteName:)` returns a real
suite on device. But we keep the fallback so the service is testable from
unit tests and from the iOS simulator without entitlement baking (the
build script strips entitlements on simulator builds to avoid iOS 26
security policy rejections — see `project.yml:99-107`).

## Impact

On simulator builds the widget payload writes to standard defaults rather
than the App Group suite, so previewing the widget extension (once
ticket #079 lands) won't see the writes. Workaround: run on a real device
to exercise the cross-bundle flow.

## Acceptance criteria

- Once ticket #079 lands the widget extension target, this ticket can be
  closed by removing the standard-defaults fallback in `writePayload` and
  letting it noop when the App Group suite isn't available.
- Add `WidgetCenter.shared.reloadAllTimelines()` from the app target after
  successful sync so the widget refreshes on each app-foreground sync tick.

## Linked code

- `// FIDELITY-WAIVER #080` in `TopAgentsWidgetService.swift`.
