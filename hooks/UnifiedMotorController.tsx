// UnifiedMotorController.tsx - VERSIÓN MEJORADA
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
    
    // A1 usa valores positivos (IN1=valor, IN2=0)
    const m1 = MOTORS[0]; // A1
    if (val > 0) {
      sendRaw(`${m1.in1}:${val}`);
      sendRaw(`${m1.in2}:0`);
    } else {
      sendRaw(`${m1.in1}:0`);
      sendRaw(`${m1.in2}:0`);
    }

    // A2, B1, B2 usan valores negativos (IN1=0, IN2=valor)
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
    <ScrollView 
      style={styles.scrollContainer} 
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerIcon}>⚡</Text>
          <View style={styles.headerTexts}>
            <Text style={styles.title}>Control Unificado de Motores</Text>
            <Text style={styles.status}>Estado: {status}</Text>
          </View>
        </View>

        {/* Información de Configuración */}
        <View style={styles.configCard}>
          <View style={styles.configHeader}>
            <Text style={styles.configIcon}>🔧</Text>
            <Text style={styles.configTitle}>Configuración de Motores</Text>
          </View>
          <Text style={styles.configDescription}>
            Todos los motores impulsan hacia ABAJO simultáneamente
          </Text>
          <View style={styles.motorConfig}>
            <View style={styles.motorItem}>
              <Text style={styles.motorLabel}>A1</Text>
              <Text style={styles.motorType}>Positivo</Text>
            </View>
            <View style={styles.motorItem}>
              <Text style={styles.motorLabel}>A2</Text>
              <Text style={styles.motorType}>Negativo</Text>
            </View>
            <View style={styles.motorItem}>
              <Text style={styles.motorLabel}>B1</Text>
              <Text style={styles.motorType}>Negativo</Text>
            </View>
            <View style={styles.motorItem}>
              <Text style={styles.motorLabel}>B2</Text>
              <Text style={styles.motorType}>Negativo</Text>
            </View>
          </View>
        </View>

        {/* Control Principal */}
        <View style={styles.controlCard}>
          <View style={styles.powerSection}>
            <Text style={styles.powerLabel}>POTENCIA</Text>
            <View style={styles.powerValueContainer}>
              <Text style={styles.powerValue}>{unifiedValue}</Text>
              <Text style={styles.powerUnit}>/255</Text>
            </View>
          </View>

          {/* Barra de Progreso */}
          <View style={styles.progressContainer}>
            <View 
              style={[
                styles.progressBar,
                { width: `${(unifiedValue / 255) * 100}%` }
              ]} 
            />
          </View>

          {/* Controles */}
          <View style={styles.controlsRow}>
            <TouchableOpacity
              style={styles.controlBtn}
              onPress={onDecrement}
            >
              <Text style={styles.controlBtnText}>−</Text>
            </TouchableOpacity>

            <View style={styles.sliderContainer}>
              <Slider
                value={unifiedValue}
                minimumValue={0}
                maximumValue={255}
                step={1}
                onValueChange={(v) => onSliderChange(v[0])}
                minimumTrackTintColor="#10b981"
                maximumTrackTintColor="#e5e7eb"
                thumbTintColor="#059669"
                thumbStyle={styles.sliderThumb}
                trackStyle={styles.sliderTrack}
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>0</Text>
                <Text style={styles.sliderLabel}>127</Text>
                <Text style={styles.sliderLabel}>255</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.controlBtn}
              onPress={onIncrement}
            >
              <Text style={styles.controlBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Botón de Parada */}
          <TouchableOpacity 
            style={[
              styles.stopBtn,
              unifiedValue === 0 && styles.stopBtnDisabled
            ]} 
            onPress={onStop}
            disabled={unifiedValue === 0}
          >
            <Text style={styles.stopIcon}>🛑</Text>
            <Text style={styles.stopText}>DETENER MOTORES</Text>
          </TouchableOpacity>
        </View>

        {/* Detalles de Configuración Actual */}
        <View style={styles.detailsCard}>
          <Text style={styles.detailsTitle}>⚙️ Configuración Actual</Text>
          <View style={styles.motorDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Motor A1:</Text>
              <Text style={styles.detailValue}>
                {unifiedValue > 0 ? `IN1=${unifiedValue}, IN2=0` : "IN1=0, IN2=0"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Motor A2:</Text>
              <Text style={styles.detailValue}>
                {unifiedValue > 0 ? `IN1=0, IN2=${unifiedValue}` : "IN1=0, IN2=0"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Motor B1:</Text>
              <Text style={styles.detailValue}>
                {unifiedValue > 0 ? `IN1=0, IN2=${unifiedValue}` : "IN1=0, IN2=0"}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Motor B2:</Text>
              <Text style={styles.detailValue}>
                {unifiedValue > 0 ? `IN1=0, IN2=${unifiedValue}` : "IN1=0, IN2=0"}
              </Text>
            </View>
          </View>
        </View>

        {/* Información Adicional */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            Todos los motores funcionan simultáneamente con la misma potencia
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

// --- Estilos Mejorados ---
const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  container: {
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  headerIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  headerTexts: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  status: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  configCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  configIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  configTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  configDescription: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
  },
  motorConfig: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  motorItem: {
    alignItems: 'center',
    flex: 1,
  },
  motorLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 4,
  },
  motorType: {
    fontSize: 12,
    color: '#6b7280',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
  },
  controlCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  powerSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  powerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: 1,
    marginBottom: 8,
  },
  powerValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  powerValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#059669',
  },
  powerUnit: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '600',
    marginLeft: 4,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 24,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  controlBtnText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
  },
  sliderContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sliderThumb: {
    width: 28,
    height: 28,
    borderRadius: 14,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  stopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  stopBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  stopIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  stopText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  detailsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 16,
  },
  motorDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  detailLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#0369a1',
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },
});