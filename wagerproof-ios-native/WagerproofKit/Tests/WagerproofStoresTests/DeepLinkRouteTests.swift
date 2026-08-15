import Foundation
import XCTest
@testable import WagerproofStores

final class DeepLinkRouteTests: XCTestCase {
    func testPushRouteMapsKnownHosts() {
        XCTAssertEqual(DeepLinkRoute(pushRoute: "agents"), .agents)
        XCTAssertEqual(DeepLinkRoute(pushRoute: "outliers"), .outliers)
        XCTAssertEqual(DeepLinkRoute(pushRoute: "feed"), .feed)
        XCTAssertEqual(DeepLinkRoute(pushRoute: "unknown"), .feed)
        XCTAssertEqual(DeepLinkRoute(pushRoute: "/agents"), .agents)
        XCTAssertEqual(DeepLinkRoute(pushRoute: "Agents"), .agents)
    }

    func testPushRouteRejectsAuthAndPaywallRoutes() {
        XCTAssertNil(DeepLinkRoute(pushRoute: "reset-password"))
        XCTAssertNil(DeepLinkRoute(pushRoute: "picks-hold"))
    }

    func testPushRouteURLRoundTrip() {
        XCTAssertEqual(DeepLinkRoute(pushRoute: "agents")?.url, URL(string: "wagerproof://agents"))
        XCTAssertEqual(DeepLinkRoute(url: URL(string: "wagerproof://outliers")!), .outliers)
    }
}
