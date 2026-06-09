import Foundation
import Observation
import WagerproofModels

/// Drives the CFB game detail bottom sheet. Mirrors the RN
/// `CFBGameSheetContext` (provider + `useCFBGameSheet` hook). See
/// `NFLGameSheetStore` — identical shape, different model.
@Observable
@MainActor
public final class CFBGameSheetStore {
    public var selectedGame: CFBPrediction?

    public init() {}

    public func openGameSheet(_ game: CFBPrediction) {
        selectedGame = game
    }

    public func closeGameSheet() {
        selectedGame = nil
    }
}
