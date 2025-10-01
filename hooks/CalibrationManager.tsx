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

// Implementación simple sin AsyncStorage
const LocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.log('Error getting from storage:', error);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.log('Error setting to storage:', error);
    }
  }
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

  const loadCalibration = () => {
    try {
      const saved = LocalStorage.getItem('drone_calibration');
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

  const saveCalibration = () => {
    try {
      LocalStorage.setItem('drone_calibration', JSON.stringify(calibration));
      console.log('Calibración guardada:', calibration);
      Alert.alert('✅ Éxito', 'Calibración guardada correctamente');
      setIsModified(false);
      onClose(calibration);
    } catch (error) {
      console.log('Error guardando calibración:', error);
      Alert.alert('❌ Error', 'No se pudo guardar la calibración');
    }
  };

  const resetToDefaults = () => {
    Alert.alert(
      '🔄 Restablecer Valores',
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
    <View style={styles.fieldCard}>
      <View style={styles.fieldHeader}>
        <View style={styles.fieldTitle}>
          <Text style={styles.fieldLabel}>{label}</Text>
          <Text style={styles.fieldValue}>{value}</Text>
        </View>
        <Text style={styles.fieldDescription}>{description}</Text>
      </View>
      
      <View style={styles.controlsRow}>
        <TextInput
          style={styles.input}
          value={value.toString()}
          onChangeText={(text) => handleNumberChange(path, text)}
          keyboardType="numeric"
          placeholder={`${min}-${max}`}
        />
        <View style={styles.controlButtons}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => handleNumberChange(path, (value - step).toFixed(2))}
          >
            <Text style={styles.controlButtonText}>−</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => handleNumberChange(path, (value + step).toFixed(2))}
          >
            <Text style={styles.controlButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Mejorado */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>⚙️</Text>
          <View style={styles.headerTexts}>
            <Text style={styles.title}>Modo Admin - Calibración</Text>
            <Text style={styles.subtitle}>Ajuste fino de parámetros del dron</Text>
          </View>
        </View>
      </View>

      {/* Banner de Estado */}
      <View style={[styles.connectionBanner, 
                   { backgroundColor: isConnected ? '#dcfce7' : '#fef3c7' }]}>
        <View style={[styles.statusIndicator, 
                     { backgroundColor: isConnected ? '#16a34a' : '#d97706' }]} />
        <Text style={[styles.connectionText, 
                     { color: isConnected ? '#166534' : '#92400e' }]}>
          {isConnected ? '✅ Conectado al ESP32' : '⚠️ Modo Offline - Los cambios se aplicarán al conectar'}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Sección Modo Test */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🧪</Text>
            <Text style={styles.sectionTitle}>MODO TEST</Text>
          </View>
          <View style={styles.switchCard}>
            <View style={styles.switchContent}>
              <Text style={styles.switchLabel}>Modo Test Activado</Text>
              <Text style={styles.switchDescription}>
                Simula conexión con ESP32 sin hardware real
              </Text>
            </View>
            <Switch
              value={currentTestMode}
              onValueChange={onToggleTestMode}
              trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
              thumbColor={currentTestMode ? '#3b82f6' : '#f8fafc'}
              ios_backgroundColor="#cbd5e1"
            />
          </View>
        </View>

        {/* Sección PID */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🎯</Text>
            <Text style={styles.sectionTitle}>PID - ESTABILIZACIÓN</Text>
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>📊 Pitch (Adelante/Atrás)</Text>
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
              description="Corrección error acumulado - Usar con cuidado"
              min={0}
              max={1}
              step={0.01}
            />
            <CalibrationField
              label="KD Pitch"
              path="pitchPID.kd"
              value={calibration.pitchPID.kd}
              description="Amortiguación - Reduce oscilaciones"
              min={0}
              max={5}
              step={0.1}
            />
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>📊 Roll (Izquierda/Derecha)</Text>
            <CalibrationField
              label="KP Roll"
              path="rollPID.kp"
              value={calibration.rollPID.kp}
              description="Fuerza de corrección lateral"
              min={0.1}
              max={10}
              step={0.1}
            />
            <CalibrationField
              label="KI Roll"
              path="rollPID.ki"
              value={calibration.rollPID.ki}
              description="Integral para movimiento lateral"
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
          </View>

          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>🔄 Yaw (Rotación)</Text>
            <CalibrationField
              label="KP Yaw"
              path="yawPID.kp"
              value={calibration.yawPID.kp}
              description="Fuerza de corrección de rotación"
              min={0.1}
              max={5}
              step={0.1}
            />
            <CalibrationField
              label="KI Yaw"
              path="yawPID.ki"
              value={calibration.yawPID.ki}
              description="Corrección rotación acumulada"
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
        </View>

        {/* Sección Throttle */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>📈</Text>
            <Text style={styles.sectionTitle}>THROTTLE - ALTITUD</Text>
          </View>
          <CalibrationField
            label="Throttle Mínimo"
            path="minThrottle"
            value={calibration.minThrottle}
            description="Velocidad mínima para despegue (130-180)"
            min={100}
            max={200}
            step={1}
          />
          <CalibrationField
            label="Throttle Máximo"
            path="maxThrottle"
            value={calibration.maxThrottle}
            description="Velocidad máxima permitida"
            min={200}
            max={255}
            step={1}
          />
          <CalibrationField
            label="Throttle Base"
            path="baseThrottle"
            value={calibration.baseThrottle}
            description="Velocidad después del despegue"
            min={150}
            max={220}
            step={1}
          />
        </View>

        {/* Sección Controles */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🎮</Text>
            <Text style={styles.sectionTitle}>CONTROLES - SENSIBILIDAD</Text>
          </View>
          <CalibrationField
            label="Fuerza Pitch"
            path="movementForce.pitch"
            value={calibration.movementForce.pitch}
            description="Sensibilidad al presionar ↑/↓"
            min={30}
            max={200}
            step={5}
          />
          <CalibrationField
            label="Fuerza Roll"
            path="movementForce.roll"
            value={calibration.movementForce.roll}
            description="Sensibilidad al presionar ←/→"
            min={30}
            max={200}
            step={5}
          />
          <CalibrationField
            label="Fuerza Yaw"
            path="movementForce.yaw"
            value={calibration.movementForce.yaw}
            description="Sensibilidad de rotación ↶/↷"
            min={50}
            max={255}
            step={5}
          />
          <CalibrationField
            label="Paso Throttle"
            path="movementForce.throttleStep"
            value={calibration.movementForce.throttleStep}
            description="Incremento al presionar ▲/▼"
            min={1}
            max={30}
            step={1}
          />
        </View>

        {/* Sección Avanzado */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionIcon}>🔧</Text>
            <Text style={styles.sectionTitle}>AVANZADO</Text>
          </View>
          <CalibrationField
            label="Filtro Alpha"
            path="alpha"
            value={calibration.alpha}
            description="Filtro complementario (0.90-0.98)"
            min={0.9}
            max={0.98}
            step={0.01}
          />
          <CalibrationField
            label="Duración Despegue"
            path="takeoffDuration"
            value={calibration.takeoffDuration}
            description="Tiempo despegue automático (ms)"
            min={1000}
            max={5000}
            step={100}
          />
        </View>

        {/* Botones de Acción */}
        <View style={styles.actionSection}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.resetButton]} 
            onPress={resetToDefaults}
          >
            <Text style={styles.actionButtonIcon}>🔄</Text>
            <Text style={styles.actionButtonText}>Restablecer Valores</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.saveButton, !isModified && styles.disabledButton]} 
            onPress={saveCalibration}
            disabled={!isModified}
          >
            <Text style={styles.actionButtonIcon}>💾</Text>
            <Text style={[styles.actionButtonText, !isModified && styles.disabledText]}>
              Guardar Calibración
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer Informativo */}
        <View style={styles.footer}>
          <Text style={styles.footerIcon}>💡</Text>
          <Text style={styles.footerText}>
            Ajusta progresivamente y prueba después de cada cambio
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
    backgroundColor: '#4f46e5',
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  headerTexts: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#e0e7ff',
    fontWeight: '500',
  },
  connectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  connectionText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
  },
  switchCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  switchContent: {
    flex: 1,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 12,
    color: '#64748b',
  },
  subsection: {
    marginBottom: 8,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    marginTop: 8,
  },
  fieldCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fieldHeader: {
    marginBottom: 12,
  },
  fieldTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#059669',
  },
  fieldDescription: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    backgroundColor: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  controlButtons: {
    flexDirection: 'row',
  },
  controlButton: {
    width: 44,
    height: 44,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  controlButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  actionSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
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
  resetButton: {
    backgroundColor: '#f59e0b',
  },
  saveButton: {
    backgroundColor: '#059669',
  },
  disabledButton: {
    backgroundColor: '#cbd5e1',
  },
  actionButtonIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  disabledText: {
    color: '#94a3b8',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  footerIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  footerText: {
    fontSize: 14,
    color: '#1e40af',
    fontWeight: '500',
    flex: 1,
    fontStyle: 'italic',
  },
});