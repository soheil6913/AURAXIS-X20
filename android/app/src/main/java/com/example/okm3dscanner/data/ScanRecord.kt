package com.example.data

data class ScanRecord(
    val id: String,
    val name: String,
    val date: String,
    val width: Int,
    val length: Int,
    val soilType: String,
    val scanPattern: String,
    val sensorType: String,
    val gridData: List<Float>,
    val phaseData: List<Float>,
    val maxDepthMeters: Float = 4.5f,
    val notes: String = "",
    val latitude: Double? = 35.6892,
    val longitude: Double? = 51.3890
)
