import Foundation
import SwiftUI
import WagerproofModels

/// Formatting + chip helpers ported from web NFLAnalytics / CFBAnalytics.
enum HistoricalAnalysisCopy {
    static let dimLabels: [String: String] = [
        "over_under": "Over / Under",
        "home_away": "Home vs Away",
        "fav_dog": "Favorite vs Underdog",
    ]

    static func sideLabel(betType: String, side: String) -> String {
        if side == "over" { return "Over" }
        if side == "under" { return "Under" }
        let isML = HistoricalAnalysisBetType.moneylineMarkets.contains(betType)
            || betType == "ml" || betType == "f5_ml"
        let verb = isML ? "won" : "covered"
        switch side {
        case "home": return "Home \(verb)"
        case "away": return "Away \(verb)"
        case "favorite": return "Favorites \(verb)"
        case "underdog": return "Underdogs \(verb)"
        default: return side
        }
    }

    static func verb(for betType: String) -> String {
        switch betType {
        case "fg_spread": return "covered"
        case "h1_spread": return "covered the 1H spread"
        case "fg_ml": return "won"
        case "h1_ml": return "won in the 1H"
        case "fg_total": return "went over"
        case "h1_total": return "went over the 1H total"
        case "team_total": return "went over their team total"
        case "ml": return "won"
        case "rl": return "covered the run line"
        case "total": return "went over"
        case "f5_ml": return "won the F5"
        case "f5_rl": return "covered the F5 run line"
        case "f5_total": return "went over the F5 total"
        default: return "hit"
        }
    }

    static func outcomeLabel(for betType: String) -> String {
        switch betType {
        case "fg_spread", "h1_spread", "rl", "f5_rl": return "Cover"
        case "fg_ml", "h1_ml", "ml", "f5_ml": return "Win"
        case "fg_total", "h1_total", "team_total", "total", "f5_total": return "Over"
        default: return "Hit"
        }
    }

    static func noun(for betType: String, snapshot: HistoricalAnalysisUISnapshot? = nil) -> String {
        if betType == "team_total" { return "team totals" }
        if let snapshot, !activeConferences(snapshot).isEmpty,
           ["fg_spread", "h1_spread"].contains(snapshot.betType) {
            return "spreads"
        }
        return "games"
    }

    static func significance(n: Int, hit: Double) -> (label: String, isStrong: Bool) {
        let dev = abs(hit - 50)
        if n < 20 { return ("Thin sample", false) }
        if n >= 60 && dev >= 5 { return ("Strong", true) }
        if n >= 30 && dev >= 3 { return ("Solid", true) }
        return ("Neutral", false)
    }

    static func trimmed(_ value: Double) -> String {
        if value == value.rounded() { return String(format: "%.0f", value) }
        var s = String(format: "%.1f", value)
        while s.hasSuffix("0") { s.removeLast() }
        if s.hasSuffix(".") { s.removeLast() }
        return s
    }

    /// Plain year string — avoids locale grouping (e.g. 2,018) in Text views.
    static func year(_ value: Int) -> String {
        String(value)
    }

    static func yearRange(_ min: Int, _ max: Int) -> String {
        "\(year(min))–\(year(max))"
    }

    static func hitPctColor(_ hitPct: Double) -> Color {
        if hitPct > 50 { return .green }
        if hitPct < 50 { return .red }
        return .white
    }

    /// Headline numbers should match the filtered subject — when the user
    /// filters to favorites/underdogs or home/away, pull stats from that
    /// breakdown slice instead of the blended `overall` row (which counts
    /// both sides and can read 50% while favorites show 40%).
    static func activeConferences(_ snapshot: HistoricalAnalysisUISnapshot) -> [String] {
        if !snapshot.selectedConferences.isEmpty { return snapshot.selectedConferences }
        if snapshot.conference != "any" { return [snapshot.conference] }
        return []
    }

    static func conferencePillLabel(_ conferences: [String]) -> String {
        if conferences.isEmpty { return "Conference" }
        if conferences.count == 1 { return conferences[0] }
        if conferences.count == 2 { return "\(conferences[0]), \(conferences[1])" }
        return "\(conferences[0]) +\(conferences.count - 1)"
    }

    static func conferenceHeadlineSubject(_ conferences: [String], situation: String) -> String {
        let names = conferences.joined(separator: ", ")
        let base = conferences.count == 1 ? "\(names) schools" : "\(names) schools"
        if situation.isEmpty { return base }
        return "\(base) (\(situation.lowercased()))"
    }

    static func headlineMetrics(
        snapshot: HistoricalAnalysisUISnapshot,
        data: HistoricalAnalysisResponse
    ) -> (n: Int, wins: Int, hitPct: Double, roi: Double?) {
        if !activeConferences(snapshot).isEmpty {
            let o = data.overall
            return (o.n, o.wins, o.hitPct, o.roi)
        }
        if let side = directionalBarSide(snapshot),
           let bar = data.bars.first(where: { $0.dimension == "fav_dog" }),
           let opt = bar.options.first(where: { $0.side == side }) {
            return (opt.n, opt.wins, opt.hitPct, opt.roi)
        }
        if snapshot.side != "any",
           let bar = data.bars.first(where: { $0.dimension == "home_away" }),
           let opt = bar.options.first(where: { $0.side == snapshot.side }) {
            return (opt.n, opt.wins, opt.hitPct, opt.roi)
        }
        let o = data.overall
        return (o.n, o.wins, o.hitPct, o.roi)
    }

    private static func directionalBarSide(_ snapshot: HistoricalAnalysisUISnapshot) -> String? {
        if ["fg_spread", "h1_spread"].contains(snapshot.betType) {
            switch snapshot.spreadSide {
            case "favorite", "underdog": return snapshot.spreadSide
            default: break
            }
        }
        if HistoricalAnalysisBetType.moneylineMarkets.contains(snapshot.betType)
            || snapshot.betType == "team_total"
            || ["ml", "f5_ml", "rl", "f5_rl"].contains(snapshot.betType) {
            switch snapshot.favDog {
            case "favorite", "underdog": return snapshot.favDog
            default: break
            }
        }
        return nil
    }

    static func signedPct(_ value: Double) -> String {
        (value > 0 ? "+" : "") + trimmed(value) + "%"
    }

    static func fmtKickoff(_ iso: String) -> String {
        let isoFmt = ISO8601DateFormatter()
        isoFmt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        var date = isoFmt.date(from: iso)
        if date == nil {
            isoFmt.formatOptions = [.withInternetDateTime]
            date = isoFmt.date(from: iso)
        }
        guard let date else { return "" }
        let fmt = DateFormatter()
        fmt.locale = Locale(identifier: "en_US_POSIX")
        fmt.timeZone = TimeZone(identifier: "America/New_York")
        fmt.dateFormat = "EEE, MMM d, h:mm a"
        return fmt.string(from: date) + " ET"
    }

