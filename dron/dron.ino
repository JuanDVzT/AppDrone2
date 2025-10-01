#include <WiFi.h>
#include <WiFiUdp.h>
#include <WebSocketsServer.h>
#include <Wire.h>
#include <MPU6050.h>
#include <ArduinoJson.h>

// === CONFIGURACIÓN DE PINES ===
#define A1_IN1 12
#define A1_IN2 13
#define A2_IN1 27
#define A2_IN2 14
#define B1_IN1 25
#define B1_IN2 26
#define B2_IN1 33
#define B2_IN2 32

// === CONFIGURACIÓN WiFi ===
const char* ssid = "Alexis";
const char* password = "58036136";

WiFiUDP udp;
WebSocketsServer webSocket = WebSocketsServer(81);
const int udpPort = 4210;

// === ESTRUCTURAS PARA CALIBRACIÓN ===
struct PIDCalibration {
  float kp;
  float ki;
  float kd;
};

struct CalibrationData {
  PIDCalibration pitchPID;
  PIDCalibration rollPID;
  PIDCalibration yawPID;
  int minThrottle;
  int maxThrottle;
  int baseThrottle;
  int movementForcePitch;
  int movementForceRoll;
  int movementForceYaw;
  int throttleStep;
  float alpha;
  int takeoffDuration;
};

// === MPU6050 Y ESTABILIZACIÓN ===
MPU6050 mpu;

// Variables de ángulos y control
float angleX = 0, angleY = 0, angleZ = 0;
float accAngleX, accAngleY;
float gyroRateX, gyroRateY, gyroRateZ;
unsigned long lastTime = 0;
float dt;

// PID para los 3 ejes
float prevErrorX = 0, integralX = 0;
float prevErrorY = 0, integralY = 0;
float prevErrorZ = 0, integralZ = 0;

// Constantes PID (se sobreescriben con calibración)
float KP_PITCH = 1.5;
float KI_PITCH = 0.0;
float KD_PITCH = 0.8;

float KP_ROLL = 1.5;
float KI_ROLL = 0.0;
float KD_ROLL = 0.8;

float KP_YAW = 1.0;
float KI_YAW = 0.0;
float KD_YAW = 0.3;

float ALPHA = 0.96;

// Estados del dron
enum DroneState { IDLE, TAKING_OFF, FLYING, LANDING };
DroneState droneState = IDLE;
unsigned long stateStartTime = 0;
int TAKEOFF_DURATION = 2000;

// Control de motores y movimientos
int baseThrottle = 0;
int pitchCommand = 0;
int rollCommand = 0;
int yawCommand = 0;

int MIN_THROTTLE = 130;
int MAX_THROTTLE = 255;
int BASE_THROTTLE = 170;
#define TARGET_ANGLE 0

// Yaw tracking
float initialYaw = 0;
bool yawInitialized = false;

// Variables WiFi
unsigned long lastBroadcast = 0;
unsigned long lastWifiCheck = 0;
const unsigned long broadcastIntervalDisconnected = 1000;
const unsigned long wifiCheckInterval = 5000;
bool wsConnected = false;
bool wifiConnected = false;

// Mapeo de nombres a pines
struct PinMap {
  const char* name;
  uint8_t pin;
};

PinMap pinMap[] = {
  {"A1_IN1", A1_IN1},
  {"A1_IN2", A1_IN2},
  {"A2_IN1", A2_IN1},
  {"A2_IN2", A2_IN2},
  {"B1_IN1", B1_IN1},
  {"B1_IN2", B1_IN2},
  {"B2_IN1", B2_IN1},
  {"B2_IN2", B2_IN2},
};

// === FUNCIONES AUXILIARES ===
uint8_t findPinByName(const String& name) {
  for (auto &pm : pinMap) {
    if (name.equalsIgnoreCase(pm.name)) {
      return pm.pin;
    }
  }
  return 255;
}

void apagarMotoresProgresivo() {
  for (int p = 255; p >= 0; p -= 5) {
    for (auto &pm : pinMap) {
      analogWrite(pm.pin, 0);
    }
    delay(20);
  }
}

