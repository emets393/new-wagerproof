import SwiftUI
import WagerproofDesign

/// Inline weather row used by the NFL/CFB game bottom sheets. Mirrors RN
/// `WeatherDisplay.tsx` — three optional chips: temperature, wind speed, and
/// precipitation. Section is hidden if all three are nil; the parent sheet
/// also conditionally renders the wrapper, so this view assumes at least
/// one value is non-nil.
struct WeatherDisplay: View {
    let temperatureF: Double?
    let windSpeedMph: Double?
    let precipitationPct: Double?

    var body: some View {
        HStack(spacing: 16) {
            if let t = temperatureF {
                weatherChip(icon: "thermometer.medium", label: "\(Int(t.rounded()))°F")
            }
            if let w = windSpeedMph {
                weatherChip(icon: "wind", label: "\(Int(w.rounded())) mph")
            }
            if let p = precipitationPct, p > 0 {
                weatherChip(icon: "cloud.rain.fill", label: "\(Int(p.rounded()))%")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .padding(.horizontal, 12)
        .background(
            RoundedRectangle(cornerRadius: 8)
                .fill(Color.appAccentBlue.opacity(0.06))
        )
    }

    @ViewBuilder
    private func weatherChip(icon: String, label: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.appAccentBlue)
            Text(label)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
        }
    }
}

#Preview {
    WeatherDisplay(temperatureF: 72, windSpeedMph: 12, precipitationPct: 30)
        .padding()
        .background(Color.appSurface)
}
