// App.tsx
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import ESP32Scanner from './hooks/ESP32Scanner';

export default function App() {
  const [appKey, setAppKey] = useState(0);

  const handleRestart = () => {
    // cambiar la key desmonta y vuelve a montar toda la app
    setAppKey(prev => prev + 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header con botón de reinicio */}
      <View style={styles.header}>
        <Text style={styles.title}>Control ESP32</Text>
        <TouchableOpacity style={styles.restartBtn} onPress={handleRestart}>
          <Text style={styles.restartText}>Reiniciar App</Text>
        </TouchableOpacity>
      </View>

      {/* Todo el contenido de la app se reinicia al cambiar la key */}
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
});
