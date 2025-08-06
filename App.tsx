// /**
//  * Sample React Native App
//  * https://github.com/facebook/react-native
//  *
//  * @format
//  */

// import { NewAppScreen } from '@react-native/new-app-screen';
// import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';

// function App() {
//   const isDarkMode = useColorScheme() === 'dark';

//   return (
//     <View style={styles.container}>
//       <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
//       <NewAppScreen templateFileName="App.tsx" />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   container: {
//     flex: 1,
//   },
// });

// export default App;

import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import dgram from 'react-native-udp';

const PORT = 4210;

export default function ESP32Scanner() {
  const [espIP, setEspIP] = useState(null);

  useEffect(() => {
    const socket = dgram.createSocket('udp4');

    socket.bind(PORT);
    socket.once('listening', () => {
      console.log('Escuchando UDP en puerto', PORT);
    });

    socket.on('message', (msg, rinfo) => {
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
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 18 }}>
        {espIP ? `ESP32 IP: ${espIP}` : 'Buscando ESP32...'}
      </Text>
    </View>
  );
}

