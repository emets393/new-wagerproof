import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices

/// Tappable preset archetype tile shown in Screen 1's "Use a Preset" path.
/// Ports `components/agents/inputs/ArchetypeCard.tsx`.
struct ArchetypeCard: View {
    /// `.standard` — the wizard tile: emoji glyph + recommended-sport badges.
    /// `.compact` — the onboarding tile: a pixel-office character in place of
    /// the emoji and no sport badges, so the row reads slimmer.
    enum Style { case standard, compact }

    let row: PresetArchetypeRow
    var style: Style = .standard
    /// Pixel-office character shown in `.compact` style. Ignored by `.standard`,
    /// which renders `row.emoji`.
    var spriteIndex: Int = 0
    let selected: Bool
    let onSelect: () -> Void

    private var accentColor: Color {
        Color(hexString: row.color) ?? Color(hex: 0x00E676)
    }

    private var isCompact: Bool { style == .compact }

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    leadingGlyph

                    VStack(alignment: .leading, spacing: 4) {
                        Text(row.name)
                            .font(.system(size: 17, weight: .bold))
                            .foregroundStyle(Color.appTextPrimary)
                            .lineLimit(1)
                        Text(row.description)
                            .font(.system(size: 13))
                            .foregroundStyle(Color.appTextSecondary)
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                    }

                    Spacer(minLength: 8)

                    if selected {
                        ZStack {
                            Circle().fill(accentColor)
                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                        }
                        .frame(width: 24, height: 24)
                    }
                }

                // Onboarding tiles drop the sport badges to stay slim; the
                // wizard keeps them so the preset's leagues read at a glance.
                if !isCompact, !row.recommendedSports.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(row.recommendedSports, id: \.self) { sport in
                            sportBadge(sport)
                        }
                    }
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            // Liquid Glass card surface; the accent stroke remains as the
            // selection indicator only.
            .liquidGlassBackground(
                in: RoundedRectangle(cornerRadius: 16, style: .continuous),
                tint: selected ? accentColor.opacity(0.16) : Color.white.opacity(0.05)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(selected ? accentColor : Color.clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
        .padding(.vertical, 4)
    }

    /// The 48×48 Liquid Glass tile leading the row. `.standard` shows the
    /// archetype's emoji; `.compact` puts a pixel-office character inside the
    /// same glass container (it bobs when the tile is selected).
    @ViewBuilder
    private var leadingGlyph: some View {
        switch style {
        case .standard:
            Text(row.emoji)
                .font(.system(size: 24))
                .frame(width: 48, height: 48)
                .liquidGlassBackground(
                    in: RoundedRectangle(cornerRadius: 12, style: .continuous),
                    tint: accentColor.opacity(0.20)
                )
        case .compact:
            PixelSpriteAvatar(spriteIndex: spriteIndex, animated: selected)
                .padding(5)
                .frame(width: 48, height: 48)
                .liquidGlassBackground(
                    in: RoundedRectangle(cornerRadius: 12, style: .continuous),
                    tint: accentColor.opacity(0.20)
                )
        }
    }

    private func sportBadge(_ sport: AgentSport) -> some View {
        HStack(spacing: 4) {
            Image(systemName: sport.sfSymbol)
                .font(.system(size: 11))
            Text(sport.label)
                .font(.system(size: 11, weight: .bold))
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .foregroundStyle(Color.appTextSecondary)
        .background(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.appBorder.opacity(0.4))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .strokeBorder(Color.appBorder, lineWidth: 1)
        )
    }
}
