import Foundation
import Supabase
import WagerproofModels

public enum AgentPickFeedbackError: Error {
    case notSignedIn
}

/// Writes agent-detail "How did we do?" reports to `agent_pick_feedback`
/// on the main Supabase project so we can review pick quality periodically.
public enum AgentPickFeedbackService {
    public static func submit(
        userId: String,
        agent: Agent,
        items: [AgentBetItem],
        userDescription: String
    ) async throws {
        let main = await MainSupabase.shared.client
        let row = AgentPickFeedbackInsert(
            user_id: userId,
            agent_id: agent.id,
            agent_name: agent.name,
            user_description: userDescription,
            picks_snapshot: items.prefix(25).map(PickSnapshot.init),
            agent_snapshot: AgentSnapshot(agent: agent),
            platform: "ios"
        )
        _ = try await main
            .from("agent_pick_feedback")
            .insert(row)
            .execute()
    }
}

private struct AgentPickFeedbackInsert: Encodable {
    let user_id: String
    let agent_id: String
    let agent_name: String
    let user_description: String
    let picks_snapshot: [PickSnapshot]
    let agent_snapshot: AgentSnapshot
    let platform: String
}

private struct AgentSnapshot: Encodable {
    let name: String
    let avatar_emoji: String
    let preferred_sports: [String]
    let archetype: String?

    init(agent: Agent) {
        self.name = agent.name
        self.avatar_emoji = agent.avatarEmoji
        self.preferred_sports = agent.preferredSports.map(\.rawValue)
        self.archetype = agent.archetype?.rawValue
    }
}

private struct PickSnapshot: Encodable {
    let id: String
    let kind: String
    let matchup: String?
    let selection: String?
    let bet_type: String?
    let odds: String?
    let units: Double
    let sport: String?
    let game_date: String
    let result: String

    init(_ item: AgentBetItem) {
        switch item {
        case .pick(let pick):
            self.id = pick.id
            self.kind = "pick"
            self.matchup = pick.matchup
            self.selection = pick.pickSelection
            self.bet_type = pick.betType
            self.odds = pick.odds
            self.units = pick.units
            self.sport = pick.sport.rawValue
            self.game_date = pick.gameDate
            self.result = pick.result.rawValue
        case .parlay(let parlay):
            self.id = parlay.id
            self.kind = "parlay"
            self.matchup = parlay.legs.map(\.matchup).joined(separator: " + ")
            self.selection = "\(parlay.legsCount)-leg parlay"
            self.bet_type = "parlay"
            self.odds = parlay.combinedOdds
            self.units = parlay.units
            self.sport = parlay.sport.rawValue
            self.game_date = parlay.targetDate
            self.result = parlay.result.rawValue
        }
    }
}
