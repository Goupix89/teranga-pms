package com.hotelpms.pos.ui.receipt

import android.Manifest
import android.bluetooth.BluetoothDevice
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel
import com.hotelpms.pos.domain.model.Establishment
import com.hotelpms.pos.domain.model.Order

/**
 * Receipt dialog for invoices (including merged invoices).
 * Shows PDF preview and supports thermal printing via Bluetooth.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun InvoiceReceiptScreen(
    order: Order,
    establishment: Establishment,
    onDismiss: () -> Unit,
    viewModel: ReceiptViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    val state by viewModel.state.collectAsState()
    var showPrinterDialog by remember { mutableStateOf(false) }
    var bluetoothPermissionGranted by remember {
        mutableStateOf(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) ==
                        PackageManager.PERMISSION_GRANTED
            } else true
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        bluetoothPermissionGranted = permissions.values.all { it }
        if (bluetoothPermissionGranted) {
            viewModel.loadPairedPrinters()
            showPrinterDialog = true
        }
    }

    // If the order has an invoiceId, load the invoice PDF; otherwise fall back to order receipt
    val hasInvoice = order.invoiceId != null

    LaunchedEffect(order.id) {
        if (hasInvoice) {
            viewModel.loadInvoicePdf(order.invoiceId!!)
        } else {
            viewModel.loadReceipt(order.id)
        }
    }

    // Build invoice items from order items for thermal printing
    val invoiceItems: List<Map<String, Any>> = remember(order) {
        order.items?.map { item ->
            mapOf(
                "name" to (item.article?.name ?: "Article"),
                "quantity" to item.quantity,
                "unitPrice" to item.unitPrice
            )
        } ?: emptyList()
    }

    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Surface(
            modifier = Modifier
                .fillMaxWidth(0.92f)
                .fillMaxHeight(0.85f),
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 6.dp
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                TopAppBar(
                    title = {
                        Text(
                            if (hasInvoice) "Facture" else "Recu ${order.orderNumber ?: ""}",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                    },
                    navigationIcon = {
                        IconButton(onClick = onDismiss) {
                            Icon(Icons.Default.Close, contentDescription = "Fermer")
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = MaterialTheme.colorScheme.surface
                    )
                )

                Box(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .padding(16.dp),
                    contentAlignment = Alignment.Center
                ) {
                    when {
                        state.isLoading -> {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                CircularProgressIndicator()
                                Spacer(Modifier.height(12.dp))
                                Text("Chargement...", style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                        state.error != null -> {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    state.error!!,
                                    color = MaterialTheme.colorScheme.error,
                                    textAlign = TextAlign.Center
                                )
                                Spacer(Modifier.height(12.dp))
                                Button(onClick = {
                                    if (hasInvoice) viewModel.loadInvoicePdf(order.invoiceId!!)
                                    else viewModel.loadReceipt(order.id)
                                }) {
                                    Text("Reessayer")
                                }
                            }
                        }
                        state.previewBitmap != null -> {
                            Image(
                                bitmap = state.previewBitmap!!.asImageBitmap(),
                                contentDescription = "Apercu",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .verticalScroll(rememberScrollState())
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(MaterialTheme.colorScheme.surfaceVariant),
                                contentScale = ContentScale.FillWidth
                            )
                        }
                    }
                }

                // Action buttons
                if (state.pdfBytes != null) {
                    HorizontalDivider()
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceEvenly
                    ) {
                        OutlinedButton(
                            onClick = { viewModel.shareReceipt(context, order.orderNumber) }
                        ) {
                            Icon(Icons.Default.Share, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("Partager")
                        }

                        Button(
                            onClick = {
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !bluetoothPermissionGranted) {
                                    permissionLauncher.launch(
                                        arrayOf(
                                            Manifest.permission.BLUETOOTH_CONNECT,
                                            Manifest.permission.BLUETOOTH_SCAN
                                        )
                                    )
                                } else {
                                    viewModel.loadPairedPrinters()
                                    showPrinterDialog = true
                                }
                            },
                            enabled = !state.isPrinting
                        ) {
                            if (state.isPrinting) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(18.dp),
                                    strokeWidth = 2.dp,
                                    color = MaterialTheme.colorScheme.onPrimary
                                )
                            } else {
                                Icon(Icons.Default.Print, contentDescription = null, modifier = Modifier.size(18.dp))
                            }
                            Spacer(Modifier.width(6.dp))
                            Text(if (state.isPrinting) "Impression..." else "Imprimer")
                        }
                    }
                }

                state.printResult?.let { msg ->
                    Snackbar(
                        modifier = Modifier.padding(8.dp),
                        action = {
                            TextButton(onClick = { viewModel.clearMessages() }) {
                                Text("OK")
                            }
                        }
                    ) {
                        Text(msg)
                    }
                }
            }
        }
    }

    // Printer selection dialog
    if (showPrinterDialog) {
        PrinterSelectionDialog(
            printers = state.pairedPrinters,
            onSelect = { device ->
                showPrinterDialog = false
                if (hasInvoice) {
                    // Thermal print as invoice receipt
                    viewModel.printInvoiceToThermal(
                        device = device,
                        invoiceNumber = order.orderNumber ?: order.id.take(8),
                        items = invoiceItems,
                        totalAmount = order.totalAmount,
                        tableNumber = order.tableNumber,
                        paymentMethod = order.paymentMethod,
                        orderNumbers = listOfNotNull(order.orderNumber),
                        establishment = establishment
                    )
                } else {
                    viewModel.printToThermal(device, order, establishment)
                }
            },
            onDismiss = { showPrinterDialog = false }
        )
    }
}

@Composable
private fun PrinterSelectionDialog(
    printers: List<BluetoothDevice>,
    onSelect: (BluetoothDevice) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Choisir une imprimante") },
        text = {
            if (printers.isEmpty()) {
                Text(
                    "Aucune imprimante Bluetooth appairee.\n\nAllez dans Parametres > Bluetooth pour appairer votre imprimante thermique.",
                    style = MaterialTheme.typography.bodyMedium
                )
            } else {
                Column {
                    printers.forEach { device ->
                        @Suppress("MissingPermission")
                        val name = try { device.name ?: device.address } catch (_: SecurityException) { device.address }
                        TextButton(
                            onClick = { onSelect(device) },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Icon(Icons.Default.Print, contentDescription = null, modifier = Modifier.size(20.dp))
                            Spacer(Modifier.width(8.dp))
                            Text(name, modifier = Modifier.weight(1f))
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Fermer")
            }
        }
    )
}
