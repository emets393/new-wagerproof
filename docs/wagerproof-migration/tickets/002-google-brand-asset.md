# Ticket #002 — Google brand asset missing in iOS bundle

**Status:** open
**Filed by:** B01 implementer
**Filed:** 2026-05-20
**Affects screen / file:** `wagerproof-mobile/app/(auth)/login.tsx`, `wagerproof-mobile/app/(auth)/signup.tsx` → `wagerproof_ios_native/Wagerproof/Features/Auth/Components/SocialSignInButton.swift`

## What we couldn't ship in scope

The RN app uses the `MaterialCommunityIcons` `"google"` glyph as the Google sign-in button mark. SF Symbols has no Google glyph. B01 renders a bold "G" wordmark in its place. We need to import the official Google "G" SVG/PNG asset (and Google's brand guidelines compliance) into the iOS asset catalogue.

## Why

We don't ship a vetted Google brand asset in `WagerproofDesign/Resources` yet. Substituting a non-official glyph that close-matches the brand would be a brand violation.

## Impact

The Google button shows a teal-on-white "G" instead of the multi-colour Google "G". Functional behaviour is identical (`SignInWithGoogle` flow unchanged).

## Acceptance criteria

- Import `google_logo.png` (or PDF/SVG vector) into `WagerproofKit/Sources/WagerproofDesign/Resources/Images.xcassets/google_logo.imageset/` honouring Google's brand guidelines (`https://developers.google.com/identity/branding-guidelines`).
- `SocialSignInButton.glyph` switches from the "G" `Text` to `Image("google_logo")` for `.google`.
- Verify the asset uses Google's recommended "Continue with Google" button variant.

## Linked code

- `// FIDELITY-WAIVER #002` in `Wagerproof/Features/Auth/Components/SocialSignInButton.swift`

## Notes

Apple's `SignInWithAppleButton` uses the native Apple-provided mark, so no equivalent asset import is needed for Apple. Only Google requires bundled assets.
