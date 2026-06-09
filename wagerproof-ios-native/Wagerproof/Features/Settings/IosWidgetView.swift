import SwiftUI
import WagerproofDesign

/// iOS Widget walkthrough — port of `wagerproof-mobile/app/(modals)/ios-widget.tsx`.
///
/// This modal explains how to add the WagerProof Home Screen widget. It is
/// purely educational + showcases three widget content types (Picks / Fades /
/// Market Value) with sample data. The real WidgetKit extension lives outside
/// this batch and reads from App Group `widgetPayload`.
struct IosWidgetView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selected: WidgetType = .picks

    private enum WidgetType: String, CaseIterable, Identifiable {
        case picks, fades, market
        var id: String { rawValue }

        var title: String {
            switch self {
            case .picks: return "Editor Picks"
            case .fades: return "Fade Alerts"
            case .market: return "Market Value"
            }
        }

        var icon: String {
            switch self {
            case .picks: return "star.fill"
            case .fades: return "bolt.fill"
            case .market: return "chart.line.uptrend.xyaxis"
            }
        }

        var label: String {
            switch self {
            case .picks: return "Picks"
            case .fades: return "Fades"
            case .market: return "Market"
            }
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.xl) {
                    intro
                    selector
                    widgetPreview
                    instructionsCard
                    infoNote
                }
                .padding(.vertical, Spacing.lg)
            }
            .background(Color.appSurface.ignoresSafeArea())
            .navigationTitle("iOS Widget")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        dismiss()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 15, weight: .semibold))
                    }
                    .tint(Color.appTextPrimary)
                    .accessibilityLabel("Close")
                }
            }
        }
    }

    private var intro: some View {
        VStack(spacing: Spacing.md) {
            ZStack {
                Circle()
                    .fill(Color(hex: 0x22C55E).opacity(0.15))
                    .frame(width: 80, height: 80)
                Image(systemName: "square.grid.2x2.fill")
                    .font(.system(size: 38))
                    .foregroundStyle(Color(hex: 0x22C55E))
            }

            Text("WagerProof Widget")
                .font(AppFont.display)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextPrimary)
            Text("Add our widget to your Home Screen for instant access to picks, fade alerts, and market insights.")
                .font(AppFont.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextSecondary)
                .padding(.horizontal, Spacing.lg)
        }
    }

    private var selector: some View {
        HStack(spacing: Spacing.sm) {
            ForEach(WidgetType.allCases) { type in
                Button {
                    selected = type
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: type.icon)
                            .font(.system(size: 14))
                        Text(type.label)
                            .font(AppFont.captionEmphasized)
                    }
                    .foregroundStyle(selected == type ? .white : Color.appTextSecondary)
                    .padding(.horizontal, Spacing.md)
                    .padding(.vertical, 10)
                    .background(selected == type ? Color(hex: 0x22C55E) : Color.appSurfaceMuted)
                    .clipShape(Capsule())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var widgetPreview: some View {
        VStack(spacing: Spacing.sm) {
            Text("WIDGET PREVIEW")
                .font(.system(size: 12, weight: .semibold))
                .tracking(1)
                .foregroundStyle(Color.appTextSecondary)

            VStack(alignment: .leading, spacing: Spacing.sm) {
                HStack {
                    Image(systemName: selected.icon)
                        .font(.system(size: 13))
                        .foregroundStyle(Color(hex: 0x22C55E))
                    Text(selected.title)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                    Spacer()
                    Text("WagerProof")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(Color(hex: 0x9CA3AF))
                }

                ForEach(sampleRows(), id: \.self) { sample in
                    HStack(spacing: Spacing.sm) {
                        Text(sample.sport)
                            .font(.system(size: 9, weight: .heavy))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 3)
                            .background(sample.color)
                            .cornerRadius(4)
                        VStack(alignment: .leading, spacing: 1) {
                            Text(sample.matchup)
                                .font(.system(size: 9))
                                .foregroundStyle(Color(hex: 0x9CA3AF))
                            Text(sample.line)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundStyle(.white)
                        }
                        Spacer()
                        Text(sample.trailing)
                            .font(.system(size: 11, weight: .bold))
                            .foregroundStyle(Color(hex: 0x22C55E))
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 6)
                    .background(Color.white.opacity(0.06))
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.white.opacity(0.08))
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
            .padding(Spacing.md)
            .background(Color(hex: 0x0A0A0A))
            .clipShape(RoundedRectangle(cornerRadius: 24))
            .shadow(color: .black.opacity(0.3), radius: 16, y: 8)
            .padding(.horizontal, Spacing.lg)
        }
    }

    private var instructionsCard: some View {
        VStack(alignment: .leading, spacing: Spacing.md) {
            Text("How to Add the Widget")
                .font(AppFont.headline)
                .foregroundStyle(Color.appTextPrimary)

            step(1, "Long press on your Home Screen until apps start jiggling")
            step(2, "Tap the + button in the top corner")
            step(3, "Search for \"WagerProof\"")
            step(4, "Choose Medium or Large size, then tap Add Widget")
            step(5, "Long press the widget and select Edit Widget to choose content type")
        }
        .padding(Spacing.lg)
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal, Spacing.lg)
    }

    private func step(_ index: Int, _ text: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.md) {
            ZStack {
                Circle()
                    .fill(Color(hex: 0x22C55E))
                    .frame(width: 24, height: 24)
                Text("\(index)")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
            }
            Text(text)
                .font(AppFont.body)
                .foregroundStyle(Color.appTextSecondary)
        }
    }

    private var infoNote: some View {
        HStack(alignment: .top, spacing: Spacing.sm) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(Color(hex: 0x22C55E))
            Text("The widget updates automatically when you open the app. Data refreshes every 30-60 minutes.")
                .font(AppFont.body)
                .foregroundStyle(Color.appTextSecondary)
        }
        .padding(Spacing.lg)
        .background(Color(hex: 0x22C55E).opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal, Spacing.lg)
    }

    // MARK: - Sample data

    private struct WidgetSampleRow: Hashable {
        let sport: String
        let matchup: String
        let line: String
        let trailing: String
        let color: Color
    }

    private func sampleRows() -> [WidgetSampleRow] {
        switch selected {
        case .picks:
            return [
                .init(sport: "NFL", matchup: "Ravens @ Chiefs", line: "Ravens -3.5", trailing: "-110", color: Color(hex: 0x013369)),
                .init(sport: "NBA", matchup: "Lakers @ Celtics", line: "Over 224.5", trailing: "-105", color: Color(hex: 0x1D428A)),
                .init(sport: "CFB", matchup: "Alabama @ Georgia", line: "Georgia -7", trailing: "-115", color: Color(hex: 0x8B0000)),
                .init(sport: "NCAAB", matchup: "Duke @ UNC", line: "Duke +2.5", trailing: "-108", color: Color(hex: 0xFF6600))
            ]
        case .fades:
            return [
                .init(sport: "NFL", matchup: "49ers @ Cowboys", line: "Fade to Cowboys", trailing: "85%", color: Color(hex: 0x013369)),
                .init(sport: "CFB", matchup: "Ohio State @ Michigan", line: "Fade to Under", trailing: "12pt", color: Color(hex: 0x8B0000)),
                .init(sport: "NBA", matchup: "Warriors @ Suns", line: "Fade to Suns", trailing: "11pt", color: Color(hex: 0x1D428A)),
                .init(sport: "NCAAB", matchup: "Kansas @ Kentucky", line: "Fade to Kansas", trailing: "7pt", color: Color(hex: 0xFF6600))
            ]
        case .market:
            return [
                .init(sport: "NFL", matchup: "Packers @ Bears", line: "Packers", trailing: "62%", color: Color(hex: 0x013369)),
                .init(sport: "NBA", matchup: "Nuggets @ Heat", line: "Nuggets ML", trailing: "87%", color: Color(hex: 0x1D428A)),
                .init(sport: "CFB", matchup: "Texas @ Oklahoma", line: "Over", trailing: "59%", color: Color(hex: 0x8B0000)),
                .init(sport: "NCAAB", matchup: "Gonzaga @ UCLA", line: "Gonzaga", trailing: "64%", color: Color(hex: 0xFF6600))
            ]
        }
    }
}
