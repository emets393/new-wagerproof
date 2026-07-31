import ActivityKit
import SwiftUI
import WagerproofModels
import WidgetKit

/// The Lock Screen / banner face of the picks hold.
///
/// Layout is deliberately the shape users already read as "something of mine
/// is running out": headline, oversized countdown, brand lockup on the right,
/// then a status line over a draining bar.
struct PicksExpiryLockScreenView: View {
    let context: ActivityViewContext<PicksExpiryAttributes>

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            VStack(alignment: .leading, spacing: 6) {
                Text(PicksExpiryStyle.headline(context.attributes, isStale: context.isStale))
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundStyle(WidgetPalette.textPrimary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.75)

                if context.isStale {
                    Text("0:00:00")
                        .font(.system(size: 34, weight: .heavy, design: .monospaced))
                        .foregroundStyle(WidgetPalette.textMuted)
                } else {
                    Text(timerInterval: context.state.range, countsDown: true)
                        .font(.system(size: 34, weight: .heavy, design: .monospaced))
                        .foregroundStyle(PicksExpiryStyle.urgent)
                        // Reserve the full H:MM:SS width so the headline above
                        // doesn't reflow when the clock drops an hour digit.
                        .frame(width: 178, alignment: .leading)
                }

                Text(PicksExpiryStyle.subtitle(context.attributes, isStale: context.isStale))
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(WidgetPalette.textSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)

                progressBar
            }

            Spacer(minLength: 0)

            brandLockup
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(surface)
        // Without this the card launches the app with no URL and the user lands
        // wherever they left off — `RootRouter` needs the route to put the
        // paywall back up. The Dynamic Island sets its own copy.
        .widgetURL(URL(string: "wagerproof://picks-hold"))
    }

    @ViewBuilder
    private var progressBar: some View {
        if context.isStale {
            Capsule()
                .fill(WidgetPalette.textMuted.opacity(0.35))
                .frame(height: 5)
        } else {
            ProgressView(timerInterval: context.state.range, countsDown: true) {
                EmptyView()
            } currentValueLabel: {
                EmptyView()
            }
            .progressViewStyle(.linear)
            .tint(PicksExpiryStyle.urgent)
        }
    }

    private var brandLockup: some View {
        VStack(alignment: .trailing, spacing: 4) {
            HStack(spacing: 0) {
                Text("Wager").foregroundStyle(WidgetPalette.textPrimary)
                Text("Proof").foregroundStyle(WidgetPalette.accent)
            }
            .font(.system(size: 15, weight: .black, design: .rounded))

            Text("PRO")
                .font(.system(size: 8, weight: .heavy, design: .monospaced))
                .tracking(0.6)
                .foregroundStyle(.black)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(Capsule().fill(WidgetPalette.accent))
        }
        .padding(.top, 2)
    }

    /// Dark base with a green→amber wash: brand at the top-left corner,
    /// deadline color bleeding in from the side the clock sits on.
    private var surface: some View {
        ZStack {
            Color(widgetRGB: 0x0B1410)
            LinearGradient(
                colors: [
                    WidgetPalette.accent.opacity(0.22),
                    Color.clear,
                    PicksExpiryStyle.urgent.opacity(0.16),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }
}
