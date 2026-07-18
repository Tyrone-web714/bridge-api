const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const component = read('src/app/components/AuthenticatedMediaImage.js');
const deliveryNotes = read('src/app/screens/DeliveryNotesScreen.js');
const accountPanel = read('src/app/components/AccountKnowledgePanel.js');
const home = read('src/app/screens/HomeScreen.js');
const driverSession = read('src/app/services/driverSession.js');
const packageJson = JSON.parse(read('package.json'));

assert(component.includes('getDriverSessionHeaders'), 'authenticated media must use existing driver session headers');
assert(component.includes("classification === 'ORGANIZATION_PRIVATE'"), 'private media classification must be explicit');
assert(component.includes("accessPath.startsWith('/api/media/')"), 'private media accessPath must be recognized');
assert(component.includes('/\\/api\\/media\\/[^/?#]+/i.test(url)'), 'private media URL path must be recognized');
assert(component.includes('API_BASE_URL.replace'), 'relative private media paths must resolve against API_BASE_URL');
assert(!component.includes('legacyPublicUrl'), 'mobile private media must not fall back to legacy public URLs');
assert(!component.includes('PHOTO_STORAGE_PUBLIC_BASE_URL'), 'mobile must not know R2 public base URL');
assert(!component.includes('r2.dev'), 'mobile must not hard-code R2 public URLs');

assert(driverSession.includes('expo-secure-store'), 'driver session token must remain in SecureStore-backed session module');
assert(driverSession.includes('Authorization: `Bearer ${activeSession.token}`'), 'session module must construct bearer auth header');

assert(deliveryNotes.includes("import AuthenticatedMediaImage from '../components/AuthenticatedMediaImage'"), 'DeliveryNotesScreen must import authenticated image component');
assert(accountPanel.includes("import AuthenticatedMediaImage from './AuthenticatedMediaImage'"), 'AccountKnowledgePanel must import authenticated image component');
assert(home.includes("import AuthenticatedMediaImage from '../components/AuthenticatedMediaImage'"), 'HomeScreen must import authenticated image component');

for (const [label, source] of [
  ['DeliveryNotesScreen', deliveryNotes],
  ['AccountKnowledgePanel', accountPanel],
  ['HomeScreen', home]
]) {
  assert(!source.includes('source={{ uri: photo.url }}'), `${label} must not render private photo.url directly`);
  assert(!source.includes('source={{ uri: previewPhoto.url }}'), `${label} must not render private previewPhoto.url directly`);
  assert(!source.includes('source={{ uri: selectedDriverPhoto.url }}'), `${label} must not render private selectedDriverPhoto.url directly`);
}

assert(packageJson.scripts['test:mobile-private-media'] === 'node scripts/check-mobile-private-media.cjs', 'package script must register mobile private media test');

console.log('[test:mobile-private-media] authenticated private media rendering contracts verified.');
