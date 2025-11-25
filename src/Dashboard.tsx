// src/Dashboard.tsx (Fixed for Safari iOS Bottom Bar)
import { useState, useEffect, useMemo } from "react";
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
  ChevronUp, ChevronDown, Minus 
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
    borderColor = "#64748b"; 
    textColor = "#64748b";
    bgColor = "#f8fafc";
  } else if (status === 'inprogress') {
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
      background-color: ${bgColor};
      border: 2px solid ${borderColor};
      border-radius: 12px;
      padding: 6px 12px;
      white-space: nowrap;
      font-family: 'Kanit', sans-serif;
      font-weight: 600;
      font-size: 13px;
      color: ${textColor};
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      text-align: center;
      position: relative;
      display: inline-block;
      transform: translate(-50%, -50%);
      min-width: 90px;
    ">
      <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
        <span>${name}</span>
        ${status === 'waiting' ? `<span style="background:${borderColor}; color:white; border-radius:99px; padding: 0 6px; font-size:10px; height:18px; display:flex; align-items:center; justify-content:center;">${score}</span>` : ''}
      </div>
      <div style="position: absolute; bottom: -8px; left: 50%; transform: translateX(-50%); width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-top: 7px solid ${borderColor};"></div>
    </div>
  `;

  return L.divIcon({ className: "custom-div-icon", html: html, iconSize: [120, 50], iconAnchor: [60, 50] });
};

// Components
function MapFlyTo({ location }: { location: [number, number] }) {
  const map = useMap();
  useEffect(() => { if (location) map.flyTo(location, 16, { duration: 1.2, easeLinearity: 0.5 }); }, [location, map]);
  return null;
}

function StatCard({ label, count, color, icon }: any) {
  return (
    <div className={`relative overflow-hidden rounded-xl p-2 md:p-3 border border-white/10 ${color} shadow-lg hover:scale-[1.02] transition-transform cursor-default group flex-1`}>
      <div className="absolute right-0 top-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity transform scale-150">{icon}</div>
      <div className="relative z-10 flex flex-col items-center md:items-start">
        <span className="text-[9px] md:text-[10px] uppercase tracking-wider text-white/80 font-semibold">{label}</span>
        <span className="text-xl md:text-2xl font-bold text-white mt-1">{count}</span>
      </div>
    </div>
  );
}

// ==========================================
// 🎨 DASHBOARD (Safari Safe Version)
// ==========================================
export default function Dashboard() {
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileOpen, setIsMobileOpen] = useState(true);

  // Filters
  const [selectedProvince, setSelectedProvince] = useState("ทั้งหมด");
  const [selectedDistrict, setSelectedDistrict] = useState("ทั้งหมด");
  const [selectedSubDistrict, setSelectedSubDistrict] = useState("ทั้งหมด");

  useEffect(() => {
    const q = query(collection(db, "requests"));
    const unsub = onSnapshot(q, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestData)));
    });
    return () => unsub();
  }, []);

  // Filter Logic
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
    const confirmMsg = newStatus === 'inprogress' ? "⚠️ ยืนยันการรับเคสนี้?" : "✅ ยืนยันการปิดเคส?";
    if(!confirm(confirmMsg)) return;
    try { await updateDoc(doc(db, "requests", id), { status: newStatus }); } catch (err) { console.error(err); alert("Error"); }
  };

  const openMaps = (lat: number, lng: number, e: any) => {
    e.stopPropagation();
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  const formatTime = (ts: any) => {
    if(!ts) return "";
    return new Date(ts.seconds * 1000).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="flex flex-col-reverse md:flex-row h-screen bg-slate-50 overflow-hidden font-sans text-slate-800">
      
      {/* ================= SIDEBAR (Safe Area Patched) ================= */}
      <div 
        className={`
          w-full md:w-[450px] md:h-full bg-white shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.15)] z-[1000] flex flex-col border-r border-slate-200
          transition-all duration-300 ease-in-out
          
          /* 🟢 แก้ไขตรงนี้: เพิ่มความสูงตอนพับ + เว้นขอบล่าง (Safe Area) */
          ${isMobileOpen ? 'h-[55vh]' : 'h-[90px]'} 
          md:h-full
          pb-[env(safe-area-inset-bottom)]
        `}
      >
        
        {/* Mobile Toggle Handle */}
        <div 
          className="md:hidden w-full h-[32px] bg-white flex justify-center items-center cursor-pointer border-t-4 border-slate-300 rounded-t-3xl shadow-sm hover:bg-slate-50 active:bg-slate-100 relative z-50"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
        >
           {isMobileOpen ? <ChevronDown className="text-slate-400 animate-bounce" size={20}/> : <Minus className="text-slate-400" size={30}/>}
        </div>

        {/* 1. Header (Stats) */}
        <div className="p-3 md:p-5 bg-slate-900 text-white shadow-lg relative overflow-hidden flex-shrink-0">
          <div className="relative z-10">
            <div className={`flex justify-between items-center mb-3 ${!isMobileOpen ? 'hidden md:flex' : ''}`}>
              <h1 className="text-lg md:text-2xl font-bold flex items-center gap-2 bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent">
                <Siren className="text-red-500" fill="currentColor" size={20} /> WAR ROOM
              </h1>
              <Link to="/" className="text-[10px] md:text-xs bg-slate-800/80 hover:bg-slate-700 backdrop-blur-sm px-3 py-1.5 rounded-full text-slate-300 border border-slate-700 transition flex items-center gap-1">
                <ArrowRightCircle size={12} /> <span className="hidden md:inline">แจ้งเหตุ</span>
              </Link>
            </div>

            <div className={`grid grid-cols-4 gap-2 ${!isMobileOpen ? 'opacity-100' : ''}`}>
              <StatCard label="รอช่วย" count={stats.waiting} color="bg-blue-600" icon={<Users />} />
              <StatCard label="วิกฤต" count={stats.critical} color="bg-red-600" icon={<AlertTriangle />} />
              <StatCard label="กำลัง" count={stats.working} color="bg-orange-500" icon={<Navigation />} />
              <StatCard label="เสร็จ" count={stats.completed} color="bg-emerald-600" icon={<CheckCircle2 />} />
            </div>
          </div>
        </div>
        
        {/* List Content */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-opacity duration-300 ${!isMobileOpen ? 'opacity-0 pointer-events-none hidden md:flex md:opacity-100 md:pointer-events-auto' : 'opacity-100'}`}>
            {/* Filters */}
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

            {/* List */}
            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-slate-50/50">
              {filteredRequests.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400 space-y-2">
                    <Filter size={30} className="text-slate-300"/>
                    <span className="text-xs font-medium">ไม่พบข้อมูล</span>
                </div>
              )}

              {filteredRequests.map((req) => {
                const isDone = req.status === 'completed';
                const isWorking = req.status === 'inprogress';
                const score = req.ai_analysis?.risk_score || 0;
                let cardBorder = isDone ? "border-l-slate-300" : (score >= 8 ? "border-l-red-500" : (score >= 5 ? "border-l-orange-400" : "border-l-emerald-500"));
                let badgeStyle = isDone ? "bg-slate-100 text-slate-500" : (score >= 8 ? "bg-red-100 text-red-700" : (score >= 5 ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700"));
                
                return (
                  <div key={req.id} onClick={() => req.location && setSelectedLocation([req.location.lat, req.location.lng])} className={`bg-white rounded-xl p-3 shadow-sm hover:shadow-md border border-slate-100 ${cardBorder} border-l-[6px] transition-all cursor-pointer group relative overflow-hidden`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide flex items-center gap-1 ${badgeStyle}`}>
                            {isDone ? <CheckCircle2 size={10}/> : <Activity size={10}/>}
                            {isDone ? "Completed" : `Risk Score: ${score}`}
                          </span>
                          {isWorking && !isDone && <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-100 px-2 py-1 rounded-md flex items-center gap-1 font-bold"><Siren size={10} className="animate-pulse"/> กำลังช่วย</span>}
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-full"><Clock size={10}/> {formatTime(req.timestamp)}</span>
                    </div>

                    <div className="flex gap-3">
                      <div className="flex-1">
                          <h3 className="font-bold text-slate-800 text-sm md:text-base line-clamp-1">{req.name}</h3>
                          <div className="flex items-center gap-1 text-[10px] md:text-xs text-slate-500 mt-1 mb-2">
                            <Phone size={10} className="text-blue-500"/> {req.contact} 
                            <span className="mx-1">•</span> 
                            <Users size={10} className="text-blue-500"/> {req.peopleCount} คน
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[10px] md:text-xs text-slate-600 italic mb-2 leading-relaxed line-clamp-2">"{req.description}"</div>
                          {req.address?.details && <div className="flex items-start gap-1.5 text-[10px] text-slate-500 mb-2"><MapPin size={10} className="mt-0.5 text-red-400 flex-shrink-0"/> <span className="line-clamp-1">{req.address.details} {req.address.subdistrict}</span></div>}

                          <div className="grid grid-cols-2 gap-2 mt-auto">
                            <button onClick={(e) => openMaps(req.location!.lat, req.location!.lng, e)} className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold transition"><Navigation size={12}/> นำทาง</button>
                            {req.status === 'waiting' && <button onClick={(e) => updateStatus(req.id, 'inprogress', e)} className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-[10px] font-bold shadow-md shadow-orange-200 transition transform active:scale-95"><ArrowRightCircle size={12}/> รับงาน</button>}
                            {req.status === 'inprogress' && <button onClick={(e) => updateStatus(req.id, 'completed', e)} className="flex items-center justify-center gap-1 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-[10px] font-bold shadow-md shadow-emerald-200 transition transform active:scale-95"><CheckCircle2 size={12}/> ปิดเคส</button>}
                            {req.status === 'completed' && <div className="flex items-center justify-center text-[10px] text-slate-400 font-medium bg-slate-50 rounded-lg border border-slate-100 cursor-default">เสร็จแล้ว</div>}
                          </div>
                      </div>
                      
                      {req.imageUrl && (
                          <div className="w-16 flex-shrink-0 flex flex-col gap-2">
                            <img src={req.imageUrl} className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-sm" />
                            {req.contact && <a href={`tel:${req.contact}`} onClick={(e)=>e.stopPropagation()} className="w-full py-1 bg-green-50 text-green-600 border border-green-200 rounded-lg text-[9px] font-bold text-center hover:bg-green-100 flex justify-center gap-1"><Phone size={8}/> โทร</a>}
                          </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
        </div>
      </div>

      {/* ================= MAP SECTION ================= */}
      <div className="flex-1 w-full h-full relative z-0 bg-slate-200">
        <MapContainer center={[13.7563, 100.5018]} zoom={10} style={{ height: "100%", width: "100%" }} zoomControl={false}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" attribution='© CARTO' />
          {selectedLocation && <MapFlyTo location={selectedLocation} />}

          {filteredRequests.map((req) => {
            if (!req.location) return null;
            const score = req.ai_analysis?.risk_score || 0;
            const icon = createLabelIcon(req.name, score, req.status);

            return (
              <Marker key={req.id} position={req.location} icon={icon}>
                <Popup className="custom-popup">
                  <div className="text-center min-w-[180px] font-sans p-1">
                    <b className="text-sm text-slate-800">{req.name}</b>
                    <p className="text-xs text-slate-500 mt-1 mb-2 line-clamp-2">"{req.description}"</p>
                    {req.status !== 'completed' && (
                         <button onClick={(e) => updateStatus(req.id, req.status === 'waiting' ? 'inprogress' : 'completed', e)} className={`w-full py-1.5 text-white rounded-lg text-xs font-bold shadow-sm transition ${req.status === 'waiting' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                            {req.status === 'waiting' ? 'รับงานนี้' : 'ปิดเคส'}
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