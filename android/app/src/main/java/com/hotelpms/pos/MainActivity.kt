package com.hotelpms.pos

import android.app.Application
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.hotelpms.pos.ui.auth.AuthViewModel
import com.hotelpms.pos.ui.auth.LoginScreen
import com.hotelpms.pos.ui.pos.PosScreen
import dagger.hilt.android.AndroidEntryPoint
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class PmsApplication : Application()

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = androidx.compose.ui.graphics.Color(0xFF0066D0),
                    onPrimary = androidx.compose.ui.graphics.Color.White,
                    primaryContainer = androidx.compose.ui.graphics.Color(0xFFDFEEFF),
                    secondary = androidx.compose.ui.graphics.Color(0xFFF06306),
                    surface = androidx.compose.ui.graphics.Color.White,
                    error = androidx.compose.ui.graphics.Color(0xFFDC2626),
                )
            ) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    PmsNavigation()
                }
            }
        }
    }
}

@Composable
fun PmsNavigation() {
    val navController = rememberNavController()
    val authViewModel: AuthViewModel = hiltViewModel()
    val authState = authViewModel.uiState

    val startDestination = if (authState.isLoggedIn) "pos" else "login"

    NavHost(navController = navController, startDestination = startDestination) {
        composable("login") {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate("pos") {
                        popUpTo("login") { inclusive = true }
                    }
                },
                viewModel = authViewModel
            )
        }

        composable("pos") {
            PosScreen(
                onLogout = {
                    authViewModel.logout()
                    navController.navigate("login") {
                        popUpTo("pos") { inclusive = true }
                    }
                }
            )
        }
    }
}
