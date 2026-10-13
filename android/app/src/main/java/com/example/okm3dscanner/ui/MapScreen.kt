package com.example.ui

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.ScanRecord
import com.example.ui.theme.*

@SuppressLint("SetJavaScriptEnabled", "MissingPermission")
@Composable
fun MapScreen(
    viewModel: VisualizerViewModel,
    onNavigateToVisualizer: () -> Unit = {},
    onNavigateToAi: () -> Unit = {}
) {
    val context = LocalContext.current
    val viewedScan by viewModel.viewedScan.collectAsStateWithLifecycle()
    val savedScans by viewModel.savedScans.collectAsStateWithLifecycle()

    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var activeLayer by remember { mutableStateOf("satellite") } // satellite, osm, topo
    var isLocating by remember { mutableStateOf(false) }
    var userLocation by remember { mutableStateOf<Pair<Double, Double>?>(null) }
    var isDetailsCardExpanded by remember { mutableStateOf(true) }
    var selectedScan by remember { mutableStateOf<ScanRecord?>(viewedScan ?: savedScans.firstOrNull()) }

    // Fetch GPS fix if permission is granted
    fun requestGpsLocation() {
        isLocating = true
        try {
            val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            val provider = if (lm?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true) {
                LocationManager.GPS_PROVIDER
            } else {
                LocationManager.NETWORK_PROVIDER
            }

            val lastFix = lm?.getLastKnownLocation(provider)
            if (lastFix != null) {
                userLocation = Pair(lastFix.latitude, lastFix.longitude)
                webViewRef?.evaluateJavascript(
                    "window.postMessage({ type: 'MAP_PAN_TO', lat: ${lastFix.latitude}, lng: ${lastFix.longitude}, zoom: 16 }, '*');",
                    null
                )
                isLocating = false
            } else {
                lm?.requestSingleUpdate(provider, object : LocationListener {
                    override fun onLocationChanged(loc: Location) {
                        userLocation = Pair(loc.latitude, loc.longitude)
                        webViewRef?.evaluateJavascript(
                            "window.postMessage({ type: 'MAP_PAN_TO', lat: ${loc.latitude}, lng: ${loc.longitude}, zoom: 16 }, '*');",
                            null
                        )
                        isLocating = false
                    }
                    @Deprecated("Deprecated in Java")
                    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
                    override fun onProviderEnabled(provider: String) {}
                    override fun onProviderDisabled(provider: String) { isLocating = false }
                }, null)
            }
        } catch (e: Exception) {
            isLocating = false
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(DarkBg)) {
        // High Performance Embedded GIS Interactive Map (Leaflet OpenStreetMap / Satellite)
        AndroidView(
            factory = { ctx ->
                WebView(ctx).apply {
                    setLayerType(View.LAYER_TYPE_HARDWARE, null)
                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        databaseEnabled = true
                        allowFileAccess = true
                        setSupportZoom(true)
                        builtInZoomControls = true
                        displayZoomControls = false
                    }
                    webViewClient = WebViewClient()
                    webChromeClient = WebChromeClient()
                    loadUrl("https://ais-dev-nv5l246zvgkkw3jfiowkmt-248179377299.europe-west2.run.app/?tab=map&embed=true")
                    webViewRef = this
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        // Floating Map Controls Toolbar (Right side, non-blocking)
        Column(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
            horizontalAlignment = Alignment.End
        ) {
            // Layer Switcher Card
            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceBg.copy(alpha = 0.92f)),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
            ) {
                Row(
                    modifier = Modifier.padding(4.dp),
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    listOf(
                        "satellite" to "ماهواره",
                        "osm" to "نقشه",
                        "topo" to "توپو"
                    ).forEach { (id, label) ->
                        val isSelected = activeLayer == id
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (isSelected) CyberGold else Color.Transparent)
                                .clickable {
                                    activeLayer = id
                                    webViewRef?.evaluateJavascript(
                                        "window.postMessage({ type: 'MAP_SET_LAYER', layer: '$id' }, '*');",
                                        null
                                    )
                                }
                                .padding(horizontal = 10.dp, vertical = 6.dp)
                        ) {
                            Text(
                                text = label,
                                color = if (isSelected) Color.Black else GrayText,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // Zoom In, Zoom Out & Return to GPS Fix Buttons
            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceBg.copy(alpha = 0.92f)),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
            ) {
                Column(modifier = Modifier.padding(4.dp)) {
                    IconButton(
                        onClick = {
                            webViewRef?.evaluateJavascript("window.postMessage({ type: 'MAP_ZOOM_IN' }, '*');", null)
                        },
                        modifier = Modifier.size(38.dp)
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "Zoom In", tint = Color.White)
                    }

                    HorizontalDivider(color = Color.White.copy(alpha = 0.1f), modifier = Modifier.width(32.dp))

                    IconButton(
                        onClick = {
                            webViewRef?.evaluateJavascript("window.postMessage({ type: 'MAP_ZOOM_OUT' }, '*');", null)
                        },
                        modifier = Modifier.size(38.dp)
                    ) {
                        Icon(Icons.Default.Remove, contentDescription = "Zoom Out", tint = Color.White)
                    }

                    HorizontalDivider(color = Color.White.copy(alpha = 0.1f), modifier = Modifier.width(32.dp))

                    // My Location GPS Target Fix Button
                    IconButton(
                        onClick = { requestGpsLocation() },
                        modifier = Modifier.size(38.dp)
                    ) {
                        if (isLocating) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                color = CyberCyan,
                                strokeWidth = 2.dp
                            )
                        } else {
                            Icon(
                                Icons.Default.MyLocation,
                                contentDescription = "My GPS Fix",
                                tint = if (userLocation != null) CyberCyan else CyberGold
                            )
                        }
                    }
                }
            }
        }

        // Bottom Expandable Information Card (Non-overlapping, responsive scrollable details)
        Card(
            colors = CardDefaults.cardColors(containerColor = SurfaceBg.copy(alpha = 0.95f)),
            shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f)),
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.BottomCenter)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp)
            ) {
                // Header Row with Toggle
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { isDetailsCardExpanded = !isDetailsCardExpanded },
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(CyberGold)
                        )
                        Text(
                            text = selectedScan?.name ?: "نقشه پایگاه‌های اسکن رادار",
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    IconButton(
                        onClick = { isDetailsCardExpanded = !isDetailsCardExpanded },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            if (isDetailsCardExpanded) Icons.Default.KeyboardArrowDown else Icons.Default.KeyboardArrowUp,
                            contentDescription = "Expand/Collapse",
                            tint = GrayText
                        )
                    }
                }

                // Collapsible Body
                AnimatedVisibility(visible = isDetailsCardExpanded) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        selectedScan?.let { s ->
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Column {
                                    Text("مختصات GPS ثبت‌شده:", color = GrayText, fontSize = 10.sp)
                                    Text(
                                        "${String.format("%.4f", s.latitude ?: 35.6892)}°, ${String.format("%.4f", s.longitude ?: 51.3890)}°",
                                        color = CyberGold,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("بستر زمین و ابعاد:", color = GrayText, fontSize = 10.sp)
                                    Text(
                                        "${s.width}×${s.length} | ${s.soilType.split(" ").firstOrNull() ?: ""}",
                                        color = CyberCyan,
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }

                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Button(
                                    onClick = {
                                        viewModel.loadScanToVisualizer(s)
                                        onNavigateToVisualizer()
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = CyberCyan),
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.ViewInAr, contentDescription = null, tint = Color.Black, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("نمایش ۳بعدی", color = Color.Black, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }

                                Button(
                                    onClick = {
                                        viewModel.loadScanToVisualizer(s)
                                        onNavigateToAi()
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = CyberGold),
                                    shape = RoundedCornerShape(10.dp),
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Icon(Icons.Default.AutoAwesome, contentDescription = null, tint = Color.Black, modifier = Modifier.size(16.dp))
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Text("تحلیل AI", color = Color.Black, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
