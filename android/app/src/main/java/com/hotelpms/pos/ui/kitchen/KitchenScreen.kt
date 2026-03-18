package com.hotelpms.pos.ui.kitchen

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.hotelpms.pos.domain.model.Order
import com.hotelpms.pos.ui.theme.*
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KitchenScreen(viewModel: KitchenViewModel = hiltViewModel()) {
    val uiState = viewModel.uiState

    // Auto-refresh every 15 seconds
    LaunchedEffect(Unit) {
        while (true) {
            delay(15_000)
            viewModel.fetchOrders()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Cuisine",
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp
                    )
                },
                actions = {
                    IconButton(onClick = { viewModel.fetchOrders() }) {
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
            // Error snackbar
            if (uiState.error != null) {
                Snackbar(
                    modifier = Modifier.padding(8.dp),
                    action = {
                        TextButton(onClick = { viewModel.clearError() }) {
                            Text("OK", color = Color.White)
                        }
                    },
                    containerColor = RougeDahomey
                ) {
                    Text(uiState.error, color = Color.White)
                }
            }

            // Loading indicator
            if (uiState.isLoading) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth(),
                    color = OrBeninois
                )
            }

            // Column headers
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                KitchenColumnHeader(
                    title = "En attente",
                    count = uiState.pendingOrders.size,
                    color = OrBeninois,
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(4.dp))
                KitchenColumnHeader(
                    title = "En cours",
                    count = uiState.inProgressOrders.size,
                    color = RougeDahomey,
                    modifier = Modifier.weight(1f)
                )
                Spacer(modifier = Modifier.width(4.dp))
                KitchenColumnHeader(
                    title = "Prete",
                    count = uiState.readyOrders.size,
                    color = VertBeninois,
                    modifier = Modifier.weight(1f)
                )
            }

            // 3-column layout
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 4.dp)
            ) {
                // PENDING column
                KitchenColumn(
                    orders = uiState.pendingOrders,
                    statusColor = OrBeninois,
                    actionLabel = "Commencer",
                    actionColor = RougeDahomey,
                    onAction = { orderId -> viewModel.updateOrderStatus(orderId, "IN_PROGRESS") },
                    modifier = Modifier.weight(1f)
                )

                Spacer(modifier = Modifier.width(4.dp))

                // IN_PROGRESS column
                KitchenColumn(
                    orders = uiState.inProgressOrders,
                    statusColor = RougeDahomey,
                    actionLabel = "Prete !",
                    actionColor = VertBeninois,
                    onAction = { orderId -> viewModel.updateOrderStatus(orderId, "READY") },
                    modifier = Modifier.weight(1f)
                )

                Spacer(modifier = Modifier.width(4.dp))

                // READY column (no action for Cook)
                KitchenColumn(
                    orders = uiState.readyOrders,
                    statusColor = VertBeninois,
                    actionLabel = null,
                    actionColor = null,
                    onAction = null,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

@Composable
private fun KitchenColumnHeader(
    title: String,
    count: Int,
    color: Color,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier,
        color = color.copy(alpha = 0.15f),
        shape = MaterialTheme.shapes.small
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Text(
                text = title,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp,
                color = TerreFon
            )
            Spacer(modifier = Modifier.width(6.dp))
            Badge(containerColor = color) {
                Text(
                    text = count.toString(),
                    color = Color.White,
                    fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

@Composable
private fun KitchenColumn(
    orders: List<Order>,
    statusColor: Color,
    actionLabel: String?,
    actionColor: Color?,
    onAction: ((String) -> Unit)?,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier.fillMaxHeight(),
        contentPadding = PaddingValues(vertical = 4.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        items(orders, key = { it.id }) { order ->
            KitchenOrderCard(
                order = order,
                statusColor = statusColor,
                actionLabel = actionLabel,
                actionColor = actionColor,
                onAction = onAction
            )
        }
    }
}

@Composable
private fun KitchenOrderCard(
    order: Order,
    statusColor: Color,
    actionLabel: String?,
    actionColor: Color?,
    onAction: ((String) -> Unit)?
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CremeGanvie),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column {
            // Colored top border
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .background(statusColor)
            )

            Column(modifier = Modifier.padding(10.dp)) {
                // Order number and table
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = order.orderNumber ?: "---",
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = TerreFon
                    )
                    if (order.tableNumber != null) {
                        Surface(
                            color = BronzeAbomey.copy(alpha = 0.15f),
                            shape = MaterialTheme.shapes.extraSmall
                        ) {
                            Text(
                                text = "Table ${order.tableNumber}",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = BronzeAbomeyDark,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(6.dp))

                // Time since creation
                val timeSince = formatTimeSince(order.createdAt)
                if (timeSince.isNotEmpty()) {
                    Text(
                        text = timeSince,
                        fontSize = 11.sp,
                        color = BronzeAbomey
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                }

                HorizontalDivider(color = Outline)
                Spacer(modifier = Modifier.height(6.dp))

                // Items list
                order.items?.forEach { item ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = item.article?.name ?: "Article",
                            fontSize = 13.sp,
                            color = TerreFon,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f)
                        )
                        Surface(
                            color = statusColor.copy(alpha = 0.2f),
                            shape = MaterialTheme.shapes.extraSmall
                        ) {
                            Text(
                                text = "x${item.quantity}",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = TerreFon,
                                modifier = Modifier.padding(horizontal = 6.dp, vertical = 1.dp)
                            )
                        }
                    }
                }

                // Action button
                if (actionLabel != null && actionColor != null && onAction != null) {
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(
                        onClick = { onAction(order.id) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = actionColor),
                        contentPadding = PaddingValues(vertical = 8.dp)
                    ) {
                        Text(
                            text = actionLabel,
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = Color.White
                        )
                    }
                }
            }
        }
    }
}

private fun formatTimeSince(dateString: String?): String {
    if (dateString == null) return ""

    return try {
        val formats = listOf(
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.getDefault()),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.getDefault()),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ", Locale.getDefault())
        )
        formats.forEach { it.timeZone = TimeZone.getTimeZone("UTC") }

        var date: Date? = null
        for (fmt in formats) {
            try {
                date = fmt.parse(dateString)
                if (date != null) break
            } catch (_: Exception) { }
        }

        if (date == null) return ""

        val now = System.currentTimeMillis()
        val diff = now - date.time
        val minutes = diff / 60_000
        val hours = minutes / 60

        when {
            minutes < 1 -> "A l'instant"
            minutes < 60 -> "Il y a ${minutes} min"
            hours < 24 -> "Il y a ${hours}h ${minutes % 60}min"
            else -> "Il y a ${hours / 24}j"
        }
    } catch (_: Exception) {
        ""
    }
}
