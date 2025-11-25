// ai-worker.mjs (ฉบับแก้ไข: รันบน Server ได้ + แก้ Status ปุ่มหาย)
import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import http from "http"; 

// ==========================================
// 🔴 ส่วนตั้งค่า (ใช้ process.env สำหรับ Server)
// ==========================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "flood-rescue-ai.firebaseapp.com",
  projectId: "flood-rescue-ai",
  storageBucket: "flood-rescue-ai.firebasestorage.app",
  messagingSenderId: "847062213330",
  appId: "1:847062213330:web:5c6af3bb8e5bf92c90830b",
  measurementId: "G-4Z8DMG10ZM",
};

// ==========================================

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ใช้ชื่อโมเดลที่เสถียรกว่าสำหรับ Server
const MODEL_CANDIDATES = ["gemini-1.5-flash", "gemini-pro-vision"]; 

console.log("🚀 กำลังเริ่มระบบ AI Worker...");

async function start() {
  try {
    // 1. Login เข้าระบบ
    await signInAnonymously(auth);
    console.log("🔑 Login Firebase สำเร็จ!");

    // 2. เลือกโมเดล (ใช้ Flash เป็นหลักเพราะไวและถูก)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log(`✅ พร้อมทำงานด้วยโมเดล: gemini-1.5-flash`);

    // 3. เริ่มเฝ้า Database
    console.log("👀 หุ่นยนต์พร้อมทำงาน! รอรับเคส...");

    onSnapshot(collection(db, "requests"), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          
          // 🔴 LOGIC สำคัญที่แก้ให้:
          // ตรวจสอบว่า Status เป็น waiting และ "ยังไม่เคยมีผลวิเคราะห์" (เพื่อกัน Loop)
          if (data.status === "waiting" && !data.ai_analysis) {
            console.log(`\n🔔 พบเคสใหม่: ${data.name}`);
            await analyzeCase(model, change.doc.id, data);
          }
        }
      });
    });
  } catch (error) {
    console.error("❌ ระบบเริ่มไม่สำเร็จ:", error.message);
  }
}

async function analyzeCase(model, docId, data) {
  try {
    console.log("   ...กำลังวิเคราะห์รูปภาพ...");

    if (!data.imageUrl) {
      console.log("   ⚠️ ไม่มีรูปภาพ ข้าม...");
      return;
    }

    // เตรียมรูปภาพ
    const base64Image = data.imageUrl.split(",")[1];
    const imagePart = {
      inlineData: { data: base64Image, mimeType: "image/jpeg" },
    };

    // คำสั่ง Prompt
    const prompt = `
      คุณคือเจ้าหน้าที่กู้ภัย AI
      ดูรูปภาพและข้อมูล: "${data.description}"
      
      ประเมินความเสี่ยงและตอบเป็น JSON เท่านั้น (ห้ามมี markdown):
      {
        "risk_score": (คะแนน 0-10, 10คือวิกฤตสุด),
        "priority": ("High" หรือ "Medium" หรือ "Low"),
        "summary": (สรุปสั้นๆ ภาษาไทย ไม่เกิน 10 คำ),
        "needs": [(อาเรย์สิ่งที่คาดว่าต้องการ เช่น เรือ, อาหาร, ยา)]
      }
    `;

    // ส่งให้ AI คิด
    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();

    // แกะ JSON
    const jsonString = responseText.replace(/```json|```/g, "").trim();
    const aiResult = JSON.parse(jsonString);

    // 🔴 แก้ไขจุดนี้: อัปเดตแค่ผล AI แต่ "ไม่เปลี่ยน status" 
    // เพื่อให้ status ยังเป็น "waiting" และปุ่ม "รับงาน" ยังแสดงบน Dashboard
    await updateDoc(doc(db, "requests", docId), {
      ai_analysis: aiResult
      // status: "analyzed"  <-- เอาบรรทัดนี้ออกครับ
    });

    console.log(
      `✅ วิเคราะห์เสร็จ: Risk ${aiResult.risk_score}/10 (${aiResult.summary})`
    );
  } catch (error) {
    console.error("❌ AI Error:", error.message);
  }
}

// รันระบบ
start();

// Health Check Endpoint สำหรับ Server (เช่น Render/Heroku)
const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.write("AI Worker is Running! 🤖");
    res.end();
  })
  .listen(PORT, () => {
    console.log(`🌍 Server listening on port ${PORT}`);
  });