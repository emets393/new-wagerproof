import SwiftUI
import WagerproofModels
import WagerproofDesign

/// Head-to-Head widget body — the native `VsTeamCluster`: career record for
/// this market against this week's opponent. Gated exactly like the web
/// (2+ meetings, 2+ graded lines) with matching empty-state copy.
struct NFLHeadToHeadBlock: View {
    let matchup: NFLPropTrendMatchup?
    let marketKey: String
    let marketLabel: String
    let opponent: String

    var body: some View {
        if let matchup, matchup.meetings >= 2 {
            if let record = matchup.byMarket[marketKey], record.n >= 2 {
                recordView(record, meetings: matchup.meetings)
            } else {
                emptyState(
                    title: "No \(marketLabel.lowercased()) sample",
                    body: "Not enough graded lines vs \(opponent)."
                )
            }
        } else {
            emptyState(
                title: "No H2H sample yet",
                body: "Needs 2+ career meetings vs \(opponent)."
            )
        }
    }

    private func recordView(_ record: NFLPropHitRate, meetings: Int) -> some View {
        let verb = NFLPropVerdicts.isTdVerbMarket(marketKey) ? "scored" : "over"
        return VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 0) {
                Text("\(record.h)")
                    .font(.system(size: 30, weight: .black, design: .monospaced))
                    .foregroundStyle(Color.appTextPrimary)
                Text("/\(record.n)")
                    .font(.system(size: 30, weight: .black, design: .monospaced))
                    .foregroundStyle(Color.appTextMuted)
            }
            Text("\(verb) vs \(opponent)\(record.pct.map { " · \(Int(($0 * 100).rounded()))%" } ?? "")")
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextSecondary)
            Text("\(meetings) career meetings")
                .font(.system(size: 11))
                .foregroundStyle(Color.appTextMuted)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func emptyState(title: String, body: String) -> some View {
        VStack(spacing: 3) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
            Text(body)
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, minHeight: 72)
        .padding(.horizontal, 12)
        .background(Color.appSurfaceMuted.opacity(0.3), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.appBorder.opacity(0.5), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
        )
    }
}
