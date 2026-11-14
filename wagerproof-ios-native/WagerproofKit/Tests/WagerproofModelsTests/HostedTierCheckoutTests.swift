import XCTest
@testable import WagerproofModels

final class HostedTierCheckoutTests: XCTestCase {
    private let user = UUID(uuidString: "11111111-2222-4333-8444-555555555555")!

    func testIdentifiedCheckoutShowsHostedOptions() throws {
        let url = try XCTUnwrap(HostedTierCheckout.url(baseURL: "https://pay.rev.cat/example/", appUserID: user.uuidString.lowercased(), authenticatedUserID: user))
        XCTAssertEqual(url.absoluteString, "https://pay.rev.cat/example/11111111-2222-4333-8444-555555555555?currency=USD")
        XCTAssertFalse(url.absoluteString.contains("package_id"))
    }

    func testRejectsAnonymousOrStaleCustomer() {
        for id in ["$RCAnonymousID:abc", UUID().uuidString.lowercased(), ""] {
            XCTAssertNil(HostedTierCheckout.url(baseURL: "https://pay.rev.cat/example", appUserID: id, authenticatedUserID: user))
        }
    }

    func testRejectsUntrustedOrPreidentifiedLinks() {
        for link in [nil, "https://wagerproof.bet/plans/tiers", "http://pay.rev.cat/example", "https://pay.rev.cat.evil.test/example", "https://pay.rev.cat/example/other-user", "https://pay.rev.cat/example?package_id=wrong", "https://pay.rev.cat/example#fragment", "https://user@pay.rev.cat/example"] as [String?] {
            XCTAssertNil(HostedTierCheckout.url(baseURL: link, appUserID: user.uuidString.lowercased(), authenticatedUserID: user))
        }
    }
}
