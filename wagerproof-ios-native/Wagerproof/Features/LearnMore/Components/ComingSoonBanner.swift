import SwiftUI
import WagerproofDesign

/// Direct port of `wagerproof-mobile/components/ComingSoonBanner.tsx`.
///
/// Small green-tinted card with a gradient icon block on the left, a title +
/// description block in the middle, and a "PREVIEW" pill on the right. Used
/// at the top of pages backed by a not-yet-launched sport (currently only MLB).
struct ComingSoonBanner: View {

    /// Lock to MLB only — matches RN `sport: 'mlb'` constraint. If/when other
    /// sports are added the enum should grow with corresponding config rows.
    enum Sport {
        case mlb
    }

    let sport: Sport
    /// Override copy if the caller wants something more specific.
    var titleOverride: String? = nil
    var descriptionOverride: String? = nil

    var body: some View {
        HStack(alignment: .center, spacing: Spacing.md) {
            // Gradient icon block — green stops match RN `gradientColors`.
            ZStack {
                LinearGradient(
                    colors: [Color(hex: 0x22C55E), Color(hex: 0x16A34A)],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                Image(systemName: systemImage)
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .frame(width: 48, height: 48)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                Text(titleOverride ?? defaultTitle)
                    .font(.system(size: 16, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                Text(descriptionOverride ?? defaultDescription)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Text("PREVIEW")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.appAccentAmber)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .padding(Spacing.md)
        .background(Color(hex: 0x22C55E).opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color(hex: 0x22C55E).opacity(0.3), lineWidth: 1)
        )
        .padding(.horizontal, Spacing.sm)
    }

    // MARK: - Sport config

    private var systemImage: String {
        switch sport {
        case .mlb: return "baseball.fill"
        }
    }

    private var defaultTitle: String {
        switch sport {
        case .mlb: return "MLB COMING SOON"
        }
    }

    private var defaultDescription: String {
        switch sport {
        case .mlb: return "Baseball predictions launching soon"
        }
    }
}
