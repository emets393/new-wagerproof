import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Rich MLB game result card for search: matchup header (tap = game-sheet
/// handoff) + a rail of insight chips (Trends / F5 / Props teasers, tap =
/// local push to the expanded surface). Teasers are computed by the VIEW from
/// the Kit insight adapters — absent kinds hide their chip, loading kinds
/// shimmer, neutral chips still navigate ("never hide the door").
struct SearchMatchupCard: View {
    let result: SearchStore.SearchResult.Game
    let teasers: [InsightTeaser]                       // ordered trends, f5, props
    let loadingKinds: Set<InsightTeaser.Kind>          // first-hydrate shimmer chips
    let onOpenGame: () -> Void
    let onOpenInsight: (InsightTeaser.Kind) -> Void

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 26, style: .continuous)
        VStack(alignment: .leading, spacing: 10) {
            header
            if !teasers.isEmpty || !loadingKinds.isEmpty {
                chipRail
            }
        }
        .padding(14)
        .background(shape.fill(.ultraThinMaterial))
        .clipShape(shape)
        .overlay(shape.strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5))
        .padding(.horizontal, 16)
        .padding(.vertical, 4)
    }

    private var header: some View {
        Button(action: onOpenGame) {
            HStack(spacing: 10) {
                logoDisc(team: result.awayTeam)
                logoDisc(team: result.homeTeam)
                VStack(alignment: .leading, spacing: 2) {
                    Text("\(result.awayTeam) @ \(result.homeTeam)")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.75)
                    Text(subtitle)
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                        .lineLimit(1)
                }
                Spacer(minLength: 6)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextMuted)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var subtitle: String {
        var parts = [result.sport.label]
        if let time = result.gameTime, !time.isEmpty { parts.append(Self.prettyTime(time)) }
        return parts.joined(separator: " · ")
    }

    /// Upstream `gameTime` fields are a mix of ISO 8601 and bare dates —
    /// surface what parses, fall back to the raw string (same rule as
    /// `SearchResultRow`'s formatter).
    private static func prettyTime(_ raw: String) -> String {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = iso.date(from: raw) { return shortFormatter.string(from: d) }
        iso.formatOptions = [.withInternetDateTime]
        if let d = iso.date(from: raw) { return shortFormatter.string(from: d) }
        return raw
    }

    private static let shortFormatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale.current
        f.dateFormat = "EEE h:mm a"
        return f
    }()

    @ViewBuilder
    private func logoDisc(team: String) -> some View {
        if result.sport == .mlb, let info = MLBTeams.info(for: team), let url = URL(string: info.logoUrl) {
            AsyncImage(url: url) { phase in
                if case .success(let img) = phase {
                    img.resizable().scaledToFit()
                } else {
                    Circle().fill(Color(hex: Int(info.primaryHex)).opacity(0.4))
                }
            }
            .frame(width: 24, height: 24)
        } else {
            Circle()
                .fill(Color.appSurfaceMuted)
                .frame(width: 24, height: 24)
                .overlay(
                    Text(String(team.prefix(1)))
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(Color.appTextSecondary)
                )
        }
    }

    private var chipRail: some View {
        HStack(alignment: .top, spacing: 8) {
            ForEach(InsightTeaser.Kind.allCases, id: \.self) { kind in
                if let teaser = teasers.first(where: { $0.kind == kind }) {
                    InsightChip(teaser: teaser) { onOpenInsight(kind) }
                } else if loadingKinds.contains(kind) {
                    SkeletonCapsule(width: 110, height: 52)
                        .shimmering()
                }
            }
        }
    }
}

/// One insight teaser chip — tracking-caps kind title + tinted icon + the
/// teaser headline (or neutral copy). Always tappable.
private struct InsightChip: View {
    let teaser: InsightTeaser
    let onTap: () -> Void

    private var title: String {
        switch teaser.kind {
        case .trends: return "TRENDS"
        case .f5: return "FIRST 5"
        case .props: return "PROPS"
        }
    }

    private var icon: String {
        switch teaser.kind {
        case .trends: return "chart.line.uptrend.xyaxis"
        case .f5: return "baseball.diamond.bases"
        case .props: return "figure.baseball"
        }
    }

    private var tint: Color {
        switch teaser.signal {
        case .positive: return Color(hex: 0x22C55E)
        case .negative: return Color(hex: 0xEF4444)
        case .neutral: return Color.appTextSecondary
        }
    }

    private var headline: String {
        if let h = teaser.headline { return h }
        switch teaser.kind {
        case .trends: return "Situational angles"
        case .f5: return "F5 splits"
        case .props: return "Props posted"
        }
    }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Image(systemName: icon)
                        .font(.system(size: 9, weight: .semibold))
                        .foregroundStyle(tint)
                    Text(title)
                        .font(.system(size: 9, weight: .bold))
                        .tracking(0.6)
                        .foregroundStyle(Color.appTextSecondary)
                    if teaser.smallSample {
                        Circle().fill(Color.appAccentAmber).frame(width: 4, height: 4)
                    }
                }
                Text(headline)
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(teaser.headline == nil ? Color.appTextSecondary : tint)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(8)
            .frame(maxWidth: .infinity, minHeight: 52, alignment: .topLeading)
            .background(Color.appSurfaceMuted.opacity(0.6), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
