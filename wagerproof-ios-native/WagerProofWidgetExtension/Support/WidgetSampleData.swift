import WagerproofModels

/// Fixture data for widget placeholders (shown while the real timeline
/// resolves) and Xcode previews. Never shown to real users once real data
/// loads.
enum WidgetSampleData {
    static let outlierAlerts: [OutlierAlertForWidget] = [
        OutlierAlertForWidget(
            id: "sample-1", kind: .value, sport: "nfl",
            awayTeam: "49ers", homeTeam: "Cowboys",
            marketType: "Spread", side: "Cowboys", confidence: 85
        ),
        OutlierAlertForWidget(
            id: "sample-2", kind: .fade, sport: "nba",
            awayTeam: "Warriors", homeTeam: "Suns",
            marketType: "Spread", side: "Warriors", confidence: 11
        ),
        OutlierAlertForWidget(
            id: "sample-3", kind: .value, sport: "cfb",
            awayTeam: "Alabama", homeTeam: "Georgia",
            marketType: "Total", side: "Over", confidence: 62
        ),
        OutlierAlertForWidget(
            id: "sample-4", kind: .fade, sport: "ncaab",
            awayTeam: "Kansas", homeTeam: "Kentucky",
            marketType: "Total", side: "Under", confidence: 7
        ),
        OutlierAlertForWidget(
            id: "sample-5", kind: .value, sport: "nfl",
            awayTeam: "Bills", homeTeam: "Dolphins",
            marketType: "Moneyline", side: "Bills", confidence: 88
        ),
    ]

    static let topAgents: [TopAgentWidgetData] = [
        TopAgentWidgetData(
            agentId: "sample-a1", agentName: "Sharp Edge", agentEmoji: "🎯",
            agentColor: "#22c55e", isFavorite: true, netUnits: 8.4,
            winRate: 0.61, currentStreak: 4, record: "28-18",
            picks: [
                AgentPickForWidget(id: "p1", sport: "nfl", matchup: "Ravens @ Chiefs", pickSelection: "Ravens -3.5", odds: "-110"),
                AgentPickForWidget(id: "p2", sport: "nba", matchup: "Lakers @ Celtics", pickSelection: "Over 224.5", odds: "-105"),
            ]
        ),
        TopAgentWidgetData(
            agentId: "sample-a2", agentName: "Line Hunter", agentEmoji: "🧠",
            agentColor: "#3b82f6", isFavorite: false, netUnits: 6.1,
            winRate: 0.57, currentStreak: 2, record: "24-18",
            picks: [
                AgentPickForWidget(id: "p3", sport: "cfb", matchup: "Alabama @ Georgia", pickSelection: "Georgia -7", odds: "-115"),
            ]
        ),
        TopAgentWidgetData(
            agentId: "sample-a3", agentName: "Market Fade", agentEmoji: "⚡",
            agentColor: "#f59e0b", isFavorite: true, netUnits: 4.2,
            winRate: 0.54, currentStreak: 1, record: "20-17",
            picks: [
                AgentPickForWidget(id: "p4", sport: "ncaab", matchup: "Duke @ UNC", pickSelection: "Duke +2.5", odds: "-108"),
            ]
        ),
    ]
}
