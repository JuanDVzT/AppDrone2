import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PIDCalibration {
  kp: number;
  ki: number; 
  kd: number;
}

interface CalibrationValues {
  pitchPID: PIDCalibration;
  rollPID: PIDCalibration;
  yawPID: PIDCalibration;
  minThrottle: number;
  maxThrottle: number;
  baseThrottle: number;
  movementForce: {
    pitch: number;
    roll: number;
    yaw: number;
    throttleStep: number;
  };
  alpha: number;
  takeoffDuration: number;
}

const DEFAULT_CALIBRATION: CalibrationValues = {
  pitchPID: { kp: 1.5, ki: 0.0, kd: 0.8 },
  rollPID: { kp: 1.5, ki: 0.0, kd: 0.8 },
  yawPID: { kp: 1.0, ki: 0.0, kd: 0.3 },
  minThrottle: 130,
  maxThrottle: 255,
  baseThrottle: 170,
  movementForce: {
    pitch: 80,
    roll: 80,
    yaw: 100,
    throttleStep: 10
  },
  alpha: 0.96,
  takeoffDuration: 2000
};

type Props = {
  isVisible: boolean;
  onClose: (values: CalibrationValues) => void;
  onToggleTestMode: (enabled: boolean) => void;
  currentTestMode: boolean;
  isConnected?: boolean;
};

