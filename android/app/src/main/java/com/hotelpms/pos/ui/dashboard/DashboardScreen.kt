package com.hotelpms.pos.ui.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
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
    val effectiveRole = (userRole ?: state.userRole).uppercase()

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

    // Widget configurator dialog
    if (state.showConfigurator) {
        WidgetConfiguratorDialog(
            viewModel = viewModel,
            onDismiss = { viewModel.toggleConfigurator() }
        )
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
                    IconButton(onClick = { viewModel.toggleConfigurator() }) {
                        Icon(Icons.Default.Tune, contentDescription = "Personnaliser")
                    }
                    IconButton(onClick = { viewModel.fetchStats() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rafraichir")
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
            val enabledWidgets = viewModel.getEnabledWidgets()

            if (enabledWidgets.isEmpty() && state.configLoaded) {
                // Empty state
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Dashboard,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
                        )
                        Spacer(Modifier.height(16.dp))
                        Text(
                            "Aucun widget actif",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(Modifier.height(8.dp))
                        Button(onClick = { viewModel.toggleConfigurator() }) {
                            Icon(Icons.Default.Tune, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Personnaliser")
                        }
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(padding)
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Togo Independence Day banner (shows only on April 27th)
                    item { TogoIndependenceBanner() }
                    // Labour Day banner (shows only on May 1st)
                    item { LabourDayBanner() }

                    item { Spacer(modifier = Modifier.height(4.dp)) }

                    enabledWidgets.forEach { widget ->
                        item(key = widget.id) {
                            RenderWidget(
                                widgetId = widget.id,
                                state = state,
                                currencyFormat = currencyFormat,
                                onNavigateToMenu = onNavigateToMenu
                            )
                        }
                    }

                    item { Spacer(modifier = Modifier.height(16.dp)) }
                }
            }
        }
    }
}

// =============================================================================
// WIDGET RENDERER
// =============================================================================

@Composable
private fun RenderWidget(
    widgetId: String,
    state: DashboardUiState,
    currencyFormat: NumberFormat,
    onNavigateToMenu: (() -> Unit)?
) {
    when (widgetId) {
        "rooms_status" -> WidgetRoomsStatus(state)
        "menu_button" -> WidgetMenuButton(onNavigateToMenu)
        "orders_stats" -> WidgetOrdersStats(state)
        "my_orders" -> WidgetMyOrders(state, currencyFormat)
        "recent_orders" -> {
            if (state.myRecentOrders.isNotEmpty()) {
                RecentOrdersSection("Mes dernieres commandes", state.myRecentOrders)
            }
        }
        "team_orders" -> ColleaguesOrdersSection(state.allOrders, myUserId = state.userName)
        "server_breakdown" -> {
            if (state.serverBreakdown.isNotEmpty()) {
                ServerBreakdownSection(state.serverBreakdown, currencyFormat)
            }
        }
        "cook_stats" -> WidgetCookStats(state)
        "cleaning_stats" -> WidgetCleaningStats(state)
        "revenue" -> WidgetRevenue(state, currencyFormat)
        "financial" -> WidgetFinancial(state, currencyFormat)
        "approvals" -> WidgetApprovals(state)
    }
}

// =============================================================================
// INDIVIDUAL WIDGETS
// =============================================================================

@Composable
private fun WidgetRoomsStatus(state: DashboardUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Etat des chambres", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            RoomStatusChip(modifier = Modifier.weight(1f), label = "Disponibles", count = state.stats.availableRooms, color = VertBeninois)
            RoomStatusChip(modifier = Modifier.weight(1f), label = "Occupees", count = state.stats.occupiedRooms, color = RougeDahomey)
            RoomStatusChip(modifier = Modifier.weight(1f), label = "Nettoyage", count = state.stats.cleaningRooms, color = OrBeninois)
        }
    }
}

@Composable
private fun WidgetMenuButton(onNavigateToMenu: (() -> Unit)?) {
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
}

@Composable
private fun WidgetOrdersStats(state: DashboardUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Commandes", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(modifier = Modifier.weight(1f), title = "Total du jour", value = "${state.stats.todayOrders}", icon = Icons.Default.Receipt, backgroundColor = OrBeninoisContainer, iconColor = OrBeninois)
            StatCard(modifier = Modifier.weight(1f), title = "En attente", value = "${state.stats.pendingOrders}", icon = Icons.Default.Pending, backgroundColor = RougeDahomeyContainer, iconColor = RougeDahomey)
            StatCard(modifier = Modifier.weight(1f), title = "Pretes", value = "${state.readyToServeCount}", icon = Icons.Default.RoomService, backgroundColor = VertBeninoisContainer, iconColor = VertBeninois)
        }
    }
}

