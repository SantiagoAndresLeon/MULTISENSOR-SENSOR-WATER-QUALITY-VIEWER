#include <WiFi.h>
#include <HTTPClient.h>

// ------------ CONFIG WIFI (TU RED) ------------
const char* ssid = "UMMG-PUBR-CLL100";
const char* password = "";   // contraseña vacía

// ------------ URL DEL GOOGLE SCRIPT ------------
const char* serverUrl = "https://script.google.com/macros/s/AKfycbwAi8OWyVmFCI_im3raq-uxFS8cGX_FE_SKKbnsm3giRu7w7Oddzlwe8cEGBwS6U5I/exec";

// ------------ PINES ------------
const int pinVoltaje = 34;   
const int pinCorriente = 35; 
const int pinADC = 32;

unsigned long lastSend = 0;
const unsigned long interval = 30000;  // 30 segundos

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("Conectando a WiFi...");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi conectado.");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {

  if (millis() - lastSend >= interval) {
    lastSend = millis();

    // ----- LECTURAS -----
    int vRaw = analogRead(pinVoltaje);
    int iRaw = analogRead(pinCorriente);
    int adcRaw = analogRead(pinADC);

    float voltaje = (vRaw / 4095.0) * 3.3;    
    float corriente = (iRaw / 4095.0) * 3.3;  
    float adc = adcRaw;

    Serial.println("Enviando datos al Google Script...");

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;

      // Construimos la URL con parámetros
      String url = String(serverUrl) +
                   "?v=" + voltaje +
                   "&i=" + corriente +
                   "&adc=" + adc;

      http.begin(url);
      int httpCode = http.GET();

      if (httpCode > 0) {
        String payload = http.getString();
        Serial.print("Respuesta: ");
        Serial.println(payload);
      } else {
        Serial.print("Error HTTP: ");
        Serial.println(httpCode);
      }

      http.end();
    } else {
      Serial.println("WiFi desconectado, intentando reconectar...");
      WiFi.reconnect();
    }
  }
}
