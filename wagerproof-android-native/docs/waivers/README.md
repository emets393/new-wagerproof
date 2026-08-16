# Fidelity Waivers

Every intentional divergence from the iOS app carries a `// FIDELITY-WAIVER #NNN` comment at the
code site. #001–#110 are carried over from the iOS RN→Swift migration; #201+ are Android-new.
This ledger is generated from the code comments (first occurrence per number). Waivers whose comment
has been removed because Android now matches (or beats) iOS are listed under **Resolved on Android**
at the bottom rather than left in the generated list.

- `FIDELITY-WAIVER #001: create-bots slide uses a Compose placeholder` — app/src/main/java/com/wagerproof/app/features/auth/OnboardingSlide.kt
- `FIDELITY-WAIVER #008: deterministic fallback team colors` — app/src/main/java/com/wagerproof/app/features/gamecards/SportTeamColors.kt
- `FIDELITY-WAIVER #011: live-score polling is not network-state gated` — core/stores/src/main/kotlin/com/wagerproof/core/stores/LiveScoresStore.kt
- `FIDELITY-WAIVER #024: CFB/NCAAB outlier palette fallback` — app/src/main/java/com/wagerproof/app/features/outliers/OutlierTeamPalette.kt
- `FIDELITY-WAIVER #027: onboarding has no offline write queue` — core/stores/src/main/kotlin/com/wagerproof/core/stores/OnboardingStore.kt
- `FIDELITY-WAIVER #051: FCM token retains the legacy expo_push_token column name` — core/services/src/main/kotlin/com/wagerproof/core/services/NotificationService.kt
- `FIDELITY-WAIVER #053: WagerBot admin rows remain deferred` — app/src/main/java/com/wagerproof/app/features/settings/DeveloperSettingsScreen.kt
- `FIDELITY-WAIVER #055: Meta event-test rows are not surfaced` — app/src/main/java/com/wagerproof/app/features/settings/DeveloperSettingsScreen.kt
- `FIDELITY-WAIVER #061: Roast has no production live-audio driver` — app/src/main/java/com/wagerproof/app/features/roast/RoastMicButtonView.kt
- `FIDELITY-WAIVER #062: Outliers refresh side effect differs from RN` — core/stores/src/main/kotlin/com/wagerproof/core/stores/OutliersStore.kt
- `FIDELITY-WAIVER #063: static robot art replaces Lottie` — app/src/main/java/com/wagerproof/app/features/learn/slides/Slide1Create247Agent.kt
- `FIDELITY-WAIVER #070: Top Agent Picks tab ownership differs` — core/stores/src/main/kotlin/com/wagerproof/core/stores/AgentsStore.kt
- `FIDELITY-WAIVER #071: static glow replaces RN's animated color cycle` — app/src/main/java/com/wagerproof/app/features/agents/components/GlowAccentBar.kt
- `FIDELITY-WAIVER #079: native time picker replaces custom 5-minute wheels` — app/src/main/java/com/wagerproof/app/features/agents/creation/inputs/TimePickerModal.kt
- `FIDELITY-WAIVER #101: owner-confirmed omission of iOS Dummy Data Mode` — core/stores/src/main/kotlin/com/wagerproof/core/stores/NBABettingTrendsStore.kt
- `FIDELITY-WAIVER #201: Apple Sign-In is omitted on Android` — app/src/main/java/com/wagerproof/app/features/auth/LoginView.kt
- `FIDELITY-WAIVER #203: CoreMotion parallax maps to Android sensors` — app/src/main/java/com/wagerproof/app/features/agents/components/AgentPickFocusView.kt
- `FIDELITY-WAIVER #205: agent charts are hand-drawn on Compose Canvas (chrome only — interpolation, index-anchored labels, and 160-point downsampling now match iOS)` — app/src/main/java/com/wagerproof/app/features/agents/components/AgentPerformanceCharts.kt
- `FIDELITY-WAIVER #210: widget gradient is approximated in Glance` — widgets/src/main/java/com/wagerproof/widgets/AgentMonitorWidget.kt
- `FIDELITY-WAIVER #211: unavailable widget SF Symbols map to emoji` — widgets/src/main/java/com/wagerproof/widgets/AgentMonitorWidget.kt
- `FIDELITY-WAIVER #212: pick-history presentation differs from iOS` — app/src/main/java/com/wagerproof/app/features/agents/components/PickHistoryFolder.kt
- `FIDELITY-WAIVER #215: focus backdrop has no ultraThinMaterial blur` — app/src/main/java/com/wagerproof/app/features/agents/components/AgentPickFocusView.kt
- `FIDELITY-WAIVER #220: WagerBot SF Symbol fallbacks are approximate` — app/src/main/java/com/wagerproof/app/features/chat/WagerBotUiTokens.kt
- `FIDELITY-WAIVER #230: no pre-Android-26 glass-disc merge` — app/src/main/java/com/wagerproof/app/features/outliers/OutliersShared.kt
- `FIDELITY-WAIVER #231: Compose large-title collapse approximation` — app/src/main/java/com/wagerproof/app/features/agents/AgentsScreen.kt
- `FIDELITY-WAIVER #232: outlier avatar/headshot renderer differs` — app/src/main/java/com/wagerproof/app/features/outliers/OutliersTrendCard.kt
- `FIDELITY-WAIVER #233: outlier detail sheet sizing differs` — app/src/main/java/com/wagerproof/app/features/outliers/OutliersTrendDetailSheet.kt
- `FIDELITY-WAIVER #234: pinned outlier section header is approximated` — app/src/main/java/com/wagerproof/app/features/outliers/OutliersTrendsView.kt
- `FIDELITY-WAIVER #235: drifting-symbol/glass animation is static` — app/src/main/java/com/wagerproof/app/features/outliers/OutliersHowToBanner.kt
- `FIDELITY-WAIVER #236: matchup glass-disc merge is approximated` — app/src/main/java/com/wagerproof/app/features/outliers/OutlierMatchupCardView.kt
- `FIDELITY-WAIVER #240: several Android-native component substitutions` — app/src/main/java/com/wagerproof/app/features/auth/ResetPasswordScreen.kt
- `FIDELITY-WAIVER #241: animated auth/props/outlier chrome differs` — app/src/main/java/com/wagerproof/app/features/auth/AuthGateScreen.kt
- `FIDELITY-WAIVER #242: nested-scroll props hero replaces iOS transition` — app/src/main/java/com/wagerproof/app/features/props/detail/PropsCollapsingScaffold.kt (scope extended 2026-08-15: also hosts the NFL analysis detail — picker-in-hero chip strip that FILTERS markets vs iOS's pinned-accessory strip; visual behaviour matches, internals differ)
- `FIDELITY-WAIVER #244: SF Symbols use Material equivalents` — app/src/main/java/com/wagerproof/app/features/onboarding/components/OnboardingIcons.kt
- `FIDELITY-WAIVER #251: Assistant FAB uses a single tonal shadow` — app/src/main/java/com/wagerproof/app/features/navigation/AssistantFab.kt
- `FIDELITY-WAIVER #256: notification test flow differs` — app/src/main/java/com/wagerproof/app/features/settings/DeveloperSettingsScreen.kt
- `FIDELITY-WAIVER #257: Settings hero banners use static Material chrome` — app/src/main/java/com/wagerproof/app/features/settings/SettingsScreen.kt
- `FIDELITY-WAIVER #260: onboarding Liquid Glass uses a Compose approximation` — app/src/main/java/com/wagerproof/app/features/onboarding/OnboardingPageShell.kt
- `FIDELITY-WAIVER #280: regression narrative uses plain text instead of markdown` — app/src/main/java/com/wagerproof/app/features/analytics/RegressionNarrativeCard.kt
- `FIDELITY-WAIVER #281: NCAAB model card lives outside the Outliers package` — app/src/main/java/com/wagerproof/app/features/outliers/NCAABModelAccuracyView.kt
- `FIDELITY-WAIVER #301: glass blur / dashed-stroke approximations` — app/src/main/java/com/wagerproof/app/features/agents/components/AgentPerformanceCharts.kt (also app/src/main/java/com/wagerproof/app/features/roast/RoastMessageBubble.kt — the AgentDetailHero sprite-swap use of this number is RESOLVED, see below)
- `FIDELITY-WAIVER #320: agent detail collapse is custom Compose` — app/src/main/java/com/wagerproof/app/features/agents/AgentDetailScreen.kt
- `FIDELITY-WAIVER #334: AI Connector banner symbol chrome is static` — app/src/main/java/com/wagerproof/app/features/settings/AIConnectorBanner.kt
- `FIDELITY-WAIVER #335: Android connector guide is platform-specific` — app/src/main/java/com/wagerproof/app/features/settings/ConnectorGuideScreen.kt
- `FIDELITY-WAIVER #336: agent row card fill is flat, not ultraThinMaterial` — app/src/main/java/com/wagerproof/app/features/agents/components/AgentRowCard.kt
- `FIDELITY-WAIVER #B21: RevenueCat stream binds the Android SDK listener directly` — core/stores/src/main/kotlin/com/wagerproof/core/stores/RevenueCatStore.kt

## Resolved on Android

Waiver comments removed from the code; kept here so the numbers stay traceable.

- **#301 (AgentDetailHero.kt use only)** agent sprite while generating was approximated with the
  standing avatar — RESOLVED. `AvatarDisc` now swaps to the seated `SitWorkSprite` +
  `LaptopSprite` (ported into `components/AgentResearchIdleCard.kt`) while a run is in flight,
  matching iOS. #301 itself is NOT fully resolved — it's a shared number still covering blur/
  dashed-stroke approximations in `AgentPerformanceCharts.kt` and `RoastMessageBubble.kt`.
- **#305** swipe-to-generate control was Android-native — RESOLVED. The card and the regenerate
  sheet now share one `SwipeToGeneratePill` (`components/AgentResearchIdleCard.kt`) with the iOS
  heat-up fill, per-notch haptics, 90% commit threshold, and locked capsule.
- **#033** line-movement chart stub — RESOLVED. `features/cfb/CFBLineMovementSection.kt` now draws a
  real chart off the game-keyed `nfl_line_movement` / `cfb_line_movement` views. The corresponding
  iOS stub at `Wagerproof/Features/CFB/Components/LineMovementSection.swift` is still real, so
  Android is ahead of iOS here rather than at parity.
- **#254** Discord link-state read not performed — RESOLVED. `features/settings/DiscordScreen.kt`
  reads live link state from `profiles.discord_user_id`.
- **#052 / #250** paywall and funnel parity — RESOLVED. Android now ships the custom checkout,
  generic RevenueCat UI, full Mixpanel/Meta funnel, and hard-gate semantics.
- **#253** Play In-App Review unavailable — RESOLVED. `ReviewPromptCoordinator` owns contextual
  triggers and `RootHost` launches the Play review flow; Settings retains the manual listing action.
- **#214** receipt-printer feed measured by fraction-of-card — RESOLVED. `AgentPickFocusView`
  now measures the region and drives the feeding card's TOP from the slot to the pager's rest
  inset (`TICKET_TOP_INSET`), at natural unbounded height inside a clipped region, so the
  hand-off to the pager is seamless like iOS's `.position`-based feed.
- **Plain-text pick share** (was folded into #203's comment) — RESOLVED. Share now renders the
  ticket off-screen at 340 dp / ≥3× density to a transparent PNG and sends `image/png` through a
  FileProvider uri, matching iOS's `ImageRenderer` export. The chooser is given an `IntentSender`
  callback so `ReviewPromptCoordinator.recordContentShared()` only fires when a target was
  actually chosen. A text body remains as the render-failure fallback only.

## Owner-confirmed divergences (2026-07-31)

Product-owner decisions from the parity push; these are deliberate and should not be re-flagged
as gaps by future audits:

- **#201 Apple Sign-In stays out.** Confirmed: Android ships without it; Apple-only accounts are
  iOS/web-only. (Avoids owning the 6-month Apple web client-secret JWT rotation for Android.)
- **NFL Public Betting stays Pro-gated on Android** even though iOS serves it free — the Android
  gate is the intended monetization boundary, not a port bug.
- **WagerBot Voice is not a production Android feature** — the chat entry point is removed;
  Developer/Secret Settings entry only, matching iOS's incubating status.
- **MAMMOTH PLAY / High Conviction / Signals feed-card badges are deprecated on Android** — being
  removed; conviction surfaces on the detail page only, matching iOS.
- **Dummy Data Mode is not ported** — the inert toggle is removed rather than backed by fixtures;
  offseason NBA/NCAAB/CFB screens ship unverified until their seasons start.

## Open waivers with a pending backend step

- **#051** (push token) — the `expo_push_token` column name is still the RN-era one and the waiver
  stands, but the token it holds is a bare FCM registration token and that is now correct:
  `supabase/functions/send-agent-pick-ready-notification` sniffs the token shape
  (`ExponentPushToken[…]` → Expo, 64-hex → APNs, else FCM v1) and the FCM branch sends
  `channel_id: wagerproof_updates`, matching `NotificationService.REMOTE_CHANNEL_ID`. Pending
  deploy with `FCM_SERVICE_ACCOUNT_JSON` set before Android devices actually receive the push.
