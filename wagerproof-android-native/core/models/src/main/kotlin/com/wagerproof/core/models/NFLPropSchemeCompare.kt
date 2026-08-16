package com.wagerproof.core.models

// MARK: - Scheme-compare resolution
//
// Port of `src/features/propBreakdown/schemeCompare.ts` + the web
// ComparisonBlock's defense-tile / game-split / look-hit-rate pickers,
// mirroring iOS `NFLPropSchemeCompare.swift`. Pure field selection.

enum class NFLSchemeCompareMode { RECEIVING, QB, RUSH }

/** One "career overall vs this look" comparison row. */
data class NFLCompareLookRow(
    val key: String,
    val label: String,
    /** Primary display value (ypt / epa_db / epa_rush). */
    val value: Double,
    val unit: String,
    /** Served delta vs career overall; null → compute `value - overall`. */
    val delta: Double?,
    /** Threshold for coloring the delta as meaningful. */
    val deltaThreshold: Double,
    val sample: String?,
    val pctile: Double?,
    /** Sample-size caption (targets / dropbacks / carries). */
    val detail: String,
    /** Support metrics line (QB: YPA/cmp/sack; RB: YPC/TD rate). */
    val support: String?,
)

data class NFLSchemeCompareResolved(
    val mode: NFLSchemeCompareMode,
    val overallLabel: String,
    val overallValue: Double?,
    val overallUnit: String,
    val overallDetail: String,
    val overallSupport: String?,
    val sample: String?,
    val lookRows: List<NFLCompareLookRow>,
    val emptyReason: EmptyReason,
) {
    enum class EmptyReason { NONE, ROOKIE, THIN, MISSING }

    val hasCompare: Boolean get() = overallValue != null && lookRows.isNotEmpty()
}

/** One "What {opp} actually plays" tile. */
data class NFLPropDefenseTile(
    val key: String,
    val label: String,
    val rate: Double,
    val pctile: Double,
)

/** One "Did he clear the line vs defenses like {opp}?" row. */
data class NFLPropLookHitEntry(
    val bucket: String,
    val record: NFLPropHitRate,
)

/** The one applicable per-game split worth showing. */
data class NFLPropGameSplitResolved(
    val entry: NFLPropGameSplitEntry,
    val overall: NFLPropGameSplitEntry,
    val statKey: String,
    val bucketLabels: List<String>,
)

object NFLPropSchemeCompare {
    // MARK: Label maps (ported from marketMap.ts)

    val coverageLabels: Map<String, String> = mapOf(
        "zone" to "vs Zone", "man" to "vs Man", "two_high" to "vs Two-high",
        "one_high" to "vs One-high", "pressure" to "vs Pressure", "blitz" to "vs Blitz",
    )

    val rushLookLabels: Map<String, String> = mapOf(
        "heavy_box" to "vs Heavy box", "neutral" to "vs Neutral box", "light_box" to "vs Light box",
    )

    val defenseLabels: Map<String, String> = mapOf(
        "man" to "Man coverage", "zone" to "Zone coverage", "two_high" to "Two-high shell",
        "pressure" to "Pressure", "blitz" to "Blitz", "heavy_box" to "Heavy box", "light_box" to "Light box",
    )

    val lookBucketLabels: Map<String, String> = mapOf(
        "zone_heavy" to "vs zone-heavy Ds", "man_heavy" to "vs man-heavy Ds",
        "two_high" to "vs two-high Ds", "two_high_heavy" to "vs two-high Ds",
        "single_high" to "vs single-high Ds", "heavy_box" to "vs heavy-box Ds",
        "light_box" to "vs light-box Ds", "blitz_heavy" to "vs blitz-heavy Ds",
    )

    val gameSplitBucketLabels: Map<String, String> = mapOf(
        "zone_heavy" to "zone-heavy", "man_heavy" to "man-heavy",
        "two_high_heavy" to "two-high", "single_high" to "single-high",
        "heavy_box" to "heavy box", "light_box" to "light box", "blitz_heavy" to "blitz-heavy",
    )

    /**
     * scheme_game_splits stat key per market (markets without one show no
     * per-game splits block — pass TDs and completions, per web).
     */
    val gameSplitStatForMarket: Map<String, String> = mapOf(
        "player_receptions" to "receptions",
        "player_reception_yds" to "rec_yds",
        "player_rush_yds" to "rush_yds",
        "player_rush_attempts" to "rush_att",
        "player_pass_yds" to "pass_yds",
        "player_pass_attempts" to "pass_att",
    )

