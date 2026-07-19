import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { createNavigationContainerRef, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LandingScreen from '../screens/LandingScreen';
import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import DeliveryNotesScreen from '../screens/DeliveryNotesScreen';
import TodayRouteScreen from '../screens/TodayRouteScreen';
import DeliverySettlementScreen from '../screens/DeliverySettlementScreen';
import FinalInventoryCloseoutScreen from '../screens/FinalInventoryCloseoutScreen';
import RouteInventoryScreen from '../screens/RouteInventoryScreen';
import HazardReportScreen from '../screens/HazardReportScreen';
import WarehouseInventoryScreen from '../screens/WarehouseInventoryScreen';
import DriverSettingsOverlay from '../components/DriverSettingsOverlay';
import { recoverPendingCameraDraft } from '../services/mobileMediaSelection';
import { readLatestPhotoDraft } from '../services/photoDraftStore';
import { initializeDriverSession } from '../services/driverSession';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

export default function RootNavigator() {
  const [activeScreen, setActiveScreen] = useState('Landing');
  const [sessionBootstrapState, setSessionBootstrapState] = useState('restoring');
  const updateActiveScreen = () => {
    setActiveScreen(navigationRef.getCurrentRoute()?.name || 'Landing');
  };
  const restoreCanonicalSession = useCallback(async () => {
    try {
      await initializeDriverSession();
      setSessionBootstrapState('ready');
    } catch {
      setSessionBootstrapState('ready');
    }
  }, []);

  const resumePhotoWorkflow = useCallback(async () => {
    if (!navigationRef.isReady()) return;
    await initializeDriverSession().catch(() => null);
    const recovered = await recoverPendingCameraDraft().catch(() => null);
    const draft = recovered || await readLatestPhotoDraft().catch(() => null);
    if (!draft?.workflow || !draft?.photos?.length || !draft?.context?.routeParams) return;

    if (draft.workflow === 'delivery-notes') {
      navigationRef.reset({
        index: 1,
        routes: [
          { name: 'Home' },
          {
            name: 'DeliveryNotes',
            params: {
              ...draft.context.routeParams,
              restoredPhotoDraft: true,
            },
          },
        ],
      });
    } else if (draft.workflow === 'hazard-report') {
      navigationRef.reset({
        index: 1,
        routes: [
          { name: 'Home' },
          {
            name: 'HazardReport',
            params: {
              ...draft.context.routeParams,
              restoredPhotoDraft: true,
            },
          },
        ],
      });
    }
  }, []);

  useEffect(() => {
    restoreCanonicalSession();
  }, [restoreCanonicalSession]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        restoreCanonicalSession().then(resumePhotoWorkflow);
      }
    });
    return () => subscription.remove();
  }, [restoreCanonicalSession, resumePhotoWorkflow]);

  if (sessionBootstrapState === 'restoring') {
    return (
      <View style={styles.restoreRoot}>
        <ActivityIndicator color="#ffffff" />
        <Text style={styles.restoreText}>Restoring driver session...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} onReady={() => { updateActiveScreen(); resumePhotoWorkflow(); }} onStateChange={updateActiveScreen}>
      <Stack.Navigator initialRouteName="Landing" screenOptions={{ headerTitleAlign: 'center' }}>
        <Stack.Screen
          name="Landing"
          component={LandingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Map"
          component={MapScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DeliveryNotes"
          component={DeliveryNotesScreen}
          options={{
            title: 'Delivery Notes',
            headerStyle: { backgroundColor: '#93bedb' },
            headerTintColor: '#102033',
            headerTitleStyle: { fontWeight: '900' },
          }}
        />
        <Stack.Screen
          name="TodayRoute"
          component={TodayRouteScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DeliverySettlement"
          component={DeliverySettlementScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="RouteInventory"
          component={RouteInventoryScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="FinalInventoryCloseout"
          component={FinalInventoryCloseoutScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="HazardReport"
          component={HazardReportScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="WarehouseInventory"
          component={WarehouseInventoryScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
      <DriverSettingsOverlay
        navigationRef={navigationRef}
        visible={activeScreen !== 'Landing'}
        screenKey={activeScreen}
      />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  restoreRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#102033',
  },
  restoreText: {
    marginTop: 12,
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
