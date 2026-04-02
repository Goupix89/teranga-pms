package com.hotelpms.pos.data.remote

import com.hotelpms.pos.BuildConfig
import com.hotelpms.pos.data.local.TokenManager
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import okhttp3.*
import okhttp3.sse.EventSource
import okhttp3.sse.EventSourceListener
import okhttp3.sse.EventSources
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * SSE-based real-time sync service for orders.
 * Connects to /api/notifications/stream and emits events
 * when order/kitchen-related notifications arrive.
 */
@Singleton
class OrderSyncService @Inject constructor(
    private val tokenManager: TokenManager
) {
    private val _orderEvents = MutableSharedFlow<String>(extraBufferCapacity = 10)
    val orderEvents: SharedFlow<String> = _orderEvents.asSharedFlow()

    private var eventSource: EventSource? = null
    private var reconnectJob: Job? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val sseClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.SECONDS) // no read timeout for SSE
        .writeTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    fun connect() {
        disconnect()
        val token = tokenManager.accessToken ?: return
        val baseUrl = BuildConfig.API_BASE_URL.trimEnd('/')

        val request = Request.Builder()
            .url("$baseUrl/api/notifications/stream")
            .header("Authorization", "Bearer $token")
            .header("Accept", "text/event-stream")
            .build()

        val factory = EventSources.createFactory(sseClient)
        eventSource = factory.newEventSource(request, object : EventSourceListener() {
            override fun onEvent(eventSource: EventSource, id: String?, type: String?, data: String) {
                // Check if this is an order-related notification
                if (data.contains("ORDER", ignoreCase = true) ||
                    data.contains("KITCHEN", ignoreCase = true) ||
                    data.contains("order", ignoreCase = false) ||
                    data.contains("commande", ignoreCase = true)
                ) {
                    _orderEvents.tryEmit("ORDER_UPDATE")
                }
                // Also emit for any notification so the notification screen can refresh
                _orderEvents.tryEmit("NOTIFICATION")
            }

            override fun onFailure(eventSource: EventSource, t: Throwable?, response: Response?) {
                // Auto-reconnect after 5 seconds
                scheduleReconnect()
            }

            override fun onClosed(eventSource: EventSource) {
                scheduleReconnect()
            }
        })
    }

    fun disconnect() {
        reconnectJob?.cancel()
        eventSource?.cancel()
        eventSource = null
    }

    private fun scheduleReconnect() {
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(5000)
            if (tokenManager.isLoggedIn) {
                connect()
            }
        }
    }
}
