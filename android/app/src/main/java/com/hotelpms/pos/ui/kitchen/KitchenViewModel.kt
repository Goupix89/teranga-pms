package com.hotelpms.pos.ui.kitchen

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.local.TokenManager
import com.hotelpms.pos.data.remote.OrderSyncService
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.Order
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class KitchenUiState(
    val orders: List<Order> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
) {
    val pendingOrders: List<Order>
        get() = orders.filter { it.status == "PENDING" }

    val inProgressOrders: List<Order>
        get() = orders.filter { it.status == "IN_PROGRESS" }

    val readyOrders: List<Order>
        get() = orders.filter { it.status == "READY" }
}

@HiltViewModel
class KitchenViewModel @Inject constructor(
    private val apiService: PmsApiService,
    private val tokenManager: TokenManager,
    private val orderSyncService: OrderSyncService
) : ViewModel() {

    var uiState by mutableStateOf(KitchenUiState())
        private set

    init {
        fetchOrders()
        startRealtimeSync()
    }

    private fun startRealtimeSync() {
        orderSyncService.connect()
        orderSyncService.orderEvents
            .onEach { event ->
                if (event == "ORDER_UPDATE") {
                    fetchOrders()
                }
            }
            .launchIn(viewModelScope)

        // Polling every 5s for reliable instant updates
        viewModelScope.launch {
            while (isActive) {
                delay(5000)
                try { fetchOrders() } catch (_: Exception) { }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        orderSyncService.disconnect()
    }

    fun fetchOrders() {
        val establishmentId = tokenManager.establishmentId ?: return

        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)
            try {
                val response = apiService.getKitchenOrders(establishmentId)
                if (response.isSuccessful) {
                    uiState = uiState.copy(
                        orders = response.body() ?: emptyList(),
                        isLoading = false
                    )
                } else {
                    // Fallback: fetch all orders and filter client-side
                    fetchOrdersFallback()
                }
            } catch (e: Exception) {
                // Fallback on network error for kitchen endpoint
                try {
                    fetchOrdersFallback()
                } catch (e2: Exception) {
                    uiState = uiState.copy(
                        isLoading = false,
                        error = e2.message ?: "Erreur de chargement des commandes"
                    )
                }
            }
        }
    }

    private suspend fun fetchOrdersFallback() {
        val response = apiService.getOrders()
        val allOrders = response.data
        val kitchenOrders = allOrders.filter {
            it.status in listOf("PENDING", "IN_PROGRESS", "READY")
        }
        uiState = uiState.copy(
            orders = kitchenOrders,
            isLoading = false
        )
    }

    fun updateOrderStatus(orderId: String, newStatus: String) {
        viewModelScope.launch {
            try {
                apiService.updateOrderStatus(
                    id = orderId,
                    body = com.hotelpms.pos.domain.model.OrderStatusRequest(status = newStatus)
                )
                fetchOrders()
            } catch (e: Exception) {
                uiState = uiState.copy(
                    error = e.message ?: "Erreur lors de la mise a jour"
                )
            }
        }
    }

    fun clearError() {
        uiState = uiState.copy(error = null)
    }
}
