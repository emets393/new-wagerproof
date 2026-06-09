import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Per-category Outliers detail view pushed onto the navigation stack when
/// the user taps a section header. Ports the `selectedCategory !== null`
/// branch of `wagerproof-mobile/app/(drawer)/(tabs)/outliers.tsx` (lines 1907–2182).
///
/// Each category has its own:
///   - `ToolExplainerBannerView` at the top
///   - sport filter pill row (where applicable)
///   - list of `OutlierAlertCard` or a deferred placeholder
struct OutliersDetailView: View {
    @Bindable var store: OutliersStore
    let category: OutliersStore.Category

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        // Value/fade categories share the OutliersStore (week games + alerts)
        // and render inline; every other category delegates to its own
        // self-contained list view that owns its store, sort pills, refresh
        // toolbar item, and sheet presentation. This keeps OutliersDetailView
        // a pure router for the deeper categories instead of trying to merge
        // their state into the shared store.
        switch category {
        case .value, .fade:
            inlineAlertsBody
        default:
            // Every tool category resolves through the shared router so the
            // Outliers hub and the Games-page banner open the identical page.
            ToolRouter.leafView(for: category)
        }
    }

    @ViewBuilder
    private var inlineAlertsBody: some View {
        ScrollView {
            VStack(spacing: 14) {
                explainerBanner
                if case .value = category {
                    valueAlertsList
                } else {
                    fadeAlertsList
                }
            }
            .padding(.horizontal, Spacing.lg)
            .padding(.bottom, Spacing.xxl)
        }
        .background(Color.appSurface.ignoresSafeArea())
        .navigationTitle(category.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await store.refresh() }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await store.refresh() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .tint(Color.appPrimary)
            }
        }
    }

    // MARK: - Banners

    /// Inline explainer banners for the value / fade categories. The trend /
    /// accuracy / regression categories route to their own views (which
    /// embed their own ToolExplainerBannerView), so we only need two cases.
    @ViewBuilder
    private var explainerBanner: some View {
        switch category {
        case .value:
            ToolExplainerBannerView(
                accentColor: Color(hex: 0x22C55E),
                title: "Prediction Market Alerts",
                titleIcon: "chart.line.uptrend.xyaxis",
                headline: "Follow the smart money.",
                description: "Prediction markets move faster than sportsbooks. When Polymarket consensus diverges from the line, the book may not have adjusted yet — that's your window.",
                examples: [
                    .init(icon: "chart.line.uptrend.xyaxis", label: "Polymarket has Chiefs ML at 67%", value: "Book: -150", valueColor: Color(hex: 0x22C55E)),
                    .init(icon: "arrow.left.arrow.right", label: "Consensus says Over but line hasn't moved", value: "62% Over", valueColor: Color(hex: 0x22C55E)),
                    .init(icon: "exclamationmark.circle.fill", label: "Spread divergence: market vs book", value: "+3.5 gap", valueColor: Color(hex: 0xF59E0B)),
                ]
            )
        case .fade:
            ToolExplainerBannerView(
                accentColor: Color(hex: 0xF59E0B),
                title: "Model Fade Alerts",
                titleIcon: "bolt.fill",
                headline: "When confidence backfires.",
                description: "When our model is extremely confident, backtesting shows betting the opposite side has been more profitable. These are contrarian opportunities hiding in plain sight.",
                examples: [
                    .init(icon: "bolt.fill", label: "Model says Bills -7 at 92% confidence", value: "Fade", valueColor: Color(hex: 0xEF4444)),
                    .init(icon: "arrow.up.arrow.down", label: "Backtest: fading 90%+ picks hits 61%", value: "61% win", valueColor: Color(hex: 0x22C55E)),
                    .init(icon: "gauge.high", label: "Extreme NBA spread confidence", value: "Fade", valueColor: Color(hex: 0xEF4444)),
                ]
            )
        default:
            EmptyView()
        }
    }

    // MARK: - Value alerts list

    private var valueAlertsList: some View {
        @Bindable var binding = store
        return VStack(spacing: 12) {
            sportFilterPills(currentBinding: $binding.valueAlertsSportFilter, countProvider: store.valueAlertsCount)
            if store.isLoading && store.filteredValueAlerts.isEmpty {
                shimmerRows
            } else if store.filteredValueAlerts.isEmpty {
                emptyState("No value alerts found for this week.")
            } else {
                ForEach(Array(store.filteredValueAlerts.enumerated()), id: \.element.id) { index, alert in
                    OutlierAlertCard(kind: .value(alert)) {
                        store.loadingGameId = alert.gameId
                        // FIDELITY-WAIVER #021: game-sheet route deferred to B12.
                        Task {
                            try? await Task.sleep(nanoseconds: 500_000_000)
                            await MainActor.run { store.loadingGameId = nil }
                        }
                    }
                    .staggeredAppear(index: index)
                }
            }
        }
    }

    // MARK: - Fade alerts list

    private var fadeAlertsList: some View {
        @Bindable var binding = store
        return VStack(spacing: 12) {
            sportFilterPills(currentBinding: $binding.fadeAlertsSportFilter, countProvider: store.fadeAlertsCount)
            if store.isLoading && store.filteredFadeAlerts.isEmpty {
                shimmerRows
            } else if store.filteredFadeAlerts.isEmpty {
                emptyState("No model fade alerts found for today.")
            } else {
                ForEach(Array(store.filteredFadeAlerts.enumerated()), id: \.element.id) { index, alert in
                    OutlierAlertCard(kind: .fade(alert)) {
                        store.loadingGameId = alert.gameId
                        Task {
                            try? await Task.sleep(nanoseconds: 500_000_000)
                            await MainActor.run { store.loadingGameId = nil }
                        }
                    }
                    .staggeredAppear(index: index)
                }
            }
        }
    }

    // MARK: - Sport filter pills (used by both detail lists)

    /// Renders an "All / NFL (n) / CFB (n) / NBA (n) / NCAAB (n)" pill row.
    /// Mirrors RN's `renderSportFilter`. Pills hide when their count is 0.
    private func sportFilterPills(
        currentBinding: Binding<SportLeague?>,
        countProvider: @escaping (SportLeague) -> Int
    ) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                pill(
                    label: "All (\(totalCount(provider: countProvider)))",
                    isActive: currentBinding.wrappedValue == nil,
                    sport: nil
                ) {
                    currentBinding.wrappedValue = nil
                }
                ForEach([SportLeague.nfl, .cfb, .nba, .ncaab], id: \.self) { sport in
                    let count = countProvider(sport)
                    if count > 0 {
                        pill(
                            label: "\(sport.rawValue.uppercased()) (\(count))",
                            isActive: currentBinding.wrappedValue == sport,
                            sport: sport
                        ) {
                            currentBinding.wrappedValue = currentBinding.wrappedValue == sport ? nil : sport
                        }
                    }
                }
            }
        }
        .sensoryFeedback(.selection, trigger: currentBinding.wrappedValue)
    }

    private func totalCount(provider: @escaping (SportLeague) -> Int) -> Int {
        SportLeague.allCases.reduce(0) { $0 + provider($1) }
    }

    private func pill(label: String, isActive: Bool, sport: SportLeague?, onTap: @escaping () -> Void) -> some View {
        Button(action: onTap) {
            HStack(spacing: 4) {
                if let sport {
                    Image(systemName: sport.sfSymbol)
                        .font(.system(size: 11, weight: .semibold))
                }
                Text(label)
                    .font(.system(size: 13, weight: .semibold))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isActive ? Color.appPrimary : Color.appSurfaceMuted)
            .foregroundStyle(isActive ? .white : Color.appTextPrimary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Loading / empty

    /// ~3 skeleton cards that mirror `OutlierAlertCard`'s footprint so the
    /// crossfade to loaded content never shifts layout: same 14pt continuous
    /// corner, 14pt padding, and the accent-tinted chrome. Inner placeholders
    /// (pills / logo discs / body lines) carry the shimmer; chrome stays solid.
    private var shimmerRows: some View {
        // Tint the skeleton chrome with the category's accent so loading reads
        // as the right alert type (green = value, amber = fade).
        let accent = category == .value ? Color(hex: 0x22C55E) : Color(hex: 0xF59E0B)
        return VStack(spacing: 12) {
            ForEach(0..<3, id: \.self) { _ in
                outlierCardShimmer(accent: accent)
            }
        }
        .transition(.opacity)
    }

    /// Single skeleton row reproducing `OutlierAlertCard`'s VStack(spacing: 10):
    /// header pills + lines row, matchup row (logo discs + abbrevs), body text.
    private func outlierCardShimmer(accent: Color) -> some View {
        let shape = RoundedRectangle(cornerRadius: 14, style: .continuous)
        return VStack(alignment: .leading, spacing: 10) {
            // Header: sport / market / accent pills, then the lines pill row.
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    SkeletonCapsule(width: 56, height: 22)
                    SkeletonCapsule(width: 70, height: 22)
                    SkeletonCapsule(width: 48, height: 22)
                }
                HStack(spacing: 6) {
                    SkeletonCapsule(width: 72, height: 20)
                    SkeletonCapsule(width: 60, height: 20)
                }
            }
            // Matchup: away disc + abbrev, "@", home disc + abbrev.
            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    SkeletonCircle(28)
                    SkeletonBlock(width: 32, height: 13)
                }
                SkeletonBlock(width: 10, height: 13)
                HStack(spacing: 6) {
                    SkeletonCircle(28)
                    SkeletonBlock(width: 32, height: 13)
                }
                Spacer()
            }
            // Body descriptive line.
            SkeletonBlock(height: 13)
                .padding(.trailing, 40)
        }
        .padding(14)
        .shimmering()
        .background(accent.opacity(0.1))
        .overlay(shape.strokeBorder(accent.opacity(0.3), lineWidth: 1))
        .clipShape(shape)
    }

    private func emptyState(_ text: String) -> some View {
        ContentUnavailableView {
            Label("No outliers", systemImage: "magnifyingglass")
        } description: {
            Text(text)
        }
        .frame(minHeight: 220)
    }
}
