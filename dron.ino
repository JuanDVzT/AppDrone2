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
const char* ssid = "Prueba";
const char* password = "12345678";

WiFiUDP udp;
WebSocketsServer webSocket = WebSocketsServer(81);

const int udpPort = 4210;
unsigned long lastBroadcast = 0;
const unsigned long broadcastIntervalDisconnected = 1000;
bool wsConnected = false;

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

void setup() {
  Serial.begin(115200);

  WiFi.begin(ssid, password);
  Serial.print("Conectando a WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConectado a WiFi");
  Serial.println("IP local: " + WiFi.localIP().toString());

  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);
  udp.begin(udpPort);

  for (auto &pm : pinMap) {
    pinMode(pm.pin, OUTPUT);
    analogWrite(pm.pin, 0);
  }
}

void loop() {
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
}
