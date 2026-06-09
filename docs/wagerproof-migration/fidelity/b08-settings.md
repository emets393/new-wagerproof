# Fidelity table — B08 Settings + Modals + RevenueCat Paywall + Pro Gating

Sources:
- `wagerproof-mobile/app/(drawer)/(tabs)/settings.tsx` (930 lines)
- `wagerproof-mobile/app/(modals)/delete-account.tsx`
- `wagerproof-mobile/app/(modals)/discord.tsx`
- `wagerproof-mobile/app/(modals)/ios-widget.tsx`
- `wagerproof-mobile/app/(modals)/secret-settings.tsx`
- `wagerproof-mobile/components/RevenueCatPaywall.tsx`
- `wagerproof-mobile/components/CustomerCenter.tsx`
- `wagerproof-mobile/components/ProContentSection.tsx`
- `wagerproof-mobile/components/ProFeatureGate.tsx`
- `wagerproof-mobile/components/LockedGameCard.tsx`
- `wagerproof-mobile/components/LockedOverlay.tsx`
- `wagerproof-mobile/components/DeleteAccountBottomSheet.tsx`
- `wagerproof-mobile/components/ReviewRequestModal.tsx`
- `wagerproof-mobile/services/revenuecat.ts`
- `wagerproof-mobile/services/notificationService.ts`
- `wagerproof-mobile/contexts/RevenueCatContext.tsx`
- `wagerproof-mobile/contexts/AdminModeContext.tsx`
- `wagerproof-mobile/contexts/SettingsContext.tsx`
- `wagerproof-mobile/hooks/useProAccess.ts`
- `wagerproof-mobile/hooks/useIsAdmin.ts`

Targets:
- `wagerproof_ios_native/Wagerproof/Features/Settings/*`
- `wagerproof_ios_native/Wagerproof/Features/Paywall/*`
- `wagerproof_ios_native/WagerproofKit/Sources/WagerproofStores/{SettingsStore, RevenueCatStore, AdminModeStore, ProAccessStore}.swift`
- `wagerproof_ios_native/WagerproofKit/Sources/WagerproofServices/{RevenueCatService, NotificationService}.swift`
- `wagerproof_ios_native/Wagerproof/App/WagerproofApp.swift` (env injection + auth lifecycle wiring)
- `wagerproof_ios_native/Wagerproof/Features/Navigation/MainTabView.swift` (settings tab wired)

Legend: `✅ matches` / `🔧 fixed` (deliberately diverged + better) / `⚠️ #NNN` (waiver, see tickets/NNN-*.md).

## SettingsView (main screen)