@Composable
private fun WidgetMyOrders(state: DashboardUiState, currencyFormat: NumberFormat) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        StatCard(modifier = Modifier.weight(1f), title = "Mes commandes", value = "${state.myOrdersCount}", icon = Icons.Default.Person, backgroundColor = OrBeninoisContainer, iconColor = OrBeninoisDark)
        StatCard(modifier = Modifier.weight(1f), title = "Mon total", value = "${currencyFormat.format(state.myDailyTotal)} F", icon = Icons.Default.AttachMoney, backgroundColor = VertBeninoisContainer, iconColor = VertBeninois)
    }
}

@Composable
private fun WidgetCookStats(state: DashboardUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Cuisine", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(modifier = Modifier.weight(1f), title = "En attente", value = "${state.stats.pendingOrders}", icon = Icons.Default.Pending, backgroundColor = OrBeninoisContainer, iconColor = OrBeninois)
            StatCard(modifier = Modifier.weight(1f), title = "En preparation", value = "${state.preparingCount}", icon = Icons.Default.Restaurant, backgroundColor = RougeDahomeyContainer, iconColor = RougeDahomey)
            StatCard(modifier = Modifier.weight(1f), title = "Pretes", value = "${state.readyCount}", icon = Icons.Default.CheckCircle, backgroundColor = VertBeninoisContainer, iconColor = VertBeninois)
        }
    }
}

@Composable
private fun WidgetCleaningStats(state: DashboardUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Nettoyage", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(modifier = Modifier.weight(1f), title = "A nettoyer", value = "${state.stats.cleaningRooms}", icon = Icons.Default.CleaningServices, backgroundColor = OrBeninoisContainer, iconColor = OrBeninois)
            StatCard(modifier = Modifier.weight(1f), title = "Sessions", value = "${state.todaySessionsCount}", icon = Icons.Default.Today, backgroundColor = VertBeninoisContainer, iconColor = VertBeninois)
            StatCard(modifier = Modifier.weight(1f), title = "Duree moy.", value = "${state.averageDuration} min", icon = Icons.Default.Timer, backgroundColor = RougeDahomeyContainer, iconColor = RougeDahomey)
        }
    }
}

@Composable
private fun WidgetRevenue(state: DashboardUiState, currencyFormat: NumberFormat) {
    StatCard(
        modifier = Modifier.fillMaxWidth(),
        title = "Revenus du jour",
        value = "${currencyFormat.format(state.stats.todayRevenue)} FCFA",
        icon = Icons.Default.Payments,
        backgroundColor = VertBeninoisContainer,
        iconColor = VertBeninois
    )
}

@Composable
private fun WidgetFinancial(state: DashboardUiState, currencyFormat: NumberFormat) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Divider()
        Text("Finance", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            StatCard(modifier = Modifier.weight(1f), title = "Revenus", value = "${currencyFormat.format(state.monthlyRevenue)} F", icon = Icons.Default.TrendingUp, backgroundColor = VertBeninoisContainer, iconColor = VertBeninois)
            StatCard(modifier = Modifier.weight(1f), title = "Stock mvts", value = "${state.stockMovementsCount}", icon = Icons.Default.Inventory, backgroundColor = OrBeninoisContainer, iconColor = OrBeninois)
            StatCard(modifier = Modifier.weight(1f), title = "Factures", value = "${state.invoicesCount}", icon = Icons.Default.Description, backgroundColor = RougeDahomeyContainer, iconColor = RougeDahomey)
        }
    }
}

@Composable
private fun WidgetApprovals(state: DashboardUiState) {
    StatCard(
        modifier = Modifier.fillMaxWidth(),
        title = "Approbations en attente",
        value = "${state.stats.pendingApprovals}",
        icon = Icons.Default.Approval,
        backgroundColor = if (state.stats.pendingApprovals > 0) RougeDahomeyContainer else VertBeninoisContainer,
        iconColor = if (state.stats.pendingApprovals > 0) RougeDahomey else VertBeninois
    )
}

// =============================================================================
// WIDGET CONFIGURATOR DIALOG
// =============================================================================

