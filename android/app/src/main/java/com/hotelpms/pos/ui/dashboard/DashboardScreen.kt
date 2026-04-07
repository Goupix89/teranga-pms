package com.hotelpms.pos.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hotelpms.pos.domain.model.Order
import com.hotelpms.pos.ui.theme.*
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel(),
    onNavigateToMenu: (() -> Unit)? = null,
    userRole: String? = null
) {
    val state = viewModel.uiState
    // Use role from MainScaffold (authoritative) or fallback to ViewModel
    val effectiveRole = (userRole ?: state.userRole).uppercase()

    // Sync role into ViewModel so it fetches the right stats
    LaunchedEffect(userRole) {
        if (!userRole.isNullOrBlank() && state.userRole.uppercase() != userRole.uppercase()) {
            viewModel.setRole(userRole.uppercase())
        }
    }
    val snackbarHostState = remember { SnackbarHostState() }
    val currencyFormat = remember {
        NumberFormat.getNumberInstance(Locale.FRANCE).apply {
            maximumFractionDigits = 0
        }
    }

    LaunchedEffect(state.error) {
        state.error?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearError()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Tableau de bord")
                        if (state.userName.isNotBlank()) {
                            Text(
                                "Bienvenue, ${state.userName}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.fetchStats() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rafra\u00eechir")
                    }
                }
            )
        }
    ) { padding ->
        if (state.isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item { Spacer(modifier = Modifier.height(4.dp)) }

                when (effectiveRole) {
                    "COOK" -> {
                        item { CookDashboard(state) }
                    }
                    "CLEANER" -> {
                        item { CleanerDashboard(state) }
                    }
                    "SERVER" -> {
                        item { ServerDashboard(state, currencyFormat, onNavigateToMenu) }
                        if (state.myRecentOrders.isNotEmpty()) {
                            item { RecentOrdersSection("Mes dernières commandes", state.myRecentOrders) }
                        }
                        item { ColleaguesOrdersSection(state.allOrders, tokenManager = null, myUserId = state.userName) }
                    }
                    "MAITRE_HOTEL" -> {
                        item { MaitreHotelDashboard(state, currencyFormat, onNavigateToMenu) }
                        if (state.serverBreakdown.isNotEmpty()) {
                            item { ServerBreakdownSection(state.serverBreakdown, currencyFormat) }
                        }
                        if (state.myRecentOrders.isNotEmpty()) {
                            item { RecentOrdersSection("Mes commandes", state.myRecentOrders) }
                        }
                    }
                    "DAF", "OWNER" -> {
                        item { ManagerDashboard(state, currencyFormat) }
                        item { DafFinancialSection(state, currencyFormat) }
                    }
                    else -> {
                        item { ManagerDashboard(state, currencyFormat) }
                    }
                }

                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
    }
}

@Composable
private fun CookDashboard(state: DashboardUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Cuisine",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Commandes en attente",
                value = "${state.stats.pendingOrders}",
                icon = Icons.Default.Pending,
                backgroundColor = OrBeninoisContainer,
                iconColor = OrBeninois
            )
            StatCard(
                modifier = Modifier.weight(1f),
                title = "En pr\u00e9paration",
                value = "${state.preparingCount}",
                icon = Icons.Default.Restaurant,
                backgroundColor = RougeDahomeyContainer,
                iconColor = RougeDahomey
            )
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Pr\u00eates",
                value = "${state.readyCount}",
                icon = Icons.Default.CheckCircle,
                backgroundColor = VertBeninoisContainer,
                iconColor = VertBeninois
            )
        }
    }
}

@Composable
private fun CleanerDashboard(state: DashboardUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Nettoyage",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Chambres \u00e0 nettoyer",
                value = "${state.stats.cleaningRooms}",
                icon = Icons.Default.CleaningServices,
                backgroundColor = OrBeninoisContainer,
                iconColor = OrBeninois
            )
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Sessions du jour",
                value = "${state.todaySessionsCount}",
                icon = Icons.Default.Today,
                backgroundColor = VertBeninoisContainer,
                iconColor = VertBeninois
            )
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Dur\u00e9e moyenne",
                value = "${state.averageDuration} min",
                icon = Icons.Default.Timer,
                backgroundColor = RougeDahomeyContainer,
                iconColor = RougeDahomey
            )
        }
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "R\u00e9sum\u00e9 des chambres",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            RoomStatusChip(
                modifier = Modifier.weight(1f),
                label = "Disponibles",
                count = state.stats.availableRooms,
                color = VertBeninois
            )
            RoomStatusChip(
                modifier = Modifier.weight(1f),
                label = "Nettoyage",
                count = state.stats.cleaningRooms,
                color = OrBeninois
            )
            RoomStatusChip(
                modifier = Modifier.weight(1f),
                label = "Occup\u00e9es",
                count = state.stats.occupiedRooms,
                color = RougeDahomey
            )
        }
    }
}

