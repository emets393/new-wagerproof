import SwiftUI
import WagerproofDesign
import WagerproofStores

/// Compact bottom-sheet variant of the Delete Account UI. RN had a
/// `BottomSheet`-based copy of the delete-account flow (see
/// `wagerproof-mobile/components/DeleteAccountBottomSheet.tsx`) reachable
/// from other screens; iOS realizes it with a `.presentationDetents([.medium])`
/// sheet wrapping `DeleteAccountView`. Kept as a separate view so callers
/// that want the slimmer detent presentation can opt in.
struct DeleteAccountBottomSheet: View {
    var body: some View {
        DeleteAccountView()
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
    }
}
