import Foundation
import XCTest
@testable import WagerproofModels

final class AchievementTests: XCTestCase {
    func testCatalogHas24UniqueAssetsAcrossSixFamilies() {
        let entries = AchievementCatalog.definitions
        XCTAssertEqual(entries.count, 24)
        XCTAssertEqual(Set(entries.map(\.id)).count, 24)
        XCTAssertEqual(Set(entries.map(\.variantRoot)).count, 24)
        XCTAssertEqual(Set(entries.map(\.group)).count, 6)
        XCTAssertTrue(entries.allSatisfy { $0.target > 0 && !$0.requirement.isEmpty })
    }
    func testInvalidOrExtremeProgressIsSafeAndNeverEarns() {
        let definition = AchievementCatalog.definitions[0]
        for (progress, expected) in [(Double.nan, 0.0), (.infinity, 0), (-1, 0), (3, 1)] {
            let achievement = Achievement(definition: definition, status: .init(id: definition.id, progress: progress))
            XCTAssertEqual(achievement.fraction, expected)
            XCTAssertFalse(achievement.earned)
        }
    }
    func testSnapshotRoundTripPreservesBackfillCreditAndPendingIDs() throws {
        let date = Date(timeIntervalSince1970: 1_800_000_000), agent = UUID()
        let status = AchievementStatus(id: "first-agent", earnedAt: date, isBackfilled: true, creditedAgentId: agent)
        let original = AchievementSnapshot(initializedAt: date, generatedAt: date, achievements: [status], newlyUnlockedIds: ["first-agent"])
        let restored = try JSONDecoder().decode(AchievementSnapshot.self, from: JSONEncoder().encode(original))
        XCTAssertEqual(restored.achievements, [status])
        XCTAssertEqual(restored.newlyUnlockedIds, ["first-agent"])
        XCTAssertEqual(restored.generatedAt, date)
    }
}
