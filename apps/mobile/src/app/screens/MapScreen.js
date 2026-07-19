import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE_URL, DRIVER_ID, DRIVER_NAME } from '../config/api';
import AccountKnowledgePanel from '../components/AccountKnowledgePanel';
import VehicleLayer from '../components/VehicleLayer';
import {
  fetchHazardsInBounds,
  fetchHazardsNearCoordinate,
  recordRouteEvent,
  requestSafeRoute,
  submitDriverHazardReport,
} from '../services/routingApi';
import { updateAssignedRouteStopStatus } from '../services/routeManifestApi';

const TEST_COORDINATE = {
  latitude: 29.4241,
  longitude: -98.4936,
};
const INFO_CARD_AUTO_COLLAPSE_MS = 6500;
const COMPANY_SPEED_LIMIT_MPH = 65;
const SPEED_APPROACHING_LIMIT_MPH = 60;
const SPEED_OVER_LIMIT_TRIGGER_MPH = 66;
const METERS_PER_SECOND_TO_MPH = 2.236936;
const OFF_ROUTE_WARNING_THRESHOLD_METERS = 55;
const OFF_ROUTE_RESET_THRESHOLD_METERS = 35;
const OFF_ROUTE_REROUTE_CONFIRM_MS = 2500;
const OFF_ROUTE_REROUTE_COOLDOWN_MS = 15000;
const OFF_ROUTE_MANUAL_REROUTE_THRESHOLD_METERS = 60;
const ARRIVAL_DISTANCE_METERS = 80;
const TURN_PROMPT_FAR_METERS = 1609;
const TURN_PROMPT_NEAR_METERS = 160;
const DIRECTIONS_ROW_HEIGHT = 116;
const DIRECTIONS_PRIMARY_ROW_HEIGHT = 132;
const LOCATION_DISTANCE_INTERVAL_METERS = 1;
const LOCATION_TIME_INTERVAL_MS = 500;
const GPS_TRACE_INTERVAL_MS = 15000;
const GPS_TRACE_MIN_DISTANCE_METERS = 10;
const INITIAL_LOCATION_TIMEOUT_MS = 3500;
const LAST_KNOWN_LOCATION_MAX_AGE_MS = 120000;
const LAST_KNOWN_LOCATION_REQUIRED_ACCURACY_METERS = 250;
const MOTION_STATE_MIN_INTERVAL_MS = 750;
const MOTION_POSITION_MIN_METERS = 1.8;
const MOTION_HEADING_MIN_DEGREES = 2.5;
const MOTION_SPEED_MIN_MPH = 1;
const MOTION_DEVIATION_MIN_METERS = 5;
const MPH_TO_METERS_PER_SECOND = 0.44704;
const MOTION_PREDICTION_SECONDS = 0.45;
const HEADING_SMOOTHING_ALPHA = 0.32;
const MAX_REASONABLE_TRUCK_SPEED_MPH = 95;
const IDLE_SPEED_FLOOR_MPH = 2.5;
const SPEED_STALE_MS = 2500;
const SPEED_DECAY_INTERVAL_MS = 1000;
const SPEED_ALERT_CONFIRM_MS = 1800;
const VISIBLE_HAZARD_FETCH_MIN_MS = 1400;
const VISIBLE_HAZARD_LIMIT_PER_TYPE = 140;
const LIVE_HAZARD_SCAN_RADIUS_METERS = 1000;
const LIVE_HAZARD_SCAN_MIN_MS = 4500;
const LIVE_HAZARD_SCAN_MIN_MOVE_METERS = 90;
const LIVE_LOW_BRIDGE_CRITICAL_METERS = 300;
const LIVE_HAZARD_ALERT_COOLDOWN_MS = 90000;
const NAV_CAMERA_LOOKAHEAD_MIN_METERS = 22;
const NAV_CAMERA_LOOKAHEAD_MAX_METERS = 58;
const ROUTE_HEADING_LOOKAHEAD_MIN_METERS = 28;
const ROUTE_HEADING_LOOKAHEAD_MAX_METERS = 60;
const NAV_CAMERA_ZOOM = 19.4;
const NAV_CAMERA_PITCH = 67.5;
const FOLLOW_CAMERA_ANIMATION_MS = 650;
const FOLLOW_CAMERA_MIN_INTERVAL_MS = 450;
const FOLLOW_CAMERA_MIN_MOVE_METERS = 1.8;
const FOLLOW_CAMERA_MIN_HEADING_DEGREES = 1.5;
const FOLLOW_CAMERA_MIN_ANIMATION_MS = 450;
const FOLLOW_CAMERA_MAX_ANIMATION_MS = 950;
const ROUTE_PROJECTION_BACKTRACK_SEGMENTS = 6;
const ROUTE_PROJECTION_LOOKAHEAD_SEGMENTS = 90;
const ROUTE_PROJECTION_GLOBAL_FALLBACK_METERS = 80;
const ROUTE_HAZARD_FAR_ALERT_METERS = 1609;
const ROUTE_HAZARD_NEAR_ALERT_METERS = 402;
const AUTO_REFOLLOW_AFTER_PAN_MS = 6000;
const MOVING_REFOLLOW_SPEED_MPH = 5;
const ACTIVE_ROUTE_SHADOW_COLOR = '#063241';
const ACTIVE_ROUTE_CASING_COLOR = '#78f7ff';
const ACTIVE_ROUTE_MAIN_COLOR = '#00d7e8';
const ACTIVE_ROUTE_HIGHLIGHT_COLOR = '#a7ffff';
const ALTERNATE_ROUTE_COLOR = '#6f7f8f';
const ALTERNATE_ROUTE_SHADOW_COLOR = '#243242';
const ACTIVE_ROUTE_LANE_OFFSET_METERS = 3.8;
const ACTIVE_ROUTE_CORNER_SMOOTHING_PASSES = 2;
const ROUTE_CONNECTOR_DOT_PATTERN = [1, 13];
const ROUTE_CONNECTOR_SHADOW_COLOR = 'rgba(0, 0, 0, 0.45)';
const ROUTE_CONNECTOR_DOT_COLOR = '#ffffff';
const ROUTE_CONNECTOR_FRONT_OFFSET_METERS = 15;
const ROUTE_CONNECTOR_TARGET_AHEAD_METERS = 34;
const ROUTE_CONNECTOR_CURVE_SEGMENTS = 18;
const REPORT_HAZARD_TYPES = [
  { key: 'low_bridge', label: 'Low Bridge' },
  { key: 'no_truck', label: 'No Truck' },
  { key: 'residential', label: 'Residential' },
];
const NAVIGATION_LOCATION_ACCURACY =
  Location.Accuracy.BestForNavigation ?? Location.Accuracy.Highest ?? Location.Accuracy.High;
const VOICE_ALERTS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_VOICE_ALERTS === 'true';
const VOICE_ON_ICON = require('../../assets/voice-on-speaker.png');
const VOICE_OFF_ICON = require('../../assets/voice-off-speaker.png');

function decodePolyline(encoded) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte = null;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return coordinates;
}

