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
  confirmFinalInventoryCloseoutPrint,
  prepareFinalInventoryCloseout,
} from '../services/routeManifestApi';
import { buildZplDocument } from '../services/deliveryDocumentService';
import {
  printZpl,
  readSelectedPrinter,
} from '../services/zebraPrinterService';

const FIELDS = [
  { key: 'sellableQuantity', label: 'Remaining sellable' },
  { key: 'returnedQuantity', label: 'Customer returns' },
  { key: 'damagedQuantity', label: 'Damaged' },
  { key: 'missingQuantity', label: 'Missing / unaccounted' },
  { key: 'addedQuantity', label: 'Added inventory' },
  { key: 'rejectedQuantity', label: 'Rejected inventory' },
];

function quantity(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export default function FinalInventoryCloseoutScreen({ navigation, route }) {
  const params = route?.params || {};
  const reconciliation = params.inventoryReconciliation || {};
  const loadedQuantity = quantity(reconciliation.plannedQuantity);
  const deliveredQuantity = quantity(reconciliation.deliveredQuantity);
  const startingSellable = Math.max(
    0,
    loadedQuantity
      + quantity(reconciliation.addedQuantity)
      - deliveredQuantity
      - quantity(reconciliation.returnedQuantity)
      - quantity(reconciliation.damagedQuantity)
      - quantity(reconciliation.missingQuantity)
      - quantity(reconciliation.rejectedQuantity)
  );
  const [values, setValues] = useState({
    sellableQuantity: String(startingSellable),
    returnedQuantity: String(quantity(reconciliation.returnedQuantity)),
    damagedQuantity: String(quantity(reconciliation.damagedQuantity)),
    missingQuantity: String(quantity(reconciliation.missingQuantity)),
    addedQuantity: String(quantity(reconciliation.addedQuantity)),
    rejectedQuantity: String(quantity(reconciliation.rejectedQuantity)),
  });
  const [notes, setNotes] = useState('');
  const [warehouseEmployeeId, setWarehouseEmployeeId] = useState('');
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  const summary = useMemo(() => {
    const normalized = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, quantity(value)])
    );
    const accounted = deliveredQuantity
      + normalized.sellableQuantity
      + normalized.returnedQuantity
      + normalized.damagedQuantity
      + normalized.missingQuantity
      + normalized.rejectedQuantity;
    const available = loadedQuantity + normalized.addedQuantity;
    return {
      ...normalized,
      unaccountedQuantity: Math.max(0, available - accounted),
      overageQuantity: Math.max(0, accounted - available),
    };
  }, [values, loadedQuantity, deliveredQuantity]);

  const completeAfterPrint = async (document) => {
    const completed = await confirmFinalInventoryCloseoutPrint(
      params.manifestId,
      document.printConfirmationToken,
      { driverId: params.driverId, driverName: params.driverName }
    );
    setPendingConfirmation(null);
    Alert.alert(
      'Route closed',
      'Final inventory inspection was printed and sent to the supervisor review queue.',
      [{
        text: 'Done',
        onPress: () => navigation.replace('TodayRoute', {
          driverId: params.driverId,
          driverName: params.driverName,
          routeDate: params.routeDate,
        }),
      }]
    );
    return completed;
  };

  const printAndComplete = async () => {
    if (!warehouseEmployeeId.trim()) {
      Alert.alert('Staff confirmation required', 'Enter the company employee ID of the staff member conducting the return inventory check.');
      return;
    }
    setIsPrinting(true);
    try {
      let printer = selectedPrinter || await readSelectedPrinter();
      if (!printer?.address) {
        throw new Error('Connect the Zebra ZQ520 from Home Settings before final closeout.');
      }
      const document = await prepareFinalInventoryCloseout(
        params.manifestId,
        {
          loadedQuantity,
          deliveredQuantity,
          ...summary,
          notes,
          items: [],
          warehouseEmployeeId: warehouseEmployeeId.trim(),
        },
        { driverId: params.driverId, driverName: params.driverName }
      );
      await printZpl(buildZplDocument(document), printer);
      setSelectedPrinter(printer);
      setPendingConfirmation(document);
      await completeAfterPrint(document);
    } catch (error) {
      Alert.alert(
        pendingConfirmation ? 'Confirmation pending' : 'Final closeout not completed',
        error.message || 'The Zebra print was not confirmed. The route remains active.'
      );
    } finally {
      setIsPrinting(false);
    }
  };

  const retryConfirmation = async () => {
    if (!pendingConfirmation) return;
    setIsPrinting(true);
    try {
      await completeAfterPrint(pendingConfirmation);
    } catch (error) {
      Alert.alert('Confirmation pending', error.message);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>{'< Back'}</Text>
          </Pressable>
          <Text style={styles.kicker}>Distribution Center Return</Text>
          <Text style={styles.title}>Final Inventory Inspection</Text>
          <Text style={styles.routeText}>
            Route {params.routeNumber} | {params.routeDate}
          </Text>
        </View>

        <View style={styles.summaryBand}>
          <View><Text style={styles.metric}>{loadedQuantity}</Text><Text style={styles.metricLabel}>Loaded</Text></View>
          <View><Text style={styles.metric}>{deliveredQuantity}</Text><Text style={styles.metricLabel}>Delivered</Text></View>
          <View><Text style={styles.metric}>{summary.unaccountedQuantity}</Text><Text style={styles.metricLabel}>Unaccounted</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Physical inspection counts</Text>
        {FIELDS.map((field) => (
          <View key={field.key} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{field.label}</Text>
            <TextInput
              value={values[field.key]}
              onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={styles.input}
            />
          </View>
        ))}

        {summary.overageQuantity > 0 && (
          <Text style={styles.warning}>Inspection exceeds loaded plus added inventory by {summary.overageQuantity}.</Text>
        )}
        {summary.unaccountedQuantity > 0 && (
          <Text style={styles.warning}>{summary.unaccountedQuantity} unit(s) remain unaccounted.</Text>
        )}

        <Text style={styles.sectionTitle}>Inspection notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Record damage, returns, seal, or warehouse inspection notes"
          placeholderTextColor="#718598"
          style={styles.notes}
        />

        <Text style={styles.sectionTitle}>Staff conducting inspection</Text>
        <TextInput
          value={warehouseEmployeeId}
          onChangeText={setWarehouseEmployeeId}
          placeholder="Company employee ID"
          placeholderTextColor="#718598"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.staffInput}
        />

        {pendingConfirmation ? (
          <Pressable onPress={retryConfirmation} disabled={isPrinting} style={styles.completeButton}>
            <Text style={styles.completeText}>Retry Backend Print Confirmation</Text>
          </Pressable>
        ) : (
          <Pressable onPress={printAndComplete} disabled={isPrinting} style={styles.completeButton}>
            {isPrinting
              ? <ActivityIndicator color="#ffffff" />
              : <Text style={styles.completeText}>Print and Complete Route</Text>}
          </Pressable>
        )}
        <Text style={styles.requirement}>
          The route remains active unless the Zebra ZQ520 accepts the final inventory closeout.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08131d' },
  content: { padding: 18, paddingBottom: 42 },
  header: { marginBottom: 18 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 14 },
  backText: { color: '#75e8f4', fontWeight: '900' },
  kicker: { color: '#71d7c5', fontWeight: '900', textTransform: 'uppercase', marginTop: 8 },
  title: { color: '#ffffff', fontSize: 28, fontWeight: '900', marginTop: 5 },
  routeText: { color: '#a9bdc8', marginTop: 5, fontWeight: '700' },
  summaryBand: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#102938', padding: 16, borderRadius: 6 },
  metric: { color: '#ffffff', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  metricLabel: { color: '#9eb4c0', fontSize: 12, fontWeight: '800', marginTop: 3 },
  sectionTitle: { color: '#ffffff', fontSize: 17, fontWeight: '900', marginTop: 22, marginBottom: 9 },
  fieldRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#20394a' },
  fieldLabel: { color: '#dce9ef', fontWeight: '800', flex: 1, paddingRight: 12 },
  input: { width: 95, backgroundColor: '#132b39', color: '#ffffff', borderWidth: 1, borderColor: '#355568', padding: 11, textAlign: 'right', fontWeight: '900' },
  notes: { minHeight: 105, backgroundColor: '#102532', color: '#ffffff', borderWidth: 1, borderColor: '#355568', padding: 12, textAlignVertical: 'top' },
  staffInput: { minHeight: 50, backgroundColor: '#102532', color: '#ffffff', borderWidth: 1, borderColor: '#355568', paddingHorizontal: 12 },
  warning: { color: '#ffd07a', fontWeight: '800', marginTop: 10 },
  printerButton: { marginTop: 22, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#29485f' },
  printerText: { color: '#ffffff', fontWeight: '900' },
  completeButton: { marginTop: 12, minHeight: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: '#16866f' },
  completeText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  requirement: { color: '#9fb3be', textAlign: 'center', marginTop: 12, lineHeight: 19 },
});
