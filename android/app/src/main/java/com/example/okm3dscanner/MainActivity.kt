package com.example.okm3dscanner

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.example.ui.AppDashboard
import com.example.ui.VisualizerViewModel
import com.example.ui.theme.DarkBg
import com.example.ui.theme.OKM3DScannerTheme

class MainActivity : ComponentActivity() {
    private val visualizerViewModel: VisualizerViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            OKM3DScannerTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = DarkBg
                ) {
                    AppDashboard(viewModel = visualizerViewModel)
                }
            }
        }
    }
}
