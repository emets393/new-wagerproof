// ResearchTime.swift
//
// Single source of truth for the personalized time-value arc (pages 6–8):
// the self-reported DAILY sports-app-checking bucket, the projection
// formulas, and every piece of branched copy. Pages render this — they
// never do math or own copy, so the numbers on the cost/reclaim reveals,
// the pitch-intro summary slide, and the paywall reprise can never drift
// apart.
//
// The frame is per-DAY (scores, odds, lines, sports apps — the repetitive
// checking an agent replaces), projected across a betting lifetime and
// expressed as "years of your life" — modelled on Orbital Focus's
// screen-time arc (÷16 waking hours × 46-year horizon). Checking is a daily
// habit, so every bucket clears a full year on the cost reveal.
//
// Estimates quantify TIME ONLY. The cost reveal is just the user's own
// reported time projected; the reclaim is scoped to the repetitive checking
// an agent automates (a disclosed fraction) and always carries an on-screen
// disclosure. Never present these as outcomes, and never attach them to
// profit/win language. See .claude docs: onboarding-timevalue-paywall.

import Foundation

/// Self-reported DAILY time spent checking scores, odds, lines, and sports
/// apps. Raw values are PERSISTED in
/// `profiles.onboarding_data.researchTimeBucket` — never rename a case.
/// (The persisted KEY is still `researchTimeBucket` for continuity; the old
/// weekly-research values `lt1`/`h6to10`/… no longer match a case, so they
/// resolve tolerantly to `.unknown`.)
enum ResearchTimeBucket: String, CaseIterable, Identifiable, Sendable {
    case lt30m
    case m30to60
    case h1to2
    case h2to3
    case h3to4
    case h4plus
    case unknown

    var id: String { rawValue }

    /// Pill label on the question page.
    var optionLabel: String {
        switch self {
        case .lt30m:   "< 30 min"
        case .m30to60: "30–60 min"
        case .h1to2:   "1–2 hours"
        case .h2to3:   "2–3 hours"
        case .h3to4:   "3–4 hours"
        case .h4plus:  "4+ hours"
        case .unknown: "Honestly, no idea"
        }
    }

    /// Conservative midpoint (hours/day) used by every projection. `unknown`
    /// sits near an engaged bettor's median rather than forcing fake precision.
    var hoursPerDay: Double {
        switch self {
        case .lt30m:   0.5
        case .m30to60: 0.75
        case .h1to2:   1.5
        case .h2to3:   2.5
        case .h3to4:   3.5
        case .h4plus:  5.0
        case .unknown: 1.5
        }
    }

    /// Weekly checking hours (7× the daily midpoint) — used by the paywall's
    /// before/after chart, which reads in hours/week.
    var hoursPerWeek: Double { hoursPerDay * 7 }

    /// First-person echo of the tapped answer (rendered dimmed).
    var echoLine: String {
        switch self {
        case .lt30m:   "Under half an hour a day."
        case .m30to60: "Half an hour to an hour a day."
        case .h1to2:   "One to two hours a day."
        case .h2to3:   "Two to three hours a day."
        case .h3to4:   "Three to four hours a day."
        case .h4plus:  "Four or more hours a day."
        case .unknown: "Honestly, not sure."
        }
    }

    /// Branched conversational acknowledgment (rendered bright, accent ring).
    var replyLine: String {
        switch self {
        case .lt30m:   "Disciplined. Let's keep it that way."
        case .m30to60: "Not bad — but that's still real time we can hand back."
        case .h1to2:   "That adds up faster than it feels. Most of it is the same checks on repeat."
        case .h2to3:   "That's a part-time habit — scores, lines, and refreshes, over and over."
        case .h3to4:   "That's a second job you never applied for. Almost all of it is repeatable."
        case .h4plus:  "That's a huge chunk of your day going to the scroll. Let's win it back."
        case .unknown: "Most bettors underestimate it. Score checks and line refreshes add up fast."
        }
    }

    /// Tolerant resolve — nil / unrecognized (older weekly payloads, future
    /// renames) land on `.unknown` so downstream math always has a basis.
    static func resolve(_ raw: String?) -> ResearchTimeBucket {
        guard let raw, let bucket = ResearchTimeBucket(rawValue: raw) else { return .unknown }
        return bucket
    }
}

