import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Native port of `wagerproof-mobile/components/BettingTrendsWidget.tsx`.
///
/// Renders the ATS + O/U trends tables for one NBA or NCAAB matchup. The
/// widget is dumb — it takes the two parsed `*SituationalTrendRow` rows from
/// either `NBABettingTrendsStore.trends(for:)` or
/// `NCAABBettingTrendsStore.trends(for:)` and renders the two tables.
///
/// Row visibility logic matches RN's `BettingTrendsWidget` exactly — for the
/// ATS table we suppress rows where both teams have <3 ATS games in the
/// bucket (the RN `if (awayParsed.total < 3 && homeParsed.total < 3) return null`
/// guard). The O/U table renders all 5 situational buckets unconditionally,
/// same as RN.
struct BettingTrendsWidget: View {
    enum Sport: Hashable {
        case nba, ncaab
    }

    let awayAbbr: String
    let homeAbbr: String
    let awayTeam: SituationalTrendBucket
    let homeTeam: SituationalTrendBucket
    var isLoading: Bool = false
    let sport: Sport

    /// Convenience initializer that reads NBA rows.
    init(awayAbbr: String, homeAbbr: String, away: NBASituationalTrendRow, home: NBASituationalTrendRow, isLoading: Bool = false) {
        self.awayAbbr = awayAbbr
        self.homeAbbr = homeAbbr
        self.awayTeam = SituationalTrendBucket(nba: away)
        self.homeTeam = SituationalTrendBucket(nba: home)
        self.isLoading = isLoading
        self.sport = .nba
    }

    /// Convenience initializer that reads NCAAB rows.
    init(awayAbbr: String, homeAbbr: String, away: NCAABSituationalTrendRow, home: NCAABSituationalTrendRow, isLoading: Bool = false) {
        self.awayAbbr = awayAbbr
        self.homeAbbr = homeAbbr
        self.awayTeam = SituationalTrendBucket(ncaab: away)
        self.homeTeam = SituationalTrendBucket(ncaab: home)
        self.isLoading = isLoading
        self.sport = .ncaab
    }

    var body: some View {
        ZStack {
            if isLoading {
                loadingCard
            } else {
                loadedCard
            }
        }
    }

    // Title + card chrome now live in the hosting `WidgetSection`
    // ("Betting Trends") so this widget renders chromeless and pins cleanly
    // under its handed-off header (iOS Weather pattern).
    private var loadingCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            ProgressView()
                .controlSize(.small)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var loadedCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            // ATS Records
            sectionLabel("ATS Records")
            table(atsRows())

