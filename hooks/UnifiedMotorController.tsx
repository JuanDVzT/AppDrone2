
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Slider } from "@miblanchard/react-native-slider";

type Props = {
  espIP?: string;
  ws?: WebSocket | null;
};

const MOTORS = [
  { id: "A1", in1: "A1_IN1", in2: "A1_IN2" },
  { id: "A2", in1: "A2_IN1", in2: "A2_IN2" },
  { id: "B1", in1: "B1_IN1", in2: "B1_IN2" },
  { id: "B2", in1: "B2_IN1", in2: "B2_IN2" },
];

export default function UnifiedMotorController({ espIP, ws: externalWs }: Props) {
  const [unifiedValue, setUnifiedValue] = useState(0);
  const [status, setStatus] = useState("Desconectado");
  const wsRef = useRef<WebSocket | null>(externalWs ?? null);
  const sendTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (externalWs) {
      wsRef.current = externalWs;
      setStatus("Conectado (WS externa)");
      return;
    }
    if (!espIP) {
      setStatus("Esperando IP del ESP32...");
      return;
    }

    const wsUrl = `ws://${espIP}:81/`;
    const wsLocal = new WebSocket(wsUrl);

    wsLocal.onopen = () => {
      setStatus(`Conectado a ${espIP}`);
      try {
        wsLocal.send("App unified motor controller conectado");
      } catch {}
    };

    wsLocal.onerror = () => setStatus("Error WS");
    wsLocal.onclose = () => setStatus("Desconectado");

    wsRef.current = wsLocal;

    return () => {
      try {
        wsLocal.close();
      } catch {}
      wsRef.current = null;
    };
  }, [espIP, externalWs]);

  // --- Funciones de envío ---
  function sendRaw(payload: string) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;
    try {
      ws.send(payload);
    } catch {}
  }

  function sendUnifiedValue(value: number) {
    const val = Math.max(0, Math.min(255, Math.round(value))); 
    

    const m1 = MOTORS[0]; // A1
    if (val > 0) {
      sendRaw(`${m1.in1}:${val}`);
      sendRaw(`${m1.in2}:0`);
    } else {
      sendRaw(`${m1.in1}:0`);
      sendRaw(`${m1.in2}:0`);
    }
    const negativeMotors = MOTORS.slice(1); // A2, B1, B2
    
    negativeMotors.forEach(m => {
      if (val > 0) {
        sendRaw(`${m.in1}:0`);
        sendRaw(`${m.in2}:${val}`);
      } else {
        sendRaw(`${m.in1}:0`);
        sendRaw(`${m.in2}:0`);
      }
    });
  }

  function resetAllMotors() {
    for (const m of MOTORS) {
      sendRaw(`${m.in1}:0`);
      sendRaw(`${m.in2}:0`);
    }
    setUnifiedValue(0);
  }

  useEffect(() => {
    resetAllMotors();
    return () => {
      resetAllMotors();
    };
  }, [wsRef.current]);

  function scheduleSend(value: number) {
    if (sendTimerRef.current) {
      clearTimeout(sendTimerRef.current);
    }
    sendTimerRef.current = setTimeout(() => {
      sendUnifiedValue(value);
      sendTimerRef.current = null;
    }, 100);
  }

  // --- Handlers ---
  function onIncrement() {
    setUnifiedValue((prev) => {
      const next = Math.min(255, prev + 1);
      scheduleSend(next);
      return next;
    });
  }

  function onDecrement() {
    setUnifiedValue((prev) => {
      const next = Math.max(0, prev - 1);
      scheduleSend(next);
      return next;
    });
  }

  function onSliderChange(value: number) {
    const roundedValue = Math.round(value);
    setUnifiedValue(roundedValue);
    scheduleSend(roundedValue);
  }

  function onStop() {
    setUnifiedValue(0);
    scheduleSend(0);
  }

  // --- Render ---
  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <Text style={styles.title}>Control Unificado de Motores</Text>
        <Text style={styles.status}>Estado: {status}</Text>
        
        <View style={styles.motorInfo}>
          <Text style={styles.motorInfoText}>
            Todos los motores impulsan hacia ABAJO
          </Text>
          <Text style={styles.motorInfoSubtext}>
            A1: positivo | A2, B1, B2: negativo
          </Text>
        </View>

        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.smallBtn}
            onPress={onDecrement}
          >
            <Text style={styles.btnText}>-</Text>
          </TouchableOpacity>

          <View style={styles.sliderWrapper}>
            <Slider
              value={unifiedValue}
              minimumValue={0}
              maximumValue={255}
              step={1}
              onValueChange={(v) => onSliderChange(v[0])}
              minimumTrackTintColor="#10b981"
              maximumTrackTintColor="#ddd"
              thumbTintColor="#059669"
            />
          </View>

          <TouchableOpacity
            style={styles.smallBtn}
            onPress={onIncrement}
          >
            <Text style={styles.btnText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.valueRow}>
          <Text style={styles.valueText}>Potencia: {unifiedValue}</Text>
          <TouchableOpacity style={styles.stopBtn} onPress={onStop}>
            <Text style={styles.stopText}>DETENER</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.motorDetails}>
          <Text style={styles.detailsTitle}>Configuración actual:</Text>
          <Text style={styles.detailText}>
            • A1: {unifiedValue > 0 ? `IN1=${unifiedValue}, IN2=0` : "IN1=0, IN2=0"}
          </Text>
          <Text style={styles.detailText}>
            • A2: {unifiedValue > 0 ? `IN1=0, IN2=${unifiedValue}` : "IN1=0, IN2=0"}
          </Text>
          <Text style={styles.detailText}>
            • B1: {unifiedValue > 0 ? `IN1=0, IN2=${unifiedValue}` : "IN1=0, IN2=0"}
          </Text>
          <Text style={styles.detailText}>
            • B2: {unifiedValue > 0 ? `IN1=0, IN2=${unifiedValue}` : "IN1=0, IN2=0"}
          </Text>
        </View>

        <View style={{ height: 10 }} />
        <Text style={styles.hint}>
          Todos los motores funcionan simultáneamente con la misma potencia
        </Text>
      </View>
    </ScrollView>
  );
}