    static func lineForBet(betType: String, game: HistoricalAnalysisUpcomingGame) -> String {
        let t = game.team
        let favLabel: (Bool?, String, String, String) -> String = { fav, yes, no, unknown in
            guard let fav else { return unknown }
            return fav ? yes : no
        }
        if betType == "fg_spread", let sp = game.teamSpread {
            return "\(t) \(sp > 0 ? "+" : "")\(trimmed(sp))"
        }
        if betType == "fg_ml" {
            return "\(t) ML (\(favLabel(game.isFavorite, "favorite", "underdog", "even")))"
        }
        if betType == "fg_total" {
            return "Total O/U \(game.total.map(trimmed) ?? "—")"
        }
        if betType == "team_total" {
            return "\(t) team total \(game.ttLine.map(trimmed) ?? "—")"
        }
        if betType == "h1_spread", let sp = game.h1Spread {
            return "\(t) 1H \(sp > 0 ? "+" : "")\(trimmed(sp))"
        }
        if betType == "h1_ml" {
            return "\(t) 1H ML (\(favLabel(game.isFavorite, "favorite", "underdog", "even")))"
        }
        if betType == "h1_total" {
            return "1H Total O/U \(game.h1Total.map(trimmed) ?? "—")"
        }
        if betType == "ml" {
            return "\(t) ML (\(favLabel(game.isFavorite, "fav", "dog", "even")))"
        }
        if betType == "rl" {
            switch game.isFavorite {
            case true?: return "\(t) RL −1.5"
            case false?: return "\(t) RL +1.5"
            case nil: return "\(t) RL"
            }
        }
        if betType == "total" {
            return "Total O/U \(game.total.map(trimmed) ?? "—")"
        }
        if betType == "f5_ml" {
            return "\(t) F5 ML"
        }
        if betType == "f5_rl" {
            switch game.isFavorite {
            case true?: return "\(t) F5 RL −0.5"
            case false?: return "\(t) F5 RL +0.5"
            case nil: return "\(t) F5 RL"
            }
        }
        if betType == "f5_total" {
            return "F5 Total O/U \(game.f5Total.map(trimmed) ?? "—")"
        }
        return ""
    }

    static func mlbUpcomingChips(_ g: HistoricalAnalysisUpcomingGame) -> [String] {
        var chips: [String] = []
        if let sg = g.seriesGame {
            chips.append("Series G\(sg >= 4 ? "4+" : "\(sg)")")
        }
        if let t = g.tripSeriesIndex {
            chips.append(t >= 3 ? "3rd+ series of trip" : t == 2 ? "2nd series of trip" : "1st series of trip")
        }
        if g.isSwitchGame == true { chips.append("Switch") }
        if let hand = g.oppSpHand, !hand.isEmpty { chips.append("vs \(hand)HP") }
        if let name = g.oppSpName, !name.isEmpty { chips.append(name) }
        if g.isDoubleheader == true { chips.append("DH") }
        return chips
    }

    struct ActiveChip: Identifiable {
        let id = UUID()
        let label: String
        let clear: () -> Void
    }