    // MARK: Mode resolution

    private fun isRushMarket(key: String) =
        key == "player_rush_yds" || key == "player_rush_attempts"

    private fun isPassMarket(key: String) =
        key == "player_pass_yds" || key == "player_pass_tds" ||
            key == "player_pass_attempts" || key == "player_pass_completions"

    private fun isReceivingMarket(key: String) =
        key == "player_receptions" || key == "player_reception_yds"

    /**
     * Pick the layer from scheme.kind + market family. Order matters: the
     * rush-market check runs BEFORE the QB check, and ATD falls qb → rush →
     * receiving (mirrors the web `resolveCompareMode`).
     */
    fun resolveMode(page: NFLPropPlayerPage, marketKey: String): NFLSchemeCompareMode? {
        val kind = page.scheme?.kind
        if (isRushMarket(marketKey) && (kind == "rb" || page.scheme?.rushOverall != null)) {
            return NFLSchemeCompareMode.RUSH
        }
        if (isPassMarket(marketKey) && (kind == "qb" || page.position == "QB")) {
            return NFLSchemeCompareMode.QB
        }
        if (marketKey == "player_anytime_td") {
            if (kind == "qb" || page.position == "QB") return NFLSchemeCompareMode.QB
            if (kind == "rb" || page.scheme?.rushOverall != null) return NFLSchemeCompareMode.RUSH
            return NFLSchemeCompareMode.RECEIVING
        }
        if (isReceivingMarket(marketKey)) return NFLSchemeCompareMode.RECEIVING
        // Fallback: position-native layer when the market is odd.
        if (kind == "qb") return NFLSchemeCompareMode.QB
        if (kind == "rb" && page.scheme?.rushOverall != null) return NFLSchemeCompareMode.RUSH
        if (page.scheme?.playerOverall?.ypt != null) return NFLSchemeCompareMode.RECEIVING
        return null
    }

    // MARK: Compare resolution

