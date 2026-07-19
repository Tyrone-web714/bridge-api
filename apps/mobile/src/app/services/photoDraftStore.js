import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDriverTenantContext } from './driverSession';
import {
  cleanTenantValue,
  isTrustedTenantContext,
  operationMatchesTenant,
  safeStoragePart,
  tenantScopedStorageKey,
} from './tenantContext';

const PHOTO_DRAFT_PREFIX = '@truck-safe-routing/photo-drafts/v1';
const PHOTO_DRAFT_INDEX_PART = 'index';
const PHOTO_DRAFT_INTENT_PART = 'active-camera-intent';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

function requireIdentity() {
  const identity = getDriverTenantContext();
  if (!isTrustedTenantContext(identity)) {
    throw new Error('A trusted driver Organization context is required for camera photo drafts.');
  }
  return identity;
}

function nowIso() {
  return new Date().toISOString();
}

function isFresh(record = {}) {
  const createdAt = Date.parse(record.createdAt || record.updatedAt || '');
  return Number.isFinite(createdAt) && Date.now() - createdAt <= DRAFT_TTL_MS;
}

function workflowContextKey(workflow, context = {}) {
  return [
    workflow,
    context.accountNumber,
    context.placeId,
    context.destination,
    context.routeDate,
    context.routeNumber,
    context.stopId,
    context.category,
  ].map((part) => safeStoragePart(part, 'none')).join('-');
}

function indexKey(identity) {
  return tenantScopedStorageKey(PHOTO_DRAFT_PREFIX, identity, PHOTO_DRAFT_INDEX_PART);
}

function intentKey(identity) {
  return tenantScopedStorageKey(PHOTO_DRAFT_PREFIX, identity, PHOTO_DRAFT_INTENT_PART);
}

function draftKey(identity, workflow, context = {}) {
  return tenantScopedStorageKey(PHOTO_DRAFT_PREFIX, identity, 'draft', workflowContextKey(workflow, context));
}

async function readJson(key, fallback) {
  try {
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function upsertIndex(identity, draft) {
  const key = indexKey(identity);
  const current = await readJson(key, []);
  const active = (Array.isArray(current) ? current : [])
    .filter((item) => item?.key !== draft.key && isFresh(item));
  await writeJson(key, [
    {
      key: draft.key,
      workflow: draft.workflow,
      context: draft.context,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    },
    ...active,
  ].slice(0, 8));
}

function sanitizeRouteParams(routeParams = {}) {
  const destinationDetails = routeParams.destinationDetails || {};
  return {
    destinationAddress: cleanTenantValue(routeParams.destinationAddress),
    destinationPlaceId: cleanTenantValue(routeParams.destinationPlaceId),
    destinationDetails: routeParams.destinationDetails || null,
    driverId: cleanTenantValue(routeParams.driverId),
    driverName: cleanTenantValue(routeParams.driverName),
    routeDestination: cleanTenantValue(routeParams.routeDestination),
    routeManifestId: cleanTenantValue(routeParams.routeManifestId || destinationDetails.routeManifestId),
    routeStopId: cleanTenantValue(routeParams.routeStopId || destinationDetails.routeStopId),
    routeDate: cleanTenantValue(routeParams.routeDate || routeParams.routeManifestDate || destinationDetails.routeDate),
    routeNumber: cleanTenantValue(routeParams.routeNumber || destinationDetails.routeNumber),
  };
}

export function buildDeliveryNoteDraftContext({
  accountNumber,
  placeId,
  destination,
  routeManifestId,
  routeStopId,
  routeDate,
  routeNumber,
  routeParams,
} = {}) {
  return {
    accountNumber: cleanTenantValue(accountNumber),
    placeId: cleanTenantValue(placeId),
    destination: cleanTenantValue(destination),
    routeManifestId: cleanTenantValue(routeManifestId || routeParams?.routeManifestId || routeParams?.destinationDetails?.routeManifestId),
    stopId: cleanTenantValue(routeStopId || routeParams?.routeStopId || routeParams?.destinationDetails?.routeStopId),
    routeDate: cleanTenantValue(routeDate || routeParams?.routeDate || routeParams?.routeManifestDate || routeParams?.destinationDetails?.routeDate),
    routeNumber: cleanTenantValue(routeNumber || routeParams?.routeNumber || routeParams?.destinationDetails?.routeNumber),
    routeParams: sanitizeRouteParams(routeParams),
  };
}

export function buildHazardDraftContext(routeParams = {}) {
  return {
    category: 'hazard-report',
    routeParams: sanitizeRouteParams(routeParams),
  };
}

export async function rememberCameraWorkflow({ workflow, context = {} } = {}) {
  const identity = requireIdentity();
  const intent = {
    workflow,
    context,
    organizationId: identity.organizationId,
    internalDriverId: identity.internalDriverId,
    companyDriverNumber: identity.companyDriverNumber,
    createdAt: nowIso(),
  };
  await writeJson(intentKey(identity), intent);
  return intent;
}

export async function readCameraWorkflowIntent() {
  const identity = requireIdentity();
  const intent = await readJson(intentKey(identity), null);
  if (!intent || !operationMatchesTenant(intent, identity) || !isFresh(intent)) return null;
  return intent;
}

export async function clearCameraWorkflowIntent() {
  const identity = requireIdentity();
  await AsyncStorage.removeItem(intentKey(identity));
}

export async function savePhotoDraft({ workflow, context = {}, photos = [] } = {}) {
  const identity = requireIdentity();
  const key = draftKey(identity, workflow, context);
  const existing = await readJson(key, null);
  const createdAt = existing?.createdAt || nowIso();
  const draft = {
    key,
    workflow,
    context,
    photos: (Array.isArray(photos) ? photos : []).filter((photo) => photo?.uri || photo?.localUri),
    organizationId: identity.organizationId,
    internalDriverId: identity.internalDriverId,
    companyDriverNumber: identity.companyDriverNumber,
    createdAt,
    updatedAt: nowIso(),
  };
  await writeJson(key, draft);
  await upsertIndex(identity, draft);
  return draft;
}

export async function readPhotoDraft({ workflow, context = {} } = {}) {
  const identity = requireIdentity();
  const draft = await readJson(draftKey(identity, workflow, context), null);
  if (!draft || !operationMatchesTenant(draft, identity) || !isFresh(draft)) return null;
  return draft;
}

export async function readLatestPhotoDraft() {
  const identity = requireIdentity();
  const index = await readJson(indexKey(identity), []);
  const active = (Array.isArray(index) ? index : []).filter(isFresh);
  for (const item of active) {
    const draft = await readJson(item.key, null);
    if (draft && operationMatchesTenant(draft, identity) && isFresh(draft) && draft.photos?.length) {
      return draft;
    }
  }
  return null;
}

export async function clearPhotoDraft({ workflow, context = {} } = {}) {
  const identity = requireIdentity();
  const key = draftKey(identity, workflow, context);
  await AsyncStorage.removeItem(key);
  const index = await readJson(indexKey(identity), []);
  await writeJson(indexKey(identity), (Array.isArray(index) ? index : []).filter((item) => item?.key !== key));
}
