import XCTest
@testable import WagerproofModels

final class SubscriptionTierTests: XCTestCase {
    func testMarketingRenamePreservesExistingBillingEntitlements() {
        XCTAssertEqual(SubscriptionTier.allCases.map(\.title), ["Premium", "Premium Plus", "Pro"])
        XCTAssertEqual(SubscriptionTier.allCases.map(\.entitlementID),
                       ["WagerProof Standard", "WagerProof Premium", "WagerProof Pro"])
        XCTAssertEqual(SubscriptionTier.resolve(activeEntitlementIDs: ["WagerProof Standard"]), .standard)
        XCTAssertEqual(SubscriptionTier.resolve(activeEntitlementIDs: ["WagerProof Premium"]), .premium)
        XCTAssertTrue(SubscriptionTier.isTieredCustomer(productIDs: [], entitlementIDs: ["WagerProof Standard"]))
    }
    func testLegacyProWinsOverNewLowerTier() {
        XCTAssertEqual(SubscriptionTier.resolve(activeEntitlementIDs: ["WagerProof Pro", "WagerProof Standard"]), .pro)
        XCTAssertEqual(SubscriptionTier.resolve(activeEntitlementIDs: ["WagerProof Pro", "WagerProof Premium"]), .pro)
    }
    func testCumulativeAccess() {
        XCTAssertTrue(SubscriptionTier.standard.includes(.standard))
        XCTAssertFalse(SubscriptionTier.standard.includes(.premium))
        XCTAssertTrue(SubscriptionTier.premium.includes(.standard))
        XCTAssertTrue(SubscriptionTier.premium.includes(.premium))
        XCTAssertFalse(SubscriptionTier.premium.includes(.pro))
        XCTAssertTrue(SubscriptionTier.pro.includes(.premium))
        XCTAssertNil(SubscriptionTier.resolve(activeEntitlementIDs: []))
    }
    func testOnlyNewCatalogEnrollsCustomers() {
        for product in ["monthly", "annual", "lifetime", "promotional"] {
            XCTAssertFalse(SubscriptionTier.isTieredCustomer(productIDs: [product], entitlementIDs: ["WagerProof Pro"]))
        }
        XCTAssertTrue(SubscriptionTier.isTieredCustomer(productIDs: ["com.wagerproof.mobile.tiers.pro_yearly"], entitlementIDs: ["WagerProof Pro"]))
        XCTAssertTrue(SubscriptionTier.isTieredCustomer(productIDs: [], entitlementIDs: ["WagerProof Premium"]))
        XCTAssertFalse(SubscriptionTier.isTieredCustomer(productIDs: [], entitlementIDs: []))
    }
}
