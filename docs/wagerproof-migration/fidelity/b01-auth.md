# Fidelity Table — B01 Auth

Implementer: B01 auth-foundation agent
Date: 2026-05-20
RN sources:
- `wagerproof-mobile/app/(auth)/_layout.tsx`
- `wagerproof-mobile/app/(auth)/login.tsx`
- `wagerproof-mobile/app/(auth)/email-login.tsx`
- `wagerproof-mobile/app/(auth)/signup.tsx`
- `wagerproof-mobile/app/(auth)/forgot-password.tsx`
- `wagerproof-mobile/contexts/AuthContext.tsx`

Swift targets:
- `Wagerproof/Features/Auth/AuthRouter.swift`
- `Wagerproof/Features/Auth/LoginView.swift`
- `Wagerproof/Features/Auth/EmailLoginView.swift`
- `Wagerproof/Features/Auth/SignupView.swift`
- `Wagerproof/Features/Auth/ForgotPasswordView.swift`
- `Wagerproof/Features/Auth/Components/OnboardingSlide.swift`
- `Wagerproof/Features/Auth/Components/SocialSignInButton.swift`
- `WagerproofKit/Sources/WagerproofStores/AuthStore.swift` (extended)
- `WagerproofKit/Sources/WagerproofServices/GoogleSignInCoordinator.swift` (new)

Legend: ✅ matches · 🔧 fixed (diverged, justified) · ⚠️ #NNN (waiver) · ❌ missing

---

## AuthRouter (RN `_layout.tsx` Stack)

| RN element | Swift counterpart | Match |
|---|---|---|
| Stack with headerShown=false, contentStyle bg #000, slide_from_right | `NavigationStack(path:)` with `.preferredColorScheme(.dark)` and `.tint(.white)`; system push transition replaces RN's `slide_from_right`. | ✅ |
| Routes: login / email-login / signup / forgot-password | `AuthRoute` enum + `navigationDestination(for: AuthRoute.self)` | ✅ |

## LoginView (`app/(auth)/login.tsx`)

### Visual structure

| RN element | Swift counterpart | Match |
|---|---|---|
| `<View style={container}>` background `#000` | `ZStack` rooted in `AuthRouter`'s NavigationStack | ✅ |
| `<Video>` looping login-background.mp4 (slides 0,5) | `AVPlayer` via `VideoBackground` UIViewRepresentable; falls back to teal `Color` placeholder when asset missing | ⚠️ #003 |
| Teal linear gradient overlay `rgba(0,191,165,0.6→0.85→#00BFA5)` | `LinearGradient` in `gradientLayer` (identical stops) | ✅ |
| Bottom black fade `transparent → rgba(0,0,0,0.8) → #000` | Inner `LinearGradient` on lower 55% height | ✅ |
| SegmentedProgressBar (6 segments, top 10pt + safe-area, gap 6) | `SegmentedProgressBar` SwiftUI view using `TimelineView(.animation)` to fill the active segment over `duration` seconds | ✅ |
| `ScreenVisuals` (LineMoveCard, StatsCard, AIModelCard, AgentBotsDemo, DiscordCard) | `OnboardingSlide.swift` with per-slide visuals: `FloatingPublicBettingVisual`, `FloatingAIModelVisual`, `CreateBotsPlaceholder`, `FloatingDiscordVisual` | 🔧 PixelOffice 3D scene swapped for SF-symbol bot trio placeholder |
| Title 42pt weight 800 + subtitle 24pt weight 600 | `Text(...).font(.system(size: 42/24, weight: .heavy/.semibold))` with `.fixedSize(horizontal: false, vertical: true)` to allow wrapping | ✅ |
| AnimatedSlideContent spring(tension 100, friction 12) | `.transition(.asymmetric(insertion: .move(edge: .trailing).combined(with: .opacity), removal: .move(edge: .leading).combined(with: .opacity)))` driven by `.animation(.spring(response: 0.5, dampingFraction: 0.85))` | ✅ |

### Tokens

| RN value | Swift value | Match |
|---|---|---|
| `#00BFA5` (teal accent) | `Color(hex: 0x00BFA5)` | ✅ |
| `#FF4444` (snackbar red) | `Color(hex: 0xFF4444)` | ✅ |
| White pill bg, radius 30, paddingVertical 16, minHeight 54 | `RoundedRectangle(cornerRadius: 30).fill(.white)` `.minHeight(54)` | ✅ |
| `rgba(255,255,255,0.6)` other-signin text | `.white.opacity(0.6)` | ✅ |
| `rgba(255,255,255,0.4)` terms text | `.white.opacity(0.4)` | ✅ |
| Slide duration: 5 s default, 10 s for slide 1 (createBots) | `OnboardingSlideKind.duration` (case `.createBots` returns 10) | ✅ |

