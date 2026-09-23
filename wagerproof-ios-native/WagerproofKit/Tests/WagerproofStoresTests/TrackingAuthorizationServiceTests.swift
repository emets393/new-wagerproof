import AppTrackingTransparency
import XCTest
@testable import WagerproofServices

@MainActor
final class TrackingAuthorizationServiceTests: XCTestCase {
    func testShowingExplanationDoesNotRequestPermission() async {
        var requests = 0
        let service = TrackingAuthorizationService(
            readStatus: { .notDetermined }, isActive: { true },
            requestAuthorization: { requests += 1; return .authorized },
            applyConsent: { _ in }
        )
        await service.refresh()
        XCTAssertEqual(requests, 0)
        XCTAssertEqual(service.status, .notDetermined)
    }

    func testEveryResolvedChoiceAllowsContinuing() async {
        for result: ATTrackingManager.AuthorizationStatus in [.authorized, .denied, .restricted] {
            var applied: ATTrackingManager.AuthorizationStatus?
            let service = TrackingAuthorizationService(
                readStatus: { .notDetermined }, isActive: { true },
                requestAuthorization: { result }, applyConsent: { applied = $0 }
            )
            let canContinue = await service.request()
            XCTAssertTrue(canContinue)
            XCTAssertEqual(applied, result)
            XCTAssertEqual(service.status, result)
            XCTAssertFalse(service.isRequesting)
        }
    }

    func testInactiveAndUnresolvedRequestsStayRetryable() async {
        var active = false
        var requests = 0
        let service = TrackingAuthorizationService(
            readStatus: { .notDetermined }, isActive: { active },
            requestAuthorization: { requests += 1; return requests == 1 ? .notDetermined : .denied },
            applyConsent: { _ in }
        )
        let inactive = await service.request()
        XCTAssertFalse(inactive)
        XCTAssertEqual(requests, 0)
        active = true
        let interrupted = await service.request()
        XCTAssertFalse(interrupted)
        XCTAssertFalse(service.isRequesting)
        let retry = await service.request()
        XCTAssertTrue(retry)
        XCTAssertEqual(requests, 2)
    }

    func testExistingChoicesDoNotRequestAgainAndSettingsRevocationIsApplied() async {
        var status: ATTrackingManager.AuthorizationStatus = .authorized
        var requests = 0
        var applied: ATTrackingManager.AuthorizationStatus?
        let service = TrackingAuthorizationService(
            readStatus: { status }, isActive: { true },
            requestAuthorization: { requests += 1; return .authorized },
            applyConsent: { applied = $0 }
        )
        let resolved = await service.request()
        XCTAssertTrue(resolved)
        XCTAssertEqual(requests, 0)
        status = .denied
        await service.refresh()
        XCTAssertEqual(service.status, .denied)
        XCTAssertEqual(applied, .denied)
    }

    func testConcurrentTapsCannotAdvanceWhileSystemPromptIsPending() async {
        var continuation: CheckedContinuation<ATTrackingManager.AuthorizationStatus, Never>?
        let service = TrackingAuthorizationService(
            readStatus: { .notDetermined }, isActive: { true },
            requestAuthorization: { await withCheckedContinuation { continuation = $0 } },
            applyConsent: { _ in }
        )
        let first = Task { await service.request() }
        while continuation == nil { await Task.yield() }
        let duplicate = await service.request()
        XCTAssertFalse(duplicate)
        XCTAssertTrue(service.isRequesting)
        continuation?.resume(returning: .denied)
        let completed = await first.value
        XCTAssertTrue(completed)
        XCTAssertFalse(service.isRequesting)
    }
}
