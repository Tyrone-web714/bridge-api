import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { attachPhotoToNoteDraft } from '../services/noteComposerStore';

export default function TsrCameraScreen({ navigation, route }) {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('');
  const deliveryNotesContext = route?.params?.deliveryNotesContext || {};

  const closeCamera = () => {
    navigation.goBack();
  };

  const takePhoto = async () => {
    if (isCapturing || isSaving) return;
    setIsCapturing(true);
    setStatusText('');
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.35,
        skipProcessing: false,
      });
      if (photo?.uri) {
        setCapturedPhoto({
          ...photo,
          mediaSource: 'camera',
          fileName: `camera-${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
        });
      } else {
        setStatusText('No photo was captured. Try again.');
      }
    } catch (error) {
      setStatusText(error.message || 'Unable to take photo.');
    } finally {
      setIsCapturing(false);
    }
  };

  const usePhoto = async () => {
    if (!capturedPhoto || isSaving) return;
    setIsSaving(true);
    setStatusText('Saving photo to note draft...');
    try {
      await attachPhotoToNoteDraft(deliveryNotesContext, capturedPhoto, 'camera');
      navigation.goBack();
    } catch (error) {
      setStatusText(error.message || 'Unable to save this photo. Retake before saving.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionPanel}>
          <Text style={styles.title}>Camera Access</Text>
          <Text style={styles.message}>Truck-Safe Routing needs camera access to attach delivery photos.</Text>
          <Pressable onPress={requestPermission} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Allow Camera</Text>
          </Pressable>
          <Pressable onPress={closeCamera} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {capturedPhoto?.uri ? (
        <Image source={{ uri: capturedPhoto.uri }} style={styles.camera} resizeMode="cover" />
      ) : (
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      )}

      <View style={styles.topBar}>
        <Pressable onPress={closeCamera} style={styles.closeButton}>
          <Text style={styles.closeText}>Cancel</Text>
        </Pressable>
        <Text style={styles.topTitle}>Delivery Photo</Text>
      </View>

      <View style={styles.bottomPanel}>
        {!!statusText && <Text style={styles.statusText}>{statusText}</Text>}

        {capturedPhoto?.uri ? (
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => {
                setCapturedPhoto(null);
                setStatusText('');
              }}
              disabled={isSaving}
              style={[styles.secondaryButton, isSaving && styles.disabledButton]}
            >
              <Text style={styles.secondaryButtonText}>Retake</Text>
            </Pressable>
            <Pressable
              onPress={usePhoto}
              disabled={isSaving}
              style={[styles.primaryButton, isSaving && styles.disabledButton]}
            >
              {isSaving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Use Photo</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={takePhoto}
            disabled={isCapturing}
            style={[styles.captureButton, isCapturing && styles.disabledButton]}
          >
            {isCapturing ? (
              <ActivityIndicator color="#102033" />
            ) : (
              <Text style={styles.captureButtonText}>Take Photo</Text>
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07131f',
  },
  camera: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    minHeight: 86,
    paddingTop: 28,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(7,19,31,0.72)',
  },
  topTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
  },
  closeButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  closeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 18,
    backgroundColor: 'rgba(7,19,31,0.82)',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  captureButton: {
    alignSelf: 'center',
    width: 94,
    height: 94,
    borderRadius: 47,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 6,
    borderColor: '#67e8f9',
  },
  captureButtonText: {
    color: '#102033',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16866f',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#20384d',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.62,
  },
  statusText: {
    marginBottom: 12,
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  permissionPanel: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 14,
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    color: '#d7edf7',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    textAlign: 'center',
  },
});
