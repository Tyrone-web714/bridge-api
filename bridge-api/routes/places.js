const express = require('express');
const fs = require('fs');
const path = require('path');
const repositories = require('../db/repositories');

const router = express.Router();
const AUTOCOMPLETE_MIN_CHARS = 2;
const RECENTS_FILE = path.join(__dirname, '..', 'data', 'recent_destinations.json');
const MAX_RECENT_DESTINATIONS = 12;
const BUSINESS_SEARCH_RADIUS_METERS = 120;
const BUSINESS_SEARCH_MAX_CANDIDATES = 30;
const PLACES_NEARBY_MAX_RESULTS = 20;
const PLACES_TEXT_MAX_RESULTS = 20;
const BUSINESS_FALLBACK_MAX_DISTANCE_METERS = 75;
const BUSINESS_LABEL_MATCH_MIN_SCORE = 55;
const PLACES_NEW_BASE_URL = 'https://places.googleapis.com/v1';
const PLACE_DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'photos',
  'types',
  'googleMapsUri',
  'websiteUri',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'businessStatus',
  'rating',
  'userRatingCount'
].join(',');
const PLACE_SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.photos',
  'places.types',
  'places.businessStatus',
  'places.rating',
  'places.userRatingCount'
].join(',');
const AUTOCOMPLETE_FIELD_MASK = [
  'suggestions.placePrediction.placeId',
  'suggestions.placePrediction.text.text',
  'suggestions.placePrediction.structuredFormat.mainText.text',
  'suggestions.placePrediction.structuredFormat.secondaryText.text',
  'suggestions.placePrediction.types'
].join(',');
const ADDRESS_LIKE_TYPES = new Set([
  'street_address',
  'route',
  'intersection',
  'premise',
  'subpremise',
  'postal_code',
  'locality',
  'political'
]);
const BUSINESS_LIKE_TYPES = new Set([
  'accounting',
  'airport',
  'atm',
  'bakery',
  'bank',
  'bar',
  'beauty_salon',
  'bicycle_store',
  'book_store',
  'bowling_alley',
  'cafe',
  'car_dealer',
  'car_rental',
  'car_repair',
  'car_wash',
  'clothing_store',
  'convenience_store',
  'department_store',
  'doctor',
  'drugstore',
  'electronics_store',
  'florist',
  'food',
  'furniture_store',
  'gas_station',
  'grocery_or_supermarket',
  'gym',
  'hardware_store',
  'health',
  'home_goods_store',
  'hospital',
  'laundry',
  'liquor_store',
  'lodging',
  'meal_delivery',
  'meal_takeaway',
  'movie_theater',
  'moving_company',
  'pharmacy',
  'physiotherapist',
  'plumber',
  'post_office',
  'real_estate_agency',
  'restaurant',
  'school',
  'shopping_mall',
  'store',
  'storage',
  'supermarket',
  'tourist_attraction',
  'veterinary_care'
]);

function cleanInput(value) {
  return String(value || '').trim().slice(0, 120);
}

function cleanLongInput(value) {
  return String(value || '').trim().slice(0, 300);
}

function cleanLargeInput(value) {
  return String(value || '').trim().slice(0, 2000);
}

