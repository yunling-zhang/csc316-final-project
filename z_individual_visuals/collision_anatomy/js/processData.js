/**
 * Data Processing Script for Collision Anatomy Visualization
 * FIXED VERSION - Properly handles the complex CSV header structure
 */

// Zone mapping: Maps CSV impact location names to visual zones
const ZONE_MAPPING = {
  "Front, includes engine hood & windshield": "front",
  "Roof": "roof",
  "Rear, including trunk": "rear",
  "Left front third of the vehicle": "left-front",
  "Left middle third of the vehicle": "left-middle",
  "Left rear third of the vehicle": "left-rear",
  "Left front two-thirds of the vehicle": "left-front",
  "Left rear two-thirds of the vehicle": "left-rear",
  "Entire left side": "left-middle",
  "Left side unspecified": "left-middle",
  "Right front third of the vehicle": "right-front",
  "Right middle third of the vehicle": "right-middle",
  "Right rear third of the vehicle": "right-rear",
  "Right front two-thirds of the vehicle": "right-front",
  "Right rear two-thirds of the vehicle": "right-rear",
  "Entire right side": "right-middle",
  "Right side unspecified": "right-middle",
  "Undercarriage": "undercarriage",
  "Interior": "interior",
  "Attachment (either towed or trailer) was hit first": "attachment"
};

// Process the CSV data - handles the complex multi-header format
function processCSVData(rawData) {
  console.log("Processing CSV data...");
  console.log("Raw data rows:", rawData.length);
  
  // Initialize the data structure
  const processedData = {
    zones: {},
    maneuvers: [],
    years: []
  };

  // Initialize all zones
  const zoneNames = ['front', 'roof', 'rear', 'left-front', 'left-middle', 'left-rear',
                     'right-front', 'right-middle', 'right-rear', 'undercarriage', 'interior', 'attachment'];

  zoneNames.forEach(zone => {
    processedData.zones[zone] = {
      total: { vehicles: 0, injured: 0, fatalities: 0 },
      byYear: {},
      byManeuver: {}
    };
  });

  // Extract years (from 1999 to 2023)
  for (let year = 1999; year <= 2023; year++) {
    processedData.years.push(year);
    // Initialize year data for all zones
    zoneNames.forEach(zone => {
      processedData.zones[zone].byYear[year] = { vehicles: 0, injured: 0, fatalities: 0 };
    });
  }

  // Get column keys from first data row
  if (rawData.length === 0) {
    console.error("No data rows found!");
    return processedData;
  }

  const sampleRow = rawData[0];
  const columns = Object.keys(sampleRow);
  console.log("Columns found:", columns.slice(0, 10), "...");

  // D3.csv uses row 3 as header: "Vehicle Maneuver", "1st Impact Loc", then year columns
  const maneuverCol = 'Vehicle Maneuver';
  const impactCol = '1st Impact Loc';

  console.log("Looking for columns:", maneuverCol, impactCol);
  console.log("Sample row keys:", Object.keys(sampleRow).slice(0, 5));
  console.log("Sample row data:", {
    maneuver: sampleRow[maneuverCol],
    impact: sampleRow[impactCol],
    total: sampleRow['Total'],
    year1999: sampleRow['1999']
  });

  // Process each row
  let processedRows = 0;
  let skippedRows = 0;

  console.log("Starting to process", rawData.length, "rows");

  rawData.forEach((row, index) => {
    // Get maneuver and impact location from the named columns
    const maneuver = row[maneuverCol] || '';
    const impactLoc = row[impactCol] || '';

    // Debug first few valid rows
    if (index < 5) {
      console.log(`Row ${index}:`, {
        maneuver,
        impactLoc,
        total: row['Total'],
        total1: row['Total.1'],
        total2: row['Total.2'],
        year1999: row['1999'],
        allKeys: Object.keys(row).length
      });
    }

    // Skip invalid rows
    if (!maneuver || !impactLoc ||
        maneuver === 'Vehicle Maneuver' ||
        impactLoc === '1st Impact Loc' ||
        impactLoc === 'Total' ||
        maneuver === 'Total' ||
        maneuver.includes('Jurisdiction does not provide')) {
      skippedRows++;
      return;
    }

    // Get the zone for this impact location
    const zone = ZONE_MAPPING[impactLoc];
    if (!zone) {
      // Skip unknown impact locations (but log it for debugging)
      if (index < 10) {
        console.log(`Skipping unknown impact location: "${impactLoc}"`);
      }
      return;
    }

    // Add maneuver to list if not already there
    if (maneuver !== 'Total' && !processedData.maneuvers.includes(maneuver)) {
      processedData.maneuvers.push(maneuver);
    }

    // Initialize maneuver data for this zone if needed
    if (!processedData.zones[zone].byManeuver[maneuver]) {
      processedData.zones[zone].byManeuver[maneuver] = {
        vehicles: 0,
        injured: 0,
        fatalities: 0
      };
    }

    // Parse totals - look for "Total" columns
    // The CSV has columns: Total, Total (for injured), Total (for fatalities)
    // D3 renames duplicates to Total, Total.1, Total.2
    const totalVehicles = parseNumber(row['Total']);
    const totalInjured = parseNumber(row['Total.1']);
    const totalFatalities = parseNumber(row['Total.2']);

    if (totalVehicles > 0 || totalInjured > 0 || totalFatalities > 0) {
      processedData.zones[zone].total.vehicles += totalVehicles;
      processedData.zones[zone].total.injured += totalInjured;
      processedData.zones[zone].total.fatalities += totalFatalities;

      if (maneuver !== 'Total') {
        processedData.zones[zone].byManeuver[maneuver].vehicles += totalVehicles;
        processedData.zones[zone].byManeuver[maneuver].injured += totalInjured;
        processedData.zones[zone].byManeuver[maneuver].fatalities += totalFatalities;
      }
    }

    // Process by year - columns are: 1999, 1999.1, 1999.2, 2000, 2000.1, 2000.2, etc.
    processedData.years.forEach(year => {
      const yearStr = year.toString();
      const vehiclesKey = yearStr;
      const injuredKey = yearStr + '.1';
      const fatalitiesKey = yearStr + '.2';

      const yearVehicles = parseNumber(row[vehiclesKey]);
      const yearInjured = parseNumber(row[injuredKey]);
      const yearFatalities = parseNumber(row[fatalitiesKey]);

      if (yearVehicles > 0 || yearInjured > 0 || yearFatalities > 0) {
        processedData.zones[zone].byYear[year].vehicles += yearVehicles;
        processedData.zones[zone].byYear[year].injured += yearInjured;
        processedData.zones[zone].byYear[year].fatalities += yearFatalities;
      }
    });

    processedRows++;
  });

  console.log("Processed rows:", processedRows);
  console.log("Skipped rows:", skippedRows);

  // Log zone totals for debugging
  console.log("Zone totals:");
  Object.entries(processedData.zones).forEach(([zone, data]) => {
    if (data.total.vehicles > 0) {
      console.log(`  ${zone}: ${data.total.vehicles.toLocaleString()} vehicles, ${data.total.fatalities.toLocaleString()} fatalities`);
    }
  });

  return processedData;
}

// Helper function to safely parse numbers
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = parseInt(value, 10);
  return isNaN(num) ? 0 : num;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { processCSVData, ZONE_MAPPING };
}