import Foundation
import Observation
import Supabase
import WagerproofModels
import WagerproofServices

/// Loads NBA matchup overview data: injury report + recent trends for the
/// open NBAGameBottomSheet. Mirrors RN `hooks/useNBAMatchupOverview.ts`
/// end-to-end:
///
///   - Injuries: `nba_injury_report` filtered by `team_name IN (away, home)`,
///     `game_date_et = normalizeDateString(game_date)`, `bucket = 'current'`.
///   - Trends:   single-row select against `nba_input_values_view` on
///     `(game_date, away_team, home_team)`.
///
/// The store is per-sheet — it's owned by the bottom sheet view and reset
/// each time the user opens a different game. Cumulative injury impact
/// scores are computed here (matches RN's `calculateInjuryImpact` helper).
@Observable
@MainActor
public final class NBAMatchupOverviewStore {
    public enum LoadState: Equatable, Sendable {
        case idle, loading, loaded, failed(String)
    }

    public private(set) var awayInjuries: [NBAInjuryReport] = []
    public private(set) var homeInjuries: [NBAInjuryReport] = []
    public private(set) var trends: NBAGameTrends?
    public private(set) var awayInjuryImpact: Double = 0
    public private(set) var homeInjuryImpact: Double = 0
    public private(set) var injuriesState: LoadState = .idle
    public private(set) var trendsState: LoadState = .idle

    public init() {}

    public func reset() {
        awayInjuries = []
        homeInjuries = []
        trends = nil
        awayInjuryImpact = 0
        homeInjuryImpact = 0
        injuriesState = .idle
        trendsState = .idle
    }

    /// Mirrors RN's mount-time effect: fetch injuries + trends in parallel
    /// whenever `awayTeam`, `homeTeam`, `gameDate`, and `isOpen` are all
    /// truthy. We model "isOpen" by callers only invoking this method.
    public func load(awayTeam: String?, homeTeam: String?, gameDate: String?) async {
        guard let awayTeam = awayTeam?.trimmingCharacters(in: .whitespaces),
              !awayTeam.isEmpty,
              let homeTeam = homeTeam?.trimmingCharacters(in: .whitespaces),
              !homeTeam.isEmpty,
              let rawDate = gameDate,
              !rawDate.isEmpty else {
            reset()
            return
        }
        #if DEBUG
        // Dummy Data Mode: real captured injuries + a synthesized recent-trends
        // payload so the matchup overview + injury widgets populate offseason.
        if DummyDataMode.isEnabled {
            let (away, home) = DummyData.nbaInjuries(awayTeam: awayTeam, homeTeam: homeTeam)
            self.awayInjuries = away
            self.homeInjuries = home
            self.awayInjuryImpact = Self.calculateInjuryImpact(away)
            self.homeInjuryImpact = Self.calculateInjuryImpact(home)
            self.injuriesState = .loaded
            self.trends = DummyData.nbaRecentTrends(awayTeam: awayTeam, homeTeam: homeTeam)
            self.trendsState = .loaded
            return
        }
        #endif
        let normalized = Self.normalizeDateString(rawDate)
        await withTaskGroup(of: Void.self) { group in
            group.addTask { @MainActor in
                await self.loadInjuries(awayTeam: awayTeam, homeTeam: homeTeam, normalizedDate: normalized)
            }
            group.addTask { @MainActor in
                await self.loadTrends(awayTeam: awayTeam, homeTeam: homeTeam, normalizedDate: normalized)
            }
            await group.waitForAll()
        }
    }

