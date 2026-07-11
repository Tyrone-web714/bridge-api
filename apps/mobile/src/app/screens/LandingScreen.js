import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LANDING_AUTO_ADVANCE_MS = 2400;
const LANDING_FADE_MS = 520;

export default function LandingScreen({ navigation }) {
  const screenOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: LANDING_FADE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          navigation.replace('Home');
        }
      });
    }, LANDING_AUTO_ADVANCE_MS);

    return () => clearTimeout(timer);
  }, [navigation, screenOpacity]);

  return (
    <Animated.View style={[styles.animatedRoot, { opacity: screenOpacity }]}>
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoLockup}>
          <Text style={styles.safeText}>Truck-Safe Routing</Text>
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.headline}>Driver route safety</Text>
          <Text style={styles.subcopy}>
            Low-clearance, restricted-zone, and truck-profile aware navigation for daily delivery routes.
          </Text>
        </View>
      </View>
    </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#b5121b',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    justifyContent: 'space-between',
  },
  logoLockup: {
    alignItems: 'center',
  },
  safeText: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  copyBlock: {
    alignItems: 'center',
  },
  headline: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  subcopy: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 21,
    color: '#ffe6e8',
    textAlign: 'center',
  },
});
