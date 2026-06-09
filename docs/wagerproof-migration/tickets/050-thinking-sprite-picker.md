# Ticket #050 — Thinking Sprite picker not ported

**Status:** open
**Filed by:** b08-implementer-2026-05-21
**Filed:** 2026-05-21
**Affects screen / file:** `wagerproof-mobile/app/(drawer)/(tabs)/settings.tsx` → `wagerproof_ios_native/Wagerproof/Features/Settings/SettingsView.swift`

## What we couldn't ship in scope

The Settings screen has a "Thinking Sprite" preference row (settings.tsx:438–445) that opens a bottom-sheet picker (`ThinkingSpritePicker`) so the user can choose which animated sprite WagerBot uses while waiting for a response. The B08 Swift port omits this row.

## Why

The thinking-sprite assets and the `useThinkingSprite` hook live inside the WagerBot chat module, which lands in B17. Porting the picker now would force B08 to take a dependency on a future batch and create dead code until B17 wires it back up.

## Impact

Pro users can't change the animated thinking sprite from the Settings screen on iOS until B17 ships. They retain the default sprite ("Petals"), so the WagerBot UI still works — it's only the customization that is missing.

## Acceptance criteria

- B17 lands the `WagerBotChatStore` and the `ThinkingSprite` asset catalog.
- A `ThinkingSpritePickerSheet` Swift view exists that mirrors `components/chat/ThinkingSpritePicker.tsx`.
- The Settings "Thinking Sprite" row appears in the Preferences section between WagerBot Suggestions and Push Notifications.
- Selection persists via the App Group default consumed by the chat module.

## Linked code

- Settings preferences section in `SettingsView.swift` is missing the Thinking Sprite row between the WagerBot Suggestions and Push Notifications rows.

## Notes

This is a pure UX gap — no backend or analytics implications.
