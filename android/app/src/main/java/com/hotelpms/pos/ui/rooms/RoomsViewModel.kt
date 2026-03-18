package com.hotelpms.pos.ui.rooms

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.local.TokenManager
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.Room
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RoomsUiState(
    val rooms: List<Room> = emptyList(),
    val filteredRooms: List<Room> = emptyList(),
    val selectedFilter: String? = null,
    val userRole: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null
)

@HiltViewModel
class RoomsViewModel @Inject constructor(
    private val api: PmsApiService,
    private val tokenManager: TokenManager
) : ViewModel() {

    var uiState by mutableStateOf(RoomsUiState())
        private set

    private val establishmentId: String
        get() = tokenManager.establishmentId ?: ""

    init {
        uiState = uiState.copy(userRole = tokenManager.establishmentRole ?: "")
        fetchRooms()
    }

    fun fetchRooms() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)
            try {
                val response = api.getRooms(establishmentId)
                if (response.success) {
                    uiState = uiState.copy(
                        rooms = response.data,
                        isLoading = false
                    )
                    applyFilter(uiState.selectedFilter)
                } else {
                    uiState = uiState.copy(isLoading = false, error = "Impossible de charger les chambres")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de chargement")
            }
        }
    }

    fun setFilter(filter: String?) {
        uiState = uiState.copy(selectedFilter = filter)
        applyFilter(filter)
    }

    private fun applyFilter(filter: String?) {
        val filtered = if (filter == null) {
            uiState.rooms
        } else {
            uiState.rooms.filter { it.status == filter }
        }
        uiState = uiState.copy(filteredRooms = filtered)
    }

    fun createRoom(
        number: String,
        floor: Int,
        type: String,
        pricePerNight: Double,
        maxOccupancy: Int
    ) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true)
            try {
                val body = mapOf<String, Any>(
                    "number" to number,
                    "floor" to floor,
                    "type" to type,
                    "pricePerNight" to pricePerNight,
                    "maxOccupancy" to maxOccupancy,
                    "establishmentId" to establishmentId
                )
                val response = api.createRoom(body)
                if (response.success) {
                    val msg = if (uiState.userRole.uppercase() == "DAF") {
                        "Chambre cr\u00e9\u00e9e avec succ\u00e8s"
                    } else {
                        "Soumis \u00e0 validation DAF"
                    }
                    uiState = uiState.copy(isLoading = false, successMessage = msg)
                    fetchRooms()
                } else {
                    uiState = uiState.copy(isLoading = false, error = response.message ?: "Erreur")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de cr\u00e9ation")
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
