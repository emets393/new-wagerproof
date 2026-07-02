import Foundation
import WagerproofModels

/// Fetches the top Outliers alerts (value + fade, ranked by confidence) and
/// writes them into the shared App Group payload consumed by the "Top
/// Outliers" Home Screen widget. Mirrors `TopAgentsWidgetService`'s
/// read-modify-write shape — the App Group blob is one JSON document shared
/// across domains, so this reads the existing payload, replaces only the
/// `topOutliers` field, and writes the whole thing back.
///
/// Reuses `OutliersService`'s existing, already-correct fetch pipeline
/// (`fetchWeekGames` → `fetchValueAlerts`/`fetchFadeAlerts`) rather than
/// re-implementing it — that pipeline runs several Supabase queries per sport
/// plus prediction hydration, which is too expensive to run inside the
/// widget-extension process itself. This service is only ever meant to be
/// called from the main app; the extension's `TimelineProvider` just reads
/// the cached payload.
public enum OutliersWidgetService {
    private static let maxWidgetAlerts = 6

    @discardableResult
    public static func sync() async -> [OutlierAlertForWidget] {
        guard let games = try? await OutliersService.shared.fetchWeekGames(), !games.isEmpty else {
            return []
        }

        async let valuesTask = OutliersService.shared.fetchValueAlerts(weekGames: games)
        async let fadesTask = OutliersService.shared.fetchFadeAlerts(weekGames: games)
        let (values, fades) = await (valuesTask, fadesTask)

        let top = (values.map(Self.toWidget) + fades.map(Self.toWidget))
            .sorted { $0.confidence > $1.confidence }
            .prefix(maxWidgetAlerts)

        var existing = TopAgentsWidgetService.readPayload() ?? WidgetDataPayload.empty()
        existing.topOutliers = Array(top)
        existing.lastUpdated = Self.nowISO()
        try? TopAgentsWidgetService.writePayload(existing)
        return Array(top)
    }

    // MARK: - Mapping

    private static func toWidget(_ alert: OutlierValueAlert) -> OutlierAlertForWidget {
        OutlierAlertForWidget(
            id: "value-\(alert.id)",
            kind: .value,
            sport: alert.sport.rawValue,
            awayTeam: alert.awayTeam,
            homeTeam: alert.homeTeam,
            marketType: alert.marketType.rawValue,
            side: alert.side,
            confidence: Int(alert.percentage.rounded()),
            gameTime: alert.game.gameTime
        )
    }

    private static func toWidget(_ alert: OutlierFadeAlert) -> OutlierAlertForWidget {
        OutlierAlertForWidget(
            id: "fade-\(alert.id)",
            kind: .fade,
            sport: alert.sport.rawValue,
            awayTeam: alert.awayTeam,
            homeTeam: alert.homeTeam,
            marketType: alert.pickType.rawValue,
            // Raw model-favored side — the widget view computes the
            // "fade to the opposite side" recommendation from this + kind,
            // same split RN's `FadeAlertWidgetData.fadeRecommendation` used.
            side: alert.predictedTeam,
            confidence: alert.confidence,
            gameTime: alert.game.gameTime
        )
    }

    private static func nowISO() -> String {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.string(from: Date())
    }
}
