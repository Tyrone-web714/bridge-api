import {
  clearCameraWorkflowIntent,
  readCameraWorkflowIntent,
  rememberCameraWorkflow,
  savePhotoDraft,
} from './photoDraftStore';
import { persistDeliveryPhoto } from './deliveryPhotoStore';

const DEFAULT_IMAGE_QUALITY = 0.35;

function getImagePickerModule() {
  try {
    return require('expo-image-picker');
  } catch {
    return null;
  }
}

export function getImageMimeType(asset = {}) {
  if (asset.mimeType) return asset.mimeType;
  const uri = String(asset.uri || '').toLowerCase();
  if (uri.endsWith('.png')) return 'image/png';
  if (uri.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

function safeFileName(asset = {}, source = 'photo') {
  if (asset.fileName) return asset.fileName;
  const mimeType = getImageMimeType(asset);
  const extension = mimeType === 'image/png'
    ? 'png'
    : mimeType === 'image/webp'
      ? 'webp'
      : 'jpg';
  return `${source}-${Date.now()}.${extension}`;
}

export function normalizeImageAsset(asset = {}, source = 'library') {
  return {
    ...asset,
    uri: asset.uri,
    mimeType: getImageMimeType(asset),
    fileName: safeFileName(asset, source),
    width: asset.width || null,
    height: asset.height || null,
    mediaSource: source,
  };
}

function stabilizeCameraAssets(assets = []) {
  return assets.map((asset) => persistDeliveryPhoto(asset));
}

function imagePickerUnavailable(Alert) {
  Alert.alert(
    'New build required',
    'Photo upload needs the newest Truck-Safe development build. You can still save written information now.'
  );
}

export async function capturePhotoAssets({
  Alert,
  base64 = false,
  quality = DEFAULT_IMAGE_QUALITY,
  draftWorkflow = null,
  draftContext = {},
} = {}) {
  const ImagePicker = getImagePickerModule();
  if (!ImagePicker) {
    imagePickerUnavailable(Alert);
    return [];
  }

  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access to take a photo in Truck-Safe Routing.');
      return [];
    }

    if (draftWorkflow) {
      await rememberCameraWorkflow({ workflow: draftWorkflow, context: draftContext });
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality,
      base64,
    });
    if (result.canceled) {
      if (draftWorkflow) await clearCameraWorkflowIntent().catch(() => null);
      return [];
    }

    const assets = stabilizeCameraAssets((result.assets || [])
      .filter((asset) => asset?.uri)
      .map((asset) => normalizeImageAsset(asset, 'camera')));
    if (draftWorkflow && assets.length) {
      await savePhotoDraft({ workflow: draftWorkflow, context: draftContext, photos: assets });
      await clearCameraWorkflowIntent().catch(() => null);
    }
    return assets;
  } catch (error) {
    if (draftWorkflow) await clearCameraWorkflowIntent().catch(() => null);
    Alert.alert('Camera unavailable', error.message || 'Unable to take a photo right now.');
    return [];
  }
}

export async function recoverPendingCameraDraft() {
  const ImagePicker = getImagePickerModule();
  if (!ImagePicker?.getPendingResultAsync) return null;
  const intent = await readCameraWorkflowIntent().catch(() => null);
  if (!intent?.workflow) return null;

  const result = await ImagePicker.getPendingResultAsync().catch(() => null);
  if (!result) return null;
  if (result.canceled) {
    await clearCameraWorkflowIntent().catch(() => null);
    return null;
  }
  const assets = stabilizeCameraAssets((result.assets || [])
    .filter((asset) => asset?.uri)
    .map((asset) => normalizeImageAsset(asset, 'camera')));
  if (!assets.length) return null;

  const draft = await savePhotoDraft({
    workflow: intent.workflow,
    context: intent.context,
    photos: assets,
  });
  await clearCameraWorkflowIntent().catch(() => null);
  return draft;
}

export async function choosePhotoLibraryAssets({
  Alert,
  base64 = false,
  quality = DEFAULT_IMAGE_QUALITY,
  selectionLimit = 1,
  allowsMultipleSelection = false,
} = {}) {
  const ImagePicker = getImagePickerModule();
  if (!ImagePicker) {
    imagePickerUnavailable(Alert);
    return [];
  }

  try {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to attach existing photos in Truck-Safe Routing.');
      return [];
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection,
      selectionLimit,
      quality,
      base64,
    });
    if (result.canceled) return [];

    return (result.assets || [])
      .filter((asset) => asset?.uri)
      .slice(0, selectionLimit)
      .map((asset) => normalizeImageAsset(asset, 'library'));
  } catch (error) {
    Alert.alert('Photo picker unavailable', error.message || 'Unable to choose photos right now.');
    return [];
  }
}

export function selectImageAssetsWithPrompt({
  Alert,
  title = 'Attach Photo',
  message = 'Select a photo source.',
  remainingSlots = 1,
  base64 = false,
  quality = DEFAULT_IMAGE_QUALITY,
  allowsMultipleSelection = false,
  draftWorkflow = null,
  draftContext = {},
} = {}) {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const assets = await capturePhotoAssets({
              Alert,
              base64,
              quality,
              draftWorkflow,
              draftContext,
            });
            resolve(assets.slice(0, Math.max(remainingSlots, 0)));
          },
        },
        {
          text: 'Choose From Library',
          onPress: async () => {
            const assets = await choosePhotoLibraryAssets({
              Alert,
              base64,
              quality,
              allowsMultipleSelection,
              selectionLimit: Math.max(remainingSlots, 1),
            });
            resolve(assets.slice(0, Math.max(remainingSlots, 0)));
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve([]),
        },
      ],
      { cancelable: true, onDismiss: () => resolve([]) }
    );
  });
}