    static func activeChips(
        sport: HistoricalAnalysisSport,
        snapshot: HistoricalAnalysisUISnapshot,
        seasonFloor: Int,
        onChange: @escaping (HistoricalAnalysisUISnapshot) -> Void
    ) -> [ActiveChip] {
        var chips: [ActiveChip] = []
        var s = snapshot
        // Sport-aware defaults — CFB as-of ranges are wider than NFL's, so
        // hardcoded [0,40]-style comparisons would show phantom chips there.
        let d = HistoricalAnalysisUISnapshot.defaults(for: sport)
        let betType = s.betType
        // Game totals are game-level: Side doesn't apply. ML odds apply to ML markets (football) / all MLB.
        let isGameTotal = betType == "fg_total" || betType == "h1_total"
        let mlApplies = true // FG ML odds filter is available on every market
        let weekMax = sport == .nfl ? 18 : 16
        let seasonMax = sport.seasonMax
        let spreadCfg = HistoricalAnalysisFilterBuilder.spreadConfig(sport: sport, betType: "fg_spread")
        let totalCfg = HistoricalAnalysisFilterBuilder.totalConfig(sport: sport, betType: betType)

        if s.seasonMin != seasonFloor || s.seasonMax != seasonMax {
            chips.append(.init(label: "Seasons \(yearRange(s.seasonMin, s.seasonMax))") {
                s.seasonMin = seasonFloor; s.seasonMax = seasonMax; onChange(s)
            })
        }

        switch sport {
        case .nfl:
            if s.seasonType != "any" {
                chips.append(.init(label: s.seasonType == "regular" ? "Regular season" : "Playoffs") {
                    s.seasonType = "any"; s.playoffRound = "any"; onChange(s)
                })
            }
            if s.seasonType == "regular", s.weekMin != 1 || s.weekMax != weekMax {
                chips.append(.init(label: "Weeks \(s.weekMin)–\(s.weekMax)") {
                    s.weekMin = 1; s.weekMax = weekMax; onChange(s)
                })
            }
            if s.seasonType == "postseason", s.playoffRound != "any" {
                chips.append(.init(label: "Round: \(s.playoffRound)") {
                    s.playoffRound = "any"; onChange(s)
                })
            }
        case .cfb:
            if s.gameType != "any" {
                let labels: [String: String] = [
                    "regular": "Regular season", "bowl": "Bowl games",
                    "playoff": "Playoff", "postseason": "All postseason",
                ]
                chips.append(.init(label: labels[s.gameType] ?? s.gameType) {
                    s.gameType = "any"; onChange(s)
                })
            }
            if s.rankedMatchup != "any" {
                let labels: [String: String] = [
                    "both": "Both ranked", "neither": "Neither ranked",
                    "home_ranked": "Home ranked / away unranked",
                    "away_ranked": "Away ranked / home unranked",
                    "either": "Either ranked",
                ]
                chips.append(.init(label: labels[s.rankedMatchup] ?? s.rankedMatchup) {
                    s.rankedMatchup = "any"; onChange(s)
                })
            }
            if s.gameType == "regular", s.weekMin != 1 || s.weekMax != weekMax {
                chips.append(.init(label: "Weeks \(s.weekMin)–\(s.weekMax)") {
                    s.weekMin = 1; s.weekMax = weekMax; onChange(s)
                })
            }
        case .mlb:
            if s.monthMin != 3 || s.monthMax != 11 {
                chips.append(.init(label: "Months \(s.monthMin)–\(s.monthMax)") {
                    s.monthMin = 3; s.monthMax = 11; onChange(s)
                })
            }
            if s.dayOfWeek != "any" {
                chips.append(.init(label: s.dayOfWeek) { s.dayOfWeek = "any"; onChange(s) })
            }
            if s.seriesGameMin != nil || s.seriesGameMax != nil {
                chips.append(.init(label: "Series game") {
                    s.seriesGameMin = nil; s.seriesGameMax = nil; onChange(s)
                })
            }
            if s.tripMin != nil || s.tripMax != nil {
                chips.append(.init(label: "Trip") {
                    s.tripMin = nil; s.tripMax = nil; onChange(s)
                })
            }
            if s.switchGame != nil {
                chips.append(.init(label: "Switch: \(s.switchGame == true ? "Yes" : "No")") {
                    s.switchGame = nil; onChange(s)
                })
            }
            if s.restMin != nil || s.restMax != nil {
                chips.append(.init(label: "Rest") {
                    s.restMin = nil; s.restMax = nil; onChange(s)
                })
            }
            if s.lastResult != "any" {
                chips.append(.init(label: "Last: \(s.lastResult)") {
                    s.lastResult = "any"; onChange(s)
                })
            }
            if !s.lastMarginMin.isEmpty || !s.lastMarginMax.isEmpty {
                chips.append(.init(label: "Last margin") {
                    s.lastMarginMin = ""; s.lastMarginMax = ""; onChange(s)
                })
            }
            for p in s.sp {
                chips.append(.init(label: "SP: \(p.name)") {
                    s.sp.removeAll { $0.id == p.id }; onChange(s)
                })
            }
            for p in s.oppSp {
                chips.append(.init(label: "Opp SP: \(p.name)") {
                    s.oppSp.removeAll { $0.id == p.id }; onChange(s)
                })
            }
            if s.spHand != "any" {
                chips.append(.init(label: "SP \(s.spHand)HP") { s.spHand = "any"; onChange(s) })
            }
            if s.oppSpHand != "any" {
                chips.append(.init(label: "Opp SP \(s.oppSpHand)HP") { s.oppSpHand = "any"; onChange(s) })
            }
            if s.interleague != nil {
                chips.append(.init(label: "Interleague: \(s.interleague == true ? "Yes" : "No")") {
                    s.interleague = nil; onChange(s)
                })
            }
            if s.doubleheader != nil {
                chips.append(.init(label: "DH: \(s.doubleheader == true ? "Yes" : "No")") {
                    s.doubleheader = nil; onChange(s)
                })
            }
            if s.windDir != "any" {
                chips.append(.init(label: "Wind \(s.windDir)") { s.windDir = "any"; onChange(s) })
            }
            if s.pfRunsMin != nil || s.pfRunsMax != nil {
                chips.append(.init(label: "Park factor") {
                    s.pfRunsMin = nil; s.pfRunsMax = nil; onChange(s)
                })
            }
        }

        for team in s.teams {
            chips.append(.init(label: "Team: \(team)") {
                s.teams.removeAll { $0 == team }; onChange(s)
            })
        }
        for opp in s.opponents {
            chips.append(.init(label: "vs \(opp)") {
                s.opponents.removeAll { $0 == opp }; onChange(s)
            })
        }

        if s.side != "any", !isGameTotal {
            chips.append(.init(label: s.side == "home" ? "Home" : "Away") {
                s.side = "any"; onChange(s)
            })
        }

        if (HistoricalAnalysisBetType.moneylineMarkets.contains(betType)
            || betType == "team_total"
            || ["ml", "f5_ml", "rl", "f5_rl"].contains(betType)),
           s.favDog != "any" {
            chips.append(.init(label: s.favDog == "favorite" ? "Favorites" : "Underdogs") {
                s.favDog = "any"; onChange(s)
            })
        }

        if let spreadCfg {
            let spreadMax = spreadCfg.max
            let lo = HistoricalAnalysisCopy.trimmed(s.spreadMin)
            let hi = HistoricalAnalysisCopy.trimmed(s.spreadMax)
            if s.spreadSide != "any" {
                let sideLabel = s.spreadSide == "favorite" ? "Favored by" : "Getting"
                chips.append(.init(label: "\(sideLabel) \(lo)–\(hi)") {
                    s.spreadSide = "any"; s.spreadMin = 0; s.spreadMax = spreadMax; onChange(s)
                })
            } else if s.spreadMin > 0.001 || s.spreadMax < spreadMax - 0.001 {
                chips.append(.init(label: "Spread \(lo)–\(hi)") {
                    s.spreadMin = 0; s.spreadMax = spreadMax; onChange(s)
                })
            }
        }

        if let totalCfg,
           s.lineMin > totalCfg.min + 0.001 || s.lineMax < totalCfg.max - 0.001 {
            let lo = HistoricalAnalysisCopy.trimmed(s.lineMin)
            let hi = HistoricalAnalysisCopy.trimmed(s.lineMax)
            chips.append(.init(label: "\(totalCfg.label) \(lo)–\(hi)") {
                s.lineMin = totalCfg.min; s.lineMax = totalCfg.max; onChange(s)
            })
        }

        if sport == .nfl || sport == .cfb {
            let h1SpreadMax = sport == .cfb ? 28.0 : 14.0
            let oppSpreadMax = sport == .cfb ? 50.0 : 20.0
            let h1TotalMax = sport == .cfb ? 45.0 : 35.0
            let ttMax = sport == .cfb ? 55.0 : 40.0
            appendSpreadChip(&chips, snapshot: s, label: "1H spread", side: \.h1SpreadSide, min: \.h1SpreadMin, max: \.h1SpreadMax, defaultMax: h1SpreadMax, onChange: onChange)
            appendSpreadChip(&chips, snapshot: s, label: "Opponent spread", side: \.oppSpreadSide, min: \.oppSpreadMin, max: \.oppSpreadMax, defaultMax: oppSpreadMax, onChange: onChange)
            appendRangeChip(&chips, snapshot: s, label: "1H total", min: \.h1TotalMin, max: \.h1TotalMax, defaults: [15, h1TotalMax], onChange: onChange)
            appendRangeChip(&chips, snapshot: s, label: "Team total", min: \.ttLineMin, max: \.ttLineMax, defaults: [10, ttMax], onChange: onChange)
            appendRangeChip(&chips, snapshot: s, label: "Opponent TT", min: \.oppTtLineMin, max: \.oppTtLineMax, defaults: [10, ttMax], onChange: onChange)
            appendMoneylineChip(&chips, snapshot: s, label: "1H ML", min: \.h1MlMin, max: \.h1MlMax, onChange: onChange)
            appendMoneylineChip(&chips, snapshot: s, label: "Opponent ML", min: \.oppMlMin, max: \.oppMlMax, onChange: onChange)
        }

        if mlApplies, !s.mlMin.isEmpty || !s.mlMax.isEmpty {
            let fmt: (String) -> String = { raw in
                guard let n = Double(raw) else { return raw }
                return n > 0 ? "+\(Int(n))" : "\(Int(n))"
            }
            let label: String
            if !s.mlMin.isEmpty && !s.mlMax.isEmpty {
                label = "ML \(fmt(s.mlMin)) to \(fmt(s.mlMax))"
            } else if !s.mlMin.isEmpty {
                label = "ML ≥ \(fmt(s.mlMin))"
            } else {
                label = "ML ≤ \(fmt(s.mlMax))"
            }
            chips.append(.init(label: label) { s.mlMin = ""; s.mlMax = ""; onChange(s) })
        }

        if s.primetime != nil {
            chips.append(.init(label: "Primetime: \(s.primetime == true ? "Yes" : "No")") {
                s.primetime = nil; onChange(s)
            })
        }

        switch sport {
        case .nfl:
            if s.division != nil {
                chips.append(.init(label: "Divisional: \(s.division == true ? "Yes" : "No")") {
                    s.division = nil; onChange(s)
                })
            }
            if s.dome != "any" {
                chips.append(.init(label: s.dome == "dome" ? "Dome" : "Outdoor") {
                    s.dome = "any"; onChange(s)
                })
            }
            if s.precip != "any" {
                chips.append(.init(label: "Precip: \(s.precip)") { s.precip = "any"; onChange(s) })
            }
            if s.tempMin != -10 || s.tempMax != 100 {
                chips.append(.init(label: "Temp \(s.tempMin)–\(s.tempMax)°F") {
                    s.tempMin = -10; s.tempMax = 100; onChange(s)
                })
            }
    if (s.windMax != 60 || s.windMin != nil) {
                let lo = s.windMin ?? 0
                let label = lo > 0 && s.windMax < 60 ? "Wind \(lo)–\(s.windMax)"
                    : lo > 0 ? "Wind ≥ \(lo)" : "Wind ≤ \(s.windMax)"
                chips.append(.init(label: label) {
                    s.windMin = nil; s.windMax = 60; onChange(s)
                })
            }
            if s.restBye != "any" {
                let labels: [String: String] = [
                    "off_bye": "Off a bye", "pre_bye": "Before a bye", "short": "Short rest",
                ]
                chips.append(.init(label: labels[s.restBye] ?? s.restBye) { s.restBye = "any"; onChange(s) })
            }
            if s.coach != "any" {
                chips.append(.init(label: "Coach: \(s.coach)") { s.coach = "any"; onChange(s) })
            }
            if s.referee != "any" {
                chips.append(.init(label: "Ref: \(s.referee)") { s.referee = "any"; onChange(s) })
            }
            if s.lastResult != "any" {
                chips.append(.init(label: "Last game: \(s.lastResult == "won" ? "Won" : "Lost")") {
                    s.lastResult = "any"; onChange(s)
                })
            }
            if s.lastAts != "any" {
                chips.append(.init(label: "Last game: \(s.lastAts == "covered" ? "Covered" : "Didn't cover")") {
                    s.lastAts = "any"; onChange(s)
                })
            }
            if s.lastTotal != "any" {
                chips.append(.init(label: "Last game: \(s.lastTotal == "over" ? "Over" : "Under")") {
                    s.lastTotal = "any"; onChange(s)
                })
            }
            if s.lastRole != "any" {
                chips.append(.init(label: "Last game: \(s.lastRole == "favorite" ? "Favorite" : "Underdog")") {
                    s.lastRole = "any"; onChange(s)
                })
            }
            if let lastOt = s.lastOt {
                chips.append(.init(label: "Last game OT: \(lastOt ? "Yes" : "No")") {
                    s.lastOt = nil; onChange(s)
                })
            }
            if s.lastBlowout != "any" {
                chips.append(.init(label: "Last game: \(s.lastBlowout == "win" ? "Blowout win" : "Blowout loss")") {
                    s.lastBlowout = "any"; onChange(s)
                })
            }
            
            // B1: New NFL filter chips
            
            // Days of week
            for day in s.daysOfWeek {
                chips.append(.init(label: dayLabel(day)) {
                    s.daysOfWeek.removeAll { $0 == day }; onChange(s)
                })
            }
            
            // Team divisions
            for division in s.teamDivisions {
                chips.append(.init(label: division) {
                    s.teamDivisions.removeAll { $0 == division }; onChange(s)
                })
            }
            
            // Last game margin (replaces blowout for NFL)
            let defaultMargin = d.lastMargin
            if s.lastMargin != defaultMargin {
                let minStr = s.lastMargin[0] == defaultMargin[0] ? "" : "\(s.lastMargin[0])"
                let maxStr = s.lastMargin[1] == defaultMargin[1] ? "" : "\(s.lastMargin[1])"
                let label: String
                if !minStr.isEmpty && !maxStr.isEmpty {
                    label = "Last margin \(minStr)–\(maxStr)"
                } else if !minStr.isEmpty {
                    label = "Last margin ≥ \(minStr)"
                } else {
                    label = "Last margin ≤ \(maxStr)"
                }
                chips.append(.init(label: label) {
                    s.lastMargin = defaultMargin; onChange(s)
                })
            }
            
            // Season Record filters
            if s.winPct != [0, 100] {
                chips.append(.init(label: "Win% \(Int(s.winPct[0]))–\(Int(s.winPct[1]))%") {
                    s.winPct = [0, 100]; onChange(s)
                })
            }
            if s.winStreak != [0, 16] {
                chips.append(.init(label: "Win streak \(s.winStreak[0])–\(s.winStreak[1])") {
                    s.winStreak = [0, 16]; onChange(s)
                })
            }
            if s.lossStreak != [0, 16] {
                chips.append(.init(label: "Loss streak \(s.lossStreak[0])–\(s.lossStreak[1])") {
                    s.lossStreak = [0, 16]; onChange(s)
                })
            }
            if let above500 = s.above500 {
                chips.append(.init(label: above500 ? "Above .500" : "Below .500") {
                    s.above500 = nil; onChange(s)
                })
            }
            if let winPctGtOpp = s.winPctGtOpp {
                chips.append(.init(label: winPctGtOpp ? "Better record than opp" : "Worse record than opp") {
                    s.winPctGtOpp = nil; onChange(s)
                })
            }
            if s.ppg != d.ppg {
                chips.append(.init(label: "PPG \(trimmed(s.ppg[0]))–\(trimmed(s.ppg[1]))") {
                    s.ppg = d.ppg; onChange(s)
                })
            }
            if s.paPg != d.paPg {
                chips.append(.init(label: "PA/G \(trimmed(s.paPg[0]))–\(trimmed(s.paPg[1]))") {
                    s.paPg = d.paPg; onChange(s)
                })
            }
            if s.pointDiffPg != d.pointDiffPg {
                chips.append(.init(label: "Point diff \(trimmed(s.pointDiffPg[0]))–\(trimmed(s.pointDiffPg[1]))") {
                    s.pointDiffPg = d.pointDiffPg; onChange(s)
                })
            }
            if s.minGames > 0 {
                chips.append(.init(label: "Min \(s.minGames) games") {
                    s.minGames = 0; onChange(s)
                })
            }
            
            // Cover Profile filters
            if s.atsWinPct != [0, 100] {
                chips.append(.init(label: "ATS% \(Int(s.atsWinPct[0]))–\(Int(s.atsWinPct[1]))%") {
                    s.atsWinPct = [0, 100]; onChange(s)
                })
            }
            if s.atsWinStreak != [0, 16] {
                chips.append(.init(label: "ATS streak \(s.atsWinStreak[0])–\(s.atsWinStreak[1])") {
                    s.atsWinStreak = [0, 16]; onChange(s)
                })
            }
            if s.avgCoverMargin != d.avgCoverMargin {
                chips.append(.init(label: "Cover margin \(trimmed(s.avgCoverMargin[0]))–\(trimmed(s.avgCoverMargin[1]))") {
                    s.avgCoverMargin = d.avgCoverMargin; onChange(s)
                })
            }
            
            // Total Profile filters
            if s.overPct != [0, 100] {
                chips.append(.init(label: "Over% \(Int(s.overPct[0]))–\(Int(s.overPct[1]))%") {
                    s.overPct = [0, 100]; onChange(s)
                })
            }
            if s.overStreak != [0, 16] {
                chips.append(.init(label: "Over streak \(s.overStreak[0])–\(s.overStreak[1])") {
                    s.overStreak = [0, 16]; onChange(s)
                })
            }
            if s.underStreak != [0, 16] {
                chips.append(.init(label: "Under streak \(s.underStreak[0])–\(s.underStreak[1])") {
                    s.underStreak = [0, 16]; onChange(s)
                })
            }
            
            // Prior Year filters
            if s.prevWins != d.prevWins {
                chips.append(.init(label: "Prev wins \(s.prevWins[0])–\(s.prevWins[1])") {
                    s.prevWins = d.prevWins; onChange(s)
                })
            }
            if s.prevWinPct != [0, 100] {
                chips.append(.init(label: "Prev win% \(Int(s.prevWinPct[0]))–\(Int(s.prevWinPct[1]))%") {
                    s.prevWinPct = [0, 100]; onChange(s)
                })
            }
            if let madePlayoffs = s.madePlayoffsPrev {
                chips.append(.init(label: madePlayoffs ? "Made playoffs prev" : "Missed playoffs prev") {
                    s.madePlayoffsPrev = nil; onChange(s)
                })
            }
            if let moreWins = s.moreWinsThanOppPrev {
                chips.append(.init(label: moreWins ? "More wins than opp prev" : "Fewer wins than opp prev") {
                    s.moreWinsThanOppPrev = nil; onChange(s)
                })
            }
            
            // Head-to-Head filters
            if s.h2hLastWin != "any" {
                chips.append(.init(label: "H2H last: \(s.h2hLastWin == "yes" ? "Won" : "Lost")") {
                    s.h2hLastWin = "any"; onChange(s)
                })
            }
            if s.h2hLastAts != "any" {
                chips.append(.init(label: "H2H last: \(s.h2hLastAts == "yes" ? "Covered" : "Didn't cover")") {
                    s.h2hLastAts = "any"; onChange(s)
                })
            }
            if s.h2hLastOver != "any" {
                chips.append(.init(label: "H2H last: \(s.h2hLastOver == "yes" ? "Over" : "Under")") {
                    s.h2hLastOver = "any"; onChange(s)
                })
            }
            if let h2hHome = s.h2hLastHome {
                chips.append(.init(label: "H2H last: \(h2hHome ? "Home" : "Away")") {
                    s.h2hLastHome = nil; onChange(s)
                })
            }
            if let h2hFav = s.h2hLastFav {
                chips.append(.init(label: "H2H last: \(h2hFav ? "Favorite" : "Underdog")") {
                    s.h2hLastFav = nil; onChange(s)
                })
            }
            if let sameSeason = s.h2hSameSeason {
                chips.append(.init(label: "H2H: \(sameSeason ? "Same season" : "Different season")") {
                    s.h2hSameSeason = nil; onChange(s)
                })
            }
            if s.h2hSpreadCmp != "any" {
                chips.append(.init(label: "H2H spread: \(s.h2hSpreadCmp == "lower" ? "Lower" : "Higher")") {
                    s.h2hSpreadCmp = "any"; onChange(s)
                })
            }
            
            // Opponent Record filters  
            if s.oppWinPct != [0, 100] {
                chips.append(.init(label: "Opp win% \(Int(s.oppWinPct[0]))–\(Int(s.oppWinPct[1]))%") {
                    s.oppWinPct = [0, 100]; onChange(s)
                })
            }
            if s.oppOverPct != [0, 100] {
                chips.append(.init(label: "Opp over% \(Int(s.oppOverPct[0]))–\(Int(s.oppOverPct[1]))%") {
                    s.oppOverPct = [0, 100]; onChange(s)
                })
            }
            if s.oppWinStreak != [0, 16] {
                chips.append(.init(label: "Opp win streak \(s.oppWinStreak[0])–\(s.oppWinStreak[1])") {
                    s.oppWinStreak = [0, 16]; onChange(s)
                })
            }
            if s.oppPrevWinPct != [0, 100] {
                chips.append(.init(label: "Opp prev win% \(Int(s.oppPrevWinPct[0]))–\(Int(s.oppPrevWinPct[1]))%") {
                    s.oppPrevWinPct = [0, 100]; onChange(s)
                })
            }
            
            // Opponent Last Game filters
            if s.oppLastResult != "any" {
                chips.append(.init(label: "Opp last: \(s.oppLastResult == "won" ? "Won" : "Lost")") {
                    s.oppLastResult = "any"; onChange(s)
                })
            }
            if s.oppLastAts != "any" {
                chips.append(.init(label: "Opp last: \(s.oppLastAts == "covered" ? "Covered" : "Didn't cover")") {
                    s.oppLastAts = "any"; onChange(s)
                })
            }
            if s.oppLastTotal != "any" {
                chips.append(.init(label: "Opp last: \(s.oppLastTotal == "over" ? "Over" : "Under")") {
                    s.oppLastTotal = "any"; onChange(s)
                })
            }
            if s.oppLastRole != "any" {
                chips.append(.init(label: "Opp last: \(s.oppLastRole == "favorite" ? "Favorite" : "Underdog")") {
                    s.oppLastRole = "any"; onChange(s)
                })
            }
            if let oppLastOt = s.oppLastOt {
                chips.append(.init(label: "Opp last OT: \(oppLastOt ? "Yes" : "No")") {
                    s.oppLastOt = nil; onChange(s)
                })
            }
            let defaultOppMargin = d.oppLastMargin
            if s.oppLastMargin != defaultOppMargin {
                let minStr = s.oppLastMargin[0] == defaultOppMargin[0] ? "" : "\(s.oppLastMargin[0])"
                let maxStr = s.oppLastMargin[1] == defaultOppMargin[1] ? "" : "\(s.oppLastMargin[1])"
                let label: String
                if !minStr.isEmpty && !maxStr.isEmpty {
                    label = "Opp last margin \(minStr)–\(maxStr)"
                } else if !minStr.isEmpty {
                    label = "Opp last margin ≥ \(minStr)"
                } else {
                    label = "Opp last margin ≤ \(maxStr)"
                }
                chips.append(.init(label: label) {
                    s.oppLastMargin = defaultOppMargin; onChange(s)
                })
            }
        case .cfb:
            if s.conferenceGame != nil {
                chips.append(.init(label: "Conference game: \(s.conferenceGame == true ? "Yes" : "No")") {
                    s.conferenceGame = nil; onChange(s)
                })
            }
            if s.neutralSite != nil {
                chips.append(.init(label: "Neutral site: \(s.neutralSite == true ? "Yes" : "No")") {
                    s.neutralSite = nil; onChange(s)
                })
            }
            for conf in activeConferences(s) {
                chips.append(.init(label: conf) {
                    s.selectedConferences.removeAll { $0 == conf }
                    if s.selectedConferences.isEmpty { s.conference = "any" }
                    onChange(s)
                })
            }
            if s.tempMin != -10 || s.tempMax != 110 {
                chips.append(.init(label: "Temp \(s.tempMin)–\(s.tempMax)°F") {
                    s.tempMin = -10; s.tempMax = 110; onChange(s)
                })
            }
    if (s.windMax != 60 || s.windMin != nil) {
                let lo = s.windMin ?? 0
                let label = lo > 0 && s.windMax < 60 ? "Wind \(lo)–\(s.windMax)"
                    : lo > 0 ? "Wind ≥ \(lo)" : "Wind ≤ \(s.windMax)"
                chips.append(.init(label: label) {
                    s.windMin = nil; s.windMax = 60; onChange(s)
                })
            }
            if s.weather != "any" {
                let labels: [String: String] = ["clear": "Clear", "cloudy": "Cloudy", "rain": "Rain", "snow": "Snow"]
                chips.append(.init(label: "Weather: \(labels[s.weather] ?? s.weather)") { s.weather = "any"; onChange(s) })
            }
            if s.dome != "any" {
                chips.append(.init(label: s.dome == "dome" ? "Indoors / dome" : "Outdoors") { s.dome = "any"; onChange(s) })
            }
            if s.lastResult != "any" {
                chips.append(.init(label: "Last game: \(s.lastResult == "won" ? "Won" : "Lost")") {
                    s.lastResult = "any"; onChange(s)
                })
            }
            if s.lastAts != "any" {
                chips.append(.init(label: "Last game: \(s.lastAts == "covered" ? "Covered" : "Didn't cover")") {
                    s.lastAts = "any"; onChange(s)
                })
            }
            if s.lastTotal != "any" {
                chips.append(.init(label: "Last game: \(s.lastTotal == "over" ? "Over" : "Under")") {
                    s.lastTotal = "any"; onChange(s)
                })
            }
            if s.lastRole != "any" {
                chips.append(.init(label: "Last game: \(s.lastRole == "favorite" ? "Favorite" : "Underdog")") {
                    s.lastRole = "any"; onChange(s)
                })
            }
            if let lastOt = s.lastOt {
                chips.append(.init(label: "Last game OT: \(lastOt ? "Yes" : "No")") {
                    s.lastOt = nil; onChange(s)
                })
            }
            if s.lastBlowout != "any" {
                chips.append(.init(label: "Last game: \(s.lastBlowout == "win" ? "Blowout win" : "Blowout loss")") {
                    s.lastBlowout = "any"; onChange(s)
                })
            }
        case .mlb:
            if s.division != nil {
                chips.append(.init(label: "Division: \(s.division == true ? "Yes" : "No")") {
                    s.division = nil; onChange(s)
                })
            }
            if s.dome != "any" {
                chips.append(.init(label: s.dome == "dome" ? "Dome" : "Outdoor") {
                    s.dome = "any"; onChange(s)
                })
            }
            if s.tempMin != -10 || s.tempMax != 110 {
                chips.append(.init(label: "Temp \(s.tempMin)–\(s.tempMax)°F") {
                    s.tempMin = -10; s.tempMax = 110; onChange(s)
                })
            }
            if s.windMin != nil || s.windMax != 60 {
                chips.append(.init(label: "Wind") {
                    s.windMin = nil; s.windMax = 60; onChange(s)
                })
            }
        }

        return chips
    }
    
