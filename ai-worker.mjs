// ai-worker.mjs (ฉบับสมบูรณ์: คืนชีพ Loop หาโมเดล + แก้ปุ่มหาย)
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

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ♻️ คืนค่า Loop: ใส่รายชื่อโมเดลหลายๆ ตัว เผื่อตัวไหนพังจะได้ใช้อีกตัวแทน
const MODEL_CANDIDATES = [
  "gemini-flash-latest",        // ตัวใหม่ เร็ว
  "gemini-pro-latest",     // ตัวที่คุณเคยใช้แล้วเวิร์ค
  "gemini-2.5-pro",              // ตัวพื้นฐาน (กันตาย)
  "gemini-2.5-flash"           // ตัวเก่าแต่ชัวร์
];

console.log("🚀 กำลังเริ่มระบบ AI Worker...");

async function start() {
  try {
    await signInAnonymously(auth);
    console.log("🔑 Login Firebase สำเร็จ!");

    // ♻️ Logic เดิมกลับมาแล้ว: วนลูปหาโมเดลที่ใช้ได้
    let activeModel = null;
    console.log("🔍 กำลังสุ่มหาโมเดล AI ที่ใช้ได้...");

    for (const modelName of MODEL_CANDIDATES) {
      try {
        console.log(`   ...ทดสอบโมเดล: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        await model.generateContent("Test Connection"); // ยิงเทสก่อน
        activeModel = model;
        console.log(`✅ เจอแล้ว! จะใช้โมเดล: "${modelName}"`);
        break; // เจอแล้วหยุดหา
      } catch (e) {
        console.warn(`   ⚠️ โมเดล ${modelName} ใช้ไม่ได้ (ข้าม)`);
      }
    }

    if (!activeModel) {
      console.error("❌ หมดหนทาง! หาโมเดล AI ไม่เจอเลยสักตัว (เช็ค API Key ด่วน)");
      return;
    }

    console.log("👀 หุ่นยนต์พร้อมทำงาน! รอรับเคส...");

    onSnapshot(collection(db, "requests"), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === "added") {
          const data = change.doc.data();
          // Logic เดิมที่แก้ให้แล้ว: เช็ค waiting และ เช็คว่ายังไม่เคยวิเคราะห์
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

    // อัปเดตข้อมูล (แต่ไม่เปลี่ยน status เพื่อให้ปุ่มยังอยู่)
    await updateDoc(doc(db, "requests", docId), {
      ai_analysis: aiResult
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
    res.write("AI Worker is Running! 🤖"); // เขียนข้อความบอกว่าฉันยังอยู่นะ
    res.end();
  })
  .listen(PORT, () => {
    console.log(`🌍 Server listening on port ${PORT}`);
  });
