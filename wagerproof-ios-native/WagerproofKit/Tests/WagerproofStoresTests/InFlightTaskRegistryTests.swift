import XCTest
@testable import WagerproofStores

final class InFlightTaskRegistryTests: XCTestCase {
    @MainActor
    func testMatchingKeysShareOneOperation() async {
        let registry = InFlightTaskRegistry<String>()
        var starts = 0

        async let first: Void = registry.run(key: "games") {
            starts += 1
            try? await Task.sleep(for: .milliseconds(50))
        }
        async let second: Void = registry.run(key: "games") {
            starts += 1
            try? await Task.sleep(for: .milliseconds(50))
        }

        _ = await (first, second)
        XCTAssertEqual(starts, 1)
    }

    @MainActor
    func testDifferentKeysRunIndependently() async {
        let registry = InFlightTaskRegistry<String>()
        var starts = 0

        async let games: Void = registry.run(key: "games") { starts += 1 }
        async let props: Void = registry.run(key: "props") { starts += 1 }

        _ = await (games, props)
        XCTAssertEqual(starts, 2)
    }
}
