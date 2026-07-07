# Agents Feature Inventory — Part 4: Pixel Office, Cards, Charts, Sheets

> Parity contract for the Android (Jetpack Compose) port. Source: `wagerproof-ios-native/Wagerproof/Features/Agents/`.
> Covers: PixelOffice(+Scene/Node/Assets), PixelSpriteAvatar, PixelEmojiInline, AgentCard, AgentRowCard, AgentIdCard, AgentDetailHero, AgentHeaderActionZone, AgentLeaderboard, AgentChatRoom, AgentResearchIdleCard, AgentOverlapFooter, BinAgentsSheet, CollapsingAgentsHeader, CompanyDashboardBanner, DistributionHistogramChart, FittedCurveOverlayChart, AgentPerformanceCharts, AgentStatsSkeleton, GlowAccentBar, GlowingCardWrapper, AgentColorPalette, AgentCardGlyphTexture, SwipeableRow, AgentGenerationControlSheets, AgentHRBottomSheet.

### `PixelOffice.swift` (~287 lines)
- SwiftUI host wrapper for the pixel-art "Agent HQ" office SpriteKit scene; hero row on the Agents hub. `PixelOffice` (host) + `PixelOfficeSceneRepresentable` + `PixelOfficeAgentSpec: Equatable`.
- **Inputs**: `agents: [AgentWithPerformance]?` (nil → 4 named fallback agents: "Line Hawk", "Spread Eagle", "Model Maven", "Value Hunter" states working/thinking/working/idle; up to 8 real agents, one per desk), `isActive = true` (false pauses scene).
- **Layout**: ZStack(topLeading) — scene via `.aspectRatio(864/800, .fit)` (MUST constrain or SKView collapses in ScrollView); bottom-right `controlChips` (padding 8): time-mode pill (🌙/☀️ emoji 14pt + "Auto"/"Day"/"Night", 12pt semibold tracking 0.3 white, hPad 11/vPad 7, `liquidGlassBackground(Capsule)`) + floor-style pill (🏢 "Standard" / 🚀 "Future"). Clipped r20 continuous. SKView bg `#0f1118`, 30fps, ignoresSiblingOrder, async rendering.
- **Prefs**: `@AppStorage("pixel-office-floor-style")` default `"future"`; `@AppStorage("pixel-office-time-mode")` default `"auto"` (auto: night = hour ≥19 || <6). Scene paused when `!isActive || scenePhase != .active`. Targeted `updateFloor(key:)` / `updateAgents(_:)` pushes on change of `currentFloorKey` ("`{style}_{day|night}`") / agentSpecs.
- **Interactions**: time pill cycles auto→day→night→auto; floor pill toggles standard↔future.

### `PixelOfficeScene.swift` (~656 lines)
- The SKScene driving the office sim. Defines `PixelOfficeAgentSpec` (displayName, emoji, accentColorHex, spriteIndex 0-7, state, stateLabel, isActive) + `.make(from:)` state derivation: `!isActive` → idle/"OFF"; `lastGeneratedAt` today (ISO8601) → done/"PICKS READY"; else working/"WORKING".
- **Scene**: size 864×800, aspectFit, bg `#0f1118`, anchor (0,0); RN top-down Y flipped via `flipY(y) = 800 - y`. Z-order: z0 floor sprite (`floor_{style}_{day|night}`, only background); z2 sixteen laptops (32×64 at `PixelOfficeLaptops.spots`, open/closed textures); z3–3.9 agents (depth-sorted by mapY); z3.92 particle layer (pooled SKShapeNodes); z4 `office_fg` overlay.
- **updateAgents(specs)**: removes all nodes, clears claims/particles; caps to 8; spawns at shuffled spawn points ±4px jitter, facing down; staggered forced routing at `0.6 + i*0.4s` (agents walk from spawn to station — deliberate deviation from RN); periodic churn every 5s: one random agent gets new state (inactive: [idle×3, thinking]; active: [working, thinking, done, working, thinking, idle]).
- **Routing (`setAgentState`)**: working/thinking → claim desk; done → idle point; idle → idle or meeting point; error → stay. Claims in a Set (no shared points); 8-directional A* over the collision grid; `bubbleEmoji` from `PixelOfficeActivity.bubbles` (dormant for working/idle/meeting).
- **Game loop**: dt clamp 0.1s. `stepAgents`: tile lerp at walkSpeed 110px/s; final exact-approach (<4px snap); direct fallback (<3px); facing from dominant axis. Anim key: walking → `{dir}_walk`; done → `front_done_dance`; error → `front_alert_jump`; working/thinking at desk → `{ptDir}_sit_work`/`{ptDir}_sit_idle`; else `{dir}_idle`. Frame cycling: 2fps arrived+idle else 6fps, 4 frames. `relaxLabels`: 10 relaxation passes push name tags sharing a vertical band (bandH 52) apart (halfW 56, padX 6, deterministic tie-break), clamp ±74, glide lerp `min(1, dt*9)`. Particles: tick 0.3s — coffee steam (white 0.5α, rises), fire embers (orange rgb(255,140,0) 0.7α); night-only monitor glow over working desks (40%/tick, teal rgb(45,212,191) 0.35α, r2-4, maxLife 1.2); update: life decays, pos += v·dt, opacity = life·0.5, cap 30. `refreshLaptopOccupancy`: seats claimed by working/thinking/error → open-laptop texture via `idToSeat`.

