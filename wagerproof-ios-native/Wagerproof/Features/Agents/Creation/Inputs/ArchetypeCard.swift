import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofServices

/// Tappable preset archetype tile shown in Screen 1's "Use a Preset" path.
/// Ports `components/agents/inputs/ArchetypeCard.tsx`.
struct ArchetypeCard: View {
    let row: PresetArchetypeRow
    let selected: Bool
    let onSelect: () -> Void

    private var accentColor: Color {
        Color(hexString: row.color) ?? Color(hex: 0x00E676)
    }

    var body: some View {
        Button(action: onSelect) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    Text(row.emoji)
                        .font(.system(size: 24))
                        .frame(width: 48, height: 48)
                        .liquidGlassBackground(
                            in: RoundedRectangle(cornerRadius: 12, style: .continuous),
                            tint: accentColor.opacity(0.20)
                        )

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

                if !row.recommendedSports.isEmpty {
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
