package com.wagerproof.core.services

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class AuthServiceDeletionResponseTest {
    @Test
    fun acceptsConfirmedSuccessfulDeletion() {
        AuthService.requireSuccessfulAccountDeletion(
            EdgeFunctions.EdgeResponse(status = 200, body = "{\"success\":true}"),
        )
    }

    @Test
    fun surfacesServerErrorAndStatus() {
        val failure = assertFailsWith<AuthService.AccountDeletionException.Server> {
            AuthService.requireSuccessfulAccountDeletion(
                EdgeFunctions.EdgeResponse(status = 409, body = "{\"success\":false,\"error\":\"Deletion blocked\"}"),
            )
        }
        assertEquals(409, failure.statusCode)
        assertEquals("Deletion blocked", failure.message)
    }

    @Test
    fun rejectsMalformedSuccessfulResponse() {
        val failure = assertFailsWith<AuthService.AccountDeletionException.MalformedResponse> {
            AuthService.requireSuccessfulAccountDeletion(
                EdgeFunctions.EdgeResponse(status = 200, body = "not-json"),
            )
        }
        assertEquals(200, failure.statusCode)
    }
}
