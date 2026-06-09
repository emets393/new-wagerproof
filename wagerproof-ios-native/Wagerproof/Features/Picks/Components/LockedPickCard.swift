import SwiftUI
import WagerproofDesign

/// Locked placeholder shown to non-pro users for paid picks. Mirrors RN's
/// `LockedPickCard.tsx`: a blurred placeholder card with a centered "PRO"
/// crown badge + "Tap to unlock all picks" subtitle.
///
/// On tap we surface the paywall presenter — for B05 we expose an `onTap`
/// closure so the picks tab can wire to whatever paywall hook ships next
/// (RevenueCat presentation lands in B08).
struct LockedPickCard: View {
    let sport: String
    var minHeight: CGFloat = 80
    var onTap: () -> Void = {}

    var body: some View {
        Button(action: onTap) {
            ZStack {
                // Blurred placeholder lines (RN: 3 fake content rows).
                VStack(alignment: .leading, spacing: 12) {
                    Capsule().fill(Color.appBorder).frame(width: 180, height: 12)
                    Capsule().fill(Color.appBorder.opacity(0.7)).frame(width: 120, height: 12)
                    Capsule().fill(Color.appBorder.opacity(0.5)).frame(width: 240, height: 12)
                }
                .padding(20)
                .frame(maxWidth: .infinity, alignment: .leading)
                .opacity(0.5)
                .blur(radius: 4)

                // Lock badge — crown + sport + "Pro Pick" label.
                VStack(spacing: 4) {
                    HStack(spacing: 4) {
                        Image(systemName: "crown.fill")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.appAccentAmber)
                        Text("PRO")
                            .font(.system(size: 11, weight: .heavy))
                            .foregroundStyle(Color.appAccentAmber)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.appAccentAmber.opacity(0.15), in: Capsule())

                    HStack(spacing: 6) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 16, weight: .semibold))
                        Text("\(sport) Pro Pick")
                            .font(.system(size: 14, weight: .bold))
                    }
                    .foregroundStyle(Color.appTextPrimary)
                    .padding(.top, 4)
                    Text("Tap to unlock all picks")
                        .font(.system(size: 11))
                        .foregroundStyle(Color.appTextSecondary)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.appSurfaceElevated.opacity(0.95))
                )
            }
            .frame(maxWidth: .infinity, minHeight: minHeight)
            .background(
                RoundedRectangle(cornerRadius: 16).fill(Color.appSurfaceMuted)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16).stroke(Color.appBorder, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(sport) Pro Pick — tap to unlock")
    }
}

#Preview {
    LockedPickCard(sport: "NBA")
        .padding()
        .background(Color.appSurface)
}
