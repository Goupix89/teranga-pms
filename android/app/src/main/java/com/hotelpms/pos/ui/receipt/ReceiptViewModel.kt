package com.hotelpms.pos.ui.receipt

import android.bluetooth.BluetoothDevice
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import androidx.core.content.FileProvider
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.hotelpms.pos.data.remote.PmsApiService
import com.hotelpms.pos.domain.model.Establishment
import com.hotelpms.pos.domain.model.Order
import com.hotelpms.pos.domain.printer.BluetoothPrinterManager
import com.hotelpms.pos.domain.printer.ReceiptFormatter
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import javax.inject.Inject

data class ReceiptUiState(
    val isLoading: Boolean = false,
    val pdfBytes: ByteArray? = null,
    val previewBitmap: Bitmap? = null,
    val error: String? = null,
    val pairedPrinters: List<BluetoothDevice> = emptyList(),
    val isPrinting: Boolean = false,
    val printResult: String? = null
)

@HiltViewModel
class ReceiptViewModel @Inject constructor(
    private val api: PmsApiService,
    private val printerManager: BluetoothPrinterManager
) : ViewModel() {

    private val _state = MutableStateFlow(ReceiptUiState())
    val state: StateFlow<ReceiptUiState> = _state.asStateFlow()

    fun loadReceipt(orderId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val response = api.getOrderReceipt(orderId)
                if (response.isSuccessful && response.body() != null) {
                    val bytes = response.body()!!.bytes()
                    val bitmap = renderPdfPage(bytes)
                    _state.value = _state.value.copy(
                        isLoading = false,
                        pdfBytes = bytes,
                        previewBitmap = bitmap
                    )
                } else {
                    _state.value = _state.value.copy(
                        isLoading = false,
                        error = "Erreur de chargement du recu"
                    )
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    error = e.message ?: "Erreur inconnue"
                )
            }
        }
    }

    fun loadPairedPrinters() {
        if (!printerManager.isBluetoothEnabled()) {
            _state.value = _state.value.copy(
                pairedPrinters = emptyList(),
                error = "Bluetooth desactive"
            )
            return
        }
        try {
            val printers = printerManager.getPairedPrinters()
            _state.value = _state.value.copy(pairedPrinters = printers)
        } catch (e: SecurityException) {
            _state.value = _state.value.copy(error = "Permission Bluetooth requise")
        }
    }

    fun printToThermal(device: BluetoothDevice, order: Order, establishment: Establishment) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isPrinting = true, printResult = null)
            val receiptData = ReceiptFormatter.formatReceipt(order, establishment)
            val result = printerManager.print(device, receiptData)
            _state.value = _state.value.copy(
                isPrinting = false,
                printResult = if (result.isSuccess) "Impression reussie" else result.exceptionOrNull()?.message
            )
        }
    }

    fun printInvoiceToThermal(
        device: BluetoothDevice,
        invoiceNumber: String,
        items: List<Map<String, Any>>,
        totalAmount: Double,
        tableNumber: String?,
        paymentMethod: String?,
        orderNumbers: List<String>,
        establishment: Establishment
    ) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isPrinting = true, printResult = null)
            val receiptData = ReceiptFormatter.formatInvoiceReceipt(
                invoiceNumber, items, totalAmount, tableNumber, paymentMethod, orderNumbers, establishment
            )
            val result = printerManager.print(device, receiptData)
            _state.value = _state.value.copy(
                isPrinting = false,
                printResult = if (result.isSuccess) "Impression reussie" else result.exceptionOrNull()?.message
            )
        }
    }

    fun loadInvoicePdf(invoiceId: String) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, error = null)
            try {
                val response = api.getInvoicePdf(invoiceId)
                if (response.isSuccessful && response.body() != null) {
                    val bytes = response.body()!!.bytes()
                    val bitmap = renderPdfPage(bytes)
                    _state.value = _state.value.copy(
                        isLoading = false,
                        pdfBytes = bytes,
                        previewBitmap = bitmap
                    )
                } else {
                    _state.value = _state.value.copy(isLoading = false, error = "Erreur chargement facture")
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(isLoading = false, error = e.message ?: "Erreur")
            }
        }
    }

    fun shareReceipt(context: Context, orderNumber: String?) {
        val bytes = _state.value.pdfBytes ?: return
        viewModelScope.launch {
            try {
                val cacheDir = File(context.cacheDir, "receipts")
                cacheDir.mkdirs()
                val file = File(cacheDir, "recu-${orderNumber ?: "commande"}.pdf")
                file.writeBytes(bytes)

                val uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    file
                )

                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = "application/pdf"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_SUBJECT, "Recu ${orderNumber ?: ""}")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                context.startActivity(Intent.createChooser(intent, "Partager le recu"))
            } catch (e: Exception) {
                _state.value = _state.value.copy(error = "Erreur de partage: ${e.message}")
            }
        }
    }

    fun clearMessages() {
        _state.value = _state.value.copy(error = null, printResult = null)
    }

    private fun renderPdfPage(pdfBytes: ByteArray): Bitmap? {
        return try {
            val tempFile = File.createTempFile("receipt", ".pdf")
            tempFile.writeBytes(pdfBytes)
            val fd = ParcelFileDescriptor.open(tempFile, ParcelFileDescriptor.MODE_READ_ONLY)
            val renderer = PdfRenderer(fd)
            val page = renderer.openPage(0)
            val scale = 2f
            val bitmap = Bitmap.createBitmap(
                (page.width * scale).toInt(),
                (page.height * scale).toInt(),
                Bitmap.Config.ARGB_8888
            )
            bitmap.eraseColor(android.graphics.Color.WHITE)
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            page.close()
            renderer.close()
            fd.close()
            tempFile.delete()
            bitmap
        } catch (e: Exception) {
            null
        }
    }
}
