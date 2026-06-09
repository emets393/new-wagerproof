# Ticket #053 — Secret settings WagerBot test actions not ported

**Status:** open
**Filed by:** b08-implementer-2026-05-21
**Filed:** 2026-05-21
**Affects screen / file:** `wagerproof-mobile/app/(modals)/secret-settings.tsx` → `wagerproof_ios_native/Wagerproof/Features/Settings/SecretSettingsView.swift`

## What we couldn't ship in scope

The RN secret settings screen exposes three WagerBot-specific dev tools:
1. "WagerBot Voice" navigation row (jumps to `/(drawer)/wagerbot-voice`).
2. "WagerBot Test Mode" toggle (`WagerBotSuggestionContext.testModeEnabled`).
3. "Trigger Test Bubble" button (`WagerBotSuggestionContext.triggerTestSuggestion`).

The Swift secret settings screen omits all three.

## Why

These all depend on the WagerBot suggestion + voice modules, which land in B17 (chat) and B18 (voice). Porting them now would require pulling in `WagerBotSuggestionStore`, the suggestion-bubble overlay, and the voice route — none of which exist in Swift yet.

## Impact

Engineers testing builds on iOS can't trigger a test suggestion bubble or jump straight to voice mode from the developer drawer. They can still toggle Simulate Freemium / Admin Mode and run all the RevenueCat + push diagnostics, so the most important dev affordances are intact.

## Acceptance criteria

- B17 lands `WagerBotSuggestionStore` with `testModeEnabled` and `triggerTestSuggestion()`.
- B18 lands the voice route + ‌WagerBotVoiceView.
- Three rows added to `SecretSettingsView.testingTogglesSection` matching the RN spec.

## Linked code

- `SecretSettingsView.testingTogglesSection` — currently missing the three rows.

## Notes

The diagnostic toggles (Simulate Freemium, Admin Mode) ship in this batch because they only need `RevenueCatStore` + `AdminModeStore`, both delivered here.
