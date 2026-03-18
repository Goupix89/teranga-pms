package com.hotelpms.pos.ui.cleaning

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.local.TokenManager
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.CleaningSession
import com.hotelpms.pos.domain.model.ClockInRequest
import com.hotelpms.pos.domain.model.Room
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CleaningUiState(
    val rooms: List<Room> = emptyList(),
    val sessions: List<CleaningSession> = emptyList(),
    val currentSession: CleaningSession? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null
)

@HiltViewModel
class CleaningViewModel @Inject constructor(
    private val api: PmsApiService,
    private val tokenManager: TokenManager
) : ViewModel() {

    var uiState by mutableStateOf(CleaningUiState())
        private set

    private val establishmentId: String
        get() = tokenManager.establishmentId ?: ""

    init {
        fetchRooms()
        fetchSessions()
    }

    fun fetchRooms() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true)
            try {
                val response = api.getRooms(establishmentId)
                if (response.success) {
                    val cleaningRooms = response.data.filter { it.status == "CLEANING" }
                    uiState = uiState.copy(rooms = cleaningRooms, isLoading = false)
                } else {
                    uiState = uiState.copy(isLoading = false, error = "Impossible de charger les chambres")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de chargement")
            }
        }
    }

    fun fetchSessions() {
        viewModelScope.launch {
            try {
                val response = api.getCleaningSessions(establishmentId)
                if (response.success) {
                    val mySessions = response.data.filter { it.cleanerId == tokenManager.userId }
                    val active = mySessions.find { it.clockOutAt == null }
                    uiState = uiState.copy(
                        sessions = mySessions.filter { it.clockOutAt != null },
                        currentSession = active
                    )
                }
            } catch (e: Exception) {
                uiState = uiState.copy(error = e.message ?: "Erreur de chargement des sessions")
            }
        }
    }

    fun clockIn(roomId: String) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true)
            try {
                val request = ClockInRequest(
                    establishmentId = establishmentId,
                    roomId = roomId
                )
                val response = api.clockIn(request)
                if (response.success) {
                    uiState = uiState.copy(
                        isLoading = false,
                        successMessage = "Pointage d'entr\u00e9e enregistr\u00e9"
                    )
                    fetchSessions()
                    fetchRooms()
                } else {
                    uiState = uiState.copy(isLoading = false, error = response.message ?: "Erreur")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de pointage")
            }
        }
    }

    fun clockOut(sessionId: String) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true)
            try {
                val response = api.clockOut(sessionId)
                if (response.success) {
                    uiState = uiState.copy(
                        isLoading = false,
                        currentSession = null,
                        successMessage = "Pointage de sortie enregistr\u00e9"
                    )
                    fetchSessions()
                    fetchRooms()
                } else {
                    uiState = uiState.copy(isLoading = false, error = response.message ?: "Erreur")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de pointage")
            }
        }
    }

    fun clearError() {
        uiState = uiState.copy(error = null)
    }

    fun clearSuccess() {
        uiState = uiState.copy(successMessage = null)
    }
}
