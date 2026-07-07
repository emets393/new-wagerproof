# Inventory 07 — Features: Games feed, per-sport detail, Scoreboard, shared game components

Parity contract for porting the iOS SwiftUI screens under
`wagerproof-ios-native/Wagerproof/Features/{GameCards,Games,MLB,NBA,CFB,NCAAB,NFL,Scoreboard,GameWidgets,Components}`
to Jetpack Compose. File counts verified 2026-07-06: GameCards 14, Games 7, MLB 11, NBA 6,
CFB 6, NCAAB 4, NFL 4, Scoreboard 6, GameWidgets 1, Components 4 — **63 Swift files, ~17.9K lines**.

Conventions used below:
- **Stores** are `@Observable` classes injected via `@Environment` (Compose: ViewModel/DI singletons).
- `Color.app*` tokens come from `WagerproofDesign` (appSurface, appSurfaceElevated, appSurfaceMuted,
  appBorder, appTextPrimary/Secondary/Muted, appPrimary green, appAccentBlue/Red/Amber/Purple,
  appWin/appLoss). Mammoth orange = `#F97316`, gold = `#FACC15`, win green = `#22C55E`,
  loss red = `#EF4444`, amber = `#F59E0B`/`#EAB308`, sharp blue = `#3B82F6`.
- "Liquid Glass" = iOS 26 `.glassEffect` with ultraThinMaterial fallback. Compose equivalent:
  translucent surface + blur/hairline border; the metaball "merge" of overlapping discs has no
  Compose primitive — approximate with overlapping tinted circles (see porting notes).

---

## 1. Games/ — the games feed (7 files)

### 1.1 `GamesView.swift` (595 ln) — Home "Games" tab root
- **Purpose**: one feed for all 5 sports; sport picker + sort + per-date sections of game cards;
  pushes per-sport detail carousels.
- **Nav placement**: first tab of MainTabView, inside its own `NavigationStack`, large title "Games".
- **Layout (top→bottom)**:
  1. Toolbar: leading WagerProof wordmark (`WagerProofLeadingToolbarItem`), trailing Settings gear.
  2. Pinned section header `pickerBar`: HStack[ segmented **sportPicker** + **sortMenu** ] wrapped in
     `LiquidGlassCapsule`, h-padding 14. Picker = native segmented control clipped to capsule,
     sports in seasonal `Sport.displayOrder()` (football-first Sept–mid-Feb, MLB-first otherwise).
     Sort menu = `arrow.up.arrow.down` icon → Menu with 3 items: Sort by Time (`clock`),
     Sort by Spread Value (`chart.line.uptrend.xyaxis`), Sort by O/U Value (`number`).
     Per-sport remembered sort (`store.sortModes[sport]`).
  3. **Tool banners** (`toolBanners`): swipeable paged `TabView` of `ToolBannerCard`s, fixed 64pt
     height, page-dot indicators (6pt circles, appPrimary active / appBorder inactive). Only for
     MLB/NBA/NCAAB (registry below); NBA/NCAAB banners hidden when their accuracy report is empty
     (`visibleTools` gates on `nbaAccuracy.games`/`ncaabAccuracy.games`).
  4. **bodyContent**: loading skeleton | error state | per-sport date sections.
     Date sections: `GameDateGrouping.group(...)` buckets by ET `yyyy-MM-dd`; header = uppercase
     compact date label (11pt bold, tracking 0.8, appTextSecondary, leading-padded 20), scrolls
     inline (NOT pinned). Cards h-padded 12, spacing 8.
- **Stores observed**: `MainTabStore`, `GamesStore` (selectedSport, sortModes, games.{nfl,cfb,nba,ncaab,mlb},
  `sortedNFL/CFB/NBA/NCAAB/MLB()`, `isLoading(sport:)`, `errorMessage(sport:)`, `refresh(sport:force:)`,
  `refreshAll()`), `AuthStore`, `SettingsStore`, `RevenueCatStore`, `AdminModeStore`, `ProAccessStore`,
  5 per-sport sheet stores (`NFL/CFB/NBA/NCAAB/MLBGameSheetStore` — `selectedGame`, `openGameSheet`,
  `closeGameSheet`), optional `MLBBettingTrendsStore` + `MLBF5SplitsStore` (shell-hoisted, handed to
  MLB carousel). Local `@State`: `selectedTool: SportTool?`, `toolPage: Int`,
  `nbaAccuracy = NBAModelAccuracyStore()`, `ncaabAccuracy = NCAABModelAccuracyStore()`.
- **States**: loading = 5× `GameCardShimmer` (only when no cached games), opacity transition;
  error = `ContentUnavailableView` "Failed to load games" (`exclamationmark.triangle`) + Retry
  borderedProminent tinted appPrimary; empty per sport = season-aware `emptyTile` (44pt light SF
  symbol per sport: football/graduationcap/basketball/baseball + `SportSeason.emptyCopy` title/message,
  minHeight 220); populated = date sections.
- **Interactions**: pull-to-refresh → `store.refresh(sport:, force: true)` (5-min TTL bypass);
  `.task` → `refreshAll()`; `.task(id: selectedSport)` lazily loads NBA/NCAAB accuracy;
  card tap → `xxxSheetStore.openGameSheet(game)`; banner tap → `selectedTool = tool`.
  Sensory feedback: `.selection` on sport change + sort change.
- **Navigation pushed**: 5× `navigationDestination(item: $sheet.selectedGame)` →
  `NFL/CFB/NBA/NCAAB/MLBGameCarousel(games: store.sortedX(), initialGame:)` each with
  `.navigationTransition(.zoom(sourceID: "<sport>-<gameId>", in: cardTransition))` matched to the
  card's `.matchedTransitionSource`; Settings destination (`wagerProofSettingsDestination`),
  WagerBot chat destination (`wagerProofChatDestination`);
  `navigationDestination(item: $selectedTool)` → `ToolRouter.leafView(for: tool.category)`.
- **Animations**: `.animation(.appQuick, value: selectedSport)`; `staggeredAppear(index:)` on every
  card (per-index appearance stagger); card→detail zoom transition (shared `@Namespace cardTransition`);
  tool carousel resets page to 0 on sport change.

### 1.2 `Games/Components/SportPickerBar.swift` (67 ln)
- Alternative horizontal pill bar (scrollable HStack, spacing 24): text 16pt (bold when selected)
  + 3pt appPrimary underline capsule animated between pills via `matchedGeometryEffect("sportPill")`.
  Height 48, appSurface bg + 1px bottom hairline. `@Binding selectedSport`. `.selection` haptic.
  Note: `GamesView` currently uses the segmented Picker, not this bar — port for parity but confirm usage.

### 1.3 `Games/GameDateGrouping.swift` (77 ln) — logic, no UI
- `group(items, key:, label:) -> [Section]`: stable bucketing preserving in-bucket sort order;
  sections sorted ascending by key. `dateKey(from:)` parses ISO8601 (±fractional), `yyyy-MM-dd`,
  `yyyy-MM-dd HH:mm:ss` → ET `yyyy-MM-dd` string.

### 1.4 `Games/GamesFixtures.swift` (164 ln) — DEBUG only
- Deterministic sample NFL (4) + CFB (2) predictions for parity screenshots. Port as test fixtures.

### 1.5 `Games/Tools/SportTool.swift` (73 ln)
- `SportTool` struct (Identifiable/Hashable by id): sport, title, subtitle, actionWord, primary/secondary
  Color, `symbols: [String]` (drifting SF symbols), seed/speedFactor/yJitter, `category: OutliersStore.Category`.
- Registry: mlb → "MLB Regression Report" (purple 0xA855F7/0xC9A0FB, `.mlbRegression`);
  nba → "NBA Model Accuracy" (teal 0x14B8A6/0x5FD6C9, `.nbaAccuracy`);
  ncaab → "NCAAB Model Accuracy" (orange 0xF97316/0xFBA864, `.ncaabAccuracy`). NFL/CFB: none.

### 1.6 `Games/Tools/ToolBannerCard.swift` (25 ln)
- Thin wrapper rendering a `SportTool` as `HoneydewOptionCard` (drifting-symbol gradient promo card
  from WagerproofDesign, 64pt min height). Fires `onTap`.

### 1.7 `Games/Tools/ToolRouter.swift` (18 ln)
- `leafView(for category:)`: `.nbaAccuracy → NBAModelAccuracyView()`, `.ncaabAccuracy →
  NCAABModelAccuracyView()`, `.mlbRegression → MlbRegressionReportView()`, `.value/.fade → EmptyView`.
  Shared with Outliers hub so both entry points open identical pages.

---

## 2. GameCards/ — shared card infrastructure (14 files)

### 2.1 `Components/GameRowCard.swift` (1223 ln) — THE universal feed card
- **Purpose**: single horizontal game row used by all 5 sport cards via a normalized `Model`.
- **Container**: RoundedRect r=26 continuous; `.ultraThinMaterial` fill (opacity 0.55 in dark mode);
  hairline `appBorder.opacity(0.4)` 0.5pt stroke; shadow black 6% r4 y2. **Mammoth variant**
  (`isMammoth`): orange gradient wash overlay (0.20→0.08 dark / 0.12→0.04 light), 1.2pt orange 0.55
  stroke, orange shadow r10 y5, + `MammothElectricBorder` — a `TimelineView(.animation 30fps)`
  spinning `AngularGradient` (orange↔gold, 95°/s) 2.5pt ring + pulsing inner ring
  (`0.55+0.45·sin(5.5t)` opacity modulation).
- **Two main-row layouts**:
  - **Standard** (`oddsBreakdown == nil`): `teamsBlock` (two 34pt overlapping avatars, HStack
    spacing −10, inside `LiquidGlassMergeContainer(spacing: 16)` so iOS 26 fuses them; below:
    "AWAY @ HOME" line — abbr 9pt semibold + moneyline 10pt bold mono, ML colored appAccentBlue
    if negative / appPrimary if positive; block width 96) · Spacer · `linesBlock` (spread pill
    showing favorite abbr + line e.g. "BAL −1.5", O/U pill; capsules: label 8pt bold appTextMuted
    + value 11pt bold mono, appSurfaceMuted 0.6 fill, hairline stroke) · `sparklineBlock`
    (Polymarket dual-line sparkline, width 98 h 38). Time pill (9pt bold mono in glass capsule)
    absolute top-right.
  - **Breakdown** (`oddsBreakdown != nil` — MLB always, NFL/CFB/NBA/NCAAB all populate it too):
    scan-line table — `diagonalLogos` (away upper-left, home lower-right, 38pt, centers 22pt apart
    vertically, glass-merged) · abbr column (14pt semibold) · three value columns
    Spread / ML / TOT (13pt bold mono cells 44pt wide, rounded-6 muted chips) · Polymarket chart
    (98×52). Labels row beneath: "Spread ML TOT | PRED MKT" 8pt bold. Total convention: away row
    "O48.5", home row "U48.5". Geometry constants in `enum BD` (contentInset = 26−19 = 7 so the
    away logo is concentric with the card corner). Time pill relocates to the bottom info row.
