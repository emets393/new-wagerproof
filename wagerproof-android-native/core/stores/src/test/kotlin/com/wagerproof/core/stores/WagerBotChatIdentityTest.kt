package com.wagerproof.core.stores

import com.wagerproof.core.models.WagerBotMessage
import com.wagerproof.core.models.WagerBotThreadSummary
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class WagerBotChatIdentityTest {

    @Test
    fun accountChangeClearsEveryUserScopedValue() = runBlocking {
        val loadedMessage = WagerBotMessage.user("account-a secret", TEST_TIMESTAMP)
        val summary = threadSummary("thread-a")
        val store = WagerBotChatStore(
            listThreads = { listOf(summary) },
            loadMessages = { listOf(loadedMessage) },
            deleteThreadRemote = { error("delete failed") },
        )

        store.bind("user-a")
        store.loadThread(summary)
        store.refreshHistory("user-a")
        store.draft = "account-a draft"
        store.deleteThread("not-the-active-thread")

        assertTrue(store.messages.isNotEmpty())
        assertTrue(store.threads.isNotEmpty())
        assertTrue(store.lastError != null)

        store.bind("user-b")

        assertEquals("user-b", store.boundUserId)
        assertTrue(store.messages.isEmpty())
        assertNull(store.threadId)
        assertNull(store.threadTitle)
        assertTrue(store.threads.isEmpty())
        assertEquals(WagerBotChatStore.HistoryLoadState.Idle, store.historyLoadState)
        assertEquals("", store.draft)
        assertNull(store.lastError)
        assertFalse(store.isStreaming)
    }

    @Test
    fun bindingTheSameUserPreservesHydratedStateAndDraft() = runBlocking {
        val loadedMessage = WagerBotMessage.user("keep me", TEST_TIMESTAMP)
        val summary = threadSummary("thread-a")
        val store = WagerBotChatStore(
            listThreads = { listOf(summary) },
            loadMessages = { listOf(loadedMessage) },
        )

        store.bind("user-a")
        store.loadThread(summary)
        store.refreshHistory("user-a")
        store.draft = "unfinished thought"

        store.bind("user-a")

        assertEquals(listOf(loadedMessage), store.messages)
        assertEquals(summary.id, store.threadId)
        assertEquals(summary.title, store.threadTitle)
        assertEquals(listOf(summary), store.threads)
        assertEquals(WagerBotChatStore.HistoryLoadState.Loaded, store.historyLoadState)
        assertEquals("unfinished thought", store.draft)
    }

    @Test
    fun historyCompletionFromPreviousAccountCannotPublish() = runBlocking {
        val started = CompletableDeferred<Unit>()
        val response = CompletableDeferred<List<WagerBotThreadSummary>>()
        val store = WagerBotChatStore(
            listThreads = {
                started.complete(Unit)
                response.await()
            },
        )
        store.bind("user-a")

        val refresh = launch { store.refreshHistory("user-a") }
        started.await()
        store.bind("user-b")
        response.complete(listOf(threadSummary("thread-a")))
        refresh.join()

        assertEquals("user-b", store.boundUserId)
        assertTrue(store.threads.isEmpty())
        assertEquals(WagerBotChatStore.HistoryLoadState.Idle, store.historyLoadState)
    }

    @Test
    fun threadCompletionFromPreviousAccountCannotPublish() = runBlocking {
        val started = CompletableDeferred<Unit>()
        val response = CompletableDeferred<List<WagerBotMessage>>()
        val store = WagerBotChatStore(
            loadMessages = {
                started.complete(Unit)
                response.await()
            },
        )
        store.bind("user-a")

        val load = launch { store.loadThread(threadSummary("thread-a")) }
        started.await()
        store.bind("user-b")
        response.complete(listOf(WagerBotMessage.user("account-a secret", TEST_TIMESTAMP)))
        load.join()

        assertEquals("user-b", store.boundUserId)
        assertTrue(store.messages.isEmpty())
        assertNull(store.threadId)
        assertNull(store.threadTitle)
    }

    @Test
    fun cancellationFromHistoryFetchPropagatesToCaller() = runBlocking {
        val store = WagerBotChatStore(
            listThreads = { throw CancellationException("cancelled") },
        )
        store.bind("user-a")

        assertFailsWith<CancellationException> {
            store.refreshHistory("user-a")
        }
        Unit
    }

    private fun threadSummary(id: String) = WagerBotThreadSummary(
        id = id,
        title = "Account A thread",
        createdAt = TEST_TIMESTAMP,
    )

    private companion object {
        const val TEST_TIMESTAMP = "2026-08-01T00:00:00.000Z"
    }
}
