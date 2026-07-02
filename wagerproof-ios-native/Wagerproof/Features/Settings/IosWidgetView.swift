import SwiftUI
import WagerproofDesign

/// iOS Widget walkthrough — port of `wagerproof-mobile/app/(modals)/ios-widget.tsx`,
/// updated for the native `WagerProofWidgetExtension` target (see
/// `WagerProofWidgetExtension/WagerProofWidgetBundle.swift`).
///
/// Unlike the old RN-era widget (one configurable widget with an Editor
/// Picks / Fade Alerts / Market Value / Top Agents picker), the native
/// extension ships two separate, independently-addable widgets — "Top
/// Outliers" and "Agent Monitor" — so there's no "Edit Widget to choose
/// content type" step anymore, just two widgets to search for and add.
struct IosWidgetView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selected: WidgetType = .outliers

    private enum WidgetType: String, CaseIterable, Identifiable {
        case outliers, agents
        var id: String { rawValue }

        var title: String {
            switch self {
            case .outliers: return "Top Outliers"
            case .agents: return "Agent Monitor"
            }
        }

        var icon: String {
            switch self {
            case .outliers: return "bell.badge.fill"
            case .agents: return "brain.head.profile"
            }
        }

        var label: String {
            switch self {
            case .outliers: return "Outliers"
            case .agents: return "Agents"
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
            .navigationTitle("iOS Widgets")
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

            Text("WagerProof Widgets")
                .font(AppFont.display)
                .multilineTextAlignment(.center)
                .foregroundStyle(Color.appTextPrimary)
            Text("Add Top Outliers and Agent Monitor to your Home Screen for instant access to today's sharpest signals and your agents' latest picks.")
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
            Text("How to Add a Widget")
                .font(AppFont.headline)
                .foregroundStyle(Color.appTextPrimary)

            step(1, "Long press on your Home Screen until apps start jiggling")
            step(2, "Tap the + button in the top corner")
            step(3, "Search for \"WagerProof Outliers\" or \"WagerProof Agents\"")
            step(4, "Choose Small, Medium, or Large size, then tap Add Widget")
            step(5, "Repeat to add the other widget — each one lives on your Home Screen independently")
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
            Text("Widgets sync automatically when you open the app and refresh roughly every 60 minutes in the background.")
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
        case .outliers:
            return [
                .init(sport: "NFL", matchup: "49ers @ Cowboys", line: "Fade to Cowboys", trailing: "85%", color: Color(hex: 0x013369)),
                .init(sport: "NBA", matchup: "Warriors @ Suns", line: "Fade to Suns", trailing: "11pt", color: Color(hex: 0x1D428A)),
                .init(sport: "CFB", matchup: "Alabama @ Georgia", line: "Over value", trailing: "62%", color: Color(hex: 0x8B0000)),
                .init(sport: "NCAAB", matchup: "Kansas @ Kentucky", line: "Fade to Kansas", trailing: "7pt", color: Color(hex: 0xFF6600))
            ]
        case .agents:
            return [
                .init(sport: "\u{1F3AF}", matchup: "Sharp Edge — 28-18", line: "Ravens @ Chiefs — Ravens -3.5", trailing: "+8.4u", color: Color(hex: 0x22C55E)),
                .init(sport: "\u{1F9E0}", matchup: "Line Hunter — 24-18", line: "Alabama @ Georgia — Georgia -7", trailing: "+6.1u", color: Color(hex: 0x3B82F6)),
                .init(sport: "\u{26A1}", matchup: "Market Fade — 20-17", line: "Duke @ UNC — Duke +2.5", trailing: "+4.2u", color: Color(hex: 0xF59E0B))
            ]
        }
    }
}