### `PixelOfficeAgentNode.swift` (~237 lines)
- SKSpriteNode subclass — one character, scene-driven (manual frame stepping). `init(agentIndex, avatarIdx 0-7, displayName, emoji, accentColorHex)` (hex handles `gradient:#a,#b` → first; fallback `#94a3b8`).
- **Fields**: mapX/Y, targetX/Y, fromX/Y, toX/Y, facing, arrived, path [GridCoord], pathIdx, moveProgress, state, isActive, claimedPointKey, bubbleEmoji, animKey ("front_idle"), frameIdx, animTimer; lastTextureKey memo.
- **Children**: sprite 48×64 center anchor nearest. nameTag (zPosition 100): state pill rect 84×21 r5 at y=82, fill `PixelOfficeStateColor.forState`, `AvenirNext-Heavy` 13pt white; name box rect 116×22 r4 at y=56, fill `#0a0c12`@0.85, stroke accent 1.5pt, `AvenirNext-Bold` 15pt `#e0e4ec`, "emoji name" truncated 12 chars + "…". Speech bubble at y=108 (hidden unless arrived + bubbleEmoji): white 0.92α circle r15, 1pt black 0.15α stroke, emoji 17pt.
- **Key methods**: `syncSceneNode()` — position `(mapX, 800 - mapY + 24)` (footAnchorLift = FH/2−8), zPosition `3 + (mapY/800)·0.9`.

### `PixelOfficeAssets.swift` (~575 lines) — ALL constants verbatim-critical
- `PixelAnim` (18 cases): 8-col × 9-row sheet (48×64 frames), 4 frames each: front_idle [0-3], front_walk [4-7], front_sit_idle [8-11], front_sit_work [12-15], left_* [16-31], right_* [32-47], back_* [48-63], front_done_dance [64-67], front_alert_jump [68-71]. `isIdle` = 8 idle/sit_idle cases (2fps vs 6fps).
- `PixelOfficeGeo`: mapWidth 864, mapHeight 800, frameWidth 48, frameHeight 64, sheetCols 8, sheetRows 9, walkSpeed 110, animFps 6, idleAnimFps 2, arriveThreshold 2, tile 32.
- `PixelOfficeStateColor`: idle `#94a3b8`, working `#f97316`, thinking `#8b5cf6`, done `#22c55e`, error `#ef4444`; labels WORKING/THINKING/DONE/ERROR/RESTING.
- `PixelOfficePoints`: 8 desks (row y=544 facing down: x 112/176/304/368; row y=672 facing up: same x), 20 idle points, 8 meeting points (exact coords in Swift source — transcribe). Keys `desk_i`/`idle_i`/`meeting_i`.
- `PixelOfficeActivity.bubbles`: 19 activity→emoji entries (getting_coffee ☕, eating 🍕, watching_tv 📺, gaming 🎮, grilling 🔥, napping 💤, thinking 💭, snacking 🍿, reading 📚, fire_hangout 🔥, socializing/chatting 💬, checking_fridge ❄️, getting_water 💧, petting_dog 🐶, cornhole 🎯, relaxing 🌿, getting_drink 🍺, outdoor_meeting 💬).
- `PixelOfficeLaptops`: 16 LaptopSpots (4 conference y=448, 4 bullpen y=512, 4 conference y=512, 4 bullpen y=576), `idToSeat` {0:10,1:8,2:9,3:11,4:0,5:1,6:2,7:3,8:12,9:14,10:15,11:13,12:4,13:5,14:6,15:7}, texture `office_laptop_{front|back|left|right}_{open|close}`.
- `PixelOfficePathfinding`: 27×25 collision grid — 25-row hardcoded bitmap of '0'/'1' strings (COPY VERBATIM from Swift); 8-dir A* diagonal cost 1.4, Manhattan heuristic, no corner-cutting, end tile allowed if blocked, 2000-node cap, fallback direct tile.
- `PixelOfficeTextureCache` (@MainActor singleton): memoizes avatar sheets (`avatar_0`…`avatar_7` PNGs from `Resources/PixelOffice/`), per-frame crops, static textures; all `.nearest`.