    fun resolve(page: NFLPropPlayerPage, marketKey: String): NFLSchemeCompareResolved? {
        val mode = resolveMode(page, marketKey) ?: return null
        val scheme = page.scheme ?: return NFLSchemeCompareResolved(
            mode = mode, overallLabel = "Career", overallValue = null, overallUnit = "",
            overallDetail = "", overallSupport = null, sample = null, lookRows = emptyList(),
            emptyReason = if (page.rookie) NFLSchemeCompareResolved.EmptyReason.ROOKIE
            else NFLSchemeCompareResolved.EmptyReason.MISSING,
        )

        return when (mode) {
            NFLSchemeCompareMode.QB -> {
                // QB overall must carry both epa_db and dropbacks (isQbOverall).
                val overall = scheme.playerOverall
                    ?.takeIf { it.epaDb != null && it.dropbacks != null }
                val focus = scheme.lookFocus.ifEmpty { listOf("zone", "pressure") }
                val rows = focus.mapNotNull { key ->
                    val raw = scheme.playerSplits[key] ?: return@mapNotNull null
                    val dropbacks = raw.dropbacks?.takeIf { it >= 1 } ?: return@mapNotNull null
                    if (raw.insufficient) return@mapNotNull null
                    val value = raw.epaDb ?: return@mapNotNull null
                    NFLCompareLookRow(
                        key = key,
                        label = coverageLabels[key] ?: "vs $key",
                        value = value,
                        unit = "EPA/db",
                        delta = raw.deltaEpaDb,
                        deltaThreshold = 0.04,
                        sample = raw.sample,
                        pctile = raw.pctile,
                        detail = "$dropbacks db",
                        support = qbSupport(raw.ypa, raw.compPct, raw.sackRate),
                    )
                }
                NFLSchemeCompareResolved(
                    mode = mode,
                    overallLabel = "Career EPA/db",
                    overallValue = overall?.epaDb,
                    overallUnit = "EPA/db",
                    overallDetail = overall?.dropbacks?.let { "$it dropbacks" } ?: "",
                    overallSupport = overall?.let { qbSupport(it.ypa, it.compPct, it.sackRate) },
                    sample = overall?.sample,
                    lookRows = rows,
                    emptyReason = emptyReason(rows.isEmpty(), overall, page.rookie, thinDefault = false),
                )
            }

            NFLSchemeCompareMode.RUSH -> {
                val overall = scheme.rushOverall
                    ?.takeIf { it.ypc != null && it.carries != null }
                val focus = scheme.rushLookFocus.ifEmpty { listOf("neutral") }
                val rows = focus.mapNotNull { key ->
                    val raw = scheme.rushSplits[key] ?: return@mapNotNull null
                    val carries = raw.carries?.takeIf { it >= 1 } ?: return@mapNotNull null
                    if (raw.insufficient) return@mapNotNull null
                    val value = raw.epaRush ?: return@mapNotNull null
                    NFLCompareLookRow(
                        key = key,
                        label = rushLookLabels[key] ?: "vs $key",
                        value = value,
                        unit = "EPA/rush",
                        delta = raw.deltaEpaRush,
                        deltaThreshold = 0.04,
                        sample = raw.sample,
                        pctile = raw.pctile,
                        detail = "$carries att",
                        support = rushSupport(raw.ypc, raw.tdRate),
                    )
                }
                NFLSchemeCompareResolved(
                    mode = mode,
                    overallLabel = "Career EPA/rush",
                    overallValue = overall?.epaRush,
                    overallUnit = "EPA/rush",
                    overallDetail = overall?.carries?.let { "$it att" } ?: "",
                    overallSupport = overall?.let { rushSupport(it.ypc, it.tdRate) },
                    sample = overall?.sample,
                    lookRows = rows,
                    emptyReason = emptyReason(rows.isEmpty(), overall, page.rookie, thinDefault = false),
                )
            }

            NFLSchemeCompareMode.RECEIVING -> {
                val overall = scheme.playerOverall?.takeIf { it.ypt != null }
                val focus = scheme.lookFocus.ifEmpty { listOf("zone", "man") }
                    .filter { it in setOf("zone", "man", "two_high", "one_high") }
                val rows = focus.mapNotNull { key ->
                    val raw = scheme.playerSplits[key] ?: return@mapNotNull null
                    val targets = raw.targets?.takeIf { it >= 1 } ?: return@mapNotNull null
                    if (raw.insufficient) return@mapNotNull null
                    val ypt = raw.ypt?.takeIf { it.isFinite() } ?: return@mapNotNull null
                    NFLCompareLookRow(
                        key = key,
                        label = coverageLabels[key] ?: "vs $key",
                        value = ypt,
                        unit = "ypt",
                        delta = raw.deltaYpt,
                        deltaThreshold = 0.35,
                        sample = raw.sample,
                        pctile = raw.pctile,
                        detail = "$targets tgt",
                        support = null,
                    )
                }
                NFLSchemeCompareResolved(
                    mode = mode,
                    overallLabel = "Career ypt",
                    overallValue = overall?.ypt,
                    overallUnit = "ypt",
                    overallDetail = overall?.targets?.let { "all coverages · $it tgt" } ?: "",
                    overallSupport = null,
                    sample = overall?.sample,
                    lookRows = rows,
                    emptyReason = emptyReason(rows.isEmpty(), overall, page.rookie, thinDefault = true),
                )
            }
        }
    }

    private fun emptyReason(
        rowsEmpty: Boolean,
        overall: NFLPropSchemeSplit?,
        rookie: Boolean,
        thinDefault: Boolean,
    ): NFLSchemeCompareResolved.EmptyReason = when {
        !rowsEmpty -> NFLSchemeCompareResolved.EmptyReason.NONE
        overall == null && rookie -> NFLSchemeCompareResolved.EmptyReason.ROOKIE
        overall == null -> if (thinDefault) NFLSchemeCompareResolved.EmptyReason.THIN
        else NFLSchemeCompareResolved.EmptyReason.MISSING
        thinDefault -> NFLSchemeCompareResolved.EmptyReason.THIN
        overall.sample == "thin" -> NFLSchemeCompareResolved.EmptyReason.THIN
        else -> NFLSchemeCompareResolved.EmptyReason.MISSING
    }

    private fun qbSupport(ypa: Double?, compPct: Double?, sackRate: Double?): String =
        "YPA ${NFLPropFormat.perGame(ypa, 1)} · ${NFLPropFormat.ratePct(compPct)} cmp · ${NFLPropFormat.ratePct(sackRate)} sack"

