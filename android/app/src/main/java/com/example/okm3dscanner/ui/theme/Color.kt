package com.example.ui.theme

import androidx.compose.ui.graphics.Color

val DarkBg = Color(0xFF020617)
val SurfaceBg = Color(0xFF0F172A)
val CardBg = Color(0xFF1E293B)
val CyberGold = Color(0xFFF59E0B)
val CyberCyan = Color(0xFF06B6D4)
val CyberRed = Color(0xFFEF4444)
val GrayText = Color(0xFF94A3B8)

fun getTargetColor(normalizedVal: Float, phaseNorm: Float): Color {
    return when {
        normalizedVal > 0.75f -> Color(0xFFF59E0B) // Gold Peak
        normalizedVal < 0.25f -> Color(0xFF3B82F6) // Cavity
        normalizedVal > 0.55f -> Color(0xFFEF4444) // Ferrous / High Magnetic
        else -> Color(0xFF10B981) // Normal Ground
    }
}
