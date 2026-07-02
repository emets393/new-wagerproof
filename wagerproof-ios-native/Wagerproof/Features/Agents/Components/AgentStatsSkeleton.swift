import SwiftUI
import WagerproofDesign

/// Loading placeholder for `AgentStatsView` — mirrors its layout (summary cards
/// row + control pills + a tall hero chart + two per-sport charts) so the swap
/// to real content doesn't jump. Uses the shared shimmer skeleton primitives.
struct AgentStatsSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                HStack(spacing: 12) {
                    summaryCard
                    summaryCard
                }
                HStack(spacing: 12) {
                    summaryCard
                    summaryCard
                }
                HStack(spacing: 8) {
                    ForEach(0..<3, id: \.self) { _ in
                        SkeletonCapsule(width: 74, height: 30)
                    }
                    Spacer()
                }
                chartCard(height: 220)
                SkeletonBlock(width: 140, height: 18)
                chartCard(height: 150)
                chartCard(height: 150)
            }
            .padding(16)
            .shimmering()
        }
        .background(Color.appSurface.ignoresSafeArea())
    }

    private var summaryCard: some View {
        VStack(spacing: 8) {
            SkeletonBlock(width: 60, height: 11)
            SkeletonBlock(width: 80, height: 24)
        }
        .frame(maxWidth: .infinity)
        .padding(16)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func chartCard(height: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SkeletonBlock(width: 160, height: 15)
            SkeletonBlock(height: height, cornerRadius: 12)
        }
        .padding(14)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}
