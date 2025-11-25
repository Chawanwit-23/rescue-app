// src/Dashboard.tsx (Master Version: Responsive + Actions + Full Filters)
import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, query, doc, updateDoc } from "firebase/firestore";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import * as LucideIcons from "lucide-react"; 
import { Link } from "react-router-dom";

// --- 1. ส่วน Import ไอคอน (ดึงมาเฉพาะที่ใช้จริง ลดขนาดไฟล์) ---
const { 
  AlertTriangle, 
  CheckCircle, 
  Navigation, 
  ArrowRightCircle, 
  Activity, 
  Users, 
  MapPin, 
  Search, 
  Siren, 
  CheckCircle2, 
  RefreshCw 
} = LucideIcons as any;

// --- 2. Interface (กำหนดประเภทข้อมูล เพื่อความแม่นยำ) ---
interface RequestData {
  id: string;
  name: string;
  contact: string;
  description: string;
  peopleCount: number;
  waterLevel?: string;
  reporterType?: string;
  location?: { lat: number, lng: number };
  address?: {
    province: string;
    district: string;
    subdistrict: string;
    details: string;
    postcode?: string;
  };
  imageUrl?: string;
  status: 'waiting' | 'inprogress' | 'completed';
  timestamp?: any;
  ai_analysis?: {
    risk_score: number;
    summary?: string;
  };
}

// --- 3. ฟังก์ชันสร้างหมุดบนแผนที่ (Label Marker) ---
const createLabelIcon = (name: string, score: number, status: string) => {
  let borderColor = "#22c55e"; // เขียว (Default)
  let textColor = "#15803d";
  let bgColor = "white";
  
  // Logic เปลี่ยนสีตามสถานะและความเสี่ยง
  if (status === 'completed') {
    borderColor = "#64748b"; // เทา (เสร็จแล้ว)
    textColor = "#64748b";
    bgColor = "#f1f5f9";
  } else if (status === 'inprogress') {
    borderColor = "#f97316"; // ส้ม (กำลังทำ)
    textColor = "#c2410c";
  } else if (score >= 8) {
    borderColor = "#ef4444"; // แดง (วิกฤต)
    textColor = "#b91c1c";
  } else if (score >= 5) {
    borderColor = "#f97316"; // ส้ม (ปานกลาง)
    textColor = "#c2410c";
  }

  // HTML CSS สำหรับป้ายชื่อ
  const html = `
    <div style="
      background-color: ${bgColor};
      border: 2px solid ${borderColor};
      border-radius: 8px;
      padding: 4px 8px;
      white-space: nowrap;
      font-weight: bold;
      font-size: 12px;
      color: ${textColor};
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      text-align: center;
      position: relative;
      display: inline-block;
      transform: translate(-50%, -50%);
      min-width: 80px;
    ">
      <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
        <span>${name}</span>
        ${status === 'waiting' ? `<span style="background:${borderColor}; color:white; border-radius:50%; width:16px; height:16px; font-size:10px; display:flex; align-items:center; justify-content:center;">${score}</span>` : ''}
      </div>
      
      <div style="
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        width: 0; 
        height: 0; 
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid ${borderColor};
      "></div>
    </div>
  `;

  return L.divIcon({
    className: "custom-div-icon",
    html: html,
    iconSize: [100, 40],
    iconAnchor: [50, 40]
  });
};

// --- 4. Component ย่อย: บินไปหาจุดพิกัด ---
function MapFlyTo({ location }: { location: [number, number] }) {
  const map = useMap();
  useEffect(() => { 
    if (location) {
      map.flyTo(location, 16, { duration: 1.5 });
    }
  }, [location, map]);
  return null;
}

