// โหลดโมดูลที่จำเป็น
const WebSocket = require("ws"); // ใช้สำหรับสร้าง WebSocket Server
const express = require("express"); // ใช้สำหรับสร้าง HTTP Server
const bodyParser = require("body-parser"); // ใช้สำหรับจัดการข้อมูล JSON
const https = require("https"); // ใช้สำหรับสร้าง HTTPS Server
const http = require("http"); // ใช้สำหรับสร้าง HTTP Server
const fs = require("fs"); // ใช้สำหรับอ่านไฟล์ระบบ
require("dotenv").config(); // โหลด Environment Variables

// สร้างแอปพลิเคชัน Express
const app = express();
app.use(bodyParser.json()); // เปิดใช้งาน Body Parser เพื่อแปลง JSON request

// กำหนดค่าจาก Environment Variables
const env = process.env.NODE_ENV || "development"; // ตรวจสอบ Environment
const config = require(`./config/${env}`); // โหลดไฟล์ Config ตาม Environment

// ตรวจสอบว่ากำลังรันใน Production หรือ Development
const isProduction = config.NODE_ENV === "production";

// ตั้งค่า WebSocket Server
const wss = new WebSocket.Server({ noServer: true });
let clients = []; // เก็บรายการ WebSocket Clients ที่เชื่อมต่ออยู่

// -----------------------------------------------------------------------------
// การจัดการ WebSocket Server
// -----------------------------------------------------------------------------
wss.on("connection", (ws) => {
  // เมื่อมี Client เชื่อมต่อ
  clients.push(ws); // เพิ่ม Client ลงในรายการ

  ws.on("close", () => {
    // เมื่อ Client ปิดการเชื่อมต่อ
    clients = clients.filter((client) => client !== ws); // ลบ Client ออกจากรายการ
  });

  ws.on("error", (err) => {
    console.error("WebSocket Error:", err);
  });
});

// -----------------------------------------------------------------------------
// การจัดการ Webhook (รับข้อความจาก API และส่งไปยัง WebSocket Clients)
// -----------------------------------------------------------------------------
app.post("/", (req, res) => {
  const message = req.body; // ข้อความที่ส่งมาจาก Webhook
  console.log("ข้อความที่ได้รับจาก Webhook:", message);

  // ส่งข้อความไปยัง WebSocket Clients
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message)); // ส่งข้อความในรูปแบบ JSON
    }
  });

  res.status(200).send({ status: "Message sent to WebSocket clients" }); // ตอบกลับ HTTP 200
});

// -----------------------------------------------------------------------------
// การตั้งค่า HTTPS/HTTP Server
// -----------------------------------------------------------------------------
let server;
if (isProduction) {
  const options = {
    key: fs.readFileSync(config.SSL_KEY), // อ่านไฟล์ Private Key
    cert: fs.readFileSync(config.SSL_CERT), // อ่านไฟล์ Certificate
  };
  server = https.createServer(options, app); // ใช้ HTTPS ใน Production
} else {
  server = http.createServer(app); // ใช้ HTTP ใน Development
}

// -----------------------------------------------------------------------------
// การเปิดใช้งาน Server
// -----------------------------------------------------------------------------
server.listen(config.PORT, () => {
  console.log(
    `WebSocket server running on ${
      isProduction ? "https" : "http"
    }://${config.DOMAIN}:${config.PORT}`
  );
});

// -----------------------------------------------------------------------------
// การจัดการ Upgrade Request สำหรับ WebSocket
// -----------------------------------------------------------------------------
server.on("upgrade", (request, socket, head) => {
  console.log("Upgrade request received:", request.url);
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request); // เรียก Event 'connection' เมื่อมีการอัปเกรดเป็น WebSocket
  });
});
