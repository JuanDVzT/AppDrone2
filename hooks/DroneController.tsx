import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';

type Props = {
  ws: WebSocket | null;
  isConnected: boolean;
};

// Configuración fija de motores según tu hardware
const MOTOR_CONFIG = {
  A1: { in1: "A1_IN1", in2: "A1_IN2", direction: 1 },    // Positivo
  A2: { in1: "A2_IN1", in2: "A2_IN2", direction: -1 },   // Negativo  
  B1: { in1: "B1_IN1", in2: "B1_IN2", direction: -1 },   // Negativo
  B2: { in1: "B2_IN1", in2: "B2_IN2", direction: -1 },   // Negativo
};

// Constantes de control
const CONTROL_CONSTANTS = {
  THROTTLE: {
    MIN: 0,
    MAX: 255,
    STEP: 10,
    DEFAULT: 0
  },
  MOVEMENT: {
    PITCH_FORCE: 80,
    ROLL_FORCE: 80, 
    YAW_FORCE: 100,
    NEUTRAL: 0
  }
};

type MotorSpeeds = {
  A1: number;
  A2: number;
  B1: number;
  B2: number;
};

type MovementState = {
  throttle: number;
  pitch: number;
  roll: number;
  yaw: number;
};

export default function DroneController({ ws, isConnected }: Props) {
  // Estado único para todo el movimiento
  const [movement, setMovement] = useState<MovementState>({
    throttle: CONTROL_CONSTANTS.THROTTLE.DEFAULT,
    pitch: CONTROL_CONSTANTS.MOVEMENT.NEUTRAL,
    roll: CONTROL_CONSTANTS.MOVEMENT.NEUTRAL,
    yaw: CONTROL_CONSTANTS.MOVEMENT.NEUTRAL
  });

  const movementRef = useRef(movement);
  const sendIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sincronizar ref con estado
  useEffect(() => {
    movementRef.current = movement;
  }, [movement]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      stopSendingCommands();
      sendAllMotorsStop();
    };
  }, []);

  // ===== FUNCIONES DE CONTROL DE MOTORES =====
  
  const sendMotorCommand = (motorId: keyof typeof MOTOR_CONFIG, speed: number) => {
    if (!ws || !isConnected) return;

    const motor = MOTOR_CONFIG[motorId];
    const direction = motor.direction;
    const adjustedSpeed = speed * direction;
    
    // Enviar comando según dirección
    if (adjustedSpeed > 0) {
      ws.send(`${motor.in1}:${Math.abs(adjustedSpeed)}`);
      ws.send(`${motor.in2}:0`);
    } else if (adjustedSpeed < 0) {
      ws.send(`${motor.in1}:0`);
      ws.send(`${motor.in2}:${Math.abs(adjustedSpeed)}`);
    } else {
      ws.send(`${motor.in1}:0`);
      ws.send(`${motor.in2}:0`);
    }
  };

  const sendAllMotorsStop = () => {
    Object.keys(MOTOR_CONFIG).forEach(motorId => {
      sendMotorCommand(motorId as keyof typeof MOTOR_CONFIG, 0);
    });
  };

  // ===== CÁLCULO DE VELOCIDADES DE MOTORES =====

  const calculateMotorSpeeds = (throttle: number, pitch: number, roll: number, yaw: number): MotorSpeeds => {
    // Fórmula básica de mezcla para cuadricóptero X
    const base = throttle;
    
    return {
      // Delantero izquierdo
      A1: base + pitch + roll + yaw,
      // Delantero derecho  
      A2: base + pitch - roll - yaw,
      // Trasero izquierdo
      B1: base - pitch + roll - yaw,
      // Trasero derecho
      B2: base - pitch - roll + yaw
    };
  };

  const clampMotorSpeeds = (speeds: MotorSpeeds): MotorSpeeds => {
    const clamped: MotorSpeeds = { ...speeds };
    
    Object.keys(speeds).forEach(motorId => {
      const key = motorId as keyof MotorSpeeds;
      clamped[key] = Math.max(0, Math.min(255, Math.round(speeds[key])));
    });
    
    return clamped;
  };

  // ===== ENVÍO DE COMANDOS =====

  const sendMovementCommands = () => {
    if (!ws || !isConnected) return;

    const { throttle, pitch, roll, yaw } = movementRef.current;
    
    // Calcular velocidades
    const rawSpeeds = calculateMotorSpeeds(throttle, pitch, roll, yaw);
    const clampedSpeeds = clampMotorSpeeds(rawSpeeds);
    
    // Enviar comandos a cada motor
    Object.entries(clampedSpeeds).forEach(([motorId, speed]) => {
      sendMotorCommand(motorId as keyof typeof MOTOR_CONFIG, speed);
    });

    console.log('Motors:', clampedSpeeds, 'Movement:', { throttle, pitch, roll, yaw });
  };

  const startSendingCommands = () => {
    if (sendIntervalRef.current) return;
    
    sendIntervalRef.current = setInterval(() => {
      sendMovementCommands();
    }, 100);
  };

  const stopSendingCommands = () => {
    if (sendIntervalRef.current) {
      clearInterval(sendIntervalRef.current);
      sendIntervalRef.current = null;
    }
  };

  // ===== HANDLERS DE CONTROLES =====

  const updateMovement = (updates: Partial<MovementState>) => {
    setMovement(prev => ({ ...prev, ...updates }));
  };

  const handleThrottleChange = (change: number) => {
    setMovement(prev => {
      const newThrottle = Math.max(
        CONTROL_CONSTANTS.THROTTLE.MIN,
        Math.min(CONTROL_CONSTANTS.THROTTLE.MAX, prev.throttle + change)
      );
      
      return { ...prev, throttle: newThrottle };
    });
  };

  const handleDirectionPress = (direction: 'forward' | 'backward' | 'left' | 'right') => {
    const updates: Partial<MovementState> = {};
    
    switch (direction) {
      case 'forward':
        updates.pitch = CONTROL_CONSTANTS.MOVEMENT.PITCH_FORCE;
        break;
      case 'backward':
        updates.pitch = -CONTROL_CONSTANTS.MOVEMENT.PITCH_FORCE;
        break;
      case 'left':
        updates.roll = -CONTROL_CONSTANTS.MOVEMENT.ROLL_FORCE;
        break;
      case 'right':
        updates.roll = CONTROL_CONSTANTS.MOVEMENT.ROLL_FORCE;
        break;
    }
    
    updateMovement(updates);
    if (!sendIntervalRef.current) {
      startSendingCommands();
    }
  };

  const handleDirectionRelease = (axis: 'pitch' | 'roll') => {
    updateMovement({ [axis]: CONTROL_CONSTANTS.MOVEMENT.NEUTRAL });
  };

  const handleYawPress = (direction: 'left' | 'right') => {
    const yaw = direction === 'left' 
      ? -CONTROL_CONSTANTS.MOVEMENT.YAW_FORCE 
      : CONTROL_CONSTANTS.MOVEMENT.YAW_FORCE;
    
    updateMovement({ yaw });
    if (!sendIntervalRef.current) {
      startSendingCommands();
    }
  };

  const handleYawRelease = () => {
    updateMovement({ yaw: CONTROL_CONSTANTS.MOVEMENT.NEUTRAL });
  };

  const handleTakeOff = () => {
    Alert.alert(
      "Despegar",
      "¿Iniciar secuencia de despegue?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Despegar", 
          onPress: () => {
            const takeoffThrottle = 120;
            updateMovement({ 
              throttle: takeoffThrottle,
              pitch: 0,
              roll: 0, 
              yaw: 0
            });
            startSendingCommands();
          }
        }
      ]
    );
  };

  const handleLand = () => {
    updateMovement({ 
      throttle: 0,
      pitch: 0,
      roll: 0,
      yaw: 0
    });
    stopSendingCommands();
    sendAllMotorsStop();
  };

  const handleEmergencyStop = () => {
    Alert.alert(
      "PARADA DE EMERGENCIA",
      "¿Detener motores inmediatamente?",
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "DETENER", 
          style: "destructive",
          onPress: () => {
            updateMovement({ 
              throttle: 0,
              pitch: 0,
              roll: 0,
              yaw: 0
            });
            stopSendingCommands();
            sendAllMotorsStop();
          }
        }
      ]
    );
  };

  const handleResetThrottle = () => {
    updateMovement({ throttle: 0 });
  };

  // ===== RENDER =====

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Control de Dron</Text>
      
      <View style={styles.connectionStatus}>
        <View 
          style={[
            styles.statusIndicator, 
            { backgroundColor: isConnected ? '#22c55e' : '#ef4444' }
          ]} 
        />
        <Text style={styles.statusText}>
          {isConnected ? 'CONECTADO' : 'DESCONECTADO'}
        </Text>
      </View>

      {/* THROTTLE CONTROL */}
      <View style={styles.throttleSection}>
        <View style={styles.throttleHeader}>
          <Text style={styles.sectionTitle}>ALTITUD: {movement.throttle}</Text>
          <TouchableOpacity
            style={styles.resetThrottleBtn}
            onPress={handleResetThrottle}
            disabled={!isConnected}
          >
            <Text style={styles.resetThrottleText}>RESET</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.throttleDisplay}>
          <Text style={styles.throttleValue}>{movement.throttle}</Text>
          <View style={styles.throttleBar}>
            <View 
              style={[
                styles.throttleFill,
                { height: `${(movement.throttle / 255) * 100}%` }
              ]} 
            />
          </View>
        </View>

        <View style={styles.altitudeButtons}>
          <TouchableOpacity
            style={[styles.altitudeBtn, styles.upBtn]}
            onPressIn={() => handleThrottleChange(CONTROL_CONSTANTS.THROTTLE.STEP)}
            disabled={!isConnected}
          >
            <Text style={styles.altitudeText}>▲ SUBIR</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.altitudeBtn, styles.downBtn]}
            onPressIn={() => handleThrottleChange(-CONTROL_CONSTANTS.THROTTLE.STEP)}
            disabled={!isConnected}
          >
            <Text style={styles.altitudeText}>▼ BAJAR</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* DIRECTION CONTROL */}
      <View style={styles.directionSection}>
        <Text style={styles.sectionTitle}>DIRECCIÓN</Text>
        
        <View style={styles.dpadContainer}>
          <View style={styles.dpadRow}>
            <TouchableOpacity
              style={[styles.dpadBtn, styles.forwardBtn]}
              onPressIn={() => handleDirectionPress('forward')}
              onPressOut={() => handleDirectionRelease('pitch')}
              disabled={!isConnected}
            >
              <Text style={styles.dpadText}>↑</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.dpadRow}>
            <TouchableOpacity
              style={[styles.dpadBtn, styles.leftBtn]}
              onPressIn={() => handleDirectionPress('left')}
              onPressOut={() => handleDirectionRelease('roll')}
              disabled={!isConnected}
            >
              <Text style={styles.dpadText}>←</Text>
            </TouchableOpacity>
            
            <View style={styles.dpadCenter} />
            
            <TouchableOpacity
              style={[styles.dpadBtn, styles.rightBtn]}
              onPressIn={() => handleDirectionPress('right')}
              onPressOut={() => handleDirectionRelease('roll')}
              disabled={!isConnected}
            >
              <Text style={styles.dpadText}>→</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.dpadRow}>
            <TouchableOpacity
              style={[styles.dpadBtn, styles.backwardBtn]}
              onPressIn={() => handleDirectionPress('backward')}
              onPressOut={() => handleDirectionRelease('pitch')}
              disabled={!isConnected}
            >
              <Text style={styles.dpadText}>↓</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.yawContainer}>
          <Text style={styles.yawLabel}>ROTACIÓN</Text>
          <View style={styles.yawButtons}>
            <TouchableOpacity
              style={[styles.yawBtn, styles.yawLeftBtn]}
              onPressIn={() => handleYawPress('left')}
              onPressOut={handleYawRelease}
              disabled={!isConnected}
            >
              <Text style={styles.yawText}>↶ IZQ</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.yawBtn, styles.yawRightBtn]}
              onPressIn={() => handleYawPress('right')}
              onPressOut={handleYawRelease}
              disabled={!isConnected}
            >
              <Text style={styles.yawText}>DER ↷</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* FLIGHT COMMANDS */}
      <View style={styles.flightCommands}>
        <TouchableOpacity
          style={[styles.commandBtn, styles.takeoffBtn]}
          onPress={handleTakeOff}
          disabled={!isConnected}
        >
          <Text style={styles.commandText}>DESPEGAR</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.commandBtn, styles.landBtn]}
          onPress={handleLand}
          disabled={!isConnected}
        >
          <Text style={styles.commandText}>ATERRIZAR</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.commandBtn, styles.emergencyBtn]}
          onPress={handleEmergencyStop}
        >
          <Text style={styles.commandText}>🛑 EMERGENCIA</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoPanel}>
        <Text style={styles.infoText}>
          Throttle: {movement.throttle} | Pitch: {movement.pitch} | Roll: {movement.roll} | Yaw: {movement.yaw}
        </Text>
        <Text style={styles.infoHint}>
          Mantén presionados los botones para mover el dron
        </Text>
      </View>
    </View>
  );
}

