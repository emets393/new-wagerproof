import SwiftUI
import WagerproofDesign
import WagerproofModels

// Shared primitives for the matchup insight widgets (Betting Trends / Player
// Props / First-5). Every widget is the same 3-layer sandwich: verdict line →
// signal rows → expand footer, inside the existing WidgetCollapsingSection
// chrome. Summary math lives in Kit (TrendsInsight / PropsInsight / F5Insight)
// so SearchStore teasers and these widgets share one source of truth.

/// Shell every matchup insight widget uses. Wraps `WidgetCollapsingSection`
/// (verdict accessory + header tap) and appends the expand footer.
struct InsightWidgetSection<Content: View>: View {
    let title: String
    let systemImage: String
    var iconTint: Color = .appPrimary
    var badge: InsightVerdictBadge? = nil
    var expandLabel: String? = nil
    var onExpand: (() -> Void)? = nil
    @ViewBuilder var content: Content

    var body: some View {
        WidgetCollapsingSection(
            title: title,
            systemImage: systemImage,
            iconTint: iconTint,
            accessory: badge.map { .verdict(text: $0.text, tintHex: $0.tintHex) } ?? .none,
            onHeaderTap: onExpand
        ) {
            VStack(alignment: .leading, spacing: 12) {
                content
                if let expandLabel, let onExpand {
                    InsightExpandFooter(label: expandLabel, action: onExpand)
                }
            }
        }
    }
}

/// Verdict sentence(s) + lean-tinted capsule chips + 1–3 strength dots.
struct InsightVerdictLine: View {
    let verdicts: [InsightVerdict]
    let accent: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(verdicts) { verdict in
                row(verdict)
            }
        }
    }

    @ViewBuilder
    private func row(_ verdict: InsightVerdict) -> some View {
        let tint = leanTint(verdict.lean)
        HStack(spacing: 8) {
            if let chip = leanChip(verdict.lean) {
                Text(chip)
                    .font(.system(size: 10, weight: .bold))
                    .tracking(0.4)
                    .foregroundStyle(tint)
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(tint.opacity(0.14), in: Capsule())
            }
            Text(verdict.text)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(verdict.strength > 0 ? Color.appTextPrimary : Color.appTextSecondary)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
            Spacer(minLength: 4)
            if verdict.strength > 0 {
                HStack(spacing: 3) {
                    ForEach(0..<3, id: \.self) { i in
                        Circle()
                            .fill(i < verdict.strength ? tint : Color.appBorder.opacity(0.6))
                            .frame(width: 5, height: 5)
                    }
                }
            }
        }
    }

    private func leanChip(_ lean: InsightVerdict.Lean) -> String? {
        switch lean {
        case .team(let abbr, _): return abbr
        case .over: return "OVER"
        case .under: return "UNDER"
        case .none: return nil
        }
    }

    private func leanTint(_ lean: InsightVerdict.Lean) -> Color {
        switch lean {
        case .team: return accent
        case .over: return Color(hex: 0x22C55E)
        // Legacy adapter convention — under leans read blue, not red.
        case .under: return Color(hex: 0x3B82F6)
        case .none: return Color.appTextSecondary
        }
    }
}

/// Two-sided tug bar. Halves tinted at 0.85 opacity, widths proportional to
/// value/(away+home), numerals OUTSIDE the track in 11pt monospacedDigit,
/// nil side = gray dashed half, center hairline at 50/50.
struct SignalSplitBar: View {
    let awayValue: Double?
    let homeValue: Double?
    let awayNumeral: String
    let homeNumeral: String
    let awayTint: Color
    let homeTint: Color
    var height: CGFloat = 8

    init(awayValue: Double?, homeValue: Double?,
         awayNumeral: String, homeNumeral: String,
         awayTint: Color, homeTint: Color, height: CGFloat = 8) {
        self.awayValue = awayValue
        self.homeValue = homeValue
        self.awayNumeral = awayNumeral
        self.homeNumeral = homeNumeral
        self.awayTint = awayTint
        self.homeTint = homeTint
        self.height = height
    }

    var body: some View {
        HStack(spacing: 8) {
            numeral(awayNumeral, alignment: .trailing)
            track
            numeral(homeNumeral, alignment: .leading)
        }
    }

