import Foundation
import Supabase
import WagerproofModels

public actor CFBSignalDefinitionsService {
    public static let shared = CFBSignalDefinitionsService()
    public init() {}

    private var cached: [String: CFBSignalDefinition]?

    public func definitionsBySource() async -> [String: CFBSignalDefinition] {
        if let cached { return cached }
        let cfb = await CFBSupabase.shared.client
        guard let rows: [SignalDefRow] = try? await cfb
            .from("cfb_signal_defs")
            .select()
            .execute()
            .value
        else {
            cached = [:]
            return [:]
        }

        var out: [String: CFBSignalDefinition] = [:]
        for row in rows {
            let definition = row.model
            for key in row.matchKeys {
                for candidate in Self.normalizedCandidates(for: key) {
                    out[candidate] = definition
                }
            }
        }
        cached = out
        return out
    }

    public static func normalize(_ value: String) -> String {
        let lower = value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
        let cleaned = lower.replacingOccurrences(
            of: #"[^a-z0-9]+"#,
            with: " ",
            options: .regularExpression
        )
        return cleaned
            .split(separator: " ")
            .joined(separator: " ")
    }

    public static func definition(for rawKey: String, in definitions: [String: CFBSignalDefinition]) -> CFBSignalDefinition? {
        let candidates = normalizedCandidates(for: rawKey)
        for candidate in candidates {
            if let definition = definitions[candidate] {
                return definition
            }
        }
        if let legacyKey = legacySignalKey(for: rawKey),
           let definition = definitions[normalize(legacyKey)] {
            return definition
        }

        return definitions.first { entry in
            let key = entry.key
            let definition = entry.value
            return candidates.contains(Self.normalize(definition.sourceKey))
                || candidates.contains(Self.normalize(definition.displayName))
                || candidates.contains { candidate in
                    candidate.count > 6 && (key.contains(candidate) || candidate.contains(key))
                }
        }?.value
    }

    public static func normalizedCandidates(for value: String) -> [String] {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        var candidates = [normalize(trimmed)]

        if let open = trimmed.firstIndex(of: "(") {
            candidates.append(normalize(String(trimmed[..<open])))
        }

        if let colon = trimmed.firstIndex(of: ":") {
            candidates.append(normalize(String(trimmed[..<colon])))
            candidates.append(normalize(String(trimmed[trimmed.index(after: colon)...])))
        }

        candidates.append(contentsOf: trimmed.split(separator: "/").map { normalize(String($0)) })

        var seen = Set<String>()
        return candidates.filter { !$0.isEmpty && seen.insert($0).inserted }
    }

    public static func legacySignalKey(for rawKey: String) -> String? {
        let key = normalize(rawKey)
        if key.hasPrefix("team total") { return "team_total" }
        if key.contains("t2 high edge dog") { return "model_highedge_dog" }
        if key.contains("t3 away") && key.contains("p5 edge") { return "model_road_value" }
        if key.contains("t3 fade home backup qb") { return "fade_home_backup_qb" }
        if key.contains("sos fade padded road") { return "padded_road_fade" }
        if key.contains("g5 fade top2 post loss") { return "g5_fade_after_loss" }
        if key.contains("stack model gap") { return "stack" }
        if key.contains("sb volume gap") { return "soft_book_gap" }
        if key.contains("premium lay fav") { return "premium_lay_fav" }
        if key.contains("key dog") { return "key_dog" }
        if key.contains("key lay") { return "key_lay_fav" }
        if key.contains("rvr ranked vs ranked") { return "rvr_home" }
        if key.contains("conf bigten away fav") { return "conf_bigten_road_fav" }
        if key.contains("conf sunbelt fade") { return "conf_sunbelt_fade" }
        if key.contains("conf aac total") { return "conf_aac_over" }
        if key.contains("conf sunbelt total") { return "conf_sunbelt_under" }
        if key.contains("form over hot fade") { return "form_over_hot_under" }
        if key.contains("total fade high") { return "fade_high_total" }
        if key.contains("total fade low") { return "fade_low_total" }
        if key.contains("total model over edge") && key.contains("g5") { return "model_total_over_pace" }
        if key.contains("total model over edge") { return "model_total_over" }
        if key.contains("t1 under model high total weakd") { return "model_total_under" }
        if key.contains("ranked upset") { return "ranked_upset_letdown_under" }
        if key.contains("pt rr letdown") { return "primetime_rivalry_letdown_under" }
        if key.contains("backup qb") && key.contains("under") { return "backup_qb_under" }
        if key.contains("1h spread") { return "h1_spread" }
        if key.contains("1h total") { return "h1_total" }
        if key.contains("1h ml") { return "h1_ml" }
        return nil
    }

    private struct FlexibleText: Decodable {
        let value: String

        init(from decoder: Decoder) throws {
            let c = try decoder.singleValueContainer()
            if let s = try? c.decode(String.self) {
                value = s
            } else if let i = try? c.decode(Int.self) {
                value = String(i)
            } else if let d = try? c.decode(Double.self) {
                value = d.rounded() == d ? String(Int(d)) : String(d)
            } else if let b = try? c.decode(Bool.self) {
                value = b ? "true" : "false"
            } else {
                value = ""
            }
        }
    }

    private struct SignalDefRow: Decodable {
        let id: String?
        let source: String?
        let signalKey: String?
        let signalName: String?
        let slug: String?
        let displayName: String
        let oneLiner: String?
        let definition: String?
        let whyItWorks: String?
        let betDirection: String?
        let typicalHit: String?

        enum CodingKeys: String, CodingKey {
            case id, source, slug, definition
            case signalKey = "signal_key"
            case signalName = "signal_name"
            case displayName = "display_name"
            case oneLiner = "one_liner"
            case whyItWorks = "why_it_works"
            case betDirection = "bet_direction"
            case typicalHit = "typical_hit"
        }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            id = (try? c.decodeIfPresent(FlexibleText.self, forKey: .id))?.value
            source = (try? c.decodeIfPresent(FlexibleText.self, forKey: .source))?.value
            signalKey = (try? c.decodeIfPresent(FlexibleText.self, forKey: .signalKey))?.value
            signalName = (try? c.decodeIfPresent(FlexibleText.self, forKey: .signalName))?.value
            slug = (try? c.decodeIfPresent(FlexibleText.self, forKey: .slug))?.value
            displayName = (try? c.decodeIfPresent(FlexibleText.self, forKey: .displayName))?.value ?? source ?? signalKey ?? signalName ?? "Signal"
            oneLiner = (try? c.decodeIfPresent(FlexibleText.self, forKey: .oneLiner))?.value
            definition = (try? c.decodeIfPresent(FlexibleText.self, forKey: .definition))?.value
            whyItWorks = (try? c.decodeIfPresent(FlexibleText.self, forKey: .whyItWorks))?.value
            betDirection = (try? c.decodeIfPresent(FlexibleText.self, forKey: .betDirection))?.value
            typicalHit = (try? c.decodeIfPresent(FlexibleText.self, forKey: .typicalHit))?.value
        }

        var matchKeys: [String] {
            let possibleKeys: [String?] = [source, signalKey, signalName, slug, id, displayName]
            let baseKeys = possibleKeys.compactMap { $0 }.filter { !$0.isEmpty }
            return baseKeys + legacyAliases(for: signalKey)
        }

        private func legacyAliases(for signalKey: String?) -> [String] {
            switch signalKey {
            case "key_dog":
                return ["KEY dog +2.5/3/3.5 (HOME dog)", "KEY dog +2.5/3/3.5"]
            case "key_lay_fav":
                return ["KEY lay-fav -6.5", "KEY favorite -6.5"]
            case "backup_qb_under":
                return ["T2 under: backup QB (open>=50)", "backup QB under"]
            case "h1_total":
                return ["1H total (pruned tempo model)", "1H total"]
            case "h1_ml":
                return ["1H ML (dog-conversion, track-live)", "1H ML"]
            case "h1_spread":
                return ["1H spread (model)", "1H spread"]
            case "team_total":
                return ["team total (model)", "team total"]
            case "conf_bigten_road_fav":
                return ["CONF BigTen away-fav cover", "BigTen away-fav cover"]
            case "premium_lay_fav":
                return ["PREMIUM lay-fav", "premium lay fav"]
            case "soft_book_gap":
                return ["soft-book gap", "soft book gap"]
            case "rvr_home":
                return ["RvR home-dog", "ranked vs ranked home dog"]
            default:
                return []
            }
        }

        var model: CFBSignalDefinition {
            let key = source ?? signalKey ?? signalName ?? slug ?? id ?? displayName
            return CFBSignalDefinition(
                signalKey: signalKey,
                sourceKey: key,
                displayName: displayName,
                oneLiner: oneLiner,
                definition: definition,
                whyItWorks: whyItWorks,
                betDirection: betDirection,
                typicalHit: typicalHit
            )
        }
    }
}
