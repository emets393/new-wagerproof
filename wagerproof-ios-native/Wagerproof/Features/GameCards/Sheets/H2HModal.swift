import SwiftUI
import WagerproofDesign

/// Head-to-head modal opened from a game bottom sheet. Mirrors RN
/// `components/H2HModal.tsx` (and the inline `H2HSection.tsx`) — when full
/// historical games are wired up, this view renders the most-recent
/// head-to-head matchups between the two teams along with score / cover /
/// over-under outcomes.
///
/// FIDELITY-WAIVER #032: Historical H2H data lookup depends on
/// `nfl_historical_games` + a CFB equivalent that need careful join logic.
/// B04 ships the modal shell + empty-state copy; the row-level fetch lands
/// when the historical data store ports in a later batch. See ticket #032.
struct H2HModal: View {
    let awayTeam: String
    let homeTeam: String
    var onClose: () -> Void = {}

    var body: some View {
        NavigationStack {
            VStack(spacing: Spacing.lg) {
                ContentUnavailableView {
                    Label("Head-to-Head Data", systemImage: "clock.arrow.2.circlepath")
                } description: {
                    Text("Historical matchups between \(awayTeam) and \(homeTeam) will appear here once the historical games dataset wires up.")
                        .multilineTextAlignment(.center)
                }
                Spacer()
            }
            .padding()
            .background(Color.appSurface)
            .navigationTitle("Head to Head")
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
    H2HModal(awayTeam: "Dallas", homeTeam: "Philadelphia")
}
