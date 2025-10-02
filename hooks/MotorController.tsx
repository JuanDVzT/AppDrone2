// MotorController.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Slider } from "@miblanchard/react-native-slider";

type Props = {
  espIP?: string;
  ws?: WebSocket | null;
  isConnected?: boolean;
  onReconnect?: () => void;
};

const MOTORS = [
  { id: "A1", in1: "A1_IN1", in2: "A1_IN2" },
  { id: "A2", in1: "A2_IN1", in2: "A2_IN2" },
  { id: "B1", in1: "B1_IN1", in2: "B1_IN2" },
  { id: "B2", in1: "B2_IN1", in2: "B2_IN2" },
];

export default function MotorController({ espIP, ws: externalWs, isConnected = false, onReconnect }: Props) {
  const [values, setValues] = useState<number[]>(() => MOTORS.map(() => 0));
  const [status, setStatus] = useState("Desconectado");
  const [internalConnected, setInternalConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(externalWs ?? null);

  const sendTimers = useRef<(NodeJS.Timeout | null)[]>(
    Array(MOTORS.length).fill(null)
  );

 
  const combinedConnected = externalWs ? isConnected : internalConnected;


  useEffect(() => {
    if (externalWs) {
      wsRef.current = externalWs;
      setStatus("Conectado (WS externa)");
      setInternalConnected(true);
      return;
    }
    
    if (!espIP) {
      setStatus("Esperando IP del ESP32...");
      setInternalConnected(false);
      return;
    }

    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connectWebSocket = () => {
      try {
        const wsUrl = `ws://${espIP}:81/`;
        const wsLocal = new WebSocket(wsUrl);
        
        wsLocal.onopen = () => {
          console.log('WebSocket conectado exitosamente a', espIP);
          setStatus(`Conectado a ${espIP}`);
          setInternalConnected(true);
          reconnectAttempts = 0;
          try {
            wsLocal.send("App motor controller reconectado");
          } catch {}
        };

        wsLocal.onmessage = (event) => {
          console.log('Mensaje recibido:', event.data);
        };

        wsLocal.onerror = (error) => {
          console.log('Error WebSocket:', error);
          setStatus("Error de conexión");
          setInternalConnected(false);
        };

        wsLocal.onclose = (event) => {
          console.log(`WebSocket cerrado: ${event.code} - ${event.reason}`);
          setInternalConnected(false);
          
          
          if (event.code === 1000) {
            setStatus("Desconectado");
            return;
          }
          
          
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * reconnectAttempts, 5000);
            setStatus(`Reconectando en ${delay/1000}s... (${reconnectAttempts}/${maxReconnectAttempts})`);
            
            reconnectTimeout = setTimeout(() => {
              connectWebSocket();
            }, delay);
          } else {
            setStatus('Error: Máximo de reconexiones alcanzado');
          }
        };

        wsRef.current = wsLocal;
      } catch (error) {
        console.error('Error creando WebSocket:', error);
        setStatus("Error creando conexión");
        setInternalConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      try {
        if (wsRef.current && !externalWs) {
          wsRef.current.close(1000, "Cleanup");
        }
      } catch {}
      wsRef.current = null;
    };
  }, [espIP, externalWs]);

  useEffect(() => {
    if (combinedConnected && wsRef.current?.readyState === WebSocket.OPEN) {
     
      const timeout = setTimeout(() => {
        console.log('Reenviando estado de motores tras reconexión...');
        values.forEach((val, index) => {
          if (val !== 0) {
            sendMotorValue(index, val);
          }
        });
      }, 500); // Delay para asegurar que la conexión está estable
      
      return () => clearTimeout(timeout);
    }
  }, [combinedConnected, values]);

  function sendRaw(payload: string): boolean {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('WebSocket no conectado, no se puede enviar:', payload);
      
      if (onReconnect) {
        console.log('Solicitando reconexión...');
        onReconnect();
      }
      return false;
    }
    try {
      ws.send(payload);
      console.log('Comando enviado:', payload);
      return true;
    } catch (error) {
      console.log('Error enviando comando:', error);
      return false;
    }
  }

  function sendMotorValue(index: number, val: number) {
    const m = MOTORS[index];
    const v = Math.max(-255, Math.min(255, Math.round(val)));
    
    if (v > 0) {
      sendRaw(`${m.in1}:${v}`);
      sendRaw(`${m.in2}:0`);
    } else if (v < 0) {
      sendRaw(`${m.in1}:0`);
      sendRaw(`${m.in2}:${Math.abs(v)}`);
    } else {
      sendRaw(`${m.in1}:0`);
      sendRaw(`${m.in2}:0`);
    }
  }

  function resetAllMotors() {
    console.log('Apagando todos los motores');
    for (const m of MOTORS) {
      sendRaw(`${m.in1}:0`);
      sendRaw(`${m.in2}:0`);
    }
    setValues(MOTORS.map(() => 0));
  }

  useEffect(() => {
    return () => {
      resetAllMotors();
    };
  }, []);

  function scheduleSend(index: number, newVal: number) {
    if (sendTimers.current[index]) {
      clearTimeout(sendTimers.current[index] as NodeJS.Timeout);
    }
    sendTimers.current[index] = setTimeout(() => {
      sendMotorValue(index, newVal);
      sendTimers.current[index] = null;
    }, 100);
  }

  function onIncrement(index: number) {
    setValues((prev) => {
      const next = [...prev];
      next[index] = Math.min(255, next[index] + 1);
      scheduleSend(index, next[index]);
      return next;
    });
  }

  function onDecrement(index: number) {
    setValues((prev) => {
      const next = [...prev];
      next[index] = Math.max(-255, next[index] - 1);
      scheduleSend(index, next[index]);
      return next;
    });
  }

  function onSliderChange(index: number, v: number) {
    setValues((prev) => {
      const next = [...prev];
      next[index] = Math.round(v);
      return next;
    });
    scheduleSend(index, v);
  }

  function onStop(index: number) {
    setValues((prev) => {
      const next = [...prev];
      next[index] = 0;
      scheduleSend(index, 0);
      return next;
    });
  }

  function handleForceReconnect() {
    if (onReconnect) {
      onReconnect();
    } else {
      setValues(MOTORS.map(() => 0));
      setTimeout(() => {
      }, 100);
    }
  }

  function renderMotorRow(index: number) {
    const motor = MOTORS[index];
    const val = values[index];
    return (
      <View key={motor.id} style={styles.motorRow}>
        <Text style={styles.motorLabel}>{motor.id}</Text>
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.smallBtn}
            onPress={() => onDecrement(index)}
            disabled={!combinedConnected}
          >
            <Text style={[styles.btnText, !combinedConnected && styles.disabledText]}>-</Text>
          </TouchableOpacity>

          <View style={styles.sliderWrapper}>
            <Slider
              value={val}
              minimumValue={-255}
              maximumValue={255}
              step={1}
              onValueChange={(v) => onSliderChange(index, v[0])}
              onSlidingComplete={() => scheduleSend(index, values[index])}
              minimumTrackTintColor={combinedConnected ? "#3b82f6" : "#9ca3af"}
              maximumTrackTintColor="#ddd"
              thumbTintColor={combinedConnected ? "#2563eb" : "#6b7280"}
              disabled={!combinedConnected}
            />
          </View>

          <TouchableOpacity
            style={styles.smallBtn}
            onPress={() => onIncrement(index)}
            disabled={!combinedConnected}
          >
            <Text style={[styles.btnText, !combinedConnected && styles.disabledText]}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rowRight}>
          <Text style={[styles.valueText, !combinedConnected && styles.disabledText]}>
            {val}
          </Text>
          <TouchableOpacity 
            style={[styles.stopBtn, !combinedConnected && styles.disabledBtn]} 
            onPress={() => onStop(index)}
            disabled={!combinedConnected}
          >
            <Text style={styles.stopText}>STOP</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.pinInfo}>
          {motor.in1} / {motor.in2}
        </Text>
      </View>
    );
  }

  // --- Render 
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Control de motores</Text>
        <View style={styles.connectionStatus}>
          <View 
            style={[
              styles.statusIndicator, 
              { backgroundColor: combinedConnected ? '#22c55e' : '#ef4444' }
            ]} 
          />
          <Text style={[
            styles.status, 
            { color: combinedConnected ? '#22c55e' : '#ef4444' }
          ]}>
            {combinedConnected ? 'Conectado' : 'Desconectado'}
          </Text>
        </View>
      </View>
      
      <Text style={styles.statusText}>{status}</Text>

      {!combinedConnected && (
        <TouchableOpacity style={styles.reconnectBtn} onPress={handleForceReconnect}>
          <Text style={styles.reconnectText}>Reconectar Manualmente</Text>
        </TouchableOpacity>
      )}

      {MOTORS.map((_, i) => renderMotorRow(i))}
      
      <TouchableOpacity 
        style={[styles.resetBtn, !combinedConnected && styles.disabledBtn]} 
        onPress={resetAllMotors}
        disabled={!combinedConnected}
      >
        <Text style={styles.resetText}>APAGAR TODOS LOS MOTORES</Text>
      </TouchableOpacity>

      <View style={{ height: 10 }} />
      <Text style={styles.hint}>
        {combinedConnected 
          ? "Usa los sliders o los botones +/-. Valor positivo → IN1=valor, IN2=0. Valor negativo → IN1=0, IN2=abs(valor)."
          : "Conecta con el ESP32 para controlar los motores."
        }
      </Text>
    </View>
  );
}

