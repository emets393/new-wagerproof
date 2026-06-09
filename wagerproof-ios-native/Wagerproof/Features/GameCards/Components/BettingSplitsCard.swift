import SwiftUI
import WagerproofDesign

/// Public betting splits visualization used by NFL/CFB game bottom sheets.
/// Mirrors RN `BettingSplitsCard.tsx` + the `PublicBettingBars` component:
/// a stacked group of horizontal bars showing the percentage of bets +
/// percentage of money on each side of each line (ML / Spread / Total).
///
/// All percentage strings are decimal stringified by the backend
/// (e.g. `"0.61"` = 61%). We parse to Double and clamp 0...1.
struct BettingSplitsCard: View {
    let homeTeam: String
    let awayTeam: String

    let homeMlBets: String?
    let awayMlBets: String?
    let homeMlHandle: String?
    let awayMlHandle: String?
    let mlSplitsLabel: String?

    let homeSpreadBets: String?
    let awaySpreadBets: String?
    let homeSpreadHandle: String?
    let awaySpreadHandle: String?
    let spreadSplitsLabel: String?

    let overBets: String?
    let underBets: String?
    let overHandle: String?
    let underHandle: String?
    let totalSplitsLabel: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 8) {
                Image(systemName: "person.3.fill")
                    .foregroundStyle(Color.appAccentPurple)
                Text("Public Betting")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            // Moneyline
            if hasML {
                splitRow(
                    title: "Moneyline",
                    awayLabel: awayTeam,
                    homeLabel: homeTeam,
                    awayBets: parsePercent(awayMlBets),
                    homeBets: parsePercent(homeMlBets),
                    awayHandle: parsePercent(awayMlHandle),
                    homeHandle: parsePercent(homeMlHandle),
                    splitLabel: mlSplitsLabel
                )
            }
            // Spread
            if hasSpread {
                splitRow(
                    title: "Spread",
                    awayLabel: awayTeam,
                    homeLabel: homeTeam,
                    awayBets: parsePercent(awaySpreadBets),
                    homeBets: parsePercent(homeSpreadBets),
                    awayHandle: parsePercent(awaySpreadHandle),
                    homeHandle: parsePercent(homeSpreadHandle),
                    splitLabel: spreadSplitsLabel
                )
            }
            // Total
            if hasTotal {
                splitRow(
                    title: "Total",
                    awayLabel: "Over",
                    homeLabel: "Under",
                    awayBets: parsePercent(overBets),
                    homeBets: parsePercent(underBets),
                    awayHandle: parsePercent(overHandle),
                    homeHandle: parsePercent(underHandle),
                    splitLabel: totalSplitsLabel
                )
            }
        }
    }

    private var hasML: Bool {
        anyNonNil(homeMlBets, awayMlBets, homeMlHandle, awayMlHandle) || mlSplitsLabel != nil
    }

    private var hasSpread: Bool {
        anyNonNil(homeSpreadBets, awaySpreadBets, homeSpreadHandle, awaySpreadHandle) || spreadSplitsLabel != nil
    }

    private var hasTotal: Bool {
        anyNonNil(overBets, underBets, overHandle, underHandle) || totalSplitsLabel != nil
    }

    private func anyNonNil(_ values: String?...) -> Bool {
        values.contains { $0 != nil }
    }

    @ViewBuilder
    private func splitRow(
        title: String,
        awayLabel: String,
        homeLabel: String,
        awayBets: Double?,
        homeBets: Double?,
        awayHandle: Double?,
        homeHandle: Double?,
        splitLabel: String?
    ) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                Spacer()
                if let label = splitLabel {
                    Text(label.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .tracking(0.5)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(Color.appAccentAmber.opacity(0.15), in: Capsule())
                        .foregroundStyle(Color.appAccentAmber)
                }
            }
            // Bets row
            if awayBets != nil || homeBets != nil {
                splitBar(
                    leftLabel: "\(awayLabel) Bets",
                    leftPct: awayBets,
                    rightLabel: "\(homeLabel) Bets",
                    rightPct: homeBets,
                    leftColor: Color.appAccentBlue,
                    rightColor: Color.appPrimary
                )
            }
            // Handle row
            if awayHandle != nil || homeHandle != nil {
                splitBar(
                    leftLabel: "\(awayLabel) $",
                    leftPct: awayHandle,
                    rightLabel: "\(homeLabel) $",
                    rightPct: homeHandle,
                    leftColor: Color.appAccentBlue.opacity(0.6),
                    rightColor: Color.appPrimary.opacity(0.6)
                )
            }
        }
    }

    @ViewBuilder
    private func splitBar(
        leftLabel: String,
        leftPct: Double?,
        rightLabel: String,
        rightPct: Double?,
        leftColor: Color,
        rightColor: Color
    ) -> some View {
        let left = leftPct ?? 0
        let right = rightPct ?? max(0, 1 - left)

        VStack(spacing: 4) {
            HStack {
                Text(leftLabel)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                Spacer()
                Text(rightLabel)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
            }
            GeometryReader { proxy in
                HStack(spacing: 0) {
                    Rectangle()
                        .fill(leftColor)
                        .frame(width: proxy.size.width * left)
                    Rectangle()
                        .fill(rightColor)
                        .frame(width: proxy.size.width * right)
                }
                .clipShape(Capsule())
            }
            .frame(height: 10)
            HStack {
                Text(formatPercent(leftPct))
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(leftColor)
                Spacer()
                Text(formatPercent(rightPct))
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(rightColor)
            }
        }
    }

    private func parsePercent(_ raw: String?) -> Double? {
        guard let raw, let val = Double(raw) else { return nil }
        if val < 0 { return 0 }
        if val > 1 { return min(1, val / 100) }
        return val
    }

    private func formatPercent(_ value: Double?) -> String {
        guard let v = value else { return "—" }
        return "\(Int((v * 100).rounded()))%"
    }
}