// === FUNCIONES DE CALIBRACIÓN ===
void applyCalibration(const CalibrationData& calib) {
  // Aplicar PID
  KP_PITCH = calib.pitchPID.kp;
  KI_PITCH = calib.pitchPID.ki;
  KD_PITCH = calib.pitchPID.kd;
  
  KP_ROLL = calib.rollPID.kp;
  KI_ROLL = calib.rollPID.ki;
  KD_ROLL = calib.rollPID.kd;
  
  KP_YAW = calib.yawPID.kp;
  KI_YAW = calib.yawPID.ki;
  KD_YAW = calib.yawPID.kd;
  
  // Aplicar throttle
  MIN_THROTTLE = calib.minThrottle;
  MAX_THROTTLE = calib.maxThrottle;
  BASE_THROTTLE = calib.baseThrottle;
  
  // Aplicar filtro y tiempos
  ALPHA = calib.alpha;
  TAKEOFF_DURATION = calib.takeoffDuration;
  
  Serial.println("=== CALIBRACIÓN APLICADA ===");
  Serial.printf("PID Pitch: KP=%.2f KI=%.2f KD=%.2f\n", KP_PITCH, KI_PITCH, KD_PITCH);
  Serial.printf("PID Roll: KP=%.2f KI=%.2f KD=%.2f\n", KP_ROLL, KI_ROLL, KD_ROLL);
  Serial.printf("PID Yaw: KP=%.2f KI=%.2f KD=%.2f\n", KP_YAW, KI_YAW, KD_YAW);
  Serial.printf("Throttle: min=%d max=%d base=%d\n", MIN_THROTTLE, MAX_THROTTLE, BASE_THROTTLE);
  Serial.printf("Alpha: %.2f, Takeoff: %dms\n", ALPHA, TAKEOFF_DURATION);
  Serial.println("============================");
}

// === FUNCIONES DE ESTABILIZACIÓN ===
void initMPU6050() {
  Wire.begin();
  mpu.initialize();
  
  if (mpu.testConnection()) {
    Serial.println("MPU6050 conectado correctamente");
  } else {
    Serial.println("ERROR: MPU6050 no conectado");
    while(1);
  }
  
  mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_250);
  mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_2);
  
  delay(100);
  calibrateSensors();
}

void calibrateSensors() {
  Serial.println("Calibrando sensores... No mover el dron!");
  delay(2000);
  
  long gyroXOffset = 0, gyroYOffset = 0, gyroZOffset = 0;
  
  for(int i = 0; i < 200; i++) {
    int16_t gx, gy, gz;
    mpu.getRotation(&gx, &gy, &gz);
    gyroXOffset += gx;
    gyroYOffset += gy;
    gyroZOffset += gz;
    delay(10);
  }
  
  gyroXOffset /= 200;
  gyroYOffset /= 200; 
  gyroZOffset /= 200;
  
  Serial.printf("Offsets: X=%ld Y=%ld Z=%ld\n", gyroXOffset, gyroYOffset, gyroZOffset);
}

void readMPU6050() {
  int16_t ax, ay, az, gx, gy, gz;
  
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
  
  // Aplicar offsets (ajustar según calibración)
  gx -= 0;
  gy -= 0;
  gz -= 0;
  
  float accX = ax / 16384.0;
  float accY = ay / 16384.0; 
  float accZ = az / 16384.0;
  
  gyroRateX = gx / 131.0;
  gyroRateY = gy / 131.0;
  gyroRateZ = gz / 131.0;
  
  accAngleX = atan2(accY, accZ) * 180/PI;
  accAngleY = atan2(accX, accZ) * 180/PI;
}

void calculateAngles() {
  unsigned long currentTime = micros();
  dt = (currentTime - lastTime) / 1000000.0;
  lastTime = currentTime;
  
  angleX = ALPHA * (angleX + gyroRateX * dt) + (1 - ALPHA) * accAngleX;
  angleY = ALPHA * (angleY + gyroRateY * dt) + (1 - ALPHA) * accAngleY;
  angleZ += gyroRateZ * dt;
  
  if (!yawInitialized && droneState != IDLE) {
    initialYaw = angleZ;
    yawInitialized = true;
  }
}

float computePID(float angle, float target, float *prevError, float *integral, float kp, float ki, float kd) {
  float error = target - angle;
  *integral += error * dt;
  float derivative = (error - *prevError) / dt;
  *prevError = error;
  
  *integral = constrain(*integral, -200, 200);
  
  return kp * error + ki * (*integral) + kd * derivative;
}

