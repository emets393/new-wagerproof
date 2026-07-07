import Foundation

/// Translates UI filter state into warehouse RPC `p_filters` JSON.
/// Logic ported from `src/pages/NFLAnalytics.tsx` and `CFBAnalytics.tsx`.
public enum HistoricalAnalysisFilterBuilder {
    private struct SpreadCfg {
        let max: Double
        let mk: String
        let xk: String
        let amk: String
        let axk: String
    }

    private struct TotalCfg {
        let min: Double
        let max: Double
        let mk: String
        let xk: String
        let label: String
    }

    private static let nflSpreadCfg: [String: SpreadCfg] = [
        "fg_spread": SpreadCfg(max: 20, mk: "spread_min", xk: "spread_max", amk: "abs_spread_min", axk: "abs_spread_max"),
        "h1_spread": SpreadCfg(max: 14, mk: "h1_spread_min", xk: "h1_spread_max", amk: "h1_abs_spread_min", axk: "h1_abs_spread_max"),
    ]

    private static let cfbSpreadCfg: [String: SpreadCfg] = [
        "fg_spread": SpreadCfg(max: 28, mk: "spread_min", xk: "spread_max", amk: "abs_spread_min", axk: "abs_spread_max"),
        "h1_spread": SpreadCfg(max: 18, mk: "h1_spread_min", xk: "h1_spread_max", amk: "h1_abs_spread_min", axk: "h1_abs_spread_max"),
    ]

    private static let nflTotalCfg: [String: TotalCfg] = [
        "fg_total": TotalCfg(min: 30, max: 60, mk: "total_min", xk: "total_max", label: "Game total"),
        "h1_total": TotalCfg(min: 15, max: 35, mk: "h1_total_min", xk: "h1_total_max", label: "1H total"),
        "team_total": TotalCfg(min: 10, max: 40, mk: "tt_min", xk: "tt_max", label: "Team total line"),
    ]

    private static let cfbTotalCfg: [String: TotalCfg] = [
        "fg_total": TotalCfg(min: 30, max: 80, mk: "total_min", xk: "total_max", label: "Game total"),
        "h1_total": TotalCfg(min: 15, max: 45, mk: "h1_total_min", xk: "h1_total_max", label: "1H total"),
        "team_total": TotalCfg(min: 10, max: 55, mk: "tt_min", xk: "tt_max", label: "Team total line"),
    ]

    public struct SpreadConfig: Sendable {
        public let max: Double
    }

    public struct TotalConfig: Sendable {
        public let min: Double
        public let max: Double
        public let label: String
    }

    public static func spreadConfig(sport: HistoricalAnalysisSport, betType: String) -> SpreadConfig? {
        let cfg = sport == .nfl ? nflSpreadCfg : cfbSpreadCfg
        guard let spread = cfg[betType] else { return nil }
        return SpreadConfig(max: spread.max)
    }

    public static func totalConfig(sport: HistoricalAnalysisSport, betType: String) -> TotalConfig? {
        let cfg = sport == .nfl ? nflTotalCfg : cfbTotalCfg
        guard let total = cfg[betType] else { return nil }
        return TotalConfig(min: total.min, max: total.max, label: total.label)
    }

    public static func seasonFloor(betType: String, sport: HistoricalAnalysisSport) -> Int {
        if HistoricalAnalysisBetType.limitedHistory.contains(betType) { return 2023 }
        return sport.defaultSeasonFloor
    }

