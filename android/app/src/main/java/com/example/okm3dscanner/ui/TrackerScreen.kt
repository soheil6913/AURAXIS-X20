package com.example.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.hardware.ConnectionMode
import com.example.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.max

@Composable
fun TrackerScreen(viewModel: VisualizerViewModel) {
    val adcValue by viewModel.sensorManager.adcValue.collectAsStateWithLifecycle()
    val phaseShift by viewModel.sensorManager.phaseShift.collectAsStateWithLifecycle()
    val connectionState by viewModel.sensorManager.connectionState.collectAsStateWithLifecycle()
    val connectionStatus by viewModel.sensorManager.tvStatus.collectAsStateWithLifecycle()
    val telemetry by viewModel.sensorManager.telemetry.collectAsStateWithLifecycle()
    val lastPacketTimestamp by viewModel.sensorManager.lastPacketTimestamp.collectAsStateWithLifecycle()

    var groundZero by remember { mutableStateOf(380) }
    var alarmThreshold by remember { mutableStateOf(750) }
    var isLiveAudioMuted by remember { mutableStateOf(false) }
    var isTelemetryExpanded by remember { mutableStateOf(true) }

    val diffFromZero = adcValue - groundZero
    val isAlarm = adcValue >= alarmThreshold
    val isCavity = adcValue < 250 && phaseShift < -15

    val timeFormatter = remember { SimpleDateFormat("HH:mm:ss.SSS", Locale.getDefault()) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Top Header with Connection Badge
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "ردیاب زنده مگنتومتر (Live Pinpointer)",
                    color = CyberGold,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "اندازه‌گیری آنی میدان مغناطیسی زمین",
                    color = GrayText,
                    fontSize = 10.sp
                )
            }

            Surface(
                color = CardBg,
                shape = RoundedCornerShape(10.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    val indicatorColor = when (connectionState) {
                        ConnectionMode.DISCONNECTED -> Color.Red
                        ConnectionMode.CONNECTING_USB, ConnectionMode.CONNECTING_BT, ConnectionMode.SCANNING_BT -> Color.Yellow
                        ConnectionMode.USB -> Color.Green
                        ConnectionMode.BLUETOOTH -> CyberCyan
                        ConnectionMode.SIMULATOR -> CyberGold
                        ConnectionMode.ERROR -> Color.Red
                    }
                    Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(indicatorColor))
                    Text(
                        text = connectionStatus.split(" ").firstOrNull() ?: "متصل",
                        color = Color.White,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }

        // Main Gauges Card: Real-time Signal, Phase & Estimated Depth
        Card(
            colors = CardDefaults.cardColors(containerColor = SurfaceBg),
            shape = RoundedCornerShape(18.dp),
            modifier = Modifier.fillMaxWidth(),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // 3 Gauges in Responsive Row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    // Gauge 1: ADC Signal
                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("سیگنال ADC", color = GrayText, fontSize = 10.sp)
                        Text(
                            text = "$adcValue",
                            color = if (isAlarm) CyberRed else CyberGold,
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            text = "بالانس: $groundZero",
                            color = GrayText,
                            fontSize = 9.sp
                        )
                    }

                    // Gauge 2: Phase Shift
                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("زاویه فاز", color = GrayText, fontSize = 10.sp)
                        Text(
                            text = "$phaseShift°",
                            color = CyberCyan,
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            text = if (phaseShift > 10) "پاسخ فلزی (+)" else if (phaseShift < -10) "پاسخ حفره (-)" else "خاک یکنواخت",
                            color = if (phaseShift > 10) CyberGold else if (phaseShift < -10) CyberCyan else GrayText,
                            fontSize = 9.sp
                        )
                    }

                    // Gauge 3: Estimated Depth
                    Column(
                        modifier = Modifier.weight(1f),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("عمق تخمینی", color = GrayText, fontSize = 10.sp)
                        val estDepth = max(0.4f, (1.0f - (adcValue.toFloat() / 1024f)) * 5.0f)
                        Text(
                            text = String.format("%.1f m", estDepth),
                            color = Color.White,
                            fontSize = 32.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text("حداکثر برد: ۵ متر", color = GrayText, fontSize = 9.sp)
                    }
                }

                // Interactive Ground Balance (Ground Zero) & Quick Mute Actions
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Button(
                        onClick = { groundZero = adcValue },
                        colors = ButtonDefaults.buttonColors(containerColor = CardBg),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, CyberCyan.copy(alpha = 0.5f))
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, tint = CyberCyan, modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("بالانس زمین (Zero)", color = CyberCyan, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }

                    Button(
                        onClick = { isLiveAudioMuted = !isLiveAudioMuted },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (isLiveAudioMuted) Color.Red.copy(alpha = 0.2f) else CardBg
                        ),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.weight(1f),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.1f))
                    ) {
                        Icon(
                            if (isLiveAudioMuted) Icons.Default.VolumeOff else Icons.Default.VolumeUp,
                            contentDescription = null,
                            tint = if (isLiveAudioMuted) Color.Red else CyberGold,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(if (isLiveAudioMuted) "صوت: خاموش" else "صوت: فعال", color = Color.White, fontSize = 11.sp)
                    }
                }
            }
        }

        // Alarm Banner when over threshold
        if (isAlarm) {
            Card(
                colors = CardDefaults.cardColors(containerColor = CyberRed.copy(alpha = 0.2f)),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, CyberRed),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(Icons.Default.Warning, contentDescription = null, tint = CyberRed, modifier = Modifier.size(24.dp))
                    Column {
                        Text("هشدار: شدت مغناطیسی غیرعادی (Target Alert!)", color = CyberRed, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text("سیگنال از حد آستانه ($alarmThreshold ADC) عبور کرده است.", color = Color.White, fontSize = 10.sp)
                    }
                }
            }
        } else if (isCavity) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E3A8A).copy(alpha = 0.3f)),
                shape = RoundedCornerShape(14.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, CyberCyan),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Icon(Icons.Default.Info, contentDescription = null, tint = CyberCyan, modifier = Modifier.size(24.dp))
                    Column {
                        Text("تشخیص افت میدان مغناطیسی (Cavity Drop)", color = CyberCyan, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text("افت سیگنال به همراه فاز منفی مشخصه حفره یا فضای خالی زیرسطحی است.", color = Color.White, fontSize = 10.sp)
                    }
                }
            }
        }

        // Live Telemetry Protocol Health & Hardware Packet Diagnostics Card
        Card(
            colors = CardDefaults.cardColors(containerColor = SurfaceBg),
            shape = RoundedCornerShape(18.dp),
            modifier = Modifier.fillMaxWidth(),
            border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.08f))
        ) {
            Column(modifier = Modifier.padding(14.dp)) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { isTelemetryExpanded = !isTelemetryExpanded },
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(Icons.Default.SettingsEthernet, contentDescription = null, tint = CyberGold, modifier = Modifier.size(18.dp))
                        Text(
                            text = "سلامت پروتکل و پکت‌های سنسور (Hardware Telemetry)",
                            color = Color.White,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    IconButton(
                        onClick = { isTelemetryExpanded = !isTelemetryExpanded },
                        modifier = Modifier.size(24.dp)
                    ) {
                        Icon(
                            if (isTelemetryExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                            contentDescription = null,
                            tint = GrayText
                        )
                    }
                }

                AnimatedVisibility(visible = isTelemetryExpanded) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("تعداد کل پکت‌های دریافتی:", color = GrayText, fontSize = 11.sp)
                            Text("${telemetry.packetCount}", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("زمان آخرین پکت معتبر:", color = GrayText, fontSize = 11.sp)
                            Text(timeFormatter.format(Date(lastPacketTimestamp)), color = CyberCyan, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("اعتبار چکسام (CRC/Checksum):", color = GrayText, fontSize = 11.sp)
                            Text(if (telemetry.isChecksumValid) "تایید شد (OK)" else "خطای پکت", color = if (telemetry.isChecksumValid) Color.Green else Color.Red, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("پروفایل سخت‌افزاری فعال:", color = GrayText, fontSize = 11.sp)
                            Text(telemetry.sensorId, color = CyberGold, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
