export const DEFAULT_TRUCK_PROFILE = {
  heightFt: '13.6',
  weightLb: '80000',
  lengthFt: '53',
  hazmat: false,
};

export const AUTOCOMPLETE_MIN_CHARS = 2;
export const AUTOCOMPLETE_DEBOUNCE_MS = 180;
export const AUTOCOMPLETE_MAX_RESULTS = 6;

export function toPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function createAutocompleteSessionToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function predictionTypeLabel(types = []) {
  if (types.includes('street_address') || types.includes('premise')) return 'Address';
  if (types.includes('route')) return 'Street';
  if (types.includes('locality')) return 'City';
  if (types.includes('postal_code')) return 'ZIP';
  return 'Place';
}

export function buildTruckProfilePayload(truckProfile = DEFAULT_TRUCK_PROFILE) {
  return {
    height_ft: toPositiveNumber(
      truckProfile.heightFt,
      Number(DEFAULT_TRUCK_PROFILE.heightFt)
    ),
    weight_lb: toPositiveNumber(
      truckProfile.weightLb,
      Number(DEFAULT_TRUCK_PROFILE.weightLb)
    ),
    length_ft: toPositiveNumber(
      truckProfile.lengthFt,
      Number(DEFAULT_TRUCK_PROFILE.lengthFt)
    ),
    hazmat: truckProfile.hazmat,
  };
}

export function buildDestinationStreetViewPanoramaUrl(destinationDetails) {
  const location = destinationDetails?.location;
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}
