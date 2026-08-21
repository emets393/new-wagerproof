import SwiftUI
import WagerproofModels
import WagerproofDesign

// MARK: - Prop signal UI (P1–P18 rule flags)

/// Compact prop-signal row shown beneath an NFL prop feed card when the
/// displayed market fired one or more P-flags.
struct NFLPropSignalFeedStrip: View {
    let flags: [String]
    /// Optional backtest records keyed by flag (`P14` → `12-8 · 60%`) from the
    /// pages payload — shown when present so the strip matches web chips.
    var recordsByKey: [String: String] = [:]

    private var signals: [NFLPropSignalDefinition] {
        NFLPropSignalDefinitions.resolve(flags)
    }

    private var actionable: [NFLPropSignalDefinition] {
        signals.filter { !$0.isAntiSignal }
    }

    private var anti: [NFLPropSignalDefinition] {
        signals.filter(\.isAntiSignal)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            header
            if !actionable.isEmpty {
                signalGroup(title: "Supports this prop", signals: actionable, muted: false)
            }
            if !anti.isEmpty {
                signalGroup(title: "Avoid this prop", signals: anti, muted: true)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 9)
        .background(Color.appSurfaceElevated.opacity(0.55), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(Color.appBorder.opacity(0.45), lineWidth: 0.6)
        )
    }

    private var header: some View {
        HStack(spacing: 6) {
            Image(systemName: "bolt.fill")
                .font(.system(size: 11, weight: .black))
                .foregroundStyle(Color(hex: 0xF97316))
            Text(signals.count == 1 ? "1 Prop Signal" : "\(signals.count) Prop Signals")
                .font(.system(size: 11, weight: .black))
                .foregroundStyle(Color(hex: 0xF97316))
            Spacer(minLength: 0)
        }
    }

    @ViewBuilder
    private func signalGroup(title: String, signals: [NFLPropSignalDefinition], muted: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 9, weight: .black))
                .foregroundStyle(muted ? Color.appAccentAmber : Color.appTextMuted)
            VStack(spacing: 6) {
                ForEach(signals) { signal in
                    NFLPropSignalCompactRow(
                        signal: signal,
                        muted: muted,
                        record: recordsByKey[signal.id]
                    )
                }
            }
        }
    }
}

private struct NFLPropSignalCompactRow: View {
    let signal: NFLPropSignalDefinition
    let muted: Bool
    var record: String? = nil

    private var tint: Color { muted ? Color.appAccentAmber : Color.appAccentBlue }

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: muted ? "exclamationmark.triangle.fill" : "info.circle.fill")
                .font(.system(size: 11, weight: .black))
                .foregroundStyle(tint)
            VStack(alignment: .leading, spacing: 1) {
                Text(signal.displayName)
                    .font(.system(size: 11, weight: .black))
                    .foregroundStyle(tint)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                HStack(spacing: 6) {
                    Text(signal.betDirection)
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(tint.opacity(0.75))
                    if let record, !record.isEmpty {
                        Text(record)
                            .font(.system(size: 9, weight: .semibold, design: .monospaced))
                            .foregroundStyle(tint.opacity(0.7))
                            .lineLimit(1)
                    }
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(tint.opacity(muted ? 0.12 : 0.16), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(tint.opacity(muted ? 0.45 : 0.38), lineWidth: 0.8)
        )
    }
}

struct NFLPropSignalGroup: View {
    let flags: [String]
    var recordsByKey: [String: String] = [:]
    var onSelect: (NFLPropSignalDefinition) -> Void = { _ in }

    private var signals: [NFLPropSignalDefinition] {
        NFLPropSignalDefinitions.resolve(flags)
    }

    var body: some View {
        if signals.isEmpty {
            EmptyView()
        } else {
            let actionable = signals.filter { !$0.isAntiSignal }
            let anti = signals.filter(\.isAntiSignal)
            VStack(alignment: .leading, spacing: 9) {
                if !actionable.isEmpty {
                    detailGroup(title: "Supports this prop", signals: actionable, muted: false)
                }
                if !anti.isEmpty {
                    detailGroup(title: "Avoid this prop", signals: anti, muted: true)
                }
            }
        }
    }

