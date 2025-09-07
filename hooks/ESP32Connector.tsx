import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MotorController from './MotorController';
import { getTestMode, simulateWebSocketConnection } from './ESP32Simulator';

type Props = {
  espIP: string;
};

export default function ESP32Connector({ espIP }: Props) {
  const [status, setStatus] = useState('Conectando...');
  const [message, setMessage] = useState('');
  const [showMotorController, setShowMotorController] = useState(false);
  const wsRef = useRef<WebSocket | any>(null);

  useEffect(() => {
    if (!espIP) return;

    if (getTestMode()) {
      setStatus(`Conectado a ${espIP} (Simulado)`);
      wsRef.current = simulateWebSocketConnection(espIP);
      setTimeout(() => {
        setMessage('Conexión simulada exitosa');
      }, 1000);
    } else {
      const ws = new WebSocket(`ws://${espIP}:81/`);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus(`Conectado a ${espIP}`);
        ws.send('Hola ESP32');
      };

      ws.onmessage = (event) => {
        setMessage(event.data);
      };

      ws.onerror = () => {
        setStatus('Error de conexión');
      };

      ws.onclose = () => {
        setStatus('Desconectado');
      };
    }

    return () => {
      if (wsRef.current && !getTestMode()) {
        wsRef.current.close();
      }
      wsRef.current = null;
    };
  }, [espIP]);

  const toggleMotorController = () => {
    setShowMotorController(prev => !prev);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.status}>{status}</Text>
      {message !== '' && <Text style={styles.message}>{message}</Text>}

      {wsRef.current && (
        <TouchableOpacity style={styles.btn} onPress={toggleMotorController}>
          <Text style={styles.btnText}>
            {showMotorController ? 'Ocultar Controlador de Motores' : 'Mostrar Controlador de Motores'}
          </Text>
        </TouchableOpacity>
      )}

      {showMotorController && wsRef.current && <MotorController ws={wsRef.current} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
  },
  status: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#333',
    marginBottom: 12,
  },
  btn: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
