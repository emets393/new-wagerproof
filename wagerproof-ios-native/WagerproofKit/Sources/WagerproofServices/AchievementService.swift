import Foundation
import Supabase
import WagerproofModels

public protocol AchievementServing: Sendable {
    func fetch() async throws -> AchievementSnapshot
    func acknowledge(_ ids: [String]) async throws
    func record(_ activity: AchievementActivity) async throws -> AchievementSnapshot
}

public struct AchievementService: AchievementServing {
    public init() {}
    public func acknowledge(_ ids: [String]) async throws {
        struct Params: Encodable { let achievement_ids: [String] }
        let client = await MainSupabase.shared.client
        _ = try await client.rpc("acknowledge_achievement_celebrations", params: Params(achievement_ids: ids)).execute()
    }
    public func fetch() async throws -> AchievementSnapshot {
        let client = await MainSupabase.shared.client
        return try await client.rpc("get_user_achievements").execute().value
    }
    public func record(_ activity: AchievementActivity) async throws -> AchievementSnapshot {
        struct Params: Encodable { let activity: String }
        let client = await MainSupabase.shared.client
        return try await client.rpc("record_achievement_activity", params: Params(activity: activity.rawValue))
            .execute().value
    }
}