    private func numeral(_ text: String, alignment: Alignment) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .monospacedDigit()
            .foregroundStyle(Color.appTextPrimary)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
            .frame(minWidth: 34, alignment: alignment)
            .fixedSize()
    }

    private var track: some View {
        GeometryReader { geo in
            let w = geo.size.width
            let awayFraction: CGFloat = {
                // Any missing side gets a 50/50 split so the dashed
                // missing-data half stays visible (spec §1c).
                guard let a = awayValue, let h = homeValue else { return 0.5 }
                let total = a + h
                guard total > 0 else { return 0.5 }
                return CGFloat(a / total)
            }()
            ZStack(alignment: .leading) {
                HStack(spacing: 0) {
                    half(value: awayValue, tint: awayTint)
                        .frame(width: max(0, w * awayFraction))
                    half(value: homeValue, tint: homeTint)
                        .frame(width: max(0, w * (1 - awayFraction)))
                }
                // 50/50 reference hairline.
                Rectangle()
                    .fill(Color.appSurface.opacity(0.9))
                    .frame(width: 1)
                    .offset(x: w / 2)
            }
            .clipShape(Capsule())
        }
        .frame(height: height)
    }

    @ViewBuilder
    private func half(value: Double?, tint: Color) -> some View {
        if value != nil {
            Rectangle().fill(tint.opacity(0.85))
        } else {
            // Missing-data half: gray dashed so it can't read as a real value.
            Rectangle()
                .fill(Color.appBorder.opacity(0.25))
                .overlay(
                    Line()
                        .stroke(style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                        .foregroundStyle(Color.appTextMuted.opacity(0.6))
                )
        }
    }

    private struct Line: Shape {
        func path(in rect: CGRect) -> Path {
            var p = Path()
            p.move(to: CGPoint(x: rect.minX, y: rect.midY))
            p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
            return p
        }
    }
}

/// Label line + trailing badge capsule + `SignalSplitBar` (+ optional amber
/// subtext). ~44pt tall.
struct InsightSignalRow: View {
    let title: String
    let badgeText: String?
    let badgeTint: Color?
    let bar: SignalSplitBar
    var subtext: String? = nil

    init(title: String, badgeText: String?, badgeTint: Color?,
         bar: SignalSplitBar, subtext: String? = nil) {
        self.title = title
        self.badgeText = badgeText
        self.badgeTint = badgeTint
        self.bar = bar
        self.subtext = subtext
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 8) {
                Text(title)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Spacer(minLength: 4)
                if let badgeText {
                    let tint = badgeTint ?? Color.appTextSecondary
                    Text(badgeText)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(tint)
                        .padding(.horizontal, 7)
                        .padding(.vertical, 2)
                        .background(tint.opacity(0.13), in: Capsule())
                }
            }
            bar
            if let subtext {
                Text(subtext)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Color.appAccentAmber)
            }
        }
    }
}

/// Last-10 dot strip: cleared → filled green dot, missed → hollow gray.
struct MiniHitStrip: View {
    let strip: [(cleared: Bool, value: Double)]
    var dotSize: CGFloat = 5

    init(strip: [(cleared: Bool, value: Double)], dotSize: CGFloat = 5) {
        self.strip = strip
        self.dotSize = dotSize
    }

    var body: some View {
        HStack(spacing: 3) {
            ForEach(Array(strip.enumerated()), id: \.offset) { _, entry in
                if entry.cleared {
                    Circle()
                        .fill(Color(hex: 0x22C55E))
                        .frame(width: dotSize, height: dotSize)
                } else {
                    Circle()
                        .stroke(Color.appTextMuted.opacity(0.7), lineWidth: 1)
                        .frame(width: dotSize, height: dotSize)
                }
            }
        }
    }
}

/// Full-width expand affordance at the bottom of every insight widget.
struct InsightExpandFooter: View {
    let label: String
    let action: () -> Void

    init(label: String, action: @escaping () -> Void) {
        self.label = label
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            VStack(spacing: 0) {
                Divider().overlay(Color.appBorder.opacity(0.4))
                HStack(spacing: 4) {
                    Text(label)
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .semibold))
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appPrimary)
                .frame(maxWidth: .infinity)
                .padding(.top, 10)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// Shared first-hydrate skeleton mirroring the digest layout: verdict-line
/// block, N × [two stacked blocks + trailing capsule], footer block.
struct InsightWidgetSkeleton: View {
    var rowCount: Int = 3

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            SkeletonBlock(width: 200, height: 14)
            ForEach(0..<rowCount, id: \.self) { _ in
                HStack(alignment: .center, spacing: 10) {
                    VStack(alignment: .leading, spacing: 6) {
                        SkeletonBlock(width: 130, height: 10)
                        SkeletonBlock(height: 8, cornerRadius: 4)
                    }
                    SkeletonCapsule(width: 52, height: 18)
                }
            }
            SkeletonBlock(width: 140, height: 12)
                .frame(maxWidth: .infinity)
        }
        .shimmering()
    }
}
