package com.example.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ViewInAr
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.ScanRecord
import com.example.ui.theme.CardBg
import com.example.ui.theme.CyberCyan
import com.example.ui.theme.CyberGold
import com.example.ui.theme.GrayText

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(viewModel: VisualizerViewModel, onLoadScan: (ScanRecord) -> Unit) {
    val savedScans by viewModel.savedScans.collectAsStateWithLifecycle()
    var searchQuery by remember { mutableStateOf("") }

    val filteredScans = remember(savedScans, searchQuery) {
        if (searchQuery.isBlank()) {
            savedScans
        } else {
            val query = searchQuery.trim().lowercase()
            savedScans.filter {
                it.name.lowercase().contains(query) ||
                it.date.lowercase().contains(query) ||
                it.notes.lowercase().contains(query)
            }
        }
    }

    // Statistics calculations
    val totalScans = savedScans.size
    val avgDepth = if (totalScans > 0) {
        String.format("%.1f", savedScans.map { it.maxDepthMeters }.average())
    } else "0.0"

    val soilCounts = savedScans.groupingBy { it.soilType.split("(")[0].trim() }.eachCount()
    val mostCommonSoil = soilCounts.maxByOrNull { it.value }?.key ?: "نامشخص"

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        Text("تاریخچه اسکن‌های زمین", color = CyberGold, fontSize = 16.sp, fontWeight = FontWeight.Bold)

        Spacer(modifier = Modifier.height(12.dp))

        // Summary Statistics Cards
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Card 1: Total Scans
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.weight(1f)
            ) {
                Column(modifier = Modifier.padding(10.dp)) {
                    Text("کل اسکن‌ها", color = GrayText, fontSize = 10.sp)
                    Text("$totalScans", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            }

            // Card 2: Avg Depth
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.weight(1f)
            ) {
                Column(modifier = Modifier.padding(10.dp)) {
                    Text("میانگین عمق", color = GrayText, fontSize = 10.sp)
                    Text("${avgDepth}m", color = CyberCyan, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                }
            }

            // Card 3: Soil Type
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.weight(1.2f)
            ) {
                Column(modifier = Modifier.padding(10.dp)) {
                    Text("خاک غالب", color = GrayText, fontSize = 10.sp)
                    Text(mostCommonSoil, color = CyberGold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        // Search Bar
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("جستجوی نام یا تاریخ...", fontSize = 12.sp, color = GrayText) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search", tint = CyberGold) },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { searchQuery = "" }) {
                        Icon(Icons.Default.Close, contentDescription = "Clear", tint = GrayText)
                    }
                }
            },
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = CyberGold,
                unfocusedBorderColor = Color.Gray.copy(alpha = 0.3f),
                focusedContainerColor = CardBg,
                unfocusedContainerColor = CardBg,
                focusedTextColor = Color.White,
                unfocusedTextColor = Color.White
            ),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp)
        )

        LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            items(filteredScans) { scan ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = CardBg),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(scan.name, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            Text("تاریخ: ${scan.date} | ابعاد: ${scan.width}×${scan.length}", color = GrayText, fontSize = 11.sp)
                        }

                        IconButton(onClick = {
                            viewModel.loadScanToVisualizer(scan)
                            onLoadScan(scan)
                        }) {
                            Icon(Icons.Default.ViewInAr, contentDescription = "Load", tint = CyberCyan)
                        }
                    }
                }
            }
        }
    }
}

