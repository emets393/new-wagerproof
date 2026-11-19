import SwiftUI
import WagerproofStores

/// Which game the widget cards on this page belong to. Set ONCE per detail
/// sheet with `.widgetVotes(...)`; every `WidgetCollapsingSection` that carries
/// a `widgetKey` reads it to know what its vote and share buttons act on.
/// See `.claude/docs/34_widget_votes_share.md`.
///
/// An environment value rather than a parameter on the card because the shell
/// knows neither sport nor game, and threading both through 60-odd call sites
/// (and every helper between them) would touch far more code than one modifier
/// per sheet.
struct WidgetVoteContext: Equatable {
    let game: WidgetVotesStore.GameKey
    /// "NO @ CHI" — printed on the share image so a cropped card still says
    /// which game it is about.
    let matchup: String
}

private struct WidgetVoteContextKey: EnvironmentKey {
    static let defaultValue: WidgetVoteContext? = nil
}

extension EnvironmentValues {
    /// `nil` outside a game-detail sheet — cards there render no action row.
    var widgetVoteContext: WidgetVoteContext? {
        get { self[WidgetVoteContextKey.self] }
        set { self[WidgetVoteContextKey.self] = newValue }
    }
}

extension View {
    /// Turns on the vote + share action row for every keyed widget card inside
    /// this game-detail sheet and loads the game's tallies.
    ///
    /// `gameId` must be the canonical `GameConsensusKey` value — the same key
    /// web and Android send — or the platforms would each keep separate scores
    /// for the same game.
    func widgetVotes(sport: GamesStore.Sport, gameId: String, matchup: String) -> some View {
        modifier(WidgetVotesModifier(
            context: WidgetVoteContext(
                game: WidgetVotesStore.GameKey(sport: sport.rawValue, gameId: gameId),
                matchup: matchup
            )
        ))
    }
}

private struct WidgetVotesModifier: ViewModifier {
    let context: WidgetVoteContext

    // Optional: previews and the screenshot harness mount sheets without these.
    @Environment(WidgetVotesStore.self) private var store: WidgetVotesStore?
    @Environment(AuthStore.self) private var auth: AuthStore?

    private var userId: String? {
        if case .authenticated(let id) = auth?.phase { return id.uuidString.lowercased() }
        return nil
    }

    func body(content: Content) -> some View {
        content
            // A game with no id cannot be voted on; leaving the context nil
            // hides the action row instead of showing buttons that do nothing.
            .environment(\.widgetVoteContext, context.game.gameId.isEmpty ? nil : context)
            .task(id: "\(context.game.sport)|\(context.game.gameId)|\(userId ?? "")") {
                guard let store else { return }
                // Before loading: `myVote` is per-account, so a user switch has
                // to drop the previous account's cache first.
                store.setUser(userId)
                guard userId != nil else { return }
                await store.ensureLoaded(context.game)
            }
    }
}
