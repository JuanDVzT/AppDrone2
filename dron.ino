#include <WiFi.h>
#include <WiFiUdp.h>

const char* ssid = "ALEXIS";
const char* password = "58036136";
WiFiUDP udp;
const int udpPort = 4210;

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConectado a WiFi");
}

void loop() {
  IPAddress ip = WiFi.localIP();
  String mac = WiFi.macAddress();
  String message = "ESP32|" + ip.toString() + "|" + mac;
  udp.beginPacket(IPAddress(255, 255, 255, 255), udpPort);
  udp.write((const uint8_t*)message.c_str(), message.length());
  udp.endPacket();


  Serial.println("Broadcast enviado: " + message);
  delay(5000);
}
