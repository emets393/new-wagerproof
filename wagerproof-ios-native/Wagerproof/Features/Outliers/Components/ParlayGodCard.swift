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
            VStack(alignment: .leading, spacing: 1) {
                Text(ticket.category.title)
                    .font(.system(size: 14, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                if !showsMatchup {
                    Text("\(ticket.legs.count) legs · same game")
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(Color.appTextMuted)
                }
            }
            Spacer(minLength: 4)
            // Sport chips — one glyph per contributing sport (merged live
            // slates put several on one card).
            HStack(spacing: -4) {
                ForEach(ticket.sports) { sport in
                    Image(systemName: sport.sfSymbol)
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(Color.appTextSecondary)
                        .frame(width: 17, height: 17)
                        .background(Color.appSurfaceMuted, in: Circle())
                        .overlay(Circle().stroke(Color.appBorder.opacity(0.5), lineWidth: 0.5))
                }
            }
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
        } else if leg.sport == .nfl {
            let team = leg.teamAbbr ?? leg.subject
            GameCardTeamAvatar(
                teamName: team,
                sport: "nfl",
                size: size,
                colors: NFLTeamColors.colorPair(for: team)
            )
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
                Text(
                    showsMatchup
                        ? "Every leg has hit 100% of its sample"
                        : "Every leg must win · tap for full evidence"
                )
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

// MARK: - Matchup widget

/// Same-game parlay digest used inside a matchup's collapsing widget stack.
///
/// The horizontal ticket rail is intentionally the same finite-height surface
/// used elsewhere in the app. It remains cheap for the collapsing parent to
/// measure while the large summary explains what the options mean.
struct MatchupParlaysWidget: View {
    let tickets: [ParlayTicket]
    let onOpen: (ParlayTicket) -> Void

    var body: some View {
        WidgetCollapsingSection(
            title: "Matchup Parlays",
            systemImage: "bolt.fill",
            iconTint: Color.appPrimary,
            accessory: .verdict(
                text: "\(tickets.count) OPTION\(tickets.count == 1 ? "" : "S")",
                tintHex: 0x22C55E
            )
        ) {
            ProContentSection(title: "Matchup Parlays", minHeight: 236) {
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(alignment: .top, spacing: 12) {
                        ForEach(tickets) { ticket in
                            Button {
                                onOpen(ticket)
                            } label: {
                                ParlayGodCard(ticket: ticket, showsMatchup: false)
                                    .frame(width: 300)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
    }
}

private struct MatchupParlayTicketBoard: View {
    let ticket: ParlayTicket
    let onOpen: () -> Void

    var body: some View {
        Button(action: onOpen) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: ticket.category.sfSymbol)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 26, height: 26)
                        .background(
                            Color.appPrimary.gradient,
                            in: RoundedRectangle(cornerRadius: 8, style: .continuous)
                        )

                    VStack(alignment: .leading, spacing: 1) {
                        Text(ticket.category.title.uppercased())
                            .font(.system(size: 10, weight: .heavy))
                            .tracking(0.55)
                            .foregroundStyle(Color.appTextSecondary)
                        Text("\(ticket.legs.count) legs · same game")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Color.appTextMuted)
                    }

                    Spacer(minLength: 8)

                    VStack(alignment: .trailing, spacing: 0) {
                        Text(ticket.combinedOddsText)
                            .font(.system(size: 23, weight: .heavy, design: .rounded))
                            .monospacedDigit()
                            .foregroundStyle(Color.appPrimary)
                        Text("COMBINED")
                            .font(.system(size: 7, weight: .bold))
                            .tracking(0.55)
                            .foregroundStyle(Color.appTextMuted)
                    }
                }

                VStack(spacing: 8) {
                    ForEach(Array(ticket.legs.enumerated()), id: \.element.id) { index, leg in
                        MatchupParlayLegRow(number: index + 1, leg: leg)
                    }
                }

                HStack(spacing: 6) {
                    Image(systemName: "checkmark.shield.fill")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.appWin)
                    Text("All \(ticket.legs.count) legs must win")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                    Spacer(minLength: 4)
                    Text("Full evidence")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.appPrimary)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Color.appPrimary)
                }
                .padding(.top, 2)
            }
            .padding(12)
            .background(
                Color.appSurfaceMuted.opacity(0.30),
                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color.appBorder.opacity(0.50), lineWidth: 0.75)
            )
            .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .contain)
        .accessibilityHint("Opens the full evidence for this parlay")
    }
}

