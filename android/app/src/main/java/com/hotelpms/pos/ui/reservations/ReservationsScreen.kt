package com.hotelpms.pos.ui.reservations

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hotelpms.pos.domain.model.Reservation
import com.hotelpms.pos.domain.model.Room
import com.hotelpms.pos.ui.theme.*
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReservationsScreen(
    viewModel: ReservationsViewModel = hiltViewModel()
) {
    val state = viewModel.uiState
    val snackbarHostState = remember { SnackbarHostState() }
    var showCreateDialog by remember { mutableStateOf(false) }
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

    LaunchedEffect(state.successMessage) {
        state.successMessage?.let {
            snackbarHostState.showSnackbar(it)
            viewModel.clearSuccess()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = { Text("R\u00e9servations") },
                actions = {
                    IconButton(onClick = { viewModel.fetchReservations() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rafra\u00eechir")
                    }
                }
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showCreateDialog = true },
                containerColor = RougeDahomey
            ) {
                Icon(Icons.Default.Add, contentDescription = "Nouvelle r\u00e9servation", tint = Color.White)
            }
        }
    ) { padding ->
        if (state.isLoading && state.reservations.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else if (state.reservations.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.EventBusy,
                        contentDescription = null,
                        modifier = Modifier.size(64.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Aucune r\u00e9servation",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                item { Spacer(modifier = Modifier.height(4.dp)) }
                items(state.reservations) { reservation ->
                    ReservationCard(
                        reservation = reservation,
                        userRole = state.userRole,
                        isLoading = state.isLoading,
                        currencyFormat = currencyFormat,
                        onCheckIn = { viewModel.checkIn(reservation.id) },
                        onCheckOut = { viewModel.checkOut(reservation.id) },
                        onUpdateDates = { checkIn, checkOut ->
                            viewModel.updateDates(reservation.id, checkIn, checkOut)
                        }
                    )
                }
                item { Spacer(modifier = Modifier.height(80.dp)) }
            }
        }
    }

    if (showCreateDialog) {
        CreateReservationDialog(
            rooms = state.rooms,
            onDismiss = { showCreateDialog = false },
            onCreate = { roomId, guestName, email, phone, checkIn, checkOut, guests ->
                showCreateDialog = false
                viewModel.create(roomId, guestName, email, phone, checkIn, checkOut, guests)
            }
        )
    }
}