### `PixelSpriteAvatar.swift` (~101 lines)
- Front-idle loop as avatar (AgentCard/AgentRowCard/AgentIdCard/hero disc/LeaderboardRow). `spriteIndex` (clamped 0-7), `animated = true`.
- `Image(uiImage:)` `.interpolation(.none)` resizable scaledToFit. Static cache `[Int: [UIImage]]` of cropped front-idle frames. `TimelineView(.periodic 1/2.5)` at 2.5fps; frame = `(Int(t*fps) + spriteIndex) % count` — **phase-offset by spriteIndex so cards bob out of sync**.

### `PixelEmojiInline.swift` (~30 lines)
- `Text(emoji)` at size (default 16), `.shadow(black 0.18, r1, y1)`, `.baselineOffset(-1)`.

### `AgentCard.swift` (~113 lines)
- Single-column card primitive. `agent: AgentWithPerformance`, `onTap`.
- Button: (1) `GlowAccentBar(color: avatarColor)` top; (2) padded-16: identity HStack — 50×50 r14 avatar (avatarGradient + PixelSpriteAvatar pad 3) + name 18pt bold + sport chips (10pt semibold secondary, appBorder-0.4 r6) + green active dot (`#10B981` 10×10); (3) Divider; (4) 3 stat cells (label uppercased 11pt medium tracking 0.5 secondary; value 16pt bold): Record / Net Units (appWin/appLoss) / Streak. Chrome: appSurfaceElevated, r16, appBorder-0.5 stroke. Defaults "0-0", "+0.00u", "-".

### `AgentRowCard.swift` (~464 lines)
- Full-width row in My Agents list; MLB `GameRowCard` glass language. Exports `AgentFormChart` + private `DottedBaseline`.
- **Inputs**: `agent`, `hasUnreadPicks = false`, `onTap`, `onLongPress`.
- **Layout**: r26 card. (1) main HStack: avatar 52×52 r14 squircle — elevated base + avatarGradient @0.85 + 1.5pt inner stroke, PixelSpriteAvatar pad 3; double shadow brand primary (0.32 r6, 0.18 r10 y2); topTrailing unread dot `#00E676` 11×11 with 1.5pt elevated ring, offset (4,−4); identityBlock: name 16pt bold + 7×7 `#10B981` active dot; strategyChipsRow = first 2 `strategyTags` capsule chips (10pt bold, tag-colored, appSurfaceMuted-0.6 fill + hairline; 2nd chip layoutPriority 1); Spacer; `AgentFormChart` 96×50. (2) Divider. (3) infoRow: sportsCluster (≤3 → icon+label pills [SF 8pt + 9pt bold]; >3 → overlapped coins HStack(spacing −7) 22×22 circles) + Spacer + recordUnits (if totalPicks>0): recordLabel 10pt semibold secondary · win% 11pt heavy (appWin ≥50) · "7D n%" 10pt bold. Background: `.ultraThinMaterial` (0.55 dark), `AgentCardGlyphTexture(avatarColor, seed: id)`, appBorder-0.4 0.5pt stroke; shadow black 0.06 r4 y2.
- **Derived**: `overallWinPct` = wins/(wins+losses); `recentWinPct` = overall + currentStreak·5 clamp 2-98 (**synthetic**). tagColor: archetype→primary, risk 1-2→appWin / 4-5→`#F97316`, betType→appAccentBlue, lean→secondary, value→appWin, fade→`#8B5CF6`.
- **`AgentFormChart`**: VStack trailing: streak badge — flame.fill (W) / snowflake (L) 8pt + "Streak" 9pt semibold + "W3"/"L2"/"—" 10pt heavy (appWin/appLoss/appTextMuted), capsule 0.14α; bars — h28, barWidth 8, spacing 3, bottom-aligned. **Synthetic buckets**: FNV-1a hash of avatarId seeds LCG PRNG, Fisher-Yates shuffles wins+losses bools, split into `min(7, max(3, total/4))` buckets. Red losses stacked ON TOP of green wins, r2, min 2pt, scaled by max volume. Zero graded → `DottedBaseline` dashed [0.5,5] 2pt appTextMuted-0.5.
- Long-press 0.4s → onLongPress. `.sensoryFeedback(.impact(.light))`.

