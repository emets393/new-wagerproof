# Ticket #003 — login-background.mp4 asset import deferred

**Status:** open
**Filed by:** B01 implementer
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/app/(auth)/login.tsx` → `wagerproof_ios_native/Wagerproof/Features/Auth/LoginView.swift`

## What we couldn't ship in scope

The RN login carousel uses `assets/login-background.mp4` as a looping muted backdrop on slides 0 (proData) and 5 (getStarted). B01 does not bundle the MP4 into the iOS target. The Swift `VideoBackground` view gracefully falls back to a solid teal `Color(hex: 0x00BFA5)` when the file is missing.

## Why

Asset import into the iOS Xcode project + the WagerproofKit SPM resource bundle requires touching the project config (XcodeGen + Package.swift `resources`). The MP4 is also 7+ MB which influences the iOS bundle size; we want a deliberate decision on whether to ship it.

## Impact

Slides 0 and 5 show a solid teal background instead of the looping video. The teal gradient overlay and bottom-black fade still apply, so the screen still reads as a branded login. The motion / brand polish of the video backdrop is lost.

## Acceptance criteria

- Decide whether to ship the video at all (or replace with an animated SwiftUI gradient / particle effect).
- If shipping: copy `wagerproof-mobile/assets/login-background.mp4` to `wagerproof_ios_native/WagerproofKit/Sources/WagerproofDesign/Resources/`.
- Update `WagerproofKit/Package.swift` `WagerproofDesign` target's `resources` list to `.process("Resources")` (already in place; just verify the MP4 is included).
- `makeVideoPlayer` in `LoginView.swift` updates `Bundle.main.url(forResource:…)` to `Bundle.module.url(forResource:…)` with explicit fallback to main bundle.

## Linked code

- `// FIDELITY-WAIVER #003` in `Wagerproof/Features/Auth/LoginView.swift` (function `makeVideoPlayer`)

## Notes

Carousel pause logic (`player.rate = isPaused ? 0 : 1`) is implemented and ready to drive a real AVPlayer once the asset lands.
