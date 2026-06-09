import SwiftUI

/// One action revealed by a row's native `.swipeActions`. A small data carrier
/// so `AgentsView` can build its leading/trailing action sets once and map them
/// to the SwiftUI `Button`s the `List` row exposes on swipe.
struct RowSwipeAction: Identifiable {
    let id: String
    let title: String
    let systemImage: String
    let tint: Color
    let action: () -> Void

    init(id: String, title: String, systemImage: String, tint: Color, action: @escaping () -> Void) {
        self.id = id
        self.title = title
        self.systemImage = systemImage
        self.tint = tint
        self.action = action
    }
}
