# 04 — Design System Inventory (iOS → Compose parity contract)

Source of truth audited on 2026-07-06:

- `wagerproof-ios-native/WagerproofKit/Sources/WagerproofDesign/` — 26 Swift files (~3.3K lines) + `Resources/`
- `wagerproof-ios-native/WagerproofKit/Sources/WagerproofSharedKit/` — 2 Swift files
- App-target design-critical components under `wagerproof-ios-native/Wagerproof/Features/` (PixelOffice sim, pick tickets/folder/printer, collapsing scroll, research card) — included because the parity contract needs them even though they live outside the kit.

> **Important negative findings:** there are **no custom font files** (no .ttf/.otf anywhere — everything is SF system font, often `design: .rounded`), **no color sets in any asset catalog** (all colors are code-defined hex in `Tokens.swift`), and there is **no component literally named `GlassCard` or `FilterPill` in the iOS app** — those are web-app names. Their iOS equivalents are the `liquidGlassBackground` modifier family, `LiquidGlassCapsule`, and per-screen `filterPill(...)` helpers (documented below under PickHistorySheet).

---

## 1. Design tokens

### 1.1 `Tokens.swift` — colors

Naming convention `app<Role>`. Helper inits: `Color(hex: Int)` (sRGB) and `Color(light:dark:)` (UIColor trait-resolved — Compose equivalent: resolve on `isSystemInDarkTheme()`).

Brand-fixed (same in both modes):

| Token | Hex |
|---|---|
| `appPrimary` | `#22C55E` |
| `appPrimaryStrong` | `#16A34A` |
| `appPrimarySubtle` | `#BBF7D0` |
| `appAccentRed` | `#EF4444` |
| `appAccentAmber` | `#F59E0B` |
| `appAccentBlue` | `#3B82F6` |
| `appAccentPurple` | `#A855F7` |
| `appWin` | `#22C55E` |
| `appLoss` | `#EF4444` |
| `appPush` | `#94A3B8` |
| `appPending` | `#F59E0B` |

Light/dark adaptive:

| Token | Light | Dark |
|---|---|---|
| `appSurface` | `#FFFFFF` | `#0A0A0A` |
| `appSurfaceElevated` | `#F8FAFC` | `#141414` |
| `appSurfaceMuted` | `#F1F5F9` | `#1F1F1F` |
| `appBorder` | `#E2E8F0` | `#262626` |
| `appBorderStrong` | `#CBD5E1` | `#404040` |
| `appTextPrimary` | `#0F172A` | `#F8FAFC` |
| `appTextSecondary` | `#475569` | `#94A3B8` |
| `appTextMuted` | `#94A3B8` | `#64748B` |
| `appTextInverse` | `#FFFFFF` | `#0F172A` |
| `appSkeleton` | `#E6ECF3` | `#2B2B2B` |
| `appSkeletonHighlight` | `#F6F9FC` | `#3D3D3D` |

Additional hard-coded hexes used repeatedly outside Tokens (keep as literals or add tokens):
`#111111` (pixelwave base), `#0F100F` (pixelwave gradient tail), `#0F1117` (onboarding backdrop top), `#00E676` (bright brand green — wordmark "Proof", terminal green), `#0F1118`/`0x0f1118` (SKView bg), `#141927`/`#0D101A` (ticket cardstock gradient), `#151A28`, `#151A25`/`#0C0F17` (folder back), `#0B1011` (pick-history sheet bg), `#2C313C`/`#0E1016` (printer slot bar), `#070A0A` + `#9FB3AD` + `#8CA89B` (thinking terminal), `#FFE7A6` (swipe-pill gold), `#4ADE80`/`#F87171` (stats pill P/L), `#1F2937`/`#6B7280` (neutral team disc fallback).

### 1.2 `Spacing.swift`

```
Spacing:      xxs=2, xs=4, sm=8, md=12, lg=16, xl=24, xxl=32, xxxl=48   (dp)
CornerRadius: sm=6, md=10, lg=14, xl=20, pill=999
```
Other radii used in components: 16 (skeleton card), 22 (ticket), 23 (option card), 20 (office clip, glow wrapper), 18/26 (folder shapes).

### 1.3 `Typography.swift` — `AppFont`

All SF system font. **Rounded design is used for display + odds styles** — this is the visual signature to replicate.

| Token | Size | Weight | Design |
|---|---|---|---|
| `displayLarge` | 34 | bold | **rounded** |
| `display` | 28 | bold | **rounded** |
| `title` | 22 | semibold | default |
| `headline` | 17 | semibold | default |
| `body` | 15 | regular | default |
| `bodyEmphasized` | 15 | semibold | default |
| `caption` | 13 | medium | default |
| `captionEmphasized` | 13 | semibold | default |
| `micro` | 11 | medium | default |
| `mono` | body | — | monospaced |
| `monoCaption` | caption | — | monospaced |
| `oddsLarge` | 28 | bold | **rounded** |
| `oddsMedium` | 18 | semibold | rounded |
| `oddsSmall` | 13 | semibold | rounded |

Monospaced is used heavily for ticket stamp values (`size 16-17 semibold monospaced`) and the terminal animation (14 monospaced). PixelOffice name tags use `AvenirNext-Heavy` (13) / `AvenirNext-Bold` (15) inside SpriteKit — substitute any heavy geometric sans on Android.

### 1.4 `Animations.swift` — motion vocabulary

| Token | Spec |
|---|---|
| `appQuick` | spring(response 0.25, dampingFraction 0.85) |
| `appStandard` | spring(response 0.4, dampingFraction 0.8) |
| `appBouncy` | spring(response 0.5, dampingFraction 0.65) |
| `appCarousel` | spring(response 0.5, dampingFraction 0.85) |
| `appSlow` | easeInOut 0.6s |
| `appLinear` | linear 0.15s |
| `appShimmer` | linear 1.5s, repeatForever (no autoreverse) |

Transitions (`AnyTransition`): `fadeIn` (opacity), `scaleIn` (scale 0.85 + opacity), `slideFromLeading/Trailing/Top/Bottom` (move + opacity), `cardLift` (scale 0.95 + opacity).

Compose mapping: iOS spring(response R, dampingFraction ζ) → `spring(dampingRatio = ζ, stiffness = (2π/R)²)` (mass 1). E.g. response 0.4 → stiffness ≈ 246.7; 0.25 → ≈ 631.7; 0.5 → ≈ 157.9; 0.55 → ≈ 130.5.

Other recurring animation constants across components: entrance spring (0.55, 0.82) with 0.18s delay (CTA buttons); staggered-appear spring (0.42, 0.82); shimmer sweep 1.4s; research shimmer 1.9s; swipe-pill shimmer 1.7s; progress bar easeInOut 0.3s.

### 1.5 `DesignBundle.swift`
Exposes SPM `Bundle.module` as `Bundle.wagerproofDesign` so the app target can load kit resources (Lottie JSON, PixelOffice PNGs). Compose analog: resources live in the `:core:design` module's `res/`/`assets/`.

---

## 2. WagerproofSharedKit (2 files)

### `AppGroup.swift`
- App group id `group.com.wagerproof.mobile`; `AppGroup.defaults` = shared UserDefaults with `.standard` fallback (unit tests).
- Keys (`AppGroupKey`): `last_notification_route`, `theme_pref`, `admin_mode_enabled`, `widget_payload_v1`, `dummy_data_mode_debug`, `pro_entitlement_granted_v1`, `pro_subscription_type_v1`, `wagerbot_chat_model_debug`, and per-user `onboarding_complete/{userId}`.
- Android port: single `DataStore<Preferences>` shared with Glance widgets (same process) — keep the exact key strings for cross-platform mental parity; the pro-entitlement mirror keys matter for widget cold-start (never flash "free" while RevenueCat reconciles).

### `KeychainStore.swift`
- `actor` wrapping Security framework generic-password items; service `com.wagerproof.mobile`, optional access group; `kSecAttrAccessibleAfterFirstUnlock`; setString/getString/remove with update-then-add upsert.
- Android port: `EncryptedSharedPreferences` or Keystore-backed AES + DataStore; API surface: `suspend fun setString/getString/remove`.

---