### Gestures

| RN element | Swift counterpart | Match |
|---|---|---|
| `TouchableOpacity` on progress segments | `Button { onTap(i) }` inside `SegmentedProgressBar` | ✅ |
| Auto-advance after `SCREEN_DURATIONS[currentIndex]` | `.task(id:)` that sleeps then increments `currentIndex` | ✅ |
| `Snackbar` 5s auto-dismiss on auth errors | Custom snackbar overlay with `Task.sleep(5_000_000_000)` auto-dismiss | ✅ |
| `handleAppleSignIn` (expo-apple-authentication) | `SignInWithAppleButton` (native AS) + handler invoking `authStore.signInWithApple` | ✅ |
| `handleGoogleSignIn` (RN-google-signin) | `SocialSignInButton(provider: .google)` calling `authStore.signInWithGoogle()` | ✅ |
| `handleEmailSignIn` → router.push('/(auth)/email-login') | `NavigationLink(value: AuthRoute.emailLogin)` | ✅ |
| Tap left/right thirds advances/rewinds slide | `tapZones` HStack of two clear contentShape rectangles | 🔧 left third = previous, right two-thirds = next (left=prev, right=next, like RN) |
| Long-press to pause carousel | `LongPressGesture(minimumDuration: 0.18).onChanged` toggling `isPaused` | ✅ |
| `useLearnWagerProof().openLearnSheet()` 2s timer | Disabled per spec (commented out in RN; not ported) | ✅ (RN code already disabled) |

### Navigation

| RN | Swift | Match |
|---|---|---|
| `router.push('/(auth)/email-login')` | `path.append(.emailLogin)` via NavigationLink | ✅ |

### Analytics

| RN | Swift | Match |
|---|---|---|
| `debugLog('login.tsx:handleGoogleSignIn', ...)` POST to 127.0.0.1:7243 | Not ported — dev-only POST excluded from release. | 🔧 explicit DEBUG-only feature, intentionally dropped |

### State reads/writes

| RN | Swift | Match |
|---|---|---|
| `useAuth().signInWithProvider('apple'/'google')` | `authStore.signInWithApple(idToken:nonce:)`, `authStore.signInWithGoogle()` | ✅ |
| Supabase `signInWithIdToken({ provider, token })` | `MainSupabase.shared.client.auth.signInWithIdToken(credentials:)` inside `AuthStore` | ✅ |
| `setLoading`, `setErrorMessage` | `@State` locals (`googleLoading`, `appleLoading`, `snackbarMessage`); `authStore.lastError` observed | ✅ |

### Async actions

| RN | Swift | Match |
|---|---|---|
| Apple identity-token nonce hashing (sha256) | `CryptoKit.SHA256.hash(data:)` in `sha256Hex` | ✅ |

### Haptics

| RN | Swift | Match |
|---|---|---|
| RN does not implement haptics for login (only via Paper internals) | `.sensoryFeedback(.selection, trigger: currentIndex)`, `.sensoryFeedback(.impact(weight: .medium), trigger: signInTapCount)`, `.sensoryFeedback(.success, trigger: authStore.lastSuccessAt)`, `.sensoryFeedback(.error, trigger: snackbarMessage)` | 🔧 added per Honeydew 09-motion-and-haptics.md |

### Empty / loading / error states

| State | RN copy | Swift implementation | Match |
|---|---|---|---|
| Loading | Social buttons disabled, spinner | `googleLoading`/`appleLoading` state + `ProgressView` swap | ✅ |
| Empty | n/a (always carousel) | n/a | ✅ |
| Error | Snackbar with err.message, 5s, "Dismiss" action | Custom snackbar overlay, `.transition(.move(edge: .bottom).combined(with: .opacity))`, 5s auto-dismiss, "Dismiss" button | ✅ |

---

## EmailLoginView (`app/(auth)/email-login.tsx`)

### Visual structure

