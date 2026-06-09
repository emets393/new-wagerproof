import SwiftUI
import WagerproofDesign

/// Large-scale Liquid Glass matchup hero with a scroll-driven morph.
///
/// Two team logos render as big glass discs. At `progress == 0` (hero expanded)
/// they overlap in the center and — inside a `GlassEffectContainer` — fuse into
/// one fluid liquid-glass blob with the team colors transitioning across the
/// seam. As `progress → 1` (hero collapsed) the two discs *flow apart* to
/// opposite edges and shrink, the glass un-merging continuously, landing on the
/// classic `away | lines | home` compact header. The split is the signature
/// Liquid Glass "movement" — driven directly by the collapse, not a discrete
/// animation.
///
/// Choreography by `progress`:
///   - discs: big+overlapping+fused  →  small+edges+separated
///   - `expandedStats` (below the fused discs): full, fades out on collapse
///   - `collapsedStats` (in the gap between split discs): fades in on collapse
///   - per-team abbr + ML (under each disc): hidden when fused, revealed split
///   - centered "AWAY @ HOME" title: shown only when fused
///
/// The host owns everything outside the disc/stat block (date row, pitchers,
/// etc.); this view is just the morphing matchup centerpiece.
struct MatchupGlassHero: View {
    struct Side {
        var logoURL: String?
        var abbr: String
        /// Raw team colors; lifted for dark mode internally via `teamVisible`.
        var primary: Color
        var secondary: Color
        var ml: Int?
    }

    struct Stat: Identifiable {
        let id = UUID()
        var label: String
        var value: String
    }

    let away: Side
    let home: Side
    /// Full stat rows shown stacked below the fused discs (expanded state).
    var expandedStats: [Stat]
    /// Trimmed stat rows shown in the gap between the split discs (collapsed).
    var collapsedStats: [Stat]
    let progress: CGFloat

    var bigSize: CGFloat = 80
    var smallSize: CGFloat = 40

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        let p = clamp(progress)
        let size = lerp(bigSize, smallSize, p)
        // Discs start fused and pull apart over the back half of the collapse,
        // so the big fused blob reads clearly before it splits.
        let split = clamp((p - 0.18) / 0.6)
        // Expanded extras (stacked lines below) fade over the first ~half.
        let detail = clamp(1 - p * 1.9)