    // Helper for day labels (B1)
    private static func dayLabel(_ day: String) -> String {
        switch day {
        case "Sun": return "Sunday"
        case "Mon": return "Monday" 
        case "Tue": return "Tuesday"
        case "Wed": return "Wednesday"
        case "Thu": return "Thursday"
        case "Fri": return "Friday"
        case "Sat": return "Saturday"
        default: return day
        }
    }

    private static func appendSpreadChip(
        _ chips: inout [ActiveChip],
        snapshot: HistoricalAnalysisUISnapshot,
        label: String,
        side: WritableKeyPath<HistoricalAnalysisUISnapshot, String>,
        min: WritableKeyPath<HistoricalAnalysisUISnapshot, Double>,
        max: WritableKeyPath<HistoricalAnalysisUISnapshot, Double>,
        defaultMax: Double,
        onChange: @escaping (HistoricalAnalysisUISnapshot) -> Void
    ) {
        let currentSide = snapshot[keyPath: side]
        let currentMin = snapshot[keyPath: min]
        let currentMax = snapshot[keyPath: max]
        guard currentSide != "any" || currentMin > 0 || currentMax < defaultMax else { return }
        chips.append(.init(label: "\(label) \(currentSide == "any" ? "" : currentSide + " ")\(trimmed(currentMin))–\(trimmed(currentMax))") {
            var next = snapshot
            next[keyPath: side] = "any"
            next[keyPath: min] = 0
            next[keyPath: max] = defaultMax
            onChange(next)
        })
    }