@Composable
private fun ServerDashboard(
    state: DashboardUiState,
    currencyFormat: NumberFormat,
    onNavigateToMenu: (() -> Unit)? = null
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Service",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )

        // "Accéder au menu" button
        if (onNavigateToMenu != null) {
            Button(
                onClick = onNavigateToMenu,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = RougeDahomey),
                contentPadding = PaddingValues(vertical = 16.dp)
            ) {
                Icon(Icons.Default.Restaurant, contentDescription = null, modifier = Modifier.size(24.dp))
                Spacer(Modifier.width(12.dp))
                Text(
                    "Accéder au menu",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = Color.White
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Mes commandes",
                value = "${state.myOrdersCount}",
                icon = Icons.Default.Receipt,
                backgroundColor = OrBeninoisContainer,
                iconColor = OrBeninois
            )
            StatCard(
                modifier = Modifier.weight(1f),
                title = "En attente",
                value = "${state.stats.pendingOrders}",
                icon = Icons.Default.Pending,
                backgroundColor = RougeDahomeyContainer,
                iconColor = RougeDahomey
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Prêtes à servir",
                value = "${state.readyToServeCount}",
                icon = Icons.Default.RoomService,
                backgroundColor = VertBeninoisContainer,
                iconColor = VertBeninois
            )
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Total du jour",
                value = "${currencyFormat.format(state.myDailyTotal)} FCFA",
                icon = Icons.Default.AttachMoney,
                backgroundColor = OrBeninoisContainer,
                iconColor = OrBeninoisDark
            )
        }

        // Room status overview for SERVER
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            "État des chambres",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            RoomStatusChip(
                modifier = Modifier.weight(1f),
                label = "Disponibles",
                count = state.stats.availableRooms,
                color = VertBeninois
            )
            RoomStatusChip(
                modifier = Modifier.weight(1f),
                label = "Occupées",
                count = state.stats.occupiedRooms,
                color = RougeDahomey
            )
            RoomStatusChip(
                modifier = Modifier.weight(1f),
                label = "Nettoyage",
                count = state.stats.cleaningRooms,
                color = OrBeninois
            )
        }
    }
}

@Composable
private fun ManagerDashboard(state: DashboardUiState, currencyFormat: NumberFormat) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Vue d'ensemble",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Chambres dispo",
                value = "${state.stats.availableRooms}",
                icon = Icons.Default.Hotel,
                backgroundColor = VertBeninoisContainer,
                iconColor = VertBeninois
            )
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Occup\u00e9es",
                value = "${state.stats.occupiedRooms}",
                icon = Icons.Default.KingBed,
                backgroundColor = RougeDahomeyContainer,
                iconColor = RougeDahomey
            )
            StatCard(
                modifier = Modifier.weight(1f),
                title = "R\u00e9servations",
                value = "${state.stats.todayOrders}",
                icon = Icons.Default.CalendarMonth,
                backgroundColor = OrBeninoisContainer,
                iconColor = OrBeninois
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Commandes",
                value = "${state.stats.todayOrders}",
                icon = Icons.Default.Receipt,
                backgroundColor = Color(0xFFF3E5F5),
                iconColor = BronzeAbomey
            )
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Revenus",
                value = "${currencyFormat.format(state.stats.todayRevenue)} FCFA",
                icon = Icons.Default.Payments,
                backgroundColor = OrBeninoisContainer,
                iconColor = OrBeninoisDark
            )
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Approbations",
                value = "${state.stats.pendingApprovals}",
                icon = Icons.Default.Approval,
                backgroundColor = if (state.stats.pendingApprovals > 0) RougeDahomeyContainer else VertBeninoisContainer,
                iconColor = if (state.stats.pendingApprovals > 0) RougeDahomey else VertBeninois
            )
        }
    }
}

@Composable
private fun DafFinancialSection(state: DashboardUiState, currencyFormat: NumberFormat) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Divider()
        Text(
            "Finance",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold
        )
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Revenus mensuels",
                value = "${currencyFormat.format(state.monthlyRevenue)} FCFA",
                icon = Icons.Default.TrendingUp,
                backgroundColor = VertBeninoisContainer,
                iconColor = VertBeninois
            )
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Mouvements stock",
                value = "${state.stockMovementsCount}",
                icon = Icons.Default.Inventory,
                backgroundColor = OrBeninoisContainer,
                iconColor = OrBeninois
            )
            StatCard(
                modifier = Modifier.weight(1f),
                title = "Factures",
                value = "${state.invoicesCount}",
                icon = Icons.Default.Description,
                backgroundColor = RougeDahomeyContainer,
                iconColor = RougeDahomey
            )
        }
    }
}

