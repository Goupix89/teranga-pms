package com.hotelpms.pos.ui.cleaning

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
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
import com.hotelpms.pos.domain.model.CleaningSession
import com.hotelpms.pos.domain.model.Room
import com.hotelpms.pos.ui.theme.*
import kotlinx.coroutines.delay

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CleaningScreen(
    viewModel: CleaningViewModel = hiltViewModel()
) {
    val state = viewModel.uiState
    val snackbarHostState = remember { SnackbarHostState() }

    var elapsedMinutes by remember { mutableStateOf(0L) }
    LaunchedEffect(state.currentSession) {
        if (state.currentSession != null) {
            while (true) {
                delay(60_000L)
                elapsedMinutes++
            }
        } else {
            elapsedMinutes = 0L
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
                title = { Text("Nettoyage") },
                actions = {
                    IconButton(onClick = {
                        viewModel.fetchRooms()
                        viewModel.fetchSessions()
                    }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rafra\u00eechir")
                    }
                }
            )
        }
    ) { padding ->
        if (state.isLoading && state.rooms.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
        } else {
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    ClockSection(
                        currentSession = state.currentSession,
                        elapsedMinutes = elapsedMinutes,
                        isLoading = state.isLoading,
                        onClockOut = { sessionId -> viewModel.clockOut(sessionId) }
                    )
                }

                item {
                    Text(
                        "Chambres \u00e0 nettoyer",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }

                if (state.rooms.isEmpty()) {
                    item {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = VertBeninoisContainer)
                        ) {
                            Row(
                                modifier = Modifier.padding(16.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Icon(Icons.Default.CheckCircle, contentDescription = null, tint = VertBeninois)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    "Aucune chambre \u00e0 nettoyer",
                                    style = MaterialTheme.typography.bodyLarge,
                                    color = VertBeninoisDark
                                )
                            }
                        }
                    }
                } else {
                    item {
                        RoomGrid(
                            rooms = state.rooms,
                            currentSession = state.currentSession,
                            onClockIn = { roomId -> viewModel.clockIn(roomId) }
                        )
                    }
                }

                item {
                    Text(
                        "Mes sessions du jour",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }

                if (state.sessions.isEmpty()) {
                    item {
                        Text(
                            "Aucune session compl\u00e9t\u00e9e aujourd'hui",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                } else {
                    items(state.sessions) { session ->
                        SessionRow(session)
                    }
                }

                item { Spacer(modifier = Modifier.height(16.dp)) }
            }
        }
    }
}

@Composable
private fun ClockSection(
    currentSession: CleaningSession?,
    elapsedMinutes: Long,
    isLoading: Boolean,
    onClockOut: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = if (currentSession != null) RougeDahomeyContainer else VertBeninoisContainer
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (currentSession != null) {
                Icon(
                    Icons.Default.Timer,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = RougeDahomey
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Session en cours",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = RougeDahomey
                )
                Text(
                    "Chambre ${currentSession.room?.number ?: currentSession.roomId}",
                    style = MaterialTheme.typography.bodyLarge,
                    color = RougeDahomeyDark
                )
                Text(
                    "Dur\u00e9e : ${formatDuration(elapsedMinutes)}",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = RougeDahomey,
                    modifier = Modifier.padding(vertical = 8.dp)
                )
                Button(
                    onClick = { onClockOut(currentSession.id) },
                    colors = ButtonDefaults.buttonColors(containerColor = RougeDahomey),
                    enabled = !isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(24.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                    } else {
                        Icon(Icons.Default.Logout, contentDescription = null)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Pointer sortie", style = MaterialTheme.typography.titleMedium)
                    }
                }
            } else {
                Icon(
                    Icons.Default.CleaningServices,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = VertBeninois
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    "Pr\u00eat \u00e0 travailler",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = VertBeninoisDark
                )
                Text(
                    "S\u00e9lectionnez une chambre ci-dessous pour commencer",
                    style = MaterialTheme.typography.bodyMedium,
                    color = VertBeninoisDark
                )
            }
        }
    }
}

@Composable
private fun RoomGrid(
    rooms: List<Room>,
    currentSession: CleaningSession?,
    onClockIn: (String) -> Unit
) {
    LazyVerticalGrid(
        columns = GridCells.Adaptive(minSize = 140.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.heightIn(max = 400.dp)
    ) {
        items(rooms) { room ->
            RoomCleaningCard(
                room = room,
                enabled = currentSession == null,
                onClockIn = { onClockIn(room.id) }
            )
        }
    }
}

@Composable
private fun RoomCleaningCard(
    room: Room,
    enabled: Boolean,
    onClockIn: () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = OrBeninoisContainer)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = room.number,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = OrBeninoisDark
            )
            Text(
                text = "\u00c9tage ${room.floor}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = room.type,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(8.dp))
            Button(
                onClick = onClockIn,
                enabled = enabled,
                colors = ButtonDefaults.buttonColors(containerColor = VertBeninois),
                modifier = Modifier.fillMaxWidth(),
                contentPadding = PaddingValues(vertical = 8.dp)
            ) {
                Icon(Icons.Default.Login, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Pointer entr\u00e9e", style = MaterialTheme.typography.labelMedium)
            }
        }
    }
}

@Composable
private fun SessionRow(session: CleaningSession) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Default.CheckCircle,
                contentDescription = null,
                tint = VertBeninois,
                modifier = Modifier.size(24.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "Chambre ${session.room?.number ?: session.roomId}",
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    "D\u00e9but : ${formatTime(session.clockInAt)} — Fin : ${formatTime(session.clockOutAt ?: "")}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            session.durationMinutes?.let { duration ->
                Text(
                    "${duration} min",
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    color = BronzeAbomey
                )
            }
        }
    }
}

private fun formatDuration(minutes: Long): String {
    val hours = minutes / 60
    val mins = minutes % 60
    return if (hours > 0) "${hours}h ${mins}min" else "${mins}min"
}

private fun formatTime(isoString: String): String {
    if (isoString.isBlank()) return "--:--"
    return try {
        val timePart = isoString.substringAfter("T").substringBefore(".")
        timePart.substring(0, 5)
    } catch (e: Exception) {
        "--:--"
    }
}
