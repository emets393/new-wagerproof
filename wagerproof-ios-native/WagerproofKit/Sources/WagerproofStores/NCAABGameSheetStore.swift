import Foundation
import Observation
import WagerproofModels

/// Drives the NCAAB game detail bottom sheet. Mirrors the RN
/// `NCAABGameSheetContext` (provider + `useNCAABGameSheet` hook). See
/// `NFLGameSheetStore` / `CFBGameSheetStore` — identical shape, different
/// model.
@Observable
@MainActor
public final class NCAABGameSheetStore {
    public var selectedGame: NCAABGame?

    public init() {}

    public func openGameSheet(_ game: NCAABGame) {
        selectedGame = game
    }

    public func closeGameSheet() {
        selectedGame = nil
    }
}
