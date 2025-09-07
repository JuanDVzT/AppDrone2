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
};

const MOTORS = [
  { id: "A1", in1: "A1_IN1", in2: "A1_IN2" },
  { id: "A2", in1: "A2_IN1", in2: "A2_IN2" },
  { id: "B1", in1: "B1_IN1", in2: "B1_IN2" },
  { id: "B2", in1: "B2_IN1", in2: "B2_IN2" },
];

export default function MotorController({ espIP, ws: externalWs }: Props) {
  const [values, setValues] = useState<number[]>(() => MOTORS.map(() => 0));
  const [status, setStatus] = useState("Desconectado");
  const wsRef = useRef<WebSocket | null>(externalWs ?? null);

  const sendTimers = useRef<(NodeJS.Timeout | null)[]>(
    Array(MOTORS.length).fill(null)
  );

  // --- WebSocket ---
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
        wsLocal.send("App motor controller conectado");
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
    for (const m of MOTORS) {
      sendRaw(`${m.in1}:0`);
      sendRaw(`${m.in2}:0`);
    }
    setValues(MOTORS.map(() => 0));
  }

  useEffect(() => {
    resetAllMotors();
    return () => {
      resetAllMotors();
    };
  }, [wsRef.current]);

  function scheduleSend(index: number, newVal: number) {
    if (sendTimers.current[index]) {
      clearTimeout(sendTimers.current[index] as NodeJS.Timeout);
    }
    sendTimers.current[index] = setTimeout(() => {
      sendMotorValue(index, newVal);
      sendTimers.current[index] = null;
    }, 100);
  }

  // --- Handlers ---
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

  // --- Render fila de motor ---
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
          >
            <Text style={styles.btnText}>-</Text>
          </TouchableOpacity>

          <View style={styles.sliderWrapper}>
            <Slider
              value={val}
              minimumValue={-255}
              maximumValue={255}
              step={1}
              onValueChange={(v) => onSliderChange(index, v[0])}
              minimumTrackTintColor="#3b82f6"
              maximumTrackTintColor="#ddd"
              thumbTintColor="#2563eb"
            />
          </View>

          <TouchableOpacity
            style={styles.smallBtn}
            onPress={() => onIncrement(index)}
          >
            <Text style={styles.btnText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rowRight}>
          <Text style={styles.valueText}>{val}</Text>
          <TouchableOpacity style={styles.stopBtn} onPress={() => onStop(index)}>
            <Text style={styles.stopText}>STOP</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.pinInfo}>
          {motor.in1} / {motor.in2}
        </Text>
      </View>
    );
  }

  // --- Render principal ---
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Control de motores</Text>
      <Text style={styles.status}>Estado: {status}</Text>
      {MOTORS.map((_, i) => renderMotorRow(i))}
      <View style={{ height: 20 }} />
      <Text style={styles.hint}>
        Usa los sliders o los botones +/-. Valor positivo → IN1=valor, IN2=0.
        Valor negativo → IN1=0, IN2=abs(valor).
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
  },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  status: { fontSize: 13, color: "#444", marginBottom: 10 },
  motorRow: {
    marginBottom: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  motorLabel: { fontSize: 15, fontWeight: "600", marginBottom: 6 },
  controlsRow: { flexDirection: "row", alignItems: "center" },
  smallBtn: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 6,
  },
  btnText: { fontSize: 18, fontWeight: "700" },
  sliderWrapper: { flex: 1, paddingHorizontal: 4 },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    justifyContent: "space-between",
  },
  valueText: { fontSize: 14, width: 50, textAlign: "center" },
  stopBtn: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ef4444",
    borderRadius: 6,
  },
  stopText: { color: "#fff", fontWeight: "700" },
  pinInfo: { marginTop: 6, fontSize: 11, color: "#666" },
  hint: { fontSize: 12, color: "#666" },
});
