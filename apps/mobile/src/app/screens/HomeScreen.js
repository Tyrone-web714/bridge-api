import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { API_BASE_URL } from '../config/api';
import AuthenticatedMediaImage from '../components/AuthenticatedMediaImage';
import {
  fetchAddressPredictions,
  fetchBackendHealth,
  fetchDeliveryNotesForDestination,
  fetchDestinationDetails,
  fetchRecentDestinations,
  saveRecentDestinationRecord,
} from '../services/homeApi';
import {
  AUTOCOMPLETE_DEBOUNCE_MS,
  AUTOCOMPLETE_MAX_RESULTS,
  AUTOCOMPLETE_MIN_CHARS,
  DEFAULT_TRUCK_PROFILE,
  buildDestinationStreetViewPanoramaUrl,
  buildTruckProfilePayload,
  createAutocompleteSessionToken,
  predictionTypeLabel,
} from '../utils/destinationUtils';
import { getAssignedRouteLookupDates, getLocalRouteDate } from '../utils/routeDate';
import { fetchAssignedDriverRouteFromDates } from '../services/routeManifestApi';
import { readCachedAssignedRoute } from '../services/routeManifestOfflineStore';
import { recoverPendingCameraDraft } from '../services/mobileMediaSelection';
import { readLatestPhotoDraft } from '../services/photoDraftStore';
import {
  initializeDriverSession,
  loginDriverSession,
  logoutDriverSession,
} from '../services/driverSession';

function buildConfirmedDriver(driverId, driverName, assignedRoute) {
  return {
    id: driverId,
    name: assignedRoute?.assignedDriverName || assignedRoute?.driverName || driverName || driverId,
    routeNumber: assignedRoute?.routeNumber,
    routeDate: assignedRoute?.routeDate,
    stopCount: assignedRoute?.totalStops,
    manifestId: assignedRoute?.id || assignedRoute?.manifestId,
  };
}

function navigateToPhotoDraft(navigation, draft) {
  if (!draft?.workflow || !draft?.context?.routeParams) return false;
  if (draft.workflow === 'delivery-notes') {
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        {
          name: 'DeliveryNotes',
          params: {
            ...draft.context.routeParams,
            restoredPhotoDraft: true,
          },
        },
      ],
    });
    return true;
  }
  if (draft.workflow === 'hazard-report') {
    navigation.reset({
      index: 1,
      routes: [
        { name: 'Home' },
        {
          name: 'HazardReport',
          params: {
            ...draft.context.routeParams,
            restoredPhotoDraft: true,
          },
        },
      ],
    });
    return true;
  }
  return false;
}

function GoogleMapsAttribution({ photoAttributions = [] }) {
  const authors = Array.isArray(photoAttributions) ? photoAttributions : [];
  return (
    <View
      accessibilityLabel="Google Maps attribution"
      style={styles.googleMapsAttribution}
    >
      {authors.map((author, index) => (
        <Text
          key={`${author?.displayName || 'author'}-${index}`}
          onPress={author?.uri ? () => Linking.openURL(author.uri) : undefined}
          style={styles.googleMapsAttributionText}
        >
          {author?.displayName || 'Photo contributor'}
        </Text>
      ))}
      <Text style={styles.googleMapsAttributionText}>Google Maps</Text>
    </View>
  );
}

