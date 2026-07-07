# Parity Contract Inventory 06 — Outliers, Onboarding, Chat, Props

Source: `wagerproof-ios-native/Wagerproof/Features/{Outliers,Onboarding,Chat,Props}/`
Verified file counts: **Outliers 29 · Onboarding 22 · Chat 17 · Props 16 = 84 Swift files (~19.6K lines)**.
Every file was read in full for this inventory. Target packages: `com.wagerproof.app.features.{outliers,onboarding,chat,props}`.

Shared vocabulary used below (defined in WagerproofDesign, needs Compose equivalents — see inventory 0x for primitives):
`liquidGlassBackground` (iOS 26 glass, `.ultraThinMaterial` fallback), `LiquidGlassMergeContainer` (overlapping glass discs fuse), `teamGlassDisc` (team-tinted glass circle), `SkeletonBlock/SkeletonCircle/SkeletonCapsule` + `.shimmering()` (single travelling highlight), `.staggeredAppear(index:)` (per-row fade+lift stagger), `CollapsingWidgetScroll` (collapsing hero + widget stack), `TeamAuraBackground` (two-team color glow behind hero), `MatchupGlassHero`, `WidgetCollapsingSection` (collapsible titled widget card), `HoneydewOptionCard` (gradient tool banner with drifting SF symbols + action word), `ToolExplainerBannerView`, `ContentUnavailableView` (native error/empty), `GameCardTeamAvatar`, `SportsbookLogoView`.

---

# 1. OUTLIERS (29 files)

## 1.1 `OutliersView.swift` (root, 68 ln)
- **Purpose**: Outliers tab root — filterable betting trends hub (teams/coaches/refs/players).
- **Navigation placement**: tab root inside its own `NavigationStack`. Large nav title "Outliers".
- **Layout**: `ScrollView { OutliersTrendsView(store:) }` on `Color.appSurface`. Toolbar: leading WagerProof logo item, trailing Settings gear. Settings + Chat push as `navigationDestination`s (`wagerProofSettingsDestination`/`wagerProofChatDestination`).
- **Stores**: `OutliersTrendsStore` (env, hoisted to tab shell so SearchView shares one fetch — `loadState`, `refresh()`), plus MainTabStore, AuthStore, SettingsStore, RevenueCatStore, AdminModeStore, ProAccessStore for toolbar/settings wiring.
- **States**: `.task` triggers `refresh()` only when `loadState == .idle`; pull-to-refresh via `.refreshable`.
- **Interactions**: pull-to-refresh; settings gear → pushed Settings page.

## 1.2 `OutliersTrendsView.swift` (622 ln) — the main trends surface
- **Purpose**: Matchup-specific trends hub: sticky filter pill row over market-grouped horizontal card carousels.
- **Layout**: `LazyVStack(pinnedViews: [.sectionHeaders])` — a single Section whose *pinned header* is the filter pill row (floating Liquid Glass capsules, no opaque bar, cards refract through as they scroll under). Content = per-market sections: section header (small bold SF icon + uppercased footnote-semibold secondary title) + horizontal `LazyHStack` carousel of `OutliersTrendCard`s (fixed width **300pt**), carousel bleeds edge-to-edge (negative horizontal padding).
- **Filter pills** (in order): **Sport** pill (Menu+Picker: NFL/NCAAF/MLB/NBA/NCAAB, sport SF icons), **Subject** pill (Menu; only if `sport.allowedSubjects.count > 1`; all/teams/coaches/refs/players with icons grid/shield/person/flag/figure.run), **Matchup** pill (always opens searchable sheet; when a game is selected the pill shows diagonal Liquid Glass team logo pair + "AWY @ HOM" abbrev text, else grid icon + "All games"). Pill chrome: HStack in 36pt-tall capsule, `liquidGlassBackground(interactive: true)` + 0.35-opacity border stroke, 13pt bold text, 9pt bold chevron.down in muted.
- **Market icons** per section key: spread/rl→arrow.left.and.right, ml→dollarsign.circle.fill, total/ou→sum, team_total→person.2.fill, h1_spread→clock.arrow…counterclockwise, h1_total→clock.badge.checkmark, player_anytime_td→figure.run.circle.fill, rush_yds→figure.run, reception_yds→arrow.down.right.circle.fill, receptions→hand.raised.fill, pass_yds→paperplane.fill, pass_tds→trophy.fill, default chart.line.uptrend.xyaxis.
- **Stores bound**: `@Bindable OutliersTrendsStore` — `sport`, `subject`, `matchupFilter` (`.allGames`/`.game(id:)`), `games`, `slateGames`, `marketSections` (`[OutliersTrendsMarketSection]` with `title`, `marketKey`, `cards`), `loadState`, `isLoadingTrends`, `lastError`, `onSportChanged()`, `refresh()`. `onChange(of: store.sport)` → `onSportChanged()` + refresh.
- **States**:
  - *Coming soon* (`!sport.hasTrendsData`): chart icon 34pt light + "Trends coming soon" + copy naming NFL/NCAAF/MLB live.
  - *Loading* (`isLoadingTrends && sections.isEmpty`): 3 section skeletons — header skeleton (14pt square + 110×12 block) + horizontal shimmer carousel of 3× `OutliersTrendCardShimmer` at 300pt, scroll disabled, `.transition(.opacity)`.
  - *Error*: `ContentUnavailableView("Couldn't load trends", exclamationmark.triangle)` + Retry borderedProminent appPrimary.
  - *Empty*: line.3.horizontal.decrease.circle icon + "No trends match" + hint copy.
  - *Populated + refreshing*: sections list plus trailing `updatingIndicator` (small ProgressView + "Updating trends…" 12pt).
- **Interactions**: card tap → sets `selectedTrend: OutliersTrendSelection?` → `.sheet` presenting `OutliersTrendDetailSheet(card:sport:game:)`. Matchup pill → `showMatchupPicker` sheet.
- **Sheets in file**:
  - `OutliersMatchupPickerSheet` (private): NavigationStack + insetGrouped List, `.searchable("Search teams")`, "All games" row + Section titled "Today" (MLB) or "This week" (others) of `OutliersMatchupPickerRow`s (diagonal glass logos 30pt + away name / "@ home" two-line), checkmark on selection, Close toolbar button; selecting writes `store.matchupFilter` and dismisses.
  - `OutliersDiagonalMatchupLogos` / `OutliersGlassTeamAvatar` (private): two team discs on a diagonal (away upper-left z0, home lower-right z1, offset = size×0.48) inside `LiquidGlassMergeContainer(spacing:14)`; per-sport logo/color resolution (NCAAF by full name via CFBTeamAssets, MLB via MLBTeams, else NFLTeamAssets), initials fallback (TeamInitials), `teamGlassDisc(tint: 0.5)` + primary-color shadow.
- Also defines `OutliersTrendSelection` (Identifiable by card id, carries card + game).

## 1.3 `Components/OutliersTrendCard.swift` (573 ln) — trend card (compact + expanded)
- **Purpose**: THE trend card. Two display modes: `.compact` (carousel, fixed 240pt height, max 3 trend rows) and `.expanded` (detail sheet, all rows, wraps).
- **Layout (normal card)**: 16pt continuous-rounded card on `appSurfaceElevated` + 0.35 border. Content 12pt padding, spacing 9:
  1. Header: subject **avatar** (team → `GameCardTeamAvatar` 36pt with per-sport colors; coach → team avatar or person.fill icon disc; referee → NFL shield AsyncImage in appPrimary 0.12 circle; player → headshot AsyncImage 40pt circle / `NFLPlayerHeadshot` fallback) + VStack("SubjectName — BetTypeLabel" 14pt heavy 1-line-compact, optional subjectDetail 11pt, matchup label 12pt bold secondary — nicknames via team asset tables) + trailing `gameScheduleLabel` (compact date + ET time, 10pt semibold muted, right-aligned).
  2. **Betting lines block**: ≥2 lines → side-by-side chips (O/U pair, book logo leading, no book name); 1 line → full-width chip with label ("OVER"/"UNDER"/market uppercased 9pt bold muted), optional team prefix for coach/ref spread/ML (e.g. "KC"), line text 12pt bold + odds 12pt semibold appPrimary, trailing "@ <SportsbookLogoView compact> BookName". Chip bg `appSurfaceMuted.opacity(0.35)` r10. If no lines but `lineContext` → single 11pt semibold appPrimary line.
  3. **Trend rows** (compact: first 3, single line; expanded: all, wrapping): dimension SF icon (14pt wide slot, tinted by strength) + row text with trailing "(NN%)" stripped + right-aligned "NN%" 12pt heavy rounded monospaced digit. Strength tint: >75% `appWin` green, ≥60% `appAccentAmber`, else secondary. **Row icon mapping is dimension-phrase based** (parses the phrase after "of last <n>"): non-division→globe.americas.fill, non-primetime→sun.max.fill, road/away→airplane, home→house.fill, underdog→pawprint.fill, favorite→star.fill, division→person.2.fill, primetime/night→moon.stars.fill, day game→sun.max.fill, "vs …"→person.line.dotted.person.fill, series g1–g4→N.circle.fill, generic games→sportscourt.fill, else circle.fill.
  4. **Compact footer** (pinned to bottom of the fixed-height card, after a 0.5pt hairline): "+" plus.circle.fill in appPrimary, then up to 3 `pctPreviewChip`s for hidden rows (dimension icon + %, tinted capsule at 0.14 opacity), "+N" overflow count 10pt heavy muted, trailing CTA "More" or "View breakdown" (11pt bold appPrimary + chevron.right).
- **Player overflow variant** (`card.isPlayerOverflow`): full-width row — person.3.fill icon, subject name + detail, chevron.right, appPrimary 0.08 bg r16 with 0.25 appPrimary stroke; tap fires `onExpandPlayers`.
- **Bindings**: `OutliersTrendsCard` (subjectKind team/coach/referee/player, subjectName/Detail, teamAbbr, playerId, headshotUrl, marketKey, betTypeLabel, matchupLabel, bettingLines[], rows[] each with text/dominantPct/sampleN, lineContext), `OutliersTrendsGame?` (kickoff, team names/abbrevs).

## 1.4 `Components/OutliersTrendCardShimmer.swift` (90 ln)
- Skeleton mirroring compact `OutliersTrendCard` at fixed 240pt: header (36 circle + 150×13 + 100×11 blocks + trailing 36×9/30×9), 36pt betting-line chip block, 3 trend rows (14 square + full-width 10 + 26×10), spacer, footer (hairline + 3× 36×16 capsules + 60×11 block). Shimmer on inner group only; chrome (elevated fill + border) solid. Shared with Search's Outliers rail.

## 1.5 `Components/OutliersTrendDetailSheet.swift` (66 ln)
- **Purpose/behavior**: bottom sheet revealing one trend card in FULL (`displayMode: .expanded`). `presentationBackground(.clear)` so ONLY the card floats over the dimmed page; detent is **fit-to-content** — measures card height via GeometryReader + PreferenceKey (`SheetContentHeightKey`) and sets `.presentationDetents([.height(h)])` (fallback `.medium` before first layout). Drag indicator visible = sole dismiss affordance. Even 24pt v-insets. Compose: modal bottom sheet with transparent container + wrap-content height.

## 1.6 `OutliersDetailView.swift` (282 ln)
- **Purpose**: per-category detail pushed from hub section headers. Router: `.value`/`.fade` render inline; every other category → `ToolRouter.leafView(for:)` (shared tool router so Games-page banners open identical pages).
- **Inline body (value/fade)**: ScrollView, spacing 14 — `ToolExplainerBannerView` then alerts list. Inline nav title (category.displayName), `refreshable`, trailing arrow.clockwise refresh toolbar button.
- **Explainer banners** (exact copy):
  - Value (accent `#22C55E`): "Prediction Market Alerts" / chart.line.uptrend.xyaxis / "Follow the smart money." + 3 examples ("Polymarket has Chiefs ML at 67%"→"Book: -150" green; "Consensus says Over…"→"62% Over" green; "Spread divergence…"→"+3.5 gap" amber `#F59E0B`).
  - Fade (accent `#F59E0B`): "Model Fade Alerts" / bolt.fill / "When confidence backfires." + 3 examples (Bills -7 92% → "Fade" red `#EF4444`; backtest 61% → green; NBA gauge → "Fade" red).