| RN element | Swift counterpart | Match |
|---|---|---|
| `<View>` + `<LinearGradient>` teal-to-black | `ZStack { AuthGradientBackground() ... }` (same teal-to-black gradient) | ✅ |
| `<ScrollView keyboardShouldPersistTaps="handled">` | `ScrollView { ... }.scrollDismissesKeyboard(.interactively)` | ✅ |
| Back button (40×40 circle, white-on-10% bg, MaterialCommunityIcons.arrow-left) | Circular `Button` with `Image(systemName: "chevron.left")` | ✅ |
| Logo `wagerproofGreenDark.png` (140×50) | SF-symbol chart glyph + "WagerProof" wordmark | ⚠️ #004 |
| Title "Welcome Back" 32pt weight 800 | `Text("Welcome Back").font(.system(size: 32, weight: .heavy))` | ✅ |
| Subtitle "Sign in with your email" 16pt opacity 0.5 | `Text(...).font(.system(size: 16)).foregroundStyle(.white.opacity(0.5))` | ✅ |
| Email input row (envelope icon, placeholder, white bg 8% + 12% border, radius 14) | `AuthFieldRow(label:"Email", icon:"envelope") { TextField(...) }` | ✅ |
| Password input row + eye toggle | `AuthFieldRow(label:"Password", icon:"lock") { SecureField/TextField } trailing: { eye Button }` | ✅ |
| Forgot Password link `#00BFA5` | `NavigationLink(value: .forgotPassword) { Text("Forgot Password?") }` styled teal | ✅ |
| Error banner red 12% bg + alert-circle icon | `AuthErrorBanner` view with `exclamationmark.circle` SF symbol | ✅ |
| White pill Sign-In CTA, opacity 0.4 when disabled | `Button` with `RoundedRectangle(cornerRadius: 30).fill(.white)`, `.opacity(0.4)` when invalid | ✅ |
| Footer "Don't have an account? Sign Up" | `NavigationLink(value: .signup)` with teal text | ✅ |

### Tokens

| RN | Swift | Match |
|---|---|---|
| Input bg `rgba(255,255,255,0.08)` | `.white.opacity(0.08)` | ✅ |
| Input border `rgba(255,255,255,0.12)` | `.white.opacity(0.12)` | ✅ |
| Input radius 14 | `RoundedRectangle(cornerRadius: 14)` | ✅ |
| Input minHeight 52 | `.frame(minHeight: 52)` | ✅ |
| Error red `#ff6b6b` | `Color(hex: 0xFF6B6B)` | ✅ |
| Footer link `#00BFA5` | `Color(hex: 0x00BFA5)` | ✅ |

### Gestures

| RN | Swift | Match |
|---|---|---|
| onChangeText clears error | `.onChange(of: email/password) { errorMessage = nil }` | ✅ |
| keyboardType="email-address" | `.keyboardType(.emailAddress)` | ✅ |
| autoCapitalize="none", autoCorrect=false | `.textInputAutocapitalization(.never)`, `.autocorrectionDisabled()` | ✅ |
| secureTextEntry toggle on eye press | Group switching `SecureField`/`TextField` driven by `isPasswordVisible` | ✅ |
| Sign-in disabled when email/password empty | `.disabled(loading || email.isEmpty || password.isEmpty)` + opacity 0.4 | ✅ |
| KeyboardAvoidingView padding | SwiftUI auto-adjusts content for keyboard | ✅ |
| `router.back()` | `dismiss()` env action | ✅ |

### Navigation

| RN | Swift | Match |
|---|---|---|
| `router.push('/(auth)/forgot-password')` | `NavigationLink(value: AuthRoute.forgotPassword)` | ✅ |
| `router.push('/(auth)/signup')` | `NavigationLink(value: AuthRoute.signup)` | ✅ |

### State reads/writes

| RN | Swift | Match |
|---|---|---|
| `useAuth().signIn(email, password)` | `authStore.signIn(email:password:)` | ✅ |
| Supabase `signInWithPassword({ email, password })` | `client.auth.signIn(email:password:)` inside `AuthStore.signIn` | ✅ |
| Error classification "Invalid login credentials" → "Invalid email or password" | `EmailLoginView.classify(raw:)` static helper, verbatim string match | ✅ |
| Error classification "Email not confirmed" → "Please verify your email before signing in" | Same helper | ✅ |

### Empty / loading / error

| State | RN copy | Swift | Match |
|---|---|---|---|
| Loading | ActivityIndicator inside Sign In button | `ProgressView().tint(.black)` swap | ✅ |
| Error | Red banner above CTA with classified message | `AuthErrorBanner` with `.transition(.opacity)` and `.animation(.easeInOut(duration: 0.2))` | ✅ |

### Haptics