/// Derived projections for one bucket. All display values are pre-rounded
/// here so every surface shows identical numbers.
struct ResearchTimeEstimates: Sendable {
    // Disclosed assumptions (owner-approved). Mirrors Orbital Focus's
    // screen-time arc: a betting lifetime projected across ~46 years, with a
    // 16-waking-hours-a-day basis for the "years of your life" equivalence.
    // Reclaim is scoped to the repetitive checking an agent automates — kept
    // conservative and always shown with the on-screen disclosure.
    static let wakingHoursPerDay = 16.0
    static let lifetimeHorizonYears = 46.0
    static let daysPerYear = 365.0
    static let reclaimFraction = 0.75

    let bucket: ResearchTimeBucket
    /// Calendar days of THIS year spent checking, at this pace: hours/day × 365 ÷ 24.
    let daysThisYear: Int
    /// Years of life spent checking, projected across a betting lifetime and
    /// expressed against waking hours (the "bad news" figure).
    let yearsOfLife: Int
    /// Years an agent hands back — `reclaimFraction` of the years-of-life
    /// figure, floored (min 1) and shown as "N+ years".
    let reclaimYears: Int
    /// Weekly hours the agent's checking replaces — the concrete anchor under
    /// the big abstract "years" number.
    let reclaimHoursPerWeek: Int

    init(bucket: ResearchTimeBucket) {
        self.bucket = bucket
        let hpd = bucket.hoursPerDay
        let yearsExact = hpd / Self.wakingHoursPerDay * Self.lifetimeHorizonYears
        daysThisYear = Int((hpd / 24.0 * Self.daysPerYear).rounded())
        yearsOfLife = max(1, Int(yearsExact.rounded()))
        reclaimYears = max(1, Int(yearsExact * Self.reclaimFraction))   // floor
        reclaimHoursPerWeek = max(1, Int((hpd * Self.reclaimFraction * 7).rounded()))
    }

    init(rawBucket: String?) {
        self.init(bucket: ResearchTimeBucket.resolve(rawBucket))
    }

    /// "year" / "years" for a given count — keeps every surface's pluralization
    /// in one place.
    static func yearsWord(_ n: Int) -> String { n == 1 ? "year" : "years" }

    /// Goal-branched close for the reclaim reveal. Keys match the persisted
    /// goal ids on `OnboardingPrimaryGoalPage` verbatim.
    static func reclaimClose(forGoal goal: String?) -> String {
        switch goal {
        case "Find profitable edges faster":
            "Time you could spend acting on edges while they're live instead of hunting for them."
        case "Analyze data to improve strategy":
            "Time you could spend refining strategy instead of gathering inputs."
        case "Track my performance over time":
            "Time you could spend reviewing what works instead of redoing the same checks."
        case "Get timely alerts for model picks":
            "Your agent watches the board, so you only step in when something's worth your attention."
        default:
            "Time back for the parts of betting you actually enjoy."
        }
    }

    /// Always visible with the cost reveal's final block.
    static let costFootnote =
        "Projection of your current habits, at about 16 waking hours a day."

    /// Required disclosure — always on screen with the reclaim figure, never
    /// behind a tap. Sells time only; explicitly disclaims outcomes.
    static let reclaimDisclosure =
        "Estimated from your answer and the checking WagerProof automates: score, line, and model updates, projected across a betting lifetime at about 16 waking hours a day. Estimates aren't guarantees. Actual time savings vary, and WagerProof does not promise betting profits or outcomes."
}

// MARK: - Weekly bet-amount (money-in-play) arc

/// Self-reported weekly bet amount. Powers the "money in play" figures woven
/// into the cost/reclaim/summary/paywall alongside the time numbers. The frame
/// is RISK-SIZING ONLY: it projects how much a small weekly stake becomes over
/// a year and a betting lifetime (turnover — total wagered), never winnings,
/// losses, or returns. Raw values are PERSISTED in
/// `profiles.onboarding_data.weeklyStakesBucket` — never rename a case.
enum StakesBucket: String, CaseIterable, Identifiable, Sendable {
    case lt50
    case h50to150
    case h150to400
    case h400to1000
    case h1000plus
    case unknown

