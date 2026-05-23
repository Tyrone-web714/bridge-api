const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn, spawnSync } = require('child_process');
const unzipper = require('unzipper');
require('dotenv').config();

const postgres = require('../db/postgres');

const TIGER_YEAR = String(process.env.CENSUS_TIGER_YEAR || '2025').trim();
const DATA_DIR = path.join(__dirname, '..', 'data', 'census', `tiger${TIGER_YEAR}`, 'place');
const DEFAULT_PG_BIN = 'C:\\Program Files\\PostgreSQL\\17\\bin';
const SHP2PGSQL = process.env.SHP2PGSQL_PATH || path.join(DEFAULT_PG_BIN, 'shp2pgsql.exe');
const PSQL = process.env.PSQL_PATH || path.join(DEFAULT_PG_BIN, 'psql.exe');
const CENSUS_BASE_URL = `https://www2.census.gov/geo/tiger/TIGER${TIGER_YEAR}/PLACE`;
const STATES = [
  { code: 'TX', fips: '48', name: 'Texas' },
  { code: 'OK', fips: '40', name: 'Oklahoma' },
  { code: 'NM', fips: '35', name: 'New Mexico' },
  { code: 'AR', fips: '05', name: 'Arkansas' }
];

function ensureTool(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} was not found at ${filePath}. Set ${label === 'shp2pgsql' ? 'SHP2PGSQL_PATH' : 'PSQL_PATH'} if PostgreSQL is installed somewhere else.`);
  }
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    const file = fs.createWriteStream(destination);
    const request = https.get(url, {
      headers: { 'User-Agent': 'truck-safe-routing-census-import/1.0' }
    }, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location) {
        file.close();
        fs.rmSync(destination, { force: true });
        downloadFile(new URL(response.headers.location, url).toString(), destination).then(resolve, reject);
        return;
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        file.close();
        fs.rmSync(destination, { force: true });
        reject(new Error(`Census download failed with HTTP ${response.statusCode}: ${url}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    });
    request.on('error', (error) => {
      file.close();
      fs.rmSync(destination, { force: true });
      reject(error);
    });
  });
}

async function extractZip(zipPath, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: outputDir }))
    .promise();
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.stdio || 'pipe',
    encoding: 'utf8',
    shell: false
  });

  if (result.status !== 0) {
    throw new Error([
      `${path.basename(command)} failed with exit code ${result.status}`,
      result.stdout,
      result.stderr
    ].filter(Boolean).join('\n'));
  }

  return result;
}

function streamCommandToFile(command, args, outputFile) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFile);
    const child = spawn(command, args, {
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stderr = '';

    child.stdout.pipe(output);
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      output.close();
      reject(error);
    });
    child.on('close', (code) => {
      output.close();
      if (code !== 0) {
        reject(new Error(`${path.basename(command)} failed with exit code ${code}\n${stderr}`));
        return;
      }
      resolve();
    });
  });
}

function runPsqlSql(sql) {
  runCommand(PSQL, [process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'pipe' });
}

