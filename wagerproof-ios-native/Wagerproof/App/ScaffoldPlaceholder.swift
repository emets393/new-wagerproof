import SwiftUI
import WagerproofDesign

/// Generic empty-state used by every phase-2 batch that has wired its
/// navigation slot but hasn't ported the feature view yet. Lets implementer
/// agents land an end-to-end navigation graph before any single screen is
/// finished, so deep links and tab switches can be tested early.
///
/// Once a feature view ships, replace its `ScaffoldPlaceholder` call site
/// with the real view (e.g. `GamesView()`). Don't leave stub copy in shipped
/// builds — every appearance of this view is a TODO.
struct ScaffoldPlaceholder: View {
    let title: String
    let note: String

    var body: some View {
        NavigationStack {
            ContentUnavailableView {
                Label(title, systemImage: "hammer.fill")
            } description: {
                Text(note)
                    .multilineTextAlignment(.center)
            }
            .navigationTitle(title)
        }
    }
}
