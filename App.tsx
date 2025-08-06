import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import dgram from 'react-native-udp';

const PORT = 4210;

export default function ESP32Scanner() {
  const [espIP, setEspIP] = useState(null);

  useEffect(() => {
    const socket = dgram.createSocket({ type: 'udp4' });

    socket.bind(PORT);
    socket.once('listening', () => {
      console.log('Escuchando UDP en puerto', PORT);
    });

    socket.on('message', (msg, _rinfo) => {
      const message = msg.toString();
      if (message.startsWith('ESP32|')) {
        const [_, ip, mac] = message.split('|');
        console.log(`ESP32 detectado: IP=${ip}, MAC=${mac}`);
        setEspIP(ip);
      }
    });

    return () => {
      socket.close();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {espIP ? `ESP32 IP: ${espIP}` : 'Buscando ESP32...'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  text: {
    fontSize: 18,
  },
});