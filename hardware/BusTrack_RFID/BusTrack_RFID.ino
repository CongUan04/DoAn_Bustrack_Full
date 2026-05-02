/**
 * BusTrack — ESP32 RFID Scanner
 * ─────────────────────────────────────────────────────────────
 * Phần cứng:
 *   - ESP32 (bất kỳ board nào)
 *   - MFRC522 RFID module
 *
 * Kết nối SPI (MFRC522 → ESP32):
 *   SDA  (SS/CS) → GPIO 5
 *   SCK          → GPIO 18
 *   MOSI         → GPIO 23
 *   MISO         → GPIO 19
 *   RST          → GPIO 4
 *   3.3V & GND   → 3.3V & GND
 *
 * Thư viện cần cài (Arduino Library Manager):
 *   - "MFRC522" by GithubCommunity
 *
 * ─────────────────────────────────────────────────────────────
 * HƯỚNG DẪN CẤU HÌNH:
 *   1. Điền WIFI_SSID, WIFI_PASSWORD của mạng nội bộ
 *   2. Cập nhật SERVER_HOST nếu đổi domain Render
 *   3. Nạp sketch, mở Serial Monitor @ 115200 baud
 *   4. Quẹt thẻ RFID → xem phản hồi từ server
 * ─────────────────────────────────────────────────────────────
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>  // HTTPS — bắt buộc cho Render.com
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>

// ================= 1. CẤU HÌNH MẠNG & WEB =================
const char* ssid = "Cong Hue";          
const char* password = "66668888";      

// [RENDER.COM] Cập nhật sang HTTPS production
const char* SERVER_HOST = "bustrack-backend-vq38.onrender.com"; // Chỉ hostname, không có https://
String busId = "69b13051f673cb7fb1079638";        
const char* API_KEY = "bustrack_iot_2026_esp32";  

// ================= 2. CẤU HÌNH PHẦN CỨNG =================
// Cấu hình RFID RC522
#define RST_PIN 22  
#define SS_PIN  5   
MFRC522 rfid(SS_PIN, RST_PIN);

// Cấu hình GPS NEO-6M
TinyGPSPlus gps;
HardwareSerial gpsSerial(2); 

// Biến điều phối thời gian và lưu trữ
String macAddress = "";
unsigned long lastGpsTime = 0;

void setup() {
  Serial.begin(115200);
  
  // Khởi tạo cả 2 module
  SPI.begin();
  rfid.PCD_Init();
  gpsSerial.begin(9600, SERIAL_8N1, 16, 17);
  
  // Kết nối WiFi
  Serial.println("\n[WIFI] Dang ket noi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  // Lấy và IN RA màn hình MAC Address (Cực kỳ quan trọng để dán lên Web)
  macAddress = WiFi.macAddress();
  Serial.println("\n[WIFI] Ket noi thanh cong!");
  Serial.println("[WIFI] MAC Address cua mach la: " + macAddress);
  
  Serial.println("=========================================");
  Serial.println("  HE THONG BUSTRACK KHOI DONG (GPS + RFID)");
  Serial.println("=========================================");
}

void loop() {
  // ---------------------------------------------------------
  // LUỒNG 1: LẮNG NGHE GPS LIÊN TỤC
  // ---------------------------------------------------------
  while (gpsSerial.available() > 0) {
    gps.encode(gpsSerial.read());
  }

  // ---------------------------------------------------------
  // LUỒNG 2: KIỂM TRA QUẸT THẺ (Ưu tiên xử lý ngay)
  // ---------------------------------------------------------
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    String rfid_uid = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      rfid_uid += String(rfid.uid.uidByte[i] < 0x10 ? " 0" : " ");
      rfid_uid += String(rfid.uid.uidByte[i], HEX);
    }
    rfid_uid.trim();
    rfid_uid.toUpperCase(); 
    
    Serial.println("\n[RFID] Phat hien the: " + rfid_uid);
    sendAttendanceAPI(rfid_uid); 
    
    delay(1500); // Tạm dừng 1.5s để chống quẹt 1 lần gửi chục request
    rfid.PICC_HaltA();
  }

  // ---------------------------------------------------------
  // LUỒNG 3: GỬI TỌA ĐỘ LÊN WEB (Chỉ gửi mỗi 5 giây)
  // ---------------------------------------------------------
  if (millis() - lastGpsTime > 5000) {
    if (gps.location.isValid()) {
      double lat = gps.location.lat();
      double lng = gps.location.lng();
      double speed = gps.speed.isValid() ? gps.speed.kmph() : 0.0;
      double heading = gps.course.isValid() ? gps.course.deg() : 0.0;
      
      Serial.println("\n[GPS] Dang gui toa do len Live Map...");
      sendLocationAPI(lat, lng, speed, heading);
    } else {
      Serial.println("[GPS] Dang cho ve tinh...");
    }
    lastGpsTime = millis();
  }
}

// ================= CÁC HÀM GỬI API (HTTPS - Render.com) =================
void sendAttendanceAPI(String uid) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure(); // Bỏ qua xác thực SSL certificate

  HTTPClient http;
  http.begin(client, String("https://") + SERVER_HOST + "/api/attendance/scan");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);

  String jsonBody = "{\"rfid_uid\":\"" + uid + "\", \"device_mac_address\":\"" + macAddress + "\"}";
  int httpCode = http.POST(jsonBody);

  if (httpCode == 200 || httpCode == 201) Serial.println(" -> [API] Diem danh thanh cong tren Web!");
  else Serial.printf(" -> [API Loi %d] Khong the diem danh\n", httpCode);
  http.end();
}

void sendLocationAPI(double lat, double lng, double speed, double heading) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure(); // Bỏ qua xác thực SSL certificate

  HTTPClient http;
  // [SỬA LỖI]: Đính kèm API_KEY trực tiếp vào URL (Query Parameter) thay vì chỉ dùng Header.
  // Điều này đảm bảo 100% API_KEY đến được server, vượt qua mọi lỗi rớt Header của ESP32.
  http.begin(client, String("https://") + SERVER_HOST + "/api/buses/" + busId + "/location?api_key=" + API_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);

  String jsonBody = "{\"lat\":" + String(lat, 6) + ", \"lng\":" + String(lng, 6) +
                    ", \"speed\":" + String(speed, 2) + ", \"heading\":" + String(heading, 2) + "}";
  // [SỬA LỖI]: Dùng PUT thay vì PATCH. 
  // Hàm sendRequest("PATCH") của ESP32 thường bị lỗi âm thầm drop custom headers (x-api-key)!
  int httpCode = http.PUT(jsonBody);

  if (httpCode == 200) {
    Serial.println(" -> [API] Live Map da cap nhat!");
  } else {
    Serial.printf(" -> [API Loi %d] Khong the cap nhat Live Map\n", httpCode);
    String response = http.getString();
    Serial.println("    Chi tiet loi: " + response);
  }
  http.end();
}