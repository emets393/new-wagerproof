import SwiftUI
import WagerproofDesign
import WagerproofModels

/// Bottom sheet that renders a single editor pick's full detail. Mirrors RN
/// `PickDetailBottomSheet.tsx`: team gradient header → close button → full
/// `EditorPickCard`. Driven via SwiftUI `.sheet(item:)` from the picks tab.
struct PickDetailBottomSheet: View {
    let pick: EditorPick
    let gameData: EditorPickGameData
    var onDismiss: () -> Void = {}

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                gradientHeader
                    .padding(.horizontal, 16)
                    .padding(.top, 8)

                EditorPickCard(pick: pick, gameData: gameData)
                .padding(.horizontal, 16)
                .padding(.top, 8)
            }
            .padding(.bottom, 32)
        }
        .background(Color.appSurface.ignoresSafeArea())
        .overlay(alignment: .topTrailing) {
            // Floating close button (mirrors RN's absolute-positioned Pressable).
            Button(action: onDismiss) {
                Image(systemName: "xmark")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(width: 32, height: 32)
                    .background(Color.appSurfaceMuted, in: Circle())
            }
            .buttonStyle(.plain)
            .padding(.top, 16)
            .padding(.trailing, 24)
            .sensoryFeedback(.impact(weight: .light), trigger: pick.id)
            .accessibilityLabel("Close")
        }
        .presentationDetents([.fraction(0.9), .large])
        .presentationDragIndicator(.visible)
        .presentationBackground(Color.appSurface)
    }

    @ViewBuilder
    private var gradientHeader: some View {
        let away = gameData.awayTeamColors
        let home = gameData.homeTeamColors

        ZStack {
            LinearGradient(
                colors: [
                    hex(away.primary).opacity(0.25),
                    .clear,
                    hex(home.primary).opacity(0.25)
                ],
                startPoint: .leading,
                endPoint: .trailing
            )

            HStack(spacing: 24) {
                teamCircle(name: gameData.awayTeam, logo: gameData.awayLogo, colors: away, sideIcon: "airplane.departure")
                centerColumn
                teamCircle(name: gameData.homeTeam, logo: gameData.homeLogo, colors: home, sideIcon: "house.fill")
            }
            .padding(.vertical, 16)
            .padding(.horizontal, 20)
        }
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    @ViewBuilder
    private func teamCircle(name: String, logo: String?, colors: TeamColors, sideIcon: String) -> some View {
        VStack(spacing: 6) {
            ZStack {
                Circle().fill(.clear)
                Circle().stroke(hex(colors.primary), lineWidth: 3)
                if let str = logo, let url = URL(string: str), !str.isEmpty {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let img): img.resizable().scaledToFit().padding(8)
                        default: initialsFallback(name: name, colors: colors)
                        }
                    }
                } else {
                    initialsFallback(name: name, colors: colors)
                }
            }
            .frame(width: 72, height: 72)
            Text(name)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.appTextPrimary)
                .lineLimit(1)
            Image(systemName: sideIcon)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(Color.appTextSecondary)
                .padding(.horizontal, 8)
                .padding(.vertical, 2)
                .background(Color.appSurfaceMuted, in: Capsule())
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var centerColumn: some View {
        VStack(spacing: 8) {
            Image(systemName: "at")
                .font(.system(size: 20))
                .foregroundStyle(Color.appTextSecondary)
                .frame(width: 36, height: 36)
                .background(Color.appSurfaceMuted, in: Circle())
            if let total = gameData.overLine {
                Text("O/U: \(formatTotal(total))")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Color.appSurfaceMuted.opacity(0.6), in: Capsule())
            }
        }
    }

    @ViewBuilder
    private func initialsFallback(name: String, colors: TeamColors) -> some View {
        let primary = hex(colors.primary)
        let secondary = hex(colors.secondary)
        ZStack {
            LinearGradient(colors: [primary, secondary], startPoint: .topLeading, endPoint: .bottomTrailing)
                .clipShape(Circle())
            Text(initials(name))
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(.white)
        }
    }

    private func initials(_ name: String) -> String {
        if name.isEmpty { return "TBD" }
        let parts = name.split(separator: " ").map(String.init)
        if parts.count >= 2 { return String(parts.last!.prefix(3)).uppercased() }
        return String(name.prefix(3)).uppercased()
    }

    private func formatTotal(_ v: Double) -> String {
        if v == v.rounded() { return String(format: "%.0f", v) }
        return String(format: "%.1f", v)
    }

    private func hex(_ s: String) -> Color {
        var str = s
        if str.hasPrefix("#") { str.removeFirst() }
        guard str.count == 6, let n = Int(str, radix: 16) else { return Color.gray }
        return Color(hex: n)
    }
}
