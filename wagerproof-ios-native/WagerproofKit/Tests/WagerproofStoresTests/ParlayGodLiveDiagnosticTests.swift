import XCTest
import WagerproofModels
@testable import WagerproofServices

/// Live-network diagnostic (hits the real CFB Supabase) — run manually via
/// `-only-testing:...ParlayGodLiveDiagnosticTests` when a Parlay God surface
/// looks empty in-app; asserts each leg source produces something and surfaces
/// the underlying fetch error instead of the store's silent `try?`.
final class ParlayGodLiveDiagnosticTests: XCTestCase {
    func testLiveMLBBundleProducesTeamLegs() async throws {
        // Opt-in only — live network + slate-dependent, would flake CI runs.
        try XCTSkipUnless(ProcessInfo.processInfo.environment["PG_LIVE_DIAG"] == "1",
                          "Set PG_LIVE_DIAG=1 to run the live diagnostic")
        let bundle: MLBTrendsSlateBundle
        do {
            bundle = try await OutliersTrendsService.shared.fetchMLBBundle()
        } catch {
            XCTFail("fetchMLBBundle threw: \(error)")
            return
        }
        print("PGDIAG games=\(bundle.games.count) teams=\(bundle.teams.count) through=\(bundle.throughDate ?? "nil")")
        let legs = ParlayGodEngine.teamLegs(bundle: bundle)
        print("PGDIAG teamLegs=\(legs.count)")
        for leg in legs.prefix(6) {
            print("PGDIAG leg: \(leg.category.rawValue) | \(leg.subject) \(leg.betText) \(leg.oddsText) | \(leg.evidence)")
        }
        XCTAssertFalse(bundle.games.isEmpty, "slate games empty")
        XCTAssertFalse(bundle.teams.isEmpty, "team trend records empty")
        XCTAssertFalse(legs.isEmpty, "no team legs extracted")
    }
}
