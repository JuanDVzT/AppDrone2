// App.tsx
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import ESP32Scanner from './hooks/ESP32Scanner';
import { getTestMode, setTestMode } from './hooks/ESP32Simulator';

export default function App() {
  const [appKey, setAppKey] = useState(0);
  const [testMode, setTestModeState] = useState(getTestMode());

  const handleRestart = () => {
    setAppKey(prev => prev + 1);
  };

  const toggleTestMode = () => {
    const newValue = !testMode;
    setTestMode(newValue);
    setTestModeState(newValue);
    // Reiniciar la app al cambiar modo
    setAppKey(prev => prev + 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Control ESP32</Text>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            style={[styles.testBtn, { backgroundColor: testMode ? '#22c55e' : '#9ca3af' }]}
            onPress={toggleTestMode}
          >
            <Text style={styles.restartText}>Test</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.restartBtn} onPress={handleRestart}>
            <Text style={styles.restartText}>Reiniciar App</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View key={appKey} style={{ flex: 1 }}>
        <ESP32Scanner />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#3b82f6',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  restartBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  restartText: {
    color: '#fff',
    fontWeight: '700',
  },
  testBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
});
