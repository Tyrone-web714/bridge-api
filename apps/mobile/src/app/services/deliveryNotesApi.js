import { API_BASE_URL, jsonApiHeaders } from '../config/api';
import {
  cacheDeliveryNotes,
  enqueueDeliveryOperation,
  markDeliveryOperationFailed,
  readCachedDeliveryNotes,
  readPendingDeliveryOperations,
  removePendingDeliveryOperation,
} from './deliveryOfflineStore';
import {
  deleteLocalDeliveryPhotos,
  isLocalMediaUploadError,
  prepareDeliveryPhotoForUpload,
} from './deliveryPhotoStore';

function identityHeaders({ driverId, driverName } = {}) {
  const headers = {};
  if (String(driverId || '').trim()) headers['X-TSR-Driver-Id'] = String(driverId).trim();
  if (String(driverName || '').trim()) headers['X-TSR-Driver-Name'] = String(driverName).trim();
  return headers;
}

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || `HTTP ${response.status}` };
  }
}

function noteIdentity(note = {}) {
  return {
    routeStopId: note.routeStopId,
    routeManifestId: note.routeManifestId,
    routeDate: note.routeDate,
    routeNumber: note.routeNumber,
    accountNumber: note.accountNumber,
    placeId: note.placeId,
    destination: note.destination || note.address,
  };
}

function optimisticPhotos(note = {}) {
  const retained = Array.isArray(note.existingPhotos) ? note.existingPhotos : [];
  const added = (Array.isArray(note.photos) ? note.photos : []).map((photo, index) => {
    if (photo?.url && !photo?.base64) return photo;
    return {
      id: `offline-photo-${Date.now()}-${index}`,
      clientPhotoId: photo.clientPhotoId || null,
      mimeType: photo.mimeType || 'image/jpeg',
      originalName: photo.fileName || null,
      url: photo.localUri || photo.uri || (photo.base64
        ? `data:${photo.mimeType || 'image/jpeg'};base64,${photo.base64}`
        : photo.url || null),
      pendingSync: true,
    };
  });
  return [...retained, ...added].filter((photo) => photo?.url);
}

async function upsertCachedNote(note, noteId = null, pendingSync = false) {
  const identity = noteIdentity(note);
  const notes = await readCachedDeliveryNotes(identity);
  const id = noteId || note.id || `delivery-note-offline-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const optimisticNote = {
    ...note,
    id,
    photos: optimisticPhotos(note),
    createdAt: note.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pendingSync,
  };
  await cacheDeliveryNotes(identity, [
    optimisticNote,
    ...notes.filter((item) => item.id !== id),
  ]);
  return optimisticNote;
}

export async function fetchAccountDeliveryNotes({
  accountNumber,
  placeId,
  destination,
  routeStopId,
  routeManifestId,
  routeDate,
  routeNumber,
  driverId,
  driverName,
} = {}) {
  const identity = { accountNumber, placeId, destination, routeStopId, routeManifestId, routeDate, routeNumber };
  const query = new URLSearchParams();
  if (routeStopId) query.set('routeStopId', routeStopId);
  if (routeManifestId) query.set('routeManifestId', routeManifestId);
  if (routeDate) query.set('routeDate', routeDate);
  if (routeNumber) query.set('routeNumber', routeNumber);
  if (accountNumber) query.set('accountNumber', accountNumber);
  if (placeId) query.set('placeId', placeId);
  if (destination) query.set('destination', destination);
  try {
    const response = await fetch(`${API_BASE_URL}/api/delivery-notes?${query.toString()}`, {
      headers: jsonApiHeaders(identityHeaders({ driverId, driverName })),
    });
    const data = await readJson(response);
    if (!response.ok) {
      const error = new Error(data?.error || 'Unable to load delivery notes.');
      error.status = response.status;
      throw error;
    }
    const notes = Array.isArray(data.notes) ? data.notes : [];
    await cacheDeliveryNotes(identity, notes);
    return notes;
  } catch (error) {
    if (error?.status) throw error;
    const cached = await readCachedDeliveryNotes(identity);
    if (!cached.length) throw error;
    return cached.map((note) => ({ ...note, loadedFromOfflineCache: true }));
  }
}

async function sendNoteOperation(operation) {
  const noteId = operation.payload?.noteId;
  const endpoint = noteId
    ? `${API_BASE_URL}/api/delivery-notes/${encodeURIComponent(noteId)}`
    : `${API_BASE_URL}/api/delivery-notes`;
  const method = operation.type === 'delivery_note_delete'
    ? 'DELETE'
    : noteId
      ? 'PUT'
      : 'POST';
  const rawNote = operation.payload?.note || {};
  const expectedPhotoCount = method === 'DELETE'
    ? 0
    : (Array.isArray(rawNote.existingPhotos) ? rawNote.existingPhotos.length : 0)
      + (Array.isArray(rawNote.photos) ? rawNote.photos.length : 0);
  const preparedPhotos = method === 'DELETE'
    ? []
    : await Promise.all(
        (Array.isArray(rawNote.photos) ? rawNote.photos : [])
          .map(prepareDeliveryPhotoForUpload)
      );
  const response = await fetch(endpoint, {
    method,
    headers: jsonApiHeaders(identityHeaders(operation)),
    body: method === 'DELETE'
      ? undefined
      : JSON.stringify({ ...rawNote, photos: preparedPhotos }),
  });
  const data = await readJson(response);
  if (!response.ok) {
    const error = new Error(data?.error || `Delivery note failed. HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (method !== 'DELETE' && expectedPhotoCount > 0) {
    const savedPhotoCount = Array.isArray(data?.note?.photos) ? data.note.photos.length : 0;
    if (savedPhotoCount !== expectedPhotoCount) {
      const error = new Error(`Delivery note photo save mismatch: expected ${expectedPhotoCount}, saved ${savedPhotoCount}.`);
      error.status = 409;
      error.expectedPhotoCount = expectedPhotoCount;
      error.savedPhotoCount = savedPhotoCount;
      throw error;
    }
  }
  if (method !== 'DELETE') {
    deleteLocalDeliveryPhotos(rawNote.photos);
  }
  return data;
}

