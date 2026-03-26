package com.hotelpms.pos.ui.reservations

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.local.TokenManager
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.QrCodeData
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
    val successMessage: String? = null,
    val qrCodeData: QrCodeData? = null,
    val showQrDialog: Boolean = false,
    val paymentSimulated: Boolean = false
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
                    uiState = uiState.copy(isLoading = false, error = "Impossible de charger les réservations")
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
                    uiState = uiState.copy(isLoading = false, successMessage = "Check-in effectué")
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
                    uiState = uiState.copy(isLoading = false, successMessage = "Check-out effectué")
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
                        "Soumis à validation DAF"
                    } else {
                        "Dates mises à jour"
                    }
                    uiState = uiState.copy(isLoading = false, successMessage = msg)
                    fetchReservations()
                } else {
                    uiState = uiState.copy(isLoading = false, error = response.message ?: "Erreur")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de mise à jour")
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
        numberOfGuests: Int,
        paymentMethod: String
    ) {
        viewModelScope.launch {
            uiState = uiState.copy(isLoading = true)
            try {
                val body = hashMapOf<String, Any>(
                    "roomId" to roomId,
                    "guestName" to guestName,
                    "guestEmail" to guestEmail,
                    "guestPhone" to guestPhone,
                    "checkIn" to checkIn,
                    "checkOut" to checkOut,
                    "numberOfGuests" to numberOfGuests,
                    "paymentMethod" to paymentMethod,
                    "establishmentId" to establishmentId
                )
                val response = api.createReservation(body)
                if (response.success) {
                    uiState = uiState.copy(isLoading = false, successMessage = "Réservation créée — facture générée")
                    fetchReservations()
                    // Auto-show QR code if invoice was generated
                    val invoiceId = response.data?.invoiceId
                    if (invoiceId != null) {
                        showQrCode(invoiceId, paymentMethod)
                    }
                } else {
                    uiState = uiState.copy(isLoading = false, error = response.message ?: "Erreur")
                }
            } catch (e: Exception) {
                uiState = uiState.copy(isLoading = false, error = e.message ?: "Erreur de création")
            }
        }
    }

    fun showQrCode(invoiceId: String, paymentMethod: String? = null) {
        viewModelScope.launch {
            try {
                val response = api.getInvoiceQrCode(invoiceId, paymentMethod)
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body?.data != null) {
                        uiState = uiState.copy(
                            qrCodeData = body.data,
                            showQrDialog = true,
                            paymentSimulated = false
                        )
                    }
                }
            } catch (_: Exception) {}
        }
    }

    fun simulatePayment(invoiceId: String) {
        viewModelScope.launch {
            try {
                val response = api.simulatePayment(invoiceId)
                if (response.isSuccessful) {
                    uiState = uiState.copy(
                        paymentSimulated = true,
                        successMessage = "Paiement simulé avec succès !"
                    )
                    fetchReservations()
                }
            } catch (e: Exception) {
                uiState = uiState.copy(error = e.message ?: "Erreur de simulation")
            }
        }
    }

    fun dismissQrDialog() {
        uiState = uiState.copy(showQrDialog = false, qrCodeData = null, paymentSimulated = false)
    }

    fun clearError() {
        uiState = uiState.copy(error = null)
    }

    fun clearSuccess() {
        uiState = uiState.copy(successMessage = null)
    }
}
