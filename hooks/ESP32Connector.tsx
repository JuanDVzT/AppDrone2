import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import MotorController from './MotorController';
import UnifiedMotorController from './UnifiedMotorController';
import DroneController from './DroneController';
import CalibrationManager from './CalibrationManager';
import { getTestMode, setTestMode, simulateWebSocketConnection } from './ESP32Simulator';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = {
  espIP: string;
};

interface CalibrationValues {
  pitchPID: { kp: number; ki: number; kd: number };
  rollPID: { kp: number; ki: number; kd: number };
  yawPID: { kp: number; ki: number; kd: number };
  minThrottle: number;
  maxThrottle: number;
  baseThrottle: number;
  movementForce: { pitch: number; roll: number; yaw: number; throttleStep: number };
  alpha: number;
  takeoffDuration: number;
}

export default function ESP32Connector({ espIP }: Props) {
  const [status, setStatus] = useState('Conectando...');
  const [message, setMessage] = useState('');
  const [activeController, setActiveController] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [testMode, setTestModeState] = useState(getTestMode());
  const [calibration, setCalibration] = useState<CalibrationValues | null>(null);
  
  const wsRef = useRef<WebSocket | any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    loadCalibration();
  }, []);

  const loadCalibration = async () => {
    try {
      const saved = await AsyncStorage.getItem('drone_calibration');
      if (saved) {
        const parsed = JSON.parse(saved);
        setCalibration(parsed);
        console.log('Calibración cargada en connector:', parsed);
      }
    } catch (error) {
      console.log('Error cargando calibración en connector:', error);
    }
  };

  const connectWebSocket = useCallback(() => {
    if (!espIP) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (getTestMode()) {
      setStatus(`Conectado a ${espIP} (Simulado)`);
      setIsConnected(true);
      wsRef.current = simulateWebSocketConnection(espIP);
      setTimeout(() => {
        setMessage('Conexión simulada exitosa');
      }, 1000);
      return;
    }

    try {
      const ws = new WebSocket(`ws://${espIP}:81/`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket conectado exitosamente');
        setStatus(`Conectado a ${espIP}`);
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;
        
        if (calibration) {
          setTimeout(() => {
            sendCalibrationToESP32();
          }, 500);
        }
        
        ws.send('Hola ESP32 - Reconectado');
      };

      ws.onmessage = (event) => {
        setMessage(event.data);
      };

      ws.onerror = (error) => {
        console.log('Error WebSocket:', error);
        setIsConnected(false);
      };

      ws.onclose = (event) => {
        console.log(`WebSocket cerrado: ${event.code} - ${event.reason}`);
        setIsConnected(false);
        
        if (event.code === 1000) return;
        
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          const delay = Math.min(1000 * reconnectAttemptsRef.current, 5000);
          setStatus(`Reconectando en ${delay/1000} segundos... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, delay);
        } else {
          setStatus('Error: Máximo de reconexiones alcanzado');
        }
      };
    } catch (error) {
      console.error('Error creando WebSocket:', error);
      setIsConnected(false);
    }
  }, [espIP, calibration]);

  const sendCalibrationToESP32 = () => {
    if (!calibration || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    try {
      const calibCommand = `CALIB:${JSON.stringify(calibration)}`;
      wsRef.current.send(calibCommand);
      console.log('Calibración enviada al ESP32:', calibration);
    } catch (error) {
      console.log('Error enviando calibración:', error);
    }
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current && !getTestMode()) {
        wsRef.current.close(1000, "Component unmount");
      }
    };
  }, [connectWebSocket]);

  useEffect(() => {
    if (espIP) {
      reconnectAttemptsRef.current = 0;
      connectWebSocket();
    }
  }, [espIP, connectWebSocket]);

  const toggleController = (controller: string) => {
    // Si ya está activo, lo desactiva (toggle)
    if (activeController === controller) {
      setActiveController(null);
    } else {
      setActiveController(controller);
    }
  };

  const forceReconnect = () => {
    reconnectAttemptsRef.current = 0;
    connectWebSocket();
  };

  const toggleTestMode = (enabled: boolean) => {
    setTestMode(enabled);
    setTestModeState(enabled);
    
    if (enabled) {
      setStatus('Modo Test Activado');
      setIsConnected(true);
      wsRef.current = simulateWebSocketConnection(espIP);
    } else {
      setStatus('Modo Test Desactivado - Reconectando...');
      setIsConnected(false);
      connectWebSocket();
    }
  };

  const handleCalibrationClose = (newCalibration: CalibrationValues) => {
    setCalibration(newCalibration);
    setActiveController(null); // Cierra el panel al guardar
    
    if (isConnected) {
      setTimeout(sendCalibrationToESP32, 100);
    }
  };

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={[styles.status, { color: isConnected ? '#22c55e' : '#ef4444' }]}>
            {status}
          </Text>
          {!isConnected && (
            <TouchableOpacity style={styles.reconnectBtn} onPress={forceReconnect}>
              <Text style={styles.reconnectText}>Reconectar</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {message !== '' && <Text style={styles.message}>{message}</Text>}

        {isConnected && (
          <View style={styles.buttonsContainer}>
            <TouchableOpacity 
              style={[
                styles.btn, 
                activeController === 'motor' && styles.btnActive
              ]} 
              onPress={() => toggleController('motor')}
            >
              <Text style={styles.btnText}>
                {activeController === 'motor' ? '✕ ' : ''}Control Individual
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.btn, 
                styles.unifiedBtn,
                activeController === 'unified' && styles.btnActive
              ]} 
              onPress={() => toggleController('unified')}
            >
              <Text style={styles.btnText}>
                {activeController === 'unified' ? '✕ ' : ''}Control Unificado
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.btn, 
                styles.droneBtn,
                activeController === 'drone' && styles.btnActive
              ]} 
              onPress={() => toggleController('drone')}
            >
              <Text style={styles.btnText}>
                {activeController === 'drone' ? '✕ ' : ''}Control Dron
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.btn, 
                styles.adminBtn,
                activeController === 'admin' && styles.btnActive
              ]} 
              onPress={() => toggleController('admin')}
            >
              <Text style={styles.btnText}>
                {activeController === 'admin' ? '✕ ' : ''}Modo Admin
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {activeController === 'motor' && (
          <MotorController 
            ws={wsRef.current} 
            isConnected={isConnected}
            onReconnect={forceReconnect}
          />
        )}

        {activeController === 'unified' && (
          <UnifiedMotorController 
            ws={wsRef.current}
          />
        )}

        {activeController === 'drone' && (
          <DroneController 
            ws={wsRef.current}
            isConnected={isConnected}
          />
        )}

        {activeController === 'admin' && (
          <CalibrationManager 
            isVisible={true}
            onClose={handleCalibrationClose}
            onToggleTestMode={toggleTestMode}
            currentTestMode={testMode}
            isConnected={isConnected && !testMode}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 10,
  },
  container: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  status: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  reconnectBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  reconnectText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  message: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  buttonsContainer: {
    gap: 10,
  },
  btn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  unifiedBtn: {
    backgroundColor: '#10b981',
  },
  droneBtn: {
    backgroundColor: '#8b5cf6',
  },
  adminBtn: {
    backgroundColor: '#f59e0b',
  },
  btnActive: {
    backgroundColor: '#1d4ed8',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});