// Estilos (los mismos que antes)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8fafc',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#1e293b',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  throttleSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
  },
  throttleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resetThrottleBtn: {
    backgroundColor: '#6b7280',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  resetThrottleText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  throttleDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 16,
  },
  throttleValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#059669',
    minWidth: 50,
    textAlign: 'center',
  },
  throttleBar: {
    width: 30,
    height: 120,
    backgroundColor: '#e2e8f0',
    borderRadius: 15,
    overflow: 'hidden',
  },
  throttleFill: {
    width: '100%',
    backgroundColor: '#10b981',
    position: 'absolute',
    bottom: 0,
  },
  altitudeButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  altitudeBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 3,
    maxWidth: 150,
  },
  upBtn: {
    backgroundColor: '#10b981',
  },
  downBtn: {
    backgroundColor: '#ef4444',
  },
  altitudeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  directionSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
    textAlign: 'center',
  },
  dpadContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  dpadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
    elevation: 4,
  },
  forwardBtn: {
    backgroundColor: '#3b82f6',
  },
  backwardBtn: {
    backgroundColor: '#3b82f6',
  },
  leftBtn: {
    backgroundColor: '#3b82f6',
  },
  rightBtn: {
    backgroundColor: '#3b82f6',
  },
  dpadCenter: {
    width: 70,
    height: 70,
    margin: 4,
  },
  dpadText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  yawContainer: {
    alignItems: 'center',
  },
  yawLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  yawButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  yawBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 3,
  },
  yawLeftBtn: {
    backgroundColor: '#f59e0b',
  },
  yawRightBtn: {
    backgroundColor: '#f59e0b',
  },
  yawText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  flightCommands: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  commandBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    elevation: 2,
    minWidth: 100,
  },
  takeoffBtn: {
    backgroundColor: '#059669',
  },
  landBtn: {
    backgroundColor: '#f59e0b',
  },
  emergencyBtn: {
    backgroundColor: '#dc2626',
  },
  commandText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
  infoPanel: {
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 1,
  },
  infoText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 4,
  },
  infoHint: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});