import SwiftUI
import WagerproofDesign
import WagerproofModels
import WagerproofStores

/// Full-bleed editor pick card. Mirrors RN `EditorPickCard.tsx`:
/// gradient background tinted by the picked side's team color → badges →
/// date+time header → matchup row (away • lines • home) → EDITOR'S PICK
/// section → optional ANALYSIS notes → optional admin controls.
struct EditorPickCard: View {
    let pick: EditorPick
    let gameData: EditorPickGameData
    var adminModeEnabled: Bool = false
    var onEdit: (() -> Void)? = nil
    /// Called after a result update succeeds — parent re-fetches.
    var onResultUpdated: (() -> Void)? = nil
    /// Hook to actually mutate `editors_picks.result`. Closure injected by the
    /// parent (typically the picks tab) so this view doesn't depend on the
    /// store directly. Mirrors RN's per-card supabase update.
    var updateResult: ((PickResult?) async -> Bool)? = nil

    @State private var isUpdatingResult: Bool = false
    @State private var showClearConfirmation: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            badgesRow
            dateTimeHeader
            matchupRow
            pickSection
            if let notes = pick.editorsNotes, notes.count > 5 {
                notesSection(notes)
            }
            if adminModeEnabled {
                adminSection
            }
        }
        .padding(16)
        .background(gradientBackground)
        .background(Color.appSurfaceElevated)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16).stroke(Color.appBorder, lineWidth: 1)
        )
    }

    // MARK: - Sections

    @ViewBuilder
    private var badgesRow: some View {
        HStack(spacing: 6) {
            Spacer()
            if let result = pick.result, result != .pending {
                Text(result.rawValue.uppercased())
                    .pillBadge(color: resultColor(result))
            }
            if pick.isFreePick == true {
                Text("FREE PICK").pillBadge(color: Color.appPrimary)
            }
            if !pick.isPublished {
                Text("DRAFT").pillBadge(color: Color.appAccentAmber)
            }
        }
        .frame(height: pick.result != nil || pick.isFreePick == true || !pick.isPublished ? nil : 0, alignment: .topTrailing)
    }

    @ViewBuilder
    private var dateTimeHeader: some View {
        VStack(spacing: 4) {
            if let date = gameData.gameDate {
                Text(date)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
            }
            if let time = gameData.gameTime, !time.isEmpty {
                Text(time)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.appSurfaceMuted, in: Capsule())
            }
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private var matchupRow: some View {
        HStack(alignment: .top, spacing: 8) {
            teamColumn(name: gameData.awayTeam, logo: gameData.awayLogo, colors: gameData.awayTeamColors)
            centerColumn
            teamColumn(name: gameData.homeTeam, logo: gameData.homeLogo, colors: gameData.homeTeamColors)
        }
    }

    @ViewBuilder
    private func teamColumn(name: String, logo: String?, colors: TeamColors) -> some View {
        VStack(spacing: 8) {
            ZStack {
                Circle().fill(.white)
                Circle().stroke(hexColor(colors.primary), lineWidth: 2)
                if let str = logo, let url = URL(string: str), !str.isEmpty {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let img):
                            img.resizable().scaledToFit().padding(10)
                        default:
                            initialsFallback(name: name, colors: colors)
                        }
                    }
                } else {
                    initialsFallback(name: name, colors: colors)
                }
            }
            .frame(width: 60, height: 60)
            Text(name)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color.appTextPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity)
    }

    @ViewBuilder
    private func initialsFallback(name: String, colors: TeamColors) -> some View {
        ZStack {
            Circle().fill(hexColor(colors.primary))
            Text(initials(name))
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(.white)
        }
        .padding(2)
    }

    @ViewBuilder
    private var centerColumn: some View {
        VStack(spacing: 8) {
            Text("@")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Color.appTextMuted.opacity(0.4))
                .padding(.top, 12)
            HStack(alignment: .top, spacing: 8) {
                bettingCol(ml: gameData.awayMl, spread: gameData.awaySpread)
                VStack {
                    Text(formatTotal(gameData.overLine))
                        .font(.system(size: 10, weight: .semibold))
                        .foregroundStyle(Color.appTextSecondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.appBorder, lineWidth: 1)
                                .background(RoundedRectangle(cornerRadius: 8).fill(Color.appSurfaceMuted.opacity(0.4)))
                        )
                }
                bettingCol(ml: gameData.homeMl, spread: gameData.homeSpread)
            }
        }
    }

    @ViewBuilder
    private func bettingCol(ml: Int?, spread: Double?) -> some View {
        VStack(spacing: 2) {
            Text(formatMoneyline(ml))
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color.appPrimary)
            Text(formatSpread(spread))
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Color.appTextPrimary)
        }
    }

    @ViewBuilder
    private var pickSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("EDITOR'S PICK")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color.appAccentBlue)
                .tracking(0.5)
            if let value = pick.pickValue, !value.isEmpty {
                Text(value)
                    .font(.system(size: 18, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                HStack(spacing: 8) {
                    if let price = pick.bestPrice, !price.isEmpty {
                        Text(price).metaBadge(color: Color.appPrimary)
                    }
                    if let book = pick.sportsbook, !book.isEmpty {
                        Text("@ \(book)").metaBadge(color: Color.appTextSecondary)
                    }
                    if let units = pick.units {
                        HStack(spacing: 2) {
                            Text(formatUnits(units))
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(Color.appTextPrimary)
                            Text("unit\(units != 1 ? "s" : "")")
                                .font(.system(size: 12))
                                .foregroundStyle(Color.appTextSecondary)
                        }
                    }
                }
                if let result = pick.result, result != .pending {
                    let calc = UnitsCalculation.calculate(result: pick.result, odds: pick.bestPrice, units: pick.units)
                    Text("\(calc.netUnits > 0 ? "+" : "")\(String(format: "%.2f", calc.netUnits)) units")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(calc.netUnits > 0 ? Color.appWin : calc.netUnits < 0 ? Color.appLoss : Color.appTextSecondary)
                }
            } else {
                // Legacy pick (no pick_value) — render selected_bet_type as bullet.
                Text(pick.selectedBetType)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Color.appTextPrimary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12).fill(Color.appAccentBlue.opacity(0.1))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12).stroke(Color.appAccentBlue.opacity(0.25), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func notesSection(_ notes: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("ANALYSIS")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color.appTextSecondary)
                .tracking(0.5)
                .opacity(0.8)
            Text(notes)
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextPrimary)
                .lineSpacing(4)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12).fill(Color.appSurfaceMuted.opacity(0.5))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12).stroke(Color.appBorder, lineWidth: 1)
        )
    }

    @ViewBuilder
    private var adminSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "shield.checkered")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.appPrimary)
                Text("ADMIN CONTROLS")
                    .font(.system(size: 10, weight: .heavy))
                    .foregroundStyle(Color.appPrimary)
                    .tracking(0.5)
            }
            HStack(spacing: 8) {
                AdminPillButton(systemImage: "pencil", title: "Edit", tint: Color.appAccentBlue) {
                    onEdit?()
                }
                if isGamePast {
                    if isUpdatingResult {
                        ProgressView().tint(Color.appPrimary)
                    } else {
                        AdminPillButton(systemImage: "checkmark.circle", title: "Won", tint: Color.appWin) {
                            Task { await applyResult(.won) }
                        }
                        AdminPillButton(systemImage: "xmark.circle", title: "Lost", tint: Color.appLoss) {
                            Task { await applyResult(.lost) }
                        }
                        AdminPillButton(systemImage: "minus.circle", title: "Push", tint: Color.appTextSecondary) {
                            Task { await applyResult(.push) }
                        }
                        if let r = pick.result, r != .pending {
                            AdminPillButton(systemImage: "arrow.clockwise", title: "Clear", tint: Color.appAccentAmber) {
                                showClearConfirmation = true
                            }
                        }
                    }
                }
            }
        }
        .padding(.top, 12)
        .overlay(alignment: .top) {
            Rectangle().fill(Color.appBorder).frame(height: 1)
        }
        .confirmationDialog(
            "Clear this pick's result?",
            isPresented: $showClearConfirmation,
            titleVisibility: .visible
        ) {
            Button("Clear Result", role: .destructive) {
                Task { await applyResult(nil) }
            }
            Button("Cancel", role: .cancel) {}
        }
    }

    // MARK: - Background gradient (picked-side team tint)

    private var gradientBackground: some View {
        let primary = pickedSideIsHome
            ? gameData.homeTeamColors.primary
            : gameData.awayTeamColors.primary
        let base = hexColor(primary)
        return LinearGradient(
            colors: [
                base.opacity(0.15),
                base.opacity(0.08),
                .clear
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    // MARK: - Behaviour

    private var isGamePast: Bool {
        guard let raw = gameData.rawGameDate, let date = EditorPicksStore.parseDate(raw) else {
            return false
        }
        // RN adds a 4-hour buffer to account for game duration.
        return Date().timeIntervalSince(date) > 4 * 60 * 60
    }

    private var pickedSideIsHome: Bool {
        // Heuristic: if the canonical selected_bet_type or pick_value
        // mentions the home team, we tint home; else away. RN does this
        // via `firstBet?.includes('home')`.
        let blob = (pick.selectedBetType + " " + (pick.pickValue ?? "")).lowercased()
        if blob.contains("home") { return true }
        if blob.contains(gameData.homeTeam.lowercased()) { return true }
        return false
    }

    @MainActor
    private func applyResult(_ result: PickResult?) async {
        guard let updateResult else { return }
        isUpdatingResult = true
        let ok = await updateResult(result)
        isUpdatingResult = false
        if ok { onResultUpdated?() }
    }

    // MARK: - Formatters

    private func formatSpread(_ v: Double?) -> String {
        guard let v else { return "-" }
        if v == 0 { return "PK" }
        let prefix = v > 0 ? "+" : ""
        let trimmed = v == v.rounded() ? String(format: "%.0f", v) : String(format: "%.1f", v)
        return "\(prefix)\(trimmed)"
    }

    private func formatMoneyline(_ v: Int?) -> String {
        guard let v else { return "-" }
        if v == 0 { return "Even" }
        return v > 0 ? "+\(v)" : "\(v)"
    }

    private func formatTotal(_ v: Double?) -> String {
        guard let v else { return "-" }
        if v == v.rounded() { return String(format: "%.0f", v) }
        return String(format: "%.1f", v)
    }

    private func formatUnits(_ v: Double) -> String {
        if v == v.rounded() { return String(format: "%.0f", v) }
        return String(format: "%.1f", v)
    }

    private func initials(_ name: String) -> String {
        if name.isEmpty { return "TBD" }
        let parts = name.split(separator: " ").map(String.init)
        if parts.count >= 2 { return String(parts.last!.prefix(3)).uppercased() }
        return String(name.prefix(3)).uppercased()
    }

    private func resultColor(_ r: PickResult) -> Color {
        switch r {
        case .won: return Color.appWin
        case .lost: return Color.appLoss
        case .push: return Color.appPush
        case .pending: return Color.appPending
        }
    }

    private func hexColor(_ hex: String) -> Color {
        // Accepts "#RRGGBB" or "RRGGBB"; falls back to gray.
        var s = hex
        if s.hasPrefix("#") { s.removeFirst() }
        guard s.count == 6, let n = Int(s, radix: 16) else { return Color.gray }
        return Color(hex: n)
    }
}

// MARK: - Helper styling

private extension View {
    func pillBadge(color: Color) -> some View {
        self
            .font(.system(size: 10, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color, in: RoundedRectangle(cornerRadius: 12))
    }

    func metaBadge(color: Color) -> some View {
        self
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 6))
            .overlay(
                RoundedRectangle(cornerRadius: 6).stroke(color.opacity(0.3), lineWidth: 1)
            )
    }
}

private struct AdminPillButton: View {
    let systemImage: String
    let title: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: systemImage)
                    .font(.system(size: 14, weight: .semibold))
                Text(title)
                    .font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(tint)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }
}
