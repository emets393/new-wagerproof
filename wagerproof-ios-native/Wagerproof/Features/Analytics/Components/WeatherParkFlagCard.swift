import SwiftUI
import WagerproofDesign
import WagerproofModels

/// One game's weather/park impact card: cyan icon chip (icon inferred from
/// the flag text), matchup + venue, then wrapping flag chips.
struct WeatherParkFlagCard: View {
    let flag: MLBWeatherParkFlag

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10).fill(Regression.accentCyan.opacity(0.15))
                Image(systemName: icon)
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Regression.accentCyan)
            }
            .frame(width: 40, height: 40)

            VStack(alignment: .leading, spacing: 4) {
                Text(flag.matchup)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Text(flag.venue)
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
                RegressionFlowLayout(spacing: 4) {
                    ForEach(Array(flag.flags.enumerated()), id: \.offset) { _, text in
                        Text(text)
                            .font(.system(size: 10, weight: .semibold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Color.appSurfaceMuted)
                            .foregroundStyle(Color.appTextPrimary)
                            .clipShape(Capsule())
                    }
                }
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appSurfaceElevated, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.appBorder, lineWidth: 1))
    }

    /// Same heuristic as RN `weatherIconForFlags`, mapped to SF Symbols.
    private var icon: String {
        let joined = flag.flags.joined(separator: " ").lowercased()
        if joined.contains("rain") { return "cloud.heavyrain.fill" }
        if joined.contains("wind") { return "wind" }
        if joined.contains("cold") || joined.contains("snow") { return "snowflake" }
        if joined.contains("hot") || joined.contains("heat") { return "sun.max.fill" }
        if joined.contains("dome") || joined.contains("roof") { return "house.fill" }
        if joined.contains("humid") { return "humidity.fill" }
        return "cloud.sun.fill"
    }
}