    private static func appendRangeChip(
        _ chips: inout [ActiveChip],
        snapshot: HistoricalAnalysisUISnapshot,
        label: String,
        min: WritableKeyPath<HistoricalAnalysisUISnapshot, Double>,
        max: WritableKeyPath<HistoricalAnalysisUISnapshot, Double>,
        defaults: [Double],
        onChange: @escaping (HistoricalAnalysisUISnapshot) -> Void
    ) {
        guard snapshot[keyPath: min] != defaults[0] || snapshot[keyPath: max] != defaults[1] else { return }
        chips.append(.init(label: "\(label) \(trimmed(snapshot[keyPath: min]))–\(trimmed(snapshot[keyPath: max]))") {
            var next = snapshot
            next[keyPath: min] = defaults[0]
            next[keyPath: max] = defaults[1]
            onChange(next)
        })
    }

    private static func appendMoneylineChip(
        _ chips: inout [ActiveChip],
        snapshot: HistoricalAnalysisUISnapshot,
        label: String,
        min: WritableKeyPath<HistoricalAnalysisUISnapshot, String>,
        max: WritableKeyPath<HistoricalAnalysisUISnapshot, String>,
        onChange: @escaping (HistoricalAnalysisUISnapshot) -> Void
    ) {
        guard !snapshot[keyPath: min].isEmpty || !snapshot[keyPath: max].isEmpty else { return }
        chips.append(.init(label: label) {
            var next = snapshot
            next[keyPath: min] = ""
            next[keyPath: max] = ""
            onChange(next)
        })
    }