            // O/U Trends
            sectionLabel("O/U Trends")
                .padding(.top, 4)
            table(ouRows())
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func sectionLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 12, weight: .semibold))
            .tracking(0.5)
            .foregroundStyle(Color.appTextSecondary)
            .padding(.bottom, 6)
    }

    @ViewBuilder
    private func table(_ rows: [SituationRow]) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 0) {
                Text("Situation")
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .modifier(TableHeaderText())
                Text(awayAbbr)
                    .frame(maxWidth: .infinity)
                    .modifier(TableHeaderText())
                Text(homeAbbr)
                    .frame(maxWidth: .infinity)
                    .modifier(TableHeaderText())
            }
            .frame(maxWidth: .infinity)
            .padding(.bottom, 4)
            .overlay(
                Rectangle()
                    .fill(Color.white.opacity(0.1))
                    .frame(height: 1),
                alignment: .bottom
            )

            ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                row.body
            }
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.white.opacity(0.05))
        )
    }

    // MARK: - Row data

    /// Builds the ATS rows in the same order RN's `extractSituations` does
    /// (last_game, fav_dog, side_spread, rest_bucket, rest_comp). Filters
    /// out rows where neither team has at least 3 games — matches RN's
    /// `if (awayParsed.total < 3 && homeParsed.total < 3) return null`.
    private func atsRows() -> [SituationRow] {
        let buckets: [(label: String, ar: String?, ap: Double?, hr: String?, hp: Double?)] = [
            (formatSituation(awayTeam.lastGameSituation), awayTeam.atsLastGameRecord, awayTeam.atsLastGameCoverPct,
             homeTeam.atsLastGameRecord, homeTeam.atsLastGameCoverPct),
            (formatSituation(awayTeam.favDogSituation), awayTeam.atsFavDogRecord, awayTeam.atsFavDogCoverPct,
             homeTeam.atsFavDogRecord, homeTeam.atsFavDogCoverPct),
            (formatSituation(awayTeam.sideSpreadSituation), awayTeam.atsSideFavDogRecord, awayTeam.atsSideFavDogCoverPct,
             homeTeam.atsSideFavDogRecord, homeTeam.atsSideFavDogCoverPct),
            (formatSituation(awayTeam.restBucket), awayTeam.atsRestBucketRecord, awayTeam.atsRestBucketCoverPct,
             homeTeam.atsRestBucketRecord, homeTeam.atsRestBucketCoverPct),
            (formatSituation(awayTeam.restComp), awayTeam.atsRestCompRecord, awayTeam.atsRestCompCoverPct,
             homeTeam.atsRestCompRecord, homeTeam.atsRestCompCoverPct)
        ]
        return buckets.compactMap { b in
            let aw = parseRecord(b.ar)
            let hm = parseRecord(b.hr)
            // RN filter: skip if both teams have fewer than 3 games in this
            // bucket (insufficient sample size).
            if aw.total < 3 && hm.total < 3 { return nil }
            return SituationRow(kind: .ats, label: b.label,
                                awayRecord: b.ar, awayPct: b.ap,
                                homeRecord: b.hr, homePct: b.hp,
                                awayOverPct: nil, awayUnderPct: nil,
                                homeOverPct: nil, homeUnderPct: nil)
        }
    }

    /// O/U rows. RN renders all 5 buckets without filtering — replicate that.
    private func ouRows() -> [SituationRow] {
        let buckets: [(label: String, ao: Double?, au: Double?, ho: Double?, hu: Double?)] = [
            (formatSituation(awayTeam.lastGameSituation), awayTeam.ouLastGameOverPct, awayTeam.ouLastGameUnderPct,
             homeTeam.ouLastGameOverPct, homeTeam.ouLastGameUnderPct),
            (formatSituation(awayTeam.favDogSituation), awayTeam.ouFavDogOverPct, awayTeam.ouFavDogUnderPct,
             homeTeam.ouFavDogOverPct, homeTeam.ouFavDogUnderPct),
            (formatSituation(awayTeam.sideSpreadSituation), awayTeam.ouSideFavDogOverPct, awayTeam.ouSideFavDogUnderPct,
             homeTeam.ouSideFavDogOverPct, homeTeam.ouSideFavDogUnderPct),
            (formatSituation(awayTeam.restBucket), awayTeam.ouRestBucketOverPct, awayTeam.ouRestBucketUnderPct,
             homeTeam.ouRestBucketOverPct, homeTeam.ouRestBucketUnderPct),
            (formatSituation(awayTeam.restComp), awayTeam.ouRestCompOverPct, awayTeam.ouRestCompUnderPct,
             homeTeam.ouRestCompOverPct, homeTeam.ouRestCompUnderPct)
        ]
        return buckets.map { b in
            SituationRow(kind: .ou, label: b.label,
                         awayRecord: nil, awayPct: nil,
                         homeRecord: nil, homePct: nil,
                         awayOverPct: b.ao, awayUnderPct: b.au,
                         homeOverPct: b.ho, homeUnderPct: b.hu)
        }
    }

    private func formatSituation(_ value: String?) -> String {
        switch sport {
        case .nba: return formatNBASituation(value)
        case .ncaab: return formatNCAABSituation(value)
        }
    }

    private func parseRecord(_ raw: String?) -> (total: Int, wins: Int, losses: Int, pushes: Int) {
        switch sport {
        case .nba:
            let r = parseNBARecord(raw)
            return (r.total, r.wins, r.losses, r.pushes)
        case .ncaab:
            let r = parseNCAABRecord(raw)
            return (r.total, r.wins, r.losses, r.pushes)
        }
    }

}