    public static func buildRPCFilters(
        sport: HistoricalAnalysisSport,
        snapshot: HistoricalAnalysisUISnapshot,
        conferenceTeamMap: [String: [String]] = [:]
    ) -> [String: JSONValue] {
        var f: [String: JSONValue] = [:]
        let betType = snapshot.betType
        let seasonFloor = seasonFloor(betType: betType, sport: sport)
        let spreadCfg = sport == .nfl ? nflSpreadCfg : cfbSpreadCfg
        let totalCfg = sport == .nfl ? nflTotalCfg : cfbTotalCfg

        if snapshot.seasonMin > seasonFloor { f["season_min"] = .int(snapshot.seasonMin) }
        if snapshot.seasonMax < HistoricalAnalysisSport.seasonMax { f["season_max"] = .int(snapshot.seasonMax) }

        switch sport {
        case .nfl:
            if snapshot.seasonType == "regular" {
                f["season_type"] = .string("regular")
                if snapshot.weekMin > 1 { f["week_min"] = .int(snapshot.weekMin) }
                if snapshot.weekMax < 18 { f["week_max"] = .int(snapshot.weekMax) }
            } else if snapshot.seasonType == "postseason" {
                f["season_type"] = .string("postseason")
                if snapshot.playoffRound != "any" { f["playoff_round"] = .string(snapshot.playoffRound) }
            }
        case .cfb:
            if snapshot.gameType != "any" { f["game_type"] = .string(snapshot.gameType) }
            if snapshot.rankedMatchup != "any" { f["ranked_matchup"] = .string(snapshot.rankedMatchup) }
            if snapshot.gameType == "regular" {
                if snapshot.weekMin > 1 { f["week_min"] = .int(snapshot.weekMin) }
                if snapshot.weekMax < 16 { f["week_max"] = .int(snapshot.weekMax) }
            }
        }

        if snapshot.side != "any" { f["side"] = .string(snapshot.side) }

        if let scfg = spreadCfg[betType] {
            let lo = snapshot.spreadMin
            let hi = snapshot.spreadMax
            // Floor near-zero edge to 0.5 — excludes pick'em games that would
            // pollute the underdog bucket (see spec + web comments).
            let loD = max(lo, 0.5)
            if snapshot.spreadSide == "favorite" {
                f[scfg.mk] = .double(-hi)
                f[scfg.xk] = .double(-loD)
            } else if snapshot.spreadSide == "underdog" {
                f[scfg.mk] = .double(loD)
                f[scfg.xk] = .double(hi)
            } else if lo > 0 || hi < scfg.max {
                f[scfg.amk] = .double(lo)
                f[scfg.axk] = .double(hi)
            }
        }

        if snapshot.favDog != "any",
           HistoricalAnalysisBetType.moneylineMarkets.contains(betType) || betType == "team_total" {
            f["fav_dog"] = .string(snapshot.favDog)
        }

        var mlA = snapshot.mlMin.trimmingCharacters(in: .whitespaces).isEmpty
            ? nil : Double(snapshot.mlMin)
        var mlB = snapshot.mlMax.trimmingCharacters(in: .whitespaces).isEmpty
            ? nil : Double(snapshot.mlMax)
        if let a = mlA, let b = mlB, a > b { swap(&mlA, &mlB) }
        if let a = mlA { f["ml_min"] = .double(a) }
        if let b = mlB { f["ml_max"] = .double(b) }

        if let tcfg = totalCfg[betType] {
            if snapshot.lineMin > tcfg.min { f[tcfg.mk] = .double(snapshot.lineMin) }
            if snapshot.lineMax < tcfg.max { f[tcfg.xk] = .double(snapshot.lineMax) }
        }

        if let primetime = snapshot.primetime { f["primetime"] = .bool(primetime) }

        switch sport {
        case .nfl:
            if let division = snapshot.division { f["division"] = .bool(division) }
            if snapshot.dome != "any" { f["dome"] = .bool(snapshot.dome == "dome") }
            if snapshot.precip != "any" { f["precip"] = .string(snapshot.precip) }
            if snapshot.tempMin > -10 { f["temp_min"] = .int(snapshot.tempMin) }
            if snapshot.tempMax < 100 { f["temp_max"] = .int(snapshot.tempMax) }
            if snapshot.windMax < 60 { f["wind_max"] = .int(snapshot.windMax) }
            switch snapshot.restBye {
            case "off_bye": f["rest_min"] = .int(13)
            case "short": f["rest_max"] = .int(4)
            case "pre_bye": f["pre_bye"] = .bool(true)
            default: break
            }
            if snapshot.coach != "any" { f["coach"] = .string(snapshot.coach) }
            if snapshot.referee != "any" { f["referee"] = .string(snapshot.referee) }
        case .cfb:
            if let conferenceGame = snapshot.conferenceGame { f["conference_game"] = .bool(conferenceGame) }
            if let neutralSite = snapshot.neutralSite { f["neutral_site"] = .bool(neutralSite) }
            let picked = snapshot.selectedConferences.filter { !$0.isEmpty }
            if picked.count == 1 {
                f["conference"] = .string(picked[0])
            } else if picked.count > 1 {
                let teams = Array(Set(picked.flatMap { conferenceTeamMap[$0] ?? [] })).sorted()
                if !teams.isEmpty {
                    f["team"] = .array(teams.map { .string($0) })
                }
            } else if snapshot.conference != "any" {
                f["conference"] = .string(snapshot.conference)
            }
            if snapshot.tempMin > -10 { f["temp_min"] = .int(snapshot.tempMin) }
            if snapshot.tempMax < 110 { f["temp_max"] = .int(snapshot.tempMax) }
            if snapshot.windMax < 60 { f["wind_max"] = .int(snapshot.windMax) }
        }

        return f
    }

    /// Hide degenerate breakdown bars — each side must be ≥10% of the split.
    public static func nonDegenerateBars(_ bars: [HistoricalAnalysisBar]) -> [HistoricalAnalysisBar] {
        bars.filter { bar in
            let total = bar.options.reduce(0) { $0 + $1.n }
            guard total > 0 else { return false }
            return bar.options.allSatisfy { $0.n > 0 && Double($0.n) / Double(total) >= 0.1 }
        }
    }

    /// Bars to render — non-degenerate AND not redundant with an active side filter.
    /// When the user pins home/away or favorite/underdog, hide that breakdown dimension
    /// (mirrors web comment: "hidden when a filter pins the side").
    public static func shownBars(
        _ bars: [HistoricalAnalysisBar],
        snapshot: HistoricalAnalysisUISnapshot
    ) -> [HistoricalAnalysisBar] {
        nonDegenerateBars(bars).filter { !isPinnedBreakdownDimension($0.dimension, snapshot: snapshot) }
    }

    private static func isPinnedBreakdownDimension(
        _ dimension: String,
        snapshot: HistoricalAnalysisUISnapshot
    ) -> Bool {
        switch dimension {
        case "home_away":
            return snapshot.side != "any"
        case "fav_dog":
            if ["fg_spread", "h1_spread"].contains(snapshot.betType) {
                return snapshot.spreadSide != "any"
            }
            if HistoricalAnalysisBetType.moneylineMarkets.contains(snapshot.betType)
                || snapshot.betType == "team_total" {
                return snapshot.favDog != "any"
            }
            return false
        default:
            return false
        }
    }
}
