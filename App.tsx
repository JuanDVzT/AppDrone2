// App.tsx - VERSIÓN MEJORADA Y MODERNA
import React, { useState } from 'react';
import { 
  SafeAreaView, 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView,
  StatusBar
} from 'react-native';
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

    setAppKey(prev => prev + 1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#4f46e5" 
        translucent={false}
      />
      
      {/* Header Mejorado */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.titleSection}>
            <Text style={styles.title}>🚁 Control Dron ESP32</Text>
          </View>

          <View style={styles.controlsSection}>
            <TouchableOpacity
              style={[
                styles.controlButton,
                styles.testButton,
                { 
                  backgroundColor: testMode ? '#22c55e' : '#6b7280',
                }
              ]}
              onPress={toggleTestMode}
            >
              <Text style={styles.buttonIcon}>
                {testMode ? '🧪' : '⚡'}
              </Text>
              <Text style={styles.buttonText}>
                {testMode ? 'Test' : 'Real'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.controlButton,
                styles.restartButton
              ]} 
              onPress={handleRestart}
            >
              <Text style={styles.buttonIcon}>🔄</Text>
              <Text style={styles.buttonText}>Reiniciar</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Status Bar */}
        <View style={styles.statusBar}>
          <View style={styles.statusIndicator}>
            <View 
              style={[
                styles.statusDot,
                { backgroundColor: testMode ? '#f59e0b' : '#22c55e' }
              ]} 
            />
            <Text style={styles.statusText}>
              {testMode ? 'Modo Simulación' : 'Activo'}
            </Text>
          </View>
          <Text style={styles.version}>v2.0.1</Text>
        </View>
      </View>

      {/* Contenido Principal */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentCard}>
          <View key={appKey} style={styles.scannerContainer}>
            <ESP32Scanner />
          </View>
        </View>
        
        {/* Footer Informativo */}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>💡 Información del Sistema</Text>
          <View style={styles.footerGrid}>
            <View style={styles.footerItem}>
              <Text style={styles.footerIcon}>📡</Text>
              <Text style={styles.footerText}>Escaneo UDP</Text>
              <Text style={styles.footerSubtext}></Text>
            </View>
            <View style={styles.footerItem}>
              <Text style={styles.footerIcon}>🔗</Text>
              <Text style={styles.footerText}>WebSocket</Text>
              <Text style={styles.footerSubtext}></Text>
            </View>
            <View style={styles.footerItem}>
              <Text style={styles.footerIcon}>⚙️</Text>
              <Text style={styles.footerText}>Estabilización</Text>
              <Text style={styles.footerSubtext}></Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#4f46e5',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    marginBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  titleSection: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#e0e7ff',
    fontWeight: '500',
    opacity: 0.9,
  },
  controlsSection: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  testButton: {
    backgroundColor: '#6b7280',
  },
  restartButton: {
    backgroundColor: '#ef4444',
  },
  buttonIcon: {
    fontSize: 14,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#e0e7ff',
    fontWeight: '600',
  },
  version: {
    fontSize: 11,
    color: '#c7d2fe',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 8,
  },
  contentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
  },
  scannerContainer: {
    flex: 1,
  },
  footer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  footerGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerItem: {
    alignItems: 'center',
    flex: 1,
  },
  footerIcon: {
    fontSize: 20,
    marginBottom: 6,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 2,
  },
  footerSubtext: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
});