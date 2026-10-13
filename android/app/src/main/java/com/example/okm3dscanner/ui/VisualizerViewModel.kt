package com.example.ui

import androidx.lifecycle.ViewModel
import com.example.data.ScanRecord
import com.example.hardware.SensorManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class VisualizerViewModel : ViewModel() {
    val sensorManager = SensorManager()

    private val _gridWidth = MutableStateFlow(10)
    val gridWidth: StateFlow<Int> = _gridWidth.asStateFlow()

    private val _gridLength = MutableStateFlow(14)
    val gridLength: StateFlow<Int> = _gridLength.asStateFlow()

    private val _soilType = MutableStateFlow("خاک کشاورزی (Soil)")
    val soilType: StateFlow<String> = _soilType.asStateFlow()

    private val _scanPattern = MutableStateFlow("موازی (Parallel)")
    val scanPattern: StateFlow<String> = _scanPattern.asStateFlow()

    private val _isScanActive = MutableStateFlow(false)
    val isScanActive: StateFlow<Boolean> = _isScanActive.asStateFlow()

    private val _currentCol = MutableStateFlow(0)
    val currentCol: StateFlow<Int> = _currentCol.asStateFlow()

    private val _currentRow = MutableStateFlow(0)
    val currentRow: StateFlow<Int> = _currentRow.asStateFlow()

    private val _activeScanData = MutableStateFlow<List<Float>>(emptyList())
    val activeScanData: StateFlow<List<Float>> = _activeScanData.asStateFlow()

    private val sampleInitialScan = ScanRecord(
        id = "sample-1",
        name = "اسکن نمونه شیراز (تپه باستانی)",
        date = "1403/05/20",
        width = 10,
        length = 12,
        soilType = "خاک کشاورزی (Soil)",
        scanPattern = "موازی (Parallel)",
        sensorType = "GOLD_RADAR_X20",
        gridData = List(120) { idx ->
            val x = idx % 10
            val y = idx / 10
            if (x in 4..6 && y in 4..7) 850f else 320f
        },
        phaseData = List(120) { 10f },
        notes = "ثبت شده با سنسور مگنتومتر"
    )

    private val _savedScans = MutableStateFlow<List<ScanRecord>>(listOf(sampleInitialScan))
    val savedScans: StateFlow<List<ScanRecord>> = _savedScans.asStateFlow()

    private val _viewedScan = MutableStateFlow<ScanRecord?>(sampleInitialScan)
    val viewedScan: StateFlow<ScanRecord?> = _viewedScan.asStateFlow()

    val yaw = MutableStateFlow(45f)
    val pitch = MutableStateFlow(30f)
    val zoom = MutableStateFlow(1f)
    val panX = MutableStateFlow(0f)
    val panY = MutableStateFlow(0f)
    val zScale = MutableStateFlow(1f)
    val colorThreshold = MutableStateFlow(0.5f)
    val renderStyle = MutableStateFlow("3D Solid Wireframe")
    val isRgbAnalysis = MutableStateFlow(false)
    val selectedNodeIndex = MutableStateFlow<Int?>(null)
    val resetTrigger = MutableStateFlow(0)

    fun updateGridWidth(newW: Int) {
        if (newW in 2..50) _gridWidth.value = newW
    }

    fun updateGridLength(newL: Int) {
        if (newL in 2..50) _gridLength.value = newL
    }

    fun updateSoilType(soil: String) {
        _soilType.value = soil
    }

    fun updateScanPattern(pattern: String) {
        _scanPattern.value = pattern
    }

    fun startNewScan() {
        _activeScanData.value = emptyList()
        _currentCol.value = 0
        _currentRow.value = 0
        _isScanActive.value = true
    }

    fun recordCurrentStep() {
        val currentData = _activeScanData.value.toMutableList()
        val totalPoints = _gridWidth.value * _gridLength.value

        if (currentData.size < totalPoints) {
            val pulseAdc = sensorManager.adcValue.value.toFloat()
            currentData.add(pulseAdc)
            _activeScanData.value = currentData

            val nextIndex = currentData.size
            if (nextIndex < totalPoints) {
                _currentCol.value = nextIndex % _gridWidth.value
                _currentRow.value = nextIndex / _gridWidth.value
            }
        }
    }

    fun cancelScan() {
        _isScanActive.value = false
        _activeScanData.value = emptyList()
    }

    fun loadScanToVisualizer(scan: ScanRecord) {
        _viewedScan.value = scan
    }

    fun saveScanRecord(name: String, notes: String) {
        _viewedScan.value?.let { current ->
            val updated = current.copy(name = name, notes = notes)
            _viewedScan.value = updated
            _savedScans.value = _savedScans.value.map { if (it.id == updated.id) updated else it }
        }
    }
}