// =============================================================================
// MAITRE D'HOTEL DASHBOARD
// =============================================================================

@Composable
private fun MaitreHotelDashboard(
    state: DashboardUiState,
    currencyFormat: NumberFormat,
    onNavigateToMenu: (() -> Unit)? = null
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Maître d'hôtel", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

        if (onNavigateToMenu != null) {
            Button(
                onClick = onNavigateToMenu,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = RougeDahomey),
                contentPadding = PaddingValues(vertical = 16.dp)
            ) {
                Icon(Icons.Default.Restaurant, contentDescription = null, modifier = Modifier.size(24.dp))
                Spacer(Modifier.width(12.dp))
                Text("Prendre une commande", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Color.White)
            }
        }

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(modifier = Modifier.weight(1f), title = "Total commandes", value = "${state.stats.todayOrders}", icon = Icons.Default.Receipt, backgroundColor = OrBeninoisContainer, iconColor = OrBeninois)
            StatCard(modifier = Modifier.weight(1f), title = "Revenus du jour", value = "${currencyFormat.format(state.stats.todayRevenue)} F", icon = Icons.Default.Payments, backgroundColor = VertBeninoisContainer, iconColor = VertBeninois)
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(modifier = Modifier.weight(1f), title = "Mes commandes", value = "${state.myOrdersCount}", icon = Icons.Default.Person, backgroundColor = OrBeninoisContainer, iconColor = OrBeninoisDark)
            StatCard(modifier = Modifier.weight(1f), title = "En attente", value = "${state.stats.pendingOrders}", icon = Icons.Default.Pending, backgroundColor = RougeDahomeyContainer, iconColor = RougeDahomey)
            StatCard(modifier = Modifier.weight(1f), title = "Prêtes", value = "${state.readyToServeCount}", icon = Icons.Default.RoomService, backgroundColor = VertBeninoisContainer, iconColor = VertBeninois)
        }

        // Rooms overview
        Spacer(modifier = Modifier.height(4.dp))
        Text("État des chambres", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            RoomStatusChip(modifier = Modifier.weight(1f), label = "Disponibles", count = state.stats.availableRooms, color = VertBeninois)
            RoomStatusChip(modifier = Modifier.weight(1f), label = "Occupées", count = state.stats.occupiedRooms, color = RougeDahomey)
            RoomStatusChip(modifier = Modifier.weight(1f), label = "Nettoyage", count = state.stats.cleaningRooms, color = OrBeninois)
        }
    }
}

// =============================================================================
// SERVER BREAKDOWN (per-server order summary for MAITRE_HOTEL)
// =============================================================================

