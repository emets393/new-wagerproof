import SwiftUI
import WagerproofDesign

/// Native port of `wagerproof-mobile/components/FadeAlertTooltip.tsx`.
///
/// Inline tooltip rendered inside game bottom sheets when the model's
/// confidence on a spread or total is "extreme" — meaning the historical
/// backtest shows the fade is more profitable than following the model.
///
/// Two flavours match RN's `betType: 'spread' | 'total'`. The widget itself
/// is presentation-only — the gating logic (when to display it) lives
/// upstream in whichever game-sheet view embeds the widget. Mirrors the
/// existing per-screen ticket #034 for fade-alert detection.
struct FadeAlertTooltip: View {
    enum BetKind {
        case spread, total
    }

    /// "Under 45.5" / "Patriots +3.5" — pre-formatted string of the fade
    /// suggestion. The widget surfaces it verbatim; no parsing here.
    let suggestedBet: String

    /// Kept on the API in case future copy needs to vary by bet type. RN
    /// doesn't currently key any copy off this — neither do we, but the
    /// surface keeps parity with the RN signature.
    let betKind: BetKind

    init(betType: BetKind, suggestedBet: String) {
        self.betKind = betType
        self.suggestedBet = suggestedBet
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header — amber bolt + uppercase tracking.
            HStack(spacing: 8) {
                Image(systemName: "bolt.fill")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color(hex: 0xF59E0B))
                Text("FADE ALERT TRIGGERED")
                    .font(.system(size: 14, weight: .heavy))
                    .tracking(0.5)
                    .foregroundStyle(Color(hex: 0xF59E0B))
            }

            // Body paragraph with inline highlights. SwiftUI's
            // `AttributedString` lets us inline-color the highlighted
            // segments without dropping out of `Text` composition.
            descriptionText

            // Suggestion sub-card.
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.left.arrow.right")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color(hex: 0x22C55E))
                    Text("CONSIDER THE FADE")
                        .font(.system(size: 12, weight: .heavy))
                        .foregroundStyle(Color(hex: 0x22C55E))
                }
                suggestionText
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color(hex: 0x22C55E, opacity: 0.10))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .strokeBorder(Color(hex: 0x22C55E, opacity: 0.30), lineWidth: 1)
            )

            // Stats row.
            HStack(spacing: 16) {
                HStack(spacing: 4) {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color(hex: 0x22C55E))
                    Text("Higher hit rate when fading")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.appTextSecondary)
                }
                HStack(spacing: 4) {
                    Image(systemName: "banknote")
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color(hex: 0x22C55E))
                    Text("Historically profitable")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(hex: 0xF59E0B, opacity: 0.10))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .strokeBorder(Color(hex: 0xF59E0B, opacity: 0.30), lineWidth: 1)
        )
        .padding(.vertical, 12)
    }

    /// Body paragraph with `extreme confidence` + `overconfident` highlighted
    /// in amber, and `more profitable` in green — matches RN's three inline
    /// `<Text style={highlight}>` spans.
    private var descriptionText: Text {
        // Building this via `Text` + `+` keeps the layout inside a single
        // wrapped paragraph; `AttributedString` would also work but Text
        // composition is the simpler primitive for two-color inline runs.
        let amber = Color(hex: 0xF59E0B)
        let green = Color(hex: 0x22C55E)
        return Text("Our model is showing ")
            .foregroundColor(Color.appTextSecondary)
            + Text("extreme confidence").bold().foregroundColor(amber)
            + Text(" on this pick. Historical backtesting across thousands of games reveals that when the model is ")
            .foregroundColor(Color.appTextSecondary)
            + Text("overconfident").bold().foregroundColor(amber)
            + Text(", betting the opposite direction has been ")
            .foregroundColor(Color.appTextSecondary)
            + Text("more profitable").bold().foregroundColor(green)
            + Text(".").foregroundColor(Color.appTextSecondary)
    }

    /// Suggestion text with the fade target highlighted in green.
    private var suggestionText: Text {
        let green = Color(hex: 0x22C55E)
        return Text("Instead of following the model, consider betting ")
            .foregroundColor(Color.white.opacity(0.8))
            + Text(suggestedBet).bold().foregroundColor(green)
    }
}
