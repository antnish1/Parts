const fs = require('node:fs');
const path = require('node:path');
const XLSX = require('xlsx');

const inputPath = process.argv[2];
const sheetName = process.argv[3] || 'Sheet3';
const outputDir = process.argv[4] || process.cwd();

if (!inputPath) {
  console.error('Usage: node scripts/prepare-part-location-import.cjs <workbook.xlsx> [Sheet3] [output-dir]');
  process.exit(1);
}

function clean(value) {
  return String(value ?? '').trim();
}

function normalizePartNo(value) {
  return clean(value).replace(/\s+/g, '').toUpperCase();
}

function normalizeLocation(value) {
  return clean(value).replace(/\s+/g, ' ').toUpperCase();
}

function splitLocations(value) {
  return clean(value)
    .split(/\s*(?:&|,)\s*/g)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

const workbook = XLSX.readFile(inputPath, { raw: true });
const sheet = workbook.Sheets[sheetName];
if (!sheet) {
  console.error(`Sheet ${sheetName} was not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
  process.exit(1);
}

const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
const header = (rows[0] || []).map((value) => clean(value).toLowerCase());
const partIndex = header.findIndex((value) => value === 'part no' || value === 'part no.' || value === 'partno' || value === 'part_no');
const locationIndex = header.findIndex((value) => value === 'location');

if (partIndex < 0 || locationIndex < 0) {
  console.error('Expected columns "Part No" and "Location" were not found.');
  process.exit(1);
}

const generated = [];
const invalidRows = [];
const duplicates = [];
const seen = new Set();
let multiLocationRows = 0;

rows.slice(1).forEach((row, index) => {
  const sourceRow = index + 2;
  const partNo = clean(row[partIndex]);
  const partNoNormalized = normalizePartNo(partNo);
  const sourceLocation = clean(row[locationIndex]);
  if (!partNoNormalized || !sourceLocation) {
    invalidRows.push({ row: sourceRow, partNo, location: sourceLocation, reason: !partNoNormalized ? 'blank_part_no' : 'blank_location' });
    return;
  }

  const locations = splitLocations(sourceLocation);
  if (locations.length > 1) multiLocationRows += 1;
  if (locations.length === 0) {
    invalidRows.push({ row: sourceRow, partNo, location: sourceLocation, reason: 'location_split_empty' });
    return;
  }

  locations.forEach((location) => {
    const locationNormalized = normalizeLocation(location);
    const key = `${partNoNormalized}::${locationNormalized}`;
    if (seen.has(key)) {
      duplicates.push({ row: sourceRow, partNo, location });
      return;
    }
    seen.add(key);
    generated.push({
      part_no: partNo,
      part_no_normalized: partNoNormalized,
      location,
      location_normalized: locationNormalized,
      is_active: true,
    });
  });
});

fs.mkdirSync(outputDir, { recursive: true });
const csvPath = path.join(outputDir, 'part_locations_import.csv');
const reportPath = path.join(outputDir, 'part_locations_import_report.json');
const csv = [
  ['part_no', 'part_no_normalized', 'location', 'location_normalized', 'is_active'].map(csvCell).join(','),
  ...generated.map((row) => [row.part_no, row.part_no_normalized, row.location, row.location_normalized, row.is_active].map(csvCell).join(',')),
].join('\n');

const report = {
  workbook: path.basename(inputPath),
  sheet: sheetName,
  sourceRows: Math.max(rows.length - 1, 0),
  generatedRecords: generated.length,
  uniqueParts: new Set(generated.map((row) => row.part_no_normalized)).size,
  multiLocationRows,
  duplicateMappingsRemoved: duplicates.length,
  invalidRows: invalidRows.length,
  duplicateDetails: duplicates,
  invalidDetails: invalidRows,
  notes: [
    'Splits Location cells on ampersand (&) and comma (,).',
    'Keeps the original display location while adding normalized values for indexed lookup and duplicate detection.',
    'This script only prepares files. It never connects to or writes to Supabase.',
  ],
};

fs.writeFileSync(csvPath, csv, 'utf8');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({ csvPath, reportPath, ...report }, null, 2));
