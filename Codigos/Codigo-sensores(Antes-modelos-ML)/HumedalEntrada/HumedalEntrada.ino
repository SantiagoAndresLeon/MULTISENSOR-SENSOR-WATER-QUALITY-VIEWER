#include <WiFi.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// -------------------- Pines --------------------
#define PH_PIN 36
#define ORP_PIN 39
#define OD_PIN 34
#define EC_PIN 32
#define ONE_WIRE_BUS 27

// -------------------- Configuración Wi-Fi --------------------
const char* ssid = "UMMG-PUBR-CLL100";
const char* password = "";
const char* serverName = "https://script.google.com/macros/s/AKfycbx1yrBtSiLPpJdHncAOfzV8P0i4uwSViKwksmcp0RcL1stjtXp1BpQ6T9bO0f67m8Oz/exec"; // Humedal entrada

// -------------------- Variables generales --------------------
#define VREF 3300.0
#define ADC_RES 4095.0
#define NUM_MUESTRAS 20

// Offset para conductividad (mS/cm)
float EC_OFFSET = 0; // Ajusta este valor según tu calibración

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);
float temperature = 20.0;

// -------------------- Funciones de cálculo --------------------
float calcularPH(float voltage_mv) {
  return (voltage_mv - 3913.3) / -260.0;
}

float calcularORP(float voltage_mv) {
  return 0.681504 * voltage_mv - 1622.86;
}

float calcularOD(float voltage_mv) {
  return 0.02275 * voltage_mv;
}

float calcularEC(float voltage_mv) {
  float m = 0.0073;
  float b = 0.786;
  return m * voltage_mv + b;
}

// -------------------- Funciones WiFi y envío --------------------
void initWiFi() {
  Serial.print("Connecting to: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  int timeout = 40;
  while (WiFi.status() != WL_CONNECTED && timeout-- > 0) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Failed to connect");
  } else {
    Serial.print("WiFi connected. IP: ");
    Serial.println(WiFi.localIP());
  }
}

void sendDataToGoogleSheet(float phValue, float odValue, float temp, float orp, float ec) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverName);
    http.addHeader("Content-Type", "application/json");

    String jsonData = "{";
    jsonData += "\"ph\":\"" + String(phValue, 2) + "\",";
    jsonData += "\"od\":\"" + String(odValue, 2) + "\",";
    jsonData += "\"temperature\":\"" + String(temp, 1) + "\",";
    jsonData += "\"orp\":\"" + String(orp, 2) + "\",";
    jsonData += "\"conductividad\":\"" + String(ec, 2) + "\"}";

    int httpResponseCode = http.POST(jsonData);
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
    http.end();
  } else {
    Serial.println("WiFi not connected");
  }
}

// -------------------- Setup --------------------
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  sensors.begin();
  initWiFi();
}

// -------------------- Loop principal --------------------
void loop() {
  sensors.requestTemperatures();
  temperature = sensors.getTempCByIndex(0);

  int adcPH = analogRead(PH_PIN);
  float ph_mv = (adcPH / ADC_RES) * 5000.0;
  float pH = calcularPH(ph_mv);

  float suma_orp = 0;
  for (int i = 0; i < NUM_MUESTRAS; i++) {
    int adcORP = analogRead(ORP_PIN);
    float voltage = (adcORP / ADC_RES) * (VREF / 1000.0);
    suma_orp += voltage * 1000.0;
    delay(10);
  }
  float orp_mv_avg = suma_orp / NUM_MUESTRAS;
  float orp_value = calcularORP(orp_mv_avg);

  float suma_od = 0;
  for (int i = 0; i < NUM_MUESTRAS; i++) {
    int adcOD = analogRead(OD_PIN);
    float od_mv = (adcOD / ADC_RES) * VREF;
    suma_od += od_mv;
    delay(10);
  }
  float od_mv_avg = suma_od / NUM_MUESTRAS;
  float od_value = calcularOD(od_mv_avg);

  int adcEC = analogRead(EC_PIN);
  float ec_mv = (adcEC / ADC_RES) * VREF;
  float ec_value = calcularEC(ec_mv) + EC_OFFSET; // Se aplica el offset aquí

  Serial.println("--------- LECTURA DE SENSORES ---------");
  Serial.print("Temperatura (°C): "); Serial.println(temperature, 1);
  Serial.print("pH: "); Serial.print(pH, 2); Serial.print(" | mV: "); Serial.println(ph_mv, 2);
  Serial.print("ORP: "); Serial.print(orp_value, 2); Serial.print(" mV | Promedio mV: "); Serial.println(orp_mv_avg, 2);
  Serial.print("OD: "); Serial.print(od_value, 2); Serial.print(" mg/L | Promedio mV: "); Serial.println(od_mv_avg, 2);
  Serial.print("Conductividad: "); Serial.print(ec_value, 2); Serial.print(" mS/cm | mV: "); Serial.println(ec_mv, 2);
  Serial.println("----------------------------------------\n");

  sendDataToGoogleSheet(pH, od_value, temperature, orp_value, ec_value);
  delay(300000);
  }
