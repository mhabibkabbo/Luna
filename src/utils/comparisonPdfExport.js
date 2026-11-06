/**
 * @file comparisonPdfExport.js
 * Professional NASA-Style Technical Report PDF Dossier Generator
 * for the Lunar Landing Site Comparison & Mission Decision Support System.
 *
 * Uses the exact evaluated scientific metrics displayed in the application
 * (never independently recalculating or fabricating values).
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  COMPARISON_PARAMETER_DEFINITIONS,
  getMatrixCellDisplay,
  NASA_DATASETS_REGISTRY,
} from './comparisonEngine.js';

/**
 * Generates and downloads a multi-page landscape NASA-style technical comparison PDF dossier.
 *
 * @param {object} options
 * @param {Array} options.evaluations - Evaluated locations (2 to 8 sites)
 * @param {number} options.durationDays - Mission duration in days (7, 14, or 28)
 * @param {number} options.referenceEpochMs - Reference epoch timestamp (ms)
 * @param {object} options.tradeOff - Output of computeMultiSiteTradeOffAnalysis()
 * @returns {Promise<string>} Downloaded filename
 */
export async function exportComparisonDossierPdf({
  evaluations = [],
  durationDays = 14,
  referenceEpochMs = Date.now(),
  tradeOff = null,
}) {
  const validEvals = evaluations.filter((e) => e && e.isValid);
  if (validEvals.length < 2) {
    throw new Error('At least 2 valid lunar locations are required to export a comparison dossier.');
  }

  // Allow UI loading spinner to paint before synchronous PDF layout work
  await new Promise((resolve) => setTimeout(resolve, 60));

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm
  const generatedUtc = new Date().toUTCString();
  const epochUtc = new Date(referenceEpochMs).toUTCString();

  // Helper to draw clean white technical report page header
  const drawReportHeader = (sectionCode, sectionTitle, subtitle) => {
    // Top bar
    doc.setFillColor(10, 18, 32);
    doc.rect(0, 0, pageWidth, 18, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 210, 196);
    doc.text(`LUNA MISSION DECISION SUPPORT · ${sectionCode}`, 14, 7.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(sectionTitle, 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(180, 196, 216);
    doc.text(
      `Duration: ${durationDays} Days (${durationDays * 24}h)  |  Epoch: ${epochUtc}`,
      pageWidth - 14,
      11.5,
      { align: 'right' }
    );

    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(subtitle, 14, 24.5);
    }
  };

  // =========================================================================
  // PAGE 1 — MISSION COMPARISON OVERVIEW (DARK NAVY TECHNICAL COVER PAGE)
  // =========================================================================
  doc.setFillColor(6, 11, 19);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Subtle top accent stripe
  doc.setFillColor(0, 210, 196);
  doc.rect(0, 0, pageWidth, 2.5, 'F');

  // Header metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(0, 210, 196);
  doc.text('LUNA · LUNAR LANDING SITE NAVIGATOR & MISSION DECISION SUPPORT SYSTEM', 16, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`REPORT GENERATED: ${generatedUtc}`, pageWidth - 16, 18, { align: 'right' });

  // Main Cover Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(248, 250, 252);
  doc.text('Lunar Landing Site Comparison & Mission Evaluation Dossier', 16, 33);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Multi-site scientific trade study across ${validEvals.length} candidate locations for a ${durationDays}-day (${durationDays * 24}-hour) surface mission.`,
    16,
    41
  );

  // Configuration Summary Box on Cover
  doc.setFillColor(12, 20, 34);
  doc.setDrawColor(30, 48, 72);
  doc.roundedRect(16, 47, pageWidth - 32, 22, 2, 2, 'FD');

  const metaCols = [
    { label: 'PLANNED MISSION DURATION', value: `${durationDays} Earth Days (${durationDays * 24} Hours)` },
    { label: 'REFERENCE TOUCHDOWN EPOCH', value: epochUtc },
    { label: 'EVALUATED LOCATIONS', value: `${validEvals.length} / 8 Candidate Sites` },
    { label: 'RECOMMENDATION STATUS', value: tradeOff?.hasDefensibleWinner ? `Supported (${tradeOff.bestCandidate?.name})` : 'Conditional / Incomplete Data' },
  ];

  metaCols.forEach((col, idx) => {
    const x = 22 + idx * 66;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(col.label, x, 54.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(241, 245, 249);
    const wrapped = doc.splitTextToSize(String(col.value), 62);
    doc.text(wrapped.slice(0, 2), x, 60.5);
  });

  // Candidate Directory Table on Cover
  autoTable(doc, {
    startY: 75,
    margin: { left: 16, right: 16 },
    head: [
      [
        '#',
        'Landing Site Name',
        'Selenographic Coordinates',
        'Origin / Agency',
        'Geological Region / Classification',
        'Data Completeness',
        'Overall Suitability',
      ],
    ],
    body: validEvals.map((ev, idx) => [
      `#${idx + 1}`,
      ev.name,
      ev.formattedCoords,
      ev.isCustom ? 'User-Defined' : ev.agency || 'NASA Catalog',
      ev.terrain.terrainClassification,
      ev.completenessStatus,
      ev.suitability.overallSuitability !== null
        ? `${ev.suitability.overallSuitability} / 100`
        : 'Insufficient Data for Scoring',
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.8,
      textColor: [226, 232, 240],
      fillColor: [11, 18, 30],
      lineColor: [26, 42, 64],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [16, 28, 46],
      textColor: [0, 210, 196],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [14, 23, 38],
    },
  });

  // Executive Summary Box on Cover
  const coverAfterTableY = (doc.lastAutoTable?.finalY || 145) + 7;
  if (coverAfterTableY < pageHeight - 28) {
    doc.setFillColor(12, 20, 34);
    doc.setDrawColor(0, 210, 196);
    doc.roundedRect(16, coverAfterTableY, pageWidth - 32, Math.min(36, pageHeight - coverAfterTableY - 16), 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 210, 196);
    doc.text('EXECUTIVE TRADE-OFF VERDICT', 21, coverAfterTableY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(tradeOff?.recommendationTitle || 'Mission Comparison Complete', 21, coverAfterTableY + 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(203, 213, 225);
    const execLines = doc.splitTextToSize(
      tradeOff?.recommendationRationale ||
        (tradeOff?.keyDifferences || []).slice(0, 2).join(' '),
      pageWidth - 44
    );
    doc.text(execLines.slice(0, 3), 21, coverAfterTableY + 19);
  }

  // =========================================================================
  // PAGE 2 — LANDING SITE COMPARISON MATRIX (ROWS = SITES, COLS = PARAMETERS)
  // =========================================================================
  doc.addPage('a4', 'landscape');
  drawReportHeader(
    'SECTION 01 · MASTER COMPARISON MATRIX',
    'Landing Site Comparison Matrix (Core Evaluation Parameters)',
    `Rows represent the ${validEvals.length} selected landing locations; columns display verified scientific parameters over the ${durationDays}-day mission duration.`
  );

  const coreParamIds = [
    'coordinates',
    'solarIlluminationPct',
    'solarPowerPotential',
    'earthVisibilityPct',
    'surfaceTempRange',
    'elevationM',
    'slopeDeg',
    'roughnessM',
    'craterDensity',
    'overallSuitability',
  ];

  const coreColumns = coreParamIds.map((pid) =>
    COMPARISON_PARAMETER_DEFINITIONS.find((d) => d.id === pid)
  ).filter(Boolean);

  autoTable(doc, {
    startY: 29,
    margin: { left: 14, right: 14 },
    head: [
      [
        'Landing Site',
        ...coreColumns.map((c) => `${c.shortLabel}\n(${c.unit})`),
      ],
    ],
    body: validEvals.map((ev, idx) => [
      `#${idx + 1} ${ev.name}`,
      ...coreColumns.map((col) => {
        const cell = getMatrixCellDisplay(ev, col.id);
        return cell.subtext ? `${cell.text}\n[${cell.subtext}]` : cell.text;
      }),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.4,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 34 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // Extended Parameters Matrix on same or next page so no parameter is ever omitted or truncated
  const extendedParamIds = [
    'solarElevationDeg',
    'totalSunlightHours',
    'totalDarknessHours',
    'longestContinuousDarkHours',
    'illuminationStability',
    'earthElevationDeg',
    'totalCommHours',
    'maxBlackoutHours',
    'localReliefM',
    'tempVariationC',
  ];
  const extendedColumns = extendedParamIds
    .map((pid) => COMPARISON_PARAMETER_DEFINITIONS.find((d) => d.id === pid))
    .filter(Boolean);

  const matrix2StartY = (doc.lastAutoTable?.finalY || 110) + 8;
  if (matrix2StartY > pageHeight - 55) {
    doc.addPage('a4', 'landscape');
    drawReportHeader(
      'SECTION 01B · EXTENDED COMPARISON MATRIX',
      'Landing Site Comparison Matrix (Extended Time-Series & Terrain Parameters)',
      `Continuation of all scientific evaluation parameters across the ${durationDays}-day mission window.`
    );
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Extended Time-Dependent & Topographic Parameters Matrix', 14, matrix2StartY - 2);
  }

  autoTable(doc, {
    startY: matrix2StartY > pageHeight - 55 ? 29 : matrix2StartY,
    margin: { left: 14, right: 14 },
    head: [
      [
        'Landing Site',
        ...extendedColumns.map((c) => `${c.shortLabel}\n(${c.unit})`),
      ],
    ],
    body: validEvals.map((ev, idx) => [
      `#${idx + 1} ${ev.name}`,
      ...extendedColumns.map((col) => {
        const cell = getMatrixCellDisplay(ev, col.id);
        return cell.text;
      }),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 34 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  // =========================================================================
  // PAGE 3 — SOLAR & ENERGY ANALYSIS
  // =========================================================================
  doc.addPage('a4', 'landscape');
  drawReportHeader(
    'SECTION 02 · SOLAR & ENERGY ANALYSIS',
    `Solar Illumination & Energy Availability (${durationDays}-Day Mission Window)`,
    'Time-integrated solar elevation, sunlight/darkness hours, longest shadow streaks, and normalized solar array flux potential.'
  );

  autoTable(doc, {
    startY: 29,
    margin: { left: 14, right: 14 },
    head: [
      [
        'Landing Site',
        'Touchdown Sun Elev.',
        'Sun Elev. Range (Min / Max)',
        'Illumination (%)',
        'Total Sunlight (h)',
        'Total Darkness (h)',
        'Longest Continuous Dark (h)',
        'Mean Array Flux (%)',
        'Illumination Stability & Charging Windows',
        'Solar Suitability',
      ],
    ],
    body: validEvals.map((ev, idx) => [
      `#${idx + 1} ${ev.name}`,
      `${ev.solar.touchdownElevationDeg.toFixed(2)}°`,
      `${ev.solar.minElevationDeg.toFixed(1)}° to ${ev.solar.maxElevationDeg.toFixed(1)}°`,
      `${ev.solar.solarIlluminationPct.toFixed(1)}%`,
      `${ev.solar.totalSunlightHours} h`,
      `${ev.solar.totalDarknessHours} h`,
      `${ev.solar.longestContinuousDarkHours} h`,
      `${ev.solar.solarPowerPotentialPct.toFixed(1)}%`,
      `${ev.solar.illuminationStability}\n(${ev.solar.powerOpportunitiesLabel})`,
      `${ev.suitability.solarSuitability} / 100`,
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.6,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [251, 191, 36],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 34 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const solarNoteY = (doc.lastAutoTable?.finalY || 130) + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Methodology & Mission Duration Energy Implications:', 14, solarNoteY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const solarNotes = [
    `• Time-Dependent Integration: Evaluated at 2-hour intervals across ${durationDays * 24} hours (${durationDays} days) starting at ${epochUtc}. Because the lunar synodic day is 29.53 Earth days (~708.7 hours), a 7-day mission samples ~24% of a lunation, a 14-day mission samples ~47% (one full equatorial day or night phase), and a 28-day mission spans ~95% of a complete lunar diurnal cycle.`,
    '• Topographic Horizon Masking: For sites within 80°S–90°S (or in the NASA LOLA horizon table), solar elevation is tested against the 360° LOLA DEM horizon profile. Sites north of 80°S without precomputed horizon profiles use a 0° geometric tangent horizon.',
    '• Solar Power Potential Assumption: Reported as normalized solar collector flux factor (%). Absolute electrical energy (kWh) is intentionally omitted unless spacecraft-specific solar array area, cell efficiency, and gimbal tracking geometry are specified.',
  ];
  solarNotes.forEach((line, i) => {
    const wrapped = doc.splitTextToSize(line, pageWidth - 28);
    doc.text(wrapped, 14, solarNoteY + 6 + i * 10);
  });

  // =========================================================================
  // PAGE 4 — COMMUNICATION & VISIBILITY ANALYSIS
  // =========================================================================
  doc.addPage('a4', 'landscape');
  drawReportHeader(
    'SECTION 03 · COMMUNICATION & EARTH VISIBILITY',
    `Direct-to-Earth (DTE) Visibility & Blackout Analysis (${durationDays}-Day Mission Window)`,
    'Topocentric selenographic libration geometry, terrain horizon masking, communication window counts, and blackout durations.'
  );

  autoTable(doc, {
    startY: 29,
    margin: { left: 14, right: 14 },
    head: [
      [
        'Landing Site',
        'Earth Visibility Status',
        'Touchdown Earth Elev.',
        'Earth Elev. Range (Min / Max)',
        'Terrain Clearance Margin',
        'DTE LOS Availability (%)',
        'Expected Comm Windows',
        'Total Comm Availability (h)',
        'Max Blackout Duration (h)',
        'Comm Suitability',
      ],
    ],
    body: validEvals.map((ev, idx) => [
      `#${idx + 1} ${ev.name}`,
      ev.communication.earthVisibilityLabel,
      `${ev.communication.touchdownElevationDeg.toFixed(2)}°`,
      `${ev.communication.minElevationDeg.toFixed(1)}° to ${ev.communication.maxElevationDeg.toFixed(1)}°`,
      `${ev.communication.touchdownMarginDeg.toFixed(2)}°`,
      `${ev.communication.earthVisibilityPct.toFixed(1)}%`,
      `${ev.communication.commWindowsCount} window(s)`,
      `${ev.communication.totalCommHours} h`,
      `${ev.communication.maxBlackoutHours} h`,
      `${ev.suitability.commSuitability} / 100`,
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.6,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [56, 189, 248],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 34 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const commNoteY = (doc.lastAutoTable?.finalY || 130) + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Engineering Distinction Between Geometric Visibility & RF Link Availability:', 14, commNoteY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const commNotes = [
    '• Geometric Line-of-Sight vs. RF Link Closure: Geometric Earth visibility indicates that the apparent Earth disc clears the local lunar horizon and surrounding LOLA DEM terrain ridges. Actual communication availability additionally requires Earth DSN complex elevation (>10° station mask), spacecraft X/S/Ka-band transponder link margin, and multipath mitigation.',
    '• Libration Modulation at Polar Latitudes: Due to optical libration in latitude (±6.68°) and longitude (±7.9°), Earth describes a ~14-day figure-eight trajectory in the lunar polar sky, causing periodic terrain masking behind south polar massifs.',
  ];
  commNotes.forEach((line, i) => {
    const wrapped = doc.splitTextToSize(line, pageWidth - 28);
    doc.text(wrapped, 14, commNoteY + 6 + i * 11);
  });

  // =========================================================================
  // PAGE 5 — TERRAIN & THERMAL ANALYSIS
  // =========================================================================
  doc.addPage('a4', 'landscape');
  drawReportHeader(
    'SECTION 04 · TERRAIN & THERMAL ANALYSIS',
    'Topographic Characteristics (LRO LOLA DEM) & Analytical Surface Thermal Regimen',
    'Measured LOLA 400 m/px polar elevation, Horn 3x3 slope, 2 km RMS roughness, and radiative balance temperature extrema.'
  );

  autoTable(doc, {
    startY: 29,
    margin: { left: 14, right: 14 },
    head: [
      [
        'Landing Site',
        'Elevation (m)',
        'Slope (°)',
        'Roughness (m RMS)',
        'Local Relief (2 km)',
        'Crater Density',
        'Terrain Classification',
        'Touchdown Temp',
        'Mission Min / Max Temp',
        'Thermal Exposure (Cryo / Benign)',
      ],
    ],
    body: validEvals.map((ev, idx) => [
      `#${idx + 1} ${ev.name}`,
      ev.terrain.elevationM !== null
        ? `${ev.terrain.elevationM >= 0 ? '+' : ''}${ev.terrain.elevationM.toLocaleString()} m`
        : 'Data Not Available',
      ev.terrain.slopeDeg !== null ? `${ev.terrain.slopeDeg.toFixed(1)}°` : 'Data Not Available',
      ev.terrain.roughnessM !== null ? `${ev.terrain.roughnessM.toFixed(1)} m` : 'Data Not Available',
      ev.terrain.localReliefM !== null ? `${ev.terrain.localReliefM.toFixed(0)} m` : 'Data Not Available',
      'Data Not Available',
      ev.terrain.terrainClassification,
      `${ev.thermal.touchdownTempC}°C (${ev.thermal.touchdownTempK} K)`,
      `${ev.thermal.minTempC}°C to ${ev.thermal.maxTempC > 0 ? '+' : ''}${ev.thermal.maxTempC}°C\n(Δ${ev.thermal.tempVariationC}°C)`,
      `${ev.thermal.cryogenicHours}h cryo / ${ev.thermal.benignThermalHours}h benign`,
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      cellPadding: 2.5,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [52, 211, 153],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 34 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const terrainNoteY = (doc.lastAutoTable?.finalY || 130) + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Terrain & Thermal Dataset Provenance Notes:', 14, terrainNoteY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const terrainNotes = [
    '• LRO LOLA South Pole DEM Coverage Boundary (80°S–90°S): High-resolution (400 m/px, 0.5 m vertical precision) gridded elevation, Horn 3x3 slope, and 2 km RMS surface roughness are computed directly from the bundled NASA LOLA South Pole binary grid. Custom locations north of 80°S without published catalog values explicitly report Data Not Available.',
    '• Crater Spatial Density: Local crater count catalogs (e.g., Robbins 2019) are not loaded in local application memory; Crater Density is strictly reported as Data Not Available rather than approximated.',
    '• Surface Temperature Provenance: Temperatures are Model-Derived via an analytical Stefan-Boltzmann radiative equilibrium model parameterized by LRO Diviner literature (Vasavada et al. 2012; Paige et al. 2010) and coupled to local LOLA DEM shadow masking.',
  ];
  terrainNotes.forEach((line, i) => {
    const wrapped = doc.splitTextToSize(line, pageWidth - 28);
    doc.text(wrapped, 14, terrainNoteY + 6 + i * 10);
  });

  // =========================================================================
  // PAGE 6 — SUITABILITY & EVIDENCE-BASED TRADE-OFF ANALYSIS
  // =========================================================================
  doc.addPage('a4', 'landscape');
  drawReportHeader(
    'SECTION 05 · SUITABILITY & TRADE-OFF ANALYSIS',
    'Multi-Disciplinary Mission Suitability & Evidence-Based Recommendation',
    'Weighted suitability breakdown (35% Solar, 30% Comm, 20% Terrain, 15% Thermal), site advantages/disadvantages, and operational risks.'
  );

  autoTable(doc, {
    startY: 29,
    margin: { left: 14, right: 14 },
    head: [
      [
        'Landing Site',
        'Solar Score (35%)',
        'Comm Score (30%)',
        'Terrain Score (20%)',
        'Thermal Score (15%)',
        'Overall Suitability',
        'Key Advantages',
        'Key Disadvantages & Operational Risks',
      ],
    ],
    body: validEvals.map((ev, idx) => {
      const summary = tradeOff?.siteSummaries?.find((s) => s.id === ev.id);
      return [
        `#${idx + 1} ${ev.name}`,
        `${ev.suitability.solarSuitability} / 100`,
        `${ev.suitability.commSuitability} / 100`,
        ev.suitability.terrainSuitability !== null
          ? `${ev.suitability.terrainSuitability} / 100`
          : 'Data Not Available',
        `${ev.suitability.thermalSuitability} / 100`,
        ev.suitability.overallSuitability !== null
          ? `${ev.suitability.overallSuitability} / 100`
          : 'Insufficient Data for Scoring',
        (summary?.advantages || []).join('; ') || 'No standout advantage identified',
        (summary?.disadvantages || []).join('; ') || 'Nominal within evaluated parameters',
      ];
    }),
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      cellPadding: 2.5,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [0, 210, 196],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { fontStyle: 'bold', fillColor: [241, 245, 249], cellWidth: 32 },
      6: { cellWidth: 62 },
      7: { cellWidth: 68 },
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const tradeY = (doc.lastAutoTable?.finalY || 115) + 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`Recommendation: ${tradeOff?.recommendationTitle || 'Evaluated'}`, 14, tradeY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const recLines = doc.splitTextToSize(tradeOff?.recommendationRationale || '', pageWidth - 28);
  doc.text(recLines, 14, tradeY + 5.5);

  let diffStartY = tradeY + 5.5 + recLines.length * 4.5 + 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Evidence-Based Trade-Off Findings & Critical Risks:', 14, diffStartY);
  diffStartY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const findingsList = [
    ...(tradeOff?.keyDifferences || []),
    ...(tradeOff?.criticalRisks || []).map((r) => `[CRITICAL RISK] ${r}`),
  ].slice(0, 6);

  findingsList.forEach((item) => {
    if (diffStartY < pageHeight - 16) {
      const wrapped = doc.splitTextToSize(`• ${item}`, pageWidth - 28);
      doc.text(wrapped, 14, diffStartY);
      diffStartY += wrapped.length * 4.2 + 1;
    }
  });

  // =========================================================================
  // PAGE 7 — DATA SOURCES, PROVENANCE & METHODOLOGY
  // =========================================================================
  doc.addPage('a4', 'landscape');
  drawReportHeader(
    'SECTION 06 · DATA SOURCES & SCIENTIFIC METHODOLOGY',
    'Dataset Provenance, Spatial/Temporal Resolution & Scoring Methodology',
    'Complete documentation of NASA planetary datasets, analytical ephemerides, scoring equations, and coverage limitations.'
  );

  autoTable(doc, {
    startY: 29,
    margin: { left: 14, right: 14 },
    head: [
      [
        'Dataset / Model Name',
        'Source Organization & Instrument',
        'Spatial & Temporal Resolution',
        'Coverage Area & Datum',
        'Derivation / Provenance Type',
      ],
    ],
    body: NASA_DATASETS_REGISTRY.map((ds) => [
      ds.datasetName,
      `${ds.instrument}\n(${ds.productId})`,
      ds.spatialResolution,
      `${ds.coverageArea}\n${ds.verticalDatum}`,
      ds.provenanceType,
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.8,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  const methY = (doc.lastAutoTable?.finalY || 115) + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Suitability Scoring Formula, Missing Data Policy & Limitations:', 14, methY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(51, 65, 85);
  const methLines = [
    '• Composite Suitability Equation: Overall = 0.35 × SolarSuitability + 0.30 × CommSuitability + 0.20 × TerrainSuitability + 0.15 × ThermalSuitability.',
    '• Strict Missing-Data Policy: Missing measurements are never substituted with zero, random numbers, or neighbor averages. If any required pillar (such as local LOLA DEM terrain slope for custom sites north of 80°S) is unavailable, Overall Suitability is reported as "Insufficient Data for Scoring" and the site is not artificially ranked.',
    '• Parameters Requiring Further Investigation: (1) Meter-scale boulder distribution and crater rim hazards from LROC NAC (0.5–2 m/px) imagery; (2) Spacecraft-specific solar array geometry and battery depth-of-discharge curves; (3) Earth DSN station scheduling and X/Ka-band atmospheric link margins.',
  ];
  methLines.forEach((line, idx) => {
    const wrapped = doc.splitTextToSize(line, pageWidth - 28);
    doc.text(wrapped, 14, methY + 6 + idx * 11);
  });

  // =========================================================================
  // ADD FOOTER & PAGE NUMBERS TO ALL PAGES
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const isCover = p === 1;
    doc.setDrawColor(isCover ? 30 : 203, isCover ? 48 : 213, isCover ? 72 : 225);
    doc.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(isCover ? 148 : 100, isCover ? 163 : 116, isCover ? 184 : 139);
    doc.text(
      `LUNA — Lunar Mission & Site Studio · Scientific Comparison Dossier · Generated ${generatedUtc}`,
      14,
      pageHeight - 5.5
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - 14, pageHeight - 5.5, {
      align: 'right',
    });
  }

  const fileName = `Luna_Site_Comparison_${validEvals.length}Sites_${durationDays}d_${new Date(referenceEpochMs).toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
  return fileName;
}