- **Avatar** (`avatar(for:)`): AsyncImage logo in circle (82% of disc), team-glass disc
  (`teamGlassDisc(primary:secondary:tint:0.5)` — iOS 26 tinted glass, pre-26 gradient disc);
  contrast plate logic: dark mode + dark logo (lum<0.45) → faint light wash white-0.78 @15%;
  light mode + light logo (lum>0.6) → black 55% plate; fallback = initials white bold with shadow.
  Team-color halo shadow (primary 22% r5). Colors lifted for dark mode via
  `Color.teamVisible(in:minBrightness:0.5)` (HSB brightness floor, saturation ×0.9).
- **Bottom row** (below hairline divider), two modes:
  - Model-edge pills: `ouEdgeBlock` ("O/U OVER +2.5 63%" — direction colored, delta mono,
    probability appTextSecondary) + `mlEdgeBlock` ("ML BAL +4.2%") using edge-tier colors.
  - **SlatePicks** (NFL/CFB dry-run): `slateTotalPill` ("O/U OVER 47.5", UNDER=appAccentRed,
    OVER=appPrimary, 13pt black), `slateSpreadPill` ("Spread [22pt logo] −3.5"), then badges row
    (ViewThatFits H→V): **MAMMOTH PLAY** pill (flame.fill, orange→gold gradient capsule, white text
    on appSurface fg, glow shadow), "N High Conviction" (flame, orange tint), "N Signals" (bolt,
    appTextSecondary). Built by static `convictionBadges(hasMammoth:highCount:signalCount:)` —
    mammoth trumps high conviction.
- **Model struct**: id, league, dateLabel, timeLabel, away/home `TeamSide{abbr, initials, moneyline,
  spread, logoURL, colors}`, overLine, `mlEdge: MLEdgeInfo?{abbr, edgePoints, color}`,
  `ouEdge: OUEdgeInfo?{isOver, delta, probability, color}`, away/homeTeamFullName,
  `slatePicks: SlatePicks?`, `oddsBreakdown: OddsBreakdown?`, isMammoth.
- **`GameEdgeMath`** (port exactly): `impliedProb(ml)`; `mlEdge(modelHomeProb:homeMl:awayMl:...)` picks
  larger side edge in pct points; `ouEdge(modelFairTotal:marketLine:ouResultProb:)` — direction from
  prob (≥0.5=over) else fair-vs-market; delta = fair−line; prob normalized to chosen side; color
  magnitude = |delta| or (p−0.5)×20. `edgeColor`: ≥5 strong green (0.13,0.77,0.37), ≥3 light green
  (0.52,0.80,0.09), ≥2 yellow (0.92,0.70,0.03), else orange (0.98,0.45,0.09).
- **`PolymarketMoneylineSparkline`** (in same file): `.task(id:)` →
  `PolymarketService.shared.markets(league:awayTeam:homeTeam:)` → moneyline priceHistory.
  Edge badge above chart: leader dot + "ABBR 61%" 8pt bold in leader team color (fallback "POLY ML").
  Canvas draws two normalized polylines (last 40 pts, away = p, home = 1−p), leader 1.8pt @1.0,
  trailing 1.0pt @0.55, colors = team primaries lifted to minBrightness 0.72. Loading = redacted
  rounded block; <2 points = flat-trend icon + "—".
- **States**: no internal loading (parent shows shimmer); sparkline has its own 3 states.
- **Interactions**: whole card is a Button → `onPress`; `.impact(light)` haptic.

### 2.2 `Components/GameCardShimmer.swift` (96 ln)
- Skeleton reproducing standard-row footprint exactly (2 circles 34, teamLine blocks, 2 capsule
  pills 70×22, sparkline blocks 44×8 + 98×24, divider, 2 bottom capsules 96/80×22, time pill 40×16).
  Unified `.shimmering()` sweep on placeholders; chrome solid.

### 2.3 `Components/GameCardFormatting.swift` (144 ln) — logic
- `formatMoneyline` ("+150"/"−180"/"—"), `formatSpread` (int when whole, else 1dp, signed),
  `roundToNearestHalf` (O/U display), `formatCompactDate` → "EEE, MMM d" ET,
  `convertTimeToEST` → "h:mm a ET", `confidenceColor(percent)` (80+/70/60/else same 4-tier palette).
- `TeamColorPair{primary, secondary}` + neutral palettes per sport; `TeamInitials.from(_:)` and
  `.parts(of:)` (city/nickname split, 3-word heuristic).

### 2.4 `Components/GameCardTeamAvatar.swift` (99 ln)
- Simple avatar: primary→secondary gradient circle, 2pt secondary strokeBorder, black-15% shadow,
  AsyncImage logo (padding 12%) or initials (36% size, white, shadow). Logo resolution by sport:
  nfl → `NFLTeamAssets.logo`, cfb/ncaaf → `CFBTeamAssets.logo`, mlb → `MLBTeams.logoUrl`, else nil.
  Default colors: per-sport neutrals (MLB resolves real colors). Used by heroes, chips, trend rows,
  detail tables — everywhere except `GameRowCard`'s glass avatar.

### 2.5 `Components/GameDetailCarousel.swift` (199 ln) — shared detail-page engine
- Generic `GameDetailCarousel<G, Page, Chip>`: full-bleed paging `TabView(.page, no index)` over the
  sport's sorted slate, starting at tapped game. **All pages pre-built** (deliberate: lazy build
  caused swipe hitch). Each page gets `(game, topInset, bottomInset)` — real safe-area insets read
  from GeometryReader (top: `max(12, top−36)`; bottom: `stripHeight 44 + 24 + bottomInset`).
- Single **fixed shared team-color glow**: `TeamAuraBackground(progress:0, showBase:false)`
  `.blendMode(.plusLighter)` opacity 0.9, non-interactive, colors cross-fade
  `.animation(.smooth 0.45s, value: selection)` when a page settles.
- **Floating matchup strip** (only when >1 game): bottom-pinned horizontal ScrollView of chips in a
  Liquid Glass capsule (h 44, h-pad 14, above home indicator); tap chip → `selection = idx` (plain
  set, no withAnimation — documented desync bug); auto-centers current chip via ScrollViewReader
  `.smooth(0.35)`.
- Chrome: `.toolbar(.hidden, for: .tabBar)` (strip replaces tab bar), transparent nav bar
  (`toolbarBackground(.hidden)`), inline title (only back chevron floats over glow).
- `CarouselMatchupChip`: awayLogo + "AWY @ HOM" 11pt bold + homeLogo; current = appPrimary 20% fill
  capsule + 0.55 stroke, else clear @ 0.7 opacity.

### 2.6 `Components/MatchupGlassHero.swift` (250 ln) — collapsing matchup centerpiece
- Scroll-driven morph, `progress` 0→1: two big glass team discs (80pt→40pt) start **fused center**
  (gap −16% of size inside `LiquidGlassMergeContainer(spacing:30)`) and **flow apart** to opposite
  edges (real HStack layout gap lerp, split ramps over p∈[0.18,0.78]). Choreography:
  `expandedStats` row (label 9pt/value 12pt columns) below discs fades out by p≈0.53;
  `collapsedStats` fade in centered between split discs; per-team abbr(14pt heavy)+ML(11pt mono)
  labels fade in under each disc when split; centered fused title "AWY @ HOM" (17pt heavy) shows
  only while fused. `Side{logoURL, abbr, primary, secondary, ml}`; same contrast-plate + teamVisible
  logic as GameRowCard. Used by NFL + MLB heroes.

### 2.7 `Components/ModelAccuracyWidget.swift` (212 ln)
- Chromeless 3-row table (host `WidgetCollapsingSection` "Model Accuracy" provides header): header row
  Type/Pick/Edge/Accuracy (11pt heavy), rows Spread/ML/O-U — pick 12pt heavy, edge always blue
  `#3B82F6`, accuracy "62% (41g)" colored ≥60 green 0x22C55E / ≥50 yellow 0xEAB308 / else red 0xEF4444.
  White-5% rounded-8 background. `ModelAccuracyBucket` flattens `NBAModelAccuracyData` |
  `NCAABModelAccuracyGame` (homeSpreadDiff>0 ⇒ pick home; mlPickIsHome; overLineDiff>0 ⇒ Over).
  `isLoading` → small ProgressView.

### 2.8 `Components/SportTeamColors.swift` (146 ln) — logic
- `NBATeams.colorPair(for:)` — full 30-team table + nickname-contains fallback;
  `MLBTeamColors.colorPair` (delegates to `MLBTeams.colors`); `CFBTeamColors.colorPair`
  (parses hex from `CFBTeamAssets.colorHex`, fallback below); `FallbackTeamColor.colorPair` —
  FNV-1a hash of name → stable hue (sat 0.62 bri 0.78 primary / sat 0.5 bri 0.6 secondary).
  NCAAB uses the hash fallback exclusively.

### 2.9 `Components/SportsbookButtons.swift` (122 ln)
- "Place Bet" CTA (ticket.fill + text, appPrimary rounded-8, h 44 / compact 32); hidden when
  `betslipLinks` empty. `@State sheetVisible` → `.sheet` (detents medium/large, drag indicator):
  NavigationStack + plain List of sportsbooks ordered TOP (draftkings, fanduel, betmgm, caesars,
  pointsbetus) + ADDITIONAL (bovada, betrivers, wynnbet, unibet, foxbet, hardrockbet) + unknown keys
  (capitalized). Row tap → `openURL(links[key])` + dismiss. Toolbar "Done".

### 2.10 `Components/SportsbookLogoView.swift` (151 ln)
- Book logo badge, styles `.compact` (18pt img / 22 frame / r5) and `.regular` (30 / 38 / r8).
  Chain: `logoURL` AsyncImage → `SportsbookDomainResolver.fallbackURL` (DuckDuckGo favicon
  `icons.duckduckgo.com/ip3/<domain>.ico`, Google s2 fallback; key→domain map: draftkings, fanduel,
  betmgm, betrivers, williamhill_us→caesars, espnbet, fanatics, bet365, bovada.lv, betonline.ag,
  mybookie.ag, betus.com.pa, lowvig.ag; then name-contains; then logo URL host) → letter chip
  (first initial black-weight on appTextPrimary plate).

