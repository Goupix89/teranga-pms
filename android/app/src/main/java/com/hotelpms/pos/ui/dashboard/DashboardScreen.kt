package com.hotelpms.pos.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import com.hotelpms.pos.ui.theme.*
import java.text.NumberFormat
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
                    }
                    "DAF" -> {
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
