package com.hotelpms.pos

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CleaningServices
import androidx.compose.material.icons.outlined.Inventory
import androidx.compose.material.icons.outlined.KingBed
import androidx.compose.material.icons.outlined.LocalDining
import androidx.compose.material.icons.outlined.PointOfSale
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
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
import com.hotelpms.pos.ui.kitchen.KitchenScreen
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
    NavItem("reservations", "Réservations", Icons.Outlined.CalendarMonth),
    NavItem("cleaning", "Ménage", Icons.Outlined.CleaningServices),
    NavItem("stock", "Stock", Icons.Outlined.Inventory),
    NavItem("approvals", "Approbations", Icons.Default.CheckCircle),
    NavItem("pos", "POS", Icons.Outlined.PointOfSale)
)

fun navItemsForRole(role: String): List<NavItem> {
    val allowedRoutes = when (role.uppercase()) {
        "COOK" -> listOf("dashboard", "kitchen")
        "SERVER" -> listOf("dashboard", "orders", "pos")
        "CLEANER" -> listOf("dashboard", "cleaning")
        "MANAGER" -> listOf("dashboard", "rooms", "reservations", "orders", "stock", "approvals", "pos")
        "DAF" -> listOf("dashboard", "rooms", "reservations", "orders", "stock", "approvals")
        "OWNER" -> listOf("dashboard", "rooms", "reservations", "orders", "stock", "approvals")
        "SUPERADMIN" -> listOf("dashboard", "orders", "kitchen", "rooms", "reservations", "cleaning", "stock", "approvals", "pos")
        else -> listOf("dashboard", "orders", "pos")
    }
    return allNavItems.filter { it.route in allowedRoutes }
}

// =============================================================================
// Activity
// =============================================================================

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
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
    val navItems = navItemsForRole(role)

    val userName = authViewModel.uiState.currentEstablishment?.name ?: "Teranga PMS"

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
                navItems.forEach { item ->
                    NavigationBarItem(
                        icon = { Icon(item.icon, contentDescription = item.label) },
                        label = { Text(item.label) },
                        selected = currentRoute == item.route,
                        onClick = {
                            if (currentRoute != item.route) {
                                innerNavController.navigate(item.route) {
                                    popUpTo(innerNavController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        }
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
                OrdersScreen()
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

            composable("approvals") {
                ApprovalsScreen()
            }

            composable("pos") {
                PosScreen(onLogout = onLogout)
            }
        }
    }
}
