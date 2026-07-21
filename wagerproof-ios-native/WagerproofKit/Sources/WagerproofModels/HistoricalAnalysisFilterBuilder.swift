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
            if snapshot.gameType == "any" || snapshot.gameType == "regular" {
                if snapshot.weekMin > 1 { f["week_min"] = .int(snapshot.weekMin) }
                if snapshot.weekMax < 16 { f["week_max"] = .int(snapshot.weekMax) }
            }
        case .mlb:
            break
        }

        if snapshot.side != "any", !isGameTotal { f["side"] = .string(snapshot.side) }

        // Explicit team / opponent multi-select (all sports). For CFB, explicit
        // teams override the conference→team expansion below.
        if !snapshot.teams.isEmpty {
            f["team"] = .array(snapshot.teams.map { .string($0) })
        }
        if !snapshot.opponents.isEmpty {
            f["opponent"] = .array(snapshot.opponents.map { .string($0) })
        }

        // Cross-market lines are sample filters, not result-market filters.
        if let scfg = spreadCfg["fg_spread"] {
            emitSpread(&f, side: snapshot.spreadSide, min: snapshot.spreadMin, max: snapshot.spreadMax, cfg: scfg)
            // An opponent spread is the opposite signed subject-team spread.
            emitSpread(&f, side: invertedSpreadSide(snapshot.oppSpreadSide), min: snapshot.oppSpreadMin, max: snapshot.oppSpreadMax, cfg: scfg)
        }
        if let scfg = spreadCfg["h1_spread"] {
            emitSpread(&f, side: snapshot.h1SpreadSide, min: snapshot.h1SpreadMin, max: snapshot.h1SpreadMax, cfg: scfg)
        }

        if snapshot.favDog != "any",
           HistoricalAnalysisBetType.moneylineMarkets.contains(betType) || betType == "team_total" {
            f["fav_dog"] = .string(snapshot.favDog)
        }

        emitMoneyline(&f, min: snapshot.mlMin, max: snapshot.mlMax, minKey: "ml_min", maxKey: "ml_max")
        emitMoneyline(&f, min: snapshot.h1MlMin, max: snapshot.h1MlMax, minKey: "h1_ml_min", maxKey: "h1_ml_max")
        emitMoneyline(&f, min: snapshot.oppMlMin, max: snapshot.oppMlMax, minKey: "opp_ml_min", maxKey: "opp_ml_max")
        if let cfg = totalCfg["fg_total"] {
            emitTotal(&f, min: snapshot.lineMin, max: snapshot.lineMax, cfg: cfg)
        }
        if let cfg = totalCfg["h1_total"] {
            emitTotal(&f, min: snapshot.h1TotalMin, max: snapshot.h1TotalMax, cfg: cfg)
        }
        if let cfg = totalCfg["team_total"] {
            emitTotal(&f, min: snapshot.ttLineMin, max: snapshot.ttLineMax, cfg: cfg)
            emitTotal(&f, min: snapshot.oppTtLineMin, max: snapshot.oppTtLineMax,
                      cfg: TotalCfg(min: cfg.min, max: cfg.max, mk: "opp_tt_min", xk: "opp_tt_max", label: cfg.label))
        }

        if let primetime = snapshot.primetime { f["primetime"] = .bool(primetime) }

        switch sport {
        case .nfl:
            if let division = snapshot.division { f["division"] = .bool(division) }
            if snapshot.dome != "any" { f["dome"] = .bool(snapshot.dome == "dome") }
            if snapshot.precip != "any" { f["precip"] = .string(snapshot.precip) }
            if snapshot.tempMin > -10 { f["temp_min"] = .int(snapshot.tempMin) }
            if snapshot.tempMax < 100 { f["temp_max"] = .int(snapshot.tempMax) }
            if let windMin = snapshot.windMin, windMin > 0 { f["wind_min"] = .int(windMin) }
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
            if snapshot.teams.isEmpty {
                // Only expand conferences → team[] when the user hasn't already
                // narrowed to specific schools via the Team dropdown.
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
            } else if picked.count == 1 {
                f["conference"] = .string(picked[0])
            } else if picked.isEmpty, snapshot.conference != "any" {
                f["conference"] = .string(snapshot.conference)
            }
            if snapshot.tempMin > -10 { f["temp_min"] = .int(snapshot.tempMin) }
            if snapshot.tempMax < 110 { f["temp_max"] = .int(snapshot.tempMax) }
            if let windMin = snapshot.windMin, windMin > 0 { f["wind_min"] = .int(windMin) }
            if snapshot.windMax < 60 { f["wind_max"] = .int(snapshot.windMax) }
            if snapshot.weather != "any" { f["weather"] = .string(snapshot.weather) }   // CFBD weatherCondition
            if snapshot.dome != "any" { f["dome"] = .bool(snapshot.dome == "dome") }     // CFBD gameIndoors
            // Rest/Bye — CFB short week is ≤6 (weekday after Saturday), not NFL's 4.
            switch snapshot.restBye {
            case "off_bye": f["rest_min"] = .int(13)
            case "short": f["rest_max"] = .int(6)
            case "pre_bye": f["pre_bye"] = .bool(true)
            default: break
            }
            if !snapshot.daysOfWeek.isEmpty {
                f["day_of_week"] = .array(snapshot.daysOfWeek.map { .string($0) })
            }
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
            
            // NFL + CFB use signed lastMargin (CFB last_blowout was removed).
            let defaultMargin = sport == .cfb ? [-80, 80] : [-60, 60]
            if snapshot.lastMargin != defaultMargin {
                if snapshot.lastMargin[0] > defaultMargin[0] {
                    f["last_margin_min"] = .int(snapshot.lastMargin[0])
                }
                if snapshot.lastMargin[1] < defaultMargin[1] {
                    f["last_margin_max"] = .int(snapshot.lastMargin[1])
                }
            }
        }
        
        // As-of + opponent mirrors — NFL and CFB share the same RPC keys (CFB ppg bounds 0–60).
        if sport == .nfl || sport == .cfb {
            // Days of week (NFL always; CFB also handled in sport switch above — keep NFL here)
            if sport == .nfl, !snapshot.daysOfWeek.isEmpty {
                f["day_of_week"] = .array(snapshot.daysOfWeek.map { .string($0) })
            }
            
            // Team divisions multi-select (NFL only)
            if sport == .nfl, !snapshot.teamDivisions.isEmpty {
                f["team_division"] = .array(snapshot.teamDivisions.map { .string($0) })
            }

            let ppgMax = sport == .cfb ? 60.0 : 40.0
            let prevWinsMax = sport == .cfb ? 15.0 : 16.0
            let coverMarginDefault = sport == .cfb ? [-30.0, 30.0] : [-15.0, 15.0]
            let pointDiffDefault = sport == .cfb ? [-40.0, 40.0] : [-20.0, 20.0]
            
            // Season Record (as-of)
            applyPctRange(&f, key: "win_pct", range: snapshot.winPct, defaultRange: [0, 100])
            applyNumRange(&f, key: "win_streak", range: snapshot.winStreak.map(Double.init), defaultRange: [0, 16])
            applyNumRange(&f, key: "loss_streak", range: snapshot.lossStreak.map(Double.init), defaultRange: [0, 16])
            if let above500 = snapshot.above500 { f["above_500"] = .bool(above500) }
            if let winPctGtOpp = snapshot.winPctGtOpp { f["win_pct_gt_opp"] = .bool(winPctGtOpp) }
            applyNumRange(&f, key: "ppg", range: snapshot.ppg, defaultRange: [0, ppgMax])
            applyNumRange(&f, key: "pa_pg", range: snapshot.paPg, defaultRange: [0, ppgMax])
            applyNumRange(&f, key: "point_diff_pg", range: snapshot.pointDiffPg, defaultRange: pointDiffDefault)
            if snapshot.minGames > 0 { f["min_games"] = .int(snapshot.minGames) }
            
            // Cover Profile
            applyPctRange(&f, key: "ats_win_pct", range: snapshot.atsWinPct, defaultRange: [0, 100])
            applyNumRange(&f, key: "ats_win_streak", range: snapshot.atsWinStreak.map(Double.init), defaultRange: [0, 16])
            applyNumRange(&f, key: "avg_cover_margin", range: snapshot.avgCoverMargin, defaultRange: coverMarginDefault)
            
            // Total Profile
            applyPctRange(&f, key: "over_pct", range: snapshot.overPct, defaultRange: [0, 100])
            applyNumRange(&f, key: "over_streak", range: snapshot.overStreak.map(Double.init), defaultRange: [0, 16])
            applyNumRange(&f, key: "under_streak", range: snapshot.underStreak.map(Double.init), defaultRange: [0, 16])
            
            // Prior Year
            applyNumRange(&f, key: "prev_wins", range: snapshot.prevWins.map(Double.init), defaultRange: [0, prevWinsMax])
            applyPctRange(&f, key: "prev_win_pct", range: snapshot.prevWinPct, defaultRange: [0, 100])
            if let madePlayoffsPrev = snapshot.madePlayoffsPrev { f["made_playoffs_prev"] = .bool(madePlayoffsPrev) }
            if let moreWins = snapshot.moreWinsThanOppPrev { f["more_wins_than_opp_prev"] = .bool(moreWins) }
            
            // Head-to-Head
            if snapshot.h2hLastWin != "any" { f["h2h_last_win"] = .int(snapshot.h2hLastWin == "yes" ? 1 : 0) }
            if snapshot.h2hLastAts != "any" { f["h2h_last_ats_win"] = .int(snapshot.h2hLastAts == "yes" ? 1 : 0) }
            if snapshot.h2hLastOver != "any" { f["h2h_last_over"] = .int(snapshot.h2hLastOver == "yes" ? 1 : 0) }
            if let h2hLastHome = snapshot.h2hLastHome { f["h2h_last_home"] = .bool(h2hLastHome) }
            if let h2hLastFav = snapshot.h2hLastFav { f["h2h_last_fav"] = .bool(h2hLastFav) }
            if let h2hSameSeason = snapshot.h2hSameSeason { f["h2h_same_season"] = .bool(h2hSameSeason) }
            if snapshot.h2hSpreadCmp == "lower" { f["h2h_spread_lower"] = .bool(true) }
            if snapshot.h2hSpreadCmp == "higher" { f["h2h_spread_higher"] = .bool(true) }
            
            // Opponent Record
            applyPctRange(&f, key: "opp_win_pct", range: snapshot.oppWinPct, defaultRange: [0, 100])
            applyPctRange(&f, key: "opp_over_pct", range: snapshot.oppOverPct, defaultRange: [0, 100])
            applyNumRange(&f, key: "opp_win_streak", range: snapshot.oppWinStreak.map(Double.init), defaultRange: [0, 16])
            applyNumRange(&f, key: "opp_loss_streak", range: snapshot.oppLossStreak.map(Double.init), defaultRange: [0, 16])
            applyNumRange(&f, key: "opp_ppg", range: snapshot.oppPpg, defaultRange: [0, ppgMax])
            applyNumRange(&f, key: "opp_pa_pg", range: snapshot.oppPaPg, defaultRange: [0, ppgMax])
            applyPctRange(&f, key: "opp_prev_win_pct", range: snapshot.oppPrevWinPct, defaultRange: [0, 100])
            
            // Opponent Last Game
            if snapshot.oppLastResult != "any" { f["opp_last_won"] = .int(snapshot.oppLastResult == "won" ? 1 : 0) }
            if snapshot.oppLastAts != "any" { f["opp_last_covered"] = .int(snapshot.oppLastAts == "covered" ? 1 : 0) }
            if snapshot.oppLastTotal != "any" { f["opp_last_over"] = .int(snapshot.oppLastTotal == "over" ? 1 : 0) }
            if snapshot.oppLastRole != "any" { f["opp_last_favorite"] = .bool(snapshot.oppLastRole == "favorite") }
            if let oppLastOt = snapshot.oppLastOt { f["opp_last_overtime"] = .bool(oppLastOt) }
            
            let defaultOppMargin = sport == .cfb ? [-80, 80] : [-60, 60]
            if snapshot.oppLastMargin != defaultOppMargin {
                if snapshot.oppLastMargin[0] > defaultOppMargin[0] {
                    f["opp_last_margin_min"] = .int(snapshot.oppLastMargin[0])
                }
                if snapshot.oppLastMargin[1] < defaultOppMargin[1] {
                    f["opp_last_margin_max"] = .int(snapshot.oppLastMargin[1])
                }
            }
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
        if !snapshot.teams.isEmpty {
            out["team"] = .array(Array(Set(snapshot.teams.map { MLBF5.toSplitTeamAbbr($0) })).map { .string($0) })
        }
        if !snapshot.opponents.isEmpty {
            out["opponent"] = .array(Array(Set(snapshot.opponents.map { MLBF5.toSplitTeamAbbr($0) })).map { .string($0) })
        }
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

        // Totals are cross-market sample filters on web ("available on every bet
        // type"). iOS repurposes ONE line slider per market: F5 bounds on the F5
        // total market, FG total bounds everywhere else — previously the slider
        // was dead on ML/RL markets.
        if betType == "f5_total" {
            if let tcfg = mlbTotalCfg["f5_total"] {
                if snapshot.lineMin > tcfg.min { out["f5_total_min"] = .double(snapshot.lineMin) }
                if snapshot.lineMax < tcfg.max { out["f5_total_max"] = .double(snapshot.lineMax) }
            }
        } else if let tcfg = mlbTotalCfg["total"] {
            if snapshot.lineMin > tcfg.min { out["total_min"] = .double(snapshot.lineMin) }
            if snapshot.lineMax < tcfg.max { out["total_max"] = .double(snapshot.lineMax) }
        }

        // RPC does jsonb_array_elements on day_of_week — a scalar string makes the
        // whole query error ("cannot extract elements from a scalar"), which froze
        // the page on stale results. Must be an array even for a single day.
        if snapshot.dayOfWeek != "any" { out["day_of_week"] = .array([.string(snapshot.dayOfWeek)]) }
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
        if snapshot.windMax < 40 { out["wind_max"] = .int(snapshot.windMax) }
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
    
    /// Apply percent range (UI 0-100 → RPC 0-1) only when narrowed from default
    private static func applyPctRange(_ filters: inout [String: JSONValue], key: String, range: [Double], defaultRange: [Double]) {
        if range[0] > defaultRange[0] {
            filters["\(key)_min"] = .double(range[0] / 100.0)
        }
        if range[1] < defaultRange[1] {
            filters["\(key)_max"] = .double(range[1] / 100.0)
        }
    }
    
    /// Apply numeric range only when narrowed from default
    private static func applyNumRange(_ filters: inout [String: JSONValue], key: String, range: [Double], defaultRange: [Double]) {
        if range[0] > defaultRange[0] {
            filters["\(key)_min"] = .double(range[0])
        }
        if range[1] < defaultRange[1] {
            filters["\(key)_max"] = .double(range[1])
        }
    }

    private static func invertedSpreadSide(_ side: String) -> String {
        switch side {
        case "favorite": return "underdog"
        case "underdog": return "favorite"
        default: return "any"
        }
    }

    private static func emitSpread(
        _ filters: inout [String: JSONValue],
        side: String,
        min: Double,
        max: Double,
        cfg: SpreadCfg
    ) {
        let minDog = Swift.max(min, 0.5)
        switch side {
        case "favorite":
            filters[cfg.mk] = .double(-max)
            filters[cfg.xk] = .double(-minDog)
        case "underdog":
            filters[cfg.mk] = .double(minDog)
            filters[cfg.xk] = .double(max)
        default:
            if min > 0 || max < cfg.max {
                filters[cfg.amk] = .double(min)
                filters[cfg.axk] = .double(max)
            }
        }
    }

    private static func emitMoneyline(
        _ filters: inout [String: JSONValue],
        min: String,
        max: String,
        minKey: String,
        maxKey: String
    ) {
        var low = Double(min.trimmingCharacters(in: .whitespaces))
        var high = Double(max.trimmingCharacters(in: .whitespaces))
        if (low ?? 0) > (high ?? 0), low != nil, high != nil { swap(&low, &high) }
        if let low, !low.isNaN { filters[minKey] = .double(low) }
        if let high, !high.isNaN { filters[maxKey] = .double(high) }
    }

    private static func emitTotal(
        _ filters: inout [String: JSONValue],
        min: Double,
        max: Double,
        cfg: TotalCfg
    ) {
        if min > cfg.min { filters[cfg.mk] = .double(min) }
        if max < cfg.max { filters[cfg.xk] = .double(max) }
    }
}