export default function HomeScreen({ navigation, route }) {
  const [destination, setDestination] = useState('');
  const [destinationPlaceId, setDestinationPlaceId] = useState(null);
  const [destinationPredictions, setDestinationPredictions] = useState([]);
  const [isAutocompleteLoading, setIsAutocompleteLoading] = useState(false);
  const [autocompleteError, setAutocompleteError] = useState('');
  const [lastAutocompleteQuery, setLastAutocompleteQuery] = useState('');
  const [recentDestinations, setRecentDestinations] = useState([]);
  const [destinationDetails, setDestinationDetails] = useState(null);
  const [destinationImageMode, setDestinationImageMode] = useState('primary');
  const [isDestinationPreviewModalVisible, setIsDestinationPreviewModalVisible] = useState(false);
  const [isDestinationPhotoViewerVisible, setIsDestinationPhotoViewerVisible] = useState(false);
  const [isStreetViewViewerVisible, setIsStreetViewViewerVisible] = useState(false);
  const [isDriverPhotoGalleryVisible, setIsDriverPhotoGalleryVisible] = useState(false);
  const [selectedDriverPhoto, setSelectedDriverPhoto] = useState(null);
  const [isDestinationDetailsLoading, setIsDestinationDetailsLoading] = useState(false);
  const [deliveryNotes, setDeliveryNotes] = useState([]);
  const [isDeliveryNotesLoading, setIsDeliveryNotesLoading] = useState(false);
  const [deliveryNotesError, setDeliveryNotesError] = useState('');
  const [backendStatus, setBackendStatus] = useState({
    label: 'Checking backend...',
    ok: false,
    detail: API_BASE_URL,
  });
  const [truckProfile, setTruckProfile] = useState(DEFAULT_TRUCK_PROFILE);
  const [driverIdInput, setDriverIdInput] = useState('');
  const [driverPinInput, setDriverPinInput] = useState('');
  const [confirmedDriver, setConfirmedDriver] = useState(null);
  const [isDriverLoginChecking, setIsDriverLoginChecking] = useState(false);
  const [driverStartupState, setDriverStartupState] = useState('restoring');
  const [driverLoginStatus, setDriverLoginStatus] = useState('');
  const autocompleteRequestIdRef = useRef(0);
  const autocompleteSessionTokenRef = useRef(createAutocompleteSessionToken());
  const deliveryNotesRequestIdRef = useRef(0);

  const loadRecentDestinations = async () => {
    try {
      setRecentDestinations(await fetchRecentDestinations());
    } catch {
      setRecentDestinations([]);
    }
  };

  const checkBackendStatus = async () => {
    setBackendStatus({
      label: 'Checking backend...',
      ok: false,
      detail: API_BASE_URL,
    });

    try {
      await fetchBackendHealth();

      setBackendStatus({
        label: 'Backend connected',
        ok: true,
        detail: API_BASE_URL,
      });
    } catch (error) {
      setBackendStatus({
        label: 'Backend unreachable',
        ok: false,
        detail: `${API_BASE_URL} | ${error.message || 'network request failed'}`,
      });
    }
  };

  const loadDestinationDetails = async (placeId, address = destination.trim(), options = {}) => {
    if (!placeId && !address) {
      setDestinationDetails(null);
      return null;
    }

    setIsDestinationDetailsLoading(true);
    try {
      const place = await fetchDestinationDetails({
        placeId,
        address,
        label: options.label,
        types: options.types,
      });
      setDestinationImageMode('primary');
      setDestinationDetails(place);
      if (place?.placeId) {
        setDestinationPlaceId(place.placeId);
      }
      if (options.openPreview && place) {
        setIsDestinationPreviewModalVisible(true);
      }
      return place;
    } catch {
      setDestinationDetails(null);
      return null;
    } finally {
      setIsDestinationDetailsLoading(false);
    }
  };

  const loadDeliveryNotesForDestination = async (placeId, address, accountNumber = null) => {
    const cleanedAddress = String(address || '').trim();
    if (!placeId && !cleanedAddress) {
      setDeliveryNotes([]);
      setDeliveryNotesError('');
      setIsDeliveryNotesLoading(false);
      return;
    }

    const requestId = deliveryNotesRequestIdRef.current + 1;
    deliveryNotesRequestIdRef.current = requestId;
    setIsDeliveryNotesLoading(true);
    setDeliveryNotesError('');

    try {
      const notes = await fetchDeliveryNotesForDestination({
        accountNumber,
        placeId,
        address: cleanedAddress,
      });
      if (requestId !== deliveryNotesRequestIdRef.current) return;

      setDeliveryNotes(notes);
    } catch (error) {
      if (requestId !== deliveryNotesRequestIdRef.current) return;
      setDeliveryNotes([]);
      setDeliveryNotesError(error.message || 'Delivery notes unavailable.');
    } finally {
      if (requestId === deliveryNotesRequestIdRef.current) {
        setIsDeliveryNotesLoading(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const restoreDriverSession = async () => {
      setDriverStartupState('restoring');
      try {
        const session = await initializeDriverSession();
        if (!isMounted) return;

        const sessionDriver = session?.driver || null;
        const authenticatedDriverId = sessionDriver?.driverId || sessionDriver?.companyDriverNumber || '';
        const authenticatedDriverName = sessionDriver?.driverName || authenticatedDriverId;

        if (!session || !authenticatedDriverId) {
          setDriverStartupState('unauthenticated');
          setDriverLoginStatus('');
          return;
        }

        setDriverIdInput(authenticatedDriverId);
        setDriverPinInput('');
        setDriverLoginStatus('Restored driver session. Checking today\'s assigned route...');

        const routeDates = getAssignedRouteLookupDates();
        let assignedRoute = null;
        for (const routeDate of routeDates) {
          assignedRoute = await readCachedAssignedRoute({
            driverId: authenticatedDriverId,
            routeDate,
          });
          if (assignedRoute) break;
        }

        if (!assignedRoute) {
          assignedRoute = await fetchAssignedDriverRouteFromDates({
            routeDates,
            driverId: authenticatedDriverId,
            driverName: authenticatedDriverName,
          }).catch(() => null);
        }

        if (!isMounted) return;

        if (assignedRoute) {
          const confirmed = buildConfirmedDriver(authenticatedDriverId, authenticatedDriverName, assignedRoute);
          setConfirmedDriver(confirmed);
          setDriverLoginStatus(`Ready: route ${confirmed.routeNumber} is assigned today.`);
        } else {
          setConfirmedDriver(null);
          setDriverLoginStatus(
            `Signed in as ${authenticatedDriverName || authenticatedDriverId}. No assigned route is cached for today.`
          );
        }
        setDriverStartupState('authenticated');

        const recoveredDraft = await recoverPendingCameraDraft().catch(() => null);
        const latestDraft = recoveredDraft || await readLatestPhotoDraft().catch(() => null);
        if (isMounted && latestDraft?.photos?.length) {
          navigateToPhotoDraft(navigation, latestDraft);
        }
      } catch (error) {
        if (!isMounted) return;
        setConfirmedDriver(null);
        setDriverLoginStatus(error.message || 'Driver session restoration failed. Sign in to continue.');
        setDriverStartupState('error');
      }
    };

    restoreDriverSession();
    checkBackendStatus();
    loadRecentDestinations();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!route?.params?.resetDestinationToken) return;

    autocompleteRequestIdRef.current += 1;
    autocompleteSessionTokenRef.current = createAutocompleteSessionToken();
    setDestination('');
    setDestinationPlaceId(null);
    setDestinationPredictions([]);
    setIsAutocompleteLoading(false);
    setAutocompleteError('');
    setLastAutocompleteQuery('');
    setDestinationDetails(null);
    setDestinationImageMode('primary');
    setIsDestinationPreviewModalVisible(false);
    setIsDestinationPhotoViewerVisible(false);
    setIsStreetViewViewerVisible(false);
    setIsDriverPhotoGalleryVisible(false);
    setSelectedDriverPhoto(null);
    setDeliveryNotes([]);
    setDeliveryNotesError('');
    setIsDeliveryNotesLoading(false);
    checkBackendStatus();
  }, [route?.params?.resetDestinationToken]);

  useEffect(() => {
    const returnedDestination = route?.params?.returnDestination;
    if (!returnedDestination) return;

    const returnedAddress = String(returnedDestination.address || '').trim();
    const returnedDetails = returnedDestination.details || null;
    const returnedPlaceId =
      returnedDetails?.placeId ||
      returnedDetails?.routingPlaceId ||
      returnedDestination.placeId ||
      null;

    setDestination(returnedAddress);
    setDestinationPlaceId(returnedPlaceId);
    setDestinationDetails(returnedDetails);
    setDestinationPredictions([]);
    setAutocompleteError('');
    setLastAutocompleteQuery('');
    setDestinationImageMode('primary');
    setIsDestinationPreviewModalVisible(false);
    setIsDestinationPhotoViewerVisible(false);
    setIsStreetViewViewerVisible(false);
    setIsDriverPhotoGalleryVisible(false);
    setSelectedDriverPhoto(null);

    if (!returnedDetails && (returnedPlaceId || returnedAddress)) {
      loadDestinationDetails(returnedPlaceId, returnedAddress);
    }
  }, [route?.params?.returnDestinationToken]);

  useEffect(() => {
    setDestinationImageMode('primary');
  }, [destinationDetails?.photoUrl, destinationDetails?.streetViewUrl]);

  useEffect(() => {
    const effectivePlaceId =
      destinationDetails?.routingPlaceId || destinationDetails?.placeId || destinationPlaceId || null;
    const effectiveAddress =
      destinationDetails?.formattedAddress ||
      destinationDetails?.secondaryText ||
      destination.trim();

    if (!effectivePlaceId && !destinationDetails) {
      setDeliveryNotes([]);
      setDeliveryNotesError('');
      setIsDeliveryNotesLoading(false);
      return;
    }

    loadDeliveryNotesForDestination(
      effectivePlaceId,
      effectiveAddress,
      destinationDetails?.accountNumber || null
    );
  }, [
    destinationPlaceId,
    destinationDetails?.placeId,
    destinationDetails?.accountNumber,
    destinationDetails?.formattedAddress,
    destinationDetails?.secondaryText,
    destination,
  ]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const effectivePlaceId = destinationDetails?.placeId || destinationPlaceId || null;
      const effectiveAddress =
        destinationDetails?.formattedAddress ||
        destinationDetails?.secondaryText ||
        destination.trim();

      if (effectivePlaceId || destinationDetails) {
        loadDeliveryNotesForDestination(
          effectivePlaceId,
          effectiveAddress,
          destinationDetails?.accountNumber || null
        );
      }
    });

    return unsubscribe;
  }, [
    navigation,
    destinationPlaceId,
    destinationDetails?.placeId,
    destinationDetails?.accountNumber,
    destinationDetails?.formattedAddress,
    destinationDetails?.secondaryText,
    destination,
  ]);

  useEffect(() => {
    const cleaned = destination.trim();

    if (destinationPlaceId || cleaned.length < AUTOCOMPLETE_MIN_CHARS) {
      autocompleteRequestIdRef.current += 1;
      setDestinationPredictions([]);
      setIsAutocompleteLoading(false);
      setAutocompleteError('');
      setLastAutocompleteQuery('');
      return undefined;
    }

    const requestId = autocompleteRequestIdRef.current + 1;
    autocompleteRequestIdRef.current = requestId;
    const timeoutId = setTimeout(async () => {
      setIsAutocompleteLoading(true);
      setAutocompleteError('');
      setLastAutocompleteQuery(cleaned);

      try {
        const predictions = await fetchAddressPredictions({
          input: cleaned,
          sessionToken: autocompleteSessionTokenRef.current,
          maxResults: AUTOCOMPLETE_MAX_RESULTS,
        });

        if (requestId !== autocompleteRequestIdRef.current) return;

        setDestinationPredictions(predictions);
        if (!predictions.length) {
          setDestinationDetails(null);
        }
      } catch (error) {
        if (requestId !== autocompleteRequestIdRef.current) return;
        setDestinationPredictions([]);
        setAutocompleteError(`${error.message || 'Address suggestions unavailable.'} (${API_BASE_URL})`);
      } finally {
        if (requestId === autocompleteRequestIdRef.current) {
          setIsAutocompleteLoading(false);
        }
      }
    }, AUTOCOMPLETE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [destination, destinationPlaceId]);

  const handleDestinationChange = (value) => {
    setDestination(value);
    setDestinationPlaceId(null);
    setDestinationDetails(null);
    setDeliveryNotes([]);
    setDeliveryNotesError('');
    setDestinationImageMode('primary');
    setIsDestinationPreviewModalVisible(false);
    setIsDestinationPhotoViewerVisible(false);
    setIsStreetViewViewerVisible(false);
    setIsDriverPhotoGalleryVisible(false);
    setSelectedDriverPhoto(null);
  };

  const handlePredictionPress = (prediction) => {
    setDestination(prediction.description);
    setDestinationPlaceId(prediction.placeId);
    setDestinationPredictions([]);
    setAutocompleteError('');
    setLastAutocompleteQuery('');
    autocompleteSessionTokenRef.current = createAutocompleteSessionToken();
    loadDestinationDetails(prediction.placeId, prediction.description, {
      label: prediction.mainText || prediction.description,
      types: prediction.types || [],
    });
  };

  const handleRecentDestinationPress = (record) => {
    setDestination(record.description);
    setDestinationPlaceId(record.placeId || null);
    setDestinationDetails(record);
    setIsDestinationPreviewModalVisible(false);
    setIsDestinationPhotoViewerVisible(false);
    setIsStreetViewViewerVisible(false);
    setIsDriverPhotoGalleryVisible(false);
    setSelectedDriverPhoto(null);
    setDestinationPredictions([]);
    setAutocompleteError('');
    setLastAutocompleteQuery('');
    if (record.placeId) {
      loadDestinationDetails(record.placeId, record.description, {
        label: record.name || record.mainText || record.description,
        types: record.types || [],
      });
    }
  };

  const handleBusinessCandidatePress = async (candidate) => {
    if (!candidate?.placeId) return;

    const candidateAddress =
      candidate.formattedAddress ||
      destinationDetails?.formattedAddress ||
      destinationDetails?.secondaryText ||
      destination;

    setDestination(candidateAddress);
    setDestinationPlaceId(candidate.placeId);
    setDestinationImageMode('primary');
    setDestinationDetails((previousDetails) => ({
      ...(previousDetails || {}),
      placeId: candidate.placeId,
      routingPlaceId: candidate.placeId,
      name: candidate.name || previousDetails?.name || candidateAddress,
      formattedAddress: candidateAddress,
      location: candidate.location || previousDetails?.location || null,
      types: candidate.types || previousDetails?.types || [],
      rating: candidate.rating ?? previousDetails?.rating ?? null,
      userRatingsTotal: candidate.userRatingsTotal ?? previousDetails?.userRatingsTotal ?? null,
      photoUrl: candidate.photoUrl || previousDetails?.photoUrl || '',
      placePhotoUrl: candidate.photoUrl || previousDetails?.placePhotoUrl || '',
      photoSource: candidate.photoSource || previousDetails?.photoSource || '',
    }));

    await loadDestinationDetails(candidate.placeId, candidateAddress, {
      label: candidate.name || candidateAddress,
      types: candidate.types || [],
    });
  };

  const clearDestination = () => {
    autocompleteRequestIdRef.current += 1;
    setDestination('');
    setDestinationPlaceId(null);
    setDestinationPredictions([]);
    setIsAutocompleteLoading(false);
    setAutocompleteError('');
    setLastAutocompleteQuery('');
    setDestinationDetails(null);
    setDeliveryNotes([]);
    setDeliveryNotesError('');
    setIsDestinationPreviewModalVisible(false);
    setIsDestinationPhotoViewerVisible(false);
    setIsStreetViewViewerVisible(false);
    setIsDriverPhotoGalleryVisible(false);
    setSelectedDriverPhoto(null);
    autocompleteSessionTokenRef.current = createAutocompleteSessionToken();
  };

  const openSupervisorDashboard = async () => {
    const adminUrl = `${API_BASE_URL}/api/admin`;

    try {
      const canOpen = await Linking.canOpenURL(adminUrl);
      if (!canOpen) {
        throw new Error('Unable to open supervisor dashboard on this device.');
      }
      await Linking.openURL(adminUrl);
    } catch (error) {
      Alert.alert(
        'Supervisor dashboard unavailable',
        error.message || 'Make sure the backend is running and the phone can reach the backend.'
      );
    }
  };

  const handleDriverIdChange = (value) => {
    setDriverIdInput(String(value || ''));
    setConfirmedDriver(null);
    setDriverLoginStatus('');
  };

  const confirmDriverLogin = async () => {
    const cleanedDriverId = driverIdInput.trim();

    if (!cleanedDriverId) {
      Alert.alert('Driver ID needed', 'Enter your assigned driver ID before opening today\'s route.');
      return;
    }
    if (!/^\d{6,12}$/.test(driverPinInput)) {
      Alert.alert('Driver PIN needed', 'Enter the 6 to 12 digit PIN assigned by your supervisor.');
      return;
    }

    setIsDriverLoginChecking(true);
    setDriverStartupState('authenticating');
    setDriverLoginStatus('Authenticating driver...');
    try {
      const session = await loginDriverSession(API_BASE_URL, {
        driverId: cleanedDriverId,
        pin: driverPinInput,
      });
      const authenticatedDriverId = session.driver.driverId;
      const authenticatedDriverName = session.driver.driverName || authenticatedDriverId;
      const assignedRoute = await fetchAssignedDriverRouteFromDates({
        routeDates: getAssignedRouteLookupDates(),
        driverId: authenticatedDriverId,
        driverName: authenticatedDriverName,
      });

      if (!assignedRoute) {
        setConfirmedDriver(null);
        setDriverLoginStatus('There is no assigned route for you.');
        Alert.alert(
          'No assigned route',
          'There is no assigned route for you.'
        );
        return;
      }

      const confirmed = buildConfirmedDriver(authenticatedDriverId, authenticatedDriverName, assignedRoute);
      setConfirmedDriver(confirmed);
      setDriverPinInput('');
      setDriverStartupState('authenticated');
      setDriverLoginStatus(`Ready: route ${confirmed.routeNumber} is assigned today.`);
      Alert.alert(
        'Login confirmed',
        `${confirmed.name || confirmed.id} is assigned to route ${confirmed.routeNumber}.`
      );
    } catch (error) {
      setConfirmedDriver(null);
      setDriverStartupState('unauthenticated');
      setDriverLoginStatus(error.message || 'Backend confirmation failed. Today\'s route is locked.');
      Alert.alert(
        'Driver login failed',
        error.message || 'The backend could not confirm this driver ID.'
      );
    } finally {
      setIsDriverLoginChecking(false);
    }
  };

  const switchDriver = async () => {
    await logoutDriverSession(API_BASE_URL);
    setDriverIdInput('');
    setDriverPinInput('');
    setConfirmedDriver(null);
    setDriverStartupState('unauthenticated');
    setDriverLoginStatus('Driver cleared. Enter another driver ID to continue.');
  };

  const openTodayRoute = () => {
    if (!confirmedDriver?.id) {
      Alert.alert('Driver login required', 'Confirm your driver ID before opening today\'s assigned route.');
      return;
    }

    navigation.navigate('TodayRoute', {
      driverId: confirmedDriver.id,
      driverName: confirmedDriver.name,
      routeDate: confirmedDriver.routeDate || getLocalRouteDate(),
    });
  };

  const openDeliveryNotes = () => {
    navigation.navigate('DeliveryNotes', {
      destinationAddress: destination.trim(),
      destinationPlaceId: destinationDetails?.placeId || destinationPlaceId || null,
      destinationDetails,
    });
  };

  const buildMapNavigationParams = (mode) => {
    const cleaned = destination.trim();
    const hasRoutingPlaceId =
      !!destinationDetails && Object.prototype.hasOwnProperty.call(destinationDetails, 'routingPlaceId');
    const effectivePlaceId = hasRoutingPlaceId
      ? destinationDetails.routingPlaceId || null
      : destinationDetails?.placeId || destinationPlaceId || null;

    return {
      destinationAddress: cleaned,
      destinationPlaceId: effectivePlaceId,
      destinationDetails,
      mode,
      initialRouteDetailsVisible: mode === 'directions',
      truckProfile: buildTruckProfilePayload(truckProfile),
    };
  };

  const openDirectionsPreview = () => {
    const cleaned = destination.trim();
    if (!cleaned) {
      Alert.alert('Destination needed', 'Choose a destination before viewing directions.');
      return;
    }

    saveRecentDestination(cleaned);
    navigation.navigate('Map', buildMapNavigationParams('directions'));
  };

  const saveRecentDestination = async (cleanedDestination) => {
    try {
      const effectivePlaceId = destinationDetails?.placeId || destinationPlaceId || null;
      const payload = {
        placeId: effectivePlaceId,
        description: cleanedDestination,
      };

      setRecentDestinations(await saveRecentDestinationRecord(payload));
    } catch {
      // Recent destination storage should never block navigation.
    }
  };

  const handleStart = () => {
    const cleaned = destination.trim();
    if (!cleaned) return;

    saveRecentDestination(cleaned);
    navigation.navigate('Map', buildMapNavigationParams('start'));
  };

  const destinationPreviewPhotoUrl =
    destinationImageMode === 'failed'
      ? null
      : destinationImageMode === 'streetView'
        ? destinationDetails?.streetViewUrl
        : destinationDetails?.photoUrl;

  const destinationStreetViewPanoramaUrl =
    buildDestinationStreetViewPanoramaUrl(destinationDetails);

  const openDestinationVisualExplorer = () => {
    if (destinationStreetViewPanoramaUrl) {
      setIsStreetViewViewerVisible(true);
      return;
    }

    if (destinationPreviewPhotoUrl) {
      setIsDestinationPhotoViewerVisible(true);
    }
  };

  const handleStreetViewNavigationRequest = (request) => {
    const url = String(request?.url || '');
    if (!url) return false;

    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('about:blank')
    ) {
      return true;
    }

    return false;
  };

  const openDriverPhotoGallery = () => {
    setSelectedDriverPhoto(null);
    setIsDriverPhotoGalleryVisible(true);
  };

  const handleDestinationImageError = () => {
    if (
      destinationImageMode === 'primary' &&
      destinationDetails?.streetViewUrl &&
      destinationDetails.streetViewUrl !== destinationDetails?.photoUrl
    ) {
      setDestinationImageMode('streetView');
      return;
    }

    setDestinationImageMode('failed');
  };

  const destinationPhoneNumber =
    destinationDetails?.phoneNumber ||
    destinationDetails?.formattedPhoneNumber ||
    destinationDetails?.internationalPhoneNumber ||
    '';
  const shouldShowRecentDestinations =
    destination.trim().length > 0 &&
    !destinationPlaceId &&
    recentDestinations.length > 0;
  const driverUploadedPhotos = deliveryNotes.flatMap((note) => (
    Array.isArray(note.photos)
      ? note.photos
        .filter((photo) => photo?.url)
        .map((photo) => ({
          ...photo,
          noteId: note.id,
          title: note.accountName || note.customerName || note.destination || destinationDetails?.name || 'Account photo',
          subtitle: note.instructions || note.address || destinationDetails?.formattedAddress || destination,
          driverName: note.driverName || '',
        }))
      : []
  ));
  const driverUploadedPhotoCount = driverUploadedPhotos.length;
  const destinationBusinessCandidates = Array.isArray(destinationDetails?.businessCandidates)
    ? destinationDetails.businessCandidates.filter((candidate) => candidate?.placeId && candidate?.name)
    : [];
  const isDriverRestoring = driverStartupState === 'restoring';
  const isDriverAuthenticated = driverStartupState === 'authenticated';
  const shouldShowDriverLoginForm = !isDriverRestoring && !isDriverAuthenticated && !confirmedDriver;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.driverLoginPanel}>
          {isDriverRestoring ? (
            <View style={styles.driverRestorePanel}>
              <ActivityIndicator color="#ffffff" />
              <Text style={styles.driverRestoreText}>Restoring driver session...</Text>
            </View>
          ) : shouldShowDriverLoginForm ? (
            <>
              <TextInput
                value={driverIdInput}
                onChangeText={handleDriverIdChange}
                placeholder="DRIVER LOGIN"
                placeholderTextColor="#ffffff"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                textContentType="username"
                keyboardType="visible-password"
                returnKeyType="done"
                textAlign="center"
                style={styles.driverLoginTitleTab}
              />
              <TextInput
                value={driverPinInput}
                onChangeText={(value) => {
                  setDriverPinInput(String(value || '').replace(/\D/g, '').slice(0, 12));
                  setConfirmedDriver(null);
                  setDriverLoginStatus('');
                }}
                placeholder="DRIVER PIN"
                placeholderTextColor="#ffffff"
                keyboardType="number-pad"
                secureTextEntry
                maxLength={12}
                textAlign="center"
                style={styles.driverLoginTitleTab}
              />
              <Pressable
                onPress={confirmDriverLogin}
                disabled={isDriverLoginChecking}
                style={({ pressed }) => [
                  styles.driverLoginButton,
                  isDriverLoginChecking && styles.driverLoginButtonDisabled,
                  pressed && styles.supervisorButtonPressed,
                ]}
              >
                <Text style={styles.driverLoginButtonText}>
                  {isDriverLoginChecking ? 'Authenticating...' : 'Sign In'}
                </Text>
              </Pressable>
            </>
          ) : !confirmedDriver ? (
            <View style={styles.driverLoginConfirmed}>
              <Text style={styles.driverLoginConfirmedTitle}>Login Confirmed</Text>
              <Text style={styles.driverLoginConfirmedText}>
                {driverLoginStatus || 'Driver session is active. Checking assigned route...'}
              </Text>
              <Pressable
                onPress={switchDriver}
                style={({ pressed }) => [
                  styles.switchDriverButton,
                  pressed && styles.supervisorButtonPressed,
                ]}
              >
                <Text style={styles.switchDriverButtonText}>Switch Driver</Text>
              </Pressable>
            </View>
          ) : null}
          {!!confirmedDriver && (
            <View style={styles.driverLoginConfirmed}>
              <Text style={styles.driverLoginConfirmedTitle}>Login Confirmed</Text>
              <Text style={styles.driverLoginConfirmedText}>
                {confirmedDriver.name || confirmedDriver.id} | Route {confirmedDriver.routeNumber} | {confirmedDriver.stopCount} stops
              </Text>
              <Pressable
                onPress={switchDriver}
                style={({ pressed }) => [
                  styles.switchDriverButton,
                  pressed && styles.supervisorButtonPressed,
                ]}
              >
                <Text style={styles.switchDriverButtonText}>Switch Driver</Text>
              </Pressable>
            </View>
          )}
          {!!driverLoginStatus && !confirmedDriver && (
            <Text style={styles.driverLoginStatusText}>{driverLoginStatus}</Text>
          )}
        </View>

        <View style={styles.homeSpacer} />

        <View style={styles.actionFooter}>
          <Pressable
            onPress={openTodayRoute}
            style={({ pressed }) => [
              styles.todayRouteButton,
              !confirmedDriver && styles.todayRouteButtonDisabled,
              pressed && styles.supervisorButtonPressed,
            ]}
          >
            <Text style={styles.todayRouteButtonText}>Today's Assigned Route</Text>
          </Pressable>
          <Pressable
            onPress={openSupervisorDashboard}
            style={({ pressed }) => [
              styles.supervisorBottomButton,
              pressed && styles.supervisorButtonPressed,
            ]}
          >
            <Text style={styles.supervisorButtonText}>Supervisor Dashboard</Text>
          </Pressable>
        </View>

        <View style={styles.routeSetupPanel}>
          <View style={styles.destinationInputWrap}>
            <View pointerEvents="none" style={styles.searchIcon}>
              <View style={styles.searchIconCircle} />
              <View style={styles.searchIconHandle} />
            </View>
            <TextInput
              value={destination}
              onChangeText={handleDestinationChange}
              placeholder="Search here"
              placeholderTextColor="#d2d8df"
              autoCapitalize="words"
              autoCorrect={false}
              autoComplete="street-address"
              textContentType="fullStreetAddress"
              returnKeyType="search"
              style={[styles.input, styles.destinationInput]}
            />
            {!!destination && (
              <Pressable
                onPress={clearDestination}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.clearDestinationButton,
                  pressed && styles.clearDestinationButtonPressed,
                ]}
              >
                <Text style={styles.clearDestinationText}>Clear</Text>
              </Pressable>
            )}
          </View>

          {(isAutocompleteLoading || destinationPredictions.length > 0 || !!autocompleteError || !!lastAutocompleteQuery) && (
            <View style={styles.suggestionPanel}>
              {isAutocompleteLoading && (
                <View style={styles.suggestionStatusRow}>
                  <ActivityIndicator size="small" color="#d62828" />
                  <Text style={styles.suggestionStatusText}>Finding addresses...</Text>
                </View>
              )}

              {destinationPredictions.map((prediction) => (
                <Pressable
                  key={prediction.placeId}
                  onPress={() => handlePredictionPress(prediction)}
                  style={({ pressed }) => [
                    styles.suggestionItem,
                    pressed && styles.suggestionItemPressed,
                  ]}
                >
                  <View style={styles.suggestionTopRow}>
                    <Text style={styles.suggestionMainText} numberOfLines={1}>
                      {prediction.mainText}
                    </Text>
                    <Text style={styles.suggestionTypeText}>
                      {predictionTypeLabel(prediction.types)}
                    </Text>
                  </View>
                  {!!prediction.secondaryText && (
                    <Text style={styles.suggestionSecondaryText} numberOfLines={1}>
                      {prediction.secondaryText}
                    </Text>
                  )}
                </Pressable>
              ))}

              {!!autocompleteError && (
                <Text style={styles.suggestionErrorText}>{autocompleteError}</Text>
              )}

              {!isAutocompleteLoading &&
                !autocompleteError &&
                !!lastAutocompleteQuery &&
                destinationPredictions.length === 0 && (
                  <Text style={styles.suggestionEmptyText}>No matching addresses found.</Text>
                )}
              <GoogleMapsAttribution />
            </View>
          )}

          {isDestinationDetailsLoading && (
            <View style={styles.destinationPreviewLoading}>
              <ActivityIndicator size="small" color="#d62828" />
              <Text style={styles.destinationPreviewLoadingText}>Loading destination preview...</Text>
            </View>
          )}

          {!!destinationDetails && (
            <View style={styles.destinationPreview}>
              {destinationPreviewPhotoUrl ? (
                <Pressable
                  onPress={openDestinationVisualExplorer}
                  style={({ pressed }) => [
                    styles.destinationPreviewImageButton,
                    pressed && styles.destinationPreviewImagePressed,
                  ]}
                >
                  <Image
                    source={{ uri: destinationPreviewPhotoUrl }}
                    style={styles.destinationPreviewImage}
                    resizeMode="cover"
                    onError={handleDestinationImageError}
                  />
                  <View style={styles.destinationImageHint}>
                    <Text style={styles.destinationImageHintText}>Tap to explore photo</Text>
                  </View>
                </Pressable>
              ) : (
                <View style={styles.destinationPreviewFallback}>
                  <Text style={styles.destinationPreviewFallbackText}>Destination image unavailable</Text>
                </View>
              )}

              <View style={styles.destinationPreviewTextWrap}>
                <GoogleMapsAttribution
                  photoAttributions={destinationDetails.photoAttributions}
                />
                <Text style={styles.destinationPreviewTitle} numberOfLines={1}>
                  {destinationDetails.name || destination}
                </Text>
                <Text style={styles.destinationPreviewAddress} numberOfLines={2}>
                  {destinationDetails.formattedAddress || destinationDetails.secondaryText || destination}
                </Text>
                {!!destinationPhoneNumber && (
                  <Text style={styles.destinationPreviewPhone} numberOfLines={1}>
                    {destinationPhoneNumber}
                  </Text>
                )}
                {destinationBusinessCandidates.length > 0 && (
                  <View style={styles.businessCandidatePanel}>
                    <Text style={styles.businessCandidateKicker}>Also at this location</Text>
                    <ScrollView
                      horizontal={true}
                      showsHorizontalScrollIndicator={false}
                      keyboardShouldPersistTaps="handled"
                      contentContainerStyle={styles.businessCandidateList}
                    >
                      {destinationBusinessCandidates.map((candidate) => (
                        <Pressable
                          key={candidate.placeId}
                          onPress={() => handleBusinessCandidatePress(candidate)}
                          style={({ pressed }) => [
                            styles.businessCandidateCard,
                            pressed && styles.destinationActionPressed,
                          ]}
                        >
                          <View style={styles.businessCandidateTextWrap}>
                            <Text style={styles.businessCandidateName} numberOfLines={1}>
                              {candidate.name}
                            </Text>
                            <Text style={styles.businessCandidateMeta} numberOfLines={1}>
                              {candidate.rating ? `${candidate.rating.toFixed(1)} stars` : 'Business/account'}
                            </Text>
                            <GoogleMapsAttribution
                              photoAttributions={candidate.photoAttributions}
                            />
                          </View>
                          {candidate.photoUrl ? (
                            <Image
                              source={{ uri: candidate.photoUrl }}
                              style={styles.businessCandidateImage}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.businessCandidateImageFallback}>
                              <Text style={styles.businessCandidateImageText}>GO</Text>
                            </View>
                          )}
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
                {!destinationPreviewPhotoUrl && (
                  <Text style={styles.destinationPreviewPhotoNote}>
                    Destination image unavailable from Google.
                  </Text>
                )}

                <View style={styles.destinationPrimaryActions}>
                  <Pressable
                    onPress={openDirectionsPreview}
                    style={({ pressed }) => [
                      styles.destinationPrimaryActionTab,
                      pressed && styles.destinationActionPressed,
                    ]}
                  >
                    <Text style={styles.destinationPrimaryActionIcon}>></Text>
                    <Text style={styles.destinationPrimaryActionText}>Directions</Text>
                  </Pressable>

                  <Pressable
                    onPress={handleStart}
                    style={({ pressed }) => [
                      styles.destinationPrimaryActionTab,
                      styles.destinationPrimaryActionTabStart,
                      pressed && styles.destinationActionPressed,
                    ]}
                  >
                    <Text style={[styles.destinationPrimaryActionIcon, styles.destinationPrimaryActionStartIcon]}>
                      ^
                    </Text>
                    <Text style={styles.destinationPrimaryActionText}>Start</Text>
                  </Pressable>
                </View>

                <View style={styles.destinationActionGrid}>
                  <Pressable
                    onPress={openDriverPhotoGallery}
                    style={({ pressed }) => [
                      styles.destinationSquareTab,
                      pressed && styles.destinationActionPressed,
                    ]}
                  >
                    <View style={styles.destinationSquareTextWrap}>
                      <Text style={styles.destinationSquareTitle}>Uploaded Photos</Text>
                      <Text style={styles.destinationSquareSubtitle}>
                        {driverUploadedPhotoCount} driver upload{driverUploadedPhotoCount === 1 ? '' : 's'}
                      </Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={openDeliveryNotes}
                    style={({ pressed }) => [
                      styles.destinationSquareTab,
                      pressed && styles.destinationActionPressed,
                    ]}
                  >
                    <View style={styles.destinationSquareTextWrap}>
                      <Text style={styles.destinationSquareTitle}>Delivery Notes</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {shouldShowRecentDestinations && (
            <View style={styles.recentPanel}>
              <Text style={styles.recentTitle}>Recent destinations</Text>
              {recentDestinations.slice(0, 5).map((record) => (
                <Pressable
                  key={record.placeId || record.description}
                  onPress={() => handleRecentDestinationPress(record)}
                  style={({ pressed }) => [
                    styles.recentItem,
                    pressed && styles.recentItemPressed,
                  ]}
                >
                  {record.photoUrl ? (
                    <Image
                      source={{ uri: record.photoUrl }}
                      style={styles.recentImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.recentImageFallback}>
                      <Text style={styles.recentImageFallbackText}>DEST</Text>
                    </View>
                  )}
                  <View style={styles.recentTextWrap}>
                    <Text style={styles.recentMainText} numberOfLines={1}>
                      {record.name || record.mainText || record.description}
                    </Text>
                    <Text style={styles.recentSecondaryText} numberOfLines={1}>
                      {record.secondaryText || record.description}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

        </View>
      </ScrollView>

      <Modal
        visible={isDestinationPreviewModalVisible && !!destinationDetails}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDestinationPreviewModalVisible(false)}
      >
        <View style={styles.destinationModalOverlay}>
          <View style={styles.destinationModalCard}>
            <View style={styles.destinationModalHeader}>
              <View style={styles.destinationModalTitleWrap}>
                <Text style={styles.destinationModalKicker}>Selected Destination</Text>
                <Text style={styles.destinationModalTitle} numberOfLines={2}>
                  {destinationDetails?.name || destination}
                </Text>
              </View>
              <Pressable
                onPress={() => setIsDestinationPreviewModalVisible(false)}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.destinationModalCloseButton,
                  pressed && styles.destinationModalCloseButtonPressed,
                ]}
              >
                <Text style={styles.destinationModalCloseText}>X</Text>
              </Pressable>
            </View>

            {destinationPreviewPhotoUrl ? (
              <Image
                source={{ uri: destinationPreviewPhotoUrl }}
                style={styles.destinationModalImage}
                resizeMode="cover"
                onError={handleDestinationImageError}
              />
            ) : (
              <View style={styles.destinationModalImageFallback}>
                <Text style={styles.destinationModalImageFallbackText}>Destination image unavailable</Text>
              </View>
            )}

            <View style={styles.destinationModalInfoPanel}>
              <GoogleMapsAttribution
                photoAttributions={destinationDetails?.photoAttributions}
              />
              <Text style={styles.destinationModalLabel}>Address</Text>
              <Text style={styles.destinationModalValue}>
                {destinationDetails?.formattedAddress || destinationDetails?.secondaryText || destination}
              </Text>

              <Text style={styles.destinationModalLabel}>Phone</Text>
              <Text style={styles.destinationModalValue}>
                {destinationPhoneNumber || 'Phone number unavailable'}
              </Text>
            </View>

            <View style={styles.destinationModalActions}>
              <Pressable
                onPress={() => setIsDestinationPreviewModalVisible(false)}
                style={({ pressed }) => [
                  styles.destinationModalSecondaryButton,
                  pressed && styles.destinationModalButtonPressed,
                ]}
              >
                <Text style={styles.destinationModalSecondaryText}>Close</Text>
              </Pressable>

              <Pressable
                onPress={handleStart}
                style={({ pressed }) => [
                  styles.destinationModalPrimaryButton,
                  pressed && styles.destinationModalButtonPressed,
                ]}
              >
                <Text style={styles.destinationModalPrimaryText}>Start Navigation</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isDestinationPhotoViewerVisible && !!destinationPreviewPhotoUrl}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsDestinationPhotoViewerVisible(false)}
      >
        <View style={styles.photoViewerOverlay}>
          <View style={styles.photoViewerHeader}>
            <View style={styles.photoViewerTitleWrap}>
              <Text style={styles.photoViewerKicker}>Destination photo</Text>
              <Text style={styles.photoViewerTitle} numberOfLines={1}>
                {destinationDetails?.name || destination}
              </Text>
            </View>
            <Pressable
              onPress={() => setIsDestinationPhotoViewerVisible(false)}
              style={({ pressed }) => [
                styles.photoViewerCloseButton,
                pressed && styles.destinationModalCloseButtonPressed,
              ]}
            >
              <Text style={styles.photoViewerCloseText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.photoViewerVerticalScroll}
            contentContainerStyle={styles.photoViewerVerticalContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
            bouncesZoom={true}
          >
            <GoogleMapsAttribution
              photoAttributions={destinationDetails?.photoAttributions}
            />
            <ScrollView
              horizontal={true}
              bounces={true}
              contentContainerStyle={styles.photoViewerHorizontalContent}
            >
              <Image
                source={{ uri: destinationPreviewPhotoUrl }}
                style={styles.photoViewerImage}
                resizeMode="cover"
                onError={handleDestinationImageError}
              />
            </ScrollView>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={isStreetViewViewerVisible && !!destinationStreetViewPanoramaUrl}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setIsStreetViewViewerVisible(false)}
      >
        <SafeAreaView style={styles.streetViewExplorer}>
          <View style={styles.streetViewHeader}>
            <View style={styles.photoViewerTitleWrap}>
              <Text style={styles.photoViewerKicker}>360 destination view</Text>
              <Text style={styles.photoViewerTitle} numberOfLines={1}>
                {destinationDetails?.name || destination}
              </Text>
            </View>
            <Pressable
              onPress={() => setIsStreetViewViewerVisible(false)}
              style={({ pressed }) => [
                styles.photoViewerCloseButton,
                pressed && styles.destinationModalCloseButtonPressed,
              ]}
            >
              <Text style={styles.photoViewerCloseText}>Close</Text>
            </Pressable>
          </View>
          <WebView
            source={{ uri: destinationStreetViewPanoramaUrl }}
            style={styles.streetViewWebView}
            originWhitelist={['*']}
            onShouldStartLoadWithRequest={handleStreetViewNavigationRequest}
            startInLoadingState={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={isDriverPhotoGalleryVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          setSelectedDriverPhoto(null);
          setIsDriverPhotoGalleryVisible(false);
        }}
      >
        <SafeAreaView style={styles.driverPhotoGallery}>
          <View style={styles.driverPhotoGalleryHeader}>
            <View style={styles.photoViewerTitleWrap}>
              <Text style={styles.photoViewerKicker}>Driver-uploaded photos</Text>
              <Text style={styles.photoViewerTitle} numberOfLines={1}>
                {destinationDetails?.name || destination || 'Selected account'}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setSelectedDriverPhoto(null);
                setIsDriverPhotoGalleryVisible(false);
              }}
              style={({ pressed }) => [
                styles.photoViewerCloseButton,
                pressed && styles.destinationModalCloseButtonPressed,
              ]}
            >
              <Text style={styles.photoViewerCloseText}>Close</Text>
            </Pressable>
          </View>

          {selectedDriverPhoto ? (
            <View style={styles.driverPhotoDetail}>
              <Pressable
                onPress={() => setSelectedDriverPhoto(null)}
                style={({ pressed }) => [
                  styles.driverPhotoBackButton,
                  pressed && styles.destinationActionPressed,
                ]}
              >
                <Text style={styles.driverPhotoBackText}>Back to photos</Text>
              </Pressable>
              <AuthenticatedMediaImage
                media={selectedDriverPhoto}
                style={styles.driverPhotoDetailImage}
                resizeMode="contain"
              />
              <Text style={styles.driverPhotoDetailTitle} numberOfLines={2}>
                {selectedDriverPhoto.title}
              </Text>
              {!!selectedDriverPhoto.subtitle && (
                <Text style={styles.driverPhotoDetailCaption} numberOfLines={4}>
                  {selectedDriverPhoto.subtitle}
                </Text>
              )}
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.driverPhotoGalleryContent}>
              {driverUploadedPhotoCount === 0 ? (
                <View style={styles.driverPhotoEmptyCard}>
                  <Text style={styles.driverPhotoEmptyTitle}>No driver photos yet</Text>
                  <Text style={styles.driverPhotoEmptyText}>
                    Photos uploaded by drivers for this account will appear here.
                  </Text>
                  <Pressable
                    onPress={() => {
                      setIsDriverPhotoGalleryVisible(false);
                      openDeliveryNotes();
                    }}
                    style={({ pressed }) => [
                      styles.driverPhotoEmptyButton,
                      pressed && styles.destinationActionPressed,
                    ]}
                  >
                    <Text style={styles.driverPhotoEmptyButtonText}>Add Photos</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.driverPhotoGrid}>
                  {driverUploadedPhotos.map((photo, index) => (
                    <Pressable
                      key={`${photo.id || photo.url}-${index}`}
                      onPress={() => setSelectedDriverPhoto(photo)}
                      style={({ pressed }) => [
                        styles.driverPhotoTile,
                        pressed && styles.destinationActionPressed,
                      ]}
                    >
                      <AuthenticatedMediaImage
                        media={photo}
                        style={styles.driverPhotoTileImage}
                        resizeMode="cover"
                      />
                      <View style={styles.driverPhotoTileCaption}>
                        <Text style={styles.driverPhotoTileTitle} numberOfLines={1}>
                          {photo.title}
                        </Text>
                        {!!photo.driverName && (
                          <Text style={styles.driverPhotoTileMeta} numberOfLines={1}>
                            {photo.driverName}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#152235',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 30,
    justifyContent: 'flex-start',
  },
  headerPanel: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 18,
    marginBottom: 14,
    backgroundColor: '#c8131f',
    shadowColor: '#8c1118',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandTextWrap: {
    flex: 1,
  },
  brandKicker: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    color: '#aee4ff',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
    color: '#ffffff',
  },
  subtitle: {
    marginTop: 14,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    color: '#ffffff',
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  statusCircleRed: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.66)',
  },
  statusCircleBlue: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1565c0',
    borderWidth: 2,
    borderColor: 'rgba(174,228,255,0.72)',
  },
  statusCircleText: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    color: '#102033',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  statusCircleTextLight: {
    color: '#ffffff',
  },
  supervisorButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(7, 25, 43, 0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.48)',
  },
  supervisorButtonPressed: {
    opacity: 0.82,
  },
  supervisorButtonText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  todayRouteButton: {
    minHeight: 58,
    width: '88%',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 8,
    backgroundColor: 'rgba(13, 127, 137, 0.74)',
    borderWidth: 1,
    borderColor: 'rgba(155, 241, 255, 0.42)',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  todayRouteButtonDisabled: {
    opacity: 0.54,
    backgroundColor: 'rgba(70, 87, 98, 0.72)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  todayRouteButtonText: {
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  driverLoginPanel: {
    zIndex: 2,
    alignItems: 'center',
    marginTop: 6,
  },
  driverLoginTitleTab: {
    width: '78%',
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(17, 25, 35, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(127,208,255,0.32)',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  driverRestorePanel: {
    width: '78%',
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: 'rgba(17, 25, 35, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(127,208,255,0.32)',
  },
  driverRestoreText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  driverLoginKicker: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    color: '#7fd0ff',
    textTransform: 'uppercase',
  },
  driverLoginTitle: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    color: '#ffffff',
  },
  driverLoginInput: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 16,
    marginTop: 13,
    backgroundColor: '#242a31',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  driverLoginButton: {
    minHeight: 48,
    width: '78%',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    backgroundColor: '#d62828',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  driverLoginButtonDisabled: {
    opacity: 0.68,
  },
  driverLoginButtonText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  driverLoginConfirmed: {
    width: '88%',
    marginTop: 12,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(64, 230, 131, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(64, 230, 131, 0.34)',
  },
  driverLoginConfirmedTitle: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    color: '#7dffb0',
    textTransform: 'uppercase',
  },
  driverLoginConfirmedText: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  switchDriverButton: {
    alignSelf: 'flex-start',
    minHeight: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 9,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  switchDriverButtonText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  driverLoginStatusText: {
    width: '84%',
    marginTop: 10,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    color: '#c7d4df',
    textAlign: 'center',
  },
  homeSpacer: {
    flex: 1,
    minHeight: 260,
  },
  routeSetupPanel: {
    display: 'none',
    marginTop: 14,
    marginBottom: 16,
    zIndex: 1,
  },
  backendStatusPill: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  backendStatusOk: {
    backgroundColor: '#dff7ed',
    borderColor: '#2e9d67',
  },
  backendStatusError: {
    backgroundColor: '#ffe8e8',
    borderColor: '#d62828',
  },
  backendStatusPressed: {
    opacity: 0.78,
  },
  backendStatusText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    color: '#102033',
  },
  backendStatusDetail: {
    marginTop: 2,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    color: '#33566f',
  },
  label: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1565c0',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 0,
    borderRadius: 28,
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 16,
    backgroundColor: '#242a31',
    fontSize: 19,
    color: '#ffffff',
  },
  destinationInputWrap: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 22,
    top: 18,
    zIndex: 2,
    width: 24,
    height: 24,
  },
  searchIconCircle: {
    position: 'absolute',
    left: 1,
    top: 1,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#f5f7fa',
  },
  searchIconHandle: {
    position: 'absolute',
    left: 15,
    top: 16,
    width: 11,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#f5f7fa',
    transform: [{ rotate: '45deg' }],
  },
  destinationInput: {
    minHeight: 58,
    paddingLeft: 58,
    paddingRight: 84,
    shadowColor: '#000000',
    shadowOpacity: 0.32,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 9,
  },
  clearDestinationButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    height: 38,
    minWidth: 56,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4e5660',
  },
  clearDestinationButtonPressed: {
    opacity: 0.75,
  },
  clearDestinationText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
  },
  suggestionPanel: {
    marginTop: -6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#20262d',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  suggestionStatusRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  suggestionStatusText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#c7d4df',
  },
  suggestionItem: {
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  suggestionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestionItemPressed: {
    backgroundColor: '#203f5f',
  },
  suggestionMainText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  suggestionTypeText: {
    minWidth: 54,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    overflow: 'hidden',
    textAlign: 'center',
    backgroundColor: '#d9212e',
    fontSize: 10,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  suggestionSecondaryText: {
    marginTop: 3,
    fontSize: 13,
    color: '#a9bac8',
  },
  suggestionErrorText: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#ff9ca5',
  },
  suggestionEmptyText: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#c7d4df',
  },
  googleMapsAttribution: {
    minHeight: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  googleMapsAttributionText: {
    color: '#ffffff',
    fontSize: 12,
    fontStyle: 'normal',
    fontWeight: '400',
  },
  destinationPreviewLoading: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -4,
    marginBottom: 16,
  },
  destinationPreviewLoadingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#c7d4df',
  },
  destinationPreview: {
    borderWidth: 0,
    borderRadius: 22,
    overflow: 'hidden',
    marginTop: -4,
    marginBottom: 16,
    backgroundColor: '#20262d',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  destinationPreviewImageButton: {
    position: 'relative',
    overflow: 'hidden',
  },
  destinationPreviewImagePressed: {
    opacity: 0.9,
  },
  destinationPreviewImage: {
    width: '100%',
    height: 420,
    backgroundColor: '#eeeeee',
  },
  destinationImageHint: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  destinationImageHintText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  destinationPreviewFallback: {
    width: '100%',
    height: 360,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#102235',
  },
  destinationPreviewFallbackText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    textAlign: 'center',
    color: '#c7d4df',
  },
  destinationPreviewTextWrap: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: '#20262d',
  },
  destinationPreviewKicker: {
    marginBottom: 4,
    fontSize: 10,
    fontWeight: '900',
    color: '#ff6f7a',
    textTransform: 'uppercase',
  },
  destinationPreviewTitle: {
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    color: '#ffffff',
  },
  destinationPreviewAddress: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 17,
    color: '#c7d4df',
  },
  destinationPreviewPhone: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    color: '#7fd0ff',
  },
  destinationPreviewPhotoNote: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#ffd37a',
  },
  businessCandidatePanel: {
    marginTop: 12,
    borderRadius: 18,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: 'rgba(10, 18, 28, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(127, 208, 255, 0.18)',
  },
  businessCandidateKicker: {
    paddingHorizontal: 12,
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    color: '#7fd0ff',
    textTransform: 'uppercase',
  },
  businessCandidateList: {
    gap: 10,
    paddingHorizontal: 10,
  },
  businessCandidateCard: {
    width: 252,
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#2a3038',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  businessCandidateTextWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  businessCandidateName: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  businessCandidateMeta: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    color: '#c7d4df',
  },
  businessCandidateImage: {
    width: 82,
    height: '100%',
    backgroundColor: '#111820',
  },
  businessCandidateImageFallback: {
    width: 82,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#152839',
  },
  businessCandidateImageText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#7fd0ff',
  },
  destinationPrimaryActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  destinationPrimaryActionTab: {
    flex: 1,
    minHeight: 58,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: 'rgba(127, 208, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(127, 208, 255, 0.42)',
  },
  destinationPrimaryActionTabStart: {
    backgroundColor: 'rgba(13, 127, 137, 0.42)',
    borderColor: 'rgba(155, 241, 255, 0.58)',
  },
  destinationPrimaryActionIcon: {
    fontSize: 42,
    lineHeight: 44,
    fontWeight: '900',
    color: '#ffffff',
  },
  destinationPrimaryActionStartIcon: {
    marginTop: 8,
  },
  destinationPrimaryActionText: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '900',
    color: '#ffffff',
  },
  destinationActionPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  destinationActionGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    marginBottom: 2,
  },
  destinationSquareTab: {
    flex: 1,
    minHeight: 76,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(12, 25, 36, 0.68)',
    borderWidth: 1,
    borderColor: 'rgba(127,208,255,0.26)',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  destinationSquareTabDisabled: {
    opacity: 0.58,
  },
  destinationSquareTextWrap: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationSquareTitle: {
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
    color: '#ffffff',
  },
  destinationSquareSubtitle: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '800',
    color: '#c7d4df',
  },
  recentPanel: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    marginBottom: 4,
    backgroundColor: '#20262d',
    overflow: 'hidden',
  },
  recentTitle: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    fontSize: 12,
    fontWeight: '900',
    color: '#7fd0ff',
    textTransform: 'uppercase',
  },
  recentItem: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  recentItemPressed: {
    backgroundColor: '#203f5f',
  },
  recentImage: {
    width: 48,
    height: 42,
    borderRadius: 8,
    backgroundColor: '#eeeeee',
  },
  recentImageFallback: {
    width: 48,
    height: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5ff',
    borderWidth: 1,
    borderColor: '#2f78a5',
  },
  recentImageFallbackText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#1565c0',
  },
  recentTextWrap: {
    flex: 1,
  },
  recentMainText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  recentSecondaryText: {
    marginTop: 3,
    fontSize: 12,
    color: '#a9bac8',
  },
  deliveryNotesButton: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 2,
    backgroundColor: '#20262d',
    borderWidth: 0,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  deliveryNotesButtonPressed: {
    opacity: 0.84,
  },
  deliveryNotesIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d9212e',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  deliveryNotesIconText: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '900',
    color: '#ffffff',
  },
  deliveryNotesTextWrap: {
    flex: 1,
  },
  deliveryNotesTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#ffffff',
  },
  deliveryNotesSubtitle: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#c7d4df',
  },
  actionFooter: {
    marginTop: 0,
    marginBottom: 8,
    zIndex: 1,
    alignItems: 'center',
  },
  routeCircleActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 18,
    marginBottom: 12,
  },
  routeCircleActionWrap: {
    width: 68,
    alignItems: 'center',
  },
  routeCircleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9, 25, 36, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(127,208,255,0.42)',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  routeCircleButtonPrimary: {
    backgroundColor: 'rgba(13, 127, 137, 0.48)',
    borderColor: 'rgba(155, 241, 255, 0.54)',
  },
  routeCircleButtonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.96 }],
  },
  routeCircleIcon: {
    fontSize: 21,
    lineHeight: 23,
    fontWeight: '900',
    color: '#ffffff',
  },
  routeCircleLabel: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    color: '#c7d4df',
    textTransform: 'uppercase',
  },
  profilePanel: {
    borderWidth: 2,
    borderColor: '#a9303a',
    borderRadius: 18,
    padding: 14,
    marginBottom: 18,
    backgroundColor: '#f1d7dc',
    shadowColor: '#d62828',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#c8131f',
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  switchRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: '#102033',
  },
  switchDetail: {
    marginTop: 4,
    maxWidth: 220,
    fontSize: 12,
    color: '#666666',
  },
  startButton: {
    backgroundColor: '#0d7f89',
    width: '100%',
    minHeight: 62,
    borderRadius: 31,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(155, 241, 255, 0.34)',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
    marginTop: 4,
  },
  startButtonPressed: {
    opacity: 0.85,
  },
  startButtonText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 16,
    textTransform: 'uppercase',
  },
  supervisorBottomButton: {
    minHeight: 46,
    width: '72%',
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 12,
    backgroundColor: 'rgba(32, 38, 45, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 10, 18, 0.96)',
  },
  photoViewerHeader: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 26,
    paddingBottom: 12,
    backgroundColor: 'rgba(20, 30, 42, 0.94)',
  },
  photoViewerTitleWrap: {
    flex: 1,
  },
  photoViewerKicker: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    color: '#7fd0ff',
    textTransform: 'uppercase',
  },
  photoViewerTitle: {
    marginTop: 3,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    color: '#ffffff',
  },
  photoViewerCloseButton: {
    minHeight: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#2b333d',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  photoViewerCloseText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  photoViewerVerticalScroll: {
    flex: 1,
  },
  photoViewerVerticalContent: {
    minHeight: 820,
    justifyContent: 'center',
  },
  photoViewerHorizontalContent: {
    minWidth: 920,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  photoViewerImage: {
    width: 880,
    height: 620,
    borderRadius: 24,
    backgroundColor: '#20262d',
  },
  streetViewExplorer: {
    flex: 1,
    backgroundColor: '#050b12',
  },
  streetViewHeader: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#11151c',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  streetViewWebView: {
    flex: 1,
    backgroundColor: '#050b12',
  },
  driverPhotoGallery: {
    flex: 1,
    backgroundColor: '#07121f',
  },
  driverPhotoGalleryHeader: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#11151c',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  driverPhotoGalleryContent: {
    padding: 16,
    paddingBottom: 28,
  },
  driverPhotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  driverPhotoTile: {
    width: '48%',
    minHeight: 178,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#152235',
    borderWidth: 1,
    borderColor: 'rgba(127,208,255,0.18)',
  },
  driverPhotoTileImage: {
    width: '100%',
    height: 126,
    backgroundColor: '#20262d',
  },
  driverPhotoTileCaption: {
    padding: 9,
  },
  driverPhotoTileTitle: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    color: '#ffffff',
  },
  driverPhotoTileMeta: {
    marginTop: 3,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    color: '#7fd0ff',
  },
  driverPhotoDetail: {
    flex: 1,
    padding: 16,
  },
  driverPhotoBackButton: {
    alignSelf: 'flex-start',
    minHeight: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    marginBottom: 12,
    backgroundColor: 'rgba(127,208,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(127,208,255,0.28)',
  },
  driverPhotoBackText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  driverPhotoDetailImage: {
    flex: 1,
    width: '100%',
    borderRadius: 20,
    backgroundColor: '#050b12',
  },
  driverPhotoDetailTitle: {
    marginTop: 14,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '900',
    color: '#ffffff',
  },
  driverPhotoDetailCaption: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: '#c7d4df',
  },
  driverPhotoEmptyCard: {
    minHeight: 240,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
    backgroundColor: '#152235',
    borderWidth: 1,
    borderColor: 'rgba(127,208,255,0.20)',
  },
  driverPhotoEmptyTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  driverPhotoEmptyText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#c7d4df',
    textAlign: 'center',
  },
  driverPhotoEmptyButton: {
    marginTop: 16,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#0d7f89',
  },
  driverPhotoEmptyButtonText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  streetViewUnavailableCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#050b12',
  },
  streetViewUnavailableTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    textAlign: 'center',
    color: '#ffffff',
  },
  streetViewUnavailableText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: '#c7d4df',
  },
  streetViewOpenBrowserButton: {
    marginTop: 18,
    minHeight: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#0d7f89',
  },
  streetViewOpenBrowserText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  destinationModalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    backgroundColor: 'rgba(12, 38, 64, 0.58)',
  },
  destinationModalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    shadowColor: '#000000',
    shadowOpacity: 0.26,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  destinationModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: '#fff6f7',
  },
  destinationModalTitleWrap: {
    flex: 1,
  },
  destinationModalKicker: {
    marginBottom: 4,
    fontSize: 11,
    fontWeight: '900',
    color: '#b5121b',
    textTransform: 'uppercase',
  },
  destinationModalTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    color: '#111111',
  },
  destinationModalCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe5e9',
  },
  destinationModalCloseButtonPressed: {
    opacity: 0.75,
  },
  destinationModalCloseText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#b5121b',
  },
  destinationModalImage: {
    width: '100%',
    height: 245,
    backgroundColor: '#e8f5ff',
  },
  destinationModalImageFallback: {
    width: '100%',
    height: 245,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#e8f5ff',
  },
  destinationModalImageFallbackText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    textAlign: 'center',
    color: '#24506f',
  },
  destinationModalInfoPanel: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 6,
  },
  destinationModalLabel: {
    marginTop: 10,
    fontSize: 11,
    fontWeight: '900',
    color: '#24506f',
    textTransform: 'uppercase',
  },
  destinationModalValue: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
    color: '#111111',
  },
  destinationModalActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 18,
  },
  destinationModalSecondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e8f5ff',
    borderWidth: 1,
    borderColor: '#2f78a5',
  },
  destinationModalPrimaryButton: {
    flex: 1.35,
    minHeight: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d62828',
  },
  destinationModalButtonPressed: {
    opacity: 0.82,
  },
  destinationModalSecondaryText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1565c0',
    textTransform: 'uppercase',
  },
  destinationModalPrimaryText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
});
