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

    /// Per-sport tool inventory. Accent colors mirror each tool's existing
    /// page accent so the banner and its destination read as one feature.
    static let registry: [GamesStore.Sport: [SportTool]] = [
        .nfl: [
            SportTool(
                id: "nfl-historical-trends", sport: .nfl,
                title: "NFL Historical Trends", subtitle: "See how any bet type has performed",
                actionWord: "Open",
                primaryColor: Color(hex: 0x3B82F6), secondaryColor: Color(hex: 0x93C5FD),
                symbols: ["chart.bar.fill", "chart.line.uptrend.xyaxis", "calendar", "football.fill", "percent", "arrow.up.arrow.down", "clock.fill", "chart.xyaxis.line", "bolt.fill", "star.fill"],
                seed: 0.41, speedFactor: 0.98, yJitter: -0.02,
                category: .nflHistoricalAnalysis
            ),
        ],
        .cfb: [
            SportTool(
                id: "cfb-historical-trends", sport: .cfb,
                title: "CFB Historical Trends", subtitle: "See how any bet type has performed",
                actionWord: "Open",
                primaryColor: Color(hex: 0xF59E0B), secondaryColor: Color(hex: 0xFCD34D),
                symbols: ["chart.bar.fill", "chart.line.uptrend.xyaxis", "calendar", "graduationcap.fill", "percent", "arrow.up.arrow.down", "clock.fill", "chart.xyaxis.line", "bolt.fill", "star.fill"],
                seed: 0.52, speedFactor: 1.0, yJitter: -0.02,
                category: .cfbHistoricalAnalysis
            ),
        ],
        .mlb: [
            SportTool(
                id: "mlb-historical-trends", sport: .mlb,
                title: "MLB Historical Trends", subtitle: "Situational hit rates, F5, matching games",
                actionWord: "Open",
                primaryColor: Color(hex: 0x3B82F6), secondaryColor: Color(hex: 0x4ADE80),
                symbols: ["chart.bar.fill", "chart.line.uptrend.xyaxis", "baseball.fill", "percent", "calendar", "arrow.up.arrow.down", "clock.fill", "chart.xyaxis.line", "bolt.fill", "star.fill"],
                seed: 0.48, speedFactor: 0.99, yJitter: -0.02,
                category: .mlbHistoricalAnalysis
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
        ],
        .nba: [
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

    /// Lookup by id. Lets other surfaces (the Search Explore rail) reuse a tool's
    /// exact banner styling — colors, symbols, drift seed — so a shortcut tile and
    /// the banner it shortcuts to animate identically instead of drifting apart.
    static func tool(id: String) -> SportTool? {
        registry.values.flatMap(\.self).first { $0.id == id }
    }
}
