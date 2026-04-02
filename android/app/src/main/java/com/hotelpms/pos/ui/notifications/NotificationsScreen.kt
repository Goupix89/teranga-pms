package com.hotelpms.pos.ui.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hotelpms.pos.domain.model.Notification
import com.hotelpms.pos.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    viewModel: NotificationsViewModel = hiltViewModel()
) {
    val state = viewModel.uiState

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Notifications", fontWeight = FontWeight.Bold, fontSize = 22.sp)
                        if (state.unreadCount > 0) {
                            Spacer(Modifier.width(8.dp))
                            Badge(containerColor = RougeDahomey) {
                                Text("${state.unreadCount}")
                            }
                        }
                    }
                },
                actions = {
                    if (state.unreadCount > 0) {
                        TextButton(onClick = { viewModel.markAllAsRead() }) {
                            Text("Tout lire", color = OrBeninois, fontWeight = FontWeight.Bold)
                        }
                    }
                    IconButton(onClick = { viewModel.fetchNotifications() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rafraichir")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = TerreFon,
                    titleContentColor = SableOuidah,
                    actionIconContentColor = SableOuidah
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(SableOuidah)
        ) {
            if (state.error != null) {
                Snackbar(
                    modifier = Modifier.padding(8.dp),
                    action = { TextButton(onClick = { viewModel.clearError() }) { Text("OK", color = Color.White) } },
                    containerColor = RougeDahomey
                ) { Text(state.error, color = Color.White) }
            }

            if (state.isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = RougeDahomey)
                }
            } else if (state.notifications.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.NotificationsNone,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = BronzeAbomey
                        )
                        Spacer(Modifier.height(12.dp))
                        Text("Aucune notification", fontSize = 16.sp, color = BronzeAbomey)
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    items(state.notifications, key = { it.id }) { notification ->
                        NotificationCard(
                            notification = notification,
                            onMarkRead = { viewModel.markAsRead(notification.id) }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun NotificationCard(
    notification: Notification,
    onMarkRead: () -> Unit
) {
    val icon = when {
        notification.type.contains("ORDER", ignoreCase = true) -> Icons.Default.ShoppingCart
        notification.type.contains("PAYMENT", ignoreCase = true) -> Icons.Default.Payment
        notification.type.contains("RESERVATION", ignoreCase = true) -> Icons.Default.CalendarMonth
        notification.type.contains("CLEANING", ignoreCase = true) -> Icons.Default.CleaningServices
        notification.type.contains("APPROVAL", ignoreCase = true) -> Icons.Default.CheckCircle
        notification.type.contains("STOCK", ignoreCase = true) -> Icons.Default.Inventory
        else -> Icons.Default.Notifications
    }

    val iconColor = when {
        notification.type.contains("ORDER", ignoreCase = true) -> OrBeninois
        notification.type.contains("PAYMENT", ignoreCase = true) -> VertBeninois
        notification.type.contains("APPROVAL", ignoreCase = true) -> RougeDahomey
        else -> BronzeAbomey
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { if (!notification.isRead) onMarkRead() },
        colors = CardDefaults.cardColors(
            containerColor = if (notification.isRead) CremeGanvie else CremeGanvie.copy(alpha = 1f)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (notification.isRead) 1.dp else 3.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            // Unread indicator + icon
            Box(contentAlignment = Alignment.TopEnd) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(iconColor.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(22.dp))
                }
                if (!notification.isRead) {
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(RougeDahomey)
                    )
                }
            }

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = notification.title,
                    fontWeight = if (notification.isRead) FontWeight.Normal else FontWeight.Bold,
                    fontSize = 14.sp,
                    color = TerreFon,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                if (notification.body != null) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = notification.body,
                        fontSize = 12.sp,
                        color = BronzeAbomey,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    text = formatNotificationTime(notification.createdAt),
                    fontSize = 11.sp,
                    color = BronzeAbomeyLight
                )
            }
        }
    }
}

private fun formatNotificationTime(dateString: String?): String {
    if (dateString == null) return ""
    return try {
        val formats = listOf(
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault())
        )
        formats.forEach { it.timeZone = TimeZone.getTimeZone("UTC") }
        var date: Date? = null
        for (fmt in formats) {
            try { date = fmt.parse(dateString); if (date != null) break } catch (_: Exception) {}
        }
        if (date == null) return ""

        val now = System.currentTimeMillis()
        val diff = now - date.time
        val minutes = diff / 60000
        val hours = minutes / 60
        val days = hours / 24

        when {
            minutes < 1 -> "A l'instant"
            minutes < 60 -> "Il y a ${minutes}min"
            hours < 24 -> "Il y a ${hours}h"
            days < 7 -> "Il y a ${days}j"
            else -> SimpleDateFormat("dd/MM/yyyy HH:mm", Locale.getDefault()).format(date)
        }
    } catch (_: Exception) { "" }
}