| Trigger | Swift sensoryFeedback | Match |
|---|---|---|
| Field focus advance | `.sensoryFeedback(.selection, trigger: focused)` | 🔧 added |
| Sign-in tap | `.sensoryFeedback(.impact(weight: .light), trigger: signInTapCount)` | 🔧 added |
| Sign-in success | `.sensoryFeedback(.success, trigger: authStore.lastSuccessAt)` | 🔧 added |
| Eye toggle | `.sensoryFeedback(.selection, trigger: isPasswordVisible)` | 🔧 added |

---

## SignupView (`app/(auth)/signup.tsx`)

### Visual structure

| RN element | Swift counterpart | Match |
|---|---|---|
| ScrollView + gradient background | Same as EmailLoginView | ✅ |
| Back button | Same | ✅ |
| Logo | Same (FIDELITY-WAIVER #004) | ⚠️ #004 |
| Title "Create Account" + subtitle | `Text`/`Text` 32pt/16pt | ✅ |
| Email field | `AuthFieldRow(label:"Email", icon:"envelope")` | ✅ |
| Password field (placeholder "At least 8 characters", newPassword content type) | `AuthFieldRow(label:"Password", icon:"lock")` with `.textContentType(.newPassword)` | ✅ |
| Confirm field (lock-check-outline icon) | `AuthFieldRow(label:"Confirm Password", icon:"lock.shield")` | ✅ |
| Disclaimer row info.circle + 12pt 40% white text | `HStack` with `info.circle` + 12pt 40% white | ✅ |
| Error banner + success banner (teal) | `AuthErrorBanner` + `AuthSuccessBanner` (defined in SignupView.swift) | ✅ |
| Create Account CTA white pill | Same pattern as EmailLoginView | ✅ |
| Divider "or continue with" | `HStack { Rect; Text; Rect }` | ✅ |
| Apple button (iOS only) + Google button | `SignInWithAppleButton` + `SocialSignInButton(.google)` | ✅ |
| Footer "Already have an account? Sign In" | `Button { dismiss() }` | ✅ |

### State reads/writes

| RN | Swift | Match |
|---|---|---|
| `useAuth().signUp(email, password)` | `authStore.signUp(email:password:)` (passes `wagerproof://` as emailRedirectTo) | ✅ |
| Inline session check via `supabase.auth.getSession()` | `if case .authenticated = authStore.phase { ... }` after signup | ✅ |
| Auto-route back to login 3s after email-verification message | `Task { sleep 3_000_000_000; dismiss() }` | ✅ |
| `useAuth().signInWithProvider('apple'/'google')` | `authStore.signInWithApple/Google` | ✅ |

### Validation

| RN check | Swift check | Match |
|---|---|---|
| email empty → "Please enter your email" | Same | ✅ |
| email no @ → "Please enter a valid email" | Same | ✅ |
| password empty → "Please enter a password" | Same | ✅ |
| password.length < 8 → "Password must be at least 8 characters" | Same | ✅ |
| password !== confirmPassword → "Passwords do not match" | Same | ✅ |
| `"already registered"` → "An account with this email already exists" | `SignupView.classify(raw:)` matches case-insensitively | ✅ |

---

## ForgotPasswordView (`app/(auth)/forgot-password.tsx`)

### Visual structure

| RN element | Swift counterpart | Match |
|---|---|---|
| ScrollView + gradient | Same teal-to-black gradient | ✅ |
| Back button | Same circular chevron-left button | ✅ |
| Logo | SF-symbol + wordmark (FIDELITY-WAIVER #004) | ⚠️ #004 |
| 80×80 circular tinted lock-reset icon | `ZStack { Circle().fill(teal12%); Image(systemName: "lock.rotation") }` | ✅ |
| Title "Forgot Password?" 28pt heavy | `Text(...).font(.system(size: 28, weight: .heavy))` | ✅ |
| Multi-line subtitle | `Text(...).font(.system(size: 16)).lineSpacing(4)` | ✅ |
| Email field (submitLabel = send) | `AuthFieldRow` + `.submitLabel(.send)` | ✅ |
| Error banner | `AuthErrorBanner` | ✅ |
| "Send Reset Link" white pill | Same pattern as other forms | ✅ |
| Footer "Remember your password? Sign In" | `Button { dismiss() }` | ✅ |
| Success state: 96pt envelope.badge icon + title + email highlight + info row + back button | Implemented as `successView` body branch | ✅ |
| Email highlight in `#00BFA5` (exact entered value) | `Text(submittedEmail).foregroundStyle(Color(hex: 0x00BFA5))` | ✅ |
| Symbol-bounce on success icon | `.symbolEffect(.bounce, value: success)` | ✅ |

### Async actions

| RN | Swift | Match |
|---|---|---|
| `supabase.auth.resetPasswordForEmail(email, { redirectTo: 'wagerproof://reset-password' })` | `AuthStore.sendPasswordReset(email:)` passes `URL(string: "wagerproof://reset-password")` to `client.auth.resetPasswordForEmail` | ✅ |

---

## AuthStore extensions

| RN AuthContext field | Swift AuthStore counterpart | Match |
|---|---|---|
| `signInWithProvider('google')` | `signInWithGoogle()` — uses `GoogleSignInCoordinator` → `signInWithIdToken(provider: .google, idToken:, accessToken:)` | ✅ |
| `signInWithProvider('apple')` | `signInWithApple(idToken:, nonce:)` — calls `signInWithIdToken(provider: .apple, idToken:, nonce:)` | ✅ |
| `signUp` with `emailRedirectTo: 'wagerproof://'` | `signUp(email:password:)` with `redirectTo: URL(string: "wagerproof://")` | ✅ |
| `sendPasswordReset(email)` with `redirectTo: 'wagerproof://reset-password'` | `sendPasswordReset(email:)` with `redirectTo: URL(string: "wagerproof://reset-password")` | ✅ |
| Apple cancellation suppressed | `if let asError = error as? ASAuthorizationError, asError.code == .canceled { return }` in view; AuthStore swallows messages containing "cancel" in `signInWithGoogle` | ✅ |
| `lastError` field | `lastError` (String?) + `clearError()` mutator | ✅ |
| Session listener via `supabase.auth.onAuthStateChange` | `for await (event, session) in client.auth.authStateChanges` inside `start()` Task | ✅ (unchanged from B00) |

---

## RootView integration

| Before | After | Match |
|---|---|---|
| `case .unauthenticated: ScaffoldPlaceholder(...)` | `case .unauthenticated: AuthRouter()` | ✅ |
| WagerproofApp.init() bootstrap | Added `GoogleSignInCoordinator.configureIfNeeded()` | ✅ |
| `onOpenURL` only handled deep-link router | Now hands URL to `GIDSignIn.sharedInstance.handle(url)` first, falls through to router | ✅ |

---

## Open waivers (filed tickets)

| Ticket | Description | File ref |
|---|---|---|
| #001 | PixelOffice 3D agent-office scene not portable in B01 scope — render SF-symbol bot trio placeholder for slide 1 (`Create Bots`). | `Components/OnboardingSlide.swift` `CreateBotsPlaceholder` |
| #002 | No official Google brand asset in iOS bundle yet — render bold "G" mark in social button. | `Components/SocialSignInButton.swift` |
| #003 | `login-background.mp4` asset not yet imported to iOS bundle — fall back to teal `Color` background on video slides. | `LoginView.swift` `makeVideoPlayer` |
| #004 | `wagerproofGreenDark.png` logo asset not yet imported — render SF-symbol + wordmark stand-in on all 4 auth screens. | `EmailLoginView.swift` `logo`, `SignupView.swift` `logo`, `ForgotPasswordView.swift` `logo` |

---

## Parity screenshots

| Screen | empty.png | loaded.png | error.png | Notes |
|---|---|---|---|---|
| LoginView | slide 0 (Access Pro-Level Sports Data) | slide 3 (Live Public Betting Data, widgets visible) | duplicate of empty | error snackbar requires real auth failure → see B01 limitation |
| EmailLoginView | empty form | duplicate (same — UI automation not driving keystrokes in this batch) | duplicate of empty | mid-typed & inline-error states require keystroke automation we don't have in MCP this batch |
| SignupView | empty 3-field form | duplicate | duplicate | same |
| ForgotPasswordView | empty form | duplicate | duplicate | success state requires successful backend round-trip |

> Limitation: the XcodeBuildMCP environment for this batch did not expose tap / type-text automation. Loaded & error states for forms are captured as the empty state with this note; a follow-up batch with full UI automation should re-capture them.

---

## Diff list (rows requiring reviewer scrutiny)

- 🔧 LoginView slide 1 visual is an SF-symbol bot trio, not PixelOffice 3D scene — ticket #001.
- 🔧 LoginView Google button uses bold "G" instead of official asset — ticket #002.
- 🔧 LoginView video slides fall back to teal placeholder when MP4 missing — ticket #003.
- 🔧 All 4 screens use SF-symbol + wordmark instead of logo PNG — ticket #004.
- 🔧 Haptics added across all screens (not present in RN) — justified by Honeydew motion vocabulary.
- 🔧 dev-only POST to 127.0.0.1:7243 not ported — RN excludes from release; same effect.

No ❌ rows.
