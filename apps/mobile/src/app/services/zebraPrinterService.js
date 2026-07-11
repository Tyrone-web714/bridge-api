import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform } from 'react-native';

const PRINTER_STORAGE_KEY = '@truck-safe-routing/zebra-printer/v1';

function bluetoothModule() {
  try {
    return require('react-native-bluetooth-classic').default;
  } catch {
    return null;
  }
}

async function requestBluetoothPermission() {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 31) return true;
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  ]);
  return Object.values(result).every((value) => value === PermissionsAndroid.RESULTS.GRANTED);
}

export async function listPairedZebraPrinters() {
  const module = bluetoothModule();
  if (!module) {
    throw new Error('Bluetooth printing requires the newest installed Truck-Safe build.');
  }
  const granted = await requestBluetoothPermission();
  if (!granted) throw new Error('Bluetooth permission is required to use the Zebra printer.');
  const devices = await module.getBondedDevices();
  return (devices || []).filter((device) => (
    /zq|zebra/i.test(`${device?.name || ''} ${device?.address || ''}`)
  ));
}

export async function saveSelectedPrinter(device) {
  const printer = {
    name: device?.name || 'Zebra ZQ520',
    address: device?.address || device?.id,
  };
  if (!printer.address) throw new Error('The selected printer has no Bluetooth address.');
  await AsyncStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(printer));
  return printer;
}

export async function readSelectedPrinter() {
  try {
    const stored = await AsyncStorage.getItem(PRINTER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export async function connectZebraPrinter(device) {
  const module = bluetoothModule();
  if (!module) throw new Error('Bluetooth printing requires the newest installed Truck-Safe build.');
  const granted = await requestBluetoothPermission();
  if (!granted) throw new Error('Bluetooth permission is required to connect the Zebra printer.');
  const printer = device ? await saveSelectedPrinter(device) : await readSelectedPrinter();
  if (!printer?.address) throw new Error('Select a paired Zebra ZQ520 first.');
  let connectedDevice = null;
  try {
    connectedDevice = await module.getConnectedDevice(printer.address);
  } catch {
    connectedDevice = null;
  }
  if (!connectedDevice) {
    connectedDevice = await module.connectToDevice(printer.address);
  }
  if (!connectedDevice) throw new Error('Unable to connect to the Zebra ZQ520.');
  if (!await connectedDevice.isConnected()) await connectedDevice.connect();
  return printer;
}

export async function readZebraConnectionStatus() {
  const printer = await readSelectedPrinter();
  if (!printer?.address) return { printer: null, connected: false };
  const module = bluetoothModule();
  if (!module) return { printer, connected: false };
  try {
    const device = await module.getConnectedDevice(printer.address);
    return { printer, connected: Boolean(device && await device.isConnected()) };
  } catch {
    return { printer, connected: false };
  }
}

export async function disconnectZebraPrinter() {
  const printer = await readSelectedPrinter();
  const module = bluetoothModule();
  if (module && printer?.address) {
    try {
      const device = await module.getConnectedDevice(printer.address);
      if (device && await device.isConnected()) await device.disconnect();
    } catch {
      // The stored selection is still cleared when the radio is already disconnected.
    }
  }
  await AsyncStorage.removeItem(PRINTER_STORAGE_KEY);
  return null;
}

export async function printZpl(zpl, selectedPrinter = null) {
  const module = bluetoothModule();
  if (!module) {
    throw new Error('Bluetooth printing requires the newest installed Truck-Safe build.');
  }
  const granted = await requestBluetoothPermission();
  if (!granted) throw new Error('Bluetooth permission is required to print.');
  const printer = selectedPrinter || await readSelectedPrinter();
  if (!printer?.address) throw new Error('Select the paired Zebra ZQ520 before printing.');

  await connectZebraPrinter(printer);
  let device = await module.getConnectedDevice(printer.address);
  if (!device) throw new Error('Unable to connect to the Zebra ZQ520.');
  const connected = await device.isConnected();
  if (!connected) await device.connect();
  const written = await device.write(zpl, 'utf8');
  if (!written) throw new Error('The Zebra printer did not accept the document.');
  return printer;
}
