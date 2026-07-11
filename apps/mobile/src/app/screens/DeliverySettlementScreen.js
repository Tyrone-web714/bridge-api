import React, { useEffect, useMemo, useState } from 'react';
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
  createStopDeliveryDocument,
  addRouteTruckInventory,
  fetchRouteTruckInventory,
  fetchRouteCloseoutDocument,
  fetchStopDeliveryDocuments,
  fetchStopDeliverySettlement,
  saveStopDeliverySettlement,
  lookupProductByBarcode,
  updateAssignedRouteStopStatus,
} from '../services/routeManifestApi';
import SignatureCaptureModal from '../components/SignatureCaptureModal';
import AccountKnowledgePanel from '../components/AccountKnowledgePanel';
import ProductBarcodeScannerModal from '../components/ProductBarcodeScannerModal';
import {
  buildLocalDeliveryDocument,
  buildLocalRouteCloseoutDocument,
  buildZplDocument,
} from '../services/deliveryDocumentService';
import { readCachedStopDelivery } from '../services/deliveryOfflineStore';
import {
  printZpl,
  readSelectedPrinter,
} from '../services/zebraPrinterService';

const EXCEPTION_FIELDS = [
  { key: 'rejectedQuantity', label: 'Rejected', color: '#ffb347' },
  { key: 'damagedQuantity', label: 'Damaged', color: '#ff6b6b' },
  { key: 'returnedQuantity', label: 'Return', color: '#74c0fc' },
  { key: 'missingQuantity', label: 'Missing', color: '#f06595' },
];

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'check', label: 'Check' },
  { key: 'card', label: 'Card' },
  { key: 'credit_account', label: 'Credit Account' },
  { key: 'partial_payment', label: 'Partial Payment' },
  { key: 'unpaid', label: 'Unpaid' },
];

