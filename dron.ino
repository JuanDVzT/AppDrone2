#include <WiFi.h>
#include <WiFiUdp.h>
#include <WebSocketsServer.h>

// Pines
#define A1_IN1 12
#define A1_IN2 13
#define A2_IN1 27
#define A2_IN2 14
#define B1_IN1 25
#define B1_IN2 26
#define B2_IN1 33
#define B2_IN2 32

// WiFi y WebSocket
const char* ssid = "Alexis";
const char* password = "58036136";

WiFiUDP udp;
WebSocketsServer webSocket = WebSocketsServer(81);

const int udpPort = 4210;
unsigned long lastBroadcast = 0;
unsigned long lastWifiCheck = 0;
const unsigned long broadcastIntervalDisconnected = 1000;
const unsigned long wifiCheckInterval = 5000; // Verificar WiFi cada 5 segundos
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

uint8_t findPinByName(const String& name) {
  for (auto &pm : pinMap) {
    if (name.equalsIgnoreCase(pm.name)) {
      return pm.pin;
    }
  }
  return 255; // No encontrado
}

void apagarMotoresProgresivo() {
  for (int p = 255; p >= 0; p -= 5) {
    for (auto &pm : pinMap) {
      analogWrite(pm.pin, 0);
    }
    delay(20);
  }
}

void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    wsConnected = true;
    Serial.println("[WS] Cliente conectado");
    webSocket.sendTXT(num, "ESP32 listo para recibir comandos");
  } 
  else if (type == WStype_DISCONNECTED) {
    wsConnected = false;
    Serial.println("[WS] Cliente desconectado → apagando motores");
    apagarMotoresProgresivo();
  } 
  else if (type == WStype_TEXT) {
    String received = String((char*)payload).substring(0, length);
    Serial.printf("[WS] Recibido: %s\n", received.c_str());

    int sepIndex = received.indexOf(':');
    if (sepIndex == -1) {
      Serial.println("[WS] Formato incorrecto, se espera PIN:VALOR");
      return;
    }

    String pinName = received.substring(0, sepIndex);
    String valStr = received.substring(sepIndex + 1);
    valStr.trim();

    uint8_t pin = findPinByName(pinName);
    if (pin == 255) {
      Serial.println("[WS] Nombre de pin no válido: " + pinName);
      return;
    }

    int val = valStr.toInt();
    val = constrain(val, 0, 255);

    Serial.printf("[WS] Pin: %s -> %d\n", pinName.c_str(), val);

    analogWrite(pin, val);
  }
}

bool connectToWiFi() {
  Serial.print("Conectando a WiFi");
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) { // Máximo 10 segundos
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
      // Apagar motores por seguridad
      apagarMotoresProgresivo();
    }
    
    // Intentar reconexión
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

void setup() {
  Serial.begin(115200);

  // Configurar pines primero
  for (auto &pm : pinMap) {
    pinMode(pm.pin, OUTPUT);
    analogWrite(pm.pin, 0);
  }

  // Conectar a WiFi
  connectToWiFi();

  // Inicializar WebSocket y UDP solo si WiFi está conectado
  if (wifiConnected) {
    webSocket.begin();
    webSocket.onEvent(onWebSocketEvent);
    udp.begin(udpPort);
    Serial.println("WebSocket y UDP inicializados");
  } else {
    Serial.println("WebSocket y UDP NO inicializados - Sin conexión WiFi");
  }
}

void loop() {
  // Verificar y mantener conexión WiFi
  checkWiFiConnection();

  // Solo procesar WebSocket y broadcasts si WiFi está conectado
  if (wifiConnected) {
    webSocket.loop();

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
    // Si no hay WiFi, pequeño delay para no saturar el loop
    delay(100);
  }
}