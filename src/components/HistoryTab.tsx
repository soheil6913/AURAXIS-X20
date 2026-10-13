import React, { useState } from 'react';
import { ScanRecord } from '../types';
import {
  History,
  Search,
  Trash2,
  Box,
  Sparkles,
  Download,
  Calendar,
  Layers,
  MapPin,
  FileSpreadsheet,
  FileCode,
  X,
  ArrowUpDown,
  BarChart2,
  TrendingUp,
  Activity,
  Award,
  Globe,
  GitCompare,
  CheckCircle2,
  ArrowRightLeft,
  Scale,
  Zap,
  Check
} from 'lucide-react';

interface HistoryTabProps {
  scans: ScanRecord[];
  onLoadScan: (scan: ScanRecord) => void;
  onDeleteScan: (id: string) => void;
  onNavigateToAiWithScan: (scan: ScanRecord) => void;
}

// Helper to escape XML strings for KML specifications
const escapeXml = (unsafe: string): string => {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
};

// Download Helper
export const downloadFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Export individual scan to JSON
export const exportScanToJson = (scan: ScanRecord) => {
  const safeName = scan.name.replace(/[^\w\d_\-]/gi, '_') || 'scan';
  const fileName = `${safeName}_${scan.id.slice(0, 6)}.json`;
  const jsonString = JSON.stringify(scan, null, 2);
  downloadFile(fileName, jsonString, 'application/json;charset=utf-8;');
};

// Export individual scan to GIS-ready CSV with Metadata, Coordinates & 2D Matrix
export const exportScanToCsv = (scan: ScanRecord) => {
  const safeName = scan.name.replace(/[^\w\d_\-]/gi, '_') || 'scan';
  const fileName = `${safeName}_${scan.id.slice(0, 6)}.csv`;

  const baseLat = scan.coordinates?.lat ?? 35.6892;
  const baseLng = scan.coordinates?.lng ?? 51.3890;
  const isGeoreferenced = Boolean(scan.coordinates?.lat && scan.coordinates?.lng);

  const stepMeters = 0.5; // Estimated 0.5m survey grid step resolution
  const latPerMeter = 1 / 111320;
  const lngPerMeter = 1 / (111320 * Math.cos((baseLat * Math.PI) / 180));

  // Build CSV metadata header
  let csvContent = `# AURAXIS X20 - ADVANCED TACTICAL GEOPHYSICAL GROUND SCAN DATA (GIS EXPORT)\n`;
  csvContent += `# Scan Title, "${scan.name.replace(/"/g, '""')}"\n`;
  csvContent += `# Date, "${scan.date}"\n`;
  csvContent += `# Grid Dimensions, ${scan.width} Cols x ${scan.length} Rows (${scan.width * scan.length} Total Points)\n`;
  csvContent += `# Soil Profile, "${scan.soilType}"\n`;
  csvContent += `# Scan Pattern, "${scan.scanPattern}"\n`;
  csvContent += `# Sensor Hardware, "${scan.sensorType}"\n`;
  csvContent += `# Max Depth Estimation, ${scan.maxDepthMeters} meters\n`;
  csvContent += `# Base Datum Latitude, ${baseLat.toFixed(7)}\n`;
  csvContent += `# Base Datum Longitude, ${baseLng.toFixed(7)}\n`;
  csvContent += `# Georeferenced Status, "${isGeoreferenced ? 'VERIFIED_GPS' : 'LOCAL_REFERENCE'}"\n`;
  if (scan.notes) {
    csvContent += `# Notes, "${scan.notes.replace(/"/g, '""')}"\n`;
  }
  csvContent += `# Scientific Notice, "Magnetic anomalies indicate field variations, not definitive chemical/metallurgical composition."\n`;
  csvContent += `# Export Timestamp, "${new Date().toISOString()}"\n`;
  csvContent += `\n`;

  // 1. Tabular GIS Format for QGIS / ArcGIS / Surfer / Excel
  csvContent += `Index,X_Col,Y_Row,Relative_X_m,Relative_Y_m,Latitude,Longitude,ADC_Value,Flux_uT,Phase_Degrees,Estimated_Depth_m,Target_Classification,Motion_Artifact\n`;

  const totalPoints = scan.width * scan.length;
  for (let i = 0; i < totalPoints; i++) {
    const col = (i % scan.width);
    const row = Math.floor(i / scan.width);
    const x = col + 1;
    const y = row + 1;
    const adc = scan.gridData[i] ?? 0;
    const phase = scan.phaseData?.[i] ?? 0;
    const depth = Number((scan.maxDepthMeters * (1 - adc / 1024)).toFixed(2));
    const flux_uT = Number(((adc - 512) * 0.1).toFixed(2));
    const motionArtifact = scan.motionFlags?.[i] ? 'TRUE' : 'FALSE';

    const relX = Number(((col - (scan.width - 1) / 2) * stepMeters).toFixed(2));
    const relY = Number(((row - (scan.length - 1) / 2) * stepMeters).toFixed(2));
    const pointLat = (baseLat + relY * latPerMeter).toFixed(7);
    const pointLng = (baseLng + relX * lngPerMeter).toFixed(7);

    let classification = 'Standard_Soil';
    if (adc < 250) classification = 'Cavity_Void';
    else if (adc > 750) classification = 'Positive_Magnetic_Peak';
    else if (adc > 550) classification = 'Moderate_Magnetic_Anomaly';

    csvContent += `${i + 1},${x},${y},${relX},${relY},${pointLat},${pointLng},${adc},${flux_uT},${phase},${depth},${classification},${motionArtifact}\n`;
  }

  // 2. 2D Signal Matrix Format (Compatible with Golden Software Surfer / Voxler / MATLAB / Python Pandas)
  csvContent += `\n# 2D ADC SIGNAL INTENSITY MATRIX (Rows = Y, Columns = X)\n`;
  const xHeaders = Array.from({ length: scan.width }, (_, idx) => `X_${idx + 1}`).join(',');
  csvContent += `Y_Row,${xHeaders}\n`;

  for (let r = 0; r < scan.length; r++) {
    const rowValues = [];
    for (let c = 0; c < scan.width; c++) {
      const idx = r * scan.width + c;
      rowValues.push(scan.gridData[idx] ?? 0);
    }
    csvContent += `Y_${r + 1},${rowValues.join(',')}\n`;
  }

  downloadFile(fileName, csvContent, 'text/csv;charset=utf-8;');
};

