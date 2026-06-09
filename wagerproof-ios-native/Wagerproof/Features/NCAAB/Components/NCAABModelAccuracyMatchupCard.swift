import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Data-rich accuracy card used in the NCAAB Model Accuracy list screen.
/// Mirrors `wagerproof-mobile/components/ncaab/ModelAccuracyMatchupCard.tsx`.
/// Identical structure to the NBA variant — same Spread/ML/O/U layout,
/// same accuracy color thresholds — but typed for the NCAAB payload which
/// uses an `NCAABAccuracyBucket` instead of the NBA one, plus already-bucketed
/// `mlPickProbRounded`.
struct NCAABModelAccuracyMatchupCardView: View {
    let game: NCAABModelAccuracyGame

    var body: some View {
        VStack(spacing: 0) {
            LinearGradient(
                colors: [
                    TeamColorPair.neutralNCAAB.primary,
                    TeamColorPair.neutralNCAAB.secondary,
                    TeamColorPair.neutralNCAAB.primary.opacity(0.85),
                    TeamColorPair.neutralNCAAB.secondary.opacity(0.85)
                ],
                startPoint: .leading,
                endPoint: .trailing
            )
            .frame(height: 4)

            VStack(spacing: 6) {
                header
                pickBlock(label: "Spread", pickValue: spreadPickText, edgeValue: spreadEdgeText, accuracy: game.spreadAccuracy)
                pickBlock(label: "ML Win Prob", pickValue: mlPickText, edgeValue: nil, accuracy: game.mlAccuracy)
                pickBlock(label: "Over/Under", pickValue: ouPickText, edgeValue: ouEdgeText, accuracy: game.ouAccuracy)
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 14)
        }
        .background(.ultraThinMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5)
        )
        .shadow(color: .black.opacity(0.06), radius: 4, x: 0, y: 2)
    }

    @ViewBuilder
    private var header: some View {
        HStack(spacing: 8) {
            HStack(spacing: 6) {
                GameCardTeamAvatar(teamName: game.awayTeam, sport: "ncaab", size: 32)
                Text(game.awayAbbr)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Text("@")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary.opacity(0.6))
                    .padding(.horizontal, 4)
                GameCardTeamAvatar(teamName: game.homeTeam, sport: "ncaab", size: 32)
                Text(game.homeAbbr)
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            Spacer()
            Text(formatTipoff(time: game.tipoffTime, date: game.gameDate))
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(.bottom, 4)
    }

    @ViewBuilder
    private func pickBlock(label: String, pickValue: String, edgeValue: String?, accuracy: NCAABAccuracyBucket?) -> some View {
        VStack(spacing: 4) {
            HStack {
                Text(label)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                Spacer()
                HStack(spacing: 2) {
                    Text(pickValue)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                    if let edgeValue {
                        Text(" (edge \(edgeValue))")
                            .font(.system(size: 11))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }
            }
            HStack {
                Text("Accuracy")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                Spacer()
                accuracyText(accuracy)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.appSurfaceMuted.opacity(0.5))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color.appBorder.opacity(0.5), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func accuracyText(_ acc: NCAABAccuracyBucket?) -> some View {
        if let acc {
            HStack(spacing: 2) {
                Text(String(format: "%.1f%%", acc.accuracyPct))
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(accuracyColor(acc.accuracyPct))
                Text(" (n=\(acc.games))")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.appTextSecondary)
            }
        } else {
            Text("—")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        }
    }

    private var spreadPickText: String {
        guard let homeSpread = game.homeSpread else { return "—" }
        let homePredictedToCover = (game.homeSpreadDiff ?? 0) > 0
        let abbr = homePredictedToCover ? game.homeAbbr : game.awayAbbr
        let line = homePredictedToCover ? homeSpread : -homeSpread
        return "\(abbr) \(GameCardFormatting.formatSpread(line))"
    }

    private var spreadEdgeText: String? {
        guard let diff = game.homeSpreadDiff else { return nil }
        return "+\(GameCardFormatting.roundToNearestHalf(abs(diff)))"
    }

    private var mlPickText: String {
        guard let prob = game.mlPickProbRounded else { return "—" }
        let abbr = (game.mlPickIsHome ?? false) ? game.homeAbbr : game.awayAbbr
        return "\(abbr) \(Int((prob * 100).rounded()))%"
    }

    private var ouPickText: String {
        guard let diff = game.overLineDiff, let line = game.overLine else { return "—" }
        let direction = diff > 0 ? "Over" : "Under"
        return "\(direction) \(GameCardFormatting.formatSpread(line).trimmingCharacters(in: CharacterSet(charactersIn: "+")))"
    }

    private var ouEdgeText: String? {
        guard let diff = game.overLineDiff else { return nil }
        return "+\(GameCardFormatting.roundToNearestHalf(abs(diff)))"
    }

    private func accuracyColor(_ pct: Double) -> Color {
        if pct >= 60 { return Color(hex: 0x00C853) }
        if pct >= 50 { return Color(hex: 0xFFD600) }
        return Color(hex: 0xFF5252)
    }

    private func formatTipoff(time: String?, date: String) -> String {
        if let time, !time.isEmpty {
            return GameCardFormatting.convertTimeToEST(time)
        }
        return GameCardFormatting.formatCompactDate(date)
    }
}
