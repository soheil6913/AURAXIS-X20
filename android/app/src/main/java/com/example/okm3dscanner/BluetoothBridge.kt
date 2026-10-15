package com.example.okm3dscanner

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothSocket
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.io.InputStream
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger

/**
 * Real Bluetooth bridge between the Android host and the React web app.
 *
 * Exposed to JavaScript as `window.AuraxisBT`. Supports:
 *  - Bluetooth Classic SPP (RFCOMM) for HC-05 / HC-06 style modules (device must be paired first)
 *  - BLE UART: Nordic UART Service and HM-10 style FFE0/FFE1 (devices found by scanning)
 *
 * No data is simulated here: every byte forwarded to JS came from the remote device.
 * Events are delivered to JS through `window.__auraxisBT(jsonString)`.
 */
@SuppressLint("MissingPermission")
@Suppress("DEPRECATION")
class BluetoothBridge(
    private val activity: Activity,
    private val webView: WebView,
    private val askPermissions: (Array<String>) -> Unit
) {
    private companion object {
        val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        val NUS_SERVICE: UUID = UUID.fromString("6E400001-B5A3-F393-E0A9-E50E24DCCA9E")
        val NUS_RX: UUID = UUID.fromString("6E400002-B5A3-F393-E0A9-E50E24DCCA9E") // write to device
        val NUS_TX: UUID = UUID.fromString("6E400003-B5A3-F393-E0A9-E50E24DCCA9E") // notify from device
        val HM10_SERVICE: UUID = UUID.fromString("0000FFE0-0000-1000-8000-00805F9B34FB")
        val HM10_CHAR: UUID = UUID.fromString("0000FFE1-0000-1000-8000-00805F9B34FB")
        val CCCD: UUID = UUID.fromString("00002902-0000-1000-8000-00805F9B34FB")
        const val SCAN_MS = 10_000L
        const val BLE_CHUNK = 20
    }

    private val main = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val session = AtomicInteger(0)

    private var socket: BluetoothSocket? = null
    private var gatt: BluetoothGatt? = null
    private var gattWriteChar: BluetoothGattCharacteristic? = null
    private var scanCallback: ScanCallback? = null
    private var scanStopper: Runnable? = null

    @Volatile private var connectedMode: String? = null // "SPP" or "BLE"

    // ---------------------------------------------------------------- helpers

    private fun adapter(): BluetoothAdapter? =
        (activity.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

    private fun requiredPermissions(): Array<String> =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            arrayOf(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN)
        } else {
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        }

    private fun missingPermissions(): Array<String> =
        requiredPermissions()
            .filter { activity.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
            .toTypedArray()

    private fun safeName(d: BluetoothDevice): String =
        try { d.name ?: "" } catch (_: SecurityException) { "" }

    private fun emit(obj: JSONObject) {
        val js = "window.__auraxisBT && window.__auraxisBT(${JSONObject.quote(obj.toString())})"
        main.post {
            try { webView.evaluateJavascript(js, null) } catch (_: Exception) { }
        }
    }

    private fun emitError(message: String) =
        emit(JSONObject().put("t", "error").put("message", message))

    private fun emitState(
        connected: Boolean,
        type: String?,
        name: String?,
        address: String?,
        status: String,
        connecting: Boolean = false
    ) {
        emit(
            JSONObject()
                .put("t", "state")
                .put("connected", connected)
                .put("connecting", connecting)
                .put("type", type ?: JSONObject.NULL)
                .put("name", name ?: JSONObject.NULL)
                .put("address", address ?: JSONObject.NULL)
                .put("status", status)
        )
    }

    private fun emitData(bytes: ByteArray) {
        val text = String(bytes, Charsets.UTF_8)
        val hex = bytes.joinToString(" ") { "%02X".format(it) }
        emit(JSONObject().put("t", "data").put("text", text).put("hex", hex))
    }

    // ----------------------------------------------------- JS-visible methods

    @JavascriptInterface
    fun isAvailable(): Boolean = adapter() != null

    @JavascriptInterface
    fun isEnabled(): Boolean = try { adapter()?.isEnabled == true } catch (_: SecurityException) { false }

    @JavascriptInterface
    fun hasPermissions(): Boolean = missingPermissions().isEmpty()

    @JavascriptInterface
    fun requestPermissions() {
        val missing = missingPermissions()
        if (missing.isEmpty()) {
            emit(JSONObject().put("t", "perm").put("granted", true))
        } else {
            main.post { askPermissions(missing) }
        }
    }

    fun onPermissionResult() {
        emit(JSONObject().put("t", "perm").put("granted", hasPermissions()))
    }

    /** Asks the user (system dialog) to turn Bluetooth on if it is off. */
    @JavascriptInterface
    fun enableBluetooth() {
        main.post {
            try {
                if (adapter()?.isEnabled == false) {
                    activity.startActivity(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE))
                }
            } catch (e: Exception) {
                emitError("روشن کردن بلوتوث ممکن نشد: ${e.message ?: e.javaClass.simpleName}")
            }
        }
    }

    @JavascriptInterface
    fun openBluetoothSettings() {
        main.post {
            try {
                activity.startActivity(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
            } catch (e: Exception) {
                emitError("باز کردن تنظیمات بلوتوث ممکن نشد")
            }
        }
    }

    /** JSON array of bonded (paired) devices: [{name, address, type}] */
    @JavascriptInterface
    fun getPairedDevices(): String {
        val arr = JSONArray()
        try {
            adapter()?.bondedDevices?.forEach { d ->
                val type = when (d.type) {
                    BluetoothDevice.DEVICE_TYPE_CLASSIC -> "classic"
                    BluetoothDevice.DEVICE_TYPE_LE -> "ble"
                    BluetoothDevice.DEVICE_TYPE_DUAL -> "dual"
                    else -> "unknown"
                }
                arr.put(
                    JSONObject()
                        .put("name", safeName(d))
                        .put("address", d.address)
                        .put("type", type)
                )
            }
        } catch (_: SecurityException) {
        }
        return arr.toString()
    }

    @JavascriptInterface
    fun startScan() {
        if (missingPermissions().isNotEmpty()) {
            emitError("مجوز بلوتوث داده نشده است")
            requestPermissions()
            return
        }
        val scanner = try {
            adapter()?.takeIf { it.isEnabled }?.bluetoothLeScanner
        } catch (_: SecurityException) {
            null
        }
        if (scanner == null) {
            emitError("بلوتوث گوشی خاموش است")
            return
        }
        stopScan()
        val cb = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult?) {
                val r = result ?: return
                val d = r.device ?: return
                emit(
                    JSONObject()
                        .put("t", "device")
                        .put("name", safeName(d))
                        .put("address", d.address)
                        .put("ble", true)
                        .put("rssi", r.rssi)
                )
            }

            override fun onScanFailed(errorCode: Int) {
                emitError("جستجوی BLE ناموفق بود (کد $errorCode)")
                scanCallback = null
                emit(JSONObject().put("t", "scan").put("active", false))
            }
        }
        try {
            scanner.startScan(cb)
        } catch (e: Exception) {
            emitError("شروع جستجوی BLE ممکن نشد: ${e.message ?: e.javaClass.simpleName}")
            return
        }
        scanCallback = cb
        emit(JSONObject().put("t", "scan").put("active", true))
        val stopper = Runnable { stopScan() }
        scanStopper = stopper
        main.postDelayed(stopper, SCAN_MS)
    }

    @JavascriptInterface
    fun stopScan() {
        scanStopper?.let { main.removeCallbacks(it) }
        scanStopper = null
        val cb = scanCallback ?: return
        scanCallback = null
        try { adapter()?.bluetoothLeScanner?.stopScan(cb) } catch (_: Exception) { }
        emit(JSONObject().put("t", "scan").put("active", false))
    }

    /** mode: "SPP" (Classic, device must be paired) or "BLE" */
    @JavascriptInterface
    fun connect(address: String, mode: String) {
        if (missingPermissions().isNotEmpty()) {
            emitState(false, null, null, address, "مجوز بلوتوث داده نشده است")
            requestPermissions()
            return
        }
        scope.launch {
            closeConnection()
            val id = session.incrementAndGet()
            val ad = adapter()
            if (ad == null || !ad.isEnabled) {
                emitState(false, null, null, address, "بلوتوث گوشی خاموش است")
                return@launch
            }
            val device = try {
                ad.getRemoteDevice(address)
            } catch (_: IllegalArgumentException) {
                emitState(false, null, null, address, "آدرس دستگاه نامعتبر است")
                return@launch
            }
            stopScan()
            emitState(false, null, safeName(device), address, "در حال اتصال...", connecting = true)
            if (mode == "BLE") connectBle(device, id) else connectClassic(device, id)
        }
    }

    @JavascriptInterface
    fun disconnect() {
        scope.launch {
            closeConnection()
            emitState(false, null, null, null, "ارتباط توسط کاربر قطع شد")
        }
    }

    /** Queues text for transmission. Returns false if nothing is connected. */
    @JavascriptInterface
    fun send(text: String): Boolean {
        val data = text.toByteArray(Charsets.UTF_8)
        when (connectedMode) {
            "SPP" -> {
                val s = socket ?: return false
                scope.launch {
                    try {
                        s.outputStream.write(data)
                        s.outputStream.flush()
                    } catch (e: IOException) {
                        emitError("ارسال ناموفق بود: ${e.message ?: "خطای ورودی/خروجی"}")
                    }
                }
                return true
            }
            "BLE" -> {
                val g = gatt ?: return false
                val c = gattWriteChar ?: return false
                scope.launch { writeBle(g, c, data) }
                return true
            }
        }
        return false
    }

    // -------------------------------------------------------------- lifecycle

    fun release() {
        stopScan()
        closeConnection()
        scope.cancel()
    }

    @Synchronized
    private fun closeConnection() {
        session.incrementAndGet()
        connectedMode = null
        try { socket?.close() } catch (_: Exception) { }
        socket = null
        try { gatt?.disconnect() } catch (_: Exception) { }
        try { gatt?.close() } catch (_: Exception) { }
        gatt = null
        gattWriteChar = null
    }

    // ---------------------------------------------------------------- classic

    private fun connectClassic(device: BluetoothDevice, id: Int) {
        val name = safeName(device)
        val sock: BluetoothSocket = try {
            device.createRfcommSocketToServiceRecord(SPP_UUID)
        } catch (e: Exception) {
            if (session.get() == id) {
                emitState(false, null, null, device.address, "ساخت سوکت SPP ناموفق بود (${e.message ?: e.javaClass.simpleName})")
            }
            return
        }
        try {
            adapter()?.cancelDiscovery()
            sock.connect()
        } catch (e: Exception) {
            try { sock.close() } catch (_: Exception) { }
            if (session.get() == id) {
                emitState(
                    false, null, null, device.address,
                    "اتصال SPP ناموفق بود (${e.message ?: e.javaClass.simpleName}). " +
                        "ماژول باید روشن و در تنظیمات بلوتوث گوشی جفت‌شده باشد."
                )
            }
            return
        }
        if (session.get() != id) {
            try { sock.close() } catch (_: Exception) { }
            return
        }
        socket = sock
        connectedMode = "SPP"
        emitState(true, "BT_CLASSIC", name, device.address, "متصل (Classic SPP)")
        readLoop(sock.inputStream, id)
    }

    private fun readLoop(input: InputStream, id: Int) {
        val buf = ByteArray(512)
        try {
            while (session.get() == id) {
                val n = input.read(buf)
                if (n < 0) break
                if (n > 0) emitData(buf.copyOf(n))
            }
        } catch (_: IOException) {
            // fall through: treated as a disconnect below
        }
        if (session.get() == id) {
            closeConnection()
            emitState(false, null, null, null, "اتصال از سمت دستگاه قطع شد")
        }
    }

    // -------------------------------------------------------------------- BLE

    private fun connectBle(device: BluetoothDevice, id: Int) {
        val name = safeName(device)
        val address = device.address

        fun fail(reason: String) {
            if (session.get() != id) return
            closeConnection()
            emitState(false, null, null, address, reason)
        }

        fun markConnected() {
            if (session.get() != id) return
            connectedMode = "BLE"
            emitState(true, "BLE", name, address, "متصل (BLE)")
        }

        val cb = object : BluetoothGattCallback() {
            override fun onConnectionStateChange(g: BluetoothGatt?, status: Int, newState: Int) {
                if (session.get() != id) {
                    try { g?.close() } catch (_: Exception) { }
                    return
                }
                if (newState == BluetoothProfile.STATE_CONNECTED && status == BluetoothGatt.GATT_SUCCESS) {
                    g?.discoverServices()
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED || status != BluetoothGatt.GATT_SUCCESS) {
                    val was = connectedMode == "BLE"
                    fail(if (was) "اتصال BLE قطع شد" else "اتصال BLE ناموفق بود (کد $status)")
                }
            }

            override fun onServicesDiscovered(g: BluetoothGatt?, status: Int) {
                if (session.get() != id || g == null) return
                if (status != BluetoothGatt.GATT_SUCCESS) {
                    fail("کشف سرویس‌های BLE ناموفق بود")
                    return
                }
                val pick = pickUartCharacteristics(g)
                if (pick == null) {
                    fail("این دستگاه سرویس سریال شناخته‌شده (Nordic UART یا HM-10 با FFE0) ندارد")
                    return
                }
                val (notifyChar, writeChar) = pick
                gattWriteChar = writeChar
                if (!g.setCharacteristicNotification(notifyChar, true)) {
                    fail("فعال‌سازی اعلان BLE ناموفق بود")
                    return
                }
                val cccd = notifyChar.getDescriptor(CCCD)
                if (cccd == null) {
                    markConnected()
                    return
                }
                cccd.value =
                    if (notifyChar.properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0)
                        BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                    else
                        BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
                if (!g.writeDescriptor(cccd)) fail("فعال‌سازی اعلان BLE ناموفق بود")
            }

            override fun onDescriptorWrite(g: BluetoothGatt?, d: BluetoothGattDescriptor?, status: Int) {
                if (session.get() != id || d?.uuid != CCCD) return
                if (status == BluetoothGatt.GATT_SUCCESS) markConnected()
                else fail("فعال‌سازی اعلان BLE ناموفق بود (کد $status)")
            }

            override fun onCharacteristicChanged(g: BluetoothGatt?, c: BluetoothGattCharacteristic?) {
                if (session.get() != id) return
                val v = c?.value ?: return
                if (v.isNotEmpty()) emitData(v.copyOf())
            }
        }

        val g = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            device.connectGatt(activity, false, cb, BluetoothDevice.TRANSPORT_LE)
        } else {
            device.connectGatt(activity, false, cb)
        }
        gatt = g
        if (session.get() != id) {
            // superseded while connecting: release the handle we just stored
            try { g?.close() } catch (_: Exception) { }
            gatt = null
        }
    }

    /** Returns (notify characteristic, write characteristic or null). */
    private fun pickUartCharacteristics(
        g: BluetoothGatt
    ): Pair<BluetoothGattCharacteristic, BluetoothGattCharacteristic?>? {
        g.getService(NUS_SERVICE)?.let { s ->
            val tx = s.getCharacteristic(NUS_TX)
            if (tx != null) return Pair(tx, s.getCharacteristic(NUS_RX) ?: tx)
        }
        g.getService(HM10_SERVICE)?.getCharacteristic(HM10_CHAR)?.let { return Pair(it, it) }

        val skip = listOf("00001800", "00001801", "0000180f")
        for (s in g.services) {
            if (skip.any { s.uuid.toString().startsWith(it) }) continue
            for (c in s.characteristics) {
                val p = c.properties
                val canNotify = p and (BluetoothGattCharacteristic.PROPERTY_NOTIFY or
                    BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0
                if (canNotify) {
                    val canWrite = p and (BluetoothGattCharacteristic.PROPERTY_WRITE or
                        BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0
                    return Pair(c, if (canWrite) c else null)
                }
            }
        }
        return null
    }

    private suspend fun writeBle(g: BluetoothGatt, c: BluetoothGattCharacteristic, data: ByteArray) {
        val noResponse = c.properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0
        var off = 0
        while (off < data.size) {
            val end = minOf(off + BLE_CHUNK, data.size)
            c.writeType =
                if (noResponse) BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                else BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            c.value = data.copyOfRange(off, end)
            if (!g.writeCharacteristic(c)) {
                emitError("نوشتن روی BLE ناموفق بود")
                return
            }
            off = end
            delay(40)
        }
    }
}