    static func headlineSubject(
        sport: HistoricalAnalysisSport,
        snapshot: HistoricalAnalysisUISnapshot
    ) -> String {
        let isGameTotal = ["fg_total", "h1_total", "total", "f5_total"].contains(snapshot.betType)

        // Game totals are game outcomes ("went over") — never "Favorites went over".
        if isGameTotal {
            switch sport {
            case .mlb where !snapshot.teams.isEmpty:
                return "\(snapshot.teams.joined(separator: ", ")) games"
            default:
                break
            }
            if snapshot.side != "any" {
                return snapshot.side == "home" ? "Home games" : "Road games"
            }
            return "Games"
        }

        var parts: [String] = []
        if snapshot.side != "any" { parts.append(snapshot.side == "home" ? "Home" : "Road") }
        let dir: String
        if ["fg_spread", "h1_spread"].contains(snapshot.betType) {
            dir = snapshot.spreadSide
        } else if ["fg_ml", "h1_ml", "ml", "f5_ml", "team_total"].contains(snapshot.betType) {
            dir = snapshot.favDog
        } else {
            dir = "any"
        }
        if dir != "any" { parts.append(dir == "favorite" ? "favorites" : "underdogs") }
        let situation = parts.joined(separator: " ")
        switch sport {
        case .nfl:
            if snapshot.coach != "any" {
                return "\(snapshot.coach)'s teams\(situation.isEmpty ? "" : " (\(situation.lowercased()))")"
            }
        case .cfb:
            let confs = activeConferences(snapshot)
            if !confs.isEmpty {
                return conferenceHeadlineSubject(confs, situation: situation)
            }
        case .mlb:
            if !snapshot.teams.isEmpty {
                let names = snapshot.teams.joined(separator: ", ")
                return "\(names)\(situation.isEmpty ? "" : " (\(situation.lowercased()))")"
            }
        }
        if !situation.isEmpty {
            return situation.prefix(1).uppercased() + situation.dropFirst()
        }
        return "Teams"
    }

