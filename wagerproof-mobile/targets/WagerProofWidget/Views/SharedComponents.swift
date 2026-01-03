import SwiftUI
import WidgetKit

// MARK: - Color Extensions

extension Color {
    /// Initialize Color from hex string
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }

    // WagerProof Brand Colors - Premium palette
    static let wpGreen = Color(hex: "22c55e")
    static let wpLightGreen = Color(hex: "4ade80")
    static let wpDarkGreen = Color(hex: "16a34a")
    static let wpAmber = Color(hex: "fbbf24")
    static let wpRed = Color(hex: "ef4444")
    static let wpGray = Color(hex: "9ca3af")
    static let wpLightGray = Color(hex: "d1d5db")
    static let wpDarkGray = Color(hex: "374151")
    static let wpBackground = Color(hex: "0a0a0a")
    static let wpCardBackground = Color(hex: "18181b")
    static let wpSurface = Color(hex: "27272a")
}

// MARK: - Widget Header

struct WidgetHeader: View {
    let contentType: WidgetContentType

    var body: some View {
        HStack(spacing: 8) {
            // Icon with subtle glow effect
            Image(systemName: contentType.iconName)
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(.wpGreen)

            Text(contentType.displayName)
                .font(.system(size: 13, weight: .bold))
                .foregroundColor(.white)

            Spacer()

            // Brand badge
            Text("WagerProof")
                .font(.system(size: 10, weight: .medium))
                .foregroundColor(.wpGray)
        }
    }
}

// MARK: - Sport Badge

struct SportBadge: View {
    let sport: String

    var body: some View {
        Text(sport.uppercased())
            .font(.system(size: 9, weight: .heavy))
            .foregroundColor(.white)
            .padding(.horizontal, 6)
            .padding(.vertical, 3)
            .background(
                RoundedRectangle(cornerRadius: 4)
                    .fill(sportColor)
            )
    }

    private var sportColor: Color {
        switch sport.lowercased() {
        case "nfl": return Color(hex: "013369")   // NFL Blue
        case "nba": return Color(hex: "1d428a")   // NBA Blue
        case "cfb": return Color(hex: "8b0000")   // College red
        case "ncaab": return Color(hex: "ff6600") // College orange
        default: return .wpDarkGray
        }
    }
}

// MARK: - Glass Card Modifier

struct GlassCard: ViewModifier {
    let isCompact: Bool

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, isCompact ? 8 : 12)
            .padding(.vertical, isCompact ? 6 : 10)
            .background(
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.wpSurface.opacity(0.6))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.white.opacity(0.08), lineWidth: 1)
                    )
            )
    }
}

extension View {
    func glassCard(isCompact: Bool = false) -> some View {
        modifier(GlassCard(isCompact: isCompact))
    }
}

// MARK: - Editor Pick Row

struct EditorPickRow: View {
    let pick: EditorPickWidgetData
    let isCompact: Bool

    init(pick: EditorPickWidgetData, isCompact: Bool = false) {
        self.pick = pick
        self.isCompact = isCompact
    }

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            // Left side - Sport badge
            SportBadge(sport: pick.gameType)

            // Middle - Matchup and pick value
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    Text(pick.formattedMatchup)
                        .font(.system(size: isCompact ? 9 : 10, weight: .regular))
                        .foregroundColor(.wpGray)
                        .lineLimit(1)

                    if let result = pick.result {
                        ResultBadge(result: result)
                    }
                }

                if let pickValue = pick.pickValue {
                    Text(pickValue)
                        .font(.system(size: isCompact ? 11 : 13, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                }
            }

            Spacer(minLength: 4)

            // Right side - Price
            if let price = pick.bestPrice {
                Text(price)
                    .font(.system(size: isCompact ? 11 : 13, weight: .bold))
                    .foregroundColor(.wpGreen)
            }
        }
        .glassCard(isCompact: isCompact)
    }
}

// MARK: - Fade Alert Row