@Composable
private fun WidgetConfiguratorDialog(
    viewModel: DashboardViewModel,
    onDismiss: () -> Unit
) {
    val available = viewModel.getAvailableWidgets()
    val configs = viewModel.uiState.widgetConfigs
    val categories = available.map { it.category }.distinct()

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.95f)
                .fillMaxHeight(0.85f),
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                // Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Personnaliser", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                    IconButton(onClick = onDismiss) {
                        Icon(Icons.Default.Close, contentDescription = "Fermer")
                    }
                }

                Divider()

                // Widget list
                LazyColumn(
                    modifier = Modifier
                        .weight(1f)
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    categories.forEach { category ->
                        item {
                            Spacer(Modifier.height(12.dp))
                            Text(
                                category,
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Spacer(Modifier.height(4.dp))
                        }

                        val categoryWidgets = available.filter { it.category == category }
                        items(categoryWidgets, key = { it.id }) { widget ->
                            val config = configs.find { it.id == widget.id }
                            val isEnabled = config?.enabled ?: false
                            val idx = configs.indexOfFirst { it.id == widget.id }

                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(
                                    containerColor = if (isEnabled)
                                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
                                    else
                                        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.3f)
                                )
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(widget.label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                                        Text(widget.description, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                    // Move buttons
                                    if (isEnabled) {
                                        IconButton(
                                            onClick = { viewModel.moveWidget(widget.id, -1) },
                                            modifier = Modifier.size(32.dp),
                                            enabled = idx > 0
                                        ) {
                                            Icon(Icons.Default.KeyboardArrowUp, contentDescription = "Monter", modifier = Modifier.size(20.dp))
                                        }
                                        IconButton(
                                            onClick = { viewModel.moveWidget(widget.id, 1) },
                                            modifier = Modifier.size(32.dp),
                                            enabled = idx < configs.lastIndex
                                        ) {
                                            Icon(Icons.Default.KeyboardArrowDown, contentDescription = "Descendre", modifier = Modifier.size(20.dp))
                                        }
                                    }
                                    Switch(
                                        checked = isEnabled,
                                        onCheckedChange = { viewModel.toggleWidget(widget.id) }
                                    )
                                }
                            }
                        }
                    }
                    item { Spacer(Modifier.height(8.dp)) }
                }

                Divider()

                // Footer buttons
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    OutlinedButton(
                        onClick = { viewModel.resetWidgetsToDefault() },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Reinitialiser", fontSize = 13.sp)
                    }
                    Button(
                        onClick = { viewModel.saveWidgetConfig() },
                        modifier = Modifier.weight(1f)
                    ) {
                        Text("Enregistrer", fontSize = 13.sp)
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
                "READY" -> "Prete"
                "SERVED" -> "Servie"
                "CANCELLED" -> "Annulee"
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
                                Text(order.orderNumber ?: "\u2014", fontWeight = FontWeight.Bold, fontSize = 13.sp)
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
private fun ColleaguesOrdersSection(allOrders: List<Order>, myUserId: String) {
    val activeOrders = allOrders.filter { it.status in listOf("PENDING", "IN_PROGRESS", "READY") }
    if (activeOrders.isEmpty()) return

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Divider()
        Text("Commandes actives (equipe)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
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
                        Text("Pretes", fontSize = 11.sp, color = VertBeninois)
                    }
                }
            }
        }

        val readyOrders = activeOrders.filter { it.status == "READY" }
        if (readyOrders.isNotEmpty()) {
            Text("A servir maintenant", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = VertBeninois)
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
                            Text("${order.orderNumber ?: "\u2014"}${if (order.tableNumber != null) " \u00b7 Table ${order.tableNumber}" else ""}", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            Text(order.createdBy?.let { "${it.firstName} ${it.lastName}" } ?: "", fontSize = 11.sp, color = BronzeAbomey)
                        }
                        Icon(Icons.Default.RoomService, contentDescription = null, tint = VertBeninois, modifier = Modifier.size(20.dp))
                    }
                }
            }
        }
    }
}

// =============================================================================
// SERVER BREAKDOWN (per-server order summary)
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
                        Text("${server.orderCount} cmd \u00b7 ${currencyFormat.format(server.revenue)} F", fontSize = 12.sp, color = BronzeAbomey)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (server.pendingCount > 0) {
                            Surface(color = OrBeninois.copy(alpha = 0.2f), shape = RoundedCornerShape(4.dp)) {
                                Text("${server.pendingCount} en cours", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = OrBeninois, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                            }
                        }
                        if (server.readyCount > 0) {
                            Surface(color = VertBeninois.copy(alpha = 0.2f), shape = RoundedCornerShape(4.dp)) {
                                Text("${server.readyCount} prete${if (server.readyCount > 1) "s" else ""}", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = VertBeninois, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                            }
                        }
                    }
                }
            }
        }
    }
}

// =============================================================================
// REUSABLE COMPONENTS
// =============================================================================

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