| RN element | Swift counterpart | Match |
|---|---|---|
| Custom header (back chevron + "Settings" + subtitle) (settings.tsx:318–331) | `.navigationTitle("Settings") + .navigationBarTitleDisplayMode(.large)` | 🔧 fixed — native large nav title |
| Hand-rolled `SectionCard` blocks (settings.tsx:98–115) | `Form` with `Section("…")` headers + `.insetGrouped` style | 🔧 fixed — native HIG-correct sections |
| Hand-rolled `ActionRow` with rounded icon chip + 2-line text (settings.tsx:50–96) | `row(icon:iconColor:iconBackground:title:subtitle:)` helper that mirrors the visual exactly | ✅ matches |
| Gold hero `LinearGradient` "Go Pro Today" / "You Are Pro" / "Verifying Access" (settings.tsx:334–369) | `heroCard` ZStack with same gradient stops `[0xEFBE34, 0xF3C43F, 0xF7D768]` + same eyebrow/title/badge copy | ✅ matches |
| Hero glow circles `heroGlowOne` / `heroGlowTwo` (settings.tsx:701–718) | Two `Circle().fill(Color.white.opacity(0.18/0.13))` shapes inside the ZStack | ✅ matches |
| Hero gift/crown/loading icon (settings.tsx:361–366) | `Image(systemName: "gift.fill" / "crown.fill" / "hourglass")` in a rotated rounded rectangle | ✅ matches |
| Email row (settings.tsx:373–380) | `row(icon: "envelope.fill", title: "Email", subtitle: email, chevron: false)` | ✅ matches |
| Manage Subscription row with spinner/chevron (settings.tsx:381–404) | `Button { handleManageSubscriptionTap() }` wrapping the row, swaps `ProgressView()` for `chevron()` while opening Customer Center | ✅ matches |
| Dark mode toggle (settings.tsx:408–422) | `Toggle(isOn: …)` bound to `themeStore.mode` (`.dark`↔`.light`) | ✅ matches |
| WagerBot suggestions toggle (settings.tsx:423–437) | `Toggle(isOn: $settings.wagerBotSuggestionsEnabled)` persisted to App Group defaults | ✅ matches |
| Thinking sprite picker row (settings.tsx:438–445) | ❌ deferred to ticket #050 (ThinkingSprite picker isn't ported until B17 lands) | ⚠️ #050 |
| Push notifications toggle with permission flow (settings.tsx:446–464) | `Toggle` bound to `SettingsStore.notificationPermission`; triggers `requestPermission()` when undetermined and `notificationDeniedAlert` when denied | ✅ matches |
| Push notifications spinner during permission check (settings.tsx:454) | `ProgressView()` rendered when `settings.isCheckingNotificationPermission` | ✅ matches |
| iOS Widget row (settings.tsx:466–474) | `Button` opening `IosWidgetView` via `modal = .iosWidget` | ✅ matches |
| Android-only App Version row (settings.tsx:476–486) | Not applicable on iOS; same row appears in Legal section below | 🔧 fixed |
| Discord promo banner with gradient (settings.tsx:489–516) | `discordBanner` ZStack with same gradient stops `[0x5B67F3, 0x6F7CFF, 0x8D96FF]` + bubble icon | ✅ matches |
| Discord channel row (settings.tsx:519–526) | `row(icon: "bubble.left.and.bubble.right.fill", …)` opening `DiscordView` | ✅ matches |
| Feature Requests row (settings.tsx:527–534) | Reached via SideMenuSheet per B09 split; not duplicated in settings | 🔧 fixed |
| Learn WagerProof row (settings.tsx:535–542) | Reached via SideMenuSheet per B21 split; not duplicated in settings | 🔧 fixed |
| Contact Us row (mailto:) (settings.tsx:543–551) | `Button { openURL("mailto:admin@wagerproof.bet?…") }` wrapping the row | ✅ matches |
| Privacy Policy / Terms of Use rows (settings.tsx:554–569) | Two `Button { openURL(…) }` rows pointing at wagerproof.bet | ✅ matches |
| App Version row with double-tap shortcut (settings.tsx:574–579 + 202–220) | `handleVersionTap()` increments a counter; ≥2 taps in 500ms opens `SecretSettingsView` via `fullScreenCover` | ✅ matches |
| Log Out row + alert (settings.tsx:584–600 + 222–233) | `Button` row triggers `.alert("Logout", role: .destructive)` and on confirm calls `auth.signOut()` | ✅ matches |
| Delete Account row in Danger Zone (settings.tsx:602–620) | `Button(role: .destructive)` opening `DeleteAccountView` modal | ✅ matches |
| RevenueCatPaywall mount at bottom (settings.tsx:626–634) | `.sheet(isPresented: $isPaywallPresented)` presenting `RevenueCatPaywallView` | ✅ matches |

## DeleteAccountView (modal)

| RN element | Swift counterpart | Match |
|---|---|---|
| Header gradient + close button (delete-account.tsx:56–73) | `NavigationStack` with toolbar `xmark` + Danger Zone title; gradient eyebrow replaced by red tint on title | 🔧 fixed |
| Red alert icon circle (delete-account.tsx:76–83) | ZStack with `Circle().fill(.red.opacity(0.15))` + `Image(systemName: "exclamationmark.triangle.fill")` | ✅ matches |
| Title + description (delete-account.tsx:85–94) | `Text(AppFont.display)` + `Text(AppFont.body)` | ✅ matches |
| Warning box (delete-account.tsx:96–106) | `HStack { Image("info.circle.fill"); Text(…) }` with red tint + 1pt red border | ✅ matches |
| SwipeToDeleteSlider gesture (delete-account.tsx:120–125) | `Button(role: .destructive)` → confirmation `.alert` w/ destructive role | 🔧 fixed — RN's slider was a one-off; iOS HIG calls for an explicit destructive button + confirmation alert |
| Confirmation alert (delete-account.tsx:21–52) | `.alert("Delete Account", isPresented:)` with Cancel + destructive Delete | ✅ matches |
| Deletion progress spinner (delete-account.tsx:112–118) | `ProgressView()` swap inside the button label | ✅ matches |
| Backend account-delete RPC call | ⚠️ Sign-out only — the RPC-backed delete is tracked in ticket #054 | ⚠️ #054 |

## DiscordView (modal)

