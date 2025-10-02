export let TEST_MODE = false;

export const setTestMode = (value: boolean) => {
  TEST_MODE = value;
  console.log(`Modo Test ${value ? 'activado' : 'desactivado'}`);
};

export const getTestMode = () => TEST_MODE;

export const SIMULATED_IP = '192.168.1.100';

export const simulateESP32Detection = (callback: (ip: string) => void): NodeJS.Timeout => {
  return setTimeout(() => {
    if (TEST_MODE) {
      console.log('ESP32 simulado detectado:', SIMULATED_IP);
      callback(SIMULATED_IP);
    }
  }, 2000);
};

export const simulateWebSocketConnection = (ip: string) => {
  console.log(`Simulando conexión WebSocket a: ws://${ip}:81/`);
  
  return {
    send: (data: string) => {
      console.log('📤 Datos enviados al ESP32 simulado:', data);
      
      if (data.startsWith('CALIB:')) {
        console.log('✅ Calibración recibida en simulador');
        console.log('📊 Valores de calibración aplicados en simulación');
      }
      
      if (data === 'TAKEOFF') {
        console.log('🚀 Simulando despegue...');
      }
      
      if (data === 'LAND') {
        console.log('🛬 Simulando aterrizaje...');
      }
      
      if (data.startsWith('THROTTLE:')) {
        const throttle = data.split(':')[1];
        console.log(`🎛️  Throttle simulado: ${throttle}`);
      }
      
      if (data.startsWith('MOVE:')) {
        console.log(`🎮 Movimiento simulado: ${data}`);
      }
    },
    close: () => {
      console.log('🔌 Conexión WebSocket simulada cerrada');
    },
    readyState: 1 //
  };
};