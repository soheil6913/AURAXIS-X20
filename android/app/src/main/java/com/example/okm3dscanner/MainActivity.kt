package com.example.okm3dscanner

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.os.Bundle
import android.webkit.GeolocationPermissions
import android.webkit.MimeTypeMap
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import java.io.ByteArrayInputStream
import java.io.IOException

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private var bridge: BluetoothBridge? = null

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            bridge?.onPermissionResult()
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            textZoom = 100
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
        }

        // Real Bluetooth (Classic SPP + BLE UART) exposed to the web app as window.AuraxisBT
        val btBridge = BluetoothBridge(this, webView) { perms -> permissionLauncher.launch(perms) }
        bridge = btBridge
        webView.addJavascriptInterface(btBridge, "AuraxisBT")

        webView.webViewClient = object : WebViewClient() {
            // The JS bridge must only ever be reachable from our own bundled pages:
            // external links open in the system browser instead of inside this WebView.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == HOST) return false
                if (url.scheme == "http" || url.scheme == "https") {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, url))
                    } catch (_: Exception) {
                    }
                }
                return true
            }

            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest
            ): WebResourceResponse? {
                val url = request.url
                if (url.host != HOST) return null
                val path = url.path.orEmpty()

                if (path.startsWith("/api/")) {
                    val body = """{"error":"تحلیل هوش مصنوعی در نسخه اندروید هنوز به سرور متصل نیست."}"""
                    return WebResourceResponse(
                        "application/json", "utf-8", 503, "Service Unavailable",
                        emptyMap(), ByteArrayInputStream(body.toByteArray())
                    )
                }

                val rel = if (path.isEmpty() || path == "/") "index.html" else path.trimStart('/')
                if (rel.contains("..")) return notFound()
                return try {
                    WebResourceResponse(mimeFor(rel), "utf-8", assets.open("web/$rel"))
                } catch (e: IOException) {
                    notFound()
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback
            ) {
                callback.invoke(origin, true, false)
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        permissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION))

        if (savedInstanceState != null) webView.restoreState(savedInstanceState)
        else webView.loadUrl("https://$HOST/")
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onDestroy() {
        bridge?.release()
        bridge = null
        webView.destroy()
        super.onDestroy()
    }

    private fun notFound() = WebResourceResponse(
        "text/plain", "utf-8", 404, "Not Found",
        emptyMap(), ByteArrayInputStream(ByteArray(0))
    )

    private fun mimeFor(name: String): String {
        val ext = name.substringAfterLast('.', "").lowercase()
        return when (ext) {
            "js", "mjs" -> "text/javascript"
            "json", "webmanifest" -> "application/json"
            "wasm" -> "application/wasm"
            else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
                ?: "application/octet-stream"
        }
    }

    private companion object {
        const val HOST = "appassets.androidplatform.net"
    }
}