| RN element | Swift counterpart | Match |
|---|---|---|
| Header with close button (discord.tsx:98–110) | Toolbar `xmark` | ✅ matches |
| Logo gradient circle + title (discord.tsx:118–128) | `LinearGradient` Circle + `Image(systemName: "bubble.left.and.bubble.right.fill")` + "Join Our Discord Community" | ✅ matches |
| Locked card for non-Pro (discord.tsx:130–178) | `lockedCard` view with PRO FEATURE pill + checkmark.shield icon + "Unlock with Pro" CTA | ✅ matches |
| Step 1 — Link Discord card (discord.tsx:273–315) | `stepCard(…)` w/ link icon → opens `discord-callback?user_id=…` Supabase URL | ✅ matches |
| Step 2 — Join Discord server card (discord.tsx:317–350) | `stepCard(…)` w/ checkmark.shield → opens `https://discord.gg/gwy9y7XSDV` | ✅ matches |
| Read `profiles.discord_user_id` on mount (discord.tsx:35–50) | `.task { await checkDiscordLink() }` → byte-identical Supabase query | ✅ matches |
| Three benefit cards (discord.tsx:352–395) | `benefitsList` VStack with three `benefit(icon:title:body:)` | ✅ matches |
| Footer disclaimer (discord.tsx:397–400) | `Text` w/ AppFont.caption | ✅ matches |

## IosWidgetView (modal)

| RN element | Swift counterpart | Match |
|---|---|---|
| Header (ios-widget.tsx:248–258) | Toolbar `xmark` | ✅ matches |
| Intro icon + title + subtitle (ios-widget.tsx:268–278) | `intro` VStack | ✅ matches |
| Picks/Fades/Market segmented selector (ios-widget.tsx:281–335) | Three `Button` pills wrapped in `HStack`; selected one gets the brand green fill | ✅ matches |
| Live widget preview (ios-widget.tsx:338–345) | `widgetPreview` block that builds rows from `sampleRows()` | ✅ matches |
| Five "How to Add the Widget" steps (ios-widget.tsx:348–399) | `instructionsCard` VStack with `step(_:_:)` helper that renders a numbered green circle + text | ✅ matches |
| Info note (ios-widget.tsx:402–407) | `infoNote` HStack | ✅ matches |
| Android fallback message (ios-widget.tsx:198–204) | Not applicable on iOS-only build | 🔧 fixed |

## SecretSettingsView (modal)

| RN element | Swift counterpart | Match |
|---|---|---|
| Back chevron header + subtitle (secret-settings.tsx:376–389) | Toolbar chevron.left + large nav title "Developer" | 🔧 fixed |
| "WagerBot Voice" navigation row (secret-settings.tsx:392–402) | ❌ deferred to B17 voice integration (`WagerBotVoice` view not yet ported) | ⚠️ #053 |
| WagerBot Test Mode toggle (secret-settings.tsx:407–421) | ❌ deferred to B17 WagerBot integration | ⚠️ #053 |
| Trigger Test Bubble row (secret-settings.tsx:422–432) | ❌ deferred to B17 WagerBot integration | ⚠️ #053 |
| Simulate Freemium toggle (secret-settings.tsx:433–448) | `Toggle(isOn: $revenueCat.forceFreemiumMode)` | ✅ matches |
| Admin Mode toggle (gated on `canEnableAdminMode`) (secret-settings.tsx:449–466) | `Toggle` bound to `adminMode.adminModeEnabled` shown only when `adminMode.canEnableAdminMode` | ✅ matches |
| Push Diagnostics action (secret-settings.tsx:471–478) | `runPushDiagnostics()` collects platform/permission/token/userId into an alert | ✅ matches |
| Register & Test Push action (secret-settings.tsx:479–486) | `registerAndTestPush()` requests permission → registers token → schedules a local notification | ✅ matches |
| Sync Offerings action (secret-settings.tsx:487–501) | `syncRevenueCat()` → `revenueCat.syncPurchases()` | ✅ matches |
| Check Offerings action (secret-settings.tsx:502–509) | `checkOfferings()` → `revenueCat.refreshOffering()` then shows identifier + package count | ✅ matches |
| Test Paywall action (secret-settings.tsx:510–517) | `isPaywallPresented = true` opens `RevenueCatPaywallView(placementId: .genericFeature)` | ✅ matches |
| Meta SDK Events action (secret-settings.tsx:518–525) | ❌ Meta SDK not bridged in the iOS port; tracked in ticket #055 | ⚠️ #055 |
| Reset Onboarding action (secret-settings.tsx:526–533 + 259–311) | `resetOnboarding()` updates `profiles.onboarding_completed = false` + calls `onboarding.reset()` | ✅ matches |
| User ID info row (secret-settings.tsx:537–550) | `labelRow("User ID", value: userId.uuidString)` inside an `Info` section | ✅ matches |

