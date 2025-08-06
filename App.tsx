import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import ESP32Scanner from './hooks/ESP32Scanner';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <ESP32Scanner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#ffffffff',
  },
});
