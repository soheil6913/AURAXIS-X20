/**
 * AURAXIS X20 - Advanced GIS Data Exporter (CSV & KML)
 * 
 * Generates standards-compliant exports for:
 * - Google Earth Pro & Google Earth Web (.kml)
 * - QGIS / ArcGIS / Global Mapper (.kml & .csv)
 * - Golden Software Surfer / Voxler (2D & 3D grid matrices)
 * - Python GeoPandas / MATLAB / Excel
 */

import { ScanRecord } from '../types';
import { adcToMicroTesla } from './geophysicalEngine';

export interface GisExportOptions {
  stepMeters?: number; // Distance in meters between survey points (default: 0.5m)
  headingDegrees?: number; // Survey orientation relative to true North (default: 0)
  includeBoundaryPolygon?: boolean;
  includeGridPoints?: boolean;
  includeAnomalies?: boolean;
  baseLat?: number;
  baseLng?: number;
}

/**
 * Calculates (lat, lng) from a base coordinate and (eastOffsetMeters, northOffsetMeters)
 * 1 degree latitude ~= 111,320 meters
 * 1 degree longitude ~= 111,320 * cos(lat) meters
 */
export function offsetCoordinates(
  baseLat: number,
  baseLng: number,
  eastMeters: number,
  northMeters: number
): { lat: number; lng: number } {
  const earthRadius = 6378137.0; // WGS84 major radius
  const dLat = (northMeters / earthRadius) * (180 / Math.PI);
  const dLng = (eastMeters / (earthRadius * Math.cos((baseLat * Math.PI) / 180))) * (180 / Math.PI);

  return {
    lat: Number((baseLat + dLat).toFixed(7)),
    lng: Number((baseLng + dLng).toFixed(7))
  };
}

/**
 * Escape XML special characters for valid KML
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Export a single ScanRecord to a comprehensive GIS-ready CSV string
 */
export function generateScanCsv(scan: ScanRecord, options: GisExportOptions = {}): string {
  const step = options.stepMeters ?? 0.5;
  const baseLat = scan.coordinates?.lat ?? options.baseLat ?? 35.6892;
  const baseLng = scan.coordinates?.lng ?? options.baseLng ?? 51.3890;

  let csv = `# =============================================================================\n`;
  csv += `# AURAXIS X20 TACTICAL GEOPHYSICAL DATASET\n`;
  csv += `# Project Name: "${scan.name.replace(/"/g, '""')}"\n`;
  csv += `# Survey Date: "${scan.date}"\n`;
  csv += `# Dimensions: ${scan.width} Columns (X) x ${scan.length} Rows (Y)\n`;
  csv += `# Step Spacing: ${step} meters per point (Total Area: ${(scan.width * step).toFixed(1)}m x ${(scan.length * step).toFixed(1)}m)\n`;
  csv += `# Soil Profile: "${scan.soilType}"\n`;
  csv += `# Sensor Driver: "${scan.sensorType}"\n`;
  csv += `# Scan Pattern: "${scan.scanPattern}"\n`;
  csv += `# Max Estimated Depth: ${scan.maxDepthMeters} meters\n`;
  csv += `# Base Georeference: WGS84 (Lat: ${baseLat}, Lng: ${baseLng})\n`;
  if (scan.notes) {
    csv += `# Notes: "${scan.notes.replace(/"/g, '""')}"\n`;
  }
  csv += `# Exported At: "${new Date().toISOString()}"\n`;
  csv += `# =============================================================================\n\n`;

  // 1. Point Data Table with GIS Coordinates
  csv += `Point_Index,Grid_X,Grid_Y,East_Offset_m,North_Offset_m,Latitude,Longitude,ADC_Raw,Magnetic_Flux_uT,Phase_Shift_Deg,Estimated_Depth_m,Classification,Evidence_Tier\n`;

  const totalPoints = scan.width * scan.length;
  for (let i = 0; i < totalPoints; i++) {
    const col = i % scan.width; // 0-indexed
    const row = Math.floor(i / scan.width); // 0-indexed

    const eastMeters = col * step;
    const northMeters = row * step;
    const { lat, lng } = offsetCoordinates(baseLat, baseLng, eastMeters, northMeters);

    const adc = scan.gridData[i] ?? 380;
    const phase = scan.phaseData?.[i] ?? 0;
    const uT = adcToMicroTesla(adc, scan.sensorType);
    const depth = Number((scan.maxDepthMeters * (1 - Math.min(Math.max(adc, 0), 1024) / 1024)).toFixed(2));

    let classification = 'Background_Soil';
    let tier = 'Tier_1_No_Significant_Anomaly';

    if (adc > 750 && phase > 15) {
      classification = 'High_Conductivity_Dipole';
      tier = 'Tier_4_High_Quality_Repeatable';
    } else if (adc > 650) {
      classification = 'Positive_Magnetic_Peak';
      tier = 'Tier_3_Multi_Sensor_Anomaly';
    } else if (adc < 240) {
      classification = 'Subsurface_Void_Cavity';
      tier = 'Tier_3_Multi_Sensor_Anomaly';
    } else if (adc > 520 || adc < 300) {
      classification = 'Possible_Variation';
      tier = 'Tier_2_Possible_Anomaly';
    }

    csv += `${i + 1},${col + 1},${row + 1},${eastMeters.toFixed(2)},${northMeters.toFixed(2)},${lat},${lng},${adc},${uT},${phase},${depth},${classification},${tier}\n`;
  }

  // 2. 2D ADC Signal Matrix for MATLAB / Surfer / Python Pandas
  csv += `\n# 2D ADC INTENSITY GRID MATRIX (Rows: Y, Columns: X)\n`;
  const colHeaders = Array.from({ length: scan.width }, (_, idx) => `X_${idx + 1}`).join(',');
  csv += `Row_Y,${colHeaders}\n`;

  for (let r = 0; r < scan.length; r++) {
    const rowVals = [];
    for (let c = 0; c < scan.width; c++) {
      rowVals.push(scan.gridData[r * scan.width + c] ?? 380);
    }
    csv += `Y_${r + 1},${rowVals.join(',')}\n`;
  }

  return csv;
}

