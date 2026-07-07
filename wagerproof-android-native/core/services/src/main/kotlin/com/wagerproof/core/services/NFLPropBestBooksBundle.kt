package com.wagerproof.core.services

import com.wagerproof.core.models.serialization.WagerproofJson
import com.wagerproof.core.shared.AppGroup
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Backend-precomputed best-shop fields keyed by `player_id|market`.
 * Shipped in the app assets until `nfl_dryrun_props` carries these columns.
 */
@Serializable
internal data class NFLPropBestBooksRecord(
    @SerialName("best_over_book") val bestOverBook: String? = null,
    @SerialName("best_over_book_name") val bestOverBookName: String? = null,
    @SerialName("best_over_book_logo") val bestOverBookLogo: String? = null,
    @SerialName("best_over_line") val bestOverLine: Double? = null,
    @SerialName("best_over_price") val bestOverPrice: Double? = null,
    @SerialName("best_under_book") val bestUnderBook: String? = null,
    @SerialName("best_under_book_name") val bestUnderBookName: String? = null,
    @SerialName("best_under_book_logo") val bestUnderBookLogo: String? = null,
    @SerialName("best_under_line") val bestUnderLine: Double? = null,
    @SerialName("best_under_price") val bestUnderPrice: Double? = null,
)

internal object NFLPropBestBooksBundle {

    /** Lazy so the assets read happens off the class-load path; failure → empty index. */
    val index: Map<String, NFLPropBestBooksRecord> by lazy { load() }

    private fun load(): Map<String, NFLPropBestBooksRecord> = runCatching {
        AppGroup.context.assets
            .open("nfl_dryrun_prop_best_books.json")
            .use { it.readBytes().decodeToString() }
            .let { WagerproofJson.decodeFromString<Map<String, NFLPropBestBooksRecord>>(it) }
    }.getOrDefault(emptyMap())
}
