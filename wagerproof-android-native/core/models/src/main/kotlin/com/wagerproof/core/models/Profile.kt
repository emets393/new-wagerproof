package com.wagerproof.core.models

import com.wagerproof.core.models.serialization.LenientInstantSerializer
import kotlin.time.Instant
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * `user_profiles`/`profiles` row. `id` is a UUID on iOS — kept as String on
 * the JVM for parity (validation happens server-side). `isAdmin` has no
 * default on purpose: a missing `is_admin` column must fail decode, exactly
 * like Swift's non-optional Bool.
 */
@Serializable
data class Profile(
    val id: String,
    val email: String? = null,
    @SerialName("display_name") val displayName: String? = null,
    val username: String? = null,
    @SerialName("avatar_url") val avatarUrl: String? = null,
    @SerialName("is_admin") val isAdmin: Boolean,
    // The only real date type in the module — everything else keeps ISO strings.
    @SerialName("created_at")
    @Serializable(with = LenientInstantSerializer::class)
    val createdAt: Instant? = null,
)
