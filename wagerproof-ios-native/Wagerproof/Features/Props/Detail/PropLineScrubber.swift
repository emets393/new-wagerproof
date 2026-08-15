import SwiftUI
import WagerproofModels
import WagerproofDesign

/// Floating line scrubber. Collapsed it is a tiny glass pill that sits over
/// the scrolling widgets; a tap expands the same pill to hold the readout and
/// the alternate-line wheel. Content scrolls underneath — this view is an
/// overlay, not a layout inset.
///
/// The tick under the centered caret is the selected line, and scrubbing
/// left/right updates everything upstream in real time. Digits roll via the
/// numeric-text content transition.
struct PropLineScrubber: View {
    let lines: [MLBPlayerPropLineEntry]
    @Binding var selectedLine: Double

    /// The line currently centered under the caret (drives the scroll wheel).
    @State private var centered: Double?
    /// Starts collapsed so the wheel is out of the way until the user wants it.
    @State private var isExpanded = false

    private var activeEntry: MLBPlayerPropLineEntry? { lines.first { $0.line == selectedLine } }

    private let tickWidth: CGFloat = 58
    private let wheelHeight: CGFloat = 54

    var body: some View {
        VStack(spacing: isExpanded ? 8 : 0) {
            header
            if isExpanded {
                wheel
                    .transition(.opacity)
            }
        }
        .padding(.horizontal, isExpanded ? 16 : 14)
        .padding(.vertical, isExpanded ? 12 : 8)
        .frame(maxWidth: isExpanded ? .infinity : nil)
        .liquidGlassBackground(in: pillShape)
        .overlay(pillShape.strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5))
        .shadow(color: .black.opacity(0.18), radius: isExpanded ? 16 : 10, x: 0, y: 4)
        .padding(.horizontal, isExpanded ? 12 : 0)
        .onAppear { centered = selectedLine }
        .onChange(of: centered) { _, v in
            if let v, v != selectedLine { selectedLine = v }
        }
        .onChange(of: selectedLine) { _, v in
            if centered != v { centered = v }
        }
        .sensoryFeedback(.selection, trigger: selectedLine)
        .animation(.snappy(duration: 0.28), value: isExpanded)
    }

    private var pillShape: RoundedRectangle {
        RoundedRectangle(cornerRadius: isExpanded ? 28 : 20, style: .continuous)
    }

    // MARK: - Header (compact pill vs expanded readout)

    private var header: some View {
        Button {
            withAnimation(.snappy(duration: 0.28)) { isExpanded.toggle() }
        } label: {
            Group {
                if isExpanded {
                    expandedReadout
                } else {
                    compactReadout
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Line \(MLBPlayerProps.formatLine(selectedLine))")
        .accessibilityHint(isExpanded ? "Collapse line selector" : "Expand line selector")
        .accessibilityAddTraits(.isButton)
    }

    /// Tiny collapsed chip — line + over price, hugs its content.
    private var compactReadout: some View {
        HStack(spacing: 8) {
            Text(MLBPlayerProps.formatLine(selectedLine))
                .font(.system(size: 16, weight: .heavy, design: .rounded))
                .foregroundStyle(Color.appTextPrimary)
                .contentTransition(.numericText())
                .animation(.snappy(duration: 0.28), value: selectedLine)
            Text(MLBPlayerProps.formatOdds(activeEntry?.over))
                .font(.system(size: 12, weight: .heavy, design: .monospaced))
                .foregroundStyle(Color.appPrimary)
                .contentTransition(.numericText())
                .animation(.snappy(duration: 0.28), value: selectedLine)
            Image(systemName: "chevron.up")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
        }
    }

    private var expandedReadout: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 0) {
                Text("LINE")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.6)
                    .foregroundStyle(Color.appTextMuted)
                Text(MLBPlayerProps.formatLine(selectedLine))
                    .font(.system(size: 22, weight: .heavy, design: .rounded))
                    .foregroundStyle(Color.appTextPrimary)
                    .contentTransition(.numericText())
                    .animation(.snappy(duration: 0.28), value: selectedLine)
            }
            Spacer()
            HStack(spacing: 6) {
                oddsChip(prefix: "O", odds: activeEntry?.over, tint: Color.appPrimary)
                oddsChip(prefix: "U", odds: activeEntry?.under, tint: Color.appTextSecondary)
            }
            Image(systemName: "chevron.down")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
                .frame(width: 18)
                .accessibilityHidden(true)
        }
    }

    private func oddsChip(prefix: String, odds: Int?, tint: Color) -> some View {
        HStack(spacing: 4) {
            Text(prefix)
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
            Text(MLBPlayerProps.formatOdds(odds))
                .font(.system(size: 13, weight: .heavy, design: .monospaced))
                .foregroundStyle(tint)
                .contentTransition(.numericText())
                .animation(.snappy(duration: 0.28), value: selectedLine)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color.appSurfaceMuted.opacity(0.5), in: Capsule())
        .overlay(Capsule().stroke(Color.appBorder.opacity(0.5), lineWidth: 0.5))
    }

    // MARK: - Scroll wheel

    private var wheel: some View {
        GeometryReader { geo in
            let pad = max(0, (geo.size.width - tickWidth) / 2)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 0) {
                    ForEach(lines, id: \.line) { entry in
                        tick(entry)
                            .frame(width: tickWidth, height: wheelHeight)
                            .id(entry.line)
                            .scrollTransition(.interactive, axis: .horizontal) { content, phase in
                                content
                                    .scaleEffect(phase.isIdentity ? 1 : 0.78)
                                    .opacity(phase.isIdentity ? 1 : 0.4)
                            }
                            .contentShape(Rectangle())
                            .onTapGesture {
                                withAnimation(.snappy) { centered = entry.line }
                            }
                    }
                }
                .scrollTargetLayout()
                .padding(.horizontal, pad)
            }
            .scrollPosition(id: $centered, anchor: .center)
            // Custom snap so a tick ALWAYS settles centered under the caret —
            // `.viewAligned` snaps leading edges, which would let the caret
            // rest between two lines. Each item is `tickWidth` wide (spacing 0)
            // and the content is half-width padded, so the centered offset for
            // line i is exactly `i * tickWidth`.
            .scrollTargetBehavior(SnapToTickBehavior(tickWidth: tickWidth))
            .overlay(alignment: .top) { caret }
            .mask(
                LinearGradient(
                    stops: [
                        .init(color: .clear, location: 0),
                        .init(color: .black, location: 0.18),
                        .init(color: .black, location: 0.82),
                        .init(color: .clear, location: 1),
                    ],
                    startPoint: .leading, endPoint: .trailing
                )
            )
        }
        .frame(height: wheelHeight)
    }

    private var caret: some View {
        Capsule()
            .fill(Color.appPrimary)
            .frame(width: 3, height: 16)
            .shadow(color: Color.appPrimary.opacity(0.6), radius: 4)
    }

    private func tick(_ entry: MLBPlayerPropLineEntry) -> some View {
        let isCentered = entry.line == centered
        return VStack(spacing: 6) {
            RoundedRectangle(cornerRadius: 1)
                .fill(isCentered ? Color.appPrimary : Color.appBorderStrong)
                .frame(width: 2, height: isCentered ? 22 : 14)
            Text(MLBPlayerProps.formatLine(entry.line))
                .font(.system(size: isCentered ? 17 : 14, weight: isCentered ? .heavy : .semibold, design: .rounded))
                .foregroundStyle(isCentered ? Color.appPrimary : Color.appTextSecondary)
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .padding(.top, 4)
        .animation(.snappy(duration: 0.2), value: isCentered)
    }
}

/// Snaps the scroll so a tick always lands centered under the caret. With
/// `tickWidth`-wide items at spacing 0 and half-width content padding, the
/// rest offset that centers line *i* is exactly `i * tickWidth` — so we round
/// the proposed offset to the nearest multiple of `tickWidth`.
private struct SnapToTickBehavior: ScrollTargetBehavior {
    let tickWidth: CGFloat

    func updateTarget(_ target: inout ScrollTarget, context: TargetContext) {
        guard tickWidth > 0 else { return }
        let index = (target.rect.origin.x / tickWidth).rounded()
        target.rect.origin.x = index * tickWidth
    }
}