### `AgentIdCard.swift` (~317 lines)
- 2-up grid card. Fixed h195, r20, appSurfaceElevated, 0.5pt appBorder-0.5, shadow black 0.12 r8 y2. (1) 3pt primary→secondary gradient strip; (2) wash gradient [primary 0.08, secondary 0.05, clear]; identityRow — 40×40 r12 avatar + name 14pt bold + up to 4 sport tiles (18×18 r5, SF 8pt); performancePanel (r12 appBorder-0.25, v4/h8): header [chart icon 9pt + "PERFORMANCE" 9pt bold tracking 0.5 + netUnitsLabel 12pt heavy], `AgentSparkline` h32, footer [recordLabel 10pt + streakChip]; bottomRow — active: "AUTOPILOT ON" pill (6×6 `#10B981` dot + 8pt bold, r6 green-0.10) + next-run pill (`formatNextRun` → "9:00a ET"; TZ abbrs NY→ET, Chicago→CT, Denver→MT, LA→PT); inactive: pause.circle + "AUTOPILOT OFF" appLoss.
- **`AgentSparkline`**: Path polyline — **synthetic** equity curve: `min(max(total,5),12)` steps; early (< bestStreak) +(|avg|+0.3), late (> steps−|worstStreak|) −(|avg|+0.2), middle avg + sin(i·2.1)·0.5; rescaled so last == netUnits. Stroke 2pt `#22C55E`/`#EF4444`. 0 picks → dotted midline.

### `AgentDetailHero.swift` (~367 lines)
- Collapsing hero for both detail screens, hosted by `CollapsingWidgetScroll` (progress 0→1). Exports `AgentPixelWaveBackground`, `AgentGlassHero`, `AgentStatStrip`, `AgentStatQuadrant`, `AgentStatCell`.
- `AgentPixelWaveBackground`: wraps shared `PixelWaveBackground(accentColor: brand primary, progress, screenAnchored: true, rippleEmitter)` — page paints it twice sharing one emitter so avatar-tap ripples align.
- `AgentGlassHero` inputs: agent, performance?, lockedNetUnits, subtitleSystemImage/subtitle, progress, isGenerating (swaps avatar to seated-working pose), onAvatarTap ((CGPoint)->Void)?, bigSize 76, smallSize 44.
- **Collapse math**: `expanded = clamp(1 − p/0.5)`; `compact = clamp((p − 0.5)/0.5)`; two layouts crossfade, hit-testing at opacity > 0.5.
- **Expanded**: HStack — avatarDisc(76) + name 26pt heavy (minScale 0.6) + subtitle (icon 10pt + 11pt medium secondary); right `AgentStatQuadrant` maxWidth 210. Below: sportPills (10pt semibold, glass capsules).
- **Compact**: avatarDisc(44) + name 16pt heavy + compactStatLine — record · netUnits ("•••" locked) · win% · streak, "·"-separated, 13pt bold mono.
- **Avatar disc**: `PixelSpriteAvatar` pad size·0.18, OR isGenerating: `SitWorkSprite` (0.60/0.80) + `LaptopSprite` (0.30/0.44, offset y 0.16), easeInOut 0.35. Chrome `.teamGlassDisc(primary:secondary:tint:0.5)`, shadow primary 0.3 r7 y3. Tap tracked via `.onGeometryChange` (global center) → onAvatarTap(center).
- `AgentStatQuadrant`: 2×2 glass tiles (r12, white 0.08 border, v8/h6): Record+Net Units / Win Rate+Streak. `AgentStatCell`: label 10pt semibold tracking 0.5; value 16pt heavy mono; locked → material rect + lock.fill 10pt, r6.