- **Sport filter pills**: horizontal row "All (n)" + per-sport "NFL (n)" etc. for nfl/cfb/nba/ncaab; pills hide when count 0; active = appPrimary bg + white text, inactive appSurfaceMuted; tapping active pill toggles back to All; `.sensoryFeedback(.selection)`.
- **Stores bound**: `@Bindable OutliersStore` — `valueAlertsSportFilter`, `fadeAlertsSportFilter`, `filteredValueAlerts`, `filteredFadeAlerts`, `valueAlertsCount(_:)`, `fadeAlertsCount(_:)`, `isLoading`, `loadingGameId`, `refresh()`.
- **States**: loading → 3 category-accent-tinted `outlierCardShimmer` rows (mirror OutlierAlertCard footprint: header pill capsules 56/70/48×22 + lines capsules, matchup row 28-circles + 32×13 abbrevs, body line; 14pt padding, accent 0.1 bg + 0.3 stroke, r14); empty → `ContentUnavailableView("No outliers", magnifyingglass)` with per-category copy; populated → `OutlierAlertCard`s with `.staggeredAppear(index:)`.
- **Interactions**: card tap sets `store.loadingGameId` then clears after 0.5s — game-sheet route **deferred (FIDELITY-WAIVER #021)**; port should wire real game-sheet nav.

## 1.7 `Components/OutlierAlertCard.swift` (347 ln)
- **Purpose**: full-width Value/Fade alert card (`Kind.value(OutlierValueAlert)` / `.fade(OutlierFadeAlert)`).
- **Layout** (VStack spacing 10, 14pt padding, accent 0.1 bg / 0.3 border, r14 continuous):
  1. Header pills row: sport pill (sport SF icon + "NFL" 11pt bold in sport color 0.15 capsule; sport colors NFL #013369, CFB #C8102E, NBA #1D428A, NCAAB #F58426, MLB #002D72), optional time pill (clock + "EEE h:mm a" formatted from ISO gameTime, muted capsule), market pill (marketType/pickType raw label, accent 0.2 capsule), accent pill (value: percent icon + "67%"; fade: bolt.fill + "FADE"; solid accent bg white text).
  2. Lines row: "Spread: -2.5", "O/U: 49.5", "ML: +115/-135" muted capsules (built from game.homeSpread/totalLine/awayMl/homeMl).
  3. Matchup row: teamCell ×2 separated by "@" — 28pt circle (logo AsyncImage or initials via `OutlierTeamPalette.initials`) + abbrev 13pt bold.
  4. Body text: value → "**{side}** - Strong 67% consensus" (ML) or "- 67% suggests line hasn't adjusted"; fade → "**{predictedTeam}** — Model confidence {n}%|pt on {pickType}".
  5. Fade only: **"Consider the Fade" box** — green #22C55E arrow.left.arrow.right + title, "Bet **{fadeTeam} {fadeSpread}**" (computed: spread → opposite team + its spread; total → flip Over/Under at the total line); green 0.1 bg/0.3 border r10. Plus fade reason line ("Model shows Npt edge … historically profitable to fade", 12pt secondary).
- Whole card is a plain Button → `onTap`.

## 1.8 `Components/ToolExplainerBanner.swift` (109 ln) — `ToolExplainerBannerView`
- Reusable glass explainer: 3pt accent top bar; uppercased accent title with icon; 18pt heavy headline (-0.5 tracking); 13pt secondary description; Divider; "EXAMPLE SIGNALS:" label; example rows (28pt accent-0.2 circle icon + 12pt semibold label + trailing 12pt heavy value in `valueColor ?? accent`, muted r10 row bg). Card bg: accent-gradient (0.12→clear→0.12 topLeading→bottomTrailing) over appSurfaceElevated 0.6 over ultraThinMaterial, r16 + border 0.6.

## 1.9 `Components/OutliersHeroHeader.swift` (112 ln) — `OutliersHeroHeaderView` *(legacy, superseded by the HowTo banner but still on disk)*
- Tri-color gradient stripe (#00E676→#00B0FF→#7C4DFF, 3pt), headline "Spot the setup before the outcome." (20pt heavy), body copy, Divider, 3-step flow row: "We Scan" (dot.radiowaves green #22C55E) → chevron → "We Flag" (chart.bar.xaxis amber #F59E0B) → chevron → "You Act" (scope purple #7C4DFF); 40pt tinted circles, 13pt bold titles, 11pt centered desc. Same tri-tint gradient card bg as ToolExplainerBanner.

## 1.10 `Components/OutliersHowToBanner.swift` (34 ln)
- Current hub how-to entry: `HoneydewOptionCard(title: "How Outliers work", subtitle: "Spot the setup before the outcome", actionWord: "Learn more", primary #00B0FF, secondary #7C4DFF, symbols [dot.radiowaves…, chart.line…, scope, bolt.fill, target, sparkles, chart.bar.xaxis], seed 0.21)` → `@State showLearnMore` sheet → `OutliersLearnMoreSheet`.

## 1.11 `Components/OutliersLearnMoreSheet.swift` (133 ln)
- Glass "Learn more" sheet: NavigationStack, inline title "How Outliers work", trailing xmark.circle.fill dismiss. Headline block (22pt heavy + 14pt secondary), "HOW IT WORKS" section (3 steps: We scan #22C55E dot.radiowaves / We flag #F59E0B chart.bar.xaxis / You act #7C4DFF scope), "WHAT WE FLAG" section (Market value #22C55E chart.line…, Model fades #F59E0B bolt.fill, Situational trends #0EA5E9 baseball.fill, Model accuracy #14B8A6 target). Rows: 40pt tinted circle icon + 15pt bold title + 13pt desc, each in liquidGlass r18 card. `presentationDetents([.medium,.large])`, drag indicator, `presentationBackground(.ultraThinMaterial)`.

## 1.12 `OutlierFeed.swift` (191 ln) — models + aggregator (non-view)
- `OutlierFeedItem`: merged per-game unit (`id` "mlb-<gamePk>", sport, gamePk, gameTimeEt, away/home `Team{name,abbr,logoURL,primary,secondary}`, `signals: [OutlierSignal]`, detail payloads `trends: MLBGameTrends?`, `f5: MLBF5Game?`, `f5Lookup: [String: MLBF5SplitRow]`, combined `severity`). Equality/hash by id only.
- `OutlierSignal`: kind (value/fade/trends/f5/accuracy/pitcher), badge text, tintHex (trends #0EA5E9 "TRENDS", f5 #F97316 "F5"), headline, severity.
- `OutlierAggregator.build(trends:f5Games:f5Store:)` (@MainActor): buckets by gamePk, extracts signals — trends fires when `ouConsensusScore ≥ 50 || mlDominanceScore ≥ 10` (headline chooses O/U-lean vs ML-edge wording; severity = ou*0.25+ml); F5 fires when showable split exists and peak |f5LineEdge / rsDiffVsSeason| > 0 (severity peak×10). Resolves teams via MLBTeams tables, sorts by severity desc.

## 1.13 `OutlierSections.swift` (135 ln) — hub rail ranking (non-view)
- `OutlierSections.Kind`: trends ("Betting Trends", chart.line.uptrend.xyaxis, #0EA5E9) / f5 ("First 5 Innings", baseball.diamond.bases, #F97316) / props ("Player Props", figure.baseball, #22C55E). Used as nav values for rail "See all".
- Rankers: `trends()` — games with ≥1 fired signal, sort by signal count then consensus score; `f5()` — showable + edge summary, ranked by peak divergence; `props()` — L10 streaks with ≥5 games and pct ≥70 or ≤30, sorted by |pct−50|.
- `OutlierCardBuilder` (@MainActor): builds `OutlierInsightCard` for a trends/F5 game (badge/verdict from `MLBTrendsInsight`/`MLBF5Insight` summaries, time via `MLBFormatting.gameTime`).

## 1.14 `Components/OutlierInsightCard.swift` (118 ln)
- Compact rail thumbnail (fixed 178pt wide; `stretches: true` = full width in "See all" list): overlapping 30pt glass team discs (`LiquidGlassMergeContainer(spacing:14)`, HStack spacing −8) + "AWY @ HOM" 13pt bold; optional `InsightVerdictBadge` capsule (9pt heavy, tintHex 0.16 bg); verdict line 12pt semibold 2-line; optional time 10pt. r20 ultraThinMaterial (0.8 dark) + border, shadow. Button → onTap.

## 1.15 `Components/OutlierPropCard.swift` (86 ln)
- Prop analog for the hub Props rail (fixed 168pt): `PlayerHeadshot` 30pt in 34pt teamGlassDisc (team primary/secondary via `teamVisible`), player name 13pt bold + "vs OPP" 10pt; "{MarketLabel} o{line}" 12pt semibold; hit badge — L10 pct 11pt heavy in hitColor capsule (≥70 #22C55E, ≤30 #EF4444, else secondary) + "{x}/{n} L10" 10pt. Tap → `onTap(item.selection)` pushes `PlayerPropDetailView`.

## 1.16 `Components/OutlierGameTile.swift` (104 ln)
- Merged-outlier list row (GameRowCard language): overlapping 38pt team discs (merge container, −10 spacing, logo 0.82 inset or abbr text, `teamGlassDisc(tint:0.5)` + primary shadow), "AWY @ HOM" 15pt bold, time 11pt (MLBFormatting.gameTime), per-signal badge capsules (9pt heavy, tint 0.15 bg + 0.35 stroke), trailing chevron.right. r22 ultraThinMaterial (0.78 dark) + border + shadow. Tap pushes `OutlierMatchupDetailView`.

## 1.17 `OutlierMatchupDetailView.swift` (135 ln)
- **Purpose**: per-game outlier detail — pushed. `CollapsingWidgetScroll(heroMax:152, heroMin:96)` with `TeamAuraBackground(away/home primaries)` and `MatchupGlassHero` (logo/abbr/colors per side, no ML, no stats).
- **Content**: `summaryCard` ("why flagged": one row per signal — badge capsule (9pt heavy tinted) + headline 13pt secondary; liquidGlass r18 card) then one widget per signal: `.trends` → `WidgetCollapsingSection("Situational Trends", chart.bar.xaxis, tint)` wrapping `MLBBettingTrendsMatchupCardView` (tap → `trendsSheet` state); `.f5` → `WidgetCollapsingSection("First-Five Splits", 5.circle.fill)` wrapping `F5GameCardView(game:lookup:)`. Other kinds EmptyView (later phase).
- **Sheet**: `.sheet(item: $trendsSheet)` → `BettingTrendsDetailSheet` fed by `MLBTrendsMatrixAdapter` (no "View matchup" — already on the matchup). Nav bar hidden-background, empty inline title.

## 1.18 `OutlierSectionListView.swift` (48 ln)
- "See all" list for one rail kind: ScrollView + LazyVStack(spacing 12) of the same cards (`OutlierCardBuilder.trends/f5` with `stretches: true`, or `OutlierPropCard`). Tap handlers injected (`onTrends`/`onF5`/`onProp`) so nav matches the rail. Reads optional env `MLBF5SplitsStore`. Inline nav title = kind.title.

## 1.19 `Components/OutlierMatchupCard.swift` (335 ln)
- Square gradient matchup card for Spotify-style rails (also used by Top Agent Picks): **80pt** square, away→home primary-color LinearGradient, two 38pt diagonal team bubbles (away top-left, home bottom-right) + centered 18pt "VS" glass pill, all inside one `LiquidGlassMergeContainer(spacing:22)` so they fuse; corner radius computed **concentric** with the discs (`cardSize/2 − logoBg/2 + inset`). Below: subtext row (accent pickIcon + pickLabel 14pt bold minScale 0.65) + optional pickValue 14pt heavy accent. `loading` overlays black 0.45 + white ProgressView.
- Also defines **`OutlierTeamPalette`** (shared enum): `color(for:sport:slot:)` brand-primary lookup (full NFL & NBA hex tables inline, MLB via MLBTeams gate, CFB/NCAAB → sport-tint fallback — FIDELITY-WAIVER #024), `initials(for:)` (2-letter, drops "the"/"of"), `logoURL(for:sport:)` (ESPN slug maps keyed by NFL city names & NBA full+city names; MLB via table; CFB/NCAAB nil). Port these tables verbatim.

## 1.20 `Components/OutlierCardShimmer.swift` (41 ln) — `OutlierCardShimmerView`
- Shimmer matching the OLD 160pt square card + subtext/value lines (used by hub sections & Top Agent Picks feed). `phase` param retained but ignored (unified sweep).

## 1.21 `Components/TrendsMatrixView.swift` (296 ln)
- Sport-agnostic situational-trends matrix renderer (all three betting-trends sheets feed it via adapters).
- Types: `TrendsTeamSide` (away/home); `TrendsConsensusBadge` (text, systemImage, colorHex); `TrendsMatrixMetricRow` with `Cell` enum — `.pct(Double?)` (MLB), `.recordPct(record:pct:)` (ATS "W-L-P" over colored cover-% badge), `.recordOU(record:over:under:)` ("O-U-P" over "x%O / y%U"); `TrendsMatrixSection` (id, title, systemImage, tooltip, away/home labels, rows, badges, hasData).
- `trendsPctColor`: nil→#9CA3AF, ≥55→#22C55E, ≥45→#EAB308, else #EF4444 (shared thresholds).
- Section card: ultraThinMaterial r16 + border + shadow. Header: accent icon + 14pt semibold title + badge capsules (icon 8pt + text 10pt bold, color 0.14 bg). Matrix: team header row (48pt gutter; 40pt avatar via injected `avatar(side,size)` closure or AWAY/HOME abbr; situation label 10pt ≤2 lines) then metric rows (row label 10pt semibold in gutter; cells centered, pct badge = colored 13pt bold on color-0.125 r6; records 15pt bold). Rows divided by 1pt 0.08 hairlines. `hasData == false` → "No data available" muted box. Optional italic tooltip row (info.circle + 11pt).
- `TrendsTeamAvatar`: remote logo w/ `GameCardTeamAvatar` fallback.

## 1.22 `Components/BettingTrendsDetailSheet.swift` (225 ln)
- Full situational-trends sheet shared by MLB/NBA/NCAAB. `presentationDetents([.large])`, drag indicator, background-interaction disabled. Content: **headerCard** (4pt team-stripe gradient; "Situational Betting Trends" 18pt bold; away column @ home column — 64pt avatars + 12pt names; center "@" + timeDisplay chip; optional demoted "View matchup" capsule button `accent.opacity(0.12)` shown only when `onViewMatchup != nil`) → `TrendsMatrixView(sections:accent:avatar:)` → **How to Use guide** card with two variants (`Guide.mlb` = Win%/Over% copy, `.basketball` = ATS/O-U copy — verbatim multiline strings in file), a shared Color Legend (≥55% strong green / 45–54% neutral yellow / <45% weak red) and per-variant Quick Tips.

## 1.23–1.25 `Components/{MLB,NBA,NCAAB}TrendsMatrixAdapter.swift` (135/154/120 ln)
- Map sport payloads → `TrendsMatrixSection`s.
- **MLB** (accent #16A34A): 7 pairs in order — lastGame(clock)/homeAway(house)/favDog(rosette)/restBucket(calendar.badge.clock)/restComp(scale.3d)/league(shield)/division(trophy), each with WIN% + OVER% `.pct` rows (percent-only view, normalizes 0..1→0..100). Badges: ML edge when |awayWin−homeWin| ≥ 10 ("ML ABR", bolt.fill green), Over lean both >55 (arrow.up green), Under lean both <45 (arrow.down blue #3B82F6). Also exposes `avatarProvider` (MLBTeamLogo by teamId), 4-color stripe (away pri/sec + home pri/sec), `timeDisplay`.
- **NBA** (accent #3B82F6): 5 pairs — lastGame/favDog/sideFavDog(house)/restBucket/restComp with ATS `.recordPct` + O/U `.recordOU` rows. Badges gated on ≥5 games BOTH sides: ATS gap > 10 → "ATS ABR"; O/U both >55 same direction. hasData = either ATS record ≠ "-". Avatar: ESPN logo via OutlierTeamPalette + NBATeams colorPair.
- **NCAAB**: same 5 configs (delegates to NBA's normalizeRecord/badges); avatars use `game.away/homeTeamLogo` (ncaab_team_mapping) + `FallbackTeamColor` hashed stripes.

## 1.26 `NBAModelAccuracyView.swift` (296 ln)
- **Purpose**: NBA Model Accuracy list, pushed from the hub. Inline title, trailing refresh button, `refreshable`, `.task` idle-refresh.
- **Layout**: ScrollView + LazyVStack(pinned headers): explainer `ToolExplainerBannerView` (accent #14B8A6 "NBA Model Accuracy"/target/"Know when the model is dialed in." + 3 examples Trust/Fade/Trust) rides at top; pinned **sort bar** — Time(clock)/Spread(target)/ML(chart.bar.fill)/O-U(arrow.up.arrow.down) capsule pills (active appPrimary/white) inside `LiquidGlassCapsule` on appSurface; content = matchup cards; footer "How to use this tool" card (lightbulb.fill + 3 numbered tips).
- **Store**: local `@State NBAModelAccuracyStore` — `sortMode` (time/spread/moneyline/ou), `games`, `accuracyById`, `loadState`, `refresh(force:)`. Env: GamesStore, NBAGameSheetStore, MainTabStore.
- **States**: loading (empty cache) → 4× `NBAModelAccuracyCardShimmer` (private: 26pt glass card, 4pt accent bar as solid skeleton, header avatars/abbrs/time blocks, 3 pick-block placeholders r12 muted); loaded-empty → ContentUnavailableView("No NBA accuracy data today", target); failed → red triangle 36pt + message + Retry.
- **Interactions**: card tap → resolve gameId in `gamesStore.games.nba` → `nbaSheetStore.openGameSheet(game)` → `tabStore.select(.games)` (cross-tab handoff; no-op if uncached). Cards themselves = `NBAModelAccuracyMatchupCardView` (lives outside these dirs) with `.staggeredAppear`.

## 1.27 `NCAABModelAccuracyView.swift` (281 ln)
- Identical shape to 1.26 with NCAAB store/sheet-store, explainer accent **#F97316**, copy "The model's college track record." (70%+/30%− actionable), same pills/shimmer/footer.

## 1.28 `OutliersFixtures.swift` (114 ln) — DEBUG only
- Deterministic sample `OutlierGame`s (Celtics/Lakers, Chiefs/Bills, Duke/UNC), `valueAlerts` (3) and `fadeAlerts` (2) for parity screenshots. Port as test fixtures if screenshot testing is set up.

## 1.29 (already covered) `Components/BettingTrendsInsightWidget.swift` (46 ln)
- Collapsed "Betting Trends" digest for game detail sheets: `InsightWidgetSection(title:"Betting Trends", icon chart.line.uptrend.xyaxis, tint #8B5CF6, badge, expandLabel:"See all N situations", onExpand)` wrapping `InsightVerdictLine` + top-3 `TrendSignalRow`s or quiet "No situational edge in today's data". `onExpand` → host presents `BettingTrendsDetailSheet`.

---

# 2. ONBOARDING (22 files)

## Flow overview (exact step order — `OnboardingStore.Step`, raw 1–20)
Carousel (steps 1–18, one shared shell, button-driven slides) → generation cinematic (19) → reveal (20):

| # | Step | Page view | Input collected | CTA gate (`canAdvance`) |
|---|------|-----------|-----------------|--------------------------|
| 1 | terms | OnboardingTermsPage | scroll-to-bottom + checkbox (18+ folded in) | scrolled AND checked; CTA "I agree — continue" stamps termsAcceptedAt + overEighteenAttested |
| 2 | sportsSelection | OnboardingSportsPage | multi-select sports chips | ≥1 selected |
| 3 | sportsShowcase | OnboardingSportsShowcasePage | none (pitch) | always |
| 4 | bettorType | OnboardingBettorTypePage | casual/serious/professional | selected |
| 5 | personalizedValue | OnboardingPersonalizedValuePage | none (branched pitch) | always |
| 6 | acquisitionSource | OnboardingAcquisitionPage | single chip | selected |
| 7 | primaryGoal | OnboardingPrimaryGoalPage | single card | selected |
| 8 | agentValueIntro | OnboardingAgentPitchIntroPage | none — CTA steps through 3 inner slides before advancing | always |
| 9 | agentValueProof | OnboardingAgentPitchProofPage | none | always |
| 10 | attPriming | OnboardingATTPage | real ATT prompt fires on page-active | always |
| 11 | builderSports | OnboardingBuilderSportsPage | agent sports (pre-seeded from step 2) | ≥1 |
| 12 | builderArchetype | OnboardingBuilderArchetypePage | preset or Customize | archetype chosen flag |
| 13 | builderMindset | OnboardingBuilderMindsetPage | 4 sliders | always |
| 14 | builderBetStyle | OnboardingBuilderBetStylePage | segmented + sliders + toggles | always |
| 15 | builderDataTrust | OnboardingBuilderDataTrustPage | sliders/toggle/odds inputs | always |
| 16 | builderSportRules | OnboardingBuilderSportRulesPage | conditional per-sport toggles/sliders | always |
| 17 | builderInsights | OnboardingBuilderInsightsPage | 4 optional text fields | always |
| 18 | builderIdentity | OnboardingBuilderIdentityPage | name + character + color | valid name; CTA "Create my agent" |
| 19 | generation | OnboardingGenerationCinematic | — | auto-advances (genesis model) |
| 20 | reveal | OnboardingRevealView | — | "See everything" → `markComplete()` |

**No skip anywhere in the carousel** — pager is strictly button-driven (deliberately NOT `TabView(.page)`; a ZStack with directional `.move` transitions so there is no swipe surface). Back chevron available from step 2 on (`canGoBack: currentStep > .terms`). Completion: `markComplete()` (cache-first); RootView then presents **PostOnboardingPaywall** as fullScreenCover over the main app for non-Pro users (skip/close allowed there).

## 2.1 `OnboardingView.swift` (159 ln) — root
- 3 strata: **Layer 0** persistent `AnimatedAccentPixelWave` background (same pixelwave as the login screen; hit-inert; `ignoresSafeArea(.keyboard)`; reacts to chip taps via shared `GlyphRippleEmitter` env and glides tint). **Layer 1** phase switch (carousel/generation/reveal) cross-faded `.appSlow`, forced `preferredColorScheme(.dark)`.
- Accent tint state machine: base = `OnboardingTheme.accent(bettorType)`; once archetype chosen its hex wins; generation phase applies white-lift boost. Interruption-safe retarget (`tintFrom = from.mix(to, by: blend)` then animate blend 0→1).
- Owns `AgentCreationStore` (`creationStore`, survives phase swap) + lazily creates `OnboardingGenesisModel` on entering a cinematic step (start() only on `.generation`). Haptic `.impact(.light)` on step change (fwd + back). Pre-warms archetypes (`loadArchetypesIfNeeded`).

## 2.2 `OnboardingStep.swift` (10 ln) — `typealias OnboardingStep = OnboardingStore.Step`.

## 2.3 `OnboardingTheme.swift` (33 ln)
- `accent(for:)`: nil/casual → appPrimary (green), serious → appAccentBlue, professional → appAccentPurple. `archetypeAccent(hex:)`. `generationBoost` = accent mixed 15% white.

## 2.4 `OnboardingPageSpec.swift` (66 ln)
- Static per-step chrome descriptor: `ctaTitle`, `isCTAEnabled(store)`, `onContinue(store)`. Special cases: terms (stamp + advance), agentValueIntro (steps `agentPitchSlide` 0→2 with `.appCarousel` before advancing), builderIdentity ("Create my agent"). Default: "Continue" + `canAdvance` + `advance()`.

## 2.5 `OnboardingPageSlot.swift` (11 ln)
- `@Entry var onboardingPageIsActive: Bool = true` environment — pages gate Lottie/chart grow-ins/ATT prompt on active-page, which with the button pager equals mount time.

## 2.6 `OnboardingCarouselContainer.swift` (200 ln)
- One `OnboardingPageShell` (progress bar + Liquid Glass back chevron + Continue CTA; `useNativeChrome: false` — transparent band so the pixelwave shows; `ctaTint: accent`; `isCTALoading: store.isTransitioning`) wrapping the custom pager. Pager: `ZStack { pageContent(selection).id(selection) }` with asymmetric `.move` insertion/removal keyed off `slideEdge` (derived from step raw-value direction in the SAME update as selection), `.appCarousel` animation; Reduce Motion → 0.15s cross-fade. NOT clipped (page scroll draws under the chrome insets).
- Draft plumbing: `seedBuilderIfNeeded()` — once, at ≥ agentValueIntro: random `spriteIndex` 0…7 if unset; map survey favoriteSports (NFL/College Football/NBA/NCAAB/MLB strings) → `AgentSport`, fallback [.nfl]. `projectDraftToStore()` mirrors every wizard mutation into `OnboardingStore.agentDraft` (preferredSports/archetype/name/avatarEmoji/avatarColor/spriteIndex/personalityParams/customInsights/autoGenerate fields) on `onChange(of: creationStore.draft)`.

## 2.7 `Pages/OnboardingPageKit.swift` (243 ln) — shared page primitives
- `.pageEntrance(index:)`: staggered fade + 14pt lift, spring(0.45, 0.85), delay `min(index,8) × 0.06s`, fires when page becomes active; Reduce Motion instant.
- `OnboardingPageScaffold(title:subtitle:content)`: ScrollView, centered 28pt bold white title (entrance 0) + 16pt white-0.7 subtitle (entrance 1), `.scrollBounceBehavior(.basedOnSize)`.
- `OnboardingPressStyle`: pressed scale 0.965 + opacity 0.85, spring release.
- `OnboardingChip` (icon+label capsule, minHeight 48, liquidGlass tint accent-0.25 when selected + 1.5pt accent stroke, `.glyphRipple(on: isSelected)`), `OnboardingOptionCard` (icon 24pt + 18pt semibold title + 14pt detail, r16 glass, accent stroke, optional minHeight), `OnboardingFeatureRow` (44pt accent-tinted glass icon tile + 16pt bold title + 14pt copy in r16 glass card).

## 2.8 `Pages/OnboardingTermsPage.swift` (162 ln)
- Title + subtitle; conditional "Scroll down to continue" chevron hint (appPrimary, disappears once scrolled); glass ScrollView of verbatim legal sections (bold markdown via `Text(.init())`; sections 1,2,3,4,5,6,9,10,12,18 with full copy in file); bottom sentinel `Color.clear.onAppear { store.setTermsScrolledToBottom() }`; checkbox row (checkmark.square.fill/square 24pt, disabled-looking gray until scrolled, copy "I have read and agree to the Terms and Conditions, and confirm I am 18 or older") → `store.setTermsChecked`, `.sensoryFeedback(.success)`. Scroll/check state lives ON THE STORE (survives page unmount).

## 2.9 `Pages/OnboardingSportsPage.swift` (55 ln)
- "Which sports do you follow most?" / "You can change this later in Settings." Adaptive grid (min 150) of `OnboardingChip`s: NFL football.fill, College Football football, NBA basketball.fill, MLB baseball.fill, NCAAB basketball, Soccer soccerball, Other sparkles. Labels are the persisted strings — don't rename. `store.toggleFavoriteSport`, selection haptic.

## 2.10 `Pages/OnboardingSportsShowcasePage.swift` (70 ln)
- "We cover the major leagues" pitch: 5 league glyph tiles (NFL/CFB/NBA/NCAAB/MLB, 84pt tall glass tiles, appPrimary icons, staggered entrance 2–6) + 3 feature rows: Player props (chart.bar.xaxis), Outliers (waveform.path.ecg), Research agents (brain.head.profile).

## 2.11 `Pages/OnboardingBettorTypePage.swift` (58 ln)
- "What kind of bettor are you?" — 3 `OnboardingOptionCard`s each with ITS OWN accent (casual green face.smiling, serious blue chart.line.uptrend.xyaxis, professional purple target; details "I bet for fun…", "I research lines…", "I track units, ROI, and closing-line value"). Selection retunes the entire surface tint live.

## 2.12 `Pages/OnboardingPersonalizedValuePage.swift` (199 ln)
- Branches on bettorType. **Casual** (`CasualTimeSavedView`): "Get your weekends back" + Swift Charts bar chart — "Doing it yourself" bar grows to 4 (annotation "~4 hrs/week") vs accent-gradient "With WagerProof" bar to 0.25 ("~15 min"); bars grow with springs (delays 0.25/0.55) when page ACTIVE, annotations + light haptic land after ~1.2s (`barsLanded`); glass r20 chart card; plus one feature row ("Answers, not homework", clock.badge.checkmark). **Serious/Pro** (`SharpFeaturesView`): title "Built for sharp process"(pro)/"Built for how you bet"; 3 feature rows (square.stack.3d.up.fill drill-downs, chart.xyaxis.line trends, slider.horizontal.3 agents) + adaptive grid of 8 market chips ("1H spread", "Team totals", "SP strikeouts", "F5 ML", "ATS form", "Public splits", "Line moves", "Park factors"; accent 0.14 capsules + 0.4 stroke).

## 2.13 `Pages/OnboardingAcquisitionPage.swift` (37 ln)
- "Where did you hear about us?" single-select chips: TikTok, X/Twitter, YouTube, Google, Friend/Referral, Other (persisted strings).

## 2.14 `Pages/OnboardingPrimaryGoalPage.swift` (51 ln)
- "What's your main goal?" — 4 option cards (id == persisted string): "Find profitable edges faster" bolt.fill, "Analyze data to improve strategy" chart.line.uptrend.xyaxis, "Track my performance over time" chart.bar.fill, "Get timely alerts for model picks" bell.badge.fill; bettor-type accent; minHeight 84 equalized.

## 2.15 `Pages/OnboardingAgentPitchPages.swift` (380 ln) — pages 8 + 9
- **Page 8 `OnboardingAgentPitchIntroPage`** — "Not another chatbot" / "Three reasons this is nothing like asking ChatGPT for picks." Inner swipeable `TabView(.page, indexDisplayMode: .never)` height 452 (inner swipe is safe — outer pager has no gesture), slide index stored on the store (`agentPitchSlide`) so the shared Continue steps through slides; custom accent dots (8pt active/6pt, tappable).
  - Slide 0 `winRateSlide` "Picks that actually hit": `WinRateBellCurves` chart — two peak-normalized gaussians (bettors mean 40 σ9, white 0.10 area/0.45 line; agents mean 65 σ6.5, accent 0.18 area/accent 2.5pt line, catmullRom), dashed RuleMarks at 40 ("Most bettors\n~40%") and 65 ("Our agents\n~65%"), x-axis labels only at 40/65; glass r20 card; caption copy below.
  - Slide 1 `comparisonSlide` "The data they don't have": two comparison cards — "ASKING CHATGPT" (dull, white-0.15 border, ✗ rows: no live odds, no model probabilities, confident-sounding guesswork) vs "YOUR WAGERPROOF AGENT" (accent border, ✓ rows: proprietary model predictions, live odds/splits/weather/market moves, readable reasoning).
  - Slide 2 `outliersSlide` "Edges served daily": the REAL `OutliersTrendCard` rendered display-only (`allowsHitTesting(false)`) with a hard-coded example card (BUF @ KC, KC -2.5 -108, 5 trend rows "Won 4 of last 5 vs this opponent" 80% etc.).
- **Page 9 `OnboardingAgentPitchProofPage`** — "An analyst who never sleeps": `WorkingDeskAvatar(spriteIndex: 0, accent:, charHeight: 92)` (seated pixel character, same rig as generation) + 3 feature rows (clock.arrow.2.circlepath / cpu / text.magnifyingglass). Avatar dims to 0.4 when page inactive.

## 2.16 `Pages/OnboardingATTPage.swift` (113 ln)
- "One quick thing" + inline copy with bold accent "Allow"; a **mock ATT dialog** rendered in Liquid Glass (chart icon tile, the exact system prompt text, Divider-separated "Allow" (appPrimary) / "Ask App Not to Track" rows); "Tap Allow when the pop-up appears" hint. On page-active (NOT onAppear — pre-mount would fire early): real `ATTrackingManager.requestTrackingAuthorization()` once if `.notDetermined`. Result ignored; always advanceable. **Android port: replace with an equivalent consent/priming page or drop the step (no ATT).**

## 2.17 `Pages/OnboardingBuilderPages.swift` (391 ln) — pages 11, 12, 18
- **11 `OnboardingBuilderSportsPage`**: "Which sports should your agent work?" / "Pre-filled from your picks — adjust anytime." — chips for all `AgentSport` cases, bettor-accent, `creation.toggleSport`.
- **12 `OnboardingBuilderArchetypePage`**: "Pick a starting point" — leading **Customize** option card (slider.horizontal.3; clears archetype, keeps chosen sports, opens balanced defaults) + "OR PICK A PRESET" divider label + archetype rows from `creation.archetypeRows` (`ArchetypeCard` component; selection = archetype id + `store.hasChosenArchetype`). `applyPreservingSports` applies the preset THEN restores the user's sports. States: idle/loading → 4 shimmer skeleton rows (48pt icon block + title/desc blocks); failed → "Couldn't load presets" glass card + Retry; loaded → rows.
- **18 `OnboardingBuilderIdentityPage`**: "Name your agent" — live avatar preview 88pt (gradient tile r26, `PixelSpriteAvatar(spriteIndex, animated: true)` on top; sprite NEVER derived from name hash); name TextField (white 0.08 fill r12, focus ring appPrimary, prompt "e.g., Sharp Shooter, The Oracle", 50-char cap + counter "N/50" + red error text); **CHARACTER** picker — horizontal row of 8 pixel sprites (42×56, selected animates + appPrimary ring); **COLOR** grid — 16 hard-coded `"gradient:#hex1,#hex2"` strings (Supabase wire format, listed in file) as 48pt circles, selected = white ring + checkmark chip. `scrollDismissesKeyboard(.immediately)`.

## 2.18 `Pages/OnboardingPersonalityPages.swift` (590 ln) — pages 13–17
- Shared: `PersonalityExplainer` (icon tile + copy glass row), `PersonalityCard` (r20 glass group), `PresetNote` ("Pre-tuned by {Archetype} — adjust anything", wand.and.stars, appPrimary). Controls are the standalone wizard's `SliderInput` (5-position labeled), `ToggleInput`, `OddsInput` bound into `creation.draft.personalityParams`.
- **13 Mindset** "Set its instincts": Risk Tolerance [Very Safe…High Risk], Underdog Lean [Chalk Only…Dogs Only], Over/Under Lean [Unders Only…Overs Only], Confidence Threshold [Any Edge…Very Picky].
- **14 Bet style** "Choose its playbook": segmented Preferred Bet Type (any/spread/ML/total), Max Picks Per Day [1–5 Picks], Skip Weak Slates toggle, Chase Value toggle, Parlay Appetite [Straights Only…Loves Parlays], Parlays Only toggle.
- **15 Data trust** "Pick its data diet": Trust WagerProof Model + Trust Polymarket sliders [Ignore…Full Trust], Polymarket Divergence Flag toggle; separate "PRICE LIMITS" card with Max Favorite Odds / Min Underdog Odds `OddsInput`s.
- **16 Sport rules** "Teach it your sports" — CONDITIONAL sections on `creation.draft.preferredSports`: FOOTBALL (nfl||cfb): Fade the Public toggle (+ Public Threshold slider 55–75% when on), Weather Impacts Totals toggle (+ Weather Sensitivity slider when on); BASKETBALL (nba||ncaab): Trust Team Ratings slider, Pace Affects Totals, Fade Back-to-Backs; NBA TRENDS (nba): Weight Recent Form slider, Ride Hot Streaks, Fade Cold Streaks, Trust ATS Trends, Regress Luck; SITUATIONAL (always): Home Court/Field Boost slider [Ignore…Maximum], + Upset Alert toggle (ncaab only). Uses optional-bridging `boolBinding`/`intBinding` helpers (defaults 3).
- **17 Custom insights** "Tell it your rules" (optional): 4 multi-line TextFields (3–6 lines, char-capped with live counter) — Betting Philosophy (book.fill, 500), Perceived Edges (chart.line.uptrend.xyaxis, 500), Situations to Avoid (xmark.octagon, 300), Target Situations (target, 300); placeholders in file; focus ring; `scrollDismissesKeyboard(.interactively)`.

## 2.19 `Cinematic/OnboardingGenesisModel.swift` (347 ln) — @Observable @MainActor driver (non-view)
- Canned ~15s theater (floor 15s, hard cap 30s) while REAL work runs concurrently: (1) `creation.submit()` creates the agent (one retry after 1.5s; then a detached `update_agent` write persists `sprite_index` since create_agent lacks the field, local copy patched immediately); (2) fetch 3 display-only teaser picks from top public agents matching sports (`AgentPicksService.fetchTopAgentPicksFeed(filterMode:"top10", limit:40)`), bundled `fixturePicks` fallback (famous matchups; MLB-only set when sports == {mlb}).
- Theater state consumed by the cinematic view: `statusLines` (newest-first, cap 4, cycled from a 12-line script: "Booting your agent's brain..." … "Stamping the tickets..."), `progressFraction` (eases to 0.95 over the floor, snaps to 1.0), `toolCallCount` (deals a skeleton ticket every ~2.8s, cap 5), `hapticTick`, random ripple bursts every ~1.6s, final line "Done. Meet {name}.", then `isFinale` — foreground fades while 4 ripples march up the screen — then `onboarding.advance()`.
- Results: `createdAgent`, `creationFailed`, `teaserPicks`.

## 2.20 `Cinematic/OnboardingGenerationCinematic.swift` (98 ln)
- Transparent (pixelwave IS the scene). Top: console lines column (height 110, 15pt bold monospaced white, newest brightest — opacity `max(0.3, 1 − i×0.24)`, insertion `.move(top)+opacity`, id by row offset). Middle: `WorkingDeskAvatar(spriteIndex, accent, charHeight: 130)`; `GlyphMatrix3x3(accent, cycle 0.7s)` + "Building {name}..." 16pt heavy; `GenerationLoadingBar(fraction, accent)` 220pt. Bottom: `ToolActivityStack(count, accent)` fanning ticket deck. Whole view fades out on `isFinale` (0.45s easeOut). Haptic on `hapticTick`.

## 2.21 `Cinematic/OnboardingRevealView.swift` (192 ln)
- The payoff over the still-rippling field. ScrollView: "{Name} is live!" 32pt black; "First research run complete — here's a taste."; the user's REAL agent as `AgentRowCard(AgentWithPerformance(agent, performance: nil))` display-only (falls back to a draft-built Agent when creation failed); teaser tickets — up to 3 `AgentPickTicket(pick:accent:teaserBlur: true)` (teams visible, details blurred behind a lock), alternating rotation ±1.2°/1.4°, dealt in sequentially (260ms apart, `.appBouncy`, fade+26pt rise). Pinned bottom `ContinueCTAButton("See everything", "→", accent)` → `store.markComplete()`. One-shot confetti `LottieView("confetti", playOnce)` after reveal lands; entrance = 3 ripples + 0.65s fade-in; success haptic; Reduce Motion shows everything instantly.

## 2.22 `PostOnboardingPaywall.swift` (338 ln)
- Mounted by RootView above the main shell when auth'd + onboarding complete + !isPro + !dismissed. Renders **RevenueCatUI `PaywallView`** for the `onboarding` placement offering (dashboard owns layout/A-B); fallbacks: placement fetch → cached `revenueCat.offering` → error surface. Forced dark; `interactiveDismissDisabled(true)`.
- Overlays: loading spinner ("Loading subscription options..." / "Finalizing your subscription..." when `isFinalizing`); error surface (triangle 56pt appPrimary + message + `OnboardingLiquidGlassButton` "Retry" and "Continue without subscription" **skip escape hatch**); **own top-trailing ✕ overlay** (guaranteed close regardless of RC template version) → `onUserDismissed()` (host flips the cover — state lifted to avoid the blank-modal trap).
- Logic: 10s timeout watchdog → error copy; `onPurchaseCompleted`/`onRestoreCompleted` (restore only collapses when the "WagerProof Pro" entitlement is actually active) → `finalize` — `revenueCat.refreshCustomerInfo()`, Meta SDK conversion events (trial→trackPurchase `fb_mobile_purchase`, paid→trackSubscribe with predicted-LTV multipliers monthly×4 / yearly×1.3, params fb_currency/fb_content_id "{type}_subscription"/fb_order_id/fb_predicted_ltv; force flush), then dismiss. Mixpanel purchase event deliberately not fired (FIDELITY-WAIVER #053).

---

# 3. CHAT (17 files)

## 3.1 `WagerBotChatSharedTypes.swift` (150 ln)
- **`WagerBotUiTokens`**: full light/dark token structs resolved once per body and passed by value. Dark: page #0A0A0A, surface #141414, border #262626, primaryText #F8FAFC, muted #94A3B8, userBubble #1F1F1F, composer #141414/#2A2A2A, hintChip #1A1A1A/#E2E8F0, control #1F1F1F, primaryAction bg #F8FAFC fg #0A0A0A, accent **#22C55E**. Light: page #FFFFFF, surface #F8FAFC, border #E2E8F0, text #0F172A/#64748B, userBubble #F1F5F9, hintChip #F1F5F9/#334155, primaryAction #0F172A/#FFFFFF, accent **#16A34A**. Port as an immutable Compose data class keyed off dark theme.
- **`WagerBotDynamicIcon`**: welcome-state avatar — radial appPrimary halo (1.6×, pulsing 0.95↔1.05 / 2s), disc with 0.35 accent ring rotating 360°/7s linear, `WagerBotIcon` sparkle scaling 1.0↔1.08 with ±1.8° wiggle.

## 3.2 `WagerBotChatView.swift` (677 ln) — chat surface
- **Navigation placement**: pushed as a REAL PAGE on the active tab's NavigationStack (`wagerProofChatDestination`), back button hidden (toolbar ✕ pops), tab bar hidden.
- **Pro gate**: `proAccess.isLoading` → plain spinner (avoid locked-state flash); `!isPro` → `lockedState` (WagerBotIcon 56 + amber lock.fill badge, "WagerBot Pro" 24pt bold, copy, amber "Unlock with Pro" crown capsule → dismiss then `tabStore.isSettingsPresented = true`, top-right Close).
- **Store**: local `@State WagerBotChatStore` — `messages: [WagerBotMessage]`, `draft`, `isStreaming`, `threadId`, `threadTitle`, `threads`, `historyLoadState`, `bind(userId:)`, `refreshHistory`, `send(text:)`, `cancel()`, `newConversation()`, `loadThread(_:)`, `deleteThread`, `deleteAllThreads`. `.task` binds user + refreshes history; `.onDisappear` cancels the in-flight stream. Env: Auth/ProAccess/MainTab/Games + all 5 sport game-sheet stores.
- **Toolbar**: leading ✕; principal WagerBotIcon 18 accent + title (`threadTitle` or "WagerBot", animated swap) over "Sports betting AI" 11pt; trailing ellipsis Menu — "New conversation" (square.and.pencil, only when messages exist), "History" (clock.arrow.circlepath), DEBUG-only model Picker (persists `WagerBotModelSelection.currentId`, model switch starts a fresh thread).
- **Messages list & scroll choreography** (the load-bearing part):
  - Empty → `welcomeState`; else GeometryReader + ScrollViewReader + ScrollView + LazyVStack(spacing 16, hPad 16, maxWidth 720 centered).
  - Anchors: `chat-top-anchor`; per-message `.id(message.id)`; `chat-bottom-detector` 1pt (onAppear/onDisappear drives `isAtBottom`); `chat-tail-anchor`; **phantom spacer `85% of viewport height`** (min 200) at the bottom.
  - On user submit: set `lastUserMessageId` → **two dispatch-async hops** then `proxy.scrollTo(id, anchor: .top)` spring — the new user bubble pins to the TOP and the assistant streams into the space below. **NEVER auto-scroll during streaming.**
  - Scroll-to-bottom **puck** (arrow.down in 40pt circle, composer bg + border + shadow) rises above the composer when `!isAtBottom && !messages.isEmpty`, transition scale(0.6, bottom)+opacity; tap → spring scroll to tail anchor.
  - `.scrollDismissesKeyboard(.interactively)`; tap anywhere resigns first responder.
- **Welcome state**: `WagerBotDynamicIcon(72)`, "What's on your slip today?" 22pt bold, "Try one of these" + prompt carousel — **12 canned prompts, 3 pages × 4** (exact strings in file: "What are the best bets today?" … "Explain how the model weights matchups"), inner `TabView(.page)` height 240 of full-width seed chips (14pt medium, r14 hintChip bg + border; tap = light haptic + send), custom capsule page dots (active = accent 18×6, else border 6×6, tappable). Carousel collapses (opacity+scale 0.96) while the composer is focused.
- **Composer** (bottom `safeAreaInset`): r24 `liquidGlassBackground(interactive:)` + composerBorder stroke + shadow; vertical-axis TextField (1–4 lines) with custom bold placeholder "Ask anything"; any newline in the draft is intercepted → cleaned + sent (keyboard Send key). Trailing 44pt circular button: arrow.up (send, primaryAction colors, hidden until focused/canSend) ⇄ stop.fill while streaming (tap cancels).
- **Sheets**: `isShowingHistory` → `WagerBotConversationsSheet` (env store injected; select → `loadThread`).
- **Nav handoffs**: `openSheet(forGameId:sport:)` — medium haptic, dismiss chat, then per-sport GamesStore lookup (NFL/CFB string id, NBA/NCAAB Int gameId, MLB id or gamePk) → sport sheet store `openGameSheet`. `handleComponentNav(_:)` for V2 components: game/value → select Games tab + openSheet; prop → Props tab; agent/agent_pick → Agents tab; tool → Games tab; all dismiss chat.

## 3.3 `WagerBotChatBubble.swift` (311 ln) — ContentBlock rendering contract
- Message roles: user (right-aligned bubble, ≥32pt leading spacer) vs assistant (full-width leading).
- **Fixed render order regardless of stream arrival**: (1) body blocks (text/thinking/cards/widgets/components in arrival order) OR `WagerBotThinkingIndicator` when streaming with no body yet; (2) consolidated tool-calls pill; (3) game-references pill (only post-stream and when refs exist); (4) follow-ups list (always last, **suppressed entirely while streaming**). Block transition: insertion opacity+move(bottom), removal opacity.
- Body filtering: `toolUse`/`followUps` excluded (out-of-band); `gameCards`/`chatWidgets`/`appComponents` **held back until streaming ends** (no mid-stream slam-in).
- Per-block renderers: `.text` — user: 15pt in r16 userBubble + border, maxWidth 330 (screens ≤470pt) / 530; assistant: `WagerBotMarkdownText` (15pt, textSelection enabled). `.thinking` — bare muted 12pt italic, 4-line cap ("model muttering"). `.gameCards` → `WagerBotSuggestedGamesCarousel`. `.chatWidgets` → stacked `WagerBotActionPreview`s. `.appComponents` → `WagerBotAppComponentsView`.
- Follow-ups: Perplexity-style vertical list — rows of arrow.turn.down.right + 14pt medium question + trailing plus, divider inset 28pt; tap = light haptic + `onFollowUpTap` (sends as next user turn). Dedup + trim.
- Game refs consolidation: union of gameIds across gameCards + chatWidgets blocks, dedup'd.

## 3.4 `WagerBotThinkingIndicator.swift` (130 ln)
- Three pulsing accent dots (phaseAnimator opacity 0.3↔1.0, 0.9s, staggered 0/0.15/0.3s) + **cycling italic verb** (12 betting phrases: "crunching the numbers", "running the models", "checking the lines", "comparing odds", "weighing the matchup", "scanning Polymarket", "reading the splits", "looking up trends", "pulling predictions", "spotting the edge", "tracking the steam", "syncing live data"), rotates every 3s (Timer-driven; transition opacity + 8pt y-offset), verb text = dim base (accent 0.45) with a bright `.shimmering()` copy overlaid and masked to the glyphs. Random initial index.

## 3.5 `WagerBotMarkdownText.swift` (271 ln)
- Block-level markdown renderer (SwiftUI inline markdown collapses structure): splits into paragraphs / bullet lists (`- * •`) / numbered lists (`1.` `1)`) / headings (#…###; h1 19pt, h2 17pt, h3+ 16pt bold) / blockquotes (`>` — 3pt bar + italic; optional `quoteAccent` variant = tinted bg + colored bar); inline bold/italic/code/links via `AttributedString(markdown:, inlineOnlyPreservingWhitespace)`. VStack spacing 8; bullets in 10pt gutter, numbers in 22pt right-aligned monospaced-digit gutter.

## 3.6 `WagerBotToolCallsPill.swift` (135 ln)
- Consolidates all `toolUse` blocks into one collapsible pill: collapsed = up to 4 overlapping 22pt icon circles (accent 0.20 fill, `WagerBotToolCatalog.icon(for:)`, 2pt surface ring, −8 overlap) + count label ("1 action"/"N actions"/"running"/"N running") + chevron, appPrimary 0.10 capsule. **Auto-expands while any call `.running`**, auto-collapses when done; manual tap toggle persists. Expanded = stacked `WagerBotToolUseChip`s.

## 3.7 `WagerBotToolUseChip.swift` (184 ln)
- Per-tool-call chip, 3 states from `WagerBotToolStatus`:
  - `.running`: pulsing 8pt accent dot; **shimmer border** (leading→trailing accent gradient stroke masked to the r10 stroke).
  - `.done(ms, ok: true, summary)`: green checkmark, trailing server summary (e.g. "8 games") 11pt + "412ms" monospaced-digit; static accent-0.18 border; one-shot `.success` haptic on first completion.
  - `.done(ok: false)`: red xmark, `appLoss` 0.10 bg.
- Middle: tool label via `WagerBotToolCatalog.label(for:)` + input summary parsed from the args JSON (league uppercased / "query" quoted / game_id 8-char tail / date / "limit N").

## 3.8 `WagerBotGameReferencesPill.swift` (111 ln)
- Compact pill: up to 4 overlapping 26pt sport-glyph circles (basketball/football/baseball icons; sport colors nba amber, nfl blue, cfb purple, ncaab red, mlb blue) + "N game(s)" + chevron.right; appPrimary 0.08 capsule + 0.18 stroke. Thumbnail tap → `onTap(ref)` opens that game sheet.

## 3.9 `WagerBotSuggestedGamesCarousel.swift` (115 ln)
- Horizontal carousel of 260pt mini game cards from `gameCards` blocks (held until stream end): sport capsule badge + gameTime; away/home abbr rows 16pt bold with signed spreads monospaced; optional "Model: {pick}" row with WagerBotIcon; hintChip bg r14 + border. Tap → parent `openSheet`.

## 3.10 `WagerBotActionPreview.swift` (296 ln)
- Rich inline card for a `present_analysis` widget (legacy V1 path). Header: type icon + label (matchup/model_projection/polymarket/public_betting/injuries/betting_trends/weather with icon map; title override; trailing sport uppercased). Optional markdown analysis. **Type-dispatched KV grid** decoded from the widget's `data` JSON: model_projection (spread_pick, ml_prob — handles both 0–1 and pre-scaled, ou_pick+line, edge), polymarket (implied probs, $volume K), public_betting (bet%/money%), injuries (first 4 players name→status), weather (temp/wind/conditions), matchup (matchup/time formatted "EEE, MMM d · h:mm a"/venue), betting_trends + unknown → generic first-5 k/v scan. Footer "View game details ↗" in accent. Whole card tappable → game sheet.

## 3.11 `WagerBotAppComponentsView.swift` (690 ln) — V2 rich components
- Renders an `appComponents` block: optional markdown summary, then components — 1 component full width; ≥2 → **horizontal scroller of columns of up to 2 cards** (cardWidth `min(290, screen×0.74)`, peeking next column, `scrollClipDisabled`).
- Card chrome (`WagerBotComponentCard`): r16 ultraThinMaterial (0.78 dark) + hairline + shadow; tappable when `component.nav.kind != "none"` (light haptic → `onNav`), trailing chevron when tappable.
- **Type dispatch** (14 kinds): `game`/`value` (header "VALUE PLAY" amber bolt or sport name; `ChatMatchupLogos` overlapping 36pt real-logo glass discs; "AWY @ HOM" 15pt bold + pick line; pills spread / "O/U n" / "Edge +x" with edgeColor ≥5 #00C853, ≥2 #8BC34A), `prop` (teal #14B8A6 figure.basketball; player, pills line / "L10 n%" / trend), `agent` (emoji tile 44pt, name, pills record / ±units green#00C853-red#E53935 / win%), `agent_pick` (brain header + agent name, selection 15pt bold, matchup, 3-line reasoning, trailing WON/LOST/PUSH/PENDING), `editor_pick` (star amber, selection, matchup + best price + book pills, analysis), `tool` (accent icon tile + title/subtitle banner), `model_projection` (stats Proj. Score / Fair Line / Fair Total + edge pills), `polymarket` (purple #8B5CF6; away/home implied % + model %), `betting_trends` (label→value rows), `model_accuracy` (teal scope; Record / Win % / ROI), `injury` (red cross.case; player rows name/team→status or "No notable injuries"), `weather` (sky-blue cloud.sun; Temp/Wind/Precip/Sky), `public_betting` (person.3 splits rows), unknown → title + analysis text (forward-compat).
- Helpers to port: `chatTeamColorPair` (per-sport color tables + hashed fallback), `chatContrastPlate` (luminance-based plate behind same-color logos), `ChatTeamLogo` (GameRowCard-avatar port), `gameTimeLabel` (ISO→"h:mm a ET").

## 3.12 `WagerBotProposalCard.swift` (103 ln)
- Forward-compat confirm/skip proposal card (icon circle + title/detail + Skip/Confirm buttons; Status pending/executing("Working…"+spinner)/confirmed("Done")/failed("Retry")/skipped). **Not currently wired to any block type** — port the shape, low priority.

## 3.13 `WagerBotPendingActionAdapter.swift` (27 ln)
- Trivial adapter seam (`build(widget:) → Decision{widget, openSheet: true}`) — every widget today is "open the game sheet". Keep the seam.

## 3.14 `WagerBotConversationsSheet.swift` (309 ln) — thread list / persistence UI
- Sheet with NavigationStack, inline title "History", leading destructive "Clear All" (disabled when empty; confirmationDialog "Clear all conversations?" → `store.deleteAllThreads()`), trailing "Done".
- Sections: "Pinned" then "History" in insetGrouped List. Row: optional orange pin.fill, title (or "New chat"), relative updated-at (`RelativeDateTimeFormatter` short, from ISO with/without fractional seconds), trailing checkmark (active thread) or chevron. Tap = selection haptic + `onSelect`. **Leading swipe = pin/unpin** (orange; local-only — pinned IDs in `UserDefaults` key `wagerbot.pinnedThreads.{userId}`); **trailing swipe = server-backed Delete** (appLoss). Pull-to-refresh.
- States: idle/loading → 6 `ConversationRowSkeleton`s inside the same insetGrouped list (title 200×14 + timestamp 90×11 + accessory block, shimmer, list disabled); failed → orange triangle + "Couldn't load history" + Retry; empty → bubble icon + "No conversations yet" copy.

## 3.15 `WagerBotVoiceLimitSheet.swift` (191 ln)
- Shown on HTTP 429 from `create-wagerbot-voice-session`. `ChattingRobot` Lottie 96pt hero; headline "You've hit today's voice limit" (free) / "You've hit your Pro voice limit"; friendly body copy per tier; optional server reset line (arrow.clockwise.circle.fill + verbatim 429 message). Buttons: free → "Upgrade to Pro" (appPrimary r14; dismiss then 0.25s-delayed `onUpgrade` → paywall) + "Maybe later"; Pro → single "Got it". Detents medium/large.

## 3.16 `WagerBotVoiceView.swift` (1065 ln) — voice mode UI
- **Placement**: full screen, nav bar hidden, forced dark, idle timer disabled during session, `session.stop()` on disappear.
- **Persisted picks** (`@AppStorage`): `wagerbot.voice` (marin/cedar/ash → display "Sky"/"Vegas"/"Ace" with voice subtitles), `wagerbot.personality` (friendly/spicy), `wagerbot.model` (gpt-realtime "Flagship" sparkles / gpt-realtime-mini "Fast" bolt.fill), `wagerbot.guidance` free text.
- **Visual state machine** (statusText/statusDotColor): error→"Reconnect needed" red; holding→"Listening..." amber; aiSpeaking→"Speaking..."; waiting→"Thinking..."; connecting→"Connecting..."; connected→"Ready" (green); else "Disconnected" (white 0.4). Local mirrors of `session.isAiSpeaking`/`isWaitingForResponse` via onChange; `isHoldingToTalk` tracked locally.
- **Layout** top→bottom on a #0A0A0A→#111827→#0A0A0A vertical gradient (maxWidth 560): header (back chevron = hang-up+dismiss; centered mm:ss session timer, 1s tick task from `connectedAt`; gear → settings sheet) → status pill (8pt dot + text in dot-tinted capsule) → bot header row (waveform icon tile + "WagerBot Voice" 26pt rounded bold) → **orb** (240pt / 200pt compact <620pt tall: blurred accent glow that intensifies with `pulsePhase` when active, accent ring 0.25+0.45×glow, inner dark disc with `ChattingRobot` Lottie; whole orb scales 1+0.06×phase while active; pulse = 1.4s ease repeat) + voice display name + "WagerBot Voice" caption → optional inline error card (red 0.12 r16) → bottom controls.
- **Push-to-talk button**: full-width r20 — disabled (white 0.12, "Connecting..."/"Disconnected"), idle (appPrimary, hand.tap.fill "Press And Hold To Talk"), held (appPrimary 0.85, mic.fill "Release To Send"); gesture combo `LongPressGesture(minimumDuration: 0)` onEnded = press-start + `simultaneousGesture(DragGesture(minimumDistance: 0))` onEnded = release (LongPress never signals release); haptics medium on start / light on end. Start clears waiting/speaking flags + `session.startTalking()`; release → `session.stopTalking()` (commit + response.create).
- Secondary buttons: "Reconnect" (neutral) + "Hang Up" (red-tinted phone.down.fill).
- **Toast**: transient top banner (red 0.92 r12) for 4s on error; inline card persists.
- **Sheets**: settings (fraction 0.6/large) = `VoiceSettingsSheet`; limit sheet (429 detection by code or "daily limit"/"rate limit"/"limit reached" substrings) = `WagerBotVoiceLimitSheet`; paywall = `RevenueCatPaywallView(genericFeature)`.
- **`VoiceSettingsSheet`** (private): "Voice Settings" title; VOICE section (3 option tiles: 40pt icon tile, label+subtitle, checkmark.circle.fill; selecting calls `onVoiceChanged` → persist + **reconnect**, dismiss); PERSONALITY (Friendly face.smiling.inverse; **Spicy flame.fill guarded by a 3-step alert cascade** — "Turn on Spicy Mode?"/"Never mind|I'm curious" → "Are you sure?"/"Take me back|I can handle it"(destructive) → "Last chance!"/"Actually, no|Turn it on"(destructive) — full R-rated warning copy in file; confirm fires `onPersonalityChanged(.spicy)` + reconnect); ADVANCED — model tiles (change reconnects) + Custom Guidance `TextEditor` (min 96/max 160pt, custom placeholder overlay, 1500-char counter that turns red over limit, informational only; applies on NEXT connect, no reconnect).
- Note: despite "waveforms" in older specs, the current design has **no live waveform visual** — the pulsing orb + status pill carry the audio state.

## 3.17 `WagerBotVoiceSession.swift` (≈780 ln) — engine (non-UI, port to Kotlin service)
- `@Observable @MainActor` OpenAI **Realtime API over WebSocket**. Public surface: `state` (idle/requestingSession/connecting/connected/ending/ended/error(String)), `isAiSpeaking`, `isWaitingForResponse`, `isMuted`; `start(voiceWire:rudenessWire:modelWire:guidance:)`, `stop()`, `startTalking()`, `stopTalking()`.
- Connection model: (1) Supabase edge fn `create-wagerbot-voice-session` mints an ephemeral client secret + model (server pre-configures instructions/voice/audio/turn_detection: null — client must NOT send session.update or PTT breaks); (2) WS `wss://api.openai.com/v1/realtime?model=<model>` with Bearer secret — model in URL MUST match minted model; URLSession delegate waits for `didOpenWithProtocol` before sending (avoids "Socket is not connected"). (3) Audio: AVAudioEngine — mic tap → converter → **24kHz mono PCM16** base64 `input_audio_buffer.append` (frames forwarded only while `isMicStreaming`); inbound `response.output_audio.delta` → PCM16 → player node. (4) PTT release sends `input_audio_buffer.commit` + `response.create`. Android: Oboe/AudioRecord + OkHttp WS equivalent.

---

# 4. PROPS (16 files)

## 4.1 `PropsView.swift` (1127 ln) — Props tab root
- **Placement**: tab root, own NavigationStack, large title "Props".
- **Layout**: ScrollView + LazyVStack(pinned section headers). Pinned header = **sticky filter pill row** (same floating Liquid Glass pill chrome as Outliers Trends: 36pt capsules, `liquidGlassBackground(interactive:)` + 0.35 border, 13pt bold text + 9pt chevron.down). Feed content scrolls beneath; MLB additionally shows the **`MLBBestPicksBanner`** riding WITH the feed (scrolls away; 12pt insets), transition opacity+move(top).
- **Pill axes** (order): **Sport** (opens `PropSportPickerSheet` — a sheet, NOT a Menu, so off-season sports can render dimmed with "Out of season" caption; pill itself dims 0.5 when the shown sport is off-season via `SportSeason.isInSeason`); when `sport.hasProps` (MLB/NFL): **Matchup** (per-sport picker sheets; selected pill shows two 18pt team logos + "AWY @ HOM", else grid icon "All games"), **Market** (sheets; NFL pill swaps to bolt.fill + "Prop Signals" when signalsOnly), **Sort** (native Menu Picker; only MLB/NFL which have >1 mode: Game Time clock / L10 Hit Rate flame).
- **State**: `@Environment PropsStore` (shared at tab shell; `selectedSport`, `matchups`/`sortedMatchups()`, `nflPlayers`, `isLoading`, `hasCachedMatchups`, `errorMessage`, `refresh(force:)`) + local `sortMode`, `mlbFilters: MLBPropFeedFilters{gamePk,market}`, `nflFilters: NFLPropFeedFilters{gameId,market,signalsOnly}`, sheet booleans (`showMLBMarketSheet`, `showMLBMatchupSheet`, `showNFLMarketSheet`, `showNFLMatchupSheet`, `showSportSheet`, `showBestPicks`), `selectedProp: PlayerPropSelection?`, `selectedNFLProp: NFLPlayerPropSelection?`, `bestPicksStore: MLBPlayerPropPicksStore`, `@Namespace cardTransition`.
- **Reactive rules** (port exactly): switching sport resets the other sport's filters + resets sortMode if invalid + refreshes (+ MLB refreshes best-picks summary); selecting an MLB market forces `batter_home_runs` back to nil and flips sort to hitRate; selecting an NFL market clears signalsOnly + flips sort to hitRate; enabling signalsOnly forces hitRate sort and clears the game filter if that game has no flagged players; NFL players refresh clears a market filter no longer present on the board.
- **Feeds**: date-grouped sections via `GameDateGrouping` with uppercase 11pt bold tracking-0.8 date headers (leading-aligned 20pt). MLB: `PlayerPropFeed.items(...)` → `PropPlayerCard`s; NFL: `NFLPropFeed.items(...)` → `NFLPropPlayerCard`s. Sort within date: time (tiebreak hitRate desc / name) or hitRate desc (tiebreak time); NFL signalsOnly forces hitRate. Cards `.staggeredAppear(index:)`, 12pt h-padding.
- **Navigation**: card tap → `navigationDestination(item:)` pushes `PlayerPropDetailView` / `NFLPropDetailView` with **zoom transition** (`.navigationTransition(.zoom(sourceID: selection.transitionID, in: cardTransition))` paired with `matchedTransitionSource` on the card — Compose: shared-element transition). `showBestPicks` pushes `MLBBestPicksView`. Settings/Chat destinations as on other tabs.
- **States**: coming-soon (non-props sports — hourglass 48pt + "{Sport} player props coming soon" + "MLB and NFL props are live…"); loading (no cache) → 3× `PropCardShimmer`; error (no cache) → ContentUnavailableView "Failed to load props" + Retry; filtered-empty vs season-empty tiles — season-aware copy via `SportSeason.emptyCopy` when the whole slate is empty, else precise filter-aware labels (e.g. "No {Market} prop signals for AWY @ HOM" — full label-derivation logic in file).
- **In-file sheets**: `PropSportPickerSheet` (insetGrouped rows; off-season rows dimmed 0.55 + caption; medium detent); `MLBPropMatchupPickerSheet` + `NFLPropMatchupPickerSheet` (searchable "Search teams"; "All games" row + Games section with 30pt logo pairs + names; checkmarks); `MLBPropMarketFilterSheet` (All Markets / Pitching / Hitting sections from `MLBPropFeedFilters.sheetPitcher/BatterMarkets`; medium+large detents); `NFLPropMarketFilterSheet` (All Markets row, **Prop Signals row** — orange #F97316 bolt.fill + "N players with a signal" count, selecting sets signalsOnly + clears market; then Passing/Rushing/Receiving/Other sections filtered to markets present on the board).

## 4.2 `PlayerPropFeed.swift` (428 ln) — MLB feed builder (non-view)
- `MLBPropFeedFilters` (gamePk/market; sheet market lists exclude `batter_home_runs`), `MLBPropGameFilterOption(s)` (all-games sentinel first, chronological), `PlayerPropFeedItem` (selection + `headline: MLBHeadlineProp` + team hexes + lineOrder + metricLabel "BEST"/market-uppercased; sort keys sortDate/sortTime/hitRate = l10 over/games).
- `PlayerPropFeed.items`: flattens matchups → away/home starters (K-anchored headline: prefers `pitcher_strikeouts`), lineup batters, extra posted-but-unlisted batter groups; players without a headline for the active filter are dropped. transitionIDs `"prop-{gamePk}-{playerId}-{pitcher|batter}"`.
- Best-Picks resolution: `selection(for pick:...)` 3-level fallback (matchup cache → forced refresh → raw props fetch + `parseGameLabel` "A @ B"/"vs" splitting), transitionID `"best-pick-{id}"`, `preferredMarket` = pick market.

## 4.3 `NFLPropFeed.swift` (256 ln) — NFL feed builder (non-view)
- `NFLPropFeedFilters` (gameId/market/**signalsOnly**; canonical sheet market lists — passing 5, rushing 3, receiving 3, other 5 + uncategorized appended; `sheetMarkets(from:)` filters to present keys sorted by `marketSortIndex`; `filterLabel` = "Prop Signals" when signalsOnly; `flaggedPlayerCount`/`hasFlaggedPlayers`; game options never scoped by the game filter itself but scoped by signalsOnly).
- `NFLPropGameFilterOption(s)`: one per gameId, sorted by date then slot order; away/home resolved from `isHome` else parsed from `2025_12_AWAY_HOME` gameId.
- `NFLPlayerPropSelection` (player + preferredMarket + transitionID "nflprop-{playerId}"), `NFLPropFeedItem` (player, displayMarket, metricLabel "SIGNAL"/"BEST"/market, hitRate = l10HitRate). `headlineMarket(filter:signalsOnly:)`: signalsOnly → first flagged (or the filtered market only if flagged); filtered → that market; default → first flagged else first.

## 4.4 `Components/PropPlayerCard.swift` (245 ln) — MLB feed card
- r26 continuous card, `.ultraThinMaterial` (0.55 dark) + hairline + shadow; padding L12/R14/V9.
- Main row: **avatar** — `PlayerHeadshot(40)` in 44pt `teamGlassDisc(primary/secondary teamVisible)` + soft primary halo, with a 16pt team-logo chip on glass bottom-trailing, both in `LiquidGlassMergeContainer(spacing:14)`; **identity** — name 15pt bold (minScale 0.75) over "vs OPP" 11pt; centered **O/U pills** — "O {line}" 9pt bold muted + odds 11pt bold monospaced (Over tinted appPrimary, Under secondary) in muted capsules; **trend block** — "L10 TREND" 8pt label over `RecentFormStrip` 74×46.
- Divider, then **bottom info row**: infoItem(metricLabel → market label in appPrimary) · infoItem("L10" → "x/n Over") · infoItem("HIT" → pct, color ≥70 appPrimary / ≥55 #EAB308 / else secondary) · trailing glass **time pill** (9pt bold monospaced).
- `matchedTransitionSource(id: transitionID)`, light-impact haptic. Also defines **`RecentFormStrip`** — last-10 bar strip, bar height ∝ value with `maxVal = max(line×1.5, maxValue, 1)`, cleared → appPrimary green, missed → appLoss 0.7 red, r1.5 bars gap 2.

## 4.5 `Components/NFLPropPlayerCard.swift` (568 ln) — NFL feed card + signal UI
- Mirrors 4.4 (chrome, avatar with `NFLPlayerHeadshot` + NFL logo chip, identity subtitle "POS · vs OPP", trend strip vs `clearThreshold`, bottom row with L10 "hits/n Over" and HIT%; time pill = slot label or date). O/U block: yes/no markets (anytime TD) render a single "TD +460" pill + "{pct} implied" caption instead of O/U pills.
- **`NFLPropSignalFeedStrip`** appended when the displayed market has flags: header (orange #F97316 bolt.fill + "N Prop Signal(s)"), then groups "Supports this prop" (blue appAccentBlue info.circle.fill rows) and "Avoid this prop" (amber appAccentAmber exclamationmark.triangle.fill rows) of compact rows (displayName 11pt black + betDirection 9pt heavy in tinted r10 chips) inside a r14 elevated strip. Resolved via `NFLPropSignalDefinitions.resolve(flags)`; `isAntiSignal` splits the groups.
- **`NFLPropSignalGroup`** (detail-page variant): adaptive grid (min 118) of tappable `NFLPropSignalButton`s (name + direction + circled chevron.up.forward) → `onSelect(signal)`.
- **`NFLPropSignalDetailSheet`** — THE prop-signal sheet: signal displayName 22pt black, oneLiner, blocks "DEFINITION"/"WHY IT WORKS"/"BET DIRECTION", then **`SignalPerformanceStatsSection(backtestHit: signal.typicalHit, seasonDisplay: SignalSeasonRecordDisplay(performance: seasonRecord))`** — i.e. BOTH the all-time backtest hit AND the **season-to-date record** (memory: keep the two records separate); anti-signal amber warning footer. medium/large detents, Done button.
- **`NFLPlayerHeadshot`**: headshotUrl → `NFLTeams.headshotUrl(playerId:)` (numeric ESPN ids only) → initials disc fallback.

## 4.6 `Components/PropCardShimmer.swift` (104 ln)
- Pixel-mirror skeleton of PropPlayerCard: 44 circle, name/vs blocks, two 58×20 capsules, 44×8 + 74×46 trend blocks, divider, 3 info pairs + 44×18 time capsule. Chrome solid (`Color(light:0xFFFFFF,dark:0x202024)`), inner shimmer.

## 4.7 `Components/PlayerHeadshot.swift` (33 ln)
- Circular MLB CDN headshot (`MLBPlayerProps.headshotURL(playerId)`), muted disc + mini spinner while loading, person.fill on failure, 1pt border.

## 4.8 `Components/MLBBestPicksBanner.swift` (38 ln)
- `HoneydewOptionCard("Best MLB Props", subtitle live once graded: "N settled · +x.xu · yy% win" else "Today's AI picks + track record", actionWord "View all", emerald #10B981/#6EE7B7, 10 drifting symbols)` → onTap pushes Best Picks.

## 4.9 `MLBBestPicksView.swift` (606 ln)
- Pushed hub, inline title "Best MLB Props". Header card (sparkles "Algorithm Best Picks" + methodology copy "…Stakes: Lean 0.5u · Strong 1.0u · Elite 1.5u."). Segmented Picker **Performance | Today's Picks** (default Performance).
- **Performance**: 2×2 KPI grid (Settled w/ "W-L-P" sub, Win Rate "excludes pushes", Units Won on staked (±color), ROI "units ÷ stake"); per-tier sections (tier emoji+label header + "N settled · ±u · % ROI") each a mini table — header row Market/W-L-P/Units/ROI (fixed col widths 46/54/62) + market rows (emoji + label, records monospaced, units/ROI tinted win/loss); "Recent Graded Picks" list — rows with headshot+team-badge avatar (40+18), player/team/date, WON/LOST/PUSH result badge capsule, market line "Label U|O line" + tier chip, "Actual: n" + ±units heavy.
- **Today's Picks**: "🥎 Batter Picks" / "⚾ Pitcher Picks" sections of pick cards — avatar 52+22, tier pill "{emoji} TIER · score" (elite solid appPrimary / strong 0.85 / lean muted), optional lock.fill "Locked", name, "team · gameLabel · ☀️ Day|🌙 Night", market emoji+label, "Over/Under {line} {odds}" bold appPrimary, "{pct}% L10 · x/n", up to 3 rationale bullets; card bg/border tier-tinted. Tap → `openPickDetail` (async resolve w/ spinner + `resolvingPickId` disable; 3-level fallback per 4.2) → pushes `PlayerPropDetailView(selection:, initialLine: pick.line)`.
- States: loading → 3 redacted 72pt rounded placeholders; error → ContentUnavailableView + Retry; empty per segment ("No graded picks yet…" / "No qualified picks right now…").

## 4.10 `PlayerPropSelection.swift` (46 ln)
- Nav payload (Identifiable/Hashable by transitionID): player identity/role/position/batSide, team+opponent names/abbrs/logo, opposing starter name/hand/archetype, gameTimeEt/officialDate/gamePk, `preferredMarket`, full `props: [MLBPlayerPropRow]` ladder set (self-contained detail — NO refetch), `gameIsDay`.

## 4.11 `Detail/PlayerPropDetailView.swift` (305 ln) — MLB prop detail
- Pushed with zoom transition. `CollapsingWidgetScroll(heroMax 134, heroMin 116)` over `TeamAuraBackground(team vs opp primaries)`.
- **Hero** (collapsing, lerped): top row (☀️ Day/🌙 Night · "vs OPP" · time); `PlayerHeadshot` lerp 50→32 in teamGlassDisc ring + halo; name 19→16 heavy + subtitle (pos · batSide · "vs {starter} ({R/L}HP)" · archetype icon+label) fading out (detail = 1−p×1.9); right: **live hit-rate %** (27→21 heavy appPrimary + "x/n L10" caption) with `.contentTransition(.numericText())` rolling; **pinned segmented market Picker** (when >1 market) — scroll-spy highlights the market in view, tapping scrolls the widget flush under the collapsed hero (anchor y = heroMin/viewport, spy suppressed 0.45s after a tap).
- **Content**: one `WidgetCollapsingSection(marketLabel, chart.bar.fill)` per market row: verdict sentence (`MLBPlayerProps.buildVerdict`, numericText-animated on line change) → `RecentPropBarChart(bars, line)` → Divider → `PropContextTiles` → batter-archetype footnote ("…relievers are not counted.") → market/line/odds summary line.
- **Scroll-spy plumbing**: per-widget GeometryReader tracker writing global minY into a reference-type `SpyStore` (no re-render on scroll); active = deepest section with top ≤ 178pt anchor.
- **Bottom `safeAreaInset`**: `PropLineScrubber` for the active market, `.id(activeMarket)`; per-market selected line dictionary (`selectedLines`), lazily defaults to `MLBPlayerProps.defaultLine`; `initialLine` seeds the preferred market's line (Best Picks entry). Tab bar hidden; nav title empty (name lives in the hero).

## 4.12 `Detail/PropLineScrubber.swift` (176 ln)
- Liquid Glass bottom bar (r28) replacing the tab bar: **readout** ("LINE" 9pt + selected line 22pt heavy rounded numericText; O/U odds chips numericText-rolling) + **scroll wheel** — horizontal ladder of 58pt ticks (tick mark 2×14/22 + line label 14/17pt, centered enlarges), `scrollPosition(id:, anchor: .center)` + custom `SnapToTickBehavior` (rounds offset to tickWidth multiples so a tick ALWAYS centers under the fixed appPrimary caret), `.scrollTransition` scales side ticks 0.78/opacity 0.4, edge fade mask (0.18/0.82 stops), tick tap animates to center; two-way sync `centered ⇄ selectedLine`; selection haptic. Compose: LazyRow + snap fling behavior + center marker.

## 4.13 `Detail/RecentPropBarChart.swift` (105 ln)
- Swift Charts bar chart of last N games: bars r2 width-ratio 0.62, cleared → appPrimary / missed → appLoss 0.7, value annotation on top (9pt bold matching color); dashed RuleMark at the selected line (1.2pt dash 4-3 appPrimary 0.85, "Line n" annotation trailing); fixed x-domain oldest→newest, y 0…`max(line×1.5, maxBar, line+1, 1)` (RN-parity stable scaling); x labels = "M/D" vertical 8pt; **`.animation(.easeInOut 0.25, value: line)`** — the threshold slides and bars recolor live as the scrubber moves. Empty → "No recent games" italic.

## 4.14 `Detail/PropContextTiles.swift` (74 ln)
- 3-col grid of hit-split tiles: L10 (always), day/night ("☀️ Day"/"🌙 Night") when present, "vs {Archetype} SP" (batters). Tile: uppercased 10pt label, fraction 22pt heavy appPrimary (numericText), "Over · pct%" caption; muted r10 bg + border; **low-confidence (<5 games) dims to 0.75**.

## 4.15 `Detail/NFLPropDetailView.swift` (706 ln) — NFL prop detail (trend board)
- Same collapsing-hero shell (heroMax 88 / heroMin 72 — no market picker; markets stack vertically). Hero: top row (Week N · opponentLabel · date/slot), `NFLPlayerHeadshot` disc + name + subtitle (pos · team · reportStatus).
- Content = eager VStack (NOT lazy — lazy + scrollTo skipped widgets) of per-market `WidgetCollapsingSection`s + a footnote ("Lines are the consensus close (median across books). Trends are point-in-time season game logs."). On open, auto-scrolls to the headline market (preferred → first flagged → first) after 380ms.
- Each market widget = sectioned trend board, each section header has an **info (ⓘ) button → `NFLPropMetricHelpSheet`** (11 canned help entries keyed posted_line/game_log/book_odds/season_stats/last_game/l3_avg/l5_avg/szn_avg/szn_high/opp_defense/line_movement — full copy in file, medium detent):
  1. **Posted Line** — consensus close sentence (O/U or anytime-TD implied-prob variant) + `NFLPropSignalGroup(flags)` when flagged → tapping a signal opens **`NFLPropSignalDetailSheet` with `seasonRecord: propPerfByCode[code]`** — season-to-date record loaded via `SignalPerformanceService.performances(for: .nfl, season:)`, keyed by short P-code (P14 from P14_attempts_model_under).
  2. **Game Log** — `NFLPropTrendChart`: bar chart vs close line (or 0.5 TD bar for yes/no), bar annotations, dashed "Line n"/"TD" rule with capsule label, fixed x-domain, then a **logo row** — 20pt opponent `GameCardTeamAvatar` + "W{n}" under each bar — plus caption.
  3. **Best Lines** (when best-book quotes exist) — rows "Over 262.5 -110 @ [logo] DraftKings" (side 14pt heavy + line/odds monospaced appPrimary + `SportsbookLogoView`), yes/no shows Yes only.
  4. **Season Stats** — 3-col grid of tappable stat tiles (each with its own ⓘ): Last Game, L3 Avg, L5 Avg, Season Avg, Season High, **Opp Defense** ("ABR +12%" matchup index vs league avg; ≥1.08 green appPrimary, ≤0.92 red appLoss).
  5. **Line Movement** (when open+close present) — "Line 258.5 → 262.5 — moved +4.0 from the open. Books were spread across a 6-point range." or implied-prob move for TD.
- Sheets: `selectedSignal` → signal sheet; `metricHelp` → help sheet.

## 4.16 `PropsFixtures.swift` (179 ln) — DEBUG only
- Aaron Judge hits/total-bases MLB rows (line ladders + 15-game logs) + `sampleSelection`; NFL `nflBoard` (Josh Allen pass/rush yds w/ flags P1, Mahomes pass yds + anytime TD w/ P5, best-book quotes) shaped like `nfl_dryrun_props`. Port as screenshot-test fixtures.

---

# 5. Compose porting notes

## Cross-cutting infrastructure to build FIRST (blocking many views)
1. **Glass system**: `liquidGlassBackground` → frosted translucent surface (Modifier w/ blur/alpha per theme; no live refraction on Android — approximate with translucent surfaces + hairline borders); `LiquidGlassMergeContainer` → simply overlap discs (merge effect is decorative); `teamGlassDisc` → team-tinted gradient circle + border.
2. **Skeleton kit**: SkeletonBlock/Circle/Capsule composables + a single travelling shimmer `Modifier.shimmering()` (one sweep across the whole group, chrome excluded).
3. **`staggeredAppear(index)`**: per-item `AnimatedVisibility`/graphicsLayer fade + 14dp lift, delay index×~60ms (cap 8).
4. **`CollapsingWidgetScroll` + `TeamAuraBackground` + `MatchupGlassHero` + `WidgetCollapsingSection`**: collapsing-toolbar pattern (nested scroll connection driving `progress` 0–1) with lerped hero metrics.
5. **Pinned section headers**: `LazyColumn` + `stickyHeader` replaces `LazyVStack(pinnedViews:)` everywhere (Outliers filter row, Props filter row, model-accuracy sort bar).
6. **Zoom card→detail transition**: `matchedTransitionSource`/`navigationTransition(.zoom)` → Compose shared-element transitions (androidx.compose.animation SharedTransitionLayout), keyed by `transitionID`.
7. **`.contentTransition(.numericText())`**: rolling digits → `AnimatedContent` with slide/fade per-digit or a count-anim library; used heavily in prop detail + scrubber.
8. **Haptics**: `.sensoryFeedback(.selection/.impact/.success)` → `LocalHapticFeedback`/Vibrator wrappers; note counter-triggered one-shot patterns (`ptStartCount &+= 1`).
9. **Sheets**: `presentationDetents([.medium,.large])`/`.height(measured)`/`presentationBackground(.clear|.ultraThinMaterial)` → ModalBottomSheet with custom sheet states; the **fit-to-content clear-background sheet** (OutliersTrendDetailSheet) needs a transparent container + wrap-content.
10. **Charts**: Swift Charts (bar + gaussian area/line + RuleMark annotations) → Vico/custom Canvas. Needed: onboarding time-saved bars, bell curves, MLB/NFL prop bar charts w/ animated dashed threshold.
11. **Pixelwave/ripple/pixel-sprite stack** (onboarding): `AnimatedAccentPixelWave`, `GlyphRippleEmitter` + `.glyphRipple(on:)`, `PixelSpriteAvatar`, `WorkingDeskAvatar`, `GlyphMatrix3x3`, `GenerationLoadingBar`, `ToolActivityStack` — custom Canvas composables; the ripple emitter becomes a shared flow the background collects.
12. **Lottie**: confetti, ChattingRobot → lottie-compose.
13. **SSE/WS**: WagerBotChatStore streaming (SSE content blocks) + WagerBotVoiceSession (OkHttp WebSocket + AudioRecord/AudioTrack @ 24kHz PCM16).
14. **Platform swaps**: ATT page → drop or replace with notification/consent priming; RevenueCatUI PaywallView → RevenueCat Android Paywalls (placement `onboarding`); Meta events → Facebook Android SDK; `@AppStorage`/UserDefaults → DataStore (keys `wagerbot.voice/personality/model/guidance`, `wagerbot.pinnedThreads.{userId}`).

## Suggested Kotlin file checklist

### `com.wagerproof.app.features.outliers`
- [ ] `OutliersScreen.kt` ← OutliersView.swift
- [ ] `OutliersTrendsView.kt` (+ `OutliersMatchupPickerSheet`, `DiagonalMatchupLogos`, `GlassTeamAvatar`, `OutliersTrendSelection`) ← OutliersTrendsView.swift
- [ ] `OutliersDetailScreen.kt` (value/fade router + sport pills + alert shimmer) ← OutliersDetailView.swift
- [ ] `OutlierFeed.kt` (OutlierFeedItem/OutlierSignal/OutlierAggregator) ← OutlierFeed.swift
- [ ] `OutlierSections.kt` (Kind + rankers + OutlierCardBuilder) ← OutlierSections.swift
- [ ] `OutlierMatchupDetailScreen.kt` ← OutlierMatchupDetailView.swift
- [ ] `OutlierSectionListScreen.kt` ← OutlierSectionListView.swift
- [ ] `NbaModelAccuracyScreen.kt` (+ card shimmer) ← NBAModelAccuracyView.swift
- [ ] `NcaabModelAccuracyScreen.kt` (+ card shimmer) ← NCAABModelAccuracyView.swift
- [ ] `components/OutliersTrendCard.kt` (compact/expanded + row-icon dimension parser) ← OutliersTrendCard.swift
- [ ] `components/OutliersTrendCardShimmer.kt` ← OutliersTrendCardShimmer.swift
- [ ] `components/OutliersTrendDetailSheet.kt` (clear bg, fit-height) ← OutliersTrendDetailSheet.swift
- [ ] `components/OutlierAlertCard.kt` ← OutlierAlertCard.swift
- [ ] `components/OutlierGameTile.kt` ← OutlierGameTile.swift
- [ ] `components/OutlierInsightCard.kt` ← OutlierInsightCard.swift
- [ ] `components/OutlierPropCard.kt` ← OutlierPropCard.swift
- [ ] `components/OutlierMatchupCard.kt` (+ **OutlierTeamPalette** color/logo tables) ← OutlierMatchupCard.swift
- [ ] `components/OutlierCardShimmer.kt` ← OutlierCardShimmer.swift
- [ ] `components/ToolExplainerBanner.kt` ← ToolExplainerBanner.swift
- [ ] `components/OutliersHeroHeader.kt` (legacy — port only if hub still references) ← OutliersHeroHeader.swift
- [ ] `components/OutliersHowToBanner.kt` ← OutliersHowToBanner.swift
- [ ] `components/OutliersLearnMoreSheet.kt` ← OutliersLearnMoreSheet.swift
- [ ] `components/BettingTrendsInsightWidget.kt` ← BettingTrendsInsightWidget.swift
- [ ] `components/TrendsMatrixView.kt` (types + pct color + section renderer + TrendsTeamAvatar) ← TrendsMatrixView.swift
- [ ] `components/BettingTrendsDetailSheet.kt` (guide copy verbatim) ← BettingTrendsDetailSheet.swift
- [ ] `components/MlbTrendsMatrixAdapter.kt` ← MLBTrendsMatrixAdapter.swift
- [ ] `components/NbaTrendsMatrixAdapter.kt` ← NBATrendsMatrixAdapter.swift
- [ ] `components/NcaabTrendsMatrixAdapter.kt` ← NCAABTrendsMatrixAdapter.swift
- [ ] `OutliersFixtures.kt` (debug/test source set) ← OutliersFixtures.swift

### `com.wagerproof.app.features.onboarding`
- [ ] `OnboardingScreen.kt` (root: pixelwave layer, phase switch, tint retarget, genesis lifecycle) ← OnboardingView.swift
- [ ] `OnboardingStep.kt` (alias/enum mapping) ← OnboardingStep.swift
- [ ] `OnboardingTheme.kt` ← OnboardingTheme.swift
- [ ] `OnboardingPageSpec.kt` ← OnboardingPageSpec.swift
- [ ] `OnboardingPageSlot.kt` (CompositionLocal `LocalOnboardingPageIsActive`) ← OnboardingPageSlot.swift
- [ ] `OnboardingCarouselContainer.kt` (shell + directional slide pager + draft seeding/projection) ← OnboardingCarouselContainer.swift
- [ ] `pages/OnboardingPageKit.kt` (pageEntrance, scaffold, press style, Chip/OptionCard/FeatureRow) ← OnboardingPageKit.swift
- [ ] `pages/OnboardingTermsPage.kt` (scroll sentinel + checkbox; legal copy verbatim) ← OnboardingTermsPage.swift
- [ ] `pages/OnboardingSportsPage.kt` ← OnboardingSportsPage.swift
- [ ] `pages/OnboardingSportsShowcasePage.kt` ← OnboardingSportsShowcasePage.swift
- [ ] `pages/OnboardingBettorTypePage.kt` ← OnboardingBettorTypePage.swift
- [ ] `pages/OnboardingPersonalizedValuePage.kt` (casual chart / sharp features branch) ← OnboardingPersonalizedValuePage.swift
- [ ] `pages/OnboardingAcquisitionPage.kt` ← OnboardingAcquisitionPage.swift
- [ ] `pages/OnboardingPrimaryGoalPage.kt` ← OnboardingPrimaryGoalPage.swift
- [ ] `pages/OnboardingAgentPitchPages.kt` (intro 3-slide pager + bell curves + example trend card; proof page) ← OnboardingAgentPitchPages.swift
- [ ] `pages/OnboardingAttPage.kt` → **REPLACE**: no ATT on Android (notification-permission priming or remove step; renumber carousel) ← OnboardingATTPage.swift
- [ ] `pages/OnboardingBuilderPages.kt` (sports / archetype / identity incl. 16 gradient strings + 8-sprite picker) ← OnboardingBuilderPages.swift
- [ ] `pages/OnboardingPersonalityPages.kt` (mindset/betstyle/datatrust/sportrules/insights; all slider label arrays verbatim) ← OnboardingPersonalityPages.swift
- [ ] `cinematic/OnboardingGenesisModel.kt` (coroutine ViewModel: script, timings 15s/30s, submit+retry, sprite patch, teaser picks + fixtures) ← OnboardingGenesisModel.swift
- [ ] `cinematic/OnboardingGenerationCinematic.kt` ← OnboardingGenerationCinematic.swift
- [ ] `cinematic/OnboardingRevealView.kt` (ticket deal timeline, confetti, markComplete) ← OnboardingRevealView.swift
- [ ] `PostOnboardingPaywall.kt` (RevenueCat Android paywall for `onboarding` placement + timeout/retry/skip + close overlay + Meta events) ← PostOnboardingPaywall.swift

### `com.wagerproof.app.features.chat`
- [ ] `WagerBotUiTokens.kt` + `WagerBotDynamicIcon.kt` ← WagerBotChatSharedTypes.swift
- [ ] `WagerBotChatScreen.kt` (pro gate, toolbar/menu, list + scroll-pin choreography incl. 85% phantom spacer + bottom detector + puck, welcome carousel w/ 12 prompts, composer, nav handoffs) ← WagerBotChatView.swift
- [ ] `WagerBotChatBubble.kt` (fixed block order contract + streaming hold-backs) ← WagerBotChatBubble.swift
- [ ] `WagerBotThinkingIndicator.kt` (dots + cycling shimmer verbs) ← WagerBotThinkingIndicator.swift
- [ ] `WagerBotMarkdownText.kt` (block parser + inline AnnotatedString) ← WagerBotMarkdownText.swift
- [ ] `WagerBotToolCallsPill.kt` ← WagerBotToolCallsPill.swift
- [ ] `WagerBotToolUseChip.kt` (running shimmer border / done / error) ← WagerBotToolUseChip.swift
- [ ] `WagerBotGameReferencesPill.kt` ← WagerBotGameReferencesPill.swift
- [ ] `WagerBotSuggestedGamesCarousel.kt` ← WagerBotSuggestedGamesCarousel.swift
- [ ] `WagerBotActionPreview.kt` (widget-type KV renderers) ← WagerBotActionPreview.swift
- [ ] `WagerBotAppComponentsView.kt` (14-type dispatch, 2-row column scroller, ChatTeamLogo/contrast plate) ← WagerBotAppComponentsView.swift
- [ ] `WagerBotProposalCard.kt` (forward-compat, low priority) ← WagerBotProposalCard.swift
- [ ] `WagerBotPendingActionAdapter.kt` ← WagerBotPendingActionAdapter.swift
- [ ] `WagerBotConversationsSheet.kt` (skeleton/pin-swipe/delete-swipe/clear-all; pins in DataStore) ← WagerBotConversationsSheet.swift
- [ ] `WagerBotVoiceLimitSheet.kt` ← WagerBotVoiceLimitSheet.swift
- [ ] `WagerBotVoiceScreen.kt` (state machine, orb, PTT press/release gesture, settings sheet incl. 3-step spicy dialog cascade + guidance editor, toast, timer) ← WagerBotVoiceView.swift
- [ ] `WagerBotVoiceSession.kt` (OkHttp WS + AudioRecord/AudioTrack 24kHz PCM16, edge-fn session mint, PTT commit protocol — do NOT send session.update) ← WagerBotVoiceSession.swift

### `com.wagerproof.app.features.props`
- [ ] `PropsScreen.kt` (pills, reactive filter rules, date sections, states, all 5 in-file sheets: sport/matchup×2/market×2) ← PropsView.swift
- [ ] `PlayerPropFeed.kt` (MLB filters/options/items + best-pick resolution) ← PlayerPropFeed.swift
- [ ] `NflPropFeed.kt` (filters incl. signalsOnly, options, headline-market logic) ← NFLPropFeed.swift
- [ ] `PlayerPropSelection.kt` ← PlayerPropSelection.swift
- [ ] `MlbBestPicksScreen.kt` (Performance/Today's segments, KPI grid, tier tables, pick cards, async detail resolve) ← MLBBestPicksView.swift
- [ ] `components/PropPlayerCard.kt` (+ RecentFormStrip) ← PropPlayerCard.swift
- [ ] `components/NflPropPlayerCard.kt` (+ NFLPropSignalFeedStrip, NFLPropSignalGroup, **NFLPropSignalDetailSheet** w/ season-to-date + backtest stats, NFLPlayerHeadshot) ← NFLPropPlayerCard.swift
- [ ] `components/PropCardShimmer.kt` ← PropCardShimmer.swift
- [ ] `components/PlayerHeadshot.kt` ← PlayerHeadshot.swift
- [ ] `components/MlbBestPicksBanner.kt` ← MLBBestPicksBanner.swift
- [ ] `detail/PlayerPropDetailScreen.kt` (collapsing hero + scroll-spy + segmented picker + per-market line state + bottom scrubber inset) ← PlayerPropDetailView.swift
- [ ] `detail/NflPropDetailScreen.kt` (trend board sections + metric-help sheet copy + signal perf load keyed by P-code) ← NFLPropDetailView.swift
- [ ] `detail/PropContextTiles.kt` ← PropContextTiles.swift
- [ ] `detail/PropLineScrubber.kt` (snap-to-tick wheel + caret + edge fade) ← PropLineScrubber.swift
- [ ] `detail/RecentPropBarChart.kt` (animated threshold + recolor) ← RecentPropBarChart.swift
- [ ] `PropsFixtures.kt` (debug source set) ← PropsFixtures.swift