function sanitizeRecentDestination(record = {}) {
  const description = cleanLongInput(record.description);
  return {
    placeId: cleanInput(record.placeId),
    description,
    mainText: description,
    secondaryText: '',
    name: '',
    savedAt: record.savedAt || new Date().toISOString()
  };
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseTypes(value) {
  return String(value || '')
    .split(',')
    .map((type) => type.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function normalizePlaceText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenSet(value) {
  const ignored = new Set(['and', 'the', 'at', 'of', 'a', 'an', 'inc', 'llc', 'co', 'company']);
  return new Set(
    normalizePlaceText(value)
      .split(' ')
      .filter((token) => token.length > 1 && !ignored.has(token))
  );
}

function placeTextMatchScore(expectedLabel, candidateName) {
  const expected = normalizePlaceText(expectedLabel);
  const candidate = normalizePlaceText(candidateName);
  if (!expected || !candidate) return 0;
  if (expected === candidate) return 100;
  if (candidate.includes(expected) || expected.includes(candidate)) return 88;

  const expectedTokens = tokenSet(expected);
  const candidateTokens = tokenSet(candidate);
  if (!expectedTokens.size || !candidateTokens.size) return 0;

  let matches = 0;
  for (const token of expectedTokens) {
    if (candidateTokens.has(token)) matches += 1;
  }

  return Math.round((matches / Math.min(expectedTokens.size, candidateTokens.size)) * 80);
}

function looksLikeStreetAddress(value) {
  return /^\d+\s+[a-z0-9]/i.test(String(value || '').trim());
}

function normalizeStreetAddress(value) {
  return normalizePlaceText(value)
    .replace(/\b(east)\b/g, 'e')
    .replace(/\b(west)\b/g, 'w')
    .replace(/\b(north)\b/g, 'n')
    .replace(/\b(south)\b/g, 's')
    .replace(/\b(street)\b/g, 'st')
    .replace(/\b(road)\b/g, 'rd')
    .replace(/\b(avenue)\b/g, 'ave')
    .replace(/\b(boulevard)\b/g, 'blvd')
    .replace(/\b(drive)\b/g, 'dr')
    .replace(/\b(lane)\b/g, 'ln')
    .replace(/\b(parkway)\b/g, 'pkwy')
    .replace(/\b(suite|ste|unit|building|bldg|floor|fl)\b.*$/g, '')
    .replace(/\b(usa|united states)\b/g, '')
    .trim();
}

function streetNumber(value) {
  const match = normalizeStreetAddress(value).match(/^(\d+[a-z]?)(?:\s|$)/i);
  return match?.[1] || '';
}

function isSameStreetAddress(candidateAddress, selectedAddress) {
  const candidate = normalizeStreetAddress(candidateAddress);
  const selected = normalizeStreetAddress(selectedAddress);
  if (!candidate || !selected) return false;

  const candidateNumber = streetNumber(candidate);
  const selectedNumber = streetNumber(selected);
  if (candidateNumber || selectedNumber) {
    if (!candidateNumber || !selectedNumber || candidateNumber !== selectedNumber) return false;
  }

  const candidateTokens = tokenSet(candidate);
  const selectedTokens = tokenSet(selected);
  let sharedTokens = 0;
  for (const token of selectedTokens) {
    if (candidateTokens.has(token)) sharedTokens += 1;
  }

  return sharedTokens >= Math.min(3, selectedTokens.size);
}

function hasBusinessSelectionContext(metadata = {}) {
  const types = metadata.selectedTypes || [];
  if (types.some((type) => BUSINESS_LIKE_TYPES.has(type) || type === 'establishment' || type === 'point_of_interest')) {
    return true;
  }
  return Boolean(metadata.selectedLabel && !looksLikeStreetAddress(metadata.selectedLabel));
}

function readRecentDestinations() {
  try {
    if (!fs.existsSync(RECENTS_FILE)) return [];
    const parsed = JSON.parse(fs.readFileSync(RECENTS_FILE, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    const sanitized = parsed.map(sanitizeRecentDestination).filter((record) => record.description);
    writeRecentDestinations(sanitized);
    return sanitized;
  } catch (error) {
    console.error('recent-destinations read error:', error.message);
    return [];
  }
}

function writeRecentDestinations(records) {
  fs.mkdirSync(path.dirname(RECENTS_FILE), { recursive: true });
  fs.writeFileSync(RECENTS_FILE, JSON.stringify(records, null, 2));
}

async function listRecentDestinations() {
  if (repositories.isDatabaseEnabled()) {
    return repositories.listRecentDestinations();
  }
  return readRecentDestinations();
}

async function saveRecentDestination(destination) {
  const sanitizedDestination = sanitizeRecentDestination(destination);
  if (repositories.isDatabaseEnabled()) {
    return repositories.saveRecentDestination(sanitizedDestination, MAX_RECENT_DESTINATIONS);
  }

  const key = sanitizedDestination.placeId || sanitizedDestination.description.toLowerCase();
  const existing = readRecentDestinations()
    .filter((record) => (record.placeId || record.description?.toLowerCase()) !== key);
  const nextRecords = [sanitizedDestination, ...existing].slice(0, MAX_RECENT_DESTINATIONS);
  writeRecentDestinations(nextRecords);
  return nextRecords;
}

function buildPhotoUrl(req, photoReference) {
  if (!photoReference) return null;
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const query = new URLSearchParams({
    ref: photoReference,
    maxwidth: '900'
  });
  return `${baseUrl}/api/places/photo?${query.toString()}`;
}

function buildStreetViewUrl(req, location) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const query = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    size: '900x520'
  });
  return `${baseUrl}/api/places/street-view?${query.toString()}`;
}

function requireGoogleMapsApiKey() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    const error = new Error('GOOGLE_MAPS_API_KEY not set on server');
    error.statusCode = 500;
    throw error;
  }
  return key;
}

