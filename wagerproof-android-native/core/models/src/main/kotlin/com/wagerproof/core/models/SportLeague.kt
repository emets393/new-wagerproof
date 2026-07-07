package com.wagerproof.core.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Global sport enum (iOS `SportLeague`). Wire values are the lowercase raws. */
@Serializable
enum class SportLeague(val raw: String) {
    @SerialName("nfl") NFL("nfl"),
    @SerialName("cfb") CFB("cfb"),
    @SerialName("nba") NBA("nba"),
    @SerialName("ncaab") NCAAB("ncaab"),
    @SerialName("mlb") MLB("mlb");

    val displayName: String
        get() = when (this) {
            NFL -> "NFL"
            CFB -> "College Football"
            NBA -> "NBA"
            NCAAB -> "College Basketball"
            MLB -> "MLB"
        }

    // iOS SF Symbol name, kept for cross-platform parity; Android maps it to its own icon resource.
    val sfSymbol: String
        get() = when (this) {
            NFL, CFB -> "football.fill"
            NBA, NCAAB -> "basketball.fill"
            MLB -> "baseball.fill"
        }
}