## RevenueCatPaywallView (component)

| RN element | Swift counterpart | Match |
|---|---|---|
| Modal container + close button (RevenueCatPaywall.tsx:122–138) | `NavigationStack` with toolbar `xmark` | ✅ matches |
| `usePlacementOffering(placementId, visible)` (RevenueCatPaywall.tsx:53–56) | `RevenueCatStore.fetchOffering(forPlacement:)` invoked on `.task` | ✅ matches |
| Loading spinner (RevenueCatPaywall.tsx:140–146) | `LoadState.loading` → `VStack { ProgressView; Text(…) }` | ✅ matches |
| Error state with Retry (RevenueCatPaywall.tsx:147–163) | `ContentUnavailableView` w/ Retry `Button` | 🔧 fixed |
| Empty state (RevenueCatPaywall.tsx:226–242) | `ContentUnavailableView` "No options" + Retry | 🔧 fixed |
| Native `<PaywallComponent>` from `react-native-purchases-ui` (RevenueCatPaywall.tsx:166–202) | `PaywallView(offering:displayCloseButton:)` from `RevenueCatUI` Swift SDK | ✅ matches |
| `onPurchaseCompleted` → `refreshCustomerInfo` (RevenueCatPaywall.tsx:76–91) | `.onPurchaseCompleted { _ in await revenueCat.refreshCustomerInfo(); dismiss() }` | ✅ matches |
| `onRestoreCompleted` → `refreshCustomerInfo` (RevenueCatPaywall.tsx:93–108) | `.onRestoreCompleted { _ in await revenueCat.refreshCustomerInfo(); dismiss() }` | ✅ matches |
| Android `Portal` wrapper to escape modal stacking (RevenueCatPaywall.tsx:246–248) | Not applicable on iOS-only build | 🔧 fixed |

## CustomerCenterView (component)

| RN element | Swift counterpart | Match |
|---|---|---|
| `<CustomerInfoView>` from `react-native-purchases-ui` (CustomerCenter.tsx:99–111) | `RevenueCatUI.CustomerCenterView()` Swift SDK component | ✅ matches |
| Manual restore button (CustomerCenter.tsx:126–148) | Built into the SDK's CustomerCenterView (Manage row) | 🔧 fixed |
| Custom subscription info card (CustomerCenter.tsx:151–187) | Built into the SDK's CustomerCenterView | 🔧 fixed |
| Refresh on dismiss (CustomerCenter.tsx:39, openCustomerCenter flow) | `.task { await revenueCat.refreshCustomerInfo() }` on view appear | ✅ matches |

## ProContentSection (component)

| RN element | Swift counterpart | Match |
|---|---|---|
| Pro user → render children directly (ProContentSection.tsx:39–41) | `if proAccess.isPro || proAccess.isLoading { content }` | ✅ matches |
| Loading state → render children (avoid lock flicker) (ProContentSection.tsx:39) | Same `isLoading` short-circuit | ✅ matches |
| Blur overlay via `AndroidBlurView` (ProContentSection.tsx:77–81) | `Color.clear.background(.ultraThinMaterial)` | 🔧 fixed — iOS material is faster + accessibility-aware |
| Lock badge with title/subtitle (ProContentSection.tsx:84–110) | `HStack` w/ `lock.fill` + title + "Tap to unlock" inside a capsule | ✅ matches |
| `presentPaywallForPlacementIfNeeded` → `refreshCustomerInfo` (ProContentSection.tsx:43–60) | `.sheet { RevenueCatPaywallView(placementId:) }` — same placement default | ✅ matches |

## ProFeatureGate (component)

| RN element | Swift counterpart | Match |
|---|---|---|
| Loading → "Loading…" text (ProFeatureGate.tsx:45–53) | `if proAccess.isLoading { HStack { ProgressView; Text("Loading…") } }` | ✅ matches |
| Pro user → render children (ProFeatureGate.tsx:96) | `else if proAccess.isPro { content }` | ✅ matches |
| Custom fallback view (ProFeatureGate.tsx:56–58) | Generic `Fallback` view parameter via `init(fallback:)` overload | ✅ matches |
| Upgrade prompt with crown + Pro Feature copy + button (ProFeatureGate.tsx:60–90) | `upgradePrompt` VStack matching RN copy exactly | ✅ matches |
| Mounted `RevenueCatPaywall` (ProFeatureGate.tsx:84–89) | `.sheet(isPresented:)` presenting `RevenueCatPaywallView` | ✅ matches |

