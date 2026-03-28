package com.hotelpms.pos.ui.auth

import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.messaging.FirebaseMessaging
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.data.repository.PosRepository
import com.hotelpms.pos.domain.model.Establishment
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

data class LoginUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val isLoggedIn: Boolean = false,
    val currentRole: String? = null,
    val currentEstablishment: Establishment? = null,
    val establishments: List<Establishment> = emptyList()
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val repository: PosRepository,
    private val api: PmsApiService,
    private val tokenManager: com.hotelpms.pos.data.local.TokenManager
) : ViewModel() {

    var uiState by mutableStateOf(LoginUiState(isLoggedIn = repository.isLoggedIn))
        private set

    init {
        if (repository.isLoggedIn) {
            fetchEstablishments()
            registerFcmToken()
        }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)

            val result = repository.login(email, password)
            result.fold(
                onSuccess = {
                    uiState = uiState.copy(isLoading = false, isLoggedIn = true)
                    fetchEstablishments()
                    registerFcmToken()
                },
                onFailure = { e ->
                    uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de connexion")
                }
            )
        }
    }

    private fun registerFcmToken() {
        viewModelScope.launch {
            try {
                val fcmToken = FirebaseMessaging.getInstance().token.await()
                api.registerDeviceToken(mapOf("token" to fcmToken, "platform" to "ANDROID"))
            } catch (e: Exception) {
                Log.w("AuthViewModel", "Failed to register FCM token", e)
            }
        }
    }

    fun fetchEstablishments() {
        viewModelScope.launch {
            try {
                val response = api.getEstablishments()
                if (response.success && response.data.isNotEmpty()) {
                    val establishment = response.data.first()
                    val role = establishment.currentUserRole ?: repository.userRole ?: "SERVER"
                    tokenManager.saveEstablishment(establishment.id, role.uppercase())
                    uiState = uiState.copy(
                        establishments = response.data,
                        currentEstablishment = establishment,
                        currentRole = role.uppercase()
                    )
                } else {
                    // Fallback to user role from login
                    uiState = uiState.copy(
                        currentRole = (repository.userRole ?: "SERVER").uppercase()
                    )
                }
            } catch (_: Exception) {
                // Fallback to user role from login
                uiState = uiState.copy(
                    currentRole = (repository.userRole ?: "SERVER").uppercase()
                )
            }
        }
    }

    fun selectEstablishment(establishment: Establishment) {
        val role = establishment.currentUserRole ?: repository.userRole ?: "SERVER"
        tokenManager.saveEstablishment(establishment.id, role.uppercase())
        uiState = uiState.copy(
            currentEstablishment = establishment,
            currentRole = role.uppercase()
        )
    }

    fun logout() {
        viewModelScope.launch {
            try {
                val fcmToken = FirebaseMessaging.getInstance().token.await()
                api.removeDeviceToken(mapOf("token" to fcmToken))
            } catch (_: Exception) { }
        }
        repository.logout()
        uiState = LoginUiState()
    }
}
