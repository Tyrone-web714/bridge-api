import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { AnimatedRegion, Marker } from 'react-native-maps';

const DEFAULT_SCALE = 1;
const SPRITE_FRAME_DEGREES = 11.25;
const SPRITE_FRAME_HYSTERESIS_DEGREES = 1.25;
const VEHICLE_MARKER_ANIMATION_MS = 700;
const VEHICLE_MARKER_MIN_ANIMATION_MS = 450;
const VEHICLE_MARKER_MAX_ANIMATION_MS = 1000;
const VEHICLE_LAYER_DEBUG =
  typeof __DEV__ !== 'undefined' &&
  __DEV__ &&
  process.env.EXPO_PUBLIC_VEHICLE_LAYER_DEBUG === 'true';

const TRUCK_SPRITE_FRAMES = [
  require('../../assets/truck-sprites-native/truck-00000.png'),
  require('../../assets/truck-sprites-native/truck-01125.png'),
  require('../../assets/truck-sprites-native/truck-02250.png'),
  require('../../assets/truck-sprites-native/truck-03375.png'),
  require('../../assets/truck-sprites-native/truck-04500.png'),
  require('../../assets/truck-sprites-native/truck-05625.png'),
  require('../../assets/truck-sprites-native/truck-06750.png'),
  require('../../assets/truck-sprites-native/truck-07875.png'),
  require('../../assets/truck-sprites-native/truck-09000.png'),
  require('../../assets/truck-sprites-native/truck-10125.png'),
  require('../../assets/truck-sprites-native/truck-11250.png'),
  require('../../assets/truck-sprites-native/truck-12375.png'),
  require('../../assets/truck-sprites-native/truck-13500.png'),
  require('../../assets/truck-sprites-native/truck-14625.png'),
  require('../../assets/truck-sprites-native/truck-15750.png'),
  require('../../assets/truck-sprites-native/truck-16875.png'),
  require('../../assets/truck-sprites-native/truck-18000.png'),
  require('../../assets/truck-sprites-native/truck-19125.png'),
  require('../../assets/truck-sprites-native/truck-20250.png'),
  require('../../assets/truck-sprites-native/truck-21375.png'),
  require('../../assets/truck-sprites-native/truck-22500.png'),
  require('../../assets/truck-sprites-native/truck-23625.png'),
  require('../../assets/truck-sprites-native/truck-24750.png'),
  require('../../assets/truck-sprites-native/truck-25875.png'),
  require('../../assets/truck-sprites-native/truck-27000.png'),
  require('../../assets/truck-sprites-native/truck-28125.png'),
  require('../../assets/truck-sprites-native/truck-29250.png'),
  require('../../assets/truck-sprites-native/truck-30375.png'),
  require('../../assets/truck-sprites-native/truck-31500.png'),
  require('../../assets/truck-sprites-native/truck-32625.png'),
  require('../../assets/truck-sprites-native/truck-33750.png'),
  require('../../assets/truck-sprites-native/truck-34875.png'),
];

function normalizeHeadingDegrees(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;

  return ((parsed % 360) + 360) % 360;
}

