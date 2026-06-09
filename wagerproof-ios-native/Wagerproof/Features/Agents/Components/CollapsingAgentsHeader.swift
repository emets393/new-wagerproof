import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Geometry for the Agents hub's collapsing pixel-office hero.
///
/// On scroll the office starts full-width at the top and shrinks into a small
/// floating "minimap" widget the user can drag between the four screen corners.
/// The agent list scrolls full-screen underneath — there's no reserved header
/// bar — and the office returns to its full-size place when scrolled back to
/// the top. See `FloatingOfficeWidget`.
///
/// The list's constant top spacer equals `expandedHeight`, and the collapse
/// completes over that same distance, so by the time the office is fully
/// collapsed the list has scrolled up to fill the whole screen (no black gap).
enum AgentsHeaderMetrics {
    static let hPad: CGFloat = 12
    /// PixelOffice map aspect (height / width) — see PixelOfficeGeo.
    static let officeAspect: CGFloat = 800.0 / 864.0
    static let topInset: CGFloat = 8
    static let bottomInset: CGFloat = 10
    /// Width of the collapsed floating widget.
    static let tinyWidth: CGFloat = 140
    /// Inset of the floating widget from the screen edges at each corner.
    static let cornerInset: CGFloat = 14
    static let topCornerClearance: CGFloat = 10
    /// Extra bottom inset so the widget clears the floating tab bar.
    static let bottomCornerClearance: CGFloat = 96

    static func officeWidth(_ width: CGFloat) -> CGFloat { max(0, width - hPad * 2) }
    static func officeFullHeight(_ width: CGFloat) -> CGFloat { officeWidth(width) * officeAspect }
    static func expandedHeight(_ width: CGFloat) -> CGFloat { officeFullHeight(width) + topInset + bottomInset }
    /// Scroll distance over which the office fully collapses. Equals the spacer
    /// height so the list fills the screen exactly as the office reaches its
    /// tiny floating state.
    static func collapseDistance(_ width: CGFloat) -> CGFloat { max(1, expandedHeight(width)) }
}

/// The four screen corners the tiny office can snap to.
enum OfficeCorner: CaseIterable {
    case topLeading, topTrailing, bottomLeading, bottomTrailing
}

/// The pixel office rendered as a scroll-driven floating widget. At
/// `progress == 0` it fills the top of the page (full size); at `progress == 1`
/// it's a small draggable minimap pinned to `corner`, with the agency stats as
/// a liquid-glass pill over it. Dragging (only while collapsed) snaps it to the
/// nearest corner; scrolling back up returns it to its full-size place.
struct FloatingOfficeWidget: View {
    let agents: [AgentWithPerformance]
    let progress: CGFloat
    let width: CGFloat
    let height: CGFloat
    @Binding var corner: OfficeCorner

    @State private var dragOffset: CGSize = .zero

    private var p: CGFloat { min(1, max(0, progress)) }
    private var officeWidth: CGFloat { AgentsHeaderMetrics.officeWidth(width) }
    private var officeFullHeight: CGFloat { AgentsHeaderMetrics.officeFullHeight(width) }
    private var tinyScale: CGFloat { officeWidth > 0 ? AgentsHeaderMetrics.tinyWidth / officeWidth : 0.4 }
    private var scale: CGFloat { 1 - p * (1 - tinyScale) }

    /// Stats pill fades in only once the office has mostly shrunk.
    private var statsOpacity: Double { Double(max(0, (p - 0.6) / 0.4)) }

    var body: some View {
        let scaledW = officeWidth * scale
        let scaledH = officeFullHeight * scale
        let center = currentCenter()

        ZStack(alignment: .topLeading) {
            // ── Office (just scaled — no edge blur / opacity effects) ──
            PixelOffice(agents: agents, isActive: true)
                .frame(width: officeWidth, height: officeFullHeight)
                .scaleEffect(scale, anchor: .topLeading)
                .frame(width: scaledW, height: scaledH, alignment: .topLeading)
                .shadow(color: .black.opacity(0.35 * Double(p)), radius: 12 * p, x: 0, y: 5 * p)
                .offset(x: center.x - scaledW / 2, y: center.y - scaledH / 2)
                // Interactive only while collapsed, so the office doesn't eat
                // scroll drags during the expand/collapse transition.
                .allowsHitTesting(p > 0.9)
                .gesture(dragGesture)

            // ── Agency stats — liquid-glass pill over the tiny office ──
            AgencyStatsPill(agents: agents)
                .opacity(statsOpacity)
                .position(x: center.x, y: center.y + scaledH / 2 - 12)
                .allowsHitTesting(false)
        }
        .frame(width: width, height: height, alignment: .topLeading)
    }