export async function saveAccountDeliveryNote(note, identity = {}, noteId = null) {
  const operationType = noteId ? 'delivery_note_update' : 'delivery_note_create';
  const hasNewPhotos = Array.isArray(note?.photos) && note.photos.length > 0;
  const persistedNote = {
    ...note,
    id: noteId || note.id || `delivery-note-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  };
  try {
    const result = await sendNoteOperation({
      type: operationType,
      payload: { noteId, note: persistedNote },
      ...identity,
    });
    const savedNote = result.note || persistedNote;
    await upsertCachedNote(savedNote, savedNote.id, false);
    return result;
  } catch (error) {
    if (isLocalMediaUploadError(error)) throw error;
    if (error?.status) throw error;
    if (hasNewPhotos) {
      throw new Error(error.message || 'Delivery note photos were not saved. Check the connection and try again before leaving this stop.');
    }
    const operation = await enqueueDeliveryOperation(
      operationType,
      { noteId, note: persistedNote },
      identity
    );
    const optimisticNote = await upsertCachedNote(persistedNote, persistedNote.id, true);
    return { ok: true, queued: true, operationId: operation.id, note: optimisticNote };
  }
}

export async function deleteAccountDeliveryNote(noteOrId, identity = {}) {
  const note = typeof noteOrId === 'object' ? noteOrId : null;
  const noteId = note?.id || noteOrId;
  try {
    const result = await sendNoteOperation({
      type: 'delivery_note_delete',
      payload: { noteId, note },
      ...identity,
    });
    if (note) {
      const notes = await readCachedDeliveryNotes(noteIdentity(note));
      await cacheDeliveryNotes(noteIdentity(note), notes.filter((item) => item.id !== noteId));
    }
    return result;
  } catch (error) {
    if (error?.status) throw error;
    const operation = await enqueueDeliveryOperation(
      'delivery_note_delete',
      { noteId, note },
      identity
    );
    if (note) {
      const notes = await readCachedDeliveryNotes(noteIdentity(note));
      await cacheDeliveryNotes(noteIdentity(note), notes.filter((item) => item.id !== noteId));
    }
    return { ok: true, queued: true, operationId: operation.id };
  }
}

export async function flushPendingDeliveryNoteOperations() {
  const operations = (await readPendingDeliveryOperations()).filter((operation) => (
    operation.type.startsWith('delivery_note_')
  ));
  let synced = 0;
  for (const operation of operations) {
    try {
      await sendNoteOperation(operation);
      await removePendingDeliveryOperation(operation.id, operation);
      synced += 1;
    } catch (error) {
      await markDeliveryOperationFailed(operation.id, error.message, operation);
      break;
    }
  }
  return { synced };
}
