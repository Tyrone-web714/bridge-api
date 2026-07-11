import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchRouteTruckInventory,
} from '../services/routeManifestApi';

function quantity(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function RouteInventoryScreen({ navigation, route }) {
  const params = route?.params || {};
  const { manifestId, driverId, driverName, routeNumber, routeDate } = params;
  const driverOptions = useMemo(() => ({ driverId, driverName }), [driverId, driverName]);
  const [items, setItems] = useState([]);
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadInventory = useCallback(async () => {
    if (!manifestId || !driverId) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchRouteTruckInventory(manifestId, driverOptions);
      setItems(data.items || []);
      setConfirmation(data.confirmation || null);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load route inventory.');
    } finally {
      setLoading(false);
    }
  }, [driverId, driverOptions, manifestId]);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  const totals = items.reduce((summary, item) => ({
    planned: summary.planned + quantity(item.plannedQuantity),
    added: summary.added + quantity(item.addedQuantity),
    expected: summary.expected + quantity(item.expectedOnTruckQuantity),
  }), { planned: 0, added: 0, expected: 0 });
  const isPrinted = confirmation?.status === 'printed' || !!confirmation?.printedAt;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Route Inventory</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.routeNumber}>Route {routeNumber || '-'}</Text>
        <Text style={styles.routeMeta}>{routeDate || ''} | Driver ID {driverId || '-'}</Text>

        <View style={styles.summaryBand}>
          <Text style={styles.summaryText}>Planned {totals.planned}</Text>
          <Text style={styles.summaryText}>Added {totals.added}</Text>
          <Text style={styles.summaryText}>Expected {totals.expected}</Text>
        </View>

        {loading ? <ActivityIndicator color="#51d6c8" style={styles.loader} /> : null}
        {!!error && <Text style={styles.error}>{error}</Text>}
        {!loading && items.map((item) => (
          <View key={item.id || item.sku} style={styles.itemRow}>
            <View style={styles.itemText}>
              <Text style={styles.itemName}>{item.productName || item.sku || 'Product'}</Text>
              <Text style={styles.itemMeta}>SKU {item.sku || '-'}{item.packageSize ? ` | ${item.packageSize}` : ''}</Text>
              {!!item.barcodes?.length && <Text style={styles.itemMeta}>Barcode {item.barcodes.join(', ')}</Text>}
            </View>
            <View style={styles.itemQuantities}>
              <Text style={styles.quantityText}>Plan {quantity(item.plannedQuantity)}</Text>
              <Text style={styles.quantityText}>Added {quantity(item.addedQuantity)}</Text>
              <Text style={styles.expectedText}>Expected {quantity(item.expectedOnTruckQuantity)}</Text>
            </View>
          </View>
        ))}

        <View style={styles.confirmationSection}>
          <Text style={styles.sectionTitle}>Departure Confirmation Status</Text>
          {isPrinted ? (
            <View style={styles.printedStatus}>
              <Text style={styles.printedTitle}>Confirmed and Printed</Text>
              <Text style={styles.printedText}>{confirmation.warehouseEmployeeName || confirmation.warehouseEmployeeId}</Text>
            </View>
          ) : (
            <View style={styles.pendingStatus}>
              <Text style={styles.pendingTitle}>Warehouse confirmation pending</Text>
              <Text style={styles.pendingText}>The full route inventory remains available for driver review.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08131d' },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#23404f' },
  backButton: { minWidth: 72, minHeight: 42, justifyContent: 'center' },
  backText: { color: '#7fd0ff', fontWeight: '900' },
  headerTitle: { flex: 1, marginRight: 72, color: '#ffffff', fontSize: 18, fontWeight: '900', textAlign: 'center' },
  content: { padding: 16, paddingBottom: 44 },
  routeNumber: { color: '#ffffff', fontSize: 24, fontWeight: '900' },
  routeMeta: { color: '#9eb4c4', marginTop: 4, fontWeight: '700' },
  summaryBand: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#294958' },
  summaryText: { color: '#dbe9f2', fontWeight: '900' },
  loader: { marginVertical: 28 },
  error: { color: '#ff9f9f', fontWeight: '800', marginVertical: 12 },
  itemRow: { flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1f3541' },
  itemText: { flex: 1 },
  itemName: { color: '#ffffff', fontWeight: '900', fontSize: 15 },
  itemMeta: { color: '#91a8b8', marginTop: 3, fontSize: 12 },
  itemQuantities: { width: 94, alignItems: 'flex-end' },
  quantityText: { color: '#c8d6df', fontWeight: '700', fontSize: 12 },
  expectedText: { color: '#70e0b1', fontWeight: '900', marginTop: 4 },
  confirmationSection: { marginTop: 26, paddingTop: 18, borderTopWidth: 1, borderTopColor: '#345768' },
  sectionTitle: { color: '#ffffff', fontSize: 18, fontWeight: '900', marginBottom: 12 },
  printedStatus: { padding: 16, backgroundColor: '#123a31', borderWidth: 1, borderColor: '#2c9d7e', borderRadius: 6 },
  printedTitle: { color: '#79efc2', fontWeight: '900' },
  printedText: { color: '#ffffff', marginTop: 4 },
  pendingStatus: { padding: 16, backgroundColor: '#2b2515', borderWidth: 1, borderColor: '#8f7332', borderRadius: 6 },
  pendingTitle: { color: '#ffd37a', fontWeight: '900' },
  pendingText: { color: '#ffffff', marginTop: 4 },
});
