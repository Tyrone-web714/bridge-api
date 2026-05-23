const crypto = require('crypto');
const repositories = require('../db/repositories');

const ADMIN_COOKIE_NAME = 'tsr_admin_session';
const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
const PASSWORD_KEYLEN = 64;
const PASSWORD_COST = 16384;

function cleanText(value, maxLength = 180) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeUsername(value) {
  return cleanText(value, 80).toLowerCase();
}

function getAdminPassword() {
  return process.env.ADMIN_DASHBOARD_PASSWORD || process.env.SUPERVISOR_ADMIN_PASSWORD || null;
}

function getAdminSecret() {
  return process.env.ADMIN_DASHBOARD_SECRET || process.env.SUPERVISOR_ADMIN_SECRET || getAdminPassword();
}

function getAdminRoleForUsername(username) {
  const normalizedUsername = normalizeUsername(username);
  const adminUsers = String(process.env.ADMIN_DASHBOARD_ADMINS || 'admin')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (adminUsers.includes(normalizedUsername)) return 'admin';
  return cleanText(process.env.ADMIN_DASHBOARD_ROLE || 'supervisor', 40).toLowerCase() || 'supervisor';
}

function timingSafeStringEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto.scryptSync(String(password || ''), salt, PASSWORD_KEYLEN, { N: PASSWORD_COST }).toString('base64url');
  return `scrypt:${PASSWORD_COST}:${salt}:${hash}`;
}

function verifyPassword(password, passwordHash) {
  const parts = String(passwordHash || '').split(':');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;

  const cost = Number(parts[1]);
  const salt = parts[2];
  const expectedHash = parts[3];
  if (!Number.isFinite(cost) || !salt || !expectedHash) return false;

  const actualHash = crypto.scryptSync(String(password || ''), salt, PASSWORD_KEYLEN, { N: cost }).toString('base64url');
  return timingSafeStringEqual(actualHash, expectedHash);
}

function getCookieValue(req, name) {
  const rawCookie = req.headers.cookie || '';
  const cookies = rawCookie.split(';').map((item) => item.trim()).filter(Boolean);
  const cookie = cookies.find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : null;
}

function signAdminPayload(payload) {
  const secret = getAdminSecret();
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function createAdminSessionToken(username, role = 'supervisor') {
  const expiresAt = Date.now() + ADMIN_SESSION_MS;
  const payload = Buffer.from(JSON.stringify({ username, role, expiresAt })).toString('base64url');
  const signature = signAdminPayload(payload);
  return `${payload}.${signature}`;
}

function verifyAdminSessionToken(token) {
  const secret = getAdminSecret();
  if (!secret || !token || !token.includes('.')) return null;

  const [payload, signature] = token.split('.');
  const expectedSignature = signAdminPayload(payload);
  if (!timingSafeStringEqual(signature, expectedSignature)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed?.username || !Number.isFinite(parsed.expiresAt)) return null;
    if (parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getAdminSession(req) {
  return verifyAdminSessionToken(getCookieValue(req, ADMIN_COOKIE_NAME));
}

function setAdminSessionCookie(req, res, username, role) {
  const token = createAdminSessionToken(username, role || getAdminRoleForUsername(username));
  const secure = req.secure || String(req.headers['x-forwarded-proto'] || '').includes('https');
  const cookieParts = [
    `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/api',
    `Max-Age=${Math.floor(ADMIN_SESSION_MS / 1000)}`
  ];
  if (secure) cookieParts.push('Secure');
  res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function clearAdminSessionCookie(res) {
  res.setHeader('Set-Cookie', `${ADMIN_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/api; Max-Age=0`);
}

async function authenticateAdminUser(usernameInput, password) {
  const username = normalizeUsername(usernameInput) || 'supervisor';
  if (!getAdminSecret()) {
    return { ok: false, setupRequired: true, reason: 'Admin dashboard secret is not configured.' };
  }

  if (repositories.isDatabaseEnabled()) {
    const user = await repositories.getAdminUser(username);
    if (user) {
      if (!user.active) return { ok: false, reason: 'This admin user is inactive.' };
      if (!verifyPassword(password, user.passwordHash)) return { ok: false, reason: 'Incorrect supervisor username or password.' };
      await repositories.recordAdminUserLogin(username);
      return { ok: true, username: user.username, role: user.role || 'supervisor' };
    }
  }

  const configuredPassword = getAdminPassword();
  if (!configuredPassword) {
    return { ok: false, setupRequired: true, reason: 'Admin dashboard password is not configured.' };
  }
  if (!timingSafeStringEqual(password, configuredPassword)) {
    return { ok: false, reason: 'Incorrect supervisor username or password.' };
  }

  return { ok: true, username, role: getAdminRoleForUsername(username), usedLegacySharedPassword: true };
}

module.exports = {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MS,
  authenticateAdminUser,
  clearAdminSessionCookie,
  getAdminPassword,
  getAdminSecret,
  getAdminRoleForUsername,
  getAdminSession,
  hashPassword,
  normalizeUsername,
  setAdminSessionCookie,
  timingSafeStringEqual,
  verifyPassword
};