    private func loadInjuries(awayTeam: String, homeTeam: String, normalizedDate: String) async {
        injuriesState = .loading
        let cfb = await CFBSupabase.shared.client
        do {
            let rows: [NBAInjuryReport] = try await cfb
                .from("nba_injury_report")
                .select("player_name, avg_pie_season, status, team_id, team_name, team_abbr")
                .in("team_name", values: [awayTeam, homeTeam])
                .eq("game_date_et", value: normalizedDate)
                .eq("bucket", value: "current")
                .execute()
                .value
            let away = rows.filter { $0.teamName.compare(awayTeam, options: .caseInsensitive) == .orderedSame }
            let home = rows.filter { $0.teamName.compare(homeTeam, options: .caseInsensitive) == .orderedSame }
            self.awayInjuries = away
            self.homeInjuries = home
            self.awayInjuryImpact = Self.calculateInjuryImpact(away)
            self.homeInjuryImpact = Self.calculateInjuryImpact(home)
            self.injuriesState = .loaded
        } catch {
            self.injuriesState = .failed(error.localizedDescription)
        }
    }

    private func loadTrends(awayTeam: String, homeTeam: String, normalizedDate: String) async {
        trendsState = .loading
        let cfb = await CFBSupabase.shared.client
        // RN uses `maybeSingle`. supabase-swift returns a single row by
        // executing a normal select and reading the first element.
        let select = """
            home_ovr_rtg, away_ovr_rtg, \
            home_consistency, away_consistency, \
            home_win_streak, away_win_streak, \
            home_ats_pct, away_ats_pct, \
            home_ats_streak, away_ats_streak, \
            home_last_margin, away_last_margin, \
            home_over_pct, away_over_pct, \
            home_adj_pace_pregame_l3_trend, away_adj_pace_pregame_l3_trend, \
            home_adj_off_rtg_pregame_l3_trend, away_adj_off_rtg_pregame_l3_trend, \
            home_adj_def_rtg_pregame_l3_trend, away_adj_def_rtg_pregame_l3_trend
            """
        do {
            let rows: [NBAGameTrends] = try await cfb
                .from("nba_input_values_view")
                .select(select)
                .eq("game_date", value: normalizedDate)
                .eq("away_team", value: awayTeam)
                .eq("home_team", value: homeTeam)
                .execute()
                .value
            self.trends = rows.first
            self.trendsState = .loaded
        } catch {
            self.trends = nil
            self.trendsState = .failed(error.localizedDescription)
        }
    }

    /// Cumulative Injury Impact Score = sum of -PIE values. Mirrors RN's
    /// `calculateInjuryImpact` exactly.
    private static func calculateInjuryImpact(_ injuries: [NBAInjuryReport]) -> Double {
        if injuries.isEmpty { return 0 }
        return injuries.reduce(0.0) { sum, injury in
            guard let pie = injury.pieValue else { return sum }
            return sum + (-pie)
        }
    }

    /// Normalize date string to `YYYY-MM-DD` matching RN behavior. Mirrors
    /// `normalizeDateString` in the original hook.
    static func normalizeDateString(_ dateStr: String) -> String {
        var normalized = dateStr
        if dateStr.contains("T") {
            normalized = dateStr.components(separatedBy: "T").first ?? dateStr
        } else if dateStr.contains(" ") {
            normalized = dateStr.components(separatedBy: " ").first ?? dateStr
        }
        let pattern = #"^\d{4}-\d{2}-\d{2}$"#
        if normalized.range(of: pattern, options: .regularExpression) == nil {
            // Fallback: try to reformat via Date.
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            let parsed = iso.date(from: dateStr) ?? ISO8601DateFormatter().date(from: dateStr)
            if let date = parsed {
                let f = DateFormatter()
                f.locale = Locale(identifier: "en_US_POSIX")
                f.timeZone = TimeZone(identifier: "America/New_York")
                f.dateFormat = "yyyy-MM-dd"
                return f.string(from: date)
            }
        }
        return normalized
    }

    #if DEBUG
    public func debugSet(
        awayInjuries: [NBAInjuryReport] = [],
        homeInjuries: [NBAInjuryReport] = [],
        trends: NBAGameTrends? = nil
    ) {
        self.awayInjuries = awayInjuries
        self.homeInjuries = homeInjuries
        self.trends = trends
        self.awayInjuryImpact = Self.calculateInjuryImpact(awayInjuries)
        self.homeInjuryImpact = Self.calculateInjuryImpact(homeInjuries)
        self.injuriesState = .loaded
        self.trendsState = .loaded
    }
    #endif
}
