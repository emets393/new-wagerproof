import XCTest
@testable import WagerproofModels

final class SportsbookTeamAliasesTests: XCTestCase {
    func testAliasTableCoversFullReferenceCatalog() {
        XCTAssertGreaterThanOrEqual(CFBSportsbookTeamAliases.supportedAliasCount, 139)
    }

    func testTokenBoundaryPrefixMatchesOrdinaryPrograms() {
        let examples = [
            ("TCU Horned Frogs", "TCU"),
            ("North Carolina Tar Heels", "North Carolina"),
            ("NC State Wolfpack", "NC State"),
            ("Mississippi State Bulldogs", "Mississippi State"),
            ("Maryland Terrapins", "Maryland"),
            ("North Dakota State Bison", "North Dakota State"),
        ]

        for (oddsName, canonical) in examples {
            XCTAssertTrue(
                CFBSportsbookTeamAliases.matches(
                    oddsAPIName: oddsName,
                    canonicalName: canonical
                ),
                "Expected \(oddsName) to resolve only to \(canonical)"
            )
        }
    }

    func testNonPrefixAliasesResolveExplicitly() {
        let examples = [
            ("Southern California Trojans", "USC"),
            ("Mississippi Rebels", "Ole Miss"),
            ("UMass Minutemen", "Massachusetts"),
            ("Hawaii Rainbow Warriors", "Hawai'i"),
            ("San Jose State Spartans", "San José State"),
            ("Sam Houston State Bearkats", "Sam Houston"),
            ("Southern Mississippi Golden Eagles", "Southern Miss"),
            ("Appalachian State Mountaineers", "App State"),
        ]

        for (oddsName, canonical) in examples {
            XCTAssertEqual(
                CFBSportsbookTeamAliases.canonicalName(
                    forOddsAPIName: oddsName,
                    candidates: [canonical]
                ),
                canonical
            )
        }
    }

    func testMiamiProgramsCannotCrossMatch() {
        let candidates = ["Miami", "Miami (OH)"]

        XCTAssertEqual(
            CFBSportsbookTeamAliases.canonicalName(
                forOddsAPIName: "Miami Hurricanes",
                candidates: candidates
            ),
            "Miami"
        )
        XCTAssertEqual(
            CFBSportsbookTeamAliases.canonicalName(
                forOddsAPIName: "Miami (OH) RedHawks",
                candidates: candidates
            ),
            "Miami (OH)"
        )
        XCTAssertEqual(
            CFBSportsbookTeamAliases.canonicalName(
                forOddsAPIName: "Miami RedHawks",
                candidates: candidates
            ),
            "Miami (OH)"
        )
    }

    func testUnknownSchoolNeverFallsBackFuzzily() {
        XCTAssertNil(
            CFBSportsbookTeamAliases.canonicalName(
                forOddsAPIName: "Another State Wildcats",
                candidates: ["Arizona State", "Kansas State", "Ohio State"]
            )
        )

        XCTAssertNil(
            CFBSportsbookTeamAliases.canonicalName(
                forOddsAPIName: "North Carolina A&T Aggies",
                candidates: ["North Carolina"]
            )
        )
        XCTAssertNil(
            CFBSportsbookTeamAliases.canonicalName(
                forOddsAPIName: "Tennessee State Tigers",
                candidates: ["Tennessee"]
            )
        )
    }
}
