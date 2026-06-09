import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Defensive wrapper around a pick card. Mirrors RN's `PickCardErrorBoundary`
/// which catches per-card render exceptions and renders a small fallback so
/// one bad pick doesn't blow up the whole feed.
///
/// In SwiftUI, view rendering doesn't `throw`; this wrapper instead asserts
/// shape invariants on the (pick, gameData) pair before delegating to the
/// real card. If a required field is missing we render a compact fallback
/// row with the pick id + a "couldn't render" hint. This keeps reviewer
/// parity with the RN safety net while staying within native idioms.
///
/// Sentinels checked:
///   - non-empty team names (RN crashed on missing `gameData.away_team`)
///   - valid `selected_bet_type` string (RN crashed when null)
///
/// Anything else is the card's job to render gracefully.
struct PickCardErrorBoundary<Content: View>: View {
    let pickId: String
    let pick: EditorPick
    let gameData: EditorPickGameData
    @ViewBuilder var content: () -> Content

    var body: some View {
        if isShapeOk {
            content()
        } else {
            fallback
        }
    }

    private var isShapeOk: Bool {
        !gameData.awayTeam.isEmpty
            && !gameData.homeTeam.isEmpty
            && !pick.selectedBetType.isEmpty
    }

    @ViewBuilder
    private var fallback: some View {
        HStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.appAccentAmber)
            VStack(alignment: .leading, spacing: 2) {
                Text("Couldn't render this pick")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
                Text("Pick \(pickId) is missing required fields")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Spacer()
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12).fill(Color.appAccentAmber.opacity(0.1))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12).stroke(Color.appAccentAmber.opacity(0.3), lineWidth: 1)
        )
    }
}
