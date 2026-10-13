export type ConnectionMode = 'DISCONNECTED' | 'CONNECTING_USB' | 'CONNECTING_BT' | 'USB' | 'BLUETOOTH' | 'SIMULATOR';

export type SensorType = 'GOLD_RADAR_X20' | 'FMG3' | 'FLC100' | 'HMC5883L';

export type SoilType = 'خاک کشاورزی (Soil)' | 'خاک معدنی (Mineral)' | 'سنگ و صخره (Hard Rock)' | 'ماسه خیس (Wet Sand)';

export type ScanPattern = 'موازی (Parallel)' | 'زیگزاگ (Zig-Zag)';

export type RenderStyle = '3d-mesh' | 'point-cloud' | 'wireframe' | 'contour' | 'voxel';

export type EvidenceTier =
  | '1. No significant anomaly detected'
  | '2. Possible anomaly — insufficient evidence'
  | '3. Multi-sensor anomaly — further investigation recommended'
  | '4. High-quality, repeatable anomaly — independent verification recommended';

export interface ImuMotionTelemetry {
  accelX: number; // m/s²
  accelY: number;
  accelZ: number;
  tiltAngleDeg: number;
  motionStabilityPct: number; // 0 - 100%
  isMotionArtifactSuspected: boolean;
  sampleRateHz: number;
}

export interface Anomaly {
  id: string;
  x: number;
  y: number;
  depthMeters: number;
  value: number; // raw ADC
  phaseShift: number;
  type: 'gold' | 'ferrous' | 'cavity' | 'mineral';
  confidence: number; // 0 - 100
  title: string;
  evidenceTier?: EvidenceTier;
  snrRatio?: number;
  deltaAdc?: number;
}

export interface ScanRecord {
  id: string;
  name: string;
  date: string;
  width: number;
  length: number;
  soilType: SoilType;
  scanPattern: ScanPattern;
  sensorType: SensorType;
  gridData: number[]; // ADC values array of length width * length
  phaseData: number[]; // Phase shift values array
  motionFlags?: boolean[]; // Flags per point if motion artifact suspected
  maxDepthMeters: number;
  notes?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  anomalies?: Anomaly[];
}

export interface AiDetectedObject {
  title: string;
  type: 'precious_metal' | 'ferrous' | 'cavity' | 'mineralization';
  depthEstimateMeters: number;
  confidencePercentage: number;
  x: number;
  y: number;
  description: string;
  evidenceTier?: EvidenceTier;
}

export interface AiAnalysisResult {
  summary: string;
  detectedObjects: AiDetectedObject[];
  soilConductivityIndex: number; // e.g. 1-10 scale
  excavationFeasibility: number; // 1 - 100
  mineralInterferenceLevel: 'کم (Low)' | 'متوسط (Medium)' | 'شدید (High)';
  recommendations: string[];
  geophysicalDataInterpretation: string;
  // Tactical Structured Fields
  evidenceTier?: EvidenceTier;
  multiSensorAgreement?: string;
  alternativeHypotheses?: string[];
  scientificLimitations?: string;
  confidenceCalculationFormula?: string;
  baselineStats?: {
    meanAdc: number;
    stdDev: number;
    peakDeltaAdc: number;
    snr: number;
  };
}

export interface RecurringSoilPattern {
  patternTitle: string;
  type: 'soil_baseline' | 'mineralization' | 'moisture_layer' | 'persistent_anomaly';
  description: string;
  affectedScansCount: number;
  consistencyConfidence: number; // 0 - 100
}

export interface UniqueScanAnomaly {
  scanId: string;
  scanName: string;
  anomalyDescription: string;
  significance: 'high' | 'medium' | 'low';
}

export interface MultiScanComparisonResult {
  summary: string;
  soilCorrelationIndex: number; // 0 - 100%
  recurringPatterns: RecurringSoilPattern[];
  uniqueAnomaliesPerScan: UniqueScanAnomaly[];
  operatorRecommendations: string[];
  evidenceTierSummary?: string;
  spatialConsistencyAdvice?: string;
}