    // MARK: - Narrative sentence (share infographic)

    /// "When"-style clauses built from the active filters, composed into
    /// "When {a}, {b}, and {c}, {subject} {verb} X% of the time."
    static func narrativeClauses(
        sport: HistoricalAnalysisSport,
        snapshot: HistoricalAnalysisUISnapshot
    ) -> [String] {
        var clauses: [String] = []
        let s = snapshot
        let betType = s.betType

        switch sport {
        case .nfl:
            if s.seasonType == "regular" { clauses.append("it's the regular season") }
            if s.seasonType == "postseason" {
                if s.playoffRound == "any" {
                    clauses.append("it's the playoffs")
                } else if s.playoffRound == "Super Bowl" {
                    clauses.append("it's the Super Bowl")
                } else {
                    clauses.append("it's the \(s.playoffRound) round")
                }
            }
            if s.seasonType == "regular", s.weekMin != 1 || s.weekMax != 18 {
                clauses.append(weekClause(s.weekMin, s.weekMax))
            }
            if let division = s.division {
                clauses.append(division ? "it's a divisional game" : "it's a non-divisional game")
            }
        case .cfb:
            switch s.gameType {
            case "regular": clauses.append("it's the regular season")
            case "bowl": clauses.append("it's a bowl game")
            case "playoff": clauses.append("it's a playoff game")
            case "postseason": clauses.append("it's the postseason")
            default: break
            }
            if s.gameType == "regular", s.weekMin != 1 || s.weekMax != 16 {
                clauses.append(weekClause(s.weekMin, s.weekMax))
            }
            switch s.rankedMatchup {
            case "both": clauses.append("both teams are ranked")
            case "neither": clauses.append("neither team is ranked")
            case "home_ranked": clauses.append("only the home team is ranked")
            case "away_ranked": clauses.append("only the away team is ranked")
            case "either": clauses.append("at least one team is ranked")
            default: break
            }
            if let confGame = s.conferenceGame {
                clauses.append(confGame ? "it's a conference game" : "it's a non-conference game")
            }
            if let neutral = s.neutralSite {
                clauses.append(neutral ? "it's at a neutral site" : "it's not at a neutral site")
            }
        case .mlb:
            if s.monthMin != 3 || s.monthMax != 11 {
                clauses.append("it's months \(s.monthMin)–\(s.monthMax)")
            }
            if s.dayOfWeek != "any" {
                clauses.append("it's a \(s.dayOfWeek)")
            }
            if let division = s.division {
                clauses.append(division ? "it's a division game" : "it's a non-division game")
            }
            if let interleague = s.interleague {
                clauses.append(interleague ? "it's interleague" : "it's not interleague")
            }
            if s.switchGame == true { clauses.append("it's a switch game") }
            if s.lastResult == "won" { clauses.append("they won their last game") }
            if s.lastResult == "lost" { clauses.append("they lost their last game") }
            if s.spHand != "any" { clauses.append("their starter is \(s.spHand)HP") }
            if s.oppSpHand != "any" { clauses.append("the opposing starter is \(s.oppSpHand)HP") }
            if !s.sp.isEmpty {
                clauses.append("starting \(s.sp.map(\.name).joined(separator: " / "))")
            }
            if !s.oppSp.isEmpty {
                clauses.append("facing \(s.oppSp.map(\.name).joined(separator: " / "))")
            }
        }

        if let primetime = s.primetime {
            clauses.append(primetime ? "it's primetime" : "it's not primetime")
        }

        if sport == .nfl {
            if s.dome == "dome" { clauses.append("the game is in a dome") }
            if s.dome == "outdoor" { clauses.append("the game is outdoors") }
            switch s.precip {
            case "rain": clauses.append("it's raining")
            case "snow": clauses.append("it's snowing")
            case "none": clauses.append("conditions are dry")
            default: break
            }
            switch s.restBye {
            case "off_bye": clauses.append("they're coming off a bye")
            case "pre_bye": clauses.append("it's the week before a bye")
            case "short": clauses.append("they're on short rest")
            default: break
            }
            if s.lastResult == "won" { clauses.append("they won their last game") }
            if s.lastResult == "lost" { clauses.append("they lost their last game") }
            if s.lastAts == "covered" { clauses.append("they covered last game") }
            if s.lastAts == "not" { clauses.append("they didn't cover last game") }
            if s.lastTotal == "over" { clauses.append("their last game went over") }
            if s.lastTotal == "under" { clauses.append("their last game went under") }
            if s.lastRole == "favorite" { clauses.append("they were favorites last game") }
            if s.lastRole == "underdog" { clauses.append("they were underdogs last game") }
            if s.lastBlowout == "win" { clauses.append("they blew out their last opponent") }
            if s.lastBlowout == "loss" { clauses.append("they were blown out last game") }
            if let lastOt = s.lastOt {
                clauses.append(lastOt ? "their last game went to OT" : "their last game didn't go to OT")
            }
            if s.referee != "any" { clauses.append("\(s.referee) is officiating") }
        }

        if sport == .mlb {
            if s.dome == "dome" { clauses.append("the game is in a dome") }
            if s.dome == "outdoor" { clauses.append("the game is outdoors") }
            if s.windDir != "any" { clauses.append("wind is \(s.windDir)") }
        }

        let tempDefaultMax: Int
        switch sport {
        case .nfl: tempDefaultMax = 100
        case .cfb, .mlb: tempDefaultMax = 110
        }
        if s.tempMin != -10 || s.tempMax != tempDefaultMax {
            clauses.append("it's \(s.tempMin)–\(s.tempMax)°F")
        }
        if s.windMin != nil || s.windMax != 60 {
            let lo = s.windMin ?? 0
            if lo > 0 && s.windMax < 60 {
                clauses.append("winds are \(lo)–\(s.windMax) mph")
            } else if lo > 0 {
                clauses.append("winds are at least \(lo) mph")
            } else {
                clauses.append("winds are under \(s.windMax) mph")
            }
        }

        if let spreadCfg = HistoricalAnalysisFilterBuilder.spreadConfig(sport: sport, betType: "fg_spread") {
            let lo = trimmed(s.spreadMin)
            let hi = trimmed(s.spreadMax)
            if s.spreadSide == "favorite" {
                clauses.append("they're laying \(lo)–\(hi) points")
            } else if s.spreadSide == "underdog" {
                clauses.append("they're getting \(lo)–\(hi) points")
            } else if s.spreadMin > 0.001 || s.spreadMax < spreadCfg.max - 0.001 {
                clauses.append("the spread is \(lo)–\(hi) points")
            }
        }

        if let totalCfg = HistoricalAnalysisFilterBuilder.totalConfig(sport: sport, betType: betType),
           s.lineMin > totalCfg.min + 0.001 || s.lineMax < totalCfg.max - 0.001 {
            clauses.append("the \(totalCfg.label.lowercased()) is \(trimmed(s.lineMin))–\(trimmed(s.lineMax))")
        }

        if !s.mlMin.isEmpty || !s.mlMax.isEmpty {
            let fmt: (String) -> String = { raw in
                guard let n = Double(raw) else { return raw }
                return n > 0 ? "+\(Int(n))" : "\(Int(n))"
            }
            if !s.mlMin.isEmpty && !s.mlMax.isEmpty {
                clauses.append("the moneyline is \(fmt(s.mlMin)) to \(fmt(s.mlMax))")
            } else if !s.mlMin.isEmpty {
                clauses.append("the moneyline is \(fmt(s.mlMin)) or better")
            } else {
                clauses.append("the moneyline is \(fmt(s.mlMax)) or worse")
            }
        }

        return clauses
    }