void stabilizeDrone() {
  if (droneState != FLYING && droneState != TAKING_OFF) return;
  
  readMPU6050();
  calculateAngles();
  
  float pitchStabilization = computePID(angleX, TARGET_ANGLE + pitchCommand/100.0, &prevErrorX, &integralX, KP_PITCH, KI_PITCH, KD_PITCH);
  float rollStabilization = computePID(angleY, TARGET_ANGLE + rollCommand/100.0, &prevErrorY, &integralY, KP_ROLL, KI_ROLL, KD_ROLL);
  float targetYaw = initialYaw + (yawCommand * 0.1);
  float yawStabilization = computePID(angleZ, targetYaw, &prevErrorZ, &integralZ, KP_YAW, KI_YAW, KD_YAW);
  
  int m1 = baseThrottle + pitchStabilization - rollStabilization - yawStabilization;
  int m2 = baseThrottle + pitchStabilization + rollStabilization + yawStabilization;
  int m3 = baseThrottle - pitchStabilization + rollStabilization - yawStabilization;
  int m4 = baseThrottle - pitchStabilization - rollStabilization + yawStabilization;
  
  m1 = constrain(m1, 0, 255);
  m2 = constrain(m2, 0, 255);
  m3 = constrain(m3, 0, 255);
  m4 = constrain(m4, 0, 255);
  
  analogWrite(A1_IN1, m1); analogWrite(A1_IN2, 0);
  analogWrite(A2_IN1, m2); analogWrite(A2_IN2, 0);
  analogWrite(B1_IN1, m3); analogWrite(B1_IN2, 0);
  analogWrite(B2_IN1, m4); analogWrite(B2_IN2, 0);
  
  Serial.printf("Angles: X=%.1f Y=%.1f Z=%.1f | Cmd: P=%d R=%d Y=%d | Motors: %d %d %d %d\n", 
                angleX, angleY, angleZ, pitchCommand, rollCommand, yawCommand, m1, m2, m3, m4);
}

void setMovementCommand(int pitch, int roll, int yaw) {
  pitchCommand = constrain(pitch, -255, 255);
  rollCommand = constrain(roll, -255, 255);
  yawCommand = constrain(yaw, -255, 255);
}

void setDroneState(DroneState newState) {
  droneState = newState;
  stateStartTime = millis();
  
  switch(droneState) {
    case IDLE:
      baseThrottle = 0;
      pitchCommand = 0; rollCommand = 0; yawCommand = 0;
      integralX = 0; integralY = 0; integralZ = 0;
      prevErrorX = 0; prevErrorY = 0; prevErrorZ = 0;
      yawInitialized = false;
      apagarMotoresProgresivo();
      break;
      
    case TAKING_OFF:
      baseThrottle = MIN_THROTTLE;
      pitchCommand = 0; rollCommand = 0; yawCommand = 0;
      break;
      
    case FLYING:
      break;
      
    case LANDING:
      break;
  }
}

// === WEBSOCKET ===
void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    wsConnected = true;
    Serial.println("[WS] Cliente conectado");
    webSocket.sendTXT(num, "ESP32 listo - Calibración Activa");
  } 
  else if (type == WStype_DISCONNECTED) {
    wsConnected = false;
    Serial.println("[WS] Cliente desconectado → ATERRIZAJE DE EMERGENCIA");
    setDroneState(IDLE);
  } 
  else if (type == WStype_TEXT) {
    String received = String((char*)payload).substring(0, length);
    Serial.printf("[WS] Recibido: %s\n", received.c_str());

    if (received.startsWith("CALIB:")) {
      String calibJson = received.substring(6);
      Serial.println("Recibiendo calibración...");
      
      DynamicJsonDocument doc(1024);
      DeserializationError error = deserializeJson(doc, calibJson);
      
      if (!error) {
        CalibrationData newCalib;
        
        newCalib.pitchPID.kp = doc["pitchPID"]["kp"] | 1.5;
        newCalib.pitchPID.ki = doc["pitchPID"]["ki"] | 0.0;
        newCalib.pitchPID.kd = doc["pitchPID"]["kd"] | 0.8;
        
        newCalib.rollPID.kp = doc["rollPID"]["kp"] | 1.5;
        newCalib.rollPID.ki = doc["rollPID"]["ki"] | 0.0;
        newCalib.rollPID.kd = doc["rollPID"]["kd"] | 0.8;
        
        newCalib.yawPID.kp = doc["yawPID"]["kp"] | 1.0;
        newCalib.yawPID.ki = doc["yawPID"]["ki"] | 0.0;
        newCalib.yawPID.kd = doc["yawPID"]["kd"] | 0.3;
        
        newCalib.minThrottle = doc["minThrottle"] | 130;
        newCalib.maxThrottle = doc["maxThrottle"] | 255;
        newCalib.baseThrottle = doc["baseThrottle"] | 170;
        newCalib.alpha = doc["alpha"] | 0.96;
        newCalib.takeoffDuration = doc["takeoffDuration"] | 2000;
        
        applyCalibration(newCalib);
        webSocket.sendTXT(num, "Calibración aplicada correctamente");
      } else {
        Serial.println("Error parseando calibración JSON");
        webSocket.sendTXT(num, "Error en formato de calibración");
      }
    }
    else if (received == "TAKEOFF") {
      Serial.println("INICIANDO DESPEGUE");
      setDroneState(TAKING_OFF);
    }
    else if (received == "LAND") {
      Serial.println("INICIANDO ATERRIZAJE");
      setDroneState(LANDING);
    }
    else if (received == "EMERGENCY_STOP") {
      Serial.println("PARADA DE EMERGENCIA");
      setDroneState(IDLE);
    }
    else if (received.startsWith("THROTTLE:")) {
      int throttle = received.substring(9).toInt();
      baseThrottle = constrain(throttle, MIN_THROTTLE, MAX_THROTTLE);
      if (droneState == IDLE && baseThrottle > MIN_THROTTLE) {
        setDroneState(FLYING);
      }
    }
    else if (received.startsWith("MOVE:")) {
      String data = received.substring(5);
      int sep1 = data.indexOf(',');
      int sep2 = data.indexOf(',', sep1+1);
      
      if (sep1 != -1 && sep2 != -1) {
        int pitch = data.substring(0, sep1).toInt();
        int roll = data.substring(sep1+1, sep2).toInt();
        int yaw = data.substring(sep2+1).toInt();
        
        setMovementCommand(pitch, roll, yaw);
        Serial.printf("Movimiento: P=%d, R=%d, Y=%d\n", pitch, roll, yaw);
      }
    }
    else if (received == "RESET_YAW") {
      initialYaw = angleZ;
      Serial.println("Yaw resetado a posición actual");
    }
    else {
      int sepIndex = received.indexOf(':');
      if (sepIndex != -1) {
        String pinName = received.substring(0, sepIndex);
        String valStr = received.substring(sepIndex + 1);
        valStr.trim();
        
        uint8_t pin = findPinByName(pinName);
        if (pin != 255) {
          int val = valStr.toInt();
          val = constrain(val, 0, 255);
          analogWrite(pin, val);
        }
      }
    }
  }
}

