# 08 — Per-screen native specification (Wagerproof)

This document is the **screen-by-screen specification** for the Swift port of Wagerproof. For every screen / sheet that exists in the RN app, it lists:

- Layout container (`List` / `LazyVGrid` / `ScrollView` / `Form`)
- Navigation chrome (title display mode, toolbar items, tab visibility)
- Native primitives applied (from the catalog at [Honeydew's 07-native-interactions.md](https://github.com/anthropics/honeydew_ios_native/docs/swift-migration/07-native-interactions.md))
- Gesture choreography (taps, long-presses, swipes, drags)
- Animations and transitions
- Haptic events
- Empty / loading / error states
- Edge cases preserved from RN

If a primitive is named here, look up its implementation in [Honeydew's 07-native-interactions.md](https://github.com/anthropics/honeydew_ios_native/docs/swift-migration/07-native-interactions.md). If a motion or haptic token is named, look up its definition in [Honeydew's 09-motion-and-haptics.md](https://github.com/anthropics/honeydew_ios_native/docs/swift-migration/09-motion-and-haptics.md).

This document was assembled from two parallel research passes against the RN source (~3,500 lines of source across 41 screens / sheets). Section ordering: auth → onboarding → drawer/tab shell → core tabs → agents → sport-specific sheets → analytics → settings/devtools → chat / voice → premium sheets.

> **How implementer agents use this document**
> 1. Re-read your screen's RN source end-to-end.
> 2. Find your screen's section below.
> 3. Cross-reference primitives, haptics, animation tokens.
> 4. Build the Swift view; capture the parity screenshots; reviewer signs off.

---

## A. Global primitive map (apply everywhere)

The following RN → SwiftUI swaps apply to **every** screen unless a screen-specific note overrides. Implementer agents should NOT re-decide these per screen.

### A.1 Containers

| RN | SwiftUI |
|---|---|
| `ScrollView` (vertical) | `ScrollView { ... }` |
| `ScrollView horizontal` | `ScrollView(.horizontal) { LazyHStack { ... } }` with `.scrollTargetBehavior(.viewAligned)` when paging matters |
| `FlatList` (homogeneous) | `List { ForEach(...) { ... } }` or `LazyVStack` inside `ScrollView` if the rows need custom backgrounds |
| `SectionList` | `List { Section { ... } header: { ... } }` |
| `View` (just a stack) | `VStack` / `HStack` / `ZStack` |
| `SafeAreaView` | `.ignoresSafeArea(...)` opt-out from the outside; SwiftUI inherits safe area by default |
| `KeyboardAvoidingView` | system handles this — no modifier needed |
| `Modal` (transparent overlay) | `.sheet(item:)` or `.fullScreenCover(item:)` |
| `@gorhom/bottom-sheet` | `.sheet(item:)` + `.presentationDetents([.medium, .large])` + `.presentationDragIndicator(.visible)` |
| `Pressable` / `TouchableOpacity` | `Button { ... } label: { ... }.buttonStyle(.plain)` |
| `Linking.openURL` | `@Environment(\.openURL)` or `Link` |

### A.2 Inputs

| RN | SwiftUI |
|---|---|
| `TextInput` | `TextField` (single line) / `TextEditor` (multi-line) |
| `TextInput.keyboardType="email-address"` | `.textContentType(.emailAddress).keyboardType(.emailAddress).autocorrectionDisabled().textInputAutocapitalization(.never)` |
| `TextInput.secureTextEntry` | `SecureField` |
| `Switch` | `Toggle("", isOn:)` |
| `Slider` | `Slider(value: $value, in: 0...100, step: 1)` |
| `Picker` (RN's modal picker) | `Picker` with `.menu` / `.wheel` / `.segmented` style |
| `RefreshControl` | `.refreshable { await store.refresh() }` |
| Dropdown menus | `Menu("Label") { Button("...") { ... } }` |
| Bottom action sheet | `.confirmationDialog(...)` |

### A.3 Navigation

| RN | SwiftUI |
|---|---|
| `expo-router` Stack | `NavigationStack(path: $router.path) { rootView.navigationDestination(for: Route.self) { ... } }` |
| `expo-router` Tabs | `TabView(selection: $selectedTab) { ... }` with `.tabItem { Label("", systemImage: "") }` |
| `expo-router` Drawer | iOS has no native drawer. Replace with `.toolbar(content: { Button("", systemImage: "line.3.horizontal") { showSheet = true } })` opening a `.sheet` with the drawer content, OR use `NavigationSplitView` on iPad. RN's drawer behaviour does not idiom on iPhone — the side menu becomes a sheet. |
| `router.push("/foo")` | `router.path.append(.foo)` |
| `router.replace("/foo")` | `router.path = [.foo]` |
| Modal route | `.sheet(item:)` keyed off a state property in the root |
| `Linking.addEventListener('url', ...)` | `.onOpenURL { url in router.handle(deepLink: url) }` |

### A.4 Async + state

| RN | SwiftUI |
|---|---|
| `useState` | `@State` (view) or `@Observable` property (store) |
| `useEffect(() => {}, [dep])` | `.onChange(of: dep) { ... }` or `.task(id: dep) { ... }` |
| `useEffect(() => {}, [])` | `.task { ... }` (auto-cancels on view removal) |
| `useContext` | `@Environment(Store.self)` |
| `useQuery` (TanStack) | `@Observable` store method + `.task` to trigger; caching via the store, not the view |
| `setTimeout` / `setInterval` | `Task.sleep` inside `Task { }`; for timers use `Timer.publish(...)` or `TimelineView(.animation)` |

### A.5 Visuals

| RN | SwiftUI |
|---|---|
| `LinearGradient` (expo) | `LinearGradient(colors:, startPoint:, endPoint:)` |
| `BlurView` | `.background(.ultraThinMaterial)` or `.background(.regularMaterial)` |
| `Image` (network) | `AsyncImage(url:)` with placeholder + transition |
| `Image` (local) | `Image("assetName")` |
| `lottie-react-native` | `LottieView` from `lottie-ios` SPM (mirror Honeydew's CachedAsyncImage usage) |
| `MaskedView` | `.mask { ... }` |
| `Animated.View` | `.animation(.appStandard, value: trigger)` + `.transition(...)` |
| `react-native-svg` | `Image(systemName:)` for SF Symbols, or `Path` with custom shape, or a generated `Image` asset |

### A.6 Icons (canonical SF Symbol map)

Wagerproof's RN code uses `MaterialCommunityIcons`, `Ionicons`, and `Expo/vector-icons`. The canonical SF Symbol mapping below is the single source of truth — implementer agents do NOT pick a different symbol when one is already canonicalized here.

| Concept | Canonical SF Symbol |
|---|---|
| Search | `magnifyingglass` |
| Settings / gear | `gearshape.fill` |
| Back / chevron-left | `chevron.left` (auto via NavigationStack) |
| Close / dismiss | `xmark` |
| More / overflow | `ellipsis` |
| Filter | `line.3.horizontal.decrease.circle` |
| Sort | `arrow.up.arrow.down` |
| Refresh | `arrow.clockwise` |
| Share | `square.and.arrow.up` (or use `ShareLink` directly) |
| Add | `plus` (toolbar) or `plus.circle.fill` (FAB-equivalent) |
| Edit | `pencil` |
| Delete | `trash` |
| Favorite (off / on) | `star` / `star.fill` |
| Like / vote (off / on) | `heart` / `heart.fill` |
| Notification bell | `bell` / `bell.fill` |
| User / profile | `person.circle` / `person.circle.fill` |
| Lock / pro gate | `lock.fill` |
| Crown / pro | `crown.fill` |
| Chart / accuracy | `chart.line.uptrend.xyaxis` |
| Money / odds | `dollarsign.circle` / `dollarsign.circle.fill` |
| Calendar | `calendar` |
| Clock / time | `clock` / `clock.fill` |
| Trending up | `arrow.up.right` |
| Trending down | `arrow.down.right` |
| Win | `checkmark.circle.fill` |
| Loss | `xmark.octagon.fill` |
| Push (bet result) | `equal.circle.fill` |
| Football (NFL/CFB) | `football.fill` |
| Basketball (NBA/NCAAB) | `basketball.fill` |
| Baseball (MLB) | `baseball.fill` |
| Robot / WagerBot / AI | `brain.head.profile` (header) or `apple.intelligence` (assistant bubble) |
| Wand / sparkles | `wand.and.stars` |
| Microphone / voice | `mic.fill` / `mic.circle.fill` |
| Speaker | `speaker.wave.2.fill` / `speaker.slash.fill` (muted) |
| Headphones / podcast | `headphones` |
| Lightning / live | `bolt.fill` |
| Flame / hot pick | `flame.fill` |
| Trophy / leader | `trophy.fill` |
| Chart bars / standings | `chart.bar.fill` |
| External link / sportsbook | `arrow.up.forward.app` |
| Discord | bundled asset `Image("discord_logo")` — no SF Symbol exists |
| Google | bundled asset `Image("google_logo")` — no SF Symbol exists |
| Apple sign-in | native `SignInWithAppleButton` |
| Drawer / hamburger | `line.3.horizontal` |
| Lock-icon for pro | `lock.fill` |
| Question / help | `questionmark.circle` |
| Info | `info.circle` |
| Warning / amber | `exclamationmark.triangle.fill` |
| Pin / tag | `tag.fill` |
| Chevron right (list disclosure) | system list disclosure indicator — don't draw manually |
| Cloud / weather | `cloud.fill` / `cloud.sun.fill` / `cloud.rain.fill` / `wind` |
| Hashtag / channel | `number` |
| Camera | `camera.fill` |
| Photo / gallery | `photo.fill` |
| Crash / error | `exclamationmark.octagon.fill` |
| Offline / no signal | `wifi.slash` |
| Hammer / scaffold | `hammer.fill` |

If a screen uses an icon not on this list, the implementer agent adds a row here with the canonical SF Symbol before writing code. No ad-hoc swaps.

### A.7 Haptic vocabulary (cross-screen rules)

| Event | Modifier |
|---|---|
| Tab change | `.sensoryFeedback(.selection, trigger: selectedTab)` |
| Filter / sort change | `.sensoryFeedback(.selection, trigger: filter)` |
| Toggle change | `.sensoryFeedback(.selection, trigger: isOn)` |
| Button tap (light) | `.sensoryFeedback(.impact(weight: .light), trigger: tapCount)` |
| CTA tap (medium) | `.sensoryFeedback(.impact(weight: .medium), trigger: tapCount)` |
| Pull-to-refresh end | `.sensoryFeedback(.impact(weight: .medium), trigger: refreshDone)` |
| Async success | `.sensoryFeedback(.success, trigger: lastSuccessAt)` |
| Async failure | `.sensoryFeedback(.error, trigger: lastErrorAt)` |
| Favorite added (positive) | `.sensoryFeedback(.success, trigger: justFavorited)` |
| Long-press preview open | system fires automatically via `.contextMenu` |

### A.8 Animation tokens

All animations resolve to one of these (defined in `WagerproofKit/Sources/WagerproofDesign/Animations.swift`):

| Token | Use |
|---|---|
| `.appQuick` | Toggles, button presses, micro changes (~250ms) |
| `.appStandard` | Most state changes (filter, sort, list rearrangement) (~400ms) |
| `.appBouncy` | Affirmative success animations (~500ms with overshoot) |
| `.appSlow` | Onboarding step transitions, paywall reveal (~600ms) |
| `.appLinear` | Continuous progress (timers, drag handles) (150ms) |
| `.appShimmer` | Skeleton shimmer (1500ms looping) |

Never use `.default` — it's the parent-context default and unpredictable.

### A.9 Transition tokens

Defined in `WagerproofKit/Sources/WagerproofDesign/Animations.swift`:

| Token | Use |
|---|---|
| `.fadeIn` | Generic fade |
| `.scaleIn` | New tile / new card |
| `.slideFromLeading` | Chat bubble / inbound message |
| `.slideFromTrailing` | User chat bubble / outbound |
| `.slideFromTop` | Toast / newly added grocery-list-style item |
| `.slideFromBottom` | Snackbar / banner |
| `.cardLift` | Sheet CTA emerge |

### A.10 Standard state primitives

- **Loading:** redacted skeleton with `.redacted(reason: .placeholder).shimmering()`. Match the number of placeholder rows to a typical loaded layout (e.g. 6 game cards).
- **Empty:** `ContentUnavailableView("Title", systemImage: "<symbol>", description: Text("Body")) { Button(...) { ... } }`.
- **Error:** Inline banner above the content list: `Label("Couldn't refresh", systemImage: "exclamationmark.octagon.fill")` with a "Retry" `Button`. Or a `Toast`/`Snackbar` overlay if the failure is non-blocking.

### A.11 Pro gating

Every place RN renders `<LockedOverlay>` or `<LockedGameCard>` in lieu of real content for non-Pro users, the Swift port uses the same component name (`LockedOverlayView` / `LockedGameCardView`) with the same behaviour: visual lock chip + tap → `PaywallStore.present(reason: .gameCard)`.

---

## B. Per-screen specifications (Auth + Onboarding + Drawer/Tabs + Home + Picks + Agents)

> The screens below are batch A. Section numbers reset within this batch. SF Symbol overrides in section-level "SF Symbol swaps" trump the global table only if explicitly justified.

### 1. `LoginView` — auto-advancing onboarding carousel + Apple/Google/email sign-in

**RN source:** `wagerproof-mobile/app/(auth)/login.tsx`
**Container:** `ZStack` rooted in `AuthRouter`'s `NavigationStack`. Background layer is a full-bleed `Video`/colour-block, then a teal `LinearGradient` overlay, then a bottom-up black gradient, then the content `VStack`. No nav bar — chrome is custom.
**Navigation chrome:** None (status bar light). Top-edge progress dots overlay; no toolbar. `.statusBarHidden(false)` with `.preferredColorScheme(.dark)` forced.

**Native primitives:**
- `TabView(selection:).tabViewStyle(.page(indexDisplayMode: .never))` — the 6-page auto-rotating carousel (RN's `AnimatedSlideContent` + per-screen visuals). One page per `OnboardingSlide` enum case (`.proData`, `.createBots`, `.aiModels`, `.publicBetting`, `.discord`, `.getStarted`).
- Custom `SegmentedProgressBar` view — 6 thin pills at the top safe area inset. Each pill is a `Button` so tapping a segment jumps `selectedIndex`. Active pill animates a `Capsule().fill(.white).frame(width: progress * fullWidth)` over a `.white.opacity(0.3)` track. Animation timer is a `TimelineView(.animation)` driven by a `@State var slideStart: Date` reset whenever `selectedIndex` changes; pause when `isPaused == true`.
- `VideoPlayer` (AVKit) for video slides (`login-background.mp4`); muted, looping, `.disabled(true)`.
- `SignInWithAppleButton(.continue, onRequest:, onCompletion:)` — native Apple component. iOS-only via `if #available`/`#if os(iOS)`.
- Google sign-in: bordered `Button` with white background, `Image("google_logo")` + "Continue with Google" label. Calls `AuthStore.signInWithGoogle()` (which wraps `GIDSignIn.sharedInstance.signIn(withPresenting:)`).
- "Other Sign In" plain `Button` → `authRouter.path.append(.emailLogin)`.
- Tap-zone overlay: invisible `Color.clear.contentShape(Rectangle()).onTapGesture { ... }` regions on left and right thirds of the screen to advance/rewind the slide (matches RN's `TouchableOpacity` segment taps). A long-press on the centre pauses the carousel — `LongPressGesture(minimumDuration: 0.15).onChanged { isPaused = true }.onEnded { isPaused = false }`.
- `SafeAreaInset(edge: .bottom)`-attached terms block with two tappable `Text` runs: "Privacy Policy" and "Terms of Use" — use `AttributedString` + `.environment(\.openURL, ...)`.
- Snackbar for auth errors: `.toast` style via a custom `ErrorToast` view modifier (or `Snackbar` from a shared util). RN uses Paper's `Snackbar`; in Swift, a `.overlay(alignment: .bottom)` + `.transition(.move(edge: .bottom).combined(with: .opacity))` for ~5s, with a "Dismiss" button.

**Gesture choreography:**
- Tap a progress segment → `selectedIndex = i` with `.spring(response: 0.35)` carousel transition.
- Tap left third → previous slide; tap right third → next slide.
- Long-press anywhere on the slide content → pause auto-advance (video also pauses).
- Tap "Continue with Apple" → triggers `ASAuthorizationController`. On success → `AuthStore` sets session, `RootRouter.phase = .ready` (or `.onboarding`).
- Tap "Continue with Google" → triggers `GIDSignIn`. Same routing on success.
- Tap "Other Sign In" → push `EmailLoginView`.
- Swipe — n/a (carousel is auto-driven; system page swipe disabled by setting `.indexViewStyle(.page(backgroundDisplayMode: .never))` + `.disabled(false)` only for tap zones).

**Animations:**
- Slide change: `.transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .move(edge: .leading).combined(with: .opacity)))` wrapped in `.animation(.spring(response: 0.5, dampingFraction: 0.85), value: selectedIndex)`.
- Per-slide visuals (the floating Stats card, Line-Movement card, AI model card, Discord card, PixelOffice mini): each fades + scales from initial to final transform across the slide duration. Use `.keyframeAnimator(initialValue: SlideVisualState(), trigger: selectedIndex) { ... }` to drive translate/rotate/scale per slide.
- Progress bar fill: linear `withAnimation(.linear(duration: SLIDE_DURATION))` on the active segment width.
- Background video crossfade between video and image slides: `.transition(.opacity)` on the `Group` switching the background.

**Haptics:**
- Segment tap → `.sensoryFeedback(.selection, trigger: selectedIndex)`
- "Continue with Apple/Google" tap → `.sensoryFeedback(.impact(weight: .medium), trigger: signInTapCount)`
- Auth success → `.sensoryFeedback(.success, trigger: authStore.lastSuccessAt)`
- Auth failure → `.sensoryFeedback(.error, trigger: snackbar.errorId)`

**Loading state:** When `loading == true`, social buttons get `.disabled(true).opacity(0.6)` and "Continue with X" labels swap to `ProgressView()`.
**Empty state:** n/a — login screen always has the carousel.
**Error state:** Bottom snackbar with red background, 5s auto-dismiss, "Dismiss" trailing `Button`.

**SF Symbol swaps:**
- `MaterialCommunityIcons.apple` → native `SignInWithAppleButton` (no Image needed); for non-button Apple glyph use SF Symbol `applelogo`.
- `MaterialCommunityIcons.google` → bundled asset `Image("google_logo")` (SF Symbols has no Google glyph; use the official asset).
- `MaterialCommunityIcons.pound` (Discord channel `#` glyph in DiscordCard) → SF Symbol `number`.
- `MaterialCommunityIcons.robot` (NFL Predictor card) → SF Symbol `brain.head.profile`.
- `MaterialCommunityIcons.chart-timeline-variant` (fallback background) → SF Symbol `chart.line.uptrend.xyaxis`.

**Edge cases preserved from RN:**
- The 2nd slide (`Create Bots`, index 1, the `PixelOffice` mini-demo) auto-advances after 10 s, every other slide after 5 s — preserve as a `SLIDE_DURATIONS: [TimeInterval] = [5,10,5,5,5,5]` lookup in Swift.
- Carousel auto-loops back to slide 0 after the last slide.
- The PixelOffice demo defers mounting by ~100 ms (RN uses `setTimeout(setReady, 100)`) — in Swift, gate the heavy view via `.task { try? await Task.sleep(for: .milliseconds(100)); ready = true }` and show a `Color(hex: "1a1a2e")` placeholder while not ready.
- Apple sign-in button is iOS-only (RN gates on `Platform.OS === 'ios'`). Swift target is iOS-only so always render — but keep the gate for visionOS/macCatalyst tolerance.
- The dev-mode `debugLog` POST to `127.0.0.1:7243/ingest/...` is dev-only — exclude from release builds via `#if DEBUG`.
- Video must continue playing even when paused for haptic long-press? Actually no — RN pauses video on `isPaused`. Mirror: bind `AVPlayer.rate = isPaused ? 0 : 1`.

> ⚠️ Ambiguity: RN imports a `useLearnWagerProof` context and there's commented-out code to auto-open the Learn sheet 2 s after mount. Treat as disabled in the port; do not auto-present `LearnWagerProofBottomSheet`.

---

### 2. `EmailLoginView` — email + password sign-in form

**RN source:** `wagerproof-mobile/app/(auth)/email-login.tsx`
**Container:** `ScrollView` + `VStack`. Form is custom-styled (not `Form`) to keep the brand visual.
**Navigation chrome:** `.navigationBarBackButtonHidden()`. Leading custom back button (`chevron.left` in a circular `.background(.white.opacity(0.1))` 40pt button) calls `dismiss()` / `authRouter.path.removeLast()`. Title not shown (custom title block in body). Status bar light.

**Native primitives:**
- `ScrollView { VStack { ... } }.scrollDismissesKeyboard(.interactively)`.
- `Image("wagerproofGreenDark")` logo centered top.
- Two stacked `VStack` field groups, each with a small label `Text` + a styled row containing an SF Symbol + `TextField`/`SecureField` + (password) eye toggle `Button`.
- Email `TextField` — `.textContentType(.emailAddress)`, `.keyboardType(.emailAddress)`, `.textInputAutocapitalization(.never)`, `.autocorrectionDisabled()`, `.submitLabel(.next)`, `.focused($focused, equals: .email)`.
- Password `SecureField` (toggle to `TextField` when `isPasswordVisible == true`) — `.textContentType(.password)`, `.submitLabel(.go)`, `.focused($focused, equals: .password)`, `.onSubmit { Task { await signIn() } }`.
- `@FocusState private var focused: Field?` enum `{ case email, password }`.
- `Button("Forgot Password?")` plain inline link → `authRouter.path.append(.forgotPassword)`.
- Sign-in button: white pill `Button` with rounded corner radius 30, height 54. When loading, label swaps to `ProgressView().tint(.black)`. Disabled when `email.isEmpty || password.isEmpty || loading`.
- Inline error banner: red-tinted `HStack { Image(systemName: "exclamationmark.circle"); Text(error) }` rendered conditionally — `.transition(.opacity)`.
- Footer "Don't have an account? Sign Up" — `Text` + plain `Button` → `authRouter.path.append(.signup)`.
- `LinearGradient` background applied via `.background()` (teal-to-black, matches `colors: [0,191,165,0.15] → 0,0,0,0.95 → black`).
- `.toolbar(.hidden, for: .tabBar)` (tabs are not present in this stack anyway, but be defensive).

**Gesture choreography:**
- Tap email field → focus advances; on submit, jumps to password.
- Tap password eye → toggle `isPasswordVisible`.
- Tap "Forgot Password?" → push `ForgotPasswordView`.
- Tap "Sign In" → `Task { await authStore.signIn(email:password:) }`.
- Swipe down inside scroll → dismiss keyboard (`.scrollDismissesKeyboard(.interactively)`).
- Tap back button → `dismiss()`.

**Animations:**
- Error appearance: `.transition(.opacity)` `.animation(.easeInOut(duration: 0.2), value: errorMessage)`.
- Sign-in button label swap to `ProgressView`: `.contentTransition(.identity)` + `.animation(.spring(response: 0.3), value: loading)`.

**Haptics:**
- Field focus advance via `.submitLabel(.next)` → `.sensoryFeedback(.selection, trigger: focused)`.
- Sign-in tap → `.sensoryFeedback(.impact(weight: .light), trigger: signInTapCount)`.
- Sign-in success → `.sensoryFeedback(.success, trigger: authStore.lastSuccessAt)`.
- Sign-in failure → `.sensoryFeedback(.error, trigger: errorMessage)`.
- Eye toggle → `.sensoryFeedback(.selection, trigger: isPasswordVisible)`.

**Loading state:** Sign-in button shows `ProgressView`; fields keep value but become `.disabled(true)`.
**Empty state:** n/a.
**Error state:** Inline red banner above the Sign-In button. Three classification strings preserved verbatim from RN: "Invalid email or password" (when err matches `Invalid login credentials`), "Please verify your email before signing in" (when `Email not confirmed`), else the raw `error.message`.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.arrow-left` → SF Symbol `chevron.left` (or `arrow.left` if a thicker visual is desired; align with the rest of the app — use `chevron.left`).
- RN `MaterialCommunityIcons.email-outline` → SF Symbol `envelope`.
- RN `MaterialCommunityIcons.lock-outline` → SF Symbol `lock`.
- RN `MaterialCommunityIcons.eye-outline` → SF Symbol `eye`.
- RN `MaterialCommunityIcons.eye-off-outline` → SF Symbol `eye.slash`.
- RN `MaterialCommunityIcons.alert-circle-outline` → SF Symbol `exclamationmark.circle`.

**Edge cases preserved from RN:**
- Setting either field clears the error (RN: `setError('')` inside `onChangeText`). Mirror via `.onChange(of: email) { error = nil }` and same for password.
- Disabled state opacity 0.4 (matches RN `signInButtonDisabled`).
- `KeyboardAvoidingView` behavior `'padding'` on iOS — SwiftUI auto-avoids; no extra config.

---

### 3. `SignupView` — create account form with email/password + social fallback

**RN source:** `wagerproof-mobile/app/(auth)/signup.tsx`
**Container:** `ScrollView` + `VStack`, same shell as `EmailLoginView`.
**Navigation chrome:** `.navigationBarBackButtonHidden()`. Custom back button leading.

**Native primitives:**
- Three fields: email (`TextField`), password (`SecureField`/`TextField` w/ eye toggle), confirm password (same). All wired to `@FocusState` enum `{ case email, password, confirm }`.
- Password field — `.textContentType(.newPassword)` (triggers iOS strong-password suggestion).
- Confirm field — `.textContentType(.newPassword)`.
- Disclaimer block: small `HStack` of `info.circle` + 12pt `Text` "By signing up, you confirm that you are 18+ and understand this platform is for analytics only."
- Inline error banner (red) + inline success banner (green) — only one shown at a time. After success, `Task { try? await Task.sleep(for: .seconds(3)); authRouter.path = [.login] }`.
- "Create Account" primary white pill button — disabled when `email.isEmpty || password.isEmpty || confirmPassword.isEmpty || success != nil`.
- Divider with "or continue with" label.
- Two horizontal-stacked `Button`s for Apple (iOS-only) + Google. Each uses `SignInWithAppleButton` / Google-branded custom button (same as `LoginView`).
- Footer "Already have an account? Sign In" → `authRouter.path.removeAll(); authRouter.path.append(.login)` (or `.dismiss()` if pushed from login).

**Gesture choreography:**
- Tap fields → focus advances email → password → confirm.
- Tap "Create Account" → `Task { await authStore.signUp(email:password:) }`. On success: clear fields; if `session` exists, show "Account created! Setting up your profile..." and let auth state listener route; else show "Account created! Please check your email to verify..." then auto-route back to login after 3 s.
- Tap social → same flow as `LoginView`.

**Animations:**
- Error/success banner appearance: `.transition(.opacity.combined(with: .move(edge: .top)))`.
- "Create Account" → `ProgressView` swap: same as login.

**Haptics:**
- Submit success → `.sensoryFeedback(.success, trigger: success)`.
- Submit error → `.sensoryFeedback(.error, trigger: errorMessage)`.
- Field eye toggle → `.sensoryFeedback(.selection, trigger: isPasswordVisible)`.

**Loading state:** "Create Account" button shows `ProgressView`; all fields and buttons `.disabled(true)`.
**Empty state:** n/a.
**Error state:** Specific classifications preserved from RN: "An account with this email already exists" (matches `already registered`); password length error ("Password must be at least 8 characters"); password mismatch ("Passwords do not match"); generic `error.message` otherwise.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.lock-check-outline` (confirm field) → SF Symbol `lock.shield`.
- RN `MaterialCommunityIcons.information-outline` (disclaimer) → SF Symbol `info.circle`.
- RN `MaterialCommunityIcons.check-circle-outline` (success) → SF Symbol `checkmark.circle`.
- Other icons: same as `EmailLoginView`.

**Edge cases preserved from RN:**
- Inline session check after signup (`supabase.auth.getSession()`): if session exists, show the "setting up your profile" message; otherwise the "check your email" message + 3-second delayed redirect.
- All three field validation rules fire client-side before hitting Supabase.
- Disclaimer text is intentionally muted (`rgba(255,255,255,0.4)`); use `.foregroundStyle(.secondary)`.

---

### 4. `ForgotPasswordView` — request password reset link

**RN source:** `wagerproof-mobile/app/(auth)/forgot-password.tsx`
**Container:** Two views in one — `if success { SuccessView } else { Form }`. Both share the teal-to-black `LinearGradient` background.
**Navigation chrome:** `.navigationBarBackButtonHidden()`. Custom circular back button leading.

**Native primitives (form state):**
- Centered hero block: 80pt circular tinted `lock.rotation` icon container (`rgba(0,191,165,0.12)`).
- Title "Forgot Password?" + multi-line subtitle.
- Single email `TextField` with `envelope` icon — same modifiers as `EmailLoginView`'s email field, but `.submitLabel(.send)`.
- Inline red error banner.
- "Send Reset Link" white pill button — disabled when email empty or `loading`. `ProgressView` swap when loading.
- Footer "Remember your password? Sign In" — plain `Button` that calls `dismiss()`.

**Native primitives (success state):**
- Larger 96pt circular icon (`envelope.badge`).
- Title "Check Your Email".
- Three lines of explanation including the entered email value highlighted in teal `Text("\(email)").foregroundStyle(Color(hex: "00BFA5"))`.
- Info row: `info.circle` + "If you don't see the email, check your spam folder."
- "Back to Login" white pill button with leading `chevron.left` icon — `dismiss()`.

**Gesture choreography:**
- Tap email field → focus.
- Submit (`.onSubmit { Task { await sendReset() } }`).
- Tap "Send Reset Link" → `Task { await authStore.sendPasswordReset(email:) }`; on success → swap to success state; on failure → inline error.
- Tap "Back to Login" → `dismiss()`.

**Animations:**
- Form → success state cross-fade: gate the whole content in `Group { if success { SuccessView } else { FormView } }.animation(.easeInOut(duration: 0.3), value: success)`.
- `.symbolEffect(.bounce, value: success)` on the success envelope icon.

**Haptics:**
- Submit → `.sensoryFeedback(.impact(weight: .light), trigger: submitTapCount)`.
- Reset link sent successfully → `.sensoryFeedback(.success, trigger: success)`.
- Error → `.sensoryFeedback(.error, trigger: errorMessage)`.

**Loading state:** "Send Reset Link" button shows `ProgressView`.
**Empty state:** n/a.
**Error state:** Inline red banner with `exclamationmark.circle` + supabase-returned message.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.lock-reset` → SF Symbol `lock.rotation`.
- RN `MaterialCommunityIcons.email-check-outline` → SF Symbol `envelope.badge`.
- Other icons: same as `EmailLoginView` / `SignupView`.

**Edge cases preserved from RN:**
- Supabase's `sendPasswordReset` uses `wagerproof://reset-password` as `redirectTo`. The Swift `AuthStore.sendPasswordReset` must pass that scheme through to `supabase.auth.resetPasswordForEmail(_:redirectTo:)`.
- Highlighted email in success view is the exact value typed (no normalisation/lowercasing).

---

### 5. `OnboardingView` — 21-step onboarding wizard

**RN source:** `wagerproof-mobile/app/(onboarding)/index.tsx` (+ all 15 step components under `components/onboarding/steps/`)
**Container:** `ZStack` of a teal-tinted bottom-up `LinearGradient` background + the active step view. The orchestrator switches between two modes:
1. Steps 1–19 → a `TabView(selection:).tabViewStyle(.page(indexDisplayMode: .never))` (RN uses `PagerView` with `scrollEnabled={false}` — preserve the no-swipe constraint by disabling user gesture: render content inside a `.gesture(DragGesture().onChanged { _ in })` no-op overlay, or use a custom `OnboardingPager` view that animates `offset` on `currentStep` change).
2. Steps 20–21 → render full-screen `AgentGenerationStep` / `AgentBornStep` outside the pager (cinematic).

`OnboardingStore` (the Swift port of `OnboardingContext`) exposes:
```swift
enum Step: Int, CaseIterable {
    case personalizationIntro = 1
    case termsAcceptance      = 2
    case sportsSelection      = 3
    case ageConfirmation      = 4
    case bettorType           = 5
    case acquisitionSource    = 6
    case primaryGoal          = 7
    case valueClaim           = 8
    case featureSpotlight     = 9
    case dataTransparency     = 10
    case agentValue247        = 11
    case agentValueAssistant  = 12
    case agentValueStrategies = 13
    case agentValueLeaderboard = 14
    case agentBuilder         = 15  // internal sub-flow handles 15..19
    case agentGeneration      = 20
    case agentBorn            = 21
}
var currentStep: Step
func nextStep(); func prevStep(); func completeOnboarding(createdAgentId:) async
```

**Navigation chrome:** No `NavigationStack` chrome — onboarding takes over the whole screen. A top `ProgressIndicator` view shows current step / 21 and a back chevron (`chevron.left` button → `store.prevStep()`).

**Native primitives per step:**

| Step | View | Primitives |
|---|---|---|
| 1 `.personalizationIntro` | `OnboardingPersonalizationIntroView` | Centered hero `Image` or SF Symbol `person.crop.circle.badge.checkmark`, headline + subhead, "Get Started" `.borderedProminent` button at bottom |
| 2 `.termsAcceptance` | `OnboardingTermsView` | Scrolled `Text(.init(termsMarkdown))` (markdown) + a `Toggle("I agree to terms")` + "Continue" CTA. Disabled until toggled. |
| 3 `.sportsSelection` | `OnboardingSportsView` | Multi-select chip grid (`LazyVGrid(columns: 2)`) of sport `Button(.bordered)` with leading SF symbol per sport (NFL `football`, NBA `basketball`, MLB `baseball.diamond`, CFB `graduationcap`, NCAAB `basketball.circle`). Tap toggles selection with `.sensoryFeedback(.selection)`. |
| 4 `.ageConfirmation` | `OnboardingAgeView` | Big "Are you 18+" prompt + two `Button`s ("Yes, I'm 18+" / "No") laid out as primary + plain. |
| 5 `.bettorType` | `OnboardingBettorTypeView` | Single-select chip list (`VStack` of pill `Button`s): "Casual", "Sharp", "Tracking", "New to betting". `.sensoryFeedback(.selection)` per tap. |
| 6 `.acquisitionSource` | `OnboardingAcquisitionView` | Single-select list of "How did you hear about us?" options. Same chip pattern. |
| 7 `.primaryGoal` | `OnboardingPrimaryGoalView` | Single-select goal chips ("Beat the books", "Track picks", "Get edges", "Learn"). |
| 8 `.valueClaim` | `OnboardingValueClaimView` | Static value-prop screen: hero illustration + 3 bullet points + "Sounds good" CTA. |
| 9 `.featureSpotlight` | `OnboardingFeatureSpotlightView` | Animated demo card (uses RN's `Animated`/`reanimated` widgets) — port using `TimelineView(.animation)` + `.symbolEffect(.bounce, options: .repeating)` on a featured SF Symbol. |
| 10 `.dataTransparency` | `OnboardingDataTransparencyView` | Static section: shield/sources block. Hero SF Symbol `checkmark.shield`. |
| 11–14 `.agentValueXxx` | 4 separate views | Each is a hero card + "Continue" CTA showcasing an agent value-prop (24/7, virtual assistant, multiple strategies, leaderboard). Use `LinearGradient` background tints per slide. |
| 15 (sub-flow `OnboardingAgentBuilder`) | `OnboardingAgentBuilderView` | Internally handles 5 sub-screens (15–19): sport/archetype pick → identity → personality → custom insights → review. Mirror by reusing parts of `AgentCreateView` rendering but inside the onboarding shell. Sub-flow uses its own `@State var subStep: Int` 0..4 and only calls `store.nextStep()` once at the end. |
| 20 `.agentGeneration` | `AgentGenerationView` | Full-screen cinematic. Pulsing brain SF Symbol (`brain.head.profile`) + scanning lines + multi-stage status text. Use `PhaseAnimator(0..<3) { phase in ... }` for the rotating status text. |
| 21 `.agentBorn` | `AgentBornView` | Confetti + agent reveal card; "Let's Go!" CTA → `store.completeOnboarding(createdAgentId:)` → `RootRouter.phase = .ready`. Use a Lottie file for confetti (asset already exists). |

**Gesture choreography:**
- Swipe → DISABLED (RN explicitly sets `scrollEnabled={false}` on PagerView). Wrap the pager in `.allowsHitTesting(true)` but no `DragGesture` is exposed; transitions happen only via store mutations.
- Tap "Continue" / option chips → `store.nextStep()`.
- Tap back chevron in `ProgressIndicator` → `store.prevStep()` (no-op on step 1).

**Animations:**
- Step transitions: `withAnimation(.spring(response: 0.4, dampingFraction: 0.85)) { offset = -step * width }` — preserve RN's left-to-right slide.
- Reduce-motion: when `accessibilityReduceMotion == true`, use `.transition(.opacity)` instead.
- Step 20's cinematic animation: `KeyframeAnimator` driving brain symbol scale (1.0 → 1.1 → 1.0) + opacity pulse over 4 s, looping.
- Step 21 confetti: Lottie autoplay, hide on completion.

**Haptics:**
- Step advance → `.sensoryFeedback(.impact(weight: .light), trigger: store.currentStep)`.
- Multi-select chip toggle → `.sensoryFeedback(.selection, trigger: selectedSports)`.
- Agent born reveal → `.sensoryFeedback(.success, trigger: bornRevealed)`.

**Loading state:** During step 20 generation, show the cinematic animation with rotating status copy ("Studying your slate…", "Calibrating personality…", "Generating today's picks…").
**Empty state:** n/a (always a step).
**Error state:** If agent generation fails on step 20, transition to step 21 anyway with a fallback "Your agent is ready — picks will follow shortly" message. Alert is suppressed (RN behavior).

**SF Symbol swaps:**
- RN `MaterialCommunityIcons` icons used in step components (per-step varies): swap canonically — `football` for NFL, `basketball` for NBA, `baseball.diamond` for MLB, `graduationcap` for CFB, `basketball.circle` for NCAAB, `brain.head.profile` for the agent brain, `chart.line.uptrend.xyaxis` for performance, `checkmark.shield` for trust/data, `wand.and.stars` for "AI generates", `person.3` for community/leaderboard, `bell.badge` for notifications, `clock` for 24/7.

**Edge cases preserved from RN:**
- `setStep` calls in step components persist `currentStep` to `AsyncStorage` — Swift port persists to `UserDefaults(suiteName: "group.com.wagerproof.mobile")` key `onboarding_current_step` so user resumes at last step on relaunch.
- Steps 15–19 are handled inside one `OnboardingAgentBuilder` (no separate pager pages) — the orchestrator's pager only has 15 pages, with the builder occupying index 14 (RN: `if (step <= 14) return step - 1; return 14`).
- Onboarding completion is the only way to leave — there's no "skip" button on the orchestrator. Individual steps may have a plain "Skip" but most don't.
- Theme is forced dark: `.environment(\.colorScheme, .dark)`.
- Onboarding completion must NOT fall through to Login on auth state change — `OnboardingGuard` (the RN double-check) is subsumed into `RootRouter.phase` (only transitions to `.ready` when both authed AND `onboarding_complete == true`).

> ⚠️ Ambiguity: The exact branching graph between bettor type / primary goal answers and agent-builder defaults isn't enumerated in RN code paths sampled here. The agent builder reads earlier survey answers from `OnboardingContext` and pre-seeds archetype + personality. Implementer must read `OnboardingAgentBuilder.tsx` end-to-end to map every survey-answer → archetype default.

---

### 6. `MainTabView` — drawer + tab host with deep-link routing

**RN source:** `wagerproof-mobile/app/(drawer)/_layout.tsx`
**Container:** `NavigationStack(path: $rootRouter.mainPath)` wrapping a `TabView`. The "drawer" — which in RN is `expo-router/drawer` with a side menu — becomes a SwiftUI **side panel sheet** since iOS doesn't natively style hamburger drawers: tap the leading `line.3.horizontal` button → `.sheet(item: $sideMenuItem) { _ in SideMenuView() }` with `.presentationDetents([.large])`, drag indicator hidden, drag-to-dismiss enabled.
**Navigation chrome:** Owned per-tab inside `TabBarView` (see §7). This view's job is the stack root + deep-link routing.

**Native primitives:**
- `NavigationStack(path: $rootRouter.mainPath)` with `navigationDestination(for: MainRoute.self)` covering:
  - `.settings` → `SettingsView()`
  - `.wagerbotChat` → `WagerbotChatView()`
  - `.wagerbotVoice` → `WagerbotVoiceView()`
  - `.editorPicksStats` → `EditorPicksStatsView()`
  - `.agentDetail(id:)` → `AgentDetailView(id:)`
  - `.agentCreate` → `AgentCreateView()`
  - `.agentSettings(id:)` → `AgentDetailSettingsView(id:)`
  - `.agentPublicDetail(id:)` → `PublicDetailView(id:)`
- Root: `TabBarView()`.
- `.onOpenURL { url in DeepLinkRouter.handle(url) }` — maps the URL scheme:
  - `wagerproof://picks` → switch to picks tab
  - `wagerproof://agents` → switch to agents tab + pop to root
  - `wagerproof://outliers` → switch to outliers tab
  - `wagerproof://feed` → switch to games tab
  - else → games tab
- `.task { await topAgentsWidgetSyncStore.sync() }` — replicates `useTopAgentsWidgetSync`. Writes to App Group `UserDefaults(suiteName: "group.com.wagerproof.mobile")` via `WidgetDataBridge`.
- Side menu sheet content: `SideMenuView` — `List` with the rows (Games, Picks, Agents, Outliers, Scoreboard, Feature Requests, Discord link, Secret Settings if admin, Privacy, Terms). Tapping a row pops the sheet and navigates.

**Gesture choreography:**
- Tap hamburger → present `SideMenuView` sheet at `.large` detent.
- Swipe down on sheet → dismiss (system).
- Tap row in side menu → dismiss sheet + `tabSelection.current = .x` (or `Linking.openURL(...)` for Discord/Privacy/Terms via `openURL` environment value).

**Animations:** All system — sheet presentation, navigation push. No custom transitions on the host.

**Haptics:**
- Hamburger tap → `.sensoryFeedback(.impact(weight: .light), trigger: sideMenuOpenCount)`.
- Side-menu row tap → `.sensoryFeedback(.selection, trigger: tabSelection.current)`.
- Deep link handled → `.sensoryFeedback(.impact(weight: .light), trigger: lastHandledURL)`.

**Loading state:** None on the host (tabs each render their own).
**Empty state:** n/a.
**Error state:** Deep link with unrecognised host falls back to Games tab (matches RN default).

**SF Symbol swaps:**
- RN side-menu icons (Picks `star`, Agents `brain`, Outliers `bell-alert-outline`, Games `trophy`, Scoreboard `scoreboard`, Settings `cog`, Discord — bundled asset, Feature Requests `lightbulb-on`, Privacy/Terms `shield-lock`) →
  - Picks `star`, Agents `brain.head.profile`, Outliers `bell.badge`, Games `trophy`, Scoreboard `sportscourt`, Settings `gearshape`, Discord → bundled asset `Image("discord_logo")` (no SF equivalent), Feature Requests `lightbulb`, Privacy `lock.shield`, Terms `doc.text`.

**Edge cases preserved from RN:**
- `Linking.getInitialURL()` cold-start: in Swift, this is handled automatically by `.onOpenURL` (delivered after first scene activation).
- Widget deep-links arrive on the same scheme — same handler.
- `wagerbot-chat`, `wagerbot-voice`, and `settings` use `presentation: 'card'` + `slide_from_right` in RN. In Swift these are normal pushes (`NavigationStack` slide is the iOS default, so no override needed).

> ⚠️ Ambiguity: The RN drawer rendered by `expo-router/drawer` is technically a left-edge swipe-revealed panel. iOS HIG strongly discourages drawer patterns. Decision: replace with a `.sheet`-based side menu opened via the toolbar hamburger button — preserves all menu items, dropps the gesture. If the design lead insists on a swipe drawer, use a `.matchedGeometryEffect`-driven custom overlay, but default to the sheet approach.

---

### 7. `TabBarView` — bottom tab bar + floating WagerBot launcher + suggestion bubble

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/_layout.tsx`
**Container:** `TabView(selection: $tabSelection.current)` with five visible tabs + hidden tabs reached via deep link / push only.
**Navigation chrome:** Each tab owns its `NavigationStack`; this view only sets `.toolbarBackground(.ultraThinMaterial, for: .tabBar)`, `.toolbarBackground(.visible, for: .tabBar)`, `.tint(Color(hex: "00E676"))`.

**Native primitives:**
```swift
TabView(selection: $tab.current) {
    GamesView()
        .tabItem { Label("Games", systemImage: "trophy") }
        .tag(MainTab.games)
    AgentsView()
        .tabItem { Label("Agents", systemImage: "brain.head.profile") }
        .tag(MainTab.agents)
    OutliersView()
        .tabItem {
            Label("Alerts", systemImage: "bell.badge")
                .badge(liveScores.hasLiveGames ? "•" : nil)  // RN draws a pulsing dot on scoreboard tab — see edge cases
        }
        .tag(MainTab.outliers)
    ScoreboardView()
        .tabItem { Label("Scores", systemImage: "sportscourt") }
        .tag(MainTab.scoreboard)
}
.tint(Color.brandGreen)
```

- `WagerBotSuggestionBubbleOverlay` — a `.overlay(alignment: .topTrailing)` view bound to `WagerBotSuggestionStore.isVisible`. Shows the floating chat bubble that RN renders via `WagerBotSuggestionBubble`. Two visual modes: attached (small pill) and detached (a draggable floating bubble — port using `.gesture(DragGesture().onChanged { drag.offset = $0.translation })`). When tapped → push `wagerbot-chat`. When `onScanPage` fires → call `WagerBotSuggestionStore.scanCurrentPage()`.
- Pull-tab interactions: tap-tab-to-scroll-to-top — `tab.onChange(of: tab.current) { _, new in if new == oldValue { tabScrollToTopTrigger = UUID() } }`, each tab subscribes.
- Tabs hidden from the bar but reachable via push (RN sets `href: null`): chat, picks, voice-chat, roast, feature-requests, settings, etc. In Swift these aren't `TabView` items at all — they are `navigationDestination` pushes from inside the visible tabs.

**Gesture choreography:**
- Tap tab → `tab.current = .x` (system). Tap same tab again → pop stack to root (system `NavigationStack` behavior) + scroll-to-top.
- Long-press suggestion bubble (when in detached mode) → drag.
- Tap suggestion bubble (attached mode) → push `wagerbot-chat`.
- Tap dismiss-X on bubble → `WagerBotSuggestionStore.dismissSuggestion()`.

**Animations:**
- Tab switch: system cross-fade.
- Suggestion bubble entry: `.transition(.move(edge: .top).combined(with: .opacity))` `.animation(.spring(response: 0.4), value: store.isVisible)`.
- Live indicator pulse on the Alerts/Scores tab badge: a 1-second `withAnimation(.easeInOut(duration: 1).repeatForever())` on opacity 0.4↔1 + scale 1.0↔1.2 around a 8pt green dot. Use a custom `LiveIndicator` `View` that overlays the tab item's icon — since `Label`'s system badge can't pulse, draw a custom `Circle` on top of the icon when `hasLiveGames`. Implement via `.overlay(alignment: .topTrailing)` with a `TimelineView(.animation)` or `PhaseAnimator`.

**Haptics:**
- Tab switch → system fires automatically.
- Suggestion bubble appear → `.sensoryFeedback(.impact(weight: .light), trigger: store.isVisible)`.
- Suggestion tap → `.sensoryFeedback(.selection, trigger: store.lastTapAt)`.

**Loading state:** Lazy tab content — `TabView` automatically lazy-loads.
**Empty state:** n/a.
**Error state:** n/a (each tab handles its own).

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.trophy` → SF Symbol `trophy`.
- RN `MaterialCommunityIcons.brain` → SF Symbol `brain.head.profile`.
- RN `MaterialCommunityIcons.bell-alert-outline` → SF Symbol `bell.badge`.
- RN `MaterialCommunityIcons.scoreboard` → SF Symbol `sportscourt`.
- RN `MaterialCommunityIcons.star` (picks, hidden tab) → SF Symbol `star`.
- RN `MaterialCommunityIcons.message-text` (chat, hidden tab) → SF Symbol `bubble.left.and.bubble.right`.
- RN `MaterialCommunityIcons.fire` (roast, hidden tab) → SF Symbol `flame`.
- RN `MaterialCommunityIcons.phone` (voice-chat, hidden tab) → SF Symbol `phone`.
- RN `MaterialCommunityIcons.lightbulb-on` (feature-requests, hidden tab) → SF Symbol `lightbulb`.
- RN `MaterialCommunityIcons.robot` (header WagerBot button) → SF Symbol `bubble.left.and.text.bubble.right` (or custom asset for WagerBot mascot).

**Edge cases preserved from RN:**
- Tab bar must auto-hide on Chat, WagerBot Chat, WagerBot Voice, Voice Chat, Roast, Settings, and any agent sub-screen (create, detail, settings, public). RN does this by returning `null` from `FloatingTabBar`. Swift equivalent: `.toolbar(.hidden, for: .tabBar)` on those destination views.
- The `Picks` tab is hidden from the visible bar (`href: null`) but pushed from the drawer side menu. Mirror by NOT including `Picks` in the `TabView` and exposing it via `MainRoute.picks` push.
- The active-tab tint is forced to `#00E676` (brand green), not the system blue. Apply via `.tint(Color.brandGreen)` on the `TabView`.
- The live-scores hook is owned by the `TabBarView`'s parent (not the tab bar itself) to avoid re-mounting on every pathname change — port that ownership: `LiveScoresStore` is an `@Observable` injected via `.environment(liveScoresStore)`.

> ⚠️ Ambiguity: RN renders BOTH the system `Tabs` component (set to `display: none`) AND a custom `FloatingTabBar` overlay. The intent is "system tabs for routing, custom UI for chrome." In SwiftUI a `TabView` already gives a native bar, so use the native `TabView` and skip the custom overlay; brand it with `.toolbarBackground` + `.tint`. If pixel-perfect parity with the RN custom bar is required, replace `TabView`'s tab bar by hiding it (`UITabBar.appearance().isHidden = true`) and rendering a custom `HStack` over the bottom safe area — but default to the native approach.

---

### 8. `GamesView` — home tab, multi-sport game card feed

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/index.tsx`
**Container:** `ZStack` of:
- Bottom layer: a custom `PagerView`-style switcher between sports (Swift port uses `TabView(.page)` if horizontal swipe is desired, or a plain `Group { switch sport { ... } }`).
- For the active sport, a `ScrollView` with `LazyVGrid(columns: 2)` of game cards.
- Top layer (`overlay(alignment: .top)`): a frosted-glass header containing the "WagerProof" title row + horizontal sport-pill tabs.

**Navigation chrome:** Header is fully custom (no system nav bar). The nav stack is owned by this view's parent (`MainTabView`), but `GamesView` sets `.navigationBarHidden(true)` (iOS 16+) / `.toolbar(.hidden, for: .navigationBar)`.

**Native primitives:**
- `GamesStore` — `@Observable` class holding `var cachedData: [Sport: SportFeed]` (per-sport games + lastFetch). Methods `refreshNFL()`, `refreshCFB()`, `refreshNBA()`, `refreshNCAAB()`, `refreshMLB()`, `refreshAll()` — each runs the multi-query merge logic against `CFBSupabaseClient`.
- `ScrollView { LazyVGrid(columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)], spacing: 8) { ... } }`.
- `.refreshable { await games.refreshSport(selectedSport, force: true) }` per sport.
- Header (top, sticky via `.overlay(alignment: .top)`):
  - Left: `Button(systemImage: "gearshape", size: 31)` → `mainRouter.path.append(.settings)`.
  - Center: branded title "Wager" (foreground primary) + "Proof" (brand green `#00E676`), two `Text` runs in an `HStack`.
  - Right: `Button` cluster (max 2): admin test-trigger (`bolt.fill`, only when `wagerBotStore.testModeEnabled`), and the WagerBot launcher (`bubble.left.and.text.bubble.right` or branded asset).
  - Below header: horizontal `ScrollView(.horizontal, showsIndicators: false)` of sport pill buttons ordered by `GamesStore.Sport.displayOrder()` — seasonal: NFL, CFB, MLB, NBA, NCAAB from Sept 1 through Feb 15 (football season), MLB, NFL, CFB, NBA, NCAAB otherwise. The default selected sport follows the first pill. Selected sport gets bold weight + a 3pt-tall `Capsule().fill(Color.brandGreen)` underline at the bottom (`.overlay(alignment: .bottom)`).
- Each game tile: a `Button` with a custom `RoundedRectangle`-shaped content view that wraps the per-sport card (`NFLGameCard`, `CFBGameCard`, `NBAGameCard`, `NCAABGameCard`, `MLBGameCard`). On tap → call the matching `*GameSheetStore.openGameSheet(game)` (e.g. `NFLGameSheetStore.openGameSheet(game)`), which triggers a `.sheet(item:)` on this view's root.
- `.searchable(text: $searchTexts[selectedSport], prompt: "Search teams or cities…")` — RN uses an inline `TextInput` inside the listHeader, but the iOS-native `.searchable` is the correct port. Pin to the navigation header (RN's header is custom but functionally identical).
- `Menu` for sort selection (replaces RN `react-native-paper` `Menu`):
  ```swift
  Menu {
      Button { sortMode[selectedSport] = .time } label: { Label("Sort by Time", systemImage: "clock") }
      Button { sortMode[selectedSport] = .spread } label: { Label("Sort by Spread Value", systemImage: "chart.line.uptrend.xyaxis") }
      Button { sortMode[selectedSport] = .ou } label: { Label("Sort by O/U Value", systemImage: "number") }
  } label: { Image(systemName: "arrow.up.arrow.down") }
  ```
- Banner row (above the grid for specific sports):
  - NBA selected + no search query → render `NBABettingTrendsBanner` + `NBAModelAccuracyBanner` views.
  - NCAAB → `NCAABBettingTrendsBanner` + `NCAABModelAccuracyBanner`.
  - MLB → `MLBBettingTrendsBanner` + `MLBRegressionReportBanner` + the Discord CTA banner.
- Discord banner: `Button` with a teal-to-blue `LinearGradient` + `bubble.left.and.bubble.right` icon + "Join our Discord" / "Get picks, live chat & community updates" text + trailing `chevron.right`. Calls `openURL(URL(string: "https://discord.gg/gwy9y7XSDV"))` via the `@Environment(\.openURL)` value.
- `LockedGameCard` wrapper — when `proAccess.isPro == false && index >= 2`, wrap the tile in a `LockedGameCard` overlay (blur + lock badge + paywall CTA).
- Shimmer skeleton: 2-column grid of `GameCardShimmer` placeholders via `.redacted(reason: .placeholder).shimmering()` while `loading[sport] == true && !refreshing[sport]`.

**Gesture choreography:**
- Tap sport pill → `selectedSport = sport`. Animated underline slides via `.matchedGeometryEffect(id: "sportPill", in: pillNamespace)`.
- Tap game tile → `*GameSheetStore.openGameSheet(game)`.
- Long-press game tile → `.contextMenu { Button("Open"); Button("Share"); Button(role: .destructive, "Hide") }` (RN does not have a context menu on cards — this is an enhancement for native parity; if implementer needs to match RN exactly, skip the contextMenu).
- Pull down on grid → `.refreshable`.
- Tap settings cog → push `MainRoute.settings`.
- Tap WagerBot icon → `wagerBotStore.openManualMenu()` (shows a sheet of WagerBot actions).
- Tap search text → keyboard appears, debounced filter.
- Tap sort menu → opens.

**Animations:**
- Sport switch: `.transition(.opacity)` `.animation(.easeInOut(duration: 0.2), value: selectedSport)` on the grid container.
- Pill underline slide: `.matchedGeometryEffect` with `.spring(response: 0.4)`.
- New tile reveal: `.transition(.scale(scale: 0.9).combined(with: .opacity))`.
- Shimmer skeleton → real cards: SwiftUI auto cross-fade via state change; the `.shimmering()` modifier stops when `loading == false`.

**Haptics:**
- Sport pill tap → `.sensoryFeedback(.selection, trigger: selectedSport)`.
- Tile tap → `.sensoryFeedback(.impact(weight: .light), trigger: tileTapCount)`.
- Sort change → `.sensoryFeedback(.selection, trigger: sortMode)`.
- Pull-to-refresh end → `.sensoryFeedback(.impact(weight: .medium), trigger: refreshing)`.
- Discord banner tap → `.sensoryFeedback(.impact(weight: .light), trigger: discordTap)`.

**Loading state:** 4 shimmer tiles (2×2) in the grid. Sport tabs and header remain interactive.
**Empty state:** `NoGamesTerminal` view (RN component) — port as `ContentUnavailableView` variant with a terminal-look aesthetic: monospace `Text` lines, green-on-black, "no games today" message. Or pragmatically use `ContentUnavailableView("No games today", systemImage: "calendar.badge.exclamationmark", description: Text("Check back closer to game time"))`.
**Error state:** Centered `ContentUnavailableView("Failed to load games", systemImage: "exclamationmark.triangle", description: Text(error))` with a "Retry" button.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.cog` (settings) → SF Symbol `gearshape`.
- RN `MaterialCommunityIcons.magnify` (search) → SF Symbol `magnifyingglass` (provided by `.searchable`).
- RN `MaterialCommunityIcons.close-circle` (clear search) → SF Symbol `xmark.circle.fill` (also provided by `.searchable`).
- RN `MaterialCommunityIcons.sort` → SF Symbol `arrow.up.arrow.down`.
- RN `MaterialCommunityIcons.clock-outline` (sort by time) → SF Symbol `clock`.
- RN `MaterialCommunityIcons.chart-line` (sort by spread) → SF Symbol `chart.line.uptrend.xyaxis`.
- RN `MaterialCommunityIcons.numeric` (sort by O/U) → SF Symbol `number`.
- RN `MaterialCommunityIcons.lightning-bolt` (test trigger) → SF Symbol `bolt.fill`.
- RN `MaterialCommunityIcons.robot` (WagerBot launcher) → SF Symbol `bubble.left.and.text.bubble.right`.
- RN `MaterialCommunityIcons.chat-processing-outline` (Discord banner) → SF Symbol `bubble.left.and.bubble.right`.
- RN `MaterialCommunityIcons.chevron-right` → SF Symbol `chevron.right`.
- RN `MaterialCommunityIcons.alert-circle` (error state) → SF Symbol `exclamationmark.triangle`.
- RN `MaterialCommunityIcons.calendar-blank` (no search results) → SF Symbol `calendar.badge.exclamationmark`.
- RN sport icons (`baseball`, `basketball`, `basketball-hoop`, `football`, `school`) → `baseball.diamond`, `basketball`, `basketball.circle`, `football`, `graduationcap`.

**Edge cases preserved from RN:**
- 5-minute cache TTL per sport: only re-fetch a sport's data if `Date().timeIntervalSince(cached.lastFetch ?? .distantPast) > 300` OR the user pulls to refresh.
- Initial mount fires `refreshSport(...)` for ALL sports in parallel (RN's `useEffect` on mount loops `sports.forEach(fetchDataForSport)`). Mirror via `.task { await games.refreshAllInParallel() }`.
- Default selected sport is `.mlb` (per `useState<Sport>('mlb')`).
- WagerBot suggestion bubble is registered on `feed` page mount via `wagerBotStore.onFeedMount()` and unregistered on disappear via `.onDisappear { wagerBotStore.onFeedUnmount() }`.
- Polymarket data is set on the WagerBot store via `wagerBotStore.setPolymarketData(...)` once the MLB/NBA banner loads it. The banner views are responsible — preserve the call sites.
- Live betting line: NFL has the most complex merge — `v_input_values_with_epa` rows are joined with the most-recent `nfl_predictions_epa` (by run_id), `nfl_betting_lines` (by training_key, most recent `as_of_ts`), and `production_weather`. The Swift `GamesStore.refreshNFL()` must reproduce this 4-table merge byte-for-byte.
- MLB query window: today through day-after-tomorrow (`startDate..endDate`), filtered to non-postponed games, joined with `mlb_predictions_current` (final-prediction flag), `mlb_team_mapping` (logos + abbrevs), `mlb_game_signals` (3-tier signals). Swift port preserves the exact filter + merge.
- Each `*GameSheet` (NFL/CFB/NBA/NCAAB/MLB) is opened via the corresponding `*GameSheetStore.openGameSheet(game)` — a `.sheet(item:)` on this view's root for each store.
- Headers stay fixed (no scroll-based hide animation, despite the RN interpolation setup — outputs are `[0,0]`). Keep it simple in Swift; no parallax.
- Non-pro users see only first 2 cards per sport unlocked (`index < 2`); the rest are blurred via `LockedGameCard`. `proAccess.isPro` check.

> ⚠️ Ambiguity: The "sport unavailable" `Alert.alert('Coming Soon', ...)` is currently dead code — all sports have `available: true`. Preserve the code path (`.alert` modifier gated on availability) but expect it to never trigger.

---

### 9. `PicksView` — Editor's Picks tab, sectioned by date

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/picks.tsx`
**Container:** `ZStack` of:
- A custom frosted-glass header (matches `GamesView`'s header — cog, "WagerProof" title with optional admin shield, view-mode toggle, drafts toggle for admins, WagerBot launcher, sport pills underneath).
- A scrollable `SectionedList` of picks grouped by date label ("Today", "Yesterday", "Mar 18", etc.) — port via `List { ForEach(groupedPicks) { section in Section(header: ...) { ForEach(section.picks) { ... } } } }.listStyle(.plain)`.

**Navigation chrome:** `.navigationBarHidden(true)` (custom header). When admin mode is on, a small `shield.checkered` badge appears next to the title.

**Native primitives:**
- `EditorPicksStore` — `@Observable`. Fetches from main Supabase `editors_picks` table (filtered by `is_published == true` unless admin + showDrafts). Joins with per-sport game data from CFB Supabase (NFL/CFB/NBA/NCAAB) for logos, scores, dates.
- Sport pills row identical to `GamesView` but with `"All"` as the first option (default).
- View mode toggle button: `view-list` (compact) ↔ `view-agenda` (large). Two card variants:
  - Large → `EditorPickCard`
  - Compact → `CompactPickCard`
  Wrap in `PickCardErrorBoundary` (in Swift, use `Result`-based fallback or a `View` that catches via `.onAppear`).
- Admin-only "Drafts" toggle pill: `eye` vs `eye.slash`, tint green when on.
- Admin-only FAB: bottom-right `FAB` (Material Paper) → `Button { editorPickSheetStore.openCreateSheet() }`. In Swift port, render as a floating `Button` with `Circle().fill(Color.brandGreen).frame(width: 56, height: 56)` + `plus` SF symbol inside, positioned via `.overlay(alignment: .bottomTrailing) { ... .padding(16).padding(.bottom, tabBarHeight) }`.
- Section header: a horizontal rule + uppercase date label centered, ~12pt bold, with the rule extending on both sides.
- Pull-to-refresh: `.refreshable { await picks.refresh() }`.
- Pick card tap: invoke `pickDetailSheetStore.openPickDetail(pick:gameData:)`.
- Long-press pick card (admin) → `editorPickSheetStore.openEditSheet(pick)`.
- Empty state per sport: a card with `clipboard.fill.badge.exclamationmark`-style icon + "No Current Picks" / "Check back soon for new picks".
- `EditorPicksStatsBanner` — pinned at the top of the section list as `ListHeaderComponent`.
- Locked pick wrapper: when `!proAccess.isPro && !pick.is_free_pick`, wrap the card in `LockedPickCard` (blur overlay + paywall CTA).

**Gesture choreography:**
- Tap sport pill → `selectedSport = sport` (instant filter; data is already loaded).
- Tap view-mode toggle → flip between compact / large card layouts.
- Tap pick card → open `PickDetailBottomSheet`.
- Long-press pick card (admin only) → open the editor pick creator sheet in edit mode.
- Swipe left on a pick row (`List` row, admin only) → `.swipeActions(edge: .trailing) { Button(role: .destructive) { editorPicksStore.delete(pick.id) } label: { Label("Delete", systemImage: "trash") } }`.
- Pull-to-refresh → re-fetch.
- Tap FAB → open creator sheet (`.add` mode).
- Tap cog → push settings.

**Animations:**
- Section list insert/delete: system list animations (`.animation(.default, value: groupedPicks)`).
- Sport filter change: `.animation(.spring(response: 0.4), value: selectedSport)` on the picks `ForEach`.
- View-mode toggle: `.animation(.easeInOut(duration: 0.25), value: viewMode)` — cards cross-fade as layout changes.
- FAB scale-in on appear: `.scaleEffect(adminModeEnabled ? 1 : 0).animation(.spring(response: 0.5), value: adminModeEnabled)`.

**Haptics:**
- Sport pill tap → `.sensoryFeedback(.selection, trigger: selectedSport)`.
- View-mode toggle → `.sensoryFeedback(.selection, trigger: viewMode)`.
- Pick tap → `.sensoryFeedback(.impact(weight: .light), trigger: tapCount)`.
- Long-press (admin) → system fires from `.contextMenu` (or `.swipeActions`).
- FAB tap → `.sensoryFeedback(.impact(weight: .medium), trigger: fabTapCount)`.
- Pull-to-refresh end → `.sensoryFeedback(.impact(weight: .medium), trigger: refreshing)`.
- Drafts toggle (admin) → `.sensoryFeedback(.selection, trigger: showDrafts)`.

**Loading state:** Shimmer 4 `GameCardShimmer` cards while initial fetch is pending.
**Empty state:** Within the scroll, a centered card with `clipboard.fill.badge.exclamationmark` + "No Current Picks" + per-sport subtitle ("No `<SPORT>` picks right now" or "Check back soon for new picks").
**Error state:** Centered `ContentUnavailableView("Couldn't load picks", systemImage: "exclamationmark.triangle", description: Text(error))`.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.cog` → SF Symbol `gearshape`.
- RN `MaterialCommunityIcons.shield-account` (admin badge) → SF Symbol `shield.checkered`.
- RN `MaterialCommunityIcons.view-list` → SF Symbol `list.bullet`.
- RN `MaterialCommunityIcons.view-agenda` → SF Symbol `square.stack.fill`.
- RN `MaterialCommunityIcons.eye` → SF Symbol `eye`.
- RN `MaterialCommunityIcons.eye-off` → SF Symbol `eye.slash`.
- RN `MaterialCommunityIcons.robot` → SF Symbol `bubble.left.and.text.bubble.right` (same as Games tab).
- RN `MaterialCommunityIcons.clipboard-text-off-outline` (empty state) → SF Symbol `clipboard.fill.badge.exclamationmark` (or `clipboard.fill` + a `.badge`).
- RN `MaterialCommunityIcons.plus` (FAB) → SF Symbol `plus`.
- RN `MaterialCommunityIcons.alert-circle` → SF Symbol `exclamationmark.triangle`.
- RN sport icons → same as `GamesView`.

**Edge cases preserved from RN:**
- Picks are filtered to the last 7 days + future games (RN does this after fetching). Implement the date filter in `EditorPicksStore` post-merge.
- `allPicks` (no date filter) is kept separately for stats calculations (`EditorPicksStatsBanner`).
- iOS widget sync: when picks or gamesData change AND `Platform.OS === 'ios'`, push the first 5 picks to App Group `UserDefaults` via `WidgetDataBridge.syncWidgetData(...)`. Preserve existing `fadeAlerts`, `polymarketValues`, `topAgentPicks` so we don't clobber other widget data.
- NCAAB team mapping is cached at module level (`ncaabTeamMappingsCache`) — port as a static property on `EditorPicksStore` or a dedicated `NCAABTeamMappingCache` actor.
- NFL/CFB/NBA/NCAAB game date/time formatting uses ET-anchored conversion. The RN code does a manual UTC offset (5 hours for EST) — Swift should use `Calendar(identifier: .gregorian)` with `TimeZone(identifier: "America/New_York")` for cleaner conversion, but produce the same display strings.
- The on-pick-saved callback (`setOnPickSaved(() => fetchPicks)`) is a pub-sub bridge between the editor sheet and this view — port as `editorPickSheetStore.onPickSaved: (() async -> Void)?` that this view registers on appear and clears on disappear.

> ⚠️ Ambiguity: Compact vs large view mode is a per-screen state in RN (`useState`); not persisted across launches. Mirror — no `UserDefaults` write.

---

### 10. `AgentsView` — Agents hub, lists user's agents with Pixel Office banner

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/agents/index.tsx`
**Container:** `ZStack` of:
- Frosted-glass header (cog left, "WagerProof Agents" pill title center, WagerBot launcher right).
- Below header: either an empty-state `ScrollView` (no agents), an error `ScrollView`, or a `FlatList`-equivalent of agent ID cards in a 2-column grid.
**Navigation chrome:** `.navigationBarHidden(true)`.

**Native primitives:**
- `AgentsStore` — wraps `useUserAgents` React Query hook in Swift: fetches `avatar_profiles` for the current user + joins `avatar_performance_cache`. `AgentsStore.refresh()` re-runs the query.
- Header (`.overlay(alignment: .top)`):
  - Leading: cog button → push `MainRoute.settings`.
  - Center: "Wager" + "Proof" + a green pill "Agents" badge (`.padding(.horizontal, 10).padding(.vertical, 4).background(Color.brandGreen.opacity(0.12), in: Capsule()).overlay(Capsule().stroke(Color.brandGreen.opacity(0.25)))`).
  - Trailing: WagerBot launcher.
- Body (when agents exist):
  - `ScrollView { LazyVStack { CompanyDashboardBanner(agents:); PixelOffice(agents:); LazyVGrid(columns: 2, spacing: 8) { ForEach(sortedAgents, id: \.id) { agent in AgentIdCard(agent:) } } } }`.
  - Agents sorted by `performance.net_units` descending.
  - `PixelOffice` is a heavy pixel-art interactive scene; defer mount via `.task { try? await Task.sleep(for: .milliseconds(50)); officeReady = true }` and render a small `ActivityIndicator` placeholder until ready.
  - `OFFICE_HEIGHT = 800 * (width / 864)` aspect ratio preserved.
  - The `PixelOffice` becomes inactive (animation stops) when scrolled past `OFFICE_VISIBILITY_CUTOFF` to save battery. Hook via `.onScrollGeometryChange(for: CGFloat.self) { $0.contentOffset.y } action: { _, y in officeSceneActive = y < OFFICE_VISIBILITY_CUTOFF }`.
- Body (empty state): `EmptyStateView` with a 3-step journey card (tune-variant icon, brain icon, lightning-bolt icon) + "Create Your First Agent" big green button. Above the steps, a smaller `PixelOffice(agentCount: 4)` plays.
- Body (error state): `ContentUnavailableView` with `exclamationmark.circle` + "Failed to load agents" + a bordered "Retry" button.
- FAB (bottom-right): `Button { handleCreateAgent() }` with `plus` SF symbol, brand green background, scale-in when user has agents AND `canCreateMoreAgents`.
- When agent limit is reached: a pill button "Agent limit reached" (lock icon) — tap shows an `Alert("Agent Limit Reached", message:)` with copy depending on isPro/isAdmin.
- `RefreshControl` → `.refreshable { await refetch() }`.

**Gesture choreography:**
- Tap agent ID card → push `MainRoute.agentDetail(id:)`.
- Long-press agent ID card → opens `ActionSheetIOS`-equivalent (`.confirmationDialog`):
  ```swift
  .confirmationDialog(agent.name, isPresented: $showAgentActions, titleVisibility: .visible) {
      Button("Settings") { mainRouter.path.append(.agentSettings(id: agent.id)) }
      Button(agent.auto_generate ? "Turn Autopilot Off" : "Turn Autopilot On") { Task { await toggleAutopilot(agent) } }
      Button("Delete Agent", role: .destructive) { confirmDelete(agent) }
      Button("Cancel", role: .cancel) {}
  }
  ```
- Delete confirmation: a secondary `.alert("Delete Agent", isPresented: $showDeleteAlert)` with destructive + cancel.
- Tap FAB → check entitlements via `agentEntitlements.canCreateAnotherAgent(activeCount:totalCount:)`; if blocked, show `.alert`; else `mainRouter.path.append(.agentCreate)`.
- Tap "Agent limit reached" hint → `.alert` explaining limits.
- Pull-to-refresh → `.refreshable`.
- Tap cog → push settings.

**Animations:**
- Agent card stagger on initial render: `.transition(.scale(scale: 0.9).combined(with: .opacity))` per card, delayed by index.
- Pixel office active/inactive: opacity 1↔0.6 with `.animation(.easeInOut(duration: 0.4), value: officeSceneActive)`.
- FAB scale-in: `.scaleEffect(hasAgents && canCreateMore ? 1 : 0).animation(.spring(response: 0.5))`.
- Skeleton shimmer (initial load): three `AgentTimelineSkeleton` views with `.shimmering(active: true)`.

**Haptics:**
- Agent card tap → `.sensoryFeedback(.impact(weight: .light), trigger: tapCount)`.
- Agent card long-press → `.sensoryFeedback(.impact(weight: .medium), trigger: longPressCount)`.
- Autopilot toggle (from confirmation dialog) → `.sensoryFeedback(.success, trigger: autopilotChangedAt)` on success / `.error` on failure.
- Delete success → `.success`; delete failure → `.error`.
- FAB tap → `.sensoryFeedback(.impact(weight: .medium), trigger: fabTapCount)`.

**Loading state:** Three `AgentTimelineSkeleton` rows with shimmer.
**Empty state:** Custom 3-step "journey" empty-state view + "Create Your First Agent" big button + miniature `PixelOffice`.
**Error state:** `ContentUnavailableView { Label("Failed to load agents", systemImage: "exclamationmark.circle") } actions: { Button("Retry") { Task { await refetch() } }.buttonStyle(.bordered) }`.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.cog` → SF Symbol `gearshape`.
- RN `MaterialCommunityIcons.robot` (WagerBot) → SF Symbol `bubble.left.and.text.bubble.right`.
- RN `MaterialCommunityIcons.plus` (FAB) → SF Symbol `plus`.
- RN `MaterialCommunityIcons.lock` (limit hint) → SF Symbol `lock`.
- RN `MaterialCommunityIcons.alert-circle-outline` (error) → SF Symbol `exclamationmark.circle`.
- RN `MaterialCommunityIcons.tune-variant` (journey step 1) → SF Symbol `slider.horizontal.3`.
- RN `MaterialCommunityIcons.brain` (journey step 2) → SF Symbol `brain.head.profile`.
- RN `MaterialCommunityIcons.lightning-bolt` (journey step 3) → SF Symbol `bolt.fill`.

**Edge cases preserved from RN:**
- Daily activity tracking: `trackAppOpen(user.id)` on mount → port as `.task { await activityStore.trackAppOpen(userId) }`.
- `useTopAgentsWidgetSync()` is called from the drawer layout (not here), but the agent list change is what triggers it.
- Agents are padded to an even count for the 2-column grid (`paddedAgents = agents.length % 2 != 0 ? [...agents, null] : agents`). The padding entry renders an empty spacer.
- `ITEM_HEIGHT = 203` is preserved so `getItemLayout` works — in SwiftUI, use `.frame(height: 203)` per cell.
- The `PixelOffice` mini in empty state uses `agentCount: 4` placeholders (no real agents). Port via a `PixelOffice(placeholderCount: 4)` initializer.
- Pro users can have up to 30 total agents, 10 active; free users get 1 active. `useAgentEntitlements()` exposes this — port via `AgentEntitlementsStore.canCreateAnotherAgent(activeCount:totalCount:)`.

---

### 11. `AgentCreateView` — 6-step agent creation wizard

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/agents/create.tsx` + each `components/agents/creation/Screen[N]_*.tsx`
**Container:** `ZStack` of:
- Top: frosted-glass header (close button left, screen title center, "1/6" step counter right, animated progress dot row below).
- Middle: `ScrollView` of the active step's content (with `KeyboardAvoidingView` behavior).
- Bottom (not on last step): frosted-glass footer with "Back" (outlined) + "Next" (filled brand green) buttons.

**Navigation chrome:** `.navigationBarHidden(true)`. `.toolbar(.hidden, for: .tabBar)`.

**Native primitives:**
- `AgentCreationStore` — `@Observable`. Holds `formState: CreateAgentFormState`, `currentScreen: Int`, helpers `updateFormState`, `updatePersonalityParam`, `updateCustomInsight`, `applyArchetypePreset`. Validates each step's `validateScreen(i)` and returns error strings via `getValidationError(i)`.
- Header progress row: 6 `Capsule()` segments (`.height(3)`) — active/past use `Color.brandGreen`, future use a muted gray.
- Body: `Group { switch currentScreen { case 0: Screen1View; case 1: Screen2View; ... } }`.

Each sub-screen view (RN files `Screen1_SportArchetype.tsx` through `Screen6_Review.tsx`):

| Step | View | Purpose | Primitives |
|---|---|---|---|
| 0 | `Screen1SportArchetypeView` | Pick sports + archetype preset | Multi-select sport chips (`LazyVGrid`), then a horizontal scroll of "Archetype" cards (preset personalities like "Sharp", "Underdog Hunter", "Value Hunter"). Tap an archetype → `applyArchetypePreset(id, personalityParams, customInsights)`. |
| 1 | `Screen2IdentityView` | Name + emoji + color | `TextField` for name (max 50), `SwipeableEmojiPicker` (a `TabView(.page)` of emoji grids), `LazyHGrid` of 10 color swatches. |
| 2 | `Screen3PersonalityView` | Personality sliders (5 params) | `SliderInput` (custom: 1-5 scale labeled "Very Safe" → "High Risk", etc.) for risk_tolerance, confidence_threshold, trust_model, trust_polymarket, plus a `Picker(.segmented)` for `preferred_bet_type` ("Spread", "Moneyline", "Total", "Any"). |
| 3 | `Screen4DataAndConditionsView` | Toggles for data sources + signals | `ToggleInput` (custom card-style toggle) for `chase_value`, `fade_public`, `weather_impacts_totals`, `ride_hot_streaks`, `fade_cold_streaks`, `skip_weak_slates`. Conditional fields shown via `getConditionalParams(sports)`. |
| 4 | `Screen5CustomInsightsView` | Free-text user-supplied "always consider" notes | Multi-line `TextEditor` fields for several insight categories (animation-enabled via `LayoutAnimation` in RN — in Swift use `.animation(.default, value: insights)` on the form). |
| 5 | `Screen6ReviewView` | Confirmation + autopilot config | Read-only summary of the form + `Toggle("Auto-generate picks daily")` + `TimePickerModal` for `auto_generate_time` + timezone picker. Final big "Create Agent" `Button(.borderedProminent)` at bottom (full-width). |

**Gesture choreography:**
- Tap close (X) → `.alert("Discard Agent?", "Are you sure...")` confirm; "Discard" pops the stack via `dismiss()`; "Keep Editing" cancels.
- Tap "Back" → `currentScreen -= 1` (no-op on step 0); scroll resets to top.
- Tap "Next" → validate; if invalid, `.alert("Required", error)`; else `currentScreen += 1` with `.sensoryFeedback(.impact(.light))`.
- Tap "Create Agent" (step 5) → `Task { await createAgent() }`. On success, transition to `AgentCreationGenerationIntro` full-screen overlay, then to `AgentBornCreationCelebration` overlay, then `router.replace(.agentDetail(id: newAgent.id))`.
- Sport chip tap (step 0) → toggle in array.
- Archetype card tap (step 0) → apply preset (with confirmation if user has edited fields manually).
- Emoji swipe (step 1) → `TabView(.page)` swipe between emoji pages.
- Color swatch tap (step 1) → select.
- Slider drag (step 2) → update param.
- Toggle tap (step 3) → flip param.
- Time picker tap (step 5) → present `TimePickerModal` (a sheet with two `Picker(.wheel)` for hours/minutes + timezone picker).

**Animations:**
- Step transition: `.transition(.move(edge: .trailing).combined(with: .opacity))` on the active step content. Reverse direction on Back.
- Progress dots fill green on advance: `.animation(.spring(response: 0.4), value: currentScreen)`.
- `LayoutAnimation` on custom insights step (RN) → SwiftUI `.animation(.spring(), value: insights)`.
- `AgentCreationGenerationIntro` overlay: cinematic animation (port like step 20 of onboarding).
- `AgentBornCreationCelebration` overlay: Lottie confetti + agent card reveal.

**Haptics:**
- Step advance → `.sensoryFeedback(.impact(weight: .light), trigger: currentScreen)`.
- Validation fail → `.sensoryFeedback(.warning, trigger: validationFailedCount)`.
- Sport/archetype/emoji/color/toggle tap → `.sensoryFeedback(.selection, trigger: ...)`.
- Create success → `.sensoryFeedback(.success, trigger: createdAgentId)`.
- Create failure → `.sensoryFeedback(.error, trigger: errorMessage)`.

**Loading state:** While `createMutation.isPending`, "Create Agent" button shows `ProgressView` and is `.disabled`. While `isEntitlementsLoading`, button label changes to "Checking subscription...".
**Empty state:** n/a.
**Error state:** `Alert("Error", message: error?.message ?? "Failed to create agent. Please try again.")`. Agent limit reached → `Alert("Agent Limit Reached", message: ...)`.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.close` (header close) → SF Symbol `xmark`.
- Step-specific icons (varies by screen): use the same canonical mappings as in §10 (brain, slider, bolt, etc.).

**Edge cases preserved from RN:**
- Name uniqueness validation per user: `agents.some(a => a.name.toLowerCase() === formState.name.trim().toLowerCase())`. Port verbatim.
- Auto-mode forced-off rule: if `!isAdmin && isPro && activeCount >= proMaxActiveAgents`, the autopilot toggle is forced off and disabled — show a small hint "Auto agent slots full; agent will start in manual mode."
- Form state is local to the wizard (not persisted across cancels). Discard confirmation dialog appears whenever user taps X.
- After successful create, the wizard transitions through two cinematic overlays before navigating away. These overlays are NOT pushed routes — they are full-screen modals presented within this view.

---

### 12. `AgentDetailView` — single agent dashboard with picks, performance, history

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/agents/[id]/index.tsx`
**Container:** `ScrollView` of:
1. Frosted-glass header (back, settings).
2. Profile card (avatar, name, sport badges, widget-favorite button, personality pills, 4-stat row: Record / Net Units / Win Rate / Streak).
3. Auto-generate time row (if `agent.auto_generate`).
4. Autopilot toggle row.
5. Generate-picks status block (or thinking animation if generating).
6. "Today's Picks" section.
7. Collapsible "Pick History" section.
8. Performance charts (lazy-mounted).
9. Disclaimer footer.
10. Audit `BottomSheet` (Gorhom) — port to `.sheet` with detents `[.fraction(0.85), .large]`.

**Navigation chrome:** `.navigationBarHidden(true)` (custom frosted header). Header has back chevron leading + cog trailing.

**Native primitives:**
- `AgentDetailStore` — wraps `useAgentDetailSnapshot(id)` + `useAgentPicks(id)`. Single snapshot RPC returns `agent`, `performance`, `todays_picks`, `todays_generation_run`. Pick history (`allPicks`) fetched lazily once charts are ready.
- Header: `AndroidBlurView`-equivalent → `.background(.ultraThinMaterial)`.
- Avatar block: if `agent.avatar_color.starts(with: "gradient:")`, render a `LinearGradient` circle; else a flat-color `Circle`. The emoji is rendered inside as `Text(emoji).font(.system(size: 48))`.
- Stat row: 4 `VStack`s, each with a small uppercase label and a value. Net Units uses green/red color based on sign. If `!canViewAgentPicks`, the Net Units value is overlaid with `.ultraThinMaterial` blur + a lock SF symbol.
- Personality pills: `FlowLayout` (iOS 16+) or `LazyVGrid` of `Capsule()` views with the primary brand color at 20% opacity.
- Widget-favorite button: `Button { Task { await toggleWidgetFavorite() } }` with `star.fill` / `star` (filled = is favorite). Limited to 3 favorites total — if more, show `Alert("Favorite Limit Reached", message:)`.
- Auto-generate time row: tappable → opens `TimePickerModal` sheet.
- Autopilot row: `Toggle("Autopilot", isOn: $autoGenerate)` with brand green track.
- Generate-picks status block (3 variants):
  - **Generating**: `ThinkingAnimation(variant: .generatingPicks)` — port via custom `View` with `PhaseAnimator` + rotating status copy.
  - **Has picks**: status card with `checkmark.circle` + "Today's picks are live" + regen summary text + a small regen `Button` showing `N/3 daily regenerations remaining`. Use `arrow.clockwise` SF symbol.
  - **No picks generated yet**: empty card with `calendar.badge.exclamationmark` + "No picks yet today" + big "Generate Today's Picks" button.
- Today's Picks list: `ForEach(effectiveTodaysPicks) { pick in AgentPickRow(pick:) }`. Each row has two action buttons: "Open Game Card" (push the per-sport game sheet via `gameLookupStore.openGameForPick(...)`) and "Open Pick Audit" (presents the audit sheet).
- Pick history section header: tappable `HStack` with title + chevron (`chevron.down` / `chevron.up`). When expanded:
  - Horizontal `ScrollView` of filter `Chip`s: All / Won / Lost / Pending → use `Picker(.segmented)` or a custom chip row.
  - List of `AgentPickItem` views (max 10).
- Audit sheet: `.sheet(item: $selectedAuditPick) { pick in AuditView(pick:) }` with detents `[.fraction(0.85), .large]`. Audit content is a green-on-black "terminal" look with sections: LEANED METRICS, WHY THIS PICK, PERSONALITY ALIGNMENT, MODEL INPUT GAME PAYLOAD (JSON), AGENT PERSONALITY PAYLOAD (JSON), AGENT RESPONSE PAYLOAD (JSON). Use a monospace font (`.font(.system(.body, design: .monospaced))`).
- Snackbars: three `Snackbar`-style toasts — limit-hit, generating-in-progress, errors. Port as a single `ToastQueue` `.overlay(alignment: .bottom)` view.
- Pull-to-refresh: `.refreshable { await refresh() }` runs the snapshot + history refetch in parallel.

**Gesture choreography:**
- Tap back → `dismiss()`.
- Tap cog → push `MainRoute.agentSettings(id:)`.
- Tap widget-favorite star → toggle (with Alert if at limit).
- Tap auto-gen time → present `TimePickerModal`.
- Toggle autopilot → mutate, with success/error haptic.
- Tap "Generate Today's Picks" → `Task { await handleGeneratePicks() }`. If rate-limited, show `LimitToastVisible`; if subscription-locked, show error toast.
- Tap "Open Game Card" on a pick → resolve game and open per-sport sheet.
- Tap "Open Pick Audit" → `selectedAuditPick = pick`; sheet presents.
- Tap pick history header → collapse/expand.
- Tap filter chip → `pickFilter = .x`.
- Pull-to-refresh → re-fetch.
- Long-press a pick → `.contextMenu { Button("View audit") { selectedAuditPick = pick }; Button("Open game") { ... } }` (enhancement; RN does this via buttons but contextMenu is more iOS-native).

**Animations:**
- Header background: `.ultraThinMaterial` (static).
- ThinkingAnimation: custom `PhaseAnimator` with 4 stages cycling status text + a pulsing `brain.head.profile` symbol.
- Pick history expand/collapse: `.animation(.easeInOut(duration: 0.25), value: showHistory)`.
- Streak number color transition: `.contentTransition(.numericText())` on the streak `Text`.
- Net Units color animation: same `.contentTransition(.numericText())` + `.animation(.spring(), value: netUnits)`.
- Audit sheet drag indicator visible.
- Shimmer skeleton (initial load): full-page redacted shimmer via `AgentDetailLoadingShimmer` view; port using `.redacted(reason: .placeholder).shimmering()`.

**Haptics:**
- Widget-favorite toggle → `.sensoryFeedback(.impact(weight: .light), trigger: isFavoriteUpdating)`; success → `.success`; failure → `.error`.
- Time-picker confirm → `.success`.
- Autopilot toggle → `.success` / `.error`.
- Generate picks tap → `.sensoryFeedback(.impact(weight: .medium), trigger: generateTapCount)`.
- Generation success → `.success`; no-picks-found → `.warning`; failure → `.error`.
- Limit hit → `.warning`.
- Pick row tap (open game card) → `.impact(.light)`.
- Open audit → `.impact(.light)`.

**Loading state:** Full-page shimmer placeholder mirroring the actual layout (header skeleton, profile card skeleton with 4 stat skeletons, button skeleton, 2 pick-card skeletons).
**Empty state:** "No picks yet today" centered card with `calendar.badge.exclamationmark` + Generate button. If a run completed with zero picks, show a different message "No picks for today" + "This agent already finished today's run and chose not to publish any picks."
**Error state:** If agent not found: `ContentUnavailableView { Label("Agent not found", systemImage: "exclamationmark.circle") } actions: { Button("Go Back") { dismiss() }.buttonStyle(.bordered) }`.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.arrow-left` → SF Symbol `chevron.left`.
- RN `MaterialCommunityIcons.cog` → SF Symbol `gearshape`.
- RN `MaterialCommunityIcons.star` / `.star-outline` → SF Symbol `star.fill` / `star`.
- RN `MaterialCommunityIcons.clock-outline` → SF Symbol `clock`.
- RN `MaterialCommunityIcons.robot-outline` → SF Symbol `bolt.circle` (or `brain.head.profile`).
- RN `MaterialCommunityIcons.check-circle` → SF Symbol `checkmark.circle`.
- RN `MaterialCommunityIcons.refresh` → SF Symbol `arrow.clockwise`.
- RN `MaterialCommunityIcons.lock` / `.lock-outline` → SF Symbol `lock` / `lock`.
- RN `MaterialCommunityIcons.lightning-bolt` → SF Symbol `bolt.fill`.
- RN `MaterialCommunityIcons.calendar-blank-outline` → SF Symbol `calendar.badge.exclamationmark`.
- RN `MaterialCommunityIcons.chevron-up` / `.chevron-down` → SF Symbol `chevron.up` / `chevron.down`.
- RN `MaterialCommunityIcons.cards-outline` (Open Game Card button) → SF Symbol `rectangle.on.rectangle`.
- RN `MaterialCommunityIcons.file-code-outline` (Open Pick Audit button) → SF Symbol `doc.text.magnifyingglass`.
- RN `MaterialCommunityIcons.information-outline` (disclaimer) → SF Symbol `info.circle`.

**Edge cases preserved from RN:**
- Picks access gating is client-side via RevenueCat SDK state (`useAgentEntitlements`) — do NOT trust the server's `can_view_agent_picks` flag (server returns picks data regardless; client gates display). Port the comment as a Swift `// See navigation-map.md §7 — server returns picks; client gates display via RevenueCat SDK`.
- Manual regeneration limit: 3 per agent per day. Track via `agent.daily_generation_count` + `agent.last_generation_date` matching `todayStr`. Admin bypass.
- The `Snackbar` triple (limit, error, generating) — only one visible at a time in iOS; port as a `ToastStack` that pops the most recent.
- "Today's Picks" interprets a completed-with-0 run differently from a not-yet-run state — `effectiveTodaysGenerationRun.picks_generated === 0` with explanatory copy from `slate_note`, `no_games`, or `weak_slate` flags.
- Charts are deferred until `chartsReady = true` (after `InteractionManager.runAfterInteractions`). Mirror via `.task(priority: .background) { try? await Task.sleep(for: .milliseconds(120)); chartsReady = true }`.
- Widget-favorite limit: 3 total per user; locked agents (`is_active == false`) don't count. Show the list of current favorites in the Alert message.

> ⚠️ Ambiguity: The `ai_decision_trace` and `ai_audit_payload` JSON shapes vary by pick generation version. The audit view should fall back gracefully when `leaned_metrics` is missing — use `key_factors` as a fallback. Port the same fallback logic.

---

### 13. `AgentDetailSettingsView` — edit an existing agent's full configuration

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/agents/[id]/settings.tsx`
**Container:** `ZStack` of a `KeyboardAvoidingView` wrapping a `ScrollView` of collapsible sections + a save bar at the bottom.

**Navigation chrome:** Standard nav bar with title "Edit Agent" inline + back chevron leading + a trailing "Save" `Button` (disabled until `hasChanges`).

**Native primitives:**
- `AgentSettingsStore` — `@Observable`. Fetches single agent via `useAgent(id)`. Tracks `hasChanges` by diffing local form state vs original.
- A series of `CollapsibleSection`s (port the RN custom collapsible — see `agentDetail` view for pattern):
  1. **Identity** — name `TextField`, `SwipeableEmojiPicker`, color swatch row.
  2. **Sports** — multi-select chips (`LazyVGrid` of sport chips).
  3. **Personality** — sliders + segmented picker for `preferred_bet_type` (same primitives as creation step 3).
  4. **Data & Conditions** — toggles + `OddsInput` (custom numeric input for min/max odds).
  5. **Custom Insights** — multi-line `TextEditor`s, animated layout.
  6. **Auto-Generate** — `Toggle("Autopilot")`, time picker, timezone picker. Disabled when `!canUseAutopilot`.
  7. **Public** — `Toggle("Make agent public")`, gated by `canCreatePublicAgent`.
  8. **Danger Zone** — "Delete Agent" `Button(role: .destructive)`.
- Each `CollapsibleSection` is a card with a tappable header (icon + title + chevron) and animated content. Use `DisclosureGroup` natively, or build a custom view with `.animation(.easeInOut, value: expanded)`.
- Save bar (`.safeAreaInset(edge: .bottom)`): "Save Changes" `Button(.borderedProminent).tint(.brandGreen)`, full-width, disabled when `!hasChanges`.
- Delete confirmation: `.alert("Delete Agent", isPresented: $showDeleteAlert) { Button("Delete", role: .destructive) { ... }; Button("Cancel", role: .cancel) {} } message: { Text("This cannot be undone.") }`.
- Cancel-with-changes: `.confirmationDialog("Unsaved changes", isPresented: $showCancelDialog) { Button("Discard", role: .destructive) { dismiss() }; Button("Keep Editing", role: .cancel) {} }` triggered when user taps back with `hasChanges == true`.

**Gesture choreography:**
- Tap section header → expand/collapse.
- Tap back with changes → confirmation dialog.
- Tap Save → mutate via `updateAgentMutation.mutateAsync(...)`. On success, `dismiss()`.
- Tap Delete → confirmation alert → on confirm, mutate via `deleteAgentMutation.mutateAsync(id)` → `dismiss()` then `mainRouter.path.removeLast()` to return to agents list.
- Toggle public → if `!canCreatePublicAgent`, show upgrade prompt.

**Animations:**
- Section expand/collapse: `.animation(.easeInOut(duration: 0.25), value: expanded)`.
- Layout animation on custom insights changes.
- Save bar appearance: persistent (no animation needed).

**Haptics:**
- Section expand/collapse → `.sensoryFeedback(.impact(weight: .light), trigger: expanded)`.
- Field change → `.selection` (sliders/toggles).
- Save success → `.success`.
- Save failure → `.error`.
- Delete confirm → `.warning`.
- Delete success → `.success` after pop.

**Loading state:** While fetching agent: `ProgressView()` centered. While saving: Save button shows `ProgressView`.
**Empty state:** n/a.
**Error state:** `Alert("Failed to save", message: error)`.

**SF Symbol swaps:**
- RN section icons (varies): use SF Symbols `person.crop.circle` (identity), `sportscourt` (sports), `brain.head.profile` (personality), `chart.line.uptrend.xyaxis` (data), `text.bubble` (custom insights), `clock.arrow.circlepath` (auto-gen), `globe` (public), `trash` (danger zone).
- RN `MaterialCommunityIcons.chevron-up` / `.chevron-down` → SF Symbol `chevron.up` / `chevron.down`.

**Edge cases preserved from RN:**
- Notification permission for autopilot: when user enables autopilot, call `ensureAutoPickNotificationPermission()` (RN's helper). Port as `Task { await NotificationStore.requestAutoPickPermission() }` — request authorization for `.alert` + `.badge`.
- Public toggle gated by `canCreatePublicAgent` (Pro/admin only).
- Save button only enabled when `hasChanges` (deep diff between local form state and original agent).
- Sport changes trigger re-computation of `getConditionalParams(sports)` to hide irrelevant fields (e.g. weather toggles hidden when only NBA selected).
- Default fallback to `DEFAULT_PERSONALITY_PARAMS` / `DEFAULT_CUSTOM_INSIGHTS` if the agent's stored values are missing.

---

### 14. `PublicDetailView` — public view of an agent (followable, picks gated)

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/agents/public/[id].tsx`
**Container:** `ScrollView` of:
1. Frosted-glass header (back chevron only — no settings cog).
2. Profile card (avatar, name, sport badges, personality pills, 4-stat row).
3. Follow / Unfollow button (only when viewing someone else's agent).
4. Today's Picks section (Pro-gated; non-Pro users see `LockedPickCard` placeholders).
5. Collapsible Pick History section.
6. Performance charts.
7. Disclaimer.

**Navigation chrome:** `.navigationBarHidden(true)`. Custom back chevron leading.

**Native primitives:**
- `PublicAgentDetailStore` — wraps `useAgent(id)` + `useAgentDetailSnapshot(id)` for follow status, performance, today's picks; `useAgentPicks(id)` for history (Pro gated).
- Profile card: identical layout to `AgentDetailView` but without the widget-favorite button.
- Follow button: only shown when `user.id != agent.user_id`. Two states:
  - Following: bordered, `checkmark` SF symbol + "Following" label.
  - Not following: filled primary, `plus` symbol + "Follow" label.
- Follow toggle: writes to `user_avatar_follows` table (insert/delete via `supabase.from('user_avatar_follows')...`). Show `ProgressView` inside the button while updating.
- Today's Picks: same as `AgentDetailView` but with picks displayed read-only — no "Open Pick Audit" button for non-owners (only the "Open Game Card" action remains).
- Pick history: same collapsible section + filter chips, but read-only.
- Locked variant: when `!canViewAgentPicks`, show 2x `LockedPickCard` in today's picks and 3x in history.
- `GlowingCardWrapper`: applies a glowing border around the picks list for premium-feel — port via `.overlay(RoundedRectangle().stroke(LinearGradient(...))).shadow(...)`.
- Pull-to-refresh: `.refreshable { await refresh() }`.
- Performance charts: `AgentPerformanceCharts` view.
- Error toasts: same `Snackbar`-style as `AgentDetailView`.

**Gesture choreography:**
- Tap back → `dismiss()`.
- Tap Follow → `Task { await toggleFollow() }`. Mutates `user_avatar_follows`.
- Tap pick (own pick or pro-viewable) → `gameLookupStore.openGameForPick(...)` → opens per-sport sheet.
- Tap pick history header → expand/collapse.
- Tap filter chip → set filter.
- Pull-to-refresh → re-fetch.

**Animations:**
- Follow state transition: `.contentTransition(.symbolEffect(.replace))` on the leading SF symbol; `.animation(.spring(response: 0.3), value: isFollowing)`.
- Charts deferred-mount (same pattern as `AgentDetailView`).

**Haptics:**
- Follow tap → `.sensoryFeedback(.impact(weight: .light), trigger: followTapCount)`.
- Follow success → `.success`.
- Follow failure → `.error`.
- Pick history toggle → `.selection`.
- Pick tap → `.impact(.light)`.

**Loading state:** Full-page shimmer placeholder (same as `AgentDetailView`).
**Empty state:** When agent has no picks today: `ContentUnavailableView("No picks today", systemImage: "calendar.badge.exclamationmark", description: Text("This agent hasn't published picks for today yet"))`.
**Error state:** `ContentUnavailableView("Agent not found", systemImage: "exclamationmark.circle")` with a Go Back button. If load failed: same with retry button.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.arrow-left` → SF Symbol `chevron.left`.
- RN `MaterialCommunityIcons.plus` (Follow) → SF Symbol `plus`.
- RN `MaterialCommunityIcons.check` (Following) → SF Symbol `checkmark`.
- Pick-row icons same as `AgentDetailView`.

**Edge cases preserved from RN:**
- Follow status comes from the snapshot RPC when available (`detailSnapshot.is_following`); otherwise a fallback query to `user_avatar_follows` runs.
- Owner-of-this-agent identification: if `user.id == agent.user_id`, hide the Follow button entirely (RN comment "only show if not own agent").
- Picks access gated client-side via RevenueCat SDK (same comment + logic as `AgentDetailView`).
- The `GlowingCardWrapper` is a visual flourish — preserve the glowing border effect for premium agent picks.
- Audit sheet is NOT shown to non-owners (only "Open Game Card" action on picks). RN doesn't currently show the audit terminal here; preserve that gating.

> ⚠️ Ambiguity: The exact pick visibility rules for non-Pro viewers of public agents need confirmation: does a non-Pro viewer see the pick *selection text* (e.g. "MIL -3.5") or only the locked card? RN renders `LockedPickCard` placeholders, suggesting the selection is hidden entirely. Port that — non-Pro sees only locked placeholders, not actual pick selections.


---

## C. Per-screen specifications (continued — sport sheets, analytics, settings, chat, modals)

> Batch B. Section numbers reset.

### Per-sport analytics tools — Games-page banners + Outliers hub (shared destinations)

The RN app surfaced per-sport "tools" as gradient banners on the Games screen. In Swift these are **HoneydewOptionCard** promo banners (same component as the Settings membership/Discord cards) shown on `GamesView` for the selected sport, AND kept as CTA entries in the Outliers hub. Both entry points resolve through one map.

- **`Wagerproof/Features/Games/Tools/`** — `SportTool` (struct + `registry: [GamesStore.Sport: [SportTool]]`, the data-driven inventory: MLB×4, NBA×2, NCAAB×2, NFL/CFB none); `ToolBannerCard` (wraps `HoneydewOptionCard`); `ToolRouter.leafView(for: OutliersStore.Category)` (the single category→view map used by both `GamesView.navigationDestination(item:)` and `OutliersDetailView`).
- **Tools** (reachable from both Games banner and Outliers): NBA/NCAAB Model Accuracy, MLB Regression Report, and **Editor's Picks Stats** (`EditorPicksStatsView`, Picks-tab banner). The MLB/NBA/NCAAB Betting Trends, MLB F5 Splits, and MLB Player Prop Matchups tools were RETIRED 2026-06-11 — those datasets are now per-matchup insight widgets on the game detail sheets (`BettingTrendsInsightWidget` / `F5SplitsInsightWidget` / `MLBMatchupPropsWidget`) and search insight chips; `F5GameCardView` + `MLBF5SplitsStore` + `MLBF5Splits.swift` survive behind the F5 widget's expand sheet.
- **List-page style:** every tool list view uses the MLB feed shell — `ScrollView { LazyVStack(pinnedViews:[.sectionHeaders]) { Section { cards } header: { pinned LiquidGlassCapsule sort/filter bar } } }`, cornerRadius-26 `.ultraThinMaterial` cards.
- **Deferred:** the regression report (rebuilt 2026-06-10 as `Features/Analytics/MlbRegressionReportView` with pinned section headers) and the shared betting-trends detail sheet (`Features/Outliers/Components/BettingTrendsDetailSheet` + `TrendsMatrixView`, which replaced the per-sport trends bottom sheets) are NOT yet converted to the `CollapsingWidgetScroll` collapsing-hero engine (they render polished per-item cards today; conversion is a sizable follow-up).

### 1. `OutliersView` — Spotify-style hub of value, fade, trend, and accuracy outliers across NFL/CFB/NBA/NCAAB/MLB

> **Partially superseded 2026-06-11:** the shipped hub is a merged outlier feed, and the
> per-category trends detail pushes described below were retired with the insight-widget
> refactor (see `fidelity/b06-outliers.md` for the current mapping).

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/outliers.tsx`
**Container:** `NavigationStack` rooted in a `ZStack` with a custom blurred header (`.background(.ultraThinMaterial)`) over a `ScrollView` of category sections. The "Outliers" inner-tab carousel is a `Picker(.segmented)` selecting between three branches: `outliers` hub, `Top Agent Picks` (embed `TopAgentPicksFeedView`), and `Leaderboard` (embed `AgentLeaderboardView`). Hub branch is a vertical `ScrollView` of 7 horizontal Spotify-style sections; tapping a section header pushes the matching detail view via `NavigationLink`.
**Navigation chrome:** Inline title shows "Wager" + "Proof" wordmark (green accent on "Proof"). Leading toolbar: `gearshape` button → `RootRouter.push(.settings)`. Trailing toolbar: `app.connected.to.app.below.fill` (robot) button → `WagerBotSuggestionStore.openManualMenu()`. Tab bar visible on hub; hidden when detail view is pushed.

**Native primitives:**
- `Picker(.segmented)` — replaces `INNER_TABS` row (Outliers / Top Agent Picks / Leaderboard)
- `ScrollView(.horizontal)` + `LazyHStack` with `.scrollTargetBehavior(.viewAligned)` — replaces each section's horizontal card row (Prediction Market Alerts, Model Fade Alerts, NBA/NCAAB/MLB Betting Trends, NBA/NCAAB Model Accuracy)
- `.refreshable { await store.refreshAll() }` — replaces `RefreshControl` (invalidates value-alerts, fade-alerts, trends, accuracy queries in parallel)
- `NavigationLink(value: OutliersRoute.detail(category))` — replaces `selectedCategory` state + custom back button
- `.searchable(text: $store.searchText, placement: .navigationBarDrawer)` — replaces the in-modal "Search teams..." `TextInput` on the detail's `.sheet` (now pushed view)
- `Menu` for sport filter chips on detail view — replaces `renderSportFilter` (All/NFL/CFB/NBA/NCAAB with counts)
- `Picker(.segmented)` alternative for sport filter — wagerproof brand-pill style with `.tint(.wagerproofGreen)`
- `ContentUnavailableView("No alerts yet", systemImage: "chart.line.uptrend.xyaxis")` — replaces empty `hubCtaCard`
- `.redacted(reason: .placeholder).shimmering()` on 3 dummy `OutlierMatchupCard`s — replaces `OutlierCardShimmer` loop
- `.contextMenu` per matchup card with "Open game sheet", "Copy matchup", "Ask WagerBot about this game" actions
- `.sensoryFeedback(.selection, trigger: store.selectedCategory)` on category navigation
- `.sensoryFeedback(.impact(weight: .light), trigger: store.refreshing)` on pull-to-refresh
- Hero header at top: `OutliersHeroHeaderView` (reused) + `ToolExplainerBannerView` on detail screens

**Stores read:**
- `OutliersStore.weekGames / valueAlerts / fadeAlerts` — mirrors `useQuery(['week-games' | 'value-alerts' | 'fade-alerts'])`
- `NBABettingTrendsStore`, `NCAABBettingTrendsStore`, `MLBBettingTrendsStore` — replace `useNBABettingTrends`/`useNCAABBettingTrends`/`useMLBBettingTrends`
- `NBAModelAccuracyStore`, `NCAABModelAccuracyStore` — replace accuracy hooks
- `WagerBotSuggestionStore.setOutliersData(values, fades)` — sync for floating assistant
- `WidgetDataBridge.syncOutliersData(...)` — iOS App Group write (preserve `editorPicks` + `topAgentPicks` from existing widget data, write new fades + values, max 5 each)
- `NFLGameSheetStore.openGameSheet(game)` / `CFBGameSheetStore` / `NBAGameSheetStore` / `NCAABGameSheetStore` — opens the relevant `.sheet(item:)`
- `NBABettingTrendsSheetStore` / `NCAABBettingTrendsSheetStore` / `MLBBettingTrendsSheetStore` — same pattern for trend-card taps
- `ProAccessStore.isPro` — non-pro users see 2 cards + 3 `LockedOverlayView` placeholders

**Gesture choreography:**
- Tap a section header (`hubSectionHeader`) → push `OutliersDetailView(category:)` via `NavigationLink`
- Tap a matchup card → `.sensoryFeedback(.impact(weight: .light))`, set `loadingGameId`, call relevant `GameSheetStore.openGameSheet(...)` (async lookup via `lookupNBAFullGame` / `lookupNCAABFullGame` for accuracy cards)
- Long-press matchup card → `.contextMenu` with quick actions
- Tap sport filter pill on detail view → toggle filter, `.sensoryFeedback(.selection)`
- Swipe down on hub `ScrollView` → `.refreshable` triggers parallel refresh of 5 queries
- Detail-view back button (`arrow.left`) → `dismiss()` (system back)
- Detail-view refresh button (`arrow.clockwise`) → `store.refreshCurrentCategory()` with spinning rotation animation

**Animations:**
- Section transitions (hub → detail): system `NavigationStack` push (`.move(edge: .trailing).combined(with: .opacity)` analogue)
- New alert appears: `.transition(.scale(scale: 0.9).combined(with: .opacity))` with `.spring(response: 0.4)`
- Filter pill toggle: `.spring(response: 0.3)` color crossfade on background + text
- Refreshing state: rotating `arrow.clockwise` symbol via `.symbolEffect(.rotate, options: .repeating, value: store.refreshing)`
- Locked-card unlock prompt: tap → `LockedOverlayView` triggers paywall presentation

**Haptics:**
- Tab change: `.sensoryFeedback(.selection, trigger: store.activeTab)`
- Section header tap: `.sensoryFeedback(.impact(weight: .light), trigger: store.selectedCategory)`
- Card tap (game sheet open): `.sensoryFeedback(.impact(weight: .light), trigger: store.loadingGameId)`
- Pull-to-refresh end: `.sensoryFeedback(.impact(weight: .medium), trigger: store.refreshing)`
- Filter change: `.sensoryFeedback(.selection, trigger: store.valueAlertsFilter)`

**Loading state:** Per-section: 3 `OutlierMatchupCardView` placeholders inside `LazyHStack` with `.redacted(reason: .placeholder).shimmering()` and 150 ms staggered phase delay (use `PhaseAnimator` with index-based delay).
**Empty state:** Per section, dashed-border CTA card: `ContentUnavailableView("No alerts yet", systemImage: <section-icon>, description: Text("Explore the full tool"))` with trailing pill "View All".
**Error state:** Inline `Label("Couldn't load outliers — tap to retry", systemImage: "exclamationmark.triangle.fill")` on red background; tap → retry.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.football` → SF Symbol `football.fill`
- RN `MaterialCommunityIcons.school` → SF Symbol `graduationcap.fill`
- RN `MaterialCommunityIcons.basketball` → SF Symbol `basketball.fill`
- RN `MaterialCommunityIcons.basketball-hoop` → SF Symbol `basketball.fill` (use `.foregroundStyle(.orange)` to distinguish NCAAB)
- RN `MaterialCommunityIcons.baseball` → SF Symbol `baseball.fill`
- RN `MaterialCommunityIcons.trending-up` → SF Symbol `chart.line.uptrend.xyaxis`
- RN `MaterialCommunityIcons.lightning-bolt` → SF Symbol `bolt.fill`
- RN `MaterialCommunityIcons.percent` → SF Symbol `percent`
- RN `MaterialCommunityIcons.clock-outline` → SF Symbol `clock`
- RN `MaterialCommunityIcons.swap-horizontal` → SF Symbol `arrow.left.arrow.right`
- RN `MaterialCommunityIcons.bullseye-arrow` → SF Symbol `target`
- RN `MaterialCommunityIcons.cog` → SF Symbol `gearshape.fill`
- RN `MaterialCommunityIcons.robot` → SF Symbol `app.connected.to.app.below.fill`
- RN `MaterialCommunityIcons.chevron-right` → SF Symbol `chevron.right`
- RN `MaterialCommunityIcons.arrow-left` → SF Symbol `arrow.left`
- RN `MaterialCommunityIcons.arrow-right` → SF Symbol `arrow.right`
- RN `MaterialCommunityIcons.refresh` → SF Symbol `arrow.clockwise`
- RN `MaterialCommunityIcons.magnify` → SF Symbol `magnifyingglass`
- RN `MaterialCommunityIcons.close-circle` → SF Symbol `xmark.circle.fill`
- RN `MaterialCommunityIcons.thumb-up` / `thumb-down` → SF Symbol `hand.thumbsup.fill` / `hand.thumbsdown.fill`
- RN `MaterialCommunityIcons.shield-check` → SF Symbol `checkmark.shield.fill`
- RN `MaterialCommunityIcons.sleep` → SF Symbol `bed.double.fill`
- RN `MaterialCommunityIcons.gauge-full` → SF Symbol `gauge.high`
- RN `MaterialCommunityIcons.alert-circle` → SF Symbol `exclamationmark.circle.fill`

**Edge cases preserved from RN:**
- "Show locks" rule: when `!isProLoading && !isPro`, only show 2 cards per section + up to 3 `LockedOverlayView` placeholders (Math.min(3, remainingCount))
- Game-time filter: hide alerts where `gameTime < Date.now()` (use `isGameUpcoming` predicate)
- iOS-only widget sync (skip on macOS/iPadOS Catalyst); preserve existing `editorPicks` + `topAgentPicks` when writing
- MLB outliers use 60% threshold (vs 65% for NBA/NCAAB) — keep `MLB_BETTING_TRENDS_THRESHOLD = 60`
- NCAAB accuracy skips ML pickType (line 540 in RN: "heavily skewed toward favorites")
- NBA accuracy thresholds (65/35, min 5 games) vs NCAAB (70/30, min 10 games) — preserve constants
- `loadingGameId` clears after 500 ms `Task.sleep(nanoseconds: 500_000_000)` even on synchronous sheet open

---

### 2. `ScoreboardView` — live scores grid + tap-to-detail modal, grouped by league

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/scoreboard.tsx`
**Container:** `NavigationStack` → `ScrollView` of `LazyVStack(pinnedViews: [.sectionHeaders])` with one `Section` per league (NFL, NCAAF, NBA, NCAAB, NHL, MLB, MLS, EPL — sorted by `LEAGUE_CONFIG.order`). Each section's body is a `LazyVGrid(columns: 2)` of `LiveScoreCardView`s (compact mode) or a `LazyVStack` of `LiveScorePredictionCardView`s (expanded mode).
**Navigation chrome:** Animated blurred header (`.background(.ultraThinMaterial)`) with leading `gearshape`, centered "WagerProof" wordmark, trailing `app.connected.to.app.below.fill`. Below: "Live Scoreboard" title + "Real-time scores & predictions" subtitle. Trailing on inline `pageHeader`: a `Button` with `arrow.up.left.and.arrow.down.right` (Compact ↔ Expand). Tab bar visible.

**Native primitives:**
- `LazyVStack(pinnedViews: [.sectionHeaders])` — replaces league grouping with sticky headers
- `LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 2))` — replaces `gamesGridCompact` (2-column grid of compact cards)
- `LazyVStack` — replaces `gamesListExpanded` (full-width `LiveScorePredictionCard`s)
- `.refreshable { await scoreboardStore.refetch() }` — replaces `RefreshControl`
- `.sheet(item: $scoreboardStore.selectedGame) { game in LiveScoreDetailView(game: game) }` — replaces `LiveScoreDetailModal`
- `Button { isExpanded.toggle() }` with `.symbolEffect(.bounce, value: isExpanded)` and `.contentTransition(.symbolEffect(.replace))` on icon swap
- `.contextMenu` per `LiveScoreCardView`: "View predictions", "Open game sheet", "Share matchup"
- `Label("\(games.count) Games", systemImage: leagueIcon)` — replaces `leagueBadges`
- `ContentUnavailableView` for empty league — but per RN, instead shows `NoGamesTerminalView` (terminal-themed placeholder); preserve that custom view in `Features/Scoreboard/NoGamesTerminalView.swift`
- `.sensoryFeedback(.selection, trigger: isExpanded)`

**Stores read:**
- `LiveScoresStore.games / hasLiveGames / isLoading / refetch()` — mirrors `useLiveScores`
- `WagerBotSuggestionStore.setScoreboardData(games)` — for floating assistant scanning
- `ScoreboardSheetStore.selectedGame` — local `@State` for modal

**Gesture choreography:**
- Tap card (compact) → `.sensoryFeedback(.impact(weight: .light))`, set `selectedGame`, present `LiveScoreDetailModal`
- Tap card (expanded `LiveScorePredictionCard`) → opens prediction details (no modal — inline expansion handled in component)
- Long-press card → `.contextMenu`
- Tap "Compact"/"Expand" → toggle `isExpanded`, animated grid layout change
- Pull-to-refresh → `await refetch()`

**Animations:**
- Compact ↔ Expand grid: `.animation(.spring(response: 0.4), value: isExpanded)` cross-layout transition
- New game appears: `.transition(.scale.combined(with: .opacity))`
- Live-score number update (in `LiveScoreCardView`): `.contentTransition(.numericText())` on score
- "Hitting" badge pulse: `.symbolEffect(.pulse, options: .repeating, value: hasAnyHitting)`
- Sticky league header: native iOS pinned header behavior
- Header collapse on scroll: `.toolbar(.hidden, for: .navigationBar)` triggered via scroll offset (mirror RN's `headerTranslate`)

**Haptics:**
- Card tap: `.sensoryFeedback(.impact(weight: .light))`
- Expand/compact toggle: `.sensoryFeedback(.selection)`
- Modal open: `.sensoryFeedback(.impact(weight: .medium))`
- Refresh end: `.sensoryFeedback(.impact(weight: .medium))`

**Loading state:** 8 `LiveScoreCardShimmerView` tiles in a `LazyVGrid(columns: 2)` (4 rows × 2). Header section title also shimmers.
**Empty state:** `NoGamesTerminalView(context: .scoreboard)` — custom terminal-themed "No games" view (preserve from RN). If we use stock, fallback to `ContentUnavailableView("No live games right now", systemImage: "sportscourt.fill", description: Text("Check back during gameday."))`.
**Error state:** Inline retry banner above the league sections.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.shield-half-full` (NFL) → SF Symbol `shield.lefthalf.filled`
- RN `MaterialCommunityIcons.trophy` (NCAAF) → SF Symbol `trophy.fill`
- RN `MaterialCommunityIcons.basketball` (NBA) → SF Symbol `basketball.fill`
- RN `MaterialCommunityIcons.basketball-hoop` (NCAAB) → SF Symbol `basketball.fill`
- RN `MaterialCommunityIcons.hockey-sticks` (NHL) → SF Symbol `hockey.puck.fill`
- RN `MaterialCommunityIcons.baseball` (MLB) → SF Symbol `baseball.fill`
- RN `MaterialCommunityIcons.soccer` (MLS/EPL) → SF Symbol `soccerball`
- RN `MaterialCommunityIcons.arrow-expand` → SF Symbol `arrow.up.left.and.arrow.down.right`
- RN `MaterialCommunityIcons.arrow-collapse` → SF Symbol `arrow.down.right.and.arrow.up.left`
- RN `MaterialCommunityIcons.cog` → SF Symbol `gearshape.fill`
- RN `MaterialCommunityIcons.robot` → SF Symbol `app.connected.to.app.below.fill`

**Edge cases preserved from RN:**
- League ordering: NFL(1) → NCAAF(2) → NBA(3) → NCAAB(4) → NHL(5) → MLB(6) → MLS(7) → EPL(8); unknown leagues fall back to order 999
- `CFB` is an alias for `NCAAF` (treat as same league)
- "Hitting" badge appears only when `predictions.hasAnyHitting === true`
- Grid uses 50% width per card (2-col) in compact, 100% in expanded
- Scoreboard data syncs to `WagerBotSuggestionStore` for AI assistant scanning even when not on screen
- Modal "View Full Scoreboard" button switches to expanded mode and dismisses

---

### 3. `ChatView` — redirect to WagerbotChatView (legacy tab route)

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/chat.tsx` (5-line `Redirect href="/wagerbot-chat"`)
**Container:** Not a real screen. In Swift, this becomes an empty `View` that immediately calls `tabRouter.replaceWith(.wagerbot)` in `.task { }`. Equivalent to `Redirect` in expo-router. Tab visible but ChatView simply pushes/replaces with `WagerbotChatView`.

**Native primitives:**
- `.task { router.replace(.wagerbot) }` on appear
- `Color.clear` body

**Stores read:** `WagerBotChatStore` (proxied via `WagerbotChatView`).

**Edge cases preserved from RN:**
- Pure redirect — never render content here. If the `tabs/chat` route is hit, the user is moved into the dedicated `WagerbotChatView` (drawer-level route).
- Document the redirect as a legacy compatibility shim for the original tab layout.

**Refer to section 15 (`WagerbotChatView`) for the actual chat UI.**

---

### 4. `VoiceChatView` — redirect to WagerbotVoiceView (legacy tab route)

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/voice-chat.tsx` (exports `WagerBotVoiceChatScreen` for shared use + `LegacyVoiceChatRedirect` as default with `<Redirect href="/wagerbot-voice" />`)
**Container:** Empty redirect view; same pattern as `ChatView`. Calls `router.replace(.wagerbotVoice)`.

**Native primitives:**
- `.task { router.replace(.wagerbotVoice) }` on appear
- `Color.clear` body

**Stores read:** `WagerBotVoiceStore` (proxied via `WagerbotVoiceView`).

**Edge cases preserved from RN:**
- The actual UI lives in `WagerBotVoiceChatScreen` (in `voice-chat.tsx`); both the tab route and the drawer-level `/wagerbot-voice` route share that component.
- In Swift: extract the UI into `Features/Voice/WagerbotVoiceView.swift` (see section 16) and make the legacy tab redirect to it.

**Refer to section 16 (`WagerbotVoiceView`) for the actual voice UI.**

---

### 5. `RoastView` — voice-driven "roast me about my worst bets" AI agent

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/roast.tsx` (5 lines, delegates to `components/roast/RoastScreen.tsx` 308 lines)
**Container:** Full-screen `ZStack` with `LinearGradient` background (`#0a0a0a → #111827 → #0a0a0a`). `VStack` layout: custom header → `RoastIntensitySelectorView` → optional status banner → `ScrollView` of messages → bottom section with Lottie + status text + `RoastMicButtonView`. Wrapped in `KeyboardAvoidingView`-equivalent (`.scrollDismissesKeyboard(.interactively)` + safe-area padding).
**Navigation chrome:** No nav bar. Custom header at top with leading `arrow.left` back button → `dismiss()`, centered title "Roast Mode", trailing `arrow.clockwise` → `roastStore.clearConversation()`. Tab visible.

**Native primitives:**
- `LinearGradient(colors: [Color(hex: "0a0a0a"), Color(hex: "111827"), Color(hex: "0a0a0a")], startPoint: .top, endPoint: .bottom)`
- `ScrollViewReader` + `LazyVStack` with `.onChange(of: messages.count) { proxy.scrollTo(lastId, anchor: .bottom) }` — replaces `scrollRef.current?.scrollToEnd`
- `LottieView(animation: .named("ChattingRobot"))` (via `lottie-ios` SwiftPM dep) — replaces `LottieView source={ChattingRobot.json}`
- `.task` to auto-scroll on `messages.count`, `liveTranscript`, `aiTranscript`, `state` changes
- Custom `RoastMicButtonView` — replaces RN `<RoastMicButton>`; rendered as a circular `Button` with `.symbolEffect(.pulse, options: .repeating, isActive: state == .recording)`
- `RoastIntensitySelectorView` — replaces `<RoastIntensitySelector>`; use `Picker(.segmented)` with values: Mild / Medium / Brutal
- `ContentUnavailableView("Ready to get roasted?", systemImage: "mic.fill", description: Text("Tell The Bookie about your worst bets and prepare to get destroyed."))` — replaces empty state with mic emoji
- Message bubbles: `VStack` with left/right alignment; user bubble = `.background(Color.green.opacity(0.2))` rounded `.cornerRadius(16, corners: [.topLeft, .topRight, .bottomLeft])`; AI bubble similar but left-aligned with `.background(Color.white.opacity(0.08))`
- Live transcript bubble: dashed border via `RoundedRectangle.stroke(style: StrokeStyle(lineWidth: 1, dash: [5]))`

**Stores read:**
- `RoastSessionStore.state / intensity / messages / liveTranscript / aiTranscript / error / isConnected / isConnecting` — replaces `useRoastSession`
- `RoastSessionStore.toggleRecording() / setIntensity(_) / clearConversation()`

**Gesture choreography:**
- Tap mic button → `roastStore.toggleRecording()` (starts/stops OpenAI Realtime session)
- Tap intensity pill → `roastStore.setIntensity(.mild/.medium/.brutal)`, `.sensoryFeedback(.selection)`
- Tap header back → `dismiss()`
- Tap header refresh → confirm dialog "Clear conversation?" → `clearConversation()`
- Long-press a message → `.contextMenu` with "Copy text", "Share roast"

**Animations:**
- New message: `.transition(.move(edge: .bottom).combined(with: .opacity))` with `.animation(.spring(response: 0.3))` (replaces `FadeInDown.delay(...).duration(300)`)
- Mic recording: `.symbolEffect(.pulse, options: .repeating, isActive: state == .recording)` on `mic.fill`
- Status text color: animated between gray → green (recording) → amber (responding)
- Live transcript dashed border: continuous "marching ants" via `PhaseAnimator` if reduce-motion is off
- Lottie loops continuously regardless of state

**Haptics:**
- Mic press (recording start): `.sensoryFeedback(.impact(weight: .heavy), trigger: state == .recording)`
- Mic press (recording stop): `.sensoryFeedback(.impact(weight: .light))`
- First AI token arrives: `.sensoryFeedback(.selection)`
- Connection success: `.sensoryFeedback(.success)`
- Error: `.sensoryFeedback(.error, trigger: error)`
- Intensity change: `.sensoryFeedback(.selection)`

**Loading state:** "Connecting to The Bookie..." status banner appears under intensity selector while `isConnecting`.
**Empty state:** Centered mic emoji + "Ready to get roasted?" + "Tell The Bookie about your worst bets…".
**Error state:** Red-tinted status banner at top with error text; mic remains tappable to retry.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.arrow-left` → SF Symbol `arrow.left`
- RN `MaterialCommunityIcons.refresh` → SF Symbol `arrow.clockwise`
- RN emoji `🎤` → SF Symbol `mic.fill`

**Edge cases preserved from RN:**
- "The Bookie" label appears above every assistant bubble
- Auto-scroll fires with 100 ms debounce after messages, transcripts, or state change
- Live transcripts (user and AI) use 0.7 / 0.8 opacity to distinguish from finalized messages
- `STATUS_TEXT` map: idle → "Tap the mic to talk", recording → "Listening...", processing → "Thinking...", responding → "Roasting..."
- Intensity choice persists across session via `RoastSessionStore`
- Lottie animation continues playing even when idle — adds visual presence to empty state

---

### 6. `FeatureRequestsView` — community-voted roadmap with submit modal

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/feature-requests.tsx`
**Container:** `NavigationStack` → `ScrollView` with a blurred floating header at top + two sections: **Community Voting** (approved feature requests with thumbs up/down) and **Developer Roadmap** (subdivided into Planned / In Progress / Completed by `roadmap_status`).
**Navigation chrome:** Floating blurred header (`.background(.ultraThinMaterial)`) with `lightbulb.fill` icon + "Feature Requests" title (leading) and `plus` button in green pill (trailing). Trailing tap presents `SubmitFeatureRequestSheet` as `.sheet`. Tab visible.

**Native primitives:**
- `List` with `.listStyle(.insetGrouped)` and two sections — replaces ScrollView+Card pattern (cleaner native API)
- Per-row card: `VStack` with title row + description + footer row (votes or "X votes" badge)
- `.refreshable { await store.refetch() }`
- `.sheet(isPresented: $showSubmitModal) { SubmitFeatureRequestSheet() }` with `.presentationDetents([.medium, .large])` and `.presentationDragIndicator(.visible)`
- Submit sheet form: `Form` with `TextField("Title")` + `TextField("Description", axis: .vertical, lineLimit: 6...)` + `Button("Submit", action: handleSubmit)` `.buttonStyle(.borderedProminent).tint(.wagerproofGreen)`
- Vote buttons: pair of `Button` with `hand.thumbsup.fill` / `hand.thumbsdown.fill` symbols; tinted green when `userVote == "upvote"`, red when `"downvote"`; tap toggles or switches via `featureRequestsStore.vote(requestId:type:)`
- Status badge: `Label("Planned", systemImage: "clock")` / `Label("In Progress", systemImage: "paperplane.circle.fill")` / `Label("Completed", systemImage: "checkmark.circle.fill")` with color-coded background pills
- `.contextMenu` per row: "Copy link", "Share request"
- `.sensoryFeedback(.success, trigger: store.justSubmitted)` for submission success

**Stores read:**
- `FeatureRequestsStore.requests / userVotes / loading / refetch() / vote(id:, type:) / submit(title:, description:)`
- `ProfileStore.displayName` — used as `submitter_display_name`
- Supabase tables: `feature_requests` (read approved+roadmap), `feature_request_votes` (read user's, write/delete on vote)

**Gesture choreography:**
- Tap upvote/downvote → toggle vote (re-tap same type removes; tap different type updates); animated count change
- Tap "+" button → present submit modal with `.medium` initial detent, draggable to `.large`
- Modal "Submit" tap → validate (title + description required) → write to `feature_requests` (status: pending) → success alert → dismiss
- Pull-to-refresh → reload requests + votes
- Long-press row → context menu

**Animations:**
- Vote count change: `.contentTransition(.numericText())` on net vote number
- New request added: `.transition(.scale(scale: 0.9).combined(with: .opacity))` with `.spring(response: 0.4)`
- Roadmap status badge: `.symbolEffect(.bounce, value: roadmapStatus)` on status icon swap
- Modal dismiss: standard sheet drag-to-dismiss

**Haptics:**
- Vote tap: `.sensoryFeedback(.selection)`
- Submit success: `.sensoryFeedback(.success)`
- Submit validation error: `.sensoryFeedback(.warning)`
- Modal open: `.sensoryFeedback(.impact(weight: .light))`

**Loading state:** 3 `AlertCardShimmerView` rows per section, with section header skeleton (24pt × 150pt placeholder rect with `.redacted(reason: .placeholder)`).
**Empty state:** Per section: `ContentUnavailableView("No feature requests yet", systemImage: "lightbulb")` / `ContentUnavailableView("No roadmap items yet", systemImage: "map")` with sub-description.
**Error state:** Inline `Label("Failed to load feature requests", systemImage: "exclamationmark.triangle.fill")` with retry button.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.lightbulb-on` → SF Symbol `lightbulb.fill`
- RN `MaterialCommunityIcons.lightbulb-on-outline` → SF Symbol `lightbulb`
- RN `MaterialCommunityIcons.map-marker-path` → SF Symbol `map.fill`
- RN `MaterialCommunityIcons.clock-outline` → SF Symbol `clock`
- RN `MaterialCommunityIcons.rocket-launch` → SF Symbol `paperplane.circle.fill`
- RN `MaterialCommunityIcons.check-circle` → SF Symbol `checkmark.circle.fill`
- RN `MaterialCommunityIcons.thumb-up` → SF Symbol `hand.thumbsup.fill`
- RN `MaterialCommunityIcons.thumb-down` → SF Symbol `hand.thumbsdown.fill`
- RN `MaterialCommunityIcons.plus` → SF Symbol `plus`
- RN `MaterialCommunityIcons.close` → SF Symbol `xmark`

**Edge cases preserved from RN:**
- Only `status='approved'` or `status='roadmap'` shown to non-admins (regular users)
- Roadmap items don't expose voting UI; instead show "N votes" badge
- Same-vote re-tap removes vote; different-vote tap updates (no insert + delete sequence)
- New submissions start at `status='pending'` (hidden until editor approval)
- Display name falls back to "Anonymous" if profile doesn't have one
- Net votes color: green when positive, red when negative, neutral when zero

---

### 7. `SettingsView` — account, billing, preferences, danger zone

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/settings.tsx`
**Container:** `Form` with multiple `Section`s (NO own `NavigationStack` — it is PUSHED onto the active tab's stack via `MainTabToolbar.wagerProofSettingsDestination`, so wrapping it in its own stack would double the nav bar). Top hero is a `Button` styled as a `LinearGradient` card showing pro membership status (gold gradient if non-pro: "GO PRO TODAY"; if pro: "YOU ARE PRO" with crown). Below: Discord banner (purple gradient), then standard `Form` sections.
**Navigation chrome:** Reached by tapping the `WagerProofWordmark` in each main tab's top-leading toolbar slot (no gear button). Large title "Settings"; the system back button (from the parent stack) pops it. `.toolbar(.hidden, for: .tabBar)` hides the tab bar so it reads as a dedicated page rather than a peer of the tab surfaces.

**Native primitives:**
- `Form` with `.listStyle(.insetGrouped)` — replaces stacked `SectionCard` + `ActionRow` pattern
- Sections (in order): "Preferences", "Community & Support", "Legal & Policies", "Account", "Danger Zone" (the old "Membership" section was removed — its only content was the signed-in email, which now leads the "Account" section as a static row above "Log Out")
- `Toggle` for Dark Mode, WagerBot Suggestions, Push Notifications — wired to `@AppStorage` + system permission grants
- `NavigationLink` for "Manage Subscription" → opens RevenueCat customer center (via `RevenueCatStore.openCustomerCenter()` sheet); falls back to `https://apps.apple.com/account/subscriptions` `Link` if customer center unavailable
- `NavigationLink` for "Thinking Sprite" → push `ThinkingSpritePickerView`
- `NavigationLink` for "iOS Home Screen Widget" → push `IosWidgetView` (iOS only — hidden on macOS)
- `Link(destination: URL(...)!)` for Privacy Policy / Terms of Use (opens Safari)
- `Button("Contact Us") { openURL(URL(string: "mailto:admin@wagerproof.bet?subject=...")!) }`
- `Button("Log Out", role: .destructive)` with `.confirmationDialog("Logout?", isPresented:)` — replaces RN's `Alert.alert`
- `Button("Delete Account", role: .destructive)` → present `DeleteAccountSheet` via `.sheet`
- Hero card: `Button { handleHeroTap() } label: { ProMembershipHeroCard() }` with custom `LinearGradient` background, glow `Circle` overlays, and rotating crown badge (`.rotationEffect(.degrees(-8))`)
- Version tap counter: hidden — 5-tap-on-version-label gesture to open secret settings. Implement via `.simultaneousGesture(TapGesture(count: 5).onEnded { router.push(.secretSettings) })`
- `Picker(.menu)` not needed here — RN uses navigation pattern; mirror with `NavigationLink`

**Stores read:**
- `ThemeStore.isDark / toggleTheme()` — replaces `useThemeContext`
- `AuthStore.user / signOut() / deleteAccount() / signingOut / deletingAccount` — replaces `useAuth`
- `ProAccessStore.isPro / subscriptionType / isLoading` — replaces `useProAccess`
- `RevenueCatStore.openCustomerCenter()` — replaces `useRevenueCat`
- `WagerBotSuggestionStore.suggestionsEnabled / setSuggestionsEnabled(_:) / dismissFloating() / isDetached`
- `LearnWagerproofStore.openSheet()` — replaces `useLearnWagerProof`
- `NotificationsStore` — wraps `getNotificationPermissionStatus`, `requestNotificationPermission`, `registerPushToken`, `deactivatePushTokens`
- `ThinkingSpriteStore.selected` — replaces `useThinkingSprite`

**Gesture choreography:**
- Tap hero card (non-pro): `paywallStore.present(.genericFeature)`
- Tap hero card (pro): `revenueCatStore.openCustomerCenter()` (with App Store fallback)
- Tap toggle: instant state change + `.sensoryFeedback(.selection)`
- Tap notification toggle (off → on): if status `undetermined` → `requestNotificationPermission()`; if `denied` → alert + "Open Settings"; if `granted` → just register token
- Tap version label 5 times within 500 ms window each → push secret settings (RN uses 2 taps; iOS convention is 5 — keep 2 per RN to avoid behavioral drift, BUT note > ⚠️ Ambiguity: RN uses tap count = 2 with 500 ms window; iOS standard is 5. Verify desired count with PM.)
- Tap "Log Out" → `.confirmationDialog`; on confirm: `await signOut()`
- Tap "Delete Account" → `router.dismiss()` then push to `DeleteAccountSheet` after 120 ms `InteractionManager.runAfterInteractions` (preserve double-dismiss pattern from RN)

> ⚠️ Ambiguity: RN uses 2 version taps to reveal secret settings; standard iOS convention is 5. Decide canonical count with product team.

**Animations:**
- Toggle flip: system spring
- Subscription status badge: `.symbolEffect(.bounce, value: isPro)` on `crown.fill` swap
- Hero card glow circles: subtle `.rotationEffect` continuous via `PhaseAnimator`
- Logout/Delete spinner: `ProgressView` replaces chevron during action

**Haptics:**
- Any toggle: `.sensoryFeedback(.selection)`
- Sign out confirm: `.sensoryFeedback(.warning)`
- Delete account confirm: `.sensoryFeedback(.warning)`
- Subscription manage tap (success): `.sensoryFeedback(.impact(weight: .light))`
- Hero tap (open paywall): `.sensoryFeedback(.impact(weight: .medium))`

**Loading state:** Subscription row shows `ProgressView()` in trailing slot when `isProLoading` or `isOpeningCustomerCenter`. Sign out row replaces chevron with spinner during `signingOut`. Delete account row replaces chevron with spinner during `deletingAccount`.
**Empty state:** n/a (always renders sections).
**Error state:** Inline `Alert` for sign out failures, notification permission denials. RevenueCat errors fall back to App Store subscriptions URL.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.email-outline` → SF Symbol `envelope`
- RN `MaterialCommunityIcons.credit-card-outline` → SF Symbol `creditcard`
- RN `MaterialCommunityIcons.theme-light-dark` → SF Symbol `circle.lefthalf.filled`
- RN `MaterialCommunityIcons.robot-outline` → SF Symbol `app.connected.to.app.below.fill`
- RN `MaterialCommunityIcons.creation-outline` → SF Symbol `sparkles`
- RN `MaterialCommunityIcons.bell-outline` → SF Symbol `bell`
- RN `MaterialCommunityIcons.widgets-outline` → SF Symbol `square.grid.2x2`
- RN `MaterialCommunityIcons.information-outline` → SF Symbol `info.circle`
- RN `MaterialCommunityIcons.chat-processing-outline` → SF Symbol `bubble.left.and.bubble.right.fill`
- RN `MaterialCommunityIcons.lightbulb-on-outline` → SF Symbol `lightbulb`
- RN `MaterialCommunityIcons.school-outline` → SF Symbol `graduationcap`
- RN `MaterialCommunityIcons.shield-half-full` → SF Symbol `shield.lefthalf.filled`
- RN `MaterialCommunityIcons.file-document-outline` → SF Symbol `doc.text`
- RN `MaterialCommunityIcons.logout` → SF Symbol `rectangle.portrait.and.arrow.right`
- RN `MaterialCommunityIcons.alert-octagon-outline` → SF Symbol `exclamationmark.octagon`
- RN `MaterialCommunityIcons.crown` → SF Symbol `crown.fill`
- RN `MaterialCommunityIcons.gift` → SF Symbol `gift.fill`
- RN `MaterialCommunityIcons.star-four-points` → SF Symbol `sparkle`
- RN `MaterialCommunityIcons.chevron-left` → SF Symbol `chevron.left`
- RN `MaterialCommunityIcons.chevron-right` → SF Symbol `chevron.right`
- RN `MaterialCommunityIcons.close` → SF Symbol `xmark`
- RN `MaterialCommunityIcons.message-flash-outline` → SF Symbol `message.fill`

**Edge cases preserved from RN:**
- Pro hero card has 3 states: loading ("CHECKING PLAN" / "VERIFYING ACCESS"), pro ("PRO MEMBER" / "YOU ARE PRO"), non-pro ("SPECIAL OFFER" / "GO PRO TODAY")
- Discord banner is a separate full-width gradient `Button` between Preferences and Community sections (preserve, even though Discord row also exists in Community section)
- Version label moves into "Preferences" section on iOS (since iOS Widget row replaces it) and into "Legal & Policies" section on Android
- "Manage Subscription" subtitle changes based on pro state and `subscriptionType` (e.g. "Active monthly membership" / "View plans, billing, and upgrade options")
- Push token registration happens via `NotificationsStore.registerPushToken(user.id)` on permission grant, and `deactivatePushTokens(user.id)` on toggle off — preserve the soft-deactivate pattern (don't delete tokens)
- Spirite picker presented as a `.sheet` with `.presentationDetents([.medium])` from a bottom sheet (rather than a push) — preserve modal pattern from RN

---

### 8. `MlbBettingTrendsView` — situational ATS / O/U / ML trends per MLB game

> **SUPERSEDED 2026-06-11:** this standalone list screen was retired — the dataset now
> renders as `BettingTrendsInsightWidget` on the MLB game detail sheet (expanding to the
> shared `BettingTrendsDetailSheet`) and as Search insight chips. Spec kept for RN mapping.

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/mlb-betting-trends.tsx`
**Container:** `NavigationStack` → `ScrollView` (or `List`) of `MLBBettingTrendsMatchupCardView`s with a sticky animated header (collapses on scroll). `ToolExplainerBannerView` + `Picker(.segmented)` sort pills (`Time / O/U / ML`) anchored at top of list. `List` style: plain.
**Navigation chrome:** Animated blurred header (`.background(.ultraThinMaterial)`) with leading `arrow.left` (back), trailing `arrow.clockwise` (refresh, replaced with `ProgressView` when loading). Inline; tab hidden via `.toolbar(.hidden, for: .tabBar)`.

**Native primitives:**
- `List(games) { game in MLBBettingTrendsMatchupCardView(game: game) }` with `.listStyle(.plain).listRowSeparator(.hidden)` — replaces `Animated.FlatList`
- `.refreshable { await store.refetch() }` — replaces explicit refresh button (keep button for explicit refresh too)
- `Picker(.segmented)` for sort mode (`.time / .ouConsensus / .mlDominance`) — replaces `sortPills` `TouchableOpacity` row
- `ToolExplainerBannerView` (reusable) — shown as `List` header section
- `.contextMenu` per matchup card: "Open game sheet", "Filter by team"
- `ContentUnavailableView` empty state — replaces `NoGamesTerminalView` (or preserve custom view)
- `.sensoryFeedback(.selection, trigger: sortMode)`
- `.task { await store.maybePresentPaywall() }` for non-pro users — auto-presents paywall on appear

**Stores read:**
- `MLBBettingTrendsStore.games / isLoading / error / sortMode / refetch() / setSortMode(_:)` — replaces `useMLBBettingTrends`
- `ProAccessStore.isPro` — gates paywall
- `RevenueCatStore.refreshCustomerInfo()` — post-paywall sync
- `MLBBettingTrendsSheetStore.openTrendsSheet(game)` — open detail sheet on card tap

**Gesture choreography:**
- Tap matchup card → `MLBBettingTrendsSheetStore.openTrendsSheet(game)`
- Tap sort pill → `setSortMode(_:)`, `.sensoryFeedback(.selection)`
- Tap refresh button → `await refetch()`, with `arrow.clockwise` `.symbolEffect(.rotate)` rotation
- Pull-to-refresh → `refetch()`

**Animations:**
- Sort change reorders cards: `.animation(.spring(response: 0.5), value: sortMode)` with `.transition(.slide.combined(with: .opacity))`
- Header collapse on scroll: native `.scrollEdgeEffectStyle(.soft, for: .top)` (iOS 26) or manual `.opacity` + `.offset` driven by `GeometryReader`
- Refresh button rotation: `.symbolEffect(.rotate, options: .speed(1.5), value: isLoading)`

**Haptics:**
- Sort change: `.sensoryFeedback(.selection)`
- Back/refresh tap: `.sensoryFeedback(.impact(weight: .light))`
- Pull-to-refresh end: `.sensoryFeedback(.impact(weight: .medium))`
- Card tap: `.sensoryFeedback(.impact(weight: .light))`

**Loading state:** 4 `BettingTrendsMatchupCardShimmerView`s in a `LazyVStack` with `.redacted(reason: .placeholder).shimmering()`.
**Empty state:** `NoGamesTerminalView(context: .feedMlb)` or `ContentUnavailableView("No MLB games today", systemImage: "baseball")`.
**Error state:** `ContentUnavailableView("Couldn't load MLB trends", systemImage: "exclamationmark.triangle", description: Text(error))` + retry button.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.arrow-left` → SF Symbol `arrow.left`
- RN `MaterialCommunityIcons.refresh` → SF Symbol `arrow.clockwise`
- RN `MaterialCommunityIcons.clock-outline` → SF Symbol `clock`
- RN `MaterialCommunityIcons.trending-up` → SF Symbol `chart.line.uptrend.xyaxis`
- RN `MaterialCommunityIcons.chart-line` → SF Symbol `chart.xyaxis.line`
- RN `MaterialCommunityIcons.baseball` → SF Symbol `baseball.fill`
- RN `MaterialCommunityIcons.alert-circle` → SF Symbol `exclamationmark.circle.fill`

**Edge cases preserved from RN:**
- Auto-presents RevenueCat paywall on appear for non-pro users (with `PAYWALL_PLACEMENTS.GENERIC_FEATURE` placement)
- Sort modes specific to MLB: `time`, `ou-consensus`, `ml-dominance` (no `ats-dominance` — MLB uses moneyline as primary)
- Refresh button is disabled (rendered with `ProgressView`) while `isLoading == true`
- Cards use `gamePk` as identity (MLB-specific game ID)

---

### 9. `MlbRegressionReportView` — daily MLB pitcher/batting/bullpen regression report with sticky section headers

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/mlb-regression-report.tsx` (1897 lines)
**Container:** `NavigationStack` → fixed top nav (blurred, `.background(.ultraThinMaterial)`) + a `ScrollView` with `LazyVStack(pinnedViews: [.sectionHeaders])` below. Sections are dynamically pushed depending on which data the report contains. Sticky headers pin to the bottom of the nav bar (not under the status bar).
**Navigation chrome:** Custom nav: leading `chevron.left` (back), center stack with title "MLB Regression Report" + subtitle "Updated 5m ago" (relative time), trailing `arrow.clockwise` (refresh). Tab hidden.

**Native primitives:**
- `ScrollView` + `LazyVStack(pinnedViews: [.sectionHeaders])` — replaces `Animated.ScrollView` with `stickyHeaderIndices`
- Per section: `Section { ... } header: { SectionHeaderView(icon:, iconColor:, title:, rightSlot:) }` with `.background(theme.background)` on header so it covers scrolling content when pinned
- Sections (rendered in this order if data present):
  1. AI Analysis Summary (`bolt.fill`, purple) — `narrative_text` rendered with `Text(.init(...))` for markdown
  2. Yesterday's Results (`trophy.fill`, yellow) — recap with W-L-Push + cumulative record
  3. Model Accuracy (`chart.bar.fill`, blue) — `MLBBucketAccuracy` pills
  4. Today's Suggested Picks (`target`, green) — `AccentBarRowView`-style picks with severity colors
  5. Starting Pitcher Regression (`flame.fill`, orange) — negative + positive regression lists
  6. Team Batting Regression (`chart.line.uptrend.xyaxis`, blue) — heat-up + cool-down
  7. Bullpen Fatigue & Trends (`shield`, purple)
  8. L/R Pitcher Splits (`scope`, indigo)
  9. Perfect Storm Matchups (`cloud.bolt.fill`, yellow)
  10. Weather & Park Impact (`wind`, cyan) — uses `weatherIconForFlags` mapper
- `AccentBarRowView` — VStack with colored left edge bar + soft-fill content area (preserve from RN)
- `Markdown` rendering via `Text(.init(narrativeText))` for basic markdown (or use `swift-markdown-ui` SwiftPM dep for richer rendering)
- `.contextMenu` per pick row: "Open game sheet" → `MLBGameSheetStore.openGameSheet(gameId)`, "Copy"
- `.refreshable { await store.refetch() }`
- `.sensoryFeedback(.impact(weight: .light), trigger: store.refreshing)`

**Stores read:**
- `MLBRegressionReportStore.data / isLoading / error / refetch()` — replaces `useMLBRegressionReport`
- `MLBBucketAccuracyStore.data` — replaces `useMLBBucketAccuracy` (used inside Model Accuracy section)
- `ProAccessStore.isPro` + auto-paywall pattern (same as section 8)

**Gesture choreography:**
- Tap back → `dismiss()`
- Tap refresh → `await refetch()`
- Tap a suggested pick → open MLB game sheet for that game
- Tap a regression row → expand/collapse details (`.contextMenu` for now, or inline `DisclosureGroup`)
- Pull-to-refresh → reload

**Animations:**
- Sticky header pins flush with nav bottom edge — native list behavior
- New section appears: `.transition(.opacity)` on conditional rendering
- Refresh button rotation as above
- "Updated 5m ago" relative time auto-updates via `.timer(every: 60, on: .main)` Combine pipeline

**Haptics:**
- Refresh: `.sensoryFeedback(.impact(weight: .light))`
- Back: `.sensoryFeedback(.impact(weight: .light))`
- Pick tap: `.sensoryFeedback(.impact(weight: .light))`

**Loading state:** Centered `ProgressView()` with "Loading report…" label.
**Empty state:** `Label("No regression report available yet. Reports generate at 9 AM, 11 AM, and 4 PM ET.", systemImage: "info.circle")`.
**Error state:** `Label("Failed to load regression report.", systemImage: "exclamationmark.circle.fill")` in red.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.lightning-bolt` → SF Symbol `bolt.fill`
- RN `MaterialCommunityIcons.trophy` → SF Symbol `trophy.fill`
- RN `MaterialCommunityIcons.chart-bar` → SF Symbol `chart.bar.fill`
- RN `MaterialCommunityIcons.target` → SF Symbol `target`
- RN `MaterialCommunityIcons.fire` → SF Symbol `flame.fill`
- RN `MaterialCommunityIcons.trending-up` → SF Symbol `chart.line.uptrend.xyaxis`
- RN `MaterialCommunityIcons.shield-outline` → SF Symbol `shield`
- RN `MaterialCommunityIcons.target-variant` → SF Symbol `scope`
- RN `MaterialCommunityIcons.weather-lightning` → SF Symbol `cloud.bolt.fill`
- RN `MaterialCommunityIcons.weather-windy` → SF Symbol `wind`
- RN `MaterialCommunityIcons.weather-pouring` → SF Symbol `cloud.rain.fill`
- RN `MaterialCommunityIcons.weather-windy-variant` → SF Symbol `wind.snow`
- RN `MaterialCommunityIcons.snowflake` → SF Symbol `snowflake`
- RN `MaterialCommunityIcons.white-balance-sunny` → SF Symbol `sun.max.fill`
- RN `MaterialCommunityIcons.home-roof` → SF Symbol `house.fill`
- RN `MaterialCommunityIcons.water-percent` → SF Symbol `humidity.fill`
- RN `MaterialCommunityIcons.weather-partly-cloudy` → SF Symbol `cloud.sun.fill`
- RN `MaterialCommunityIcons.chevron-left` → SF Symbol `chevron.left`
- RN `MaterialCommunityIcons.refresh` → SF Symbol `arrow.clockwise`
- RN `MaterialCommunityIcons.information-outline` → SF Symbol `info.circle`
- RN `MaterialCommunityIcons.alert-circle` → SF Symbol `exclamationmark.circle.fill`

**Edge cases preserved from RN:**
- Section visibility is conditional on data presence (e.g. skip "Bullpen Fatigue" entirely if `bullpen_fatigue` empty)
- Severity color thresholds: `severe → red`, `moderate → amber`, otherwise green
- `winPctColor`: `≥65 → green`, `≥55 → yellow`, `≥50 → orange`, `<50 → red`
- "Updated Xm ago" timer-driven relative time
- Markdown narrative supports basic formatting (bold, italics, lists)
- Pitcher regression has both negative + positive sub-lists in the same section
- Report date displayed in uppercase format: "TUESDAY, MAY 20, 2026"

---

### 10. `NbaBettingTrendsView` — situational ATS / O/U trends per NBA game

> **SUPERSEDED 2026-06-11:** retired with the insight-widget refactor — see section 8's note;
> NBA renders `BettingTrendsInsightWidget` on the NBA game detail sheet.

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/nba-betting-trends.tsx`
**Container:** Same layout as MLB Betting Trends (`NavigationStack` → animated header → `Picker(.segmented)` sort + `ToolExplainerBannerView` → `List` of `BettingTrendsMatchupCardView`s).
**Navigation chrome:** Animated blurred header, leading back, trailing refresh. Tab hidden.

**Native primitives:**
- `List(games) { game in BettingTrendsMatchupCardView(game: game) }` with `.listStyle(.plain)`
- `Picker(.segmented)` sort modes: `.time / .ouConsensus / .atsDominance` (NBA-specific — uses ATS not ML)
- `ToolExplainerBannerView` as list header
- `.refreshable`
- `.contextMenu` per card

**Stores read:**
- `NBABettingTrendsStore.games / isLoading / error / sortMode / refetch() / setSortMode(_:)` — replaces `useNBABettingTrends`
- `NBABettingTrendsSheetStore.openTrendsSheet(game)` — opens trends detail sheet on tap
- `ProAccessStore.isPro` + auto-paywall

**Gesture choreography:**
- Tap card → `NBABettingTrendsSheetStore.openTrendsSheet(game)`
- Tap sort pill → `setSortMode(_:)`
- Pull-to-refresh → `refetch()`

**Animations:**
- Sort reorder: `.spring(response: 0.5)`
- Header collapse on scroll
- Refresh rotation

**Haptics:** Same as section 8 (selection on sort, impact light on tap/back/refresh, medium on refresh end).

**Loading state:** 4 `BettingTrendsMatchupCardShimmerView`s.
**Empty state:** `NoGamesTerminalView(context: .nbaTrends)`.
**Error state:** Inline retry banner.

**SF Symbol swaps:** Same as MLB Betting Trends (section 8) but with `chart.line.uptrend.xyaxis` for ATS pill icon.

**Edge cases preserved from RN:**
- Sort modes for NBA: `time`, `ou-consensus`, `ats-dominance` (no `ml-dominance` — basketball heavily favored favorites)
- Auto-paywall on appear
- Refresh disabled during load

---

### 11. `NbaModelAccuracyView` — historical accuracy of NBA model predictions by bucket

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/nba-model-accuracy.tsx`
**Container:** Same shape as Betting Trends (`NavigationStack` → blurred header → sort `Picker(.segmented)` → `List` of `NBAModelAccuracyMatchupCardView`s).
**Navigation chrome:** Animated blurred header (leading back, trailing refresh). Tab hidden.

**Native primitives:**
- `List` of `NBAModelAccuracyMatchupCardView`s
- `Picker(.segmented)` sort modes: `.time / .spread / .moneyline / .ou` (4 modes, vs 3 for trends)
- `ToolExplainerBannerView` (different copy: "Know when the model is dialed in")
- `.refreshable`
- `.contextMenu`

**Stores read:**
- `NBAModelAccuracyStore.games / isLoading / error / sortMode / refetch() / setSortMode(_:)` — replaces `useNBAModelAccuracy`
- `NBAGameSheetStore.openGameSheet(game)` — full game sheet (not trends sheet) on tap

**Gesture choreography:**
- Tap card → `NBAGameSheetStore.openGameSheet(game)` (different from trends — opens main game sheet)
- Sort, refresh, pull-to-refresh — same as Betting Trends

**Animations / Haptics / States:** Same patterns as section 10.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.clock-outline` → SF Symbol `clock`
- RN `MaterialCommunityIcons.target` → SF Symbol `target`
- RN `MaterialCommunityIcons.chart-bar` → SF Symbol `chart.bar.fill`
- RN `MaterialCommunityIcons.swap-vertical` → SF Symbol `arrow.up.arrow.down`
- Same set as MLB/NBA Betting Trends

**Edge cases preserved from RN:**
- 4 sort modes (Time / Spread / ML / O/U) — NBA accuracy reports all three markets
- Card uses `lookupNBAFullGame` lookup to open full sheet (slower; show `loadingGameId` spinner)

---

### 12. `NcaabBettingTrendsView` — situational trends per NCAAB game

> **SUPERSEDED 2026-06-11:** retired with the insight-widget refactor — see section 8's note;
> NCAAB renders `BettingTrendsInsightWidget` on the NCAAB game detail sheet.

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/ncaab-betting-trends.tsx`
**Container:** Identical to `NbaBettingTrendsView` shape. List of `NCAABBettingTrendsMatchupCardView`s.

**Native primitives:** Same as section 10 (Picker.segmented sort, ToolExplainerBanner, List, refreshable, contextMenu, NoGamesTerminal empty state).

**Stores read:**
- `NCAABBettingTrendsStore.games / isLoading / error / sortMode / refetch() / setSortMode(_:)` — replaces `useNCAABBettingTrends`
- `NCAABBettingTrendsSheetStore.openTrendsSheet(game)`
- `ProAccessStore.isPro` + auto-paywall

**Gesture choreography / Animations / Haptics / States:** Same as section 10.

**SF Symbol swaps:** Same as section 10.

**Edge cases preserved from RN:**
- Higher thresholds for trend detection (`BETTING_TRENDS_THRESHOLD = 65`, min 5 games — same as NBA)
- Sort: `time / ou-consensus / ats-dominance`
- NCAAB cards include team logos (`awayTeamLogo` / `homeTeamLogo`) — pass through to component

---

### 13. `NcaabModelAccuracyView` — historical accuracy of NCAAB model predictions

**RN source:** `wagerproof-mobile/app/(drawer)/(tabs)/ncaab-model-accuracy.tsx`
**Container:** Identical to `NbaModelAccuracyView` shape. List of `NCAABModelAccuracyMatchupCardView`s.

**Native primitives:** Same as section 11.

**Stores read:**
- `NCAABModelAccuracyStore.games / isLoading / error / sortMode / refetch() / setSortMode(_:)` — replaces `useNCAABModelAccuracy`
- `NCAABGameSheetStore.openGameSheet(game)` — full sheet on tap

**Gesture choreography / Animations / Haptics / States:** Same as section 11.

**SF Symbol swaps:** Same as section 11.

**Edge cases preserved from RN:**
- 3 sort modes only (`time / spread / ou` — NO ML because NCAAB ML heavily skewed toward favorites)
- Stricter thresholds: `NCAAB_ACCURACY_HIGH_THRESHOLD = 70`, `LOW_THRESHOLD = 30`, `MIN_GAMES = 10`
- Card uses `lookupNCAABFullGame` lookup (async — show loading state)

---

### 14. `EditorPicksStatsView` — editor pick performance dashboard with charts

**RN source:** `wagerproof-mobile/app/(drawer)/editor-picks-stats.tsx`
**Container:** `NavigationStack` → `ScrollView` of: editor profile card (gradient LinearGradient + avatar) → transparency message card → 2-column overall stats row (Record + Net Units) → horizontal date-filter `Picker(.segmented)` row → optional Best Run gradient card → main cumulative chart (Swift Charts) → per-sport mini charts (5 sport cards: NBA, NCAAB, NFL, CFB).
**Navigation chrome:** Custom inline header with leading `chevron.left` (back) + centered title "Editor Picks Stats" + trailing 40pt spacer. Tab hidden.

**Native primitives:**
- `ScrollView` + `VStack(spacing: 16)`
- `LinearGradient` editor profile card with team gradient
- `Picker(.segmented)` with 5 date filter options (`Best Run / 7 Days / 30 Days / 90 Days / All Time`) — replaces horizontal scroll of pills
- `Chart { LineMark(...) }` from `Charts` framework — replaces `victory-native CartesianChart`/`Line`/`Rect`
  - Main chart: line interpolation `.monotone`; foregroundStyle green if `netUnits >= 0`, else red
  - Best run highlight: `RectangleMark(xStart: ..., xEnd: ..., yStart: chartBounds.top, yEnd: chartBounds.bottom)` with `.foregroundStyle(Color.green.opacity(0.15))`
  - Mini charts: same Chart pattern at smaller frame
- `.refreshable { await store.refetch() }`
- `.contextMenu` per sport chart card: "View picks for \(sport)", "Share chart"
- `Label("Full Transparency", systemImage: "checkmark.shield.fill")`

**Stores read:**
- `EditorPicksStore.allPicks / loading / refetch()` — wraps Supabase query on `editors_picks` table where `is_published=true`
- `UnitsCalculation.calculateUnits(result:, bestPrice:, units:)` — shared util (from `wagerproof-mobile/utils/unitsCalculation.ts`)
- `EditorPicksStore.calculateBestRun(picks:)` — derived: finds min-to-max cumulative units window

**Gesture choreography:**
- Tap date filter pill → `setDateFilter(.bestRun / .last7d / etc.)`, `.sensoryFeedback(.selection)`, chart re-renders
- Tap sport chart card → push a future `EditorPicksHistoryView(sport:)` (deferred — RN doesn't have this)
- Pull-to-refresh → `refetch()`

**Animations:**
- Filter change → chart smooth re-animate via `.animation(.spring(response: 0.5), value: chartData)`
- Best run highlight rect fades in: `.transition(.opacity)`
- Net units number: `.contentTransition(.numericText())`

**Haptics:**
- Date filter change: `.sensoryFeedback(.selection)`
- Best run reveal: `.sensoryFeedback(.success, trigger: bestRun != nil)`
- Pull-to-refresh end: `.sensoryFeedback(.impact(weight: .medium))`

**Loading state:** Whole screen shows centered `ProgressView()` while `loading == true`.
**Empty state:** If `allPicks.isEmpty` → `ContentUnavailableView("No published picks yet", systemImage: "chart.line.uptrend.xyaxis")`.
**Error state:** Inline error banner; no retry on initial fail (RN catches and console.errors only).

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.shield-check` → SF Symbol `checkmark.shield.fill`
- RN `MaterialCommunityIcons.chart-timeline-variant-shimmer` → SF Symbol `chart.line.uptrend.xyaxis`
- RN `MaterialCommunityIcons.fire` → SF Symbol `flame.fill`
- RN `MaterialCommunityIcons.chart-line` → SF Symbol `chart.xyaxis.line`
- RN `MaterialCommunityIcons.calendar-week` → SF Symbol `calendar`
- RN `MaterialCommunityIcons.calendar-month` → SF Symbol `calendar`
- RN `MaterialCommunityIcons.calendar-range` → SF Symbol `calendar.day.timeline.left`
- RN `MaterialCommunityIcons.calendar-star` → SF Symbol `star.circle`
- RN `MaterialCommunityIcons.chevron-left` → SF Symbol `chevron.left`

**Edge cases preserved from RN:**
- Default filter on load: `best_run` (not "all time")
- Best run window: linear scan finds lowest cumulative units, then highest after that point — preserve exact algorithm from RN lines 86–150
- `calculateUnits` follows Formula B (matches `recalculate_avatar_performance` SQL function in main Supabase)
- Per-sport stats compute on filtered subset (`get_filtered_picks` memo)
- Chart "Now" / "Start" x-axis labels (`formatXLabel` callback for first/last only)
- Y-axis label format: `+1.5` / `-2.0` (sign prefix)

---

### 15. `WagerbotChatView` — full-screen WagerBot AI chat with thread history and pro gate

**RN source:** `wagerproof-mobile/app/(drawer)/wagerbot-chat.tsx` (5-line re-export of `components/WagerBotChatScreen.tsx` 248 lines)
**Container:** Full-screen `ZStack` with black background. Top: absolute-positioned blurred + gradient header. Body: `WagerBotChatView` (full chat surface with messages + input bar). Locked state for non-pro: centered `Button` card with crown badge and "Unlock with Pro" CTA.
**Navigation chrome:** Custom absolute-positioned header with 3 dark-glass capsule buttons: leading `arrow.left` (back), centered title block "WagerBot" + subtitle "AI-powered analysis", trailing pair (`clock.arrow.circlepath` history drawer, `square.and.pencil` new chat). Background: `BlurView` + `LinearGradient` from black-to-transparent. Tab hidden.

**Native primitives:**
- `ZStack(alignment: .top)` with black `Color.black` background
- Header: capsule buttons (`Circle().fill(Color.black.opacity(0.46))` with `.overlay(Circle().stroke(Color.white.opacity(0.2)))`)
- Body: `WagerBotChatView` — port `WagerBotChat.tsx` separately (deferred — full component spec out of batch scope)
- `.fullScreenCover(isPresented: ...)` for locked-state paywall presentation (uses RevenueCat)
- Locked state: `Button { handleUnlockPress() }` with crown badge, robot symbol, lock symbol, title "WagerBot Pro", subtitle, "Unlock with Pro" gold button
- `.scrollDismissesKeyboard(.interactively)` inside chat
- `@FocusState` on chat input

**Stores read:**
- `AuthStore.user / userEmail` — required to mount chat
- `ProAccessStore.isPro / isLoading` — gates the chat UI
- `WagerBotChatStore` — owns messages, threads, streaming state (see deferred spec)
- `WagerBotSuggestionStore.setChatPageOpen(true / false)` — lifecycle hook (set true on appear, false on disappear)
- `RevenueCatStore.refreshCustomerInfo()` — post-paywall

**Gesture choreography:**
- Tap back → `dismiss()`
- Tap history button → `chatRef.toggleHistoryDrawer()` (slides in a `NavigationLink`-pushed `ChatThreadListView` or in-place drawer)
- Tap new-chat button → `chatRef.handleNewChat()` (clears thread, focuses input)
- Tap "Unlock with Pro" → `paywallStore.present(.genericFeature)`; on success → `refreshCustomerInfo()`

**Animations:**
- Header gradient: static (no animation needed)
- Locked-state card press: `.scaleEffect(0.97)` on tap
- New thread creation: chat list reset with `.transition(.opacity)`
- Streaming text: appended to last message bubble, no transition

**Haptics:**
- Back: `.sensoryFeedback(.impact(weight: .light))`
- New chat: `.sensoryFeedback(.impact(weight: .light))`
- History drawer open: `.sensoryFeedback(.impact(weight: .light))`
- Unlock tap: `.sensoryFeedback(.impact(weight: .medium))`
- Purchase success: `.sensoryFeedback(.success)`

**Loading state:** If `user == nil`: centered `ProgressView()` + "Loading…".
**Empty state:** When pro-gated chat opens with no messages — handled inside `WagerBotChatView` (deferred).
**Error state:** Network errors during stream show inline "(network error — retry)" footer on last message (deferred to chat component spec).

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.arrow-left` → SF Symbol `arrow.left`
- RN `MaterialCommunityIcons.history` → SF Symbol `clock.arrow.circlepath`
- RN `MaterialCommunityIcons.message-plus-outline` → SF Symbol `square.and.pencil`
- RN `MaterialCommunityIcons.crown` → SF Symbol `crown.fill`
- RN `MaterialCommunityIcons.robot` → SF Symbol `app.connected.to.app.below.fill`
- RN `MaterialCommunityIcons.lock` → SF Symbol `lock.fill`

**Edge cases preserved from RN:**
- Sets `WagerBotSuggestionStore.chatPageOpen = true` on mount, false on unmount — prevents floating WagerBot from suggesting when user is already in chat
- Header always rendered (even on locked screen) — leading back button works regardless of pro state
- Pro check uses both `isPro` and `isProLoading` — show chat during load to avoid flicker (allow rendering while loading)
- Unlock CTA presents `PAYWALL_PLACEMENTS.GENERIC_FEATURE`
- Header has gradient overlay (`['rgba(8,8,8,0.74)', 'rgba(8,8,8,0.46)', 'rgba(8,8,8,0.18)', 'rgba(8,8,8,0)']` top-to-bottom) — preserve in Swift via `LinearGradient(gradient: Gradient(stops: [...]))`

---

### 16. `WagerbotVoiceView` — phone-call-style voice chat with WagerBot

**RN source:** `wagerproof-mobile/app/(drawer)/wagerbot-voice.tsx` (5-line re-export of `WagerBotVoiceChatScreen` from `app/(drawer)/(tabs)/voice-chat.tsx`)
**Container:** Full-screen `LinearGradient` background (`#0a0a0a → #0d1117 → #0a0a0a`). `VStack`: custom header (back / duration / cog) → status pills row (status / spicy / DB prompt / audio route) → "WagerBot" title + voice name label → optional "Loading game data..." → centered orb with Lottie character → optional error card → bottom controls (Hold-to-Talk + Reconnect + Hang Up row).
**Navigation chrome:** Custom header (3 buttons: leading `arrow.left` back, center duration text MM:SS, trailing `gearshape` settings). Tab hidden.

**Native primitives:**
- `LinearGradient` full-screen background
- Status pills: horizontal `HStack` with `.flexible` wrap or `FlowLayout` (iOS 16+ `Layout` protocol)
- Each pill: `Capsule().fill(color.opacity(0.12)).overlay(Capsule().stroke(color.opacity(0.3)))` with Label inside
- Center orb: `ZStack` with `Circle().scale(pulseAnim)` containing clipped `LottieView` (180×180 clipped to circle)
- Orb border animation: `Circle().stroke(animatedBorderColor, lineWidth: animatedBorderWidth)` driven by `Animation.easeInOut(duration: 0.9).repeatForever(autoreverses: true)` when `isActive`
- Hold-to-talk button: `Button` with `.simultaneousGesture(LongPressGesture(minimumDuration: 0))` capturing `onChanged` (press in) / `onEnded` (release) — replaces `onPressIn` / `onPressOut`
- Bottom row: `HStack` of `Reconnect` (`arrow.clockwise`) and `Hang Up` (`phone.down.fill`) capsule buttons
- `.sheet` for `VoiceSettingsSheetView` — replaces `<VoiceSettingsSheet visible={...}>` (custom modal)
- `.confirmationDialog` for "Reconnect needed" error → tap reconnect
- `.alert` for audio-route debug message (iOS only)
- `LottieView(animation: getLottieSource(selectedVoice))` from `lottie-ios` package

**Stores read:**
- `WagerBotVoiceStore` (replaces `useWagerBotVoice`) with state fields: `isConnecting / isConnected / isListening / isWaitingForResponse / isSpeaking / selectedVoice / selectedPersonality / forceSpeakerEnabled / lastError / connectedAt / promptSource / promptText / audioRouteInfo`
- Actions: `connect() / startTalking() / stopTalking() / hangUp() / changeVoice(_:) / changePersonality(_:) / changeForceSpeaker(_:) / refreshAudioRouteInfo() → AudioRouteDebugInfo`
- `GameDataService.fetchAndFormatGameContext()` → `String` — preloaded on appear
- `ProAccessStore.isPro / isLoading` — gates the voice UI
- `AudioRouteModule` (native module already in Swift) — bridges iOS `AVAudioSession`
- `RevenueCatStore.refreshCustomerInfo()`

**Gesture choreography:**
- Tap back → `dismiss()`
- Tap cog → present `VoiceSettingsSheetView` as `.sheet`
- Press + hold mic button → `startTalking()` (immediate haptic), continue holding while user speaks
- Release mic button → `stopTalking()` (submit transcript)
- Tap reconnect button → `connect()`
- Tap hang up → `hangUp()`
- Tap status pill (DB prompt) → `.alert` showing full prompt text
- Tap status pill (Audio Route) → `.alert` with full debug info (iOS only)

**Animations:**
- Orb pulse: `withAnimation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true)) { pulseScale = 1.06 }` when `isActive` (listening / speaking / waiting)
- Orb border glow: animated between `Color.white.opacity(0.15)` and `accentColor` over 0.9 s
- Orb shadow: animated `shadowOpacity` 0 → 0.4 over 0.9 s
- Status dot color: animated cross-fade based on state
- Lottie loops always (regardless of orb pulse)
- Duration timer: 1 Hz update via `.timer(every: 1.0)` driving `durationText`
- Mic button background: cross-fade between accent + accent.opacity(0.85) on listening

**Haptics:**
- Press mic (start talking): `.sensoryFeedback(.impact(weight: .heavy), trigger: isListening)`
- Release mic (stop talking): `.sensoryFeedback(.impact(weight: .light))`
- Connect success: `.sensoryFeedback(.impact(weight: .medium))`
- Hang up: `.sensoryFeedback(.warning)`
- Reconnect: `.sensoryFeedback(.impact(weight: .light))`
- Error: `.sensoryFeedback(.error, trigger: lastError != nil)`

**Loading state:** "Loading game data..." centered label while `isLoadingContext`. "Connecting..." status pill while `isConnecting`.
**Empty state:** n/a — full UI always renders.
**Error state:** "Reconnect needed" status pill + red error card under orb with `exclamationmark.circle` + error text.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.arrow-left` → SF Symbol `arrow.left`
- RN `MaterialCommunityIcons.cog-outline` → SF Symbol `gearshape`
- RN `MaterialCommunityIcons.fire` → SF Symbol `flame.fill`
- RN `MaterialCommunityIcons.database-check` → SF Symbol `cylinder.split.1x2.fill`
- RN `MaterialCommunityIcons.database-off` → SF Symbol `cylinder.split.1x2` (or `xmark.cylinder`)
- RN `MaterialCommunityIcons.volume-high` → SF Symbol `speaker.wave.3.fill`
- RN `MaterialCommunityIcons.ear-hearing` → SF Symbol `ear.fill`
- RN `MaterialCommunityIcons.microphone` → SF Symbol `mic.fill`
- RN `MaterialCommunityIcons.gesture-tap-hold` → SF Symbol `hand.tap.fill`
- RN `MaterialCommunityIcons.refresh` → SF Symbol `arrow.clockwise`
- RN `MaterialCommunityIcons.phone-hangup` → SF Symbol `phone.down.fill`
- RN `MaterialCommunityIcons.alert-circle-outline` → SF Symbol `exclamationmark.circle`
- RN `MaterialCommunityIcons.lock` → SF Symbol `lock.fill`

**Edge cases preserved from RN:**
- Voice → Lottie character map: `marin → VoiceMonster_Marin.json` (Donna), `cedar → VoiceMonster_Cedar.json` (Kevin), `ash → VoiceMonster_Ash.json` (Jordan); other voices fall back to `ChattingRobot.json`
- Spicy personality uses red `#ef4444` accent everywhere (orb glow, pills, mic button); friendly uses green `#22c55e`
- Force-speaker toggle (iOS only) — passes through to native `AudioRouteModule.setSpeakerLockEnabled(_:)`
- Audio route status pill (iOS only) — taps reveal full `AudioRouteDebugInfo` (mode, category, outputs, inputs)
- Pro gate: shows lock screen if `!isProLoading && !isPro` with "Unlock with Pro" CTA
- Duration timer increments only while `connectedAt != nil` (clears on hang-up)
- "Loading game data..." text appears centered under voice label while `isLoadingContext`
- Status pill tap on `promptSource` shows DB vs fallback prompt text in `.alert`
- Mic button disabled (`holdDisabled`) when `!isConnected || isConnecting`; shows "Connecting..." label
- Voice display name override map: marin → "Donna", cedar → "Kevin", ash → "Jordan"

---

### 17. `DeleteAccountView` — swipe-to-delete account modal with warning

**RN source:** `wagerproof-mobile/app/(modals)/delete-account.tsx`
**Container:** `.sheet` (presented from Settings) with `presentationDetents([.large])` and `.presentationDragIndicator(.visible)`. `ZStack` background: red-tinted `LinearGradient` header → `VStack` with icon → title → description → red warning box → spacer → `SwipeToDeleteSliderView` at bottom.
**Navigation chrome:** Custom header with leading `xmark` close button → `dismiss()`, centered "Danger Zone" title (in red), trailing 28pt spacer.

**Native primitives:**
- `LinearGradient(colors: [Color.red.opacity(0.15), .clear], startPoint: .top, endPoint: .bottom)` header
- `Circle().fill(Color.red.opacity(0.20))` icon background with `exclamationmark.circle.fill` symbol (56pt, red)
- `SwipeToDeleteSliderView` — preserve from RN (custom horizontal slider that triggers callback when slid fully right; uses `DragGesture` + `withAnimation`)
- `.confirmationDialog("Delete Account", isPresented: $showConfirmAlert)` with destructive "Delete Account" + cancel actions
- `.sheet` for the modal — `presentationDetents([.large])`, `.presentationDragIndicator(.visible)`
- Loading state: replace slider with `ProgressView()` + "Deleting account..." label

**Stores read:**
- `AuthStore.deleteAccount() / deletingAccount / signingOut` — replaces `useAuth`

**Gesture choreography:**
- Tap close (`xmark`) → `dismiss()`
- Swipe slider to right → trigger confirmation dialog
- Dialog "Delete Account" (destructive) → `await deleteAccount()`; on error → reset slider via `sliderKey += 1`; on success → user is auto-signed-out (handled by `AuthStore`)
- Dialog "Cancel" → reset slider key

**Animations:**
- Slider drag: rubber-band feel via `.gesture(DragGesture())` with `.animation(.spring())` snap-back if not slid >90%
- Success: full slide animates green tick before dismissing
- Loading state replaces slider with spring crossfade

**Haptics:**
- Slide begin: `.sensoryFeedback(.impact(weight: .light))`
- Slide complete (full): `.sensoryFeedback(.warning)`
- Delete confirmed: `.sensoryFeedback(.error)`
- Delete success: `.sensoryFeedback(.success)`

**Loading state:** `ProgressView()` + "Deleting account..." while `deletingAccount == true`.
**Empty state:** n/a.
**Error state:** `.alert("Failed to delete account")` with retry; resets slider.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.close` → SF Symbol `xmark`
- RN `MaterialCommunityIcons.alert-circle` → SF Symbol `exclamationmark.circle.fill`
- RN `MaterialCommunityIcons.information` → SF Symbol `info.circle.fill`

**Edge cases preserved from RN:**
- Slider key (`sliderKey`) increments on cancel/error to force re-render of slider component to its initial position
- Disable slider when `signingOut || deletingAccount`
- On success, `deleteAccount()` triggers sign-out — sheet auto-dismisses when `AuthStore.user → nil`

---

### 18. `DiscordView` — Discord community modal with link-account + invite CTAs (pro-gated)

**RN source:** `wagerproof-mobile/app/(modals)/discord.tsx`
**Container:** `.sheet` with `.presentationDetents([.large])`. Two states based on pro access:
- **Non-pro:** Red-tinted header, Discord logo gradient, locked main card with crown badge + "Unlock with Pro" gold gradient button, feature highlight cards
- **Pro:** Same header, instructions to (1) link account, (2) join Discord; primary CTAs for both actions
**Navigation chrome:** Leading `xmark` close button, centered "Discord" title, trailing 28pt spacer. Header has `LinearGradient(['rgba(34,211,95,0.1)', .clear])` background.

**Native primitives:**
- `.sheet` modal with `presentationDetents([.large])` + `.presentationDragIndicator(.visible)`
- Discord logo: `LinearGradient(colors: [Color(hex: "5865F2"), Color(hex: "7289DA")], startPoint: .topLeading, endPoint: .bottomTrailing)` in a 100pt `Circle` with `message.fill` symbol (60pt, white)
- Locked main card: rounded card with crown pro-badge + green shield icon + "Unlock our private Discord server!" title + description + gold gradient unlock button
- Pro main card: same layout but with "Link Discord Account" `Button(.borderedProminent)` (purple Discord blue) + "Join Discord Server" `Button(.bordered)` (green)
- Feature highlight cards (3): "Active Community", "Push Notifications", "Exclusive Access" — `LazyVGrid(columns: 1)` of `Card`s with green icons
- `Link(destination: URL(string: "https://discord.gg/gwy9y7XSDV")!)` — opens Discord invite
- Custom `handleLinkDiscord` opens `DISCORD_LINK_URL?user_id=<userId>` (Supabase edge function URL for account binding)

**Stores read:**
- `AuthStore.user`
- `ProAccessStore.isPro / isLoading`
- `ProfileStore` — checks `profiles.discord_user_id` to set `discordLinked` state
- `RevenueCatStore.refreshCustomerInfo()`

**Gesture choreography:**
- Tap close → `dismiss()`
- Tap "Unlock with Pro" (non-pro) → `paywallStore.present(.genericFeature)`; on success → `refreshCustomerInfo()`
- Tap "Link Discord Account" (pro) → `openURL("\(DISCORD_LINK_URL)?user_id=\(user.id)")` (opens Safari → Discord OAuth → callback updates `profiles.discord_user_id`)
- Tap "Join Discord Server" (pro) → `openURL("https://discord.gg/gwy9y7XSDV")`

**Animations:**
- Unlock CTA: `.scaleEffect(0.97)` on press
- Status change (linked → unlinked): symbol effect bounce
- Pro state cross-fade: `.transition(.opacity)` between locked / unlocked layouts

**Haptics:**
- Close: `.sensoryFeedback(.impact(weight: .light))`
- Unlock tap: `.sensoryFeedback(.impact(weight: .medium))`
- Link account tap: `.sensoryFeedback(.impact(weight: .light))`
- Join Discord tap: `.sensoryFeedback(.impact(weight: .light))`
- Purchase success: `.sensoryFeedback(.success)`

**Loading state:** `linkLoading == true` → `ProgressView()` replaces the link-status badge. Pro check uses RevenueCat `isLoading`.
**Empty state:** n/a.
**Error state:** Console-log + silent fallback on Discord URL failure.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.close` → SF Symbol `xmark`
- RN `MaterialCommunityIcons.chat` → SF Symbol `message.fill`
- RN `MaterialCommunityIcons.crown` → SF Symbol `crown.fill`
- RN `MaterialCommunityIcons.shield-check` → SF Symbol `checkmark.shield.fill`
- RN `MaterialCommunityIcons.lock-open` → SF Symbol `lock.open.fill`
- RN `MaterialCommunityIcons.account-group` → SF Symbol `person.3.fill`
- RN `MaterialCommunityIcons.bell-ring` → SF Symbol `bell.badge.fill`
- RN `MaterialCommunityIcons.shield-lock` → SF Symbol `lock.shield.fill`

**Edge cases preserved from RN:**
- `discordLinked` query against `profiles` table on mount
- Link URL embeds `user_id` query param for Supabase callback to bind Discord ID
- Discord invite URL is hard-coded: `https://discord.gg/gwy9y7XSDV`
- Pro check uses combined `isLoading || isPro` — render full pro layout during load to avoid flicker
- Account linking happens out-of-band (Safari → Discord OAuth → Supabase edge function callback); modal doesn't track completion live

---

### 19. `IosWidgetView` — iOS Home Screen widget marketing + preview + install instructions

**RN source:** `wagerproof-mobile/app/(modals)/ios-widget.tsx`
**Container:** `.sheet` with `.presentationDetents([.large])`. `ScrollView` of: green-tinted gradient header → intro card (widget icon + title + subtitle) → widget type `Picker(.segmented)` (Picks / Fades / Market) → live widget preview using sample data → numbered step-by-step instructions card → info note.
**Navigation chrome:** Header with leading `xmark` close → `dismiss()`, centered "iOS Widget" title, trailing spacer.

**Native primitives:**
- `ScrollView` + `VStack(spacing: 20)`
- `Picker(.segmented)` with 3 options (Picks / Fades / Market)
- Widget preview: replicates the actual iOS Widget UI (defined separately in `WagerProofWidget` extension target). Use the same rendering primitives:
  - Widget container: `RoundedRectangle(cornerRadius: 24).fill(Color(hex: "0a0a0a"))` with shadow
  - Glass card row: `RoundedRectangle(cornerRadius: 8).fill(Color(hex: "27272a").opacity(0.6))`
  - Sport badge: capsule with NFL/NBA/CFB/NCAAB color
  - Result badge: green WON / red LOST / amber PUSH
  - Sample data: 5 picks / 5 fades / 5 market values (hard-coded)
- Instructions card: `Card` with 5 numbered steps (each a row: `Circle().fill(.green).overlay(Text("\(n)"))` + step text with bold keyword)
- Info note: `Label("The widget updates automatically...", systemImage: "info.circle.fill")` in green
- iPad / non-iOS fallback: `ContentUnavailableView("iOS Widgets are only available on iOS devices", systemImage: "iphone")`

**Stores read:** None — purely informational. Widget data is sourced separately via `WidgetDataBridge` (App Group `UserDefaults`).

**Gesture choreography:**
- Tap close → `dismiss()`
- Tap widget type pill → `setSelectedWidget(.picks / .fades / .market)`, `.sensoryFeedback(.selection)`, preview re-renders

**Animations:**
- Widget preview swap on type change: `.transition(.opacity)` + `.animation(.spring(response: 0.4))`
- Numbered steps: subtle entrance on appear via `.transition(.move(edge: .leading))` if first appearance

**Haptics:**
- Type change: `.sensoryFeedback(.selection)`
- Close: `.sensoryFeedback(.impact(weight: .light))`

**Loading state:** n/a.
**Empty state:** n/a (always renders with sample data).
**Error state:** Non-iOS platforms → `ContentUnavailableView`.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.close` → SF Symbol `xmark`
- RN `MaterialCommunityIcons.widgets` → SF Symbol `square.grid.2x2.fill`
- RN `MaterialCommunityIcons.star` → SF Symbol `star.fill`
- RN `MaterialCommunityIcons.lightning-bolt` → SF Symbol `bolt.fill`
- RN `MaterialCommunityIcons.chart-line` → SF Symbol `chart.xyaxis.line`
- RN `MaterialCommunityIcons.information` → SF Symbol `info.circle.fill`

**Edge cases preserved from RN:**
- iOS-only check; non-iOS platforms show platform-mismatch placeholder
- Sample data is hard-coded for marketing display (does NOT reflect user's actual widget content)
- Fade alerts: NFL uses percentage (`85%`), other sports use point deltas (`12pt`) — preserve the display logic
- Widget colors are intentionally pinned (not theme-driven): NFL blue `#013369`, NBA blue `#1d428a`, CFB red `#8b0000`, NCAAB orange `#ff6600`
- Numbered instructions: 5 steps (long press → + → search "WagerProof" → choose size → Edit Widget for content)

---

### 20. `SecretSettingsView` — admin/devtools modal with diagnostics, paywall test, push debug

**RN source:** `wagerproof-mobile/app/(modals)/secret-settings.tsx`
**Container:** `.fullScreenCover` (vs `.sheet` — RN uses regular modal but devtools warrant full takeover). `ScrollView` of `Form`-style sections: "More Goodies", "Testing Toggles", "Diagnostics", "Info".
**Navigation chrome:** Same custom header pattern as `SettingsView`: leading `chevron.left` back, centered "Secret Settings" title with subtitle "Devtools & diagnostics".

**Native primitives:**
- `Form` with sections — replaces `SectionCard` + `ActionRow` pattern from settings
- Sections (in order):
  1. **More Goodies** — NavigationLink to WagerBot Voice (push)
  2. **Testing Toggles**:
     - `Toggle("WagerBot Test Mode", isOn: $store.testModeEnabled)` — adds trigger button to header
     - `Button("Trigger Test Bubble") { store.triggerTestSuggestion() }`
     - `Toggle("Simulate Freemium", isOn: $store.forceFreemiumMode)`
     - `Toggle("Admin Mode", isOn: $store.adminModeEnabled)` (only if `canEnableAdminMode`)
  3. **Diagnostics**:
     - `Button("Push Diagnostics") { ... }` — runs full push diagnostic, shows result in `.alert`
     - `Button("Register & Test Push") { ... }` — calls Expo push API to send test notification
     - `Button("Sync Offerings") { ... }` — RevenueCat refresh
     - `Button("Check Offerings") { ... }`
     - `Button("Test Paywall") { ... }` — present paywall via `paywallStore.present(.testPaywall)`
     - `Button("Meta SDK Events") { metaTestSheetStore.openSheet() }` — opens debug sheet
     - `Button("Reset Onboarding") { ... }` — clears onboarding flag
  4. **Info** (if `user`):
     - `Label("User ID", systemImage: "person.fill")` with `subtitle: user.id`
- `.alert` for diagnostic results (push diagnostics, test push response)
- `.sheet` for Meta Test (separate context)

**Stores read:**
- `AuthStore.user`
- `WagerBotSuggestionStore.testModeEnabled / setTestModeEnabled(_:) / triggerTestSuggestion()`
- `ProAccessStore.forceFreemiumMode / setForceFreemiumMode(_:)`
- `AdminModeStore.adminModeEnabled / toggleAdminMode() / canEnableAdminMode`
- `RevenueCatStore.refreshCustomerInfo() / syncPurchases() / getAllOfferings()`
- `MetaTestSheetStore.openSheet()`
- `OnboardingStore.setOnboardingIncomplete()`
- `NotificationsStore.initializeNotifications() / getNotificationPermissionStatus() / requestNotificationPermission() / getExpoPushToken() / registerPushToken(userId)`
- Supabase `user_push_tokens` read

**Gesture choreography:**
- Tap any `Button` → triggers the named action; results in `.alert` for diagnostic actions
- Tap any `Toggle` → instant state change + `.sensoryFeedback(.selection)`
- Tap back → `dismiss()`

**Animations:**
- Toggle flip: system spring
- Alert presentation: native iOS modal

**Haptics:**
- Any toggle: `.sensoryFeedback(.selection)`
- Action button tap: `.sensoryFeedback(.impact(weight: .light))`
- Alert dismiss: native

**Loading state:** Diagnostic buttons can show `ProgressView()` overlay during async ops (push register, RevenueCat sync).
**Empty state:** n/a.
**Error state:** Errors shown in `.alert` with error message + line-by-line debug output.

**SF Symbol swaps:**
- Same set as `SettingsView` (section 7)
- RN `MaterialCommunityIcons.crown` → SF Symbol `crown.fill`
- RN `MaterialCommunityIcons.bug` (if used) → SF Symbol `ladybug.fill`
- RN diagnostic icons → SF Symbol `stethoscope` / `wrench.and.screwdriver.fill`

**Edge cases preserved from RN:**
- Push diagnostics gathers: platform, device info, init result, permission status, Expo project ID (3 variants checked), push token (first 30 chars), DB tokens for user
- "Register & Test Push" falls back to local notification on simulator (no token available)
- Real push call hits `https://exp.host/--/api/v2/push/send` directly (admin-only)
- `canEnableAdminMode` gates the Admin Mode toggle (checks Supabase RPC `has_role`)
- Meta Test sheet is opened via its own `SheetStore` context (separate from this view)
- Reset Onboarding → `setOnboardingIncomplete()` flag triggers root router to re-route to onboarding flow next launch

---

### 21. `NFLGameBottomSheet` — full NFL game detail in a bottom sheet

**RN source:** `wagerproof-mobile/components/NFLGameBottomSheet.tsx`
**Container:** `.sheet(isPresented:)` with `.presentationDetents([.fraction(0.85), .large])` (mirror RN `['85%', '95%']`), `.presentationDragIndicator(.visible)`, `.presentationBackgroundInteraction(.disabled)`. Background: `Color.black.opacity(0.7)` overlay (matches RN `BottomSheetBackdrop` `opacity={0.7}`). Inside: `ScrollView` with vertically stacked sections:
1. **AgentPickRationaleWidgetView** (top — surfaces matching agent picks)
2. **WagerBotInsightPillView** (compact AI summary)
3. **Header Card** — team gradient + date/time + teams matchup + lines (away spread/ML, O/U, home spread/ML)
4. **Weather Section** (`ProContentSectionView`) — if `temperature` or `wind_speed` not nil
5. **Market Odds** (`PolymarketWidgetView`)
6. **Spread Analysis** (collapsible Pressable; expand to show full explanation)
7. **Total Analysis** (same)
8. **Public Betting** (`PublicBettingBarsView`)
9. **Head-to-Head** (`H2HSectionView`)
10. **Line Movement** (`LineMovementSectionView`)

**Navigation chrome:** No nav bar — bottom sheet header only (rounded `Capsule()` drag indicator).

**Native primitives:**
- `.sheet` with `presentationDetents([.fraction(0.85), .large])`
- `ScrollView` (no `BottomSheetScrollView` needed — SwiftUI's native ScrollView works fine in `.sheet`)
- `LinearGradient` team-color stripe at top of Header Card (away primary → away secondary → home primary → home secondary)
- Header Card: `RoundedRectangle(cornerRadius: 16)` with `LinearGradient` stripe overlay, then `VStack` of date row + teams row + line pills
- Team logos: `TeamAvatarView(team: team, sport: .nfl, size: 80)` with `AsyncImage`-backed `URL` lookup + initials fallback
- Line pills: small `Capsule` with translucent green / blue background; spread pill green, ML pill blue
- Collapsible explanation: `Button { withAnimation(.spring(response: 0.3)) { expanded.toggle() } } label: { ... }` with `chevron.up` / `chevron.down` rotation
- `ProContentSectionView` — reusable section card wrapper (preserve as Swift component)
- `.contextMenu` per line pill: "Copy line"
- `.sensoryFeedback(.impact(weight: .light), trigger: expanded)`

**Stores read:**
- `NFLGameSheetStore.selectedGame / closeGameSheet() / bottomSheetRef` — replaces `useNFLGameSheet`
- `AgentPickAuditStore.clearAgentPickAudit()` — replaces `useAgentPickAudit`
- `WagerBotSuggestionStore.onModelDetailsTap() / isDetached`

**Gesture choreography:**
- Drag down → dismiss (system swipe-down on sheet)
- Tap backdrop → dismiss
- Tap Spread Analysis section → toggle `spreadExplanationExpanded` (notify floating WagerBot if detached)
- Tap Total Analysis section → toggle `ouExplanationExpanded`
- Long-press a line pill → context menu

**Animations:**
- Sheet enter/exit: native iOS slide-up
- Collapsible expand: `.animation(.spring(response: 0.3))` with chevron `.rotationEffect(.degrees(180))`
- Header gradient: static
- Section appearance: `.transition(.opacity)` for conditional sections

**Haptics:**
- Expand/collapse: `.sensoryFeedback(.impact(weight: .light))`
- Dismiss: native sheet drag

**Loading state:** Sheet only shows when `selectedGame != nil` — no internal loading state.
**Empty state:** n/a.
**Error state:** Sub-components (PolymarketWidget, H2H, LineMovement) handle their own error display.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.weather-partly-cloudy` → SF Symbol `cloud.sun.fill`
- RN `MaterialCommunityIcons.thermometer` → SF Symbol `thermometer.medium`
- RN `MaterialCommunityIcons.weather-windy` → SF Symbol `wind`
- RN `MaterialCommunityIcons.weather-rainy` → SF Symbol `cloud.rain.fill`
- RN `MaterialCommunityIcons.chevron-up` / `chevron-down` → SF Symbol `chevron.up` / `chevron.down`

**Edge cases preserved from RN:**
- Snap points: `[0.85, 0.95]` exactly (RN `['85%', '95%']`)
- Backdrop opacity: 0.7
- Spread/total predictions auto-flip team selection based on `home_away_spread_cover_prob >= 0.5`
- Confidence buckets: `< 0.55` close, `< 0.65` moderate, `>= 0.65` strong
- Fade alert flag: probability `>= 0.80`
- Explanation text generated client-side with three tiers based on probability bucket
- Weather section conditional on temp OR wind (skip if both null)
- Header gradient uses 4-color stop (away primary, away secondary, home primary, home secondary)
- Total line rounded to nearest half: `roundToNearestHalf(over_line)`

---

### 22. `CFBGameBottomSheet` — full CFB game detail bottom sheet

**RN source:** `wagerproof-mobile/components/CFBGameBottomSheet.tsx`
**Container:** Same as NFL (`.sheet` with `.presentationDetents([.fraction(0.85), .large])`, drag indicator visible, backdrop opacity 0.7). Section order matches NFL but CFB uses `api_spread` and `api_over_line` field names + CFB-specific team colors/logos.

**Native primitives:**
- Identical to section 21 (`NFLGameBottomSheet`) — same `ScrollView` + `ProContentSectionView` + Header Card + Polymarket + collapsible spread/total + Public Betting + H2H + Line Movement sections
- `TeamAvatarView(team: team, sport: .cfb, size: 80)` — uses CFB team color/logo mapping (`getCFBTeamInitials`, `getCFBTeamColors`)

**Stores read:**
- `CFBGameSheetStore.selectedGame / closeGameSheet() / bottomSheetRef` — replaces `useCFBGameSheet`
- `AgentPickAuditStore.clearAgentPickAudit()`
- `WagerBotSuggestionStore.onModelDetailsTap() / isDetached`

**Gesture choreography / Animations / Haptics / States:** Identical to section 21.

**SF Symbol swaps:** Same as section 21.

**Edge cases preserved from RN:**
- Same `[0.85, 0.95]` detents, 0.7 backdrop opacity
- CFB uses `api_spread` (not `home_spread`/`away_spread`) and `api_over_line` field names — pass through to predictions logic
- CFB team initials use `getCFBTeamInitials` (different rules than NFL)
- Same fade-alert logic (probability >= 0.80)
- Same collapsible explanation pattern with 3 confidence tiers

---

### 23. `NBAGameBottomSheet` — full NBA game detail bottom sheet

**RN source:** `wagerproof-mobile/components/NBAGameBottomSheet.tsx`
**Container:** Same as NFL (`.sheet` with `[0.85, 0.95]` detents, drag indicator). Section order: AgentPickRationale → WagerBotInsightPill → Header Card → Polymarket → Spread Prediction (collapsible) → Total Prediction (collapsible) → Injury Report (`ProContentSectionView`) → Recent Trends (`ProContentSectionView`) → Team Stats → Model Projections.

**Native primitives:**
- Same shell as section 21
- `InjuryReportView` (NBA-specific) — replaces `InjuryReport` sub-component
- `RecentTrendsView` — replaces RN trends sub-component
- NBA uses richer data: L3/L5 trends, ATS%, streaks, consistency scores — display in `Team Stats` section
- `TeamAvatarView(sport: .nba, size: 80)`

**Stores read:**
- `NBAGameSheetStore.selectedGame / closeGameSheet() / bottomSheetRef`
- `AgentPickAuditStore.clearAgentPickAudit()`
- `WagerBotSuggestionStore.onModelDetailsTap()`

**Gesture choreography / Animations / Haptics / States:** Same as section 21.

**SF Symbol swaps:** Same as section 21 plus:
- RN `MaterialCommunityIcons.basketball` → SF Symbol `basketball.fill`
- RN `MaterialCommunityIcons.medical-bag` (if used for injuries) → SF Symbol `cross.case.fill`

**Edge cases preserved from RN:**
- NBA's `home_win_prob` / `away_win_prob` drive ML prediction
- Includes injury report + L3/L5 trends + streaks (NBA-specific richer data)
- `ProContentSectionView` minHeights vary by section (Injury 80pt, Recent Trends 80pt, Team Stats 150pt, Model Projections 200pt)

---

### 24. `NCAABGameBottomSheet` — full NCAAB game detail bottom sheet

**RN source:** `wagerproof-mobile/components/NCAABGameBottomSheet.tsx`
**Container:** Same as NBA (`.sheet` with `[0.85, 0.95]` detents). Section order: AgentPickRationale → WagerBotInsightPill → Header Card → Polymarket → Spread Prediction → Total Prediction → Team Stats → Model Projections.

**Native primitives:**
- Same shell as section 23
- `TeamAvatarView(sport: .ncaab, size: 80)` — NCAAB color/logo mapping
- No injury report (NCAAB lacks injury data)
- No recent trends section (NCAAB lacks L3/L5 streaks per MEMORY.md)

**Stores read:**
- `NCAABGameSheetStore.selectedGame / closeGameSheet() / bottomSheetRef`
- `AgentPickAuditStore.clearAgentPickAudit()`

**Gesture choreography / Animations / Haptics / States:** Same as section 21.

**SF Symbol swaps:** Same as sections 21-23.

**Edge cases preserved from RN:**
- NCAAB has team ratings + rankings + context flags but NO trends, NO streaks
- Same fade-alert threshold (>= 0.80)
- Per MEMORY.md: NCAAB data is leaner than NBA — Team Stats section will show fewer fields

---

### 25. `MLBGameBottomSheet` — full MLB game detail bottom sheet with Full Game / 1st 5 toggle

**RN source:** `wagerproof-mobile/components/MLBGameBottomSheet.tsx`
**Container:** Same shape (`.sheet` with `[0.85, 0.95]`). MLB-specific section order:
1. Header Card (date/time + final/preliminary badge + matchup + lines (ML, Run Line, O/U) + starting pitchers row)
2. Polymarket Widget
3. Projected Score section with **Full Game / 1st 5** `Picker(.segmented)` toggle
4. ML Projection (Moneyline) — reactive to `projView`
5. O/U Projection — reactive to `projView`
6. Game Signals section (statcast/situational signals chips)
7. Weather section

Special case: if `game.is_postponed == true` → minimal sheet showing only "[Away] @ [Home]" + red "Postponed" badge.

**Native primitives:**
- `.sheet` with `[0.85, 0.95]` detents
- `Picker(.segmented)` for `projView` (Full Game / 1st 5) — replaces `projToggleBtn` `TouchableOpacity` pair
- Pitcher row: `HStack` with SP name + confirmed status `checkmark.circle.fill` (green) or "TBD" (amber)
- ML/OU collapsible sections (tap to expand for full Vegas vs Model comparison)
- `MLBSituationalSignalsView` — chips for signals
- `TeamLogoLargeView(logoUrl:, abbrev:, colors:)` — MLB-specific (uses logo URL from `mlb_team_mapping`)
- `.contextMenu` on lines: "Copy ML / Run Line / O/U"

**Stores read:**
- `MLBGameSheetStore.selectedGame / closeGameSheet() / bottomSheetRef`
- `MLBBucketAccuracyStore.data` — for accuracy pills

**Gesture choreography:**
- Tap Full Game / 1st 5 toggle → `setProjView(.full / .f5)`, `.sensoryFeedback(.impact(weight: .light))`, sections re-render with f5 fields
- Tap ML Projection / O/U Projection card → expand/collapse
- Long-press signal chip → context menu

**Animations:**
- `projView` toggle: `.spring(response: 0.4)` cross-fade between full + f5 numbers; use `.contentTransition(.numericText())` on projected scores
- Postponed badge: static (no animation)
- Final/Preliminary lock badge: `lock.fill` symbol when final

**Haptics:**
- Toggle (Full Game / 1st 5): `.sensoryFeedback(.impact(weight: .light))`
- Section expand: `.sensoryFeedback(.impact(weight: .light))`

**Loading state:** None — sheet renders only when `selectedGame != nil`.
**Empty state:** n/a (use postponed banner).
**Error state:** If projection unavailable for current view: "Projection unavailable for full game" / "1st 5" inline text.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.baseball` → SF Symbol `baseball.fill`
- RN `MaterialCommunityIcons.calendar-remove` → SF Symbol `calendar.badge.minus`
- RN `MaterialCommunityIcons.lock` → SF Symbol `lock.fill`
- RN `MaterialCommunityIcons.chevron-up` / `chevron-down` → SF Symbol `chevron.up` / `chevron.down`
- RN `MaterialCommunityIcons.weather-windy` → SF Symbol `wind`

**Edge cases preserved from RN:**
- Postponed game shows minimal sheet (no projections)
- `is_final_prediction == true` shows green "Final" badge with `lock.fill`; false → amber "Preliminary"
- Full Game and 1st 5 have independent moneyline + O/U + edge values — toggle drives which set is rendered
- SP confirmed status uses ✓ vs "TBD"; ✓ green, TBD amber
- `mlAccuracy` and `ouAccuracy` use `useMLBBucketAccuracy` lookup with bet type (`full_ml / f5_ml / full_ou / f5_ou`)
- Signal chip count varies per game; "Game Signals" section only shown if `signals.length > 0` or any game data exists
- Run line is MLB-specific — show alongside ML and O/U in lines row

---

### 26. `PickDetailBottomSheet` — editor pick detail with team gradient header

**RN source:** `wagerproof-mobile/components/PickDetailBottomSheet.tsx`
**Container:** `.sheet` with `.presentationDetents([.fraction(0.9), .large])` (RN uses `['90%', '95%']`). `ScrollView` of: team gradient header → close button → full `EditorPickCardView`.
**Navigation chrome:** No nav bar. Floating close button (`xmark`) at top right; drag indicator handle at top center.

**Native primitives:**
- `.sheet` with `[0.9, 0.95]` detents + `.presentationDragIndicator(.visible)`
- Team gradient header: `LinearGradient(colors: [awayColors.primary.opacity(0.25), .clear, homeColors.primary.opacity(0.25)], startPoint: .leading, endPoint: .trailing)` — diagonal team color blend
- Team logo: `AsyncImage(url: URL(string: awayLogo))` with `Circle` clip + 3pt colored stroke matching team primary; fallback `LinearGradient` + initials if no logo
- "@" badge between teams: 36pt circle with `at.symbol` SF Symbol
- O/U badge below "@": small capsule with "O/U: 224.5" text
- Team labels: small capsule with `airplane.departure` (away) / `house.fill` (home) icons
- Close button: 32pt circle (`Circle().fill(Color.black.opacity(0.05))`) with `xmark` symbol, absolute-positioned top-right
- Embedded `EditorPickCardView` — full editor pick component (preserve from RN)

**Stores read:**
- `PickDetailSheetStore.isOpen / selectedPick / selectedGameData / closePickDetail() / bottomSheetRef` — replaces `usePickDetailSheet`

**Gesture choreography:**
- Drag down → dismiss
- Tap close button → `closePickDetail()`
- Tap backdrop → dismiss
- Inside `EditorPickCardView` — own internal gestures (deferred to that component spec)

**Animations:**
- Sheet enter/exit: native iOS slide-up
- Header gradient: static
- Close button press: `.scaleEffect(0.94)` on tap

**Haptics:**
- Close tap: `.sensoryFeedback(.impact(weight: .light))`
- Dismiss: native

**Loading state:** Renders only when `selectedPick && selectedGameData` both present — no internal loading.
**Empty state:** n/a.
**Error state:** Handled by `EditorPickCardView` internally.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.close` → SF Symbol `xmark`
- RN `MaterialCommunityIcons.at` → SF Symbol `at`
- RN `MaterialCommunityIcons.airplane-takeoff` → SF Symbol `airplane.departure`
- RN `MaterialCommunityIcons.home` → SF Symbol `house.fill`

**Edge cases preserved from RN:**
- Detents `[0.9, 0.95]` — taller than NFL/CFB/NBA sheets (`[0.85, 0.95]`) since pick card has more content
- Backdrop opacity 0.6 (vs 0.7 for game sheets)
- Logo fallback: gradient with team initials (3-letter, e.g. "BOS") when no `away_logo`/`home_logo` URL
- Default team colors when missing: `#6B7280` / `#9CA3AF` (grays)
- O/U badge optional — only shown if `selectedGameData.over_line != nil`

---

### 27. `EditorPickCreatorBottomSheet` — editor-only create/edit pick form

**RN source:** `wagerproof-mobile/components/EditorPickCreatorBottomSheet.tsx`
**Container:** `.sheet` with `.presentationDetents([.fraction(0.9)])` (RN uses `['90%']`). `Form` with sections for each field. `KeyboardAvoidingView` equivalent via `.scrollDismissesKeyboard(.interactively)` on the form `ScrollView`.
**Navigation chrome:** No nav bar; drag indicator visible. Top has a custom header inside the form: title "Create Pick" / "Edit Pick" + close button.

**Native primitives:**
- `.sheet` with `[0.9]` single-detent + `.presentationDragIndicator(.visible)`
- `Form` with sections:
  1. **League** — chip group of 4: NFL, CFB, NBA, NCAAB (`Picker(.segmented)` or custom `Chip` group with `.selected` state). Use `HStack` of `Capsule()` chips with `.tint(.wagerproofGreen)` when selected
  2. **Game** — when league selected, shows `Picker(selection: $selectedGameId)` populated by `GamesStore.fetchActiveGames(league)`. Use a custom row list with team logos + away @ home text
  3. **Pick Type** — chip group: Spread / Over Under / Moneyline
  4. **Bet Type** — `TextField` (optional)
  5. **Pick Value** — `TextField` (required, e.g. "Ravens -3.5")
  6. **Best Price** — `TextField` (e.g. "-110")
  7. **Sportsbook** — `TextField` (e.g. "DraftKings")
  8. **Units** — chip group with 10 options (0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5)
  9. **Editor's Notes** — multi-line `TextEditor` (required if publishing)
  10. **Free Pick** — `Toggle("Free Pick", isOn: $isFreePick)`
- Bottom action row: `HStack` of `Button("Save Draft")` and `Button("Publish", role: .none)` (primary). Editing mode shows additional `Button("Delete", role: .destructive)`
- `@FocusState` to advance through fields
- `.alert` for validation errors and confirmation dialogs
- `.confirmationDialog("Delete this pick?")` for delete action

**Stores read:**
- `EditorPickSheetStore.editingPick / closeSheet() / onPickSaved / bottomSheetRef` — replaces `useEditorPickSheet`
- `AuthStore.user`
- `EditorPicksGameStore.fetchActiveGames(league)` — replaces `fetchActiveGames` service call
- Supabase writes: `editors_picks` insert (new) or update (existing)

**Gesture choreography:**
- Tap chip → set league/pickType/units, `.sensoryFeedback(.selection)`
- Tap field → focus
- Tap "Save Draft" → validate (no notes required), call save with `is_published=false`
- Tap "Publish" → validate (notes required), call save with `is_published=true`
- Tap "Delete" (editing only) → confirmation dialog → call delete from supabase + `onPickSaved()`
- Tap close (`xmark`) → if dirty, `.confirmationDialog("Discard changes?")`, else `closeSheet()`
- Drag down → close (same dirty-check)

**Animations:**
- Chip selection: `.spring(response: 0.3)` background cross-fade
- Game list expand when league changes: `.transition(.opacity)` + spinner during fetch
- Submit button → `ProgressView()` overlay during `submitting`

**Haptics:**
- Chip tap: `.sensoryFeedback(.selection)`
- Save success: `.sensoryFeedback(.success)`
- Validation error: `.sensoryFeedback(.warning)`
- Delete confirm: `.sensoryFeedback(.warning)`; delete commit: `.sensoryFeedback(.error)`

**Loading state:** `loadingGames` → `ProgressView()` next to Game picker. `submitting` → `ProgressView()` on submit buttons (replaces label).
**Empty state:** League selected but no active games: `Text("No active games for this sport")` in game picker.
**Error state:** `.alert` for save failures with retry option; Supabase errors surfaced as alert.

**SF Symbol swaps:**
- RN `MaterialCommunityIcons.close` (if used in custom header) → SF Symbol `xmark`
- RN `MaterialCommunityIcons.check` → SF Symbol `checkmark`
- RN `MaterialCommunityIcons.trash-can-outline` → SF Symbol `trash`
- Sport chip icons: `football.fill` (NFL), `graduationcap.fill` (CFB), `basketball.fill` (NBA / NCAAB)

**Edge cases preserved from RN:**
- League cannot be changed when editing (only on create — `disabled={isEditing}` on chip)
- Validation rules: league + game + pickType + pickValue required for any save; editorsNotes required only for `publish=true`
- Archived game data: on new picks, snapshot of `awayTeam`, `homeTeam`, `gameDate`, lines (spread / ML / O/U) is written to `archived_game_data` JSON column
- Units field: chip group with 10 fixed options (0.5–5 in 0.5 steps); tap-same-twice clears the selection
- Free Pick toggle: pick visible to non-pro users when true
- Form auto-populates when `editingPick != null` (preserve all field mappings from RN useEffect)
- After successful save: call `onPickSaved?.()` callback + `closeSheet()` + `resetForm()`
- Pick type maps to `selected_bet_type` column (snake_case); `bet_type` is a separate optional text field
- `units` converted to `parseFloat` before insert; null if empty string

