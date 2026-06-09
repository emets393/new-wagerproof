import SwiftUI
import WagerproofDesign
import WagerproofModels

/// NBA injury report widget for the game bottom sheet. Mirrors RN
/// `components/nba/InjuryReportWidget.tsx`. Collapsible card listing per-team
/// injuries with PIE (Player Impact Estimate) values plus a footer that
/// shows the cumulative injury-impact delta.
///
/// Tap header → toggle expansion. The collapsed pill is intentionally tall
/// enough to ship as the closed-state placeholder when `isLoading`.
struct NBAInjuryReportWidget: View {
    let awayTeam: String
    let homeTeam: String
    let awayInjuries: [NBAInjuryReport]
    let homeInjuries: [NBAInjuryReport]
    let awayInjuryImpact: Double
    let homeInjuryImpact: Double
    let isLoading: Bool
    let errorMessage: String?

    /// Expansion is driven by the hosting `WidgetSection` header (the title +
    /// chevron + card chrome now live there), so the collapse toggle is shared
    /// with the rest of the pinned widgets.
    @Binding var expanded: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if isLoading {
                ProgressView()
                    .padding(20)
                    .frame(maxWidth: .infinity)
            } else if let errorMessage {
                errorState(errorMessage)
            } else if expanded {
                content
            } else {
                collapsedHint
            }
        }
    }

    /// Shown in place of the table when collapsed so the section body isn't
    /// empty before the user taps the header.
    @ViewBuilder
    private var collapsedHint: some View {
        Text("Tap to view injuries and impact scores")
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(Color.appTextSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func errorState(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.circle")
                .foregroundStyle(Color.appAccentRed)
            Text(message)
                .font(.system(size: 13))
                .foregroundStyle(Color.appAccentRed)
        }
        .frame(maxWidth: .infinity)
        .padding(16)
    }

    @ViewBuilder
    private var content: some View {
        if awayInjuries.isEmpty && homeInjuries.isEmpty {
            emptyState
        } else {
            VStack(spacing: 12) {
                HStack(alignment: .top, spacing: 12) {
                    teamColumn(name: awayTeam, injuries: awayInjuries)
                    teamColumn(name: homeTeam, injuries: homeInjuries)
                }
                Divider()
                impactFooter
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 12)
        }
    }

    @ViewBuilder
    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 32))
                .foregroundStyle(Color.appPrimary)
            Text("No injuries reported for this matchup")
                .font(.system(size: 14))
                .foregroundStyle(Color.appTextSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .padding(.horizontal, 12)
        .padding(.bottom, 12)
    }

    @ViewBuilder
    private func teamColumn(name: String, injuries: [NBAInjuryReport]) -> some View {
        VStack(spacing: 8) {
            GameCardTeamAvatar(teamName: name, sport: "nba", size: 40)
            if injuries.isEmpty {
                Text("No injuries reported")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(.vertical, 16)
            } else {
                injuryTable(injuries)
            }
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func injuryTable(_ injuries: [NBAInjuryReport]) -> some View {
        VStack(spacing: 4) {
            HStack {
                Text("PLAYER")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("STATUS")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("PIE")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(0.5)
                    .foregroundStyle(Color.appTextSecondary)
                    .frame(minWidth: 50, alignment: .trailing)
            }
            .padding(.bottom, 4)
            .overlay(Rectangle().frame(height: 1).foregroundStyle(Color.appBorder), alignment: .bottom)

            ForEach(Array(sortedByPIE(injuries).enumerated()), id: \.offset) { _, injury in
                HStack {
                    Text(formatPlayerName(injury.playerName))
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(Color.appTextPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .lineLimit(1)
                    Text(injury.status)
                        .font(.system(size: 10))
                        .foregroundStyle(Color.appTextSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .lineLimit(1)
                    Text(formatPIE(injury.pieValue))
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.appPrimary)
                        .frame(minWidth: 50, alignment: .trailing)
                }
                .padding(.vertical, 4)
            }
        }
    }

    @ViewBuilder
    private var impactFooter: some View {
        VStack(spacing: 8) {
            Text("CUMULATIVE INJURY IMPACT SCORE")
                .font(.system(size: 11, weight: .semibold))
                .tracking(0.5)
                .foregroundStyle(Color.appTextSecondary)
            HStack {
                HStack(spacing: 8) {
                    GameCardTeamAvatar(teamName: awayTeam, sport: "nba", size: 32)
                    Text(String(format: "%.2f", awayInjuryImpact))
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(impactColor(my: awayInjuryImpact, other: homeInjuryImpact))
                }
                Spacer()
                HStack(spacing: 8) {
                    GameCardTeamAvatar(teamName: homeTeam, sport: "nba", size: 32)
                    Text(String(format: "%.2f", homeInjuryImpact))
                        .font(.system(size: 18, weight: .bold))
                        .foregroundStyle(impactColor(my: homeInjuryImpact, other: awayInjuryImpact))
                }
            }
        }
        .padding(.top, 12)
    }

    // MARK: - Helpers (mirror RN `formatPlayerName` / `formatPIE` / `sortByPIE`)

    private func formatPlayerName(_ full: String) -> String {
        let parts = full.split(separator: " ", omittingEmptySubsequences: true)
        if parts.count < 2 { return full }
        let firstInitial = parts[0].prefix(1).uppercased()
        let last = parts.dropFirst().joined(separator: " ")
        return "\(firstInitial). \(last)"
    }

    private func formatPIE(_ value: Double?) -> String {
        guard let v = value else { return "N/A" }
        return String(format: "%.4f", v)
    }

    private func sortedByPIE(_ list: [NBAInjuryReport]) -> [NBAInjuryReport] {
        list.sorted { a, b in
            (a.pieValue ?? -.infinity) > (b.pieValue ?? -.infinity)
        }
    }

    private func impactColor(my: Double, other: Double) -> Color {
        if my < other { return Color.appAccentRed }   // more negative → more injuries
        if my > other { return Color.appPrimary }
        return Color.appTextPrimary
    }
}
