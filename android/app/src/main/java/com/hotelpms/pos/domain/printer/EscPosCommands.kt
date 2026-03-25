package com.hotelpms.pos.domain.printer

import android.graphics.Bitmap

/**
 * ESC/POS command constants and helpers for thermal printers.
 */
object EscPosCommands {
    private const val ESC: Byte = 0x1B
    private const val GS: Byte = 0x1D
    private const val LF: Byte = 0x0A

    val INIT = byteArrayOf(ESC, 0x40)
    val ALIGN_CENTER = byteArrayOf(ESC, 0x61, 0x01)
    val ALIGN_LEFT = byteArrayOf(ESC, 0x61, 0x00)
    val ALIGN_RIGHT = byteArrayOf(ESC, 0x61, 0x02)
    val BOLD_ON = byteArrayOf(ESC, 0x45, 0x01)
    val BOLD_OFF = byteArrayOf(ESC, 0x45, 0x00)
    val DOUBLE_HEIGHT = byteArrayOf(ESC, 0x21, 0x10)
    val NORMAL_SIZE = byteArrayOf(ESC, 0x21, 0x00)
    val CUT_PAPER = byteArrayOf(GS, 0x56, 0x00)

    fun feedLines(n: Int): ByteArray = byteArrayOf(ESC, 0x64, n.toByte())

    fun text(s: String): ByteArray = s.toByteArray(Charsets.ISO_8859_1)

    fun line(): ByteArray = byteArrayOf(LF)

    fun separator(cols: Int = 32): ByteArray = text("-".repeat(cols) + "\n")

    /**
     * Convert a Bitmap to ESC/POS raster image bytes (GS v 0).
     */
    fun printBitmap(bitmap: Bitmap, printerWidth: Int = 384): ByteArray {
        val scaled = Bitmap.createScaledBitmap(bitmap, printerWidth, (bitmap.height * printerWidth / bitmap.width), true)
        val width = scaled.width
        val height = scaled.height
        val bytesPerRow = (width + 7) / 8

        val result = mutableListOf<Byte>()
        // GS v 0 m xL xH yL yH
        result.addAll(byteArrayOf(GS, 0x76, 0x30, 0x00).toList())
        result.add((bytesPerRow and 0xFF).toByte())
        result.add((bytesPerRow shr 8 and 0xFF).toByte())
        result.add((height and 0xFF).toByte())
        result.add((height shr 8 and 0xFF).toByte())

        for (y in 0 until height) {
            for (x in 0 until bytesPerRow) {
                var byte = 0
                for (bit in 0 until 8) {
                    val px = x * 8 + bit
                    if (px < width) {
                        val pixel = scaled.getPixel(px, y)
                        val gray = (0.299 * ((pixel shr 16) and 0xFF) +
                                0.587 * ((pixel shr 8) and 0xFF) +
                                0.114 * (pixel and 0xFF)).toInt()
                        if (gray < 128) {
                            byte = byte or (0x80 shr bit)
                        }
                    }
                }
                result.add(byte.toByte())
            }
        }

        if (scaled !== bitmap) scaled.recycle()
        return result.toByteArray()
    }
}
