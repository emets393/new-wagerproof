import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Slim entry banner for NFL/CFB game pages — the only entry point per spec.
/// Uses `NavigationLink` so it works from any pushed game detail without a
/// parent-provided callback.
struct HistoricalTrendsEntryBanner: View {
    let sport: HistoricalAnalysisSport

    var body: some View {
        NavigationLink {
            HistoricalAnalysisView(sport: sport)
        } label: {
            HStack(spacing: 12) {
                Text("📊")
                    .font(.system(size: 20))
                VStack(alignment: .leading, spacing: 2) {
                    Text("Historical Trends")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text("See how any bet type has performed")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.appBorder.opacity(0.35), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .padding(.bottom, 6)
    }
}

#Preview {
    NavigationStack {
        HistoricalTrendsEntryBanner(sport: .nfl)
    }
    .background(Color.appSurface)
}
