import SwiftUI
import WagerproofDesign
import WagerproofModels

// =====================================================================
// Generation control surfaces for the agent detail page's picks footer.
//
// Two glass footer chips + the bottom sheets they open:
//   • RegenerateControlButton → RegenerateBottomSheet — explains the daily
//     regeneration quota and hosts the swipe-to-request-picks slider.
//   • AutoPilotControlButton  → AutoPilotBottomSheet  — the autopilot on/off
//     toggle + preferred-time setting + a list of the agent's recent runs.
//
// The buttons are dumb (state + tap-out); AgentDetailView owns the store calls
// and presents the sheets. See AgentDetailView.generateFooter.
// =====================================================================

// MARK: - Footer control buttons

/// Footer chip that opens the regenerate sheet. Shows the runs left today so the
/// user knows the quota at a glance ("Regenerate · 2 left").
struct RegenerateControlButton: View {
    var remaining: Int
    var accent: Color
    var enabled: Bool
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: enabled ? "arrow.clockwise" : "lock.fill")
                    .font(.system(size: 12, weight: .bold))
                Text("Regenerate")
                    .font(.system(size: 12, weight: .heavy))
                Text("\(remaining) left")
                    .font(.system(size: 11, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(remaining > 0 ? Color.appTextPrimary : Color.appTextSecondary)
                    .padding(.horizontal, 6)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(accent.opacity(remaining > 0 ? 0.28 : 0.14)))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .liquidGlassBackground(in: Capsule(), tint: accent.opacity(enabled ? 0.35 : 0.15))
            .overlay(Capsule().strokeBorder(accent.opacity(enabled ? 0.55 : 0.25), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// Footer chip that opens the autopilot sheet. A small status dot signals on/off
/// so the state reads without opening the sheet.
struct AutoPilotControlButton: View {
    var isOn: Bool
    var accent: Color
    var action: () -> Void

    private var statusColor: Color { isOn ? Color(hex: 0x00E676) : Color.appTextSecondary }

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: "bolt.badge.automatic")
                    .font(.system(size: 11, weight: .bold))
                Text("AutoPilot")
                    .font(.system(size: 11, weight: .heavy))
                Circle().fill(statusColor).frame(width: 6, height: 6)
            }
            .foregroundStyle(isOn ? Color.appTextPrimary : Color.appTextSecondary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .liquidGlassBackground(in: Capsule(), tint: accent.opacity(isOn ? 0.4 : 0.22))
            .overlay(Capsule().strokeBorder(accent.opacity(isOn ? 0.6 : 0.25), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Regenerate sheet

/// Explains the daily regeneration quota + logic, then hosts the swipe pill that
/// actually requests a fresh run. Presented from the picks footer.
struct RegenerateBottomSheet: View {
    @Environment(\.dismiss) private var dismiss

    let remaining: Int
    let maxDaily: Int
    var accent: Color
    /// false → the swipe pill is a static locked capsule (limit reached / no Pro).
    let canRegenerate: Bool
    /// Fired at the top of the swipe commit; the host dismisses + kicks the run.
    let onRequest: () -> Void

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                    quotaCard
                    logicCard
                }
                .padding(20)
            }
            .safeAreaInset(edge: .bottom) {
                SwipeToGeneratePill(
                    title: canRegenerate ? "Swipe to request picks" : "Daily limit reached",
                    accent: accent,
                    isEnabled: canRegenerate,
                    onCommit: onRequest
                )
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 12)
                .background(.ultraThinMaterial)
            }
            .background(Color(hex: 0x0B1011).ignoresSafeArea())
            .navigationTitle("Regenerate")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.tint(Color.appTextPrimary)
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(Color(hex: 0x0B1011))
        .preferredColorScheme(.dark)
    }

    private var header: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(accent.opacity(0.18)).frame(width: 44, height: 44)
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(accent)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text("Regenerate today's picks")
                    .font(.system(size: 17, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                Text("Re-run the agent against the current slate.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
            }
            Spacer(minLength: 0)
        }
    }

    /// Runs-left pip row — one filled pip per remaining run, hollow for spent.
    private var quotaCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("RUNS LEFT TODAY")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(1)
                    .foregroundStyle(Color.appTextSecondary)
                Spacer()
                Text("\(remaining)/\(maxDaily)")
                    .font(.system(size: 15, weight: .black, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(remaining > 0 ? accent : Color.appLoss)
            }
            HStack(spacing: 8) {
                ForEach(0..<maxDaily, id: \.self) { i in
                    Capsule()
                        .fill(i < remaining ? accent : Color.white.opacity(0.10))
                        .frame(height: 8)
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(accent.opacity(0.07))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(accent.opacity(0.18), lineWidth: 1)
        )
    }

    private var logicCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("HOW IT WORKS")
                .font(.system(size: 11, weight: .heavy))
                .tracking(1)
                .foregroundStyle(Color.appTextSecondary)
            bullet("gauge.with.dots.needle.67percent",
                   "Each agent gets \(maxDaily) generations per day.")
            bullet("sparkles",
                   "A run re-analyzes today's games from scratch and reprints the ticket rail.")
            bullet("bolt.badge.automatic",
                   "Autopilot runs count toward the same \(maxDaily)-per-day limit.")
            bullet("clock.arrow.circlepath",
                   "The quota resets at midnight in your local time.")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white.opacity(0.04))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    private func bullet(_ icon: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(accent)
                .frame(width: 20)
            Text(text)
                .font(.system(size: 13))
                .foregroundStyle(Color.appTextPrimary)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }
}

// MARK: - AutoPilot sheet

/// Autopilot control surface: toggle daily auto-generation, set its preferred
/// time, and review the agent's recent runs. Persists via the two async closures
/// the host wires to `AgentDetailStore`.
struct AutoPilotBottomSheet: View {
    @Environment(\.dismiss) private var dismiss

    let agentName: String
    var accent: Color
    /// Pro/admin gate — non-entitled users can view but not enable autopilot.
    let canUseAutopilot: Bool
    let remaining: Int
    let maxDaily: Int
    let recentRuns: [AgentRunSummaryRow]
    /// Persist the on/off flag → returns success so we can revert on failure.
    let onSetAuto: (Bool) async -> Bool
    /// Persist the schedule (time, IANA timezone) → returns success.
    let onSaveTime: (String, String) async -> Bool

    @State private var autoOn: Bool
    @State private var time: String
    @State private var timezone: String
    @State private var showTimePicker = false
    @State private var busy = false
    @State private var errorText: String?

    init(
        agentName: String,
        accent: Color,
        canUseAutopilot: Bool,
        remaining: Int,
        maxDaily: Int,
        initialAutoOn: Bool,
        initialTime: String,
        initialTimezone: String,
        recentRuns: [AgentRunSummaryRow],
        onSetAuto: @escaping (Bool) async -> Bool,
        onSaveTime: @escaping (String, String) async -> Bool
    ) {
        self.agentName = agentName
        self.accent = accent
        self.canUseAutopilot = canUseAutopilot
        self.remaining = remaining
        self.maxDaily = maxDaily
        self.recentRuns = recentRuns
        self.onSetAuto = onSetAuto
        self.onSaveTime = onSaveTime
        _autoOn = State(initialValue: initialAutoOn)
        _time = State(initialValue: initialTime)
        _timezone = State(initialValue: initialTimezone)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                    toggleCard
                    if autoOn { scheduleCard }
                    runsSection
                }
                .padding(20)
            }
            .background(Color(hex: 0x0B1011).ignoresSafeArea())
            .navigationTitle("AutoPilot")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }.tint(Color.appTextPrimary)
                }
            }
            .sheet(isPresented: $showTimePicker) {
                TimePickerModal(isPresented: $showTimePicker, time: $time, timezone: $timezone)
            }
            // Persist the schedule whenever the picker commits new values.
            .onChange(of: time) { _, _ in persistTime() }
            .onChange(of: timezone) { _, _ in persistTime() }
            .alert("Couldn't update", isPresented: Binding(
                get: { errorText != nil }, set: { if !$0 { errorText = nil } }
            ), presenting: errorText) { _ in
                Button("OK", role: .cancel) { errorText = nil }
            } message: { Text($0) }
        }
        .presentationDetents([.large])
        .presentationBackground(Color(hex: 0x0B1011))
        .preferredColorScheme(.dark)
    }

    private var header: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(accent.opacity(0.18)).frame(width: 44, height: 44)
                Image(systemName: "bolt.badge.automatic")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundStyle(accent)
            }
            VStack(alignment: .leading, spacing: 3) {
                Text("AutoPilot")
                    .font(.system(size: 17, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                Text("Let \(agentName) generate picks for you daily.")
                    .font(.system(size: 12))
                    .foregroundStyle(Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }

    private var toggleCard: some View {
        VStack(alignment: .leading, spacing: 4) {
            Toggle(isOn: Binding(
                get: { autoOn },
                set: { setAuto($0) }
            )) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Auto-generate picks")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text(autoOn ? "On — runs automatically each day" : "Off — you generate manually")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                }
            }
            .tint(accent)
            .disabled(busy || !canUseAutopilot)

            if !canUseAutopilot {
                Text("Upgrade to Pro to enable autopilot.")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color(hex: 0xF59E0B))
                    .padding(.top, 4)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white.opacity(0.04))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    private var scheduleCard: some View {
        Button {
            showTimePicker = true
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "clock")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(accent)
                    .frame(width: 20)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Preferred time")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(Color.appTextPrimary)
                    Text("Runs shortly after this each day.")
                        .font(.system(size: 12))
                        .foregroundStyle(Color.appTextSecondary)
                }
                Spacer(minLength: 8)
                Text("\(displayTime) \(AgentTimezoneOption.abbr(for: timezone))")
                    .font(.system(size: 14, weight: .semibold, design: .monospaced))
                    .foregroundStyle(accent)
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(Color.appTextSecondary)
            }
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.white.opacity(0.04))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }

    private var runsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("RECENT RUNS")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(1)
                    .foregroundStyle(Color.appTextSecondary)
                Spacer()
                Text("\(remaining)/\(maxDaily) left today")
                    .font(.system(size: 11, weight: .heavy, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(Color.appTextSecondary)
            }

            if recentRuns.isEmpty {
                Text("No runs yet. Generate picks or turn on autopilot to see the agent's run history here.")
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 8)
            } else {
                ForEach(recentRuns) { run in
                    runRow(run)
                }
            }
        }
    }

    private func runRow(_ run: AgentRunSummaryRow) -> some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(accent.opacity(0.14))
                Image(systemName: run.pickCount > 0 ? "doc.text.image" : "moon.zzz")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(run.pickCount > 0 ? accent : Color.appTextSecondary)
            }
            .frame(width: 38, height: 38)

            VStack(alignment: .leading, spacing: 2) {
                Text(run.displayDate + (run.isToday ? " · Today" : ""))
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Text(run.subtitle)
                    .font(.system(size: 11, weight: .semibold, design: .monospaced))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineLimit(1)
            }

            Spacer(minLength: 4)

            if run.pickCount > 0 {
                Text("\(run.pickCount) pick\(run.pickCount == 1 ? "" : "s")")
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundStyle(Color.appTextPrimary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(accent.opacity(0.2)))
            } else {
                Text("Passed")
                    .font(.system(size: 11, weight: .heavy))
                    .foregroundStyle(Color.appTextSecondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color.white.opacity(0.08)))
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.white.opacity(0.035))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.white.opacity(0.06), lineWidth: 1)
        )
    }

    // MARK: - Actions

    /// "HH:mm" 24h → "h:mm a" for display.
    private var displayTime: String {
        let parts = time.split(separator: ":")
        guard parts.count == 2, let h = Int(parts[0]), let m = Int(parts[1]) else { return time }
        let ampm = h >= 12 ? "PM" : "AM"
        let h12 = h % 12 == 0 ? 12 : h % 12
        return String(format: "%d:%02d %@", h12, m, ampm)
    }

    private func setAuto(_ value: Bool) {
        if value && !canUseAutopilot {
            errorText = "Upgrade to Pro to enable autopilot."
            return
        }
        autoOn = value  // optimistic
        busy = true
        Task {
            let ok = await onSetAuto(value)
            busy = false
            if !ok {
                autoOn = !value  // revert
                errorText = "Failed to update autopilot. Try again."
            }
        }
    }

    private func persistTime() {
        Task {
            let ok = await onSaveTime(time, timezone)
            if !ok { errorText = "Failed to save the autopilot time." }
        }
    }
}

