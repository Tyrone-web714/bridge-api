// scripts/build-bridges.cjs
// Build real low-clearance bridges JSON from FHWA NBI (<= 13 ft)

const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const { parse } = require('csv-parse');

// ----------------- NBI download URL logic -----------------
const YEAR = process.env.NBI_YEAR || '2025';

// Candidates in order:
// 1) Environment override (if you set NBI_ZIP_URL in Render)
// 2) 2025 single-file delimited (all states in one CSV)
// 3) 2025 individual-state files (all states, each state separate)
const CANDIDATE_URLS = [
  process.env.NBI_ZIP_URL,
  `https://www.fhwa.dot.gov/bridge/nbi/${YEAR}hwybronefiledel.zip`,
  `https://www.fhwa.dot.gov/bridge/nbi/${YEAR}del.zip`
].filter(Boolean);
async function downloadZipWithFallback(toPath) {
  let lastErr;
  for (const url of CANDIDATE_URLS) {
    try {
      console.log(`Trying NBI ZIP: ${url}`);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      // Use Web Fetch API style in Node 22
      const buf = Buffer.from(await resp.arrayBuffer());
      await fs.promises.writeFile(toPath, buf);

      console.log(`Downloaded ${url}`);
      return;
    } catch (e) {
      console.warn(`Failed ${url}: ${e.message}`);
      lastErr = e;
    }
  }
  throw new Error(`All NBI ZIP candidates failed. Last error: ${lastErr && lastErr.message}`);
}



const OUT_JSON = path.join('data', 'low_clearance_bridges.json');
const TMP_DIR = path.join('.tmp_nbi');
const CSV_DIR = path.join(TMP_DIR, 'csvs');

const FEET_PER_METER = 3.28084;
const CLEARANCE_CUTOFF_FT = 13.0;

/** Convert meters-looking numbers to feet; keep feet-looking numbers in feet */
function toFeet(val) {
  if (val == null || val === '') return null;
  const n = Number(val);
  if (!isFinite(n)) return null;
  // meters if plausibly small; otherwise feet
  return n <= 8 ? n * FEET_PER_METER : n;
}

/** Pick best available underclearance in feet (prefer 54B; else fallbacks) */
function pickClearanceFeet(row) {
  const vUnd =
    row.VERT_CLR_UND_054B ?? row.MIN_VERT_UND_054B ?? row['54B'] ?? null;
  const vOver =
    row.VERT_CLR_OVER_MT_053 ?? row.MIN_VERT_OVER_MT_053 ?? row['53'] ?? null;
  const vMin10 =
    row.MIN_VERT_CLR_010 ?? row['10'] ?? null;

  let ft = toFeet(vUnd);
  if (ft) return ft;

  ft = toFeet(vOver);
  if (ft) return ft;

  ft = toFeet(vMin10);
  return ft ?? null;
}

function parseLat(row) {
  const lat = row.LAT_016 ?? row.LAT ?? row['16'];
  return lat ? Number(lat) : null;
}
function parseLng(row) {
  const lng = row.LONG_017 ?? row.LON_017 ?? row.LONG ?? row['17'];
  return lng ? Number(lng) : null;
}
function bridgeName(row) {
  return row.FEATURES_DESC_006A ?? row.FEATURES_DESC ?? row['6A'] ?? row.LOCATION_009 ?? row['9'] ?? 'Bridge';
}
function bridgeId(row) {
  const s = (row.STRUCTURE_NUMBER_008 || row['8'] || '').toString().trim();
  if (s) return s;
  const st = (row.STATE_CODE_001 || '').toString().trim();
  return `${st}-${row.OBJECTID || ''}`;
}

async function extractZip(zipPath, outDir) {
  console.log('Extracting CSVs …');
  await fs.createReadStream(zipPath).pipe(unzipper.Extract({ path: outDir })).promise();
}

async function* parseCsv(filePath) {
  const parser = fs.createReadStream(filePath).pipe(parse({
    columns: true,
    relax_quotes: true,
    relax_column_count: true,
    trim: true
  }));
  for await (const record of parser) yield record;
}

async function main() {
  if (!fs.existsSync('data')) fs.mkdirSync('data', { recursive: true });
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  if (!fs.existsSync(CSV_DIR)) fs.mkdirSync(CSV_DIR, { recursive: true });

  const zipPath = path.join(TMP_DIR, 'nbi.zip');

  // ✅ use the fallback downloader (do NOT call downloadZip or use NBI_ZIP_URL here)
  await downloadZipWithFallback(zipPath);
  await extractZip(zipPath, CSV_DIR);

 // list everything we extracted (debug)
const all = fs.readdirSync(CSV_DIR);
console.log('Extracted files:', all);

// accept .csv OR .txt (FHWA often ships the delimited file as .txt)
const files = all.filter(f => {
  const lower = f.toLowerCase();
  return lower.endsWith('.csv') || lower.endsWith('.txt');
});
console.log(`Found ${files.length} delimited file(s):`, files);


  const out = [];
  for (const f of files) {
    const full = path.join(CSV_DIR, f);
    console.log(`Parsing ${f} …`);

    for await (const row of parseCsv(full)) {
      try {
        const lat = parseLat(row);
        const lng = parseLng(row);
        const clearance_ft = pickClearanceFeet(row);
        if (!lat || !lng || clearance_ft == null) continue;

        if (clearance_ft <= CLEARANCE_CUTOFF_FT) {
          out.push({
            id: bridgeId(row),
            latitude: lat,
            longitude: lng,
            clearance_ft: Math.round(clearance_ft * 10) / 10,
            name: bridgeName(row)
          });
        }
      } catch {
        // skip malformed rows
      }
    }
  }

  console.log(`✓ Low-clearance (<= ${CLEARANCE_CUTOFF_FT} ft) points: ${out.length}`);
  fs.writeFileSync(OUT_JSON, JSON.stringify(out, null, 2));
  console.log(`✓ Wrote ${OUT_JSON}`);
}

main().catch(err => {
  console.error('ETL failed:', err);
  process.exit(1);
});
