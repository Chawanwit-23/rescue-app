// ai-worker.mjs (แก้ไขเฉพาะ Logic สถานะ: ให้ปุ่ม "รอช่วย" ยังอยู่)
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
// 🔴 ส่วนตั้งค่า
// ==========================================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const FIREBASE_CONFIG = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: "flood-rescue-ai.firebaseapp.com",
  projectId: "flood-rescue-ai",
  storageBucket: "flood-rescue-ai.firebasestorage.app",
  messagingSenderId: "847062213330",
  appId: "1:847062213330:web:5c6af3bb8e5bf92c90830b",
  measurementId: "G-4Z8DMG10ZM"
};

// ==========================================

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ✅ ส่วนนี้คงเดิมตามที่คุณขอ
const MODEL_CANDIDATES = ["gemini-flash-latest"];

console.log("🚀 กำลังเริ่มระบบ AI Worker...");

async function start() {
  try {
    await signInAnonymously(auth);
    console.log("🔑 Login Firebase สำเร็จ!");

    // หาโมเดล (คงเดิม)
    let activeModel = null;
    console.log("🔍 กำลังหาโมเดล AI...");

    for (const modelName of MODEL_CANDIDATES) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        await model.generateContent("Test"); 
        activeModel = model;
        console.log(`✅ เจอแล้ว! จะใช้โมเดล: "${modelName}"`);
        break;
      } catch (e) {
        // เงียบไว้
      }
    }

    if (!activeModel) {
      console.error("❌ หาโมเดล AI ไม่เจอเลย! (เช็ค API Key หรือเครือข่าย)");
      return;
    }

    // 3. เริ่มเฝ้า Database
    console.log("👀 หุ่นยนต์พร้อมทำงาน! รอรับเคส...");

    onSnapshot(collection(db, "requests"), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          
          // 🔴 แก้ไขจุดที่ 1: เพิ่มเงื่อนไข !data.ai_analysis
          // ป้องกันไม่ให้ AI วิเคราะห์ซ้ำถ้ามีผลวิเคราะห์อยู่แล้ว
          if (data.status === "waiting" && !data.ai_analysis) {
            console.log(`\n🔔 พบเคสใหม่: ${data.name}`);
            await analyzeCase(activeModel, change.doc.id, data);
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

    const base64Image = data.imageUrl.split(",")[1];
    const imagePart = {
      inlineData: { data: base64Image, mimeType: "image/jpeg" },
    };

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

    const result = await model.generateContent([prompt, imagePart]);
    const responseText = result.response.text();
    const jsonString = responseText.replace(/```json|```/g, "").trim();
    const aiResult = JSON.parse(jsonString);

    // 🔴 แก้ไขจุดที่ 2: ลบบรรทัด status: "analyzed" ออก
    // เพื่อให้ status ยังคงเป็น "waiting" (รอช่วย) เหมือนเดิม
    // ปุ่ม "รับงาน" บน Dashboard จะได้ไม่หาย
    await updateDoc(doc(db, "requests", docId), {
      ai_analysis: aiResult
      // status: "analyzed",  <-- เอาบรรทัดนี้ออกครับ
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

const PORT = process.env.PORT || 3000;
http
  .createServer((req, res) => {
    res.write("AI Worker is Running! 🤖");
    res.end();
  })
  .listen(PORT, () => {
    console.log(`🌍 Server listening on port ${PORT}`);
  });