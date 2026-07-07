import SwiftUI
import WagerproofDesign
#if canImport(UIKit)
import UIKit
#endif

// =====================================================================
// TicketDeleteGesture — long-press-arm → vertical-drag-to-trash for the
// Week Long Parlays section's parlay cards.
//
// NOT used by the Today's Picks rail: even sequenced behind a long press,
// attaching this via `.gesture()` to a rail item claims the touch on
// touch-down, which starves the rail's horizontal `ScrollView` of the pan
// gesture it needs — the rail simply stopped scrolling. That rail's delete
// affordance is now the trash button in `AgentPickFocusView`'s top bar
// instead (see `onDelete` there). This gesture is safe on the parlay
// section because those cards sit in a plain vertical stack with no
// horizontal scroll to compete with; once armed the ticket lifts, a trash
// disc fades in beneath it, and dragging up past the threshold asks the
// host to confirm the delete (the destructive confirmationDialog + store
// call live on AgentDetailView).
// =====================================================================

struct TicketDeleteGestureModifier: ViewModifier {
    /// Off (nil-handler call sites) renders the plain content — public agent
    /// views, previews, and the history folder never get the gesture.
    var enabled: Bool
    /// Fired when the drag commits past the threshold. The HOST confirms
    /// (destructive dialog) before actually deleting.
    var onRequestDelete: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var armed = false
    @State private var dragOffset: CGFloat = 0
    @State private var pastThreshold = false

    /// Upward travel (pt) that commits the delete request.
    private let commitThreshold: CGFloat = 56
    private let maxLift: CGFloat = 84

    func body(content: Content) -> some View {
        ZStack(alignment: .bottom) {
            trashZone
            content
                .offset(y: armed ? liftOffset : 0)
                .scaleEffect(armed ? 1.04 : 1)
                .shadow(color: .black.opacity(armed ? 0.35 : 0), radius: 12, y: 6)
        }
        .zIndex(armed ? 10 : 0)
        .gesture(enabled ? deleteGesture : nil)
        .animation(reduceMotion ? nil : .spring(response: 0.32, dampingFraction: 0.75), value: armed)
        .animation(reduceMotion ? nil : .interactiveSpring(response: 0.2, dampingFraction: 0.85), value: dragOffset)
    }

    /// Rubber-banded vertical travel: free upward to `maxLift`, a token 8pt of
    /// give downward so the ticket feels held, not railed.
    private var liftOffset: CGFloat {
        if dragOffset >= 0 { return min(8, dragOffset * 0.3) }
        let up = -dragOffset
        if up <= maxLift { return -up }
        return -(maxLift + (up - maxLift) * 0.15)
    }

    private var trashZone: some View {
        ZStack {
            Circle()
                .fill(Color.appLoss.opacity(pastThreshold ? 0.92 : 0.22))
            Image(systemName: "trash.fill")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(pastThreshold ? Color.white : Color.appLoss)
        }
        .frame(width: 44, height: 44)
        .scaleEffect(pastThreshold ? 1.12 : 1)
        .opacity(armed ? 1 : 0)
        .offset(y: 8)
        .allowsHitTesting(false)
        .animation(reduceMotion ? nil : .spring(response: 0.25, dampingFraction: 0.7), value: pastThreshold)
    }

    private var deleteGesture: some Gesture {
        LongPressGesture(minimumDuration: 0.35)
            .sequenced(before: DragGesture(minimumDistance: 0, coordinateSpace: .local))
            .onChanged { value in
                switch value {
                case .first(true):
                    if !armed {
                        armed = true
                        haptic(.medium)
                    }
                case .second(true, let drag):
                    armed = true
                    let dy = drag?.translation.height ?? 0
                    dragOffset = dy
                    let over = dy <= -commitThreshold
                    if over != pastThreshold {
                        pastThreshold = over
                        if over { haptic(.rigid) }
                    }
                default:
                    break
                }
            }
            .onEnded { value in
                let commit: Bool
                if case .second(true, let drag) = value {
                    commit = (drag?.translation.height ?? 0) <= -commitThreshold
                } else {
                    commit = false
                }
                armed = false
                dragOffset = 0
                pastThreshold = false
                if commit { onRequestDelete() }
            }
    }

    private func haptic(_ style: HapticStyle) {
        #if canImport(UIKit)
        switch style {
        case .medium: UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        case .rigid: UIImpactFeedbackGenerator(style: .rigid).impactOccurred()
        }
        #endif
    }

    private enum HapticStyle { case medium, rigid }
}

extension View {
    /// Long-press then swipe up to reveal/commit a trash action under a ticket.
    /// `enabled: false` is a no-op passthrough (gesture never attached).
    func deletableTicket(enabled: Bool, onRequestDelete: @escaping () -> Void) -> some View {
        modifier(TicketDeleteGestureModifier(enabled: enabled, onRequestDelete: onRequestDelete))
    }
}
