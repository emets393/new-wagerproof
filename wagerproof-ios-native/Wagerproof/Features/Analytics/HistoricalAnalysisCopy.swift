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
        let verb = HistoricalAnalysisBetType.moneylineMarkets.contains(betType) ? "won" : "covered"
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
        default: return "hit"
        }
    }

    static func outcomeLabel(for betType: String) -> String {
        switch betType {
        case "fg_spread", "h1_spread": return "Cover"
        case "fg_ml", "h1_ml": return "Win"
        case "fg_total", "h1_total", "team_total": return "Over"
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
            || snapshot.betType == "team_total" {
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
        return ""
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
        let seasonMax = HistoricalAnalysisSport.seasonMax
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
        }

        if s.side != "any" {
            chips.append(.init(label: s.side == "home" ? "Home" : "Away") {
                s.side = "any"; onChange(s)
            })
        }

        if (HistoricalAnalysisBetType.moneylineMarkets.contains(betType) || betType == "team_total"),
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
            if s.tempMin != -10 || s.tempMax != (sport == .nfl ? 100 : 110) {
                chips.append(.init(label: "Temp \(s.tempMin)–\(s.tempMax)°F") {
                    s.tempMin = -10; s.tempMax = sport == .nfl ? 100 : 110; onChange(s)
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
        }

        return chips
    }

    static func headlineSubject(
        sport: HistoricalAnalysisSport,
        snapshot: HistoricalAnalysisUISnapshot
    ) -> String {
        var parts: [String] = []
        if snapshot.side != "any" { parts.append(snapshot.side == "home" ? "Home" : "Road") }
        let dir = ["fg_spread", "h1_spread"].contains(snapshot.betType) ? snapshot.spreadSide : snapshot.favDog
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
        }
        if !situation.isEmpty {
            return situation.prefix(1).uppercased() + situation.dropFirst()
        }
        let isTotal = ["fg_total", "h1_total"].contains(snapshot.betType)
        return isTotal ? "Games" : "Teams"
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
        }
    }
}
