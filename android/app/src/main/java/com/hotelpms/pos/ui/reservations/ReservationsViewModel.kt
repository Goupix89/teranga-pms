package com.hotelpms.pos.ui.reservations

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.local.TokenManager
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.Reservation
import com.hotelpms.pos.domain.model.ReservationDatesRequest
import com.hotelpms.pos.domain.model.Room
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ReservationsUiState(
    val reservations: List<Reservation> = emptyList(),
    val rooms: List<Room> = emptyList(),
    val userRole: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val successMessage: String? = null
)

@HiltViewModel
class ReservationsViewModel @Inject constructor(
    private val api: PmsApiService,
    private val tokenManager: TokenManager
) : ViewModel() {

    var uiState by mutableStateOf(ReservationsUiState())
        private set

    private val establishmentId: String
        get() = tokenManager.establishmentId ?: ""

    init {
        uiState = uiState.copy(userRole = tokenManager.establishmentRole ?: "")
        fetchReservations()
        fetchRooms()
    }

    fun fetchReservations() {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true, error = null)
            try {
                val response = api.getReservations(establishmentId)
                if (response.success) {
                    uiState = uiState.copy(
                        reservations = response.data,
                        isLoading = false
                    )
                } else {
                    uiState = uiState.copy(isLoading = false, error = "Impossible de charger les r\u00e9servations")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de chargement")
            }
        }
    }

    private fun fetchRooms() {
        viewModelScope.launch {
            try {
                val response = api.getRooms(establishmentId)
                if (response.success) {
                    uiState = uiState.copy(rooms = response.data)
                }
            } catch (_: Exception) {}
        }
    }

    fun checkIn(id: String) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true)
            try {
                val response = api.checkIn(id)
                if (response.success) {
                    uiState = uiState.copy(isLoading = false, successMessage = "Check-in effectu\u00e9")
                    fetchReservations()
                } else {
                    uiState = uiState.copy(isLoading = false, error = response.message ?: "Erreur")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de check-in")
            }
        }
    }

    fun checkOut(id: String) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true)
            try {
                val response = api.checkOut(id)
                if (response.success) {
                    uiState = uiState.copy(isLoading = false, successMessage = "Check-out effectu\u00e9")
                    fetchReservations()
                } else {
                    uiState = uiState.copy(isLoading = false, error = response.message ?: "Erreur")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de check-out")
            }
        }
    }

    fun updateDates(id: String, checkIn: String, checkOut: String) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true)
            try {
                val request = ReservationDatesRequest(checkIn = checkIn, checkOut = checkOut)
                val response = api.updateReservationDates(id, request)
                if (response.success) {
                    val msg = if (uiState.userRole.uppercase() == "MANAGER") {
                        "Soumis \u00e0 validation DAF"
                    } else {
                        "Dates mises \u00e0 jour"
                    }
                    uiState = uiState.copy(isLoading = false, successMessage = msg)
                    fetchReservations()
                } else {
                    uiState = uiState.copy(isLoading = false, error = response.message ?: "Erreur")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de mise \u00e0 jour")
            }
        }
    }

    fun create(
        roomId: String,
        guestName: String,
        guestEmail: String,
        guestPhone: String,
        checkIn: String,
        checkOut: String,
        numberOfGuests: Int
    ) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true)
            try {
                val body = mapOf<String, Any>(
                    "roomId" to roomId,
                    "guestName" to guestName,
                    "guestEmail" to guestEmail,
                    "guestPhone" to guestPhone,
                    "checkIn" to checkIn,
                    "checkOut" to checkOut,
                    "numberOfGuests" to numberOfGuests,
                    "establishmentId" to establishmentId
                )
                val response = api.createReservation(body)
                if (response.success) {
                    uiState = uiState.copy(isLoading = false, successMessage = "R\u00e9servation cr\u00e9\u00e9e")
                    fetchReservations()
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
