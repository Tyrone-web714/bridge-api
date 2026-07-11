import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  accessWarehouseDepartureInventory,
  confirmWarehouseDepartureInventory,
  confirmWarehouseDepartureInventoryPrint,
  confirmWarehouseReturnInventoryPrint,
  prepareWarehouseReturnInventory,
} from '../services/routeManifestApi';
import { buildZplDocument } from '../services/deliveryDocumentService';
import { printZpl, readSelectedPrinter } from '../services/zebraPrinterService';
import { getLocalRouteDate } from '../utils/routeDate';

const RETURN_FIELDS = [
  { key: 'sellableQuantity', label: 'Whole / sellable returned' },
  { key: 'returnedQuantity', label: 'Customer returns' },
  { key: 'damagedQuantity', label: 'Damaged product' },
  { key: 'rejectedQuantity', label: 'Rejected product' },
];

function quantity(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export default function WarehouseInventoryScreen({ navigation, route }) {
  const [employeeId, setEmployeeId] = useState('');
  const [routeNumber, setRouteNumber] = useState(String(route?.params?.routeNumber || ''));
  const [routeDate, setRouteDate] = useState(String(route?.params?.routeDate || getLocalRouteDate()));
  const [access, setAccess] = useState(null);
  const [mode, setMode] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [pendingDocument, setPendingDocument] = useState(null);
  const [notes, setNotes] = useState('');
  const [returnValues, setReturnValues] = useState({});

  const items = access?.items || [];
  const departureTotals = useMemo(() => items.reduce((summary, item) => ({
    planned: summary.planned + quantity(item.plannedQuantity),
    added: summary.added + quantity(item.addedQuantity),
    expected: summary.expected + quantity(item.expectedOnTruckQuantity),
  }), { planned: 0, added: 0, expected: 0 }), [items]);
  const departurePrinted = access?.confirmation?.status === 'printed' || !!access?.confirmation?.printedAt;
  const returnSummary = access?.returnSummary || {};
  const inspectedItems = useMemo(() => (returnSummary.items || []).map((item) => {
    const values = returnValues[item.sku] || {};
    const normalized = Object.fromEntries(
      RETURN_FIELDS.map((field) => [field.key, quantity(values[field.key])])
    );
    const physicalQuantity = RETURN_FIELDS.reduce(
      (total, field) => total + normalized[field.key],
      0
    );
    const discrepancyQuantity = Math.round((
      quantity(item.expectedReturnQuantity) - physicalQuantity
    ) * 100) / 100;
    return {
      ...item,
      ...normalized,
      discrepancyQuantity,
      discrepancyStatus: Math.abs(discrepancyQuantity) < 0.001
        ? 'balanced'
        : (discrepancyQuantity > 0 ? 'shortage' : 'overage'),
    };
  }), [returnSummary.items, returnValues]);
  const discrepancyQuantity = Math.round(inspectedItems.reduce(
    (total, item) => total + item.discrepancyQuantity,
    0
  ) * 100) / 100;
  const discrepancyItemCount = inspectedItems.filter(
    (item) => Math.abs(item.discrepancyQuantity) >= 0.001
  ).length;
  const hasDiscrepancy = discrepancyItemCount > 0;

  const credentials = (extra = {}) => ({
    employeeId: employeeId.trim(),
    routeNumber: routeNumber.trim(),
    routeDate: routeDate.trim(),
    ...extra,
  });

  const loginAndLoad = async () => {
    if (!employeeId.trim() || !routeNumber.trim() || !routeDate.trim()) {
      Alert.alert('Required information', 'Enter company employee ID, route number, and route date.');
      return;
    }
    setWorking(true);
    setError('');
    try {
      const data = await accessWarehouseDepartureInventory(credentials());
      setAccess(data);
      setReturnValues(Object.fromEntries((data.returnSummary?.items || []).map((item) => [
        item.sku,
        Object.fromEntries(RETURN_FIELDS.map((field) => [field.key, '0']))
      ])));
      setMode(null);
      setPendingDocument(null);
    } catch (loadError) {
      setAccess(null);
      setError(loadError.message || 'Unable to access route inventory.');
    } finally {
      setWorking(false);
    }
  };

  const selectedPrinter = async () => {
    const printer = await readSelectedPrinter();
    if (!printer?.address) throw new Error('Connect the shift printer in Settings before confirming inventory.');
    return printer;
  };

  const finishDeparturePrint = async (document) => {
    const confirmation = await confirmWarehouseDepartureInventoryPrint(credentials({
      manifestId: access.route.id,
      driverId: access.route.driverId,
      printConfirmationToken: document.printConfirmationToken,
    }));
    setAccess((current) => ({ ...current, confirmation }));
    setPendingDocument(null);
    Alert.alert('Departure inventory completed', `Confirmation and print recorded for ${access.employee?.employeeName || employeeId.trim()}.`);
  };

  const confirmDepartureAndPrint = async () => {
    setWorking(true);
    setError('');
    try {
      const printer = await selectedPrinter();
      const document = await confirmWarehouseDepartureInventory(credentials({
        manifestId: access.route.id,
        driverId: access.route.driverId,
      }));
      await printZpl(buildZplDocument(document), printer);
      setPendingDocument(document);
      await finishDeparturePrint(document);
    } catch (workError) {
      setError(workError.message || 'Unable to confirm and print departure inventory.');
    } finally {
      setWorking(false);
    }
  };

  const finishReturnPrint = async (document) => {
    await confirmWarehouseReturnInventoryPrint(credentials({
      manifestId: access.route.id,
      driverId: access.route.driverId,
      printConfirmationToken: document.printConfirmationToken,
    }));
    setPendingDocument(null);
    Alert.alert(
      'Return inventory completed',
      hasDiscrepancy
        ? 'The receipt was printed with an inventory discrepancy for supervisor review.'
        : 'The balanced return inventory receipt was printed and sent for supervisor review.',
      [{ text: 'Done', onPress: () => navigation.navigate('Home') }]
    );
  };

  const confirmReturnAndPrint = async () => {
    setWorking(true);
    setError('');
    try {
      const printer = await selectedPrinter();
      const document = await prepareWarehouseReturnInventory(credentials({
        manifestId: access.route.id,
        driverId: access.route.driverId,
        notes,
        items: inspectedItems,
      }));
      await printZpl(buildZplDocument(document), printer);
      setPendingDocument(document);
      await finishReturnPrint(document);
    } catch (workError) {
      setError(workError.message || 'Unable to confirm and print return inventory.');
    } finally {
      setWorking(false);
    }
  };

  const retryPrintConfirmation = async () => {
    if (!pendingDocument) return;
    setWorking(true);
    setError('');
    try {
      if (mode === 'return') await finishReturnPrint(pendingDocument);
      else await finishDeparturePrint(pendingDocument);
    } catch (retryError) {
      setError(retryError.message || 'Unable to record the completed print.');
    } finally {
      setWorking(false);
    }
  };

  const signOut = () => {
    setAccess(null);
    setMode(null);
    setPendingDocument(null);
    setEmployeeId('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Staff Inventory Check</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!access ? (
          <View>
            <Text style={styles.sectionTitle}>Warehouse Employee Login</Text>
            <TextInput value={employeeId} onChangeText={setEmployeeId} placeholder="Company employee ID" placeholderTextColor="#7890a3" autoCapitalize="none" autoCorrect={false} style={styles.input} />
            <TextInput value={routeNumber} onChangeText={setRouteNumber} placeholder="Route number being inspected" placeholderTextColor="#7890a3" autoCapitalize="characters" autoCorrect={false} style={styles.input} />
            <TextInput value={routeDate} onChangeText={setRouteDate} placeholder="YYYY-MM-DD" placeholderTextColor="#7890a3" autoCapitalize="none" style={styles.input} />
            <Pressable onPress={loginAndLoad} disabled={working} style={styles.primaryButton}>
              {working ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
            </Pressable>
          </View>
        ) : !mode ? (
          <View>
            <Text style={styles.routeNumber}>Route {access.route?.routeNumber || '-'}</Text>
            <Text style={styles.routeMeta}>{access.route?.routeDate || ''} | Driver {access.route?.driverName || access.route?.driverId}</Text>
            <Text style={styles.employeeMeta}>Employee: {access.employee?.employeeName || access.employee?.employeeId} | ID {access.employee?.employeeId}</Text>
            <Text style={styles.sectionTitle}>Select inventory check</Text>
            <Pressable onPress={() => setMode('departure')} style={styles.modeButton}>
              <Text style={styles.modeTitle}>Departing Inventory Check</Text>
              <Text style={styles.modeDetail}>Confirm truck inventory before the route begins</Text>
            </Pressable>
            <Pressable onPress={() => setMode('return')} style={styles.modeButton}>
              <Text style={styles.modeTitle}>Returning Inventory Check</Text>
              <Text style={styles.modeDetail}>Record whole product, returns, damage, and discrepancies</Text>
            </Pressable>
            <Pressable onPress={signOut} style={styles.secondaryButton}><Text style={styles.buttonText}>Sign Out</Text></Pressable>
          </View>
        ) : mode === 'departure' ? (
          <View>
            <Pressable onPress={() => setMode(null)} style={styles.modeBack}><Text style={styles.backText}>{'< Choose Different Check'}</Text></Pressable>
            <Text style={styles.sectionTitle}>Departing Inventory Check</Text>
            <View style={styles.summaryBand}>
              <Text style={styles.summaryText}>Planned {departureTotals.planned}</Text>
              <Text style={styles.summaryText}>Added {departureTotals.added}</Text>
              <Text style={styles.summaryText}>Expected {departureTotals.expected}</Text>
            </View>
            {items.map((item) => (
              <View key={item.id || item.sku} style={styles.itemRow}>
                <View style={styles.itemText}>
                  <Text style={styles.itemName}>{item.productName || item.sku || 'Product'}</Text>
                  <Text style={styles.itemMeta}>SKU {item.sku || '-'}{item.packageSize ? ` | ${item.packageSize}` : ''}</Text>
                </View>
                <Text style={styles.expectedText}>{quantity(item.expectedOnTruckQuantity)}</Text>
              </View>
            ))}
            {departurePrinted ? (
              <View style={styles.printedStatus}>
                <Text style={styles.printedTitle}>Confirmed and Printed</Text>
                <Text style={styles.printedText}>{access.confirmation.warehouseEmployeeName || access.confirmation.warehouseEmployeeId}</Text>
              </View>
            ) : (
              <Pressable onPress={pendingDocument ? retryPrintConfirmation : confirmDepartureAndPrint} disabled={working || !items.length} style={styles.primaryButton}>
                {working ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{pendingDocument ? 'Retry Print Confirmation' : 'Confirm and Print Departure Inventory'}</Text>}
              </Pressable>
            )}
          </View>
        ) : (
          <View>
            <Pressable onPress={() => setMode(null)} style={styles.modeBack}><Text style={styles.backText}>{'< Choose Different Check'}</Text></Pressable>
            <Text style={styles.sectionTitle}>Returning Inventory Check</Text>
            <View style={styles.returnSummary}>
              <Text style={styles.summaryLine}>Confirmed departure: {quantity(returnSummary.departureQuantity)}</Text>
              <Text style={styles.summaryLine}>Added after departure: {quantity(returnSummary.addedAfterDepartureQuantity)}</Text>
              <Text style={styles.summaryLine}>Delivered: {quantity(returnSummary.deliveredQuantity)}</Text>
              <Text style={styles.summaryLine}>Expected physical return: {quantity(returnSummary.expectedReturnQuantity)}</Text>
            </View>
            {inspectedItems.map((item) => (
              <View key={item.sku} style={styles.returnItem}>
                <Text style={styles.returnItemName}>{item.productName || item.sku}</Text>
                <Text style={styles.itemMeta}>
                  SKU {item.sku} | Expected return {quantity(item.expectedReturnQuantity)}
                </Text>
                {RETURN_FIELDS.map((field) => (
                  <View key={field.key} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <TextInput
                      value={returnValues[item.sku]?.[field.key] || '0'}
                      onChangeText={(value) => setReturnValues((current) => ({
                        ...current,
                        [item.sku]: {
                          ...(current[item.sku] || {}),
                          [field.key]: value,
                        },
                      }))}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                      style={styles.quantityInput}
                    />
                  </View>
                ))}
                <Text style={Math.abs(item.discrepancyQuantity) >= 0.001 ? styles.itemDiscrepancy : styles.itemBalanced}>
                  {Math.abs(item.discrepancyQuantity) >= 0.001
                    ? `${item.discrepancyStatus.toUpperCase()} ${Math.abs(item.discrepancyQuantity)}`
                    : 'Balanced'}
                </Text>
              </View>
            ))}
            <View style={hasDiscrepancy ? styles.discrepancyBox : styles.balancedBox}>
              <Text style={hasDiscrepancy ? styles.discrepancyTitle : styles.balancedTitle}>
                {hasDiscrepancy
                  ? `DISCREPANCY: ${discrepancyItemCount} PRODUCT${discrepancyItemCount === 1 ? '' : 'S'} | NET ${discrepancyQuantity}`
                  : 'INVENTORY BALANCED'}
              </Text>
            </View>
            <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Return inspection notes" placeholderTextColor="#7890a3" style={styles.notes} />
            <Pressable onPress={pendingDocument ? retryPrintConfirmation : confirmReturnAndPrint} disabled={working} style={styles.primaryButton}>
              {working ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{pendingDocument ? 'Retry Print Confirmation' : 'Confirm and Print Return Inventory'}</Text>}
            </Pressable>
          </View>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08131d' },
  header: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingRight: 64, borderBottomWidth: 1, borderBottomColor: '#23404f' },
  backButton: { minWidth: 72, minHeight: 42, justifyContent: 'center' },
  backText: { color: '#7fd0ff', fontWeight: '900' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '900', textAlign: 'center' },
  content: { padding: 16, paddingBottom: 44 },
  sectionTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 8, marginBottom: 16 },
  input: { minHeight: 50, marginBottom: 12, paddingHorizontal: 14, color: '#fff', backgroundColor: '#101f2a', borderWidth: 1, borderColor: '#365568', borderRadius: 6 },
  primaryButton: { minHeight: 52, marginTop: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#087f68', borderRadius: 6 },
  secondaryButton: { minHeight: 48, marginTop: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#334b5a', borderRadius: 6 },
  buttonText: { color: '#fff', fontWeight: '900', textAlign: 'center' },
  routeNumber: { color: '#fff', fontSize: 24, fontWeight: '900' },
  routeMeta: { color: '#9eb4c4', marginTop: 4, fontWeight: '700' },
  employeeMeta: { color: '#70e0b1', marginTop: 6, fontWeight: '800' },
  modeButton: { minHeight: 78, marginBottom: 12, padding: 14, justifyContent: 'center', backgroundColor: '#163b4d', borderWidth: 1, borderColor: '#3f7188', borderRadius: 6 },
  modeTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  modeDetail: { color: '#b8cbd6', marginTop: 4, fontSize: 12, fontWeight: '700' },
  modeBack: { minHeight: 40, justifyContent: 'center' },
  summaryBand: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#294958' },
  summaryText: { color: '#dbe9f2', fontWeight: '900' },
  itemRow: { flexDirection: 'row', gap: 12, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1f3541' },
  itemText: { flex: 1 },
  itemName: { color: '#fff', fontWeight: '900', fontSize: 15 },
  itemMeta: { color: '#91a8b8', marginTop: 3, fontSize: 12 },
  expectedText: { color: '#70e0b1', fontWeight: '900' },
  printedStatus: { marginTop: 18, padding: 16, backgroundColor: '#123a31', borderWidth: 1, borderColor: '#2c9d7e', borderRadius: 6 },
  printedTitle: { color: '#79efc2', fontWeight: '900' },
  printedText: { color: '#fff', marginTop: 4 },
  returnSummary: { padding: 14, backgroundColor: '#102938', borderRadius: 6 },
  summaryLine: { color: '#dbe9f2', fontWeight: '800', marginVertical: 3 },
  returnItem: { paddingVertical: 16, borderBottomWidth: 2, borderBottomColor: '#315063' },
  returnItemName: { color: '#fff', fontSize: 16, fontWeight: '900' },
  fieldRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#20394a' },
  fieldLabel: { flex: 1, color: '#dce9ef', fontWeight: '800', paddingRight: 12 },
  quantityInput: { width: 96, padding: 11, color: '#fff', backgroundColor: '#132b39', borderWidth: 1, borderColor: '#355568', textAlign: 'right', fontWeight: '900' },
  itemDiscrepancy: { marginTop: 10, color: '#ff8a95', fontWeight: '900', textAlign: 'right' },
  itemBalanced: { marginTop: 10, color: '#79efc2', fontWeight: '900', textAlign: 'right' },
  discrepancyBox: { marginTop: 18, padding: 16, backgroundColor: '#721c24', borderWidth: 2, borderColor: '#ff6573' },
  discrepancyTitle: { color: '#fff', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  balancedBox: { marginTop: 18, padding: 16, backgroundColor: '#123a31', borderWidth: 1, borderColor: '#2c9d7e' },
  balancedTitle: { color: '#79efc2', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  notes: { minHeight: 100, marginTop: 16, padding: 12, color: '#fff', backgroundColor: '#102532', borderWidth: 1, borderColor: '#355568', textAlignVertical: 'top' },
  error: { color: '#ff9f9f', fontWeight: '800', marginTop: 14 },
});