async function googlePlacesNewRequest(pathname, options = {}) {
  const {
    method = 'GET',
    body,
    fieldMask,
    timeoutMs = 10000,
    searchParams = {}
  } = options;
  const apiKey = requireGoogleMapsApiKey();
  const url = new URL(`${PLACES_NEW_BASE_URL}${pathname}`);

  for (const [key, value] of Object.entries(searchParams)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = {
    'X-Goog-Api-Key': apiKey
  };
  if (fieldMask) headers['X-Goog-FieldMask'] = fieldMask;
  if (body) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs)
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const error = new Error(payload?.error?.message || payload?.message || 'Places API (New) request failed');
    error.statusCode = response.status;
    error.googleStatus = payload?.error?.status || String(response.status);
    error.googleDetail = payload?.error?.message || payload;
    throw error;
  }

  return payload;
}

function normalizePlacesNewPlace(place = {}) {
  const placeId = place.id || String(place.name || '').replace(/^places\//, '') || '';
  const location = place.location
    ? {
        lat: Number(place.location.latitude),
        lng: Number(place.location.longitude)
      }
    : null;

  return {
    place_id: placeId,
    name: place.displayName?.text || '',
    formatted_address: place.formattedAddress || '',
    geometry: {
      location: location && Number.isFinite(location.lat) && Number.isFinite(location.lng) ? location : null
    },
    photos: (place.photos || [])
      .map((photo) => ({
        photo_reference: String(photo.name || '').replace(/\/media$/i, ''),
        author_attributions: (photo.authorAttributions || []).map((attribution) => ({
          displayName: cleanInput(attribution.displayName),
          uri: cleanLargeInput(attribution.uri),
          photoUri: cleanLargeInput(attribution.photoUri)
        })).filter((attribution) => attribution.displayName || attribution.uri)
      }))
      .filter((photo) => photo.photo_reference),
    types: place.types || [],
    url: place.googleMapsUri || null,
    website: place.websiteUri || null,
    formatted_phone_number: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
    international_phone_number: place.internationalPhoneNumber || null,
    business_status: place.businessStatus || null,
    rating: place.rating,
    user_ratings_total: place.userRatingCount
  };
}

function normalizeAutocompleteSuggestion(suggestion = {}) {
  const prediction = suggestion.placePrediction || {};
  const description = prediction.text?.text || '';
  return {
    placeId: prediction.placeId || '',
    description,
    mainText: prediction.structuredFormat?.mainText?.text || description,
    secondaryText: prediction.structuredFormat?.secondaryText?.text || '',
    matchedSubstrings: [],
    types: prediction.types || []
  };
}

function buildSearchCenter(location) {
  const latLng = toLatLng(location);
  if (!latLng) return null;
  return {
    latitude: latLng.lat,
    longitude: latLng.lng
  };
}

function toLatLng(location) {
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function distanceMeters(a, b) {
  const first = toLatLng(a);
  const second = toLatLng(b);
  if (!first || !second) return Number.POSITIVE_INFINITY;

  const toRadians = (degrees) => degrees * Math.PI / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(second.lat - first.lat);
  const dLng = toRadians(second.lng - first.lng);
  const lat1 = toRadians(first.lat);
  const lat2 = toRadians(second.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

function isAddressLikePlace(place = {}) {
  const types = new Set(place.types || []);
  return [...types].some((type) => ADDRESS_LIKE_TYPES.has(type)) &&
    ![...types].some((type) => BUSINESS_LIKE_TYPES.has(type));
}

function hasBusinessLikeType(place = {}) {
  return (place.types || []).some((type) => BUSINESS_LIKE_TYPES.has(type));
}

function hasBusinessData(place = {}) {
  return Boolean(
    place.place_id &&
    (hasBusinessLikeType(place) || place.formatted_phone_number || place.international_phone_number || place.website)
  );
}

function isRouteSafePlaceId(placeId) {
  // Google Directions can reject address descriptor IDs such as Ei... as destinations.
  // Standard POI/business Place IDs normally begin with ChI and are safe for routing.
  return /^ChI/i.test(String(placeId || ''));
}

function scoreBusinessCandidate(candidate = {}, originLocation, metadata = {}) {
  if (!candidate.place_id) return -1000;
  if (isAddressLikePlace(candidate)) return -1000;

  let score = 0;
  const distance = distanceMeters(originLocation, candidate.geometry?.location);
  if (Number.isFinite(distance)) {
    score += Math.max(0, 140 - distance);
  }
  if (hasBusinessLikeType(candidate)) score += 85;
  if (candidate.photos?.length) score += 55;
  if (candidate.formatted_phone_number || candidate.international_phone_number) score += 30;
  if (candidate.website) score += 16;
  if (candidate.business_status === 'OPERATIONAL') score += 14;
  if (candidate.rating) score += Math.min(10, Number(candidate.rating) || 0);

  const labelScore = placeTextMatchScore(metadata.selectedLabel, candidate.name);
  if (hasBusinessSelectionContext(metadata)) {
    if (labelScore < BUSINESS_LABEL_MATCH_MIN_SCORE) return -1000;
    score += labelScore * 3;
  } else if (metadata.selectedLabel) {
    score += labelScore;
  }

  return score;
}

function buildPlacePayload(req, result, fallbackPlaceId = null, metadata = {}) {
  const firstPhoto = result.photos?.[0] || null;
  const placePhotoUrl = buildPhotoUrl(req, firstPhoto?.photo_reference);
  const streetViewUrl = buildStreetViewUrl(req, result.geometry?.location);
  const resolvedPlaceId = result.place_id || fallbackPlaceId || null;

  return {
    placeId: resolvedPlaceId,
    routingPlaceId:
      metadata.routingPlaceId !== undefined
        ? metadata.routingPlaceId
        : isRouteSafePlaceId(result.place_id) ? result.place_id : null,
    routingAddress: metadata.routingAddress || result.formatted_address || null,
    routingLocation: metadata.routingLocation || result.geometry?.location || null,
    name: result.name || result.formatted_address || '',
    formattedAddress: result.formatted_address || '',
    location: result.geometry?.location || null,
    types: result.types || [],
    businessStatus: result.business_status || null,
    rating: Number.isFinite(Number(result.rating)) ? Number(result.rating) : null,
    userRatingsTotal: Number.isFinite(Number(result.user_ratings_total)) ? Number(result.user_ratings_total) : null,
    googleUrl: result.url || null,
    website: result.website || null,
    phoneNumber: result.formatted_phone_number || result.international_phone_number || null,
    internationalPhoneNumber: result.international_phone_number || null,
    photoReference: firstPhoto?.photo_reference || null,
    photoAttributions: firstPhoto?.author_attributions || [],
    placePhotoUrl,
    streetViewUrl,
    photoUrl: placePhotoUrl || streetViewUrl,
    photoSource: placePhotoUrl ? 'place_photo' : streetViewUrl ? 'street_view' : null,
    businessEnrichment: metadata.businessEnrichment || null,
    businessDetails: metadata.businessDetails || null,
    businessCandidates: []
  };
}

function buildBusinessCandidatePayload(req, candidate = {}, originLocation) {
  const photoReference = candidate.photos?.[0]?.photo_reference || null;
  const photoUrl = buildPhotoUrl(req, photoReference);
  const location = candidate.geometry?.location || null;
  const distance = distanceMeters(originLocation, location);

  return {
    placeId: candidate.place_id || null,
    name: candidate.name || '',
    formattedAddress: candidate.formatted_address || candidate.vicinity || '',
    location,
    types: candidate.types || [],
    rating: Number.isFinite(Number(candidate.rating)) ? Number(candidate.rating) : null,
    userRatingsTotal: Number.isFinite(Number(candidate.user_ratings_total)) ? Number(candidate.user_ratings_total) : null,
    photoReference,
    photoUrl,
    photoAttributions: candidate.photos?.[0]?.author_attributions || [],
    photoSource: photoUrl ? 'place_photo' : null,
    businessStatus: candidate.business_status || null,
    distanceMeters: Number.isFinite(distance) ? Math.round(distance) : null,
    searchSource: candidate.searchSource || null
  };
}

async function fetchPlaceDetailsPayload(req, placeId, metadata = {}) {
  const response = await googlePlacesNewRequest(`/places/${encodeURIComponent(placeId)}`, {
    fieldMask: PLACE_DETAILS_FIELD_MASK,
    searchParams: {
      languageCode: 'en'
    },
    timeoutMs: 10000
  });

  return buildPlacePayload(req, normalizePlacesNewPlace(response), placeId, metadata);
}

async function searchNearbyBusinessCandidates(address, location, metadata = {}) {
  const candidatesByPlaceId = new Map();
  const addCandidates = (records = [], source) => {
    for (const record of records.slice(0, BUSINESS_SEARCH_MAX_CANDIDATES)) {
      if (!record.place_id) continue;
      const existing = candidatesByPlaceId.get(record.place_id);
      candidatesByPlaceId.set(record.place_id, {
        ...(existing || {}),
        ...record,
        searchSource: existing?.searchSource || source
      });
    }
  };

  const center = buildSearchCenter(location);
  if (!center) return [];

  const nearbyResponse = await googlePlacesNewRequest('/places:searchNearby', {
    method: 'POST',
    fieldMask: PLACE_SEARCH_FIELD_MASK,
    timeoutMs: 10000,
    body: {
      maxResultCount: PLACES_NEARBY_MAX_RESULTS,
      languageCode: 'en',
      locationRestriction: {
        circle: {
          center,
          radius: BUSINESS_SEARCH_RADIUS_METERS
        }
      }
    }
  });
  addCandidates((nearbyResponse.places || []).map(normalizePlacesNewPlace), 'nearby_search');

  const textQueries = [];
  if (metadata.selectedLabel && metadata.selectedLabel !== address) {
    textQueries.push(`${metadata.selectedLabel} ${address || ''}`.trim());
  }
  if (address) {
    textQueries.push(address);
    if (!hasBusinessSelectionContext(metadata)) {
      textQueries.push(`${address} businesses`);
      textQueries.push(`${address} plaza`);
    }
  }

  for (const query of [...new Set(textQueries)].slice(0, 4)) {
    const textResponse = await googlePlacesNewRequest('/places:searchText', {
      method: 'POST',
      fieldMask: PLACE_SEARCH_FIELD_MASK,
      timeoutMs: 10000,
      body: {
        textQuery: query,
        pageSize: PLACES_TEXT_MAX_RESULTS,
        languageCode: 'en',
        locationBias: {
          circle: {
            center,
            radius: BUSINESS_SEARCH_RADIUS_METERS
          }
        }
      }
    });
    addCandidates((textResponse.places || []).map(normalizePlacesNewPlace), 'text_search');
  }

  return [...candidatesByPlaceId.values()]
    .map((candidate) => ({
      ...candidate,
      labelScore: placeTextMatchScore(metadata.selectedLabel, candidate.name),
      businessScore: scoreBusinessCandidate(candidate, location, metadata)
    }))
    .filter((candidate) => candidate.businessScore > 0)
    .sort((a, b) => b.businessScore - a.businessScore);
}

async function enrichPlaceWithNearbyBusiness(req, place, address, metadata = {}) {
  if (!hasBusinessSelectionContext(metadata)) return place;

  const shouldSearch =
    place?.location &&
    (!place.placePhotoUrl || !place.phoneNumber || isAddressLikePlace({ types: place.types }));

  if (!shouldSearch) return place;

  try {
    const candidates = await searchNearbyBusinessCandidates(address || place.formattedAddress, place.location, metadata);
    const bestCandidate = candidates[0];
    if (!bestCandidate?.place_id || bestCandidate.place_id === place.placeId) return place;

    const candidateDistance = distanceMeters(place.location, bestCandidate.geometry?.location);
    if (!hasBusinessSelectionContext(metadata) && candidateDistance > BUSINESS_FALLBACK_MAX_DISTANCE_METERS) {
      return place;
    }

    const businessPlace = await fetchPlaceDetailsPayload(req, bestCandidate.place_id, {
      businessEnrichment: {
        source: bestCandidate.searchSource || 'nearby_search',
        originalPlaceId: place.placeId,
        originalName: place.name,
        originalAddress: place.formattedAddress,
        selectedLabel: metadata.selectedLabel || null,
        labelScore: Math.round(bestCandidate.labelScore || 0),
        distanceMeters: Math.round(candidateDistance),
        score: Math.round(bestCandidate.businessScore)
      }
    });

    const isUsefulBusinessMatch = hasBusinessData({
      place_id: businessPlace.placeId,
      types: businessPlace.types,
      formatted_phone_number: businessPlace.phoneNumber,
      website: businessPlace.website
    });

    if (!isUsefulBusinessMatch) return place;

    const originalNameLooksLikeAddress =
      normalizePlaceText(place.name) === normalizePlaceText(place.formattedAddress) ||
      normalizePlaceText(place.name) === normalizePlaceText(address);
    const preferBusinessIdentity =
      hasBusinessSelectionContext(metadata) ||
      isAddressLikePlace({ types: place.types }) ||
      originalNameLooksLikeAddress;

    const businessDetails = {
      placeId: businessPlace.placeId,
      name: businessPlace.name,
      formattedAddress: businessPlace.formattedAddress,
      location: businessPlace.location,
      types: businessPlace.types,
      businessStatus: businessPlace.businessStatus,
      rating: businessPlace.rating,
      userRatingsTotal: businessPlace.userRatingsTotal,
      googleUrl: businessPlace.googleUrl,
      website: businessPlace.website,
      phoneNumber: businessPlace.phoneNumber,
      internationalPhoneNumber: businessPlace.internationalPhoneNumber,
      placePhotoUrl: businessPlace.placePhotoUrl,
      streetViewUrl: businessPlace.streetViewUrl,
      photoUrl: businessPlace.photoUrl,
      photoSource: businessPlace.photoSource
    };

    return {
      ...place,
      name: preferBusinessIdentity ? businessPlace.name : place.name || businessPlace.name,
      phoneNumber: place.phoneNumber || businessPlace.phoneNumber,
      internationalPhoneNumber: place.internationalPhoneNumber || businessPlace.internationalPhoneNumber,
      website: place.website || businessPlace.website,
      googleUrl: place.googleUrl || businessPlace.googleUrl,
      businessStatus: place.businessStatus || businessPlace.businessStatus,
      rating: place.rating || businessPlace.rating,
      userRatingsTotal: place.userRatingsTotal || businessPlace.userRatingsTotal,
      placePhotoUrl: preferBusinessIdentity ? businessPlace.placePhotoUrl || place.placePhotoUrl : place.placePhotoUrl || businessPlace.placePhotoUrl,
      photoUrl: preferBusinessIdentity
        ? businessPlace.photoUrl || place.photoUrl
        : place.placePhotoUrl ? place.photoUrl : businessPlace.photoUrl || place.photoUrl,
      photoSource: preferBusinessIdentity
        ? businessPlace.photoSource || place.photoSource
        : place.placePhotoUrl ? place.photoSource : businessPlace.photoSource || place.photoSource,
      businessEnrichment: businessPlace.businessEnrichment,
      businessDetails
    };
  } catch (error) {
    console.warn('business-enrichment warning:', error?.response?.data || error.message);
    return place;
  }
}

async function attachBusinessCandidates(req, place, address) {
  if (!place?.location) return place;

  try {
    const selectedAddress = place.formattedAddress || address;
    const candidates = await searchNearbyBusinessCandidates(address || selectedAddress, place.location, {});
    const businessCandidates = candidates
      .map((candidate) => buildBusinessCandidatePayload(req, candidate, place.location))
      .filter((candidate) => (
        candidate.placeId &&
        candidate.name &&
        candidate.placeId !== place.placeId &&
        isSameStreetAddress(candidate.formattedAddress, selectedAddress)
      ))
      .slice(0, 8);

    if (businessCandidates.length === 1 && isAddressLikePlace({ types: place.types })) {
      const onlyBusiness = await fetchPlaceDetailsPayload(req, businessCandidates[0].placeId, {
        routingPlaceId: businessCandidates[0].placeId,
        routingAddress: place.formattedAddress || selectedAddress,
        routingLocation: place.location,
        businessEnrichment: {
          source: 'single_business_at_address',
          originalPlaceId: place.placeId,
          originalName: place.name,
          originalAddress: place.formattedAddress,
          selectedAddress
        }
      });

      return {
        ...onlyBusiness,
        routingAddress: place.formattedAddress || onlyBusiness.routingAddress || selectedAddress,
        routingLocation: place.location || onlyBusiness.routingLocation,
        businessCandidates: []
      };
    }

    return {
      ...place,
      businessCandidates: businessCandidates.length > 1 ? businessCandidates : []
    };
  } catch (error) {
    console.warn('business-candidates warning:', error?.response?.data || error.message);
    return place;
  }
}

async function geocodePlaceFromAddress(req, address, fallbackPlaceId = null, metadata = {}) {
  const apiKey = requireGoogleMapsApiKey();
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', address);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('region', 'us');
  url.searchParams.set('language', 'en');

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  const status = data.status;
  if (status !== 'OK') {
    const error = new Error('Geocoding request failed');
    error.googleStatus = status;
    error.googleDetail = data.error_message || null;
    throw error;
  }

  const result = data.results?.[0] || {};
  const place = buildPlacePayload(req, result, null, {
    routingPlaceId: isRouteSafePlaceId(result.place_id) ? result.place_id : null,
    routingAddress: result.formatted_address || address,
    routingLocation: result.geometry?.location || null,
    businessEnrichment: {
      source: 'geocode',
      rejectedFallbackPlaceId: fallbackPlaceId,
      originalAddress: address
    },
    ...metadata
  });
  const enrichedPlace = await enrichPlaceWithNearbyBusiness(req, place, address, metadata);
  return attachBusinessCandidates(req, enrichedPlace, address);
}

router.get('/autocomplete', async (req, res) => {
  try {
    const input = cleanInput(req.query.input);
    const sessiontoken = cleanInput(req.query.sessiontoken);

    if (input.length < AUTOCOMPLETE_MIN_CHARS) {
      return res.json({ predictions: [] });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not set on server' });
    }

    const response = await googlePlacesNewRequest('/places:autocomplete', {
      method: 'POST',
      fieldMask: AUTOCOMPLETE_FIELD_MASK,
      timeoutMs: 10000,
      body: {
        input,
        languageCode: 'en',
        includedRegionCodes: ['us'],
        ...(sessiontoken ? { sessionToken: sessiontoken } : {})
      }
    });

    const predictions = (response.suggestions || [])
      .map(normalizeAutocompleteSuggestion)
      .filter((prediction) => prediction.placeId && prediction.description);

    return res.json({ predictions });
  } catch (err) {
    console.error('places-autocomplete error:', err?.response?.data || err.message);
    return res.status(500).json({
      error: 'Error fetching address suggestions',
      detail: err?.response?.data || err.message
    });
  }
});

router.get('/details', async (req, res) => {
  try {
    const placeId = cleanInput(req.query.placeId);
    const address = cleanLongInput(req.query.address);
    const selectedLabel = cleanInput(req.query.label);
    const selectedTypes = parseTypes(req.query.types);
    const metadata = {
      selectedLabel,
      selectedTypes
    };

    if (!placeId && !address) {
      return res.status(400).json({ error: 'placeId or address is required' });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not set on server' });
    }

    if (!placeId) {
      const place = await geocodePlaceFromAddress(req, address, null, metadata);
      return res.json({ place });
    }

    try {
      try {
        const place = await fetchPlaceDetailsPayload(req, placeId, metadata);
        const enrichedPlace = await enrichPlaceWithNearbyBusiness(req, place, address, metadata);
        const placeWithCandidates = await attachBusinessCandidates(req, enrichedPlace, address);
        return res.json({ place: placeWithCandidates });
      } catch (detailsError) {
        if (detailsError.googleStatus && detailsError.googleStatus !== 'OK') {
          if (address) {
            const place = await geocodePlaceFromAddress(req, address, placeId, metadata);
            return res.json({ place });
          }

          return res.status(502).json({
            error: 'Place details request failed',
            status: detailsError.googleStatus,
            detail: detailsError.googleDetail
          });
        }

        throw detailsError;
      }
    } catch (placeDetailsError) {
      if (address) {
        const place = await geocodePlaceFromAddress(req, address, placeId, metadata);
        return res.json({ place });
      }

      throw placeDetailsError;
    }
  } catch (err) {
    console.error('place-details error:', err?.response?.data || err.message);
    return res.status(500).json({
      error: 'Error fetching place details',
      detail: err?.response?.data || err.message
    });
  }
});

router.get('/street-view', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const size = cleanInput(req.query.size) || '640x360';

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng are required' });
    }

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY not set on server' });
    }

    const url = new URL('https://maps.googleapis.com/maps/api/streetview');
    url.searchParams.set('size', size);
    url.searchParams.set('location', `${lat},${lng}`);
    url.searchParams.set('fov', '80');
    url.searchParams.set('pitch', '0');
    url.searchParams.set('source', 'outdoor');
    url.searchParams.set('key', process.env.GOOGLE_MAPS_API_KEY);

    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({
        error: 'Street View image request failed',
        status: response.status,
        detail
      });
    }

    const body = Buffer.from(await response.arrayBuffer());
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'private, no-store, max-age=0');
    return res.send(body);
  } catch (err) {
    console.error('street-view error:', err?.response?.data || err.message);
    return res.status(500).json({
      error: 'Error fetching Street View destination image',
      detail: err?.response?.data || err.message
    });
  }
});

