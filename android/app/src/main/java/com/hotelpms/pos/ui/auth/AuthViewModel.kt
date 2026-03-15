package com.hotelpms.pos.ui.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.repository.PosRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val isLoading: Boolean = false,
    val error: String? = null,
    val isLoggedIn: Boolean = false
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val repository: PosRepository
) : ViewModel() {

    var uiState by mutableStateOf(LoginUiState(isLoggedIn = repository.isLoggedIn))
        private set

    fun login(email: String, password: String) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)

            val result = repository.login(email, password)
            result.fold(
                onSuccess = {
                    uiState = uiState.copy(isLoading = false, isLoggedIn = true)
                },
                onFailure = { e ->
                    uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de connexion")
                }
            )
        }
    }

    fun logout() {
        repository.logout()
        uiState = LoginUiState()
    }
}