    private fun rushSupport(ypc: Double?, tdRate: Double?): String {
        var out = "YPC ${NFLPropFormat.perGame(ypc, 1)}"
        if (tdRate != null) out += " · TD ${NFLPropFormat.ratePct(tdRate)}"
        return out
    }

    // MARK: Defense tiles ("What {opp} actually plays")

    /**
     * Tiles mirror the opponent's look_focus, NOT a static per-market list.
     * `zone` is synthesized as the complement of the served man rate;
     * `one_high` reuses the two-high axis relabeled "Single-high shell";
     * `neutral` yields nothing. Empty focus falls back to extreme dims
     * (pctile ≥60 or ≤40).
     */
    fun defenseTiles(page: NFLPropPlayerPage, mode: NFLSchemeCompareMode?): List<NFLPropDefenseTile> {
        val scheme = page.scheme ?: return emptyList()
        val defense = scheme.defense ?: return emptyList()

        val focusKeys = if (mode == NFLSchemeCompareMode.RUSH) {
            scheme.rushLookFocus.ifEmpty { listOf("neutral") }
        } else {
            scheme.lookFocus
        }

        val ordered = mutableListOf<NFLPropDefenseTile>()
        fun push(key: String, label: String? = null, rate: Double? = null, pctile: Double? = null) {
            val resolvedLabel = label ?: defenseLabels[key] ?: key
            if (ordered.any { it.key == key && it.label == resolvedLabel }) return
            val dim = defense.dims[key]
            val r = rate ?: dim?.rate ?: return
            val p = pctile ?: dim?.pctile ?: return
            ordered.add(NFLPropDefenseTile(key = key, label = resolvedLabel, rate = r, pctile = p))
        }

        for (look in focusKeys) {
            when (look) {
                "zone" -> defense.dims["man"]?.let { man ->
                    push(
                        "zone",
                        rate = (1 - man.rate).coerceIn(0.0, 1.0),
                        pctile = (100 - man.pctile).coerceIn(0.0, 100.0),
                    )
                }
                "one_high" -> if (defense.dims["two_high"] != null) {
                    push("two_high", label = "Single-high shell")
                }
                "neutral" -> Unit
                else -> push(look)
            }
        }

        if (ordered.isEmpty()) {
            for (key in listOf("man", "two_high", "pressure", "blitz", "heavy_box", "light_box")) {
                val dim = defense.dims[key] ?: continue
                if (dim.pctile >= 60 || dim.pctile <= 40) {
                    ordered.add(
                        NFLPropDefenseTile(
                            key = key,
                            label = defenseLabels[key] ?: key,
                            rate = dim.rate,
                            pctile = dim.pctile,
                        ),
                    )
                }
            }
        }
        return ordered
    }

    // MARK: Game splits + look hit rates

    /**
     * The one applicable game-split entry worth showing: first bucket in
     * `applicable` order that is not insufficient with n ≥ 3, plus the
     * qualified bucket labels for the caption.
     */
    fun gameSplit(page: NFLPropPlayerPage, marketKey: String): NFLPropGameSplitResolved? {
        val statKey = gameSplitStatForMarket[marketKey] ?: return null
        val gs = page.schemeGameSplits ?: return null
        val overall = gs.overall ?: return null
        if (gs.applicable.isEmpty()) return null
        val qualified = gs.applicable.filter { bucket ->
            val e = gs.splits[bucket] ?: return@filter false
            !e.insufficient && (e.n ?: 0) >= 3
        }
        val firstBucket = qualified.firstOrNull() ?: return null
        val entry = gs.splits[firstBucket] ?: return null
        if (entry.stats[statKey] == null) return null
        return NFLPropGameSplitResolved(
            entry = entry,
            overall = overall,
            statKey = statKey,
            bucketLabels = qualified.map { gameSplitBucketLabels[it] ?: it },
        )
    }

    /** "Did he clear the line vs defenses like {opp}?" rows, gated n ≥ 3. */
    fun lookHitEntries(page: NFLPropPlayerPage, marketKey: String): List<NFLPropLookHitEntry> {
        val rates = page.scheme?.lookHitRates ?: return emptyList()
        return rates.mapNotNull { (bucket, byMarket) ->
            val rec = byMarket[marketKey] ?: return@mapNotNull null
            if (rec.n < 3) return@mapNotNull null
            NFLPropLookHitEntry(bucket = bucket, record = rec)
        }.sortedBy { it.bucket }
    }
}