// MARK: - Recent run row model

/// One row in the AutoPilot sheet's "Recent runs" list. Derived client-side from
/// the agent's picks (grouped by game date) + today's run summary — there's no
/// dedicated runs endpoint, so a date that produced picks == a run, and a 0-pick
/// today's-run summary surfaces as a "Passed" row.
struct AgentRunSummaryRow: Identifiable {
    let id: String
    /// "yyyy-MM-dd" game/slate date.
    let date: String
    let pickCount: Int
    let wins: Int
    let losses: Int
    let pushes: Int
    let pending: Int
    /// Slate note for a run that produced no picks (else nil).
    let note: String?
    let isToday: Bool

    /// "Jul 1" style date label.
    var displayDate: String {
        let parts = date.split(separator: "-")
        guard parts.count == 3, let m = Int(parts[1]), let d = Int(parts[2]),
              (1...12).contains(m) else { return date }
        let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        return "\(months[m - 1]) \(d)"
    }

    /// Record / status subtitle under the date.
    var subtitle: String {
        if pickCount == 0 { return note ?? "No picks" }
        if pending == pickCount { return "Awaiting results" }
        var parts: [String] = []
        if wins + losses + pushes > 0 {
            parts.append("\(wins)-\(losses)\(pushes > 0 ? "-\(pushes)" : "")")
        }
        if pending > 0 { parts.append("\(pending) pending") }
        return parts.isEmpty ? "Awaiting results" : parts.joined(separator: " · ")
    }

