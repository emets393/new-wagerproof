import SwiftUI
import WagerproofDesign

/// Liquid Glass "Learn more" explainer for the Outliers tab, opened from the
/// `OutliersHowToBanner` tool button. Replaces the old always-on
/// `OutliersHeroHeaderView` banner: the how-to now lives behind a tap so the
/// hub leads with the merged outlier list, and the explanation gets room to
/// breathe in an on-theme glass sheet.
///
/// Content mirrors the prior hero copy — the "We scan → We flag → You act"
/// flow — plus a short tour of the kinds of outliers we surface.
struct OutliersLearnMoreSheet: View {
    @Environment(\.dismiss) private var dismiss

    private struct Step: Identifiable {
        let id = UUID()
        let icon: String
        let tint: Color
        let title: String
        let desc: String
    }

    private let flow: [Step] = [
        .init(icon: "dot.radiowaves.left.and.right", tint: Color(hex: 0x22C55E),
              title: "We scan", desc: "Every line, model signal, and situational trend across all five sports — refreshed throughout the day."),
        .init(icon: "chart.bar.xaxis", tint: Color(hex: 0xF59E0B),
              title: "We flag", desc: "Only the rare setups where our data and the history behind it say the edge is real — not noise."),
        .init(icon: "scope", tint: Color(hex: 0x7C4DFF),
              title: "You act", desc: "Open a flagged matchup to see exactly why it surfaced — before the line moves.")
    ]

    private let kinds: [Step] = [
        .init(icon: "chart.line.uptrend.xyaxis", tint: Color(hex: 0x22C55E),
              title: "Market value", desc: "Prediction-market consensus diverges from the sportsbook line."),
        .init(icon: "bolt.fill", tint: Color(hex: 0xF59E0B),
              title: "Model fades", desc: "When our model is extremely confident, the backtest says fade it."),
        .init(icon: "baseball.fill", tint: Color(hex: 0x0EA5E9),
              title: "Situational trends", desc: "ATS and over/under win rates in this exact spot."),
        .init(icon: "target", tint: Color(hex: 0x14B8A6),
              title: "Model accuracy", desc: "How the model has graded in matchups like this one.")
    ]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    headline
                    sectionTitle("How it works")
                    VStack(spacing: 10) {
                        ForEach(flow) { stepRow($0) }
                    }
                    sectionTitle("What we flag")
                    VStack(spacing: 10) {
                        ForEach(kinds) { stepRow($0) }
                    }
                }
                .padding(20)
                .padding(.bottom, 28)
            }
            .scrollIndicators(.hidden)
            .navigationTitle("How Outliers work")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { dismiss() } label: {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 22))
                            .foregroundStyle(Color.appTextSecondary)
                            .symbolRenderingMode(.hierarchical)
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        // Glass sheet so the tab's surface reads through — matches the app's
        // Liquid Glass chrome rather than an opaque modal.
        .presentationBackground(.ultraThinMaterial)
    }

    private var headline: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Spot the setup before the outcome.")
                .font(.system(size: 22, weight: .heavy))
                .foregroundStyle(Color.appTextPrimary)
                .tracking(-0.4)
            Text("We watch every game for statistical outliers — the rare conditions that have historically pointed to a betting edge. When the data lines up, the matchup shows up here.")
                .font(.system(size: 14))
                .foregroundStyle(Color.appTextSecondary)
                .lineSpacing(2)
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 12, weight: .bold))
            .tracking(0.6)
            .foregroundStyle(Color.appTextSecondary)
            .padding(.top, 2)
    }

    /// One glass row: tinted icon chip + title/description.
    private func stepRow(_ step: Step) -> some View {
        HStack(alignment: .top, spacing: 14) {
            ZStack {
                Circle().fill(step.tint.opacity(0.16))
                Image(systemName: step.icon)
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(step.tint)
            }
            .frame(width: 40, height: 40)

            VStack(alignment: .leading, spacing: 3) {
                Text(step.title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Color.appTextPrimary)
                Text(step.desc)
                    .font(.system(size: 13))
                    .foregroundStyle(Color.appTextSecondary)
                    .lineSpacing(1.5)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .liquidGlassBackground(in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(Color.appBorder.opacity(0.4), lineWidth: 0.5)
        )
    }
}
