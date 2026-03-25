package com.hotelpms.pos.domain.printer

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages Bluetooth thermal printer connections and data transmission.
 */
@Singleton
class BluetoothPrinterManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        // Standard SPP (Serial Port Profile) UUID
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    }

    private val bluetoothAdapter: BluetoothAdapter? by lazy {
        val manager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        manager?.adapter
    }

    fun isBluetoothEnabled(): Boolean = bluetoothAdapter?.isEnabled == true

    @SuppressLint("MissingPermission")
    fun getPairedPrinters(): List<BluetoothDevice> {
        return bluetoothAdapter?.bondedDevices?.toList() ?: emptyList()
    }

    @SuppressLint("MissingPermission")
    suspend fun print(device: BluetoothDevice, data: ByteArray): Result<Unit> =
        withContext(Dispatchers.IO) {
            var socket: BluetoothSocket? = null
            try {
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                socket.connect()
                socket.outputStream.write(data)
                socket.outputStream.flush()
                Result.success(Unit)
            } catch (e: IOException) {
                Result.failure(Exception("Erreur d'impression: ${e.message}"))
            } finally {
                try {
                    socket?.close()
                } catch (_: IOException) {}
            }
        }
}
