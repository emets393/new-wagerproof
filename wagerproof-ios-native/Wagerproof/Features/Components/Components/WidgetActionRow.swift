import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices
import WagerproofStores

/// Reddit-style action row at the bottom of a game-detail widget card: a vote
/// pill (up · score · down) on the leading edge, Share on the trailing edge.
/// See `.claude/docs/34_widget_votes_share.md` §5.
///
/// The row's HEIGHT IS CONSTANT no matter what it shows. `WidgetCollapsingSection`
/// caches its natural height only while unpinned, so a row that grew when votes
/// finished loading, or when the user signed in, would leave a pinned card
/// clipped or gapped until it scrolled back down.
struct WidgetActionRow: View {
    static let height: CGFloat = 36

    let widgetKey: String
    let title: String
    let systemImage: String
    let iconTint: Color
    let headline: String?
    let context: WidgetVoteContext

    @Environment(WidgetVotesStore.self) private var store: WidgetVotesStore?
    @Environment(AuthStore.self) private var auth: AuthStore?

    private var isSignedIn: Bool {
        if case .authenticated = auth?.phase { return true }
        return false
    }

    private var tally: WidgetVoteTally {
        store?.tally(for: context.game, widgetKey: widgetKey) ?? WidgetVoteTally(widgetKey: widgetKey)
    }

    /// The share image is built from the headline, so a card without one has
    /// nothing worth sharing. Pro-locked cards pass no headline, which also
    /// keeps gated content out of share images.
    private var shareHeadline: String? {
        guard let headline, !headline.isEmpty else { return nil }
        return headline
    }

    var body: some View {
        HStack(spacing: 8) {
            if store != nil, isSignedIn {
                votePill
            }
            Spacer(minLength: 8)
            if shareHeadline != nil {
                shareButton
            }
        }
        .frame(height: Self.height)
        .sensoryFeedback(.error, trigger: store?.rateLimitTick ?? 0)
    }

    // MARK: - Votes

    private var votePill: some View {
        let tally = self.tally
        return HStack(spacing: 0) {
            arrow(1, active: tally.myVote == 1)
            Text(scoreText(tally))
                .font(.system(size: 13, weight: .semibold))
                .monospacedDigit()
                .foregroundStyle(scoreColor(tally))
                .contentTransition(.numericText(value: Double(tally.score)))
                .frame(minWidth: 26)
                .accessibilityLabel(tally.hasVotes ? "Score \(tally.score)" : "No votes yet")
            arrow(-1, active: tally.myVote == -1)
        }
        .frame(height: Self.height)
        .background(Capsule().fill(Color.appSurfaceMuted.opacity(0.7)))
        .animation(.appQuick, value: tally)
        .sensoryFeedback(.selection, trigger: tally.myVote)
    }

    private func arrow(_ direction: Int, active: Bool) -> some View {
        let isUp = direction == 1
        return Button {
            guard let store else { return }
            let previous = tally.myVote
            store.tap(direction, game: context.game, widgetKey: widgetKey)
            AnalyticsService.shared.track("widget_vote_cast", properties: [
                "sport": context.game.sport,
                "game_id": context.game.gameId,
                "widget_key": widgetKey,
                "vote": WidgetVoteTally.resolvedVote(current: previous, tapped: direction),
                "previous_vote": previous,
            ])
        } label: {
            Image(systemName: isUp
                  ? (active ? "arrowshape.up.fill" : "arrowshape.up")
                  : (active ? "arrowshape.down.fill" : "arrowshape.down"))
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(active ? (isUp ? Color.appPrimary : Color.appLoss) : Color.appTextSecondary)
                // 44pt-wide target inside the 36pt row; the capsule supplies
                // the visual bounds.
                .frame(width: 44, height: Self.height)
                .contentShape(Rectangle())
        }
        // .borderless, not .plain: the row sits inside cards whose header (and
        // sometimes whole body) is itself a Button, and .plain lets the outer
        // one swallow the tap.
        .buttonStyle(.borderless)
        .accessibilityLabel(isUp ? "Upvote" : "Downvote")
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    private func scoreText(_ tally: WidgetVoteTally) -> String {
        // "Vote" only for an untouched widget. A 5-up/5-down split is a real
        // score of 0 and must say so.
        tally.hasVotes ? "\(tally.score)" : "Vote"
    }

    private func scoreColor(_ tally: WidgetVoteTally) -> Color {
        switch tally.myVote {
        case 1: return .appPrimary
        case -1: return .appLoss
        default: return .appTextPrimary
        }
    }

    // MARK: - Share

    private var shareButton: some View {
        Button {
            share()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "square.and.arrow.up")
                    .font(.system(size: 13, weight: .semibold))
                Text("Share")
                    .font(.system(size: 13, weight: .semibold))
            }
            .foregroundStyle(Color.appTextPrimary)
            .padding(.horizontal, 14)
            .frame(height: Self.height)
            .background(Capsule().fill(Color.appSurfaceMuted.opacity(0.7)))
            .contentShape(Capsule())
        }
        .buttonStyle(.borderless)
        .accessibilityLabel("Share \(title)")
    }

    @MainActor
    private func share() {
        guard let shareHeadline else { return }
        let sport = context.game.sport
        let gameId = context.game.gameId
        let widgetKey = self.widgetKey
        AnalyticsService.shared.track("widget_share_tapped", properties: [
            "sport": sport, "game_id": gameId, "widget_key": widgetKey,
        ])

        let card = WidgetShareCard(
            title: title,
            systemImage: systemImage,
            iconTint: iconTint,
            matchup: context.matchup,
            headline: shareHeadline
        )
        guard let image = WidgetShareCard.render(card) else { return }
        ActivitySharePresenter.present(items: [image]) { completed in
            guard completed else { return }
            AnalyticsService.shared.track("widget_share_completed", properties: [
                "sport": sport, "game_id": gameId, "widget_key": widgetKey,
            ])
            ReviewPromptCoordinator.shared.recordContentShared()
        }
    }
}
