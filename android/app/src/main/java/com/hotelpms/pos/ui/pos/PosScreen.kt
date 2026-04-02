package com.hotelpms.pos.ui.pos

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.hilt.navigation.compose.hiltViewModel
import com.hotelpms.pos.domain.model.CachedArticle
import com.hotelpms.pos.domain.model.CartItem
import com.hotelpms.pos.domain.model.QrCodeData
import com.hotelpms.pos.ui.theme.*
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PosScreen(
    onLogout: () -> Unit,
    viewModel: PosViewModel = hiltViewModel()
) {
    val state = viewModel.uiState
    val articles by viewModel.articles.collectAsState()
    val cartItems by viewModel.cartItems.collectAsState()
    val cartTotal by viewModel.cartTotal.collectAsState()
    val cartCount by viewModel.cartItemCount.collectAsState()
    val pendingCount by viewModel.pendingCount.collectAsState()

    val currencyFormat = remember {
        NumberFormat.getNumberInstance(Locale.FRANCE).apply {
            maximumFractionDigits = 0
            minimumFractionDigits = 0
        }
    }

    val snackbarHostState = remember { SnackbarHostState() }

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

    // QR Code payment dialog
    if (state.showQrCode && state.qrCodeData != null) {
        QrCodePaymentDialog(
            qrData = state.qrCodeData!!,
            onDismiss = { viewModel.dismissQrCode() },
            onSimulatePayment = { invoiceId -> viewModel.simulatePayment(invoiceId) },
            isSimulating = state.isSimulating,
            simulationSuccess = state.simulationSuccess
        )
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "Point de Vente",
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp
                    )
                },
                actions = {
                    if (pendingCount > 0) {
                        Badge(
                            modifier = Modifier.padding(end = 8.dp),
                            containerColor = RougeDahomey
                        ) {
                            Text("$pendingCount")
                        }
                        IconButton(onClick = { viewModel.syncPending() }) {
                            Icon(Icons.Default.Sync, contentDescription = "Synchroniser")
                        }
                    }

                    IconButton(onClick = { viewModel.refreshArticles() }) {
                        Icon(Icons.Default.Refresh, contentDescription = "Rafraichir")
                    }

                    IconButton(onClick = onLogout) {
                        Icon(Icons.Default.Logout, contentDescription = "Deconnexion")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = TerreFon,
                    titleContentColor = SableOuidah,
                    actionIconContentColor = SableOuidah
                )
            )
        },
        bottomBar = {
            if (cartItems.isNotEmpty()) {
                CartBottomBar(
                    itemCount = cartCount,
                    total = cartTotal,
                    isProcessing = state.isProcessing,
                    onCheckout = { viewModel.submitOrder() }
                )
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(SableOuidah)
        ) {
            // Error/Success snackbars inline
            if (state.error != null) {
                Snackbar(
                    modifier = Modifier.padding(8.dp),
                    action = { TextButton(onClick = { viewModel.clearError() }) { Text("OK", color = Color.White) } },
                    containerColor = RougeDahomey
                ) { Text(state.error, color = Color.White) }
            }
            if (state.successMessage != null) {
                Snackbar(
                    modifier = Modifier.padding(8.dp),
                    action = { TextButton(onClick = { viewModel.clearSuccess() }) { Text("OK", color = Color.White) } },
                    containerColor = VertBeninois
                ) { Text(state.successMessage, color = Color.White) }
            }

            // Table number + payment method row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(CremeGanvie)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = state.tableNumber,
                    onValueChange = { viewModel.setTableNumber(it) },
                    label = { Text("Table", fontSize = 12.sp, color = BronzeAbomey) },
                    modifier = Modifier.width(80.dp),
                    singleLine = true,
                    textStyle = LocalTextStyle.current.copy(fontSize = 14.sp, color = TerreFon),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = TerreFon,
                        unfocusedTextColor = TerreFon,
                        cursorColor = RougeDahomey,
                        focusedBorderColor = RougeDahomey,
                        unfocusedBorderColor = BronzeAbomey,
                        focusedLabelColor = RougeDahomey,
                        unfocusedLabelColor = BronzeAbomey
                    )
                )

                val methods = listOf(
                    "CASH" to "Especes",
                    "MOOV_MONEY" to "Flooz",
                    "MIXX_BY_YAS" to "Yas",
                    "FEDAPAY" to "FedaPay"
                )
                methods.forEach { (value, label) ->
                    FilterChip(
                        selected = state.paymentMethod == value,
                        onClick = { viewModel.setPaymentMethod(value) },
                        label = { Text(label, fontSize = 11.sp) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = OrBeninois.copy(alpha = 0.2f),
                            selectedLabelColor = TerreFon
                        )
                    )
                }
            }

            // Search bar
            OutlinedTextField(
                value = state.searchQuery,
                onValueChange = { viewModel.onSearchQueryChange(it) },
                placeholder = { Text("Rechercher un article...", color = BronzeAbomey) },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = BronzeAbomey) },
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                singleLine = true,
                colors = OutlinedTextFieldDefaults.colors(
                    focusedTextColor = TerreFon,
                    unfocusedTextColor = TerreFon,
                    cursorColor = RougeDahomey,
                    focusedBorderColor = RougeDahomey,
                    unfocusedBorderColor = BronzeAbomey
                )
            )

            // Articles grid
            if (state.isLoadingArticles) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = RougeDahomey)
                }
            } else if (articles.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.ShoppingCart,
                            contentDescription = null,
                            modifier = Modifier.size(48.dp),
                            tint = BronzeAbomey
                        )
                        Spacer(Modifier.height(8.dp))
                        Text("Aucun article", fontSize = 16.sp, color = BronzeAbomey)
                    }
                }
            } else {
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    contentPadding = PaddingValues(8.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(articles, key = { it.id }) { article ->
                        val cartQty = cartItems.find { it.article.id == article.id }?.quantity ?: 0
                        ArticleCard(
                            article = article,
                            cartQuantity = cartQty,
                            onAdd = { viewModel.addToCart(article) },
                            onRemove = { viewModel.removeFromCart(article.id) },
                            currencyFormat = currencyFormat
                        )
                    }
                }
            }
        }
    }
}