    var id: String { rawValue }

    /// Pill label on the question page.
    var optionLabel: String {
        switch self {
        case .lt50:       "Under $50"
        case .h50to150:   "$50–$150"
        case .h150to400:  "$150–$400"
        case .h400to1000: "$400–$1,000"
        case .h1000plus:  "$1,000+"
        case .unknown:    "Prefer not to say"
        }
    }

    /// Conservative weekly midpoint (dollars). `unknown` ("prefer not to say")
    /// sits near an engaged bettor's median rather than forcing fake precision.
    var weeklyDollars: Double {
        switch self {
        case .lt50:       25
        case .h50to150:   100
        case .h150to400:  250
        case .h400to1000: 650
        case .h1000plus:  1500
        case .unknown:    150
        }
    }

    /// First-person echo of the tapped answer (rendered dimmed).
    var echoLine: String {
        switch self {
        case .lt50:       "Under $50 a week."
        case .h50to150:   "Around $50 to $150 a week."
        case .h150to400:  "About $150 to $400 a week."
        case .h400to1000: "About $400 to $1,000 a week."
        case .h1000plus:  "A thousand or more a week."
        case .unknown:    "I'd rather not say."
        }
    }

    /// Branched acknowledgment (bright, accent ring). Sizes the risk — no
    /// judgment, no returns talk.
    var replyLine: String {
        switch self {
        case .lt50:       "Keeping it light. Still adds up over a year."
        case .h50to150:   "A steady habit — bigger over a year than it feels."
        case .h150to400:  "That adds up faster than it feels."
        case .h400to1000: "Serious action, every single week."
        case .h1000plus:  "High stakes. The yearly number is going to be eye-opening."
        case .unknown:    "No problem — we'll use a middle estimate."
        }
    }

    /// Tolerant resolve — nil / unrecognized lands on `.unknown` so downstream
    /// math always has a basis.
    static func resolve(_ raw: String?) -> StakesBucket {
        guard let raw, let bucket = StakesBucket(rawValue: raw) else { return .unknown }
        return bucket
    }
}

/// Derived "money in play" projections. All display values are pre-rounded and
/// pre-formatted here so every surface shows identical figures. Turnover only —
/// never winnings/losses. Lifetime uses the SAME horizon as the years-of-life
/// figure (`ResearchTimeEstimates.lifetimeHorizonYears`) so the two reveals
/// share one timeframe.
struct StakesEstimates: Sendable {
    let bucket: StakesBucket
    /// Total wagered this year: weekly × 52.
    let yearlyAction: Int
    /// Total wagered across a betting lifetime: yearly × horizon years.
    let lifetimeAction: Int

    init(bucket: StakesBucket) {
        self.bucket = bucket
        let weekly = bucket.weeklyDollars
        let yearly = weekly * 52
        yearlyAction = Self.round(yearly, to: 100)
        lifetimeAction = Self.round(yearly * ResearchTimeEstimates.lifetimeHorizonYears, to: 10_000)
    }

    init(rawBucket: String?) {
        self.init(bucket: StakesBucket.resolve(rawBucket))
    }

    /// "$13,000" — this year's total wagered.
    var yearlyActionDisplay: String { Self.money(yearlyAction) }
    /// "$600,000" — lifetime total wagered (the "you read that right" figure).
    var lifetimeActionDisplay: String { Self.money(lifetimeAction) }

    private static func round(_ value: Double, to step: Int) -> Int {
        Int((value / Double(step)).rounded()) * step
    }

    private static func money(_ value: Int) -> String {
        // Int.formatted() groups with the locale's thousands separator ("13,000").
        "$" + value.formatted()
    }

    /// Always visible with any money figure. Names it as turnover and disclaims
    /// outcomes — the money is risk-sizing, never a projection of results.
    static let disclosure =
        "Total amount wagered — money in play, not winnings or losses. Projected from your answer across a betting lifetime. WagerProof does not promise profits or outcomes."
}