router.get('/street-view-embed', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const title = cleanInput(req.query.title) || 'Destination';
    const embedKey = process.env.GOOGLE_MAPS_EMBED_API_KEY;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).send('lat and lng are required');
    }

    if (!embedKey) {
      return res.status(500).send('GOOGLE_MAPS_EMBED_API_KEY is required for 360 Street View embeds');
    }

    const embedUrl = new URL('https://www.google.com/maps/embed/v1/streetview');
    embedUrl.searchParams.set('key', embedKey);
    embedUrl.searchParams.set('location', `${lat},${lng}`);
    embedUrl.searchParams.set('fov', '80');
    embedUrl.searchParams.set('pitch', '0');

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'private, no-store, max-age=0');
    return res.send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
    <title>${escapeHtml(title)} Street View</title>
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: #050b12;
      }
      iframe {
        width: 100%;
        height: 100%;
        border: 0;
        display: block;
        background: #050b12;
      }
    </style>
  </head>
  <body>
    <iframe
      title="${escapeHtml(title)} Street View"
      src="${escapeHtml(embedUrl.toString())}"
      allowfullscreen
      referrerpolicy="no-referrer-when-downgrade">
    </iframe>
  </body>
</html>`);
  } catch (err) {
    console.error('street-view-embed error:', err?.response?.data || err.message);
    return res.status(500).send('Error loading Street View');
  }
});

router.get('/photo', async (req, res) => {
  try {
    const photoReference = cleanLargeInput(req.query.ref);
    const maxWidth = Math.min(Math.max(Number(req.query.maxwidth) || 640, 160), 1000);

    if (!photoReference) {
      return res.status(400).json({ error: 'photo reference is required' });
    }

    const apiKey = requireGoogleMapsApiKey();
    const normalizedPhotoReference = photoReference.replace(/\/media$/i, '');
    if (!normalizedPhotoReference.startsWith('places/')) {
      return res.status(400).json({
        error: 'Unsupported photo reference',
        detail: 'This backend now uses Places API (New) photo resource names.'
      });
    }

    const url = new URL(`${PLACES_NEW_BASE_URL}/${normalizedPhotoReference}/media`);
    url.searchParams.set('maxWidthPx', String(maxWidth));
    url.searchParams.set('key', apiKey);

    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({
        error: 'Place photo request failed',
        status: response.status,
        detail
      });
    }

    const body = Buffer.from(await response.arrayBuffer());
    res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    res.set('Cache-Control', 'private, no-store, max-age=0');
    return res.send(body);
  } catch (err) {
    console.error('place-photo error:', err?.response?.data || err.message);
    return res.status(500).json({
      error: 'Error fetching place photo',
      detail: err?.response?.data || err.message
    });
  }
});

router.get('/recent-destinations', async (req, res) => {
  return res.json({ destinations: await listRecentDestinations() });
});

router.post('/recent-destinations', express.json(), async (req, res) => {
  const destination = {
    placeId: cleanInput(req.body?.placeId),
    description: cleanLongInput(req.body?.description),
    savedAt: new Date().toISOString()
  };

  if (!destination.description) {
    return res.status(400).json({ error: 'description is required' });
  }

  const nextRecords = await saveRecentDestination(destination);

  return res.json({ destinations: nextRecords });
});

module.exports = router;