    private static func weekClause(_ min: Int, _ max: Int) -> String {
        min == max ? "it's week \(min)" : "it's weeks \(min)–\(max)"
    }

    /// Oxford-comma join: ["a","b","c"] → "a, b, and c".
    static func joinedClauses(_ clauses: [String]) -> String {
        switch clauses.count {
        case 0: return ""
        case 1: return clauses[0]
        case 2: return "\(clauses[0]) and \(clauses[1])"
        default: return clauses.dropLast().joined(separator: ", ") + ", and " + (clauses.last ?? "")
        }
    }

    /// Lowercase generic subjects mid-sentence; keep proper nouns intact.
    static func midSentenceSubject(_ subject: String) -> String {
        let generic: Set<String> = ["Home", "Road", "Favorites", "Underdogs", "Teams", "Games", "Home games", "Road games"]
        guard let first = subject.split(separator: " ").first, generic.contains(String(first)) else {
            return subject
        }
        return subject.prefix(1).lowercased() + subject.dropFirst()
    }

    static func scopeNote(
        sport: HistoricalAnalysisSport,
        snapshot: HistoricalAnalysisUISnapshot
    ) -> String {
        switch sport {
        case .nfl:
            var bits: [String] = []
            if snapshot.coach != "any" { bits.append("\(snapshot.coach)-coached teams") }
            if snapshot.referee != "any" { bits.append("games officiated by \(snapshot.referee)") }
            let who = bits.isEmpty ? "all teams" : bits.joined(separator: " · ")
            return "\(who) in every past game that matches your filters."
        case .cfb:
            let confs = activeConferences(snapshot)
            guard !confs.isEmpty else {
                return "All FBS teams in every past game that matches your filters."
            }
            let names = confs.count == 1 ? confs[0] : confs.joined(separator: ", ")
            switch snapshot.conferenceGame {
            case true:
                return "\(names) conference games only — matchups between schools in that conference."
            case false:
                return "\(names) schools in non-conference games only."
            default:
                if confs.count == 1 {
                    return "Every game a \(names) school played — non-conference, bowls, and more. Not \(names)-only matchups."
                }
                return "Every game involving a \(names) school — non-conference, bowls, and more."
            }
        case .mlb:
            if !snapshot.teams.isEmpty {
                let names = snapshot.teams.joined(separator: ", ")
                return "\(names) in every past game that matches your filters."
            }
            return "All MLB teams in every past game that matches your filters."
        }
    }
}
