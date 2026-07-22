import Foundation
import Supabase
import WagerproofModels

/// Per-user saved analysis systems on the main (auth) Supabase project.
/// See `.claude/docs/trends-systems/07_SYSTEMS_LEADERBOARD.md`.
///
/// A saved system = UI filter snapshot + an explicit bet-side + the EXACT
/// warehouse payload (`rpc_bet_type` / `rpc_filters`) so the nightly grader
/// reproduces the page's numbers. Filters are immutable post-save — only
/// `name` and `is_public` may be updated.
public enum HistoricalAnalysisSavedFiltersService {
    public static let maxPerUser = 25

    public static func fetch(
        sport: HistoricalAnalysisSport,
        userId: UUID
    ) async throws -> [HistoricalAnalysisSavedFilter] {
        let client = await MainSupabase.shared.client
        do {
            // Decode per-row so one legacy / web-shaped snapshot cannot blank the
            // entire My Systems list (array `.value` is all-or-nothing).
            let data = try await client
                .from(sport.savedFiltersTable)
                .select("id, user_id, name, bet_type, filters, verdict, rpc_bet_type, rpc_filters, is_public, since_saved, created_at")
                .eq("user_id", value: userId)
                .order("created_at", ascending: false)
                .execute()
                .data
            let rows = try JSONDecoder().decode([FailableSavedFilter].self, from: data)
            let decoded = rows.compactMap(\.value)
            if decoded.count != rows.count {
                print("[HistoricalAnalysisSavedFiltersService.fetch] dropped \(rows.count - decoded.count)/\(rows.count) undecodable rows for \(sport.rawValue)")
            }
            return decoded
        } catch {
            print("[HistoricalAnalysisSavedFiltersService.fetch] \(error)")
            throw error
        }
    }

    /// Wrapper so a single bad row never fails the whole My Systems payload.
    private struct FailableSavedFilter: Decodable {
        let value: HistoricalAnalysisSavedFilter?
        init(from decoder: Decoder) throws {
            value = try? HistoricalAnalysisSavedFilter(from: decoder)
        }
    }

    /// Legacy bookmark save (no bet-side tracking). Prefer `saveSystem`.
    public static func save(
        sport: HistoricalAnalysisSport,
        userId: UUID,
        name: String,
        betType: String,
        snapshot: HistoricalAnalysisUISnapshot
    ) async throws {
        let client = await MainSupabase.shared.client
        struct Insert: Encodable {
            let user_id: UUID
            let name: String
            let bet_type: String
            let filters: HistoricalAnalysisUISnapshot
        }
        try await client
            .from(sport.savedFiltersTable)
            .insert(Insert(user_id: userId, name: name, bet_type: betType, filters: snapshot))
            .execute()
    }

    /// Insert a tracked system. Returns the new row id.
    @discardableResult
    public static func saveSystem(
        sport: HistoricalAnalysisSport,
        userId: UUID,
        name: String,
        betType: String,
        snapshot: HistoricalAnalysisUISnapshot,
        verdict: AnalysisSystemVerdict,
        rpcBetType: String,
        rpcFilters: [String: JSONValue],
        isPublic: Bool
    ) async throws -> UUID {
        let client = await MainSupabase.shared.client
        struct Insert: Encodable {
            let user_id: UUID
            let name: String
            let bet_type: String
            let filters: HistoricalAnalysisUISnapshot
            let verdict: String
            let rpc_bet_type: String
            let rpc_filters: [String: JSONValue]
            let is_public: Bool
        }
        struct Row: Decodable { let id: UUID }
        do {
            let row: Row = try await client
                .from(sport.savedFiltersTable)
                .insert(
                    Insert(
                        user_id: userId,
                        name: name.trimmingCharacters(in: .whitespacesAndNewlines),
                        bet_type: betType,
                        filters: snapshot,
                        verdict: verdict.rawValue,
                        rpc_bet_type: rpcBetType,
                        rpc_filters: rpcFilters,
                        is_public: isPublic
                    )
                )
                .select("id")
                .single()
                .execute()
                .value
            return row.id
        } catch {
            print("[HistoricalAnalysisSavedFiltersService.saveSystem] \(error)")
            throw error
        }
    }

    public static func rename(
        sport: HistoricalAnalysisSport,
        id: UUID,
        name: String
    ) async throws {
        let client = await MainSupabase.shared.client
        struct Patch: Encodable { let name: String }
        try await client
            .from(sport.savedFiltersTable)
            .update(Patch(name: name.trimmingCharacters(in: .whitespacesAndNewlines)))
            .eq("id", value: id)
            .execute()
    }

    public static func setPublic(
        sport: HistoricalAnalysisSport,
        id: UUID,
        isPublic: Bool
    ) async throws {
        let client = await MainSupabase.shared.client
        struct Patch: Encodable { let is_public: Bool }
        try await client
            .from(sport.savedFiltersTable)
            .update(Patch(is_public: isPublic))
            .eq("id", value: id)
            .execute()
    }

    public static func delete(
        sport: HistoricalAnalysisSport,
        id: UUID
    ) async throws {
        let client = await MainSupabase.shared.client
        try await client
            .from(sport.savedFiltersTable)
            .delete()
            .eq("id", value: id)
            .execute()
    }

    /// Public Systems Leaderboard — MAIN client, anon-callable. Numbers are
    /// grader-computed; never recompute client-side.
    public static func fetchLeaderboard(
        sport: HistoricalAnalysisSport,
        limit: Int = 50
    ) async throws -> [AnalysisSystemsLeaderboardRow] {
        let client = await MainSupabase.shared.client
        struct Params: Encodable {
            let p_sport: String
            let p_limit: Int
        }
        return try await client
            .rpc(
                "analysis_systems_leaderboard",
                params: Params(p_sport: sport.rawValue, p_limit: limit)
            )
            .execute()
            .value
    }

    /// Fire-and-forget: score the caller's systems so Share-on doesn't wait for nightly cron.
    public static func requestGrade() async {
        let client = await MainSupabase.shared.client
        do {
            try await client.functions.invoke(
                "grade-analysis-systems",
                options: FunctionInvokeOptions(body: [String: String]())
            )
        } catch {
            print("[HistoricalAnalysisSavedFiltersService.requestGrade] \(error)")
        }
    }
}