### `AgentHeaderActionZone.swift` (~230 lines) — misleading name: generate-picks prompt controls
- `AgentGeneratePrompt(accent, title, subtitle, autoGenerate, onToggleAuto, canGenerate, buttonLabel, onGenerate)`: header (title 17pt heavy + subtitle 12pt) + `AutopilotChip` top-right + full-width `ShimmerGenerateButton`.
- `ShimmerGenerateButton`: capsule vPad 14, fill accent/appSurfaceMuted; `Label(text, "sparkles")` (lock.fill disabled) 15pt heavy black text; enabled adds white-0.6 label copy `.shimmering()` `.plusLighter` — glint sweeps TEXT.
- `AutopilotChip`: bolt.badge.automatic 11pt + "Auto"/"Manual" 11pt heavy; tinted glass accent 0.4/0.22 + stroke 0.6/0.25.
- `HoldToRegenButton`: hold-to-confirm, `holdDuration = 5.0s`. Capsule — arrow.clockwise/lock.fill 12pt + "Hold to Regenerate"/"Keep holding…"/"Limit reached" 12pt heavy; accent-0.85 fill grows to width·progress; glass tint accent 0.35; `onLongPressGesture(minimumDuration: 5, maximumDistance: 60)` — progress 0→1 linear 5s, early release rewinds easeOut 0.25; completion `.success` haptic + onRegen.

### `AgentLeaderboard.swift` (~375 lines)
- Public leaderboard. `@Bindable store: LeaderboardStore`; `showsFilters`; `pinnedHeader: AnyView`; `onRowTap`.
- **Store**: loadState, entries, sortMode/timeframe (didSet refetch), excludeUnder10Picks, isBottomMode, refresh(). Entitlements: canViewAgentPicks (→ lockStats), isLoading.
- **States**: skeleton 6 rows (`.shimmering()`); empty → trophy 48pt + "No public agents yet" + "Be the first to make your agent public!"; failed → ContentUnavailableView + Retry `#00E676`.
- `LeaderboardFilterBar`: two pill rows: SortMode pills, Timeframe pills + "10+ picks" toggle (button style, tint `#00E676`). Pill: 12pt bold, h12/v6, capsule `#00E676`-0.15 active / appBorder inactive. `.sensoryFeedback(.selection)`.
- `LeaderboardRow`: rankBadge (1 gold `#FFD700` trophy.fill 22pt / 2 silver `#C0C0C0` medal.fill / 3 bronze `#CD7F32` medal / else number 16pt bold, w32); avatar circle (avatarGradient + PixelSpriteAvatar) 44×44 top-3 (in `GlowingCardWrapper` halo) else 36×36; name 14pt semibold + first 2 sports 10pt + "+N"; statsSection (minW 56): record 12pt bold + netUnits 14pt heavy appWin/appLoss — lockStats → material + lock.fill 9pt; winRateBadge w48 "%.1f%%" 11pt bold `#00E676` (bottom mode `#F97316`; appLoss < 0.35); chevron. Chrome r12 appBorder-0.2 + 0.3 border. `.staggeredAppear` cascade.

### `AgentChatRoom.swift` (~204 lines)
- 1:1 user↔agent chat card on detail page. `agent`, `@Bindable store: AgentChatStore` (loadState → refresh() on .task, messages [id, role, content], isAssistantTyping, $draft, send()).
- Card r12 appSurfaceElevated + appBorder-0.4. (1) header: bubble icons 14pt `#20B2AA` + "Chat with {name}" 13pt bold + LIVE pill (6×6 `#22C55E` dot + "LIVE" 9pt heavy, green-0.1 capsule). (2) messageList: ScrollViewReader maxHeight 360; bubbles: user right (bg `#3B82F6`-0.18), agent left (bg appBorder-0.45); header line emoji 14pt + "You"/name 11pt heavy; content 13pt; r10, h10/v8. Typing → `TypingDots` (3 dots, TimelineView 0.18s, phase rotate, active 1.0 others 0.4). (3) inputBar: TextField 1...4 lines 14pt r8 + send arrow.up.circle.fill 26pt (`#00E676`), disabled when blank/typing.
- Empty: `PixelEmojiInline(emoji, 28)` + "Ask {name} about a pick" + two example quotes 11pt mono 0.7α. Auto-scroll on count change.

