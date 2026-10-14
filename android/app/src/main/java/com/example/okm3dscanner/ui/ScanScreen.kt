package com.example.ui

import androidx.compose.animation.core.*
import androidx.compose.foundation.*
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.hardware.ConnectionMode
import com.example.hardware.SensorType
import com.example.ui.theme.*
import kotlinx.coroutines.delay

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ScanScreen(viewModel: VisualizerViewModel, onNavigateToAi: () -> Unit = {}) {
    val gridWidth by viewModel.gridWidth.collectAsStateWithLifecycle()
    val gridLength by viewModel.gridLength.collectAsStateWithLifecycle()
    val soilType by viewModel.soilType.collectAsStateWithLifecycle()
    val scanPattern by viewModel.scanPattern.collectAsStateWithLifecycle()
    val isScanActive by viewModel.isScanActive.collectAsStateWithLifecycle()
    val currentCol by viewModel.currentCol.collectAsStateWithLifecycle()
    val currentRow by viewModel.currentRow.collectAsStateWithLifecycle()
    val activeScanData by viewModel.activeScanData.collectAsStateWithLifecycle()
    val connectionState by viewModel.sensorManager.connectionState.collectAsStateWithLifecycle()
    val connectionStatus by viewModel.sensorManager.tvStatus.collectAsStateWithLifecycle()
    val adcValue by viewModel.sensorManager.adcValue.collectAsStateWithLifecycle()
    val phaseShift by viewModel.sensorManager.phaseShift.collectAsStateWithLifecycle()
    val activeSensorType by viewModel.sensorManager.sensorType.collectAsStateWithLifecycle()
    val activeBaudRate by viewModel.sensorManager.baudRate.collectAsStateWithLifecycle()
    val compassHeading by viewModel.sensorManager.compassHeading.collectAsStateWithLifecycle()

    var autoPulseEnabled by remember { mutableStateOf(false) }

    LaunchedEffect(isScanActive, autoPulseEnabled) {
        if (isScanActive && autoPulseEnabled) {
            while (true) {
                delay(1600)
                viewModel.recordCurrentStep()
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // App Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = "AURAXIS X20",
                    color = CyberGold,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp
                )
                Text(
                    text = "Gold Radar X20 — رادار ژئوفیزیک تاکتیکی",
                    color = GrayText,
                    fontSize = 11.sp
                )
            }

            Card(
                onClick = { viewModel.sensorManager.autoConnect() },
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(12.dp)
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val indicatorColor = when (connectionState) {
                        ConnectionMode.DISCONNECTED, ConnectionMode.ERROR -> Color.Red
                        ConnectionMode.CONNECTING_USB, ConnectionMode.CONNECTING_BT, ConnectionMode.SCANNING_BT -> Color.Yellow
                        ConnectionMode.USB -> Color.Green
                        ConnectionMode.BLUETOOTH -> CyberCyan
                        ConnectionMode.SIMULATOR -> CyberGold
                    }
                    Box(
                        modifier = Modifier
                            .size(10.dp)
                            .clip(CircleShape)
                            .background(indicatorColor)
                    )
                    Text(
                        text = connectionStatus,
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }

        if (!isScanActive) {
            Text(
                text = "تنظیمات اسکن جدید (Scan Configuration)",
                color = Color.White,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
                textAlign = TextAlign.Right
            )

            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceBg),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("تعداد پالس در خط (عرض)", color = CyberGold, fontSize = 11.sp)
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(CardBg, RoundedCornerShape(8.dp))
                                    .padding(4.dp)
                            ) {
                                IconButton(onClick = { viewModel.updateGridWidth(gridWidth - 1) }) {
                                    Icon(Icons.Default.Remove, contentDescription = "Minus", tint = Color.White)
                                }
                                Text("$gridWidth", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                IconButton(onClick = { viewModel.updateGridWidth(gridWidth + 1) }) {
                                    Icon(Icons.Default.Add, contentDescription = "Plus", tint = Color.White)
                                }
                            }
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text("تعداد خطوط اسکن (طول)", color = CyberGold, fontSize = 11.sp)
                            Spacer(modifier = Modifier.height(4.dp))
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(CardBg, RoundedCornerShape(8.dp))
                                    .padding(4.dp)
                            ) {
                                IconButton(onClick = { viewModel.updateGridLength(gridLength - 1) }) {
                                    Icon(Icons.Default.Remove, contentDescription = "Minus", tint = Color.White)
                                }
                                Text("$gridLength", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                IconButton(onClick = { viewModel.updateGridLength(gridLength + 1) }) {
                                    Icon(Icons.Default.Add, contentDescription = "Plus", tint = Color.White)
                                }
                            }
                        }
                    }

                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text("نوع خاک هدف (Soil Type)", color = CyberGold, fontSize = 11.sp)
                        Spacer(modifier = Modifier.height(6.dp))
                        val soils = listOf("خاک کشاورزی (Soil)", "خاک معدنی (Mineral)", "سنگ و صخره (Hard Rock)", "ماسه خیس (Wet Sand)")
                        FlowRow(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            soils.forEach { s ->
                                FilterChip(
                                    selected = soilType == s,
                                    onClick = { viewModel.updateSoilType(s) },
                                    label = { Text(s, fontSize = 10.sp) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = CyberGold.copy(alpha = 0.2f),
                                        selectedLabelColor = CyberGold,
                                        containerColor = CardBg,
                                        labelColor = Color.White
                                    )
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            Button(
                onClick = { viewModel.startNewScan() },
                colors = ButtonDefaults.buttonColors(containerColor = CyberGold),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
            ) {
                Icon(Icons.Default.PlayArrow, contentDescription = null, tint = Color.Black)
                Spacer(modifier = Modifier.width(8.dp))
                Text("شروع اسکن سه‌بعدی جدید", color = Color.Black, fontSize = 15.sp, fontWeight = FontWeight.Bold)
            }
        } else {
            Card(
                colors = CardDefaults.cardColors(containerColor = SurfaceBg),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text("در حال تصویربرداری زمین...", color = CyberGold, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            Text("سایز شبکه: $gridWidth × $gridLength", color = GrayText, fontSize = 10.sp)
                        }

                        IconButton(
                            onClick = { viewModel.cancelScan() },
                            colors = IconButtonDefaults.iconButtonColors(containerColor = CardBg)
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "Discard", tint = Color.Red)
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Button(
                        onClick = { viewModel.recordCurrentStep() },
                        colors = ButtonDefaults.buttonColors(containerColor = CyberGold),
                        shape = CircleShape,
                        modifier = Modifier
                            .size(88.dp)
                            .border(BorderStroke(4.dp, CyberGold.copy(alpha = 0.3f)), CircleShape),
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Default.FlashOn, contentDescription = null, tint = Color.Black, modifier = Modifier.size(26.dp))
                            Text("ثبت پالس", color = Color.Black, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}