export default function CalibrationManager({ 
  isVisible, 
  onClose, 
  onToggleTestMode,
  currentTestMode,
  isConnected = false
}: Props) {
  const [calibration, setCalibration] = useState<CalibrationValues>(DEFAULT_CALIBRATION);
  const [isModified, setIsModified] = useState(false);

  useEffect(() => {
    if (isVisible) {
      loadCalibration();
    }
  }, [isVisible]);

  const loadCalibration = async () => {
    try {
      const saved = await AsyncStorage.getItem('drone_calibration');
      if (saved) {
        const parsed = JSON.parse(saved);
        setCalibration(parsed);
        console.log('Calibración cargada:', parsed);
      } else {
        setCalibration(DEFAULT_CALIBRATION);
      }
    } catch (error) {
      console.log('Error cargando calibración:', error);
      setCalibration(DEFAULT_CALIBRATION);
    }
  };

  const saveCalibration = async () => {
    try {
      await AsyncStorage.setItem('drone_calibration', JSON.stringify(calibration));
      console.log('Calibración guardada:', calibration);
      Alert.alert('Éxito', 'Calibración guardada correctamente');
      setIsModified(false);
    } catch (error) {
      console.log('Error guardando calibración:', error);
      Alert.alert('Error', 'No se pudo guardar la calibración');
    }
  };

  const resetToDefaults = () => {
    Alert.alert(
      'Restablecer Valores',
      '¿Volver a los valores por defecto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Restablecer', 
          style: 'destructive',
          onPress: () => {
            setCalibration(DEFAULT_CALIBRATION);
            setIsModified(true);
          }
        }
      ]
    );
  };

  const handleNumberChange = (path: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    
    const keys = path.split('.');
    setCalibration(prev => {
      const newCalibration = { ...prev };
      let current: any = newCalibration;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = numValue;
      return newCalibration;
    });
    
    setIsModified(true);
  };

  // Función eliminada ya que no se usa
  // const handleClose = () => {
  //   if (isModified) {
  //     Alert.alert(
  //       'Cambios sin guardar',
  //       '¿Guardar cambios antes de salir?',
  //       [
  //         { text: 'Descartar', style: 'destructive', onPress: () => onClose(calibration) },
  //         { text: 'Cancelar', style: 'cancel' },
  //         { text: 'Guardar', onPress: () => {
  //           saveCalibration();
  //           onClose(calibration);
  //         }}
  //       ]
  //     );
  //   } else {
  //     onClose(calibration);
  //   }
  // };

  if (!isVisible) return null;

  const CalibrationField = ({ 
    label, 
    path, 
    value, 
    description,
    min = 0,
    max = 100,
    step = 0.1
  }: {
    label: string;
    path: string;
    value: number;
    description: string;
    min?: number;
    max?: number;
    step?: number;
  }) => (
    <View style={styles.field}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue}>{value}</Text>
      </View>
      <Text style={styles.fieldDescription}>{description}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value.toString()}
          onChangeText={(text) => handleNumberChange(path, text)}
          keyboardType="numeric"
          placeholder={`${min}-${max}`}
        />
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => handleNumberChange(path, (value - step).toFixed(2))}
          >
            <Text style={styles.buttonText}>-</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.smallButton}
            onPress={() => handleNumberChange(path, (value + step).toFixed(2))}
          >
            <Text style={styles.buttonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Modo Admin - Calibración</Text>
      </View>

      <View style={[styles.connectionBanner, 
                   { backgroundColor: isConnected ? '#dcfce7' : '#fef3c7' }]}>
        <View style={[styles.statusIndicator, 
                     { backgroundColor: isConnected ? '#16a34a' : '#d97706' }]} />
        <Text style={[styles.connectionText, 
                     { color: isConnected ? '#166534' : '#92400e' }]}>
          {isConnected ? 'Conectado al ESP32' : 'Modo Offline - Los cambios se aplicarán al conectar'}
        </Text>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MODO TEST</Text>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Modo Test Activado</Text>
            <Switch
              value={currentTestMode}
              onValueChange={onToggleTestMode}
              trackColor={{ false: '#767577', true: '#81b0ff' }}
              thumbColor={currentTestMode ? '#f5dd4b' : '#f4f3f4'}
            />
          </View>
          <Text style={styles.sectionDescription}>
            Cuando está activado, simula conexión con ESP32 sin hardware real
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PID - ESTABILIZACIÓN</Text>
          
          <Text style={styles.subsectionTitle}>Pitch (Adelante/Atrás)</Text>
          <CalibrationField
            label="KP Pitch"
            path="pitchPID.kp"
            value={calibration.pitchPID.kp}
            description="Fuerza de corrección - Aumenta si responde lento, reduce si oscila"
            min={0.1}
            max={10}
            step={0.1}
          />
          <CalibrationField
            label="KI Pitch"
            path="pitchPID.ki"
            value={calibration.pitchPID.ki}
            description="Corrección error acumulado - Usar con cuidado, puede causar oscilaciones"
            min={0}
            max={1}
            step={0.01}
          />
          <CalibrationField
            label="KD Pitch"
            path="pitchPID.kd"
            value={calibration.pitchPID.kd}
            description="Amortiguación - Reduce oscilaciones, aumenta estabilidad"
            min={0}
            max={5}
            step={0.1}
          />

          <Text style={styles.subsectionTitle}>Roll (Izquierda/Derecha)</Text>
          <CalibrationField
            label="KP Roll"
            path="rollPID.kp"
            value={calibration.rollPID.kp}
            description="Misma función que KP Pitch pero para movimiento lateral"
            min={0.1}
            max={10}
            step={0.1}
          />
          <CalibrationField
            label="KI Roll"
            path="rollPID.ki"
            value={calibration.rollPID.ki}
            description="Integral para roll - Normalmente mantener en 0"
            min={0}
            max={1}
            step={0.01}
          />
          <CalibrationField
            label="KD Roll"
            path="rollPID.kd"
            value={calibration.rollPID.kd}
            description="Amortiguación lateral"
            min={0}
            max={5}
            step={0.1}
          />

          <Text style={styles.subsectionTitle}>Yaw (Rotación)</Text>
          <CalibrationField
            label="KP Yaw"
            path="yawPID.kp"
            value={calibration.yawPID.kp}
            description="Fuerza de corrección de rotación - Más suave que pitch/roll"
            min={0.1}
            max={5}
            step={0.1}
          />
          <CalibrationField
            label="KI Yaw"
            path="yawPID.ki"
            value={calibration.yawPID.ki}
            description="Corrección rotación acumulada - Muy poco normalmente"
            min={0}
            max={0.5}
            step={0.01}
          />
          <CalibrationField
            label="KD Yaw"
            path="yawPID.kd"
            value={calibration.yawPID.kd}
            description="Amortiguación de rotación"
            min={0}
            max={2}
            step={0.1}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>THROTTLE - ALTITUD</Text>
          <CalibrationField
            label="Throttle Mínimo"
            path="minThrottle"
            value={calibration.minThrottle}
            description="Velocidad mínima para que el dron levante (130-180)"
            min={100}
            max={200}
            step={1}
          />
          <CalibrationField
            label="Throttle Máximo"
            path="maxThrottle"
            value={calibration.maxThrottle}
            description="Velocidad máxima permitida para motores"
            min={200}
            max={255}
            step={1}
          />
          <CalibrationField
            label="Throttle Base"
            path="baseThrottle"
            value={calibration.baseThrottle}
            description="Velocidad después del despegue para vuelo estable"
            min={150}
            max={220}
            step={1}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONTROLES - SENSIBILIDAD</Text>
          <CalibrationField
            label="Fuerza Pitch"
            path="movementForce.pitch"
            value={calibration.movementForce.pitch}
            description="Sensibilidad al presionar ↑/↓ (50-150)"
            min={30}
            max={200}
            step={5}
          />
          <CalibrationField
            label="Fuerza Roll"
            path="movementForce.roll"
            value={calibration.movementForce.roll}
            description="Sensibilidad al presionar ←/→ (50-150)"
            min={30}
            max={200}
            step={5}
          />
          <CalibrationField
            label="Fuerza Yaw"
            path="movementForce.yaw"
            value={calibration.movementForce.yaw}
            description="Sensibilidad de rotación ↶/↷ (80-200)"
            min={50}
            max={255}
            step={5}
          />
          <CalibrationField
            label="Paso Throttle"
            path="movementForce.throttleStep"
            value={calibration.movementForce.throttleStep}
            description="Incremento al presionar ▲/▼ (5-25)"
            min={1}
            max={30}
            step={1}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>AVANZADO</Text>
          <CalibrationField
            label="Filtro Alpha"
            path="alpha"
            value={calibration.alpha}
            description="Filtro complementario (0.90-0.98) - Más alto = más giroscopio"
            min={0.9}
            max={0.98}
            step={0.01}
          />
          <CalibrationField
            label="Duración Despegue"
            path="takeoffDuration"
            value={calibration.takeoffDuration}
            description="Tiempo despegue automático en ms (1000-5000)"
            min={1000}
            max={5000}
            step={100}
          />
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.resetButton]} 
            onPress={resetToDefaults}
          >
            <Text style={styles.actionButtonText}>Restablecer Valores</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.saveButton]} 
            onPress={saveCalibration}
            disabled={!isModified}
          >
            <Text style={[styles.actionButtonText, !isModified && styles.disabledText]}>
              Guardar Calibración
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            💡 Ajusta progresivamente y prueba después de cada cambio
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e293b',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
    marginBottom: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  switchLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  field: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#059669',
  },
  fieldDescription: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    padding: 8,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  buttonGroup: {
    flexDirection: 'row',
  },
  smallButton: {
    width: 36,
    height: 36,
    backgroundColor: '#3b82f6',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  resetButton: {
    backgroundColor: '#f59e0b',
  },
  saveButton: {
    backgroundColor: '#059669',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  disabledText: {
    color: '#9ca3af',
  },
  footer: {
    padding: 12,
    backgroundColor: '#dbeafe',
    borderRadius: 6,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 12,
    color: '#1e40af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});