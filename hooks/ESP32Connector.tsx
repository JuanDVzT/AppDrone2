import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import MotorController from './MotorController';
import UnifiedMotorController from './UnifiedMotorController';
import { getTestMode, simulateWebSocketConnection } from './ESP32Simulator';

type Props = {
  espIP: string;
};

export default function ESP32Connector({ espIP }: Props) {
  const [status, setStatus] = useState('Conectando...');
  const [message, setMessage] = useState('');
  const [showMotorController, setShowMotorController] = useState(false);
  const [showUnifiedMotorController, setShowUnifiedMotorController] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | any>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connectWebSocket = useCallback(() => {
    if (!espIP) return;

    // Limpiar intento de reconexión anterior
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
        
        // No intentar reconexión si fue un cierre intencional
        if (event.code === 1000) return;
        
        // Reconexión automática con backoff
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
  }, [espIP]);

  useEffect(() => {
    connectWebSocket();

    return () => {
      // Limpieza
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current && !getTestMode()) {
        wsRef.current.close(1000, "Component unmount");
      }
    };
  }, [connectWebSocket]);

  // Reconectar manualmente si la IP cambia
  useEffect(() => {
    if (espIP) {
      reconnectAttemptsRef.current = 0;
      connectWebSocket();
    }
  }, [espIP, connectWebSocket]);

  const toggleMotorController = () => {
    setShowMotorController(prev => !prev);
    // Cierra el controlador unificado si está abierto
    if (showUnifiedMotorController) {
      setShowUnifiedMotorController(false);
    }
  };

  const toggleUnifiedMotorController = () => {
    setShowUnifiedMotorController(prev => !prev);
    // Cierra el controlador individual si está abierto
    if (showMotorController) {
      setShowMotorController(false);
    }
  };

  const forceReconnect = () => {
    reconnectAttemptsRef.current = 0;
    connectWebSocket();
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
                showMotorController && styles.btnActive
              ]} 
              onPress={toggleMotorController}
            >
              <Text style={styles.btnText}>
                {showMotorController ? 'Ocultar Control Individual' : 'Control Individual de Motores'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.btn, 
                styles.unifiedBtn,
                showUnifiedMotorController && styles.btnActive
              ]} 
              onPress={toggleUnifiedMotorController}
            >
              <Text style={styles.btnText}>
                {showUnifiedMotorController ? 'Ocultar Control Unificado' : 'Control Unificado de Motores'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {showMotorController && (
          <MotorController 
            ws={wsRef.current} 
            isConnected={isConnected}
            onReconnect={forceReconnect}
          />
        )}

        {showUnifiedMotorController && (
          <UnifiedMotorController 
            ws={wsRef.current}
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
  btnActive: {
    backgroundColor: '#1d4ed8',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});