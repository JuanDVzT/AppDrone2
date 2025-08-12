// MotorController.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  GestureResponderEvent,
} from "react-native";
import Slider from "@react-native-community/slider";

type Props = {
  espIP?: string;                // si no pasas ws, se usará espIP para abrir WS
  ws?: WebSocket | null;         // si pasas la ws existente, el componente la reutiliza
};

// Descripción de cada "motor" lógico y sus pines IN1/IN2 en el .ino
const MOTORS = [
  { id: "A1", in1: "A1_IN1", in2: "A1_IN2" },
  { id: "A2", in1: "A2_IN1", in2: "A2_IN2" },
  { id: "B1", in1: "B1_IN1", in2: "B1_IN2" },
  { id: "B2", in1: "B2_IN1", in2: "B2_IN2" },
];

export default function MotorController({ espIP, ws: externalWs }: Props) {
  // estado por motor: valor de -255 .. 255
  const [values, setValues] = useState<number[]>(
    () => MOTORS.map(() => 0)
  );

  // estado de conexión
  const [status, setStatus] = useState("Desconectado");
  const wsRef = useRef<WebSocket | null>(externalWs ?? null);

  // debounce timer por motor para agrupar envíos
  const sendTimers = useRef<(NodeJS.Timeout | null)[]>(
    Array(MOTORS.length).fill(null)
  );

  // creación de WS si no se pasó externamente
  useEffect(() => {
    if (externalWs) {
      // usamos la ws externa
      wsRef.current = externalWs;
      setStatus("Conectado (WS externa)");
      return;
    }

    if (!espIP) {
      setStatus("Esperando IP del ESP32...");
      return;
    }

    // Si no hay ws externa, creamos una propia
    const wsUrl = `ws://${espIP}:81/`;
    const wsLocal = new WebSocket(wsUrl);

    wsLocal.onopen = () => {
      setStatus(`Conectado a ${espIP}`);
      // opcional: pedir confirmación al servidor
      try { wsLocal.send("App motor controller conectado"); } catch {}
    };

    wsLocal.onmessage = (evt) => {
      // opcional: mostrar mensajes que envíe el ESP
      // console.log("WS msg", evt.data);
    };

    wsLocal.onerror = () => setStatus("Error WS");
    wsLocal.onclose = () => setStatus("Desconectado");

    wsRef.current = wsLocal;

    return () => {
      // limpieza: cerrar si era local
      try {
        wsLocal.close();
      } catch {}
      wsRef.current = null;
    };
  }, [espIP, externalWs]);

  // Al montar, enviar ceros por seguridad (compatibles con .ino: PIN:0)
  useEffect(() => {
    if (!wsRef.current) return;
    // enviar 0 a todos los pines de motor
    for (const m of MOTORS) {
      sendRaw(`${m.in1}:0`);
      sendRaw(`${m.in2}:0`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsRef.current]);

  // Función para enviar texto por WS si está conectado
  function sendRaw(payload: string) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) {
      // no conectado: ignorar (o podrías guardar en cola)
      // console.warn("WS no disponible, no se envía:", payload);
      return;
    }
    try {
      ws.send(payload);
    } catch (e) {
      // swallow
    }
  }

  // Envía comandos de control para un motor según valor (-255..255)
  // Lógica: si val > 0 -> IN1 = val, IN2 = 0; si val < 0 -> IN1 = 0, IN2 = abs(val)
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
      // v == 0
      sendRaw(`${m.in1}:0`);
      sendRaw(`${m.in2}:0`);
    }
  }

  // Wrapper con debounce por motor (100ms)
  function scheduleSend(index: number, newVal: number) {
    if (sendTimers.current[index]) {
      clearTimeout(sendTimers.current[index] as NodeJS.Timeout);
    }
    sendTimers.current[index] = setTimeout(() => {
      sendMotorValue(index, newVal);
      sendTimers.current[index] = null;
    }, 100);
  }

  // Handlers UI
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

  // Render de cada fila de motor
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

          <Slider
            style={styles.slider}
            minimumValue={-255}
            maximumValue={255}
            step={1}
            value={val}
            onValueChange={(v) => onSliderChange(index, v)}
            minimumTrackTintColor="#3b82f6"
            maximumTrackTintColor="#ddd"
          />

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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Control de motores</Text>
      <Text style={styles.status}>Estado: {status}</Text>

      {MOTORS.map((_, i) => renderMotorRow(i))}

      <View style={{ height: 20 }} />

      <Text style={styles.hint}>
        Usa los sliders o los botones +/-. Valor positivo → IN1=valor, IN2=0. Valor
        negativo → IN1=0, IN2=abs(valor).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  status: {
    fontSize: 13,
    color: "#444",
    marginBottom: 10,
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
    marginBottom: 6,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "700",
  },
  slider: {
    flex: 1,
    height: 40,
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
  },
  stopBtn: {
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#ef4444",
    borderRadius: 6,
  },
  stopText: {
    color: "#fff",
    fontWeight: "700",
  },
  pinInfo: {
    marginTop: 6,
    fontSize: 11,
    color: "#666",
  },
  hint: {
    fontSize: 12,
    color: "#666",
  },
});
