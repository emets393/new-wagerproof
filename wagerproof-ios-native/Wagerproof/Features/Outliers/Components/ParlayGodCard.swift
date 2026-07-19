import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices

/// One assembled Parlay God ticket: category header, 3-5 legs (each backed by
/// a 100% streak), combined odds. Compact = fixed-height rail card; expanded =
/// full evidence rows in the detail sheet. Chrome mirrors `OutliersTrendCard`.
struct ParlayGodCard: View {
    enum DisplayMode { case compact, expanded }

    let ticket: ParlayTicket
    var displayMode: DisplayMode = .compact
    /// Matchup-widget cards hide per-leg matchup labels (the game is the context).
    var showsMatchup: Bool = true

    /// Rail cards lock to one height so a carousel reads as a uniform row.
    private let compactCardHeight: CGFloat = 236

    private var isCompact: Bool { displayMode == .compact }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            header
            VStack(alignment: .leading, spacing: isCompact ? 7 : 12) {
                ForEach(ticket.legs) { leg in
                    legRow(leg)
                }
            }
            if isCompact {
                Spacer(minLength: 0)
            }
            footer
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: isCompact ? compactCardHeight : nil, alignment: .top)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.appBorder.opacity(0.35), lineWidth: 0.5)
        )
        .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    // MARK: - Header

    private var header: some View {
        HStack(spacing: 7) {
            Image(systemName: ticket.category.sfSymbol)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 22, height: 22)
                .background(Color.appPrimary.gradient, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
            Text(ticket.category.title)
                .font(.system(size: 14, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 4)
            Text(ticket.combinedOddsText)
                .font(.system(size: 13, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.appPrimary)
                .monospacedDigit()
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.appPrimary.opacity(0.12), in: Capsule())
        }
    }

    // MARK: - Legs

    @ViewBuilder
    private func legRow(_ leg: ParlayLeg) -> some View {
        HStack(alignment: .center, spacing: 8) {
            legAvatar(leg)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(leg.subject)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                        .layoutPriority(1)
                    Text(leg.betText)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(1)
                }
                if !isCompact {
                    Text(expandedEvidence(leg))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.appTextMuted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 4)
            Text(leg.oddsText)
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.appTextSecondary)
                .monospacedDigit()
            Text(leg.fractionText)
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.appWin)
                .monospacedDigit()
                .padding(.horizontal, 5)
                .padding(.vertical, 2)
                .background(Color.appWin.opacity(0.12), in: Capsule())
        }
    }

    private func expandedEvidence(_ leg: ParlayLeg) -> String {
        showsMatchup ? "\(leg.evidence) · \(leg.matchupLabel)" : leg.evidence
    }

    @ViewBuilder
    private func legAvatar(_ leg: ParlayLeg) -> some View {
        let size: CGFloat = isCompact ? 22 : 28
        if leg.kind == .prop, let urlString = leg.headshotUrl, let url = URL(string: urlString) {
            // NFL props ship a CDN headshot URL directly.
            AsyncImage(url: url) { phase in
                if case .success(let image) = phase {
                    image.resizable().scaledToFill()
                } else {
                    Image(systemName: "person.fill")
                        .font(.system(size: size * 0.45))
                        .foregroundStyle(Color.appTextMuted)
                }
            }
            .frame(width: size, height: size)
            .background(Color.appSurfaceMuted)
            .clipShape(Circle())
        } else if leg.kind == .prop, let playerId = leg.playerId {
            PlayerHeadshot(playerId: playerId, size: size)
        } else {
            let team = leg.teamAbbr ?? leg.subject
            GameCardTeamAvatar(
                teamName: team,
                sport: "mlb",
                size: size,
                colors: MLBTeamColors.colorPair(for: team)
            )
        }
    }

    // MARK: - Footer

    private var footer: some View {
        VStack(alignment: .leading, spacing: 6) {
            Rectangle()
                .fill(Color.appBorder.opacity(0.35))
                .frame(height: 0.5)
            HStack(spacing: 5) {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(Color.appWin)
                Text("Every leg has hit 100% of its sample")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
                Spacer(minLength: 0)
                if isCompact {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Color.appTextMuted)
                }
            }
            if !isCompact {
                Text("Streaks are historical, not a prediction — sizes vary per leg. Bet responsibly.")
                    .font(.system(size: 10))
                    .foregroundStyle(Color.appTextMuted)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

// MARK: - Shimmer

/// Loading placeholder matching `ParlayGodCard`'s compact geometry, per the
/// house rule that every list skeleton mirrors its parent card.
struct ParlayGodCardShimmer: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 7) {
                SkeletonBlock(width: 22, height: 22, cornerRadius: 7)
                SkeletonBlock(width: 130, height: 13)
                Spacer(minLength: 4)
                SkeletonBlock(width: 46, height: 18, cornerRadius: 9)
            }
            VStack(alignment: .leading, spacing: 7) {
                ForEach(0..<5, id: \.self) { _ in
                    HStack(spacing: 8) {
                        SkeletonCircle(22)
                        SkeletonBlock(width: 150, height: 11)
                        Spacer(minLength: 4)
                        SkeletonBlock(width: 30, height: 10)
                    }
                }
            }
            Spacer(minLength: 0)
            SkeletonBlock(width: 180, height: 10)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .frame(height: 236, alignment: .top)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Color.appBorder.opacity(0.35), lineWidth: 0.5)
        )
        .shimmering()
    }
}