        VStack(spacing: lerp(10, 5, p)) {
            discRow(size: size, split: split, p: p)
            if detail > 0.02 {
                expandedStatsRow
                    .opacity(detail)
            }
        }
    }

    // MARK: - Disc row (the morph)

    @ViewBuilder
    private func discRow(size: CGFloat, split: Double, p: CGFloat) -> some View {
        let labelH: CGFloat = 20
        let rowH = size + 2 + labelH
        let edgeMargin: CGFloat = 8
        GeometryReader { geo in
            let w = geo.size.width
            // The discs separate via real HStack LAYOUT spacing — not .offset or
            // .position — because GlassEffectContainer fuses glass based on the
            // laid-out frames. Fused: a slight negative gap so the two frames
            // overlap and the container metaball-bridges them. Split: a wide gap
            // that pushes them to opposite edges (where the bridge breaks).
            let fusedGap = -size * 0.16
            let splitGap = max(fusedGap, w - 2 * size - 2 * edgeMargin)
            let gap = lerp(fusedGap, splitGap, p)
            // Disc centers in the centered HStack (pitch = size + gap apart).
            let awayCX = w / 2 - (size + gap) / 2
            let homeCX = w / 2 + (size + gap) / 2
            let discCY = size / 2
            let labelCY = size + 2 + labelH / 2

            ZStack(alignment: .topLeading) {
                // Compact stats fill the gap that opens between the split discs.
                collapsedStatsView
                    .opacity(split)
                    .position(x: w / 2, y: discCY)

                // Two glass discs as direct HStack siblings: their layout frames
                // overlap (fused) or separate (split), so the container fuses /
                // un-fuses them accordingly.
                LiquidGlassMergeContainer(spacing: 30) {
                    HStack(spacing: gap) {
                        glassDisc(away, size: size)
                        glassDisc(home, size: size)
                    }
                }
                .frame(width: w, height: size)
                .position(x: w / 2, y: discCY)

                // Per-team abbr + ML track each disc's center; shown when split.
                sideLabel(away)
                    .opacity(split)
                    .position(x: awayCX, y: labelCY)
                sideLabel(home)
                    .opacity(split)
                    .position(x: homeCX, y: labelCY)

                // Centered "AWAY @ HOME" — only while the discs are fused.
                fusedTitle
                    .opacity(1 - split)
                    .position(x: w / 2, y: labelCY)
            }
            .frame(width: w, height: rowH)
        }
        .frame(height: rowH)
    }

    /// Per-team abbreviation + moneyline shown under a disc once it splits out.
    private func sideLabel(_ side: Side) -> some View {
        VStack(spacing: 0) {
            Text(side.abbr)
                .font(.system(size: 14, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
            Text(moneyline(side.ml))
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(Color.appTextSecondary)
        }
        .fixedSize()
    }

    /// A single big Liquid Glass team disc with the logo floating on top.
    @ViewBuilder
    private func glassDisc(_ side: Side, size: CGFloat) -> some View {
        let primary = side.primary.teamVisible(in: colorScheme)
        let secondary = side.secondary.teamVisible(in: colorScheme)
        let plate = logoPlate(for: primary)
        ZStack {
            if let logoURL = side.logoURL, let url = URL(string: logoURL) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let img):
                        ZStack {
                            if let plate { Circle().fill(plate) }
                            img.resizable().scaledToFit()
                                .padding(plate != nil ? size * 0.07 : 0)
                        }
                    default:
                        Text(side.abbr)
                            .font(.system(size: size * 0.3, weight: .bold))
                            .foregroundStyle(.white)
                    }
                }
                .frame(width: size * 0.82, height: size * 0.82)
                .clipShape(Circle())
            } else {
                Text(side.abbr)
                    .font(.system(size: size * 0.32, weight: .bold))
                    .foregroundStyle(.white)
            }
        }
        .frame(width: size, height: size)
        .teamGlassDisc(primary: primary, secondary: secondary, tint: 0.5)
        .shadow(color: primary.opacity(0.28), radius: 6, x: 0, y: 2)
    }

    // MARK: - Title + stats

    private var fusedTitle: some View {
        HStack(spacing: 6) {
            Text(away.abbr)
                .font(.system(size: 17, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
            Text("@")
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color.appTextMuted)
            Text(home.abbr)
                .font(.system(size: 17, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
        }
        .fixedSize()
    }

    private var expandedStatsRow: some View {
        HStack(spacing: 0) {
            ForEach(expandedStats) { stat in
                statColumn(stat)
                    .frame(maxWidth: .infinity)
            }
        }
    }

    private var collapsedStatsView: some View {
        HStack(spacing: 12) {
            ForEach(collapsedStats) { stat in
                statColumn(stat)
            }
        }
        .fixedSize()
    }

    private func statColumn(_ stat: Stat) -> some View {
        VStack(spacing: 2) {
            Text(stat.label.uppercased())
                .font(.system(size: 9, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
            Text(stat.value)
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
        }
    }

    // MARK: - Helpers

    private func clamp(_ t: CGFloat) -> CGFloat { min(1, max(0, t)) }
    private func clamp(_ t: Double) -> Double { min(1, max(0, t)) }
    private func lerp(_ a: CGFloat, _ b: CGFloat, _ t: CGFloat) -> CGFloat {
        a + (b - a) * clamp(t)
    }

    private func moneyline(_ ml: Int?) -> String {
        guard let ml else { return "-" }
        return ml > 0 ? "+\(ml)" : "\(ml)"
    }

    /// Faint plate behind a same-color logo so it doesn't vanish into a
    /// same-hue glass tint. Mirrors `GameRowCard` / `MLBTeamLogo`.
    private func logoPlate(for primary: Color) -> Color? {
        let lum = primary.relativeLuminance
        switch colorScheme {
        case .dark:
            return lum < 0.45 ? Color(white: 0.78).opacity(0.15) : nil
        default:
            return lum > 0.6 ? Color.black.opacity(0.55) : nil
        }
    }
}