### `AgentResearchIdleCard.swift` (~417 lines) — building blocks for the generation card
- `WorkingDeskAvatar(spriteIndex, accent, charHeight = 120)`: accent floor-glow Ellipse (0.30, w charW·2.3 × h charH·0.42, blur 28, offset y charH·0.36); `SitWorkSprite`; `LaptopSprite` offset y charH·0.22 in front. Height charH·1.12.
- `SitWorkSprite`: frontSitWork 4-frame loop at **5fps** ("typing" cadence), nearest.
- `LaptopSprite`: static `office_laptop_front_open`.
- `ResearchShimmerText(text, font = 15pt heavy)`: kerning 0.5; base white 0.34; band max(56, w·0.5) gradient [clear, white, clear], `.plusLighter`, masked to glyphs; phase linear 1.9s repeatForever; static under Reduce Motion.
- `SwipeToGeneratePill(title, accent, isEnabled, onCommit)`: h56, thumbInset 4 (thumb 48). Disabled → locked capsule (lock.fill 13pt + 14pt heavy secondary, white 0.08 + 0.10 border). Enabled: track white 0.08 + 0.12 border; ignition fill gradient [accent, accent, `#FFE7A6` gold] width fillW, opacity 0.4 + p·0.6, brightness +p·0.12, shadow accent·(p·0.8) r16p, linear 0.08; swipe label drawn twice (white 0.82 base + black copy masked to fillW) + shimmer band (max(70, w·0.26), 1.7s); thumb white circle, chevron.right 17pt `#0B0E0D` → sparkles when confirmed. Drag: progress = clamp(dx/maxDrag); **14 notch haptics** `.soft` intensity 0.35 + p·0.65; end p > 0.9 → commit (easeOut 0.18, `.success` + `.heavy`, onCommit) else spring-back (0.3, 0.7) + `.rigid` 0.5. A11y: plain button + hint.

### `AgentOverlapFooter.swift` (~86 lines)
- "N other agents made this pick" footer. `agents: [OverlapSummary]` (avatarId, name, avatarEmoji, avatarColor), `totalCount`. maxVisible 5. HStack(6): avatarStack (spacing −8, ≤5 circles 22×22 — gradient/solid + emoji 10pt, 2pt elevated ring; overflow "+N" 8pt bold) + "N other agents made this pick" 10pt medium secondary; top 1pt hairline. Data via `get_agent_pick_overlap_batch` RPC.

### `BinAgentsSheet.swift` (~205 lines)
- Drill-down when a histogram bar is tapped on Platform Statistics — top public agents in that bin ranked by net units, expandable to show pending picks.
- **Inputs**: title, metric, sport?, lower/upper, minDecided, preloaded (DEBUG). Local loadState/agents/expanded. `.task` → `PlatformStatsService.fetchBinAgents(limit: 20)`.
- **Layout**: NavigationStack → ScrollView pad 16, inline title, Done toolbar. Detents [.medium, .large]. States: skeleton 4 rows; failed → Retry; empty → "No public agents here". Agent card: r16 elevated pad 14; header: 42×42 gradient circle emoji 20pt; name 15pt heavy + [record 12pt, winRate% 12pt bold appAccentBlue]; trailing [±units 15pt heavy mono, pick-count 10pt]; chevron up/down. Expanded: pendingPicks empty → "No open picks right now"; else `AgentTodaysPicksRail` (h-pad −16 bleed). Toggle easeInOut 0.2.

### `CollapsingAgentsHeader.swift` (~56 lines) — mostly retired
- Live piece: `AgencyStatsPill(agents:)` — totalNetUnits (sum), winRateAverage (mean of per-agent win% over agents with picks), activeCount. HStack(5): "+x.xxu" `#4ADE80`/`#F87171` · win% white · "active/total" white — 11pt heavy rounded, h11/v6, glass Capsule.

### `CompanyDashboardBanner.swift` (~101 lines)
- "YOUR AGENCY" roll-up card; hosts HR CTA. `agents`, `onOpenHR`.
- r14 elevated card pad 14. Header: "YOUR AGENCY" 10pt heavy mono tracking 1.5 over "N agents · M active" 14pt bold; HR button — person.2.badge.gearshape.fill 11pt + "HR" 11pt heavy, capsule `#00E676`-0.16, green. 3 stat cells (32pt Dividers): Net Units (mono, appWin/appLoss), Avg Win Rate "%.1f%%", Agents count.

### `DistributionHistogramChart.swift` (~123 lines)
- Swift Charts histogram + fitted normal curve. Y = SHARE of agents (never raw counts). `buckets` (mid, share, lower, upper), `curve`, `fit?` (mean, isEstimated), `domain`, `metric`, `accent = .appAccentBlue`, `height = 220`, `showReferenceLines`, `onSelectBin?`.
- Marks: BarMark(width .ratio(0.9)) accent 0.32, r3; LineMark curve `.catmullRom` 2.5pt, **dashed [5,3] + grey when isEstimated** else accent; RuleMark at mean (1pt dash [4,3] appTextMuted, top annotation); RuleMark break-even (0.5238 winRate; 0 units), appLoss 0.55. Tap overlay → `proxy.value(atX:)` → bucket → onSelectBin.