// MARK: - Rail

/// Section header + horizontal ticket carousel — the shared Parlay God surface
/// for the Outliers tab, Search, and the Props tab ("Props Cheats"). Pro-gated:
/// free users see the rail blurred behind the standard unlock overlay.
struct ParlayGodRail: View {
    let title: String
    let icon: String
    let tickets: [ParlayTicket]
    let isLoading: Bool
    /// Rails hosted in a padded column bleed edge-to-edge past that inset
    /// (Outliers: Spacing.lg, Props: 12). nil = no bleed (Search's List rows
    /// manage their own margins).
    var bleedInset: CGFloat? = Spacing.lg
    /// Search hosts the rail inside a List `Section` that supplies its own header.
    var showsHeader: Bool = true
    /// When set, an empty (loaded) rail shows this note instead of vanishing —
    /// used on the Props tab, where props post each morning and the overnight
    /// gap would otherwise read as a broken section.
    var emptyNote: String? = nil

    @State private var selectedTicket: ParlayTicket?

    private let cardWidth: CGFloat = 300

    var body: some View {
        if tickets.isEmpty && !isLoading {
            if let emptyNote {
                VStack(alignment: .leading, spacing: 10) {
                    if showsHeader {
                        sectionHeader
                    }
                    HStack(spacing: 8) {
                        Image(systemName: "moon.zzz.fill")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(Color.appTextMuted)
                        Text(emptyNote)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .padding(12)
                    .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Color.appBorder.opacity(0.35), lineWidth: 0.5)
                    )
                }
            } else {
                EmptyView()
            }
        } else {
            VStack(alignment: .leading, spacing: 10) {
                if showsHeader {
                    sectionHeader
                }
                ProContentSection(title: title, minHeight: 236) {
                    carousel
                }
            }
            .sheet(item: $selectedTicket) { ticket in
                ParlayGodDetailSheet(ticket: ticket)
            }
        }
    }

    private var sectionHeader: some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .bold))
            Text(title)
                .font(.footnote.weight(.semibold))
                .textCase(.uppercase)
            Spacer(minLength: 0)
        }
        .foregroundStyle(.secondary)
    }

    @ViewBuilder
    private var carousel: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(alignment: .top, spacing: 12) {
                if isLoading && tickets.isEmpty {
                    ForEach(0..<3, id: \.self) { _ in
                        ParlayGodCardShimmer()
                            .frame(width: cardWidth)
                    }
                } else {
                    ForEach(tickets) { ticket in
                        Button {
                            selectedTicket = ticket
                        } label: {
                            ParlayGodCard(ticket: ticket)
                                .frame(width: cardWidth)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, bleedInset ?? 0)
            .padding(.vertical, 2)
        }
        .padding(.horizontal, -(bleedInset ?? 0))
        .scrollDisabled(isLoading && tickets.isEmpty)
    }
}

// MARK: - Detail sheet

/// Expanded ticket in a bottom sheet — same presentation pattern as the
/// Outliers trend detail sheet.
struct ParlayGodDetailSheet: View {
    let ticket: ParlayTicket
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Parlay God")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Color.appTextSecondary)
                        .textCase(.uppercase)
                    Spacer()
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(Color.appTextMuted)
                    }
                    .buttonStyle(.plain)
                }
                ParlayGodCard(ticket: ticket, displayMode: .expanded)
            }
            .padding(Spacing.lg)
        }
        .background(Color.appSurface)
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }
}
