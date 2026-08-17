import Foundation
import Supabase
import WagerproofModels

/// Reads and writes `profiles.preferred_sportsbooks` for the signed-in user.
/// Local `UserDefaults` stays the instant cache; this is the account copy so
/// app and website show the same books.
public actor SportsbookPreferenceService {
    public static let shared = SportsbookPreferenceService()
    public init() {}

    private struct Row: Decodable {
        let preferredSportsbooks: [String]?
        enum CodingKeys: String, CodingKey {
            case preferredSportsbooks = "preferred_sportsbooks"
        }
    }

    private struct Payload: Encodable {
        let preferredSportsbooks: [String]
        enum CodingKeys: String, CodingKey {
            case preferredSportsbooks = "preferred_sportsbooks"
        }
    }

    /// Pull the profile row. `NULL` on the column means this account has never
    /// saved a list — seed it from this device if the device already has one.
    /// A network miss leaves the local cache alone.
    public func hydrate(userId: UUID) async {
        let client = await MainSupabase.shared.client
        do {
            let row: Row = try await client
                .from("profiles")
                .select("preferred_sportsbooks")
                .eq("user_id", value: userId)
                .single()
                .execute()
                .value
            if let remote = row.preferredSportsbooks {
                await MainActor.run {
                    SportsbookPreference.selectedBookKeys = SportsbookPreference.decode(remote)
                }
            } else {
                let local = await MainActor.run { SportsbookPreference.selectedBookKeys }
                if !local.isEmpty {
                    await save(userId: userId, keys: local)
                }
            }
        } catch {
            // Offline / no profile row yet — keep whatever this device already has.
        }
    }

    public func save(userId: UUID, keys: Set<String>) async {
        let client = await MainSupabase.shared.client
        _ = try? await client
            .from("profiles")
            .update(Payload(preferredSportsbooks: keys.sorted()))
            .eq("user_id", value: userId)
            .execute()
    }
}