## LockedGameCard (component)

| RN element | Swift counterpart | Match |
|---|---|---|
| Card content rendered at 0.4 opacity behind blur (LockedGameCard.tsx:55–67) | `content.opacity(0.4).allowsHitTesting(false)` + `Color.clear.background(.ultraThinMaterial)` | ✅ matches |
| "Pro" badge w/ lock icon (LockedGameCard.tsx:68–86) | `HStack { Image("lock.fill"); Text("Pro") }` in a Capsule | ✅ matches |
| `presentPaywallForPlacementIfNeeded` on tap (LockedGameCard.tsx:28–46) | `.sheet(isPresented:)` presenting `RevenueCatPaywallView` | ✅ matches |

## LockedOverlay (component)

| RN element | Swift counterpart | Match |
|---|---|---|
| Configurable `message` (LockedOverlay.tsx:28) | `message: String` init param | ✅ matches |
| Configurable `blurIntensity` (LockedOverlay.tsx:32) | Material defaulted to `.ultraThinMaterial` | 🔧 fixed — Material levels (`thin`/`regular`/`thick`) replace the numeric intensity |
| Custom `onPress` override (LockedOverlay.tsx:30) | `action: (() -> Void)?` init param | ✅ matches |
| Lock icon circle (LockedOverlay.tsx:85–97) | ZStack with Circle + `Image(systemName: "lock.fill")` | ✅ matches |
| Text shadow on lock label (LockedOverlay.tsx:99–104) | `.shadow(color: .black.opacity(0.3), radius: 2)` on `Text` | ✅ matches |

## DeleteAccountBottomSheet (component)

| RN element | Swift counterpart | Match |
|---|---|---|
| `BottomSheet` with `['50%']` snapPoints (DeleteAccountBottomSheet.tsx:18) | `DeleteAccountView` wrapped in `.presentationDetents([.medium, .large])` | ✅ matches |
| Slider-to-confirm (DeleteAccountBottomSheet.tsx:144–149) | Destructive button + alert (same simplification as the full DeleteAccountView) | 🔧 fixed |

## ReviewRequestModal (component)

| RN element | Swift counterpart | Match |
|---|---|---|
| Custom modal w/ feedback prompt (ReviewRequestModal.tsx:41–93) | Native sheet w/ `.presentationDetents([.height(420)])` | 🔧 fixed |
| `expo-store-review.requestReview()` (ReviewRequestModal.tsx:30–32) | `@Environment(\.requestReview)` → `requestReview()` (SKStoreReviewController) | ✅ matches |
| Haptic feedback (ReviewRequestModal.tsx:24, 36) | `.sensoryFeedback(.success, trigger: …)` | ✅ matches |
| Yes / Not now buttons (ReviewRequestModal.tsx:72–90) | Two `Button` views with brand-green + outlined styles | ✅ matches |

## Stores