const DRIVER_RECEIPT_WINDOW_MS = 24 * 60 * 60 * 1000;

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function money(value) {
  return numberValue(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function isFinished(stop) {
  return ['completed', 'departed', 'skipped', 'undelivered'].includes(
    String(stop?.status || '').toLowerCase()
  );
}

function buildStopAddress(stop) {
  const cityLine = [stop?.city, stop?.stateCode, stop?.postalCode].filter(Boolean).join(' ');
  return [stop?.destinationAddress, cityLine].filter(Boolean).join(', ');
}

function adjustmentReasonForItem(item) {
  const reasons = [];
  if (numberValue(item.rejectedQuantity) > 0) reasons.push('customer_rejected');
  if (numberValue(item.damagedQuantity) > 0) reasons.push('damaged_product');
  if (numberValue(item.returnedQuantity) > 0) reasons.push('returned_to_warehouse');
  if (numberValue(item.missingQuantity) > 0) reasons.push('missing_product');
  if (numberValue(item.addedQuantity) > 0) reasons.push(item.adjustmentReason || 'driver_added_product');
  return reasons.join(', ') || null;
}

function normalizeItem(item) {
  return {
    ...item,
    plannedQuantity: numberValue(item.plannedQuantity),
    deliveredQuantity: numberValue(item.deliveredQuantity),
    rejectedQuantity: numberValue(item.rejectedQuantity),
    damagedQuantity: numberValue(item.damagedQuantity),
    returnedQuantity: numberValue(item.returnedQuantity),
    missingQuantity: numberValue(item.missingQuantity),
    addedQuantity: numberValue(item.addedQuantity),
    unitPrice: numberValue(item.unitPrice),
  };
}

function productId(item) {
  return item?.sku || item?.productNumber || item?.productId || item?.orderItemId || '';
}

function isDriverReceiptWindowOpen(completedAt) {
  if (!completedAt) return true;
  const completedAtMs = new Date(completedAt).getTime();
  return Number.isFinite(completedAtMs)
    && Date.now() - completedAtMs <= DRIVER_RECEIPT_WINDOW_MS;
}

export default function DeliverySettlementScreen({ navigation, route }) {
  const stopId = route?.params?.stopId;
  const driverId = route?.params?.driverId;
  const driverName = route?.params?.driverName || driverId;
  const routeDate = route?.params?.routeDate;
  const requestedNonDeliveryReason = route?.params?.nonDeliveryReason || null;
  const [delivery, setDelivery] = useState(null);
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [taxAmount, setTaxAmount] = useState('0.00');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [customerSignature, setCustomerSignature] = useState(null);
  const [driverSignature, setDriverSignature] = useState(null);
  const [signatureTarget, setSignatureTarget] = useState(null);
  const [savedDocuments, setSavedDocuments] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [newProduct, setNewProduct] = useState({
    barcode: '',
    sku: '',
    productName: '',
    quantity: '',
    unitPrice: '',
    reason: '',
    truckQuantity: '',
    truckReason: '',
  });
  const [scannerVisible, setScannerVisible] = useState(false);
  const [truckInventory, setTruckInventory] = useState([]);
  const [isInventorySaving, setIsInventorySaving] = useState(false);
  const [productSearch, setProductSearch] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const data = await fetchStopDeliverySettlement(stopId, { driverId, driverName });
        if (!active) return;
        const loadedItems = (data?.settlement?.items || []).map(normalizeItem);
        if (requestedNonDeliveryReason && data?.settlement?.status !== 'completed') {
          setItems(loadedItems.map((item) => ({
            ...item,
            deliveredQuantity: 0,
            rejectedQuantity: requestedNonDeliveryReason === 'customer_refused'
              ? item.plannedQuantity
              : 0,
            returnedQuantity: requestedNonDeliveryReason === 'customer_refused'
              ? 0
              : item.plannedQuantity,
          })));
        } else {
          setItems(loadedItems);
        }
        setNotes(data?.settlement?.notes || '');
        setTaxAmount(String(data?.settlement?.taxAmount ?? 0));
        setPaymentMethod(data?.settlement?.paymentMethod || '');
        setAmountPaid(String(data?.settlement?.amountPaid ?? ''));
        setCustomerSignature(data?.settlement?.customerSignature || null);
        setDriverSignature(data?.settlement?.driverSignature || null);
        setDelivery(data);
        if (data?.stop?.manifestId) {
          fetchRouteTruckInventory(data.stop.manifestId, { driverId, driverName })
            .then((inventory) => { if (active) setTruckInventory(inventory.items || []); })
            .catch(() => { if (active) setTruckInventory([]); });
        }
        readSelectedPrinter().then((printer) => {
          if (active) setSelectedPrinter(printer);
        });
        fetchStopDeliveryDocuments(stopId, { driverId, driverName })
          .then((documents) => {
            if (active) setSavedDocuments(documents);
          })
          .catch(() => {
            // Reprints remain unavailable offline; new documents can still be printed locally.
          });
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load delivery products.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [stopId, driverId, driverName, requestedNonDeliveryReason]);

  const totals = useMemo(() => items.reduce((summary, item) => {
    const planned = numberValue(item.plannedQuantity);
    const delivered = numberValue(item.deliveredQuantity);
    const rejected = numberValue(item.rejectedQuantity);
    const damaged = numberValue(item.damagedQuantity);
    const returned = numberValue(item.returnedQuantity);
    const missing = numberValue(item.missingQuantity);
    const added = numberValue(item.addedQuantity);
    const unitPrice = numberValue(item.unitPrice);
    return {
      planned: summary.planned + planned,
      delivered: summary.delivered + delivered,
      rejected: summary.rejected + rejected,
      damaged: summary.damaged + damaged,
      returned: summary.returned + returned,
      missing: summary.missing + missing,
      added: summary.added + added,
      unaccounted: summary.unaccounted + Math.max(
        0,
        planned - delivered - rejected - damaged - returned - missing
      ),
      plannedAmount: summary.plannedAmount + (planned * unitPrice),
      finalAmount: summary.finalAmount + ((delivered + added) * unitPrice),
    };
  }, {
    planned: 0,
    delivered: 0,
    rejected: 0,
    damaged: 0,
    returned: 0,
    missing: 0,
    added: 0,
    unaccounted: 0,
    plannedAmount: 0,
    finalAmount: 0,
  }), [items]);
  const calculatedTax = numberValue(taxAmount);
  const finalTotal = totals.finalAmount + calculatedTax;
  const visibleItems = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (!query) return true;
        return [
          productId(item),
          item.productName,
          item.brand,
          item.category,
          item.packageSize,
        ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      });
  }, [items, productSearch]);

  const updateExceptionQuantity = (index, field, delta) => {
    setItems((current) => current.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const currentException = numberValue(item[field]);
      const nextException = Math.max(0, currentException + delta);
      const exceptionDelta = nextException - currentException;
      const nextDelivered = Math.max(
        0,
        Math.min(
          numberValue(item.plannedQuantity),
          numberValue(item.deliveredQuantity) - exceptionDelta
        )
      );
      return {
        ...item,
        [field]: nextException,
        deliveredQuantity: nextDelivered,
      };
    }));
  };

  const addProduct = () => {
    const sku = newProduct.sku.trim();
    const productName = newProduct.productName.trim();
    const quantity = numberValue(newProduct.quantity);
    const unitPrice = numberValue(newProduct.unitPrice);
    const reason = newProduct.reason.trim();
    const inventoryLine = truckInventory.find((item) => item.sku === sku);
    const available = numberValue(inventoryLine?.availableQuantity);
    if (!newProduct.barcode || !sku || quantity <= 0 || !reason) {
      Alert.alert('Additional product', 'Scan the product barcode, then enter quantity and reason.');
      return;
    }
    if (quantity > available) {
      Alert.alert('Truck inventory required', `Only ${available} unit(s) are available. Add scanned stock to truck inventory first.`);
      return;
    }
    setItems((current) => [
      ...current,
      {
        id: `local_add_${Date.now()}`,
        orderItemId: null,
        sku,
        productName: productName || sku,
        plannedQuantity: 0,
        deliveredQuantity: 0,
        rejectedQuantity: 0,
        damagedQuantity: 0,
        returnedQuantity: 0,
        missingQuantity: 0,
        addedQuantity: quantity,
        unitPrice,
        adjustmentReason: reason,
        scannedBarcode: newProduct.barcode,
        raw: { scannedBarcode: newProduct.barcode },
        notes: null,
      },
    ]);
    setTruckInventory((current) => current.map((item) => item.sku === sku
      ? { ...item, availableQuantity: Math.max(0, numberValue(item.availableQuantity) - quantity) }
      : item));
    setNewProduct({ barcode: '', sku: '', productName: '', quantity: '', unitPrice: '', reason: '', truckQuantity: '', truckReason: '' });
  };

  const handleProductScan = async ({ barcode }) => {
    setScannerVisible(false);
    try {
      const product = await lookupProductByBarcode(barcode, { driverId, driverName });
      setNewProduct((current) => ({
        ...current,
        barcode,
        sku: product.sku,
        productName: product.productName,
        unitPrice: String(product.unitPrice ?? 0),
      }));
    } catch (scanError) {
      Alert.alert('Product not found', scanError.message);
    }
  };

  const addScannedProductToTruck = async () => {
    const manifestId = delivery?.stop?.manifestId;
    const quantity = numberValue(newProduct.truckQuantity);
    const reason = newProduct.truckReason.trim();
    if (!manifestId || !newProduct.barcode || quantity <= 0 || !reason) {
      Alert.alert('Truck inventory', 'Scan a product and enter truck quantity and reason.');
      return;
    }
    setIsInventorySaving(true);
    try {
      const result = await addRouteTruckInventory(manifestId, {
        barcode: newProduct.barcode,
        quantity,
        reason,
      }, { driverId, driverName });
      const serverLine = (result.items || []).find((item) => item.sku === newProduct.sku);
      setTruckInventory((current) => {
        const existing = current.find((item) => item.sku === newProduct.sku);
        const next = serverLine || {
          ...(existing || {}),
          sku: newProduct.sku,
          productName: newProduct.productName,
          unitPrice: numberValue(newProduct.unitPrice),
          availableQuantity: numberValue(existing?.availableQuantity) + quantity,
        };
        return [...current.filter((item) => item.sku !== newProduct.sku), next];
      });
      setNewProduct((current) => ({ ...current, truckQuantity: '', truckReason: '' }));
      Alert.alert('Truck inventory updated', result.queued
        ? 'The scanned addition is queued and will sync before the delivery.'
        : `${quantity} unit(s) added to route truck inventory.`);
    } catch (inventoryError) {
      Alert.alert('Truck inventory not updated', inventoryError.message);
    } finally {
      setIsInventorySaving(false);
    }
  };

  const removeAddedProduct = (index) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const buildPayload = (status) => ({
    status,
    completionStatus: requestedNonDeliveryReason ? 'undelivered' : 'completed',
    nonDeliveryReason: requestedNonDeliveryReason,
    notes,
    taxAmount: calculatedTax,
    paymentMethod: paymentMethod || null,
    amountPaid: numberValue(amountPaid),
    customerSignature,
    driverSignature,
    clientUpdatedAt: new Date().toISOString(),
    items: items.map((item) => ({
      orderItemId: item.orderItemId || null,
      sku: item.sku || null,
      productName: item.productName,
      brand: item.brand || null,
      packageSize: item.packageSize || null,
      category: item.category || null,
      plannedQuantity: numberValue(item.plannedQuantity),
      deliveredQuantity: numberValue(item.deliveredQuantity),
      rejectedQuantity: numberValue(item.rejectedQuantity),
      damagedQuantity: numberValue(item.damagedQuantity),
      missingQuantity: numberValue(item.missingQuantity),
      returnedQuantity: numberValue(item.returnedQuantity),
      addedQuantity: numberValue(item.addedQuantity),
      scannedBarcode: item.scannedBarcode || item.raw?.scannedBarcode || null,
      unitPrice: numberValue(item.unitPrice),
      adjustmentReason: adjustmentReasonForItem(item),
      notes: item.notes || null,
    })),
  });

  const openDeliveryNotes = () => {
    const stop = delivery?.stop || {};
    navigation.navigate('DeliveryNotes', {
      destinationAddress: buildStopAddress(stop),
      destinationPlaceId: null,
      accountNumber: stop.accountNumber,
      driverId,
      driverName,
      destinationDetails: {
        name: stop.accountName,
        formattedAddress: buildStopAddress(stop),
        accountNumber: stop.accountNumber,
        accountName: stop.accountName,
        routeStopId: stopId,
        routeDate,
        routeManifestDriverId: driverId,
        routeManifestDriverName: driverName,
      },
    });
  };

  const currentDocumentDelivery = () => ({
    ...(delivery || {}),
    settlement: {
      ...(delivery?.settlement || {}),
      ...buildPayload(delivery?.settlement?.status === 'completed' ? 'completed' : 'draft'),
      plannedAmount: totals.plannedAmount,
      finalAmount: totals.finalAmount,
      taxAmount: calculatedTax,
      totalAmount: finalTotal,
      unpaidBalance: Math.max(0, finalTotal - numberValue(amountPaid)),
      items,
    },
  });

  const printDocument = async (documentType, existingDocument = null) => {
    setIsPrinting(true);
    try {
      let document = existingDocument;
      if (!document) {
        const result = await createStopDeliveryDocument(
          stopId,
          documentType,
          { driverId, driverName }
        );
        document = result.document || {
          documentNumber: `${documentType === 'receipt' ? 'RCPT' : 'ORDER'}-${Date.now()}`,
          payload: buildLocalDeliveryDocument(
            currentDocumentDelivery(),
            { driverId, driverName },
            documentType
          ),
        };
        if (result.document) {
          setSavedDocuments((current) => [
            result.document,
            ...current.filter((item) => item.id !== result.document.id),
          ]);
        }
      }
      const printer = await printZpl(buildZplDocument(document), selectedPrinter);
      setSelectedPrinter(printer);
      Alert.alert('Print sent', `${documentType === 'receipt' ? 'Receipt' : 'Delivery order'} sent to ${printer.name}.`);
    } catch (printerError) {
      Alert.alert('Unable to print', printerError.message);
    } finally {
      setIsPrinting(false);
    }
  };

  const startNextStop = async (nextStop) => {
    try {
      await updateAssignedRouteStopStatus(nextStop.id, {
        status: 'en_route',
        routeDate,
      }, { driverId, driverName });
    } catch {
      // Navigation remains available; the durable route status queue will retry.
    }
    const destinationAddress = buildStopAddress(nextStop);
    navigation.replace('Map', {
      mode: 'start',
      destinationAddress,
      destinationPlaceId: null,
      routeStopId: nextStop.id,
      routeManifestDate: routeDate,
      destinationDetails: {
        name: nextStop.accountName || nextStop.destinationAddress,
        formattedAddress: destinationAddress,
        secondaryText: destinationAddress,
        routeManifestId: nextStop.manifestId,
        routeNumber: delivery?.stop?.routeNumber || null,
        routeStopId: nextStop.id,
        routeDate,
        accountNumber: nextStop.accountNumber,
        accountName: nextStop.accountName,
        routeManifestDriverId: driverId,
        routeManifestDriverName: driverName,
      },
      routeManifestDriverId: driverId,
      routeManifestDriverName: driverName,
    });
  };

  const printRouteCloseout = async (closeoutDocument) => {
    if (!closeoutDocument) return;
    setIsPrinting(true);
    try {
      const printer = await printZpl(buildZplDocument(closeoutDocument), selectedPrinter);
      setSelectedPrinter(printer);
      Alert.alert('Print sent', `Route turn-in receipt sent to ${printer.name}.`);
    } catch (printerError) {
      Alert.alert('Unable to print route receipt', printerError.message);
    } finally {
      setIsPrinting(false);
    }
  };

  const showNextStopPrompt = async (updatedRoute, receiptDocument = null, routeCloseoutDocument = null) => {
    const stops = Array.isArray(updatedRoute?.stops) ? updatedRoute.stops : [];
    const currentIndex = stops.findIndex((stop) => stop.id === stopId);
    const nextStop = stops.slice(currentIndex >= 0 ? currentIndex + 1 : 0).find((stop) => !isFinished(stop));
    if (!nextStop) {
      let closeoutDocument = routeCloseoutDocument;
      if (!closeoutDocument && updatedRoute?.id) {
        try {
          closeoutDocument = await fetchRouteCloseoutDocument(updatedRoute.id, { driverId, driverName });
        } catch {
          // The stop receipt remains printable even if closeout retrieval is temporarily unavailable.
        }
      }
      Alert.alert(
        'Route complete',
        'All assigned stops are complete. Print the route turn-in receipt with all transactions and inventory totals.',
        [
          closeoutDocument
            ? {
                text: 'Print Turn-In Receipt',
                onPress: () => printRouteCloseout(closeoutDocument),
              }
            : null,
          receiptDocument
            ? {
                text: 'Last Stop Receipt',
                onPress: () => printDocument('receipt', receiptDocument),
              }
            : null,
          {
            text: 'Route Manifest',
            onPress: () => navigation.replace('TodayRoute', { driverId, driverName }),
          },
        ].filter(Boolean)
      );
      return;
    }
    Alert.alert(
      'Delivery recorded',
      `${nextStop.accountName || nextStop.destinationAddress}\n${buildStopAddress(nextStop)}`,
      [
        receiptDocument
          ? {
              text: 'Print Receipt',
              onPress: () => printDocument('receipt', receiptDocument),
            }
          : null,
        {
          text: 'Route Manifest',
          style: 'cancel',
          onPress: () => navigation.replace('TodayRoute', { driverId, driverName }),
        },
        {
          text: 'Start Next Stop',
          onPress: () => startNextStop(nextStop),
        },
      ].filter(Boolean)
    );
  };

  const saveSettlement = async (status) => {
    if (status === 'completed' && totals.unaccounted > 0) {
      Alert.alert(
        'Product is not accounted for',
        `${totals.unaccounted} unit(s) still need a delivered, rejected, damaged, returned, or missing disposition.`
      );
      return;
    }
    if (status === 'completed' && !paymentMethod) {
      Alert.alert('Payment record required', 'Select how this delivery was paid or mark it unpaid.');
      return;
    }
    if (
      status === 'completed'
      && ['cash', 'check', 'card'].includes(paymentMethod)
      && Math.abs(numberValue(amountPaid) - finalTotal) > 0.01
    ) {
      Alert.alert(
        'Full payment required',
        'Cash, check, and card payments must equal the final total. Select Partial Payment when a balance remains.'
      );
      return;
    }
    if (
      status === 'completed'
      && paymentMethod === 'partial_payment'
      && (numberValue(amountPaid) <= 0 || numberValue(amountPaid) >= finalTotal)
    ) {
      Alert.alert(
        'Partial payment amount required',
        'Enter an amount greater than zero and less than the final total.'
      );
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const result = await saveStopDeliverySettlement(
        stopId,
        buildPayload(status),
        { driverId, driverName }
      );
      setDelivery(result);
      if (status === 'completed') {
        if (result.queued) {
          const statusResult = await updateAssignedRouteStopStatus(stopId, {
            status: requestedNonDeliveryReason ? 'undelivered' : 'completed',
            routeDate,
            nonDeliveryReason: requestedNonDeliveryReason,
            driverNotes: notes,
          }, { driverId, driverName });
          const offlineRoute = statusResult?.route || null;
          const offlineRouteFinished = Array.isArray(offlineRoute?.stops)
            && offlineRoute.stops.length > 0
            && offlineRoute.stops.every(isFinished);
          let offlineCloseout = null;
          if (offlineRouteFinished) {
            const cachedDeliveries = await Promise.all(
              offlineRoute.stops.map((routeStop) => (
                routeStop.id === stopId
                  ? Promise.resolve(currentDocumentDelivery())
                  : readCachedStopDelivery(routeStop.id, driverId)
              ))
            );
            offlineCloseout = buildLocalRouteCloseoutDocument(
              offlineRoute,
              cachedDeliveries.filter(Boolean),
              { driverId, driverName }
            );
          }
          Alert.alert(
            offlineRouteFinished ? 'Route completed offline' : 'Saved offline',
            offlineRouteFinished
              ? 'All transactions are stored on this phone. Print the route turn-in receipt now; the backend copy will be created when service returns.'
              : 'The transaction, receipt, and stop completion are stored on this phone and will synchronize when service returns.',
            [
              offlineCloseout
                ? {
                    text: 'Print Turn-In Receipt',
                    onPress: () => printRouteCloseout(offlineCloseout),
                  }
                : null,
              {
                text: 'Print Receipt',
                onPress: () => printDocument('receipt', {
                  documentNumber: `RCPT-OFFLINE-${Date.now()}`,
                  payload: buildLocalDeliveryDocument(
                    currentDocumentDelivery(),
                    { driverId, driverName },
                    'receipt'
                  ),
                }),
              },
              {
                text: 'Route Manifest',
                onPress: () => navigation.replace('TodayRoute', { driverId, driverName }),
              },
            ].filter(Boolean)
          );
        } else {
          const documents = await fetchStopDeliveryDocuments(stopId, { driverId, driverName });
          const receipt = documents.find((document) => document.documentType === 'receipt') || null;
          setSavedDocuments(documents);
          await showNextStopPrompt(result?.route, receipt, result?.routeCloseout || null);
        }
      } else {
        Alert.alert('Draft saved', 'The delivery settlement has been saved without closing the stop.');
      }
    } catch (saveError) {
      setError(saveError.message || 'Unable to save the delivery settlement.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#67e8f9" />
          <Text style={styles.loadingText}>Loading delivery products...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stop = delivery?.stop;
  const settlementComplete = delivery?.settlement?.status === 'completed';
  const driverReceiptWindowOpen = isDriverReceiptWindowOpen(
    delivery?.settlement?.completedAt || delivery?.stop?.actualCompletedAt
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>{'< Back'}</Text>
          </Pressable>
          <Text style={styles.headerKicker}>Delivery Settlement</Text>
        </View>

        <Text style={styles.accountName}>{stop?.accountName || 'Delivery account'}</Text>
        <Text style={styles.address}>{buildStopAddress(stop)}</Text>
        {!!stop?.accountNumber && <Text style={styles.accountNumber}>Account {stop.accountNumber}</Text>}
        <View style={styles.utilityRow}>
          <Pressable onPress={openDeliveryNotes} style={styles.notesButton}>
            <Text style={styles.notesButtonText}>Account Notes & Photos</Text>
          </Pressable>
        </View>
        <AccountKnowledgePanel
          accountNumber={stop?.accountNumber}
          destination={buildStopAddress(stop)}
          driverId={driverId}
          driverName={driverName}
          onOpen={openDeliveryNotes}
        />
        <Pressable
          onPress={() => printDocument('delivery_order')}
          disabled={isPrinting}
          style={styles.orderPrintButton}
        >
          <Text style={styles.orderPrintButtonText}>
            {isPrinting ? 'Sending to Printer...' : 'Print Itemized Delivery Order'}
          </Text>
        </Pressable>

        {!!requestedNonDeliveryReason && (
          <View style={styles.noDeliveryBanner}>
            <Text style={styles.noDeliveryTitle}>No-delivery inventory return</Text>
            <Text style={styles.noDeliveryText}>
              Product is preassigned to rejected or returned. Review every item before completing.
            </Text>
          </View>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.totalBand}>
          <View>
            <Text style={styles.totalLabel}>Planned</Text>
            <Text style={styles.totalValue}>{money(totals.plannedAmount)}</Text>
          </View>
          <View style={styles.totalRight}>
            <Text style={styles.totalLabel}>Final total</Text>
            <Text style={styles.finalValue}>{money(finalTotal)}</Text>
          </View>
        </View>

        <View style={styles.inventoryBand}>
          <Text style={styles.inventoryText}>{totals.planned} loaded</Text>
          <Text style={styles.inventoryText}>{totals.delivered + totals.added} sold</Text>
          <Text style={[styles.inventoryText, totals.unaccounted > 0 && styles.inventoryWarning]}>
            {totals.unaccounted} unaccounted
          </Text>
        </View>

        <View style={styles.itemReviewCard}>
          <View style={styles.itemReviewHeader}>
            <View style={styles.itemReviewTitleWrap}>
              <Text style={styles.itemReviewTitle}>Itemized customer order</Text>
              <Text style={styles.itemReviewText}>
                Review every product ID and ordered quantity with the customer before completing the transaction.
              </Text>
            </View>
            <Pressable
              onPress={() => printDocument('delivery_order')}
              disabled={isPrinting}
              style={styles.itemReviewPrintButton}
            >
              <Text style={styles.itemReviewPrintText}>{isPrinting ? 'Printing...' : 'Print List'}</Text>
            </Pressable>
          </View>
          <TextInput
            value={productSearch}
            onChangeText={setProductSearch}
            placeholder="Find product by product ID / item number"
            placeholderTextColor="#6f8798"
            autoCapitalize="characters"
            style={styles.productSearchInput}
          />
          <Text style={styles.itemReviewCount}>
            {visibleItems.length} of {items.length} product line(s) shown
          </Text>
        </View>

        {visibleItems.map(({ item, index }) => {
          const isAdded = !item.orderItemId && numberValue(item.plannedQuantity) === 0;
          const itemProductId = productId(item);
          return (
            <View key={item.id || `${item.productName}-${index}`} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleWrap}>
                  <Text style={styles.itemId}>Product ID {itemProductId || 'Not provided'}</Text>
                  <Text style={styles.itemName}>{item.productName || itemProductId || 'Product'}</Text>
                  <Text style={styles.itemMeta}>
                    {[item.brand, item.packageSize, `${money(item.unitPrice)} each`].filter(Boolean).join(' | ')}
                  </Text>
                </View>
                {isAdded && (
                  <Pressable onPress={() => removeAddedProduct(index)} style={styles.removeButton}>
                    <Text style={styles.removeButtonText}>Remove</Text>
                  </Pressable>
                )}
              </View>

              <View style={styles.quantityHeadline}>
                <Text style={styles.quantityLabel}>{isAdded ? 'Added' : 'Ordered'}</Text>
                <Text style={styles.quantityValue}>
                  {isAdded ? item.addedQuantity : item.plannedQuantity}
                </Text>
                <Text style={styles.lineAmount}>
                  {money((numberValue(item.deliveredQuantity) + numberValue(item.addedQuantity)) * numberValue(item.unitPrice))}
                </Text>
              </View>

              {!isAdded && (
                <>
                  <View style={styles.deliveredRow}>
                    <Text style={styles.deliveredLabel}>Delivered</Text>
                    <Text style={styles.deliveredValue}>{item.deliveredQuantity}</Text>
                  </View>
                  {EXCEPTION_FIELDS.map((field) => (
                    <View key={field.key} style={styles.stepperRow}>
                      <Text style={[styles.stepperLabel, { color: field.color }]}>{field.label}</Text>
                      <View style={styles.stepperControls}>
                        <Pressable
                          onPress={() => updateExceptionQuantity(index, field.key, -1)}
                          style={styles.stepperButton}
                        >
                          <Text style={styles.stepperButtonText}>-</Text>
                        </Pressable>
                        <Text style={styles.stepperValue}>{numberValue(item[field.key])}</Text>
                        <Pressable
                          onPress={() => updateExceptionQuantity(index, field.key, 1)}
                          disabled={numberValue(item.deliveredQuantity) <= 0}
                          style={[
                            styles.stepperButton,
                            numberValue(item.deliveredQuantity) <= 0 && styles.stepperButtonDisabled,
                          ]}
                        >
                          <Text style={styles.stepperButtonText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </View>
          );
        })}

        {!settlementComplete && !requestedNonDeliveryReason && (
          <View style={styles.addCard}>
            <Text style={styles.addTitle}>Add barcode-verified product</Text>
            <Text style={styles.addHelp}>
              Scan once. The item must be in this route's truck inventory before it can be added to the customer delivery.
            </Text>
            <Pressable onPress={() => setScannerVisible(true)} style={styles.scanButton}>
              <Text style={styles.scanButtonText}>{newProduct.barcode ? 'Scan Different Product' : 'Scan Product Barcode'}</Text>
            </Pressable>
            {!!newProduct.barcode && (
              <View style={styles.scannedProduct}>
                <Text style={styles.scannedProductName}>{newProduct.productName}</Text>
                <Text style={styles.scannedProductMeta}>SKU {newProduct.sku} | Barcode {newProduct.barcode}</Text>
                <Text style={styles.scannedProductAvailable}>
                  {numberValue(truckInventory.find((item) => item.sku === newProduct.sku)?.availableQuantity)} available on truck
                </Text>
              </View>
            )}
            {!!newProduct.barcode && (
              <View style={styles.truckInventoryBox}>
                <Text style={styles.truckInventoryTitle}>1. Add scanned stock to truck inventory</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    value={newProduct.truckQuantity}
                    onChangeText={(value) => setNewProduct((current) => ({ ...current, truckQuantity: value }))}
                    placeholder="Truck quantity"
                    placeholderTextColor="#6f8798"
                    keyboardType="decimal-pad"
                    style={[styles.input, styles.halfInput]}
                  />
                  <TextInput
                    value={newProduct.truckReason}
                    onChangeText={(value) => setNewProduct((current) => ({ ...current, truckReason: value }))}
                    placeholder="Source / reason"
                    placeholderTextColor="#6f8798"
                    style={[styles.input, styles.halfInput]}
                  />
                </View>
                <Pressable onPress={addScannedProductToTruck} disabled={isInventorySaving} style={styles.truckAddButton}>
                  <Text style={styles.addButtonText}>{isInventorySaving ? 'Saving...' : 'Add to Truck Inventory'}</Text>
                </Pressable>
              </View>
            )}
            <Text style={styles.truckInventoryTitle}>2. Transfer available quantity to this customer</Text>
            <View style={styles.inputRow}>
              <TextInput
                value={newProduct.quantity}
                onChangeText={(value) => setNewProduct((current) => ({ ...current, quantity: value }))}
                placeholder="Quantity"
                placeholderTextColor="#6f8798"
                keyboardType="decimal-pad"
                style={[styles.input, styles.halfInput]}
              />
              <View style={[styles.input, styles.halfInput]}><Text style={styles.readOnlyPrice}>{money(newProduct.unitPrice)} each</Text></View>
            </View>
            <TextInput
              value={newProduct.reason}
              onChangeText={(value) => setNewProduct((current) => ({ ...current, reason: value }))}
              placeholder="Customer addition reason"
              placeholderTextColor="#6f8798"
              style={styles.input}
            />
            <Pressable onPress={addProduct} style={styles.addButton}>
              <Text style={styles.addButtonText}>Add to Customer Delivery</Text>
            </Pressable>
          </View>
        )}

        <ProductBarcodeScannerModal
          visible={scannerVisible}
          onClose={() => setScannerVisible(false)}
          onScanned={handleProductScan}
        />

        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Delivery notes or product exception details"
          placeholderTextColor="#6f8798"
          multiline
          style={[styles.input, styles.notesInput]}
        />

        <View style={styles.paymentCard}>
          <Text style={styles.paymentTitle}>Payment and Receipt</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={taxAmount}
              onChangeText={setTaxAmount}
              placeholder="Tax"
              placeholderTextColor="#6f8798"
              keyboardType="decimal-pad"
              style={[styles.input, styles.halfInput]}
            />
            <TextInput
              value={amountPaid}
              onChangeText={setAmountPaid}
              placeholder="Amount paid"
              placeholderTextColor="#6f8798"
              keyboardType="decimal-pad"
              style={[styles.input, styles.halfInput]}
            />
          </View>
          <View style={styles.paymentMethodGrid}>
            {PAYMENT_METHODS.map((method) => (
              <Pressable
                key={method.key}
                onPress={() => {
                  setPaymentMethod(method.key);
                  if (['cash', 'check', 'card'].includes(method.key)) {
                    setAmountPaid(String(finalTotal.toFixed(2)));
                  } else if (method.key === 'credit_account' || method.key === 'unpaid') {
                    setAmountPaid('0.00');
                  }
                }}
                style={[
                  styles.paymentMethodButton,
                  paymentMethod === method.key && styles.paymentMethodButtonSelected,
                ]}
              >
                <Text style={[
                  styles.paymentMethodText,
                  paymentMethod === method.key && styles.paymentMethodTextSelected,
                ]}>
                  {method.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.balanceText}>
            Unpaid balance: {money(
              paymentMethod === 'credit_account'
                ? 0
                : Math.max(0, finalTotal - numberValue(amountPaid))
            )}
          </Text>
          <View style={styles.signatureRow}>
            <Pressable
              onPress={() => setSignatureTarget('customer')}
              style={[styles.signatureButton, customerSignature && styles.signatureButtonSaved]}
            >
              <Text style={styles.signatureButtonText}>
                {customerSignature ? 'Customer Signature Saved' : 'Customer Signature (Optional)'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSignatureTarget('driver')}
              style={[styles.signatureButton, driverSignature && styles.signatureButtonSaved]}
            >
              <Text style={styles.signatureButtonText}>
                {driverSignature ? 'Driver Signature Saved' : 'Driver Signature (Optional)'}
              </Text>
            </Pressable>
          </View>
        </View>

        {!settlementComplete && (
          <View style={styles.footerActions}>
            <Pressable
              onPress={() => saveSettlement('draft')}
              disabled={isSaving}
              style={styles.draftButton}
            >
              <Text style={styles.draftButtonText}>Save Draft</Text>
            </Pressable>
            <Pressable
              onPress={() => saveSettlement('completed')}
              disabled={isSaving || totals.unaccounted > 0}
              style={[
                styles.completeButton,
                (isSaving || totals.unaccounted > 0) && styles.completeButtonDisabled,
              ]}
            >
              <Text style={styles.completeButtonText}>
                {isSaving
                  ? 'Saving...'
                  : requestedNonDeliveryReason
                    ? 'Complete No Delivery'
                    : 'Complete Delivery'}
              </Text>
            </Pressable>
          </View>
        )}

        {settlementComplete && (
          <View style={styles.receiptCard}>
            <Text style={styles.paymentTitle}>Saved Documents</Text>
            {driverReceiptWindowOpen ? (
              <Pressable
                onPress={() => printDocument('receipt')}
                disabled={isPrinting}
                style={styles.receiptPrintButton}
              >
                <Text style={styles.receiptPrintButtonText}>Print Final Receipt</Text>
              </Pressable>
            ) : (
              <Text style={styles.retentionText}>
                The 24-hour driver reprint window has ended. A supervisor can reprint this
                receipt during the remaining 14-day retention period.
              </Text>
            )}
            {savedDocuments.map((document) => (
              <Pressable
                key={document.id || document.documentNumber}
                onPress={() => printDocument(document.documentType, document)}
                style={styles.reprintButton}
              >
                <Text style={styles.reprintButtonText}>
                  Reprint {document.documentType === 'receipt' ? 'Receipt' : 'Delivery Order'}
                </Text>
                <Text style={styles.reprintMeta}>{document.documentNumber}</Text>
              </Pressable>
            ))}
            <Text style={styles.retentionText}>
              Drivers can reprint receipts for 24 hours. Supervisors retain them for 14 days.
            </Text>
          </View>
        )}
      </ScrollView>
      <SignatureCaptureModal
        visible={Boolean(signatureTarget)}
        title={signatureTarget === 'customer' ? 'Customer Signature' : 'Driver Signature'}
        onCancel={() => setSignatureTarget(null)}
        onSave={(signature) => {
          if (signatureTarget === 'customer') setCustomerSignature(signature);
          if (signatureTarget === 'driver') setDriverSignature(signature);
          setSignatureTarget(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07131f' },
  content: { padding: 16, paddingBottom: 42 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#d7e8f2', fontSize: 16, fontWeight: '700' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  backButton: { paddingVertical: 9, paddingHorizontal: 13, backgroundColor: '#173145', borderRadius: 6 },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  headerKicker: { color: '#67e8f9', fontSize: 15, fontWeight: '900', textTransform: 'uppercase' },
  accountName: { color: '#fff', fontSize: 28, fontWeight: '900' },
  address: { color: '#b9cedb', fontSize: 15, lineHeight: 21, marginTop: 4 },
  accountNumber: { color: '#67e8f9', fontWeight: '800', marginTop: 4 },
  utilityRow: { flexDirection: 'row', gap: 9, marginTop: 14 },
  notesButton: { flex: 1, padding: 11, alignItems: 'center', backgroundColor: '#185a6b' },
  notesButtonText: { color: '#fff', fontWeight: '900', textAlign: 'center' },
  printerButton: { flex: 1, padding: 11, alignItems: 'center', backgroundColor: '#29485f' },
  printerButtonText: { color: '#fff', fontWeight: '900', textAlign: 'center' },
  orderPrintButton: { marginTop: 9, padding: 12, alignItems: 'center', backgroundColor: '#d8a329' },
  orderPrintButtonText: { color: '#101820', fontWeight: '900', fontSize: 16 },
  noDeliveryBanner: { backgroundColor: '#3a2024', padding: 14, borderLeftWidth: 5, borderLeftColor: '#ff6b6b', marginTop: 16 },
  noDeliveryTitle: { color: '#fff', fontWeight: '900', fontSize: 17 },
  noDeliveryText: { color: '#ffd6d6', marginTop: 5, lineHeight: 20 },
  errorText: { color: '#ffd0d0', backgroundColor: '#4a1f25', padding: 12, marginTop: 14, fontWeight: '700' },
  totalBand: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#28465a' },
  totalRight: { alignItems: 'flex-end' },
  totalLabel: { color: '#9bb5c5', fontSize: 13, fontWeight: '800', textTransform: 'uppercase' },
  totalValue: { color: '#dceaf2', fontSize: 25, fontWeight: '900', marginTop: 4 },
  finalValue: { color: '#72f6b3', fontSize: 28, fontWeight: '900', marginTop: 4 },
  inventoryBand: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  inventoryText: { color: '#b9cedb', fontWeight: '800' },
  inventoryWarning: { color: '#ff8f8f' },
  itemReviewCard: {
    backgroundColor: '#0f2c38',
    padding: 15,
    marginBottom: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#67e8f9',
  },
  itemReviewHeader: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  itemReviewTitleWrap: { flex: 1 },
  itemReviewTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  itemReviewText: { color: '#b9cedb', marginTop: 5, lineHeight: 19, fontWeight: '700' },
  itemReviewPrintButton: {
    paddingVertical: 10,
    paddingHorizontal: 13,
    backgroundColor: '#d8a329',
    borderRadius: 6,
  },
  itemReviewPrintText: { color: '#101820', fontWeight: '900' },
  productSearchInput: {
    backgroundColor: '#eaf1f5',
    color: '#07131f',
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginTop: 12,
    borderRadius: 6,
    fontSize: 16,
    fontWeight: '800',
  },
  itemReviewCount: { color: '#67e8f9', marginTop: 9, fontWeight: '900' },
  itemCard: { backgroundColor: '#102536', padding: 15, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#2cc7d9' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  itemTitleWrap: { flex: 1, paddingRight: 8 },
  itemId: { color: '#67e8f9', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', marginBottom: 4 },
  itemName: { color: '#fff', fontSize: 19, fontWeight: '900' },
  itemMeta: { color: '#91aebe', marginTop: 3 },
  removeButton: { padding: 7, backgroundColor: '#55252a', borderRadius: 4 },
  removeButtonText: { color: '#ffb0b0', fontWeight: '900' },
  quantityHeadline: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: '#28465a' },
  quantityLabel: { color: '#9bb5c5', fontWeight: '800' },
  quantityValue: { color: '#fff', fontSize: 22, fontWeight: '900' },
  lineAmount: { marginLeft: 'auto', color: '#72f6b3', fontSize: 18, fontWeight: '900' },
  deliveredRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 },
  deliveredLabel: { color: '#72f6b3', fontWeight: '900', fontSize: 16 },
  deliveredValue: { color: '#fff', fontWeight: '900', fontSize: 18 },
  stepperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  stepperLabel: { fontWeight: '900', fontSize: 15 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#24465c', borderRadius: 4 },
  stepperButtonDisabled: { opacity: 0.35 },
  stepperButtonText: { color: '#fff', fontSize: 24, fontWeight: '900', lineHeight: 27 },
  stepperValue: { width: 34, textAlign: 'center', color: '#fff', fontSize: 17, fontWeight: '900' },
  addCard: { backgroundColor: '#132b26', padding: 15, marginTop: 4, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: '#72f6b3' },
  addTitle: { color: '#fff', fontSize: 19, fontWeight: '900' },
  addHelp: { color: '#a8cfc0', marginTop: 4, marginBottom: 10, lineHeight: 19 },
  scanButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: '#087f8c', marginBottom: 10 },
  scanButtonText: { color: '#ffffff', fontWeight: '900' },
  scannedProduct: { padding: 12, backgroundColor: '#0d2230', borderLeftWidth: 4, borderLeftColor: '#67e8f9', marginBottom: 10 },
  scannedProductName: { color: '#ffffff', fontSize: 17, fontWeight: '900' },
  scannedProductMeta: { color: '#aac0cc', marginTop: 4, fontSize: 12 },
  scannedProductAvailable: { color: '#7dffb0', marginTop: 6, fontWeight: '900' },
  truckInventoryBox: { paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#315043', marginBottom: 12 },
  truckInventoryTitle: { color: '#dceaf2', fontWeight: '900', marginTop: 8 },
  truckAddButton: { alignSelf: 'flex-start', backgroundColor: '#087f8c', paddingVertical: 10, paddingHorizontal: 17, marginTop: 10 },
  readOnlyPrice: { color: '#07131f', fontWeight: '900', paddingVertical: 2 },
  input: { backgroundColor: '#eaf1f5', color: '#07131f', paddingHorizontal: 12, paddingVertical: 11, marginTop: 9, borderRadius: 4, fontSize: 16 },
  inputRow: { flexDirection: 'row', gap: 9 },
  halfInput: { flex: 1 },
  notesInput: { minHeight: 88, textAlignVertical: 'top', marginBottom: 14 },
  paymentCard: { backgroundColor: '#102536', padding: 15, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: '#d8a329' },
  paymentTitle: { color: '#fff', fontSize: 19, fontWeight: '900' },
  paymentMethodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  paymentMethodButton: { width: '48%', paddingVertical: 11, paddingHorizontal: 8, backgroundColor: '#24465c', alignItems: 'center' },
  paymentMethodButtonSelected: { backgroundColor: '#d8a329' },
  paymentMethodText: { color: '#dceaf2', fontWeight: '900', textAlign: 'center' },
  paymentMethodTextSelected: { color: '#101820' },
  balanceText: { color: '#72f6b3', fontSize: 17, fontWeight: '900', marginTop: 13 },
  signatureRow: { gap: 8, marginTop: 13 },
  signatureButton: { padding: 12, backgroundColor: '#25465b', alignItems: 'center' },
  signatureButtonSaved: { backgroundColor: '#16734f' },
  signatureButtonText: { color: '#fff', fontWeight: '900' },
  addButton: { alignSelf: 'flex-start', backgroundColor: '#1ca86e', paddingVertical: 10, paddingHorizontal: 17, marginTop: 11, borderRadius: 4 },
  addButtonText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  footerActions: { flexDirection: 'row', gap: 10 },
  draftButton: { flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: '#25465b', borderRadius: 5 },
  draftButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  completeButton: { flex: 1.4, paddingVertical: 14, alignItems: 'center', backgroundColor: '#d92632', borderRadius: 5 },
  completeButtonDisabled: { opacity: 0.45 },
  completeButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  receiptCard: { backgroundColor: '#132b26', padding: 15, marginTop: 14, borderLeftWidth: 4, borderLeftColor: '#72f6b3' },
  receiptPrintButton: { backgroundColor: '#1ca86e', alignItems: 'center', padding: 13, marginTop: 12 },
  receiptPrintButtonText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  reprintButton: { backgroundColor: '#25465b', padding: 11, marginTop: 9 },
  reprintButtonText: { color: '#fff', fontWeight: '900' },
  reprintMeta: { color: '#9bb5c5', marginTop: 3 },
  retentionText: { color: '#9bb5c5', marginTop: 11, fontStyle: 'italic' },
});
