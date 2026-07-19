// ResearchTime.swift
//
// Single source of truth for the personalized research-time arc (pages
// 6–8): the self-reported weekly bucket, the projection formulas, and every
// piece of branched copy. Pages render this — they never do math or own
// copy, so the numbers on the cost/reclaim reveals, the pitch-intro summary
// slide, and the paywall reprise can never drift apart.
//
// Estimates are deliberately conservative and always shown as ranges or
// floor+"+" figures with an on-screen disclosure. Never present these as
// outcomes, and never attach them to profit/win language — time is the only
// thing we quantify. See .claude/docs plan: onboarding-timevalue-paywall.

import Foundation

/// Self-reported weekly research-time bucket. Raw values are PERSISTED in
/// `profiles.onboarding_data.researchTimeBucket` — never rename a case.
enum ResearchTimeBucket: String, CaseIterable, Identifiable, Sendable {
    case lt1
    case h1to3
    case h3to6
    case h6to10
    case h10plus
    case unknown

    var id: String { rawValue }

    /// Pill label on the question page.
    var optionLabel: String {
        switch self {
        case .lt1:     "< 1 hour"
        case .h1to3:   "1–3 hours"
        case .h3to6:   "3–6 hours"
        case .h6to10:  "6–10 hours"
        case .h10plus: "10+ hours"
        case .unknown: "Honestly, no idea"
        }
    }

    /// Conservative midpoint used by every projection. `unknown` sits near
    /// the population median rather than forcing fake precision.
    var hoursPerWeek: Double {
        switch self {
        case .lt1:     1.0
        case .h1to3:   2.5
        case .h3to6:   4.5
        case .h6to10:  8.0
        case .h10plus: 12.0
        case .unknown: 5.0
        }
    }

    /// First-person echo of the tapped answer (rendered dimmed).
    var echoLine: String {
        switch self {
        case .lt1:     "Under an hour a week."
        case .h1to3:   "One to three hours a week."
        case .h3to6:   "Three to six hours a week."
        case .h6to10:  "Six to ten hours a week."
        case .h10plus: "Ten or more hours a week."
        case .unknown: "Honestly, not sure."
        }
    }

    /// Branched conversational acknowledgment (rendered bright, accent ring).
    var replyLine: String {
        switch self {
        case .lt1:     "Efficient. Let's make sure those minutes go to decisions, not scanning."
        case .h1to3:   "A few focused hours. Most of that is checks a model can run for you."
        case .h3to6:   "That's a serious habit. And most of it is the same checks, every single slate."
        case .h6to10:  "That's a part-time job. You're doing an analyst's workload by hand."
        case .h10plus: "That's a full workday, every week. Most of it is re-checking the same numbers."
        case .unknown: "Most bettors underestimate it. Line checks and box scores add up fast."
        }
    }

    /// Tolerant resolve — nil / unrecognized (older payloads, future
    /// renames) land on `.unknown` so downstream math always has a basis.
    static func resolve(_ raw: String?) -> ResearchTimeBucket {
        guard let raw, let bucket = ResearchTimeBucket(rawValue: raw) else { return .unknown }
        return bucket
    }
}

/// Derived projections for one bucket. All display values are pre-rounded
/// here so every surface shows identical numbers.
struct ResearchTimeEstimates: Sendable {
    // The two disclosed assumptions (owner-approved). Multi-sport bettors
    // are active ~40 weeks/yr, and roughly 40–60% of research time is
    // routine scanning (line checks, model reads, trend screens) — the part
    // an agent automates. Keep in sync with the on-screen disclosure copy.
    static let activeWeeksPerYear = 40.0
    static let weeksPerMonth = 4.33
    static let reclaimLowFraction = 0.40
    static let reclaimHighFraction = 0.60

    let bucket: ResearchTimeBucket
    let hoursPerMonth: Int
    let hoursPerYear: Int
    let daysPerYearEquivalent: Int
    let reclaimWeekLow: Int
    let reclaimWeekHigh: Int
    /// Floor-to-ten of the LOW yearly reclaim — rendered as "120+ hours".
    let reclaimYearLowDisplay: Int

    init(bucket: ResearchTimeBucket) {
        self.bucket = bucket
        let hpw = bucket.hoursPerWeek
        let yearly = hpw * Self.activeWeeksPerYear
        hoursPerMonth = Int((hpw * Self.weeksPerMonth).rounded())
        hoursPerYear = Int(yearly.rounded())
        daysPerYearEquivalent = Int((yearly / 24).rounded())
        reclaimWeekLow = Int((hpw * Self.reclaimLowFraction).rounded())
        reclaimWeekHigh = max(1, Int((hpw * Self.reclaimHighFraction).rounded()))
        reclaimYearLowDisplay = max(10, Int(yearly * Self.reclaimLowFraction / 10) * 10)
    }

    init(rawBucket: String?) {
        self.init(bucket: ResearchTimeBucket.resolve(rawBucket))
    }

    /// "2–3 hours" / "up to an hour" — the weekly reclaim range, phrased so
    /// the lt1 bucket never renders a "0–1" range.
    var weeklyRangeText: String {
        if reclaimWeekLow < 1 {
            return reclaimWeekHigh <= 1 ? "up to an hour" : "up to \(reclaimWeekHigh) hours"
        }
        return "\(reclaimWeekLow)–\(reclaimWeekHigh) hours"
    }

    /// Compact variant for headlines: "2–3 hrs/week" / "up to 1 hr/week".
    var weeklyRangeShortText: String {
        if reclaimWeekLow < 1 {
            return "up to \(max(1, reclaimWeekHigh)) hr/week"
        }
        return "\(reclaimWeekLow)–\(reclaimWeekHigh) hrs/week"
    }

    /// Goal-branched close for the reclaim reveal. Keys match the persisted
    /// goal ids on `OnboardingPrimaryGoalPage` verbatim.
    static func reclaimClose(forGoal goal: String?) -> String {
        switch goal {
        case "Find profitable edges faster":
            "Time you could spend acting on edges while they're live instead of hunting for them."
        case "Analyze data to improve strategy":
            "Time you could spend refining strategy instead of gathering inputs."
        case "Track my performance over time":
            "Time you could spend reviewing what works instead of redoing research."
        case "Get timely alerts for model picks":
            "Your agent watches the board, so you only step in when something's worth your attention."
        default:
            "Time back for the parts of betting you actually enjoy."
        }
    }

    /// Always visible with the cost reveal's final block.
    static let costFootnote =
        "Estimate from your answer, assuming about 40 active betting weeks per year."

    /// Required disclosure — always on screen with the reclaim figure, never
    /// behind a tap. Sells time only; explicitly disclaims outcomes.
    static let reclaimDisclosure =
        "Estimated range based on your answer and the research tasks WagerProof automates: line scanning, model checks, and trend screening. Estimates aren't guarantees. Actual time savings vary, and WagerProof does not promise betting profits or outcomes."
}
