import React, { useEffect } from 'react';
import { AppState, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/app/navigation/RootNavigator';
import {
  flushPendingDeliveryOperations,
  flushPendingStopStatusUpdates,
} from './src/app/services/routeManifestApi';
import { flushPendingDeliveryNoteOperations } from './src/app/services/deliveryNotesApi';

const STOP_SYNC_INTERVAL_MS = 30000;

export default function App() {
  useEffect(() => {
    const syncPendingStops = async () => {
      try {
        await flushPendingDeliveryOperations();
        await flushPendingDeliveryNoteOperations();
        await flushPendingStopStatusUpdates();
      } catch {
        // The durable queue remains intact and will be retried on the next activity cycle.
      }
    };

    syncPendingStops();
    const intervalId = setInterval(syncPendingStops, STOP_SYNC_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') syncPendingStops();
    });

    return () => {
      clearInterval(intervalId);
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
