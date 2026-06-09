import SwiftUI
import WagerproofStores

/// A per-sport analytics "tool" surfaced as a HoneydewOptionCard banner on the
/// Games page (and routed to the same leaf view as the Outliers hub). Modeled
/// on the Settings membership/Discord cards — the registry below is the single
/// source of truth for which tools appear under each sport, ported from the RN
/// Games-screen tool banners.
///
/// `Hashable`/`Equatable` on `id` only (SwiftUI `Color` isn't Hashable), so a
/// `SportTool` can drive `navigationDestination(item:)`.
struct SportTool: Identifiable, Hashable {
    let id: String
    let sport: GamesStore.Sport
    let title: String
    let subtitle: String
    let actionWord: String
    let primaryColor: Color
    let secondaryColor: Color
    let symbols: [String]
    let seed: Double
    let speedFactor: Double
    let yJitter: CGFloat
    /// The tool's leaf page, shared with the Outliers hub via `ToolRouter`.
    let category: OutliersStore.Category

    static func == (lhs: SportTool, rhs: SportTool) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    /// Per-sport tool inventory. NFL/CFB have no tools (RN parity), so they
    /// return `nil` → no banners. Accent colors mirror each tool's existing
    /// page accent so the banner and its destination read as one feature.
    static let registry: [GamesStore.Sport: [SportTool]] = [
        .mlb: [
            SportTool(
                id: "mlb-betting-trends", sport: .mlb,
                title: "MLB Betting Trends", subtitle: "Situational win % & O/U patterns",
                actionWord: "Open",
                primaryColor: Color(hex: 0x002D72), secondaryColor: Color(hex: 0x3B6BB8),
                symbols: ["baseball.fill", "chart.line.uptrend.xyaxis", "chart.bar.fill", "percent", "flame.fill", "calendar", "bed.double.fill", "figure.baseball", "arrow.up.right", "trophy.fill"],
                seed: 0.21, speedFactor: 1.0, yJitter: 0.02,
                category: .mlbTrends
            ),
            SportTool(
                id: "mlb-regression-report", sport: .mlb,
                title: "MLB Regression Report", subtitle: "AI narrative + suggested picks",
                actionWord: "Open",
                primaryColor: Color(hex: 0xA855F7), secondaryColor: Color(hex: 0xC9A0FB),
                symbols: ["chart.bar.xaxis", "function", "waveform.path.ecg", "brain.head.profile", "sparkles", "chart.xyaxis.line", "arrow.triangle.2.circlepath", "bolt.fill", "flame.fill", "star.fill"],
                seed: 0.37, speedFactor: 0.96, yJitter: -0.03,
                category: .mlbRegression
            ),
            SportTool(
                id: "mlb-pitcher-matchups", sport: .mlb,
                title: "Player Prop Matchups", subtitle: "Lines · L10 hit rates · splits",
                actionWord: "Open",
                primaryColor: Color(hex: 0x14B8A6), secondaryColor: Color(hex: 0x5FD6C9),
                symbols: ["figure.baseball", "baseball.fill", "person.2.fill", "chart.line.uptrend.xyaxis", "scope", "list.number", "flame.fill", "bolt.fill", "percent", "star.fill"],
                seed: 0.52, speedFactor: 1.04, yJitter: 0.03,
                category: .mlbPitcherMatchups
            ),
            SportTool(
                id: "mlb-f5-splits", sport: .mlb,
                title: "MLB F5 Splits", subtitle: "Home/away offense vs starter hand",
                actionWord: "Open",
                primaryColor: Color(hex: 0xF97316), secondaryColor: Color(hex: 0xFBA864),
                symbols: ["5.circle.fill", "baseball.diamond.bases", "figure.baseball", "chart.bar.fill", "arrow.left.arrow.right", "flame.fill", "percent", "calendar", "shield.lefthalf.filled", "bolt.fill"],
                seed: 0.68, speedFactor: 0.98, yJitter: -0.02,
                category: .mlbF5Splits
            ),
        ],
        .nba: [
            SportTool(
                id: "nba-betting-trends", sport: .nba,
                title: "NBA Betting Trends", subtitle: "Situational ATS & O/U trends",
                actionWord: "Open",
                primaryColor: Color(hex: 0x0EA5E9), secondaryColor: Color(hex: 0x67C9F2),
                symbols: ["basketball.fill", "chart.line.uptrend.xyaxis", "chart.bar.fill", "percent", "flame.fill", "calendar", "bed.double.fill", "figure.basketball", "arrow.up.right", "trophy.fill"],
                seed: 0.18, speedFactor: 1.0, yJitter: 0.02,
                category: .nbaTrends
            ),
            SportTool(
                id: "nba-model-accuracy", sport: .nba,
                title: "NBA Model Accuracy", subtitle: "Track record on today's slate",
                actionWord: "Open",
                primaryColor: Color(hex: 0x14B8A6), secondaryColor: Color(hex: 0x5FD6C9),
                symbols: ["target", "scope", "checkmark.seal.fill", "chart.bar.fill", "percent", "basketball.fill", "gauge.high", "chart.xyaxis.line", "bolt.fill", "star.fill"],
                seed: 0.44, speedFactor: 1.02, yJitter: -0.03,
                category: .nbaAccuracy
            ),
        ],
        .ncaab: [
            SportTool(
                id: "ncaab-betting-trends", sport: .ncaab,
                title: "NCAAB Betting Trends", subtitle: "Situational trends across the slate",
                actionWord: "Open",
                primaryColor: Color(hex: 0x6366F1), secondaryColor: Color(hex: 0x9BA0F7),
                symbols: ["basketball.fill", "chart.line.uptrend.xyaxis", "chart.bar.fill", "percent", "flame.fill", "calendar", "graduationcap.fill", "figure.basketball", "arrow.up.right", "trophy.fill"],
                seed: 0.27, speedFactor: 0.98, yJitter: 0.02,
                category: .ncaabTrends
            ),
            SportTool(
                id: "ncaab-model-accuracy", sport: .ncaab,
                title: "NCAAB Model Accuracy", subtitle: "The model's college track record",
                actionWord: "Open",
                primaryColor: Color(hex: 0xF97316), secondaryColor: Color(hex: 0xFBA864),
                symbols: ["target", "scope", "checkmark.seal.fill", "chart.bar.fill", "percent", "graduationcap.fill", "gauge.high", "chart.xyaxis.line", "bolt.fill", "star.fill"],
                seed: 0.59, speedFactor: 1.03, yJitter: -0.02,
                category: .ncaabAccuracy
            ),
        ],
    ]

    /// Tools for a sport (empty for sports without tools).
    static func tools(for sport: GamesStore.Sport) -> [SportTool] {
        registry[sport] ?? []
    }
}