@Composable
private fun ReservationCard(
    reservation: Reservation,
    userRole: String,
    isLoading: Boolean,
    currencyFormat: NumberFormat,
    onCheckIn: () -> Unit,
    onCheckOut: () -> Unit,
    onUpdateDates: (String, String) -> Unit
) {
    var showDateDialog by remember { mutableStateOf(false) }

    val statusColor = when (reservation.status) {
        "CONFIRMED" -> OrBeninois
        "CHECKED_IN" -> VertBeninois
        "CHECKED_OUT" -> BronzeAbomey
        "CANCELLED" -> RougeDahomey
        else -> BronzeAbomeyLight
    }
    val statusLabel = when (reservation.status) {
        "CONFIRMED" -> "Confirm\u00e9e"
        "CHECKED_IN" -> "Enregistr\u00e9e"
        "CHECKED_OUT" -> "Termin\u00e9e"
        "CANCELLED" -> "Annul\u00e9e"
        else -> reservation.status
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = reservation.guestName,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    reservation.room?.let { room ->
                        Text(
                            text = "Chambre ${room.number}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
                Surface(
                    color = statusColor.copy(alpha = 0.15f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        text = statusLabel,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = statusColor
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Dates
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Default.DateRange,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = "${formatDate(reservation.checkIn)} \u2192 ${formatDate(reservation.checkOut)}",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Price
            reservation.totalPrice?.let { price ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Default.Payments,
                        contentDescription = null,
                        modifier = Modifier.size(16.dp),
                        tint = OrBeninoisDark
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "${currencyFormat.format(price)} FCFA",
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = OrBeninoisDark
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Action buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Manager: modify dates button
                if (userRole.uppercase() == "MANAGER" && reservation.status in listOf("CONFIRMED", "CHECKED_IN")) {
                    IconButton(onClick = { showDateDialog = true }) {
                        Icon(
                            Icons.Default.EditCalendar,
                            contentDescription = "Modifier dates",
                            tint = BronzeAbomey
                        )
                    }
                }

                Spacer(modifier = Modifier.weight(1f))

                when (reservation.status) {
                    "CONFIRMED" -> {
                        Button(
                            onClick = onCheckIn,
                            colors = ButtonDefaults.buttonColors(containerColor = VertBeninois),
                            enabled = !isLoading
                        ) {
                            Icon(Icons.Default.Login, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Check-in")
                        }
                    }
                    "CHECKED_IN" -> {
                        Button(
                            onClick = onCheckOut,
                            colors = ButtonDefaults.buttonColors(containerColor = RougeDahomey),
                            enabled = !isLoading
                        ) {
                            Icon(Icons.Default.Logout, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(4.dp))
                            Text("Check-out")
                        }
                    }
                }
            }
        }
    }

    // Update dates dialog
    if (showDateDialog) {
        UpdateDatesDialog(
            currentCheckIn = reservation.checkIn,
            currentCheckOut = reservation.checkOut,
            onDismiss = { showDateDialog = false },
            onUpdate = { checkIn, checkOut ->
                showDateDialog = false
                onUpdateDates(checkIn, checkOut)
            }
        )
    }
}

@Composable
private fun UpdateDatesDialog(
    currentCheckIn: String,
    currentCheckOut: String,
    onDismiss: () -> Unit,
    onUpdate: (String, String) -> Unit
) {
    var checkIn by remember { mutableStateOf(currentCheckIn.substringBefore("T")) }
    var checkOut by remember { mutableStateOf(currentCheckOut.substringBefore("T")) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Modifier les dates") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = checkIn,
                    onValueChange = { checkIn = it },
                    label = { Text("Date d'arriv\u00e9e (AAAA-MM-JJ)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("2026-03-20") }
                )
                OutlinedTextField(
                    value = checkOut,
                    onValueChange = { checkOut = it },
                    label = { Text("Date de d\u00e9part (AAAA-MM-JJ)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("2026-03-25") }
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onUpdate(checkIn, checkOut) },
                enabled = checkIn.isNotBlank() && checkOut.isNotBlank()
            ) {
                Text("Modifier")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler")
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateReservationDialog(
    rooms: List<Room>,
    onDismiss: () -> Unit,
    onCreate: (String, String, String, String, String, String, Int) -> Unit
) {
    var selectedRoomId by remember { mutableStateOf("") }
    var guestName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var checkIn by remember { mutableStateOf("") }
    var checkOut by remember { mutableStateOf("") }
    var guests by remember { mutableStateOf("1") }
    var roomDropdownExpanded by remember { mutableStateOf(false) }

    val availableRooms = rooms.filter { it.status == "AVAILABLE" }
    val selectedRoom = availableRooms.find { it.id == selectedRoomId }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nouvelle r\u00e9servation") },
        text = {
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                // Room selector
                ExposedDropdownMenuBox(
                    expanded = roomDropdownExpanded,
                    onExpandedChange = { roomDropdownExpanded = it }
                ) {
                    OutlinedTextField(
                        value = selectedRoom?.let { "Chambre ${it.number} - ${it.type}" } ?: "",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Chambre") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = roomDropdownExpanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = roomDropdownExpanded,
                        onDismissRequest = { roomDropdownExpanded = false }
                    ) {
                        availableRooms.forEach { room ->
                            DropdownMenuItem(
                                text = { Text("${room.number} - ${room.type}") },
                                onClick = {
                                    selectedRoomId = room.id
                                    roomDropdownExpanded = false
                                }
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = guestName,
                    onValueChange = { guestName = it },
                    label = { Text("Nom du client") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("T\u00e9l\u00e9phone") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = checkIn,
                    onValueChange = { checkIn = it },
                    label = { Text("Date d'arriv\u00e9e (AAAA-MM-JJ)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("2026-03-20") }
                )
                OutlinedTextField(
                    value = checkOut,
                    onValueChange = { checkOut = it },
                    label = { Text("Date de d\u00e9part (AAAA-MM-JJ)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    placeholder = { Text("2026-03-25") }
                )
                OutlinedTextField(
                    value = guests,
                    onValueChange = { guests = it },
                    label = { Text("Nombre de personnes") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onCreate(
                        selectedRoomId,
                        guestName,
                        email,
                        phone,
                        checkIn,
                        checkOut,
                        guests.toIntOrNull() ?: 1
                    )
                },
                enabled = selectedRoomId.isNotBlank() && guestName.isNotBlank() &&
                        checkIn.isNotBlank() && checkOut.isNotBlank()
            ) {
                Text("Cr\u00e9er")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Annuler")
            }
        }
    )
}

private fun formatDate(isoString: String): String {
    return try {
        val datePart = isoString.substringBefore("T")
        val parts = datePart.split("-")
        if (parts.size == 3) "${parts[2]}/${parts[1]}/${parts[0]}" else datePart
    } catch (e: Exception) {
        isoString
    }
}
