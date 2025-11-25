// src/Dashboard.tsx (Draggable Bottom Sheet - Google Maps Style)
import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, query, doc, updateDoc } from "firebase/firestore";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import * as LucideIcons from "lucide-react"; 
import { Link } from "react-router-dom";

// Icons
const { 
  AlertTriangle, CheckCircle2, Navigation, ArrowRightCircle, Activity, 
  Users, MapPin, Search, Siren, Phone, Clock, Filter, Menu,
  Minus 
} = LucideIcons as any;

// Interface
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
  };
  imageUrl?: string;
  status: 'waiting' | 'inprogress' | 'completed';
  timestamp?: any;
  ai_analysis?: {
    risk_score: number;
    summary?: string;
  };
}

// Marker Logic
const createLabelIcon = (name: string, score: number, status: string) => {
  let borderColor = "#10b981"; 
  let textColor = "#047857";
  let bgColor = "white";
  
  if (status === 'completed') {
    borderColor = "#64748b"; textColor = "#64748b"; bgColor = "#f8fafc";
  } else if (status === 'inprogress') {
    borderColor = "#f97316"; textColor = "#c2410c";
  } else if (score >= 8) {
    borderColor = "#ef4444"; textColor = "#b91c1c";
  } else if (score >= 5) {
    borderColor = "#f59e0b"; textColor = "#b45309";
  }

  const html = `
    <div style="background-color:${bgColor}; border:2px solid ${borderColor}; border-radius:12px; padding:6px 12px; white-space:nowrap; font-family:'Kanit',sans-serif; font-weight:600; font-size:13px; color:${textColor}; box-shadow:0 4px 6px rgba(0,0,0,0.1); text-align:center; position:relative; display:inline-block; transform:translate(-50%,-50%); min-width:90px;">
      <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
        <span>${name}</span>
        ${status === 'waiting' ? `<span style="background:${borderColor}; color:white; border-radius:99px; padding:0 6px; font-size:10px; height:18px; display:flex; align-items:center; justify-content:center;">${score}</span>` : ''}
      </div>
      <div style="position:absolute; bottom:-8px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:7px solid transparent; border-right:7px solid transparent; border-top:7px solid ${borderColor};"></div>
    </div>
  `;
  return L.divIcon({ className: "custom-div-icon", html: html, iconSize: [120, 50], iconAnchor: [60, 50] });
};

// Helper Components
function MapFlyTo({ location }: { location: [number, number] }) {
  const map = useMap();
  useEffect(() => { if (location) map.flyTo(location, 16, { duration: 1.2, easeLinearity: 0.5 }); }, [location, map]);
  return null;
}

function StatCard({ label, count, color, icon }: any) {
  return (
    <div className={`relative overflow-hidden rounded-xl p-2 md:p-3 border border-white/10 ${color} shadow-lg flex-1`}>
      <div className="absolute right-0 top-0 p-3 opacity-10 scale-150">{icon}</div>
      <div className="relative z-10 flex flex-col items-center md:items-start">
        <span className="text-[9px] md:text-[10px] uppercase tracking-wider text-white/80 font-semibold">{label}</span>
        <span className="text-xl md:text-2xl font-bold text-white mt-1">{count}</span>
      </div>
    </div>
  );
}

