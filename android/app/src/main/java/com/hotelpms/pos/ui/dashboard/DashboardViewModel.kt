package com.hotelpms.pos.ui.dashboard

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.local.TokenManager
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.DashboardConfigSaveRequest
import com.hotelpms.pos.domain.model.DashboardStats
import com.hotelpms.pos.domain.model.DashboardWidgetConfig
import com.hotelpms.pos.domain.model.Order
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import javax.inject.Inject

// =============================================================================
// Widget definitions
// =============================================================================

data class WidgetDefinition(
    val id: String,
    val label: String,
    val description: String,
    val roles: List<String>,  // empty = all roles
    val category: String
)

val ALL_MOBILE_WIDGETS = listOf(
    // Hébergement
    WidgetDefinition("rooms_status", "État des chambres", "Disponibles, occupées, nettoyage", listOf(), "Hébergement"),
    // Commandes
    WidgetDefinition("menu_button", "Accès rapide menu", "Bouton pour prendre une commande", listOf("SERVER", "MAITRE_HOTEL", "POS"), "Commandes"),
    WidgetDefinition("orders_stats", "Statistiques commandes", "Commandes du jour, en attente, prêtes", listOf(), "Commandes"),
    WidgetDefinition("my_orders", "Mes commandes", "Nombre et total de mes commandes", listOf("SERVER", "MAITRE_HOTEL"), "Commandes"),
    WidgetDefinition("recent_orders", "Dernières commandes", "Liste des commandes récentes", listOf("SERVER", "MAITRE_HOTEL"), "Commandes"),
    WidgetDefinition("team_orders", "Commandes actives (équipe)", "État des commandes de l'équipe", listOf("SERVER", "MAITRE_HOTEL"), "Commandes"),
    WidgetDefinition("server_breakdown", "Commandes par serveur", "Résumé par serveur", listOf("MAITRE_HOTEL", "MANAGER", "OWNER", "DAF"), "Commandes"),
    // Cuisine
    WidgetDefinition("cook_stats", "Cuisine", "Commandes en attente, préparation, prêtes", listOf("COOK"), "Cuisine"),
    // Nettoyage
    WidgetDefinition("cleaning_stats", "Nettoyage", "Sessions, durée moyenne", listOf("CLEANER"), "Nettoyage"),
    // Finance
    WidgetDefinition("revenue", "Revenus du jour", "Montant des revenus", listOf("MANAGER", "OWNER", "DAF", "MAITRE_HOTEL"), "Finance"),
    WidgetDefinition("financial", "Finance détaillée", "Revenus mensuels, stock, factures", listOf("DAF", "OWNER"), "Finance"),
    // Opérations
    WidgetDefinition("approvals", "Approbations en attente", "Nombre d'approbations à traiter", listOf("MANAGER", "OWNER", "DAF"), "Opérations"),
)

fun getDefaultWidgetsForRole(role: String): List<DashboardWidgetConfig> {
    val upper = role.uppercase()
    val available = ALL_MOBILE_WIDGETS.filter { w ->
        w.roles.isEmpty() || upper in w.roles
    }
    return available.mapIndexed { index, w ->
        DashboardWidgetConfig(id = w.id, enabled = true, order = index)
    }
}

// =============================================================================
// UI State
// =============================================================================

