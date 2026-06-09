import SwiftUI
import WagerproofDesign

/// Modal showing the line-movement chart for a game. Mirrors RN
/// `components/LineMovementModal.tsx`. The chart itself uses an inline
/// SwiftUI Line in `LineMovementSection.swift` (CFB) / NFL's inline
/// `LineMovementSection.swift` — those views render the chart and the
/// modal hosts them in a full-screen presentation when the user wants more
/// room.
///
/// FIDELITY-WAIVER #033: Full chart wiring (nfl_line_movement +
/// cfb_line_movement tables) lands when the line-movement data store
/// ports. B04 ships the modal shell + delegates to the inline section
/// component.
struct LineMovementModal<Content: View>: View {
    let title: String
    let content: () -> Content
    var onClose: () -> Void = {}

    init(title: String, onClose: @escaping () -> Void = {}, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.onClose = onClose
        self.content = content
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.lg) {
                    content()
                }
                .padding()
            }
            .background(Color.appSurface)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { onClose() }
                        .tint(Color.appPrimary)
                }
            }
        }
    }
}

#Preview {
    LineMovementModal(title: "Line Movement") {
        ContentUnavailableView("No line movement", systemImage: "chart.line.uptrend.xyaxis")
    }
}
