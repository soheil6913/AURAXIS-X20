package com.example.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = CyberGold,
    secondary = CyberCyan,
    background = DarkBg,
    surface = SurfaceBg,
    onPrimary = DarkBg,
    onSecondary = DarkBg,
    onBackground = GrayText,
    onSurface = GrayText
)

@Composable
fun OKM3DScannerTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        content = content
    )
}
