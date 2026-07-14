import Foundation

/// Translates UI filter state into warehouse RPC `p_filters` JSON.
/// Logic ported from `src/pages/NFLAnalytics.tsx`, `CFBAnalytics.tsx`, and MLB RN types.
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
        // CFB spreads reach the low 50s (matches web CFBAnalytics.tsx SPREAD_CFG).
        "fg_spread": SpreadCfg(max: 50, mk: "spread_min", xk: "spread_max", amk: "abs_spread_min", axk: "abs_spread_max"),
        "h1_spread": SpreadCfg(max: 28, mk: "h1_spread_min", xk: "h1_spread_max", amk: "h1_abs_spread_min", axk: "h1_abs_spread_max"),
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

    private static let mlbTotalCfg: [String: TotalCfg] = [
        "total": TotalCfg(min: 5, max: 14, mk: "total_min", xk: "total_max", label: "Game total"),
        "f5_total": TotalCfg(min: 2, max: 8, mk: "f5_total_min", xk: "f5_total_max", label: "F5 total"),
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
        let cfg: [String: SpreadCfg]
        switch sport {
        case .nfl: cfg = nflSpreadCfg
        case .cfb: cfg = cfbSpreadCfg
        case .mlb: return nil
        }
        guard let spread = cfg[betType] else { return nil }
        return SpreadConfig(max: spread.max)
    }

    public static func totalConfig(sport: HistoricalAnalysisSport, betType: String) -> TotalConfig? {
        let cfg: [String: TotalCfg]
        switch sport {
        case .nfl: cfg = nflTotalCfg
        case .cfb: cfg = cfbTotalCfg
        case .mlb: cfg = mlbTotalCfg
        }
        guard let total = cfg[betType] else { return nil }
        return TotalConfig(min: total.min, max: total.max, label: total.label)
    }

    public static func seasonFloor(betType: String, sport: HistoricalAnalysisSport) -> Int {
        if sport == .mlb { return 2023 }
        if HistoricalAnalysisBetType.limitedHistory.contains(betType) { return 2023 }
        return sport.defaultSeasonFloor
    }

    public static func buildRPCFilters(
        sport: HistoricalAnalysisSport,
        snapshot: HistoricalAnalysisUISnapshot,
        conferenceTeamMap: [String: [String]] = [:]
    ) -> [String: JSONValue] {
        if sport == .mlb {
            return buildMLBRPCFilters(snapshot: snapshot)
        }

        var f: [String: JSONValue] = [:]
        let betType = snapshot.betType
        let seasonFloor = seasonFloor(betType: betType, sport: sport)
        let spreadCfg = sport == .nfl ? nflSpreadCfg : cfbSpreadCfg
        let totalCfg = sport == .nfl ? nflTotalCfg : cfbTotalCfg
        // Game totals are game-level: Side / ML-odds don't apply (they returned 0 / did nothing).
        let isGameTotal = betType == "fg_total" || betType == "h1_total"
        let isMlMkt = HistoricalAnalysisBetType.moneylineMarkets.contains(betType)

        if snapshot.seasonMin > seasonFloor { f["season_min"] = .int(snapshot.seasonMin) }
        if snapshot.seasonMax < sport.seasonMax { f["season_max"] = .int(snapshot.seasonMax) }

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
        case .mlb:
            break
        }

        if snapshot.side != "any", !isGameTotal { f["side"] = .string(snapshot.side) }

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

        // ML odds apply only to moneyline markets (spread markets use spread side; totals none).
        if isMlMkt {
            var mlA = snapshot.mlMin.trimmingCharacters(in: .whitespaces).isEmpty
                ? nil : Double(snapshot.mlMin)
            var mlB = snapshot.mlMax.trimmingCharacters(in: .whitespaces).isEmpty
                ? nil : Double(snapshot.mlMax)
            if let a = mlA, let b = mlB, a > b { swap(&mlA, &mlB) }
            if let a = mlA { f["ml_min"] = .double(a) }
            if let b = mlB { f["ml_max"] = .double(b) }
        }

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
            if snapshot.weather != "any" { f["weather"] = .string(snapshot.weather) }   // CFBD weatherCondition
            if snapshot.dome != "any" { f["dome"] = .bool(snapshot.dome == "dome") }     // CFBD gameIndoors
        case .mlb:
            break
        }

        // Football "last game" filters — team's PREVIOUS game.
        // NFL UI ships these now; CFB keys stay in the builder for when that sport's regroup lands.
        if sport == .nfl || sport == .cfb {
            if snapshot.lastResult != "any" { f["last_won"] = .int(snapshot.lastResult == "won" ? 1 : 0) }
            if snapshot.lastAts != "any" { f["last_covered"] = .int(snapshot.lastAts == "covered" ? 1 : 0) }
            if snapshot.lastTotal != "any" { f["last_over"] = .int(snapshot.lastTotal == "over" ? 1 : 0) }
            if snapshot.lastRole != "any" { f["last_favorite"] = .bool(snapshot.lastRole == "favorite") }
            if let lastOt = snapshot.lastOt { f["last_overtime"] = .bool(lastOt) }
            if snapshot.lastBlowout != "any" { f["last_blowout"] = .string(snapshot.lastBlowout) }
        }

        return f
    }

    /// Port of RN `buildMlbRpcFilters` — omit unset keys; do not invent the other end of ranges.
    public static func buildMLBRPCFilters(snapshot: HistoricalAnalysisUISnapshot) -> [String: JSONValue] {
        var out: [String: JSONValue] = [:]
        let betType = snapshot.betType
        let floor = 2023
        let seasonCap = HistoricalAnalysisSport.mlb.seasonMax

        if snapshot.seasonMin > floor { out["season_min"] = .int(snapshot.seasonMin) }
        if snapshot.seasonMax < seasonCap { out["season_max"] = .int(snapshot.seasonMax) }
        if snapshot.monthMin > 3 { out["month_min"] = .int(snapshot.monthMin) }
        if snapshot.monthMax < 11 { out["month_max"] = .int(snapshot.monthMax) }
        if !snapshot.teams.isEmpty { out["team"] = .array(snapshot.teams.map { .string($0) }) }
        if !snapshot.opponents.isEmpty { out["opponent"] = .array(snapshot.opponents.map { .string($0) }) }
        if let division = snapshot.division { out["division"] = .bool(division) }
        if let interleague = snapshot.interleague { out["interleague"] = .bool(interleague) }
        if snapshot.side != "any" { out["side"] = .string(snapshot.side) }
        if snapshot.favDog != "any" { out["fav_dog"] = .string(snapshot.favDog) }

        let mlA = snapshot.mlMin.trimmingCharacters(in: .whitespaces).isEmpty
            ? nil : Double(snapshot.mlMin)
        let mlB = snapshot.mlMax.trimmingCharacters(in: .whitespaces).isEmpty
            ? nil : Double(snapshot.mlMax)
        if let a = mlA, !a.isNaN { out["ml_min"] = .double(a) }
        if let b = mlB, !b.isNaN { out["ml_max"] = .double(b) }

        if betType == "total" || betType == "f5_total" {
            let mk = betType == "total" ? "total_min" : "f5_total_min"
            let xk = betType == "total" ? "total_max" : "f5_total_max"
            // Only emit bounds that differ from the full default range (explicit user narrowing).
            if let tcfg = mlbTotalCfg[betType] {
                if snapshot.lineMin > tcfg.min { out[mk] = .double(snapshot.lineMin) }
                if snapshot.lineMax < tcfg.max { out[xk] = .double(snapshot.lineMax) }
            }
        }

        if snapshot.dayOfWeek != "any" { out["day_of_week"] = .string(snapshot.dayOfWeek) }
        if let doubleheader = snapshot.doubleheader { out["doubleheader"] = .bool(doubleheader) }
        if let v = snapshot.seriesGameMin { out["series_game_min"] = .int(v) }
        if let v = snapshot.seriesGameMax { out["series_game_max"] = .int(v) }
        if let v = snapshot.tripMin { out["trip_min"] = .int(v) }
        if let v = snapshot.tripMax { out["trip_max"] = .int(v) }
        if let switchGame = snapshot.switchGame { out["switch_game"] = .bool(switchGame) }
        if let v = snapshot.restMin { out["rest_min"] = .int(v) }
        if let v = snapshot.restMax { out["rest_max"] = .int(v) }

        let streakA = snapshot.streakMin.trimmingCharacters(in: .whitespaces).isEmpty
            ? nil : Double(snapshot.streakMin)
        let streakB = snapshot.streakMax.trimmingCharacters(in: .whitespaces).isEmpty
            ? nil : Double(snapshot.streakMax)
        if let a = streakA, !a.isNaN { out["streak_min"] = .double(a) }
        if let b = streakB, !b.isNaN { out["streak_max"] = .double(b) }

        if snapshot.lastResult != "any" { out["last_result"] = .string(snapshot.lastResult) }

        let marginA = snapshot.lastMarginMin.trimmingCharacters(in: .whitespaces).isEmpty
            ? nil : Double(snapshot.lastMarginMin)
        let marginB = snapshot.lastMarginMax.trimmingCharacters(in: .whitespaces).isEmpty
            ? nil : Double(snapshot.lastMarginMax)
        if let a = marginA, !a.isNaN { out["last_margin_min"] = .double(a) }
        if let b = marginB, !b.isNaN { out["last_margin_max"] = .double(b) }

        if !snapshot.sp.isEmpty { out["sp"] = .array(snapshot.sp.map { .int($0.id) }) }
        if !snapshot.oppSp.isEmpty { out["opp_sp"] = .array(snapshot.oppSp.map { .int($0.id) }) }
        if snapshot.spHand != "any" { out["sp_hand"] = .string(snapshot.spHand) }
        if snapshot.oppSpHand != "any" { out["opp_sp_hand"] = .string(snapshot.oppSpHand) }

        if snapshot.tempMin > -10 { out["temp_min"] = .int(snapshot.tempMin) }
        if snapshot.tempMax < 110 { out["temp_max"] = .int(snapshot.tempMax) }
        if let windMin = snapshot.windMin { out["wind_min"] = .int(windMin) }
        if snapshot.windMax < 60 { out["wind_max"] = .int(snapshot.windMax) }
        if snapshot.windDir != "any" { out["wind_dir"] = .string(snapshot.windDir) }
        if snapshot.dome != "any" { out["dome"] = .bool(snapshot.dome == "dome") }
        if let v = snapshot.pfRunsMin { out["pf_runs_min"] = .double(v) }
        if let v = snapshot.pfRunsMax { out["pf_runs_max"] = .double(v) }

        return out
    }

    /// Port of RN `mlbFiltersWeatherOnly` — upcoming RPC should get `{}` when only weather keys are set.
    public static func mlbFiltersWeatherOnly(_ filters: [String: JSONValue]) -> Bool {
        let keys = Array(filters.keys)
        guard !keys.isEmpty else { return false }
        let weather: Set<String> = ["temp_min", "temp_max", "wind_min", "wind_max", "wind_dir"]
        return keys.allSatisfy { weather.contains($0) }
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
            if ["fg_spread", "h1_spread", "rl", "f5_rl"].contains(snapshot.betType) {
                return snapshot.spreadSide != "any" || snapshot.favDog != "any"
            }
            if HistoricalAnalysisBetType.moneylineMarkets.contains(snapshot.betType)
                || snapshot.betType == "team_total"
                || ["ml", "f5_ml"].contains(snapshot.betType) {
                return snapshot.favDog != "any"
            }
            return false
        default:
            return false
        }
    }
}