private struct MatchupParlayLegRow: View {
    let number: Int
    let leg: ParlayLeg

    var body: some View {
        HStack(alignment: .center, spacing: 9) {
            Text("\(number)")
                .font(.system(size: 9, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.appTextPrimary)
                .frame(width: 19, height: 19)
                .background(Color.appBorder.opacity(0.34), in: Circle())

            MatchupParlayLegAvatar(leg: leg)

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(leg.subject)
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                    Text(leg.betText)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                }

                Text(leg.evidence)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(Color.appTextMuted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)
            }

            Spacer(minLength: 4)

            VStack(alignment: .trailing, spacing: 2) {
                Text(leg.oddsText)
                    .font(.system(size: 10, weight: .bold, design: .monospaced))
                    .foregroundStyle(Color.appTextSecondary)
                Text(leg.fractionText)
                    .font(.system(size: 9, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Color.appWin)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(Color.appWin.opacity(0.12), in: Capsule())
            }
        }
        .padding(9)
        .background(
            Color.appSurface.opacity(0.26),
            in: RoundedRectangle(cornerRadius: 11, style: .continuous)
        )
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "Leg \(number), \(leg.subject), \(leg.betText), \(leg.oddsText), cleared \(leg.fractionText), \(leg.evidence)"
        )
    }
}

private struct MatchupParlayLegAvatar: View {
    let leg: ParlayLeg

    var body: some View {
        if leg.kind == .prop, let urlString = leg.headshotUrl, let url = URL(string: urlString) {
            AsyncImage(url: url) { phase in
                if case .success(let image) = phase {
                    image.resizable().scaledToFill()
                } else {
                    placeholder
                }
            }
            .frame(width: 26, height: 26)
            .background(Color.appSurfaceMuted)
            .clipShape(Circle())
        } else if leg.kind == .prop, let playerId = leg.playerId {
            PlayerHeadshot(playerId: playerId, size: 26)
        } else if leg.sport == .nfl {
            let team = leg.teamAbbr ?? leg.subject
            GameCardTeamAvatar(
                teamName: team,
                sport: "nfl",
                size: 26,
                colors: NFLTeamColors.colorPair(for: team)
            )
        } else {
            let team = leg.teamAbbr ?? leg.subject
            GameCardTeamAvatar(
                teamName: team,
                sport: "mlb",
                size: 26,
                colors: MLBTeamColors.colorPair(for: team)
            )
        }
    }

    private var placeholder: some View {
        Image(systemName: "person.fill")
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(Color.appTextMuted)
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
    /// Sports feeding this rail — rendered as a right-aligned "Supports"
    /// overlapping-icon cluster in the section header. Empty = no cluster.
    var sports: [ParlaySport] = []
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
            if !sports.isEmpty {
                supportsCluster
            }
        }
        .foregroundStyle(.secondary)
    }

    /// "Supports ⚾🏈" — overlapping circular sport icons, ordered per
    /// `ParlaySport.displayOrder`. Tells users the rail pulls from every
    /// sport with Outliers markets, not just the one the page filter shows.
    private var supportsCluster: some View {
        HStack(spacing: 5) {
            Text("Supports")
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.appTextMuted)
            HStack(spacing: -5) {
                ForEach(sports) { sport in
                    Image(systemName: sport.sfSymbol)
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(Color.appTextSecondary)
                        .frame(width: 19, height: 19)
                        .background(Color.appSurfaceElevated, in: Circle())
                        .overlay(Circle().stroke(Color.appBorder.opacity(0.6), lineWidth: 0.5))
                }
            }
        }
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
