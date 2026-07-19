import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DRIVER_NAME } from '../config/api';
import AuthenticatedMediaImage from '../components/AuthenticatedMediaImage';
import {
  deleteAccountDeliveryNote,
  fetchAccountDeliveryNotes,
  saveAccountDeliveryNote,
} from '../services/deliveryNotesApi';
import { persistDeliveryPhoto } from '../services/deliveryPhotoStore';
import { selectImageAssetsWithPrompt } from '../services/mobileMediaSelection';
import {
  buildDeliveryNoteDraftContext,
  clearPhotoDraft,
  readPhotoDraft,
  savePhotoDraft,
} from '../services/photoDraftStore';

const MAX_NOTE_PHOTOS = 4;
const DELIVERY_NOTE_DRAFT_WORKFLOW = 'delivery-notes';

export default function DeliveryNotesScreen({ route }) {
  const destination = route?.params?.destinationAddress || '';
  const destinationPlaceId = route?.params?.destinationPlaceId || null;
  const destinationDetails = route?.params?.destinationDetails || null;
  const accountNumber = route?.params?.accountNumber || destinationDetails?.accountNumber || null;
  const routeManifestId = route?.params?.routeManifestId || destinationDetails?.routeManifestId || null;
  const routeStopId = route?.params?.routeStopId || destinationDetails?.routeStopId || null;
  const routeDate = route?.params?.routeDate || route?.params?.routeManifestDate || destinationDetails?.routeDate || null;
  const routeNumber = route?.params?.routeNumber || destinationDetails?.routeNumber || null;
  const routeDriverId = route?.params?.driverId || destinationDetails?.routeManifestDriverId || '';
  const routeDriverName = route?.params?.driverName || destinationDetails?.routeManifestDriverName || DRIVER_NAME;

  const [accountName, setAccountName] = useState(destinationDetails?.name || '');
  const [customerName, setCustomerName] = useState('');
  const [driverName, setDriverName] = useState(routeDriverName);
  const [instructions, setInstructions] = useState('');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [existingNotes, setExistingNotes] = useState([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [existingPhotoDraft, setExistingPhotoDraft] = useState([]);
  const draftContext = buildDeliveryNoteDraftContext({
    accountNumber,
    placeId: destinationPlaceId,
    destination,
    routeManifestId,
    routeStopId,
    routeDate,
    routeNumber,
    routeParams: route?.params,
  });

  const loadNotes = useCallback(async () => {
    setIsLoadingNotes(true);
    try {
      const notes = await fetchAccountDeliveryNotes({
        accountNumber,
        placeId: destinationPlaceId,
        destination,
        routeManifestId,
        routeStopId,
        routeDate,
        routeNumber,
        driverId: routeDriverId,
        driverName: routeDriverName,
      });
      setExistingNotes(notes);
    } catch (error) {
      setExistingNotes([]);
      setStatusText(error.message || 'Unable to load delivery notes.');
    } finally {
      setIsLoadingNotes(false);
    }
  }, [
    accountNumber,
    destination,
    destinationPlaceId,
    routeManifestId,
    routeStopId,
    routeDate,
    routeNumber,
    routeDriverId,
    routeDriverName,
  ]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    let isMounted = true;

    const restorePhotoDraft = async () => {
      const draft = await readPhotoDraft({
        workflow: DELIVERY_NOTE_DRAFT_WORKFLOW,
        context: draftContext,
      }).catch(() => null);
      if (!isMounted || !draft?.photos?.length) return;

      const restoredPhotos = [];
      let failedRestoreCount = 0;
      for (const photo of draft.photos.slice(0, MAX_NOTE_PHOTOS)) {
        try {
          restoredPhotos.push(photo.localUri ? photo : persistDeliveryPhoto(photo));
        } catch {
          failedRestoreCount += 1;
        }
      }
      if (!restoredPhotos.length) {
        if (failedRestoreCount > 0) {
          setStatusText(`Unable to restore ${failedRestoreCount} captured photo${failedRestoreCount === 1 ? '' : 's'}. Retake before saving.`);
        }
        return;
      }
      setSelectedPhotos((current) => {
        const seen = new Set(current.map((photo) => photo.localUri || photo.uri));
        const next = [
          ...current,
          ...restoredPhotos.filter((photo) => !seen.has(photo.localUri || photo.uri)),
        ].slice(0, MAX_NOTE_PHOTOS);
        savePhotoDraft({
          workflow: DELIVERY_NOTE_DRAFT_WORKFLOW,
          context: draftContext,
          photos: next,
        }).catch(() => null);
        return next;
      });
      setStatusText(failedRestoreCount > 0
        ? `Restored ${restoredPhotos.length} captured photo${restoredPhotos.length === 1 ? '' : 's'}; ${failedRestoreCount} could not be restored. Retake missing photo${failedRestoreCount === 1 ? '' : 's'} before saving.`
        : 'Restored captured photo draft. Review and save the delivery note.');
    };

    restorePhotoDraft();
    return () => {
      isMounted = false;
    };
  }, [
    accountNumber,
    destination,
    destinationPlaceId,
    routeManifestId,
    routeStopId,
    routeDate,
    routeNumber,
  ]);

  const pickPhotos = async () => {
    const remainingSlots = MAX_NOTE_PHOTOS - selectedPhotos.length - existingPhotoDraft.length;
    if (remainingSlots <= 0) {
      Alert.alert('Photo limit reached', `You can attach up to ${MAX_NOTE_PHOTOS} photos per note.`);
      return;
    }

    const assets = await selectImageAssetsWithPrompt({
      Alert,
      title: 'Attach Photos',
      message: 'Take a new photo or choose existing photos from the library.',
      remainingSlots,
      allowsMultipleSelection: true,
      quality: 0.35,
      draftWorkflow: DELIVERY_NOTE_DRAFT_WORKFLOW,
      draftContext,
    });

    if (assets.length === 0) return;

    try {
      const nextPhotos = assets.map((asset) => persistDeliveryPhoto(asset));
      setSelectedPhotos((current) => {
        const merged = [...current, ...nextPhotos].slice(0, MAX_NOTE_PHOTOS);
        if (assets.some((asset) => asset.mediaSource === 'camera')) {
          savePhotoDraft({
            workflow: DELIVERY_NOTE_DRAFT_WORKFLOW,
            context: draftContext,
            photos: merged,
          }).catch(() => null);
        }
        return merged;
      });
    } catch (error) {
      Alert.alert('Photo unavailable', error.message || 'Unable to attach this photo.');
    }
  };

  const removePhoto = (indexToRemove) => {
    setSelectedPhotos((current) => {
      const next = current.filter((_, index) => index !== indexToRemove);
      if (next.length) {
        savePhotoDraft({
          workflow: DELIVERY_NOTE_DRAFT_WORKFLOW,
          context: draftContext,
          photos: next,
        }).catch(() => null);
      } else {
        clearPhotoDraft({
          workflow: DELIVERY_NOTE_DRAFT_WORKFLOW,
          context: draftContext,
        }).catch(() => null);
      }
      return next;
    });
  };

  const removeExistingPhoto = (photoToRemove) => {
    setExistingPhotoDraft((current) => (
      current.filter((photo) => (photo.id || photo.url) !== (photoToRemove.id || photoToRemove.url))
    ));
  };

  const resetForm = () => {
    setEditingNoteId(null);
    setAccountName(destinationDetails?.name || '');
    setCustomerName('');
    setDriverName(routeDriverName);
    setInstructions('');
    setSelectedPhotos([]);
    setExistingPhotoDraft([]);
    clearPhotoDraft({
      workflow: DELIVERY_NOTE_DRAFT_WORKFLOW,
      context: draftContext,
    }).catch(() => null);
  };

  const beginEditNote = (note) => {
    setEditingNoteId(note.id);
    setAccountName(note.accountName || '');
    setCustomerName(note.customerName || '');
    setDriverName(note.driverName || 'driver_app');
    setInstructions(note.instructions || '');
    setSelectedPhotos([]);
    setExistingPhotoDraft(Array.isArray(note.photos) ? note.photos : []);
    setStatusText('Editing saved delivery note.');
  };

  const updateSavedNote = async (note, updates = {}) => {
    const data = await saveAccountDeliveryNote(
      {
        ...note,
        ...updates,
        photos: updates.photos || [],
        accountNumber: note.accountNumber || accountNumber,
        routeManifestId: note.routeManifestId || routeManifestId,
        routeStopId: note.routeStopId || routeStopId,
        routeDate: note.routeDate || routeDate,
        routeNumber: note.routeNumber || routeNumber,
      },
      {
        driverId: routeDriverId,
        driverName: routeDriverName,
        routeManifestId,
        routeStopId,
        routeDate,
        routeNumber,
      },
      note.id
    );
    return data.note || data;
  };

  const removeSavedPhotoFromNote = (note, photoToRemove) => {
    Alert.alert(
      'Remove saved photo?',
      'This removes only this photo from the delivery note.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setStatusText('Removing saved photo...');
            try {
              const remainingPhotos = (note.photos || []).filter((photo) => (
                (photo.id || photo.url) !== (photoToRemove.id || photoToRemove.url)
              ));
              await updateSavedNote(note, {
                existingPhotos: remainingPhotos,
                photos: [],
              });
              setStatusText('Saved photo removed.');
              await loadNotes();
            } catch (error) {
              setStatusText(error.message || 'Unable to remove saved photo.');
            }
          },
        },
      ]
    );
  };

  const deleteNote = (note) => {
    if (!note?.id) {
      setStatusText('Unable to delete this note because it is missing an ID.');
      return;
    }

    Alert.alert(
      'Delete delivery note?',
      'This removes the note and its saved photos for this customer/account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setStatusText('Deleting delivery note...');
            try {
              const data = await deleteAccountDeliveryNote(
                note,
                { driverId: routeDriverId, driverName: routeDriverName }
              );
              if (editingNoteId === note.id) resetForm();
              setStatusText(data.queued
                ? 'Delivery note deletion saved offline and will synchronize later.'
                : 'Delivery note deleted.');
              if (data.queued) {
                setExistingNotes((current) => current.filter((item) => item.id !== note.id));
              } else {
                await loadNotes();
              }
            } catch (error) {
              setStatusText(error.message || 'Unable to delete delivery note.');
            }
          },
        },
      ]
    );
  };

  const saveNote = async () => {
    const cleanedInstructions = instructions.trim();
    if (!cleanedInstructions && selectedPhotos.length === 0 && existingPhotoDraft.length === 0) {
      Alert.alert('Add a note', 'Enter delivery instructions or attach at least one photo.');
      return;
    }

    setIsSaving(true);
    setStatusText(editingNoteId ? 'Updating delivery note...' : 'Saving delivery note...');

    try {
      const payload = {
        accountNumber,
        placeId: destinationPlaceId,
        destination: destination || destinationDetails?.formattedAddress || destinationDetails?.name || 'Unspecified destination',
        address: destinationDetails?.formattedAddress || destination,
        accountName,
        customerName,
        driverName,
        instructions: cleanedInstructions,
        routeContext: destination,
        routeManifestId,
        routeStopId,
        routeDate,
        routeNumber,
        existingPhotos: existingPhotoDraft,
        photos: selectedPhotos.map((photo) => ({
          clientPhotoId: photo.clientPhotoId,
          localUri: photo.localUri || photo.uri,
          mimeType: photo.mimeType,
          fileName: photo.fileName,
          mediaSource: photo.mediaSource,
          sizeBytes: photo.sizeBytes,
          sourceUriScheme: photo.sourceUriScheme,
        })),
      };

      const data = await saveAccountDeliveryNote(
        payload,
        {
          driverId: routeDriverId,
          driverName: routeDriverName,
          routeManifestId,
          routeStopId,
          routeDate,
          routeNumber,
        },
        editingNoteId
      );

      if (data.queued && data.note) {
        resetForm();
        await clearPhotoDraft({
          workflow: DELIVERY_NOTE_DRAFT_WORKFLOW,
          context: draftContext,
        }).catch(() => null);
        setStatusText('Delivery note saved offline. It will synchronize when service returns.');
        setExistingNotes((current) => [
          data.note,
          ...current.filter((note) => note.id !== data.note.id),
        ]);
      } else {
        await loadNotes();
        resetForm();
        await clearPhotoDraft({
          workflow: DELIVERY_NOTE_DRAFT_WORKFLOW,
          context: draftContext,
        }).catch(() => null);
        setStatusText(editingNoteId
          ? 'Delivery note updated.'
          : 'Delivery note saved for future drivers.');
      }
    } catch (error) {
      setStatusText(error.message || 'Unable to save delivery note.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerPanel}>
          <Text style={styles.kicker}>Driver knowledge</Text>
          <Text style={styles.title}>Delivery Notes</Text>
          <Text style={styles.destinationText} numberOfLines={2}>
            {destinationDetails?.name || destination || 'No destination selected'}
          </Text>
          {!!destinationDetails?.formattedAddress && (
            <Text style={styles.addressText} numberOfLines={2}>
              {destinationDetails.formattedAddress}
            </Text>
          )}
        </View>

        <View style={styles.formPanel}>
          <View style={styles.formTitleRow}>
            <Text style={styles.panelTitle}>
              {editingNoteId ? 'Edit delivery note' : 'Add note for this stop'}
            </Text>
            {editingNoteId && (
              <Pressable
                onPress={resetForm}
                style={({ pressed }) => [
                  styles.cancelEditButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.cancelEditButtonText}>Cancel Edit</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.label}>Account or business</Text>
          <TextInput
            value={accountName}
            onChangeText={setAccountName}
            placeholder="Business or account name"
            placeholderTextColor="#6c7c8c"
            style={styles.input}
          />

          <Text style={styles.label}>Customer or contact</Text>
          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Receiver, manager, dock contact"
            placeholderTextColor="#6c7c8c"
            style={styles.input}
          />

          <Text style={styles.label}>Driver name or ID</Text>
          <TextInput
            value={driverName}
            onChangeText={setDriverName}
            placeholder="Driver name or employee ID"
            placeholderTextColor="#6c7c8c"
            style={styles.input}
          />

          <Text style={styles.label}>Instructions or comments</Text>
          <TextInput
            value={instructions}
            onChangeText={setInstructions}
            placeholder="Example: Use rear entrance, check in at dock 4, avoid tight right turn by pharmacy."
            placeholderTextColor="#6c7c8c"
            multiline={true}
            textAlignVertical="top"
            style={[styles.input, styles.notesInput]}
          />

          <View style={styles.photoHeaderRow}>
            <Text style={styles.label}>Photos</Text>
            <Text style={styles.photoCountText}>{selectedPhotos.length + existingPhotoDraft.length}/{MAX_NOTE_PHOTOS}</Text>
          </View>

          <Pressable
            onPress={pickPhotos}
            style={({ pressed }) => [
              styles.photoButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.photoButtonText}>Attach Photos</Text>
          </Pressable>

          {selectedPhotos.length > 0 && (
            <View style={styles.selectedPhotoGrid}>
              {selectedPhotos.map((photo, index) => (
                <View key={`${photo.uri}-${index}`} style={styles.selectedPhotoWrap}>
                  <Image source={{ uri: photo.uri }} style={styles.selectedPhoto} resizeMode="cover" />
                  <Pressable
                    onPress={() => removePhoto(index)}
                    style={styles.removePhotoButton}
                  >
                    <Text style={styles.removePhotoText}>Remove</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {existingPhotoDraft.length > 0 && (
            <View style={styles.selectedPhotoGrid}>
              {existingPhotoDraft.map((photo) => (
                <View key={photo.id || photo.url} style={styles.selectedPhotoWrap}>
                  <AuthenticatedMediaImage media={photo} style={styles.selectedPhoto} resizeMode="cover" />
                  <Pressable
                    onPress={() => removeExistingPhoto(photo)}
                    style={styles.removePhotoButton}
                  >
                    <Text style={styles.removePhotoText}>Remove Saved Photo</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {!!statusText && (
            <Text style={styles.statusText}>{statusText}</Text>
          )}

          <Pressable
            onPress={saveNote}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.saveButton,
              isSaving && styles.saveButtonDisabled,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? 'Saving...' : 'Save Delivery Note'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.notesPanel}>
          <View style={styles.notesHeaderRow}>
            <Text style={styles.panelTitle}>Notes from other drivers</Text>
            {isLoadingNotes && <ActivityIndicator size="small" color="#d62828" />}
          </View>

          {!isLoadingNotes && existingNotes.length === 0 && (
            <Text style={styles.emptyText}>No delivery notes saved for this stop yet.</Text>
          )}

          {existingNotes.map((note) => (
            <View key={note.id} style={styles.noteCard}>
              <Text style={styles.noteTitle} numberOfLines={1}>
                {note.accountName || note.destination || 'Delivery note'}
              </Text>
              {!!note.customerName && (
                <Text style={styles.noteMeta}>Customer: {note.customerName}</Text>
              )}
              {!!note.driverName && (
                <Text style={styles.noteMeta}>Added by: {note.driverName}</Text>
              )}
              {!!note.instructions && (
                <Text style={styles.noteBody}>{note.instructions}</Text>
              )}
              {Array.isArray(note.photos) && note.photos.length > 0 && (
                <View style={styles.savedPhotoRow}>
                  {note.photos.slice(0, 4).map((photo) => (
                    <View key={photo.id || photo.url} style={styles.savedPhotoTile}>
                      <Pressable
                        onPress={() => setPreviewPhoto({
                          url: photo.url,
                          title: note.accountName || note.destination || 'Delivery photo',
                          subtitle: note.instructions || '',
                        })}
                        style={({ pressed }) => [
                          styles.savedPhotoButton,
                          pressed && styles.savedPhotoButtonPressed,
                        ]}
                      >
                        <AuthenticatedMediaImage
                          media={photo}
                          style={styles.savedPhoto}
                          resizeMode="cover"
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => removeSavedPhotoFromNote(note, photo)}
                        style={({ pressed }) => [
                          styles.savedPhotoRemoveButton,
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        <Text style={styles.savedPhotoRemoveText}>Remove</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              {!!note.createdAt && (
                <Text style={styles.noteDate}>{new Date(note.createdAt).toLocaleString()}</Text>
              )}
              <View style={styles.noteActionRow}>
                <Pressable
                  onPress={() => beginEditNote(note)}
                  style={({ pressed }) => [
                    styles.noteEditButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.noteActionText}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={() => deleteNote(note)}
                  style={({ pressed }) => [
                    styles.noteDeleteButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.noteActionText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(previewPhoto)}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewPhoto(null)}
      >
        <View style={styles.photoPreviewOverlay}>
          <View style={styles.photoPreviewCard}>
            <View style={styles.photoPreviewHeader}>
              <View style={styles.photoPreviewTitleWrap}>
                <Text style={styles.photoPreviewKicker}>Delivery photo</Text>
                <Text style={styles.photoPreviewTitle} numberOfLines={1}>
                  {previewPhoto?.title || 'Delivery photo'}
                </Text>
              </View>
              <Pressable
                onPress={() => setPreviewPhoto(null)}
                hitSlop={10}
                style={({ pressed }) => [
                  styles.photoPreviewCloseButton,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text style={styles.photoPreviewCloseText}>X</Text>
              </Pressable>
            </View>

            {!!previewPhoto?.url && (
              <AuthenticatedMediaImage
                media={previewPhoto}
                style={styles.photoPreviewImage}
                resizeMode="contain"
              />
            )}

            {!!previewPhoto?.subtitle && (
              <Text style={styles.photoPreviewCaption} numberOfLines={3}>
                {previewPhoto.subtitle}
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#93bedb',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
  },
  headerPanel: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    backgroundColor: '#c8131f',
    shadowColor: '#8c1118',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  kicker: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '900',
    color: '#aee4ff',
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    color: '#ffffff',
  },
  destinationText: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: '#ffffff',
  },
  addressText: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '700',
    color: '#ffe8ec',
  },
  formPanel: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#e2f2fb',
    borderWidth: 2,
    borderColor: '#2f78a5',
  },
  notesPanel: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#f1d7dc',
    borderWidth: 2,
    borderColor: '#a9303a',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#c8131f',
    marginBottom: 14,
  },
  formTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  cancelEditButton: {
    minHeight: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginBottom: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#a9303a',
  },
  cancelEditButtonText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#a9303a',
    textTransform: 'uppercase',
  },
  label: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1565c0',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 2,
    borderColor: '#2f78a5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    backgroundColor: '#eef8ff',
    fontSize: 16,
    color: '#111111',
  },
  notesInput: {
    minHeight: 116,
    lineHeight: 21,
  },
  photoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  photoCountText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#24506f',
  },
  photoButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1565c0',
    borderWidth: 2,
    borderColor: '#2f78a5',
  },
  photoButtonText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  selectedPhotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  selectedPhotoWrap: {
    width: '47%',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#2f78a5',
  },
  selectedPhoto: {
    width: '100%',
    height: 112,
  },
  removePhotoButton: {
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffe8ec',
  },
  removePhotoText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#a9303a',
    textTransform: 'uppercase',
  },
  statusText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    color: '#24506f',
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    backgroundColor: '#c8131f',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  saveButtonDisabled: {
    opacity: 0.62,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  buttonPressed: {
    opacity: 0.84,
  },
  notesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '700',
    color: '#24506f',
  },
  noteCard: {
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    backgroundColor: '#fff5f7',
    borderWidth: 2,
    borderColor: '#a9303a',
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111111',
  },
  noteMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '800',
    color: '#1565c0',
  },
  noteBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#23384d',
  },
  savedPhotoRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  savedPhotoTile: {
    width: 74,
  },
  savedPhotoButton: {
    borderRadius: 9,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#2f78a5',
    backgroundColor: '#eeeeee',
  },
  savedPhotoButtonPressed: {
    opacity: 0.78,
  },
  savedPhoto: {
    width: 70,
    height: 58,
    backgroundColor: '#eeeeee',
  },
  savedPhotoRemoveButton: {
    minHeight: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    backgroundColor: '#ffe8ec',
    borderWidth: 1,
    borderColor: '#a9303a',
  },
  savedPhotoRemoveText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#a9303a',
    textTransform: 'uppercase',
  },
  noteDate: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#777777',
  },
  noteActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  noteEditButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1565c0',
  },
  noteDeleteButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c8131f',
  },
  noteActionText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  photoPreviewOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(12, 38, 64, 0.72)',
  },
  photoPreviewCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '88%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#fff5f7',
    borderWidth: 2,
    borderColor: '#a9303a',
  },
  photoPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#c8131f',
  },
  photoPreviewTitleWrap: {
    flex: 1,
  },
  photoPreviewKicker: {
    fontSize: 10,
    fontWeight: '900',
    color: '#aee4ff',
    textTransform: 'uppercase',
  },
  photoPreviewTitle: {
    marginTop: 2,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: '#ffffff',
  },
  photoPreviewCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  photoPreviewCloseText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#c8131f',
  },
  photoPreviewImage: {
    width: '100%',
    height: 420,
    backgroundColor: '#102033',
  },
  photoPreviewCaption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#23384d',
  },
});
