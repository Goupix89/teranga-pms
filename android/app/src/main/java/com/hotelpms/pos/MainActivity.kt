package com.hotelpms.pos

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CleaningServices
import androidx.compose.material.icons.outlined.CloudOff
import androidx.compose.material.icons.outlined.Inventory
import androidx.compose.material.icons.outlined.KingBed
import androidx.compose.material.icons.outlined.LocalDining
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.PointOfSale
import androidx.compose.material.icons.outlined.ReceiptLong
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextAlign
import kotlinx.coroutines.launch
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.hotelpms.pos.ui.approvals.ApprovalsScreen
import com.hotelpms.pos.ui.auth.AuthViewModel
import com.hotelpms.pos.ui.auth.LoginScreen
import com.hotelpms.pos.ui.cleaning.CleaningScreen
import com.hotelpms.pos.ui.dashboard.DashboardScreen
import com.hotelpms.pos.ui.invoices.InvoicesScreen
import com.hotelpms.pos.ui.kitchen.KitchenScreen
import com.hotelpms.pos.ui.notifications.NotificationsScreen
import com.hotelpms.pos.ui.orders.OrdersScreen
import com.hotelpms.pos.ui.pos.PosScreen
import com.hotelpms.pos.ui.reservations.ReservationsScreen
import com.hotelpms.pos.ui.rooms.RoomsScreen
import com.hotelpms.pos.ui.stock.StockScreen
import com.hotelpms.pos.ui.theme.BeninTheme
import com.hotelpms.pos.ui.theme.OrBeninois
import com.hotelpms.pos.ui.theme.TerreFon
import com.hotelpms.pos.ui.theme.SableOuidah
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import dagger.hilt.android.AndroidEntryPoint
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class PmsApplication : Application()

// =============================================================================
// Navigation Items
// =============================================================================

data class NavItem(
    val route: String,
    val label: String,
    val icon: ImageVector
)

val allNavItems = listOf(
    NavItem("dashboard", "Accueil", Icons.Default.Home),
    NavItem("orders", "Commandes", Icons.Default.ShoppingCart),
    NavItem("kitchen", "Cuisine", Icons.Outlined.LocalDining),
    NavItem("rooms", "Chambres", Icons.Outlined.KingBed),
    NavItem("reservations", "Reservations", Icons.Outlined.CalendarMonth),
    NavItem("cleaning", "Menage", Icons.Outlined.CleaningServices),
    NavItem("stock", "Stock", Icons.Outlined.Inventory),
    NavItem("invoices", "Factures", Icons.Outlined.ReceiptLong),
    NavItem("approvals", "Approbations", Icons.Default.CheckCircle),
    NavItem("pos", "POS", Icons.Outlined.PointOfSale),
    NavItem("offline", "Hors-ligne", Icons.Outlined.CloudOff),
    NavItem("notifications", "Notifs", Icons.Outlined.Notifications)
)

data class NavLayout(
    val primary: List<NavItem>,
    val overflow: List<NavItem>
)

private fun itemsFor(routes: List<String>): List<NavItem> =
    routes.mapNotNull { r -> allNavItems.firstOrNull { it.route == r } }

fun navLayoutForRole(role: String): NavLayout {
    val (primaryRoutes, overflowRoutes) = when (role.uppercase()) {
        "COOK" -> listOf("dashboard", "kitchen", "notifications") to emptyList()
        "CLEANER" -> listOf("dashboard", "cleaning", "notifications") to emptyList()
        "SERVER" -> listOf("dashboard", "orders", "invoices", "pos") to listOf("offline", "notifications")
        "POS" -> listOf("dashboard", "orders", "invoices", "pos") to listOf("offline", "notifications")
        "MAITRE_HOTEL" -> listOf("dashboard", "orders", "invoices", "pos") to listOf("stock", "offline", "notifications")
        "MANAGER" -> listOf("dashboard", "orders", "invoices", "pos") to listOf("rooms", "reservations", "stock", "approvals", "offline", "notifications")
        "DAF" -> listOf("dashboard", "orders", "invoices", "approvals") to listOf("rooms", "reservations", "stock", "offline", "notifications")
        "OWNER" -> listOf("dashboard", "orders", "invoices", "approvals") to listOf("rooms", "reservations", "stock", "offline", "notifications")
        "SUPERADMIN" -> listOf("dashboard", "orders", "kitchen", "invoices") to listOf("rooms", "reservations", "cleaning", "stock", "approvals", "pos", "offline", "notifications")
        else -> listOf("dashboard", "orders", "invoices", "pos") to listOf("offline", "notifications")
    }
    return NavLayout(primary = itemsFor(primaryRoutes), overflow = itemsFor(overflowRoutes))
}

// =============================================================================
// Activity
// =============================================================================

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        setContent {
            BeninTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    PmsNavigation()
                }
            }
        }
    }
}

// =============================================================================
// Navigation
// =============================================================================

