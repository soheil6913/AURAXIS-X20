import { ScanRecord } from '../types';

// Helper to generate grid data with distinct peaks and cavities
function generateGrid(width: number, length: number, featureType: 'gold_vault' | 'mineral_vein' | 'ancient_cavity'): { gridData: number[]; phaseData: number[] } {
  const size = width * length;
  const gridData = new Array(size).fill(0);
  const phaseData = new Array(size).fill(0);

  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(length / 2);

  for (let y = 0; y < length; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const distToCenter = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

      // Base soil noise (350 - 450 ADC)
      let adc = 380 + Math.sin(x * 0.4) * 20 + Math.cos(y * 0.5) * 25 + (Math.random() * 20 - 10);
      let phase = Math.sin(x * 0.3 + y * 0.2) * 5;

      if (featureType === 'gold_vault') {
        // High metal peak in center, surrounded by cavity drop (tomb/vault)
        if (distToCenter < 2.5) {
          // Gold / Precious metal peak!
          adc = 820 + (3 - distToCenter) * 80 + (Math.random() * 30);
          phase = 42 + (Math.random() * 8);
        } else if (distToCenter >= 2.5 && distToCenter < 4.5) {
          // Cavity / Underground chamber surrounding
          adc = 180 + (distToCenter - 2.5) * 40;
          phase = -35 + (Math.random() * 6);
        }
      } else if (featureType === 'mineral_vein') {
        // Diagonal high magnetic intensity vein
        const diagDist = Math.abs((x - y * 0.7) - 2);
        if (diagDist < 2.0) {
          adc = 720 + (2.0 - diagDist) * 90 + (Math.random() * 30);
          phase = 18 + (Math.random() * 12);
        }
      } else if (featureType === 'ancient_cavity') {
        // Broad deep blue underground tunnel drop
        if (x >= 2 && x <= 5 && y >= 3 && y <= 12) {
          adc = 140 + Math.random() * 30;
          phase = -48 + Math.random() * 10;
        }
      }

      gridData[idx] = Math.round(adc);
      phaseData[idx] = Math.round(phase);
    }
  }

  return { gridData, phaseData };
}

const vaultData = generateGrid(10, 14, 'gold_vault');
const veinData = generateGrid(8, 12, 'mineral_vein');
const cavityData = generateGrid(10, 16, 'ancient_cavity');

export const SAMPLE_SCANS: ScanRecord[] = [
  {
    id: 'scan-001',
    name: 'اسکن اکتشافی منطقه ۱: ساختار دوقطبی و فضای محصور',
    date: '۲۰۲۶/۰۳/۱۵ - ۱۴:۳۰',
    width: 10,
    length: 14,
    soilType: 'خاک کشاورزی (Soil)',
    scanPattern: 'موازی (Parallel)',
    sensorType: 'GOLD_RADAR_X20',
    gridData: vaultData.gridData,
    phaseData: vaultData.phaseData,
    maxDepthMeters: 4.8,
    notes: 'آنومالی دوقطبی مغناطیسی با گرادیان بالا در مختصات (X:5, Y:7) مجاور افت پذیرفتاری محیطی.',
    coordinates: { lat: 35.6892, lng: 51.3890 },
    anomalies: [
      {
        id: 'anom-1',
        x: 5,
        y: 7,
        depthMeters: 3.2,
        value: 910,
        phaseShift: 48,
        type: 'gold',
        confidence: 94,
        evidenceTier: '4. High-quality, repeatable anomaly — independent verification recommended',
        title: 'آنومالی دوقطبی با رسانایی بالا (High Conductivity Dipole)'
      },
      {
        id: 'anom-2',
        x: 5,
        y: 8,
        depthMeters: 4.5,
        value: 160,
        phaseShift: -42,
        type: 'cavity',
        confidence: 88,
        evidenceTier: '3. Multi-sensor anomaly — further investigation recommended',
        title: 'افت گرادیان میدان / ساختار فضای توخالی (Subsurface Void)'
      }
    ]
  },
  {
    id: 'scan-002',
    name: 'اسکن کوهستان: رگه کانی‌سازی فرومغناطیس',
    date: '۲۰۲۶/۰۳/۱۲ - ۰۹:۱۵',
    width: 8,
    length: 12,
    soilType: 'سنگ و صخره (Hard Rock)',
    scanPattern: 'زیگزاگ (Zig-Zag)',
    sensorType: 'FMG3',
    gridData: veinData.gridData,
    phaseData: veinData.phaseData,
    maxDepthMeters: 6.2,
    notes: 'خط مورب مگنتیک بالا ناشی از رگه سنگ‌های آذرین مگنتیت یا کانی‌های فلزی.',
    coordinates: { lat: 36.2605, lng: 59.6168 },
    anomalies: [
      {
        id: 'anom-3',
        x: 3,
        y: 4,
        depthMeters: 2.8,
        value: 840,
        phaseShift: 24,
        type: 'mineral',
        confidence: 79,
        evidenceTier: '3. Multi-sensor anomaly — further investigation recommended',
        title: 'رگه کانی‌سازی فرومغناطیس (Mineralized Vein)'
      }
    ]
  },
  {
    id: 'scan-003',
    name: 'اسکن محوطه باستانی: دالان و راهروی زیرزمینی',
    date: '۲۰۲۶/۰۲/۲۸ - ۱۷:۴۵',
    width: 10,
    length: 16,
    soilType: 'خاک معدنی (Mineral)',
    scanPattern: 'موازی (Parallel)',
    sensorType: 'FLC100',
    gridData: cavityData.gridData,
    phaseData: cavityData.phaseData,
    maxDepthMeters: 5.5,
    notes: 'کاهش پیوسته و خطی شدت میدان مغناطیسی، منطبق بر دالان یا راهروی زیرزمینی.',
    coordinates: { lat: 32.6546, lng: 51.6680 },
    anomalies: [
      {
        id: 'anom-4',
        x: 4,
        y: 8,
        depthMeters: 3.9,
        value: 145,
        phaseShift: -50,
        type: 'cavity',
        confidence: 92,
        evidenceTier: '3. Multi-sensor anomaly — further investigation recommended',
        title: 'دالان زیرزمینی / افت میدان (Subsurface Corridor Drop)'
      }
    ]
  }
];
