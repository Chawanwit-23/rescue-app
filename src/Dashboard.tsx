import { useState, useEffect, useMemo, useRef } from "react";
import { db, auth } from "./firebase"; // 🟢 เพิ่ม auth
import {
  collection,
  onSnapshot,
  query,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth"; // 🟢 เพิ่มฟังก์ชัน Auth
import { useNavigate } from "react-router-dom"; // 🟢 เพิ่ม Hook สำหรับเปลี่ยนหน้า
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import * as LucideIcons from "lucide-react";
import { Link } from "react-router-dom";

// --- 1. Icons ---
const {
  AlertTriangle,
  CheckCircle2,
  Navigation,
  ArrowRightCircle,
  Activity,
  Users,
  MapPin,
  Search,
  Siren,
  Phone,
  Clock,
  FileText,
  UserCheck,
  X,
  Skull,
  Trash2,
  LogOut,
  Tent, // 🟢 เพิ่ม LogOut, Tent
} = LucideIcons as any;

// --- 2. Interface ---
interface RequestData {
  id: string;
  name: string;
  contact: string;
  description: string;
  peopleCount: number;
  waterLevel?: string;
  reporterType?: string;
  location?: { lat: number; lng: number };
  address?: {
    province: string;
    district: string;
    subdistrict: string;
    details: string;
  };
  imageUrl?: string;
  status: "waiting" | "inprogress" | "completed";
  timestamp?: any;
  ai_analysis?: {
    risk_score: number;
    summary?: string;
  };
  rescuerName?: string;
  rescuerContact?: string;
  isBlackCase?: boolean;
}

// --- 3. Marker Logic (Fixed Drift Issue) ---
const createLabelIcon = (
  name: string,
  score: number,
  status: string,
  isBlackCase?: boolean
) => {
  let borderColor = "#10b981";
  let textColor = "#047857";
  let bgColor = "white";
  let opacity = "1";

  if (isBlackCase) {
    // ⚫ เคสดำ
    borderColor = "#000000";
    textColor = "#ffffff";
    bgColor = "#1f2937";
    opacity = "1";
  } else if (status === "completed") {
    // ✅ เคสจบแล้ว (จางลง)
    borderColor = "#64748b";
    textColor = "#64748b";
    bgColor = "#f1f5f9";
    opacity = "0.6";
  } else if (status === "inprogress") {
    borderColor = "#f97316";
    textColor = "#c2410c";
  } else if (score >= 8) {
    borderColor = "#ef4444";
    textColor = "#b91c1c";
  } else if (score >= 5) {
    borderColor = "#f59e0b";
    textColor = "#b45309";
  }

  const html = `
    <div style="
      opacity: ${opacity};
      background-color:${bgColor}; border:2px solid ${borderColor}; border-radius:12px; padding:4px 8px; white-space:nowrap; font-family:'Kanit',sans-serif; font-weight:700; font-size:12px; color:${textColor}; box-shadow:0 4px 10px rgba(0,0,0,0.25); text-align:center; 
      
      /* 🟢 CSS Fix: จัดตำแหน่งให้ปลายหมุดจิ้มที่พิกัดพอดี */
      position: absolute;
      left: 0px;
      top: 0px;
      transform: translate(-50%, calc(-100% - 10px)); /* ดึงกล่องขึ้นไปเหนือจุดพิกัด */
      
      min-width:80px;
      ${
        status === "completed" && !isBlackCase ? "filter: grayscale(100%);" : ""
      }
      ${
        isBlackCase
          ? "border-width: 3px; animation: pulse-black 2s infinite;"
          : ""
      }
    ">
      <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
        <span>${name}</span>
        ${
          isBlackCase
            ? '<span style="font-size:12px;">💀</span>'
            : status === "waiting"
            ? `<span style="background:${borderColor}; color:white; border-radius:99px; padding:0 5px; font-size:9px; height:16px; display:flex; align-items:center; justify-content:center;">${score}</span>`
            : ""
        }
      </div>
      
      <!-- สามเหลี่ยมชี้ลง -->
      <div style="position:absolute; bottom:-8px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:7px solid transparent; border-right:7px solid transparent; border-top:8px solid ${borderColor};"></div>
    </div>
    <style>
      @keyframes pulse-black {
        0% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(0, 0, 0, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
      }
    </style>
  `;

  // ตั้งค่า iconSize และ iconAnchor เป็น [0,0] เพื่อให้ CSS เป็นคนคุมตำแหน่ง 100%
  return L.divIcon({
    className: "custom-div-icon",
    html: html,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
};

// --- 4. Helper Components ---
function MapFlyTo({ location }: { location: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (location)
      map.flyTo(location, 16, { duration: 1.5, easeLinearity: 0.25 });
  }, [location, map]);
  return null;
}

function StatCard({ label, count, color, icon }: any) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl p-3 border border-white/20 ${color} shadow-lg group 
        min-h-[80px] flex flex-col justify-center
        min-w-[100px] md:min-w-0 flex-shrink-0
    `}
    >
      <div className="absolute -right-2 -top-2 p-3 opacity-20 scale-150 group-hover:scale-[1.7] transition-transform duration-500">
        {icon}
      </div>
      <div className="relative z-10 flex flex-col items-start">
        <span className="text-[10px] uppercase tracking-wider text-white/90 font-bold opacity-80 whitespace-nowrap">
          {label}
        </span>
        <span className="text-2xl md:text-3xl font-black text-white mt-1 shadow-sm">
          {count}
        </span>
      </div>
    </div>
  );
}

// ==========================================
// 🎨 DASHBOARD MAIN COMPONENT
// ==========================================
export default function Dashboard() {
  const navigate = useNavigate(); // 🟢 ใช้สำหรับเปลี่ยนหน้า
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<
    [number, number] | null
  >(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Sheet States
  const [sheetHeight, setSheetHeight] = useState(45);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Filters
  const [selectedProvince, setSelectedProvince] = useState("ทั้งหมด");
  const [selectedDistrict, setSelectedDistrict] = useState("ทั้งหมด");
  const [selectedSubDistrict, setSelectedSubDistrict] = useState("ทั้งหมด");

  // Modal State
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [targetCaseId, setTargetCaseId] = useState<string | null>(null);
  const [officerForm, setOfficerForm] = useState({ name: "", phone: "" });

  // 🟢 1. AUTH GUARD: เช็คว่า Login หรือยัง?
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login"); // ถ้าไม่มี user ดีดกลับไปหน้า login
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // --- Fetch Data ---
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "requests")), (snapshot) => {
      setRequests(
        snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as RequestData)
        )
      );
    });
    return () => unsub();
  }, []);

  // --- Filter & Sort Logic ---
  const provinces = useMemo(
    () => [
      "ทั้งหมด",
      ...new Set(requests.map((r) => r.address?.province).filter(Boolean)),
    ],
    [requests]
  );
  const districts = useMemo(
    () => [
      "ทั้งหมด",
      ...new Set(
        requests
          .filter(
            (r) =>
              selectedProvince === "ทั้งหมด" ||
              r.address?.province === selectedProvince
          )
          .map((r) => r.address?.district)
          .filter(Boolean)
      ),
    ],
    [requests, selectedProvince]
  );
  const subdistricts = useMemo(
    () => [
      "ทั้งหมด",
      ...new Set(
        requests
          .filter(
            (r) =>
              (selectedProvince === "ทั้งหมด" ||
                r.address?.province === selectedProvince) &&
              (selectedDistrict === "ทั้งหมด" ||
                r.address?.district === selectedDistrict)
          )
          .map((r) => r.address?.subdistrict)
          .filter(Boolean)
      ),
    ],
    [requests, selectedProvince, selectedDistrict]
  );

  const filteredRequests = requests
    .filter((req) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        req.name?.toLowerCase().includes(searchLower) ||
        req.description?.toLowerCase().includes(searchLower) ||
        req.address?.details?.toLowerCase().includes(searchLower);
      return (
        matchesSearch &&
        (selectedProvince === "ทั้งหมด" ||
          req.address?.province === selectedProvince) &&
        (selectedDistrict === "ทั้งหมด" ||
          req.address?.district === selectedDistrict) &&
        (selectedSubDistrict === "ทั้งหมด" ||
          req.address?.subdistrict === selectedSubDistrict)
      );
    })
    .sort((a, b) => {
      // ลำดับ: เคสดำ > ยังไม่เสร็จ > เสร็จแล้ว
      if (a.isBlackCase && !b.isBlackCase) return -1;
      if (!a.isBlackCase && b.isBlackCase) return 1;
      if (a.status === "completed" && b.status !== "completed") return 1;
      if (a.status !== "completed" && b.status === "completed") return -1;
      return (
        (b.ai_analysis?.risk_score || 0) - (a.ai_analysis?.risk_score || 0)
      );
    });

  const stats = {
    total: filteredRequests.length,
    waiting: filteredRequests.filter((r) => r.status === "waiting").length,
    critical: filteredRequests.filter(
      (r) => r.ai_analysis?.risk_score! >= 8 && r.status !== "completed"
    ).length,
    working: filteredRequests.filter(
      (r) => r.status === "inprogress" && !r.isBlackCase
    ).length,
    completed: filteredRequests.filter(
      (r) => r.status === "completed" && !r.isBlackCase
    ).length, // 🟢 เคสเสร็จปกติ
    black: filteredRequests.filter((r) => r.isBlackCase).length, // ⚫ เคสดำ
  };

  // --- Actions ---
  const initiateAccept = (id: string, e?: any) => {
    e?.stopPropagation();
    setTargetCaseId(id);
    setShowAcceptModal(true);
    setOfficerForm({ name: "", phone: "" });
  };

  const confirmAcceptWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCaseId) return;
    if (!officerForm.name.trim() || !officerForm.phone.trim())
      return alert("กรุณากรอกข้อมูลให้ครบ");

    try {
      await updateDoc(doc(db, "requests", targetCaseId), {
        status: "inprogress",
        rescuerName: officerForm.name,
        rescuerContact: officerForm.phone,
      });
      setShowAcceptModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  // 🟢 ฟังก์ชัน Logout
  const handleLogout = async () => {
    if (confirm("ต้องการออกจากระบบ War Room?")) {
      await signOut(auth);
      navigate("/"); // กลับไปหน้าแรก
    }
  };

  const closeCase = async (id: string, e?: any) => {
    e?.stopPropagation();
    if (!confirm("✅ ยืนยันช่วยเหลือสำเร็จ (ปิดงาน)?")) return;
    try {
      await updateDoc(doc(db, "requests", id), {
        status: "completed",
        isBlackCase: false,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const markAsBlackCase = async (id: string, e?: any) => {
    e?.stopPropagation();
    if (
      !confirm(
        "💀 ยืนยันพบร่างผู้เสียชีวิต?\n\n(สถานะจะเปลี่ยนเป็น 'รอเก็บกู้' ทันที)"
      )
    )
      return;
    try {
      await updateDoc(doc(db, "requests", id), {
        isBlackCase: true,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const finishBlackCase = async (id: string, e?: any) => {
    e?.stopPropagation();
    if (
      !confirm(
        "⚰️ ยืนยันการเก็บกู้ร่างเสร็จสิ้น?\n\n(ข้อมูลเคสนี้จะถูกลบออกจากหน้าจอทันที)"
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "requests", id));
    } catch (err) {
      console.error(err);
    }
  };

  const openMaps = (lat: number, lng: number, e?: any) => {
    e?.stopPropagation();
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
      "_blank"
    );
  };

  // --- Touch/Drag Logic ---
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
    dragStartHeight.current = sheetHeight;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaPercent =
      ((dragStartY.current - e.touches[0].clientY) / window.innerHeight) * 100;
    setSheetHeight(
      Math.min(95, Math.max(12, dragStartHeight.current + deltaPercent))
    );
  };
  const handleTouchEnd = () => {
    setIsDragging(false);
    setSheetHeight(sheetHeight > 75 ? 92 : sheetHeight > 30 ? 45 : 12);
  };

  return (
    <div className="flex flex-col-reverse md:flex-row h-screen bg-slate-50 overflow-hidden font-sans text-slate-800 relative selection:bg-blue-100">
      <style>{`
        .leaflet-popup-content-wrapper { padding: 0 !important; border-radius: 16px !important; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2) !important; }
        .leaflet-popup-content { margin: 0 !important; width: 280px !important; }
        .leaflet-popup-tip { background: white; }
        .leaflet-container a.leaflet-popup-close-button { color: #aaa; font-size: 18px; top: 8px; right: 8px; background: rgba(0,0,0,0.1); border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; text-decoration: none; z-index: 20; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ================= MODAL ================= */}
      {showAcceptModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
            <div className="bg-orange-500 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <UserCheck size={20} /> ลงทะเบียนรับงาน
              </h3>
              <button
                onClick={() => setShowAcceptModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={confirmAcceptWork} className="p-5 space-y-4">
              <div className="text-sm text-slate-500 bg-orange-50 p-3 rounded-lg border border-orange-100">
                ระบุชื่อ/เบอร์ เพื่อการประสานงาน
              </div>
              <input
                autoFocus
                type="text"
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="ชื่อเจ้าหน้าที่ / หน่วยงาน"
                value={officerForm.name}
                onChange={(e) =>
                  setOfficerForm({ ...officerForm, name: e.target.value })
                }
              />
              <input
                type="tel"
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="เบอร์ติดต่อ"
                value={officerForm.phone}
                onChange={(e) =>
                  setOfficerForm({ ...officerForm, phone: e.target.value })
                }
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAcceptModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 shadow-lg shadow-orange-200"
                >
                  ยืนยัน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= SIDEBAR ================= */}
      <div
        className={`
          w-full md:w-[450px] bg-white shadow-[0_-5px_30px_rgba(0,0,0,0.1)] z-[1000] flex flex-col border-r border-slate-200
          absolute bottom-0 left-0 md:relative md:h-full rounded-t-[2rem] md:rounded-none overflow-hidden
          ${
            !isDragging
              ? "transition-[height] duration-500 cubic-bezier(0.32, 0.72, 0, 1)"
              : ""
          }
        `}
        style={{ height: `${window.innerWidth < 768 ? sheetHeight : 100}%` }}
      >
        <div
          className="md:hidden w-full h-[32px] bg-white flex justify-center items-center cursor-grab active:cursor-grabbing border-b border-slate-50 flex-shrink-0 touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-slate-200 rounded-full"></div>
        </div>

        <div className="p-4 md:p-6 bg-slate-900 text-white shadow-xl relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div
            className={`relative z-10 flex justify-between items-center mb-4 ${
              sheetHeight < 20 ? "hidden md:flex" : ""
            }`}
          >
            <h1 className="text-xl md:text-2xl font-black flex items-center gap-2 tracking-tight">
              <span className="bg-red-600 p-1.5 rounded-lg shadow-red-900/50 shadow-lg">
                <Siren size={18} className="text-white animate-pulse" />
              </span>{" "}
              WAR ROOM
            </h1>

            {/* 🟢 ปุ่มเมนูด้านขวา (Logout) */}
            <div className="flex items-center gap-2">
              <Link
                to="/evacuation"
                className="p-1.5 bg-white/10 rounded-full hover:bg-white/20 transition"
                title="จุดอพยพ"
              >
                <Tent size={16} />
              </Link>
              <Link
                to="/"
                className="text-[10px] md:text-xs bg-white/10 hover:bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full text-white border border-white/10 transition flex items-center gap-1 font-medium"
              >
                <ArrowRightCircle size={14} />{" "}
                <span className="hidden md:inline">แจ้งเหตุ</span>
              </Link>
              <button
                onClick={handleLogout}
                className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md transition"
                title="ออกจากระบบ"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div
            className={`
                flex flex-row overflow-x-auto gap-3 pb-2 -mx-1 px-1 no-scrollbar
                md:grid md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 md:overflow-visible md:pb-0 md:gap-2
                transition-all duration-300 
                ${
                  sheetHeight < 20
                    ? "opacity-0 translate-y-4 md:opacity-100 md:translate-y-0 pointer-events-none"
                    : "opacity-100 translate-y-0"
                }
            `}
          >
            <StatCard
              label="รวมทั้งหมด"
              count={stats.total}
              color="bg-gradient-to-br from-indigo-500 to-indigo-600"
              icon={<FileText />}
            />
            <StatCard
              label="รอช่วย"
              count={stats.waiting}
              color="bg-gradient-to-br from-blue-500 to-blue-600"
              icon={<Users />}
            />
            <StatCard
              label="วิกฤต"
              count={stats.critical}
              color="bg-gradient-to-br from-red-500 to-red-600"
              icon={<AlertTriangle />}
            />
            <StatCard
              label="กำลัง"
              count={stats.working}
              color="bg-gradient-to-br from-orange-400 to-orange-500"
              icon={<Navigation />}
            />
            <StatCard
              label="ปกติ"
              count={stats.completed}
              color="bg-gradient-to-br from-emerald-500 to-emerald-600"
              icon={<CheckCircle2 />}
            />
            <StatCard
              label="เสียชีวิต"
              count={stats.black}
              color="bg-gradient-to-br from-slate-700 to-black border-red-900/50"
              icon={<Skull className="text-red-500" />}
            />
          </div>
        </div>

        <div
          className={`flex-1 flex flex-col overflow-hidden transition-opacity duration-200 ${
            sheetHeight < 20
              ? "opacity-0 md:opacity-100 pointer-events-none"
              : "opacity-100"
          }`}
        >
          <div className="p-3 md:p-4 bg-white border-b border-slate-100 space-y-2 flex-shrink-0">
            <div className="relative group">
              <Search
                size={16}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
              />
              <input
                type="text"
                placeholder="ค้นหาเคส..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {[
                {
                  val: selectedProvince,
                  set: setSelectedProvince,
                  opts: provinces,
                  ph: "จังหวัด",
                },
                {
                  val: selectedDistrict,
                  set: setSelectedDistrict,
                  opts: districts,
                  ph: "อำเภอ",
                },
                {
                  val: selectedSubDistrict,
                  set: setSelectedSubDistrict,
                  opts: subdistricts,
                  ph: "ตำบล",
                },
              ].map((d, i) => (
                <select
                  key={i}
                  value={d.val}
                  onChange={(e) => d.set(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-lg p-2 outline-none min-w-[80px] flex-1"
                >
                  {d.opts.map((o) => (
                    <option key={o} value={o}>
                      {o === "ทั้งหมด" ? d.ph : o}
                    </option>
                  ))}
                </select>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-slate-50/50 pb-20 md:pb-4">
            {filteredRequests.map((req) => {
              const isDone = req.status === "completed";
              const score = req.ai_analysis?.risk_score || 0;

              let cardBorder = isDone
                ? req.isBlackCase
                  ? "border-l-black border-l-[6px] bg-slate-100"
                  : "border-l-slate-300"
                : score >= 8
                ? "border-l-red-500"
                : score >= 5
                ? "border-l-orange-400"
                : "border-l-emerald-500";
              let badgeStyle = isDone
                ? req.isBlackCase
                  ? "bg-black text-white shadow-md shadow-black/30"
                  : "bg-slate-100 text-slate-500"
                : score >= 8
                ? "bg-red-50 text-red-600"
                : score >= 5
                ? "bg-orange-50 text-orange-600"
                : "bg-emerald-50 text-emerald-600";

              return (
                <div
                  key={req.id}
                  onClick={() =>
                    req.location &&
                    setSelectedLocation([req.location.lat, req.location.lng])
                  }
                  className={`bg-white rounded-xl p-3 shadow-sm hover:shadow-lg hover:-translate-y-0.5 border border-slate-100 ${cardBorder} border-l-[4px] transition-all cursor-pointer group`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide flex items-center gap-1 ${badgeStyle}`}
                      >
                        {req.isBlackCase ? (
                          <Skull size={10} className="text-red-500" />
                        ) : isDone ? (
                          <CheckCircle2 size={10} />
                        ) : (
                          <Activity size={10} />
                        )}
                        {req.isBlackCase
                          ? "รอเก็บกู้ (เสียชีวิต)"
                          : isDone
                          ? "DONE"
                          : `RISK ${score}`}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-full font-medium">
                      <Clock size={10} />{" "}
                      {new Date(
                        req.timestamp?.seconds * 1000
                      ).toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800 text-sm md:text-base line-clamp-1">
                        {req.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-500 mt-0.5 mb-2 font-medium">
                        <span className="flex items-center gap-0.5">
                          <Phone size={10} /> {req.contact}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span className="flex items-center gap-0.5 text-blue-500 bg-blue-50 px-1.5 rounded">
                          <Users size={10} /> {req.peopleCount}
                        </span>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[10px] md:text-xs text-slate-600 italic mb-2 line-clamp-2">
                        "{req.description}"
                      </div>

                      {req.address && (
                        <div className="flex items-start gap-2 text-[10px] text-slate-500 mb-3 bg-slate-50 p-2 rounded border border-slate-100">
                          <MapPin
                            size={12}
                            className="mt-0.5 text-red-500 flex-shrink-0"
                          />
                          <div>
                            <span className="font-bold text-slate-700 block">
                              {req.address.details}
                            </span>
                            <span>
                              {req.address.subdistrict} {req.address.district}{" "}
                              {req.address.province}
                            </span>
                          </div>
                        </div>
                      )}

                      {(req.status === "inprogress" ||
                        req.status === "completed") &&
                        req.rescuerName && (
                          <div className="flex items-center gap-2 mb-2 bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md text-[10px] border border-indigo-100">
                            <UserCheck size={12} />{" "}
                            <span>
                              ดูแลโดย: <b>{req.rescuerName}</b>
                            </span>
                          </div>
                        )}

                      <div className="flex gap-2 mt-auto">
                        <button
                          onClick={(e) =>
                            openMaps(req.location!.lat, req.location!.lng, e)
                          }
                          className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold transition flex items-center justify-center gap-1"
                        >
                          <Navigation size={12} /> นำทาง
                        </button>

                        {req.status === "waiting" && (
                          <button
                            onClick={(e) => initiateAccept(req.id, e)}
                            className="flex-1 py-1.5 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 shadow-sm bg-orange-500 hover:bg-orange-600"
                          >
                            <ArrowRightCircle size={12} /> รับงาน
                          </button>
                        )}
                        {req.status === "inprogress" && (
                          <>
                            {req.isBlackCase ? (
                              <button
                                onClick={(e) => finishBlackCase(req.id, e)}
                                className="flex-1 py-1.5 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 shadow-sm bg-black hover:bg-gray-800"
                              >
                                <Trash2 size={12} /> ยืนยันเก็บกู้
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => closeCase(req.id, e)}
                                  className="flex-1 py-1.5 text-white rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 shadow-sm bg-emerald-600 hover:bg-emerald-700"
                                >
                                  <CheckCircle2 size={12} /> ปิดงาน
                                </button>
                                <button
                                  onClick={(e) => markAsBlackCase(req.id, e)}
                                  className="px-3 py-1.5 rounded-lg text-white text-[10px] font-bold flex items-center justify-center gap-1 shadow-sm bg-slate-700 hover:bg-black"
                                >
                                  <Skull size={12} /> เคสดำ
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {req.imageUrl && (
                      <img
                        src={req.imageUrl}
                        className="w-20 h-20 rounded-xl object-cover border border-slate-100 shadow-sm"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ================= MAP SECTION ================= */}
      <div className="w-full h-full relative z-0 bg-slate-200">
        <MapContainer
          center={[13.7563, 100.5018]}
          zoom={10}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          {filteredRequests.map((req) => {
            if (!req.location) return null;
            const score = req.ai_analysis?.risk_score || 0;
            return (
              <Marker
                key={req.id}
                position={req.location}
                icon={createLabelIcon(
                  req.name,
                  score,
                  req.status,
                  req.isBlackCase
                )}
                zIndexOffset={
                  req.status === "completed"
                    ? -1000
                    : req.isBlackCase
                    ? 2000
                    : 100
                }
              >
                <Popup>
                  <div className="flex flex-col font-sans">
                    {req.imageUrl ? (
                      <div
                        className="h-24 w-full bg-cover bg-center rounded-t-lg relative"
                        style={{ backgroundImage: `url(${req.imageUrl})` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                        <span
                          className={`absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded text-white ${
                            req.isBlackCase
                              ? "bg-black"
                              : req.status === "waiting"
                              ? "bg-red-600"
                              : req.status === "inprogress"
                              ? "bg-orange-500"
                              : "bg-emerald-600"
                          }`}
                        >
                          {req.isBlackCase
                            ? "URGENT: RECOVERY"
                            : req.status === "waiting"
                            ? `RISK ${score}`
                            : req.status === "inprogress"
                            ? "WORKING"
                            : "DONE"}
                        </span>
                      </div>
                    ) : (
                      <div className="h-10 w-full bg-slate-100 flex items-center justify-center border-b border-slate-200">
                        <span className="text-xs text-slate-400 font-medium">
                          ไม่มีรูปภาพ
                        </span>
                      </div>
                    )}
                    <div className="p-3">
                      <h3 className="font-bold text-slate-800 text-sm mb-1 line-clamp-1">
                        {req.name}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                        <span className="flex items-center gap-0.5">
                          <Phone size={10} /> {req.contact}
                        </span>
                        <span className="flex items-center gap-0.5 text-blue-600 bg-blue-50 px-1 rounded">
                          <Users size={10} /> {req.peopleCount}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 italic line-clamp-3 mb-3">
                        "{req.description}"
                      </p>

                      {req.address && (
                        <div className="flex items-start gap-2 text-[10px] text-slate-500 mb-3 bg-slate-50 p-2 rounded border border-slate-100">
                          <MapPin
                            size={12}
                            className="mt-0.5 text-red-500 flex-shrink-0"
                          />
                          <div>
                            <span className="font-bold text-slate-700 block">
                              {req.address.details}
                            </span>
                            <span>
                              {req.address.subdistrict} {req.address.district}{" "}
                              {req.address.province}
                            </span>
                          </div>
                        </div>
                      )}

                      {(req.status === "inprogress" ||
                        req.status === "completed") &&
                        req.rescuerName && (
                          <div className="text-[10px] bg-indigo-50 text-indigo-700 p-1.5 rounded border border-indigo-100 mb-2">
                            <b>ผู้รับผิดชอบ:</b> {req.rescuerName}
                          </div>
                        )}
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <button
                            onClick={(e) =>
                              openMaps(req.location!.lat, req.location!.lng, e)
                            }
                            className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                          >
                            <Navigation size={12} /> ไป
                          </button>
                          {req.status === "waiting" && (
                            <button
                              onClick={(e) => initiateAccept(req.id, e)}
                              className="flex-1 py-1.5 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm bg-orange-500 hover:bg-orange-600"
                            >
                              รับงาน
                            </button>
                          )}
                          {req.status === "inprogress" && !req.isBlackCase && (
                            <button
                              onClick={(e) => closeCase(req.id, e)}
                              className="flex-1 py-1.5 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm bg-emerald-600 hover:bg-emerald-700"
                            >
                              ปิดงาน
                            </button>
                          )}
                          {req.isBlackCase && (
                            <button
                              onClick={(e) => finishBlackCase(req.id, e)}
                              className="flex-1 py-1.5 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm bg-black hover:bg-gray-800"
                            >
                              <Trash2 size={12} /> ยืนยันเก็บกู้
                            </button>
                          )}
                        </div>
                        {req.status === "inprogress" && !req.isBlackCase && (
                          <button
                            onClick={(e) => markAsBlackCase(req.id, e)}
                            className="w-full py-1.5 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm bg-slate-700 hover:bg-black"
                          >
                            <Skull size={12} /> แจ้งเคสดำ (เสียชีวิต)
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
