import Foundation
import Observation
import WagerproofModels

/// Drives the NBA game detail bottom sheet. Mirrors the RN
/// `NBAGameSheetContext` (provider + `useNBAGameSheet` hook) but uses
/// SwiftUI's `.sheet(item:)` pattern — when `selectedGame != nil`, the sheet
/// is presented; nil-ing it dismisses.
///
/// `openGameSheet(_:)` matches RN's API. `closeGameSheet()` is provided for
/// imperative dismissal (e.g. when the sheet's close button calls it).
@Observable
@MainActor
public final class NBAGameSheetStore {
    public var selectedGame: NBAGame?

    public init() {}

    public func openGameSheet(_ game: NBAGame) {
        selectedGame = game
    }

    public func closeGameSheet() {
        selectedGame = nil
    }
}
