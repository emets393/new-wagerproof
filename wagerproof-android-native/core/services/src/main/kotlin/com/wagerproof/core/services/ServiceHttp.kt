package com.wagerproof.core.services

import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient

/**
 * Shared OkHttp client for the raw HTTP paths that bypass supabase-kt
 * (edge-function invokes, SSE chat streams, Realtime voice WebSocket).
 * Streams can run for minutes — readTimeout mirrors iOS's 600s resource
 * timeout; connect/write mirror the 60s request timeout.
 */
object ServiceHttp {
    val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .readTimeout(600, TimeUnit.SECONDS)
            .build()
    }
}