// =============================================================================
// ARTICLE CARD
// =============================================================================

@Composable
private fun ArticleCard(
    article: CachedArticle,
    cartQuantity: Int,
    onAdd: () -> Unit,
    onRemove: () -> Unit,
    currencyFormat: NumberFormat
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CremeGanvie),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column {
            // Placeholder icon area
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(60.dp)
                    .background(OrBeninois.copy(alpha = 0.08f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    Icons.Default.Restaurant,
                    contentDescription = null,
                    modifier = Modifier.size(28.dp),
                    tint = BronzeAbomey
                )
            }

            Column(modifier = Modifier.padding(10.dp)) {
                Text(
                    text = article.name,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    color = TerreFon,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )

                article.categoryName?.let {
                    Text(
                        text = it,
                        fontSize = 11.sp,
                        color = BronzeAbomey,
                        maxLines = 1
                    )
                }

                Spacer(Modifier.height(6.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "${currencyFormat.format(article.unitPrice)} FCFA",
                            fontWeight = FontWeight.Bold,
                            fontSize = 13.sp,
                            color = RougeDahomey
                        )
                        Text(
                            text = "Stock: ${article.currentStock}",
                            fontSize = 10.sp,
                            color = if (article.currentStock <= 5) RougeDahomey else BronzeAbomey
                        )
                    }

                    if (cartQuantity > 0) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            IconButton(
                                onClick = onRemove,
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(
                                    Icons.Default.Remove,
                                    contentDescription = "Retirer",
                                    modifier = Modifier.size(16.dp),
                                    tint = RougeDahomey
                                )
                            }
                            Surface(
                                color = OrBeninois.copy(alpha = 0.2f),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(
                                    text = "$cartQuantity",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = TerreFon,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 2.dp)
                                )
                            }
                            IconButton(
                                onClick = onAdd,
                                modifier = Modifier.size(28.dp)
                            ) {
                                Icon(
                                    Icons.Default.Add,
                                    contentDescription = "Ajouter",
                                    modifier = Modifier.size(16.dp),
                                    tint = VertBeninois
                                )
                            }
                        }
                    } else {
                        FilledTonalButton(
                            onClick = onAdd,
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            colors = ButtonDefaults.filledTonalButtonColors(
                                containerColor = VertBeninois.copy(alpha = 0.15f),
                                contentColor = VertBeninois
                            )
                        ) {
                            Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                            Spacer(Modifier.width(2.dp))
                            Text("Ajouter", fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

// =============================================================================
// CART BOTTOM BAR
// =============================================================================

@Composable
private fun CartBottomBar(
    itemCount: Int,
    total: Double,
    isProcessing: Boolean,
    onCheckout: () -> Unit
) {
    val currencyFormat = remember {
        NumberFormat.getNumberInstance(Locale.FRANCE).apply {
            maximumFractionDigits = 0
            minimumFractionDigits = 0
        }
    }

    Surface(
        color = TerreFon,
        shadowElevation = 8.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "$itemCount article${if (itemCount > 1) "s" else ""}",
                    fontSize = 12.sp,
                    color = SableOuidah.copy(alpha = 0.7f)
                )
                Text(
                    text = "${currencyFormat.format(total)} FCFA",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = OrBeninois
                )
            }

            Button(
                onClick = onCheckout,
                enabled = !isProcessing,
                colors = ButtonDefaults.buttonColors(containerColor = RougeDahomey),
                contentPadding = PaddingValues(horizontal = 24.dp, vertical = 12.dp)
            ) {
                if (isProcessing) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                    Spacer(Modifier.width(8.dp))
                }
                Icon(Icons.Default.Send, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("Commander", fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }
}

// =============================================================================
// QR CODE PAYMENT DIALOG
// =============================================================================

@Composable
private fun QrCodePaymentDialog(
    qrData: QrCodeData,
    onDismiss: () -> Unit,
    onSimulatePayment: ((String) -> Unit)? = null,
    isSimulating: Boolean = false,
    simulationSuccess: Boolean = false
) {
    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            colors = CardDefaults.cardColors(containerColor = CremeGanvie),
            elevation = CardDefaults.cardElevation(defaultElevation = 8.dp)
        ) {
            Column(
                modifier = Modifier.padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    "QR Code de paiement",
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp,
                    color = TerreFon
                )
                Spacer(Modifier.height(8.dp))

                Text(
                    qrData.invoice?.invoiceNumber ?: "",
                    fontSize = 14.sp,
                    color = BronzeAbomey
                )
                Spacer(Modifier.height(4.dp))

                val amount = qrData.invoice?.totalAmount ?: 0.0
                val fmt = remember {
                    NumberFormat.getNumberInstance(Locale.FRANCE).apply {
                        maximumFractionDigits = 0
                    }
                }
                Text(
                    "${fmt.format(amount)} FCFA",
                    fontWeight = FontWeight.Bold,
                    fontSize = 24.sp,
                    color = RougeDahomey
                )
                Text(
                    "Paiement par ${qrData.paymentLabel ?: ""}",
                    fontSize = 13.sp,
                    color = BronzeAbomey
                )
                Spacer(Modifier.height(16.dp))

                // Decode base64 QR image
                val qrBitmap = remember(qrData.qrCode) {
                    try {
                        val base64Part = qrData.qrCode.substringAfter("base64,")
                        val bytes = Base64.decode(base64Part, Base64.DEFAULT)
                        BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                    } catch (_: Exception) { null }
                }

                if (qrBitmap != null) {
                    Image(
                        bitmap = qrBitmap.asImageBitmap(),
                        contentDescription = "QR Code",
                        modifier = Modifier
                            .size(250.dp)
                            .background(Color.White, MaterialTheme.shapes.medium)
                            .padding(12.dp)
                    )
                } else {
                    Box(
                        modifier = Modifier
                            .size(250.dp)
                            .background(Color.White, MaterialTheme.shapes.medium),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("QR code indisponible", color = Color.Gray, fontSize = 12.sp)
                    }
                }

                Spacer(Modifier.height(12.dp))

                if (qrData.fedapayCheckoutUrl != null) {
                    Text(
                        "Scannez le QR code ou appuyez sur le bouton ci-dessous pour payer via FedaPay.",
                        fontSize = 11.sp, color = BronzeAbomey, textAlign = TextAlign.Center
                    )
                } else {
                    Text(
                        "Le client doit scanner ce QR code avec son application ${qrData.paymentLabel ?: ""} pour effectuer le paiement.",
                        fontSize = 11.sp, color = BronzeAbomey, textAlign = TextAlign.Center
                    )
                }
                Spacer(Modifier.height(16.dp))

                // FedaPay checkout button
                if (qrData.fedapayCheckoutUrl != null) {
                    val uriHandler = LocalUriHandler.current
                    Button(
                        onClick = { uriHandler.openUri(qrData.fedapayCheckoutUrl) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E88E5)),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text("\uD83D\uDCB3 Payer avec FedaPay", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.height(8.dp))
                }

                if (simulationSuccess) {
                    Surface(
                        color = VertBeninois.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(12.dp),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = null, tint = VertBeninois, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Text("Paiement recu !", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = VertBeninois)
                        }
                    }
                    Spacer(Modifier.height(8.dp))
                }

                // Simulate payment button
                if (!simulationSuccess && onSimulatePayment != null && qrData.invoice?.id != null) {
                    Button(
                        onClick = { onSimulatePayment(qrData.invoice.id) },
                        enabled = !isSimulating,
                        colors = ButtonDefaults.buttonColors(containerColor = VertBeninois),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        if (isSimulating) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), color = Color.White, strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                        }
                        Text("Simuler le paiement client", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                    Spacer(Modifier.height(8.dp))
                }

                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = RougeDahomey),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Fermer", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
