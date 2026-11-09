import AppTrackingTransparency
import XCTest
@testable import WagerproofServices

final class MetaConsentPolicyTests: XCTestCase {
    /// Funnel events must reach Meta for every user so SKAdNetwork / AEM
    /// campaigns can optimize; this is the regression from 3.6.3.
    func testSDKAndAggregatedEventsRunForEveryStatus() {
        for status: ATTrackingManager.AuthorizationStatus in [.notDetermined, .denied, .restricted, .authorized] {
            let policy = MetaConsentPolicy(status: status)
            XCTAssertTrue(policy.startsSDK, "SDK must start for \(status.rawValue)")
            XCTAssertTrue(policy.logsAggregatedEvents, "events must log for \(status.rawValue)")
        }
    }

    /// App Review requirement: no IDFA, external ID or matching data without ATT.
    func testIdentityAndAdvertiserIDRequireAuthorization() {
        for status: ATTrackingManager.AuthorizationStatus in [.notDetermined, .denied, .restricted] {
            let policy = MetaConsentPolicy(status: status)
            XCTAssertFalse(policy.collectsAdvertiserID)
            XCTAssertFalse(policy.sendsIdentity)
        }
        let authorized = MetaConsentPolicy(status: .authorized)
        XCTAssertTrue(authorized.collectsAdvertiserID)
        XCTAssertTrue(authorized.sendsIdentity)
    }
}