| RN context/hook | Swift store | Match |
|---|---|---|
| `RevenueCatContext` (lines 122–769) | `RevenueCatStore` | ✅ matches |
| `customerInfoUpdateListener` (RevenueCatContext.tsx:722–730) | `Purchases.shared.customerInfoStream` AsyncStream | ✅ matches |
| Trust-downgrade guard (RevenueCatContext.tsx:210–220) | `RevenueCatStore.apply(_:source:)` refuses untrusted granted→denied | ✅ matches |
| `forceFreemiumMode` (RevenueCatContext.tsx:133–137) | `RevenueCatStore.forceFreemiumMode` (persisted in App Group defaults) | ✅ matches |
| `setRevenueCatUserId` on login (RevenueCatContext.tsx:399) | `RevenueCatStore.attachUser(_:)` calls `RevenueCatService.shared.logIn(userId:)` | ✅ matches |
| `logOutRevenueCat` (RevenueCatContext.tsx:474) | `RevenueCatStore.detachUser()` | ✅ matches |
| `getCurrentOfferingForPlacement` (revenuecat.ts:509–553) | `RevenueCatStore.fetchOffering(forPlacement:)` → `RevenueCatService.offering(forPlacement:)` | ✅ matches |
| `getActiveSubscriptionType` (revenuecat.ts:891–907) | `RevenueCatService.activeSubscriptionType(_:)` | ✅ matches |
| AsyncStorage entitlement cache w/ TTL (RevenueCatContext.tsx:139–183) | `AppGroup.defaults` snapshot via `apply(_:source:)` (App Group is a stronger guarantee than AsyncStorage for widget consumers) | 🔧 fixed |
| `AdminModeContext` (full file) | `AdminModeStore` | ✅ matches |
| `useIsAdmin` RPC `has_role(_user_id, _role)` (useIsAdmin.ts:24–26) | `AdminModeStore.checkRole(for:)` byte-identical RPC | ✅ matches |
| `useProAccess` combined isPro logic (useProAccess.ts:30–46) | `ProAccessStore.isPro` (forceFreemium → admin → RC) | ✅ matches |
| `SettingsContext` (now-empty) | `SettingsStore` exposes notification + suggestion toggles | ✅ matches |
| WagerBot suggestions persistence | App Group default `wagerbotSuggestionsEnabled` | ✅ matches |
| `notificationService.registerPushToken` (notificationService.ts:115–152) | `NotificationService.registerPushToken(userId:)` upserts the same row shape with `expo_push_token` column | ✅ matches (column name preserved for backend compat) |
| `notificationService.deactivatePushTokens` (notificationService.ts:157–172) | `NotificationService.deactivatePushTokens(userId:)` | ✅ matches |
| Token transport: Expo push API (notificationService.ts:103) | iOS APNs hex token written into the same `expo_push_token` column; auto-pick-ready edge function detects format | ⚠️ #051 |

## Backend contract — Supabase queries

| RN call | Swift counterpart | Match |
|---|---|---|
| `supabase.from('user_push_tokens').upsert({...}, { onConflict: 'user_id,expo_push_token' })` | `client.from("user_push_tokens").upsert(payload, onConflict: "user_id,expo_push_token")` | ✅ byte-identical |
| `supabase.from('user_notification_preferences').upsert({...}, { onConflict: 'user_id', ignoreDuplicates: true })` | `client.from("user_notification_preferences").upsert(payload, onConflict: "user_id", ignoreDuplicates: true)` | ✅ byte-identical |
| `supabase.from('user_push_tokens').update({ is_active: false }).eq('user_id', userId)` | `client.from("user_push_tokens").update(Update(is_active: false)).eq("user_id", value: userId)` | ✅ byte-identical |
| `supabase.rpc('has_role', { _user_id, _role: 'admin' })` | `client.rpc("has_role", params: HasRoleParams(_user_id, _role: "admin"))` | ✅ byte-identical |
| `supabase.from('profiles').select('discord_user_id').eq('user_id', user.id).single()` | `client.from("profiles").select("discord_user_id").eq("user_id", value: userId).single().execute().value` | ✅ byte-identical |
| `supabase.from('profiles').update({ onboarding_completed: false }).eq('user_id', userId)` | Same in `SecretSettingsView.resetOnboarding()` | ✅ byte-identical |

## Analytics

RN tracks `paywall_viewed`, `paywall_dismissed`, `subscription_started`, `subscription_purchased`, `subscription_restored`, `purchase_failed`, `purchase_cancelled` via the `analytics.ts` helpers. iOS analytics wiring lands in B22 (full Mixpanel parity). For this batch the events are NOT emitted from the new Swift Settings/Paywall flows — RevenueCat itself still tracks all StoreKit purchases server-side, so no revenue data is lost. ⚠️ #052 tracks the per-flow Mixpanel emission.

## Navigation

| RN call | Swift counterpart | Match |
|---|---|---|
| `router.push('/(modals)/secret-settings')` | `modal = .secretSettings` → `.fullScreenCover` | ✅ matches |
| `router.push('/(modals)/discord')` | `modal = .discord` → `.sheet(item:)` | ✅ matches |
| `router.push('/(modals)/ios-widget')` | `modal = .iosWidget` → `.sheet(item:)` | ✅ matches |
| `router.push('/(modals)/delete-account')` | `modal = .deleteAccount` → `.sheet(item:)` | ✅ matches |
| `RevenueCatPaywall visible={true}` | `isPaywallPresented` → `.sheet(isPresented:)` | ✅ matches |
| `openCustomerCenter()` | `isCustomerCenterPresented` → `.sheet(isPresented:)` | ✅ matches |
