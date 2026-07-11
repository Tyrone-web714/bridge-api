import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { submitDriverHazardReport } from '../services/routingApi';

const HAZARD_TYPES = [
  { key: 'low_bridge', label: 'Low Bridge' },
  { key: 'no_truck', label: 'No-Through-Truck' },
  { key: 'residential', label: 'Residential' },
];
const MAX_PHOTOS = 4;

function photoPayload(asset) {
  return {
    base64: asset.base64,
    mimeType: asset.mimeType || 'image/jpeg',
    fileName: asset.fileName || `hazard-${Date.now()}.jpg`,
  };
}

export default function HazardReportScreen({ navigation, route }) {
  const driverId = String(route?.params?.driverId || '').trim();
  const driverName = String(route?.params?.driverName || driverId).trim();
  const [category, setCategory] = useState('low_bridge');
  const [name, setName] = useState('');
  const [nearbyAddress, setNearbyAddress] = useState('');
  const [clearanceFt, setClearanceFt] = useState('');
  const [notes, setNotes] = useState('');
  const [coordinate, setCoordinate] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshLocation = async () => {
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error('Location permission is required to report the hazard position.');
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCoordinate({
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: result.coords.accuracy,
        heading: result.coords.heading,
        speed: result.coords.speed,
      });
    } catch (error) {
      Alert.alert('Location unavailable', error.message || 'Unable to capture the hazard location.');
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    refreshLocation();
  }, []);

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Photo limit reached', `Attach up to ${MAX_PHOTOS} hazard photos.`);
      return;
    }
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access to photograph the hazard.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.35,
      base64: true,
    });
    if (!result.canceled && result.assets?.[0]?.base64) {
      setPhotos((current) => [...current, result.assets[0]].slice(0, MAX_PHOTOS));
    }
  };

  const choosePhotos = async () => {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      Alert.alert('Photo limit reached', `Attach up to ${MAX_PHOTOS} hazard photos.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo permission needed', 'Allow photo access to attach hazard pictures.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.35,
      base64: true,
    });
    if (!result.canceled) {
      const selected = (result.assets || []).filter((asset) => asset?.base64).slice(0, remaining);
      setPhotos((current) => [...current, ...selected].slice(0, MAX_PHOTOS));
    }
  };

  const submitReport = async () => {
    if (!driverId) {
      Alert.alert('Driver login required', 'Return home and sign in before reporting a hazard.');
      return;
    }
    if (!coordinate) {
      Alert.alert('Hazard location required', 'Capture the current GPS location before submitting.');
      return;
    }
    if (!name.trim() || !notes.trim()) {
      Alert.alert('Description required', 'Enter the road or bridge name and describe the hazard.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await submitDriverHazardReport({
        category,
        name: name.trim(),
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        clearance_ft: category === 'low_bridge' && clearanceFt ? Number(clearanceFt) : null,
        restriction: category === 'no_truck'
          ? 'No-through-truck restriction'
          : category === 'residential'
            ? 'Residential truck restriction'
            : 'Low-clearance bridge',
        nearby_address: nearbyAddress.trim() || null,
        notes: notes.trim(),
        reported_heading: Number.isFinite(coordinate.heading) ? coordinate.heading : null,
        reported_speed_mph: Number.isFinite(coordinate.speed) ? coordinate.speed * 2.236936 : null,
        route_destination: route?.params?.routeDestination || null,
        photos: photos.map(photoPayload),
      });
      Alert.alert(
        'Hazard submitted',
        result?.message || 'The report is awaiting supervisor verification.',
        [{ text: 'Done', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Submission failed', error.message || 'Unable to submit the hazard report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Text style={styles.headerButtonText}>Back</Text>
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Report Missing Hazard</Text>
          <Text style={styles.headerSubtitle}>{driverName || driverId}</Text>
        </View>
        <View style={styles.headerButtonSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Hazard Type</Text>
        <View style={styles.typeRow}>
          {HAZARD_TYPES.map((type) => (
            <Pressable
              key={type.key}
              onPress={() => setCategory(type.key)}
              style={[styles.typeButton, category === type.key && styles.typeButtonSelected]}
            >
              <Text style={[styles.typeText, category === type.key && styles.typeTextSelected]}>
                {type.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.locationPanel}>
          <View style={styles.locationTextWrap}>
            <Text style={styles.locationTitle}>GPS Location</Text>
            <Text style={styles.locationValue}>
              {coordinate
                ? `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`
                : 'Location not captured'}
            </Text>
            {!!coordinate?.accuracy && (
              <Text style={styles.locationAccuracy}>Accuracy: {Math.round(coordinate.accuracy)} m</Text>
            )}
          </View>
          <Pressable onPress={refreshLocation} disabled={isLocating} style={styles.locationButton}>
            {isLocating ? <ActivityIndicator color="#fff" /> : <Text style={styles.locationButtonText}>Refresh</Text>}
          </Pressable>
        </View>

        <Text style={styles.label}>{category === 'low_bridge' ? 'Bridge or Road Name' : 'Road or Area Name'}</Text>
        <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Enter the location name" />

        <Text style={styles.label}>Nearest Address or Cross Street</Text>
        <TextInput
          value={nearbyAddress}
          onChangeText={setNearbyAddress}
          style={styles.input}
          placeholder="Optional address or cross street"
        />

        {category === 'low_bridge' && (
          <>
            <Text style={styles.label}>Posted Clearance</Text>
            <TextInput
              value={clearanceFt}
              onChangeText={(value) => setClearanceFt(value.replace(/[^0-9.]/g, ''))}
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="Optional clearance in feet"
            />
          </>
        )}

        <Text style={styles.label}>Driver Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          style={[styles.input, styles.notesInput]}
          multiline
          textAlignVertical="top"
          placeholder="Describe the sign, bridge, restriction, direction of travel, or nearby landmark"
        />

        <View style={styles.photoHeader}>
          <Text style={styles.label}>Photos</Text>
          <Text style={styles.photoCount}>{photos.length}/{MAX_PHOTOS}</Text>
        </View>
        <View style={styles.photoActions}>
          <Pressable onPress={takePhoto} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Take Photo</Text>
          </Pressable>
          <Pressable onPress={choosePhotos} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Choose Photos</Text>
          </Pressable>
        </View>
        <View style={styles.photoGrid}>
          {photos.map((photo, index) => (
            <View key={`${photo.uri}-${index}`} style={styles.photoTile}>
              <Image source={{ uri: photo.uri }} style={styles.photo} />
              <Pressable
                onPress={() => setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                style={styles.removePhoto}
              >
                <Text style={styles.removePhotoText}>X</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.reviewNotice}>
          <Text style={styles.reviewNoticeText}>
            This report will not affect routing until a supervisor verifies it.
          </Text>
        </View>
        <Pressable
          onPress={submitReport}
          disabled={isSubmitting}
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        >
          {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit Hazard</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eef4f7' },
  header: {
    minHeight: 72,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111820',
  },
  headerButton: { minWidth: 64, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  headerButtonText: { color: '#fff', fontWeight: '900' },
  headerButtonSpacer: { width: 64 },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  headerSubtitle: { color: '#9fd6e8', marginTop: 3, fontSize: 12, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },
  label: { color: '#173145', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', marginBottom: 7 },
  typeRow: { flexDirection: 'row', gap: 7, marginBottom: 18 },
  typeButton: {
    flex: 1,
    minHeight: 58,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dce8ee',
    borderWidth: 2,
    borderColor: '#9db4c0',
  },
  typeButtonSelected: { backgroundColor: '#b51f2e', borderColor: '#7e101b' },
  typeText: { color: '#173145', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  typeTextSelected: { color: '#fff' },
  locationPanel: {
    minHeight: 86,
    marginBottom: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 6,
    borderLeftColor: '#16866f',
    backgroundColor: '#fff',
  },
  locationTextWrap: { flex: 1, paddingRight: 10 },
  locationTitle: { color: '#173145', fontWeight: '900' },
  locationValue: { color: '#31596a', marginTop: 5, fontWeight: '800' },
  locationAccuracy: { color: '#607d8b', marginTop: 3, fontSize: 12 },
  locationButton: {
    minWidth: 82,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16866f',
  },
  locationButtonText: { color: '#fff', fontWeight: '900' },
  input: {
    minHeight: 50,
    marginBottom: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: '#9db4c0',
    backgroundColor: '#fff',
    color: '#111820',
  },
  notesInput: { minHeight: 120 },
  photoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photoCount: { color: '#607d8b', fontWeight: '900' },
  photoActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#31596a',
  },
  secondaryButtonText: { color: '#fff', fontWeight: '900' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  photoTile: { width: '47%', aspectRatio: 1.4, position: 'relative', backgroundColor: '#dce8ee' },
  photo: { width: '100%', height: '100%' },
  removePhoto: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#a51f2b',
  },
  removePhotoText: { color: '#fff', fontWeight: '900' },
  reviewNotice: { padding: 12, marginBottom: 14, borderLeftWidth: 5, borderLeftColor: '#d49b16', backgroundColor: '#fff5d8' },
  reviewNoticeText: { color: '#5e4508', fontWeight: '800', lineHeight: 19 },
  submitButton: { minHeight: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: '#b51f2e' },
  submitButtonDisabled: { opacity: 0.55 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