function getShortestHeadingDelta(fromHeading, toHeading) {
  const from = normalizeHeadingDegrees(fromHeading);
  const to = normalizeHeadingDegrees(toHeading);

  return ((to - from + 540) % 360) - 180;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function getSpriteFrameIndex(vehicleHeading, cameraHeading, currentFrameIndex) {
  const relativeHeading = normalizeHeadingDegrees(
    vehicleHeading - cameraHeading + 180
  );

  if (Number.isInteger(currentFrameIndex)) {
    const currentFrameHeading = currentFrameIndex * SPRITE_FRAME_DEGREES;
    const distanceFromCurrentFrame = Math.abs(
      getShortestHeadingDelta(currentFrameHeading, relativeHeading)
    );
    const switchThreshold =
      SPRITE_FRAME_DEGREES / 2 + SPRITE_FRAME_HYSTERESIS_DEGREES;

    if (distanceFromCurrentFrame < switchThreshold) {
      return currentFrameIndex;
    }
  }

  return (
    Math.round(relativeHeading / SPRITE_FRAME_DEGREES) %
    TRUCK_SPRITE_FRAMES.length
  );
}

const VehicleLayer = forwardRef(function VehicleLayer({
  position,
  heading = 0,
  mapHeading = 0,
  scale = DEFAULT_SCALE,
}, ref) {
  const animatedCoordinateRef = useRef(null);
  const lastDebugLogAtRef = useRef(0);
  const lastAnimationAtRef = useRef(0);
  const lastImperativeUpdateAtRef = useRef(0);
  const initialFrameIndex = getSpriteFrameIndex(heading, mapHeading);
  const frameIndexRef = useRef(initialFrameIndex);
  const [frameIndex, setFrameIndex] = useState(initialFrameIndex);

  const routeTangentHeading = normalizeHeadingDegrees(heading);
  const cameraHeading = normalizeHeadingDegrees(mapHeading);

  if (position && !animatedCoordinateRef.current) {
    animatedCoordinateRef.current = new AnimatedRegion({
      latitude: position.latitude,
      longitude: position.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    });
  }

  const getDebugValues = (nextHeading, nextMapHeading) => ({
    cameraHeading: normalizeHeadingDegrees(nextMapHeading),
    routeTangentHeading: normalizeHeadingDegrees(nextHeading),
  });

  const updateSpriteFrame = (nextHeading, nextMapHeading) => {
    const nextFrameIndex = getSpriteFrameIndex(
      nextHeading,
      nextMapHeading,
      frameIndexRef.current
    );
    if (nextFrameIndex === frameIndexRef.current) return;

    frameIndexRef.current = nextFrameIndex;
    setFrameIndex(nextFrameIndex);
  };

  const animateToPosition = (nextPosition, durationMs = VEHICLE_MARKER_ANIMATION_MS) => {
    if (!nextPosition || !animatedCoordinateRef.current) return;

    const duration = clamp(
      Number(durationMs) || VEHICLE_MARKER_ANIMATION_MS,
      VEHICLE_MARKER_MIN_ANIMATION_MS,
      VEHICLE_MARKER_MAX_ANIMATION_MS
    );

    animatedCoordinateRef.current.stopAnimation?.();
    animatedCoordinateRef.current
      .timing({
        latitude: nextPosition.latitude,
        longitude: nextPosition.longitude,
        latitudeDelta: 0,
        longitudeDelta: 0,
        duration,
        useNativeDriver: false,
      })
      .start();
  };

  useImperativeHandle(ref, () => ({
    updateVehicle({
      position: nextPosition,
      heading: nextHeading = 0,
      mapHeading: nextMapHeading = 0,
      durationMs,
    }) {
      const debugValues = getDebugValues(nextHeading, nextMapHeading);
      animateToPosition(nextPosition, durationMs);
      updateSpriteFrame(nextHeading, nextMapHeading);
      const now = Date.now();
      lastAnimationAtRef.current = now;
      lastImperativeUpdateAtRef.current = now;

      if (!VEHICLE_LAYER_DEBUG || !nextPosition) return;
      if (now - lastDebugLogAtRef.current < 750) return;
      lastDebugLogAtRef.current = now;
      console.log('[VehicleLayer]', {
        ...debugValues,
        markerCoordinate: {
          latitude: nextPosition.latitude,
          longitude: nextPosition.longitude,
        },
      });
    },
  }));

  useEffect(() => {
    if (!position || !animatedCoordinateRef.current) return;
    const now = Date.now();
    if (now - lastImperativeUpdateAtRef.current < 1200) return;
    const elapsedMs = lastAnimationAtRef.current
      ? now - lastAnimationAtRef.current
      : VEHICLE_MARKER_ANIMATION_MS;
    animateToPosition(position, elapsedMs);
    lastAnimationAtRef.current = now;
  }, [position?.latitude, position?.longitude, heading, mapHeading]);

  useEffect(() => {
    updateSpriteFrame(heading, mapHeading);
  }, [heading, mapHeading]);

  useEffect(() => {
    if (!VEHICLE_LAYER_DEBUG || !position) return;

    const now = Date.now();
    if (now - lastDebugLogAtRef.current < 750) return;
    lastDebugLogAtRef.current = now;

    console.log('[VehicleLayer]', {
      cameraHeading,
      routeTangentHeading,
      markerCoordinate: {
        latitude: position.latitude,
        longitude: position.longitude,
      },
    });
  }, [
    cameraHeading,
    position?.latitude,
    position?.longitude,
    routeTangentHeading,
  ]);

  if (!position) return null;

  return (
    <Marker.Animated
      coordinate={animatedCoordinateRef.current}
      anchor={{ x: 0.5, y: 0.5 }}
      flat={false}
      image={TRUCK_SPRITE_FRAMES[frameIndex]}
      zIndex={20}
      tracksViewChanges={false}
    />
  );
});

function areVehicleLayerPropsEqual(previous, next) {
  const previousPosition = previous.position;
  const nextPosition = next.position;

  if (!previousPosition || !nextPosition) {
    return previousPosition === nextPosition;
  }

  const samePosition =
    Math.abs(previousPosition.latitude - nextPosition.latitude) < 0.000005 &&
    Math.abs(previousPosition.longitude - nextPosition.longitude) < 0.000005;

  return (
    samePosition &&
    Math.abs(getShortestHeadingDelta(previous.heading, next.heading)) < 3 &&
    Math.abs(getShortestHeadingDelta(previous.mapHeading, next.mapHeading)) < 3 &&
    previous.isFollowing === next.isFollowing &&
    previous.scale === next.scale
  );
}

export default React.memo(VehicleLayer, areVehicleLayerPropsEqual);
