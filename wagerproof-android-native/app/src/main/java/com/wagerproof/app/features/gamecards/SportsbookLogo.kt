package com.wagerproof.app.features.gamecards

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Text
import com.wagerproof.app.features.shared.RemoteImage
import com.wagerproof.core.design.tokens.AppColors
import java.util.Locale

/** Sportsbook key → domain map for favicon fallback (port of iOS resolver). */
object SportsbookDomainResolver {
    private val domains = mapOf(
        "draftkings" to "draftkings.com",
        "fanduel" to "fanduel.com",
        "betmgm" to "betmgm.com",
        "betrivers" to "betrivers.com",
        "williamhill_us" to "caesars.com",
        "caesars" to "caesars.com",
        "espnbet" to "espnbet.com",
        "fanatics" to "fanatics.com",
        "bet365" to "bet365.com",
        "bovada" to "bovada.lv",
        "betonlineag" to "betonline.ag",
        "mybookieag" to "mybookie.ag",
        "betus" to "betus.com.pa",
        "lowvig" to "lowvig.ag",
        "pointsbetus" to "pointsbet.com",
        "unibet" to "unibet.com",
        "foxbet" to "foxbet.com",
        "hardrockbet" to "hardrock.bet",
        "wynnbet" to "wynnbet.com",
    )

    fun fallbackURL(key: String, logoURL: String?): String? {
        val norm = key.lowercase(Locale.US).replace(" ", "").replace("_", "")
        val domain = domains[key.lowercase(Locale.US)]
            ?: domains.entries.firstOrNull { norm.contains(it.key) }?.value
        if (domain != null) return "https://icons.duckduckgo.com/ip3/$domain.ico"
        return logoURL
    }
}

enum class SportsbookLogoStyle(val img: androidx.compose.ui.unit.Dp, val frame: androidx.compose.ui.unit.Dp, val radius: androidx.compose.ui.unit.Dp) {
    COMPACT(18.dp, 22.dp, 5.dp),
    REGULAR(30.dp, 38.dp, 8.dp),
}

/** Book logo badge with favicon fallback → letter chip. Port of `SportsbookLogoView.swift`. */
@Composable
fun SportsbookLogoView(
    bookKey: String,
    logoURL: String?,
    style: SportsbookLogoStyle = SportsbookLogoStyle.REGULAR,
    modifier: Modifier = Modifier,
) {
    val url = logoURL ?: SportsbookDomainResolver.fallbackURL(bookKey, logoURL)
    Box(
        modifier.size(style.frame).clip(RoundedCornerShape(style.radius)).background(AppColors.appSurfaceMuted),
        contentAlignment = Alignment.Center,
    ) {
        RemoteImage(
            url = url,
            contentDescription = bookKey,
            modifier = Modifier.size(style.img),
            error = {
                Text(
                    bookKey.take(1).uppercase(Locale.US),
                    color = AppColors.appTextPrimary, fontWeight = FontWeight.Black, fontSize = (style.img.value * 0.6f).sp,
                )
            },
        )
    }
}
