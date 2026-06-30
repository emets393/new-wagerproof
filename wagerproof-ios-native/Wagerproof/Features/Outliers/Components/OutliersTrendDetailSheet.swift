import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Bottom sheet that reveals a single Outliers trend card in full. Carousel
/// cards are a fixed-size compact preview (capped rows + "+N more" footer);
/// tapping one presents this sheet so the entire card — every betting line and
/// every trend row — appears here instead of growing the card vertically in the
/// rail. Shared by the Outliers tab carousels and the Search "Outliers" rail.
struct OutliersTrendDetailSheet: View {
    let card: OutliersTrendsCard
    var sport: OutliersTrendsSport = .nfl
    var game: OutliersTrendsGame?

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Same card the carousel renders, just unbounded.
                    OutliersTrendCard(card: card, sport: sport, game: game, displayMode: .expanded)
                    legend
                }
                .padding(20)
                .padding(.bottom, 28)
            }
            .scrollIndicators(.hidden)
            .background(Color.appSurface)
            .navigationTitle(card.betTypeLabel)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(Color.appTextSecondary)
                            .symbolRenderingMode(.hierarchical)
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    /// Mirrors `OutliersTrendCard.trendColor` thresholds so the dot colors on the
    /// rows are self-explanatory.
    private var legend: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("How to read this")
                .font(.system(size: 12, weight: .bold))
                .tracking(0.6)
                .foregroundStyle(Color.appTextSecondary)
            legendRow(color: Color.appWin, text: "Above 75% — strong, lopsided trend")
            legendRow(color: Color.appAccentAmber, text: "60–75% — a lean worth noting")
            legendRow(color: Color.appTextSecondary, text: "Below 60% — close to a coin flip")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.35), lineWidth: 0.5)
        )
    }

    private func legendRow(color: Color, text: String) -> some View {
        HStack(spacing: 8) {
            Circle().fill(color).frame(width: 8, height: 8)
            Text(text)
                .font(.system(size: 12))
                .foregroundStyle(Color.appTextSecondary)
        }
    }
}