function formatDistance(meters) {
  if (!Number.isFinite(meters)) return 'Distance unavailable';
  return `${(meters / 1609.344).toFixed(1)} mi`;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return 'Duration unavailable';

  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (!hours) return `${remainingMinutes} min`;
  if (!remainingMinutes) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

function formatEtaClock(secondsFromNow) {
  if (!Number.isFinite(secondsFromNow)) return '--';

  const arrival = new Date(Date.now() + Math.max(0, secondsFromNow) * 1000);
  return arrival.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatClock(date) {
  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getHeadingLabel(heading) {
  const normalized = normalizeHeadingDegrees(heading) ?? 0;
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(normalized / 45) % labels.length;
  return labels[index];
}

function formatMeters(meters) {
  const parsed = Number(meters);
  if (!Number.isFinite(parsed)) return 'Distance unavailable';
  if (parsed < 1609.344) return `${Math.round(parsed)} m from route`;
  return `${(parsed / 1609.344).toFixed(1)} mi from route`;
}

function formatHazardDistance(meters) {
  const parsed = Number(meters);
  if (!Number.isFinite(parsed)) return 'nearby';
  if (parsed < 305) return `${Math.max(50, Math.round(parsed * 3.28084 / 50) * 50)} feet`;
  return `${(parsed / 1609.344).toFixed(1)} miles`;
}

function formatInstructionDistance(meters) {
  const parsed = Number(meters);
  if (!Number.isFinite(parsed)) return '';
  if (parsed < 304.8) return `${Math.max(50, Math.round(parsed * 3.28084 / 50) * 50)} ft`;
  if (parsed < 1609.344) return `${(parsed / 1609.344).toFixed(1)} mi`;
  return `${(parsed / 1609.344).toFixed(1)} mi`;
}

function getManeuverSymbol(maneuver = '') {
  const value = String(maneuver || '').toLowerCase();
  if (value.includes('uturn')) return '↺';
  if (value.includes('merge')) return '⤴';
  if (value.includes('ramp') || value.includes('exit')) return '↗';
  if (value.includes('left')) return '↰';
  if (value.includes('right')) return '↱';
  if (value.includes('straight') || value.includes('continue') || value.includes('head')) return '↑';
  return '↑';
}

function getDirectionsRowOffset(index) {
  if (index <= 0) return 0;
  return DIRECTIONS_PRIMARY_ROW_HEIGHT + (index - 1) * DIRECTIONS_ROW_HEIGHT;
}

function metersPerSecondToMph(speedMetersPerSecond) {
  const parsed = Number(speedMetersPerSecond);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed * METERS_PER_SECOND_TO_MPH
    : null;
}

function withTimeout(promise, timeoutMs) {
  let timer = null;

  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  return Promise.race([
    promise
      .then((value) => value)
      .catch(() => null),
    timeout,
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function getInitialNavigationPosition() {
  const lastKnownPosition = await Location.getLastKnownPositionAsync({
    maxAge: LAST_KNOWN_LOCATION_MAX_AGE_MS,
    requiredAccuracy: LAST_KNOWN_LOCATION_REQUIRED_ACCURACY_METERS,
  }).catch(() => null);

  if (lastKnownPosition?.coords) {
    return {
      position: lastKnownPosition,
      source: 'lastKnown',
    };
  }

  const freshPosition = await withTimeout(
    Location.getCurrentPositionAsync({
      accuracy: NAVIGATION_LOCATION_ACCURACY,
    }),
    INITIAL_LOCATION_TIMEOUT_MS
  );

  if (freshPosition?.coords) {
    return {
      position: freshPosition,
      source: 'fresh',
    };
  }

  return null;
}

function isReasonableTruckSpeed(speedMph) {
  return Number.isFinite(speedMph) && speedMph >= 0 && speedMph <= MAX_REASONABLE_TRUCK_SPEED_MPH;
}

function coordinatesAreNear(a, b, toleranceMeters = MOTION_POSITION_MIN_METERS) {
  if (!a || !b) return false;
  return haversineMeters(a, b) < toleranceMeters;
}

function hasMeaningfulHeadingChange(previousHeading, nextHeading, thresholdDegrees = MOTION_HEADING_MIN_DEGREES) {
  if (!Number.isFinite(previousHeading) || !Number.isFinite(nextHeading)) return true;
  return Math.abs(getShortestHeadingDelta(previousHeading, nextHeading)) >= thresholdDegrees;
}

function calculateLocationSpeedMph(
  position,
  coordinate,
  previousSample,
  routePoints = []
) {
  const reportedSpeedMph = metersPerSecondToMph(position?.coords?.speed);
  const timestamp = Number(position?.timestamp) || Date.now();
  const routeRemainingMeters = getRemainingRouteDistanceMeters(coordinate, routePoints);
  const horizontalAccuracyMeters = Math.max(0, Number(position?.coords?.accuracy) || 0);

  if (!previousSample?.coordinate || !Number.isFinite(previousSample.timestamp)) {
    return {
      speedMph: isReasonableTruckSpeed(reportedSpeedMph) && reportedSpeedMph >= IDLE_SPEED_FLOOR_MPH
        ? reportedSpeedMph
        : 0,
      sample: { coordinate, timestamp, routeRemainingMeters },
    };
  }

  const elapsedSeconds = (timestamp - previousSample.timestamp) / 1000;
  const movedMeters = haversineMeters(previousSample.coordinate, coordinate);
  const minimumReliableMovementMeters = Math.max(2.5, horizontalAccuracyMeters * 0.35);
  const derivedSpeedMph =
    elapsedSeconds > 0.35 &&
    elapsedSeconds < 20 &&
    movedMeters >= minimumReliableMovementMeters
      ? (movedMeters / elapsedSeconds) * METERS_PER_SECOND_TO_MPH
      : null;
  let speedMph = isReasonableTruckSpeed(reportedSpeedMph)
    ? reportedSpeedMph
    : derivedSpeedMph;

  if (
    isReasonableTruckSpeed(speedMph) &&
    speedMph < IDLE_SPEED_FLOOR_MPH &&
    movedMeters < minimumReliableMovementMeters
  ) {
    speedMph = 0;
  }

  return {
    speedMph,
    sample: { coordinate, timestamp, routeRemainingMeters },
  };
}

function smoothSpeedMph(nextSpeedMph, previousSpeedMph) {
  if (!Number.isFinite(nextSpeedMph)) {
    if (!Number.isFinite(previousSpeedMph)) return null;
    const decayedSpeed = previousSpeedMph * 0.72;
    return decayedSpeed < IDLE_SPEED_FLOOR_MPH ? 0 : decayedSpeed;
  }

  if (nextSpeedMph < IDLE_SPEED_FLOOR_MPH && (!Number.isFinite(previousSpeedMph) || previousSpeedMph < 8)) {
    return 0;
  }

  if (!Number.isFinite(previousSpeedMph)) {
    return nextSpeedMph < IDLE_SPEED_FLOOR_MPH ? 0 : nextSpeedMph;
  }

  if (Math.abs(nextSpeedMph - previousSpeedMph) > 35) {
    return previousSpeedMph * 0.35 + nextSpeedMph * 0.65;
  }

  const alpha = nextSpeedMph >= previousSpeedMph ? 0.62 : 0.38;
  const smoothedSpeed = previousSpeedMph * (1 - alpha) + nextSpeedMph * alpha;
  return smoothedSpeed < IDLE_SPEED_FLOOR_MPH ? 0 : smoothedSpeed;
}

function formatSpeedMph(speedMph) {
  return Number.isFinite(speedMph) ? Math.round(speedMph).toString() : '--';
}

function formatFeet(value, fallback = 'Unknown') {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(1)} ft` : fallback;
}

function haversineMeters(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(x));
}

function bearingDegrees(from, to) {
  if (!from || !to) return 0;

  const toRad = (value) => (value * Math.PI) / 180;
  const toDeg = (value) => (value * 180) / Math.PI;
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function getNearestRouteDistanceMeters(point, routePoints) {
  if (!point || !routePoints.length) return null;

  return routePoints.reduce((nearest, routePoint) => {
    const distance = haversineMeters(point, routePoint);
    return Math.min(nearest, distance);
  }, Infinity);
}

function getNearestRoutePointIndex(point, routePoints) {
  if (!point || !routePoints.length) return -1;

  let nearestIndex = 0;
  let nearestDistance = Infinity;

  routePoints.forEach((routePoint, index) => {
    const distance = haversineMeters(point, routePoint);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function getNearestRouteProjection(point, routePoints, options = {}) {
  if (!point || !Array.isArray(routePoints) || !routePoints.length) return null;
  if (routePoints.length === 1) {
    return {
      coordinate: routePoints[0],
      distanceMeters: haversineMeters(point, routePoints[0]),
      heading: 0,
      segmentIndex: 0,
    };
  }

  const hintedSegmentIndex = Number.isInteger(options.hintSegmentIndex)
    ? clamp(options.hintSegmentIndex, 0, routePoints.length - 2)
    : null;
  const startIndex = hintedSegmentIndex == null
    ? 0
    : Math.max(0, hintedSegmentIndex - ROUTE_PROJECTION_BACKTRACK_SEGMENTS);
  const endIndex = hintedSegmentIndex == null
    ? routePoints.length - 2
    : Math.min(
        routePoints.length - 2,
        hintedSegmentIndex + ROUTE_PROJECTION_LOOKAHEAD_SEGMENTS
      );
  let nearestProjection = null;

  for (let index = startIndex; index <= endIndex; index += 1) {
    const start = routePoints[index];
    const end = routePoints[index + 1];
    const referenceLat = ((start.latitude + end.latitude + point.latitude) / 3) * Math.PI / 180;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(referenceLat);
    const startX = start.longitude * metersPerDegreeLng;
    const startY = start.latitude * metersPerDegreeLat;
    const endX = end.longitude * metersPerDegreeLng;
    const endY = end.latitude * metersPerDegreeLat;
    const pointX = point.longitude * metersPerDegreeLng;
    const pointY = point.latitude * metersPerDegreeLat;
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
    if (segmentLengthSquared <= 0) continue;

    const progress = clamp(
      ((pointX - startX) * segmentX + (pointY - startY) * segmentY) / segmentLengthSquared,
      0,
      1
    );
    const projectedX = startX + segmentX * progress;
    const projectedY = startY + segmentY * progress;
    const coordinate = {
      latitude: projectedY / metersPerDegreeLat,
      longitude: projectedX / metersPerDegreeLng,
    };
    const distanceMeters = haversineMeters(point, coordinate);

    if (!nearestProjection || distanceMeters < nearestProjection.distanceMeters) {
      nearestProjection = {
        coordinate,
        distanceMeters,
        heading: bearingDegrees(start, end),
        segmentIndex: index,
        segmentProgress: progress,
      };
    }
  }

  if (
    hintedSegmentIndex != null &&
    nearestProjection?.distanceMeters > ROUTE_PROJECTION_GLOBAL_FALLBACK_METERS &&
    options.allowGlobalFallback !== false
  ) {
    return getNearestRouteProjection(point, routePoints);
  }

  return nearestProjection;
}

function getRouteHeading(point, routePoints) {
  if (!point || !routePoints.length) return 0;

  const nearestIndex = getNearestRoutePointIndex(point, routePoints);
  if (nearestIndex < 0) return 0;

  const lookAheadIndex = Math.min(routePoints.length - 1, nearestIndex + 8);
  if (lookAheadIndex === nearestIndex && nearestIndex > 0) {
    return bearingDegrees(routePoints[nearestIndex - 1], routePoints[nearestIndex]);
  }

  const startPoint = routePoints[nearestIndex];
  const targetPoint = routePoints[lookAheadIndex] || startPoint;

  return bearingDegrees(startPoint, targetPoint);
}

function getRouteLengthMeters(routePoints) {
  if (!Array.isArray(routePoints) || routePoints.length < 2) return 0;

  let total = 0;
  for (let index = 1; index < routePoints.length; index += 1) {
    total += haversineMeters(routePoints[index - 1], routePoints[index]);
  }

  return total;
}

function getRoutePointVisualHeading(routePoints, index) {
  const current = routePoints?.[index];
  if (!current) return 0;

  const previous = routePoints[index - 1];
  const next = routePoints[index + 1];

  if (!previous && next) return bearingDegrees(current, next);
  if (previous && !next) return bearingDegrees(previous, current);
  if (previous && next) {
    const incoming = bearingDegrees(previous, current);
    const outgoing = bearingDegrees(current, next);
    const averaged = normalizeHeadingDegrees(
      incoming + getShortestHeadingDelta(incoming, outgoing) * 0.5
    );
    return averaged ?? outgoing;
  }

  return 0;
}

function offsetRouteToRightTravelLane(routePoints, offsetMeters = ACTIVE_ROUTE_LANE_OFFSET_METERS) {
  if (!Array.isArray(routePoints) || routePoints.length < 2) return routePoints || [];

  return routePoints.map((point, index) =>
    projectCoordinate(point, getRoutePointVisualHeading(routePoints, index) + 90, offsetMeters)
  );
}

function chaikinSmoothRoute(routePoints, passes = ACTIVE_ROUTE_CORNER_SMOOTHING_PASSES) {
  if (!Array.isArray(routePoints) || routePoints.length < 3) return routePoints || [];

  let smoothed = routePoints;
  const actualPasses = smoothed.length > 450 ? 1 : passes;

  for (let pass = 0; pass < actualPasses; pass += 1) {
    const next = [smoothed[0]];

    for (let index = 0; index < smoothed.length - 1; index += 1) {
      const current = smoothed[index];
      const following = smoothed[index + 1];

      next.push({
        latitude: current.latitude * 0.78 + following.latitude * 0.22,
        longitude: current.longitude * 0.78 + following.longitude * 0.22,
      });
      next.push({
        latitude: current.latitude * 0.22 + following.latitude * 0.78,
        longitude: current.longitude * 0.22 + following.longitude * 0.78,
      });
    }

    next.push(smoothed[smoothed.length - 1]);
    smoothed = next;
  }

  return smoothed;
}

function buildDisplayedRouteCoordinates(routePoints) {
  return chaikinSmoothRoute(offsetRouteToRightTravelLane(routePoints));
}

function buildDisplayedTruckCoordinate(routeCoordinate, routeHeading, routeDeviationMeters) {
  if (!routeCoordinate) return null;
  if (
    Number.isFinite(routeDeviationMeters) &&
    routeDeviationMeters > OFF_ROUTE_WARNING_THRESHOLD_METERS
  ) {
    return routeCoordinate;
  }

  return projectCoordinate(routeCoordinate, routeHeading + 90, ACTIVE_ROUTE_LANE_OFFSET_METERS);
}

function getCoordinateAheadFromRouteProjection(projection, routePoints, aheadMeters) {
  if (
    !projection?.coordinate ||
    !Array.isArray(routePoints) ||
    routePoints.length < 2 ||
    !Number.isFinite(aheadMeters)
  ) {
    return null;
  }

  let remainingMeters = Math.max(0, aheadMeters);
  let currentCoordinate = projection.coordinate;
  let segmentIndex = Math.max(0, Number(projection.segmentIndex) || 0);

  while (segmentIndex < routePoints.length - 1) {
    const segmentEnd = routePoints[segmentIndex + 1];
    const segmentDistanceMeters = haversineMeters(currentCoordinate, segmentEnd);

    if (remainingMeters <= segmentDistanceMeters) {
      return projectCoordinate(
        currentCoordinate,
        bearingDegrees(currentCoordinate, segmentEnd),
        remainingMeters
      );
    }

    remainingMeters -= segmentDistanceMeters;
    currentCoordinate = segmentEnd;
    segmentIndex += 1;
  }

  return routePoints[routePoints.length - 1] || null;
}

function getRouteHeadingLookaheadMeters(speedMph) {
  const speed = Number(speedMph);
  if (!Number.isFinite(speed) || speed <= IDLE_SPEED_FLOOR_MPH) {
    return ROUTE_HEADING_LOOKAHEAD_MIN_METERS;
  }

  return clamp(
    ROUTE_HEADING_LOOKAHEAD_MIN_METERS + speed * 0.7,
    ROUTE_HEADING_LOOKAHEAD_MIN_METERS,
    ROUTE_HEADING_LOOKAHEAD_MAX_METERS
  );
}

function getRouteHeadingFromProjection(
  projection,
  routePoints,
  fallbackHeading = 0,
  lookaheadMeters = ROUTE_HEADING_LOOKAHEAD_MIN_METERS
) {
  if (!projection?.coordinate) {
    return Number.isFinite(fallbackHeading) ? fallbackHeading : 0;
  }

  const aheadCoordinate = getCoordinateAheadFromRouteProjection(
    projection,
    routePoints,
    lookaheadMeters
  );

  if (
    aheadCoordinate &&
    haversineMeters(projection.coordinate, aheadCoordinate) >= 3
  ) {
    return bearingDegrees(projection.coordinate, aheadCoordinate);
  }

  if (Number.isFinite(projection.heading)) return projection.heading;
  return Number.isFinite(fallbackHeading) ? fallbackHeading : 0;
}

function mixCoordinates(from, to, alpha) {
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * alpha,
    longitude: from.longitude + (to.longitude - from.longitude) * alpha,
  };
}

function sampleQuadraticRouteConnector(start, control, end, segments = ROUTE_CONNECTOR_CURVE_SEGMENTS) {
  if (!start || !control || !end) return [];

  const coordinates = [];
  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const first = mixCoordinates(start, control, progress);
    const second = mixCoordinates(control, end, progress);
    coordinates.push(mixCoordinates(first, second, progress));
  }

  return coordinates;
}

function buildRouteConnectorCoordinates(vehicleCoordinate, routeCoordinate, vehicleHeading, routeHeading) {
  if (!vehicleCoordinate || !routeCoordinate) return [];

  const distanceMeters = haversineMeters(vehicleCoordinate, routeCoordinate);
  if (!Number.isFinite(distanceMeters) || distanceMeters < 2) {
    return [vehicleCoordinate, routeCoordinate];
  }

  const start = projectCoordinate(
    vehicleCoordinate,
    vehicleHeading,
    Math.min(ROUTE_CONNECTOR_FRONT_OFFSET_METERS, Math.max(4, distanceMeters * 0.4))
  );
  const startLead = projectCoordinate(
    start,
    vehicleHeading,
    Math.min(30, Math.max(6, distanceMeters * 0.55))
  );
  const routeApproach = projectCoordinate(
    routeCoordinate,
    (routeHeading ?? vehicleHeading) + 180,
    Math.min(18, Math.max(5, distanceMeters * 0.25))
  );
  const control = mixCoordinates(startLead, routeApproach, 0.42);

  return sampleQuadraticRouteConnector(start, control, routeCoordinate);
}

function getRemainingRouteDistanceMeters(point, routePoints) {
  if (!point || !Array.isArray(routePoints) || routePoints.length < 2) return null;

  const nearestIndex = getNearestRoutePointIndex(point, routePoints);
  if (nearestIndex < 0) return null;

  let remaining = haversineMeters(point, routePoints[nearestIndex]);
  for (let index = nearestIndex + 1; index < routePoints.length; index += 1) {
    remaining += haversineMeters(routePoints[index - 1], routePoints[index]);
  }

  return Math.max(0, remaining);
}

function getDistanceAheadOnRouteMeters(currentPoint, targetPoint, routePoints) {
  if (!currentPoint || !targetPoint || !Array.isArray(routePoints) || routePoints.length < 2) {
    return null;
  }

  const currentIndex = getNearestRoutePointIndex(currentPoint, routePoints);
  const targetIndex = getNearestRoutePointIndex(targetPoint, routePoints);
  if (currentIndex < 0 || targetIndex < 0 || targetIndex < currentIndex - 2) return null;

  let distance = haversineMeters(currentPoint, routePoints[currentIndex]);
  for (let index = currentIndex + 1; index <= targetIndex; index += 1) {
    distance += haversineMeters(routePoints[index - 1], routePoints[index]);
  }
  distance += haversineMeters(routePoints[targetIndex], targetPoint);

  return Math.max(0, distance);
}

function formatRouteDeviation(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) return 'Waiting for route position.';
  if (distanceMeters <= OFF_ROUTE_WARNING_THRESHOLD_METERS) return `On route | ${Math.round(distanceMeters)} m from route`;
  return `Off route | ${Math.round(distanceMeters)} m from route`;
}

function buildOffRouteBannerMessage(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) return 'Checking route position.';
  return `${Math.round(distanceMeters)} m from selected truck-safe route`;
}

function speakAlert(message, options = {}) {
  if (!VOICE_ALERTS_ENABLED) return false;

  try {
    const Speech = require('expo-speech');
    if (options.interrupt !== false) {
      Speech.stop();
    }
    Speech.speak(message, {
      rate: 0.95,
      pitch: 1,
    });
    return true;
  } catch {
    // The installed dev client may need a rebuild before native speech is available.
    return false;
  }
}

function stopSpeechAlerts() {
  try {
    const Speech = require('expo-speech');
    Speech.stop();
    return true;
  } catch {
    return false;
  }
}

function formatTruckProfile(profile) {
  if (!profile) return '';

  const height = Number(profile.height_ft);
  const weight = Number(profile.weight_lb);
  const length = Number(profile.length_ft);
  const hazmat = profile.hazmat ? 'Hazmat' : 'Non-hazmat';

  const parts = [];
  if (Number.isFinite(height)) parts.push(`${height.toFixed(1)} ft high`);
  if (Number.isFinite(length)) parts.push(`${length.toFixed(0)} ft long`);
  if (Number.isFinite(weight)) parts.push(`${Math.round(weight).toLocaleString()} lb`);
  parts.push(hazmat);

  return parts.join(' | ');
}

function getHazardStatus(summary) {
  const severity = summary?.severity || 'clear';

  if (severity === 'critical') {
    return {
      label: 'Critical hazards found',
      style: styles.hazardCritical,
    };
  }

  if (severity === 'high') {
    return {
      label: 'Truck restrictions found',
      style: styles.hazardHigh,
    };
  }

  if (severity === 'medium') {
    return {
      label: 'Residential restrictions found',
      style: styles.hazardMedium,
    };
  }

  return {
    label: 'No hazards found',
    style: styles.hazardClear,
  };
}

function normalizeHazardCoordinate(hazard) {
  const latitude = Number(hazard?.latitude ?? hazard?.lat);
  const longitude = Number(hazard?.longitude ?? hazard?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
  };
}

function normalizeHazards(hazards) {
  return {
    lowBridges: Array.isArray(hazards?.lowBridges) ? hazards.lowBridges : [],
    noTruckZones: Array.isArray(hazards?.noTruckZones) ? hazards.noTruckZones : [],
    residentialZones: Array.isArray(hazards?.residentialZones) ? hazards.residentialZones : [],
  };
}

function boundsFromRegion(region) {
  const latitude = Number(region?.latitude);
  const longitude = Number(region?.longitude);
  const latitudeDelta = Number(region?.latitudeDelta);
  const longitudeDelta = Number(region?.longitudeDelta);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitudeDelta) ||
    !Number.isFinite(longitudeDelta)
  ) {
    return null;
  }

  const halfLat = Math.max(latitudeDelta / 2, 0.002);
  const halfLng = Math.max(longitudeDelta / 2, 0.002);

  return {
    north: Math.min(90, latitude + halfLat),
    south: Math.max(-90, latitude - halfLat),
    east: Math.min(180, longitude + halfLng),
    west: Math.max(-180, longitude - halfLng),
  };
}

function getHazardMarkerIdentity(hazard, bucket, fallbackIndex) {
  const coordinate = normalizeHazardCoordinate(hazard);
  if (!coordinate) return null;

  const idPart = hazard?.id || hazard?.name || hazard?.restriction || fallbackIndex;
  return `${bucket}:${idPart}:${coordinate.latitude.toFixed(5)}:${coordinate.longitude.toFixed(5)}`;
}

function mergeHazardLists(bucket, ...lists) {
  const seen = new Set();
  const merged = [];

  lists.flat().forEach((hazard, index) => {
    const identity = getHazardMarkerIdentity(hazard, bucket, index);
    if (!identity || seen.has(identity)) return;
    seen.add(identity);
    merged.push(hazard);
  });

  return merged;
}

function summarizeHazardsFromBuckets(hazards) {
  const normalized = normalizeHazards(hazards);
  const lowBridgeCount = normalized.lowBridges.length;
  const noTruckZoneCount = normalized.noTruckZones.length;
  const residentialZoneCount = normalized.residentialZones.length;
  const total = lowBridgeCount + noTruckZoneCount + residentialZoneCount;

  let severity = 'clear';
  if (lowBridgeCount > 0) severity = 'critical';
  else if (noTruckZoneCount > 0) severity = 'high';
  else if (residentialZoneCount > 0) severity = 'medium';

  return {
    total,
    lowBridgeCount,
    noTruckZoneCount,
    residentialZoneCount,
    severity,
  };
}

function getRouteAtIndex(routes, index) {
  if (!Array.isArray(routes) || !routes.length) return null;

  const selectedRoute = Number.isInteger(index) ? routes[index] : null;
  if (selectedRoute?.encoded) return selectedRoute;

  return routes.find((candidate) => Boolean(candidate?.encoded)) || null;
}

function getValidRouteCoordinates(encoded) {
  if (!encoded) return [];

  return decodePolyline(encoded).filter((coordinate) => (
    Number.isFinite(coordinate.latitude) &&
    Number.isFinite(coordinate.longitude)
  ));
}

function getRouteCoordinatesFromSteps(steps) {
  if (!Array.isArray(steps)) return [];

  const coordinates = [];
  steps.forEach((step) => {
    const stepCoordinates = getValidRouteCoordinates(step?.encoded);
    if (stepCoordinates.length) {
      coordinates.push(...stepCoordinates);
      return;
    }

    const startCoordinate = normalizeStepCoordinate(step?.start_location);
    const endCoordinate = normalizeStepCoordinate(step?.end_location);
    if (startCoordinate) coordinates.push(startCoordinate);
    if (endCoordinate) coordinates.push(endCoordinate);
  });

  return coordinates.filter((coordinate, index) => {
    if (!Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)) {
      return false;
    }

    const previous = coordinates[index - 1];
    return !previous ||
      previous.latitude !== coordinate.latitude ||
      previous.longitude !== coordinate.longitude;
  });
}

function normalizeStepCoordinate(coordinate) {
  const latitude = Number(coordinate?.latitude ?? coordinate?.lat);
  const longitude = Number(coordinate?.longitude ?? coordinate?.lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function normalizeRouteSteps(steps) {
  if (!Array.isArray(steps)) return [];

  return steps
    .map((step, fallbackIndex) => {
      const startCoordinate = normalizeStepCoordinate(step?.start_location);
      const endCoordinate = normalizeStepCoordinate(step?.end_location);
      if (!startCoordinate || !endCoordinate) return null;

      const coordinates = getValidRouteCoordinates(step?.encoded);

      return {
        index: Number.isInteger(step?.index) ? step.index : fallbackIndex,
        instruction: step?.instruction || 'Continue',
        maneuver: step?.maneuver || null,
        distance_m: step?.distance_m ?? null,
        duration_s: step?.duration_s ?? null,
        startCoordinate,
        endCoordinate,
        coordinates: coordinates.length ? coordinates : [startCoordinate, endCoordinate],
      };
    })
    .filter(Boolean);
}

function getNearestStepIndex(point, steps) {
  if (!point || !steps.length) return -1;

  let nearestIndex = 0;
  let nearestDistance = Infinity;

  steps.forEach((step, index) => {
    const distance = getNearestRouteDistanceMeters(point, step.coordinates);
    if (Number.isFinite(distance) && distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });

  return nearestIndex;
}

function getUpcomingInstruction(point, steps) {
  if (!point || !steps.length) return null;

  const currentStepIndex = getNearestStepIndex(point, steps);
  if (currentStepIndex < 0) return null;

  const currentStep = steps[currentStepIndex];
  const distanceToCurrentEnd = haversineMeters(point, currentStep.endCoordinate);
  const targetStepIndex = currentStepIndex < steps.length - 1 ? currentStepIndex + 1 : currentStepIndex;
  const targetStep = steps[targetStepIndex];
  const distanceToTarget = targetStepIndex === currentStepIndex
    ? distanceToCurrentEnd
    : haversineMeters(point, targetStep.startCoordinate);

  return {
    stepIndex: targetStep.index,
    instruction: targetStep.instruction,
    maneuver: targetStep.maneuver,
    distance_m: distanceToTarget,
  };
}

function normalizeHeadingDegrees(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;

  return ((parsed % 360) + 360) % 360;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getShortestHeadingDelta(fromHeading, toHeading) {
  const from = normalizeHeadingDegrees(fromHeading);
  const to = normalizeHeadingDegrees(toHeading);
  if (from == null || to == null) return 0;

  return ((to - from + 540) % 360) - 180;
}

function interpolateHeadingDegrees(fromHeading, toHeading, alpha = HEADING_SMOOTHING_ALPHA) {
  const from = normalizeHeadingDegrees(fromHeading);
  const to = normalizeHeadingDegrees(toHeading);

  if (from == null) return to ?? 0;
  if (to == null) return from;

  return normalizeHeadingDegrees(from + getShortestHeadingDelta(from, to) * alpha);
}

function speedMphToMetersPerSecond(speedMph) {
  return Number.isFinite(speedMph) && speedMph > 0 ? speedMph * MPH_TO_METERS_PER_SECOND : 0;
}

function projectCoordinate(coordinate, headingDegrees, distanceMeters) {
  if (!coordinate || !Number.isFinite(distanceMeters) || distanceMeters <= 0) {
    return coordinate;
  }

  const heading = normalizeHeadingDegrees(headingDegrees) ?? 0;
  const toRad = (value) => (value * Math.PI) / 180;
  const toDeg = (value) => (value * 180) / Math.PI;
  const earthRadiusMeters = 6371000;
  const angularDistance = distanceMeters / earthRadiusMeters;
  const bearing = toRad(heading);
  const lat1 = toRad(coordinate.latitude);
  const lng1 = toRad(coordinate.longitude);
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
    Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    latitude: toDeg(lat2),
    longitude: ((toDeg(lng2) + 540) % 360) - 180,
  };
}

function getPredictedTruckCoordinate(coordinate, headingDegrees, speedMph) {
  const speedMetersPerSecond = speedMphToMetersPerSecond(speedMph);
  if (speedMetersPerSecond < 2.2) return coordinate;

  return projectCoordinate(
    coordinate,
    headingDegrees,
    speedMetersPerSecond * MOTION_PREDICTION_SECONDS
  );
}

function getNavigationCameraCenter(coordinate, headingDegrees, speedMph = 0) {
  const speed = Number.isFinite(Number(speedMph)) ? Number(speedMph) : 0;
  const lookaheadMeters = clamp(
    NAV_CAMERA_LOOKAHEAD_MIN_METERS + speed * 0.55,
    NAV_CAMERA_LOOKAHEAD_MIN_METERS,
    NAV_CAMERA_LOOKAHEAD_MAX_METERS
  );
  return projectCoordinate(coordinate, headingDegrees, lookaheadMeters);
}

function getValidGpsHeading(position) {
  const heading = Number(position?.coords?.heading);
  return Number.isFinite(heading) && heading >= 0 && heading < 360
    ? normalizeHeadingDegrees(heading)
    : null;
}

function calculateNavigationHeading(
  position,
  coordinate,
  previousSample,
  routePoints,
  speedMph,
  fallbackHeading,
  routeDistanceMeters = null,
  routeProjection = null
) {
  const routeHeading = routeProjection?.coordinate
    ? getRouteHeadingFromProjection(
        routeProjection,
        routePoints,
        fallbackHeading,
        getRouteHeadingLookaheadMeters(speedMph)
      )
    : getRouteHeading(coordinate, routePoints);
  const isOnRoute = Number.isFinite(routeDistanceMeters) && routeDistanceMeters <= OFF_ROUTE_WARNING_THRESHOLD_METERS;

  if (
    isOnRoute &&
    Number.isFinite(routeHeading)
  ) {
    return routeHeading;
  }

  if (previousSample?.coordinate) {
    const movedMeters = haversineMeters(previousSample.coordinate, coordinate);
    if (movedMeters >= 3) {
      return bearingDegrees(previousSample.coordinate, coordinate);
    }
  }

  const gpsHeading = getValidGpsHeading(position);
  if (gpsHeading != null && Number.isFinite(speedMph) && speedMph >= 8) {
    return gpsHeading;
  }

  return Number.isFinite(routeHeading) ? routeHeading : fallbackHeading;
}

function pluralizeHazard(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildRouteHazardVoiceSummary(hazards) {
  const normalized = normalizeHazards(hazards);
  const parts = [];

  if (normalized.lowBridges.length) {
    const nearestBridge = normalized.lowBridges[0];
    const clearance = Number(nearestBridge?.clearance_ft);
    const clearanceText = Number.isFinite(clearance)
      ? `, nearest clearance ${clearance.toFixed(1)} feet`
      : '';
    parts.push(`${pluralizeHazard(normalized.lowBridges.length, 'low clearance bridge', 'low clearance bridges')}${clearanceText}`);
  }

  if (normalized.noTruckZones.length) {
    parts.push(pluralizeHazard(normalized.noTruckZones.length, 'no truck restriction'));
  }

  if (normalized.residentialZones.length) {
    parts.push(pluralizeHazard(normalized.residentialZones.length, 'residential restriction'));
  }

  if (!parts.length) return 'No known truck hazards were found on the selected route.';

  return `Warning. The selected route includes ${parts.join(', ')}.`;
}

function buildRouteHazardAlertMessage(hazardType, hazard, distanceMeters) {
  const distanceText = formatHazardDistance(distanceMeters);

  if (hazardType === 'low_bridge') {
    const clearance = Number(hazard?.clearance_ft);
    const clearanceText = Number.isFinite(clearance) ? ` Clearance ${clearance.toFixed(1)} feet.` : '';
    return `Warning. Low clearance bridge ahead in ${distanceText}.${clearanceText}`;
  }

  if (hazardType === 'no_truck') {
    return `Warning. No truck restriction ahead in ${distanceText}.`;
  }

  return `Caution. Residential truck restriction ahead in ${distanceText}.`;
}

function buildRouteStartVoicePrompt(steps, hazards) {
  const firstInstruction = steps.find((step) => step?.instruction)?.instruction;
  const hazardSummary = buildRouteHazardVoiceSummary(hazards);
  if (!firstInstruction) return `Truck Safe Routing route started. ${hazardSummary}`;

  return `Truck Safe Routing route started. ${hazardSummary} First instruction. ${firstInstruction.replace(/\.$/, '')}.`;
}

function buildRouteOptions(routes) {
  if (!Array.isArray(routes)) return [];

  return routes
    .map((candidate, fallbackIndex) => {
      const hazards = normalizeHazards(candidate?.hazards);
      const steps = normalizeRouteSteps(candidate?.steps);
      const overviewCoordinates = getValidRouteCoordinates(candidate?.encoded);
      const coordinates = overviewCoordinates.length
        ? overviewCoordinates
        : getRouteCoordinatesFromSteps(candidate?.steps);

      return {
        index: candidate?.index ?? fallbackIndex,
        route: candidate,
        coordinates,
        steps,
        hazards,
        hazardSummary: candidate?.hazardSummary || summarizeHazardsFromBuckets(hazards),
      };
    })
    .filter((option) => option.coordinates.length > 0)
    .sort((a, b) => {
      const aDuration = Number(a.route?.duration_s);
      const bDuration = Number(b.route?.duration_s);
      if (Number.isFinite(aDuration) && Number.isFinite(bDuration)) {
        return aDuration - bDuration;
      }
      if (Number.isFinite(aDuration)) return -1;
      if (Number.isFinite(bDuration)) return 1;
      return Number(a.route?.distance_m || 0) - Number(b.route?.distance_m || 0);
    })
    .slice(0, 3)
    .map((option, rank) => ({
      ...option,
      fastestRank: rank + 1,
    }));
}

function DestinationMarker() {
  return (
    <View style={styles.destinationMarker}>
      <View style={styles.destinationMarkerDot} />
    </View>
  );
}

function LowBridgeMarker() {
  return (
    <View style={[styles.hazardMarkerBase, styles.lowBridgeMarker]}>
      <Text style={styles.lowBridgeMarkerTop}>LOW</Text>
      <Text style={styles.lowBridgeMarkerIcon}>↕</Text>
    </View>
  );
}

function NoTruckMarker() {
  return (
    <View style={[styles.hazardMarkerBase, styles.noTruckMarker]}>
      <View style={styles.noTruckSlash} />
      <Text style={styles.noTruckMarkerText}>NO</Text>
      <Text style={styles.noTruckMarkerSubText}>TRUCK</Text>
    </View>
  );
}

function ResidentialMarker() {
  return (
    <View style={[styles.hazardMarkerBase, styles.residentialMarker]}>
      <View style={styles.residentialRoof} />
      <Text style={styles.residentialMarkerText}>R</Text>
    </View>
  );
}

function MapTypePreview({ label, type, selected, centerCoordinate, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.mapTypePreviewOption,
        selected && styles.mapTypePreviewSelected,
        pressed && styles.mapTypePreviewPressed,
      ]}
    >
      <View
        style={[
          styles.mapTypePreviewTile,
          selected && styles.mapTypePreviewSelectedTile,
        ]}
      >
        <MapView
          pointerEvents="none"
          liteMode={true}
          style={styles.mapTypePreviewMap}
          mapType={type}
          initialRegion={{
            latitude: centerCoordinate.latitude,
            longitude: centerCoordinate.longitude,
            latitudeDelta: 0.028,
            longitudeDelta: 0.028,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          showsCompass={false}
          showsTraffic={true}
          toolbarEnabled={false}
        />
      </View>
      <Text
        style={[
          styles.mapTypePreviewLabel,
          selected && styles.mapTypePreviewLabelSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function LowBridgeDetail({ hazard }) {
  const gap = Number(hazard?.clearance_gap_ft);
  const gapText = Number.isFinite(gap)
    ? `${gap >= 0 ? '+' : ''}${gap.toFixed(1)} ft vs truck requirement`
    : 'Clearance gap unavailable';
  const severity = hazard?.severity === 'warning' ? 'Warning' : 'Critical';

  return (
    <View style={styles.hazardDetail}>
      <View style={styles.hazardDetailHeader}>
        <Text style={styles.hazardDetailTitle}>{severity} low bridge</Text>
        <Text style={styles.hazardDetailDistance}>
          {formatMeters(hazard?.distance_from_route_m)}
        </Text>
      </View>

      <Text style={styles.hazardDetailText}>
        Clearance: {formatFeet(hazard?.clearance_ft)} | Required: {formatFeet(hazard?.required_clearance_ft)}
      </Text>
      <Text style={styles.hazardDetailText}>{gapText}</Text>
    </View>
  );
}

function RestrictionDetail({ title, hazard }) {
  const distance = Number(hazard?.distance_from_route_m);
  const name = hazard?.name || hazard?.street || hazard?.road || hazard?.description || 'Restricted road area';
  const restriction = hazard?.restriction || hazard?.restrictionType || hazard?.type || 'Truck restriction';

  return (
    <View style={styles.hazardDetail}>
      <View style={styles.hazardDetailHeader}>
        <Text style={styles.hazardDetailTitle}>{title}</Text>
        <Text style={styles.hazardDetailDistance}>
          {Number.isFinite(distance) ? formatMeters(distance) : 'Near selected route'}
        </Text>
      </View>
      <Text style={styles.hazardDetailText} numberOfLines={1}>{name}</Text>
      <Text style={styles.hazardDetailText}>{restriction}</Text>
    </View>
  );
}

export default function MapScreen({ route, navigation }) {
  const mapRef = useRef(null);
  const vehicleLayerRef = useRef(null);
  const offRouteAlertActiveRef = useRef(false);
  const lastHazardAlertKeyRef = useRef(null);
  const hasEnteredFollowModeRef = useRef(false);
  const speedAlertLevelRef = useRef('clear');
  const speedApproachingSinceRef = useRef(null);
  const speedOverSinceRef = useRef(null);
  const offRouteSinceRef = useRef(null);
  const rerouteCooldownUntilRef = useRef(0);
  const isReroutingRef = useRef(false);
  const spokenTurnPromptRef = useRef(new Set());
  const lastLocationSampleRef = useRef(null);
  const lastSpeedMphRef = useRef(null);
  const lastSpeedUpdateAtRef = useRef(null);
  const directionsScrollYRef = useRef(new Animated.Value(0));
  const lastHeadingRef = useRef(0);
  const markerAnimationTimerRef = useRef(null);
  const displayedTruckCoordinateRef = useRef(null);
  const routeStartVoiceTimerRef = useRef(null);
  const spokenRouteHazardPromptRef = useRef(new Set());
  const visibleHazardRequestIdRef = useRef(0);
  const lastVisibleHazardFetchRef = useRef({ key: '', at: 0 });
  const liveHazardRequestIdRef = useRef(0);
  const lastLiveHazardScanRef = useRef({ coordinate: null, at: 0 });
  const lastLiveHazardAlertRef = useRef({ key: '', at: 0 });
  const routeSessionIdRef = useRef(null);
  const lastRouteEventRef = useRef({ key: '', at: 0 });
  const lastGpsTraceRef = useRef({ coordinate: null, at: 0 });
  const manifestArrivalSyncedRef = useRef(false);
  const autoRefollowTimerRef = useRef(null);
  const lastUserPanAtRef = useRef(0);
  const lastFollowCameraAtRef = useRef(0);
  const lastFollowCameraTargetRef = useRef({ coordinate: null, heading: null });
  const mapHeadingRef = useRef(0);
  const routeProjectionSegmentRef = useRef(null);
  const lastVehicleUpdateAtRef = useRef(0);
  const lastMotionStatePublishRef = useRef({
    at: 0,
    liveCoordinate: null,
    displayCoordinate: null,
    heading: null,
    speedMph: null,
    deviationMeters: null,
  });
  const latestTruckCoordinateRef = useRef(null);
  const latestTruckHeadingRef = useRef(0);
  const isFollowingTruckRef = useRef(false);
  const isVoiceMutedRef = useRef(false);
  const isReturningToDestinationRef = useRef(false);
  const destinationAddress = route?.params?.destinationAddress ?? '';
  const destinationPlaceId = route?.params?.destinationPlaceId ?? null;
  const destinationDetails = route?.params?.destinationDetails ?? null;
  const routeManifestStopId = destinationDetails?.routeStopId || route?.params?.routeStopId || null;
  const routeManifestDate = destinationDetails?.routeDate || route?.params?.routeManifestDate || null;
  const routeManifestDriverId =
    destinationDetails?.routeManifestDriverId || route?.params?.routeManifestDriverId || null;
  const routeManifestDriverName =
    destinationDetails?.routeManifestDriverName || route?.params?.routeManifestDriverName || null;
  const routeManifestScreenParams = {
    ...(routeManifestDriverId ? { driverId: routeManifestDriverId } : {}),
    ...(routeManifestDriverName ? { driverName: routeManifestDriverName } : {}),
  };
  const navigationMode = route?.params?.mode ?? 'start';
  const isDirectionsPreview = navigationMode === 'directions';
  const routeTruckProfile = route?.params?.truckProfile;
  const truckProfile = useMemo(() => ({
    height_ft: routeTruckProfile?.height_ft ?? 13.6,
    weight_lb: routeTruckProfile?.weight_lb ?? 80000,
    length_ft: routeTruckProfile?.length_ft ?? 53,
    hazmat: Boolean(routeTruckProfile?.hazmat),
  }), [
    routeTruckProfile?.height_ft,
    routeTruckProfile?.weight_lb,
    routeTruckProfile?.length_ft,
    routeTruckProfile?.hazmat,
  ]);
  const [routeStatus, setRouteStatus] = useState('Waiting for destination.');
  const [routeSummary, setRouteSummary] = useState('');
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [routeSteps, setRouteSteps] = useState([]);
  const [routeOptions, setRouteOptions] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(null);
  const [nextInstruction, setNextInstruction] = useState(null);
  const [chosenRoute, setChosenRoute] = useState(null);
  const [usedTruckProfile, setUsedTruckProfile] = useState(truckProfile);
  const [hazardSummary, setHazardSummary] = useState({
    total: 0,
    lowBridgeCount: 0,
    noTruckZoneCount: 0,
    residentialZoneCount: 0,
    severity: 'clear',
  });
  const [routeVerification, setRouteVerification] = useState(null);
  const [routeVerificationByIndex, setRouteVerificationByIndex] = useState({});
  const [originNote, setOriginNote] = useState('');
  const [originCoordinate, setOriginCoordinate] = useState(TEST_COORDINATE);
  const [liveCoordinate, setLiveCoordinate] = useState(null);
  const [displayedTruckCoordinate, setDisplayedTruckCoordinate] = useState(null);
  const [routeDeviationMeters, setRouteDeviationMeters] = useState(null);
  const [truckHeading, setTruckHeading] = useState(0);
  const [mapHeading, setMapHeading] = useState(0);
  const [currentSpeedMph, setCurrentSpeedMph] = useState(null);
  const [speedBlinkOn, setSpeedBlinkOn] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [offRouteFlow, setOffRouteFlow] = useState({
    status: 'on_route',
    message: '',
  });
  const [isFollowingTruck, setIsFollowingTruck] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [isRouteDetailsVisible, setIsRouteDetailsVisible] = useState(
    Boolean(route?.params?.initialRouteDetailsVisible)
  );
  const [hasArrived, setHasArrived] = useState(false);
  const [currentClockTime, setCurrentClockTime] = useState(new Date());
  const [mapType, setMapType] = useState('standard');
  const [isReportHazardVisible, setIsReportHazardVisible] = useState(false);
  const [reportHazardType, setReportHazardType] = useState('low_bridge');
  const [reportHazardNotes, setReportHazardNotes] = useState('');
  const [reportHazardStatus, setReportHazardStatus] = useState('');
  const [isSubmittingHazardReport, setIsSubmittingHazardReport] = useState(false);
  const [hazards, setHazards] = useState({
    lowBridges: [],
    noTruckZones: [],
    residentialZones: [],
  });
  const [visibleHazards, setVisibleHazards] = useState({
    lowBridges: [],
    noTruckZones: [],
    residentialZones: [],
  });
  const [liveProximityHazards, setLiveProximityHazards] = useState({
    lowBridges: [],
    noTruckZones: [],
    residentialZones: [],
  });
  const [isInfoCardCollapsed, setIsInfoCardCollapsed] = useState(false);
  const [infoCardOpenNonce, setInfoCardOpenNonce] = useState(0);

  const navigationCoordinate = liveCoordinate ?? routeCoordinates[0] ?? originCoordinate;
  const truckCoordinate = displayedTruckCoordinate ?? navigationCoordinate;
  isFollowingTruckRef.current = isFollowingTruck;
  const destinationCoordinate = routeCoordinates.length
    ? routeCoordinates[routeCoordinates.length - 1]
    : null;
  const distanceToDestinationMeters =
    truckCoordinate && destinationCoordinate
      ? haversineMeters(truckCoordinate, destinationCoordinate)
      : null;
  const lowBridgeHazards = hazards.lowBridges || [];
  const mapHazardMarkers = useMemo(() => ({
    lowBridges: mergeHazardLists('low_bridge', hazards.lowBridges, liveProximityHazards.lowBridges),
    noTruckZones: mergeHazardLists('no_truck', hazards.noTruckZones, liveProximityHazards.noTruckZones),
    residentialZones: mergeHazardLists(
      'residential',
      hazards.residentialZones,
      liveProximityHazards.residentialZones
    ),
  }), [hazards, liveProximityHazards]);
  const totalHazards =
    (hazards.lowBridges?.length || 0) +
    (hazards.noTruckZones?.length || 0) +
    (hazards.residentialZones?.length || 0);
  const displayedHazardSummary = {
    total: hazardSummary.total ?? totalHazards,
    lowBridgeCount: hazardSummary.lowBridgeCount ?? (hazards.lowBridges?.length || 0),
    noTruckZoneCount: hazardSummary.noTruckZoneCount ?? (hazards.noTruckZones?.length || 0),
    residentialZoneCount: hazardSummary.residentialZoneCount ?? (hazards.residentialZones?.length || 0),
    severity: hazardSummary.severity || 'clear',
  };
  const hazardStatus = getHazardStatus(displayedHazardSummary);
  const isOverCompanySpeedLimit =
    Number.isFinite(currentSpeedMph) &&
    currentSpeedMph >= SPEED_OVER_LIMIT_TRIGGER_MPH;
  const headingLabel = getHeadingLabel(truckHeading);
  const destinationTitle =
    destinationDetails?.name ||
    destinationAddress ||
    'Destination';
  const destinationSubtitle =
    destinationDetails?.formattedAddress &&
    destinationDetails.formattedAddress !== destinationTitle
      ? destinationDetails.formattedAddress
      : destinationAddress;
  const remainingRoute = useMemo(() => {
    if (!chosenRoute) {
      return {
        distanceMeters: null,
        durationSeconds: null,
      };
    }

    const totalDistanceMeters =
      Number(chosenRoute.distance_m) || getRouteLengthMeters(routeCoordinates);
    const totalDurationSeconds = Number(chosenRoute.duration_s);
    const remainingDistanceMeters =
      getRemainingRouteDistanceMeters(liveCoordinate || truckCoordinate, routeCoordinates) ??
      totalDistanceMeters;
    const routeProgressRatio =
      totalDistanceMeters > 0
        ? Math.min(1, Math.max(0, remainingDistanceMeters / totalDistanceMeters))
        : 1;
    const remainingDurationSeconds = Number.isFinite(totalDurationSeconds)
        ? totalDurationSeconds * routeProgressRatio
        : null;

    return {
      distanceMeters: remainingDistanceMeters,
      durationSeconds: remainingDurationSeconds,
    };
  }, [chosenRoute, liveCoordinate, truckCoordinate, routeCoordinates]);
  const nearestRouteProjection = useMemo(() => {
    if (!truckCoordinate || !routeCoordinates.length) return null;

    return getNearestRouteProjection(truckCoordinate, routeCoordinates);
  }, [truckCoordinate, routeCoordinates]);
  const displayedRouteCoordinates = useMemo(
    () => buildDisplayedRouteCoordinates(routeCoordinates),
    [routeCoordinates]
  );
  const nearestRouteCoordinate = nearestRouteProjection?.coordinate || null;
  const routeSnappedTruckCoordinate = useMemo(() => {
    if (!truckCoordinate || !nearestRouteCoordinate) return truckCoordinate;
    if (!Number.isFinite(routeDeviationMeters)) return truckCoordinate;
    if (routeDeviationMeters > OFF_ROUTE_WARNING_THRESHOLD_METERS) return truckCoordinate;

    return nearestRouteCoordinate;
  }, [truckCoordinate, nearestRouteCoordinate, routeDeviationMeters]);
  const laneAdjustedTruckCoordinate = useMemo(() => {
    if (!routeSnappedTruckCoordinate) return truckCoordinate;
    if (
      Number.isFinite(routeDeviationMeters) &&
      routeDeviationMeters > OFF_ROUTE_WARNING_THRESHOLD_METERS
    ) {
      return truckCoordinate;
    }

    return buildDisplayedTruckCoordinate(
      routeSnappedTruckCoordinate,
      nearestRouteProjection?.heading ?? truckHeading,
      routeDeviationMeters
    );
  }, [
    routeSnappedTruckCoordinate,
    truckCoordinate,
    nearestRouteProjection?.heading,
    truckHeading,
    routeDeviationMeters,
  ]);
  const laneAdjustedNearestRouteCoordinate = useMemo(() => {
    if (!nearestRouteCoordinate) return null;

    return buildDisplayedTruckCoordinate(
      nearestRouteCoordinate,
      nearestRouteProjection?.heading ?? truckHeading,
      0
    );
  }, [nearestRouteCoordinate, nearestRouteProjection?.heading, truckHeading]);
  const routeConnectorTargetCoordinate = useMemo(() => {
    if (!nearestRouteProjection || !routeCoordinates.length) return null;

    const aheadRouteCoordinate = getCoordinateAheadFromRouteProjection(
      nearestRouteProjection,
      routeCoordinates,
      ROUTE_CONNECTOR_TARGET_AHEAD_METERS
    );
    if (!aheadRouteCoordinate) return null;

    const aheadProjection =
      getNearestRouteProjection(aheadRouteCoordinate, routeCoordinates) || nearestRouteProjection;

    return buildDisplayedTruckCoordinate(
      aheadRouteCoordinate,
      aheadProjection?.heading ?? nearestRouteProjection?.heading ?? truckHeading,
      0
    );
  }, [nearestRouteProjection, routeCoordinates, truckHeading]);
  const routeConnectorCoordinates = useMemo(
    () =>
      buildRouteConnectorCoordinates(
        laneAdjustedTruckCoordinate || truckCoordinate,
        routeConnectorTargetCoordinate ||
          laneAdjustedNearestRouteCoordinate ||
          nearestRouteCoordinate,
        truckHeading,
        nearestRouteProjection?.heading ?? truckHeading
      ),
    [
      laneAdjustedTruckCoordinate,
      truckCoordinate,
      routeConnectorTargetCoordinate,
      laneAdjustedNearestRouteCoordinate,
      nearestRouteCoordinate,
      truckHeading,
      nearestRouteProjection?.heading,
    ]
  );
  const routeConnectorDistanceMeters =
    routeConnectorCoordinates.length > 1
      ? getRouteLengthMeters(routeConnectorCoordinates)
      : 0;
  const vehicleLayerMapHeading = mapHeading;
  const showRouteConnector =
    routeConnectorCoordinates.length > 1 &&
    routeConnectorDistanceMeters > 10 &&
    !hasArrived &&
    Boolean(chosenRoute);
  const showOffRouteBanner =
    offRouteFlow.status !== 'on_route' &&
    !hasArrived &&
    Boolean(chosenRoute);
  const canManuallyReroute =
    !isRerouting &&
    !isReroutingRef.current &&
    Boolean(liveCoordinate) &&
    Boolean(chosenRoute) &&
    Number.isFinite(routeDeviationMeters) &&
    routeDeviationMeters >= OFF_ROUTE_MANUAL_REROUTE_THRESHOLD_METERS;

  const openInfoCardTemporarily = () => {
    setIsInfoCardCollapsed(false);
    setInfoCardOpenNonce((current) => current + 1);
  };

  const speakNavigationAlert = (message, options = {}) => {
    if (isVoiceMutedRef.current) return false;
    return speakAlert(message, options);
  };

  const toggleVoiceAlerts = () => {
    const nextMuted = !isVoiceMutedRef.current;
    isVoiceMutedRef.current = nextMuted;
    setIsVoiceMuted(nextMuted);

    if (nextMuted) {
      if (routeStartVoiceTimerRef.current) {
        clearTimeout(routeStartVoiceTimerRef.current);
        routeStartVoiceTimerRef.current = null;
      }
      stopSpeechAlerts();
      return;
    }

    spokenTurnPromptRef.current = new Set();
    const instruction = nextInstruction?.instruction?.replace(/\.$/, '');
    if (instruction) {
      speakAlert(
        `Voice guidance on. In ${formatInstructionDistance(nextInstruction.distance_m)}, ${instruction}.`,
        { interrupt: true }
      );
      const level =
        nextInstruction.distance_m <= TURN_PROMPT_NEAR_METERS
          ? 'near'
          : 'far';
      spokenTurnPromptRef.current.add(`${nextInstruction.stepIndex}:${level}`);
    } else {
      speakAlert('Voice guidance on.', { interrupt: true });
    }
  };

  const recordRouteSessionEvent = async (eventType, options = {}) => {
    const sessionId = routeSessionIdRef.current;
    if (!sessionId) return;

    const {
      severity = 'info',
      coordinate = truckCoordinate,
      payload = {},
      dedupeKey = null,
      dedupeMs = 15000,
    } = options;
    const eventKey = dedupeKey || `${eventType}:${severity}`;
    const now = Date.now();
    const lastEvent = lastRouteEventRef.current;

    if (lastEvent.key === eventKey && now - lastEvent.at < dedupeMs) {
      return;
    }

    lastRouteEventRef.current = { key: eventKey, at: now };

    try {
      await recordRouteEvent(sessionId, {
        eventType,
        severity,
        latitude: coordinate?.latitude ?? null,
        longitude: coordinate?.longitude ?? null,
        clientRecordedAt: new Date().toISOString(),
        payload,
      });
    } catch {
      // Route replay logging must never interrupt navigation.
    }
  };

  const maybeRecordGpsTrace = (coordinate, heading, speedMph) => {
    if (!routeSessionIdRef.current || !coordinate) return;

    const now = Date.now();
    const previous = lastGpsTraceRef.current;
    const movedMeters = previous.coordinate
      ? haversineMeters(previous.coordinate, coordinate)
      : Number.POSITIVE_INFINITY;

    const elapsedMs = now - previous.at;
    if (elapsedMs < GPS_TRACE_INTERVAL_MS) return;
    if (movedMeters < GPS_TRACE_MIN_DISTANCE_METERS && elapsedMs < 60000) return;

    lastGpsTraceRef.current = { coordinate, at: now };
    recordRouteSessionEvent('gps_trace', {
      coordinate,
      payload: {
        heading: Number.isFinite(heading) ? heading : null,
        speedMph: Number.isFinite(speedMph) ? speedMph : null,
        source: 'driver_device_gps',
      },
      dedupeKey: `gps-trace:${now}`,
      dedupeMs: 0,
    });
  };

  const recenterOnTruck = () => {
    const currentTruckCoordinate = latestTruckCoordinateRef.current;
    const currentTruckHeading = latestTruckHeadingRef.current;
    if (!currentTruckCoordinate || !mapRef.current) return;

    hasEnteredFollowModeRef.current = true;
    isFollowingTruckRef.current = true;
    mapHeadingRef.current = normalizeHeadingDegrees(currentTruckHeading);
    setIsFollowingTruck(true);
    mapRef.current?.animateCamera(
      {
        center: getNavigationCameraCenter(
          currentTruckCoordinate,
          currentTruckHeading,
          lastSpeedMphRef.current
        ),
        heading: currentTruckHeading,
        pitch: NAV_CAMERA_PITCH,
        zoom: NAV_CAMERA_ZOOM,
      },
      { duration: 450 }
    );
  };

  const restoreFollowMode = (duration = 650) => {
    const currentTruckCoordinate = latestTruckCoordinateRef.current;
    const currentTruckHeading = latestTruckHeadingRef.current;
    if (!currentTruckCoordinate || !mapRef.current) return;

    if (autoRefollowTimerRef.current) {
      clearTimeout(autoRefollowTimerRef.current);
      autoRefollowTimerRef.current = null;
    }

    hasEnteredFollowModeRef.current = true;
    isFollowingTruckRef.current = true;
    mapHeadingRef.current = normalizeHeadingDegrees(currentTruckHeading);
    setIsFollowingTruck(true);
    mapRef.current?.animateCamera(
      {
        center: getNavigationCameraCenter(
          currentTruckCoordinate,
          currentTruckHeading,
          lastSpeedMphRef.current
        ),
        heading: currentTruckHeading,
        pitch: NAV_CAMERA_PITCH,
        zoom: NAV_CAMERA_ZOOM,
      },
      { duration }
    );
  };

  const handleMapPanDrag = () => {
    if (!chosenRoute) return;

    lastUserPanAtRef.current = Date.now();
    isFollowingTruckRef.current = false;
    setIsFollowingTruck(false);
    mapRef.current?.getCamera?.().then((camera) => {
      if (Number.isFinite(camera?.heading)) {
        mapHeadingRef.current = normalizeHeadingDegrees(camera.heading);
      }
    }).catch(() => {});

    if (autoRefollowTimerRef.current) {
      clearTimeout(autoRefollowTimerRef.current);
    }

    autoRefollowTimerRef.current = setTimeout(() => {
      const idleMs = Date.now() - lastUserPanAtRef.current;
      if (idleMs >= AUTO_REFOLLOW_AFTER_PAN_MS - 100) {
        restoreFollowMode();
      }
    }, AUTO_REFOLLOW_AFTER_PAN_MS);
  };

  const handleMapRegionChangeComplete = () => {
    mapRef.current?.getCamera?.().then((camera) => {
      if (!Number.isFinite(camera?.heading)) return;
      const nextHeading = normalizeHeadingDegrees(camera.heading) ?? 0;
      mapHeadingRef.current = nextHeading;
      setMapHeading((currentHeading) => (
        Math.abs(getShortestHeadingDelta(currentHeading, nextHeading)) >= 1
          ? nextHeading
          : currentHeading
      ));
    }).catch(() => {});
  };

  const followTruckCamera = (
    cameraTruckCoordinate,
    cameraHeading,
    sampleIntervalMs = FOLLOW_CAMERA_ANIMATION_MS,
    speedMph = 0
  ) => {
    if (
      !isFollowingTruckRef.current ||
      !cameraTruckCoordinate ||
      !mapRef.current
    ) {
      return;
    }

    const now = Date.now();
    if (now - lastFollowCameraAtRef.current < FOLLOW_CAMERA_MIN_INTERVAL_MS) return;
    const lastTarget = lastFollowCameraTargetRef.current;
    const movedMeters = lastTarget.coordinate
      ? haversineMeters(lastTarget.coordinate, cameraTruckCoordinate)
      : Infinity;
    const headingDelta = Number.isFinite(lastTarget.heading)
      ? Math.abs(getShortestHeadingDelta(lastTarget.heading, cameraHeading))
      : Infinity;
    if (
      movedMeters < FOLLOW_CAMERA_MIN_MOVE_METERS &&
      headingDelta < FOLLOW_CAMERA_MIN_HEADING_DEGREES
    ) {
      return;
    }

    lastFollowCameraAtRef.current = now;
    lastFollowCameraTargetRef.current = {
      coordinate: cameraTruckCoordinate,
      heading: cameraHeading,
    };
    mapHeadingRef.current = normalizeHeadingDegrees(cameraHeading);
    const duration = clamp(
      sampleIntervalMs * 1.05,
      FOLLOW_CAMERA_MIN_ANIMATION_MS,
      FOLLOW_CAMERA_MAX_ANIMATION_MS
    );

    mapRef.current?.animateCamera(
      {
        center: getNavigationCameraCenter(cameraTruckCoordinate, cameraHeading, speedMph),
        heading: cameraHeading,
        pitch: NAV_CAMERA_PITCH,
        zoom: NAV_CAMERA_ZOOM,
      },
      { duration }
    );
  };

  const loadVisibleHazards = async (region, options = {}) => {
    const bounds = boundsFromRegion(region);
    if (!bounds) return;

    const boundsKey = [
      bounds.north.toFixed(3),
      bounds.south.toFixed(3),
      bounds.east.toFixed(3),
      bounds.west.toFixed(3),
    ].join(':');
    const now = Date.now();
    const lastFetch = lastVisibleHazardFetchRef.current;

    if (!options.force && now - lastFetch.at < VISIBLE_HAZARD_FETCH_MIN_MS) {
      return;
    }

    lastVisibleHazardFetchRef.current = { key: boundsKey, at: now };
    const requestId = visibleHazardRequestIdRef.current + 1;
    visibleHazardRequestIdRef.current = requestId;

    try {
      const data = await fetchHazardsInBounds(bounds, VISIBLE_HAZARD_LIMIT_PER_TYPE);

      if (requestId !== visibleHazardRequestIdRef.current || !data) return;
      setVisibleHazards(normalizeHazards(data.hazards));
    } catch {
      if (requestId === visibleHazardRequestIdRef.current) {
        setVisibleHazards({
          lowBridges: [],
          noTruckZones: [],
          residentialZones: [],
        });
      }
    }
  };

  const maybeSpeakLiveHazardWarning = (nextHazards) => {
    const nearestLowBridge = nextHazards.lowBridges?.[0] || null;
    const nearestNoTruck = nextHazards.noTruckZones?.[0] || null;
    const now = Date.now();

    if (nearestLowBridge) {
      const distance = Number(nearestLowBridge.distance_from_truck_m);
      const alertKey = `live-low-bridge:${nearestLowBridge.id}`;
      const isCooldownActive =
        lastLiveHazardAlertRef.current.key === alertKey &&
        now - lastLiveHazardAlertRef.current.at < LIVE_HAZARD_ALERT_COOLDOWN_MS;

      if (!isCooldownActive) {
        lastLiveHazardAlertRef.current = { key: alertKey, at: now };
        Vibration.vibrate([0, 400, 160, 400]);
        const clearanceText = Number.isFinite(Number(nearestLowBridge.clearance_ft))
          ? ` Clearance ${Number(nearestLowBridge.clearance_ft).toFixed(1)} feet.`
          : '';
        const severityText =
          Number.isFinite(distance) && distance <= LIVE_LOW_BRIDGE_CRITICAL_METERS
            ? 'Critical warning.'
            : 'Warning.';
        speakNavigationAlert(
          `${severityText} Low clearance bridge nearby.${clearanceText} Distance ${formatHazardDistance(distance)}.`
        );
        recordRouteSessionEvent('live_low_bridge_warning', {
          severity: severityText.startsWith('Critical') ? 'critical' : 'warning',
          payload: {
            hazard: nearestLowBridge,
            distanceFromTruckMeters: distance,
          },
          dedupeKey: alertKey,
          dedupeMs: LIVE_HAZARD_ALERT_COOLDOWN_MS,
        });
      }

      return;
    }

    if (nearestNoTruck) {
      const alertKey = `live-no-truck:${nearestNoTruck.id}`;
      const isCooldownActive =
        lastLiveHazardAlertRef.current.key === alertKey &&
        now - lastLiveHazardAlertRef.current.at < LIVE_HAZARD_ALERT_COOLDOWN_MS;

      if (!isCooldownActive) {
        lastLiveHazardAlertRef.current = { key: alertKey, at: now };
        Vibration.vibrate([0, 300, 140, 300]);
        speakNavigationAlert('Warning. No truck restriction detected near your current position.');
        recordRouteSessionEvent('live_no_truck_warning', {
          severity: 'warning',
          payload: {
            hazard: nearestNoTruck,
            distanceFromTruckMeters: nearestNoTruck.distance_from_truck_m ?? null,
          },
          dedupeKey: alertKey,
          dedupeMs: LIVE_HAZARD_ALERT_COOLDOWN_MS,
        });
      }
    }
  };

  const loadLiveProximityHazards = async (coordinate, options = {}) => {
    if (!coordinate) return;

    const now = Date.now();
    const lastScan = lastLiveHazardScanRef.current;
    const movedMeters = lastScan.coordinate
      ? haversineMeters(lastScan.coordinate, coordinate)
      : Infinity;

    if (
      !options.force &&
      now - lastScan.at < LIVE_HAZARD_SCAN_MIN_MS &&
      movedMeters < LIVE_HAZARD_SCAN_MIN_MOVE_METERS
    ) {
      return;
    }

    lastLiveHazardScanRef.current = { coordinate, at: now };
    const requestId = liveHazardRequestIdRef.current + 1;
    liveHazardRequestIdRef.current = requestId;

    try {
      const data = await fetchHazardsNearCoordinate(coordinate, LIVE_HAZARD_SCAN_RADIUS_METERS);

      if (requestId !== liveHazardRequestIdRef.current || !data) return;

      const nextHazards = normalizeHazards(data.hazards);
      setLiveProximityHazards(nextHazards);
      maybeSpeakLiveHazardWarning(nextHazards);
    } catch {
      if (requestId === liveHazardRequestIdRef.current) {
        setLiveProximityHazards({
          lowBridges: [],
          noTruckZones: [],
          residentialZones: [],
        });
      }
    }
  };

  const returnToCleanDestinationPage = () => {
    const resetDestinationToken = Date.now();

    if (navigation?.reset) {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'Home',
            params: {
              resetDestinationToken,
            },
          },
        ],
      });
      return;
    }

    navigation?.navigate?.('Home', {
      resetDestinationToken,
    });
  };

  const openDeliverySettlement = () => {
    if (!routeManifestStopId) return false;
    navigation?.replace?.('DeliverySettlement', {
      stopId: routeManifestStopId,
      routeDate: routeManifestDate,
      driverId: routeManifestDriverId,
      driverName: routeManifestDriverName,
    });
    return true;
  };

  const openArrivalDeliveryNotes = () => {
    navigation?.navigate?.('DeliveryNotes', {
      destinationAddress,
      destinationPlaceId,
      accountNumber: destinationDetails?.accountNumber || null,
      driverId: routeManifestDriverId,
      driverName: routeManifestDriverName,
      destinationDetails: {
        ...(destinationDetails || {}),
        routeStopId: routeManifestStopId,
        routeDate: routeManifestDate,
        routeManifestDriverId,
        routeManifestDriverName,
      },
    });
  };

  const endRoute = (options = {}) => {
    const shouldReturnHome = options?.returnHome !== false;

    recordRouteSessionEvent('route_ended', {
      severity: 'info',
      payload: {
        destinationAddress,
        distanceToDestinationMeters,
      },
      dedupeKey: 'route-ended',
      dedupeMs: 1000,
    });

    if (markerAnimationTimerRef.current) {
      clearInterval(markerAnimationTimerRef.current);
      markerAnimationTimerRef.current = null;
    }
    if (autoRefollowTimerRef.current) {
      clearTimeout(autoRefollowTimerRef.current);
      autoRefollowTimerRef.current = null;
    }
    if (routeStartVoiceTimerRef.current) {
      clearTimeout(routeStartVoiceTimerRef.current);
      routeStartVoiceTimerRef.current = null;
    }

    hasEnteredFollowModeRef.current = false;
    offRouteAlertActiveRef.current = false;
    offRouteSinceRef.current = null;
    rerouteCooldownUntilRef.current = 0;
    isReroutingRef.current = false;
    speedAlertLevelRef.current = 'clear';
    speedApproachingSinceRef.current = null;
    speedOverSinceRef.current = null;
    spokenTurnPromptRef.current = new Set();
    lastHazardAlertKeyRef.current = null;
    spokenRouteHazardPromptRef.current = new Set();
    setIsFollowingTruck(false);
    setIsRerouting(false);
    setIsRouteDetailsVisible(false);
    setHasArrived(false);
    setIsInfoCardCollapsed(true);
    setRouteCoordinates([]);
    setRouteSteps([]);
    setRouteOptions([]);
    setSelectedRouteIndex(null);
    setNextInstruction(null);
    setChosenRoute(null);
    setRouteDeviationMeters(null);
    setHazardSummary({
      total: 0,
      lowBridgeCount: 0,
      noTruckZoneCount: 0,
      residentialZoneCount: 0,
      severity: 'clear',
    });
    setRouteVerification(null);
    setRouteVerificationByIndex({});
    setHazards({
      lowBridges: [],
      noTruckZones: [],
      residentialZones: [],
    });
    setLiveProximityHazards({
      lowBridges: [],
      noTruckZones: [],
      residentialZones: [],
    });
    lastLiveHazardScanRef.current = { coordinate: null, at: 0 };
    lastLiveHazardAlertRef.current = { key: '', at: 0 };
    routeSessionIdRef.current = null;
    lastGpsTraceRef.current = { coordinate: null, at: 0 };
    lastRouteEventRef.current = { key: '', at: 0 };
    manifestArrivalSyncedRef.current = false;
    lastMotionStatePublishRef.current = {
      at: 0,
      liveCoordinate: null,
      displayCoordinate: null,
      heading: null,
      speedMph: null,
      deviationMeters: null,
    };
    lastFollowCameraTargetRef.current = { coordinate: null, heading: null };
    setRouteStatus('Route ended.');
    setRouteSummary('');

    if (routeManifestStopId && !options?.skipManifestHandoff) {
      openDeliverySettlement();
      return;
    }

    if (shouldReturnHome) {
      returnToCleanDestinationPage();
    }
  };

  const startNewDestination = () => {
    endRoute({ returnHome: true, skipManifestHandoff: true });
  };

  const openHazardReport = () => {
    setReportHazardType('low_bridge');
    setReportHazardNotes('');
    setReportHazardStatus('');
    setIsReportHazardVisible(true);
  };

  const submitHazardReport = async () => {
    const reportCoordinate = liveCoordinate || truckCoordinate || originCoordinate;
    if (!reportCoordinate || isSubmittingHazardReport) return;

    setIsSubmittingHazardReport(true);
    setReportHazardStatus('Submitting hazard report...');

    try {
      const selectedType = REPORT_HAZARD_TYPES.find((type) => type.key === reportHazardType);
      const isOnRoute = Number.isFinite(routeDeviationMeters)
        ? routeDeviationMeters <= OFF_ROUTE_WARNING_THRESHOLD_METERS
        : null;
      const payload = {
        category: reportHazardType,
        name: `${selectedType?.label || 'Hazard'} reported by driver`,
        latitude: reportCoordinate.latitude,
        longitude: reportCoordinate.longitude,
        notes: reportHazardNotes || 'Driver submitted hazard from map screen.',
        reported_by: DRIVER_ID,
        driver_id: DRIVER_ID,
        driver_name: DRIVER_NAME,
        route_destination: destinationAddress || destinationTitle,
        reported_speed_mph: Number.isFinite(currentSpeedMph) ? currentSpeedMph : null,
        reported_heading: Number.isFinite(truckHeading) ? truckHeading : null,
        route_deviation_m: Number.isFinite(routeDeviationMeters) ? routeDeviationMeters : null,
        was_on_route: isOnRoute,
        nearby_address: null,
      };

      await submitDriverHazardReport(payload);

      Vibration.vibrate(180);
      setReportHazardStatus('Report saved as pending review.');
      setReportHazardNotes('');
      setTimeout(() => {
        setIsReportHazardVisible(false);
        setReportHazardStatus('');
      }, 1200);
    } catch (error) {
      setReportHazardStatus(error.message || 'Unable to submit hazard report.');
    } finally {
      setIsSubmittingHazardReport(false);
    }
  };

  const setDisplayedTruckPosition = (coordinate, animated = false) => {
    if (!coordinate) return;

    if (markerAnimationTimerRef.current) {
      clearInterval(markerAnimationTimerRef.current);
      markerAnimationTimerRef.current = null;
    }

    displayedTruckCoordinateRef.current = coordinate;
    latestTruckCoordinateRef.current = coordinate;
    setDisplayedTruckCoordinate(coordinate);
  };

  const selectRouteOption = (option) => {
    openInfoCardTemporarily();
    const routeHeading = getRouteHeading(truckCoordinate, option.coordinates);
    setSelectedRouteIndex(option.index);
    setRouteCoordinates(option.coordinates);
    setRouteSteps(option.steps);
    setTruckHeading(routeHeading);
    lastHeadingRef.current = routeHeading;
    setHasArrived(false);
    setChosenRoute(option.route || null);
    setHazards(option.hazards);
    setHazardSummary(option.hazardSummary);
    setRouteVerification(routeVerificationByIndex[option.index] || null);
    setNextInstruction(getUpcomingInstruction(truckCoordinate, option.steps));
    spokenTurnPromptRef.current = new Set();
    spokenRouteHazardPromptRef.current = new Set();
    setRouteDeviationMeters(0);
    setOffRouteFlow({
      status: 'on_route',
      message: '',
    });
    offRouteSinceRef.current = null;
    offRouteAlertActiveRef.current = false;
    rerouteCooldownUntilRef.current = Date.now() + OFF_ROUTE_REROUTE_COOLDOWN_MS;
    lastLocationSampleRef.current = null;
    lastSpeedMphRef.current = null;
    lastSpeedUpdateAtRef.current = null;
    lastHeadingRef.current = routeHeading;
    lastMotionStatePublishRef.current = {
      at: 0,
      liveCoordinate: truckCoordinate,
      displayCoordinate: truckCoordinate,
      heading: routeHeading,
      speedMph: null,
      deviationMeters: 0,
    };
    lastFollowCameraTargetRef.current = { coordinate: null, heading: null };
    setDisplayedTruckPosition(truckCoordinate, false);
    recordRouteSessionEvent('route_selected', {
      severity: 'info',
      payload: {
        selectedRouteIndex: option.index,
        distanceMeters: option.route?.distance_m ?? null,
        durationSeconds: option.route?.duration_s ?? null,
        hazardSummary: option.hazardSummary,
      },
      dedupeKey: `route-selected:${option.index}`,
      dedupeMs: 1000,
    });
    hasEnteredFollowModeRef.current = true;
    isFollowingTruckRef.current = true;
    mapHeadingRef.current = normalizeHeadingDegrees(routeHeading);
    setIsFollowingTruck(true);
    mapRef.current?.animateCamera(
      {
        center: getNavigationCameraCenter(truckCoordinate, routeHeading),
        heading: routeHeading,
        pitch: NAV_CAMERA_PITCH,
        zoom: NAV_CAMERA_ZOOM,
      },
      { duration: 650 }
    );
  };

  const applySafeRouteData = (data, nextOriginCoordinate, options = {}) => {
    const {
      status = 'Safe route returned.',
      summaryPrefix = '',
      speakMessage = null,
      speakRouteStart = false,
    } = options;
    const routeCount = Array.isArray(data.routes) ? data.routes.length : 0;
    const chosenIndex = data.chosenRouteIndex ?? 'none';
    routeSessionIdRef.current = data.routeSessionId || routeSessionIdRef.current;
    lastGpsTraceRef.current = { coordinate: null, at: 0 };
    const builtOptions = buildRouteOptions(data.routes);
    const selectedOption =
      builtOptions.find((option) => option.index === data.chosenRouteIndex) ||
      builtOptions[0] ||
      null;
    const selectedRoute = selectedOption?.route || getRouteAtIndex(data.routes, data.chosenRouteIndex);
    const selectedSteps = selectedOption?.steps || normalizeRouteSteps(selectedRoute?.steps);
    const selectedOverviewCoordinates = getValidRouteCoordinates(selectedRoute?.encoded);
    const decodedRoute = selectedOption?.coordinates?.length
      ? selectedOption.coordinates
      : selectedOverviewCoordinates.length
        ? selectedOverviewCoordinates
        : getRouteCoordinatesFromSteps(selectedRoute?.steps);
    const selectedHazards = normalizeHazards(
      data.chosenRouteHazards ||
      selectedOption?.hazards ||
      selectedRoute?.hazards
    );
    const selectedHazardSummary =
      data.chosenRouteHazardSummary ||
      selectedOption?.hazardSummary ||
      selectedRoute?.hazardSummary ||
      summarizeHazardsFromBuckets(selectedHazards);
    const headingOrigin = nextOriginCoordinate || liveCoordinate || originCoordinate;
    const initialRouteHeading = getRouteHeading(headingOrigin, decodedRoute);

    if (nextOriginCoordinate) {
      setOriginCoordinate(nextOriginCoordinate);
      setLiveCoordinate(nextOriginCoordinate);
      setDisplayedTruckPosition(nextOriginCoordinate, false);
    }

    setRouteOptions(builtOptions);
    setSelectedRouteIndex(selectedOption?.index ?? data.chosenRouteIndex ?? null);
    setRouteCoordinates(decodedRoute);
    setRouteSteps(selectedSteps);
    setTruckHeading(initialRouteHeading);
    lastHeadingRef.current = initialRouteHeading;
    setChosenRoute(selectedRoute || null);
    setUsedTruckProfile(data.usedTruckProfile || truckProfile);
    setHazards(selectedHazards);
    setHazardSummary(selectedHazardSummary);
    const nextVerificationByIndex = {};
    (data.verification?.routes || []).forEach((verification) => {
      nextVerificationByIndex[verification.index] = verification;
    });
    setRouteVerificationByIndex(nextVerificationByIndex);
    setRouteVerification(
      data.verification?.chosenRoute ||
      nextVerificationByIndex[selectedOption?.index ?? data.chosenRouteIndex] ||
      null
    );
    setHasArrived(false);
    setNextInstruction(getUpcomingInstruction(headingOrigin, selectedSteps));
    spokenTurnPromptRef.current = new Set();
    spokenRouteHazardPromptRef.current = new Set();
    setRouteDeviationMeters(0);
    setOffRouteFlow({
      status: 'on_route',
      message: '',
    });
    offRouteSinceRef.current = null;
    offRouteAlertActiveRef.current = false;
    lastLocationSampleRef.current = nextOriginCoordinate
      ? { coordinate: nextOriginCoordinate, timestamp: Date.now() }
      : null;
    lastSpeedMphRef.current = null;
    lastSpeedUpdateAtRef.current = null;
    lastHeadingRef.current = initialRouteHeading;
    lastMotionStatePublishRef.current = {
      at: 0,
      liveCoordinate: headingOrigin,
      displayCoordinate: headingOrigin,
      heading: initialRouteHeading,
      speedMph: null,
      deviationMeters: 0,
    };
    lastFollowCameraTargetRef.current = { coordinate: null, heading: null };
    setIsInfoCardCollapsed(false);
    setInfoCardOpenNonce((current) => current + 1);
    setRouteStatus(status);
    setRouteSummary(`${summaryPrefix}Routes: ${routeCount} | Chosen route: ${chosenIndex} | Points: ${decodedRoute.length}`);
    if (isDirectionsPreview) {
      setIsRouteDetailsVisible(true);
      isFollowingTruckRef.current = false;
      setIsFollowingTruck(false);
      hasEnteredFollowModeRef.current = false;
    }
    recordRouteSessionEvent(speakRouteStart ? 'route_started' : 'route_updated', {
      severity: selectedHazardSummary?.severity === 'critical' ? 'critical' : 'info',
      coordinate: nextOriginCoordinate || truckCoordinate,
      payload: {
        destinationAddress,
        routeCount,
        chosenRouteIndex: chosenIndex,
        hazardSummary: selectedHazardSummary,
        rerouteRecommendation: data.rerouteRecommendation || null,
      },
      dedupeKey: `route-data:${data.routeSessionId || chosenIndex}`,
      dedupeMs: 1000,
    });

    const routeStartMessage = speakRouteStart
      ? buildRouteStartVoicePrompt(selectedSteps, selectedHazards)
      : null;
    const messageToSpeak = speakMessage || routeStartMessage;

    if (messageToSpeak) {
      Vibration.vibrate([0, 250, 120, 250]);
      if (routeStartVoiceTimerRef.current) {
        clearTimeout(routeStartVoiceTimerRef.current);
      }
      routeStartVoiceTimerRef.current = setTimeout(() => {
        speakNavigationAlert(messageToSpeak, { interrupt: false });
      }, 900);
    }
  };

  useEffect(() => {
    if (!chosenRoute || !routeCoordinates.length) return undefined;

    const timer = setTimeout(() => {
      setIsInfoCardCollapsed(true);
    }, INFO_CARD_AUTO_COLLAPSE_MS);

    return () => clearTimeout(timer);
  }, [chosenRoute, routeCoordinates.length, selectedRouteIndex, infoCardOpenNonce]);

  useEffect(() => {
    routeProjectionSegmentRef.current = null;
  }, [routeCoordinates]);

  useEffect(() => {
    latestTruckHeadingRef.current = truckHeading;
  }, [truckHeading]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentClockTime(new Date());
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (autoRefollowTimerRef.current) {
      clearTimeout(autoRefollowTimerRef.current);
      autoRefollowTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (
      chosenRoute &&
      Number.isFinite(distanceToDestinationMeters) &&
      distanceToDestinationMeters <= ARRIVAL_DISTANCE_METERS &&
      !hasArrived
    ) {
      setHasArrived(true);
      Vibration.vibrate([0, 350, 150, 350]);
      speakNavigationAlert('You have arrived at your destination.');
      recordRouteSessionEvent('arrived', {
        severity: 'info',
        payload: {
          destinationAddress,
          distanceToDestinationMeters,
        },
        dedupeKey: 'arrived',
        dedupeMs: 60000,
      });

      if (routeManifestStopId && routeManifestDriverId && !manifestArrivalSyncedRef.current) {
        manifestArrivalSyncedRef.current = true;
        updateAssignedRouteStopStatus(routeManifestStopId, {
          status: 'arrived',
          routeDate: routeManifestDate,
        }, {
          driverId: routeManifestDriverId,
          driverName: routeManifestDriverName,
        }).catch(() => {
          manifestArrivalSyncedRef.current = false;
        });
      }
    }
  }, [
    chosenRoute,
    destinationAddress,
    distanceToDestinationMeters,
    hasArrived,
    routeManifestDate,
    routeManifestDriverId,
    routeManifestDriverName,
    routeManifestStopId,
  ]);

  useEffect(() => {
    if (!routeCoordinates.length || !mapRef.current) return;

    const timer = setTimeout(() => {
      if (hasEnteredFollowModeRef.current && truckCoordinate) return;

      mapRef.current?.fitToCoordinates(routeCoordinates, {
        edgePadding: {
          top: 80,
          right: 50,
          bottom: 300,
          left: 50,
        },
        animated: true,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [routeCoordinates, truckCoordinate]);

  useEffect(() => {
    if (isDirectionsPreview) return undefined;
    if (!routeCoordinates.length || !truckCoordinate || !mapRef.current) return;

    const timer = setTimeout(() => {
      hasEnteredFollowModeRef.current = true;
      isFollowingTruckRef.current = true;
      mapHeadingRef.current = normalizeHeadingDegrees(truckHeading);
      setIsFollowingTruck(true);
      mapRef.current?.animateCamera(
        {
          center: getNavigationCameraCenter(truckCoordinate, truckHeading),
          heading: truckHeading,
          pitch: NAV_CAMERA_PITCH,
          zoom: NAV_CAMERA_ZOOM,
        },
        { duration: 850 }
      );
    }, 1400);

    return () => clearTimeout(timer);
  }, [routeCoordinates.length, isDirectionsPreview]);

  useEffect(() => {
    if (!chosenRoute || !liveCoordinate) return;
    loadLiveProximityHazards(liveCoordinate);
  }, [chosenRoute, liveCoordinate]);

  useEffect(() => {
    setNextInstruction(getUpcomingInstruction(truckCoordinate, routeSteps));
  }, [truckCoordinate, routeSteps]);

  useEffect(() => {
    if (!nextInstruction || !Number.isFinite(nextInstruction.distance_m)) return;

    const promptBase = nextInstruction.instruction.replace(/\.$/, '');

    if (nextInstruction.distance_m <= TURN_PROMPT_NEAR_METERS) {
      const promptKey = `${nextInstruction.stepIndex}:near`;
        if (!spokenTurnPromptRef.current.has(promptKey)) {
          const spoken = speakNavigationAlert(
            `In ${formatInstructionDistance(nextInstruction.distance_m)}, ${promptBase}.`
          );
          if (spoken) spokenTurnPromptRef.current.add(promptKey);
        }
      return;
    }

    if (nextInstruction.distance_m <= TURN_PROMPT_FAR_METERS) {
      const promptKey = `${nextInstruction.stepIndex}:far`;
        if (!spokenTurnPromptRef.current.has(promptKey)) {
          const spoken = speakNavigationAlert(
            `In ${formatInstructionDistance(nextInstruction.distance_m)}, ${promptBase}.`
          );
          if (spoken) spokenTurnPromptRef.current.add(promptKey);
        }
    }
  }, [nextInstruction]);

  useEffect(() => {
    if (!truckCoordinate || !routeCoordinates.length || selectedRouteIndex === null) return;

    const routeHazards = [
      ...(hazards.lowBridges || []).map((hazard) => ({ type: 'low_bridge', hazard, priority: 1 })),
      ...(hazards.noTruckZones || []).map((hazard) => ({ type: 'no_truck', hazard, priority: 2 })),
      ...(hazards.residentialZones || []).map((hazard) => ({ type: 'residential', hazard, priority: 3 })),
    ]
      .map((item) => {
        const coordinate = normalizeHazardCoordinate(item.hazard);
        const distanceAheadMeters = getDistanceAheadOnRouteMeters(
          truckCoordinate,
          coordinate,
          routeCoordinates
        );

        return {
          ...item,
          coordinate,
          distanceAheadMeters,
        };
      })
      .filter((item) => item.coordinate && Number.isFinite(item.distanceAheadMeters))
      .sort((a, b) => (
        a.priority - b.priority ||
        a.distanceAheadMeters - b.distanceAheadMeters
      ));

    const alertCandidate = routeHazards.find((item) => (
      item.distanceAheadMeters <= ROUTE_HAZARD_FAR_ALERT_METERS
    ));
    if (!alertCandidate) return;

    const alertLevel =
      alertCandidate.distanceAheadMeters <= ROUTE_HAZARD_NEAR_ALERT_METERS
        ? 'near'
        : 'far';
    const alertKey = `${selectedRouteIndex}:${alertCandidate.type}:${alertCandidate.hazard.id || alertCandidate.coordinate.latitude}:${alertLevel}`;
    if (spokenRouteHazardPromptRef.current.has(alertKey)) return;

    spokenRouteHazardPromptRef.current.add(alertKey);
    Vibration.vibrate(alertLevel === 'near' ? [0, 400, 150, 400] : 250);
    speakNavigationAlert(
      buildRouteHazardAlertMessage(
        alertCandidate.type,
        alertCandidate.hazard,
        alertCandidate.distanceAheadMeters
      )
    );
    recordRouteSessionEvent('route_hazard_warning', {
      severity: alertCandidate.type === 'low_bridge' ? 'critical' : 'warning',
      coordinate: alertCandidate.coordinate,
      payload: {
        hazardType: alertCandidate.type,
        alertLevel,
        distanceAheadMeters: alertCandidate.distanceAheadMeters,
        hazard: alertCandidate.hazard,
      },
      dedupeKey: alertKey,
      dedupeMs: 60000,
    });
  }, [truckCoordinate, routeCoordinates, hazards, selectedRouteIndex]);

  useEffect(() => {
    if (!isOverCompanySpeedLimit) {
      setSpeedBlinkOn(false);
      return undefined;
    }

    const timer = setInterval(() => {
      setSpeedBlinkOn((current) => !current);
    }, 500);

    return () => clearInterval(timer);
  }, [isOverCompanySpeedLimit]);

  const requestRerouteFromCurrentLocation = async (trigger = 'auto') => {
    const cleanedDestination = destinationAddress.trim();
    if (!cleanedDestination || !liveCoordinate || isReroutingRef.current) return;

    isReroutingRef.current = true;
    setIsRerouting(true);
    setRouteStatus('Recalculating safe route...');
    setRouteSummary('Driver is off route. Requesting a new truck-safe route.');
    setOffRouteFlow({
      status: 'rerouting',
      message: 'Calculating a new truck-safe route from your current location.',
    });

    try {
      const { response, data } = await requestSafeRoute({
        origin: {
          lat: liveCoordinate.latitude,
          lng: liveCoordinate.longitude,
        },
        destinationAddress: cleanedDestination,
        destinationPlaceId,
        truck: truckProfile,
        reroute: {
          trigger,
          previousRouteSessionId: routeSessionIdRef.current,
          routeDeviationMeters: Number.isFinite(routeDeviationMeters) ? routeDeviationMeters : null,
        },
      });

      if (!response.ok) {
        throw new Error(`${data?.error || data?.detail || `HTTP ${response.status}`} | ${API_BASE_URL}`);
      }

      rerouteCooldownUntilRef.current = Date.now() + OFF_ROUTE_REROUTE_COOLDOWN_MS;
      setOffRouteFlow({
        status: 'on_route',
        message: '',
      });
      applySafeRouteData(data, liveCoordinate, {
        status: 'Safe route recalculated.',
        summaryPrefix: 'Rerouted | ',
        speakMessage: trigger === 'manual'
          ? 'Manual reroute complete. New truck safe route calculated.'
          : 'New truck safe route calculated.',
      });
    } catch (error) {
      rerouteCooldownUntilRef.current = Date.now() + OFF_ROUTE_REROUTE_COOLDOWN_MS;
      setRouteStatus('Reroute request failed.');
      setRouteSummary(error.message || `Unable to request reroute from ${API_BASE_URL}`);
      setOffRouteFlow({
        status: 'failed',
        message: error.message || 'Unable to request a new truck-safe route.',
      });
    } finally {
      isReroutingRef.current = false;
      setIsRerouting(false);
    }
  };

  const publishMotionState = ({
    liveCoordinate: nextCoordinate,
    displayCoordinate,
    heading,
    speedMph,
    deviationMeters,
  }) => {
    const now = Date.now();
    const last = lastMotionStatePublishRef.current;
    const coordinateMoved = !coordinatesAreNear(
      last.liveCoordinate,
      nextCoordinate,
      MOTION_POSITION_MIN_METERS
    );
    const displayMoved = !coordinatesAreNear(
      last.displayCoordinate,
      displayCoordinate,
      MOTION_POSITION_MIN_METERS
    );
    const headingChanged = hasMeaningfulHeadingChange(last.heading, heading);
    const speedChanged =
      Math.abs((Number(speedMph) || 0) - (Number(last.speedMph) || 0)) >= MOTION_SPEED_MIN_MPH;
    const deviationChanged =
      Math.abs((Number(deviationMeters) || 0) - (Number(last.deviationMeters) || 0)) >=
      MOTION_DEVIATION_MIN_METERS;
    const shouldPublish =
      !last.at ||
      now - last.at >= MOTION_STATE_MIN_INTERVAL_MS ||
      (
        deviationChanged &&
        (
          !Number.isFinite(last.deviationMeters) ||
          (last.deviationMeters <= OFF_ROUTE_WARNING_THRESHOLD_METERS) !==
            (deviationMeters <= OFF_ROUTE_WARNING_THRESHOLD_METERS)
        )
      );

    if (!shouldPublish) return;

    lastMotionStatePublishRef.current = {
      at: now,
      liveCoordinate: nextCoordinate,
      displayCoordinate,
      heading,
      speedMph,
      deviationMeters,
    };

    if (coordinateMoved || !last.liveCoordinate) {
      setLiveCoordinate(nextCoordinate);
    }
    if (displayMoved || !last.displayCoordinate) {
      setDisplayedTruckPosition(displayCoordinate, true);
    }
    if (deviationChanged || !Number.isFinite(last.deviationMeters)) {
      setRouteDeviationMeters(deviationMeters);
    }
    if (headingChanged || !Number.isFinite(last.heading)) {
      setTruckHeading(heading);
    }
    if (speedChanged || !Number.isFinite(last.speedMph)) {
      setCurrentSpeedMph(speedMph);
    }
  };

  useEffect(() => {
    if (!routeCoordinates.length) return undefined;

    let subscription = null;
    let cancelled = false;

    async function startLocationTracking() {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled || permission.status !== 'granted') return;

      subscription = await Location.watchPositionAsync(
        {
          accuracy: NAVIGATION_LOCATION_ACCURACY,
          distanceInterval: LOCATION_DISTANCE_INTERVAL_METERS,
          timeInterval: LOCATION_TIME_INTERVAL_MS,
          mayShowUserSettingsDialog: true,
        },
        (position) => {
          const sampleTimestamp = Number(position.timestamp) || Date.now();
          const nextCoordinate = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          const previousSample = lastLocationSampleRef.current;
          const routeProjection = getNearestRouteProjection(nextCoordinate, routeCoordinates, {
            hintSegmentIndex: routeProjectionSegmentRef.current,
          });
          if (Number.isInteger(routeProjection?.segmentIndex)) {
            const previousSegmentIndex = routeProjectionSegmentRef.current;
            routeProjectionSegmentRef.current =
              previousSegmentIndex == null
                ? routeProjection.segmentIndex
                : Math.max(previousSegmentIndex, routeProjection.segmentIndex);
          }
          const distance = routeProjection?.distanceMeters ?? getNearestRouteDistanceMeters(nextCoordinate, routeCoordinates);
          const speedResult = calculateLocationSpeedMph(
            position,
            nextCoordinate,
            previousSample,
            routeCoordinates
          );
          const heading = calculateNavigationHeading(
            position,
            nextCoordinate,
            previousSample,
            routeCoordinates,
            speedResult.speedMph,
            lastHeadingRef.current,
            distance,
            routeProjection
          );
          const smoothedSpeedMph = smoothSpeedMph(
            speedResult.speedMph,
            lastSpeedMphRef.current
          );
          const smoothedHeading = interpolateHeadingDegrees(
            lastHeadingRef.current,
            heading,
            Number.isFinite(smoothedSpeedMph) && smoothedSpeedMph >= 35 ? 0.42 : HEADING_SMOOTHING_ALPHA
          );
          const predictionMeters =
            Number.isFinite(smoothedSpeedMph)
              ? smoothedSpeedMph * MPH_TO_METERS_PER_SECOND * MOTION_PREDICTION_SECONDS
              : 0;
          const routeMotionCoordinate =
            routeProjection?.coordinate &&
            Number.isFinite(distance) &&
            distance <= OFF_ROUTE_WARNING_THRESHOLD_METERS
              ? (
                  getCoordinateAheadFromRouteProjection(
                    routeProjection,
                    routeCoordinates,
                    predictionMeters
                  ) || routeProjection.coordinate
                )
              : null;
          const motionCoordinate = routeMotionCoordinate
            ? buildDisplayedTruckCoordinate(
                routeMotionCoordinate,
                smoothedHeading,
                distance
              )
            : getPredictedTruckCoordinate(
                nextCoordinate,
                smoothedHeading,
                smoothedSpeedMph
              );
          const previousVehicleUpdateAt = lastVehicleUpdateAtRef.current;
          const vehicleSampleIntervalMs = previousVehicleUpdateAt
            ? sampleTimestamp - previousVehicleUpdateAt
            : LOCATION_TIME_INTERVAL_MS;
          lastLocationSampleRef.current = speedResult.sample;
          lastSpeedMphRef.current = smoothedSpeedMph;
          lastSpeedUpdateAtRef.current = Date.now();
          lastHeadingRef.current = smoothedHeading;
          lastVehicleUpdateAtRef.current = sampleTimestamp;
          latestTruckCoordinateRef.current = motionCoordinate;
          latestTruckHeadingRef.current = smoothedHeading;

          vehicleLayerRef.current?.updateVehicle({
            position: motionCoordinate,
            heading: smoothedHeading,
            mapHeading: mapHeadingRef.current,
            durationMs: clamp(
              vehicleSampleIntervalMs * 1.05,
              450,
              1000
            ),
          });
          followTruckCamera(
            routeMotionCoordinate || motionCoordinate,
            smoothedHeading,
            vehicleSampleIntervalMs,
            smoothedSpeedMph
          );

          publishMotionState({
            liveCoordinate: nextCoordinate,
            displayCoordinate: motionCoordinate,
            heading: smoothedHeading,
            speedMph: smoothedSpeedMph,
            deviationMeters: distance,
          });
          maybeRecordGpsTrace(nextCoordinate, smoothedHeading, smoothedSpeedMph);

          if (
            chosenRoute &&
            !isFollowingTruckRef.current &&
            Number.isFinite(smoothedSpeedMph) &&
            smoothedSpeedMph >= MOVING_REFOLLOW_SPEED_MPH &&
            Date.now() - lastUserPanAtRef.current > AUTO_REFOLLOW_AFTER_PAN_MS
          ) {
            restoreFollowMode(520);
          }
        }
      );
    }

    startLocationTracking();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [routeCoordinates]);

  useEffect(() => {
    if (!routeCoordinates.length) return undefined;

    const timer = setInterval(() => {
      const lastUpdateAt = lastSpeedUpdateAtRef.current;
      if (!lastUpdateAt || Date.now() - lastUpdateAt < SPEED_STALE_MS) return;

      setCurrentSpeedMph((currentSpeed) => {
        if (!Number.isFinite(currentSpeed)) return currentSpeed;

        const decayedSpeed = currentSpeed * 0.78;
        const nextSpeed = decayedSpeed < 1 ? 0 : decayedSpeed;
        lastSpeedMphRef.current = nextSpeed;
        return nextSpeed;
      });
    }, SPEED_DECAY_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [routeCoordinates.length]);

  useEffect(() => {
    if (!Number.isFinite(routeDeviationMeters)) return;

    if (routeDeviationMeters <= OFF_ROUTE_RESET_THRESHOLD_METERS) {
      offRouteAlertActiveRef.current = false;
      offRouteSinceRef.current = null;
      setOffRouteFlow({
        status: 'on_route',
        message: '',
      });
      return;
    }

    if (routeDeviationMeters <= OFF_ROUTE_WARNING_THRESHOLD_METERS) {
      setOffRouteFlow({
        status: 'monitoring',
        message: buildOffRouteBannerMessage(routeDeviationMeters),
      });
      return;
    }

    if (!offRouteSinceRef.current) {
      offRouteSinceRef.current = Date.now();
    }

    if (!offRouteAlertActiveRef.current) {
      offRouteAlertActiveRef.current = true;
      setOffRouteFlow({
        status: 'warning',
        message: buildOffRouteBannerMessage(routeDeviationMeters),
      });
      Vibration.vibrate([0, 250, 150, 250]);
      speakNavigationAlert('Warning. You are off the selected truck safe route.');
      recordRouteSessionEvent('off_route_warning', {
        severity: 'warning',
        payload: {
          routeDeviationMeters,
        },
        dedupeKey: 'off-route-warning',
        dedupeMs: OFF_ROUTE_REROUTE_COOLDOWN_MS,
      });
    }
    setOffRouteFlow((current) => (
      current.status === 'rerouting'
        ? current
        : {
            status: 'warning',
            message: buildOffRouteBannerMessage(routeDeviationMeters),
          }
    ));

    const offRouteDurationMs = Date.now() - offRouteSinceRef.current;
    const canRequestReroute =
      offRouteDurationMs >= OFF_ROUTE_REROUTE_CONFIRM_MS &&
      Date.now() >= rerouteCooldownUntilRef.current &&
      !isReroutingRef.current &&
      Boolean(liveCoordinate) &&
      Boolean(chosenRoute);

    if (canRequestReroute) {
      recordRouteSessionEvent('reroute_requested', {
        severity: 'warning',
        payload: {
          routeDeviationMeters,
          offRouteDurationMs,
        },
        dedupeKey: 'reroute-requested',
        dedupeMs: OFF_ROUTE_REROUTE_COOLDOWN_MS,
      });
      requestRerouteFromCurrentLocation();
    }
  }, [routeDeviationMeters, liveCoordinate, chosenRoute]);

  useEffect(() => {
    if (!Number.isFinite(currentSpeedMph)) return;

    const now = Date.now();
    if (currentSpeedMph >= SPEED_OVER_LIMIT_TRIGGER_MPH) {
      speedApproachingSinceRef.current = null;
      speedOverSinceRef.current = speedOverSinceRef.current || now;
      if (
        speedAlertLevelRef.current !== 'over' &&
        now - speedOverSinceRef.current >= SPEED_ALERT_CONFIRM_MS
      ) {
        speedAlertLevelRef.current = 'over';
        Vibration.vibrate([0, 300, 120, 300]);
        speakNavigationAlert('Warning. You have exceeded 65 miles per hour. Slow down.');
        recordRouteSessionEvent('speed_over_limit', {
          severity: 'warning',
          payload: {
            speedMph: currentSpeedMph,
            speedLimitMph: COMPANY_SPEED_LIMIT_MPH,
          },
          dedupeKey: 'speed-over-limit',
          dedupeMs: 60000,
        });
      }
      return;
    }

    speedOverSinceRef.current = null;
    if (currentSpeedMph >= SPEED_APPROACHING_LIMIT_MPH) {
      speedApproachingSinceRef.current = speedApproachingSinceRef.current || now;
      if (
        speedAlertLevelRef.current === 'clear' &&
        now - speedApproachingSinceRef.current >= SPEED_ALERT_CONFIRM_MS
      ) {
        speedAlertLevelRef.current = 'approaching';
        Vibration.vibrate(250);
        speakNavigationAlert('Caution. You are approaching 65 miles per hour.');
        recordRouteSessionEvent('speed_approaching_limit', {
          severity: 'medium',
          payload: {
            speedMph: currentSpeedMph,
            speedLimitMph: COMPANY_SPEED_LIMIT_MPH,
          },
          dedupeKey: 'speed-approaching-limit',
          dedupeMs: 60000,
        });
      }
      return;
    }

    speedApproachingSinceRef.current = null;
    if (currentSpeedMph < 58) {
      speedAlertLevelRef.current = 'clear';
    }
  }, [currentSpeedMph]);

  useEffect(() => {
    if (!lowBridgeHazards.length || selectedRouteIndex === null) return;

    const firstHazard = lowBridgeHazards[0];
    const alertKey = `${selectedRouteIndex}:${firstHazard.id || lowBridgeHazards.length}`;
    if (lastHazardAlertKeyRef.current === alertKey) return;

    lastHazardAlertKeyRef.current = alertKey;
    Vibration.vibrate([0, 350, 150, 350]);
    speakNavigationAlert('Critical warning. Low clearance hazard detected on the selected route.');
  }, [lowBridgeHazards, selectedRouteIndex]);

  useEffect(() => {
    let cancelled = false;

    async function loadSafeRoute() {
      const cleanedDestination = destinationAddress.trim();
      if (!cleanedDestination) {
        setRouteStatus('No destination provided.');
        setRouteSummary('');
        return;
      }

      setRouteStatus('Requesting safe route...');
      setRouteSummary('');
      setOriginNote('');
      setLiveCoordinate(null);
      setDisplayedTruckCoordinate(null);
      displayedTruckCoordinateRef.current = null;
      setRouteDeviationMeters(null);
      setTruckHeading(0);
      setCurrentSpeedMph(null);
      lastLocationSampleRef.current = null;
      lastSpeedMphRef.current = null;
      lastSpeedUpdateAtRef.current = null;
      lastHeadingRef.current = 0;
      if (markerAnimationTimerRef.current) {
        clearInterval(markerAnimationTimerRef.current);
        markerAnimationTimerRef.current = null;
      }
      if (autoRefollowTimerRef.current) {
        clearTimeout(autoRefollowTimerRef.current);
        autoRefollowTimerRef.current = null;
      }
      if (routeStartVoiceTimerRef.current) {
        clearTimeout(routeStartVoiceTimerRef.current);
        routeStartVoiceTimerRef.current = null;
      }
      speedAlertLevelRef.current = 'clear';
      speedApproachingSinceRef.current = null;
      speedOverSinceRef.current = null;
      offRouteSinceRef.current = null;
      offRouteAlertActiveRef.current = false;
      isReroutingRef.current = false;
      rerouteCooldownUntilRef.current = 0;
      setIsRerouting(false);
      hasEnteredFollowModeRef.current = false;
      setIsFollowingTruck(false);
      setIsInfoCardCollapsed(false);
      setRouteCoordinates([]);
      setRouteSteps([]);
      setRouteOptions([]);
      setSelectedRouteIndex(null);
      setNextInstruction(null);
      spokenTurnPromptRef.current = new Set();
      spokenRouteHazardPromptRef.current = new Set();
      setChosenRoute(null);
      setUsedTruckProfile(truckProfile);
      setHazardSummary({
        total: 0,
        lowBridgeCount: 0,
        noTruckZoneCount: 0,
        residentialZoneCount: 0,
        severity: 'clear',
      });
      setRouteVerification(null);
      setRouteVerificationByIndex({});
      setHazards({
        lowBridges: [],
        noTruckZones: [],
        residentialZones: [],
      });

      try {
        setRouteStatus('Getting current location...');

        let originPayload = {
          originAddress: 'San Antonio, TX',
        };
        let routeOriginCoordinate = TEST_COORDINATE;

        const permission = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;

        if (permission.status === 'granted') {
          const initialLocation = await getInitialNavigationPosition();
          if (cancelled) return;

          const currentPosition = initialLocation?.position;
          if (!currentPosition?.coords) {
            setOriginCoordinate(TEST_COORDINATE);
            setOriginNote('Location is still warming up. Using San Antonio fallback.');
            routeOriginCoordinate = TEST_COORDINATE;
          } else {
            const currentOrigin = {
              latitude: currentPosition.coords.latitude,
              longitude: currentPosition.coords.longitude,
            };

            setOriginCoordinate(currentOrigin);
            setLiveCoordinate(currentOrigin);
            setDisplayedTruckPosition(currentOrigin, false);
            lastLocationSampleRef.current = {
              coordinate: currentOrigin,
              timestamp: Number(currentPosition.timestamp) || Date.now(),
            };
            const rawInitialSpeedMph = metersPerSecondToMph(currentPosition.coords.speed);
            const initialSpeedMph =
              isReasonableTruckSpeed(rawInitialSpeedMph) && rawInitialSpeedMph >= IDLE_SPEED_FLOOR_MPH
                ? rawInitialSpeedMph
                : 0;
            const initialHeading = normalizeHeadingDegrees(currentPosition.coords.heading) ?? 0;
            lastSpeedMphRef.current = initialSpeedMph;
            lastSpeedUpdateAtRef.current = Number.isFinite(initialSpeedMph) ? Date.now() : null;
            lastHeadingRef.current = initialHeading;
            setTruckHeading(initialHeading);
            setCurrentSpeedMph(initialSpeedMph);
            setOriginNote(
              initialLocation.source === 'lastKnown'
                ? 'Using recent phone location while GPS refreshes.'
                : 'Using current phone location.'
            );
            routeOriginCoordinate = currentOrigin;
            originPayload = {
              origin: {
                lat: currentOrigin.latitude,
                lng: currentOrigin.longitude,
              },
            };
          }
        } else {
          setOriginCoordinate(TEST_COORDINATE);
          setOriginNote('Location permission denied. Using San Antonio fallback.');
          routeOriginCoordinate = TEST_COORDINATE;
        }

        setRouteStatus('Requesting safe route...');

        const { response, data } = await requestSafeRoute({
          ...originPayload,
          destinationAddress: cleanedDestination,
          destinationPlaceId,
          truck: truckProfile,
        });
        if (cancelled) return;

        if (!response.ok) {
          setRouteStatus('Backend route request failed.');
          setRouteSummary(`${data?.error || data?.detail || `HTTP ${response.status}`} | ${API_BASE_URL}`);
          return;
        }

        if (!Array.isArray(data.routes) || data.routes.length === 0) {
          setRouteStatus('Backend returned no route.');
          setRouteSummary(`No drawable route was returned from ${API_BASE_URL}`);
          return;
        }

        applySafeRouteData(data, routeOriginCoordinate, {
          speakRouteStart: !isDirectionsPreview,
          status: isDirectionsPreview ? 'Route ready.' : 'Safe route returned.',
        });
      } catch (error) {
        if (cancelled) return;
        setRouteStatus('Could not reach backend.');
        setRouteSummary(`${error.message || 'Network request failed'} | ${API_BASE_URL}`);
      }
    }

    loadSafeRoute();

    return () => {
      cancelled = true;
    };
  }, [destinationAddress, destinationPlaceId, truckProfile, isDirectionsPreview]);

  const goBackToPreviousPage = () => {
    if (isReturningToDestinationRef.current) return;
    isReturningToDestinationRef.current = true;

    if (routeManifestStopId) {
      navigation?.navigate?.('TodayRoute', {
        driverId: routeManifestDriverId,
        driverName: routeManifestDriverName,
      });
      return;
    }

    const returnDestination = {
      address: destinationAddress,
      placeId: destinationDetails?.placeId || destinationPlaceId || null,
      details: destinationDetails,
    };

    if (navigation?.reset) {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'Home',
            params: {
              returnDestination,
              returnDestinationToken: Date.now(),
            },
          },
        ],
      });
      return;
    }

    navigation?.navigate?.('Home', {
      returnDestination,
      returnDestinationToken: Date.now(),
    });
  };

  const renderDirectionsContent = () => (
    <>
      {routeSteps.length === 0 ? (
        <View style={styles.directionsOriginCard}>
          <Text style={styles.directionsOriginLabel}>Directions are loading</Text>
          <Text style={styles.directionsOriginText} numberOfLines={1}>
            {routeStatus || 'Calculating from current location.'}
          </Text>
        </View>
      ) : (
        <View style={styles.directionsPreviewList}>
          {routeSteps.map((step, index) => {
            const rowOffset = getDirectionsRowOffset(index);
            const rowOpacity = directionsScrollYRef.current.interpolate({
              inputRange: [
                rowOffset - 520,
                rowOffset - 260,
                rowOffset + 60,
                rowOffset + 250,
              ],
              outputRange: [0.42, 0.76, 1, 0.58],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={`${step.index}-${index}-${step.instruction}`}
                style={[
                  styles.directionsPreviewStep,
                  { opacity: rowOpacity },
                  index === 0 && styles.directionsPreviewStepPrimary,
                  index === routeSteps.length - 1 && styles.directionsPreviewStepLast,
                ]}
              >
                <View style={styles.directionsPreviewIconWrap}>
                  <Text
                    style={[
                      styles.directionsPreviewIcon,
                      index === 0 && styles.directionsPreviewIconPrimary,
                    ]}
                  >
                    {getManeuverSymbol(step.maneuver)}
                  </Text>
                </View>
                <View style={styles.directionsPreviewTextWrap}>
                  <Text
                    style={[
                      styles.directionsPreviewDistance,
                      index === 0 && styles.directionsPreviewDistancePrimary,
                    ]}
                  >
                    {formatInstructionDistance(step.distance_m) || 'Next'}
                  </Text>
                  <Text
                    style={[
                      styles.directionsPreviewInstruction,
                      index === 0 && styles.directionsPreviewInstructionPrimary,
                    ]}
                  >
                    {step.instruction || 'Continue'}
                  </Text>
                </View>
              </Animated.View>
            );
          })}
        </View>
      )}
    </>
  );

  if (isDirectionsPreview) {
    return (
      <SafeAreaView
        style={[styles.container, styles.directionsOnlyContainer]}
        edges={['top', 'left', 'right']}
      >
        <View style={styles.directionsPage}>
          <View style={styles.directionsPageHeader}>
            <Pressable
              onPress={goBackToPreviousPage}
              hitSlop={12}
              style={({ pressed }) => [
                styles.directionsBackButton,
                pressed && styles.directionsBackButtonPressed,
              ]}
            >
              <Text style={styles.directionsBackButtonText}>{'< Back'}</Text>
            </Pressable>
            <Text style={styles.directionsPageTitle}>Directions</Text>
            <View style={styles.directionsHeaderSpacer} />
          </View>

          <Animated.ScrollView
            style={styles.directionsPageScroll}
            contentContainerStyle={styles.directionsPageContent}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: directionsScrollYRef.current } } }],
              { useNativeDriver: true }
            )}
          >
            {renderDirectionsContent()}
          </Animated.ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right']}
    >
      {!isDirectionsPreview && (
        <>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: TEST_COORDINATE.latitude,
          longitude: TEST_COORDINATE.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsCompass={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        mapType={mapType}
        showsTraffic={true}
        pitchEnabled={true}
        rotateEnabled={true}
        onPanDrag={handleMapPanDrag}
        onRegionChangeComplete={handleMapRegionChangeComplete}
      >
        {routeOptions
          .filter((option) => option.index !== selectedRouteIndex)
          .map((option) => (
            <React.Fragment key={`route-alt-${option.index}`}>
              <Polyline
                coordinates={option.coordinates}
                strokeColor={ALTERNATE_ROUTE_SHADOW_COLOR}
                strokeWidth={8}
                zIndex={1}
                lineCap="round"
                lineJoin="round"
                tappable={true}
                onPress={() => selectRouteOption(option)}
              />
              <Polyline
                coordinates={option.coordinates}
                strokeColor={ALTERNATE_ROUTE_COLOR}
                strokeWidth={5}
                zIndex={2}
                lineCap="round"
                lineJoin="round"
                tappable={true}
                onPress={() => selectRouteOption(option)}
              />
            </React.Fragment>
          ))}

        {displayedRouteCoordinates.length > 0 && (
          <>
            <Polyline
              coordinates={displayedRouteCoordinates}
              strokeColor={ACTIVE_ROUTE_SHADOW_COLOR}
              strokeWidth={26}
              zIndex={3}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline
              coordinates={displayedRouteCoordinates}
              strokeColor={ACTIVE_ROUTE_CASING_COLOR}
              strokeWidth={21}
              zIndex={4}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline
              coordinates={displayedRouteCoordinates}
              strokeColor={ACTIVE_ROUTE_MAIN_COLOR}
              strokeWidth={16}
              zIndex={5}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline
              coordinates={displayedRouteCoordinates}
              strokeColor={ACTIVE_ROUTE_HIGHLIGHT_COLOR}
              strokeWidth={5}
              zIndex={6}
              lineCap="round"
              lineJoin="round"
            />
          </>
        )}

        {showRouteConnector && (
          <>
            <Polyline
              coordinates={routeConnectorCoordinates}
              strokeColor={ROUTE_CONNECTOR_SHADOW_COLOR}
              strokeWidth={8}
              lineDashPattern={ROUTE_CONNECTOR_DOT_PATTERN}
              lineCap="round"
              lineJoin="round"
              zIndex={8}
            />
            <Polyline
              coordinates={routeConnectorCoordinates}
              strokeColor={ROUTE_CONNECTOR_DOT_COLOR}
              strokeWidth={5}
              lineDashPattern={ROUTE_CONNECTOR_DOT_PATTERN}
              lineCap="round"
              lineJoin="round"
              zIndex={9}
            />
          </>
        )}

        <VehicleLayer
          ref={vehicleLayerRef}
          map={mapRef}
          position={laneAdjustedTruckCoordinate || routeSnappedTruckCoordinate || truckCoordinate}
          heading={truckHeading}
          mapHeading={vehicleLayerMapHeading}
          isFollowing={isFollowingTruck}
          scale={1}
        />

        {destinationCoordinate && (
          <Marker
            coordinate={destinationCoordinate}
            anchor={{ x: 0.5, y: 1 }}
            title="Destination"
            description={destinationAddress}
          >
            <DestinationMarker />
          </Marker>
        )}

        {mapHazardMarkers.lowBridges.map((hazard, index) => {
          const coordinate = normalizeHazardCoordinate(hazard);
          if (!coordinate) return null;

          return (
            <Marker
              key={getHazardMarkerIdentity(hazard, 'low_bridge', index)}
              coordinate={coordinate}
              anchor={{ x: 0.5, y: 0.5 }}
              title="Low-clearance hazard"
              description={
                hazard.clearance_ft
                  ? `Clearance: ${hazard.clearance_ft} ft`
                  : 'Low-clearance bridge near route'
              }
            >
              <LowBridgeMarker />
            </Marker>
          );
        })}

        {mapHazardMarkers.noTruckZones.map((hazard, index) => {
          const coordinate = normalizeHazardCoordinate(hazard);
          if (!coordinate) return null;

          return (
            <Marker
              key={getHazardMarkerIdentity(hazard, 'no_truck', index)}
              coordinate={coordinate}
              anchor={{ x: 0.5, y: 0.5 }}
              title="No-truck restriction"
              description={hazard.name || hazard.road || hazard.description || 'Truck restriction near route'}
              zIndex={30}
            >
              <NoTruckMarker />
            </Marker>
          );
        })}

        {mapHazardMarkers.residentialZones.map((hazard, index) => {
          const coordinate = normalizeHazardCoordinate(hazard);
          if (!coordinate) return null;

          return (
            <Marker
              key={getHazardMarkerIdentity(hazard, 'residential', index)}
              coordinate={coordinate}
              anchor={{ x: 0.5, y: 0.5 }}
              title="Residential restriction"
              description={hazard.name || hazard.road || hazard.description || 'Residential no-through-truck area'}
              zIndex={11}
            >
              <ResidentialMarker />
            </Marker>
          );
        })}
      </MapView>

      <Pressable
        onPressIn={goBackToPreviousPage}
        hitSlop={18}
        style={({ pressed }) => [
          styles.mapBackButton,
          pressed && styles.mapBackButtonPressed,
        ]}
      >
        <Text style={styles.mapBackButtonText}>{'< Back'}</Text>
      </Pressable>

      {showOffRouteBanner && (
        <View
          style={[
            styles.offRouteBanner,
            offRouteFlow.status === 'failed' && styles.offRouteBannerFailed,
            offRouteFlow.status === 'rerouting' && styles.offRouteBannerRerouting,
          ]}
        >
          <View style={styles.offRouteBannerTextBlock}>
            <Text style={styles.offRouteBannerLabel}>
              {offRouteFlow.status === 'rerouting'
                ? 'Rerouting'
                : offRouteFlow.status === 'failed'
                  ? 'Reroute failed'
                  : offRouteFlow.status === 'monitoring'
                    ? 'Route drift'
                    : 'Off route'}
            </Text>
            <Text style={styles.offRouteBannerMessage} numberOfLines={2}>
              {offRouteFlow.message || buildOffRouteBannerMessage(routeDeviationMeters)}
            </Text>
          </View>
          {(offRouteFlow.status === 'warning' || offRouteFlow.status === 'failed') && (
            <Pressable
              onPress={() => requestRerouteFromCurrentLocation('manual')}
              disabled={!canManuallyReroute}
              style={({ pressed }) => [
                styles.offRouteRerouteButton,
                !canManuallyReroute && styles.offRouteRerouteButtonDisabled,
                pressed && styles.offRouteRerouteButtonPressed,
              ]}
            >
              <Text style={styles.offRouteRerouteButtonText}>Reroute now</Text>
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.destinationTopBanner}>
        <Text style={styles.destinationTopLabel}>Destination</Text>
        <Text style={styles.destinationTopTitle} numberOfLines={1}>
          {destinationTitle}
        </Text>
        {!!destinationSubtitle && destinationSubtitle !== destinationTitle && (
          <Text style={styles.destinationTopSubtitle} numberOfLines={1}>
            {destinationSubtitle}
          </Text>
        )}
      </View>

      <View
        style={[
          styles.speedPanel,
          isOverCompanySpeedLimit && styles.speedPanelOverLimit,
          isOverCompanySpeedLimit && speedBlinkOn && styles.speedPanelBlink,
        ]}
      >
        <Text
          style={[
            styles.speedPanelLabel,
            isOverCompanySpeedLimit && styles.speedPanelTextOverLimit,
          ]}
        >
          Limit
        </Text>
        <Text
          style={[
            styles.speedLimitText,
            isOverCompanySpeedLimit && styles.speedPanelTextOverLimit,
          ]}
        >
          {COMPANY_SPEED_LIMIT_MPH}
        </Text>
        <Text
          style={[
            styles.speedPanelUnit,
            isOverCompanySpeedLimit && styles.speedPanelTextOverLimit,
          ]}
        >
          mph
        </Text>
        <View
          style={[
            styles.speedDivider,
            isOverCompanySpeedLimit && styles.speedDividerOverLimit,
          ]}
        />
        <Text
          style={[
            styles.speedPanelLabel,
            isOverCompanySpeedLimit && styles.speedPanelTextOverLimit,
          ]}
        >
          Speed
        </Text>
        <Text
          style={[
            styles.currentSpeedText,
            isOverCompanySpeedLimit && styles.speedPanelTextOverLimit,
          ]}
        >
          {formatSpeedMph(currentSpeedMph)}
        </Text>
      </View>

      <View style={styles.clockPanel}>
        <Text style={styles.clockText}>{formatClock(currentClockTime)}</Text>
      </View>

      <View style={styles.directionBadge}>
        <Text style={styles.directionBadgeText}>{headingLabel}</Text>
      </View>
      <View style={styles.compassPanel}>
        <Text style={[styles.compassPoint, styles.compassPointNorth]}>N</Text>
        <Text style={[styles.compassPoint, styles.compassPointEast]}>E</Text>
        <Text style={[styles.compassPoint, styles.compassPointSouth]}>S</Text>
        <Text style={[styles.compassPoint, styles.compassPointWest]}>W</Text>
        <View style={styles.compassCrossVertical} />
        <View style={styles.compassCrossHorizontal} />
        <View
          style={[
            styles.compassNeedle,
            { transform: [{ rotate: `${normalizeHeadingDegrees(360 - truckHeading)}deg` }] },
          ]}
        >
          <Text style={styles.compassNeedleNorth}>▲</Text>
          <Text style={styles.compassNeedleSouth}>▼</Text>
        </View>
      </View>

      <Pressable
        onPress={() => setIsRouteDetailsVisible((current) => !current)}
        style={({ pressed }) => [
          styles.routeDetailsButton,
          isRouteDetailsVisible && styles.routeDetailsButtonActive,
          pressed && styles.routeDetailsButtonPressed,
        ]}
      >
        <Text
          style={[
            styles.routeDetailsButtonText,
            isRouteDetailsVisible && styles.routeDetailsButtonTextActive,
          ]}
        >
          Route Details
        </Text>
      </Pressable>

      <Pressable
        onPress={recenterOnTruck}
        style={({ pressed }) => [
          styles.mapRecenterButton,
          pressed && styles.mapRecenterButtonPressed,
        ]}
      >
        <Text style={styles.mapRecenterButtonText}>Recenter</Text>
      </Pressable>

      {chosenRoute && !hasArrived && (
        <>
          <Pressable
            onPress={endRoute}
            style={({ pressed }) => [
              styles.mapEndRouteButton,
              pressed && styles.mapEndRouteButtonPressed,
            ]}
          >
            <Text style={styles.mapEndRouteButtonText}>End{'\n'}Route</Text>
          </Pressable>
          <Pressable
            onPress={startNewDestination}
            style={({ pressed }) => [
              styles.mapNewDestinationButton,
              pressed && styles.mapNewDestinationButtonPressed,
            ]}
          >
            <Text style={styles.mapNewDestinationButtonText}>New{'\n'}Dest</Text>
          </Pressable>
        </>
      )}

      <Pressable
        onPress={openHazardReport}
        style={({ pressed }) => [
          styles.reportHazardButton,
          pressed && styles.reportHazardButtonPressed,
        ]}
      >
        <Text style={styles.reportHazardButtonText}>Report Hazard</Text>
      </Pressable>

      {hasArrived && (
        <View style={styles.arrivalOverlay}>
          <View style={styles.arrivalCard}>
            <Text style={styles.arrivalTitle}>Destination reached</Text>
            <Text style={styles.arrivalText} numberOfLines={2}>
              {destinationTitle}
            </Text>
            {routeManifestStopId && (
              <AccountKnowledgePanel
                accountNumber={destinationDetails?.accountNumber || null}
                destination={destinationAddress}
                placeId={destinationPlaceId}
                routeStopId={routeManifestStopId}
                routeDate={routeManifestDate}
                driverId={routeManifestDriverId}
                driverName={routeManifestDriverName}
                compact
                onOpen={openArrivalDeliveryNotes}
              />
            )}
            <View style={styles.arrivalActionRow}>
              {routeManifestStopId && (
                <Pressable
                  onPress={openArrivalDeliveryNotes}
                  style={({ pressed }) => [
                    styles.arrivalNotesButton,
                    pressed && styles.arrivalEndButtonPressed,
                  ]}
                >
                  <Text style={styles.arrivalNotesButtonText}>Notes & Photos</Text>
                </Pressable>
              )}
              <Pressable
                onPress={endRoute}
                style={({ pressed }) => [
                  styles.arrivalEndButton,
                  pressed && styles.arrivalEndButtonPressed,
                ]}
              >
                <Text style={styles.arrivalEndButtonText}>
                  {routeManifestStopId ? 'Open Delivery' : 'End Route'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
        </>
      )}

      {isRouteDetailsVisible && (
        <View style={[
          styles.routeDetailsSheet,
          isDirectionsPreview && styles.routeDetailsSheetDirections,
        ]}>
          <View style={[
            styles.routeDetailsHeader,
            isDirectionsPreview && styles.routeDetailsHeaderDirections,
          ]}>
            {isDirectionsPreview && (
              <Pressable
                onPress={() => {
                  if (navigation?.canGoBack?.()) {
                    navigation.goBack();
                  } else {
                    navigation?.navigate?.('Home');
                  }
                }}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.directionsBackButton,
                  pressed && styles.directionsBackButtonPressed,
                ]}
              >
                <Text style={styles.directionsBackButtonText}>{'< Back'}</Text>
              </Pressable>
            )}
            <Text style={[
              styles.routeDetailsTitle,
              isDirectionsPreview && styles.routeDetailsTitleDirections,
            ]}>
              {isDirectionsPreview ? 'Directions' : 'Route details'}
            </Text>
            {isDirectionsPreview ? (
              <View style={styles.directionsHeaderSpacer} />
            ) : (
              <Pressable
                onPress={() => setIsRouteDetailsVisible(false)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.routeDetailsCloseButton,
                  pressed && styles.routeDetailsCloseButtonPressed,
                ]}
              >
                <Text style={styles.routeDetailsCloseText}>Hide</Text>
              </Pressable>
            )}
          </View>

          <Animated.ScrollView
            style={styles.routeDetailsContent}
            contentContainerStyle={styles.routeDetailsContentInner}
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={!isDirectionsPreview}
            scrollEventThrottle={16}
            onScroll={
              isDirectionsPreview
                ? Animated.event(
                    [{ nativeEvent: { contentOffset: { y: directionsScrollYRef.current } } }],
                    { useNativeDriver: true }
                  )
                : undefined
            }
          >
            {!isDirectionsPreview && (
              <Text style={styles.routeDetailsStatus} numberOfLines={1}>
                {routeStatus}
              </Text>
            )}

            {isDirectionsPreview && routeSteps.length === 0 && (
              <View style={styles.directionsOriginCard}>
                <Text style={styles.directionsOriginLabel}>Directions are loading</Text>
                <Text style={styles.directionsOriginText} numberOfLines={1}>
                  {routeStatus || 'Calculating from current location.'}
                </Text>
              </View>
            )}

            {isDirectionsPreview && (
              <View style={styles.directionsPreviewList}>
                {routeSteps.length > 0 ? (
                  routeSteps.map((step, index) => {
                    const rowOffset = getDirectionsRowOffset(index);
                    const rowOpacity = directionsScrollYRef.current.interpolate({
                      inputRange: [
                        rowOffset - 520,
                        rowOffset - 260,
                        rowOffset + 60,
                        rowOffset + 250,
                      ],
                      outputRange: [0.42, 0.76, 1, 0.58],
                      extrapolate: 'clamp',
                    });

                    return (
                      <Animated.View
                        key={`${step.index}-${index}-${step.instruction}`}
                        style={[
                          styles.directionsPreviewStep,
                          { opacity: rowOpacity },
                          index === 0 && styles.directionsPreviewStepPrimary,
                          index === routeSteps.length - 1 && styles.directionsPreviewStepLast,
                        ]}
                      >
                        <View style={styles.directionsPreviewIconWrap}>
                          <Text style={[
                            styles.directionsPreviewIcon,
                            index === 0 && styles.directionsPreviewIconPrimary,
                          ]}>
                            {getManeuverSymbol(step.maneuver)}
                          </Text>
                        </View>
                        <View style={styles.directionsPreviewTextWrap}>
                          <Text style={[
                            styles.directionsPreviewDistance,
                            index === 0 && styles.directionsPreviewDistancePrimary,
                          ]}>
                            {formatInstructionDistance(step.distance_m) || 'Next'}
                          </Text>
                          <Text style={[
                            styles.directionsPreviewInstruction,
                            index === 0 && styles.directionsPreviewInstructionPrimary,
                          ]}>
                            {step.instruction || 'Continue'}
                          </Text>
                        </View>
                      </Animated.View>
                    );
                  })
                ) : (
                  <View style={styles.directionsPreviewEmpty}>
                    <Text style={styles.directionsPreviewEmptyTitle}>
                      Directions are loading
                    </Text>
                    <Text style={styles.directionsPreviewEmptyText}>
                      The route is still being calculated from your current location.
                    </Text>
                  </View>
                )}
              </View>
            )}

          <View style={styles.mapLayerSection}>
            <Text style={styles.mapLayerTitle}>Map Modes</Text>
            <View style={styles.mapLayerChoices}>
              <MapTypePreview
                label="Default"
                type="standard"
                selected={mapType === 'standard'}
                centerCoordinate={truckCoordinate}
                onPress={() => setMapType('standard')}
              />
              <MapTypePreview
                label="Satellite"
                type="satellite"
                selected={mapType === 'satellite'}
                centerCoordinate={truckCoordinate}
                onPress={() => setMapType('satellite')}
              />
              <Pressable
                onPress={toggleVoiceAlerts}
                hitSlop={12}
                style={({ pressed }) => [
                  styles.mapVoiceButton,
                  pressed && styles.mapVoiceButtonPressed,
                ]}
              >
                <Image
                  source={isVoiceMuted ? VOICE_OFF_ICON : VOICE_ON_ICON}
                  style={styles.voiceIconImage}
                  resizeMode="contain"
                />
              </Pressable>
            </View>
          </View>

          {routeOptions.length > 1 && (
            <Text style={styles.fastestRoutesTitle}>
              Choose one of the 3 fastest truck-safe routes
            </Text>
          )}

          {routeOptions.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.routeSelector}
            >
              {routeOptions.map((option) => {
                const isSelected = option.index === selectedRouteIndex;

                return (
                  <Pressable
                    key={`route-choice-${option.index}`}
                    onPress={() => selectRouteOption(option)}
                    style={[
                      styles.routeChoice,
                      isSelected && styles.routeChoiceSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.routeChoiceTitle,
                        isSelected && styles.routeChoiceTitleSelected,
                      ]}
                    >
                      {option.fastestRank === 1 ? 'Fastest' : `Route ${option.fastestRank}`}
                    </Text>
                    <Text
                      style={[
                        styles.routeChoiceDetail,
                        isSelected && styles.routeChoiceDetailSelected,
                      ]}
                    >
                      {formatDistance(option.route?.distance_m)} | {formatDuration(option.route?.duration_s)}
                    </Text>
                    <Text
                      style={[
                        styles.routeChoiceEta,
                        isSelected && styles.routeChoiceEtaSelected,
                      ]}
                    >
                      ETA {formatEtaClock(Number(option.route?.duration_s))}
                    </Text>
                    <Text
                      style={[
                        styles.routeChoiceDetail,
                        isSelected && styles.routeChoiceDetailSelected,
                      ]}
                    >
                      Hazards: {option.hazardSummary.total}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {chosenRoute && (
            <View style={[styles.hazardPanel, hazardStatus.style]}>
              <Text style={styles.hazardPanelTitle}>{hazardStatus.label}</Text>
              <View style={styles.hazardCountRow}>
                <Text style={styles.hazardCountText}>
                  Low bridges: {displayedHazardSummary.lowBridgeCount}
                </Text>
                <Text style={styles.hazardCountText}>
                  No-truck: {displayedHazardSummary.noTruckZoneCount}
                </Text>
                <Text style={styles.hazardCountText}>
                  Residential: {displayedHazardSummary.residentialZoneCount}
                </Text>
              </View>
            </View>
          )}
          </Animated.ScrollView>
        </View>
      )}

      <Modal
        visible={isReportHazardVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsReportHazardVisible(false)}
      >
        <View style={styles.reportModalOverlay}>
          <View style={styles.reportModalCard}>
            <View style={styles.reportModalHeader}>
              <Text style={styles.reportModalTitle}>Report hazard</Text>
              <Pressable
                onPress={() => setIsReportHazardVisible(false)}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.reportModalCloseButton,
                  pressed && styles.reportModalCloseButtonPressed,
                ]}
              >
                <Text style={styles.reportModalCloseText}>X</Text>
              </Pressable>
            </View>

            <Text style={styles.reportModalHelp}>
              This report is saved as pending. It will not affect routing until confirmed.
            </Text>

            <View style={styles.reportTypeRow}>
              {REPORT_HAZARD_TYPES.map((type) => {
                const isSelected = reportHazardType === type.key;
                return (
                  <Pressable
                    key={type.key}
                    onPress={() => setReportHazardType(type.key)}
                    style={({ pressed }) => [
                      styles.reportTypeButton,
                      isSelected && styles.reportTypeButtonSelected,
                      pressed && styles.reportTypeButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.reportTypeButtonText,
                        isSelected && styles.reportTypeButtonTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.reportCoordinateText}>
              Location: {(liveCoordinate || truckCoordinate || originCoordinate)?.latitude?.toFixed(5)}, {(liveCoordinate || truckCoordinate || originCoordinate)?.longitude?.toFixed(5)}
            </Text>

            <TextInput
              value={reportHazardNotes}
              onChangeText={setReportHazardNotes}
              placeholder="Notes for supervisor review"
              multiline={true}
              style={styles.reportNotesInput}
              placeholderTextColor="#6e7e8f"
            />

            {!!reportHazardStatus && (
              <Text style={styles.reportStatusText}>{reportHazardStatus}</Text>
            )}

            <View style={styles.reportActionRow}>
              <Pressable
                onPress={() => setIsReportHazardVisible(false)}
                style={({ pressed }) => [
                  styles.reportCancelButton,
                  pressed && styles.reportActionButtonPressed,
                ]}
              >
                <Text style={styles.reportCancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={submitHazardReport}
                disabled={isSubmittingHazardReport}
                style={({ pressed }) => [
                  styles.reportSubmitButton,
                  isSubmittingHazardReport && styles.reportSubmitButtonDisabled,
                  pressed && styles.reportActionButtonPressed,
                ]}
              >
                <Text style={styles.reportSubmitButtonText}>
                  {isSubmittingHazardReport ? 'Submitting' : 'Submit Report'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.bottomRouteSummary}>
        <View style={styles.bottomMetricBlock}>
          <Text style={styles.bottomMetricLabel}>Miles</Text>
          <Text style={styles.bottomMetricValue}>
            {Number.isFinite(remainingRoute.distanceMeters)
              ? formatDistance(remainingRoute.distanceMeters)
              : '--'}
          </Text>
        </View>
        <View style={styles.bottomMetricDivider} />
        <View style={styles.bottomMetricBlock}>
          <Text style={styles.bottomMetricLabel}>ETA</Text>
          <Text style={styles.bottomMetricValue}>
            {Number.isFinite(remainingRoute.durationSeconds)
              ? formatEtaClock(remainingRoute.durationSeconds)
              : '--'}
          </Text>
          <Text style={styles.bottomMetricSubvalue}>
            {Number.isFinite(remainingRoute.durationSeconds)
              ? formatDuration(remainingRoute.durationSeconds)
              : ''}
          </Text>
        </View>
        <View style={styles.bottomMetricDivider} />
        <View style={styles.bottomMetricBlock}>
          <Text style={styles.bottomMetricLabel}>Hazards</Text>
          <Text style={styles.bottomMetricValue}>{displayedHazardSummary.total}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  directionsOnlyContainer: {
    backgroundColor: '#111216',
  },
  directionsPage: {
    flex: 1,
    backgroundColor: '#111216',
  },
  directionsPageHeader: {
    minHeight: 62,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  directionsPageTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    color: '#ffffff',
  },
  directionsPageScroll: {
    flex: 1,
  },
  directionsPageContent: {
    paddingHorizontal: 10,
    paddingBottom: 28,
  },
  map: {
    flex: 1,
  },
  mapBackButton: {
    position: 'absolute',
    top: 22,
    left: 14,
    zIndex: 200,
    minWidth: 98,
    minHeight: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(12, 25, 39, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    shadowColor: '#000000',
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 32,
  },
  mapBackButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.97 }],
  },
  mapBackButtonText: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    color: '#ffffff',
  },
  offRouteBanner: {
    position: 'absolute',
    top: 176,
    left: 16,
    right: 122,
    minHeight: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    backgroundColor: 'rgba(214, 40, 40, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  offRouteBannerRerouting: {
    backgroundColor: 'rgba(21, 101, 192, 0.92)',
  },
  offRouteBannerFailed: {
    backgroundColor: 'rgba(124, 11, 18, 0.94)',
  },
  offRouteBannerTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  offRouteBannerLabel: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  offRouteBannerMessage: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    color: '#fff3f3',
  },
  offRouteRerouteButton: {
    minWidth: 96,
    minHeight: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
  },
  offRouteRerouteButtonDisabled: {
    opacity: 0.52,
  },
  offRouteRerouteButtonPressed: {
    opacity: 0.84,
  },
  offRouteRerouteButtonText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    color: '#7c0b12',
    textTransform: 'uppercase',
  },
  destinationTopBanner: {
    position: 'absolute',
    top: 18,
    left: 112,
    right: 122,
    minHeight: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b8dcf7',
    backgroundColor: '#f2f9ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  destinationTopLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1565c0',
    textTransform: 'uppercase',
  },
  destinationTopTitle: {
    marginTop: 2,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
    color: '#111111',
  },
  destinationTopSubtitle: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: '#4b5f73',
  },
  speedPanel: {
    position: 'absolute',
    top: 72,
    right: 16,
    width: 92,
    minHeight: 118,
    borderRadius: 8,
    backgroundColor: 'rgba(12, 38, 64, 0.54)',
    borderWidth: 0,
    alignItems: 'center',
    paddingVertical: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  speedPanelOverLimit: {
    backgroundColor: 'rgba(214, 40, 40, 0.72)',
  },
  speedPanelBlink: {
    backgroundColor: '#d62828',
    borderColor: '#ffffff',
  },
  speedPanelLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#aee4ff',
    textTransform: 'uppercase',
  },
  speedLimitText: {
    marginTop: 1,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    color: '#ffffff',
  },
  speedPanelUnit: {
    marginTop: -2,
    fontSize: 11,
    fontWeight: '800',
    color: '#ffd6dc',
    textTransform: 'uppercase',
  },
  speedDivider: {
    width: 60,
    height: 1,
    marginVertical: 7,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
  speedDividerOverLimit: {
    backgroundColor: 'rgba(255,255,255,0.65)',
  },
  currentSpeedText: {
    marginTop: 1,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
    color: '#ffffff',
  },
  speedPanelTextOverLimit: {
    color: '#ffffff',
  },
  compassPanel: {
    position: 'absolute',
    top: '72%',
    right: 18,
    width: 88,
    height: 88,
    marginTop: -44,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12, 38, 64, 0.50)',
    borderWidth: 1,
    borderColor: 'rgba(174,228,255,0.42)',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  directionBadge: {
    position: 'absolute',
    top: '72%',
    right: 42,
    width: 42,
    minHeight: 36,
    marginTop: -82,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionBadgeText: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    color: '#ffffff',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  compassPoint: {
    position: 'absolute',
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '900',
    color: '#aee4ff',
  },
  compassPointNorth: {
    top: 6,
  },
  compassPointEast: {
    right: 7,
  },
  compassPointSouth: {
    bottom: 6,
  },
  compassPointWest: {
    left: 7,
  },
  compassCrossVertical: {
    position: 'absolute',
    width: 1,
    height: 56,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  compassCrossHorizontal: {
    position: 'absolute',
    width: 56,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  compassNeedle: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compassNeedleNorth: {
    position: 'absolute',
    top: -1,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    color: '#ffccd3',
  },
  compassNeedleSouth: {
    position: 'absolute',
    bottom: -1,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: '#ffffff',
  },
  bottomRouteSummary: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    minHeight: 78,
    borderRadius: 18,
    borderWidth: 0,
    backgroundColor: 'rgba(12, 38, 64, 0.54)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 11,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  bottomMetricBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
    borderRadius: 14,
    marginHorizontal: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  bottomMetricLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#aee4ff',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  bottomMetricValue: {
    marginTop: 5,
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '900',
    color: '#ffffff',
  },
  bottomMetricSubvalue: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
    color: '#ffd6dc',
  },
  bottomMetricDivider: {
    width: 1,
    height: 52,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  clockPanel: {
    position: 'absolute',
    top: 68,
    left: 16,
    minWidth: 116,
    minHeight: 50,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(12, 38, 64, 0.54)',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 7,
  },
  clockText: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '900',
    color: '#ffffff',
  },
  routeDetailsButton: {
    position: 'absolute',
    right: 22,
    top: '72%',
    marginTop: 68,
    minWidth: 118,
    minHeight: 46,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(214, 40, 40, 0.82)',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  routeDetailsButtonActive: {
    backgroundColor: 'rgba(21, 101, 192, 0.86)',
  },
  routeDetailsButtonPressed: {
    opacity: 0.84,
  },
  routeDetailsButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  routeDetailsButtonTextActive: {
    color: '#ffffff',
  },
  mapRecenterButton: {
    position: 'absolute',
    right: 22,
    top: '72%',
    marginTop: 122,
    minWidth: 118,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(21, 101, 192, 0.48)',
    borderWidth: 1,
    borderColor: 'rgba(174,228,255,0.36)',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 7,
  },
  mapRecenterButtonPressed: {
    opacity: 0.84,
  },
  mapRecenterButtonText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  reportHazardButton: {
    position: 'absolute',
    right: 22,
    top: '72%',
    marginTop: 172,
    minWidth: 118,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 181, 71, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 7,
  },
  reportHazardButtonPressed: {
    opacity: 0.84,
  },
  reportHazardButtonText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    color: '#3d2a00',
    textTransform: 'uppercase',
  },
  reportModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: 'rgba(12, 38, 64, 0.48)',
  },
  reportModalCard: {
    width: '100%',
    maxWidth: 430,
    borderRadius: 18,
    padding: 16,
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  reportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  reportModalTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    color: '#111111',
  },
  reportModalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe5e9',
  },
  reportModalCloseButtonPressed: {
    opacity: 0.75,
  },
  reportModalCloseText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#b5121b',
  },
  reportModalHelp: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#24506f',
  },
  reportTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  reportTypeButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: '#e8f5ff',
    borderWidth: 1,
    borderColor: '#b8dcf7',
  },
  reportTypeButtonSelected: {
    backgroundColor: '#d62828',
    borderColor: '#d62828',
  },
  reportTypeButtonPressed: {
    opacity: 0.82,
  },
  reportTypeButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#24506f',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  reportTypeButtonTextSelected: {
    color: '#ffffff',
  },
  reportCoordinateText: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '800',
    color: '#24506f',
  },
  reportNotesInput: {
    minHeight: 86,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#b8dcf7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fcff',
    fontSize: 14,
    lineHeight: 18,
    color: '#111111',
    textAlignVertical: 'top',
  },
  reportStatusText: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '800',
    color: '#24506f',
  },
  reportActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  reportCancelButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5ff',
    borderWidth: 1,
    borderColor: '#b8dcf7',
  },
  reportSubmitButton: {
    flex: 1.45,
    minHeight: 44,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d62828',
  },
  reportSubmitButtonDisabled: {
    opacity: 0.58,
  },
  reportActionButtonPressed: {
    opacity: 0.82,
  },
  reportCancelButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1565c0',
    textTransform: 'uppercase',
  },
  reportSubmitButtonText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  arrivalOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12, 38, 64, 0.26)',
  },
  arrivalCard: {
    width: '82%',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    backgroundColor: 'rgba(12, 38, 64, 0.88)',
    shadowColor: '#000000',
    shadowOpacity: 0.26,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  arrivalTitle: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    color: '#ffffff',
  },
  arrivalText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: '#aee4ff',
  },
  arrivalEndButton: {
    marginTop: 16,
    minHeight: 44,
    minWidth: 138,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(214, 40, 40, 0.88)',
  },
  arrivalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  arrivalNotesButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(19, 91, 110, 0.88)',
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  arrivalNotesButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  arrivalEndButtonPressed: {
    opacity: 0.84,
  },
  arrivalEndButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  routeDetailsSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 132,
    maxHeight: 470,
    borderRadius: 18,
    backgroundColor: 'rgba(12, 38, 64, 0.58)',
    padding: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  routeDetailsSheetDirections: {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: undefined,
    borderRadius: 0,
    paddingHorizontal: 10,
    paddingTop: 16,
    paddingBottom: 10,
    backgroundColor: '#0e1724',
  },
  routeDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  routeDetailsHeaderDirections: {
    minHeight: 56,
    paddingTop: 4,
    paddingHorizontal: 8,
  },
  routeDetailsTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
  },
  routeDetailsTitleDirections: {
    flex: 1,
    textAlign: 'center',
    fontSize: 24,
    lineHeight: 31,
  },
  directionsBackButton: {
    width: 88,
    minHeight: 42,
    borderRadius: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  directionsBackButtonPressed: {
    opacity: 0.72,
  },
  directionsBackButtonText: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    color: '#ffffff',
  },
  directionsHeaderSpacer: {
    width: 88,
  },
  routeDetailsContent: {
    marginTop: 4,
    flexShrink: 1,
  },
  routeDetailsContentInner: {
    paddingBottom: 12,
  },
  routeDetailsCloseButton: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,214,220,0.22)',
  },
  routeDetailsCloseButtonPressed: {
    opacity: 0.78,
  },
  routeDetailsCloseText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#ffd6dc',
    textTransform: 'uppercase',
  },
  routeDetailsStatus: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#aee4ff',
  },
  directionsOriginCard: {
    marginTop: 16,
    marginHorizontal: 6,
    borderRadius: 26,
    paddingHorizontal: 14,
    paddingVertical: 16,
    backgroundColor: 'rgba(18, 34, 52, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  directionsOriginLabel: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  directionsOriginText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: '#a7a7b0',
  },
  directionsPreviewList: {
    marginTop: 16,
    marginHorizontal: 4,
    borderRadius: 30,
    overflow: 'hidden',
    backgroundColor: 'rgba(12, 25, 39, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  directionsPreviewStep: {
    flexDirection: 'row',
    gap: 18,
    minHeight: 116,
    paddingHorizontal: 18,
    paddingVertical: 22,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  directionsPreviewStepPrimary: {
    minHeight: 132,
    paddingTop: 24,
    paddingBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  directionsPreviewStepFaded: {
    opacity: 0.66,
  },
  directionsPreviewStepVeryFaded: {
    opacity: 0.42,
  },
  directionsPreviewStepLast: {
    borderBottomWidth: 0,
  },
  directionsPreviewIconWrap: {
    width: 78,
    alignItems: 'center',
    paddingTop: 2,
  },
  directionsPreviewIcon: {
    fontSize: 60,
    lineHeight: 66,
    fontWeight: '900',
    color: '#ffffff',
  },
  directionsPreviewIconPrimary: {
    fontSize: 68,
    lineHeight: 74,
  },
  directionsPreviewTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  directionsPreviewDistance: {
    fontSize: 33,
    lineHeight: 39,
    fontWeight: '900',
    color: '#ffffff',
  },
  directionsPreviewDistancePrimary: {
    fontSize: 36,
    lineHeight: 42,
  },
  directionsPreviewInstruction: {
    marginTop: 7,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    color: '#ffffff',
  },
  directionsPreviewInstructionPrimary: {
    fontSize: 31,
    lineHeight: 37,
    color: '#ffffff',
  },
  directionsPreviewEmpty: {
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  directionsPreviewEmptyTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    color: '#ffffff',
  },
  directionsPreviewEmptyText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#a7a7b0',
  },
  voiceIconImage: {
    width: 48,
    height: 48,
  },
  routeActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
  },
  routeActionButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  newDestinationButton: {
    backgroundColor: 'rgba(21, 101, 192, 0.86)',
  },
  routeActionButtonPressed: {
    opacity: 0.82,
  },
  routeActionButtonText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  mapEndRouteButton: {
    position: 'absolute',
    left: 12,
    bottom: 142,
    width: 72,
    height: 58,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214, 40, 40, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  mapEndRouteButtonPressed: {
    backgroundColor: 'rgba(214, 40, 40, 0.86)',
    transform: [{ scale: 0.97 }],
  },
  mapEndRouteButtonText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  mapNewDestinationButton: {
    position: 'absolute',
    left: 92,
    bottom: 142,
    width: 72,
    height: 58,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 96, 128, 0.46)',
    borderWidth: 1,
    borderColor: 'rgba(174,228,255,0.42)',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 7,
  },
  mapNewDestinationButtonPressed: {
    backgroundColor: 'rgba(0, 96, 128, 0.66)',
    transform: [{ scale: 0.97 }],
  },
  mapNewDestinationButtonText: {
    fontSize: 13,
    lineHeight: 15,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  mapLayerSection: {
    marginTop: 14,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: 'rgba(8, 22, 38, 0.44)',
  },
  mapLayerTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  mapLayerChoices: {
    flexDirection: 'row',
    gap: 18,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  mapVoiceButton: {
    width: 62,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapVoiceButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  mapTypePreviewOption: {
    width: 86,
    alignItems: 'center',
  },
  mapTypePreviewTile: {
    width: 82,
    height: 82,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: '#eeeeee',
  },
  mapTypePreviewSelected: {
  },
  mapTypePreviewSelectedTile: {
    borderColor: '#2aa7ff',
  },
  mapTypePreviewPressed: {
    opacity: 0.86,
  },
  mapTypePreviewMap: {
    ...StyleSheet.absoluteFillObject,
  },
  mapTypePreviewLabel: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
  },
  mapTypePreviewLabelSelected: {
    color: '#7bdff2',
  },
  infoCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: '#f2f9ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#b8dcf7',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  infoCardCollapsed: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    minHeight: 60,
    backgroundColor: '#fff6f7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ffd2d8',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  infoCardCollapsedPressed: {
    opacity: 0.9,
  },
  infoCardHandleArea: {
    alignItems: 'center',
    paddingBottom: 6,
    marginBottom: 2,
  },
  infoCardHandleAreaPressed: {
    opacity: 0.78,
  },
  infoCardHandle: {
    width: 42,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#d0d0d0',
  },
  infoCardHandleText: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '800',
    color: '#666666',
    textTransform: 'uppercase',
  },
  collapsedSummaryRow: {
    marginTop: 8,
  },
  collapsedSummaryTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111111',
  },
  collapsedSummaryText: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '700',
    color: '#444444',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666666',
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111111',
  },
  destinationText: {
    marginTop: 7,
    fontSize: 12,
    color: '#444444',
  },
  destinationVisualCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e1e1e1',
    borderRadius: 7,
    padding: 6,
    backgroundColor: '#ffffff',
  },
  destinationVisualImage: {
    width: 58,
    height: 44,
    borderRadius: 7,
    backgroundColor: '#eeeeee',
  },
  destinationVisualTextWrap: {
    flex: 1,
  },
  destinationVisualTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#111111',
  },
  destinationVisualAddress: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    color: '#555555',
  },
  routeTrackingText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '800',
    color: '#276749',
  },
  routeTrackingWarning: {
    color: '#b42318',
  },
  routeSelector: {
    marginTop: 8,
    maxHeight: 76,
  },
  fastestRoutesTitle: {
    marginTop: 12,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    color: '#aee4ff',
    textTransform: 'uppercase',
  },
  routeChoice: {
    minWidth: 126,
    borderWidth: 1,
    borderColor: '#d6d6d6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginRight: 8,
    backgroundColor: '#f7f7f7',
  },
  routeChoiceSelected: {
    borderColor: '#1565c0',
    backgroundColor: '#eaf2ff',
  },
  routeChoiceTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#222222',
  },
  routeChoiceTitleSelected: {
    color: '#0d47a1',
  },
  routeChoiceDetail: {
    marginTop: 2,
    fontSize: 10,
    color: '#555555',
  },
  routeChoiceDetailSelected: {
    color: '#183b67',
  },
  routeChoiceEta: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    color: '#0d7f89',
  },
  routeChoiceEtaSelected: {
    color: '#0d47a1',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
  },
  metricText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111111',
  },
  metricDivider: {
    marginHorizontal: 6,
    fontSize: 12,
    color: '#999999',
  },
  summaryText: {
    marginTop: 6,
    fontSize: 12,
    color: '#666666',
  },
  hazardPanel: {
    marginTop: 8,
    borderRadius: 7,
    borderWidth: 1,
    padding: 8,
  },
  hazardClear: {
    backgroundColor: '#e8f8ee',
    borderColor: '#56b870',
  },
  hazardMedium: {
    backgroundColor: '#fff8df',
    borderColor: '#f2c94c',
  },
  hazardHigh: {
    backgroundColor: '#ffeede',
    borderColor: '#f2994a',
  },
  hazardCritical: {
    backgroundColor: '#ffe8ec',
    borderColor: '#d62828',
  },
  hazardPanelTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7a1118',
  },
  hazardCountRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 5,
  },
  hazardCountText: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '800',
    color: '#23384d',
  },
  hazardDetailList: {
    marginTop: 6,
  },
  hazardDetail: {
    borderWidth: 1,
    borderColor: 'rgba(122,17,24,0.16)',
    borderRadius: 7,
    padding: 7,
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  hazardDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  hazardDetailTitle: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: '#7a1118',
  },
  hazardDetailDistance: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1565c0',
  },
  hazardDetailText: {
    marginTop: 3,
    fontSize: 11,
    color: '#23384d',
  },
  hazardMoreText: {
    marginTop: 6,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 5,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '700',
    color: '#7a1118',
  },
  destinationMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ffffff',
    borderWidth: 3,
    borderColor: '#1565c0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationMarkerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1565c0',
  },
  hazardMarkerBase: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  lowBridgeMarker: {
    backgroundColor: '#ffd54f',
    borderColor: '#7a4f00',
  },
  lowBridgeMarkerTop: {
    marginBottom: -3,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    color: '#3d2a00',
  },
  lowBridgeMarkerIcon: {
    fontSize: 23,
    lineHeight: 25,
    fontWeight: '900',
    color: '#3d2a00',
  },
  noTruckMarker: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#d62828',
    borderColor: '#ffffff',
    borderWidth: 3,
  },
  noTruckSlash: {
    position: 'absolute',
    width: 58,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    transform: [{ rotate: '-38deg' }],
    opacity: 0.92,
  },
  noTruckMarkerText: {
    fontSize: 13,
    lineHeight: 14,
    fontWeight: '900',
    color: '#ffffff',
  },
  noTruckMarkerSubText: {
    marginTop: -1,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    color: '#ffffff',
  },
  residentialMarker: {
    backgroundColor: '#e8f5ff',
    borderColor: '#1565c0',
  },
  residentialRoof: {
    position: 'absolute',
    top: 8,
    width: 20,
    height: 20,
    borderLeftWidth: 3,
    borderTopWidth: 3,
    borderColor: '#1565c0',
    transform: [{ rotate: '45deg' }],
  },
  residentialMarkerText: {
    marginTop: 8,
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '900',
    color: '#0d47a1',
  },
});
