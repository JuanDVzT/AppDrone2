import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Props = {
  espIP: string;
};

export default function ESP32Connector({ espIP }: Props) {
  const [status, setStatus] = useState('Conectando...');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const ws = new WebSocket(`ws://${espIP}:81/`);

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

    return () => {
      ws.close();
    };
  }, [espIP]);

  return (
    <View style={styles.container}>
      <Text style={styles.status}>{status}</Text>
      {message !== '' && <Text style={styles.message}>{message}</Text>}
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
  },
});