// --- 5. Component ย่อย: การ์ดสถิติ (StatCard) ---
function StatCard({ label, count, color, icon }: any) {
  return (
    <div className="bg-white/10 rounded-lg p-2 flex items-center justify-between border border-white/10 hover:bg-white/20 transition cursor-pointer">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${color} text-white shadow-sm`}>{icon}</div>
        <span className="text-[10px] md:text-xs text-slate-300 font-medium">{label}</span>
      </div>
      <span className="text-sm md:text-lg font-bold text-white drop-shadow-sm">{count}</span>
    </div>
  );
}

// ==========================================
// 🚀 Main Component: Dashboard (War Room)
// ==========================================
export default function Dashboard() {
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // State สำหรับ Dropdown Filter
  const [selectedProvince, setSelectedProvince] = useState("ทั้งหมด");
  const [selectedDistrict, setSelectedDistrict] = useState("ทั้งหมด");
  const [selectedSubDistrict, setSelectedSubDistrict] = useState("ทั้งหมด");

  // --- Real-time Listener (ดึงข้อมูลจาก Firebase) ---
  useEffect(() => {
    const q = query(collection(db, "requests"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestData));
      setRequests(data);
    });
    return () => unsub();
  }, []);

  // --- Logic สำหรับ Dropdown (Memoized เพื่อความเร็ว) ---
  const provinces = useMemo(() => {
    const list = requests.map(r => r.address?.province).filter(Boolean);
    return ["ทั้งหมด", ...new Set(list)];
  }, [requests]);

  const districts = useMemo(() => {
    const list = requests
      .filter(r => selectedProvince === "ทั้งหมด" || r.address?.province === selectedProvince)
      .map(r => r.address?.district).filter(Boolean);
    return ["ทั้งหมด", ...new Set(list)];
  }, [requests, selectedProvince]);

  const subdistricts = useMemo(() => {
    const list = requests
      .filter(r => (selectedProvince === "ทั้งหมด" || r.address?.province === selectedProvince) && 
                   (selectedDistrict === "ทั้งหมด" || r.address?.district === selectedDistrict))
      .map(r => r.address?.subdistrict).filter(Boolean);
    return ["ทั้งหมด", ...new Set(list)];
  }, [requests, selectedProvince, selectedDistrict]);

  // --- Logic การกรองข้อมูล (Filter & Sort) ---
  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.address?.details?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProvince = selectedProvince === "ทั้งหมด" || req.address?.province === selectedProvince;
    const matchesDistrict = selectedDistrict === "ทั้งหมด" || req.address?.district === selectedDistrict;
    const matchesSubDistrict = selectedSubDistrict === "ทั้งหมด" || req.address?.subdistrict === selectedSubDistrict;

    return matchesSearch && matchesProvince && matchesDistrict && matchesSubDistrict;
  }).sort((a, b) => {
    // ลำดับความสำคัญ: งานยังไม่เสร็จ > Risk Score มากไปน้อย
    if (a.status === "completed" && b.status !== "completed") return 1;
    if (a.status !== "completed" && b.status === "completed") return -1;
    return (b.ai_analysis?.risk_score || 0) - (a.ai_analysis?.risk_score || 0);
  });

  // --- คำนวณสถิติ ---
  const stats = {
    waiting: filteredRequests.filter(r => r.status === 'waiting').length,
    critical: filteredRequests.filter(r => r.ai_analysis?.risk_score! >= 8 && r.status !== 'completed').length,
    working: filteredRequests.filter(r => r.status === 'inprogress').length,
    completed: filteredRequests.filter(r => r.status === 'completed').length,
  };

  // --- Function อัปเดตสถานะ (กดรับงาน / ปิดเคส) ---
  const updateStatus = async (id: string, newStatus: string, e: any) => {
    e.stopPropagation(); // กันไม่ให้กดแล้ว Map ขยับ
    const confirmMsg = newStatus === 'inprogress' ? "ยืนยันจะรับเคสนี้?" : "ยืนยันการปิดเคส?";
    if(!confirm(confirmMsg)) return;
    
    try { 
        await updateDoc(doc(db, "requests", id), { status: newStatus }); 
    } catch (err) { 
        console.error(err);
        alert("เกิดข้อผิดพลาดในการอัปเดต");
    }
  };

  // --- เปิด Google Maps ---
  const openGoogleMaps = (lat: number, lng: number, e: any) => {
    e.stopPropagation();
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  // ==========================================
  // 🎨 UI Rendering
  // ==========================================
  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 overflow-hidden font-sans">
      
      {/* ---------------- Sidebar (รายการ) ---------------- */}
      <div className="w-full h-[55vh] md:w-1/3 md:h-full md:min-w-[420px] bg-white shadow-2xl z-20 flex flex-col border-b md:border-b-0 md:border-r border-gray-200">
        
        {/* Header Area */}
        <div className="p-4 bg-slate-900 text-white shadow-md flex-shrink-0">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-lg md:text-xl font-bold flex items-center gap-2 text-red-500">
              <Activity className="animate-pulse" /> WAR ROOM
            </h1>
            <Link to="/" className="text-[10px] md:text-xs bg-slate-800 px-3 py-1.5 rounded-full text-slate-400 border border-slate-700 hover:bg-slate-700 transition">
                ← หน้าแจ้งเหตุ
            </Link>
          </div>

          {/* Stat Cards Grid */}
          <div className="grid grid-cols-4 md:grid-cols-2 gap-2 mb-3">
            <StatCard label="รอช่วย" count={stats.waiting} color="bg-blue-500" icon={<Users size={12}/>} />
            <StatCard label="วิกฤต!" count={stats.critical} color="bg-red-600" icon={<AlertTriangle size={12}/>} />
            <StatCard label="กำลังช่วย" count={stats.working} color="bg-orange-500" icon={<Siren size={12}/>} />
            <StatCard label="เสร็จสิ้น" count={stats.completed} color="bg-green-600" icon={<CheckCircle2 size={12}/>} />
          </div>

          {/* Filters Area */}
          <div className="flex flex-col gap-2 bg-slate-800 p-2 md:p-3 rounded-lg border border-slate-700">
             <div className="flex gap-2">
                 <div className="flex-1">
                    <select value={selectedProvince} onChange={(e) => { setSelectedProvince(e.target.value); setSelectedDistrict("ทั้งหมด"); setSelectedSubDistrict("ทั้งหมด"); }} className="w-full bg-slate-700 text-[10px] md:text-xs text-white border border-slate-600 rounded-md p-1.5 outline-none">
                      {provinces.map(p => <option key={p} value={p}>{p === "ทั้งหมด" ? "ทุกจังหวัด" : p}</option>)}
                    </select>
                 </div>
                 <div className="flex-1">
                    <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedSubDistrict("ทั้งหมด"); }} className="w-full bg-slate-700 text-[10px] md:text-xs text-white border border-slate-600 rounded-md p-1.5 outline-none" disabled={selectedProvince === "ทั้งหมด"}>
                      {districts.map(d => <option key={d} value={d}>{d === "ทั้งหมด" ? "ทุกอำเภอ" : d}</option>)}
                    </select>
                 </div>
             </div>
             <div>
                <select value={selectedSubDistrict} onChange={(e) => setSelectedSubDistrict(e.target.value)} className="w-full bg-slate-700 text-[10px] md:text-xs text-white border border-slate-600 rounded-md p-1.5 outline-none" disabled={selectedDistrict === "ทั้งหมด"}>
                  {subdistricts.map(s => <option key={s} value={s}>{s === "ทั้งหมด" ? "ทุกตำบล/แขวง" : s}</option>)}
                </select>
             </div>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="p-2 md:p-3 border-b border-gray-100 bg-white sticky top-0 z-10 flex-shrink-0">
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                <input type="text" placeholder="ค้นหาเคส (ชื่อ, ที่อยู่, รายละเอียด)..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-1.5 md:py-2 text-sm border border-gray-200 rounded-lg focus:ring-blue-500 outline-none bg-gray-50"/>
            </div>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-3 bg-slate-50">
          {filteredRequests.length === 0 && (
             <div className="text-center py-10 text-gray-400 text-sm">ไม่พบข้อมูลในพื้นที่นี้</div>
          )}

          {filteredRequests.map((req) => {
            const isDone = req.status === 'completed';
            const isWorking = req.status === 'inprogress';
            const score = req.ai_analysis?.risk_score || 0;
            let borderClass = isDone ? "border-slate-200 bg-slate-50 opacity-60" : (score >= 8 ? "border-red-600 bg-red-50/40" : (score >= 5 ? "border-orange-400 bg-orange-50/40" : "border-green-500 bg-white"));

            return (
              <div key={req.id} onClick={() => req.location && setSelectedLocation([req.location.lat, req.location.lng])} className={`p-3 rounded-xl border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all group relative overflow-hidden ${borderClass}`}>
                
                {/* ลายน้ำ 'เสร็จแล้ว' */}
                {isDone && <CheckCircle size={80} className="absolute -right-4 -bottom-4 text-green-200/50 rotate-[-15deg]"/>}

                <div className="flex justify-between items-start gap-2 relative z-10">
                  <div className="flex-1">
                    {/* Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                      {!isDone ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white shadow-sm ${score >= 8 ? 'bg-red-600 animate-pulse' : score >= 5 ? 'bg-orange-500' : 'bg-green-600'}`}>RISK {score}</span>
                      ) : (<span className="text-[10px] bg-slate-500 text-white px-2 py-0.5 rounded flex items-center gap-1 shadow-sm"><CheckCircle size={10}/> จบงานแล้ว</span>)}
                      
                      {isWorking && !isDone && <span className="text-[10px] bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded flex items-center gap-1 border border-orange-200"><RefreshCw size={10} className="animate-spin"/> กำลังช่วยเหลือ</span>}
                      
                      {req.peopleCount > 1 && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1"><Users size={10}/> {req.peopleCount}</span>}
                    </div>

                    <h3 className="font-bold text-sm md:text-base text-gray-800 line-clamp-1">{req.name}</h3>
                    {req.address?.details && <p className="text-[10px] text-slate-500 line-clamp-1 mb-1"><MapPin size={10} className="inline"/> {req.address.details} {req.address.subdistrict} {req.address.district}</p>}
                    <p className="text-xs text-gray-600 bg-white/60 p-1.5 rounded border border-slate-100 line-clamp-2">"{req.description}"</p>
                    
                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-slate-200/50">
                        {/* ปุ่มนำทาง */}
                        <button onClick={(e) => openGoogleMaps(req.location!.lat, req.location!.lng, e)} className="col-span-1 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 text-xs font-bold flex justify-center items-center gap-1 border border-slate-200 transition">
                            <Navigation size={12} /> นำทาง
                        </button>

                        {/* ปุ่มเปลี่ยนสถานะ */}
                        {req.status === 'waiting' && (
                            <button onClick={(e) => updateStatus(req.id, 'inprogress', e)} className="col-span-1 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-xs font-bold flex justify-center items-center gap-1 shadow-sm shadow-orange-200 transition active:scale-95">
                                <ArrowRightCircle size={12} /> รับงานนี้
                            </button>
                        )}
                        
                        {req.status === 'inprogress' && (
                            <button onClick={(e) => updateStatus(req.id, 'completed', e)} className="col-span-1 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 text-xs font-bold flex justify-center items-center gap-1 shadow-sm shadow-green-200 transition active:scale-95">
                                <CheckCircle size={12} /> ปิดเคส
                            </button>
                        )}

                        {req.status === 'completed' && (
                            <div className="col-span-1 py-1.5 text-slate-400 text-xs text-center border border-slate-100 rounded-lg bg-slate-50 cursor-not-allowed">
                                เรียบร้อย
                            </div>
                        )}
                    </div>

                  </div>
                  {req.imageUrl && <img src={req.imageUrl} className="w-16 h-16 md:w-20 md:h-20 rounded-lg object-cover border bg-white shadow-sm flex-shrink-0" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- Map Section ---------------- */}
      <div className="flex-1 w-full h-[45vh] md:h-full relative z-0">
        <MapContainer center={[13.7563, 100.5018]} zoom={10} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />
          {selectedLocation && <MapFlyTo location={selectedLocation} />}

          {filteredRequests.map((req) => {
            if (!req.location) return null;
            const score = req.ai_analysis?.risk_score || 0;
            const icon = createLabelIcon(req.name, score, req.status);

            return (
              <Marker key={req.id} position={req.location} icon={icon}>
                <Popup>
                  <div className="text-center min-w-[160px]">
                    <b className="text-sm">{req.name}</b>
                    <br/>
                    <div className="my-2">
                        {req.status === 'waiting' && <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold">รอความช่วยเหลือ</span>}
                        {req.status === 'inprogress' && <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-bold animate-pulse">🚑 กำลังเดินทางไป</span>}
                        {req.status === 'completed' && <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold">✅ เสร็จสิ้น</span>}
                    </div>
                    
                    <p className="text-xs text-slate-500 mb-2">"{req.description}"</p>

                    {req.status !== 'completed' && (
                         <button onClick={(e) => updateStatus(req.id, req.status === 'waiting' ? 'inprogress' : 'completed', e)} className={`mt-1 w-full py-1.5 text-white rounded text-xs font-bold shadow-sm ${req.status === 'waiting' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}>
                            {req.status === 'waiting' ? 'กดรับงาน' : 'กดปิดเคส'}
                         </button>
                    )}
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