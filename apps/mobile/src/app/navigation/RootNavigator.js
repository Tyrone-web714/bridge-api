import React, { useState } from 'react';
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

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

export default function RootNavigator() {
  const [activeScreen, setActiveScreen] = useState('Landing');
  const updateActiveScreen = () => {
    setActiveScreen(navigationRef.getCurrentRoute()?.name || 'Landing');
  };

  return (
    <NavigationContainer ref={navigationRef} onReady={updateActiveScreen} onStateChange={updateActiveScreen}>
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
