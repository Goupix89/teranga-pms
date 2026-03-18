package com.hotelpms.pos.ui.rooms

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
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
import com.hotelpms.pos.domain.model.Room
import com.hotelpms.pos.ui.theme.*
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RoomsScreen(
    viewModel: RoomsViewModel = hiltViewModel()
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
                title = { Text("Chambres") },
                actions = {
                    IconButton(onClick = { viewModel.fetchRooms() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rafra\u00eechir")
                    }
                }
            )
        },
        floatingActionButton = {
            if (state.userRole.uppercase() in listOf("MANAGER", "DAF")) {
                FloatingActionButton(
                    onClick = { showCreateDialog = true },
                    containerColor = RougeDahomey
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Nouvelle chambre", tint = Color.White)
                }
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Filter chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                StatusFilterChip(null, "Toutes", state.selectedFilter) { viewModel.setFilter(it) }
                StatusFilterChip("AVAILABLE", "Disponible", state.selectedFilter) { viewModel.setFilter(it) }
                StatusFilterChip("OCCUPIED", "Occup\u00e9e", state.selectedFilter) { viewModel.setFilter(it) }
                StatusFilterChip("CLEANING", "Nettoyage", state.selectedFilter) { viewModel.setFilter(it) }
                StatusFilterChip("MAINTENANCE", "Maintenance", state.selectedFilter) { viewModel.setFilter(it) }
            }

            if (state.isLoading && state.rooms.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            } else if (state.filteredRooms.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "Aucune chambre trouv\u00e9e",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Adaptive(minSize = 160.dp),
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(state.filteredRooms) { room ->
                        RoomCard(room = room, currencyFormat = currencyFormat)
                    }
                }
            }
        }
    }

    // Create room dialog
    if (showCreateDialog) {
        CreateRoomDialog(
            onDismiss = { showCreateDialog = false },
            onCreate = { number, floor, type, price, occupancy ->
                showCreateDialog = false
                viewModel.createRoom(number, floor, type, price, occupancy)
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun StatusFilterChip(
    value: String?,
    label: String,
    selected: String?,
    onClick: (String?) -> Unit
) {
    FilterChip(
        selected = selected == value,
        onClick = { onClick(value) },
        label = { Text(label) },
        leadingIcon = if (value != null) {
            {
                Box(
                    modifier = Modifier.size(8.dp),
                    content = {
                        Surface(
                            modifier = Modifier.size(8.dp),
                            shape = MaterialTheme.shapes.small,
                            color = statusColor(value)
                        ) {}
                    }
                )
            }
        } else null
    )
}

@Composable
private fun RoomCard(room: Room, currencyFormat: NumberFormat) {
    val statusCol = statusColor(room.status)
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = room.number,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )
                Surface(
                    color = statusCol.copy(alpha = 0.15f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        text = translateStatus(room.status),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = statusCol
                    )
                }
            }
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = room.type,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = "\u00c9tage ${room.floor}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "${currencyFormat.format(room.pricePerNight)} FCFA / nuit",
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = OrBeninoisDark
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateRoomDialog(
    onDismiss: () -> Unit,
    onCreate: (String, Int, String, Double, Int) -> Unit
) {
    var number by remember { mutableStateOf("") }
    var floor by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("STANDARD") }
    var price by remember { mutableStateOf("") }
    var occupancy by remember { mutableStateOf("2") }
    var expanded by remember { mutableStateOf(false) }
    val roomTypes = listOf("STANDARD", "SUITE", "DELUXE", "SINGLE", "DOUBLE")

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Nouvelle chambre") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = number,
                    onValueChange = { number = it },
                    label = { Text("Num\u00e9ro") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = floor,
                    onValueChange = { floor = it },
                    label = { Text("\u00c9tage") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                ExposedDropdownMenuBox(
                    expanded = expanded,
                    onExpandedChange = { expanded = it }
                ) {
                    OutlinedTextField(
                        value = type,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Type") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false }
                    ) {
                        roomTypes.forEach { roomType ->
                            DropdownMenuItem(
                                text = { Text(roomType) },
                                onClick = {
                                    type = roomType
                                    expanded = false
                                }
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = price,
                    onValueChange = { price = it },
                    label = { Text("Prix / nuit (FCFA)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                OutlinedTextField(
                    value = occupancy,
                    onValueChange = { occupancy = it },
                    label = { Text("Capacit\u00e9 max") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onCreate(
                        number,
                        floor.toIntOrNull() ?: 0,
                        type,
                        price.toDoubleOrNull() ?: 0.0,
                        occupancy.toIntOrNull() ?: 2
                    )
                },
                enabled = number.isNotBlank() && price.isNotBlank()
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

private fun statusColor(status: String): Color {
    return when (status) {
        "AVAILABLE" -> StatusAvailable
        "OCCUPIED" -> StatusOccupied
        "CLEANING" -> StatusCleaning
        "MAINTENANCE" -> StatusMaintenance
        else -> BronzeAbomey
    }
}

private fun translateStatus(status: String): String {
    return when (status) {
        "AVAILABLE" -> "Disponible"
        "OCCUPIED" -> "Occup\u00e9e"
        "CLEANING" -> "Nettoyage"
        "MAINTENANCE" -> "Maintenance"
        else -> status
    }
}
