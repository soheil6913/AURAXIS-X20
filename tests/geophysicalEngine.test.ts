/**
 * AURAXIS X20 - Geophysical Engine Unit Test Suite
 * Tests:
 * 1. Filtering & Normalization (ADC to microTesla, median noise filtering)
 * 2. Baseline measurement & drift statistical compensation
 * 3. Anomaly detection, SNR, and 4-tier evidence classification
 * 4. Sensor motion artifact rejection
 * 5. Corrupted, malformed, saturated, and incomplete scans handling
 * 6. Non-uniqueness disclosure & structured 9-point report generation
 */

import {
  adcToMicroTesla,
  medianFilter1D,
  computeBaselineStats,
  extractTacticalAnomalies,
  generateDeterministicTacticalReport
} from '../src/utils/geophysicalEngine';
import { ScanRecord } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST FAILED: ${message}`);
  }
}

export function runTests() {
  console.log('--- Starting AURAXIS X20 Geophysical Engine Tests ---');

  // Test 1: Unit Normalization (ADC to μT)
  console.log('[Test 1] Testing ADC to microTesla normalization across sensor profiles...');
  const utX20 = adcToMicroTesla(380, 'GOLD_RADAR_X20');
  assert(utX20 === 0, `Baseline 380 ADC should equal 0 μT for X20, got ${utX20}`);
  const utPeak = adcToMicroTesla(780, 'GOLD_RADAR_X20');
  assert(utPeak === 100, `780 ADC should equal 100 μT for X20, got ${utPeak}`);
  const utFmg3 = adcToMicroTesla(512, 'FMG3');
  assert(utFmg3 === 0, `Center 512 ADC should equal 0 μT for FMG3, got ${utFmg3}`);

  // Test 2: Median Filter Spikes Rejection
  console.log('[Test 2] Testing 1D median filter transient spike rejection...');
  const noisy = [380, 382, 999, 381, 380]; // single pulse transient glitch at idx 2
  const filtered = medianFilter1D(noisy);
  assert(filtered[2] === 382, `Glitch spike 999 should be suppressed by median filter, got ${filtered[2]}`);

  // Test 3: Baseline Statistics & Outlier Sigma-Clipping
  console.log('[Test 3] Testing robust baseline statistics...');
  const soilData = [380, 385, 375, 382, 378, 380, 384, 850]; // one high peak at end
  const stats = computeBaselineStats(soilData);
  assert(stats.mean < 400, `Baseline mean should exclude outlier 850, got ${stats.mean}`);
  assert(stats.stdDev > 0, `Standard deviation must be positive, got ${stats.stdDev}`);

  // Test 4: 4-Tier Evidence Classification & Motion Artifact Separation
  console.log('[Test 4] Testing 4-tier evidence classifications & motion artifact separation...');
  
  // 4a. Clean uniform soil -> Tier 1
  const uniformScan: ScanRecord = {
    id: 'test-1',
    name: 'Uniform Soil',
    date: '2026/10/13',
    width: 6,
    length: 6,
    soilType: 'خاک کشاورزی (Soil)',
    scanPattern: 'موازی (Parallel)',
    sensorType: 'GOLD_RADAR_X20',
    gridData: new Array(36).fill(380),
    phaseData: new Array(36).fill(0),
    maxDepthMeters: 4.5
  };
  const resUniform = extractTacticalAnomalies(uniformScan);
  assert(resUniform.primaryTier === '1. No significant anomaly detected', `Uniform grid should be Tier 1, got ${resUniform.primaryTier}`);

  // 4b. High peak with spatial clustering & phase agreement -> Tier 4
  const highPeakGrid = new Array(36).fill(380);
  const phaseGrid = new Array(36).fill(0);
  // Cluster around center (2,2)
  highPeakGrid[14] = 850; // (2, 2)
  highPeakGrid[15] = 720; // neighbor
  highPeakGrid[20] = 730; // neighbor
  highPeakGrid[8] = 710;  // neighbor
  phaseGrid[14] = 45;
  phaseGrid[15] = 30;

  const validAnomalyScan: ScanRecord = {
    ...uniformScan,
    id: 'test-2',
    gridData: highPeakGrid,
    phaseData: phaseGrid
  };
  const resValid = extractTacticalAnomalies(validAnomalyScan);
  assert(
    resValid.primaryTier === '4. High-quality, repeatable anomaly — independent verification recommended',
    `Clustered peak with phase confirmation should be Tier 4, got ${resValid.primaryTier}`
  );

  // 4c. High peak BUT motion artifact flagged -> Must be downgraded to Tier 2 (insufficient evidence)
  const motionFlags = new Array(36).fill(false);
  motionFlags[14] = true; // Probe was tilted / jerked during peak acquisition!
  const resMotion = extractTacticalAnomalies(validAnomalyScan, motionFlags);
  assert(
    resMotion.primaryTier === '2. Possible anomaly — insufficient evidence',
    `Peak with motion artifact must be downgraded to Tier 2, got ${resMotion.primaryTier}`
  );

  // Test 5: Incomplete & Corrupted Scan Handling
  console.log('[Test 5] Testing incomplete scan and saturation detection...');
  const incompleteScan: ScanRecord = {
    ...uniformScan,
    id: 'test-3',
    width: 10,
    length: 10,
    gridData: [380, 1024, 0, 380] // Only 4 points recorded out of 100, with sensor saturation!
  };
  const reportIncomplete = generateDeterministicTacticalReport(incompleteScan);
  assert(reportIncomplete.sensorHealth.dataCompletenessPct === 4, `Completeness should be 4%, got ${reportIncomplete.sensorHealth.dataCompletenessPct}%`);
  assert(reportIncomplete.sensorHealth.isSaturated === true, 'Saturation should be detected for 1024 ADC');
  assert(reportIncomplete.confidencePercentage <= 50, `Confidence must be penalized for incomplete/saturated scan, got ${reportIncomplete.confidencePercentage}%`);

  // Test 6: Scientific Non-Uniqueness Verification
  console.log('[Test 6] Verifying scientific non-uniqueness limitation disclosure...');
  assert(
    reportIncomplete.scientificLimitationsFa.includes('میدان‌های مغناطیسی و القایی به تنهایی هرگز قادر به اثبات قطعی نوع فلز') ||
    reportIncomplete.scientificLimitationsFa.includes('اصل عدم قطعیت پتانسیل ژئوفیزیک'),
    'Report must include scientific non-uniqueness disclosure'
  );

  console.log('✅ ALL AURAXIS X20 GEOPHYSICAL ENGINE TESTS PASSED SUCCESSFULLY!');
}

runTests();