/**
 * Generate a complete, compliant KML document for Google Earth & QGIS/ArcGIS
 */
export function generateScanKml(scan: ScanRecord, options: GisExportOptions = {}): string {
  const step = options.stepMeters ?? 0.5;
  const baseLat = scan.coordinates?.lat ?? options.baseLat ?? 35.6892;
  const baseLng = scan.coordinates?.lng ?? options.baseLng ?? 51.3890;
  const includeBoundary = options.includeBoundaryPolygon !== false;
  const includeGrid = options.includeGridPoints !== false;

  const widthMeters = (scan.width - 1) * step;
  const lengthMeters = (scan.length - 1) * step;

  // Calculate 4 corners of survey footprint
  const cornerSW = offsetCoordinates(baseLat, baseLng, 0, 0);
  const cornerSE = offsetCoordinates(baseLat, baseLng, widthMeters, 0);
  const cornerNE = offsetCoordinates(baseLat, baseLng, widthMeters, lengthMeters);
  const cornerNW = offsetCoordinates(baseLat, baseLng, 0, lengthMeters);

  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
  <Document>
    <name>${escapeXml(scan.name)}</name>
    <description><![CDATA[
      <div style="font-family: sans-serif; direction: rtl; text-align: right; padding: 10px;">
        <h3 style="color: #f59e0b; margin-top: 0;">AURAXIS X20 — Tactical Geophysical Survey</h3>
        <p><strong>تاریخ اسکن:</strong> ${escapeXml(scan.date)}</p>
        <p><strong>بستر خاک:</strong> ${escapeXml(scan.soilType)}</p>
        <p><strong>سنسور:</strong> ${escapeXml(scan.sensorType)}</p>
        <p><strong>ابعاد شبکه:</strong> ${scan.width} × ${scan.length} (${scan.width * scan.length} نقطه)</p>
        <p><strong>فاصله گام‌ها:</strong> ${step} متر</p>
        <p><strong>حداکثر عمق کاوش:</strong> ${scan.maxDepthMeters} متر</p>
        ${scan.notes ? `<p><strong>یادداشت:</strong> ${escapeXml(scan.notes)}</p>` : ''}
        <hr style="border: 0; border-top: 1px solid #ccc;"/>
        <p style="font-size: 11px; color: #666;">
          صادر شده توسط سامانه AURAXIS X20 برای مشاهده در Google Earth و QGIS
        </p>
      </div>
    ]]></description>

    <!-- Custom Point Styles -->
    <!-- Red Pin: High Anomaly / Peak -->
    <Style id="style-high-anomaly">
      <IconStyle>
        <color>ff0000ff</color>
        <scale>1.2</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <scale>0.8</scale>
      </LabelStyle>
    </Style>

    <!-- Amber Pin: Mineral / Moderate -->
    <Style id="style-mineral">
      <IconStyle>
        <color>ff00aaff</color>
        <scale>1.0</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/orange-circle.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <scale>0.7</scale>
      </LabelStyle>
    </Style>

    <!-- Cyan Pin: Cavity / Void Drop -->
    <Style id="style-cavity">
      <IconStyle>
        <color>ffffff00</color>
        <scale>1.1</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <scale>0.8</scale>
      </LabelStyle>
    </Style>

    <!-- Green Pin: Soil Baseline -->
    <Style id="style-soil">
      <IconStyle>
        <color>ff00aa00</color>
        <scale>0.7</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <scale>0.0</scale>
      </LabelStyle>
    </Style>

    <!-- Footprint Polygon Style -->
    <Style id="style-boundary">
      <LineStyle>
        <color>ff00e5ff</color>
        <width>2.5</width>
      </LineStyle>
      <PolyStyle>
        <color>3300e5ff</color>
        <fill>1</fill>
        <outline>1</outline>
      </PolyStyle>
    </Style>
`;

  // 1. Boundary Footprint Polygon
  if (includeBoundary) {
    kml += `
    <Placemark>
      <name>محدوده اسکن (Survey Boundary Footprint)</name>
      <styleUrl>#style-boundary</styleUrl>
      <Polygon>
        <extrude>1</extrude>
        <altitudeMode>clampToGround</altitudeMode>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              ${cornerSW.lng},${cornerSW.lat},0
              ${cornerSE.lng},${cornerSE.lat},0
              ${cornerNE.lng},${cornerNE.lat},0
              ${cornerNW.lng},${cornerNW.lat},0
              ${cornerSW.lng},${cornerSW.lat},0
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
`;
  }

  // 2. High Anomaly Placemarks Folder
  kml += `
    <Folder>
      <name>نقاط برجسته و آنومالی‌ها (Key Anomalies)</name>
      <open>1</open>
`;

  // Extract top peaks and drops
  const totalPoints = scan.width * scan.length;
  for (let i = 0; i < totalPoints; i++) {
    const adc = scan.gridData[i] ?? 380;
    const phase = scan.phaseData?.[i] ?? 0;
    const isPeak = adc > 720;
    const isCavity = adc < 240 && phase < -15;

    if (isPeak || isCavity) {
      const col = i % scan.width;
      const row = Math.floor(i / scan.width);
      const { lat, lng } = offsetCoordinates(baseLat, baseLng, col * step, row * step);
      const uT = adcToMicroTesla(adc, scan.sensorType);
      const depth = Number((scan.maxDepthMeters * (1 - Math.min(Math.max(adc, 0), 1024) / 1024)).toFixed(2));

      const title = isPeak
        ? `آنومالی مغناطیسی: ${adc} ADC (X:${col + 1}, Y:${row + 1})`
        : `افت حفره زیرزمینی: ${adc} ADC (X:${col + 1}, Y:${row + 1})`;
      const styleId = isPeak ? '#style-high-anomaly' : '#style-cavity';

      kml += `
      <Placemark>
        <name>${escapeXml(title)}</name>
        <styleUrl>${styleId}</styleUrl>
        <description><![CDATA[
          <table border="1" cellpadding="4" cellspacing="0" style="font-family: sans-serif; font-size: 12px; border-collapse: collapse;">
            <tr bgcolor="#1e293b" style="color: #fff;"><th>ویژگی ژئوفیزیک</th><th>مقدار</th></tr>
            <tr><td>مختصات شبکه</td><td>ستون X:${col + 1} | خط Y:${row + 1}</td></tr>
            <tr><td>شدت سیگنال (ADC)</td><td><strong>${adc}</strong></td></tr>
            <tr><td>چگالی شار مغناطیسی</td><td><strong>${uT} μT</strong></td></tr>
            <tr><td>زاویه اختلاف فاز</td><td>${phase}°</td></tr>
            <tr><td>تخمین عمق مدل دوقطبی</td><td><strong>${depth} متر</strong></td></tr>
            <tr><td>طول و عرض جغرافیایی</td><td>${lat}, ${lng}</td></tr>
          </table>
        ]]></description>
        <ExtendedData>
          <Data name="ADC_Value"><value>${adc}</value></Data>
          <Data name="Magnetic_Flux_uT"><value>${uT}</value></Data>
          <Data name="Phase_Shift"><value>${phase}</value></Data>
          <Data name="Estimated_Depth_m"><value>${depth}</value></Data>
          <Data name="Grid_Col"><value>${col + 1}</value></Data>
          <Data name="Grid_Row"><value>${row + 1}</value></Data>
        </ExtendedData>
        <Point>
          <altitudeMode>clampToGround</altitudeMode>
          <coordinates>${lng},${lat},0</coordinates>
        </Point>
      </Placemark>
`;
    }
  }
  kml += `    </Folder>\n`;

  // 3. Complete Grid Survey Points Folder
  if (includeGrid) {
    kml += `
    <Folder>
      <name>ماتریس کامل نقاط اسکن (${totalPoints} نقطه)</name>
      <open>0</open>
`;

    for (let i = 0; i < totalPoints; i++) {
      const col = i % scan.width;
      const row = Math.floor(i / scan.width);
      const { lat, lng } = offsetCoordinates(baseLat, baseLng, col * step, row * step);
      const adc = scan.gridData[i] ?? 380;
      const phase = scan.phaseData?.[i] ?? 0;
      const uT = adcToMicroTesla(adc, scan.sensorType);
      const depth = Number((scan.maxDepthMeters * (1 - Math.min(Math.max(adc, 0), 1024) / 1024)).toFixed(2));

      let styleId = '#style-soil';
      if (adc > 750) styleId = '#style-high-anomaly';
      else if (adc > 550) styleId = '#style-mineral';
      else if (adc < 250) styleId = '#style-cavity';

      kml += `
      <Placemark>
        <name>P${i + 1} (${adc})</name>
        <styleUrl>${styleId}</styleUrl>
        <ExtendedData>
          <Data name="Point_Index"><value>${i + 1}</value></Data>
          <Data name="Grid_X"><value>${col + 1}</value></Data>
          <Data name="Grid_Y"><value>${row + 1}</value></Data>
          <Data name="ADC"><value>${adc}</value></Data>
          <Data name="Flux_uT"><value>${uT}</value></Data>
          <Data name="Phase_Deg"><value>${phase}</value></Data>
          <Data name="Depth_m"><value>${depth}</value></Data>
        </ExtendedData>
        <Point>
          <altitudeMode>clampToGround</altitudeMode>
          <coordinates>${lng},${lat},0</coordinates>
        </Point>
      </Placemark>
`;
    }

    kml += `    </Folder>\n`;
  }

  kml += `
  </Document>
</kml>`;

  return kml;
}

/**
 * Generate a multi-scan GIS KML archive containing all saved scans
 */
export function generateAllScansKml(scans: ScanRecord[], options: GisExportOptions = {}): string {
  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>AURAXIS X20 — All Scans GIS Master Archive</name>
    <description>آرشیو کامل اسکن‌های ژئوفیزیک AURAXIS X20 شامل ${scans.length} پروژه اسکن زمین</description>
`;

  scans.forEach((scan) => {
    const scanKmlContent = generateScanKml(scan, options);
    // Extract Document body
    const docStart = scanKmlContent.indexOf('<Document>');
    const docEnd = scanKmlContent.lastIndexOf('</Document>');
    if (docStart >= 0 && docEnd >= 0) {
      const inner = scanKmlContent.slice(docStart + '<Document>'.length, docEnd);
      kml += `
    <Folder>
      <name>${escapeXml(scan.name)} (${escapeXml(scan.date)})</name>
      ${inner}
    </Folder>
`;
    }
  });

  kml += `
  </Document>
</kml>`;

  return kml;
}
