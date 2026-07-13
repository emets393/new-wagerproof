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
        if betType == "fg_spread", let sp = game.teamSpread {
            return "\(t) \(sp > 0 ? "+" : "")\(trimmed(sp))"
        }
        if betType == "fg_ml" {
            return "\(t) ML (\(game.isFavorite ? "favorite" : "underdog"))"
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
            return "\(t) 1H ML (\(game.isFavorite ? "favorite" : "underdog"))"
        }
        if betType == "h1_total" {
            return "1H Total O/U \(game.h1Total.map(trimmed) ?? "—")"
        }
        if betType == "ml" {
            return "\(t) ML (\(game.isFavorite ? "fav" : "dog"))"
        }
        if betType == "rl" {
            return "\(t) RL \(game.isFavorite ? "−1.5" : "+1.5")"
        }
        if betType == "total" {
            return "Total O/U \(game.total.map(trimmed) ?? "—")"
        }
        if betType == "f5_ml" {
            return "\(t) F5 ML"
        }
        if betType == "f5_rl" {
            return "\(t) F5 RL \(game.isFavorite ? "−0.5" : "+0.5")"
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
        let betType = s.betType
        let weekMax = sport == .nfl ? 18 : 16
        let seasonMax = sport.seasonMax
        let spreadCfg = HistoricalAnalysisFilterBuilder.spreadConfig(sport: sport, betType: betType)
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
            for team in s.teams {
                chips.append(.init(label: team) {
                    s.teams.removeAll { $0 == team }; onChange(s)
                })
            }
            for opp in s.opponents {
                chips.append(.init(label: "vs \(opp)") {
                    s.opponents.removeAll { $0 == opp }; onChange(s)
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

        if s.side != "any" {
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

        if !s.mlMin.isEmpty || !s.mlMax.isEmpty {
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
            if s.windMax != 60 {
                chips.append(.init(label: "Wind ≤ \(s.windMax)") { s.windMax = 60; onChange(s) })
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
            if s.windMax != 60 {
                chips.append(.init(label: "Wind ≤ \(s.windMax)") { s.windMax = 60; onChange(s) })
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

    static func headlineSubject(
        sport: HistoricalAnalysisSport,
        snapshot: HistoricalAnalysisUISnapshot
    ) -> String {
        var parts: [String] = []
        if snapshot.side != "any" { parts.append(snapshot.side == "home" ? "Home" : "Road") }
        let dir: String
        if ["fg_spread", "h1_spread"].contains(snapshot.betType) {
            dir = snapshot.spreadSide
        } else {
            dir = snapshot.favDog
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
        let isTotal = ["fg_total", "h1_total", "total", "f5_total"].contains(snapshot.betType)
        return isTotal ? "Games" : "Teams"
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
        if s.windMax != 60 { clauses.append("winds are under \(s.windMax) mph") }

        if let spreadCfg = HistoricalAnalysisFilterBuilder.spreadConfig(sport: sport, betType: betType) {
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
        let generic: Set<String> = ["Home", "Road", "Favorites", "Underdogs", "Teams", "Games"]
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
