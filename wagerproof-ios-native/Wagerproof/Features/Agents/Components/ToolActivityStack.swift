import SwiftUI
import WagerproofDesign

/// The horizontal fan of placeholder pick tickets shown while polling. Every
/// cumulative tool call the agent makes (`count`) deals one more BLANK scaffold
/// ticket — the exact `AgentPickMiniTicketSkeleton` used by the final Today's
/// Picks rail — into a left-aligned, evenly-fanned deck.
///
/// Design language (matches the reference mock):
///   • **Left-aligned, grows across the screen.** The first ticket sits at the
///     leading edge; each newer ticket fans out to its right. The row extends
///     rightward as tickets deal in, then tightens its overlap once it reaches
///     the trailing edge so it never runs past the width.
///   • **First ticket on top.** The leading (oldest) ticket is frontmost; newer
///     ones fan BEHIND it to the right. So the "beginning" of the run stays fully
///     lit and unoccluded — it never washes out.
///   • **Even coloring.** Every ticket renders at the same brightness/scale.
///     Depth reads purely from the crisp drop-shadow seam each ticket casts onto
///     the one fanned behind it — no dimming or shrinking of the back cards.
struct ToolActivityStack: View {
    /// Cumulative tool-use count from the run metadata (`toolCalls`).
    var count: Int
    /// Kept for call-site compatibility; the skeleton cardstock is neutral.
    var accent: Color

    /// How many scaffolds render at once before the oldest fall off the front.
    private let maxVisible = 7
    /// Comfortable peek while the deck is still growing (few cards) — how much of
    /// each ticket's leading edge shows before the next one fans over it. Shrinks
    /// automatically once the fan reaches the trailing edge.
    private let idealPeek: CGFloat = 96
    /// Never overlap tighter than this, so every ticket keeps a readable sliver.
    private let minPeek: CGFloat = 28

    private var cardW: CGFloat { AgentPickMiniTicket.width }
    private var cardH: CGFloat { AgentPickMiniTicket.height }

    private var visibleIndices: [Int] {
        guard count > 0 else { return [] }
        let lower = max(0, count - maxVisible)
        return Array(lower..<count)
    }

    var body: some View {
        GeometryReader { geo in
            let indices = visibleIndices
            let n = indices.count
            // The trailing ticket's leading edge can travel at most this far and
            // still keep its trailing edge inside the container.
            let travel = max(0, geo.size.width - cardW)
            // Grow at `idealPeek` until the fan reaches the trailing edge, then
            // clamp so it exactly fills the width (tighter overlap), with a floor.
            let fillPeek = n > 1 ? travel / CGFloat(n - 1) : 0
            let peek = n > 1 ? max(minPeek, min(idealPeek, fillPeek)) : 0

            ZStack(alignment: .leading) {
                ForEach(indices, id: \.self) { idx in
                    let pos = idx - (indices.first ?? 0)   // 0 = leading / frontmost
                    AgentPickMiniTicketSkeleton()
                        .offset(x: CGFloat(pos) * peek)
                        // Front-to-back: the leading ticket is on top; each casts
                        // its shadow rightward onto the one fanned behind it → a
                        // crisp depth seam with no dimming or scaling.
                        .zIndex(Double(maxVisible - pos))
                        .shadow(color: .black.opacity(0.55), radius: 9, x: 7, y: 4)
                        .transition(.asymmetric(
                            insertion: .move(edge: .trailing).combined(with: .opacity),
                            removal: .opacity
                        ))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .animation(.spring(response: 0.44, dampingFraction: 0.82), value: count)
        }
        // Reserve a stable footprint (+ a little slack for the shadow) so the row
        // below never jumps as tickets deal in.
        .frame(height: cardH + 10)
    }
}

#if DEBUG
#Preview("Tool activity stack") {
    struct Demo: View {
        @State private var count = 1
        var body: some View {
            ZStack {
                Color(hex: 0x0B1011).ignoresSafeArea()
                VStack(spacing: 24) {
                    ToolActivityStack(count: count, accent: Color(hex: 0xFF8A00))
                    HStack(spacing: 16) {
                        Button("Deal ticket") { count += 1 }
                        Button("Reset") { count = 1 }
                    }
                    .foregroundStyle(.white)
                    Text("count: \(count)").foregroundStyle(.secondary)
                }
                .padding(16)
            }
            .preferredColorScheme(.dark)
        }
    }
    return Demo()
}
#endif