private struct TableHeaderText: ViewModifier {
    func body(content: Content) -> some View {
        content
            .font(.system(size: 11, weight: .heavy))
            .foregroundStyle(Color.appTextSecondary)
            .multilineTextAlignment(.center)
    }
}

/// Combined situational bucket reading both NBA and NCAAB row shapes. The RN
/// widget treats the two as interchangeable via TypeScript union — we mirror
/// that with a single value type that wraps both.
struct SituationalTrendBucket: Hashable {
    let lastGameSituation: String?
    let favDogSituation: String?
    let sideSpreadSituation: String?
    let restBucket: String?
    let restComp: String?

    let atsLastGameRecord: String?
    let atsLastGameCoverPct: Double?
    let atsFavDogRecord: String?
    let atsFavDogCoverPct: Double?
    let atsSideFavDogRecord: String?
    let atsSideFavDogCoverPct: Double?
    let atsRestBucketRecord: String?
    let atsRestBucketCoverPct: Double?
    let atsRestCompRecord: String?
    let atsRestCompCoverPct: Double?

    let ouLastGameOverPct: Double?
    let ouLastGameUnderPct: Double?
    let ouFavDogOverPct: Double?
    let ouFavDogUnderPct: Double?
    let ouSideFavDogOverPct: Double?
    let ouSideFavDogUnderPct: Double?
    let ouRestBucketOverPct: Double?
    let ouRestBucketUnderPct: Double?
    let ouRestCompOverPct: Double?
    let ouRestCompUnderPct: Double?

    init(nba row: NBASituationalTrendRow) {
        self.lastGameSituation = row.lastGameSituation
        self.favDogSituation = row.favDogSituation
        self.sideSpreadSituation = row.sideSpreadSituation
        self.restBucket = row.restBucket
        self.restComp = row.restComp
        self.atsLastGameRecord = row.atsLastGameRecord
        self.atsLastGameCoverPct = row.atsLastGameCoverPct
        self.atsFavDogRecord = row.atsFavDogRecord
        self.atsFavDogCoverPct = row.atsFavDogCoverPct
        self.atsSideFavDogRecord = row.atsSideFavDogRecord
        self.atsSideFavDogCoverPct = row.atsSideFavDogCoverPct
        self.atsRestBucketRecord = row.atsRestBucketRecord
        self.atsRestBucketCoverPct = row.atsRestBucketCoverPct
        self.atsRestCompRecord = row.atsRestCompRecord
        self.atsRestCompCoverPct = row.atsRestCompCoverPct
        self.ouLastGameOverPct = row.ouLastGameOverPct
        self.ouLastGameUnderPct = row.ouLastGameUnderPct
        self.ouFavDogOverPct = row.ouFavDogOverPct
        self.ouFavDogUnderPct = row.ouFavDogUnderPct
        self.ouSideFavDogOverPct = row.ouSideFavDogOverPct
        self.ouSideFavDogUnderPct = row.ouSideFavDogUnderPct
        self.ouRestBucketOverPct = row.ouRestBucketOverPct
        self.ouRestBucketUnderPct = row.ouRestBucketUnderPct
        self.ouRestCompOverPct = row.ouRestCompOverPct
        self.ouRestCompUnderPct = row.ouRestCompUnderPct
    }