    /// Group picks by slate date into run rows (newest first), appending today's
    /// "passed" run when it produced nothing.
    static func derive(
        picks: [AgentPick],
        todaysRun: AgentGenerationRunSummary?,
        todayStr: String,
        limit: Int = 14
    ) -> [AgentRunSummaryRow] {
        var byDate: [String: [AgentPick]] = [:]
        for p in picks where !p.gameDate.isEmpty {
            byDate[p.gameDate, default: []].append(p)
        }
        var rows: [AgentRunSummaryRow] = byDate.map { date, ps in
            AgentRunSummaryRow(
                id: date,
                date: date,
                pickCount: ps.count,
                wins: ps.filter { $0.result == .won }.count,
                losses: ps.filter { $0.result == .lost }.count,
                pushes: ps.filter { $0.result == .push }.count,
                pending: ps.filter { $0.result == .pending }.count,
                note: nil,
                isToday: date == todayStr
            )
        }
        // Surface a no-pick today's run (agent ran and passed) so autopilot
        // "nothing today" outcomes are visible, not silently missing.
        if let run = todaysRun, run.picksGenerated == 0,
           !rows.contains(where: { $0.date == todayStr }) {
            let note: String = run.noGames
                ? "No games in preferred sports"
                : (run.weakSlate ? "Slate too weak — passed"
                                 : (run.slateNote ?? "Passed on the slate"))
            rows.append(AgentRunSummaryRow(
                id: todayStr, date: todayStr, pickCount: 0,
                wins: 0, losses: 0, pushes: 0, pending: 0,
                note: note, isToday: true
            ))
        }
        return Array(rows.sorted { $0.date > $1.date }.prefix(limit))
    }

    /// Local "yyyy-MM-dd" for today — matches `AgentDetailStore`'s date keying.
    static func todayString() -> String {
        let cal = Calendar(identifier: .gregorian)
        let c = cal.dateComponents([.year, .month, .day], from: Date())
        return String(format: "%04d-%02d-%02d", c.year ?? 1970, c.month ?? 1, c.day ?? 1)
    }
}
