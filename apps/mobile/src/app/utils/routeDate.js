export function getLocalRouteDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToRouteDate(routeDate, days) {
  const parts = String(routeDate || '').split('-').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return getLocalRouteDate();
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2] + days);
  return getLocalRouteDate(date);
}

export function getAssignedRouteLookupDates(date = new Date()) {
  const localRouteDate = typeof date === 'string' ? date : getLocalRouteDate(date);
  return [localRouteDate];
}
