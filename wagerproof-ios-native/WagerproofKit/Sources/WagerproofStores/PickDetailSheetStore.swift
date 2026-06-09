import Foundation
import Observation
import WagerproofModels

/// Drives the editor-pick detail bottom sheet. Mirrors the RN
/// `PickDetailSheetContext` provider but uses SwiftUI's `.sheet(item:)`
/// presentation pattern — when `selection != nil`, the sheet is presented;
/// when nil, it's dismissed.
///
/// The store is owned at the tab level (or globally on the root) so any view
/// that hands a (pick, game) pair to `present(pick:gameData:)` causes the
/// sheet to slide up over the tab shell.
@Observable
@MainActor
public final class PickDetailSheetStore {
    /// The currently-presented (pick + joined gameData). When non-nil, the
    /// SwiftUI `.sheet(item: $store.selection)` presents the detail sheet.
    public var selection: Selection?

    public init() {}

    public func present(pick: EditorPick, gameData: EditorPickGameData) {
        selection = Selection(pick: pick, gameData: gameData)
    }

    public func dismiss() {
        selection = nil
    }

    /// `Identifiable` shell for `.sheet(item:)`. Identity is the pick's id —
    /// changing pick re-presents the sheet rather than animating swap.
    public struct Selection: Identifiable, Hashable, Sendable {
        public var id: String { pick.id }
        public let pick: EditorPick
        public let gameData: EditorPickGameData

        public init(pick: EditorPick, gameData: EditorPickGameData) {
            self.pick = pick
            self.gameData = gameData
        }
    }
}

/// Drives the editor-pick creator/editor sheet (admin only). Mirrors the RN
/// `EditorPickSheetContext`. Pure sheet-identity store — the actual form
/// state lives inside `EditorPickCreatorBottomSheet`.
@Observable
@MainActor
public final class EditorPickSheetStore {
    public enum Mode: Hashable, Sendable {
        case create
        case edit(EditorPick)
    }

    public var mode: Mode?
    /// Callback registered by the picks tab — fires after a successful
    /// save/delete so the feed can re-fetch. Mirrors RN `setOnPickSaved`.
    public var onPickSaved: (@MainActor () async -> Void)?

    public init() {}

    public func openCreate() { mode = .create }
    public func openEdit(_ pick: EditorPick) { mode = .edit(pick) }
    public func dismiss() { mode = nil }

    public var isPresented: Bool { mode != nil }
    public var editingPick: EditorPick? {
        if case .edit(let p) = mode { return p }
        return nil
    }
}
