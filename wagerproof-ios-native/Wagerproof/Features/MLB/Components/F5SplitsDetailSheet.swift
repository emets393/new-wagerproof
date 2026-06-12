import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Full First-5 breakdown — the expand target of `F5SplitsInsightWidget`.
/// Presentation-agnostic: works as a `.sheet` from the MLB game sheet AND as a
/// pushed destination from Search. Body: matchup header → the full 11-row
/// `F5GameCardView` → a "What these mean" metric glossary (`F5MetricHelp`) →
/// the how-to-use copy ported from the retired `MLBF5SplitsView` explainer.
struct F5SplitsDetailSheet: View {
    let matchup: MLBF5Matchup

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                F5GameCardView(game: matchup.game, awaySplit: matchup.awaySplit, homeSplit: matchup.homeSplit)
                glossary
                howToUse
                Spacer().frame(height: 24)
            }
            .padding(.horizontal, 16)
            .padding(.top, 20)
        }
        .background(Color.appSurface)
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("\(matchup.game.awayAbbr) @ \(matchup.game.homeAbbr) · First-5 Splits")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
            Text("\(MLBFormatting.dateLabel(matchup.game.officialDate)) · \(MLBFormatting.gameTime(matchup.game.gameTimeEt))")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextSecondary)
        }
    }

    /// Glossary order mirrors the card's row order top-to-bottom.
    private static let glossaryOrder = [
        "starting_pitcher", "opposing_starter", "location",
        "split_record", "ou_record", "split_runs_scored", "season_runs_scored",
        "scoring_delta", "runs_allowed", "season_runs_allowed", "allowed_delta",
    ]

    private var glossary: some View {
        let shape = RoundedRectangle(cornerRadius: 20, style: .continuous)
        return VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "text.book.closed")
                    .foregroundStyle(Color(hex: 0x0EA5E9))
                Text("What these mean")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            ForEach(Self.glossaryOrder, id: \.self) { key in
                if let help = F5MetricHelp.all[key] {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(help.title)
                            .font(.system(size: 13, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                        Text(help.body)
                            .font(.system(size: 12))
                            .lineSpacing(3)
                            .foregroundStyle(Color.appTextSecondary)
                    }
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(shape.fill(.ultraThinMaterial))
        .clipShape(shape)
        .overlay(shape.strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5))
    }

    /// How-to-use copy ported from the retired MLBF5SplitsView explainer banner.
    private var howToUse: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "info.circle.fill")
                .font(.system(size: 16))
                .foregroundStyle(Color.appAccentBlue)
            Text("The away team is judged by its away games vs tonight's opposing starter hand, and the home team by its home games vs tonight's opposing starter hand. Small samples show real data with caution — LHP splits can be thin early in the season.")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.appTextPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appAccentBlue.opacity(0.10), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.appAccentBlue.opacity(0.4), lineWidth: 1)
        )
    }
}