## 3. Modifiers (WagerproofDesign/Modifiers)

### 3.1 `LiquidGlassBackground.swift` — the "GlassCard" primitive
Four overloads of `.liquidGlassBackground(in: Shape ...)`:
1. plain — iOS 26 `glassEffect(.regular, in: shape)`, fallback `.background(.ultraThinMaterial, in: shape)`
2. `tint:` — `.regular.tint(color)`; fallback = ultraThinMaterial + `shape.fill(tint.opacity(0.18))`
3. `interactive:` — `.regular.interactive()` (touch-driven refraction); fallback plain material
4. `tint: + interactive:` — combined.

**Compose recipe (the "fallback" tier is the target):** shape-clipped surface with (a) background blur of content behind — `Modifier.graphicsLayer` + `RenderEffect.createBlurEffect` on a backdrop capture, or Haze/`Modifier.blur` backdrop libs on API 31+, (b) translucent white/black scrim ~8-12% + optional tint at 18% alpha, (c) hairline stroke `white @ 0.25, 0.5dp` for the capsule variant. Pre-31 fallback: solid `appSurfaceElevated` at ~92% alpha.

### 3.2 `LiquidGlassCapsule.swift`
`ViewModifier` = the capsule specialization used by dozens of pill sites (scope banners, search/sort pills, info chips). Fallback tier = ultraThinMaterial capsule + `Capsule().stroke(white 0.25, 0.5pt)`. All pills must share identical visuals (matched-geometry seams).

