// ESP32Simulator.ts
// Cambia este valor para simular diferentes estados
export const TEST_MODE = true;
export const SIMULATED_IP = '192.168.1.100';

// Simula la detección de ESP32
export const simulateESP32Detection = (callback: (ip: string) => void): NodeJS.Timeout => {
  return setTimeout(() => {
    if (TEST_MODE) {
      console.log('ESP32 simulado detectado:', SIMULATED_IP);
      callback(SIMULATED_IP);
    }
  }, 2000); // Simula un retraso de 2 segundos en la detección
};

// Simula la conexión WebSocket
export const simulateWebSocketConnection = (ip: string) => {
  console.log(`Simulando conexión WebSocket a: ws://${ip}:81/`);
  
  // Simula los eventos de WebSocket
  return {
    send: (data: string) => {
      console.log('Datos enviados al ESP32 simulado:', data);
    },
    close: () => {
      console.log('Conexión WebSocket simulada cerrada');
    }
  };
};