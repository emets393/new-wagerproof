// OnboardingSportsShowcasePage.swift
//
// Page 3: "we've got you covered" — the five modeled leagues as staggered
// tiles, then the three surfaces (Props, Outliers, Research Agents) that
// hunt value across all of them. Pure pitch page; no data collected.

import SwiftUI
import WagerproofDesign
import WagerproofModels

struct OnboardingSportsShowcasePage: View {
    private let leagues: [(sport: AgentSport, label: String)] = [
        (.nfl, "NFL"), (.cfb, "CFB"), (.nba, "NBA"), (.ncaab, "NCAAB"), (.mlb, "MLB")
    ]

    var body: some View {
        OnboardingPageScaffold(
            title: "We cover the major leagues",
            subtitle: "Machine-learning models grade every game across football, basketball, and baseball."
        ) {
            // League tile row — five glyph tiles, staggered in.
            HStack(spacing: 10) {
                ForEach(Array(leagues.enumerated()), id: \.element.label) { index, league in
                    VStack(spacing: 8) {
                        Image(systemName: league.sport.sfSymbol)
                            .font(.system(size: 26))
                            .foregroundStyle(Color.appPrimary)
                        Text(league.label)
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.white.opacity(0.85))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: 84)
                    .liquidGlassBackground(
                        in: RoundedRectangle(cornerRadius: 14, style: .continuous),
                        tint: Color.appPrimary.opacity(0.12)
                    )
                    .pageEntrance(index: 2 + index)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)

            VStack(spacing: 12) {
                OnboardingFeatureRow(
                    icon: "chart.bar.xaxis",
                    title: "Player props",
                    text: "Cross-book odds and hit-rate trends for every major prop market."
                )
                .pageEntrance(index: 7)

                OnboardingFeatureRow(
                    icon: "waveform.path.ecg",
                    title: "Outliers",
                    text: "Line moves, market anomalies, and value the books haven't corrected yet."
                )
                .pageEntrance(index: 8)

                OnboardingFeatureRow(
                    icon: "brain.head.profile",
                    title: "Research agents",
                    text: "Your AI experts research and find value for you across all of it."
                )
                .pageEntrance(index: 9)
            }
            .padding(.horizontal, 24)
            .padding(.top, 12)
        }
    }
}