### 3.3 `LiquidGlassDisc.swift`
- `LiquidGlassMergeContainer(spacing: 16)` — iOS 26 `GlassEffectContainer` fuses discs within 16pt into one blob (overlapping team logos on game rows). **No Compose equivalent — skip the merge**, render independent discs (that's exactly what iOS <26 does).
- `.teamGlassDisc(primary:secondary:tint:0.5,fallbackStroke:)` — fallback path (port this): `Circle` filled `appSurfaceElevated`, overlaid `LinearGradient(primary→secondary, topLeading→bottomTrailing)` at 0.45 opacity, ring `strokeBorder(fallbackStroke, 1.5)`.

### 3.4 `Shimmer.swift` — skeleton system
- `.shimmering(active:)`: masks the content's **alpha** with a moving 3-stop diagonal gradient (topLeading→bottomTrailing): stops `[black@0.35 @ phase, black @ phase+0.1, black@0.35 @ phase+0.2]`, parent mask `scaleEffect(3)`, `phase` animates 0→0.8 linear **1.4s** repeatForever. Only silhouettes glint, never the gaps. Reduce Motion → static.
- Skeleton primitives (fill `appSkeleton`): `SkeletonBlock(width?, height, cornerRadius=6)` (nil width = fill, left-aligned), `SkeletonCircle(diameter)`, `SkeletonCapsule(width?, height)`.
- Compose: draw skeleton shapes in `appSkeleton`, apply `Modifier.graphicsLayer(compositingStrategy = Offscreen)` + `drawWithContent { drawContent(); drawRect(brush = linearGradient(...), blendMode = BlendMode.DstIn) }` with an `infiniteTransition` phase — same masked-alpha trick.

### 3.5 `StaggeredAppear.swift`
`.staggeredAppear(index:)`: opacity 0→1 + offsetY 12→0, spring(0.42, 0.82), delay = `min(index, 6) * 0.04s` (cap so lazy-list rows deep down don't wait). Reduce Motion → instant. Compose: `remember { MutableTransitionState(false) }` per row + `animateFloatAsState` with `delayMillis = min(index,6)*40`.

### 3.6 `GlyphRippleOnChange.swift`
- Environment entry `\.glyphRippleEmitter: GlyphRippleEmitter?` — a container hosting a `PixelWaveBackground` injects its emitter; descendants stay decoupled.
- `.glyphRipple(on: trigger)`: tracks the view's global-frame center (`onGeometryChange`), and on any `trigger` change calls `emitter.emit(at: center)` → the pixel background ripples at the tapped chip. Compose: `CompositionLocal<GlyphRippleEmitter?>` + `onGloballyPositioned` + `LaunchedEffect(trigger)`.
- `GlyphRippleEmitter`: `@Observable` with `Pulse(point, token)` — monotonic token so repeat taps at the same point still fire.

---

## 4. Kit components (WagerproofDesign/Components + root)

### 4.1 `OfflineToolbarIcon.swift`
`wifi.slash` 17pt regular, `appAccentRed`, fixed 42×42 frame (matches WagerBot icon footprint so the toolbar never jitters when swapped). Non-interactive. a11y "Offline".

### 4.2 `WagerBotIcon.swift` — code-drawn robot glyph
Canvas-drawn (no asset), scales via `size` (default 24), stroke = `max(1, s*0.075)`, inherits foreground color like an SF Symbol. Geometry (fractions of s): antenna stem (0.5, 0.10)→(0.5, 0.22); antenna ball r=0.07·s centered (0.5, 0.04+r); head roundRect x .13 y .22 w .74 h .58, corner .18·s, stroked; eyes filled circles r .06·s at y .40, x = .5±.13; mouth line (.36,.62)→(.64,.62); ear notches at y .42 and .58: (.08→.13) and (.87→.92); shoulders (.30,.88)→(.70,.88). Round caps/joins throughout. **Port as a custom `ImageVector` or Canvas draw — exact fractions above.**

### 4.3 `ScopeBanner.swift`
Active-filter pill: HStack(8) — leading SF icon 15 semibold `appPrimary`; title 14 semibold **white** (renders over glass on any bg); Spacer; `xmark.circle.fill` 18 regular `appTextSecondary` clear button. Padding 12h/8v, `LiquidGlassCapsule`.

### 4.4 `OnboardingProgressBar.swift`
Track+fill rounded rect, defaults: widthFraction 0.70 of parent, height 12, corner 20, track `gray@0.15`, fill `gray@0.40`; fill width animates easeInOut 0.3s. Onboarding chrome passes track `white@0.12` + fill `accent@0.9`, fixed width 168-170, height 10-12.

### 4.5 `ContinueCTAButton.swift` (canonical CTA) and `OnboardingLiquidGlassButton.swift` (legacy)
Both: Capsule pill h=60, full width, label 18 bold white + optional trailing glyph (Text 22). Glass background with `tint = accentColor.opacity(0.65)` (interactive on the new one). ContinueCTA adds a specular overlay: capsule filled `LinearGradient(white@0.22 → clear, top→center)`. Shadows: `tint@0.30 r8 y4` + `black@0.08 r2 y1` (legacy: 0.40/0.10). Entrance: opacity 0→1 & offsetY 18→0, spring(0.55, 0.82) delayed 0.18s on appear. Disabled = 50% opacity (multiplies entrance), animates 0.2s easeInOut. Loading = white ProgressView replaces label, same footprint. Legacy adds `.sensoryFeedback(.impact(weight: .light))` per tap.

### 4.6 `OnboardingPageShell.swift`
Standard onboarding container. Two chrome variants:
- **Native chrome (default)**: NavigationStack, inline empty title (44pt bar), `toolbarBackground(.visible)`, leading back `chevron.left` 17 semibold tinted `appPrimary`, principal slot = progress bar (170×12), trailing optional "Skip" 14 bold `appTextSecondary`. CTA pinned via bottom safe-area inset.
- **Custom chrome**: fully transparent 48pt top band (so animated pixel background reads through): back chevron 16 semibold white in a 40×40 glass **disc** (`Circle`, tint white@0.10, interactive), centered progress bar (168 wide, h10, track white@0.12, fill ctaTint@0.9), trailing Skip 14 bold white@0.7; placeholders 52×44 keep the bar centered; band animates `easeInOut 0.2` on canGoBack.
- CTA bar: ContinueCTAButton, 16dp horizontal + 16dp bottom padding, max width 720 (iPad).
- Compose: Scaffold with transparent top bar; state-machine-driven pager (NOT back-stack navigation) — the shell takes `canGoBack/onBack/onSkip` callbacks.

### 4.7 `HoneydewOptionCard.swift` + `OptionCardIconChrome.swift` — animated promo/option card (the "animated search/promo card")
Layer stack (bottom→top), corner 23 continuous, minHeight 64:
1. Horizontal `LinearGradient(primaryColor → secondaryColor, leading→trailing)`.
2. **OptionCardIconChrome** — drifting SF-symbol ladder (below).
3. Fade overlay `LinearGradient(primaryColor → primaryColor@0, leading→trailing)` (icons dissolve into the left edge).
4. Foreground: title 17 bold white (+shadow black@0.12 r1 y1), subtitle 13 medium white@0.95; trailing **action pill**: `actionWord` + `chevron.right` 11 semibold, 13 semibold text, padding 12h/6v, `LiquidGlassCapsule` + stroke white@0.32 0.75pt + shadow black@0.18 r4 y1.
5. Card hairline `strokeBorder(white@0.12, 1)`; shadows black@0.10 r8 y3 + black@0.04 r2 y1.

**IconChrome math** (30 Hz frame loop; frozen at t=0 under Reduce Motion): 10 lanes with per-lane `(yBase, bob, bobSpeed, rotationDeg, sizePt, baseOpacity)` table:
```
(0.16,0.04,0.60,-14,18,0.72) (0.78,0.05,0.45,22,23,0.78) (0.32,0.03,0.72,-8,21,0.76)
(0.92,0.04,0.55,6,16,0.74)  (0.20,0.05,0.80,18,25,0.82) (0.62,0.03,0.50,-26,18,0.80)
(0.38,0.04,0.68,10,21,0.80) (0.85,0.05,0.88,-14,23,0.85)(0.50,0.03,0.78,4,16,0.75)
(0.55,0.04,0.62,-32,14,0.70)
```
Per icon i: `lanePhase = i/10 + seed`; `cycle = fract(t*0.040*speedFactor + lanePhase)`; x travels `1.05 → 0.45` (`x = 1.05 - cycle*0.60`, normalized width); `y = clamp(yBase + yJitter + bob*sin(t*bobSpeed + lanePhase*2π), 0.08, 0.92)`; opacity = `baseOpacity * clamp((x-0.50)/0.10) * clamp((1.00-x)/0.06)` (dual fade: dissolve on left, materialize inside right edge). Icons render in `primaryColor` at semibold lane size, rotated by lane rotation. Even phase spacing ⇒ freezing yields a uniform ladder.

### 4.8 `LottieView.swift`
UIViewRepresentable over lottie-ios; loads by base name from the design bundle; params: loopMode (.loop default), speed, autoplay, aspectFit, `backgroundBehavior = .pauseAndRestore`. Compose: `lottie-compose` (`rememberLottieComposition(RawRes/Asset)`).

---

## 5. Procedural backgrounds — exact math

All are Canvas + TimelineView (i.e. Compose `Canvas` + `withFrameNanos`/`infiniteTransition` time source), freeze under Reduce Motion, and are non-hit-testable (except the glyph field's tap ripple).

### 5.1 `PixelDotBackground.swift` — stateless dot field, 7 programmed animations
Grid: `cols = width/spacing + 1`, `rows = height/spacing + 1`, grid centered (origin = (size − (n−1)·spacing)/2). Defaults: spacing 26, dotSize 5.5, baseOpacity 0.05, peakOpacity 0.5, baseColor white, accent `appPrimary`, speed 1.0.
Per cell (u,v ∈ 0…1, flat index i, t = epochSeconds·speed):
- `opacity = base + (peak−base)·I`; skip if < 0.012.
- dot size `s = dotSize·(0.82 + 0.34·I)`; rounded-rect corner `s·0.32` (continuous).
- color = `base.mix(accent, by: min(1, I²·1.3))` — only the hottest dots go green.
- optional edge fade: `smoothstep(0,0.12,u)·smoothstep(0,0.12,1−u) · smoothstep(0,0.10,v)·smoothstep(0,0.10,1−v)`.

Intensity functions `I(u,v,i,t)` (smoothstep = Hermite; fract = x−floor(x); hash01(n) = fract(sin(n·12.9898)·43758.5453)):
- **aurora**: `n = (sin(u·2.6 + t·0.16) + cos(v·2.1 − t·0.12) + sin((u+v)·1.7 + t·0.20))/3`; `I = smoothstep(0.05, 0.9, n·0.5 + 0.5)`
- **wave**: `phase = (u·0.72 + v·0.28)·7.0 − t·1.5`; `I = smoothstep(0.45, 1.0, sin(phase))`
- **ripple**: `d = hypot(u−0.5, v−0.5)`; `ring = sin(d·26 − t·2.4)`; `I = smoothstep(0.35,1,ring) · (1 − smoothstep(0,0.75,d))`
- **rain**: `seed = hash01(i·2654435761 & 0xFFFF)`; `head = fract(t·(0.10 + seed·0.22) + seed)`; `behind = head − v`; `I = (−0.015 ≤ behind ≤ 0.26) ? max(0, 1 − behind/0.26) : 0`
- **twinkle**: `phase = hash01(i·97 + 13)·2π`; `I = (0.5 + 0.5·sin(t·1.7 + phase))³`
- **flow**: `p = sin(u·7 + t·0.6) + sin(v·6 − t·0.5) + sin((u+v)·5 + t·0.45) + sin(hypot(u−0.5,v−0.5)·12 − t·0.8)`; `I = smoothstep(0.15, 0.95, p/4·0.5 + 0.5)`
- **scan**: `pos = fract(t·0.11)`; `I = max(0, 1 − |v − pos|·8)`

### 5.2 `PixelGlyphField.swift` — stateful reaction-diffusion "glyph colonies" + tap ripples
Grid: `cols = round(width/26)`, `rows = round(height/26)` (defaults spacing 26, dotSize 5.5, peakOpacity 0.45); cells tile edge-to-edge (`cellW = width/cols`, dot centered per cell).

**Automaton** (value grid 0…1, stepped every `intervals` — default [0.15s]; hero ambient uses [0.3], high-intensity [0.12]):
```
for each cell: n = Σ 8 Moore neighbors
nv = v*0.5 + n*0.1            // survival=0.5, spread=0.1
if n > 2.2: nv *= 0.32        // crowd → coreDecay (hollow saturated cores)
nv -= 0.05                    // ambient erosion
next = clamp(nv, 0, 1)
```
After each step: stamp 1 random glyph (+ a 2nd with p=0.4); if `Σgrid < 2.5` stamp 2 more (never goes dark). `configure()` stamps 4 glyphs then pre-warms 3 steps. RNG = xorshift64* seeded per field (`state ^= state>>12; ^= state<<25; ^= state>>27; return state * 0x2545F4914F6CDD1D`), default seed `0x5EED1234` — per-card seeds keep cards out of lockstep.

**20 seed glyphs** ((dx,dy) offsets, stamped as max(cell,1.0) at a uniform random center): single spore; plus; 3×3 hollow ring; diagonal slash; X; T; 2×2 blob; pair; L corner; diamond; chevron up; chevron down; vertical bar; horizontal bar; triangle; twin verticals; staircase; spaced trio (−2,0)(0,0)(2,0); arrowhead; scattered cluster (−1,−1)(1,0)(0,1)(2,1).

**Display**: each frame eases previous→current grid with smoothstep of `elapsed/stepGap` (crossfade spans the full gap — no hold). Dot render identical to PixelDotBackground but `s = dotSize·(0.82 + 0.4·I)`, color mix `min(1, I²·1.2)`, only lit cells drawn (`opacity < 0.012` skipped — empty grid never rendered).

**Tap ripples** (max 8 live): for cell center (px,py) and each ripple aged `age ≤ 1.5s`: `radius = age·430 pt/s`; `delta = dist(cell, origin) − radius`; `ring = exp(−delta²/(2·26²))`; `level = max(ring · (1 − age/1.5))`. Final `intensity = max(automaton, ripple)`, `opacity = max(0.45·auto, 0.72·ripple)` — ripple cells outshine ambient. Ripples come from direct taps (only on taps that fall through foreground) or the external `GlyphRippleEmitter`.

### 5.3 `WaveBackground.swift` — three breathing shadow-wave sheets
Three sheets, same color as the background (`#111111`) filling from the TOP down to a wavy bottom edge; only their **drop shadows** are visible (default shadowColor black, strength 0.4, radius 16, offsetY 9; pixelwave ambient uses 0.28/18/8, high 0.5/22/10). Sheet params (baseline fraction, ampBase, phase): `(0.72, 17, 0.8)`, `(0.52, 13, 0.4)`, `(0.32, 9, 0.0)`; all share ampVary 4, ampSpeed 0.11, waveBase 1.4, waveVary 0.30, waveSpeed 0.05, scrollSpeed 0.08.

Per sheet at time t:
```
amp   = ampBase + 4·sin(t·0.11 + phase)
waves = 1.4 + 0.30·sin(t·0.05 + phase·1.3)
k     = waves·2π / width
scroll= t·0.08·2π
edgeY(x) = height·baseline + amp·sin(x·k + scroll + phase)
```
Path: top-left → top-right → down right edge to `edgeY(width)` → polyline back sampling every 6pt → close. Fill with drop-shadow filter. Drawn back-to-front (lowest baseline first). Compose: `Paint` with `BlurMaskFilter`-shadowed path or draw the path twice (offset+blurred black, then sheet color).

### 5.4 `PixelWaveBackground.swift` — the composed "pixelwave" hero/auth backdrop
ZStack: (1) opaque vertical gradient `#111111 → #111111 → #0F100F`; (2) sheen gradient white@0.035 → 0 @ 0.5 → white@0.025; (3) `WaveBackground` + `PixelGlyphField` tinted by `accentColor`, both multiplied by `calm = 1 − 0.5·progress` (hero-collapse fade; never calms at `.high`).
- `intensity: .ambient` → glyph interval 0.3s, spacing 26, dot 5.5, peak 0.45, wave shadows 0.28/18/8.
- `.high` (generation-complete flash) → interval 0.12s, spacing 22, dot 6.5, peak 0.9, shadows 0.5/22/10.
- `screenAnchored: true`: field is sized to the full screen and offset by `−globalOrigin` so multiple instances (page + hero mask in `CollapsingWidgetScroll`) paint identical pixels; masked by a top-weighted gradient (white @0 → white @0.26 → clear @0.58 of screen height); hit-testing disabled when anchored (field would swallow scroll drags).
- `AnimatedAccentPixelWave` wraps it with `Animatable` scalar `blend` to tween the accent (`from.mix(to, blend)`) because Canvas fills can't be color-interpolated by the framework; snapshot `currentMixedColor` as the next transition's `from` so interrupted animations don't jump. Compose: `animateColorAsState` handles this natively.

---

## 6. PixelOffice SpriteKit simulation (app target — rebuild as Compose Canvas + `withFrameNanos`)

Files: `Wagerproof/Features/Agents/Components/PixelOffice.swift` (SwiftUI host + control chips), `PixelOfficeSceneRepresentable` (SKView bridge, **30 fps preferred**, bg `#0F1118`), `PixelOfficeScene.swift` (sim), `PixelOfficeAgentNode.swift` (per-agent node), `PixelOfficeAssets.swift` (all constants), `PixelSpriteAvatar.swift` (standalone avatar), plus `WorkingDeskAvatar/SitWorkSprite/LaptopSprite` in `AgentResearchIdleCard.swift`.

### 6.1 Geometry & assets
- Logical map: **864 × 800** (top-down, y grows down; SpriteKit flips — Compose can draw top-down natively). Container is `aspectRatio(864/800)`, clipped to corner 20.
- Sprite sheets `avatar_0…avatar_7.png`: **384×576 px = 8 cols × 9 rows of 48×64 frames**. Frame index counts left-to-right, top-to-bottom. **Nearest-neighbor filtering everywhere** (`FilterQuality.None`).
- Floors `floor_{standard|future}_{day|night}.png` (1071×992) — the ONLY background layer (contains the whole office; `office_bg.png` 864×800 is a fallback only, `office_fg.png` 864×800 is the foreground overlay drawn over agents). Laptops `office_laptop_{front|back|left|right}_{open|close}.png` (32×64).
- Floor style persisted under key `pixel-office-floor-style` (default `"future"`), time mode `pixel-office-time-mode` (default `"auto"`; night = hour ≥ 19 || < 6). Floor key = `floor_{style}_{day|night}`. Control chips (bottom-right glass capsules): time `☀️/🌙 + Auto|Day|Night` (cycle auto→day→night→auto) and floor `🏢 Standard / 🚀 Future`.

### 6.2 Animations (4 frames each, indices into the 8×9 sheet)
```
front_idle [0-3]      front_walk [4-7]      front_sit_idle [8-11]   front_sit_work [12-15]
left_idle  [16-19]    left_walk  [20-23]    left_sit_idle  [24-27]  left_sit_work  [28-31]
right_idle [32-35]    right_walk [36-39]    right_sit_idle [40-43]  right_sit_work [44-47]
back_idle  [48-51]    back_walk  [52-55]    back_sit_idle  [56-59]  back_sit_work  [60-63]
front_done_dance [64-67]   front_alert_jump [68-71]
```
Frame rate: **6 fps** normally, **2 fps** when arrived+idle (PixelSpriteAvatar standalone uses 2.5, SitWorkSprite close-up uses 5). Walk speed **110 px/s** (map coords). Facing→sheet dir: down→front, up→back, left→left, right→right.

### 6.3 Interaction points (map coords, facing)
- **8 desks (bullpen)**: (112,544,down) (176,544,down) (304,544,down) (368,544,down) (112,672,up) (176,672,up) (304,672,up) (368,672,up) — keys `desk_0…7`, activity `working`.
- **20 idle spots**: (240,96,down) (304,96,down) (48,128,right) (112,128,right) (528,160,down) (560,160,down) (592,160,left) (624,160,left) (400,192,down) (688,192,down) (752,192,left) (784,192,left) (80,224,down) (144,224,down) (304,352,down) (336,352,down) (368,352,down) (304,416,up) (336,416,up) (368,416,up) — keys `idle_0…19`.
- **8 meeting seats**: (656,480,down) (720,480,down) (592,512,right) (784,512,left) (592,576,right) (784,576,left) (656,608,up) (720,608,up) — keys `meeting_0…7`.
- **16 laptops** (top-left coords, dir): idx0 (608,448,right) 1 (640,448,down) 2 (704,448,down) 3 (736,448,left) 4 (96,512,down) 5 (160,512,down) 6 (288,512,down) 7 (352,512,down) 8 (608,512,right) 9 (640,512,up) 10 (704,512,up) 11 (736,512,left) 12 (96,576,up) 13 (160,576,up) 14 (288,576,up) 15 (352,576,up). Laptop→seat map: {0:10, 1:8, 2:9, 3:11, 4:0, 5:1, 6:2, 7:3, 8:12, 9:14, 10:15, 11:13, 12:4, 13:5, 14:6, 15:7}. A laptop draws OPEN when its mapped desk seat (0-7) is occupied by a working/thinking/error agent; conference seats 8-15 never open. Drawn 32×64 at top-left (x, y).

### 6.4 A* pathfinding
Tile = **32 px** → grid **27 cols × 25 rows**. Collision bitmap ('1' walkable, '0' blocked), 25 rows of 27 chars:
```
000000000000000000000000000
000000000000000000000000000
000000011110000000000000000
010111111110000000000000000
011111111110000001110111100
011110011100110111110111100
011010011100111110010111100
011110011100111111111111100
000000111111111111111111100
000000111111111000000000000
000000111111111000000000000
011110111111111000000000000
000110111111111000001111100
001110111111111011111111110
011111111111111011111111110
011111111111111011100000110
011111111111111011100000110
010000010000011111100000110
010000010000011111111111110
010000010000011111111111110
010111010111011000000000000
011111111111111000000000000
000000000000000000000000000
000000000000000000000000000
000000000000000000000000000
```
8-directional A*: orthogonal cost 1, diagonal 1.4; heuristic = Manhattan `|Δc|+|Δr|`; **end tile allowed even if blocked** (points sit on furniture); diagonals may not cut corners (both orthogonal neighbors must be clear); abort after 2000 closed nodes; no-path fallback = direct single tile. Returns tile centers (col·32+16, row·32+16) excluding the start tile.

### 6.5 Simulation loop (dt clamped to 0.1 s)
1. **Roster** (≤ 8 agents = desk count): spawn at shuffled points (idle+meeting+desks) with ±4 px jitter, facing down, front_idle. Staggered forced routing at `0.6 + i·0.4 s`. **Periodic churn every 5 s**: one random agent gets a new state — active agents pick from `[working, thinking, done, working, thinking, idle]`, inactive from `[idle, idle, idle, thinking]`.
2. **State→destination**: working/thinking → claim a desk; done → idle spot; idle → idle-or-meeting; error → stay put. Fallback: any unclaimed point. Claim set prevents double occupancy; releasing frees the point. Bubble emoji comes from an activity→emoji table (☕ 🍕 📺 🎮 🔥 💤 💭 🍿 📚 💬 ❄️ 💧 🐶 🎯 🌿 🍺 — dormant with the current activity set).
3. **Movement**: segment progress `+= walkSpeed·dt / segLen`; on ≥1 advance to next tile; after last tile, final approach to the exact point (snap if < 4 px, else append a final segment); direct-move fallback when no path (snap < 3 px). Facing = dominant axis of the current segment.
4. **Anim key**: walking → `{dir}_walk`; arrived: done → `front_done_dance`, error → `front_alert_jump`, working/thinking at a desk → `{pointDir}_sit_work` / `{pointDir}_sit_idle`, else `{dir}_idle`.
5. **Draw position**: sprite center = `(mapX, mapY − 24)` in top-down coords (foot-anchor lift = frameH/2 − 8). Depth-sort by mapY (z = 3 + mapY/800·0.9), between laptops (z2) and foreground (z4).
6. **Name tag** (drawn above foreground, z≈100 rel): state pill 84×21 r5, `AvenirNext-Heavy` 13 white, fill = state color, at y −82 above center; name box 116×22 r4, fill `#0A0C12@0.85`, stroke agent accent 1.5, `AvenirNext-Bold` 15 `#E0E4EC`, text `emoji + name` truncated at 13 chars, at y −56. **Label de-collision**: 10 relaxation passes/frame — tags within a 52-px vertical band push apart until centers ≥ 118 px (2·56 + 6), offsets clamped ±74, applied with per-frame lerp `min(1, dt·9)` (glides back to 0 when free).
7. **Particles** (pool ≤ 30, spawn tick every 0.3 s): night-only monitor glow — for each arrived working agent, p=0.4: spawn at (x±8, y−24), color `rgba(45,212,191,0.35)` (teal), vx ±3, vy −5−rand5, r 2-4, maxLife 1.2. (Coffee steam white@0.5 and fire embers orange `rgb(255,140,0)@0.7` are ported but dormant.) Update: `life −= dt/maxLife`, pos += v·dt, `opacity = life·0.5`; drawn as antialias-off circles.
8. **State colors**: idle `#94A3B8`, working `#F97316`, thinking `#8B5CF6`, done `#22C55E`, error `#EF4444`. Labels: RESTING / WORKING / THINKING / DONE / ERROR (inactive agents show OFF). Derived display state: inactive→idle/OFF; generated today→done/"PICKS READY"; else working/WORKING.
9. Pause when tab off-screen / app backgrounded (scenePhase).

### 6.6 Sprite avatars outside the office
- `PixelSpriteAvatar(spriteIndex, animated)` — front-idle 4-frame loop @ 2.5 fps, phase-offset by spriteIndex so a row of cards bobs out of sync; frames cropped once per sheet and cached; nearest-neighbor.
- `WorkingDeskAvatar` (research card / detail hero): `frontSitWork` loop @ 5 fps at charHeight (default 120; width = h·48/64), open front laptop sprite composited in FRONT at 0.60·h height offset down 0.22·h, over an accent floor-glow ellipse (w = 2.3·charW, h = 0.42·charH, opacity 0.30, blur 28, offset y 0.36·h).

---

## 7. App-target signature components (parity-critical)

### 7.1 `AgentPickTicket.swift` — boarding-pass pick ticket
- **PickTicketShape**: rounded rect r22 (continuous) + two circles r9 punched at (minX, notchY) and (maxX, notchY), filled **even-odd** so the notches are true holes; then `clipShape(RoundedRectangle 22)` trims the outer half-circles. Compose: `Path` with `fillType = EvenOdd` + clip.
- Compact ticket: fixed 250 tall, notch/tear at y=150. Cardstock = vertical gradient `#141927 → #0D101A`; hairline `white@0.07 1pt`; shadow black@0.22 r5 y2 (deliberately light — tickets stack 10 pt apart in the folder).
- Top section: date (15 medium, textPrimary@0.85) + status chip (11 heavy, tracking 0.6, status color on `status@0.16` r8); **route row** "AWAY ·——🏈——· HOME": team end = logo disc (size = code·1.25) stacked above abbreviation (code·0.8 heavy **rounded**); route = status-colored 6-px dots + dashed lines (white@0.22, dash [3,4]) + sport SF glyph; below: away name / bet type / home name (12, textSecondary). Perforation: dashed line white@0.16, dash [5,5].
- Bottom stub: 3 stamps (label 12 secondary / value 16 semibold **monospaced**) Market·Odds·Units; selection line 15 heavy; confidence `gauge.medium` + "n/5" in agent accent.
- `teaserBlur` mode: stub blurred 6 (+bet type 5) behind a lock capsule (`lock.fill` + "Unlock in the app", accent on `#0D101A@0.85`, accent@0.5 border).
- Expanded variant (`ExpandedAgentPickTicket`): notch at 200, gradient `#151A28 → #0D101A`, ghosted sport symbol 110 pt white@0.05 top-trailing, detail grid rows (label 13 secondary / value 17 semibold monospaced), Selection + SUMMARY + KEY FACTORS blocks (headers 11 heavy tracking 1), optional "View data audit" accent-tinted button (accent@0.12 fill, accent@0.35 border r10), optional brand footer (16-px logo + "Wager"+"Proof" 13 heavy, "Proof" in `#00E676`); bottom padding 110 unbranded (tail hides in the folder pocket) / 22 branded.
- `PickTeamAvatar`: deliberately **flat** (no glass — dozens render at once): circle `appSurfaceElevated` + team gradient@0.45 + 1.5 ring; luminance-aware contrast plate behind same-color logos (dark mode: `white 0.78@0.15` if lum<0.45; light: `black@0.55` if lum>0.6).

### 7.2 `PickHistoryFolder.swift` — manila folder + rolodex sheet
- **Folder shapes**: `PickFolderFrontShape` (left brim 26 below the right tab, 34-pt chamfer at 46% width; top r18, bottom r26) and `PickFolderTabShape` (back flap: tab to 52% width, chamfer down 30, r18). Both rendered as Liquid Glass (`glassEffect` / ultraThinMaterial fallback via a local `folderGlass` helper that accepts plain Shapes) + stroke white@0.08.
- Closed card (`AgentPickFolderCard`, 264 tall, front 140): up to 3 newest tickets peek from the top, offsets x [−6, 5, −3], y `26 − i·10`, tilts [−1.4°, 1.0°, −0.6°], reversed z; embossed "PICK HISTORY" (19 heavy rounded, tracking 3, white@0.12, shadow black@0.5 y−1); accent count chip bottom-trailing ("N picks" + `arrow.up.right`, accent@0.14 capsule, accent@0.35 border).
- Sheet (`PickHistorySheet`): detents [440 pt, large], bg `#0B1011` + top radial agent-accent glow (accent@0.30 → clear, radius 420). Folder sandwich: back flap behind (gradient `#151A25→#0C0F17`, h232), ticket stack between, glass front (h234, "PICK HISTORY" 28 heavy rounded tracking 4 white@0.10) in front.
- **Rolodex**: `VStack(spacing: −122)` fans the pile; deterministic jitter x [−8,7,−4,9,−6,3] / tilt [−1.6,1.2,−0.7,1.8,−1.1,0.5]°. Per-ticket scroll-position effect ("wallet physics"): with `mouth = viewportH − 236`, `zoneTop = mouth − 130`, `into = max(0, y − zoneTop)`, `residual = min(into·0.18, 200)`, ticket offsets up by `into − residual` (squashes into the folder), `scale = 0.92 + 0.08·topFade` anchored bottom, `opacity = topFade·buried` where `topFade = clamp((y−8)/56)` (rolodex fade at the top) and `buried = clamp(1 − (residual−150)/45)`. Compose: `graphicsLayer` driven by `LazyListItemInfo.offset`.
- Unstack gesture: tap or detent→large scrolls to y=600 with spring(duration 0.55). Scroll haptics: light tick every 64 pt of travel. Filter pills (Result/Sport/Sort): glass capsules, 14 semibold, minHeight 38, active = tint text + tint@0.5 border — **this is the app's FilterPill pattern**.

### 7.3 `AgentPickFocusView.swift` — print-then-swipe presentation (receipt printer)
- Tap-to-focus: dark backdrop `black@0.74` over ultraThinMaterial; card scales in from 0.9; header "Play n/N" (13 heavy, `contentTransition(.numericText())`) + up to 8 pager dots (6 px, accent vs white@0.25).
- **Print intro** (fresh generation): (1) high-intensity `PixelWaveBackground` washes over the whole screen (opacity 1), holds **850 ms**, fades out 0.5 s easeOut; (2) **receipt feed**: first ticket rises out of a slot bar in **12 chunks × 140 ms**, each chunk animated easeOut 0.13 with a light haptic @ intensity 0.6 (stuttering paper), finishing with success + spring(0.5, 0.85) hand-off; slot bar = capsule h7, gradient `#2C313C→#0E1016`, inner black@0.7 line h2, top white@0.14 highlight h1, shadow black@0.55 r8 y−2. CoreMotion pre-warmed at chunk 3.
- After printing: horizontal `TabView` pager (page style, no index) of vertically scrollable expanded tickets; current page **leans with the accelerometer** via `PickTicketMotion`: max tilt ±8° on both axes (`rotation3DEffect`, perspective 0.5).
- **PickTicketMotion** (port with Android `TYPE_ROTATION_VECTOR` @ 60 Hz): baseline primes on first sample (starts flat anywhere); `target = clamp(delta, ±0.35 rad)/0.35`; per-frame low-pass `value += (target − value)·0.09`; baseline drifts toward held attitude at 0.04/frame (sustained tilt self-centers); `goLive()` gate keeps leans flat during the feed.
- Share: renders just the card via `ImageRenderer` (scale 3, transparent) → share sheet. Compose: draw the composable into a `GraphicsLayer`/`Picture` bitmap.

### 7.4 `CollapsingWidgetScroll.swift` — iOS-Weather collapsing hero + pinned sections
- Shell: `heroMaxHeight` 230 default, `heroMinHeight` 60; `progress = clamp(scrollY / (max−min))`; hero is a top **overlay** at `height = max − (max−min)·progress`, clipped, with the shared background painted behind it (opaque → masks content scrolling under); content top-padded by `heroMax + heroTopInset + gap`. Scroll offset read once (Compose: `ScrollState.value` / `derivedStateOf`). Pin line for cards = `heroMin + heroTopInset` (via environment/CompositionLocal).
- `WidgetCollapsingSection`: header band fixed 48; when the card's natural top passes the pin line by `over`, the card pins (offset y = over), its **height shrinks** (`H − min(over, H−48)`) with the body clipped in a window under the header (body offset −collapse), all four rounded corners visible; at full collapse the header-pill **fades out in place over 44 pt** as the next header arrives (never slides under the hero); collapsing card zIndex 1. Natural height cached only while unpinned; `contentKey` change resets it. Header row: SF icon 13 semibold + UPPERCASE title 13 semibold tracking 0.6, both `appTextSecondary`, optional accessory (tap-hint / chevron / verdict badge). Card surface = Liquid Glass (`liquidGlassBackground(in: r=WidgetCard.corner)`).
- `TeamAuraBackground`: opaque `appSurface` base + two static ellipse glows (300×580, radial `color@0.85 → 0` end-radius 186, blur 48) hugging the left (away) and right (home) screen edges, centered at **global** y=210 (global anchoring keeps page + hero instances aligned); with progress: `opacity = 1 − 0.45p`, `scale = 1 − 0.30p`; rasterized once (`drawingGroup` → Compose `graphicsLayer` with `renderEffect`/offscreen).

### 7.5 `AgentResearchIdleCard.swift` pieces (the "animated research card")
- `WorkingDeskAvatar` — see §6.6.
- `ResearchShimmerText`: dim text `white@0.34` (15 heavy, kerning 0.5) + bright band overlay (width = max(56, 0.5·w), gradient clear-white-clear) masked to the glyphs, blend `plusLighter`, sweeping `x = phase·(w+band) − band`, linear 1.9 s repeatForever. The "iOS thinking" motif.
- `SwipeToGeneratePill` (swipe-to-commit, h 56, thumb inset 4): track white@0.08 + border white@0.12; ignition fill capsule width = `progress·maxDrag + thumb + insets`, gradient `[accent, accent, #FFE7A6]`, `opacity 0.4 + 0.6p`, `brightness +0.12p`, glow shadow `accent@(0.8p) radius 16p`; label rendered twice (white@0.82 base, black masked to the fill width) so glyphs recolor under the fill, plus a plusLighter shimmer sweep (band max(70, 0.26w), 1.7 s); thumb = white circle with `chevron.right` (→ `sparkles` on commit); haptics: soft impact per 1/14th of travel with intensity `0.35 + 0.65p`, success + heavy impact at commit (>90 %), rigid@0.5 on spring-back (spring 0.3/0.7). Disabled = static locked capsule (`lock.fill` + title, white@0.08). Accessibility: exposed as a plain button.

### 7.6 Smaller signature pieces
- `ThinkingAnimation` (terminal panel): bg `#070A0A` r16, border `#00E676@0.25`; header `terminal://agent-thinking` 12 mono `#9FB3AD`; rows `›` prompt in `#00E676`, history lines 14 mono `#8CA89B`, active line 14 mono `#00E676` typed at 18 ms/char (initial delay 250 ms, 350 ms between lines) with a `█` cursor blinking at 0.5 s; "Step n of N" footer.
- `GlowingCardWrapper` (top-3 leaderboard halo): two stroked rounded rects behind content — outer r+4, 4-pt gradient stroke primary/secondary@0.6, blur 6; inner r+2, 1-pt full-strength gradient stroke, blur 1; padding −3. Static (animated color cycle intentionally dropped, FIDELITY-WAIVER #071).
- `AgencyStatsPill`: `+X.XXu · NN% · a/b` — 11 heavy rounded, glass capsule (11h/6v padding); net-units green `#4ADE80` / red `#F87171`, rest white.
- `OfflineToolbarIcon`, `ScopeBanner` — see §4.

---

## 8. Resources inventory

### 8.1 `WagerproofDesign/Resources/Lotties/` (9 JSON, load via lottie-compose)
| File | Size | Use |
|---|---|---|
| ChattingRobot.json | 189 KB | WagerBot chat |
| FullscreenGreen.json | 50 KB | fullscreen celebration |
| Leaderboard.json | 23 KB | leaderboard empty/hero |
| RobotAnalyzing.json | 150 KB | agent analyzing |
| RobotCoding.json | 196 KB | agent generation |
| WaveLinesAnimation.json | 10 KB | wave accent |
| confetti.json | 65 KB | success confetti |
| face-recognition-mobile.json | 202 KB | bet-slip scan |
| pulselottie.json | 3 KB | live pulse dot |

### 8.2 `WagerproofDesign/Resources/PixelOffice/` (22 PNG, all nearest-neighbor)
| Asset | Dimensions | Notes |
|---|---|---|
| `avatar_0…avatar_7.png` (8 sheets) | 384×576 | 8×9 grid of 48×64 frames, 18 anims (§6.2) |
| `floor_standard_day/night.png`, `floor_future_day/night.png` | 1071×992 | full office scene incl. furniture/lighting; drawn scaled to 864×800 logical |
| `office_bg.png` | 864×800 | fallback only (unused when floors load) |
| `office_fg.png` | 864×800 | foreground overlay (chairs/plants) drawn over agents |
| `office_laptop_{front,back,left,right}_{open,close}.png` (8) | 32×64 | desk laptops, open = seat occupied |

### 8.3 App target `Wagerproof/Assets.xcassets`
- `AppIcon.appiconset` (+ two `.icon` bundles `AppIcon.icon` / `AppIcon 2.icon` at repo root for the iOS 26 icon format).
- `WagerproofLogo.imageset` — single universal `wagerproofrawlogo.png`, `preserves-vector-representation`. Used in the ticket brand footer + share cards.
- **No color sets, no named colors, no other image sets.** No custom fonts anywhere in the repo.
- `WagerproofServices/Resources/nfl_dryrun_prop_best_books.json` — data fixture, not design.

---

## 9. SF Symbols — full deduplicated usage inventory

Counted across `Wagerproof/`, `WagerProofWidgetExtension/`, and `WagerproofKit/Sources/` (patterns `systemName:` **and** `systemImage:`, third-party `.build` excluded): **473 total usages, 145 unique symbols** (294 via `Image(systemName:)`, 175 via `Label/systemImage:`, 4 in the widget extension).

Full list (count):
chevron.right (29), checkmark (21), chart.line.uptrend.xyaxis (19), lock.fill (16), xmark (14), info.circle (14), brain.head.profile (14), bolt.fill (13), arrow.clockwise (13), exclamationmark.triangle.fill (10), exclamationmark.triangle (10), chart.bar.fill (10), info.circle.fill (9), flame.fill (8), chevron.left (8), clock (7), arrow.right (7), square.grid.2x2.fill (6), target (5), sportscourt.fill (5), sparkles (5), chevron.up.forward (5), chevron.down (5), chart.bar.xaxis (5), trophy.fill (4), plus (4), link (4), lightbulb.fill (4), gearshape (4), gauge.medium (4), football (4), doc.on.doc (4), clock.arrow.circlepath (4), bubble.left.and.bubble.right.fill (4), baseball (4), arrow.down (4), wind (3), thermometer.medium (3), square.and.arrow.up (3), number (3), exclamationmark.circle (3), crown.fill (3), chart.bar (3), bolt.badge.automatic (3), arrow.up.right (3), arrow.up (3), xmark.circle.fill (2), wifi.slash (2), trash (2), sum (2), slider.horizontal.3 (2), scope (2), rectangle.stack.fill (2), rectangle.portrait.and.arrow.right (2), plus.circle.fill (2), person.crop.circle.badge.exclamationmark (2), person.3.fill (2), mic.fill (2), magnifyingglass (2), lightbulb (2), hand.tap.fill (2), gearshape.fill (2), figure.baseball (2), envelope.fill (2), checkmark.shield.fill (2), checkmark.seal.fill (2), checkmark.circle.fill (2), checkmark.circle (2), checklist (2), chart.line.flattrend.xyaxis (2), calendar.badge.exclamationmark (2), bubble.left.and.text.bubble.right.fill (2), bell.badge.fill (2), basketball (2), baseball.diamond.bases (2), at (2), arrow.up.arrow.down (2), arrow.left.arrow.right (2), arrow.left (2), applelogo (2), waveform (1), wand.and.stars (1), trophy (1), trash.fill (1), timer (1), ticket.fill (1), text.book.closed (1), text.badge.checkmark (1), terminal (1), square.and.pencil (1), sportscourt (1), shippingbox.fill (1), shield.fill (1), rectangle.grid.2x2.fill (1), pin.fill (1), person.fill (1), person.crop.circle.fill (1), person.crop.circle.badge.questionmark (1), person.crop.circle.badge.checkmark (1), person.crop.circle (1), person.2.fill (1), person.2.badge.gearshape.fill (1), pause.circle (1), medal.fill (1), medal (1), lock.shield.fill (1), lock.open.fill (1), list.bullet (1), line.3.horizontal.decrease.circle (1), line.3.horizontal.decrease (1), hourglass (1), hammer.fill (1), graduationcap.fill (1), graduationcap (1), football.fill (1), figure.basketball (1), envelope.badge (1), ellipsis.circle (1), dollarsign.circle.fill (1), doc.text.image (1), doc.text.fill (1), doc.on.doc.fill (1), diamond.fill (1), cpu (1), clock.fill (1), clock.badge (1), clock.arrow.2.circlepath (1), circle.lefthalf.filled (1), chevron.backward (1), chart.line.uptrend.xyaxis.circle (1), chart.bar.xaxis.ascending (1), building.2.fill (1), building.2.crop.circle (1), bubble.left.and.exclamationmark.bubble.right (1), book.fill (1), bolt.slash (1), bell (1), banknote (1), bandage (1), arrow.up.right.square (1), arrow.up.circle.fill (1), arrow.turn.down.right (1), arrow.clockwise.circle.fill (1), antenna.radiowaves.left.and.right (1), 5.circle.fill (1).

Plus dynamic symbol names built at runtime: `pick.sport.sfSymbol` (per-sport glyphs: football/basketball/baseball family) and symbols passed as data into `HoneydewOptionCard` (crown.fill, gift.fill, star.fill, dollarsign.circle.fill, headphones, message.fill, hand.wave.fill, heart.fill, ellipsis.bubble.fill, person.2/3.fill, rosette, trophy.fill, flame.fill, bolt.fill, sparkles, chart.line.uptrend.xyaxis — from preview/callers).

---

## 10. Compose porting notes

### 10.1 Icon strategy — Material Symbols (rounded style) mapping for the top symbols
Use **Material Symbols Rounded** (matches the app's rounded-font personality). Suggested mapping:

| SF Symbol | Material Symbol |
|---|---|
| chevron.right/left/down, chevron.backward | `chevron_right` / `chevron_left` / `expand_more` |
| checkmark, checkmark.circle(.fill), checkmark.seal.fill | `check`, `check_circle`, `verified` |
| chart.line.uptrend.xyaxis / flattrend | `trending_up` / `trending_flat` |
| lock.fill / lock.open.fill / lock.shield.fill | `lock` / `lock_open` / `shield_lock` |
| xmark, xmark.circle.fill | `close`, `cancel` |
| info.circle(.fill) | `info` |
| brain.head.profile | `psychology` |
| bolt.fill / bolt.slash / bolt.badge.automatic | `bolt` / `flash_off` / `flash_auto` |
| arrow.clockwise | `refresh` |
| exclamationmark.triangle(.fill) / exclamationmark.circle | `warning` / `error` |
| chart.bar.fill / chart.bar.xaxis | `bar_chart` / `analytics` |
| flame.fill | `local_fire_department` |
| clock / clock.arrow.circlepath | `schedule` / `history` |
| arrow.right/left/up/down, arrow.up.right | `arrow_forward` etc., `arrow_outward` |
| square.grid.2x2.fill | `grid_view` |
| target / scope | `target` (or `my_location`) |
| sportscourt.fill, basketball, figure.basketball | `sports_basketball` |
| football | `sports_football` |
| baseball, figure.baseball, baseball.diamond.bases | `sports_baseball` |
| sparkles / wand.and.stars | `auto_awesome` |
| trophy(.fill), medal(.fill) | `trophy`, `military_tech` |
| crown.fill | `crown` (Material Symbols has `crown`) |
| gauge.medium | `speed` |
| gearshape(.fill) | `settings` |
| link | `link` |
| lightbulb(.fill) | `lightbulb` |
| doc.on.doc | `content_copy` |
| bubble.left.and.bubble.right.fill | `forum` |
| square.and.arrow.up | `share` (deliberately Android-native) |
| magnifyingglass | `search` |
| slider.horizontal.3 / line.3.horizontal.decrease | `tune` / `filter_list` |
| person.* family | `person`, `group`, `groups`, `manage_accounts` |
| wifi.slash | `wifi_off` |
| terminal | `terminal` |
| ticket.fill | `confirmation_number` |
| envelope.fill / envelope.badge | `mail` / `mark_email_unread` |
| bell / bell.badge.fill | `notifications` / `notifications_active` |
| banknote / dollarsign.circle.fill | `payments` / `paid` |
| thermometer.medium, wind | `device_thermostat`, `air` |
| rectangle.portrait.and.arrow.right | `logout` |
| cpu | `memory` |
| hourglass, timer | `hourglass_top`, `timer` |

Custom vectors required (no good Material analog): **WagerBotIcon** (already code-drawn — port the Canvas math in §4.2), `baseball.diamond.bases` if the rounded style lacks it, `applelogo` (only on iOS-specific auth — replace with Google logo on Android), `gauge.medium` if `speed` reads wrong in context.

### 10.2 Rounded-font substitutes (Google Fonts)
SF Rounded is used for: display titles, odds values, ticket team codes, embossed folder label, stats pill. Candidates, in order of fidelity:
1. **Nunito** (+ Nunito Sans for body) — closest overall metrics to SF Rounded at bold/heavy; variable weight axis covers medium→black. Recommended default.
2. **M PLUS Rounded 1c** — rounder terminals, great at heavy weights (odds/display), slightly wider.
3. **Varela Round** — single weight only; usable for the embossed "PICK HISTORY" label but not a ramp.
4. Honorable mention: **Quicksand** (geometric-rounded, lighter feel), **Baloo 2** (for the heaviest 'heavy/black' display uses).

Strategy: `FontFamily(appRounded = Nunito)` for `displayLarge/display/odds*` + team codes; default Roboto (or Inter) for body/caption; `FontFamily.Monospace` (or JetBrains Mono/Roboto Mono) for ticket stamp values and the terminal panel.

### 10.3 Liquid Glass on Android
- **API 31+ (RenderEffect)**: implement `liquidGlassBackground(shape, tint?, ...)` as a Modifier that draws a blurred snapshot of the content **behind** the surface. Practical approach: use the Haze library (`dev.chrisbanes.haze`) — `hazeSource` on the background layers, `hazeEffect` on each pill/card with `HazeStyle(blurRadius = 24-36dp, tint = white@0.08 dark / black@0.04 light, noise)`; add tint overlay `tint@0.18` when requested, and hairline `Border(0.5dp, white@0.25)` for capsules.
- **Pre-31 fallback**: translucent solid — `appSurfaceElevated@~0.92` + tint@0.18 + hairline. Mirrors iOS's own two-tier design, so parity is guaranteed by porting the *fallback* faithfully and treating real blur as an enhancement.
- Skip entirely: `GlassEffectContainer` disc-merging and `.interactive()` touch refraction (iOS 26-only sugar; iOS <26 does without them). Optionally fake interactivity with a pressed-state scale 0.98 + highlight.
- Performance: one `hazeSource` per screen background; never nest blurs; the folder/rolodex intentionally avoids per-disc glass (§7.1 PickTeamAvatar) — keep that.

### 10.4 Frame-loop guidance
- Procedural fields (PixelDot, Glyph, Wave): single `Canvas` composable redrawn from a `produceState`/`withFrameNanos` time value; do math in the draw lambda (it's ~700 cells at most). Cache `Paint` objects; use `drawRoundRect` per dot.
- PixelOffice: one Canvas at 864×800 logical units scaled to width; `withFrameNanos` loop stepping the sim (dt clamp 0.1 s, target 30 fps — skip alternate frames); sprite frames via `drawImage(srcOffset/srcSize)` from the decoded sheets with `FilterQuality.None`; `Bitmap.Config.HARDWARE` for the floor.
- Respect "Remove animations" (`Settings.Global.ANIMATOR_DURATION_SCALE == 0` or the a11y `isTouchExplorationEnabled` analog) everywhere iOS checks Reduce Motion.
- Haptics: map iOS impact light/medium/heavy/soft/rigid → `HapticFeedbackConstants` (`CLOCK_TICK`/`KEYBOARD_TAP`/`LONG_PRESS`/`VIRTUAL_KEY`) or `VibrationEffect.createPredefined`; the swipe-pill intensity ramp needs `VibrationEffect.createOneShot(amp)`.

### 10.5 File → Kotlin checklist (`com.wagerproof.core.design`)

| iOS file | Kotlin target |
|---|---|
| Tokens.swift | `theme/AppColors.kt` (+ `WagerproofTheme.kt`) |
| Spacing.swift | `theme/Spacing.kt`, `theme/CornerRadius.kt` |
| Typography.swift | `theme/AppType.kt` (+ Nunito font res) |
| Animations.swift | `theme/Motion.kt` (spring specs + transitions) |
| DesignBundle.swift | n/a (module `res/`+`assets/`) |
| OfflineToolbarIcon.swift | `components/OfflineToolbarIcon.kt` |
| Modifiers/LiquidGlassBackground.swift | `glass/LiquidGlass.kt` (`Modifier.liquidGlass(shape, tint, interactive)`) |
| Modifiers/LiquidGlassCapsule.swift | `glass/LiquidGlass.kt` (capsule preset) |
| Modifiers/LiquidGlassDisc.swift | `glass/TeamGlassDisc.kt` |
| Modifiers/Shimmer.swift | `skeleton/Shimmer.kt` + `skeleton/SkeletonShapes.kt` |
| Modifiers/StaggeredAppear.swift | `motion/StaggeredAppear.kt` |
| Modifiers/GlyphRippleOnChange.swift | `pixel/GlyphRippleEmitter.kt` (+ CompositionLocal) |
| Components/PixelDotBackground.swift | `pixel/PixelDotBackground.kt` (+ `PixelDotAnimation` enum) |
| Components/PixelGlyphField.swift | `pixel/PixelGlyphField.kt` + `pixel/GlyphAutomaton.kt` + `pixel/SeededRandom.kt` |
| Components/WaveBackground.swift | `pixel/WaveBackground.kt` |
| Components/PixelWaveBackground.swift | `pixel/PixelWaveBackground.kt` |
| Components/AnimatedAccentPixelWave.swift | fold into PixelWaveBackground (animateColorAsState) |
| Components/WagerBotIcon.swift | `icons/WagerBotIcon.kt` (Canvas/ImageVector) |
| Components/ScopeBanner.swift | `components/ScopeBanner.kt` |
| Components/ContinueCTAButton.swift | `components/ContinueCtaButton.kt` |
| Components/OnboardingLiquidGlassButton.swift | fold into ContinueCtaButton (legacy — skip) |
| Components/OnboardingPageShell.swift | `onboarding/OnboardingPageShell.kt` |
| Components/OnboardingProgressBar.swift | `onboarding/OnboardingProgressBar.kt` |
| Components/HoneydewOptionCard.swift | `components/OptionCard.kt` |
| Components/OptionCardIconChrome.swift | `components/OptionCardIconChrome.kt` |
| Components/LottieView.swift | lottie-compose call sites (no wrapper needed) |
| SharedKit/AppGroup.swift | `:core:data` `SharedPrefsKeys.kt` + DataStore |
| SharedKit/KeychainStore.swift | `:core:data` `SecureStore.kt` |
| *App target:* PixelOffice*.swift (4 files) | `pixeloffice/PixelOfficeCanvas.kt`, `PixelOfficeSim.kt`, `PixelOfficeAssets.kt`, `AStar.kt` |
| PixelSpriteAvatar.swift | `pixeloffice/PixelSpriteAvatar.kt` |
| AgentPickTicket.swift | `tickets/PickTicket.kt` + `tickets/TicketShapes.kt` |
| AgentParlayTicket / AgentPickMiniTicket | `tickets/ParlayTicket.kt`, `tickets/MiniTicket.kt` |
| PickHistoryFolder.swift | `tickets/PickHistoryFolder.kt` + `PickHistorySheet.kt` (rolodex) |
| AgentPickFocusView.swift | `tickets/PickFocusScreen.kt` + `TicketMotion.kt` (sensor) |
| CollapsingWidgetScroll.swift | `scroll/CollapsingWidgetScroll.kt` + `scroll/TeamAuraBackground.kt` |
| AgentResearchIdleCard.swift (pieces) | `agents/WorkingDeskAvatar.kt`, `ResearchShimmerText.kt`, `SwipeToGeneratePill.kt` |
| ThinkingAnimation.swift | `agents/ThinkingTerminal.kt` |
| GlowingCardWrapper.swift | `components/GlowHalo.kt` |

Porting order suggestion: tokens → glass/shimmer/stagger → pills/CTA → pixel fields → collapsing scroll → tickets/folder/printer → PixelOffice sim (largest, most isolated).