// Export individual scan to OGC KML 2.2 (Google Earth & GIS)
export const exportScanToKml = (scan: ScanRecord) => {
  const safeName = scan.name.replace(/[^\w\d_\-]/gi, '_') || 'scan';
  const fileName = `${safeName}_${scan.id.slice(0, 6)}.kml`;

  const baseLat = scan.coordinates?.lat ?? 35.6892;
  const baseLng = scan.coordinates?.lng ?? 51.3890;
  const isGeoreferenced = Boolean(scan.coordinates?.lat && scan.coordinates?.lng);

  const stepMeters = 0.5; // 0.5m grid spacing
  const latPerMeter = 1 / 111320;
  const lngPerMeter = 1 / (111320 * Math.cos((baseLat * Math.PI) / 180));

  const totalWidthMeters = (scan.width - 1) * stepMeters;
  const totalLengthMeters = (scan.length - 1) * stepMeters;
  const halfW = totalWidthMeters / 2;
  const halfL = totalLengthMeters / 2;

  // 4 corners of survey perimeter (WGS84)
  const swLat = (baseLat - halfL * latPerMeter).toFixed(7);
  const swLng = (baseLng - halfW * lngPerMeter).toFixed(7);
  const seLat = (baseLat - halfL * latPerMeter).toFixed(7);
  const seLng = (baseLng + halfW * lngPerMeter).toFixed(7);
  const neLat = (baseLat + halfL * latPerMeter).toFixed(7);
  const neLng = (baseLng + halfW * lngPerMeter).toFixed(7);
  const nwLat = (baseLat + halfL * latPerMeter).toFixed(7);
  const nwLng = (baseLng - halfW * lngPerMeter).toFixed(7);

  const peakAdc = Math.max(...(scan.gridData || [0]));
  const avgAdc = scan.gridData.length > 0
    ? Math.round(scan.gridData.reduce((a, b) => a + b, 0) / scan.gridData.length)
    : 500;

  let kml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  kml += `<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">\n`;
  kml += `  <Document>\n`;
  kml += `    <name>${escapeXml(scan.name)} - AURAXIS X20 Survey</name>\n`;
  kml += `    <open>1</open>\n`;
  kml += `    <description><![CDATA[\n`;
  kml += `      <div style="font-family:sans-serif; direction:rtl; text-align:right;">\n`;
  kml += `        <h2 style="color:#d97706; margin:0 0 8px;">AURAXIS X20 — گزارش برداشت ژئوفیزیک GIS</h2>\n`;
  kml += `        <p><strong>نام اسکن:</strong> ${escapeXml(scan.name)}</p>\n`;
  kml += `        <p><strong>تاریخ برداشت:</strong> ${escapeXml(scan.date)}</p>\n`;
  kml += `        <p><strong>ابعاد شبکه:</strong> ${scan.width} ستون × ${scan.length} خط (${scan.width * scan.length} نقطه)</p>\n`;
  kml += `        <p><strong>بستر خاک:</strong> ${escapeXml(scan.soilType)}</p>\n`;
  kml += `        <p><strong>سنسور:</strong> ${escapeXml(scan.sensorType)}</p>\n`;
  kml += `        <p><strong>حداکثر عمق تخمینی:</strong> ${scan.maxDepthMeters} متر</p>\n`;
  kml += `        <p><strong>پیک شدت مغناطیسی:</strong> ${peakAdc} ADC (میانگین: ${avgAdc})</p>\n`;
  kml += `        <p><strong>مختصات مبنا:</strong> ${baseLat.toFixed(5)}, ${baseLng.toFixed(5)} (${isGeoreferenced ? 'ثبت زنده GPS' : 'مبنای مرجع'})</p>\n`;
  if (scan.notes) {
    kml += `        <p><strong>یادداشت:</strong> ${escapeXml(scan.notes)}</p>\n`;
  }
  kml += `        <p style="color:#64748b; font-size:11px;">تذکر: داده‌های میدان پتانسیل مغناطیسی نمایانگر تغییرات نفوذپذیری میدان هستند و هویت دقیق مواد بدون نمونه‌برداری اثبات نمی‌شود.</p>\n`;
  kml += `      </div>\n`;
  kml += `    ]]></description>\n\n`;

  // Styles
  kml += `    <!-- Styles -->\n`;
  kml += `    <Style id="surveyBoundary">\n`;
  kml += `      <LineStyle><color>ff00e5ff</color><width>3</width></LineStyle>\n`;
  kml += `      <PolyStyle><color>3300e5ff</color><fill>1</fill><outline>1</outline></PolyStyle>\n`;
  kml += `    </Style>\n`;
  kml += `    <Style id="centerPlacemark">\n`;
  kml += `      <IconStyle><scale>1.3</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/target.png</href></Icon></IconStyle>\n`;
  kml += `    </Style>\n`;
  kml += `    <Style id="highAnomaly">\n`;
  kml += `      <IconStyle><scale>1.2</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/ylw-circle.png</href></Icon></IconStyle>\n`;
  kml += `    </Style>\n`;
  kml += `    <Style id="cavityAnomaly">\n`;
  kml += `      <IconStyle><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/blu-circle.png</href></Icon></IconStyle>\n`;
  kml += `    </Style>\n`;
  kml += `    <Style id="gridNode">\n`;
  kml += `      <IconStyle><scale>0.6</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon></IconStyle>\n`;
  kml += `    </Style>\n\n`;

  // Folder 1: Survey Perimeter Polygon
  kml += `    <Folder>\n`;
  kml += `      <name>محدوده اسکن (Survey Footprint)</name>\n`;
  kml += `      <Placemark>\n`;
  kml += `        <name>محیط اسکن: ${escapeXml(scan.name)}</name>\n`;
  kml += `        <styleUrl>#surveyBoundary</styleUrl>\n`;
  kml += `        <Polygon>\n`;
  kml += `          <tessellate>1</tessellate>\n`;
  kml += `          <outerBoundaryIs>\n`;
  kml += `            <LinearRing>\n`;
  kml += `              <coordinates>\n`;
  kml += `                ${swLng},${swLat},0\n`;
  kml += `                ${seLng},${seLat},0\n`;
  kml += `                ${neLng},${neLat},0\n`;
  kml += `                ${nwLng},${nwLat},0\n`;
  kml += `                ${swLng},${swLat},0\n`;
  kml += `              </coordinates>\n`;
  kml += `            </LinearRing>\n`;
  kml += `          </outerBoundaryIs>\n`;
  kml += `        </Polygon>\n`;
  kml += `      </Placemark>\n`;

  // Center Placemark with ExtendedData
  kml += `      <Placemark>\n`;
  kml += `        <name>مرکز سایت: ${escapeXml(scan.name)}</name>\n`;
  kml += `        <styleUrl>#centerPlacemark</styleUrl>\n`;
  kml += `        <ExtendedData>\n`;
  kml += `          <Data name="ScanID"><value>${scan.id}</value></Data>\n`;
  kml += `          <Data name="SoilType"><value>${escapeXml(scan.soilType)}</value></Data>\n`;
  kml += `          <Data name="PeakADC"><value>${peakAdc}</value></Data>\n`;
  kml += `          <Data name="MaxDepth_m"><value>${scan.maxDepthMeters}</value></Data>\n`;
  kml += `        </ExtendedData>\n`;
  kml += `        <Point>\n`;
  kml += `          <coordinates>${baseLng.toFixed(7)},${baseLat.toFixed(7)},0</coordinates>\n`;
  kml += `        </Point>\n`;
  kml += `      </Placemark>\n`;
  kml += `    </Folder>\n\n`;

  // Folder 2: Significant Anomalies
  kml += `    <Folder>\n`;
  kml += `      <name>آنومالی‌های شاخص (Anomalies)</name>\n`;
  const totalPoints = scan.width * scan.length;
  for (let i = 0; i < totalPoints; i++) {
    const adc = scan.gridData[i] ?? 0;
    const phase = scan.phaseData?.[i] ?? 0;
    const isPeak = adc > 700;
    const isVoid = adc < 230;

    if (isPeak || isVoid) {
      const col = i % scan.width;
      const row = Math.floor(i / scan.width);
      const offX = (col - (scan.width - 1) / 2) * stepMeters;
      const offY = (row - (scan.length - 1) / 2) * stepMeters;
      const ptLat = (baseLat + offY * latPerMeter).toFixed(7);
      const ptLng = (baseLng + offX * lngPerMeter).toFixed(7);
      const estDepth = (scan.maxDepthMeters * (1 - adc / 1024)).toFixed(2);
      const styleId = isPeak ? '#highAnomaly' : '#cavityAnomaly';
      const label = isPeak ? `آنومالی مغناطیسی مثبت (ADC ${adc})` : `حفره و خلاء زمین (ADC ${adc})`;

      kml += `      <Placemark>\n`;
      kml += `        <name>${label} [X:${col + 1}, Y:${row + 1}]</name>\n`;
      kml += `        <styleUrl>${styleId}</styleUrl>\n`;
      kml += `        <description><![CDATA[\n`;
      kml += `          <strong>شدت پالس ADC:</strong> ${adc}<br/>\n`;
      kml += `          <strong>اختلاف فاز:</strong> ${phase}°<br/>\n`;
      kml += `          <strong>عمق تخمینی:</strong> ${estDepth} متر<br/>\n`;
      kml += `          <strong>مختصات:</strong> Lat ${ptLat}, Lng ${ptLng}<br/>\n`;
      kml += `          <strong>موقعیت شبکه:</strong> ستون ${col + 1}، خط ${row + 1}\n`;
      kml += `        ]]></description>\n`;
      kml += `        <ExtendedData>\n`;
      kml += `          <Data name="ADC_Value"><value>${adc}</value></Data>\n`;
      kml += `          <Data name="Phase_Deg"><value>${phase}</value></Data>\n`;
      kml += `          <Data name="Estimated_Depth_m"><value>${estDepth}</value></Data>\n`;
      kml += `          <Data name="Classification"><value>${isPeak ? 'Positive_Magnetic_Peak' : 'Subsurface_Cavity'}</value></Data>\n`;
      kml += `        </ExtendedData>\n`;
      kml += `        <Point>\n`;
      kml += `          <coordinates>${ptLng},${ptLat},0</coordinates>\n`;
      kml += `        </Point>\n`;
      kml += `      </Placemark>\n`;
    }
  }
  kml += `    </Folder>\n\n`;

  // Folder 3: Full Grid Measurement Point Cloud
  kml += `    <Folder>\n`;
  kml += `      <name>شبکه کامل نقاط سنجش (Grid Nodes)</name>\n`;
  for (let i = 0; i < totalPoints; i++) {
    const col = i % scan.width;
    const row = Math.floor(i / scan.width);
    const adc = scan.gridData[i] ?? 0;
    const phase = scan.phaseData?.[i] ?? 0;
    const offX = (col - (scan.width - 1) / 2) * stepMeters;
    const offY = (row - (scan.length - 1) / 2) * stepMeters;
    const ptLat = (baseLat + offY * latPerMeter).toFixed(7);
    const ptLng = (baseLng + offX * lngPerMeter).toFixed(7);
    const estDepth = (scan.maxDepthMeters * (1 - adc / 1024)).toFixed(2);

    kml += `      <Placemark>\n`;
    kml += `        <name>نقطه (${col + 1},${row + 1})</name>\n`;
    kml += `        <styleUrl>#gridNode</styleUrl>\n`;
    kml += `        <ExtendedData>\n`;
    kml += `          <Data name="ADC"><value>${adc}</value></Data>\n`;
    kml += `          <Data name="Phase"><value>${phase}</value></Data>\n`;
    kml += `          <Data name="Depth_m"><value>${estDepth}</value></Data>\n`;
    kml += `        </ExtendedData>\n`;
    kml += `        <Point>\n`;
    kml += `          <coordinates>${ptLng},${ptLat},0</coordinates>\n`;
    kml += `        </Point>\n`;
    kml += `      </Placemark>\n`;
  }
  kml += `    </Folder>\n`;

  kml += `  </Document>\n`;
  kml += `</kml>\n`;

  downloadFile(fileName, kml, 'application/vnd.google-earth.kml+xml;charset=utf-8;');
};