    init(ncaab row: NCAABSituationalTrendRow) {
        self.lastGameSituation = row.lastGameSituation
        self.favDogSituation = row.favDogSituation
        self.sideSpreadSituation = row.sideSpreadSituation
        self.restBucket = row.restBucket
        self.restComp = row.restComp
        self.atsLastGameRecord = row.atsLastGameRecord
        self.atsLastGameCoverPct = row.atsLastGameCoverPct
        self.atsFavDogRecord = row.atsFavDogRecord
        self.atsFavDogCoverPct = row.atsFavDogCoverPct
        self.atsSideFavDogRecord = row.atsSideFavDogRecord
        self.atsSideFavDogCoverPct = row.atsSideFavDogCoverPct
        self.atsRestBucketRecord = row.atsRestBucketRecord
        self.atsRestBucketCoverPct = row.atsRestBucketCoverPct
        self.atsRestCompRecord = row.atsRestCompRecord
        self.atsRestCompCoverPct = row.atsRestCompCoverPct
        self.ouLastGameOverPct = row.ouLastGameOverPct
        self.ouLastGameUnderPct = row.ouLastGameUnderPct
        self.ouFavDogOverPct = row.ouFavDogOverPct
        self.ouFavDogUnderPct = row.ouFavDogUnderPct
        self.ouSideFavDogOverPct = row.ouSideFavDogOverPct
        self.ouSideFavDogUnderPct = row.ouSideFavDogUnderPct
        self.ouRestBucketOverPct = row.ouRestBucketOverPct
        self.ouRestBucketUnderPct = row.ouRestBucketUnderPct
        self.ouRestCompOverPct = row.ouRestCompOverPct
        self.ouRestCompUnderPct = row.ouRestCompUnderPct
    }
}

/// A single situational row in either the ATS or O/U table.
private struct SituationRow {
    enum Kind { case ats, ou }

    let kind: Kind
    let label: String
    let awayRecord: String?
    let awayPct: Double?
    let homeRecord: String?
    let homePct: Double?
    let awayOverPct: Double?
    let awayUnderPct: Double?
    let homeOverPct: Double?
    let homeUnderPct: Double?

    @ViewBuilder
    var body: some View {
        HStack(spacing: 0) {
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)

            switch kind {
            case .ats:
                atsCell(record: awayRecord, pct: awayPct)
                    .frame(maxWidth: .infinity)
                atsCell(record: homeRecord, pct: homePct)
                    .frame(maxWidth: .infinity)
            case .ou:
                ouCell(overPct: awayOverPct, underPct: awayUnderPct)
                    .frame(maxWidth: .infinity)
                ouCell(overPct: homeOverPct, underPct: homeUnderPct)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 3)
    }

    @ViewBuilder
    private func atsCell(record: String?, pct: Double?) -> some View {
        VStack(spacing: 0) {
            Text(record?.isEmpty == false ? record! : "-")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(atsColor(pct))
            if let pct {
                Text("\(Int(pct.rounded()))%")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(atsColor(pct))
            }
        }
    }

    @ViewBuilder
    private func ouCell(overPct: Double?, underPct: Double?) -> some View {
        let info = ouLabel(overPct: overPct, underPct: underPct)
        Text(info.label)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(info.color)
    }

    private func atsColor(_ pct: Double?) -> Color {
        guard let pct else { return Color(hex: 0x9CA3AF) }
        if pct >= 55 { return Color(hex: 0x22C55E) }
        if pct >= 45 { return Color(hex: 0xEAB308) }
        return Color(hex: 0xEF4444)
    }

    private func ouLabel(overPct: Double?, underPct: Double?) -> (label: String, color: Color) {
        if overPct == nil && underPct == nil {
            return ("-", Color(hex: 0x9CA3AF))
        }
        let over = overPct ?? 0
        let under = underPct ?? 0
        if over > under {
            let color = over >= 55 ? Color(hex: 0x22C55E) : Color(hex: 0xEAB308)
            return ("O \(Int(over.rounded()))%", color)
        }
        let color = under >= 55 ? Color(hex: 0xEF4444) : Color(hex: 0xEAB308)
        return ("U \(Int(under.rounded()))%", color)
    }
}
