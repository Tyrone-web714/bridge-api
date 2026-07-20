function cleanValue(value) {
  const cleaned = value === null || value === undefined ? '' : String(value).trim();
  return cleaned || null;
}

function pickValue(...values) {
  for (const value of values) {
    const cleaned = cleanValue(value);
    if (cleaned) return cleaned;
  }
  return null;
}

export function buildDeliveryNotesParams(input = {}) {
  const destinationDetails = input.destinationDetails || {};
  const destinationAddress = pickValue(
    input.destinationAddress,
    input.destination,
    destinationDetails.formattedAddress,
    destinationDetails.secondaryText
  );
  const accountNumber = pickValue(input.accountNumber, input.accountId, destinationDetails.accountNumber);
  const accountName = pickValue(input.accountName, destinationDetails.accountName, destinationDetails.name);
  const destinationPlaceId = pickValue(input.destinationPlaceId, input.placeId, destinationDetails.placeId);
  const routeManifestId = pickValue(
    input.routeManifestId,
    input.manifestId,
    destinationDetails.routeManifestId,
    destinationDetails.manifestId
  );
  const routeStopId = pickValue(input.routeStopId, input.stopId, destinationDetails.routeStopId, destinationDetails.stopId);
  const routeDate = pickValue(input.routeDate, input.routeManifestDate, destinationDetails.routeDate);
  const routeNumber = pickValue(input.routeNumber, destinationDetails.routeNumber);
  const driverId = pickValue(input.driverId, destinationDetails.routeManifestDriverId);
  const driverName = pickValue(input.driverName, destinationDetails.routeManifestDriverName);
  const source = pickValue(input.source, 'unknown');
  const returnRoute = pickValue(input.returnRoute);

  return {
    deliveryNotesContractVersion: 1,
    source,
    returnRoute,
    returnParams: input.returnParams || null,
    destinationAddress,
    destinationPlaceId,
    accountNumber,
    accountId: accountNumber,
    accountName,
    driverId,
    driverName,
    routeManifestId,
    manifestId: routeManifestId,
    routeStopId,
    stopId: routeStopId,
    routeDate,
    routeNumber,
    destinationDetails: {
      ...destinationDetails,
      ...(destinationAddress ? { formattedAddress: destinationAddress, secondaryText: destinationAddress } : {}),
      ...(destinationPlaceId ? { placeId: destinationPlaceId } : {}),
      ...(accountNumber ? { accountNumber } : {}),
      ...(accountName ? { accountName, name: destinationDetails.name || accountName } : {}),
      ...(routeManifestId ? { routeManifestId } : {}),
      ...(routeStopId ? { routeStopId } : {}),
      ...(routeDate ? { routeDate } : {}),
      ...(routeNumber ? { routeNumber } : {}),
      ...(driverId ? { routeManifestDriverId: driverId } : {}),
      ...(driverName ? { routeManifestDriverName: driverName } : {}),
    },
  };
}

export function validateDeliveryNotesParams(params = {}) {
  const errors = [];
  if (!params.accountNumber && !params.destinationPlaceId) {
    errors.push('Delivery Notes requires an account number or place ID.');
  }
  if (params.source !== 'destination-search' && params.source !== 'account-knowledge' && !params.routeStopId) {
    errors.push('Route Delivery Notes requires a stop ID.');
  }
  if (params.routeStopId && !params.routeManifestId) {
    errors.push('Route Delivery Notes requires a manifest ID with the stop ID.');
  }
  if (!params.returnRoute) {
    errors.push('Delivery Notes requires an explicit return route.');
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function openDeliveryNotes(navigation, input = {}) {
  const params = buildDeliveryNotesParams(input);
  navigation?.navigate?.('DeliveryNotes', params);
  return params;
}

export function returnFromDeliveryNotes(navigation, params = {}) {
  const returnRoute = cleanValue(params.returnRoute);
  if (returnRoute) {
    navigation?.navigate?.(returnRoute, params.returnParams || {});
    return true;
  }
  if (navigation?.canGoBack?.()) {
    navigation.goBack();
    return true;
  }
  return false;
}
