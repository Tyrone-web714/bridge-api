import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import AuthenticatedMediaImage from './AuthenticatedMediaImage';
import {
  fetchAccountKnowledgeDeliveryNotes,
  noteMatchesAccountIdentity,
  subscribeDeliveryNotesChanged,
} from '../services/deliveryNotesApi';

const MAX_PREVIEW_PHOTOS = 4;

export default function AccountKnowledgePanel({
  accountNumber,
  destination,
  placeId,
  routeManifestId,
  routeStopId,
  routeDate,
  routeNumber,
  driverId,
  driverName,
  onOpen,
  compact = false,
}) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const accountIdentity = { accountNumber, placeId, destination };

  useEffect(() => {
    let active = true;
    if (!accountNumber && !placeId && !destination) {
      setNotes([]);
      return undefined;
    }

    setLoading(true);
    fetchAccountKnowledgeDeliveryNotes({
      accountNumber,
      placeId,
      destination,
      driverId,
      driverName,
    })
      .then((records) => {
        if (active) setNotes(records);
      })
      .catch(() => {
        if (active) setNotes([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accountNumber, destination, driverId, driverName, placeId]);

  useEffect(() => {
    return subscribeDeliveryNotesChanged((changedIdentity) => {
      if (!noteMatchesAccountIdentity(changedIdentity, accountIdentity)) return;
      setLoading(true);
      fetchAccountKnowledgeDeliveryNotes({
        accountNumber,
        placeId,
        destination,
        driverId,
        driverName,
      })
        .then(setNotes)
        .catch(() => null)
        .finally(() => setLoading(false));
    });
  }, [accountNumber, destination, driverId, driverName, placeId]);

  const latestNotes = notes.slice(0, compact ? 1 : 2);
  const photos = notes
    .flatMap((note) => note.photos || [])
    .filter((photo) => photo?.url)
    .slice(0, MAX_PREVIEW_PHOTOS);

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View style={styles.headingWrap}>
          <Text style={styles.kicker}>Account knowledge</Text>
          <Text style={styles.title}>
            {loading ? 'Loading notes and photos...' : `${notes.length} shared note${notes.length === 1 ? '' : 's'}`}
          </Text>
        </View>
        {loading
          ? <ActivityIndicator color="#67e8f9" />
          : (
            <Pressable
              onPress={() => onOpen?.({
                source: 'account-knowledge',
                accountNumber,
                placeId,
                destination,
                routeManifestId,
                routeStopId,
                routeDate,
                routeNumber,
                driverId,
                driverName,
              })}
              style={styles.openButton}
            >
              <Text style={styles.openButtonText}>{notes.length ? 'View / Edit' : 'Add Note'}</Text>
            </Pressable>
          )}
      </View>

      {!loading && latestNotes.length === 0 && (
        <Text style={styles.emptyText}>
          No shared delivery guidance has been recorded for this account.
        </Text>
      )}

      {latestNotes.map((note) => (
        <View key={note.id} style={styles.noteRow}>
          <Text style={styles.noteText} numberOfLines={compact ? 2 : 3}>
            {note.instructions || 'Photo-only delivery note'}
          </Text>
          <Text style={styles.noteMeta}>
            {note.driverName || 'Driver'}{note.pendingSync ? ' - pending sync' : ''}
          </Text>
        </View>
      ))}

      {photos.length > 0 && (
        <View style={styles.photoRow}>
          {photos.map((photo, index) => (
            <AuthenticatedMediaImage
              key={photo.id || photo.url || index}
              media={photo}
              style={styles.photo}
              resizeMode="cover"
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: 'rgba(8, 31, 46, 0.92)',
    borderLeftWidth: 4,
    borderLeftColor: '#67e8f9',
    padding: 12,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headingWrap: { flex: 1 },
  kicker: { color: '#67e8f9', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 15, fontWeight: '900', marginTop: 2 },
  openButton: { backgroundColor: '#185a6b', paddingVertical: 8, paddingHorizontal: 11 },
  openButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  emptyText: { color: '#a9c0ce', lineHeight: 18, marginTop: 9 },
  noteRow: { borderTopWidth: 1, borderTopColor: '#29485f', paddingTop: 9, marginTop: 9 },
  noteText: { color: '#e9f5fb', lineHeight: 19, fontWeight: '700' },
  noteMeta: { color: '#89a7b8', fontSize: 11, marginTop: 4 },
  photoRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  photo: { width: 68, height: 54, backgroundColor: '#173145' },
});
