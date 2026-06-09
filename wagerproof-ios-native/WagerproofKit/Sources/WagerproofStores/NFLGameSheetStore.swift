import Foundation
import Observation
import WagerproofModels

/// Drives the NFL game detail bottom sheet. Mirrors the RN
/// `NFLGameSheetContext` (provider + `useNFLGameSheet` hook) but uses
/// SwiftUI's `.sheet(item:)` pattern — when `selectedGame != nil`, the sheet
/// is presented; nil-ing it dismisses.
///
/// `openGameSheet(_:)` matches RN's API. `closeGameSheet()` is provided for
/// imperative dismissal (e.g. when the sheet's close button calls it).
@Observable
@MainActor
public final class NFLGameSheetStore {
    public var selectedGame: NFLPrediction?

    public init() {}

    public func openGameSheet(_ game: NFLPrediction) {
        selectedGame = game
    }

    public func closeGameSheet() {
        selectedGame = nil
    }
}