### `FittedCurveOverlayChart.swift` (~60 lines)
- Multi-sport comparison — peak-normalized bell curves. `series` (name, color, isEstimated, points), `domain`, `height = 220`. LineMark per series `.catmullRom` 2.5pt, dash [5,3] estimated; explicit color scale; RuleMark 0.5238 appLoss 0.5. Y axis hidden; legend bottom.

### `AgentPerformanceCharts.swift` (~326 lines)
- Cumulative-units line charts (overall + per sport). `items: [AgentBetItem]` (settled parlay = ONE point via ticket payout), `preferredSports`, `agentColor`, `showsTitle`.
- **Data**: settled = won/lost/push sorted createdAt; seed ChartPoint(0,0); cumulative += `netUnitsContribution` (Formula B, matches `recalculate_avatar_performance` RPC). Per-sport needs ≥2 scoped items; multi-sport parlays count Overall only.
- **Layout**: overall < 3 points → empty state (chart icon 32pt + "Performance charts will appear after picks are graded"). overallCard — "Cumulative Units" 16pt bold + units 14pt heavy mono; Chart h180: LineMark `.monotone` 2pt appWin/appLoss + AreaMark gradient [color 0.2 → clear]; X labels only "Start"/"Now"; Y "%+.1f" 10pt. sportCards — h110 LineMark only, X hidden. **glassCardBackground**: r16 `.ultraThinMaterial` + `#0F131C`-0.5 tint + white 0.08 border, pad 14. `AgentPerformanceChartSkeleton` mirrors chrome exactly.

### `AgentStatsSkeleton.swift` (~54 lines)
- Loading placeholder for AgentStatsView: 2×2 summary cards, 3 pills, hero h220, title block, two h150 cards; `.shimmering()`.

### `GlowAccentBar.swift` (~34 lines)
- 2pt gradient top strip. **FIDELITY-WAIVER #071**: RN's 5-color cycle animation dropped — static `LinearGradient([primary, secondary])` h2 + same gradient 0.5 opacity blur 3 halo.

