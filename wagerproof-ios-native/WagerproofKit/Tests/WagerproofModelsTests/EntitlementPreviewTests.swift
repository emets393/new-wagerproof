import XCTest
@testable import WagerproofModels

final class EntitlementPreviewTests: XCTestCase {
    func testPreviewOverridesAdminAndRealProWithoutChangingInputs() {
        for mode in EntitlementPreview.allCases where mode != .actual {
            let state = SubscriptionAccessState.resolve(tier: .pro, isTiered: false, isAdmin: true,
                                                        forceFree: true, preview: mode, previewAvailable: true)
            XCTAssertFalse(state.isAdmin)
            XCTAssertEqual(state.tier, mode.tier)
            XCTAssertEqual(state.isTiered, mode.isTiered)
            for minimum in SubscriptionTier.allCases {
                XCTAssertEqual(state.hasAccess(to: minimum), mode.tier?.includes(minimum) == true)
                XCTAssertEqual(state.isRestricted(minimum), mode.isTiered && mode.tier?.includes(minimum) != true)
            }
        }
    }

    func testAppStoreBuildIgnoresEveryPreview() {
        for mode in EntitlementPreview.allCases {
            let state = SubscriptionAccessState.resolve(tier: .standard, isTiered: true, isAdmin: false,
                                                        forceFree: false, preview: mode, previewAvailable: false)
            XCTAssertEqual(state.tier, .standard)
            XCTAssertTrue(state.isRestricted(.premium))
            XCTAssertTrue(state.isRestricted(.pro))
        }
    }

    func testActualRestoresRealAdminAndLegacyAccess() {
        let admin = SubscriptionAccessState.resolve(tier: nil, isTiered: true, isAdmin: true,
                                                    forceFree: false, preview: .actual, previewAvailable: true)
        XCTAssertTrue(admin.hasAccess(to: .pro))
        let legacy = SubscriptionAccessState.resolve(tier: .pro, isTiered: false, isAdmin: false,
                                                     forceFree: false, preview: .actual, previewAvailable: true)
        XCTAssertTrue(legacy.hasAccess(to: .pro))
        XCTAssertFalse(legacy.isRestricted(.premium))
        let free = SubscriptionAccessState.resolve(tier: nil, isTiered: false, isAdmin: false,
                                                   forceFree: false, preview: .actual, previewAvailable: true)
        XCTAssertFalse(free.hasAccess(to: .standard))
        XCTAssertFalse(free.isRestricted(.pro))
    }
}
