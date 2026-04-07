package com.hotelpms.pos.ui.dashboard

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.local.TokenManager
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.DashboardStats
import com.hotelpms.pos.domain.model.Order
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DashboardUiState(
    val stats: DashboardStats = DashboardStats(),
    val userRole: String = "",
    val userName: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    // Additional financial stats for DAF
    val monthlyRevenue: Double = 0.0,
    val stockMovementsCount: Int = 0,
    val invoicesCount: Int = 0,
    // Server stats
    val myOrdersCount: Int = 0,
    val readyToServeCount: Int = 0,
    val myDailyTotal: Double = 0.0,
    // Cleaner stats
    val todaySessionsCount: Int = 0,
    val averageDuration: Int = 0,
    // Cook stats
    val preparingCount: Int = 0,
    val readyCount: Int = 0,
    // Order lists for Server / MAITRE_HOTEL dashboards
    val myRecentOrders: List<Order> = emptyList(),
    val allOrders: List<Order> = emptyList(),
    // Per-server breakdown (name → count, revenue)
    val serverBreakdown: List<ServerOrderSummary> = emptyList()
)

data class ServerOrderSummary(
    val serverName: String,
    val orderCount: Int,
    val revenue: Double,
    val pendingCount: Int,
    val readyCount: Int
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val api: PmsApiService,
    private val tokenManager: TokenManager
) : ViewModel() {

    var uiState by mutableStateOf(DashboardUiState())
        private set

    private val establishmentId: String
        get() = tokenManager.establishmentId ?: ""

    init {
        uiState = uiState.copy(
            userRole = tokenManager.establishmentRole ?: "",
            userName = tokenManager.userName ?: ""
        )
        fetchStats()
    }

    fun fetchStats() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)
            try {
                // Wait for establishment role to be available (set by AuthViewModel.fetchEstablishments)
                var role = tokenManager.establishmentRole ?: ""
                if (role.isBlank()) {
                    // Retry up to 3 times with delay — fetchEstablishments runs async
                    for (i in 1..3) {
                        delay(500L * i)
                        role = tokenManager.establishmentRole ?: ""
                        if (role.isNotBlank()) break
                    }
                }
                // Final fallback
                if (role.isBlank()) role = tokenManager.userRole ?: ""

                uiState = uiState.copy(userRole = role.uppercase())

                when (role.uppercase()) {
                    "MANAGER", "DAF", "OWNER" -> fetchManagerStats(role.uppercase())
                    "MAITRE_HOTEL" -> fetchMaitreHotelStats()
                    "COOK" -> fetchCookStats()
                    "CLEANER" -> fetchCleanerStats()
                    "SERVER" -> fetchServerStats()
                    else -> fetchManagerStats(role.uppercase())
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de chargement")
            }
        }
    }

    private suspend fun fetchManagerStats(role: String) {
        val roomsDeferred = viewModelScope.async {
            try { api.getRooms(establishmentId) } catch (e: Exception) { null }
        }
        val ordersDeferred = viewModelScope.async {
            try { api.getOrders(establishmentId) } catch (e: Exception) { null }
        }
        val reservationsDeferred = viewModelScope.async {
            try { api.getReservations(establishmentId) } catch (e: Exception) { null }
        }
        val approvalsDeferred = viewModelScope.async {
            try { api.getApprovals(establishmentId) } catch (e: Exception) { null }
        }

        val rooms = roomsDeferred.await()
        val orders = ordersDeferred.await()
        val reservations = reservationsDeferred.await()
        val approvals = approvalsDeferred.await()

        val roomList = rooms?.data ?: emptyList()
        val orderList = orders?.data ?: emptyList()
        val approvalList = approvals?.data ?: emptyList()

        val stats = DashboardStats(
            totalRooms = roomList.size,
            availableRooms = roomList.count { it.status == "AVAILABLE" },
            occupiedRooms = roomList.count { it.status == "OCCUPIED" },
            cleaningRooms = roomList.count { it.status == "CLEANING" },
            todayOrders = orderList.size,
            pendingOrders = orderList.count { it.status == "PENDING" },
            todayRevenue = orderList.sumOf { it.totalAmount },
            pendingApprovals = approvalList.count { it.status == "PENDING" }
        )

        var monthlyRevenue = 0.0
        var stockMovementsCount = 0
        if (role in listOf("DAF", "OWNER")) {
            try {
                val stockMovements = api.getStockMovements(establishmentId)
                stockMovementsCount = stockMovements.data.size
            } catch (_: Exception) {}
            monthlyRevenue = orderList.sumOf { it.totalAmount }
        }

        uiState = uiState.copy(
            stats = stats,
            isLoading = false,
            monthlyRevenue = monthlyRevenue,
            stockMovementsCount = stockMovementsCount,
            invoicesCount = orderList.size
        )
    }

    private suspend fun fetchCookStats() {
        try {
            val orders = api.getOrders(establishmentId)
            val orderList = orders.data
            uiState = uiState.copy(
                stats = DashboardStats(
                    pendingOrders = orderList.count { it.status == "PENDING" },
                    todayOrders = orderList.size
                ),
                preparingCount = orderList.count { it.status == "PREPARING" },
                readyCount = orderList.count { it.status == "READY" },
                isLoading = false
            )
        } catch (e: Exception) {
            uiState = uiState.copy(isLoading = false, error = e.message)
        }
    }

    private suspend fun fetchCleanerStats() {
        try {
            val roomsDeferred = viewModelScope.async {
                try { api.getRooms(establishmentId) } catch (e: Exception) { null }
            }
            val sessionsDeferred = viewModelScope.async {
                try { api.getCleaningSessions(establishmentId) } catch (e: Exception) { null }
            }

            val rooms = roomsDeferred.await()
            val sessions = sessionsDeferred.await()

            val roomList = rooms?.data ?: emptyList()
            val sessionList = sessions?.data ?: emptyList()
            val mySessions = sessionList.filter { it.cleanerId == tokenManager.userId }
            val completedSessions = mySessions.filter { it.clockOutAt != null }
            val avgDuration = if (completedSessions.isNotEmpty()) {
                completedSessions.mapNotNull { it.durationMinutes }.average().toInt()
            } else 0

            uiState = uiState.copy(
                stats = DashboardStats(
                    cleaningRooms = roomList.count { it.status == "CLEANING" },
                    availableRooms = roomList.count { it.status == "AVAILABLE" },
                    occupiedRooms = roomList.count { it.status == "OCCUPIED" },
                    activeSessions = mySessions.count { it.clockOutAt == null }
                ),
                todaySessionsCount = mySessions.size,
                averageDuration = avgDuration,
                isLoading = false
            )
        } catch (e: Exception) {
            uiState = uiState.copy(isLoading = false, error = e.message)
        }
    }

    private suspend fun fetchServerStats() {
        try {
            val ordersDeferred = viewModelScope.async {
                try { api.getOrders(establishmentId) } catch (_: Exception) { null }
            }
            val roomsDeferred = viewModelScope.async {
                try { api.getRooms(establishmentId) } catch (_: Exception) { null }
            }

            val orders = ordersDeferred.await()
            val rooms = roomsDeferred.await()

            val orderList = orders?.data ?: emptyList()
            val roomList = rooms?.data ?: emptyList()
            val myOrders = orderList.filter { it.createdBy?.id == tokenManager.userId }

            uiState = uiState.copy(
                myOrdersCount = myOrders.size,
                readyToServeCount = orderList.count { it.status == "READY" },
                myDailyTotal = myOrders.sumOf { it.totalAmount },
                myRecentOrders = myOrders.sortedByDescending { it.createdAt }.take(10),
                allOrders = orderList,
                stats = DashboardStats(
                    pendingOrders = orderList.count { it.status == "PENDING" },
                    todayOrders = orderList.size,
                    availableRooms = roomList.count { it.status == "AVAILABLE" },
                    occupiedRooms = roomList.count { it.status == "OCCUPIED" },
                    cleaningRooms = roomList.count { it.status == "CLEANING" },
                    totalRooms = roomList.size
                ),
                isLoading = false
            )
        } catch (e: Exception) {
            uiState = uiState.copy(isLoading = false, error = e.message)
        }
    }

    private suspend fun fetchMaitreHotelStats() {
        try {
            val ordersDeferred = viewModelScope.async {
                try { api.getOrders(establishmentId) } catch (_: Exception) { null }
            }
            val roomsDeferred = viewModelScope.async {
                try { api.getRooms(establishmentId) } catch (_: Exception) { null }
            }

            val orders = ordersDeferred.await()
            val rooms = roomsDeferred.await()

            val orderList = orders?.data ?: emptyList()
            val roomList = rooms?.data ?: emptyList()
            val myOrders = orderList.filter { it.createdBy?.id == tokenManager.userId }

            // Per-server breakdown
            val byServer = orderList.groupBy { it.createdBy?.id ?: "unknown" }
            val serverBreakdown = byServer.map { (_, serverOrders) ->
                val name = serverOrders.firstOrNull()?.createdBy?.let { "${it.firstName} ${it.lastName}" } ?: "Inconnu"
                ServerOrderSummary(
                    serverName = name,
                    orderCount = serverOrders.size,
                    revenue = serverOrders.sumOf { it.totalAmount },
                    pendingCount = serverOrders.count { it.status == "PENDING" || it.status == "IN_PROGRESS" },
                    readyCount = serverOrders.count { it.status == "READY" }
                )
            }.sortedByDescending { it.orderCount }

            uiState = uiState.copy(
                myOrdersCount = myOrders.size,
                readyToServeCount = orderList.count { it.status == "READY" },
                myDailyTotal = myOrders.sumOf { it.totalAmount },
                myRecentOrders = myOrders.sortedByDescending { it.createdAt }.take(10),
                allOrders = orderList,
                serverBreakdown = serverBreakdown,
                stats = DashboardStats(
                    pendingOrders = orderList.count { it.status == "PENDING" },
                    todayOrders = orderList.size,
                    todayRevenue = orderList.sumOf { it.totalAmount },
                    availableRooms = roomList.count { it.status == "AVAILABLE" },
                    occupiedRooms = roomList.count { it.status == "OCCUPIED" },
                    cleaningRooms = roomList.count { it.status == "CLEANING" },
                    totalRooms = roomList.size
                ),
                isLoading = false
            )
        } catch (e: Exception) {
            uiState = uiState.copy(isLoading = false, error = e.message)
        }
    }

    fun setRole(role: String) {
        uiState = uiState.copy(userRole = role)
        fetchStats()
    }

    fun clearError() {
        uiState = uiState.copy(error = null)
    }
}