function runPsqlFile(sqlFile) {
  runCommand(PSQL, [process.env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-f', sqlFile], { stdio: 'pipe' });
}

function findShapefile(extractDir, state) {
  const expected = path.join(extractDir, `tl_${TIGER_YEAR}_${state.fips}_place.shp`);
  if (fs.existsSync(expected)) return expected;

  const found = fs.readdirSync(extractDir)
    .find((name) => name.toLowerCase().endsWith('.shp'));
  if (!found) throw new Error(`No .shp file found after extracting ${extractDir}`);
  return path.join(extractDir, found);
}

function createFinalTable() {
  runPsqlSql(`
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE TABLE IF NOT EXISTS census_places (
      geoid TEXT PRIMARY KEY,
      state_code TEXT NOT NULL,
      state_fips TEXT NOT NULL,
      place_fips TEXT NOT NULL,
      place_name TEXT NOT NULL,
      place_label TEXT,
      legal_stat TEXT,
      classfp TEXT,
      mtfcc TEXT,
      funcstat TEXT,
      aland BIGINT,
      awater BIGINT,
      intptlat DOUBLE PRECISION,
      intptlng DOUBLE PRECISION,
      tiger_year TEXT NOT NULL,
      geom geometry(MultiPolygon, 4326) NOT NULL,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS census_places_state_code_idx ON census_places(state_code);
    CREATE INDEX IF NOT EXISTS census_places_place_name_idx ON census_places(place_name);
    CREATE INDEX IF NOT EXISTS census_places_geom_gix ON census_places USING GIST (geom);
  `);
}

async function importState(state, shapefilePath) {
  const sqlFile = path.join(DATA_DIR, `import-${state.code.toLowerCase()}.sql`);
  runPsqlSql('DROP TABLE IF EXISTS census_places_import CASCADE;');
  await streamCommandToFile(SHP2PGSQL, [
    '-c',
    '-s',
    '4269:4326',
    '-W',
    'LATIN1',
    shapefilePath,
    'public.census_places_import'
  ], sqlFile);
  runPsqlFile(sqlFile);
  runPsqlSql(`
    INSERT INTO census_places (
      geoid, state_code, state_fips, place_fips, place_name, place_label,
      legal_stat, classfp, mtfcc, funcstat, aland, awater, intptlat, intptlng,
      tiger_year, geom, imported_at
    )
    SELECT
      geoid,
      '${state.code}',
      statefp,
      placefp,
      name,
      namelsad,
      lsad,
      classfp,
      mtfcc,
      funcstat,
      NULLIF(aland::text, '')::bigint,
      NULLIF(awater::text, '')::bigint,
      NULLIF(intptlat, '')::double precision,
      NULLIF(intptlon, '')::double precision,
      '${TIGER_YEAR}',
      ST_Multi(ST_Transform(geom, 4326))::geometry(MultiPolygon, 4326),
      NOW()
    FROM census_places_import
    WHERE geoid IS NOT NULL
    ON CONFLICT (geoid) DO UPDATE SET
      state_code = EXCLUDED.state_code,
      state_fips = EXCLUDED.state_fips,
      place_fips = EXCLUDED.place_fips,
      place_name = EXCLUDED.place_name,
      place_label = EXCLUDED.place_label,
      legal_stat = EXCLUDED.legal_stat,
      classfp = EXCLUDED.classfp,
      mtfcc = EXCLUDED.mtfcc,
      funcstat = EXCLUDED.funcstat,
      aland = EXCLUDED.aland,
      awater = EXCLUDED.awater,
      intptlat = EXCLUDED.intptlat,
      intptlng = EXCLUDED.intptlng,
      tiger_year = EXCLUDED.tiger_year,
      geom = EXCLUDED.geom,
      imported_at = NOW();
    DROP TABLE IF EXISTS census_places_import;
  `);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required before importing Census PLACE boundaries.');
  }
  ensureTool(SHP2PGSQL, 'shp2pgsql');
  ensureTool(PSQL, 'psql');
  fs.mkdirSync(DATA_DIR, { recursive: true });

  await postgres.ensureSchema();
  createFinalTable();

  for (const state of STATES) {
    const filename = `tl_${TIGER_YEAR}_${state.fips}_place.zip`;
    const url = `${CENSUS_BASE_URL}/${filename}`;
    const zipPath = path.join(DATA_DIR, filename);
    const extractDir = path.join(DATA_DIR, `${state.code.toLowerCase()}_place`);

    if (!fs.existsSync(zipPath) || process.env.CENSUS_FORCE_DOWNLOAD === 'true') {
      console.log(`[census:places] Downloading ${state.name}: ${url}`);
      await downloadFile(url, zipPath);
    } else {
      console.log(`[census:places] Using cached ${filename}`);
    }

    if (!fs.existsSync(extractDir) || process.env.CENSUS_FORCE_EXTRACT === 'true') {
      console.log(`[census:places] Extracting ${state.name}`);
      fs.rmSync(extractDir, { recursive: true, force: true });
      await extractZip(zipPath, extractDir);
    }

    const shapefilePath = findShapefile(extractDir, state);
    console.log(`[census:places] Importing ${state.name}: ${shapefilePath}`);
    await importState(state, shapefilePath);
  }

  const result = await postgres.query(`
    SELECT state_code, count(*)::int AS count
    FROM census_places
    WHERE tiger_year = $1
    GROUP BY state_code
    ORDER BY state_code
  `, [TIGER_YEAR]);
  console.table(result.rows);
  console.log(`[census:places] Complete. Imported Census TIGER/Line ${TIGER_YEAR} PLACE boundaries.`);
}

main()
  .catch((error) => {
    console.error('[census:places] failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
