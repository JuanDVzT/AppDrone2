#include <WiFi.h>
#include <WiFiUdp.h>
#include <WebSocketsServer.h>

const char* ssid = "ALEXIS";
const char* password = "58036136";

WiFiUDP udp;
WebSocketsServer webSocket = WebSocketsServer(81);

const int udpPort = 4210;
unsigned long lastBroadcast = 0;
const unsigned long broadcastInterval = 5000;
bool wsConnected = false;

void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t * payload, size_t length) {
  if (type == WStype_CONNECTED) {
    wsConnected = true;
    Serial.println("[WS] Cliente conectado");
  } else if (type == WStype_DISCONNECTED) {
    wsConnected = false;
    Serial.println("[WS] Cliente desconectado");
  } else if (type == WStype_TEXT) {
    String received = String((char*)payload);
    Serial.printf("[WS] Recibido: %s\n", received.c_str());

    // Puedes enviar datos dinámicos aquí
    String response = "ESP32 dice: Hola desde WebSocket";
    webSocket.sendTXT(num, response);
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
}

void loop() {
  webSocket.loop();
  delay(1); // evita saturación

  unsigned long now = millis();
  if (!wsConnected && now - lastBroadcast > broadcastInterval) {
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