data class DashboardUiState(
    val stats: DashboardStats = DashboardStats(),
    val userRole: String = "",
    val userName: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    // Widget config
    val widgetConfigs: List<DashboardWidgetConfig> = emptyList(),
    val showConfigurator: Boolean = false,
    val configLoaded: Boolean = false,
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
        fetchWidgetConfig()
        fetchStats()
    }

    // ─── Widget config ───────────────────────────────────────────────────────

    private fun fetchWidgetConfig() {
        viewModelScope.launch {
            try {
                val response = api.getDashboardConfig()
                if (response.isSuccessful) {
                    val widgets = response.body()?.data?.widgets
                    if (!widgets.isNullOrEmpty()) {
                        uiState = uiState.copy(widgetConfigs = widgets, configLoaded = true)
                        return@launch
                    }
                }
            } catch (_: Exception) {}
            // Fallback to role-based defaults
            val role = tokenManager.establishmentRole ?: tokenManager.userRole ?: ""
            uiState = uiState.copy(
                widgetConfigs = getDefaultWidgetsForRole(role),
                configLoaded = true
            )
        }
    }

    fun toggleConfigurator() {
        uiState = uiState.copy(showConfigurator = !uiState.showConfigurator)
    }

    fun toggleWidget(widgetId: String) {
        val updated = uiState.widgetConfigs.map { w ->
            if (w.id == widgetId) w.copy(enabled = !w.enabled) else w
        }
        uiState = uiState.copy(widgetConfigs = updated)
    }

    fun moveWidget(widgetId: String, direction: Int) {
        val list = uiState.widgetConfigs.toMutableList()
        val idx = list.indexOfFirst { it.id == widgetId }
        if (idx < 0) return
        val newIdx = (idx + direction).coerceIn(0, list.lastIndex)
        if (newIdx == idx) return
        val item = list.removeAt(idx)
        list.add(newIdx, item)
        // Reassign order
        val reordered = list.mapIndexed { i, w -> w.copy(order = i) }
        uiState = uiState.copy(widgetConfigs = reordered)
    }

    fun saveWidgetConfig() {
        viewModelScope.launch {
            try {
                api.saveDashboardConfig(DashboardConfigSaveRequest(widgets = uiState.widgetConfigs))
            } catch (_: Exception) {}
            uiState = uiState.copy(showConfigurator = false)
        }
    }

    fun resetWidgetsToDefault() {
        val role = uiState.userRole.ifBlank { tokenManager.establishmentRole ?: "" }
        uiState = uiState.copy(widgetConfigs = getDefaultWidgetsForRole(role))
    }

    fun getEnabledWidgets(): List<DashboardWidgetConfig> {
        return uiState.widgetConfigs
            .filter { it.enabled }
            .sortedBy { it.order }
    }

    fun getAvailableWidgets(): List<WidgetDefinition> {
        val role = uiState.userRole.uppercase()
        return ALL_MOBILE_WIDGETS.filter { w ->
            w.roles.isEmpty() || role in w.roles
        }
    }

    // ─── Stats fetching ──────────────────────────────────────────────────────

    fun fetchStats() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)
            try {
                var role = tokenManager.establishmentRole ?: ""
                if (role.isBlank()) {
                    for (i in 1..3) {
                        delay(500L * i)
                        role = tokenManager.establishmentRole ?: ""
                        if (role.isNotBlank()) break
                    }
                }
                if (role.isBlank()) role = tokenManager.userRole ?: ""

                uiState = uiState.copy(userRole = role.uppercase())

                // Fetch all data needed for any widgets the user might enable
                fetchAllStats(role.uppercase())
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de chargement")
            }
        }
    }

    private suspend fun fetchAllStats(role: String) {
        val roomsDeferred = viewModelScope.async {
            try { api.getRooms(establishmentId) } catch (_: Exception) { null }
        }
        val ordersDeferred = viewModelScope.async {
            try { api.getOrders(establishmentId) } catch (_: Exception) { null }
        }
        val approvalsDeferred = viewModelScope.async {
            try { api.getApprovals(establishmentId) } catch (_: Exception) { null }
        }
        val sessionsDeferred = viewModelScope.async {
            if (role == "CLEANER") try { api.getCleaningSessions(establishmentId) } catch (_: Exception) { null } else null
        }
        val stockDeferred = viewModelScope.async {
            if (role in listOf("DAF", "OWNER")) try { api.getStockMovements(establishmentId) } catch (_: Exception) { null } else null
        }
        val dailyReportDeferred = viewModelScope.async {
            if (role in listOf("DAF", "OWNER", "MANAGER", "MAITRE_HOTEL", "SERVER")) {
                try { api.getDailyReport(establishmentId = establishmentId).body() } catch (_: Exception) { null }
            } else null
        }
        val revenueSummaryDeferred = viewModelScope.async {
            if (role in listOf("DAF", "OWNER")) {
                try { api.getRevenueSummary(establishmentId = establishmentId).body() } catch (_: Exception) { null }
            } else null
        }

        val rooms = roomsDeferred.await()
        val orders = ordersDeferred.await()
        val approvals = approvalsDeferred.await()
        val sessions = sessionsDeferred.await()
        val stock = stockDeferred.await()
        val dailyReport = dailyReportDeferred.await()
        val revenueSummary = revenueSummaryDeferred.await()

        val roomList = rooms?.data ?: emptyList()
        val orderList = orders?.data ?: emptyList()
        val approvalList = approvals?.data ?: emptyList()
        val sessionList = sessions?.data ?: emptyList()

        val myOrders = orderList.filter { it.createdBy?.id == tokenManager.userId }
        val mySessions = sessionList.filter { it.cleanerId == tokenManager.userId }
        val completedSessions = mySessions.filter { it.clockOutAt != null }
        val avgDuration = if (completedSessions.isNotEmpty()) {
            completedSessions.mapNotNull { it.durationMinutes }.average().toInt()
        } else 0

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

        // Real encaissements from /reports/daily (payments collected today, vouchers excluded)
        val todayEncaisse = dailyReport?.data?.totalEncaisse ?: orderList.sumOf { it.totalAmount }
        val monthlyRevenue = revenueSummary?.data?.month?.total ?: todayEncaisse

        uiState = uiState.copy(
            stats = DashboardStats(
                totalRooms = roomList.size,
                availableRooms = roomList.count { it.status == "AVAILABLE" },
                occupiedRooms = roomList.count { it.status == "OCCUPIED" },
                cleaningRooms = roomList.count { it.status == "CLEANING" },
                todayOrders = orderList.size,
                pendingOrders = orderList.count { it.status == "PENDING" },
                todayRevenue = todayEncaisse,
                pendingApprovals = approvalList.count { it.status == "PENDING" },
                activeSessions = mySessions.count { it.clockOutAt == null }
            ),
            myOrdersCount = myOrders.size,
            readyToServeCount = orderList.count { it.status == "READY" },
            myDailyTotal = myOrders.sumOf { it.totalAmount },
            myRecentOrders = myOrders.sortedByDescending { it.createdAt }.take(10),
            allOrders = orderList,
            serverBreakdown = serverBreakdown,
            preparingCount = orderList.count { it.status == "PREPARING" },
            readyCount = orderList.count { it.status == "READY" },
            todaySessionsCount = mySessions.size,
            averageDuration = avgDuration,
            monthlyRevenue = monthlyRevenue,
            stockMovementsCount = stock?.data?.size ?: 0,
            invoicesCount = orderList.size,
            isLoading = false
        )
    }

    fun setRole(role: String) {
        uiState = uiState.copy(userRole = role)
        fetchStats()
    }

    fun clearError() {
        uiState = uiState.copy(error = null)
    }
}
