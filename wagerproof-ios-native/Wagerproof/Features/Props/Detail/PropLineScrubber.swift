import SwiftUI
import WagerproofModels
import WagerproofDesign

/// Bottom line scrubber — a Liquid Glass bar that replaces the tab bar on the
/// prop detail page. Collapsed it is a single readout row so it stays out of
/// the way; a tap expands the alternate-line wheel. The tick under the centered
/// caret is the selected line, and scrubbing left/right updates everything
/// upstream in real time.
///
/// The readout (line + Over/Under odds) uses the numeric-text content
/// transition so the digits roll as you scrub.
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
            readout
            if isExpanded {
                wheel
                    .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, isExpanded ? 12 : 10)
        .padding(.bottom, isExpanded ? 10 : 10)
        .frame(maxWidth: .infinity)
        .liquidGlassBackground(in: RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.5), lineWidth: 0.5)
        )
        .padding(.horizontal, 12)
        .shadow(color: .black.opacity(0.12), radius: 12, x: 0, y: 4)
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

    // MARK: - Readout (line + odds)

    private var readout: some View {
        Button {
            withAnimation(.snappy(duration: 0.28)) { isExpanded.toggle() }
        } label: {
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
                Image(systemName: isExpanded ? "chevron.down" : "chevron.up")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Color.appTextMuted)
                    .frame(width: 18)
                    .accessibilityHidden(true)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Line \(MLBPlayerProps.formatLine(selectedLine))")
        .accessibilityHint(isExpanded ? "Collapse line selector" : "Expand line selector")
        .accessibilityAddTraits(.isButton)
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
                // Fade the ladder toward both edges so it reads as a wheel.
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

    /// Fixed center indicator the wheel scrubs under.
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