// Export entire archive to single JSON bundle
export const exportAllScansToJson = (scans: ScanRecord[]) => {
  const fileName = `auraxis_x20_scans_archive_${new Date().toISOString().slice(0, 10)}.json`;
  const jsonString = JSON.stringify(
    {
      app: 'AURAXIS X20 - Tactical Geophysical AI',
      version: '3.0.0',
      exportedAt: new Date().toISOString(),
      totalScans: scans.length,
      scans: scans
    },
    null,
    2
  );
  downloadFile(fileName, jsonString, 'application/json;charset=utf-8;');
};

// Export entire archive as a Master GIS Summary CSV
export const exportAllScansToCsv = (scans: ScanRecord[]) => {
  const fileName = `auraxis_x20_all_scans_summary_${new Date().toISOString().slice(0, 10)}.csv`;
  let csv = `# AURAXIS X20 - GIS MASTER SURVEY ARCHIVE SUMMARY\n`;
  csv += `# Export Date, "${new Date().toISOString()}"\n`;
  csv += `# Total Surveys, ${scans.length}\n\n`;
  csv += `Scan_ID,Scan_Name,Date,Width_Cols,Length_Rows,Total_Points,Soil_Type,Sensor_Hardware,Scan_Pattern,Max_Depth_m,Latitude,Longitude,Peak_ADC,Avg_ADC,Anomalies_Count,Notes\n`;

  scans.forEach((s) => {
    const totalPoints = s.width * s.length;
    const peak = Math.max(...(s.gridData || [0]));
    const avg = s.gridData.length > 0 ? Math.round(s.gridData.reduce((a, b) => a + b, 0) / s.gridData.length) : 0;
    const lat = s.coordinates?.lat ? s.coordinates.lat.toFixed(7) : '35.6892000';
    const lng = s.coordinates?.lng ? s.coordinates.lng.toFixed(7) : '51.3890000';
    const anomaliesCount = (s.anomalies?.length ?? 0) || s.gridData.filter((v) => v > 700 || v < 230).length;
    const safeNotes = (s.notes || '').replace(/"/g, '""');

    csv += `"${s.id}","${s.name.replace(/"/g, '""')}","${s.date}",${s.width},${s.length},${totalPoints},"${s.soilType}","${s.sensorType}","${s.scanPattern}",${s.maxDepthMeters},${lat},${lng},${peak},${avg},${anomaliesCount},"${safeNotes}"\n`;
  });

  downloadFile(fileName, csv, 'text/csv;charset=utf-8;');
};

// Export entire archive as a Master Google Earth / GIS KML layer
export const exportAllScansToKml = (scans: ScanRecord[]) => {
  const fileName = `auraxis_x20_all_surveys_map_${new Date().toISOString().slice(0, 10)}.kml`;
  let kml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  kml += `<kml xmlns="http://www.opengis.net/kml/2.2">\n`;
  kml += `  <Document>\n`;
  kml += `    <name>AURAXIS X20 - Master Survey GIS Archive</name>\n`;
  kml += `    <open>1</open>\n`;
  kml += `    <description>کلیه سایت‌های برداشت ژئوفیزیک ثبت‌شده در سیستم AURAXIS X20</description>\n\n`;

  // Styles
  kml += `    <Style id="siteIcon">\n`;
  kml += `      <IconStyle><scale>1.2</scale><Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle_highlight.png</href></Icon></IconStyle>\n`;
  kml += `    </Style>\n`;
  kml += `    <Style id="siteBoundary">\n`;
  kml += `      <LineStyle><color>ff00ffff</color><width>2</width></LineStyle>\n`;
  kml += `      <PolyStyle><color>3300ffff</color><fill>1</fill><outline>1</outline></PolyStyle>\n`;
  kml += `    </Style>\n\n`;

  scans.forEach((scan) => {
    const baseLat = scan.coordinates?.lat ?? 35.6892;
    const baseLng = scan.coordinates?.lng ?? 51.3890;
    const peak = Math.max(...(scan.gridData || [0]));
    const stepMeters = 0.5;
    const latPerMeter = 1 / 111320;
    const lngPerMeter = 1 / (111320 * Math.cos((baseLat * Math.PI) / 180));
    const halfW = ((scan.width - 1) * stepMeters) / 2;
    const halfL = ((scan.length - 1) * stepMeters) / 2;

    const swLat = (baseLat - halfL * latPerMeter).toFixed(7);
    const swLng = (baseLng - halfW * lngPerMeter).toFixed(7);
    const seLat = (baseLat - halfL * latPerMeter).toFixed(7);
    const seLng = (baseLng + halfW * lngPerMeter).toFixed(7);
    const neLat = (baseLat + halfL * latPerMeter).toFixed(7);
    const neLng = (baseLng + halfW * lngPerMeter).toFixed(7);
    const nwLat = (baseLat + halfL * latPerMeter).toFixed(7);
    const nwLng = (baseLng - halfW * lngPerMeter).toFixed(7);

    kml += `    <Folder>\n`;
    kml += `      <name>${escapeXml(scan.name)} (${scan.date})</name>\n`;
    kml += `      <Placemark>\n`;
    kml += `        <name>${escapeXml(scan.name)} [پیک: ${peak} ADC]</name>\n`;
    kml += `        <styleUrl>#siteIcon</styleUrl>\n`;
    kml += `        <description><![CDATA[\n`;
    kml += `          <div style="direction:rtl; text-align:right;">\n`;
    kml += `            <h3>${escapeXml(scan.name)}</h3>\n`;
    kml += `            <p><strong>تاریخ:</strong> ${escapeXml(scan.date)}</p>\n`;
    kml += `            <p><strong>ابعاد:</strong> ${scan.width}×${scan.length} (${scan.width * scan.length} نقطه)</p>\n`;
    kml += `            <p><strong>خاک:</strong> ${escapeXml(scan.soilType)}</p>\n`;
    kml += `            <p><strong>عمق:</strong> ${scan.maxDepthMeters}m</p>\n`;
    kml += `            <p><strong>پیک سیگنال:</strong> ${peak} ADC</p>\n`;
    if (scan.notes) kml += `            <p><strong>یادداشت:</strong> ${escapeXml(scan.notes)}</p>\n`;
    kml += `          </div>\n`;
    kml += `        ]]></description>\n`;
    kml += `        <ExtendedData>\n`;
    kml += `          <Data name="ScanID"><value>${scan.id}</value></Data>\n`;
    kml += `          <Data name="Soil"><value>${escapeXml(scan.soilType)}</value></Data>\n`;
    kml += `          <Data name="PeakADC"><value>${peak}</value></Data>\n`;
    kml += `        </ExtendedData>\n`;
    kml += `        <Point><coordinates>${baseLng.toFixed(7)},${baseLat.toFixed(7)},0</coordinates></Point>\n`;
    kml += `      </Placemark>\n`;

    // Perimeter boundary
    kml += `      <Placemark>\n`;
    kml += `        <name>محدوده: ${escapeXml(scan.name)}</name>\n`;
    kml += `        <styleUrl>#siteBoundary</styleUrl>\n`;
    kml += `        <Polygon>\n`;
    kml += `          <tessellate>1</tessellate>\n`;
    kml += `          <outerBoundaryIs>\n`;
    kml += `            <LinearRing>\n`;
    kml += `              <coordinates>\n`;
    kml += `                ${swLng},${swLat},0\n`;
    kml += `                ${seLng},${seLat},0\n`;
    kml += `                ${neLng},${neLat},0\n`;
    kml += `                ${nwLng},${nwLat},0\n`;
    kml += `                ${swLng},${swLat},0\n`;
    kml += `              </coordinates>\n`;
    kml += `            </LinearRing>\n`;
    kml += `          </outerBoundaryIs>\n`;
    kml += `        </Polygon>\n`;
    kml += `      </Placemark>\n`;
    kml += `    </Folder>\n`;
  });

  kml += `  </Document>\n`;
  kml += `</kml>\n`;

  downloadFile(fileName, kml, 'application/vnd.google-earth.kml+xml;charset=utf-8;');
};

// Color mapper helper for 2D comparison heatmaps
const getScanValueColor = (val: number) => {
  if (val < 250) return '#06b6d4'; // Cyan - Low ground noise
  if (val < 500) return '#10b981'; // Emerald - Normal soil
  if (val < 750) return '#f59e0b'; // Amber - Moderate anomaly
  return '#ef4444'; // Red - Metal peak
};

export const HistoryTab: React.FC<HistoryTabProps> = ({
  scans,
  onLoadScan,
  onDeleteScan,
  onNavigateToAiWithScan
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSoilFilter, setSelectedSoilFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'peak'>('date-desc');
  const [exportToast, setExportToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setExportToast(msg);
    setTimeout(() => setExportToast(null), 3500);
  };

  // Comparison State
  const [compareScanA, setCompareScanA] = useState<ScanRecord | null>(scans[0] || null);
  const [compareScanB, setCompareScanB] = useState<ScanRecord | null>(scans[1] || null);
  const [isComparisonOpen, setIsComparisonOpen] = useState<boolean>(false);

  // Toggle scan selection for comparison
  const handleToggleCompare = (scan: ScanRecord) => {
    if (compareScanA?.id === scan.id) {
      setCompareScanA(null);
    } else if (compareScanB?.id === scan.id) {
      setCompareScanB(null);
    } else if (!compareScanA) {
      setCompareScanA(scan);
    } else if (!compareScanB) {
      setCompareScanB(scan);
    } else {
      // Replace scan B if both selected
      setCompareScanB(scan);
    }
  };

  // Calculate summary statistics
  const totalScans = scans.length;

  const avgDepth = totalScans > 0
    ? (scans.reduce((acc, s) => acc + (s.maxDepthMeters || 0), 0) / totalScans).toFixed(1)
    : '0.0';

  const maxDepth = totalScans > 0
    ? Math.max(...scans.map(s => s.maxDepthMeters || 0)).toFixed(1)
    : '0.0';

  // Most common soil type
  const soilCounts: Record<string, number> = {};
  scans.forEach((s) => {
    if (s.soilType) {
      const cleanSoil = s.soilType.split('(')[0].trim();
      soilCounts[cleanSoil] = (soilCounts[cleanSoil] || 0) + 1;
    }
  });

  let mostCommonSoil = 'نامشخص';
  let maxSoilCount = 0;
  Object.entries(soilCounts).forEach(([soil, count]) => {
    if (count > maxSoilCount) {
      maxSoilCount = count;
      mostCommonSoil = soil;
    }
  });
  const soilPercentage = totalScans > 0 ? Math.round((maxSoilCount / totalScans) * 100) : 0;

  // Max signal peak and total points
  let maxPeakAdc = 0;
  let highAnomalyCount = 0;
  let totalPointsScanned = 0;

  scans.forEach((s) => {
    totalPointsScanned += (s.width || 0) * (s.length || 0);
    const peak = Math.max(...(s.gridData || [0]));
    if (peak > maxPeakAdc) maxPeakAdc = peak;
    if (peak > 750) highAnomalyCount++;
  });

  const filteredScans = scans
    .filter((scan) => {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !term ||
        scan.name.toLowerCase().includes(term) ||
        (scan.date && scan.date.toLowerCase().includes(term)) ||
        (scan.notes && scan.notes.toLowerCase().includes(term));
      const matchesSoil = selectedSoilFilter === 'all' || scan.soilType.includes(selectedSoilFilter);
      return matchesSearch && matchesSoil;
    })
    .sort((a, b) => {
      if (sortBy === 'date-asc') {
        return a.date.localeCompare(b.date);
      }
      if (sortBy === 'peak') {
        const peakA = Math.max(...(a.gridData || [0]));
        const peakB = Math.max(...(b.gridData || [0]));
        return peakB - peakA;
      }
      // default: date-desc
      return b.date.localeCompare(a.date);
    });

  // Calculate Comparison Metrics if both scans are selected
  const peakA = compareScanA ? Math.max(...(compareScanA.gridData || [0])) : 0;
  const peakB = compareScanB ? Math.max(...(compareScanB.gridData || [0])) : 0;
  const avgA = compareScanA && compareScanA.gridData.length > 0
    ? Math.round(compareScanA.gridData.reduce((a, b) => a + b, 0) / compareScanA.gridData.length)
    : 0;
  const avgB = compareScanB && compareScanB.gridData.length > 0
    ? Math.round(compareScanB.gridData.reduce((a, b) => a + b, 0) / compareScanB.gridData.length)
    : 0;
  const peakDelta = peakB - peakA;
  const depthDelta = compareScanB && compareScanA ? Number((compareScanB.maxDepthMeters - compareScanA.maxDepthMeters).toFixed(1)) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 dir-rtl">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-amber-400" />
              تاریخچه اسکن‌های ذخیره‌شده (Scan Archive)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            مشاهده، مقایسه پهلو به پهلو، بازخوانی پروژه‌ها در نمای ۳بعدی و آنالیز هوشمند زمین
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              if (scans.length === 0) return;
              exportAllScansToJson(scans);
              triggerToast(`کامل‌ترین آرشیو (${scans.length} اسکن) به صورت فایل JSON دانلود شد.`);
            }}
            disabled={scans.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 border border-slate-700 font-bold text-xs transition"
            title="دانلود کامل آرشیو اسکن‌ها به صورت یک فایل JSON جامع"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>خروجی کل آرشیو</span>
          </button>

          <button
            onClick={() => {
              if (!compareScanA && scans.length > 0) setCompareScanA(scans[0]);
              if (!compareScanB && scans.length > 1) setCompareScanB(scans[1]);
              setIsComparisonOpen(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-400/20 transition"
          >
            <GitCompare className="w-4 h-4" />
            <span>مقایسه (Compare)</span>
          </button>

          <div className="text-xs font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-2 rounded-xl">
            {scans.length} اسکن
          </div>
        </div>
      </div>

      {/* Summary Statistics Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Card 1: Total Scans & Points */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-2 shadow-lg hover:border-amber-400/30 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">کل اسکن‌های انجام‌شده</span>
            <div className="w-8 h-8 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center">
              <BarChart2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-white font-mono">{totalScans} <span className="text-xs text-slate-400 font-normal">پروژه</span></div>
            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
              <Layers className="w-3 h-3 text-cyan-400" />
              <span>{totalPointsScanned.toLocaleString()} نقطه تصویربرداری</span>
            </div>
          </div>
        </div>

        {/* Card 2: Average & Max Depth */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-2 shadow-lg hover:border-cyan-400/30 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">میانگین عمق اسکن</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-400/10 text-cyan-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-cyan-400 font-mono">{avgDepth} <span className="text-xs text-slate-400 font-normal">متر</span></div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
              عمیق‌ترین اسکن: <strong className="text-amber-400">{maxDepth}m</strong>
            </div>
          </div>
        </div>

        {/* Card 3: Most Common Soil Type */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-2 shadow-lg hover:border-emerald-400/30 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">خاک غالب منطقه</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-base font-bold text-emerald-400 truncate">{mostCommonSoil}</div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
              سهم از آرشیو: <strong className="text-emerald-300">{soilPercentage}%</strong> ({maxSoilCount} اسکن)
            </div>
          </div>
        </div>

        {/* Card 4: Signal Peak & Anomalies */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-2 shadow-lg hover:border-amber-400/30 transition">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">پیک سیگنال آنومالی</span>
            <div className="w-8 h-8 rounded-xl bg-amber-400/10 text-amber-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-amber-400 font-mono">{maxPeakAdc} <span className="text-xs text-slate-400 font-normal">ADC</span></div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">
              اهداف فلزی بالا: <strong className="text-amber-300">{highAnomalyCount} مورد</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Floating / Sticky Comparison Selection Bar */}
      {(compareScanA || compareScanB) && (
        <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl p-3.5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-200">
            <GitCompare className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              اسکن‌های انتخاب‌شده برای مقایسه:{' '}
              <strong className="text-amber-400">{compareScanA ? compareScanA.name : 'اسکن ۱ (انتخاب نشده)'}</strong>
              {' vs '}
              <strong className="text-cyan-400">{compareScanB ? compareScanB.name : 'اسکن ۲ (انتخاب نشده)'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsComparisonOpen(true)}
              disabled={!compareScanA || !compareScanB}
              className="px-4 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold text-xs transition shadow-md shadow-cyan-400/20"
            >
              باز کردن مقایسه کامل
            </button>
            <button
              onClick={() => {
                setCompareScanA(null);
                setCompareScanB(null);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs transition"
              title="پاک کردن انتخاب‌ها"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-amber-400 absolute right-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="جستجوی نام پروژه، تاریخ (مثلاً 2026 یا 1403) یا یادداشت..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-9 py-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 outline-none transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-3 text-slate-400 hover:text-white transition"
              title="پاک کردن جستجو"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Soil Filter */}
          <select
            value={selectedSoilFilter}
            onChange={(e) => setSelectedSoilFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:border-amber-400 outline-none cursor-pointer"
          >
            <option value="all">🌱 همه نوع خاک‌ها</option>
            <option value="کشاورزی">🌾 خاک کشاورزی</option>
            <option value="معدنی">💎 خاک معدنی</option>
            <option value="سنگ">🪨 سنگ و صخره</option>
          </select>

          {/* Sort By */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'date-desc' | 'date-asc' | 'peak')}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:border-amber-400 outline-none cursor-pointer"
            >
              <option value="date-desc">📅 جدیدترین تاریخ</option>
              <option value="date-asc">📅 قدیمی‌ترین تاریخ</option>
              <option value="peak">🎯 بالاترین پیک سیگنال</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results summary notice when filtering */}
      {(searchTerm || selectedSoilFilter !== 'all') && (
        <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/60 border border-slate-800/80 px-4 py-2 rounded-xl">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-amber-400" />
            <span>
              نتایج جستجو: <strong className="text-white">{filteredScans.length}</strong> از <strong className="text-slate-300">{scans.length}</strong> اسکن
            </span>
          </div>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedSoilFilter('all');
            }}
            className="text-amber-400 hover:underline text-[11px]"
          >
            پاک کردن فیلترها
          </button>
        </div>
      )}

      {/* Scans Grid List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredScans.map((scan) => {
          // Compute peak ADC for badge
          let peak = 0;
          scan.gridData.forEach((v) => {
            if (v > peak) peak = v;
          });

          const isSelectedA = compareScanA?.id === scan.id;
          const isSelectedB = compareScanB?.id === scan.id;
          const isSelected = isSelectedA || isSelectedB;

          return (
            <div
              key={scan.id}
              className={`bg-slate-900 border ${
                isSelected
                  ? 'border-cyan-400/80 ring-2 ring-cyan-400/20 shadow-cyan-400/10'
                  : 'border-slate-800 hover:border-amber-400/40'
              } rounded-2xl p-5 space-y-4 transition-all shadow-xl flex flex-col justify-between group`}
            >
              <div className="space-y-3">
                
                {/* Title & Date & Compare Selector */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition">
                        {scan.name}
                      </h3>
                      {isSelectedA && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-400 text-slate-950 rounded-md font-mono">
                          اسکن A
                        </span>
                      )}
                      {isSelectedB && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-cyan-400 text-slate-950 rounded-md font-mono">
                          اسکن B
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      <span>{scan.date}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleCompare(scan)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                      isSelected
                        ? 'bg-cyan-400/20 text-cyan-300 border-cyan-400/40'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    <span>{isSelected ? 'انتخاب شده' : 'مقایسه'}</span>
                  </button>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-300">
                    شبکه: <span className="text-cyan-400 font-bold">{scan.width}×{scan.length}</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-300">
                    عمق: <span className="text-amber-400 font-bold">{scan.maxDepthMeters}m</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-300">
                    خاک: <span className="text-emerald-400 font-bold">{scan.soilType.split(' ')[0]}</span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800 text-slate-300">
                    پیک سیگنال: <span className="text-amber-400 font-bold">{peak} ADC</span>
                  </div>
                </div>

                {/* Notes */}
                {scan.notes && (
                  <p className="text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed italic">
                    «{scan.notes}»
                  </p>
                )}

              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-3 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onLoadScan(scan)}
                    className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md shadow-amber-400/20 transition flex items-center justify-center gap-1.5"
                  >
                    <Box className="w-4 h-4" />
                    <span>بارگذاری در ۳بعدی</span>
                  </button>

                  <button
                    onClick={() => onNavigateToAiWithScan(scan)}
                    title="تحلیل هوشمند Gemini AI"
                    className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-amber-400 hover:opacity-90 text-slate-950 font-bold text-xs transition flex items-center gap-1"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => onDeleteScan(scan.id)}
                    title="حذف اسکن"
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 border border-slate-700 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* CSV and JSON Data Export Controls */}
                <div className="flex items-center gap-2 font-mono">
                  <button
                    onClick={() => {
                      exportScanToCsv(scan);
                      triggerToast(`فایل CSV برای "${scan.name}" با موفقیت ایجاد و دانلود شد.`);
                    }}
                    title="دانلود ماتریس داده‌ها به صورت CSV (سازگار با Excel, MATLAB, Surfer, Voxler)"
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-950 border border-emerald-500/40 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>خروجی CSV</span>
                  </button>

                  <button
                    onClick={() => {
                      exportScanToJson(scan);
                      triggerToast(`فایل JSON برای "${scan.name}" با موفقیت دانلود شد.`);
                    }}
                    title="دانلود ساختار کامل پروژه به صورت JSON برای تحلیل نرم‌افزاری"
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-950 border border-cyan-500/40 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                    <span>خروجی JSON</span>
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {filteredScans.length === 0 && (
        <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-xs">
          هیچ اسکن مطابق با جستجوی شما پیدا نشد.
        </div>
      )}

      {/* ========================================== */}
      {/* SIDE-BY-SIDE COMPARISON MODAL DIALOG */}
      {/* ========================================== */}
      {isComparisonOpen && compareScanA && compareScanB && (
        <div className="fixed inset-0 z-[600] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden dir-rtl">
            
            {/* Modal Header */}
            <div className="bg-slate-950 border-b border-slate-800 p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-cyan-400 text-slate-950 flex items-center justify-center font-bold shadow-lg">
                  <GitCompare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">مقایسه تخصصی پهلو به پهلو (Side-by-Side Analysis)</h3>
                  <p className="text-xs text-slate-400">ارزیابی تفاوت پیک سیگنال مغناطیسی، بستر خاک و عمق آنومالی‌ها</p>
                </div>
              </div>

              <button
                onClick={() => setIsComparisonOpen(false)}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="p-5 overflow-y-auto space-y-6">
              
              {/* Scan Selectors Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-955 p-4 rounded-2xl border border-slate-800">
                {/* Selector A */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    اسکن مرجع اول (Scan A)
                  </label>
                  <select
                    value={compareScanA.id}
                    onChange={(e) => {
                      const found = scans.find((s) => s.id === e.target.value);
                      if (found) setCompareScanA(found);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-amber-400 outline-none cursor-pointer"
                  >
                    {scans.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.date})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selector B */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                    اسکن مقایسه‌ای دوم (Scan B)
                  </label>
                  <select
                    value={compareScanB.id}
                    onChange={(e) => {
                      const found = scans.find((s) => s.id === e.target.value);
                      if (found) setCompareScanB(found);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:border-cyan-400 outline-none cursor-pointer"
                  >
                    {scans.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.date})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Differential KPI Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 block">تفاضل پیک سیگنال (Δ Peak)</span>
                  <div className={`text-lg font-black font-mono ${peakDelta >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {peakDelta >= 0 ? `+${peakDelta}` : peakDelta} ADC
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {peakDelta > 0 ? 'پیک اسکن B قوی‌تر است' : peakDelta < 0 ? 'پیک اسکن A قوی‌تر است' : 'یکسان'}
                  </span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 block">تفاضل میانگین (Δ Avg)</span>
                  <div className="text-lg font-black text-cyan-400 font-mono">
                    {avgB - avgA >= 0 ? `+${avgB - avgA}` : avgB - avgA} ADC
                  </div>
                  <span className="text-[10px] text-slate-500 block">شدت میدان زمین</span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 block">اختلاف عمق تخمینی</span>
                  <div className="text-lg font-black text-amber-400 font-mono">
                    {depthDelta >= 0 ? `+${depthDelta}` : depthDelta}m
                  </div>
                  <span className="text-[10px] text-slate-500 block">عمق هدف</span>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1">
                  <span className="text-[11px] text-slate-400 block">سازگاری نوع خاک</span>
                  <div className="text-sm font-bold text-white truncate">
                    {compareScanA.soilType.split(' ')[0] === compareScanB.soilType.split(' ')[0] ? 'همسان (Equal)' : 'متفاوت'}
                  </div>
                  <span className="text-[10px] text-slate-500 block">تراکم بستر</span>
                </div>
              </div>

              {/* Side-by-Side 2D Heatmap Grid Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* SCAN A CARD */}
                <div className="bg-slate-950 border border-amber-400/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-amber-400">{compareScanA.name}</span>
                    <span className="text-[11px] font-mono text-slate-400">{compareScanA.date}</span>
                  </div>

                  {/* 2D Mini Grid Canvas */}
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
                    <div className="text-[10px] text-slate-400 mb-2 font-mono">
                      ماتریس 2D ({compareScanA.width} × {compareScanA.length})
                    </div>
                    <div
                      className="grid gap-1 bg-slate-950 p-2 rounded-lg border border-slate-800"
                      style={{
                        gridTemplateColumns: `repeat(${compareScanA.width}, minmax(0, 1fr))`
                      }}
                    >
                      {compareScanA.gridData.map((val, idx) => (
                        <div
                          key={idx}
                          className="w-7 h-7 rounded flex items-center justify-center text-[9px] font-mono font-bold text-slate-950 transition hover:scale-110"
                          style={{ backgroundColor: getScanValueColor(val) }}
                          title={`نقطه ${idx + 1}: ${val} ADC`}
                        >
                          {val}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Scan A Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      پیک سیگنال: <strong className="text-amber-400">{peakA} ADC</strong>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      میانگین: <strong className="text-cyan-400">{avgA} ADC</strong>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      عمق تخمینی: <strong className="text-amber-400">{compareScanA.maxDepthMeters}m</strong>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      نوع خاک: <strong className="text-emerald-400">{compareScanA.soilType.split(' ')[0]}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsComparisonOpen(false);
                      onLoadScan(compareScanA);
                    }}
                    className="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <Box className="w-4 h-4" />
                    <span>بازخوانی این اسکن در ۳بعدی</span>
                  </button>
                </div>

                {/* SCAN B CARD */}
                <div className="bg-slate-950 border border-cyan-400/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-cyan-400">{compareScanB.name}</span>
                    <span className="text-[11px] font-mono text-slate-400">{compareScanB.date}</span>
                  </div>

                  {/* 2D Mini Grid Canvas */}
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col items-center">
                    <div className="text-[10px] text-slate-400 mb-2 font-mono">
                      ماتریس 2D ({compareScanB.width} × {compareScanB.length})
                    </div>
                    <div
                      className="grid gap-1 bg-slate-950 p-2 rounded-lg border border-slate-800"
                      style={{
                        gridTemplateColumns: `repeat(${compareScanB.width}, minmax(0, 1fr))`
                      }}
                    >
                      {compareScanB.gridData.map((val, idx) => (
                        <div
                          key={idx}
                          className="w-7 h-7 rounded flex items-center justify-center text-[9px] font-mono font-bold text-slate-950 transition hover:scale-110"
                          style={{ backgroundColor: getScanValueColor(val) }}
                          title={`نقطه ${idx + 1}: ${val} ADC`}
                        >
                          {val}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Scan B Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      پیک سیگنال: <strong className="text-cyan-400">{peakB} ADC</strong>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      میانگین: <strong className="text-cyan-400">{avgB} ADC</strong>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      عمق تخمینی: <strong className="text-amber-400">{compareScanB.maxDepthMeters}m</strong>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      نوع خاک: <strong className="text-emerald-400">{compareScanB.soilType.split(' ')[0]}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsComparisonOpen(false);
                      onLoadScan(compareScanB);
                    }}
                    className="w-full py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <Box className="w-4 h-4" />
                    <span>بازخوانی این اسکن در ۳بعدی</span>
                  </button>
                </div>

              </div>

              {/* AI Differential Takeaway Banner */}
              <div className="bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-emerald-500/10 border border-slate-800 rounded-2xl p-4 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <div className="font-bold text-white">نتیجه‌گیری تحلیلی مقایسه (Differential Analysis Summary)</div>
                  <p className="text-slate-300 leading-relaxed">
                    {peakA > peakB ? (
                      <>اسکن <strong className="text-amber-400">{compareScanA.name}</strong> دارای پیک سیگنال مغناطیسی به میزان <strong className="text-amber-300">{peakA - peakB} ADC</strong> بالاتر نسبت به اسکن دوم است. این امر نشان‌دهنده احتمال رسانایی بالاتر یا وجود هدف فلزی/حفره بزرگتر در بستر زیرسطحی می‌باشد.</>
                    ) : peakB > peakA ? (
                      <>اسکن <strong className="text-cyan-400">{compareScanB.name}</strong> دارای پیک سیگنال مغناطیسی به میزان <strong className="text-cyan-300">{peakB - peakA} ADC</strong> بالاتر نسبت به اسکن اول است. این مشخصه حاکی از تمرکز جدی‌تر آنومالی هدف در محل تصویربرداری اسکن B است.</>
                    ) : (
                      <>هر دو اسکن دارای پیک‌های مغناطیسی یکسان ({peakA} ADC) می‌باشند.</>
                    )}
                  </p>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-950 border-t border-slate-800 p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    exportScanToCsv(compareScanA);
                    triggerToast(`فایل CSV برای "${compareScanA.name}" دانلود شد.`);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-400 font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-500/20 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>CSV A</span>
                </button>
                <button
                  onClick={() => {
                    exportScanToCsv(compareScanB);
                    triggerToast(`فایل CSV برای "${compareScanB.name}" دانلود شد.`);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 border border-emerald-500/40 text-emerald-400 font-bold text-xs flex items-center gap-1.5 hover:bg-emerald-500/20 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>CSV B</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsComparisonOpen(false);
                    onNavigateToAiWithScan(peakB > peakA ? compareScanB : compareScanA);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-amber-400 text-slate-950 font-bold text-xs transition shadow-lg"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>تحلیل پیشرفته با Gemini AI</span>
                </button>

                <button
                  onClick={() => setIsComparisonOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition"
                >
                  بستن مقایسه
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Floating Export Toast Notification */}
      {exportToast && (
        <div className="fixed bottom-6 right-6 z-[999] bg-slate-900/95 border border-emerald-500/60 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in backdrop-blur-md">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-xs font-medium">
            {exportToast}
          </div>
          <button
            onClick={() => setExportToast(null)}
            className="text-slate-400 hover:text-white transition p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

    </div>
  );
};