// --- Estilos ---
const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    elevation: 2,
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: { 
    fontSize: 18, 
    fontWeight: "700", 
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  status: { 
    fontSize: 12, 
    fontWeight: '600',
  },
  statusText: { 
    fontSize: 13, 
    color: "#444", 
    marginBottom: 10,
    fontStyle: 'italic',
  },
  motorRow: {
    marginBottom: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  motorLabel: { 
    fontSize: 15, 
    fontWeight: "600", 
    marginBottom: 6 
  },
  controlsRow: { 
    flexDirection: "row", 
    alignItems: "center" 
  },
  smallBtn: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 6,
  },
  btnText: { 
    fontSize: 18, 
    fontWeight: "700" 
  },
  disabledText: {
    color: '#9ca3af',
  },
  sliderWrapper: { 
    flex: 1, 
    paddingHorizontal: 4 
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    justifyContent: "space-between",
  },
  valueText: { 
    fontSize: 14, 
    width: 50, 
    textAlign: "center",
    fontWeight: '600',
  },
  stopBtn: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ef4444",
    borderRadius: 6,
  },
  disabledBtn: {
    backgroundColor: "#9ca3af",
  },
  stopText: { 
    color: "#fff", 
    fontWeight: "700",
    fontSize: 12,
  },
  pinInfo: { 
    marginTop: 6, 
    fontSize: 11, 
    color: "#666" 
  },
  reconnectBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 15,
  },
  reconnectText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  resetBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  resetText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  hint: { 
    fontSize: 12, 
    color: "#666",
    fontStyle: 'italic',
    textAlign: 'center',
  },
});