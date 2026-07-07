import Foundation
import Supabase
import WagerproofModels

/// Per-user saved filter views on the main (auth) Supabase project.
public enum HistoricalAnalysisSavedFiltersService {
    public static let maxPerUser = 25

    public static func fetch(
        sport: HistoricalAnalysisSport,
        userId: UUID
    ) async throws -> [HistoricalAnalysisSavedFilter] {
        let client = await MainSupabase.shared.client
        return try await client
            .from(sport.savedFiltersTable)
            .select()
            .eq("user_id", value: userId)
            .order("created_at", ascending: false)
            .execute()
            .value
    }

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
}
