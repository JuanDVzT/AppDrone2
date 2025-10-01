import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import MotorController from './MotorController';
import UnifiedMotorController from './UnifiedMotorController';
import DroneController from './DroneController';
import CalibrationManager from './CalibrationManager';
import { getTestMode, setTestMode, simulateWebSocketConnection } from './ESP32Simulator';

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

// Implementación simple sin AsyncStorage
const LocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.log('Error getting from storage:', error);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.log('Error setting to storage:', error);
    }
  }
};

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

  const loadCalibration = () => {
    try {
      const saved = LocalStorage.getItem('drone_calibration');
      if (saved) {
        const parsed = JSON.parse(saved);
        setCalibration(parsed);
        console.log('Calibración cargada en connector:', parsed);
      }
    } catch (error) {
      console.log('Error cargando calibración en connector:', error);
    }
  };

  const saveCalibration = (newCalibration: CalibrationValues) => {
    try {
      LocalStorage.setItem('drone_calibration', JSON.stringify(newCalibration));
      console.log('Calibración guardada localmente');
    } catch (error) {
      console.log('Error guardando calibración:', error);
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
    saveCalibration(newCalibration);
    setActiveController(null);
    
    if (isConnected) {
      setTimeout(sendCalibrationToESP32, 100);
    }
  };

  return (
    <ScrollView 
      style={styles.scrollContainer} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        {/* Header de Estado - Diseño Mejorado */}
        <View style={styles.connectionCard}>
          <View style={styles.connectionHeader}>
            <View style={styles.statusContainer}>
              <View 
                style={[
                  styles.statusDot,
                  { backgroundColor: isConnected ? '#22c55e' : '#ef4444' }
                ]} 
              />
              <Text style={[
                styles.statusText,
                { color: isConnected ? '#22c55e' : '#ef4444' }
              ]}>
                {status}
              </Text>
            </View>
            
            {!isConnected && (
              <TouchableOpacity style={styles.reconnectBtn} onPress={forceReconnect}>
                <Text style={styles.reconnectIcon}>🔄</Text>
                <Text style={styles.reconnectText}>Reconectar</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {message !== '' && (
            <View style={styles.messageContainer}>
              <Text style={styles.messageIcon}>💬</Text>
              <Text style={styles.message}>{message}</Text>
            </View>
          )}
        </View>

        {/* Botones de Control - Diseño Mejorado */}
        {isConnected && (
          <View style={styles.controlsCard}>
            <Text style={styles.controlsTitle}>🎮 Modos de Control</Text>
            
            <View style={styles.buttonsContainer}>
              <TouchableOpacity 
                style={[
                  styles.controlButton,
                  styles.motorButton,
                  activeController === 'motor' && styles.activeButton
                ]} 
                onPress={() => toggleController('motor')}
              >
                <Text style={styles.buttonIcon}>🔧</Text>
                <Text style={styles.buttonText}>
                  {activeController === 'motor' ? '✕ CERRAR' : 'Control Individual'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.controlButton,
                  styles.unifiedButton,
                  activeController === 'unified' && styles.activeButton
                ]} 
                onPress={() => toggleController('unified')}
              >
                <Text style={styles.buttonIcon}>🔄</Text>
                <Text style={styles.buttonText}>
                  {activeController === 'unified' ? '✕ CERRAR' : 'Control Unificado'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.controlButton,
                  styles.droneButton,
                  activeController === 'drone' && styles.activeButton
                ]} 
                onPress={() => toggleController('drone')}
              >
                <Text style={styles.buttonIcon}>🚁</Text>
                <Text style={styles.buttonText}>
                  {activeController === 'drone' ? '✕ CERRAR' : 'Control Dron'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.controlButton,
                  styles.adminButton,
                  activeController === 'admin' && styles.activeButton
                ]} 
                onPress={() => toggleController('admin')}
              >
                <Text style={styles.buttonIcon}>⚙️</Text>
                <Text style={styles.buttonText}>
                  {activeController === 'admin' ? '✕ CERRAR' : 'Modo Admin'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Contenido de los Controladores */}
        {activeController === 'motor' && (
          <View style={styles.controllerCard}>
            <MotorController 
              ws={wsRef.current} 
              isConnected={isConnected}
              onReconnect={forceReconnect}
            />
          </View>
        )}

        {activeController === 'unified' && (
          <View style={styles.controllerCard}>
            <UnifiedMotorController 
              ws={wsRef.current}
            />
          </View>
        )}

        {activeController === 'drone' && (
          <View style={styles.controllerCard}>
            <DroneController 
              ws={wsRef.current}
              isConnected={isConnected}
            />
          </View>
        )}

        {activeController === 'admin' && (
          <View style={styles.controllerCard}>
            <CalibrationManager 
              isVisible={true}
              onClose={handleCalibrationClose}
              onToggleTestMode={toggleTestMode}
              currentTestMode={testMode}
              isConnected={isConnected && !testMode}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 8,
  },
  container: {
    gap: 16,
  },
  connectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  reconnectBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reconnectIcon: {
    fontSize: 14,
  },
  reconnectText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
  },
  messageIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  message: {
    fontSize: 14,
    color: '#0369a1',
    fontWeight: '500',
    flex: 1,
  },
  controlsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  controlsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  buttonsContainer: {
    gap: 12,
  },
  controlButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  motorButton: {
    backgroundColor: '#3b82f6',
  },
  unifiedButton: {
    backgroundColor: '#10b981',
  },
  droneButton: {
    backgroundColor: '#8b5cf6',
  },
  adminButton: {
    backgroundColor: '#f59e0b',
  },
  activeButton: {
    backgroundColor: '#1e293b',
    transform: [{ scale: 0.98 }],
  },
  buttonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
  },
  controllerCard: {
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
  },
});