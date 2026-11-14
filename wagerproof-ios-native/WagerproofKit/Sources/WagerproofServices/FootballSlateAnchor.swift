import Foundation
import Supabase

/// Which (season, week) of a week-keyed football table a surface should show.
///
/// ONE rule everywhere: the soonest UPCOMING kickoff, with a 6-hour grace so a game stays
/// selected while it is being played, falling back to the latest week only when nothing is
/// upcoming (end of season).
///
/// Why this is not "latest season desc, week desc": that was safe only while the pipeline
/// wrote one week at a time. The Monday preview build (owner 2026-09-21) publishes NEXT
/// week's slate on Monday morning while the current week's Monday-night game is still
/// pending — a max-week anchor would jump the scoreboard, Outliers and the props surfaces
/// to next week and drop that game, which is still live and still bettable.
///
/// Mirrors `src/features/games/api/footballSlate.ts` on web and `GamesStore`'s feed anchor.
public enum FootballSlateAnchor {
    public struct Week: Sendable, Equatable {
        public let season: Int
        public let week: Int
        public init(season: Int, week: Int) {
            self.season = season
            self.week = week
        }
    }

    private struct Row: Decodable, Sendable {
        let season: Int?
        let week: Int?
    }

    /// Tables this applies to: `nfl_slate_feed`, `cfb_slate_feed`, `nfl_prop_player_pages`.
    /// All three are week-keyed with a `kickoff` column.
    public static func currentWeek(_ client: SupabaseClient, table: String) async -> Week? {
        let grace = Date().addingTimeInterval(-6 * 60 * 60)
        let graceIso = ISO8601DateFormatter().string(from: grace)
        let upcoming: [Row] = (try? await client
            .from(table)
            .select("season,week,kickoff")
            .gte("kickoff", value: graceIso)
            .order("kickoff", ascending: true)
            .limit(1)
            .execute()
            .value) ?? []
        if let row = upcoming.first, let season = row.season, let week = row.week {
            return Week(season: season, week: week)
        }
        let latest: [Row] = (try? await client
            .from(table)
            .select("season,week")
            .order("season", ascending: false)
            .order("week", ascending: false)
            .limit(1)
            .execute()
            .value) ?? []
        if let row = latest.first, let season = row.season, let week = row.week {
            return Week(season: season, week: week)
        }
        return nil
    }
}