### `GlowingCardWrapper.swift` (~54 lines)
- Static halo around top-3 leaderboard avatars (same waiver #071). `color`, `cornerRadius = 20`, content. Background ZStack pad −3: outer RoundedRect(r+4) stroked 4pt gradient 0.6 blur 6; inner (r+2) 1pt full blur 1.

### `AgentColorPalette.swift` (~85 lines)
- Helpers for `avatar_color` (`"#6366f1"` or `"gradient:#6366f1,#ec4899"`). `primary/secondary(for:)` (fallback `#6366F1`), `gradient(for:)`, `avatarGradient(for:)` → **always two-tone**: solids get `[p, p.shaded(0.55)]`. `Color.shaded(by:)` multiplies RGB; `Color(hexString:)` parses `#RRGGBB`/`RRGGBB`/`#AARRGGBB`.

### `AgentCardGlyphTexture.swift` (~77 lines)
- Animated pixel-glyph wash in AgentRowCard background. `avatarColor`, `seedString` (FNV-1a → seed, default `0x5EED_1234`), `cornerRadius = 26`. Reuses `PixelGlyphField` — intervals [0.3], spacing 22, dotSize 5, peakOpacity 0.4 dark / 0.46 light. Dark: base white, accent primary; light: base primary, accent shaded 0.72. Masked leading→trailing gradient (1.0 → 0.84@0.5 → 0.64@1.0), clipped r26.

### `SwipeableRow.swift` (~20 lines)
- Just `RowSwipeAction` data carrier (id, title, systemImage, tint, action) for native List `.swipeActions`.

### `AgentGenerationControlSheets.swift` (~615 lines)
- `RegenerateControlButton(remaining, accent, enabled, action)`: capsule chip arrow.clockwise/lock 12pt + "Regenerate" 12pt heavy + "N left" badge (11pt heavy rounded, capsule accent 0.28/0.14); glass tint 0.35/0.15 + stroke 0.55/0.25.
- `AutoPilotControlButton(isOn, accent, action)`: bolt.badge.automatic 11pt + "AutoPilot" 11pt heavy + 6×6 dot (`#00E676` on); glass tint 0.4/0.22.
- `RegenerateBottomSheet(remaining, maxDaily, accent, canRegenerate, onRequest)`: header (44×44 accent-0.18 circle + "Regenerate today's picks" 17pt heavy); quotaCard — "RUNS LEFT TODAY" + "r/max" 15pt black rounded + pip row (8pt capsules, filled accent remaining, white 0.10 spent); r16 accent 0.07 + 0.18 border; logicCard — "HOW IT WORKS" 4 icon bullets; safeAreaInset: `SwipeToGeneratePill("Swipe to request picks"/"Daily limit reached")` over material. Bg `#0B1011`, inline "Regenerate", Done, detents [.medium, .large], dark.
- `AutoPilotBottomSheet(agentName, accent, canUseAutopilot, remaining, maxDaily, recentRuns, initialAutoOn/Time/Timezone, onSetAuto: (Bool) async -> Bool, onSaveTime: (String,String) async -> Bool)`: toggleCard — Toggle "Auto-generate picks" 15pt bold, dynamic subtitle, tint accent; non-entitled "Upgrade to Pro to enable autopilot." `#F59E0B`; scheduleCard (when on) — "Preferred time" + "h:mm AM/PM {TZ}" 14pt mono accent → `TimePickerModal`; runsSection — "RECENT RUNS" + "r/max left today"; runRow: 38×38 r10 tile doc.text.image/moon.zzz; "MMM d (· Today)" 14pt bold + subtitle 11pt mono; "N pick(s)" capsule accent-0.2 or "Passed" white-0.08. Flow: optimistic flip, await, revert + alert on failure. Detents [.large], bg `#0B1011`.
- `AgentRunSummaryRow`: id/date/pickCount/wins/losses/pushes/pending/note/isToday. `subtitle`: 0 picks → note ?? "No picks"; all pending → "Awaiting results"; else "W-L(-P) · N pending". `derive(picks:todaysRun:todayStr:limit:14)` groups picks by gameDate; synthetic 0-pick "today" row when today produced nothing (note = "No games in preferred sports" / "Slate too weak — passed" / slateNote / "Passed on the slate"); newest-first, cap 14.

### `AgentHRBottomSheet.swift` (~333 lines)
- "HR DEPARTMENT" performance-review sheet from CompanyDashboardBanner. **Pure visualization — NO mutations** ("fire to save $$$" copy is flavor). `agents`, `onDismiss`. `unitSize = 100`.
- **Derivation**: agents with totalPicks > 0. **Grade** by netUnits: ≥10 S (`#FFD700`), ≥5 A (`#00E676`), ≥1 B (`#69F0AE`), ≥0 C (`#FFC107`), ≥−3 D (`#FF9800`), else F (`#FF5252`); dollarImpact = netUnits·100; totalBankroll = 1000 + Σunits·100; recommendation strings per grade (S "…MVP. Protect at all costs.", F "costing you money. Fire to save $N.").
- **Layout** (terminal/mono): headerBlock ">_" 16pt heavy mono `#00E676` + "HR DEPARTMENT" 18pt black mono tracking 2 + "AGENT PERFORMANCE REVIEW" 10pt heavy tracking 1.5. WINNERS summaryCard (green) title + Σdollars ("+$1.2k" k-suffix) + count line; LOSERS card (red `#FF5252`) with "Firing them saves $X…" copy. reportRow: r12 elevated pad 12 — 32×32 grade badge (r8, grade-0.18 + 0.4 border, letter 16pt black mono); emoji 20pt; name 14pt bold + "record | win%" 11pt mono; dollarImpact 14pt black mono over "IMPACT" 7pt heavy; recommendation 12pt mono; if costing money: red terminal callout "Without {name}, bankroll would be $X (+$Y saved)".

---

## Cross-cutting notes
- Recurring system: `liquidGlassBackground` (Liquid Glass w/ `.ultraThinMaterial` fallback), continuous squircles, semantic colors + brand green `#00E676`, `.shimmering()` / Skeleton* / `.staggeredAppear(index:)` primitives (in WagerproofDesign).
- Three synthetic-data placeholders to preserve: `AgentFormChart` buckets, `AgentRowCard.recentWinPct`, `AgentSparkline` points — all deterministic FNV-1a-seeded PRNGs off avatar id.
- Waiver #071 drops RN glow cycles in GlowAccentBar/GlowingCardWrapper.
- Misleading filenames: `AgentHeaderActionZone.swift` (generate-prompt controls), `SwipeableRow.swift` (data struct), `AgentResearchIdleCard.swift` (building blocks).
