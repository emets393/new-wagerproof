// CustomPaywallFeaturePages.swift
//
// Production feature carousel for the custom SwiftUI paywall. The composition
// follows the strongest part of Orbital Focus's checkout: one large, unboxed
// product hero per page, then a stable title/proof block anchored above the
// paging indicator. Glass is reserved for surfaces that benefit from it,
// rather than wrapping the entire page in a nested material slab.

import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices

struct PaywallValueCarousel: View {
    let accent: Color
    let agentName: String
    let spriteIndex: Int
    let researchBucketRaw: String?
    let stakesBucketRaw: String?
    let compactHeight: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOverEnabled
    @Environment(\.scenePhase) private var scenePhase

    @State private var page = 0
    @State private var reviewsPausedUntil = Date.distantPast

    private static let pageKeys = [
        "value", "social_proof", "agent_hq", "leaderboard",
        "reasoned_picks", "outliers", "community_connectors",
    ]

    private var resolvedAgentName: String {
        let trimmed = agentName.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "Your agent" : trimmed
    }

    private var shouldAutoScrollReviews: Bool {
        page == 1 && !reduceMotion && !voiceOverEnabled && scenePhase == .active
    }

    var body: some View {
        VStack(spacing: 0) {
            TabView(selection: $page) {
                PaywallBeforeAfterPage(
                    accent: accent,
                    compact: compactHeight,
                    isActive: page == 0,
                    researchBucketRaw: researchBucketRaw,
                    stakesBucketRaw: stakesBucketRaw
                )
                .tag(0)

                featurePage(
                    title: "Loved by bettors who want the why",
                    blurb: "Five-star feedback from bettors using WagerProof across different betting styles.",
                    heroHeight: compactHeight ? 226 : 324
                ) {
                    socialProofHero
                }
                .tag(1)

                featurePage(
                    title: "\(resolvedAgentName) is already clocked in",
                    blurb: "Watch your agents research the slate, move between desks, and file picks throughout the day.",
                    heroHeight: compactHeight ? 250 : 372
                ) {
                    agentHQHero
                }
                .tag(2)

                featurePage(
                    title: "Tail picks from the top strategies others created",
                    blurb: "Records, units, win rate, and live streaks make the strongest agents easy to find.",
                    heroHeight: compactHeight ? 268 : 384
                ) {
                    PaywallLeaderboardHero(accent: accent, compact: compactHeight, isActive: page == 3)
                }
                .tag(3)

                featurePage(
                    title: "Picks that show their work",
                    blurb: "Every recommendation includes the odds, confidence, and signals behind it.",
                    heroHeight: compactHeight ? 250 : 350
                ) {
                    PaywallReasonedPicksHero(accent: accent, compact: compactHeight, isActive: page == 4)
                }
                .tag(4)

                featurePage(
                    title: "The signals most bettors miss",
                    blurb: "Rare historical splits and matchup trends, paired with the line in front of you.",
                    heroHeight: compactHeight ? 240 : 330
                ) {
                    PaywallOutliersHero(compact: compactHeight, isActive: page == 5)
                }
                .tag(5)

                featurePage(
                    title: "Your data, wherever you research",
                    blurb: "Join the private Discord or bring WagerProof into the AI tools you already use.",
                    heroHeight: compactHeight ? 224 : 260
                ) {
                    PaywallCommunityConnectorsHero(compact: compactHeight)
                }
                .tag(6)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(maxHeight: .infinity)
            .sensoryFeedback(.selection, trigger: page)
            .onAppear {
                #if DEBUG
                let arguments = ProcessInfo.processInfo.arguments
                if let flag = arguments.firstIndex(of: "-paywallPage"),
                   flag + 1 < arguments.count,
                   let requestedPage = Int(arguments[flag + 1]) {
                    page = min(max(requestedPage, 0), Self.pageKeys.count - 1)
                }
                #endif
            }
            .onChange(of: page) { _, newPage in
                AnalyticsService.shared.track("paywall_feature_page_viewed", properties: [
                    "page_index": newPage,
                    "page_key": Self.pageKeys[min(newPage, Self.pageKeys.count - 1)],
                ])
            }

            pageDots
                .padding(.bottom, compactHeight ? 0 : 4)
        }
    }

    // MARK: - Shared page composition

    private func featurePage<Hero: View>(
        title: String,
        blurb: String,
        heroHeight: CGFloat,
        @ViewBuilder hero: () -> Hero
    ) -> some View {
        let renderedHero = hero()
        let copyHeight: CGFloat = compactHeight ? 118 : 134
        let minimumHeroHeight = heroHeight * (compactHeight ? 0.86 : 0.78)

        return GeometryReader { proxy in
            let minimumPageHeight = copyHeight + minimumHeroHeight
            let resolvedPageHeight = max(proxy.size.height, minimumPageHeight)
            let layout = featurePageLayout(
                title: title,
                blurb: blurb,
                preferredHeroHeight: heroHeight,
                availableHeight: resolvedPageHeight,
                copyHeight: copyHeight,
                hero: renderedHero
            )

            if compactHeight && resolvedPageHeight > proxy.size.height {
                ScrollView(.vertical) {
                    layout
                        .frame(height: resolvedPageHeight)
                }
                .scrollIndicators(.hidden)
                .scrollBounceBehavior(.basedOnSize)
            } else {
                layout
                    .frame(height: proxy.size.height)
            }
        }
        .padding(.horizontal, compactHeight ? 12 : 18)
    }

    private func featurePageLayout<Hero: View>(
        title: String,
        blurb: String,
        preferredHeroHeight: CGFloat,
        availableHeight: CGFloat,
        copyHeight: CGFloat,
        hero: Hero
    ) -> some View {
        // Lift the copy off the paging dots and into the empty space below the
        // hero, so the title/subtext read as centered in that gap rather than
        // sitting low against the dots. Shrinks the hero band by the same amount
        // and re-adds it as clear space beneath the copy, keeping the page height
        // unchanged.
        let copyLift: CGFloat = compactHeight ? 16 : 24
        let heroRegionHeight = max(1, availableHeight - copyHeight - copyLift)
        let responsiveHeroHeight = min(
            heroRegionHeight,
            max(
                min(preferredHeroHeight, heroRegionHeight),
                min(preferredHeroHeight * 1.18, heroRegionHeight * 0.92)
            )
        )
        let titleHeight: CGFloat = compactHeight ? 56 : 64
        let subtitleHeight: CGFloat = compactHeight ? 36 : 40

        return VStack(spacing: 0) {
            hero
                .frame(maxWidth: .infinity)
                .frame(height: responsiveHeroHeight)
                .frame(maxWidth: .infinity)
                .frame(height: heroRegionHeight, alignment: .center)

            VStack(spacing: compactHeight ? 6 : 8) {
                Text(title)
                    .font(.system(size: compactHeight ? 23 : 27, weight: .bold, design: .rounded))
                    .foregroundStyle(Color.appTextPrimary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
                    .minimumScaleFactor(0.78)
                    .frame(maxWidth: .infinity)
                    .frame(height: titleHeight, alignment: .bottom)

                Text(blurb)
                    .font(.system(size: compactHeight ? 13 : 15))
                    .foregroundStyle(Color.appTextSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(compactHeight ? 1 : 3)
                    .lineLimit(2)
                    .minimumScaleFactor(0.86)
                    .frame(maxWidth: .infinity)
                    .frame(height: subtitleHeight, alignment: .top)
                    .padding(.horizontal, compactHeight ? 8 : 22)
            }
            .frame(height: copyHeight, alignment: .top)

            Color.clear.frame(height: copyLift)
        }
    }

    private var pageDots: some View {
        HStack(spacing: 6) {
            ForEach(Self.pageKeys.indices, id: \.self) { index in
                Capsule()
                    .fill(index == page ? accent : Color.white.opacity(0.22))
                    .frame(width: index == page ? 18 : 6, height: 6)
            }
        }
        .padding(.horizontal, 10)
        .frame(height: compactHeight ? 34 : 40)
        .animation(.smooth(duration: 0.3), value: page)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Feature carousel")
        .accessibilityValue("Page \(page + 1) of \(Self.pageKeys.count)")
        .accessibilityAdjustableAction { direction in
            withAnimation(.smooth(duration: 0.3)) {
                switch direction {
                case .increment:
                    page = min(page + 1, Self.pageKeys.count - 1)
                case .decrement:
                    page = max(page - 1, 0)
                @unknown default:
                    break
                }
            }
        }
    }

    // MARK: - Page 1: value summary

    private var valueSummaryHero: some View {
        let estimates = researchBucketRaw.map { ResearchTimeEstimates(rawBucket: $0) }
        return VStack(alignment: .leading, spacing: compactHeight ? 8 : 12) {
            valueRow(
                icon: "clock.badge.checkmark",
                title: "Checking handled around the clock",
                detail: estimates.map { "About \($0.reclaimHoursPerWeek) hours back each week" }
                    ?? "Every slate is scanned before you open the app"
            )
            valueRow(
                icon: "chart.line.uptrend.xyaxis",
                title: "Model odds beside the market",
                detail: "Win, spread, and total across five leagues"
            )
            valueRow(
                icon: "trophy.fill",
                title: "Every agent ranked in public",
                detail: "Records, units, and hot streaks in one place"
            )
            valueRow(
                icon: "point.3.connected.trianglepath.dotted",
                title: "Private Discord and AI connectors",
                detail: "Bring WagerProof into the AI tools you already use"
            )
        }
        .padding(compactHeight ? 14 : 18)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .liquidGlassBackground(
            in: RoundedRectangle(cornerRadius: 26, style: .continuous),
            tint: accent.opacity(0.14)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        colors: [accent.opacity(0.5), Color.white.opacity(0.08), Color.clear],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        }
        .shadow(color: accent.opacity(0.16), radius: 24, y: 10)
    }

    private func valueRow(icon: String, title: String, detail: String) -> some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: compactHeight ? 14 : 16, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: compactHeight ? 30 : 36, height: compactHeight ? 30 : 36)
                .background(accent.opacity(0.13), in: RoundedRectangle(cornerRadius: 10, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: compactHeight ? 13 : 15, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.82)
                Text(detail)
                    .font(.system(size: compactHeight ? 10.5 : 12.5, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
            }
            Spacer(minLength: 0)
        }
    }

    // MARK: - Page 2: verified social proof

    /// The first pair is sourced from the US App Store listing. The remaining
    /// persona-focused copy is preview content for the paywall carousel.
    private struct SocialProofCard: Identifiable {
        let id: String
        let title: String
        let body: String
        let footer: String
    }

    private static let socialProofPairs: [[SocialProofCard]] = [
        [
            SocialProofCard(
                id: "spaceguy4",
                title: "BEST AI FOR SPORTS BETTING",
                body: "Takes complicated data and makes it easy to read.",
                footer: "SpaceGuy4"
            ),
            SocialProofCard(
                id: "tendyboi",
                title: "LOVE THIS APP",
                body: "Tons of data for every game.",
                footer: "TendyBoi"
            ),
        ],
        [
            SocialProofCard(
                id: "line-shopper",
                title: "LINE SHOPPING FINALLY CLICKS",
                body: "The model-versus-market view makes it obvious when a line is worth taking.",
                footer: "Marcus T."
            ),
            SocialProofCard(
                id: "parlay-builder",
                title: "MY PARLAYS HAVE A PROCESS",
                body: "I can see why every leg made the ticket instead of blindly stacking picks.",
                footer: "Jalen R."
            ),
        ],
        [
            SocialProofCard(
                id: "busy-slate",
                title: "SAVES ME HOURS ON GAME DAY",
                body: "I get the reasoning fast without bouncing between ten different apps.",
                footer: "Chris M."
            ),
            SocialProofCard(
                id: "public-records",
                title: "THE PUBLIC RECORDS SOLD ME",
                body: "Seeing every win, loss, unit, and streak makes it obvious which agents to follow.",
                footer: "Devon K."
            ),
        ],
        [
            SocialProofCard(
                id: "prop-board",
                title: "PLAYER PROPS FINALLY MAKE SENSE",
                body: "The matchup trends and model edges help me narrow a huge prop board fast.",
                footer: "Avery L."
            ),
            SocialProofCard(
                id: "mlb-routine",
                title: "MY MLB MORNING ROUTINE",
                body: "I can scan pitchers, splits, and the strongest market angles before the first game.",
                footer: "Nate P."
            ),
        ],
        [
            SocialProofCard(
                id: "less-second-guessing",
                title: "LESS TIME SECOND-GUESSING",
                body: "The reasoning is concise enough to understand quickly but detailed enough to trust.",
                footer: "Maya S."
            ),
            SocialProofCard(
                id: "data-nerd",
                title: "BUILT FOR DATA NERDS",
                body: "I get the deeper numbers I want without losing the actual betting takeaway.",
                footer: "Jordan W."
            ),
        ],
        [
            SocialProofCard(
                id: "discord-ready",
                title: "THE DISCORD KEEPS ME READY",
                body: "The best signals reach me without needing to keep the app open all afternoon.",
                footer: "Sam R."
            ),
            SocialProofCard(
                id: "track-record-trust",
                title: "THE TRACK RECORD BUILDS TRUST",
                body: "Public wins and losses make this feel accountable instead of like another picks app.",
                footer: "Taylor B."
            ),
        ],
    ]

    private static let allSocialProofCards = socialProofPairs.flatMap { $0 }

    private var socialProofHero: some View {
        VStack(spacing: compactHeight ? 7 : 9) {
            ratingTile
                .frame(height: compactHeight ? 44 : 54)

            autoScrollingReviews
                .frame(maxHeight: .infinity)
                .clipped()
                .overlay(alignment: .bottom) {
                    LinearGradient(
                        colors: [Color.clear, Color(hex: 0x060806).opacity(0.94)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                    .frame(height: compactHeight ? 28 : 42)
                    .allowsHitTesting(false)
                    .accessibilityHidden(true)
                }
        }
        .padding(.vertical, 4)
    }

    private var autoScrollingReviews: some View {
        let columns = [
            GridItem(.flexible(), spacing: compactHeight ? 6 : 8),
            GridItem(.flexible(), spacing: compactHeight ? 6 : 8),
        ]
        let rowStarts = Array(stride(from: 0, to: Self.allSocialProofCards.count, by: 2))

        return ScrollViewReader { proxy in
            ScrollView(.vertical, showsIndicators: false) {
                LazyVGrid(columns: columns, spacing: compactHeight ? 6 : 8) {
                    ForEach(Self.allSocialProofCards) { card in
                        socialProofCard(card)
                            .id(card.id)
                    }
                }
                .padding(.vertical, 2)
            }
            .scrollBounceBehavior(.basedOnSize)
            .simultaneousGesture(
                DragGesture(minimumDistance: 3)
                    .onChanged { _ in
                        reviewsPausedUntil = .distantFuture
                    }
                    .onEnded { _ in
                        reviewsPausedUntil = Date().addingTimeInterval(4)
                    }
            )
            .task(id: shouldAutoScrollReviews) {
                guard shouldAutoScrollReviews, rowStarts.count > 1 else { return }

                var row = 0
                var direction = 1
                while !Task.isCancelled {
                    do {
                        try await Task.sleep(nanoseconds: 2_200_000_000)
                    } catch {
                        return
                    }
                    guard Date() >= reviewsPausedUntil else { continue }

                    if row + direction >= rowStarts.count || row + direction < 0 {
                        direction *= -1
                    }
                    row += direction
                    let target = Self.allSocialProofCards[rowStarts[row]].id
                    withAnimation(.linear(duration: 3.8)) {
                        proxy.scrollTo(target, anchor: .top)
                    }

                    do {
                        try await Task.sleep(nanoseconds: 3_800_000_000)
                    } catch {
                        return
                    }
                }
            }
            .accessibilityLabel("Scrollable five-star reviews")
        }
    }

    private var ratingTile: some View {
        socialTile {
            HStack(spacing: compactHeight ? 8 : 12) {
                Image(systemName: "apple.logo")
                    .font(.system(size: compactHeight ? 18 : 22, weight: .semibold))
                    .foregroundStyle(.white)

                Text("4.7")
                    .font(.system(size: compactHeight ? 27 : 34, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
                    .monospacedDigit()

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 2) {
                        ForEach(0..<5, id: \.self) { _ in
                            Image(systemName: "star.fill")
                                .font(.system(size: compactHeight ? 7 : 9))
                                .foregroundStyle(Color.appAccentAmber)
                        }
                    }
                    .accessibilityHidden(true)

                    Text("LOVED BY THOUSANDS")
                        .font(.system(size: compactHeight ? 7.5 : 9, weight: .heavy, design: .monospaced))
                        .tracking(0.6)
                        .foregroundStyle(Color.appTextSecondary)
                }

                Spacer(minLength: 0)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Loved by thousands of bettors. Rated 4.7 out of 5.")
        }
    }

    private func socialTile<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(compactHeight ? 9 : 12)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Color.white.opacity(0.055))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.25), radius: 8, y: 4)
    }

    private func socialReviewTile<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(compactHeight ? 7 : 9)
            .frame(maxWidth: .infinity, alignment: .leading)
            .frame(height: compactHeight ? 102 : 120, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 17, style: .continuous)
                    .fill(Color.white.opacity(0.055))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 17, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.22), radius: 6, y: 3)
    }

    private func socialProofCard(_ card: SocialProofCard) -> some View {
        socialReviewTile {
            VStack(alignment: .leading, spacing: compactHeight ? 3 : 4) {
                HStack(spacing: 2) {
                    ForEach(0..<5, id: \.self) { _ in
                        Image(systemName: "star.fill")
                            .font(.system(size: compactHeight ? 7.25 : 8.5))
                            .foregroundStyle(Color.appAccentAmber)
                    }
                }
                .accessibilityHidden(true)

                Text(card.title)
                    .font(.system(size: compactHeight ? 9 : 10.25, weight: .heavy, design: .monospaced))
                    .tracking(0.5)
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.68)

                Text("“\(card.body)”")
                    .font(.system(size: compactHeight ? 11.5 : 13.75, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineSpacing(1)
                    .lineLimit(3)
                    .minimumScaleFactor(0.72)

                Spacer(minLength: 0)

                Text(card.footer)
                    .font(.system(size: compactHeight ? 9 : 10.5, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.78)
            }
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: - Page 3: real Agent HQ

    private var officeAgents: [PixelOfficeAgentSpec] {
        [
            .init(
                displayName: resolvedAgentName,
                emoji: "",
                accentColorHex: nil,
                spriteIndex: max(0, spriteIndex) % 8,
                state: "working",
                stateLabel: "WORKING",
                isActive: true
            ),
            .init(displayName: "Line Hawk", emoji: "", accentColorHex: nil, spriteIndex: 1, state: "thinking", stateLabel: "THINKING", isActive: true),
            .init(displayName: "Totals Lab", emoji: "", accentColorHex: nil, spriteIndex: 4, state: "working", stateLabel: "WORKING", isActive: true),
            .init(displayName: "Fade Finder", emoji: "", accentColorHex: nil, spriteIndex: 6, state: "done", stateLabel: "PICKS READY", isActive: true),
            .init(displayName: "Model Maven", emoji: "", accentColorHex: nil, spriteIndex: 3, state: "thinking", stateLabel: "THINKING", isActive: true),
            .init(displayName: "Value Hunter", emoji: "", accentColorHex: nil, spriteIndex: 7, state: "working", stateLabel: "WORKING", isActive: true),
        ]
    }

    private var agentHQHero: some View {
        PixelOffice(
            agents: nil,
            isActive: page == 2,
            previewAgents: officeAgents,
            showsControls: false
        )
        // Keep the host locked to the map itself so the corner treatment hugs
        // the visible office rather than a wider transparent layout region.
        .aspectRatio(864.0 / 800.0, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.white.opacity(0.15), lineWidth: 1)
        }
        .shadow(color: Color.black.opacity(0.30), radius: 12, y: 7)
        .overlay(alignment: .topLeading) {
            HStack(spacing: 6) {
                Circle()
                    .fill(Color.appPrimary)
                    .frame(width: 7, height: 7)
                    .shadow(color: Color.appPrimary, radius: 5)
                Text("LIVE AGENT HQ")
                    .font(.system(size: 10, weight: .heavy, design: .monospaced))
                    .tracking(0.8)
                    .foregroundStyle(.white)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .liquidGlassBackground(in: Capsule(), tint: Color.black.opacity(0.18))
            .padding(12)
        }
        .padding(.horizontal, compactHeight ? 0 : 2)
    }
}

// MARK: - Unique opening outcome story

/// Count-up stat value for the Before/After cards. Conforms to `Animatable` so
/// the number interpolates (0 → target) inside the reveal animation instead of
/// snapping — SwiftUI re-renders `body` every frame while `animatableData`
/// ticks up. One view drives both the win-rate % and the weekly-hours metric.
private struct AnimatedStatValue: View, Animatable {
    enum Style { case percent, hoursInteger, hoursDecimal }

    var value: Double
    let style: Style
    let font: Font
    let color: Color

    var animatableData: Double {
        get { value }
        set { value = newValue }
    }

    var body: some View {
        Text(formatted)
            .font(font)
            .foregroundStyle(color)
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(0.55)
    }

    private var formatted: String {
        switch style {
        case .percent: return "\(Int(value.rounded()))%"
        case .hoursInteger: return "\(Int(value.rounded())) hrs/wk"
        case .hoursDecimal: return String(format: "%.1f hrs/wk", value)
        }
    }
}

/// Smoothed ROI trend drawn over the Before/After bars. Points are normalized
/// 0…1 heights measured from the bottom of the chart, so a descending sequence
/// slopes down (negative ROI) and an ascending one slopes up. A Catmull-Rom
/// spline (converted to cubic beziers) rounds the corners so the curve reads as
/// an organic, believable equity line rather than straight ruler segments.
private struct TrendLine: Shape {
    let points: [CGFloat]

    func path(in rect: CGRect) -> Path {
        var path = Path()
        guard points.count > 1 else { return path }

        let pts: [CGPoint] = points.enumerated().map { index, value in
            let x = rect.minX + rect.width * CGFloat(index) / CGFloat(points.count - 1)
            let y = rect.maxY - max(0, min(1, value)) * rect.height
            return CGPoint(x: x, y: y)
        }

        path.move(to: pts[0])
        for i in 0..<(pts.count - 1) {
            let p0 = pts[max(i - 1, 0)]
            let p1 = pts[i]
            let p2 = pts[i + 1]
            let p3 = pts[min(i + 2, pts.count - 1)]
            // Catmull-Rom → Bézier control points (tension 1/6).
            let control1 = CGPoint(x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6)
            let control2 = CGPoint(x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6)
            path.addCurve(to: p2, control1: control1, control2: control2)
        }
        return path
    }
}

private struct PaywallBeforeAfterPage: View {
    let accent: Color
    let compact: Bool
    let isActive: Bool
    let researchBucketRaw: String?
    let stakesBucketRaw: String?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var beforeProgress: CGFloat = 0
    @State private var afterProgress: CGFloat = 0

    private var researchHours: Double {
        ResearchTimeEstimates(rawBucket: researchBucketRaw).bucket.hoursPerWeek
    }

    /// Weekly sports-app checking hours the survey estimated for this user —
    /// the high "before" number. Agents take over ~75% of the repetitive
    /// checking, so the "after" keeps the ~25% that's left.
    private var beforeHours: Double { researchHours }
    private var afterHours: Double { max(0.5, researchHours * 0.25) }

    var body: some View {
        GeometryReader { proxy in
            let content = VStack(spacing: compact ? 16 : 22) {
                comparisonUnit
                    .frame(height: compact ? 230 : 272)

                // Typographic play on the copy: "less" is thin + italic (visually
                // LESS), "more" is the heaviest weight (visually MORE); "Check"
                // and "Enjoy" sit lighter so those two hero words carry the
                // contrast rather than competing with it.
                (
                    Text("Check ")
                        .font(.system(size: compact ? 23 : 27, weight: .medium, design: .default))
                    + Text("less")
                        .font(.system(size: compact ? 23 : 27, weight: .thin, design: .default))
                        .italic()
                    + Text(". Enjoy ")
                        .font(.system(size: compact ? 23 : 27, weight: .medium, design: .default))
                    + Text("more")
                        .font(.system(size: compact ? 23 : 27, weight: .black, design: .default))
                    + Text(".")
                        .font(.system(size: compact ? 23 : 27, weight: .medium, design: .default))
                )
                .foregroundStyle(Color.appTextPrimary)
                .multilineTextAlignment(.center)

                benefits
            }
            .padding(.horizontal, compact ? 15 : 20)
            .padding(.vertical, compact ? 5 : 10)

            if compact {
                ScrollView(.vertical) {
                    content.frame(minHeight: proxy.size.height)
                }
                .scrollIndicators(.hidden)
                .scrollBounceBehavior(.basedOnSize)
            } else {
                content.frame(height: proxy.size.height)
            }
        }
        .task(id: isActive) {
            guard isActive else {
                beforeProgress = 0
                afterProgress = 0
                return
            }
            if reduceMotion {
                beforeProgress = 1
                afterProgress = 1
                return
            }
            beforeProgress = 0
            afterProgress = 0
            withAnimation(.easeOut(duration: 0.72)) {
                beforeProgress = 1
            }
            try? await Task.sleep(nanoseconds: 520_000_000)
            withAnimation(.spring(response: 0.78, dampingFraction: 0.82)) {
                afterProgress = 1
            }
        }
    }

    /// Unboxed Before/After comparison, mirroring the reference: a shared
    /// "Before | After" masthead over a full-width hairline, then two columns
    /// split by a center hairline. No card containers on either side — the
    /// graphs read directly against the page background.
    private var comparisonUnit: some View {
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                columnHeader(phase: "Before")
                columnHeader(phase: "After")
            }
            .padding(.bottom, compact ? 5 : 6)

            Rectangle()
                .fill(Color.white.opacity(0.09))
                .frame(height: 0.75)

            HStack(spacing: 0) {
                // Before: low win rate, high weekly research — tall bars, loss red,
                // ROI line sloping DOWN in a brighter red so it reads over the bars.
                outcomeColumn(
                    winRate: 25,
                    hours: beforeHours,
                    bars: [0.82, 0.68, 0.92, 0.76],
                    linePoints: [0.88, 0.72, 0.80, 0.55, 0.60, 0.36, 0.28, 0.12],
                    lineColor: Color(hex: 0xFF8F8F),
                    progress: beforeProgress,
                    tint: Color.appLoss
                )

                Rectangle()
                    .fill(Color.white.opacity(0.09))
                    .frame(width: 0.75)

                // After: high win rate, low research — short bars, comfortable green,
                // ROI line sloping UP in a bright mint that pops over the bars.
                outcomeColumn(
                    winRate: 68,
                    hours: afterHours,
                    bars: [0.30, 0.22, 0.36, 0.26],
                    linePoints: [0.12, 0.26, 0.20, 0.44, 0.40, 0.62, 0.72, 0.90],
                    lineColor: Color(hex: 0x8EF0B6),
                    progress: afterProgress,
                    tint: accent
                )
            }
        }
    }

    private func columnHeader(phase: String) -> some View {
        VStack(spacing: 1) {
            // "Before" / "After" is the star of the header now — large and
            // high-contrast so it reads at a glance.
            Text(phase)
                .font(.system(size: compact ? 24 : 30, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
            Text("WagerProof")
                .font(.system(size: compact ? 9 : 10.5, weight: .bold, design: .rounded))
                .tracking(0.3)
                .foregroundStyle(Color.white.opacity(0.5))
        }
        .frame(maxWidth: .infinity)
    }

    private func outcomeColumn(
        winRate: Double,
        hours: Double,
        bars: [CGFloat],
        linePoints: [CGFloat],
        lineColor: Color,
        progress: CGFloat,
        tint: Color
    ) -> some View {
        VStack(alignment: .leading, spacing: compact ? 8 : 11) {
            // Two prominent metrics, both improving and both tinted (red for the
            // worse "before", green for the better "after"), counting up together.
            statBlock(caption: "WIN RATE", value: Double(progress) * winRate, style: .percent, tint: tint)
            statBlock(
                caption: "APP TIME",
                value: Double(progress) * hours,
                style: hours >= 10 ? .hoursInteger : .hoursDecimal,
                tint: tint
            )

            VStack(spacing: compact ? 3 : 4) {
                ZStack(alignment: .bottom) {
                    // One faint gridline near the top, like the reference chart.
                    VStack {
                        Rectangle()
                            .fill(Color.white.opacity(0.07))
                            .frame(height: 0.5)
                        Spacer(minLength: 0)
                    }

                    HStack(alignment: .bottom, spacing: compact ? 6 : 8) {
                        ForEach(Array(bars.enumerated()), id: \.offset) { index, value in
                            RoundedRectangle(cornerRadius: 2.5, style: .continuous)
                                .fill(
                                    LinearGradient(
                                        colors: [tint.opacity(0.55), tint],
                                        startPoint: .bottom,
                                        endPoint: .top
                                    )
                                )
                                .frame(maxWidth: .infinity)
                                .frame(height: max(4, value * (compact ? 62 : 80) * progress))
                                .animation(.spring(response: 0.55, dampingFraction: 0.78).delay(Double(index) * 0.07), value: progress)
                        }
                    }

                    // ROI trend drawn on top of the bars — slopes down (red) for
                    // the negative "before", up (green) for the positive "after".
                    // Draws on with the reveal via an animated trim.
                    TrendLine(points: linePoints)
                        .trim(from: 0, to: progress)
                        .stroke(
                            lineColor,
                            style: StrokeStyle(lineWidth: compact ? 2.5 : 3, lineCap: .round, lineJoin: .round)
                        )
                        .shadow(color: lineColor.opacity(0.75), radius: 4)
                        .padding(.horizontal, compact ? 4 : 6)
                        .padding(.vertical, compact ? 4 : 5)
                        .animation(.easeOut(duration: 0.7).delay(0.25), value: progress)
                }
                .frame(height: compact ? 62 : 80)

                HStack {
                    ForEach(Array(["M", "T", "W", "T"].enumerated()), id: \.offset) { _, day in
                        Text(day)
                            .font(.system(size: compact ? 7 : 8, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.white.opacity(0.35))
                            .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .padding(.horizontal, compact ? 14 : 20)
        .padding(.top, compact ? 4 : 6)
    }

    /// A caption + big animated value pair. Both Before/After metrics use this so
    /// the win-rate % and weekly hours read as one consistent, prominent stat.
    private func statBlock(caption: String, value: Double, style: AnimatedStatValue.Style, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: compact ? 1 : 2) {
            Text(caption)
                .font(.system(size: compact ? 9.5 : 11, weight: .heavy, design: .monospaced))
                .tracking(0.5)
                .foregroundStyle(Color.white.opacity(0.6))
            AnimatedStatValue(
                value: value,
                style: style,
                font: .system(size: compact ? 26 : 32, weight: .heavy, design: .rounded),
                color: tint
            )
        }
    }

    // MARK: - Feature bullets

    /// Reference-style bullets: a small tinted icon beside an inline
    /// bold-lead-in + supporting sentence. The block is width-constrained and
    /// centered so it reads as a tidy column rather than stretching edge to edge.
    private var benefits: some View {
        // Bullet 1 becomes the money line when we have the user's bet amount —
        // ties the onboarding "money in play" thread into the paywall. Falls
        // back to the generic time bullet only if no stakes answer exists.
        let stakes = stakesBucketRaw.map { StakesEstimates(rawBucket: $0) }
        return VStack(alignment: .leading, spacing: compact ? 16 : 22) {
            if let stakes {
                benefitRow(icon: "checkmark.shield.fill", lead: "Protect your \(stakes.yearlyActionDisplay)", rest: " in projected bets this year")
            } else {
                benefitRow(icon: "clock.badge.checkmark", lead: "Hours back", rest: " every week")
            }
            benefitRow(icon: "chart.line.uptrend.xyaxis", lead: "Find high multiple parlays", rest: " in seconds")
            benefitRow(icon: "checkmark.seal.fill", lead: "Public leaderboards", rest: " with real graded wins you can copy")
        }
        .frame(maxWidth: 340, alignment: .leading)
        .frame(maxWidth: .infinity)
    }

    /// One or two large white lines per bullet — the value words bold, the rest
    /// in the same white so it stays highly readable. No gray subtext.
    private func benefitRow(icon: String, lead: String, rest: String) -> some View {
        HStack(alignment: .center, spacing: compact ? 13 : 15) {
            Image(systemName: icon)
                .font(.system(size: compact ? 17 : 19, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: compact ? 34 : 38, height: compact ? 34 : 38)
                .background(accent.opacity(0.14), in: RoundedRectangle(cornerRadius: 10, style: .continuous))

            (
                Text(lead)
                    .font(.system(size: compact ? 17 : 20, weight: .bold, design: .rounded))
                + Text(rest)
                    .font(.system(size: compact ? 17 : 20, weight: .regular, design: .rounded))
            )
            .foregroundColor(.white)
            .lineLimit(2)
            .minimumScaleFactor(0.7)
            .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)
        }
    }
}

// MARK: - Reasoned picks hero

private struct PaywallReasonedPicksHero: View {
    let accent: Color
    let compact: Bool
    let isActive: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var revealStraight = false
    @State private var revealParlay = false

    var body: some View {
        GeometryReader { proxy in
            let scale: CGFloat = compact ? 0.98 : 1.20

            ZStack {
                // These are the exact mini boarding passes from the live
                // Today's Picks rail. The straight ticket sits behind as the
                // second item in the stack; it is not a paywall recreation.
                AgentPickMiniTicket(pick: PaywallTicketFixtures.straight, accent: accent)
                    .scaleEffect(scale)
                    .rotationEffect(.degrees(-2.2))
                    .position(x: proxy.size.width * 0.32, y: proxy.size.height * 0.58)
                    .offset(y: revealStraight ? 0 : 44)
                    .opacity(revealStraight ? 1 : 0)
                    .accessibilityHidden(true)

                // Keep the requested high-upside parlay physically on top.
                // Its real ticket footer includes the model's reasoning
                // snippet, combined odds, units, and confidence.
                AgentParlayMiniTicket(parlay: PaywallTicketFixtures.parlay, accent: accent)
                    .scaleEffect(scale)
                    .rotationEffect(.degrees(1.6))
                    .position(x: proxy.size.width * 0.68, y: proxy.size.height * 0.42)
                    .offset(y: revealParlay ? 0 : 52)
                    .opacity(revealParlay ? 1 : 0)
                    .zIndex(2)
                    .accessibilityHidden(true)
            }
            .allowsHitTesting(false)
        }
        .task(id: isActive) {
            guard isActive else {
                revealStraight = false
                revealParlay = false
                return
            }
            if reduceMotion {
                revealStraight = true
                revealParlay = true
                return
            }
            revealStraight = false
            revealParlay = false
            withAnimation(.spring(response: 0.58, dampingFraction: 0.82)) {
                revealStraight = true
            }
            try? await Task.sleep(nanoseconds: 170_000_000)
            withAnimation(.spring(response: 0.62, dampingFraction: 0.80)) {
                revealParlay = true
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Two agent pick tickets. A four-leg Buffalo parlay at plus 2300 odds with four of five confidence, and Ravens plus three and a half at minus 110. Both include the agent's reasoning.")
    }
}

/// Stable, local-only models for the real ticket components above. Keeping the
/// fixture at the model boundary means the production ticket UI remains the
/// single source of truth for geometry, typography, and content hierarchy.
private enum PaywallTicketFixtures {
    private static let parlayID = "paywall-ticket-parlay"
    private static let gameDate = "2026-09-13"
    private static let createdAt = "2026-07-17T15:00:00Z"

    private static func leg(
        _ id: String,
        selection: String,
        odds: String,
        betType: String,
        player: String? = nil,
        market: String? = nil,
        line: Double? = nil
    ) -> AgentParlayLeg {
        AgentParlayLeg(
            id: id,
            parlayId: parlayID,
            gameId: "paywall-buf-kc",
            sport: .nfl,
            matchup: "Buffalo Bills @ Kansas City Chiefs",
            gameDate: gameDate,
            betType: betType,
            period: "full",
            pickSelection: selection,
            odds: odds,
            propPlayer: player,
            propMarket: market,
            propLine: line,
            propDirection: nil,
            legResult: .pending,
            gradedAt: nil,
            createdAt: createdAt
        )
    }

    static let parlay: AgentParlay = {
        let legs = [
            leg("paywall-leg-bills", selection: "Bills ML", odds: "+105", betType: "moneyline"),
            leg("paywall-leg-allen", selection: "Josh Allen 3+ Pass TDs", odds: "+165", betType: "prop", player: "Josh Allen", market: "Passing Touchdowns", line: 2.5),
            leg("paywall-leg-cook", selection: "James Cook Anytime TD", odds: "+110", betType: "prop", player: "James Cook", market: "Anytime Touchdown", line: 0.5),
            leg("paywall-leg-shakir", selection: "Khalil Shakir 50+ Rec Yds", odds: "+110", betType: "prop", player: "Khalil Shakir", market: "Receiving Yards", line: 49.5),
        ]

        return AgentParlay(
            id: parlayID,
            avatarId: "paywall-agent",
            sport: .nfl,
            legsCount: legs.count,
            combinedOdds: "+2300",
            units: 0.5,
            confidence: 4,
            reasoningText: "• Correlated pass volume\n• All legs clear model value",
            keyFactors: [
                "Every leg clears the model's value threshold",
                "Projected game script keeps volume concentrated in Buffalo",
            ],
            result: .pending,
            actualResult: nil,
            gradedAt: nil,
            targetDate: gameDate,
            scope: .daily,
            weekKey: nil,
            isAutoGenerated: false,
            createdAt: createdAt,
            legs: legs
        )
    }()

    static let straight = AgentPick(
        id: "paywall-ticket-straight",
        avatarId: "paywall-agent",
        gameId: "paywall-bal-cin",
        sport: .nfl,
        matchup: "Baltimore Ravens @ Cincinnati Bengals",
        gameDate: gameDate,
        betType: "spread",
        pickSelection: "Ravens +3.5",
        odds: "-110",
        units: 1,
        confidence: 4,
        reasoningText: "• Model line: Ravens +1.2\n• Baltimore has the rest edge",
        keyFactors: [
            "Model spread: Ravens +1.2",
            "Market is 2.3 points wider",
            "Rest advantage favors Baltimore",
        ],
        result: .pending,
        actualResult: nil,
        gradedAt: nil,
        createdAt: createdAt
    )
}

// MARK: - Outliers hero

private struct PaywallOutliersHero: View {
    let compact: Bool
    let isActive: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var marqueeIndex = 0

    private struct MarqueeItem: Identifiable {
        let id: String
        let sport: OutliersTrendsSport
        let card: OutliersTrendsCard
    }

    private static let firstLane = [
        MarqueeItem(id: "yankees-ml", sport: .mlb, card: yankeesMoneyline),
        MarqueeItem(id: "chiefs-spread", sport: .nfl, card: chiefsSpread),
        MarqueeItem(id: "dodgers-runline", sport: .mlb, card: dodgersRunLine),
        MarqueeItem(id: "allen-pass", sport: .nfl, card: allenPassingYards),
    ]

    private static let secondLane = [
        MarqueeItem(id: "cowboys-total", sport: .nfl, card: cowboysTotal),
        MarqueeItem(id: "orioles-total", sport: .mlb, card: oriolesTotal),
        MarqueeItem(id: "bills-ml", sport: .nfl, card: billsMoneyline),
        MarqueeItem(id: "phillies-team-total", sport: .mlb, card: philliesTeamTotal),
    ]

    var body: some View {
        GeometryReader { proxy in
            let laneWidth = proxy.size.width
            // How much of each neighbouring card peeks past the centered one.
            let peek: CGFloat = compact ? 16 : 22
            let laneSpacing: CGFloat = compact ? 8 : 10
            let cardWidth = max(compact ? 210 : 240, laneWidth - 2 * (peek + laneSpacing))

            VStack(spacing: compact ? 7 : 10) {
                marqueeLane(items: Self.firstLane, cardWidth: cardWidth, spacing: laneSpacing, laneWidth: laneWidth, direction: 1)
                marqueeLane(items: Self.secondLane, cardWidth: cardWidth, spacing: laneSpacing, laneWidth: laneWidth, direction: -1)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            .padding(.bottom, compact ? 6 : 10)
            .compositingGroup()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .allowsHitTesting(false)
        .task(id: isActive) {
            guard isActive else {
                marqueeIndex = 0
                return
            }
            guard !reduceMotion else {
                marqueeIndex = 0
                return
            }

            while !Task.isCancelled {
                do {
                    try await Task.sleep(nanoseconds: 2_000_000_000)
                } catch {
                    return
                }
                withAnimation(.spring(response: 0.62, dampingFraction: 0.84, blendDuration: 0.12)) {
                    marqueeIndex += 1
                }
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Two rotating MLB and NFL Outliers across moneyline, spread, total, run line, team total, and player prop markets.")
    }

    private func marqueeLane(
        items: [MarqueeItem],
        cardWidth: CGFloat,
        spacing: CGFloat,
        laneWidth: CGFloat,
        direction: Int
    ) -> some View {
        let n = items.count
        let step = cardWidth + spacing
        // Current index for this lane. `direction` flips travel so the two lanes
        // drift opposite ways while both keep their neighbours in view.
        let base = ((direction * marqueeIndex) % n + n) % n
        let prev = (base - 1 + n) % n
        let next = (base + 1) % n
        // Three visible cards keyed by id: the persistent ones animate their
        // offset (a slide) while the entering/leaving edges cross-fade. Current
        // is last so it draws on top of the dimmed neighbours.
        let slots: [(item: MarqueeItem, offset: CGFloat)] = [
            (items[prev], -step),
            (items[next], step),
            (items[base], 0),
        ]

        return ZStack {
            ForEach(slots, id: \.item.id) { slot in
                OutliersTrendCard(
                    card: slot.item.card,
                    sport: slot.item.sport,
                    displayMode: .expanded,
                    showsRecordStrength: true,
                    marqueeStyle: true
                )
                .frame(width: cardWidth, height: 126)
                // Treat the real card as one render layer during the spring so
                // async team/player art stays locked to the card.
                .drawingGroup()
                .opacity(slot.offset == 0 ? 1 : 0.5)
                .offset(x: slot.offset)
                .transition(.opacity)
                .accessibilityHidden(true)
            }
        }
        .frame(width: laneWidth, height: 126)
        .clipped()
    }

    private static func trendCard(
        id: String,
        matchup: String,
        subject: String,
        detail: String? = nil,
        team: String,
        subjectKind: OutliersTrendsSubjectKind = .team,
        market: String,
        label: String,
        headshotUrl: String? = nil,
        rows: [(String, Double, Int)]
    ) -> OutliersTrendsCard {
        OutliersTrendsCard(
            id: id,
            gameId: "paywall-\(id)",
            matchupLabel: matchup,
            subjectKind: subjectKind,
            subjectName: subject,
            subjectDetail: detail,
            teamAbbr: team,
            playerId: subjectKind == .player ? "paywall-\(id)-player" : nil,
            marketKey: market,
            betTypeLabel: label,
            trendValue: rows.first?.1 ?? 0.80,
            trendSampleN: rows.first?.2 ?? 5,
            lineContext: nil,
            headshotUrl: headshotUrl,
            bettingLines: [],
            rows: rows.enumerated().map { index, row in
                .init(
                    id: "\(id)-r\(index)",
                    text: row.0,
                    coverageNote: nil,
                    dominantPct: row.1,
                    sampleN: row.2
                )
            }
        )
    }

    private static let yankeesMoneyline = trendCard(
        id: "yankees-moneyline", matchup: "BOS @ NYY", subject: "Yankees", team: "NYY",
        market: "moneyline", label: "Moneyline",
        rows: [("At home", 1.0, 5), ("Vs right-handed starters", 1.0, 12), ("In series openers", 0.90, 10)]
    )
    private static let chiefsSpread = trendCard(
        id: "chiefs-spread", matchup: "BUF @ KC", subject: "Chiefs", team: "KC",
        market: "spread", label: "Spread",
        rows: [("In primetime games", 1.0, 6), ("At home", 1.0, 9), ("Vs Buffalo", 0.90, 10)]
    )
    private static let dodgersRunLine = trendCard(
        id: "dodgers-run-line", matchup: "SF @ LAD", subject: "Dodgers", team: "LAD",
        market: "run_line", label: "Run Line",
        rows: [("-1.5 in wins", 1.0, 7), ("In home starts", 1.0, 10), ("By 2+ runs vs SF", 0.90, 10)]
    )
    private static let allenPassingYards = trendCard(
        id: "allen-passing-yards", matchup: "BUF @ KC", subject: "Josh Allen", detail: "Buffalo Bills", team: "BUF", subjectKind: .player,
        market: "passing_yards", label: "Passing Yards",
        // Fixture player id can't resolve a headshot, so pin Allen's ESPN photo.
        headshotUrl: "https://a.espncdn.com/i/headshots/nfl/players/full/3918298.png",
        rows: [("In road games", 1.0, 5), ("As an underdog", 1.0, 12), ("Vs Kansas City", 0.90, 10)]
    )
    private static let cowboysTotal = trendCard(
        id: "cowboys-total", matchup: "PHI @ DAL", subject: "Cowboys", team: "DAL",
        market: "total", label: "Game Total",
        rows: [("Over at home", 1.0, 5), ("Over in division games", 1.0, 10), ("Over in primetime", 0.90, 10)]
    )
    private static let oriolesTotal = trendCard(
        id: "orioles-total", matchup: "TB @ BAL", subject: "Orioles", team: "BAL",
        market: "total", label: "Game Total",
        rows: [("Over in day games", 1.0, 5), ("Over vs lefty starters", 1.0, 8), ("Over at home", 0.917, 12)]
    )
    private static let billsMoneyline = trendCard(
        id: "bills-moneyline", matchup: "BUF @ MIA", subject: "Bills", team: "BUF",
        market: "moneyline", label: "Moneyline",
        rows: [("After a loss", 1.0, 5), ("In division road games", 1.0, 12), ("As road favorites", 0.90, 10)]
    )
    private static let philliesTeamTotal = trendCard(
        id: "phillies-team-total", matchup: "ATL @ PHI", subject: "Phillies", team: "PHI",
        market: "team_total", label: "Team Total",
        rows: [("At home", 1.0, 5), ("Vs Atlanta", 1.0, 9), ("5+ runs in night games", 0.917, 12)]
    )
}

// MARK: - Leaderboard hero

private struct PaywallLeaderboardHero: View {
    let accent: Color
    let compact: Bool
    let isActive: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selectingTopAgent = false
    @State private var showingTopAgentPicks = false
    @State private var winStampsVisible = false

    private struct Leader: Identifiable {
        let id: Int
        let sprite: Int
        let name: String
        let sport: String
        let record: String
        let units: String
        let winRate: String
        let streak: Int
    }

    private let leaders: [Leader] = [
        .init(id: 1, sprite: 2, name: "Sharp Signal", sport: "NFL", record: "53–18", units: "+28.7u", winRate: "74.6%", streak: 12),
        .init(id: 2, sprite: 6, name: "Fade Finder", sport: "NBA", record: "46–19", units: "+23.1u", winRate: "70.8%", streak: 10),
        .init(id: 3, sprite: 4, name: "Totals Lab", sport: "MLB", record: "52–24", units: "+19.6u", winRate: "68.4%", streak: 8),
        .init(id: 4, sprite: 1, name: "Line Hawk", sport: "CFB", record: "48–24", units: "+16.2u", winRate: "66.7%", streak: 6),
        .init(id: 5, sprite: 7, name: "Value Hunter", sport: "NCAAB", record: "44–23", units: "+13.9u", winRate: "65.7%", streak: 5),
    ]

    private static func wonPick(
        id: String,
        matchup: String,
        betType: String,
        selection: String,
        odds: String,
        confidence: Int,
        reasoning: String
    ) -> AgentPick {
        AgentPick(
            id: id,
            avatarId: "paywall-sharp-signal",
            gameId: "paywall-\(id)",
            sport: .nfl,
            matchup: matchup,
            gameDate: "2026-10-11",
            betType: betType,
            pickSelection: selection,
            odds: odds,
            units: 1,
            confidence: confidence,
            reasoningText: reasoning,
            keyFactors: ["Model edge cleared", "Market held through close"],
            result: .won,
            actualResult: nil,
            gradedAt: "2026-10-12T04:00:00Z",
            createdAt: "2026-10-11T14:00:00Z"
        )
    }

    private static let topAgentPicks: [AgentPick] = [
        wonPick(
            id: "leader-bills-ml",
            matchup: "Buffalo Bills @ Kansas City Chiefs",
            betType: "moneyline",
            selection: "Bills ML",
            odds: "+105",
            confidence: 5,
            reasoning: "Rest edge plus the stronger late-down profile."
        ),
        wonPick(
            id: "leader-ravens-spread",
            matchup: "Baltimore Ravens @ Cincinnati Bengals",
            betType: "spread",
            selection: "Ravens +3.5",
            odds: "-110",
            confidence: 4,
            reasoning: "The model closed 2.1 points inside the market."
        ),
        wonPick(
            id: "leader-cowboys-total",
            matchup: "Dallas Cowboys @ Philadelphia Eagles",
            betType: "total",
            selection: "Over 47.5",
            odds: "-105",
            confidence: 4,
            reasoning: "Both offenses ranked top five in early-down EPA."
        ),
    ]

    var body: some View {
        GeometryReader { proxy in
            let tight = compact || proxy.size.width < 370
            leaderboard(tight: tight)
        }
        .task(id: isActive) {
            guard isActive else {
                selectingTopAgent = false
                showingTopAgentPicks = false
                winStampsVisible = false
                return
            }
            if reduceMotion {
                selectingTopAgent = true
                showingTopAgentPicks = true
                winStampsVisible = true
                return
            }

            while !Task.isCancelled {
                withAnimation(.easeInOut(duration: 0.28)) {
                    showingTopAgentPicks = false
                    selectingTopAgent = false
                    winStampsVisible = false
                }
                try? await Task.sleep(nanoseconds: 1_250_000_000)
                guard !Task.isCancelled else { return }
                withAnimation(.spring(response: 0.36, dampingFraction: 0.72)) {
                    selectingTopAgent = true
                }
                try? await Task.sleep(nanoseconds: 720_000_000)
                guard !Task.isCancelled else { return }
                withAnimation(.smooth(duration: 0.42)) {
                    showingTopAgentPicks = true
                }
                try? await Task.sleep(nanoseconds: 520_000_000)
                guard !Task.isCancelled else { return }
                withAnimation(.spring(response: 0.42, dampingFraction: 0.66)) {
                    winStampsVisible = true
                }
                try? await Task.sleep(nanoseconds: 3_400_000_000)
            }
        }
    }

    private func leaderboard(tight: Bool) -> some View {
        VStack(spacing: tight ? 5 : 8) {
            HStack {
                if selectingTopAgent {
                    Label("TOP AGENT SELECTED", systemImage: "checkmark.circle.fill")
                        .foregroundStyle(accent)
                    Spacer()
                    Text(showingTopAgentPicks ? "3 WON PICKS" : "OPENING CARD")
                        .foregroundStyle(Color.appTextMuted)
                } else {
                    HStack(spacing: 6) {
                        Text("WIN %")
                            .foregroundStyle(.black)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(accent))
                        Text("SEASON")
                            .foregroundStyle(Color.appTextSecondary)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(Color.white.opacity(0.07)))
                    }
                    Spacer()
                }
            }
            .font(.system(size: tight ? 8 : 9, weight: .heavy, design: .monospaced))
            .tracking(0.5)
            .frame(height: tight ? 24 : 28)

            row(leaders[0], rank: 1, tight: tight)

            ZStack(alignment: .topLeading) {
                VStack(spacing: tight ? 5 : 8) {
                    ForEach(Array(leaders.dropFirst().enumerated()), id: \.element.id) { index, leader in
                        row(leader, rank: index + 2, tight: tight)
                    }
                }
                .opacity(selectingTopAgent ? 0 : 1)
                .offset(y: selectingTopAgent ? 12 : 0)

                miniTicketRail(tight: tight)
            }
            .frame(maxHeight: .infinity, alignment: .top)
        }
        .padding(tight ? 9 : 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(Color(hex: 0x121513).opacity(0.96))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.32), radius: 18, y: 10)
    }

    private func miniTicketRail(tight: Bool) -> some View {
        let scale: CGFloat = tight ? 0.60 : 0.72
        let ticketWidth = AgentPickMiniTicket.width * scale
        let ticketHeight = AgentPickMiniTicket.height * scale

        return HStack(alignment: .top, spacing: tight ? 6 : 9) {
            ForEach(Array(Self.topAgentPicks.enumerated()), id: \.element.id) { index, pick in
                AgentPickMiniTicket(pick: pick, accent: accent)
                    .overlay(alignment: .topTrailing) {
                        Text("WON")
                            .font(.system(size: 10, weight: .black, design: .monospaced))
                            .tracking(0.7)
                            .foregroundStyle(.black)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(accent))
                            .scaleEffect(winStampsVisible ? 1 : 0.45)
                            .opacity(winStampsVisible ? 1 : 0)
                            .offset(x: -10, y: 9)
                    }
                    .scaleEffect(scale, anchor: .topLeading)
                    .frame(width: ticketWidth, height: ticketHeight, alignment: .topLeading)
                    .opacity(showingTopAgentPicks ? 1 : 0)
                    .offset(x: showingTopAgentPicks ? 0 : 72 + CGFloat(index * 22))
                    .animation(
                        .spring(response: 0.52, dampingFraction: 0.80).delay(Double(index) * 0.12),
                        value: showingTopAgentPicks
                    )
                    .animation(
                        .spring(response: 0.38, dampingFraction: 0.60).delay(Double(index) * 0.13),
                        value: winStampsVisible
                    )
                    .accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.top, tight ? 3 : 5)
    }

    private func row(_ leader: Leader, rank: Int, tight: Bool) -> some View {
        let isTop = rank == 1
        let rankColor: Color = switch rank {
        case 1: Color(hex: 0xFFD54A)
        case 2: Color(white: 0.78)
        default: Color(hex: 0xCD8A4B)
        }

        return HStack(spacing: tight ? 5 : 9) {
            Group {
                if rank == 1 {
                    Image(systemName: "trophy.fill")
                } else {
                    Image(systemName: rank == 2 ? "medal.fill" : "medal")
                }
            }
            .font(.system(size: tight ? 13 : 17, weight: .bold))
            .foregroundStyle(rankColor)
            .frame(width: tight ? 18 : 26)

            PixelSpriteAvatar(spriteIndex: leader.sprite)
                .frame(width: tight ? 23 : 30, height: tight ? 30 : 39)

            VStack(alignment: .leading, spacing: 1) {
                Text(leader.name)
                    .font(.system(size: tight ? 10.5 : 13, weight: .bold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
                Text(leader.sport)
                    .font(.system(size: tight ? 7.5 : 9, weight: .heavy, design: .monospaced))
                    .tracking(0.5)
                    .foregroundStyle(Color.appTextMuted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .trailing, spacing: 1) {
                Text(leader.record)
                    .font(.system(size: tight ? 9 : 11.5, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                Text(leader.units)
                    .font(.system(size: tight ? 8 : 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.appPrimary)
                    .lineLimit(1)
            }
            .frame(width: tight ? 43 : 53, alignment: .trailing)

            Text(leader.winRate)
                .font(.system(size: tight ? 8 : 10, weight: .heavy, design: .monospaced))
                .foregroundStyle(isTop ? .black : Color.appPrimary)
                .lineLimit(1)
                .fixedSize(horizontal: true, vertical: false)
                .padding(.horizontal, tight ? 5 : 7)
                .padding(.vertical, 4)
                .background(Capsule().fill(isTop ? accent : accent.opacity(0.12)))

            HStack(spacing: 3) {
                Image(systemName: "flame.fill")
                Text("W\(leader.streak)")
                    .monospacedDigit()
                    .lineLimit(1)
                    .fixedSize(horizontal: true, vertical: false)
            }
            .font(.system(size: tight ? 7.5 : 9.5, weight: .heavy))
            .foregroundStyle(isTop ? Color.black : Color.appAccentAmber)
            .fixedSize(horizontal: true, vertical: false)
            .padding(.horizontal, tight ? 4 : 6)
            .padding(.vertical, 4)
            .background(Capsule().fill(isTop ? Color.appAccentAmber : Color.appAccentAmber.opacity(0.12)))
        }
        .padding(.horizontal, tight ? 6 : 9)
        .padding(.vertical, tight ? 5 : 7)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(isTop ? accent.opacity(0.10) : Color.appBorder.opacity(0.24))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(
                    isTop ? accent.opacity(selectingTopAgent ? 0.95 : 0.55) : Color.appBorder.opacity(0.42),
                    lineWidth: isTop && selectingTopAgent ? 2 : 1
                )
        )
        .shadow(color: isTop ? accent.opacity(selectingTopAgent ? 0.34 : 0.14) : .clear, radius: selectingTopAgent ? 16 : 10)
        .scaleEffect(isTop && selectingTopAgent && !showingTopAgentPicks ? 1.012 : 1)
    }
}

// MARK: - Community and AI connectors

private struct PaywallCommunityConnectorsHero: View {
    let compact: Bool

    var body: some View {
        VStack(spacing: compact ? 7 : 10) {
            // Reuse the exact Discord promo banner from Settings so this
            // entitlement looks identical before and after purchase.
            HoneydewOptionCard(
                title: "Join our Discord",
                subtitle: "Picks, updates, and live chat",
                actionWord: "Included",
                primaryColor: Color(red: 0.36, green: 0.40, blue: 0.95),
                secondaryColor: Color(red: 0.62, green: 0.66, blue: 1.00),
                symbols: [
                    "bubble.left.and.bubble.right.fill", "message.fill",
                    "person.2.fill", "hand.wave.fill", "headphones",
                    "mic.fill", "heart.fill", "star.fill",
                    "ellipsis.bubble.fill", "person.3.fill",
                ],
                seed: 0.46,
                speedFactor: 0.95,
                yJitter: -0.04,
                onTap: {}
            )
            .allowsHitTesting(false)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Private WagerProof Discord included with Pro")
            .accessibilityRemoveTraits(.isButton)
            .frame(height: 64)

            PaywallAIConnectorBanner(compact: compact)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct PaywallAIConnectorBanner: View {
    let compact: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private struct Provider: Identifiable {
        let id: String
        let assetName: String
        let usesInsetLogo: Bool
    }

    private let providers: [Provider] = [
        .init(id: "Claude", assetName: "AIClaudeIcon", usesInsetLogo: false),
        .init(id: "ChatGPT", assetName: "AIChatGPTIcon", usesInsetLogo: false),
        .init(id: "Gemini", assetName: "AIGeminiIcon", usesInsetLogo: false),
        .init(id: "Grok", assetName: "AIGrokIcon", usesInsetLogo: false),
        .init(id: "Codex", assetName: "AICodexIcon", usesInsetLogo: false),
    ]

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 23, style: .continuous)
        // Claude's warm charcoal + terracotta palette makes the connector
        // surface feel distinct from WagerProof's green product chrome.
        let primary = Color(hex: 0x30231F)
        let secondary = Color(hex: 0xD97757)

        ZStack {
            LinearGradient(
                colors: [primary, secondary],
                startPoint: .leading,
                endPoint: .trailing
            )

            OptionCardIconChrome(
                primaryColor: primary,
                symbols: [
                    "link", "sparkles", "brain.head.profile",
                    "text.bubble.fill", "magnifyingglass",
                    "chart.bar.fill", "bolt.fill", "network",
                    "terminal.fill", "doc.text.fill",
                ],
                seed: 0.72,
                speedFactor: 0.86,
                yJitter: 0.01,
                motionEnabled: !reduceMotion
            )

            LinearGradient(
                colors: [primary, primary.opacity(0.88), primary.opacity(0.18)],
                startPoint: .leading,
                endPoint: .trailing
            )
            .allowsHitTesting(false)

            VStack(alignment: .leading, spacing: compact ? 7 : 9) {
                HStack(spacing: compact ? -9 : -11) {
                    ForEach(providers) { provider in
                        ZStack {
                            Circle()
                                .fill(Color.black)

                            Image(provider.assetName)
                                .resizable()
                                .renderingMode(.original)
                                .aspectRatio(contentMode: provider.usesInsetLogo ? .fit : .fill)
                                .padding(provider.usesInsetLogo ? (compact ? 8 : 10) : 0)
                            }
                        .frame(width: compact ? 38 : 46, height: compact ? 38 : 46)
                        .clipShape(Circle())
                        .overlay(Circle().strokeBorder(Color.white.opacity(0.82), lineWidth: compact ? 1.5 : 2))
                        .shadow(color: .black.opacity(0.34), radius: 5, y: 3)
                        .zIndex(Double(providers.count - (providers.firstIndex(where: { $0.id == provider.id }) ?? 0)))
                    }
                }
                .accessibilityHidden(true)

                Text("Connect WagerProof to your AI")
                    .font(.system(size: compact ? 15 : 18, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)

                Text("Bring your agents, picks, and model analytics into a read-only AI workflow.")
                    .font(.system(size: compact ? 12.5 : 15, weight: .medium))
                    .foregroundStyle(.white.opacity(0.92))
                    .lineLimit(3)
                    .minimumScaleFactor(0.9)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Claude  ·  ChatGPT  ·  Gemini  ·  Grok  ·  Codex")
                    .font(.system(size: compact ? 7.5 : 9, weight: .bold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.72))
                    .lineLimit(1)
                    .minimumScaleFactor(0.72)
            }
            .padding(compact ? 10 : 14)
        }
        .frame(maxWidth: .infinity)
        .frame(height: compact ? 152 : 184)
        .clipShape(shape)
        .overlay(shape.strokeBorder(.white.opacity(0.14), lineWidth: 1))
        .shadow(color: .black.opacity(0.15), radius: 12, y: 5)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("AI connector setup for Claude, ChatGPT, Gemini, Grok, and Codex. Read-only access included with Pro.")
    }
}
