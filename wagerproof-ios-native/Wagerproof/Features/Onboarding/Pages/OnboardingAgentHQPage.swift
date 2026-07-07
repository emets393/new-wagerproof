// OnboardingAgentHQPage.swift
//
// Page 6: a first look at Agent HQ — the same pixel-office scene from the
// Agents tab (`PixelOffice`), populated with its built-in demo roster so a
// few agents are already walking the floor before the user has created one.
// Sits right after the primary-goal question, before the detailed
// agent-value pitch carousel. Pure pitch page; no data collected.

import SwiftUI
import WagerproofDesign

struct OnboardingAgentHQPage: View {
    var body: some View {
        OnboardingPageScaffold(
            title: "We created research agents to save you time!",
            subtitle: "Meet Agent HQ — a team of AI analysts that works the data around the clock so you don't have to."
        ) {
            PixelOffice(agents: nil, isActive: true)
                .overlay(alignment: .topLeading) {
                    hqBadge.padding(10)
                }
                .padding(.horizontal, 24)
                .pageEntrance(index: 2)
        }
    }

    /// Same "Agent HQ — Live" glass pill the Agents tab overlays on the real
    /// office hero (`AgentsView.agentHQStatusPill`), reproduced here since
    /// that one is private to the tab's view.
    private var hqBadge: some View {
        HStack(spacing: 5) {
            Circle()
                .fill(Color(hex: 0x22C55E))
                .frame(width: 6, height: 6)
            Text("Agent HQ — Live")
                .font(.system(size: 11, weight: .bold))
                .tracking(0.3)
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 11)
        .padding(.vertical, 6)
        .liquidGlassBackground(in: Capsule())
    }
}

#if DEBUG
#Preview("Onboarding — Agent HQ") {
    ZStack {
        Color.black.ignoresSafeArea()
        OnboardingAgentHQPage()
    }
    .preferredColorScheme(.dark)
}
#endif
