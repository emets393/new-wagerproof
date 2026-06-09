# Ticket #079 — Agent creation time picker uses native DatePicker

**Status:** open
**Filed by:** B14 implementer
**Filed:** 2026-05-21
**Closed:** —
**Affects file:** `wagerproof_ios_native/Wagerproof/Features/Agents/Creation/Inputs/TimePickerModal.swift`

## What we couldn't ship in scope

The RN `TimePickerModal.tsx` renders custom dual ScrollView wheels for hour + minute, with minutes snapped to 5-min increments. The Swift port uses SwiftUI's native `DatePicker(.wheel, displayedComponents: .hourAndMinute)` instead.

## Why

Native `DatePicker(.wheel)` gives proper iOS spinner behavior, am/pm formatting, accessibility, and haptics for free. Re-implementing a custom paired-ScrollView wheel in SwiftUI to match the RN look would require a sizable custom widget that doesn't behave correctly with VoiceOver. The trade-off is that 5-min snapping is not supported on the native picker.

## Impact

- Users can pick any minute (00-59) instead of only multiples of 5.
- This is a *broader* range, not a narrower one — the data is still valid, it just allows more precision than RN did. The server stores `auto_generate_time` as `"HH:mm"` so any minute round-trips fine.

## Acceptance criteria

Close this ticket if any of the following land:
1. Product decides 1-min precision is acceptable (most likely outcome — no real downside).
2. A custom wheel widget shipped that matches RN's 5-min behavior AND maintains VoiceOver support.

## Linked code

- `// FIDELITY-WAIVER #079` at the top of `TimePickerModal.swift`.
