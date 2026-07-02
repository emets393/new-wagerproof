import Foundation
import Supabase
import WagerproofModels

/// Reads for the Agents "Platform Statistics" screen. Population-level analytics
/// (every agent's win-rate / net-units distribution) — kept separate from the
/// per-agent / leaderboard reads in `AgentPerformanceService`.
///
/// Both calls hit whole-population / public RPCs added in
/// `20260701120000_agent_performance_distribution_rpc.sql`. The distribution
/// fetch returns raw per-agent rows once; all the screen's controls (threshold
/// slider, bin width, metric, sport) re-bucket in memory with no refetch.
public enum PlatformStatsService {
    /// Every agent with at least `minDecided` settled picks (wins+losses).
    /// `minDecided: 1` (the default) drops pending-only agents server-side; the
    /// interactive ≥N threshold is applied client-side on top of these rows.
    public static func fetchAgentDistribution(minDecided: Int = 1) async throws -> [AgentStatDatum] {
        let main = await MainSupabase.shared.client
        struct Params: Encodable { let p_min_decided: Int }
        let rows: [AgentStatDatum] = try await main
            .rpc("get_agent_performance_distribution", params: Params(p_min_decided: minDecided))
            .execute()
            .value
        return rows
    }

    /// Top public agents whose `metric` falls in `[lower, upper]`, ranked by net
    /// units, each with their currently-open (pending) picks — the tap-a-bar
    /// drill-down. `sport` scopes the returned pending picks (nil = all sports).
    public static func fetchBinAgents(
        metric: StatMetric,
        sport: AgentSport? = nil,
        lower: Double,
        upper: Double,
        minDecided: Int,
        limit: Int = 20
    ) async throws -> [BinAgent] {
        let main = await MainSupabase.shared.client
        struct Params: Encodable {
            let p_metric: String
            let p_sport: String?
            let p_lower: Double
            let p_upper: Double
            let p_min_decided: Int
            let p_limit: Int
        }
        let params = Params(
            p_metric: metric.sqlValue,
            p_sport: sport?.rawValue,
            p_lower: lower,
            p_upper: upper,
            p_min_decided: minDecided,
            p_limit: limit
        )
        let rows: [BinAgent] = try await main
            .rpc("get_distribution_bin_agents", params: params)
            .execute()
            .value
        return rows
    }
}

private extension StatMetric {
    /// The `p_metric` value the RPC expects (`avatar_performance_cache` column
    /// naming) — distinct from the Swift enum's rawValue.
    var sqlValue: String {
        switch self {
        case .winRate: return "win_rate"
        case .netUnits: return "net_units"
        }
    }
}