@Composable
fun PmsNavigation() {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = hiltViewModel()
    val authState = authViewModel.uiState

    val startDestination = if (authState.isLoggedIn) "dashboard" else "login"

    NavHost(navController = navController, startDestination = startDestination) {

        composable("login") {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate("dashboard") {
                        popUpTo("login") { inclusive = true }
                    }
                },
                viewModel = authViewModel
            )
        }

        composable("main") {
            MainScaffold(
                authViewModel = authViewModel,
                onLogout = {
                    authViewModel.logout()
                    navController.navigate("login") {
                        popUpTo("main") { inclusive = true }
                    }
                }
            )
        }

        // Also support direct deep-link to dashboard which redirects to main scaffold
        composable("dashboard") {
            MainScaffold(
                authViewModel = authViewModel,
                startRoute = "dashboard",
                onLogout = {
                    authViewModel.logout()
                    navController.navigate("login") {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
    }
}

// =============================================================================
// Main Scaffold with Bottom Navigation
// =============================================================================

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScaffold(
    authViewModel: AuthViewModel,
    startRoute: String = "dashboard",
    onLogout: () -> Unit
) {
    val innerNavController = rememberNavController()
    val navBackStackEntry by innerNavController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: startRoute

    val role = authViewModel.uiState.currentRole ?: "SERVER"
    val layout = navLayoutForRole(role)
    val overflowRoutes = remember(layout) { layout.overflow.map { it.route }.toSet() }

    var showOverflow by remember { mutableStateOf(false) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val scope = rememberCoroutineScope()

    fun navigateTo(route: String) {
        if (currentRoute != route) {
            innerNavController.navigate(route) {
                popUpTo(innerNavController.graph.findStartDestination().id) {
                    saveState = true
                }
                launchSingleTop = true
                restoreState = true
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Teranga PMS",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                },
                actions = {
                    Text(
                        role,
                        style = MaterialTheme.typography.labelMedium,
                        color = OrBeninois,
                        modifier = Modifier.padding(end = 8.dp)
                    )
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Default.ExitToApp, contentDescription = "Déconnexion")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = TerreFon,
                    titleContentColor = SableOuidah,
                    actionIconContentColor = SableOuidah
                )
            )
        },
        bottomBar = {
            NavigationBar {
                layout.primary.forEach { item ->
                    NavigationBarItem(
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label) },
                        selected = currentRoute == item.route,
                        onClick = { navigateTo(item.route) }
                    )
                }
                if (layout.overflow.isNotEmpty()) {
                    val overflowSelected = currentRoute in overflowRoutes
                    NavigationBarItem(
                        icon = { Icon(Icons.Default.MoreHoriz, contentDescription = "Plus") },
                        label = { Text("Plus") },
                        selected = overflowSelected,
                        onClick = { showOverflow = true }
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = innerNavController,
            startDestination = startRoute,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable("dashboard") {
                DashboardScreen(
                    onNavigateToMenu = {
                        innerNavController.navigate("orders") {
                            popUpTo(innerNavController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    userRole = role
                )
            }

            composable("orders") {
                OrdersScreen(
                    userRole = role,
                    establishment = authViewModel.uiState.currentEstablishment
                )
            }

            composable("kitchen") {
                KitchenScreen()
            }

            composable("rooms") {
                RoomsScreen()
            }

            composable("reservations") {
                ReservationsScreen()
            }

            composable("cleaning") {
                CleaningScreen()
            }

            composable("stock") {
                StockScreen()
            }

            composable("invoices") {
                InvoicesScreen(
                    establishment = authViewModel.uiState.currentEstablishment
                )
            }

            composable("approvals") {
                ApprovalsScreen()
            }

            composable("pos") {
                PosScreen(onLogout = onLogout)
            }

            composable("offline") {
                com.hotelpms.pos.ui.offline.OfflineQueueScreen()
            }

            composable("notifications") {
                NotificationsScreen()
            }
        }
    }

    if (showOverflow && layout.overflow.isNotEmpty()) {
        ModalBottomSheet(
            onDismissRequest = { showOverflow = false },
            sheetState = sheetState,
            containerColor = MaterialTheme.colorScheme.surface
        ) {
            Column(modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp)) {
                Text(
                    "Plus d'options",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
                LazyVerticalGrid(
                    columns = GridCells.Fixed(4),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    items(layout.overflow) { item ->
                        OverflowTile(
                            item = item,
                            selected = currentRoute == item.route,
                            onClick = {
                                scope.launch {
                                    sheetState.hide()
                                    showOverflow = false
                                    navigateTo(item.route)
                                }
                            }
                        )
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun OverflowTile(
    item: NavItem,
    selected: Boolean,
    onClick: () -> Unit
) {
    val bg = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant
    val fg = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurfaceVariant
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            modifier = Modifier
                .size(52.dp)
                .clip(CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Surface(
                shape = CircleShape,
                color = bg,
                modifier = Modifier.fillMaxSize()
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(item.icon, contentDescription = item.label, tint = fg)
                }
            }
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            item.label,
            style = MaterialTheme.typography.labelSmall,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}
