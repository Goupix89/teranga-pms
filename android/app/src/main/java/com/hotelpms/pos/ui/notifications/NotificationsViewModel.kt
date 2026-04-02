package com.hotelpms.pos.ui.notifications

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.remote.OrderSyncService
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.Notification
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.launch
import javax.inject.Inject

data class NotificationsUiState(
    val isLoading: Boolean = false,
    val notifications: List<Notification> = emptyList(),
    val unreadCount: Int = 0,
    val error: String? = null
)

@HiltViewModel
class NotificationsViewModel @Inject constructor(
    private val apiService: PmsApiService,
    private val orderSyncService: OrderSyncService
) : ViewModel() {

    var uiState by mutableStateOf(NotificationsUiState())
        private set

    init {
        fetchNotifications()
        orderSyncService.connect()
        orderSyncService.orderEvents
            .onEach { event ->
                if (event == "NOTIFICATION") {
                    fetchNotifications()
                }
            }
            .launchIn(viewModelScope)
    }

    fun fetchNotifications() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)
            try {
                val response = apiService.getNotifications()
                if (response.isSuccessful && response.body() != null) {
                    val body = response.body()!!
                    uiState = uiState.copy(
                        isLoading = false,
                        notifications = body.data,
                        unreadCount = body.unreadCount ?: 0
                    )
                } else {
                    uiState = uiState.copy(isLoading = false, error = "Erreur chargement")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur reseau")
            }
        }
    }

    fun markAsRead(notificationId: String) {
        viewModelScope.launch {
            try {
                apiService.markNotificationRead(notificationId)
                uiState = uiState.copy(
                    notifications = uiState.notifications.map {
                        if (it.id == notificationId) it.copy(isRead = true) else it
                    },
                    unreadCount = (uiState.unreadCount - 1).coerceAtLeast(0)
                )
            } catch (_: Exception) { }
        }
    }

    fun markAllAsRead() {
        viewModelScope.launch {
            try {
                apiService.markAllNotificationsRead()
                uiState = uiState.copy(
                    notifications = uiState.notifications.map { it.copy(isRead = true) },
                    unreadCount = 0
                )
            } catch (_: Exception) { }
        }
    }

    fun clearError() {
        uiState = uiState.copy(error = null)
    }
}