struct FadeAlertRow: View {
    let alert: FadeAlertWidgetData
    let isCompact: Bool

    init(alert: FadeAlertWidgetData, isCompact: Bool = false) {
        self.alert = alert
        self.isCompact = isCompact
    }

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            // Left side - Sport badge
            SportBadge(sport: alert.sport)

            // Middle - Matchup and fade recommendation
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    Text(alert.formattedMatchup)
                        .font(.system(size: isCompact ? 9 : 10, weight: .regular))
                        .foregroundColor(.wpGray)
                        .lineLimit(1)

                    // Confidence indicator
                    HStack(spacing: 2) {
                        Image(systemName: "bolt.fill")
                            .font(.system(size: 7, weight: .semibold))
                            .foregroundColor(.wpAmber)

                        Text(alert.confidenceDisplay)
                            .font(.system(size: 8, weight: .bold))
                            .foregroundColor(.wpAmber)
                    }
                }

                Text(alert.fadeRecommendation)
                    .font(.system(size: isCompact ? 11 : 13, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
            }

            Spacer(minLength: 4)

            // Right side - Pick type
            Text(alert.pickType)
                .font(.system(size: isCompact ? 10 : 11, weight: .medium))
                .foregroundColor(.wpLightGray)
        }
        .glassCard(isCompact: isCompact)
    }
}

// MARK: - Polymarket Row

struct PolymarketRow: View {
    let value: PolymarketValueWidgetData
    let isCompact: Bool

    init(value: PolymarketValueWidgetData, isCompact: Bool = false) {
        self.value = value
        self.isCompact = isCompact
    }

    var body: some View {
        HStack(alignment: .center, spacing: 8) {
            // Left side - Sport badge
            SportBadge(sport: value.sport)

            // Middle - Matchup and side
            VStack(alignment: .leading, spacing: 1) {
                HStack(spacing: 4) {
                    Text(value.formattedMatchup)
                        .font(.system(size: isCompact ? 9 : 10, weight: .regular))
                        .foregroundColor(.wpGray)
                        .lineLimit(1)

                    Text(value.marketTypeDisplay)
                        .font(.system(size: 8, weight: .medium))
                        .foregroundColor(.wpDarkGray)
                }

                Text(value.side)
                    .font(.system(size: isCompact ? 11 : 13, weight: .semibold))
                    .foregroundColor(.white)
                    .lineLimit(1)
            }

            Spacer(minLength: 4)

            // Right side - Public Lean Percentage
            VStack(alignment: .trailing, spacing: 0) {
                Text("\(value.percentage)%")
                    .font(.system(size: isCompact ? 12 : 14, weight: .bold))
                    .foregroundColor(.wpGreen)

                Text("public")
                    .font(.system(size: 7, weight: .medium))
                    .foregroundColor(.wpDarkGray)
            }
        }
        .glassCard(isCompact: isCompact)
    }
}

// MARK: - Result Badge

struct ResultBadge: View {
    let result: String

    var body: some View {
        Text(result.uppercased())
            .font(.system(size: 8, weight: .heavy))
            .foregroundColor(.white)
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(
                RoundedRectangle(cornerRadius: 3)
                    .fill(resultColor)
            )
    }

    private var resultColor: Color {
        switch result.lowercased() {
        case "won": return .wpGreen
        case "lost": return .wpRed
        case "push": return .wpAmber
        default: return .wpGray
        }
    }
}

// MARK: - Empty State View

struct EmptyStateView: View {
    let contentType: WidgetContentType

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: contentType.iconName)
                .font(.system(size: 28, weight: .light))
                .foregroundColor(.wpDarkGray)

            Text("No \(contentType.displayName)")
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(.wpGray)

            Text("Open WagerProof to load data")
                .font(.system(size: 11, weight: .regular))
                .foregroundColor(.wpDarkGray)
        }
    }
}

// MARK: - Divider Line

struct DividerLine: View {
    var body: some View {
        Rectangle()
            .fill(Color.wpSurface)
            .frame(height: 1)
    }
}
