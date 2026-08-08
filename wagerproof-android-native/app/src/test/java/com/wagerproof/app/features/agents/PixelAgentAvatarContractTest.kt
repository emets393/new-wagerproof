package com.wagerproof.app.features.agents

import androidx.compose.ui.unit.dp
import com.wagerproof.app.features.agents.components.AgentAvatarPortraitSizeFraction
import com.wagerproof.app.features.agents.components.AgentAvatarPortraitYOffsetFraction
import com.wagerproof.app.features.onboarding.pages.AgentIdentitySpriteHeight
import com.wagerproof.app.features.onboarding.pages.AgentIdentitySpriteWidth
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.math.abs

class PixelAgentAvatarContractTest {
    @Test
    fun onboardingAndInAppBuilderUseTheIosCharacterFrame() {
        assertEquals(42.dp, AgentIdentitySpriteWidth)
        assertEquals(56.dp, AgentIdentitySpriteHeight)
        assertTrue(AgentIdentitySpriteWidth.value > 0f)
        assertTrue(AgentIdentitySpriteHeight.value > 0f)
    }

    @Test
    fun overlappingGameAvatarsHaveTwoDimensionalPortraitBounds() {
        val gameCardDiameter = 20.dp

        assertTrue(abs((gameCardDiameter * AgentAvatarPortraitSizeFraction).value - 17.2f) < 0.001f)
        assertTrue(abs((gameCardDiameter * AgentAvatarPortraitYOffsetFraction).value - 2.4f) < 0.001f)
    }
}
