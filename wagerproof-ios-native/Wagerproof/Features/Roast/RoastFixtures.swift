#if DEBUG
import Foundation
import WagerproofStores

/// Deterministic sample data for the Roast parity screenshots.
/// Not used in production — gated behind `#if DEBUG`.
///
/// Covers three states:
/// - `empty`: idle, no messages, default intensity.
/// - `loaded`: a four-turn transcript at savage intensity.
/// - `error`: idle with a banner-tinted error string.
enum RoastFixtures {
    /// Four-turn conversation showcasing the user/assistant alternation +
    /// the "THE BOOKIE" caption + the corner-pinch on both sides.
    static var sampleConversation: [RoastSessionStore.Message] {
        [
            .init(
                id: "msg-1",
                role: .user,
                text: "I bet $500 on a Lions ML parlay with the Bears -3."
            ),
            .init(
                id: "msg-2",
                role: .assistant,
                text: "A Detroit-Chicago parlay. Beautiful. You found the one wager that's worse than burning the cash for warmth."
            ),
            .init(
                id: "msg-3",
                role: .user,
                text: "And I added Trubisky over 1.5 TDs."
            ),
            .init(
                id: "msg-4",
                role: .assistant,
                text: "Stop. Just stop. I'm not a therapist, I'm a sportsbook. Even I have limits."
            ),
        ]
    }

    /// Live-recording variant — interim user transcript pinned at the bottom.
    static let sampleLiveTranscript = "Okay so I bet $200 on the Knicks at +800 to win the East and then I…"
}
#endif