@Composable
private fun ServerBreakdownSection(breakdown: List<ServerOrderSummary>, currencyFormat: NumberFormat) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Divider()
        Text("Commandes par serveur", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        breakdown.forEach { server ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = CremeGanvie)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(server.serverName, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Text("${server.orderCount} cmd · ${currencyFormat.format(server.revenue)} F", fontSize = 12.sp, color = BronzeAbomey)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (server.pendingCount > 0) {
                            Surface(color = OrBeninois.copy(alpha = 0.2f), shape = RoundedCornerShape(4.dp)) {
                                Text("${server.pendingCount} en cours", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = OrBeninois, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                            }
                        }
                        if (server.readyCount > 0) {
                            Surface(color = VertBeninois.copy(alpha = 0.2f), shape = RoundedCornerShape(4.dp)) {
                                Text("${server.readyCount} prête${if (server.readyCount > 1) "s" else ""}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = VertBeninois, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

// =============================================================================
// RECENT ORDERS LIST
// =============================================================================

@Composable
private fun RecentOrdersSection(title: String, orders: List<Order>) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Divider()
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        orders.forEach { order ->
            val statusColor = when (order.status) {
                "PENDING" -> OrBeninois
                "IN_PROGRESS" -> OrBeninois
                "READY" -> VertBeninois
                "SERVED" -> BronzeAbomey
                "CANCELLED" -> RougeDahomey
                else -> BronzeAbomey
            }
            val statusLabel = when (order.status) {
                "PENDING" -> "En attente"
                "IN_PROGRESS" -> "En cours"
                "READY" -> "Prête"
                "SERVED" -> "Servie"
                "CANCELLED" -> "Annulée"
                else -> order.status
            }
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = CremeGanvie)
            ) {
                Column {
                    Box(modifier = Modifier.fillMaxWidth().height(3.dp).background(statusColor))
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(order.orderNumber ?: "—", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                if (order.tableNumber != null) {
                                    Text("Table ${order.tableNumber}", fontSize = 11.sp, color = BronzeAbomey)
                                }
                            }
                            val itemsText = order.items?.take(3)?.joinToString(", ") { "${it.quantity}x ${it.article?.name ?: "?"}" } ?: ""
                            if (itemsText.isNotEmpty()) {
                                Text(itemsText, fontSize = 11.sp, color = BronzeAbomey, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Surface(color = statusColor.copy(alpha = 0.2f), shape = RoundedCornerShape(4.dp)) {
                                Text(statusLabel, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = statusColor, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                            }
                            Spacer(Modifier.height(2.dp))
                            val fmt = try { SimpleDateFormat("yyyy-MM-dd'T'HH:mm", Locale.getDefault()) } catch (_: Exception) { null }
                            val timeFmt = SimpleDateFormat("HH:mm", Locale.getDefault())
                            val time = order.createdAt?.let { try { fmt?.parse(it)?.let { d -> timeFmt.format(d) } } catch (_: Exception) { null } }
                            Text(time ?: "", fontSize = 10.sp, color = BronzeAbomey)
                        }
                    }
                }
            }
        }
    }
}

// =============================================================================
// COLLEAGUES ORDERS STATUS (for SERVER)
// =============================================================================

@Composable
private fun ColleaguesOrdersSection(allOrders: List<Order>, tokenManager: Any?, myUserId: String) {
    val activeOrders = allOrders.filter { it.status in listOf("PENDING", "IN_PROGRESS", "READY") }
    if (activeOrders.isEmpty()) return

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Divider()
        Text("Commandes actives (équipe)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            val pending = activeOrders.count { it.status == "PENDING" }
            val inProgress = activeOrders.count { it.status == "IN_PROGRESS" }
            val ready = activeOrders.count { it.status == "READY" }
            if (pending > 0) {
                Surface(modifier = Modifier.weight(1f), color = OrBeninois.copy(alpha = 0.15f), shape = RoundedCornerShape(8.dp)) {
                    Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("$pending", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = OrBeninois)
                        Text("En attente", fontSize = 11.sp, color = OrBeninois)
                    }
                }
            }
            if (inProgress > 0) {
                Surface(modifier = Modifier.weight(1f), color = OrBeninois.copy(alpha = 0.15f), shape = RoundedCornerShape(8.dp)) {
                    Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("$inProgress", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = OrBeninois)
                        Text("En cours", fontSize = 11.sp, color = OrBeninois)
                    }
                }
            }
            if (ready > 0) {
                Surface(modifier = Modifier.weight(1f), color = VertBeninois.copy(alpha = 0.15f), shape = RoundedCornerShape(8.dp)) {
                    Column(modifier = Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("$ready", fontWeight = FontWeight.Bold, fontSize = 20.sp, color = VertBeninois)
                        Text("Prêtes", fontSize = 11.sp, color = VertBeninois)
                    }
                }
            }
        }

        // Show ready orders details (urgent)
        val readyOrders = activeOrders.filter { it.status == "READY" }
        if (readyOrders.isNotEmpty()) {
            Text("À servir maintenant", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = VertBeninois)
            readyOrders.forEach { order ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = VertBeninois.copy(alpha = 0.08f))
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("${order.orderNumber ?: "—"}${if (order.tableNumber != null) " · Table ${order.tableNumber}" else ""}", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            Text(order.createdBy?.let { "${it.firstName} ${it.lastName}" } ?: "", fontSize = 11.sp, color = BronzeAbomey)
                        }
                        Icon(Icons.Default.RoomService, contentDescription = null, tint = VertBeninois, modifier = Modifier.size(20.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun StatCard(
    modifier: Modifier = Modifier,
    title: String,
    value: String,
    icon: ImageVector,
    backgroundColor: Color,
    iconColor: Color
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = backgroundColor)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(28.dp)
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = value,
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = title,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}

@Composable
private fun RoomStatusChip(
    modifier: Modifier = Modifier,
    label: String,
    count: Int,
    color: Color
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.15f))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "$count",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = color
            )
            Text(
                text = label,
                style = MaterialTheme.typography.labelSmall,
                color = color
            )
        }
    }
}
