import XCTest
@testable import WagerproofModels

final class PaywallPlacementRouteTests: XCTestCase {
    func testNoOfferingIsNeverReplacedEvenWhenRolloutEnabled() {
        XCTAssertEqual(PaywallPlacementRoute.resolve(offeringID: nil, tieredEnabled: true, catalogReady: true), .none)
    }

    func testLegacyAudienceKeepsLegacyRendererWithExperimentEnabled() {
        XCTAssertEqual(PaywallPlacementRoute.resolve(offeringID: "hardPaywall", tieredEnabled: true, catalogReady: true), .legacy)
    }

    func testTieredRequiresBothRolloutAndStoreReadiness() {
        for enabled in [false, true] {
            for ready in [false, true] {
                XCTAssertEqual(
                    PaywallPlacementRoute.resolve(offeringID: "wagerproof_tiers_v1", tieredEnabled: enabled, catalogReady: ready),
                    enabled && ready ? .tiered : .unavailable
                )
            }
        }
    }
}
