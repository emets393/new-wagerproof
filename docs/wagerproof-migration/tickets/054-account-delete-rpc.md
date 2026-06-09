# Ticket #054 — Account-delete RPC not wired

**Status:** open
**Filed by:** b08-implementer-2026-05-21
**Filed:** 2026-05-21
**Affects screen / file:** `wagerproof-mobile/app/(modals)/delete-account.tsx` + `wagerproof-mobile/contexts/AuthContext.tsx` → `wagerproof_ios_native/Wagerproof/Features/Settings/DeleteAccountView.swift`

## What we couldn't ship in scope

The Swift Delete Account view confirms the action with a destructive `.alert` and then calls `auth.signOut()`. RN actually invokes `auth.deleteAccount()` which hits a Supabase RPC / edge function that purges the user's rows and revokes the session.

## Why

The Swift `AuthStore` does not yet expose a `deleteAccount()` method. Adding the RPC call requires:
- Confirming which edge function name to call (`delete-user`? `delete-account`?).
- Setting up retry semantics (RPC failure must not log the user out mid-flight).
- Confirming RC entitlement cleanup runs on the server side.

None of those concerns are blocking the Settings UX so we ship the modal + confirmation alert + sign-out fallback now and resolve the destructive RPC in a follow-up.

## Impact

A user who taps "Delete Account" and confirms gets signed out instead of having their account purged. They can still sign back in afterwards — their data is intact. To actually delete the account they currently have to email `admin@wagerproof.bet`.

## Acceptance criteria

- `AuthStore.deleteAccount() async -> Result` exists and invokes the RN-equivalent Supabase edge function.
- `DeleteAccountView.performDelete()` calls that method and surfaces the error message on failure.
- RC entitlement is verified to be wiped from the customer record on the server before the client signs out.

## Linked code

- `DeleteAccountView.performDelete()` currently signs out only.

## Notes

RN's `AuthContext.deleteAccount` is at `wagerproof-mobile/contexts/AuthContext.tsx` (look for `deleteAccount`).