    @ViewBuilder
    private func detailGroup(title: String, signals: [NFLPropSignalDefinition], muted: Bool) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(.system(size: 9, weight: .black))
                .foregroundStyle(muted ? Color.appAccentAmber : Color.appTextMuted)
            // Full-width stacked rows — the old adaptive grid squeezed chips to
            // ~118pt and truncated titles like "Featured WR".
            VStack(spacing: 8) {
                ForEach(signals) { signal in
                    NFLPropSignalButton(
                        signal: signal,
                        muted: muted,
                        record: recordsByKey[signal.id],
                        onSelect: onSelect
                    )
                }
            }
        }
    }
}

/// Emerald chip row matching web `PropBreakdownPage` — label + optional record
/// when we have the pages payload but may not yet have catalog definitions.
struct NFLPropSignalChipRow: View {
    let signals: [NFLPropPageSignal]
    var onSelect: (NFLPropPageSignal) -> Void = { _ in }

    var body: some View {
        if signals.isEmpty {
            EmptyView()
        } else {
            FlowLayout(spacing: 6) {
                ForEach(signals) { sig in
                    Button { onSelect(sig) } label: {
                        HStack(spacing: 5) {
                            Text("⚡ \(sig.label)")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundStyle(Color(hex: 0x059669))
                            if let record = sig.record, !record.isEmpty {
                                Text(record)
                                    .font(.system(size: 10, weight: .semibold, design: .monospaced))
                                    .foregroundStyle(Color(hex: 0x047857).opacity(0.85))
                            }
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color(hex: 0x10B981).opacity(0.12), in: Capsule())
                        .overlay(Capsule().stroke(Color(hex: 0x10B981).opacity(0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

private struct NFLPropSignalButton: View {
    let signal: NFLPropSignalDefinition
    let muted: Bool
    var record: String? = nil
    let onSelect: (NFLPropSignalDefinition) -> Void

    private var color: Color { muted ? Color.appAccentAmber : Color.appAccentBlue }

    var body: some View {
        Button { onSelect(signal) } label: {
            HStack(spacing: 10) {
                Image(systemName: muted ? "exclamationmark.triangle.fill" : "info.circle.fill")
                    .font(.system(size: 13, weight: .black))
                    .foregroundStyle(color)
                VStack(alignment: .leading, spacing: 3) {
                    Text(signal.displayName)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(color)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(spacing: 6) {
                        Text(signal.betDirection)
                            .font(.system(size: 11, weight: .heavy))
                            .foregroundStyle(color.opacity(0.78))
                        if let record, !record.isEmpty {
                            Text("·")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(color.opacity(0.45))
                            Text(record)
                                .font(.system(size: 11, weight: .semibold, design: .monospaced))
                                .foregroundStyle(color.opacity(0.72))
                                .lineLimit(1)
                        }
                    }
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(color.opacity(0.85))
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 11)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(color.opacity(muted ? 0.10 : 0.14), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(color.opacity(muted ? 0.45 : 0.38), lineWidth: 1)
            )
            .contentShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct NFLPropSignalDetailSheet: View {
    let signal: NFLPropSignalDefinition
    let seasonRecord: SignalPerformance?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text(signal.displayName)
                        .font(.system(size: 22, weight: .black))
                        .foregroundStyle(Color.appTextPrimary)
                    if !signal.oneLiner.isEmpty {
                        Text(signal.oneLiner)
                            .font(.system(size: 14, weight: .medium))
                            .foregroundStyle(Color.appTextSecondary)
                    }
                    signalBlock("Definition", signal.definition)
                    signalBlock("Why It Works", signal.whyItWorks)
                    signalBlock("Bet Direction", signal.betDirection)
                    SignalPerformanceStatsSection(
                        backtestHit: signal.typicalHit,
                        seasonDisplay: SignalSeasonRecordDisplay(performance: seasonRecord)
                    )
                    if signal.isAntiSignal {
                        Text("This is an anti-signal — the backtest says to avoid betting this market when it fires.")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Color.appAccentAmber)
                    }
                }
                .padding(20)
            }
            .background(Color.appSurface)
            .navigationTitle("Prop Signal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .tint(Color.appPrimary)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder
    private func signalBlock(_ title: String, _ body: String) -> some View {
        if !body.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text(title.uppercased())
                    .font(.system(size: 10, weight: .black))
                    .tracking(0.6)
                    .foregroundStyle(Color.appTextMuted)
                Text(body)
                    .font(.system(size: 14))
                    .foregroundStyle(Color.appTextPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// Simple wrapping layout for emerald signal chips.
private struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var height: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > maxWidth, x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
            height = y + rowHeight
        }
        return CGSize(width: maxWidth.isFinite ? maxWidth : x, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0
        for sub in subviews {
            let size = sub.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            sub.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
