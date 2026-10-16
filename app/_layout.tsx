import React, { useEffect } from 'react';
import { View, StyleSheet, Platform, StatusBar } from 'react-native';
import { Stack } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useGameStore } from '../src/store/gameStore';

export default function RootLayout() {
  const loadStoredData = useGameStore((state) => state.loadStoredData);

  useEffect(() => {
    // Lock orientation to Landscape on mobile devices
    async function lockLandscape() {
      try {
        if (Platform.OS !== 'web') {
          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.LANDSCAPE
          );
        }
      } catch (err) {
        console.warn('Orientation lock error:', err);
      }
    }

    lockLandscape();
    loadStoredData();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#070A0F' },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="lobby" />
        <Stack.Screen name="drive" />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070A0F',
  },
});
