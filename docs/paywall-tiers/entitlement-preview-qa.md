# Entitlement preview and artwork gates

## Testing on iOS

In Settings, double-tap App Version to open Developer, then enable **Preview subscription access**. Choose Standard, Premium, Pro, a legacy account, or a new-plan account with no active access. The banner opens Developer again; Reset immediately restores actual access.

Preview is available in Debug and TestFlight only. It is session-only and resets on restart/sign-out. It does not write RevenueCat entitlements or backend permissions. Paywalls opened during preview cannot purchase. Turn preview off to test actual billing. Feature actions still use the real account's server permissions.

## Gate presentation

- Actual feature UI remains visible under a blur and scrim, with interaction disabled and its accessibility subtree hidden.
- One compact prompt reuses `TieredPaywallBolt` and `TieredPaywallArtwork` from the paywall.
- The prompt names the feature and required tier and opens the matching upgrade placement.
- Nested gates suppress duplicate prompts inside the outer locked preview.
- Accessibility text sizes use a vertical prompt layout and a shorter button label.
- Existing access-policy resolution and legacy subscription mappings are unchanged.

## Verified

Existing iPhone 17 Pro Max, iOS 26.0: `D69B4254-398D-4806-921B-56411888C597`.

- Standard: Props displays the Premium artwork gate over populated feature UI.
- The CTA opens the contextual paywall with Premium/Pro options and the current preview plan.
- Underlying locked controls are absent from the accessibility tree; unlock, preview controls, and tab navigation remain available.
- Premium and expired/no-access: Agents displays the Pro artwork gate over the agent office/list.
- Pro: the gate disappears and all three fixture agent cards are accessible.
- Largest accessibility text: prompt and CTA fit after switching to a vertical layout. Normal text size restored.
- Reset was exercised from the Standard banner: the banner/gate disappeared and the populated Props controls became accessible immediately.
- Earlier in this pass: Developer tier selection updated live; Premium unlocked populated Props; legacy Pro showed populated Agents; preview Continue explicitly started no purchase.
- Twelve isolated Swift model tests passed, including the preview tier matrix, ignoring previews when unavailable, restoring actual/legacy access, hosted checkout URLs, and placement policy.
- Final Debug simulator build passed.

Evidence: `.context/entitlement-preview-qa/`. The `*-artwork.png` screenshots are the current design; earlier screenshots in that directory show the superseded design.

These are local UI/policy tests. Real purchases, renewals, server authorization, and grants were not simulated or changed by the preview controls. An upgraded UI preview does not grant server access. Loaded screens can still perform ordinary read requests behind a gate; the overlay is presentation, not backend authorization.

## TestFlight delivery

Version **3.6.3 (383)** is `VALID`, `INTERNAL_ONLY`, and `IN_BETA_TESTING`. Build ID: `3687c3dc-e237-4e4c-8e56-8e22b191cff6`. Verified membership in the existing internal group `3a34683a-ad8f-43a7-88f0-0fe094a5637f`, and wrote/read back the English testing instructions. App and widget archive versions both match 3.6.3 (383). No public App Store submission was made.

The superseded local archive `.context/tiered-qa-3.6.3-383.xcarchive` was never uploaded. The delivered candidate is `.context/tiered-qa-3.6.3-383-artwork.xcarchive`.
