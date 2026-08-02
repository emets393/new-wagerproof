import ActivityKit
import SwiftUI
import WagerproofModels
import WidgetKit

/// Lock Screen + Dynamic Island rendering of the 3-hour picks hold. Started by
/// the app (`PicksExpiryService`) when a user closes or minimizes the paywall
/// without subscribing; the clock runs off the attributes' two dates, so this widget
/// never receives an update — it just re-renders itself.
///
/// See .claude/docs/19_picks_expiry_hold.md
struct PicksExpiryLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: PicksExpiryAttributes.self) { context in
            PicksExpiryLockScreenView(context: context)
                // The card sits on the user's own wallpaper, so it carries its
                // own dark surface rather than inheriting a system material.
                .activityBackgroundTint(Color(widgetRGB: 0x0B1410))
                .activitySystemActionForegroundColor(WidgetPalette.accent)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: context.isStale ? "hourglass.bottomhalf.filled" : "hourglass")
                        .font(.system(size: 20, weight: .bold))
                        .foregroundStyle(PicksExpiryStyle.urgent)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if context.isStale {
                        Text("Expired")
                            .font(.system(size: 15, weight: .heavy, design: .rounded))
                            .foregroundStyle(WidgetPalette.textSecondary)
                    } else {
                        Text(timerInterval: context.state.range, countsDown: true)
                            .font(.system(size: 19, weight: .heavy, design: .monospaced))
                            .multilineTextAlignment(.trailing)
                            .foregroundStyle(PicksExpiryStyle.urgent)
                            .frame(width: 88)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(PicksExpiryStyle.headline(context.attributes, isStale: context.isStale))
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundStyle(WidgetPalette.textPrimary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)

                        if !context.isStale {
                            ProgressView(timerInterval: context.state.range, countsDown: true) {
                                EmptyView()
                            } currentValueLabel: {
                                EmptyView()
                            }
                            .progressViewStyle(.linear)
                            .tint(PicksExpiryStyle.urgent)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
            } compactLeading: {
                Image(systemName: "hourglass")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(PicksExpiryStyle.urgent)
            } compactTrailing: {
                if context.isStale {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(WidgetPalette.textMuted)
                } else {
                    // 11pt, not 13: the compact trailing region is ~50pt wide
                    // and H:MM:SS is seven monospaced glyphs. Bigger truncates.
                    Text(timerInterval: context.state.range, countsDown: true)
                        .font(.system(size: 11, weight: .bold, design: .monospaced))
                        .foregroundStyle(PicksExpiryStyle.urgent)
                        .frame(width: 50)
                }
            } minimal: {
                Image(systemName: "hourglass")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(PicksExpiryStyle.urgent)
            }
            // Tapping anywhere reopens the app on the paywall's own route —
            // the whole card exists to send them back to the purchase.
            .widgetURL(URL(string: "wagerproof://picks-hold"))
            .keylineTint(PicksExpiryStyle.urgent)
        }
    }
}

/// Shared tokens + copy so the Lock Screen card and the Dynamic Island can't
/// describe the same hold two different ways.
enum PicksExpiryStyle {
    static let urgent = Color(widgetRGB: 0xF59E0B)

    static func headline(_ attributes: PicksExpiryAttributes, isStale: Bool) -> String {
        if isStale { return "\(attributes.agentName)'s picks expired" }
        return attributes.pickCount == 1
            ? "Your pick is about to expire!"
            : "Your picks are about to expire!"
    }

    static func subtitle(_ attributes: PicksExpiryAttributes, isStale: Bool) -> String {
        if isStale { return "Subscribe to see today's slate" }
        let noun = attributes.pickCount == 1 ? "pick" : "picks"
        return "\(attributes.pickCount) \(noun) locked · \(attributes.agentName)"
    }
}

extension PicksExpiryAttributes.ContentState {
    /// `Text(timerInterval:)` and `ProgressView(timerInterval:)` both want a
    /// closed range. Clamped because a zero-width range traps both of them.
    var range: ClosedRange<Date> {
        startedAt...max(expiresAt, startedAt.addingTimeInterval(1))
    }
}