void updateDroneStateMachine() {
  unsigned long currentTime = millis();
  
  switch(droneState) {
    case TAKING_OFF:
      if (currentTime - stateStartTime > TAKEOFF_DURATION) {
        setDroneState(FLYING);
        Serial.println("DESPEGUE COMPLETADO - MODO ESTABILIZACIÓN ACTIVO");
      }
      break;
      
    case LANDING:
      baseThrottle -= 2;
      pitchCommand = 0; rollCommand = 0; yawCommand = 0;
      if (baseThrottle <= 0) {
        setDroneState(IDLE);
        Serial.println("ATERRIZAJE COMPLETADO");
      }
      break;
      
    case FLYING:
      break;
      
    case IDLE:
      break;
  }
}

// === WiFi ===
bool connectToWiFi() {
  Serial.print("Conectando a WiFi");
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConectado a WiFi");
    Serial.println("IP local: " + WiFi.localIP().toString());
    wifiConnected = true;
    return true;
  } else {
    Serial.println("\nError: No se pudo conectar al WiFi");
    wifiConnected = false;
    return false;
  }
}

void checkWiFiConnection() {
  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("Conexión WiFi perdida");
      wsConnected = false;
      wifiConnected = false;
      apagarMotoresProgresivo();
    }
    
    unsigned long now = millis();
    if (now - lastWifiCheck > wifiCheckInterval) {
      lastWifiCheck = now;
      Serial.println("Intentando reconectar al WiFi...");
      connectToWiFi();
    }
  } else {
    if (!wifiConnected) {
      Serial.println("WiFi reconectado exitosamente");
      wifiConnected = true;
    }
  }
}

// === SETUP Y LOOP ===
void setup() {
  Serial.begin(115200);

  for (auto &pm : pinMap) {
    pinMode(pm.pin, OUTPUT);
    analogWrite(pm.pin, 0);
  }

  initMPU6050();
  connectToWiFi();

  if (wifiConnected) {
    webSocket.begin();
    webSocket.onEvent(onWebSocketEvent);
    udp.begin(udpPort);
    Serial.println("Sistema de estabilización listo");
  }
}

void loop() {
  checkWiFiConnection();

  if (wifiConnected) {
    webSocket.loop();
    
    updateDroneStateMachine();
    stabilizeDrone();

    unsigned long now = millis();
    if (!wsConnected && now - lastBroadcast > broadcastIntervalDisconnected) {
      lastBroadcast = now;

      IPAddress broadcastIP = WiFi.localIP();
      broadcastIP[3] = 255;

      String message = "ESP32|" + WiFi.localIP().toString() + "|" + WiFi.macAddress();
      udp.beginPacket(broadcastIP, udpPort);
      udp.write((const uint8_t*)message.c_str(), message.length());
      udp.endPacket();

      Serial.println("Broadcast enviado: " + message);
    }
  } else {
    delay(100);
  }
}