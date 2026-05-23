require('dotenv').config();

const adminAuth = require('../services/adminAuth');
const postgres = require('../db/postgres');
const repositories = require('../db/repositories');

function readArg(name) {
  const prefix = `--${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1];
  return null;
}

function normalizeRole(value) {
  const role = String(value || 'supervisor').trim().toLowerCase();
  return role === 'admin' ? 'admin' : 'supervisor';
}

async function main() {
  if (!postgres.isDatabaseConfigured()) {
    throw new Error('DATABASE_URL is required before creating named admin users.');
  }

  const username = adminAuth.normalizeUsername(readArg('username') || process.env.ADMIN_CREATE_USERNAME || 'admin');
  const password = readArg('password') || process.env.ADMIN_CREATE_PASSWORD;
  const role = normalizeRole(readArg('role') || process.env.ADMIN_CREATE_ROLE || 'admin');
  const displayName = readArg('display-name') || process.env.ADMIN_CREATE_DISPLAY_NAME || username;

  if (!username) throw new Error('username is required');
  if (!password || password.length < 12) {
    throw new Error('password is required and must be at least 12 characters');
  }

  await postgres.ensureSchema();
  const user = await repositories.upsertAdminUser({
    username,
    passwordHash: adminAuth.hashPassword(password),
    role,
    displayName,
    active: true
  });

  console.log(`Admin user saved: ${user.username} (${user.role})`);
}

main()
  .catch((error) => {
    console.error(`[admin:create] failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await postgres.closePool();
  });