// ==========================================
// 🎨 DASHBOARD (Draggable Sheet Version)
// ==========================================
export default function Dashboard() {
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // 🟢 Draggable Sheet States
  const [sheetHeight, setSheetHeight] = useState(45); // ความสูงเริ่มต้น (45%)
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Filters
  const [selectedProvince, setSelectedProvince] = useState("ทั้งหมด");
  const [selectedDistrict, setSelectedDistrict] = useState("ทั้งหมด");
  const [selectedSubDistrict, setSelectedSubDistrict] = useState("ทั้งหมด");

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "requests")), (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestData)));
    });
    return () => unsub();
  }, []);

  // Filter Logic & Sort
  const provinces = useMemo(() => ["ทั้งหมด", ...new Set(requests.map(r => r.address?.province).filter(Boolean))], [requests]);
  const districts = useMemo(() => ["ทั้งหมด", ...new Set(requests.filter(r => selectedProvince === "ทั้งหมด" || r.address?.province === selectedProvince).map(r => r.address?.district).filter(Boolean))], [requests, selectedProvince]);
  const subdistricts = useMemo(() => ["ทั้งหมด", ...new Set(requests.filter(r => (selectedProvince === "ทั้งหมด" || r.address?.province === selectedProvince) && (selectedDistrict === "ทั้งหมด" || r.address?.district === selectedDistrict)).map(r => r.address?.subdistrict).filter(Boolean))], [requests, selectedProvince, selectedDistrict]);

  const filteredRequests = requests.filter(req => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = req.name?.toLowerCase().includes(searchLower) || req.description?.toLowerCase().includes(searchLower) || req.address?.details?.toLowerCase().includes(searchLower);
    return matchesSearch && (selectedProvince === "ทั้งหมด" || req.address?.province === selectedProvince) && (selectedDistrict === "ทั้งหมด" || req.address?.district === selectedDistrict) && (selectedSubDistrict === "ทั้งหมด" || req.address?.subdistrict === selectedSubDistrict);
  }).sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return 1;
    if (a.status !== "completed" && b.status === "completed") return -1;
    return (b.ai_analysis?.risk_score || 0) - (a.ai_analysis?.risk_score || 0);
  });

  const stats = {
    waiting: filteredRequests.filter(r => r.status === 'waiting').length,
    critical: filteredRequests.filter(r => r.ai_analysis?.risk_score! >= 8 && r.status !== 'completed').length,
    working: filteredRequests.filter(r => r.status === 'inprogress').length,
    completed: filteredRequests.filter(r => r.status === 'completed').length,
  };

  const updateStatus = async (id: string, newStatus: string, e: any) => {
    e.stopPropagation();
    if(!confirm(newStatus === 'inprogress' ? "⚠️ ยืนยันการรับเคสนี้?" : "✅ ยืนยันการปิดเคส?")) return;
    try { await updateDoc(doc(db, "requests", id), { status: newStatus }); } catch (err) { console.error(err); }
  };

  const openMaps = (lat: number, lng: number, e: any) => {
    e.stopPropagation();
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  // --- 🤏 Drag Logic ---
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    dragStartY.current = e.touches[0].clientY;
    dragStartHeight.current = sheetHeight;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const deltaY = dragStartY.current - currentY; // ลากขึ้น = ค่าบวก
    const windowHeight = window.innerHeight;
    const deltaPercent = (deltaY / windowHeight) * 100;
    
    // คำนวณความสูงใหม่แบบ Real-time
    let newHeight = dragStartHeight.current + deltaPercent;
    if (newHeight < 10) newHeight = 10; // ต่ำสุด
    if (newHeight > 95) newHeight = 95; // สูงสุด
    
    setSheetHeight(newHeight);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    // Snap Logic: ดูดเข้าหาจุดที่ใกล้ที่สุด
    if (sheetHeight > 75) {
      setSheetHeight(92); // เต็มจอ
    } else if (sheetHeight > 30) {
      setSheetHeight(45); // ครึ่งจอ
    } else {
      setSheetHeight(12); // พับเก็บ
    }
  };

  return (
    <div className="flex flex-col-reverse md:flex-row h-screen bg-slate-50 overflow-hidden font-sans text-slate-800 relative">
      
      {/* ================= SIDEBAR (Draggable) ================= */}
      <div 
        className={`
          w-full md:w-[450px] bg-white shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.15)] z-[1000] flex flex-col border-r border-slate-200
          absolute bottom-0 left-0 md:relative md:h-full
          ${!isDragging ? 'transition-[height] duration-300 ease-out' : ''} // มี Animation เฉพาะตอนปล่อยมือ
          rounded-t-3xl md:rounded-none overflow-hidden
        `}
        style={{ height: `${window.innerWidth < 768 ? sheetHeight : 100}%` }} // มือถือใช้ % จาก State, คอมเต็มจอ
      >
        
        {/* 🤏 Drag Handle (พื้นที่สำหรับจับลาก) */}
        <div 
          className="md:hidden w-full h-[36px] bg-white flex justify-center items-center cursor-grab active:cursor-grabbing border-b border-slate-50 flex-shrink-0 touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
           {/* ขีดเทาๆ ตรงกลาง */}
           <div className="w-12 h-1.5 bg-slate-300 rounded-full"></div>
        </div>

        {/* 1. Header */}
        <div className="p-3 md:p-5 bg-slate-900 text-white shadow-lg relative overflow-hidden flex-shrink-0">
            <div className={`flex justify-between items-center mb-3 ${sheetHeight < 20 ? 'hidden md:flex' : ''}`}>
              <h1 className="text-lg md:text-2xl font-bold flex items-center gap-2 bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                <Siren className="text-red-500" fill="currentColor" size={20} /> WAR ROOM
              </h1>
              <Link to="/" className="text-[10px] md:text-xs bg-slate-800/80 hover:bg-slate-700 backdrop-blur-sm px-3 py-1.5 rounded-full text-slate-300 border border-slate-700 transition flex items-center gap-1">
                <ArrowRightCircle size={12} /> <span className="hidden md:inline">แจ้งเหตุ</span>
              </Link>
            </div>

            {/* Stats (ซ่อนถ้าพับจนเล็กสุด) */}
            <div className={`grid grid-cols-4 gap-2 transition-opacity duration-200 ${sheetHeight < 20 ? 'opacity-0 md:opacity-100 pointer-events-none' : 'opacity-100'}`}>
              <StatCard label="รอช่วย" count={stats.waiting} color="bg-blue-600" icon={<Users />} />
              <StatCard label="วิกฤต" count={stats.critical} color="bg-red-600" icon={<AlertTriangle />} />
              <StatCard label="กำลัง" count={stats.working} color="bg-orange-500" icon={<Navigation />} />
              <StatCard label="เสร็จ" count={stats.completed} color="bg-emerald-600" icon={<CheckCircle2 />} />
            </div>
        </div>
        
        {/* Filters + List (ซ่อนถ้าพับจนเล็กสุด) */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-opacity duration-200 ${sheetHeight < 20 ? 'opacity-0 md:opacity-100 pointer-events-none' : 'opacity-100'}`}>
            <div className="p-3 md:p-4 bg-white border-b border-slate-100 shadow-sm space-y-2 flex-shrink-0">
                <div className="relative group">
                    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"/>
                    <input type="text" placeholder="ค้นหา..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"/>
                </div>
                <div className="grid grid-cols-3 gap-1 md:gap-2">
                    <select value={selectedProvince} onChange={(e) => { setSelectedProvince(e.target.value); setSelectedDistrict("ทั้งหมด"); }} className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] md:text-xs rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500">
                        {provinces.map(p => <option key={p} value={p}>{p === "ทั้งหมด" ? "จ.ทั้งหมด" : p}</option>)}
                    </select>
                    <select value={selectedDistrict} onChange={(e) => { setSelectedDistrict(e.target.value); setSelectedSubDistrict("ทั้งหมด"); }} className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] md:text-xs rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" disabled={selectedProvince === "ทั้งหมด"}>
                        {districts.map(d => <option key={d} value={d}>{d === "ทั้งหมด" ? "อ.ทั้งหมด" : d}</option>)}
                    </select>
                    <select value={selectedSubDistrict} onChange={(e) => setSelectedSubDistrict(e.target.value)} className="bg-slate-50 border border-slate-200 text-slate-600 text-[10px] md:text-xs rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-500" disabled={selectedDistrict === "ทั้งหมด"}>
                        {subdistricts.map(s => <option key={s} value={s}>{s === "ทั้งหมด" ? "ต.ทั้งหมด" : s}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-slate-50/50 pb-20 md:pb-4">
              {filteredRequests.map((req) => {
                const isDone = req.status === 'completed';
                const score = req.ai_analysis?.risk_score || 0;
                let cardBorder = isDone ? "border-l-slate-300" : (score >= 8 ? "border-l-red-500" : (score >= 5 ? "border-l-orange-400" : "border-l-emerald-500"));
                let badgeStyle = isDone ? "bg-slate-100 text-slate-500" : (score >= 8 ? "bg-red-100 text-red-700" : (score >= 5 ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"));
                
                return (
                  <div key={req.id} onClick={() => req.location && setSelectedLocation([req.location.lat, req.location.lng])} className={`bg-white rounded-xl p-3 shadow-sm hover:shadow-md border border-slate-100 ${cardBorder} border-l-[6px] transition-all cursor-pointer group`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide flex items-center gap-1 ${badgeStyle}`}>
                            {isDone ? <CheckCircle2 size={10}/> : <Activity size={10}/>} {isDone ? "Completed" : `Risk ${score}`}
                          </span>
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-full"><Clock size={10}/> {new Date(req.timestamp?.seconds * 1000).toLocaleTimeString("th-TH",{hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                          <h3 className="font-bold text-slate-800 text-sm md:text-base line-clamp-1">{req.name}</h3>
                          <div className="flex items-center gap-1 text-[10px] md:text-xs text-slate-500 mt-1 mb-2"><Phone size={10}/> {req.contact}</div>
                          <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[10px] md:text-xs text-slate-600 italic mb-2 line-clamp-2">"{req.description}"</div>
                          <div className="grid grid-cols-2 gap-2 mt-auto">
                            <button onClick={(e) => openMaps(req.location!.lat, req.location!.lng, e)} className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold"><Navigation size={12}/> นำทาง</button>
                            {req.status !== 'completed' && <button onClick={(e) => updateStatus(req.id, req.status === 'waiting' ? 'inprogress' : 'completed', e)} className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-white text-[10px] font-bold ${req.status === 'waiting' ? 'bg-orange-500' : 'bg-emerald-600'}`}>{req.status === 'waiting' ? 'รับงาน' : 'ปิดเคส'}</button>}
                          </div>
                      </div>
                      {req.imageUrl && <img src={req.imageUrl} className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-sm" />}
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
      </div>

      {/* ================= MAP SECTION ================= */}
      <div className="w-full h-full relative z-0 bg-slate-200">
        <MapContainer center={[13.7563, 100.5018]} zoom={10} style={{ height: "100%", width: "100%" }} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='© CARTO' />
          {selectedLocation && <MapFlyTo location={selectedLocation} />}
          {filteredRequests.map((req) => {
             if(!req.location) return null;
             return <Marker key={req.id} position={req.location} icon={createLabelIcon(req.name, req.ai_analysis?.risk_score||0, req.status)}><Popup className="custom-popup"><b className="text-sm">{req.name}</b></Popup></Marker>
          })}
        </MapContainer>
      </div>
    </div>
  );
}