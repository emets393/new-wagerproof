package com.wagerproof.core.design.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.wagerproof.core.design.R

/** Canonical WagerProof shield asset for auth, tickets, and share surfaces. */
@Composable
fun WagerproofShield(
    modifier: Modifier = Modifier,
    size: Dp = 24.dp,
) {
    Image(
        painter = painterResource(R.drawable.wagerproof_logo),
        contentDescription = null,
        modifier = modifier.size(size),
        contentScale = ContentScale.Fit,
    )
}
