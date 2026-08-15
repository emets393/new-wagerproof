import SwiftUI
import WagerproofDesign

/// Manual tester for the full-screen rain / snow overlay. Reached from
/// Secret Settings → UI Previews so the animation can be reviewed on a
/// game-detail-shaped backdrop.
struct WeatherPrecipitationPreviewView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selection: Selection = .rain

    private enum Selection: String, CaseIterable, Identifiable {
        case off
        case rain
        case snow

        var id: String { rawValue }

        var kind: WeatherPrecipitationKind? {
            switch self {
            case .off: return nil
            case .rain: return .rain
            case .snow: return .snow
            }
        }

        var title: String {
            switch self {
            case .off: return "Off"
            case .rain: return "Rain"
            case .snow: return "Snow"
            }
        }

        var systemImage: String {
            switch self {
            case .off: return "sun.max.fill"
            case .rain: return "cloud.rain.fill"
            case .snow: return "cloud.snow.fill"
            }
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                TeamAuraBackground(
                    awayColor: Color(hex: 0x013369),
                    homeColor: Color(hex: 0xD50A0A),
                    progress: 0
                )
                .ignoresSafeArea()

                VStack(spacing: 16) {
                    fakeHero
                    fakeCard(
                        title: "Projected Score",
                        body: "Placeholder card so you can judge how the overlay reads over widgets."
                    )
                    fakeCard(
                        title: "Market Odds",
                        body: "Chips and text should stay tappable — the overlay ignores hits."
                    )
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16)
                .padding(.top, 12)
                .padding(.bottom, 88)
            }
            .safeAreaInset(edge: .bottom) {
                controls
            }
            .navigationTitle("Weather Overlay")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .tint(Color.appTextPrimary)
                }
            }
        }
        .weatherPrecipitation(selection.kind)
    }

    private var fakeHero: some View {
        VStack(spacing: 10) {
            Text("DAL  @  PHI")
                .font(.system(size: 22, weight: .black, design: .rounded))
                .foregroundStyle(Color.appTextPrimary)
            HStack(spacing: 8) {
                weatherChip(
                    systemImage: selection.systemImage,
                    text: selection == .off ? "Clear" : selection.title
                )
                weatherChip(systemImage: "thermometer.medium", text: "44°F")
                weatherChip(systemImage: "wind", text: "12 mph")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 22)
    }

    private func weatherChip(systemImage: String, text: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.system(size: 14, weight: .bold))
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(Color.appAccentBlue)
            Text(text)
                .font(.system(size: 13, weight: .black, design: .rounded))
                .foregroundStyle(Color.appTextPrimary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.appAccentBlue.opacity(0.12), in: Capsule())
        .overlay(Capsule().stroke(Color.appAccentBlue.opacity(0.22), lineWidth: 1))
    }

    private func fakeCard(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.system(size: 11, weight: .heavy))
                .tracking(0.8)
                .foregroundStyle(Color.appTextSecondary)
            Text(body)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Color.appTextPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Color.appSurfaceElevated.opacity(0.92), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(Color.appBorder.opacity(0.7), lineWidth: 1)
        )
    }

    private var controls: some View {
        VStack(spacing: 10) {
            Picker("Weather", selection: $selection) {
                ForEach(Selection.allCases) { option in
                    Text(option.title).tag(option)
                }
            }
            .pickerStyle(.segmented)
            Text("Toggle rain and snow on a detail-page backdrop.")
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
        .padding(.bottom, 10)
        .frame(maxWidth: .infinity)
        .background(.ultraThinMaterial)
    }
}

#Preview {
    WeatherPrecipitationPreviewView()
}