    // MARK: - Positioning

    private var expandedCenter: CGPoint {
        CGPoint(x: width / 2, y: AgentsHeaderMetrics.topInset + officeFullHeight / 2)
    }

    private func collapsedCenter(_ corner: OfficeCorner) -> CGPoint {
        let tinyW = AgentsHeaderMetrics.tinyWidth
        let tinyH = tinyW * AgentsHeaderMetrics.officeAspect
        let inset = AgentsHeaderMetrics.cornerInset
        let leftX = inset + tinyW / 2
        let rightX = width - inset - tinyW / 2
        let topY = AgentsHeaderMetrics.topCornerClearance + tinyH / 2
        let bottomY = height - AgentsHeaderMetrics.bottomCornerClearance - tinyH / 2
        switch corner {
        case .topLeading: return CGPoint(x: leftX, y: topY)
        case .topTrailing: return CGPoint(x: rightX, y: topY)
        case .bottomLeading: return CGPoint(x: leftX, y: bottomY)
        case .bottomTrailing: return CGPoint(x: rightX, y: bottomY)
        }
    }

    private func currentCenter() -> CGPoint {
        let target = collapsedCenter(corner)
        let base = CGPoint(
            x: expandedCenter.x + (target.x - expandedCenter.x) * p,
            y: expandedCenter.y + (target.y - expandedCenter.y) * p
        )
        return CGPoint(x: base.x + dragOffset.width, y: base.y + dragOffset.height)
    }

    // MARK: - Drag → snap to nearest corner

    private var dragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                dragOffset = value.translation
            }
            .onEnded { value in
                let dropped = CGPoint(
                    x: collapsedCenter(corner).x + value.translation.width,
                    y: collapsedCenter(corner).y + value.translation.height
                )
                let nearest = OfficeCorner.allCases.min(by: {
                    Self.distance(collapsedCenter($0), dropped) < Self.distance(collapsedCenter($1), dropped)
                }) ?? corner
                withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                    corner = nearest
                    dragOffset = .zero
                }
            }
    }

    private static func distance(_ a: CGPoint, _ b: CGPoint) -> CGFloat {
        let dx = a.x - b.x, dy = a.y - b.y
        return dx * dx + dy * dy
    }
}

/// Compact agency stats rendered as a liquid-glass pill that floats over the
/// tiny office. Mirrors `CompanyDashboardBanner`'s computations.
struct AgencyStatsPill: View {
    let agents: [AgentWithPerformance]

    private var totalNetUnits: Double {
        agents.reduce(0) { $0 + ($1.performance?.netUnits ?? 0) }
    }
    private var winRateAverage: Double {
        let withPerf = agents.compactMap { $0.performance }.filter { $0.totalPicks > 0 }
        guard !withPerf.isEmpty else { return 0 }
        let total = withPerf.reduce(0.0) { acc, perf in
            let settled = perf.wins + perf.losses
            guard settled > 0 else { return acc }
            return acc + Double(perf.wins) / Double(settled)
        }
        return total / Double(withPerf.count)
    }
    private var activeCount: Int { agents.filter { $0.agent.isActive }.count }
    private var unitsColor: Color { totalNetUnits >= 0 ? .appWin : .appLoss }
    private var unitsLabel: String {
        let sign = totalNetUnits >= 0 ? "+" : ""
        return String(format: "%@%.2fu", sign, totalNetUnits)
    }

    var body: some View {
        HStack(spacing: 5) {
            Text(unitsLabel)
                .foregroundStyle(unitsColor)
            Text("·").foregroundStyle(Color.appTextMuted)
            Text(String(format: "%.0f%%", winRateAverage * 100))
                .foregroundStyle(Color.appTextPrimary)
            Text("·").foregroundStyle(Color.appTextMuted)
            Text("\(activeCount)/\(agents.count)")
                .foregroundStyle(Color.appTextPrimary)
        }
        .font(.system(size: 11, weight: .heavy, design: .rounded))
        .lineLimit(1)
        .fixedSize()
        .padding(.horizontal, 11)
        .padding(.vertical, 6)
        .liquidGlassBackground(in: Capsule())
        .overlay(Capsule().strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 0.5))
    }
}
