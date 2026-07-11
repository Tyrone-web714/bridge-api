import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getActiveDriverSession } from '../services/driverSession';
import { fetchAssignedDriverRouteFromDates } from '../services/routeManifestApi';
import {
  connectZebraPrinter,
  disconnectZebraPrinter,
  listPairedZebraPrinters,
  readZebraConnectionStatus,
} from '../services/zebraPrinterService';
import { getAssignedRouteLookupDates } from '../utils/routeDate';

export default function DriverSettingsOverlay({ navigationRef, visible, screenKey }) {
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [assignedRoute, setAssignedRoute] = useState(null);
  const [driver, setDriver] = useState(null);
  const [printerStatus, setPrinterStatus] = useState({ printer: null, connected: false });
  const [isPrinterBusy, setIsPrinterBusy] = useState(false);
  const [scrollOffset, setScrollOffset] = useState(0);

  useEffect(() => {
    if (!visible) setIsOpen(false);
  }, [visible]);

  useEffect(() => {
    setScrollOffset(0);
  }, [screenKey]);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('driver-settings-scroll', (offset) => {
      const nextOffset = Number(offset);
      setScrollOffset(Number.isFinite(nextOffset) ? Math.max(0, Math.min(nextOffset, 100)) : 0);
    });
    return () => subscription.remove();
  }, []);

  const loadDriverContext = async () => {
    const session = getActiveDriverSession();
    const sessionDriver = session?.driver || null;
    setDriver(sessionDriver);
    setAssignedRoute(null);
    setIsLoadingRoute(Boolean(sessionDriver?.driverId));

    const [printer] = await Promise.all([
      readZebraConnectionStatus().catch(() => ({ printer: null, connected: false })),
      sessionDriver?.driverId
        ? fetchAssignedDriverRouteFromDates({
            routeDates: getAssignedRouteLookupDates(),
            driverId: sessionDriver.driverId,
            driverName: sessionDriver.driverName,
          })
          .then(setAssignedRoute)
          .catch(() => setAssignedRoute(null))
        : Promise.resolve(),
    ]);
    setPrinterStatus(printer);
    setIsLoadingRoute(false);
  };

  const openSettings = () => {
    setIsOpen(true);
    loadDriverContext();
  };

  const connectPrinter = async () => {
    setIsPrinterBusy(true);
    try {
      const devices = await listPairedZebraPrinters();
      if (!devices.length) throw new Error('Pair the printer in Android Bluetooth settings first.');
      Alert.alert('Connect Printer', 'Select the printer for this shift.', [
        ...devices.slice(0, 6).map((device) => ({
          text: device.name || device.address,
          onPress: async () => {
            try {
              const printer = await connectZebraPrinter(device);
              setPrinterStatus({ printer, connected: true });
            } catch (error) {
              Alert.alert('Printer connection failed', error.message);
            } finally {
              setIsPrinterBusy(false);
            }
          },
        })),
        { text: 'Cancel', style: 'cancel', onPress: () => setIsPrinterBusy(false) },
      ]);
    } catch (error) {
      setIsPrinterBusy(false);
      Alert.alert('Printer unavailable', error.message);
    }
  };

  const disconnectPrinter = async () => {
    setIsPrinterBusy(true);
    try {
      await disconnectZebraPrinter();
      setPrinterStatus({ printer: null, connected: false });
    } catch (error) {
      Alert.alert('Unable to disconnect printer', error.message);
    } finally {
      setIsPrinterBusy(false);
    }
  };

  const requireDriver = () => {
    if (driver?.driverId) return true;
    Alert.alert('Driver login required', 'Return to Home and sign in before using driver settings.');
    return false;
  };

  const openInventory = () => {
    if (!requireDriver()) return;
    if (!assignedRoute?.id) {
      Alert.alert(
        'Assigned route unavailable',
        isLoadingRoute
          ? 'The assigned route is still loading. Try again in a moment.'
          : 'No assigned route is available for this driver today.'
      );
      return;
    }
    setIsOpen(false);
    navigationRef.navigate('RouteInventory', {
      manifestId: assignedRoute.id,
      routeNumber: assignedRoute.routeNumber,
      routeDate: assignedRoute.routeDate,
      driverId: driver.driverId,
      driverName: driver.driverName || driver.driverId,
    });
  };

  const openHazardReport = () => {
    if (!requireDriver()) return;
    const currentRoute = navigationRef.getCurrentRoute();
    const params = currentRoute?.params || {};
    setIsOpen(false);
    navigationRef.navigate('HazardReport', {
      driverId: driver.driverId,
      driverName: driver.driverName || driver.driverId,
      routeDestination:
        params.destinationAddress
        || params.destinationDetails?.formattedAddress
        || assignedRoute?.routeName
        || null,
    });
  };

  const openWarehouseInventory = () => {
    setIsOpen(false);
    navigationRef.navigate('WarehouseInventory', {
      routeNumber: assignedRoute?.routeNumber || '',
    });
  };

  if (!visible) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        onPress={openSettings}
        style={({ pressed }) => [
          styles.gearButton,
          {
            top: insets.top + 20,
            transform: [{ translateY: -scrollOffset }],
          },
          pressed && styles.gearButtonPressed,
        ]}
      >
        <Text style={styles.gearIcon}>{'\u2699'}</Text>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={[styles.overlay, { paddingTop: insets.top + 76 }]}>
          <View style={styles.card}>
            <View style={styles.header}>
              <View>
                <Text style={styles.title}>Settings</Text>
                <Text style={styles.driverText}>
                  {driver?.driverId
                    ? `${driver.driverName || 'Driver'} | ${driver.driverId}`
                    : 'Driver not signed in'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close settings"
                onPress={() => setIsOpen(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>X</Text>
              </Pressable>
            </View>

            <View style={styles.printerRow}>
              <View style={styles.printerText}>
                <Text style={styles.settingLabel}>PRINTER</Text>
                <Text style={printerStatus.connected ? styles.connected : styles.disconnected}>
                  {printerStatus.connected
                    ? `Connected: ${printerStatus.printer?.name || 'Printer'}`
                    : 'Not connected'}
                </Text>
              </View>
              <Pressable
                onPress={printerStatus.connected ? disconnectPrinter : connectPrinter}
                disabled={isPrinterBusy}
                style={printerStatus.connected ? styles.disconnectButton : styles.connectButton}
              >
                {isPrinterBusy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>{printerStatus.connected ? 'Disconnect' : 'Connect'}</Text>}
              </Pressable>
            </View>

            <Pressable onPress={openInventory} style={styles.inventoryButton}>
              <View>
                <Text style={styles.actionTitle}>Inventory List</Text>
                <Text style={styles.actionDetail}>
                  {isLoadingRoute
                    ? 'Loading assigned route...'
                    : assignedRoute
                      ? `Route ${assignedRoute.routeNumber}`
                      : 'Assigned route required'}
                </Text>
              </View>
            </Pressable>

            <Pressable onPress={openWarehouseInventory} style={styles.staffButton}>
              <Text style={styles.actionTitle}>Staff Inventory Confirmation</Text>
              <Text style={styles.actionDetail}>Company employee ID, confirmation, and print</Text>
            </Pressable>

            <Pressable onPress={openHazardReport} style={styles.hazardButton}>
              <Text style={styles.actionTitle}>Report Missing Hazard</Text>
              <Text style={styles.actionDetail}>Low bridge, no-through-truck, or residential restriction</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  gearButton: {
    position: 'absolute',
    right: 14,
    zIndex: 1000,
    elevation: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    backgroundColor: 'rgba(17,25,35,0.94)',
  },
  gearButtonPressed: { opacity: 0.72 },
  gearIcon: { color: '#fff', fontSize: 27, lineHeight: 30 },
  overlay: {
    flex: 1,
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.52)',
  },
  card: {
    width: '94%',
    maxWidth: 430,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(127,208,255,0.28)',
    backgroundColor: '#111923',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 17, fontWeight: '900' },
  driverText: { color: '#9fd6e8', marginTop: 3, fontSize: 11, fontWeight: '800' },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  printerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  printerText: { flex: 1 },
  settingLabel: { color: '#fff', fontWeight: '900' },
  connected: { color: '#7dffb0', marginTop: 3, fontWeight: '800', fontSize: 12 },
  disconnected: { color: '#ffc36b', marginTop: 3, fontWeight: '800', fontSize: 12 },
  connectButton: { minWidth: 94, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#16866f' },
  disconnectButton: { minWidth: 94, minHeight: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#8e2730' },
  buttonText: { color: '#fff', fontWeight: '900' },
  inventoryButton: { minHeight: 62, marginTop: 16, padding: 12, justifyContent: 'center', backgroundColor: '#0d6efd' },
  staffButton: { minHeight: 62, marginTop: 10, padding: 12, justifyContent: 'center', backgroundColor: '#087f68' },
  hazardButton: { minHeight: 62, marginTop: 10, padding: 12, justifyContent: 'center', backgroundColor: '#b51f2e' },
  actionTitle: { color: '#fff', fontWeight: '900', textAlign: 'center' },
  actionDetail: { color: '#e4eef5', marginTop: 3, fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