// --- Estilos ---
const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
  },
  container: {
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    elevation: 2,
  },
  title: { 
    fontSize: 18, 
    fontWeight: "700", 
    marginBottom: 6,
    textAlign: "center"
  },
  status: { 
    fontSize: 13, 
    color: "#444", 
    marginBottom: 10,
    textAlign: "center"
  },
  motorInfo: {
    backgroundColor: "#ecfdf5",
    padding: 12,
    borderRadius: 6,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
  },
  motorInfoText: {
    fontSize: 14,
    color: "#065f46",
    fontWeight: "600",
    textAlign: "center"
  },
  motorInfoSubtext: {
    fontSize: 12,
    color: "#047857",
    textAlign: "center",
    marginTop: 4
  },
  controlsRow: { 
    flexDirection: "row", 
    alignItems: "center",
    marginBottom: 12,
  },
  smallBtn: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 8,
  },
  btnText: { 
    fontSize: 20, 
    fontWeight: "700",
    color: "#374151"
  },
  sliderWrapper: { 
    flex: 1, 
    paddingHorizontal: 4 
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  valueText: { 
    fontSize: 16, 
    fontWeight: "600",
    color: "#1f2937"
  },
  stopBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#ef4444",
    borderRadius: 6,
  },
  stopText: { 
    color: "#fff", 
    fontWeight: "700",
    fontSize: 14
  },
  motorDetails: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#374151",
  },
  detailText: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 4,
  },
  hint: { 
    fontSize: 11, 
    color: "#6b7280",
    fontStyle: "italic",
    textAlign: "center"
  },
});