### 2.11 `Components/WeatherDisplay.swift` (52 ln)
- Legacy inline weather row: up to 3 chips (thermometer °F, wind mph, cloud.rain % if >0), 14pt
  icons appAccentBlue, appAccentBlue-6% rounded-8 background. (Newer sheets render their own hero
  weather chips instead.)

### 2.12 `Sheets/H2HModal.swift` (46 ln)
- Placeholder modal shell (FIDELITY-WAIVER #032): NavigationStack + `ContentUnavailableView`
  "Head-to-Head Data" (`clock.arrow.2.circlepath`) with team names in copy; Done button.

### 2.13 `Sheets/LineMovementModal.swift` (51 ln)
- Generic modal host (FIDELITY-WAIVER #033): NavigationStack + ScrollView + injected `content()`
  builder; title param; Done button. Charts themselves are stubs (see CFB LineMovementSection).

### 2.14 `Components/SportsbookLogoView` — counted above. (14th file = `Components/BettingSplitsCard.swift`, next.)

### 2.15 `Components/BettingSplitsCard.swift` (209 ln)
- Legacy stacked public-splits bars: header person.3.fill (appAccentPurple) + "Public Betting";
  up to 3 `splitRow`s (Moneyline / Spread / Total—Over/Under). Each: title 13pt + optional amber
  splits-label capsule; Bets bar + Handle ($) bar — GeometryReader two-segment capsule (left
  appAccentBlue, right appPrimary; handle rows at 0.6 opacity), 10pt tall, pct labels 11pt bold at
  ends. Percent parsing: "0.61"→0.61, >1 → /100, clamp 0…1. Row hidden when all 4 values nil.

---

## 3. NFL/ (4 files)

### 3.1 `Components/NFLGameCard.swift` (255 ln)
- Wrapper adapting `NFLPrediction` → `GameRowCard.Model`. league "nfl"; abbr/logo from
  `game.awayAb/homeAb` ?? `NFLTeamAssets`; colors `NFLTeamColors.colorPair`; `mlEdge: nil`
  (NFL card intentionally omits ML edge); `ouEdge` from `predTotal` (dry-run fair total) vs
  `overLine` + `ouResultProb`; full `oddsBreakdown` (O/U convention O/U prefix); `slatePicks` +
  mammoth. **Own fetch**: `.task(id: gameId)` — when `runId` contains "dryrun", queries Supabase
  (`CFBSupabase.shared.client`) table **`nfl_dryrun_picks`** (columns game_id, card_group, pick_team,
  pick_side, pick_label, best_line, vegas_line, conviction, is_mammoth, signal_keys, has_play,
  sort_order). Total pick = `card_group=="total"` row (fallback `game.fgTotalPick/fgTotalClose`);
  spread pick = `card_group=="spread"` row (fallback `fgSpreadPick/fgSpreadClose`, sign-flipped for
  away). Badges: highCount (conviction=="high" & has_play), signalCount = unique signal_keys.
  Mammoth = `game.mammoth` || any pick is mammoth. Card `.id` includes mammoth flag to re-render.
  `FlexibleStringList` decoder: array | JSON-string | comma-separated.

### 3.2 `Sheets/NFLGameCarousel.swift` (50 ln)
- `GameDetailCarousel` wrapper: teamColors from `NFLTeamColors`, chip via `CarouselMatchupChip` +
  `GameCardTeamAvatar(sport:"nfl", 18)`, page = `NFLGameBottomSheet(showAura:false, insets)`.

### 3.3 `Sheets/NFLGameBottomSheet.swift` (1785 ln) — NFL game detail page
- **Shell**: `CollapsingWidgetScroll(heroMaxHeight: hasWeather ? 246 : 206, heroMinHeight: 122)`;
  background `TeamAuraBackground(away/home primary)` when standalone, appSurface in carousel.
  `presentationDetents([.fraction(0.85), .large])` (legacy sheet API; presented as push now).
- **Hero**: topRow (compact date 14pt + ET time 12pt in glass capsule, centered) →
  `MatchupGlassHero` (expanded stats ML / Spread / O-U; collapsed Spread + O/U) → **weather chip row**
  (fades ≤ p·1.9): indoor → single "Indoor" chip (building.2.crop.circle, appAccentBlue); outdoor →
  condition chip (icon/title/tint mapped from wxIcon/wxSummary keywords: storms amber, rain blue,
  snow blue, fog gray, wind amber, cold blue, cloudy gray, partly amber, clear amber) + Temp chip
  (tint: ≤35 blue, ≥80 red, else amber) + Wind chip (≥15mph amber else blue). Chips = icon +
  UPPER label 8pt + value 12pt bold in tinted 12% capsule w/ 22% stroke.
- **Content sections in order**:
  1. **Market Odds** — `WidgetCollapsingSection("Market Odds", chart.bar.fill)` → `PolymarketWidget(league:"nfl")`.
  2. **Prediction sections** — one `marketSection` per pick group, ordered
     `spread, total, team_total, moneyline, h1_spread, h1_total, h1_ml` (titles "Spread Prediction",
     "1H Moneyline Prediction"…; icons target / arrow.up.arrow.down.circle.fill / chart.bar.fill /
     dollarsign.circle.fill; tints appPrimary / appAccentBlue (totals) / appAccentAmber (ML)).
     Headerless sections (`showsHeader:false`), Pro-gated via `ProContentSection(minHeight:154)`.
     Each **pickRow**: icon circle 34 (group tint 12%), group title 11pt heavy + trailing
     **recommendation badge** (pick.recommendation ?? "No Bet", conviction-colored capsule:
     mammoth/high orange, med appPrimary, low/lean appAccentBlue, none appTextSecondary);
     **pickHeaderLabel** — team picks: 28pt avatar + "Nickname −3.5" 20pt black rounded (1H prefix);
     totals: up/down circle icon (UNDER red / OVER appPrimary) + label; "Display Only" mini-badge;
     **metricGrid** — ML cards: single "Best Odds" box; others: `Vegas/Best Line box → arrow →
     Model box` (labels: spread "Model Line", ML "Win Prob", team_total "Proj Pts"); boxes = label
     9pt black + value 20pt black rounded, highlighted box tinted 14%;
     **bestBookRow** — `SportsbookLogoView(.regular)` + "Best Book"/name + line+odds mono 15pt,
     appPrimary 8% fill; **signalGroups** — "Supports this pick" / "Contradicts this pick"
     (contradicting amber/muted) adaptive LazyVGrid (min 118) of **signalButton**s: info.circle +
     display name 11pt black + action/team subtitle + chevron.up.forward in filled circle; blue
     (support) / amber (counter) tinted capsule-rect. Row bg: mammoth orange-12%, hasPlay
     conviction-10%, else muted-32%.
     **teamTrendStrip** (spread/total/team_total/h1 groups): "Team Trends" 10pt heavy + per-team
     trendCards — avatar 22 + abbr + chevron, season line (e.g. "Season ATS 7-4-1 63%") + "L5" chips
     (21pt circles W/O green, L/U red, else gray). Tap → trend detail sheet.
  3. **Matchup History** — `WidgetCollapsingSection("Matchup History", person.2.fill, blue)`,
     Pro-gated; rows: "2024 Season - 11/24" + Neutral flag, `AWY 17 @ HOM 24  Total 41`,
     pills Winner (appPrimary) / Covered (green) / O-U (green/red), closing lines line
     "Spread −2.5 · Total 47.5 · ML +120 / −140".
  4. **AgentPickRationaleWidget** (self-gating on `AgentPickAuditStore`; keys trainingKey,
     uniqueId, "away_home").
- **Sheets/dialogs**: `.sheet(item: $selectedSignal)` → **signalDefinitionSheet** — NavigationStack,
  display name 22pt heavy, oneLiner appPrimary, blocks Definition / Why It Works / Bet Direction,
  `SignalPerformanceStatsSection(backtestHit:, seasonDisplay:)` (all-time vs season-to-date), Done.
  `.sheet(item: $selectedTrendDetail)` → **trendDetailSheet** — team header + season game-log table
  (Date/Opp/line/result/margin columns, per-kind headers: Spread→ATS/Cover±, Total→O-U±, TT, 1H
  variants, ML→SU/Margin; margins green/red).
- **Data** (`loadDryrunData`, guarded by runId contains "dryrun", parallel async lets):
  `nfl_dryrun_picks` (full row: model_number/model_line/vegas_line/vegas_price/edge/best_book*/
  best_line/best_odds/conviction/recommendation/is_mammoth/stake_units/has_play/display_only/
  signals[]/signal_keys), `nfl_signal_defs` (signal_key, display_name, one_liner, definition,
  why_it_works, bet_direction, typical_hit), `nfl_team_trends` (su/ats/ou/tt/h1 aggregate cols +
  last5_* + game_log jsonb), `nfl_matchup_history` (matchup_key = sorted "A|B", last 5),
  `SignalPerformanceService.performances(for:.nfl, season:)`.
- Signal stance: per-row `signals[]` (stance support/counter) preferred; fallback heuristic
  `signalSupportsPick` (FADE HOME/AWAY, OVER/UNDER, team-name matching; default = support).
- `NFLFlowLayout` custom Layout (wrap layout) defined but available for chip wrapping.

### 3.4 `Components/NFLPublicBettingBars.swift` (664 ln) — "Public Lean" widget
- NOTE: currently NOT referenced by NFLGameBottomSheet's section list (legacy/available widget) —
  port it, but verify wiring. Chromeless (host header "Public Lean").
- 3 sections Moneyline (chart.line icon blue) / Spread (target green) / Total (chart.bar orange):
  bordered rounded-12 gray table — header Team|Bets|Money; team rows = 26pt gradient initials
  circle (NFL color map below) + 2 `SemiGauge`s; total rows = Over (chevron.up orange) / Under
  (chevron.down blue). Right rail 100pt: indicator badge (info.circle + label text, green 22C55E
  tinted) when a `*_splits_label` exists. Footer "HOW TO READ" legend: Bets/Money definitions +
  Indicators Consensus (green) / Sharp (blue) / Public (orange).
- **SemiGauge** (Canvas 36×24): 5 arc segments red→orange→yellow→lime→green across the half-disk
  (active bucket = percent quintile @1.0 opacity, others 0.4), needle at exact percent
  (π·(1−p/100)), colored center dot. nil percent → bucket 2, needle 50.
- `NFLTeamColors` enum: full city + full-name color map (32 teams + Washington variants),
  mascot-strip fallback, `initials(for:)` map, `contrastingTextColor` (avg luminance > 0.5 → black).
  `colorPair(for:)` reused app-wide for NFL auras/avatars.

---

## 4. CFB/ (6 files)

### 4.1 `Components/CFBGameCard.swift` (264 ln)
- Same adapter shape as NFL card: abbr/logo `CFBTeamAssets`, colors `CFBTeamColors`, ouEdge from
  `fgPredTotal ?? predTotal`; slate picks from Supabase **`cfb_dryrun_picks`** (same columns;
  `game_id` decoded via `FlexibleText` — string|int|double). Mammoth logic identical.

### 4.2 `Components/CFBPredictionCard.swift` (83 ln)
- Standalone summary card (legacy): brain.head.profile + "Model Projection"; predicted away/home
  scores (24pt bold, muted rounded-12 box); "Spread Edge"/"Total Edge" rows colored by 4-tier
  edge palette. Not part of current sheet flow — verify usage before porting.

### 4.3 `Components/LineMovementSection.swift` (59 ln)
- Stub (waiver #033): header chart.line (appAccentPurple) + "Line Movement"; 3 metric boxes
  Opening Spread / Opening Total / Current Spread; caption "Detailed line history will appear once
  cfb_line_movement wires up."

### 4.4 `Components/PublicBettingBars.swift` (45 ln) — CFB variant
- Labels only (CFB has `*_splits_label` strings, no raw pcts): rows Moneyline/Spread/Total → title +
  amber uppercase capsule label. Chromeless.

### 4.5 `Sheets/CFBGameCarousel.swift` (50 ln)
- Carousel wrapper: `CFBTeamColors` + `CFBTeamAssets` chip; page = `CFBGameBottomSheet`.

### 4.6 `Sheets/CFBGameBottomSheet.swift` (2405 ln) — CFB game detail (biggest file)
- **Shell**: `CollapsingWidgetScroll(heroMax 238, heroMin 124)`; aura as NFL.
- **Hero** (custom, not MatchupGlassHero): topRow (date + glass time capsule) → 3-column HStack:
  `heroTeamColumn` ×2 (avatar 58→30pt with **AP-rank badge** "#7" green capsule bottom-trailing when
  ranked; team name balanced 2-line split — `balancedTeamNameSplitIndex` minimizes char delta, font
  14→11pt by name length; name cross-fades to ML mono on collapse via `mlReveal` ramp p∈[0.35,0.75])
  + center `heroLinesColumn` (ML fades out / Spread / O-U / **Model** row "AWY 27.4 · HOM 31.1").
  Weather row (fades ≤p·1.9): indoor purple "Indoor / Dome" chip; else condition chip (rich keyword
  map incl. hot/cold; falls back to shortened wxSummary) + temp chip (≤38 blue, ≥82 orange, else
  green) + wind chip (blue). Chips: icon 12pt black + text 12pt black rounded, tinted 13% capsule.
- **Content**: `marketOddsSection` (PolymarketWidget league:"cfb") → **7 marketSections** (fixed
  `marketRows` array) → `honestySection` → `AgentPickRationaleWidget(gameKeys: gameId, trainingKey,
  uniqueId, away_home)`.
- **The 7 market rows** (bet board from `cfb_dryrun_games` fields on `CFBPrediction` + picks table):
  1. `spread` "Spread Prediction" (target, appPrimary) — vegas/model lines side-oriented via
     `fgSpreadPick`; `fgSpreadCapped == true` ⇒ "No Play"/off-market copy, signals suppressed.
  2. `total` "Over/Under Prediction" (up/down circle icon by `fgTotalPick`) — fgTotalClose vs fgPredTotal.
  3. `tt-home` / 4. `tt-away` "ABC Team Total" (sum icon; section header icon = 18pt team avatar) —
     best O/U line routing (`ttXBestOver/Under` by pick side, fallback close), predicted pts
     (`projectionPick.modelLine ?? ttXPred`), route note "Route to best OVER 24.5".
  5. `h1-spread` "1H Spread Prediction" (clock.badge) — h1SpreadClose (side-signed) vs h1PredMargin.
  6. `h1-total` "1H Total Prediction" (clock.arrow.circlepath) — h1TotalClose vs h1PredTotal.
  7. `moneyline` "Moneyline Prediction" (dollarsign.circle.fill, appTextSecondary) — **display-only**
     for CFB; projected winner from `predictedScore` margin.
- **marketRow layout**: title row (15pt black + MAMMOTH gradient badge + "Display only" chip +
  trailing pick/recommendation text tinted by direction: UNDER appAccentRed / OVER appPrimary /
  mammoth orange) → **marketRecommendationRow** — comparison boxes (Vegas → Model, 20pt black
  rounded; hidden for ML rows) + pick line: pickIcon (direction arrow circle 42 | team avatar 42 |
  market icon) + optional "Rare 5u mammoth spot" flame line + pickLabel 13pt heavy mono +
  bestBookRow (`SportsbookLogoView(.compact)` + "BookName 47.5 −110"); card bg tint-12% gradient
  (mammoth: orange 28%→gold 13%→surface, 1.4pt orange stroke, glow shadow) → signal buckets
  ("Supports/Contradicts this pick" LazyVGrid of signal buttons colored by conviction tier:
  mammoth/T1-high orange/gold 0xFACC15, T2 silver 0x94A3B8, T3 bronze 0xCD7F32, track gray) →
  **teamTrendStrip**: "Team Trends" header + sample label ("12 games · thru W7") + per-team tappable
  cards (avatar 20, abbr 10pt black, metric label ATS/O-U/TT Over/1H ATS/1H O-U/SU, "Season" value
  mono tinted ≥55% green / ≤45% red, L5 chips 17pt, "Tap to expand ↗").
- **honestySection** "Display Notes" (checkmark.shield.fill, blue): 3 info notes (ML context-only;
  capped spread = no play; tracking flags are paper-trade).
- **Sheets**: `selectedSignal: CFBDryRunFlag?` → signalDefinitionSheet (bolt icon tile, display name
  20pt, oneLiner or "Market · SIDE line", What it means / Why it works / Bet direction +
  `SignalPerformanceStatsSection`; xmark close; detents medium/large).
  `selectedTrendDetail` → trendDetailSheet — per-rowId column schema (spread: Spread/ATS/Cover±;
  total: Total/O-U/O-U±/Final; tt: TT/O-U/Pts/TT±; h1 variants; ML: Score/SU), fixed table widths
  334–376pt, result chips 30×24 capsules, margins green/red, location markers "@"/"(n)".
- **Data**: `loadDryRunPicks` (dryrun-gated) → `cfb_dryrun_picks` + `CFBSignalDefinitionsService
  .definitionsBySource()`; `loadTeamTrends` → **`cfb_team_trends`** (season 2025 hardcoded,
  team_name in [away,home]; su/ats/ou/tt/h1 aggregates + last5 + game_log);
  `SignalPerformanceService.performances(for: .cfb, season:)`. Signals for a row merge
  `game.activeFlags` (market+side matching, TT team matching) with pick-derived synthetic flags from
  `signal_keys`, deduped by normalized source key; support/contradict via `signalSupportsPick`.

---

## 5. MLB/ (11 files)

### 5.1 `Components/MLBGameCard.swift` (137 ln)
- Adapter `MLBGame` → GameRowCard.Model. league "mlb"; MLB date/time formatters; colors from
  `MLBTeams.colors` (UInt32 pairs); **mlEdge preferred from published `homeMlEdgePct/awayMlEdgePct`**
  (fallback `GameEdgeMath.mlEdge` on `mlHomeWinProb`); **ouEdge from published `ouDirection` +
  `ouFairTotal`−`totalLine` delta + `ouEdge` magnitude** (fallback ouEdge math). Always provides
  `oddsBreakdown` (run line / ML / shared total). No slate picks / mammoth.

### 5.2 `Components/MLBTeamLogo.swift` (139 ln)
- MLB avatar: gradient circle + 2pt primary strokeBorder + AsyncImage (contrast plate identical
  logic) or abbr initials with luminance-contrast text. Plus **`MLBFormatting`** enum:
  moneyline / spread (run line) / line / `dateLabel` ("EEE, MMM d" from yyyy-MM-dd ET) /
  `gameTime` (ISO → "h:mm a ET", "TBD").

### 5.3 `Sheets/MLBGameCarousel.swift` (102 ln)
- Carousel wrapper + extra plumbing: owns `selectedProp: PlayerPropSelection?` + `@Namespace
  propTransition` — ONE `navigationDestination` for `PlayerPropDetailView` with zoom transition
  shared across pages. Injects shared slate stores into every page: trends/f5 (from GamesView via
  env or local fallback), `MLBBucketAccuracyStore`, `MLBRegressionReportStore`. `.task` hydrates
  all four in parallel (`refreshIfNeeded/refreshIfStale`).

### 5.4 `Sheets/MLBGameBottomSheet.swift` (1070 ln) — MLB game detail
- **Shell**: `CollapsingWidgetScroll(heroMax hasWeather ? 272 : 236, heroMin 122)`. Postponed games
  short-circuit to a banner ("AWY @ HOM" + red "Postponed" pill).
- **Hero**: topRow (MLB date + glass time capsule + **Final/Preliminary pill** — lock.fill+Final
  appPrimary / Preliminary amber 0xF59E0B, glass-tinted capsule) → `MatchupGlassHero` (expanded
  ML / Run Line / O-U; collapsed Run Line + O-U) → **starting pitchers row** ("SP name ✓|TBD" per
  side, top hairline; fades) → weather chip row (sky condition via `skyIcon` map, temp tint ≤35
  blue/≥80 red/else amber, wind chip titled with windDirection, ≥15mph amber).
- **Content sections in order**:
  1. Market Odds (`PolymarketWidget league:"mlb"` — spread pill reads "Run Line").
  2. **Projected Score** (sportscourt) — Full Game / 1st 5 segmented toggle (custom capsule buttons,
     appPrimary active) + away logo 36 + "4.7 − 3.9" 28pt heavy + home logo. Toggle drives `projView`
     for the ML/O-U cards too. "Projection unavailable…" italic when side missing.
  3. **Moneyline Projection** ("1st 5 Moneyline" in F5 mode; baseball icon; chevron accessory,
     header tap toggles `mlExpanded`) — comparisonRow Vegas implied % → Our Model % (strong signal
     ⇒ appPrimary, weak ⇒ yellow 0xEAB308); pick row: team logo 36 + "Edge to ABBR" + "+3.2% delta";
     trailing **accuracyBadge** (bucket win% + record from `MLBBucketAccuracyStore` via
     `MLBBucketHelper.lookup(betType:"full_ml"/"f5_ml", edge, side)`); "SITUATIONAL EDGE" — up to 2
     side-kind `TrendSignalRow`s from the trends summary; expanded → explanation paragraph.
     Pick side: higher edge, fallback higher win prob (F5 columns `f5*` mirror full-game ones).
  4. **Total Projection / 1st 5 Total** (arrow.up/down icon, tint appPrimary/appAccentRed;
     `ouExpanded` chevron) — Vegas O/U vs Model fair total; big chevron 32pt + "Edge to Over/Under"
     + pts delta; accuracyBadge (full_ou/f5_ou, direction); up to 2 over/under-kind TrendSignalRows;
     expanded explanation.
  5. **First-5 Innings** (`F5SplitsInsightWidget`) — hidden unless game is on the F5 slate and
     `MLBF5Insight.summary` exists; skeleton only during first hydrate.
  6. **Regression Report Picks** (chart.bar.xaxis, purple 0xA855F7) — Pro-gated
     `MLBRegressionPicksSection(picks: store.suggestedPicks(for: gamePk))`; hidden when empty.
  7. **Player Props** (`MLBMatchupPropsWidget`) — from shared `PropsStore.matchup(for: gamePk)`;
     skeleton during first MLB props hydrate.
  8. **Betting Trends** (`BettingTrendsInsightWidget` + `MLBTrendsInsight.summary`) — hidden when
     game not in `mlb_situational_trends_today` slate; first-hydrate skeleton.
  9. **Game Signals** (antenna icon; verdict accessory "N SIGNALS" green) — Pro-gated; empty-copy
     paragraph or signal pills (severity colors: negative orange, positive green, over amber,
     under blue, neutral gray; category icons pitcher person.fill / bullpen flame / batting chart /
     schedule calendar / weather cloud.sun / park mappin / default target).
  10. AgentPickRationaleWidget (keys gamePk, "AWY_HOM" abbrs, "AwayName_HomeName").
- **Sheets** (one `.sheet(item: $insightDetail)`, enum `MLBInsightDetail{trends|props|f5}`):
  trends → `BettingTrendsDetailSheet` (shared matrix sheet via `MLBTrendsMatrixAdapter`);
  props → `MatchupPropsDetailSheet`; f5 → `F5SplitsDetailSheet`.
- **State**: projView, mlExpanded, ouExpanded reset `.onChange(of: gamePk)`; `.task(id: gamePk)`
  hydrates trends/f5/props concurrently. Stores: injected trends/f5/accuracy/regression + env
  `PropsStore`, fallback local store instances.

### 5.5 `Components/F5GameCardView.swift` (393 ln)
- Full 11-row First-Five comparison card (r=26 ultraThinMaterial shell): header (date·time upper /
  "AWY @ HOM" 18pt heavy / "F5 O/U 4.5" capsule) → venue line → teamsRow (46pt logos + SP name(hand)
  + "F5 ML +120" blue) → LHP small-sample warning (amber) → 3 titled sections with emoji headers:
  "⚾ Tonight's pitching matchup" (3 rows), "🔥 First-five offensive performance" (5 rows:
  Split W-L, O/U record, Split runs scored, Season runs scored, Scoring delta), "🛡️ First-five
  defensive performance" (3 rows: Avg F5 RA, Season RA, Allowed delta). Each `compareRow`:
  away cell | center label button (10pt + info.circle → **help Alert** from `F5MetricHelp.all`
  11-entry glossary) | home cell; winner coloring `.appWin`/`.appLoss` (betterHigher/betterLower);
  delta cells = arrow + signed value (goodWhenNegative flips for defense). Data via
  `MLBF5.findSplitRow(lookup, teamAbbr, homeAway, oppSpHand)`; showable floor 2 games.

### 5.6 `Components/F5SplitsDetailSheet.swift` (98 ln)
- Expand target (sheet AND Search push): header "AWY @ HOM · First-5 Splits" + date/time →
  `F5GameCardView` → "What these mean" glossary card (ordered 11 `F5MetricHelp` entries, glass
  rounded-20) → blue how-to-use info card. `presentationDetents([.large])`.

### 5.7 `Components/F5SplitsInsightWidget.swift` (103 ln)
- Digest widget (accent sky 0x0EA5E9, icon baseball.diamond.bases): `InsightWidgetSection` +
  `InsightVerdictLine(summary.verdicts)` + qualifier 11pt + `F5CompareRowView`s (title +
  `SignalSplitBar` tug bar + per-side "±0.4 vs season" delta arrows) + amber sample warning.
  Expand label "Full F5 breakdown". winPct halves tinted by `trendsPctColor`; runs rows tint the
  advantaged side `.appWin`.

### 5.8 `Components/MLBBettingTrendsMatchupCard.swift` (107 ln)
- Matchup row for the MLB Betting Trends list screen: 4pt four-stop team-color stripe on top,
  away/home columns (48pt `GameCardTeamAvatar` + abbr via `MLBTeams.displayById` fallback), center
  "@" + ET time chip, trailing chevron; r=26 glass shell. Button → parent opens
  `BettingTrendsDetailSheet`. `.impact(light)`.

### 5.9 `Components/MLBMatchupPropsWidget.swift` (136 ln)
- "Player Props" digest: `InsightWidgetSection` (figure.baseball, badge, expand "All N props") +
  `InsightVerdictLine` + ≤5 `PropSignalRow`s divided by hairlines. **PropSignalRow**: 28pt
  `PlayerHeadshot` ringed with team primary; name 13pt + `MiniHitStrip` (L10 dots) or SP/#order;
  "small sample" caption; trailing "K 5.5" mono + L10 pct capsule (≥70 green, 55–69 yellow, ≤30 red,
  low-confidence gray); chevron. Tap → `onSelect(selection)` (zoom source registered via carousel
  namespace `matchedTransitionSource`).

### 5.10 `Components/MLBRegressionPicksSection.swift` (113 ln)
- Pick cards: bet-type label ("Full Game · Moneyline" etc.) + confidence chip (high appPrimary /
  else amber outline), pick text 15pt bold, 3 stat cells Edge / Bucket ("Perfect\nStorm") /
  Bucket W% (≥65 appPrimary, ≥55 yellow, ≥50 orange, else red), italic reasoning.

### 5.11 `Components/MatchupPropsDetailSheet.swift` (192 ln)
- Expand target: own NavigationStack + `@Namespace`; header + `MatchupPropsListBody` — team groups
  (away / home / "More props" for bench batters) with 16pt logo + count headers and
  `MatchupPropListRow`s (32pt headshot, name, "SP · vs OPP" subtitle, market+line, "L10 70%" tinted).
  Rows push `PlayerPropDetailView` with zoom inside the sheet. Detents `[.large]`.

---

## 6. NBA/ (6 files)

### 6.1 `Components/NBAGameCard.swift` (76 ln)
- Adapter: abbrs from payload, initials from `TeamInitials`, no logo URLs (colors-only avatars from
  `NBATeams.colorPair`); mlEdge from `homeAwayMlProb`; ouEdge full triplet from `modelFairTotal`;
  oddsBreakdown always.

### 6.2 `Sheets/NBAGameCarousel.swift` (50 ln) — standard wrapper (`NBATeams` colors, initials chips).

### 6.3 `Sheets/NBAGameBottomSheet.swift` (740 ln) — NBA game detail
- **Shell**: `CollapsingWidgetScroll(heroMax 196, heroMin 124)` + aura.
- **Hero** (custom): topRow (date + glass time; leading-aligned) → avatar 56→30 columns
  (abbr 16pt heavy; name↔ML cross-fade) + center lines column (ML fades / Spread / O-U).
- **Sections in order**:
  1. Market Odds (Polymarket "nba").
  2. **Spread Prediction** (target; `.tapHint` accessory toggles `spreadExpanded`) — comparison
     boxes Vegas homeSpread → Model predictedSpread (appPrimary highlight); avatar 40 + "Edge to
     Team" + "X.X pts delta"; **FADE ALERT** amber pill + `FadeAlertTooltip(betType:.spread,
     suggestedBet:)` when `edge ≥ 9.5` or prob ≥ 0.8 (fade = opposite team at its spread);
     expanded → 3-tier explanation copy (<2 / <4 / ≥4 pts). Prediction source:
     `modelFairHomeSpread` preferred, fallback `homeAwaySpreadCoverProb` ((p−0.5)×20 edge).
  3. **Over/Under Prediction** (arrow circle icon; `ouExpanded`) — Vegas O/U → Model total
     (over appPrimary / under appAccentRed), chevron 32 + delta, expanded explanation. Source
     `modelFairTotal` fallback `ouResultProb`.
  4. **Injury Report** (bandage, appAccentRed; chevron toggles `injuryExpanded`) — Pro-gated →
     `NBAInjuryReportWidget`.
  5. **Recent Trends** (chart.line, blue; chevron `trendsExpanded`) — Pro-gated →
     `NBARecentTrendsWidget`.
  6. **Betting Trends** — `BettingTrendsInsightWidget(NBATrendsInsight.summary)` when
     `trendsStore.trends(for: gameId)` exists; skeleton on first load. Expand →
     `.sheet(item: $trendsDetail)` `BettingTrendsDetailSheet` via `NBATrendsMatrixAdapter`
     (guide `.basketball`).
  7. **Model Accuracy** (scope, teal 0x14B8A6) — `ModelAccuracyWidget(nba:)` when per-game lookup hits.
  8. **Team Stats** (chart.bar, blue) — table Adj. Offense/Defense/Pace + ATS% + Over% (away|home
     columns), muted-5% rounded-8 box.
  9. **Match Simulator** (sparkles, amber) — "Simulate Match" 56pt appPrimary button →
     `simulating` spinner for **2.5s** → reveal: 64pt avatars + 32pt predicted scores in amber-15%
     box. `.impact(medium)`.
  10. AgentPickRationaleWidget (gameId/trainingKey/uniqueId).
- **Stores**: local `@State` `NBAMatchupOverviewStore` (injuries + trends + impacts, per-matchup
  `load(awayTeam:homeTeam:gameDate:)`), `NBABettingTrendsStore`, `NBAModelAccuracyStore` — three
  parallel fetches in `.task(id: game.id)`; transient expand/sim state resets there too.

### 6.4 `Components/NBAInjuryReportWidget.swift` (213 ln)
- Chromeless body driven by host header chevron (`@Binding expanded`): loading spinner / error row
  (red exclamation) / collapsed hint ("Tap to view injuries and impact scores") / content: two team
  columns (avatar 40 + PLAYER|STATUS|PIE table, rows "F. LastName" 11pt, PIE 4dp appPrimary,
  sorted desc) + divider + "CUMULATIVE INJURY IMPACT SCORE" footer (32pt avatars + 18pt values,
  lower(more-injured)=red vs higher=appPrimary). Empty = green checkmark "No injuries reported".

### 6.5 `Components/NBARecentTrendsWidget.swift` (161 ln)
- Chromeless collapsible 10-metric H2H table: header avatars 32 | METRIC | avatar; rows Overall
  Rating, Consistency, Win Streak, ATS %, ATS Streak, Last Game Margin, Over/Under % (noColor),
  Pace Trend L3, Off Rtg Trend L3, Def Rtg Trend L3 (lowerIsBetter). Values 13pt bold colored
  better=appPrimary / worse=appAccentRed; zebra rows (even = muted 4%). Collapsed hint text.

### 6.6 `Components/NBAModelAccuracyMatchupCard.swift` (178 ln)
- Display-only card for the NBA Model Accuracy tool page: 4pt neutral-NBA gradient stripe; header
  avatars 32 + abbrs + "@" + tipoff; 3 pickBlocks (Spread pick "BOS −3.5 (edge +2.5)", ML Win Prob
  "BOS 64%", Over/Under "Over 224.5") each with Accuracy line "58.3% (n=41)" colored
  ≥60 0x00C853 / ≥50 0xFFD600 / else 0xFF5252; r=26 glass shell.

---

## 7. NCAAB/ (4 files)

### 7.1 `Components/NCAABGameCard.swift` (84 ln)
- Adapter: abbr from `awayTeamAbbrev` (trimmed, nonEmpty) fallback team name; colors
  `FallbackTeamColor` hash; mlEdge from `homeAwayMlProb`; ouEdge from `predTotalPoints`;
  oddsBreakdown always.

### 7.2 `Components/NCAABModelAccuracyMatchupCard.swift` (169 ln)
- Clone of the NBA accuracy card typed for `NCAABModelAccuracyGame` / `NCAABAccuracyBucket`
  (neutral-NCAAB maroon/gold stripe). Same thresholds/derivations.

### 7.3 `Sheets/NCAABGameCarousel.swift` (57 ln) — wrapper w/ hash-fallback colors, abbrev chips.

### 7.4 `Sheets/NCAABGameBottomSheet.swift` (820 ln) — NCAAB game detail
- Shell identical to NBA (heroMax 196 / heroMin 124, aura from hash colors).
- **Hero deltas vs NBA**: avatar gets **AP ranking badge** "#N" (appPrimary rounded-7, only rank ≤ 25,
  top-trailing offset); topRow adds context chips **"Conf"** (`conferenceGame`) and **"Neutral"**
  (`neutralSite`) — appPrimary 15% capsules; O/U line row hidden when `overLine` nil.
- **Sections in order**: Market Odds ("ncaab") → Spread Prediction (sources: `modelFairHomeSpread` →
  `predHomeMargin` (modelSpread = −margin) → `homeAwaySpreadCoverProb`; **isFadeAlert hardcoded
  false** — pill + FadeAlertTooltip wired but dormant, matching RN) → O/U Prediction
  (`predTotalPoints` → `ouResultProb`) → Betting Trends (`NCAABBettingTrendsStore` +
  `NCAABTrendsInsight` / `NCAABTrendsMatrixAdapter`, matrix sheet detents medium/large) →
  Model Accuracy (`accuracy(forGameId:)` → `ModelAccuracyWidget(ncaab:)`) → Team Stats (Adj
  Off/Def/Pace only — no ATS/Over rows) → Match Simulator (same 2.5s reveal) →
  **Model Projections** fallback (rectangle.grid.2x2.fill, appAccentPurple) when no per-team scores
  but margin+total exist: "Predicted Margin — Team by X.X" + "Predicted Total — YY.Y points" →
  AgentPickRationaleWidget.
- Stores owned locally (`NCAABBettingTrendsStore`, `NCAABModelAccuracyStore`), hydrated sequentially
  in `.task(id:)` (note: NBA runs parallel; NCAAB awaits serially).

---

## 8. Scoreboard/ (6 files)

### 8.1 `ScoreboardView.swift` (501 ln) — Scoreboard tab root
- **Nav placement**: tab in MainTabView, own NavigationStack, large title "Live Scoreboard".
- **Layout**: ScrollView + `LazyVStack(pinnedViews: .sectionHeaders)`; pinned header = segmented
  **SportFilter** picker (All/NFL/CFB/NBA/NCAAB/MLB) in `LiquidGlassCapsule`; subtitle "Real-time
  scores & predictions" 14pt; then per-league sections (inner LazyVStack, pinned league headers):
  **leagueHeader** = SF icon (NFL shield.lefthalf.filled, CFB trophy.fill, NBA/NCAAB basketball.fill,
  NHL hockey.puck.fill, MLB baseball.fill, soccer soccerball) + display name ("NFL Games",
  "College Football"…) 18pt bold + trailing badges "N Games" (muted) and "N Hitting" (green 0x22D35F
  10% bg) — appSurface-95% platter with bottom hairline.
- **Two densities** toggled from toolbar arrows (`isExpanded`, `.symbolEffect(.bounce)`):
  compact = 2-column LazyVGrid of `LiveScoreCard` (tap → detail sheet); expanded = full-width
  `LiveScorePredictionCard` stack. Both `staggeredAppear(index:)`.
- **Toolbar**: leading gear → `tabStore.isSettingsPresented = true`; trailing expand toggle.
- **Store**: `@State LiveScoresStore` — `games`, `loadState`, `isLoading`, `hasLiveGames`,
  `lastError`, `groupedByLeague()`, `refresh()`, **`start()`** = idempotent background polling
  (poll interval owned by store; no cache TTL). `.task` starts polling once (`if case .idle`).
  Pull-to-refresh → `store.refresh()`.
- **States**: loading = 2 shimmering league sections (skeleton header + 4 `LiveScoreCardShimmer`
  grid); error (only when no games) = amber banner card w/ Retry capsule; empty =
  `ContentUnavailableView` "No live games right now" (sportscourt.fill; waiver #007 replaces RN
  ASCII terminal); filtered-empty = per-sport CUV "No live NFL games…".
- **Sheets**: `.sheet(item: $selectedGame)` → `LiveScoreDetailModal` (footer callback flips
  `isExpanded = true` then dismisses).
- **Animations**: `.animation(.appStandard, value: isExpanded)` and `value: store.games` (layout
  animates on each poll diff), `.appQuick` on filter; selection haptics on expand + filter.
- `SportFilter` enum: shortLabel, sfSymbol, `matches(league)` (cfb accepts "CFB"+"NCAAF").

### 8.2 `Components/LiveScoreCard.swift` (243 ln) — compact grid tile
- Button tile (r=8, appSurface): main row = optional status dot 8pt (green 0x22D35F hitting /
  red 0xEF4444 not) + "NYK 17 − 24 NE" (abbr 11pt bold, scores 14pt bold monospacedDigit with
  **`.contentTransition(.numericText())`** so polled score changes roll) + right column period/clock
  (only when no predictions); prediction line centered below: "NE −3.5 • O 38.5" 10pt semibold,
  each segment green when hitting / red when not.
- Border: hitting → 1.5pt green; predictions-not-hitting → 1pt red-50%; none → appBorder.
- **Live pulse**: hitting cards get repeatForever easeInOut(1.5s autoreverse) green glow shadow
  (opacity 0.4↔0.9, radius 6↔14), reseeded via `.task(id: hasHitting)`.
- Spread display flips line sign when model picked away; `formatLine` strips trailing .0.

### 8.3 `Components/LiveScorePredictionCard.swift` (241 ln) — expanded card
- Header band (appSurfaceElevated, bottom hairline): `TeamCircleView` 48 each side + center 28pt
  scores (numericText transitions) + quarter/clock line. Body: "AI MODEL PREDICTIONS" 10pt bold
  tracking → prediction rows for moneyline ("Home to win"), spread ("Home −3.5"), overUnder
  ("Over 38.5"): check/x circle icon + label/detail + trailing "↗ Hitting / ↘ Not Hitting" +
  "62% Conf." — green/red 10% bg + 30% border rounded-8. No-predictions fallback text.
- **`TeamCircleView`** (shared, defined here): brand-green gradient circle + initials + team name
  caption (waiver #008 — no real team colors here).

### 8.4 `Components/LiveScoreCardShimmer.swift` (52 ln)
- Skeleton matching compact tile box (abbr/score blocks, period block, centered prediction capsule),
  `.shimmering()`.

### 8.5 `Sheets/LiveScoreDetailModal.swift` (265 ln)
- `.sheet` (detents medium/large, drag indicator): NavigationStack, inline title "Live Game",
  leading **league badge** (12pt bold appPrimary on appPrimarySubtle-30% rounded-6), trailing xmark.
  Score header (TeamCircleView 56 + 36pt scores + quarter/clock, appSurfaceElevated). Predictions
  section = same rows as expanded card (slightly larger paddings). No-predictions state = chart icon
  + copy. Bottom `safeAreaInset` footer: full-width appPrimary "View Full Scoreboard"
  (sportscourt.fill) → `onViewFullScoreboard()` + dismiss (parent switches to expanded layout).

### 8.6 `ScoreboardFixtures.swift` (199 ln) — DEBUG fixtures (5 games: hitting NFL, missing NFL,
  no-prediction NFL, NBA mixed, NCAAB missing). Port as test data.

---

## 9. GameWidgets/ (1 file)

### 9.1 `InsightWidgetPrimitives.swift` (459 ln) — insight-widget design system
- **`InsightWidgetSection`**: wraps `WidgetCollapsingSection` with optional verdict badge accessory
  (`InsightVerdictBadge{text,tintHex}`) + tappable header + `InsightExpandFooter` appended.
- **`InsightVerdictLine`**: rows of `InsightVerdict{text, lean(team/over/under/none), strength 0–3}`
  — lean chip capsule (team=accent, OVER green 0x22C55E, UNDER **blue 0x3B82F6** by legacy
  convention), verdict text 14pt semibold, 1–3 strength dots 5pt.
- **`SignalSplitBar`**: two-sided tug bar h=8 — numerals (11pt mono) OUTSIDE the track, halves
  tinted 0.85 proportional to value/(a+h), missing side = gray dashed half at 50/50, center 50/50
  hairline, capsule clip.
- **`InsightSignalRow`**: title 11pt + trailing badge capsule + bar + optional amber subtext (~44pt).
- **`TrendSignalRow`**: renders a `TrendsSignal` — title "Situation · Metric", badge by kind
  (side → "ABBR +12" tinted by leader pct color; over green; under blue), numerals "12-5 (71%)"
  (record-pct for NBA/NCAAB, pct-only for MLB), halves tinted `trendsPctColor`.
- **`MiniHitStrip`**: L10 dots — cleared = filled green 5pt, missed = hollow gray stroke.
- **`InsightExpandFooter`**: divider + "label ›" 13pt appPrimary full-width button.
- **`InsightWidgetSkeleton`**: verdict block + N rows (two blocks + capsule) + footer block, shimmering.
- **`SignalPerformanceStatsSection`**: "HISTORICAL BACKTEST" (typical_hit) + divider + "THIS SEASON"
  (`SignalSeasonRecordDisplay` — tone empty/neutral/positive(green)/negative(red), small-sample
  dimming). Used by NFL + CFB signal sheets. (Keep backtest vs season-to-date SEPARATE — memory rule.)

---

## 10. Components/ (4 files)

### 10.1 `Components/CollapsingWidgetScroll.swift` (428 ln) — detail-page scroll engine
- **`CollapsingWidgetScroll`**: ScrollView whose content is top-padded by `heroMaxHeight +
  heroTopInset + gap`; scroll offset read via `onScrollGeometryChange` (iOS 18) →
  `progress = clamp(scrollY / (max−min))`; hero rendered as a **top overlay** at
  `height = max − (max−min)·progress`, clipped, with the `background(progress)` builder behind it
  (bled under the status bar) so it masks content scrolling underneath; page background =
  same builder full-bleed unless `transparentPage` (carousel mode). Pin line env
  `widgetPinLine = heroMinHeight + heroTopInset`.
- **`TeamAuraBackground`**: opaque appSurface base (optional) + two blurred radial ellipse glows
  (300×580, blur 48, primary 0.85→0) anchored at global y=210, hugging left (away) / right (home)
  edges; dims to 0.55 opacity and shrinks to 0.70 scale as progress→1; `.drawingGroup()` rasterized.
- **`WidgetCollapsingSection`**: the iOS-Weather card — 48pt header band (uppercase 13pt semibold
  title + 13pt icon, both appTextSecondary; optional tappable; accessory none/tapHint/chevron/
  verdict) over body (default padding 16) in a Liquid Glass rounded-16 card. As the card's natural
  top passes the pin line it pins, its body **clips up under the header** (height shrinks to the
  48pt pill), then the pill **fades out in place over 44pt** while the next card arrives; natural
  height reserved in layout; zIndex raised while collapsing; `contentKey` invalidates cached
  height. `showsHeader:false` cards skip pin/collapse entirely (NFL/CFB pick cards).

### 10.2 `Components/PinnedWidgetScroll.swift` (213 ln) — legacy engine + shared types
- **`PinnedWidgetScroll`**: plain `List` (headers push each other off, Contacts-style) with all row
  chrome stripped; `widgetPlainRow()` helper. `WidgetSection` = opaque appSurfaceElevated header bar
  (rounded top) + body (rounded bottom) with opaque appSurface listRowBackground platter masking
  under-scroll. Superseded by CollapsingWidgetScroll for all 5 sheets but still compiled.
- Shared: **`WidgetCard`** (corner 16, hInset 16, gap 12), **`WidgetHeaderAccessory`** enum
  (none / tapHint(expanded, "Tap"/"Less" + info.circle) / chevron(expanded) / verdict(text,tintHex)),
  **`WidgetVerdictAccessoryBadge`** (10pt semibold tinted capsule).

### 10.3 `Components/FadeAlertTooltip.swift` (135 ln)
- Amber alert card (0xF59E0B 10% fill / 30% border r12): header bolt + "FADE ALERT TRIGGERED";
  paragraph with inline colored spans ("extreme confidence"/"overconfident" amber, "more profitable"
  green); green sub-card "CONSIDER THE FADE" + suggestedBet bold green; stats row (higher hit rate /
  historically profitable). `betType: .spread|.total` kept for API parity (copy identical).
  Used by NBA (live trigger edge ≥9.5 / p ≥0.8) and NCAAB (wired, dormant).

### 10.4 `Polymarket/PolymarketWidget.swift` (336 ln)
- Full market-odds widget for every game sheet. `.task(id: league-away-home)` →
  `PolymarketService.shared.markets(...)` (one call fetches all three markets; toggle just re-slices).
- Layout: **market toggle** — pills for available markets only (Moneyline / Spread["Run Line" for
  mlb] / Total; active = appPrimary 20% capsule + stroke) → **odds row** — two cards (leader dot +
  label + current pct 22pt heavy mono + delta chip "↗ +6%" green/red when |Δ|≥1; tint = team color,
  or Total: Over=appWin green / Under=appLoss red) → **chart card** — Swift `Charts` dual LineMark
  (last 60 pts, monotone, 2pt), legend top-trailing, x-axis "Start"/"Now", y-axis zoomed to data
  range ±padding (min 4), height 170, glass chrome (ultraThinMaterial + 0x0F131C-50% + white-8%
  border r16), `.animation(.appQuick, value: selectedMarket)`.
- States: loading = skeleton pills + 2 blocks + chart block shimmering; no markets = "No market
  odds yet" row; <2 history pts = flat-trend placeholder in chart card.

---

## Cross-cutting parity contracts

1. **Feed → detail flow**: card tap → sheet-store `openGameSheet` → `navigationDestination` push of a
   **carousel over the whole sorted slate** (not a single game) with a zoom transition from the card.
   Back-nav clears `selectedGame`. Other tabs (Outliers, Search) drive the same stores.
2. **Every detail page** = CollapsingWidgetScroll + team-aura background + collapsing hero +
   `WidgetCollapsingSection` cards; carousel mode: transparent page, shared fixed glow, insets passed in.
3. **Section inventory per sport** (order matters):
   - NFL: Market Odds · per-market dry-run pick cards (spread/total/team_total/ML/1H×3) w/ signals +
     team trends · Matchup History · Agent rationale.
   - CFB: Market Odds · 7-market bet board (spread/total/TT-home/TT-away/1H-spread/1H-total/ML-display)
     w/ signals + team trends · Display Notes · Agent rationale.
   - MLB: Market Odds · Projected Score (FG/F5 toggle) · Moneyline Proj · Total Proj · F5 splits ·
     Regression Picks (Pro) · Player Props · Betting Trends · Game Signals (Pro) · Agent rationale.
     (Weather lives in the hero, free.)
   - NBA: Market Odds · Spread Pred (fade alert live) · O/U Pred · Injury Report (Pro) · Recent
     Trends (Pro) · Betting Trends · Model Accuracy · Team Stats · Match Simulator · Agent rationale.
   - NCAAB: Market Odds · Spread Pred (fade dormant) · O/U Pred · Betting Trends · Model Accuracy ·
     Team Stats · Match Simulator · Model Projections fallback · Agent rationale.
4. **Pro gating**: `ProContentSection(title:minHeight:)` wraps NFL/CFB pick cards, NFL matchup
   history, MLB regression/signals, NBA injuries/trends.
5. **Direction color language**: OVER/model-side = appPrimary green; UNDER = appAccentRed in pick
   cards BUT blue 0x3B82F6 in insight-widget badges (legacy convention — keep both).
6. **Dry-run tables** (Supabase via `CFBSupabase` client): `nfl_dryrun_picks`, `cfb_dryrun_picks`,
   `nfl_signal_defs`, `nfl_team_trends`, `nfl_matchup_history`, `cfb_team_trends` (season 2025
   hardcoded), plus `SignalPerformanceService`. All decoders tolerate flexible types
   (FlexibleStringList / FlexibleText) — replicate leniency in kotlinx.serialization.
7. **Animations checklist**: staggered card appear; card→detail zoom (matchedTransitionSource ↔
   navigationTransition); MatchupGlassHero fuse/split morph; hero name↔ML cross-fades; widget
   pin-collapse-fade handoff; carousel glow cross-fade on page settle; mammoth electric border
   (30fps angular spin + sine pulse); live-score green glow pulse (1.5s autoreverse); score
   `.numericText()` roll; matchedGeometry sport-pill underline; Polymarket chart market cross-fade;
   simulator 2.5s fake delay; sensory haptics (selection on pickers/sorts, light impact on cards/rows,
   medium on simulate/detail).

---

## Compose porting notes

- **Zoom transitions**: iOS `matchedTransitionSource`/`.navigationTransition(.zoom)` →
  Compose shared-element transitions (`SharedTransitionLayout` + `sharedBounds`) between feed card
  and carousel page; sport-prefixed keys (`"nfl-<id>"`).
- **Liquid Glass**: approximate with `Modifier.background(translucent)` + `Modifier.blur`/haze lib +
  1dp hairline border. The disc **metaball merge** (LiquidGlassMergeContainer) has no equivalent —
  acceptable fallback: overlapping tinted-gradient discs without fusion (pre-iOS-26 fallback already
  looks like this).
- **CollapsingWidgetScroll** → `LazyColumn` + `NestedScrollConnection`: track scroll offset →
  `progress`; hero as an overlaid Box with animated height; per-card pin/collapse needs item
  onGloballyPositioned y vs pin line, height clamp + alpha fade — build ONE reusable
  `WidgetCollapsingSection` composable, everything else consumes it.
- **Paging carousel** → `HorizontalPager(beyondViewportPageCount = games.size)` to mirror the
  "pre-build all pages" anti-jank decision; fixed bottom chip strip in a Box overlay;
  `AnimatedContent`/`animateColorAsState` for the shared glow re-tint.
- **Pinned headers**: `LazyColumn stickyHeader` matches GamesView/Scoreboard pinning; note iOS's
  per-date headers intentionally DON'T pin (plain items).
- **Charts**: PolymarketWidget → Vico or custom Canvas; sparkline + SemiGauge + line charts are all
  simple Canvas draws — port the exact normalization math.
- **numericText score roll** → `AnimatedContent` with `slideInVertically`+fade per digit, or
  `animateIntAsState`.
- **Haptics** → `LocalHapticFeedback` (selection/light/medium impact mapping).
- **AsyncImage** → Coil `AsyncImage` with the same success/fallback branching (initials fallback,
  contrast plate by luminance — port `relativeLuminance` + `teamVisible` HSB lift exactly).
- **State stores** → Hilt-scoped ViewModels/repositories mirroring store lifetimes: app-scoped
  (GamesStore, sheet stores, PropsStore, MLB trends/F5), carousel-scoped (MLB accuracy/regression),
  screen-scoped (NBA/NCAAB sheet stores, LiveScoresStore w/ polling coroutine — cancel on stop,
  idempotent start).
- **Polling**: LiveScoresStore.start() → `viewModelScope` loop w/ delay; `refresh()` for
  pull-to-refresh (`PullToRefreshBox`).
- **Sheets** → `ModalBottomSheet` (detents ≈ skipPartiallyExpanded flags); iOS `presentationDetents`
  on the game sheets is vestigial (they're pushes now) — port as full screens.
- **Alerts** (F5 metric help) → `AlertDialog`.
- Preserve **fidelity waivers** as TODOs: #008 team colors (CFB/NCAAB fallback hash + Scoreboard
  TeamCircleView neutral), #032 H2H data, #033 line-movement charts, #007 scoreboard terminal
  empty state, #100 MLB Pro gates, #110 regression model-alignment.
- Hardcoded values to lift into config: `cfb_team_trends` season 2025, NFL signal-performance season
  fallback 2025, dry-run gating on `runId.contains("dryrun")`.

### File → Kotlin mapping checklist

Package root: `com.wagerproof.app.features.*`

**games/** (from Games/)
- [ ] `GamesView.swift` → `games/GamesScreen.kt` (+ `GamesViewModel.kt`)
- [ ] `Games/Components/SportPickerBar.swift` → `games/components/SportPickerBar.kt`
- [ ] `Games/GameDateGrouping.swift` → `games/GameDateGrouping.kt`
- [ ] `Games/GamesFixtures.swift` → `games/GamesFixtures.kt` (debug/test source set)
- [ ] `Games/Tools/SportTool.swift` → `games/tools/SportTool.kt`
- [ ] `Games/Tools/ToolBannerCard.swift` → `games/tools/ToolBannerCard.kt`
- [ ] `Games/Tools/ToolRouter.swift` → `games/tools/ToolRouter.kt`

**gamecards/** (from GameCards/)
- [ ] `GameRowCard.swift` → `gamecards/GameRowCard.kt` (+ `GameRowCardModel.kt`, `GameEdgeMath.kt`,
      `PolymarketMoneylineSparkline.kt`, `MammothElectricBorder.kt`, `TeamColorExt.kt`)
- [ ] `GameCardShimmer.swift` → `gamecards/GameCardShimmer.kt`
- [ ] `GameCardFormatting.swift` → `gamecards/GameCardFormatting.kt` (+ `TeamColorPair.kt`, `TeamInitials.kt`)
- [ ] `GameCardTeamAvatar.swift` → `gamecards/GameCardTeamAvatar.kt`
- [ ] `GameDetailCarousel.swift` → `gamecards/GameDetailCarousel.kt` (+ `CarouselMatchupChip.kt`)
- [ ] `MatchupGlassHero.swift` → `gamecards/MatchupGlassHero.kt`
- [ ] `ModelAccuracyWidget.swift` → `gamecards/ModelAccuracyWidget.kt` (+ `ModelAccuracyBucket.kt`)
- [ ] `SportTeamColors.swift` → `gamecards/SportTeamColors.kt` (NBATeams/CFBTeamColors/FallbackTeamColor)
- [ ] `SportsbookButtons.swift` → `gamecards/SportsbookButtons.kt`
- [ ] `SportsbookLogoView.swift` → `gamecards/SportsbookLogo.kt` (+ `SportsbookDomainResolver.kt`)
- [ ] `WeatherDisplay.swift` → `gamecards/WeatherDisplay.kt`
- [ ] `BettingSplitsCard.swift` → `gamecards/BettingSplitsCard.kt`
- [ ] `Sheets/H2HModal.swift` → `gamecards/sheets/H2HModal.kt`
- [ ] `Sheets/LineMovementModal.swift` → `gamecards/sheets/LineMovementModal.kt`

**nfl/**
- [ ] `NFLGameCard.swift` → `nfl/NFLGameCard.kt` (+ `NFLSlatePickRow.kt` DTO)
- [ ] `NFLPublicBettingBars.swift` → `nfl/NFLPublicBettingBars.kt` (+ `SemiGauge.kt`, `NFLTeamColors.kt`)
- [ ] `NFLGameBottomSheet.swift` → `nfl/NFLGameDetailScreen.kt` (+ `NFLDryrunModels.kt` DTOs,
      `NFLSignalSheet.kt`, `NFLTrendDetailSheet.kt`, `NFLGameDetailViewModel.kt`)
- [ ] `NFLGameCarousel.swift` → `nfl/NFLGameCarousel.kt`

**cfb/**
- [ ] `CFBGameCard.swift` → `cfb/CFBGameCard.kt`
- [ ] `CFBPredictionCard.swift` → `cfb/CFBPredictionCard.kt`
- [ ] `LineMovementSection.swift` → `cfb/CFBLineMovementSection.kt`
- [ ] `PublicBettingBars.swift` → `cfb/CFBPublicBettingBars.kt`
- [ ] `CFBGameCarousel.swift` → `cfb/CFBGameCarousel.kt`
- [ ] `CFBGameBottomSheet.swift` → `cfb/CFBGameDetailScreen.kt` (+ `CFBMarketRows.kt`,
      `CFBTrendDetailSheet.kt`, `CFBSignalSheet.kt`, `CFBDryrunModels.kt`, `CFBGameDetailViewModel.kt`)

**mlb/**
- [ ] `MLBGameCard.swift` → `mlb/MLBGameCard.kt`
- [ ] `MLBTeamLogo.swift` → `mlb/MLBTeamLogo.kt` (+ `MLBFormatting.kt`)
- [ ] `MLBGameCarousel.swift` → `mlb/MLBGameCarousel.kt`
- [ ] `MLBGameBottomSheet.swift` → `mlb/MLBGameDetailScreen.kt` (+ `MLBInsightDetail.kt`,
      `MLBSignalColors.kt`, `MLBGameDetailViewModel.kt`)
- [ ] `F5GameCardView.swift` → `mlb/f5/F5GameCard.kt` (+ `F5Helpers.kt`, `F5MetricHelp.kt`)
- [ ] `F5SplitsDetailSheet.swift` → `mlb/f5/F5SplitsDetailSheet.kt`
- [ ] `F5SplitsInsightWidget.swift` → `mlb/f5/F5SplitsInsightWidget.kt`
- [ ] `MLBBettingTrendsMatchupCard.swift` → `mlb/MLBBettingTrendsMatchupCard.kt`
- [ ] `MLBMatchupPropsWidget.swift` → `mlb/props/MLBMatchupPropsWidget.kt` (+ `PropSignalRow.kt`)
- [ ] `MLBRegressionPicksSection.swift` → `mlb/MLBRegressionPicksSection.kt`
- [ ] `MatchupPropsDetailSheet.swift` → `mlb/props/MatchupPropsDetailSheet.kt` (+ `MatchupPropsListBody.kt`)

**nba/**
- [ ] `NBAGameCard.swift` → `nba/NBAGameCard.kt`
- [ ] `NBAInjuryReportWidget.swift` → `nba/NBAInjuryReportWidget.kt`
- [ ] `NBAModelAccuracyMatchupCard.swift` → `nba/NBAModelAccuracyMatchupCard.kt`
- [ ] `NBARecentTrendsWidget.swift` → `nba/NBARecentTrendsWidget.kt`
- [ ] `NBAGameBottomSheet.swift` → `nba/NBAGameDetailScreen.kt` (+ `NBAGameDetailViewModel.kt`)
- [ ] `NBAGameCarousel.swift` → `nba/NBAGameCarousel.kt`

**ncaab/**
- [ ] `NCAABGameCard.swift` → `ncaab/NCAABGameCard.kt`
- [ ] `NCAABModelAccuracyMatchupCard.swift` → `ncaab/NCAABModelAccuracyMatchupCard.kt`
- [ ] `NCAABGameBottomSheet.swift` → `ncaab/NCAABGameDetailScreen.kt` (+ `NCAABGameDetailViewModel.kt`)
- [ ] `NCAABGameCarousel.swift` → `ncaab/NCAABGameCarousel.kt`

**scoreboard/**
- [ ] `ScoreboardView.swift` → `scoreboard/ScoreboardScreen.kt` (+ `SportFilter.kt`, `ScoreboardViewModel.kt`)
- [ ] `LiveScoreCard.swift` → `scoreboard/LiveScoreCard.kt`
- [ ] `LiveScoreCardShimmer.swift` → `scoreboard/LiveScoreCardShimmer.kt`
- [ ] `LiveScorePredictionCard.swift` → `scoreboard/LiveScorePredictionCard.kt` (+ `TeamCircleView.kt`)
- [ ] `LiveScoreDetailModal.swift` → `scoreboard/LiveScoreDetailSheet.kt`
- [ ] `ScoreboardFixtures.swift` → `scoreboard/ScoreboardFixtures.kt` (debug/test)

**gamewidgets/**
- [ ] `InsightWidgetPrimitives.swift` → `gamewidgets/InsightWidgetPrimitives.kt` (split:
      `InsightWidgetSection.kt`, `InsightVerdictLine.kt`, `SignalSplitBar.kt`, `InsightSignalRow.kt`,
      `TrendSignalRow.kt`, `MiniHitStrip.kt`, `InsightExpandFooter.kt`, `InsightWidgetSkeleton.kt`,
      `SignalPerformanceStatsSection.kt`)

**components/**
- [ ] `CollapsingWidgetScroll.swift` → `components/CollapsingWidgetScroll.kt` (+ `TeamAuraBackground.kt`,
      `WidgetCollapsingSection.kt`)
- [ ] `PinnedWidgetScroll.swift` → `components/PinnedWidgetScroll.kt` (+ `WidgetCard.kt`,
      `WidgetHeaderAccessory.kt`) — may be skippable if all screens use the collapsing engine
- [ ] `FadeAlertTooltip.swift` → `components/FadeAlertTooltip.kt`
- [ ] `PolymarketWidget.swift` → `components/polymarket/PolymarketWidget.kt`

Shared dependencies referenced but living OUTSIDE these dirs (must exist before these ports compile):
`WagerproofDesign` tokens/`LiquidGlassCapsule`/`HoneydewOptionCard`/`Skeleton*`/`shimmering`/
`staggeredAppear`/`teamGlassDisc`/`LiquidGlassMergeContainer`; stores (`GamesStore`, 5 sheet stores,
`LiveScoresStore`, `PropsStore`, `AgentPickAuditStore`, NBA/NCAAB/MLB trend+accuracy stores,
`SignalPerformanceService`, `CFBSignalDefinitionsService`); services (`PolymarketService`,
`NFLTeamAssets`, `CFBTeamAssets`, `MLBTeams`, `NFLTeamsService`, `CFBSupabase`); shared views
(`ProContentSection`, `AgentPickRationaleWidget`, `BettingTrendsDetailSheet`, `BettingTrendsInsightWidget`,
`PlayerPropDetailView`, `PlayerHeadshot`, trends-matrix adapters, `MainTabToolbar` helpers).
