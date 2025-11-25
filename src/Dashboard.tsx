// src/Dashboard.tsx (Premium UI + Beautiful Map Popup)
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
  Users, MapPin, Search, Siren, Phone, Clock, Menu, X, LocateFixed 
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

// Marker Logic (Custom HTML Marker)
const createLabelIcon = (name: string, score: number, status: string) => {
  let borderColor = "#10b981"; let textColor = "#047857"; let bgColor = "white";
  if (status === 'completed') { borderColor = "#64748b"; textColor = "#64748b"; bgColor = "#f1f5f9"; } 
  else if (status === 'inprogress') { borderColor = "#f97316"; textColor = "#c2410c"; } 
  else if (score >= 8) { borderColor = "#ef4444"; textColor = "#b91c1c"; } 
  else if (score >= 5) { borderColor = "#f59e0b"; textColor = "#b45309"; }

  const html = `
    <div style="background-color:${bgColor}; border:2px solid ${borderColor}; border-radius:12px; padding:4px 8px; white-space:nowrap; font-family:'Kanit',sans-serif; font-weight:700; font-size:12px; color:${textColor}; box-shadow:0 4px 10px rgba(0,0,0,0.15); text-align:center; position:relative; display:inline-block; transform:translate(-50%,-50%); min-width:80px;">
      <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
        <span>${name}</span>
        ${status === 'waiting' ? `<span style="background:${borderColor}; color:white; border-radius:99px; padding:0 5px; font-size:9px; height:16px; display:flex; align-items:center; justify-content:center;">${score}</span>` : ''}
      </div>
      <div style="position:absolute; bottom:-7px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:6px solid transparent; border-right:6px solid transparent; border-top:6px solid ${borderColor};"></div>
    </div>
  `;
  return L.divIcon({ className: "custom-div-icon", html: html, iconSize: [120, 50], iconAnchor: [60, 50] });
};

// Helper Components
function MapFlyTo({ location }: { location: [number, number] }) {
  const map = useMap();
  useEffect(() => { if (location) map.flyTo(location, 16, { duration: 1.5, easeLinearity: 0.25 }); }, [location, map]);
  return null;
}

function StatCard({ label, count, color, icon }: any) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-3 border border-white/20 ${color} shadow-lg flex-1 group`}>
      <div className="absolute -right-2 -top-2 p-3 opacity-20 scale-150 group-hover:scale-[1.7] transition-transform duration-500">{icon}</div>
      <div className="relative z-10 flex flex-col items-center md:items-start">
        <span className="text-[9px] md:text-[10px] uppercase tracking-wider text-white/90 font-bold opacity-80">{label}</span>
        <span className="text-xl md:text-3xl font-black text-white mt-0.5 shadow-sm">{count}</span>
      </div>
    </div>
  );
}

// ==========================================
// 🎨 PREMIUM DASHBOARD
// ==========================================
export default function Dashboard() {
  const [requests, setRequests] = useState<RequestData[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null);
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

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "requests")), (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequestData)));
    });
    return () => unsub();
  }, []);

  // Filter & Sort Logic
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

  const updateStatus = async (id: string, newStatus: string, e?: any) => {
    e?.stopPropagation();
    const confirmMsg = newStatus === 'inprogress' ? "⚠️ ยืนยันการรับเคสนี้?" : "✅ ยืนยันการปิดเคส?";
    if(!confirm(confirmMsg)) return;
    try { await updateDoc(doc(db, "requests", id), { status: newStatus }); } catch (err) { console.error(err); }
  };

  const openMaps = (lat: number, lng: number, e?: any) => {
    e?.stopPropagation();
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  // Drag Logic
  const handleTouchStart = (e: React.TouchEvent) => { setIsDragging(true); dragStartY.current = e.touches[0].clientY; dragStartHeight.current = sheetHeight; };
  const handleTouchMove = (e: React.TouchEvent) => { if (!isDragging) return; const deltaPercent = ((dragStartY.current - e.touches[0].clientY) / window.innerHeight) * 100; setSheetHeight(Math.min(95, Math.max(12, dragStartHeight.current + deltaPercent))); };
  const handleTouchEnd = () => { setIsDragging(false); setSheetHeight(sheetHeight > 75 ? 92 : sheetHeight > 30 ? 45 : 12); };

  return (
    <div className="flex flex-col-reverse md:flex-row h-screen bg-slate-50 overflow-hidden font-sans text-slate-800 relative selection:bg-blue-100">
      
      {/* 🟢 CSS OVERRIDES FOR POPUP (ใส่ CSS ตรงนี้เพื่อให้ Popup สวย) */}
      <style>{`
        .leaflet-popup-content-wrapper { padding: 0 !important; border-radius: 16px !important; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2) !important; }
        .leaflet-popup-content { margin: 0 !important; width: 280px !important; }
        .leaflet-popup-tip { background: white; }
        .leaflet-container a.leaflet-popup-close-button { color: #aaa; font-size: 18px; top: 8px; right: 8px; background: rgba(0,0,0,0.1); border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; text-decoration: none; z-index: 20; }
        .leaflet-container a.leaflet-popup-close-button:hover { color: #555; background: rgba(0,0,0,0.2); }
      `}</style>

      {/* ================= SIDEBAR (Draggable) ================= */}
      <div 
        className={`
          w-full md:w-[450px] bg-white shadow-[0_-5px_30px_rgba(0,0,0,0.1)] z-[1000] flex flex-col border-r border-slate-200
          absolute bottom-0 left-0 md:relative md:h-full rounded-t-[2rem] md:rounded-none overflow-hidden
          ${!isDragging ? 'transition-[height] duration-500 cubic-bezier(0.32, 0.72, 0, 1)' : ''}
        `}
        style={{ height: `${window.innerWidth < 768 ? sheetHeight : 100}%` }}
      >
        {/* Drag Handle */}
        <div className="md:hidden w-full h-[32px] bg-white flex justify-center items-center cursor-grab active:cursor-grabbing border-b border-slate-50 flex-shrink-0 touch-none"
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
           <div className="w-10 h-1 bg-slate-200 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="p-4 md:p-6 bg-slate-900 text-white shadow-xl relative overflow-hidden flex-shrink-0">
            {/* Background Texture */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
            
            <div className={`relative z-10 flex justify-between items-center mb-4 ${sheetHeight < 20 ? 'hidden md:flex' : ''}`}>
              <h1 className="text-xl md:text-2xl font-black flex items-center gap-2 tracking-tight">
                <span className="bg-red-600 p-1.5 rounded-lg shadow-red-900/50 shadow-lg"><Siren size={18} className="text-white animate-pulse" /></span>
                WAR ROOM
              </h1>
              <Link to="/" className="text-[10px] md:text-xs bg-white/10 hover:bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full text-white border border-white/10 transition flex items-center gap-1 font-medium">
                <ArrowRightCircle size={14} /> <span className="hidden md:inline">แจ้งเหตุ</span>
              </Link>
            </div>

            <div className={`grid grid-cols-4 gap-2 transition-all duration-300 ${sheetHeight < 20 ? 'opacity-0 translate-y-4 md:opacity-100 md:translate-y-0 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
              <StatCard label="รอช่วย" count={stats.waiting} color="bg-gradient-to-br from-blue-500 to-blue-600" icon={<Users />} />
              <StatCard label="วิกฤต" count={stats.critical} color="bg-gradient-to-br from-red-500 to-red-600" icon={<AlertTriangle />} />
              <StatCard label="กำลัง" count={stats.working} color="bg-gradient-to-br from-orange-400 to-orange-500" icon={<Navigation />} />
              <StatCard label="เสร็จ" count={stats.completed} color="bg-gradient-to-br from-emerald-500 to-emerald-600" icon={<CheckCircle2 />} />
            </div>
        </div>
        
        {/* Content Area */}
        <div className={`flex-1 flex flex-col overflow-hidden transition-opacity duration-200 ${sheetHeight < 20 ? 'opacity-0 md:opacity-100 pointer-events-none' : 'opacity-100'}`}>
            <div className="p-3 md:p-4 bg-white border-b border-slate-100 space-y-2 flex-shrink-0">
                <div className="relative group">
                    <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"/>
                    <input type="text" placeholder="ค้นหาเคส..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"/>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                   {/* Dropdowns (ย่อโค้ดเพื่อความกระชับ) */}
                   {[
                     {val: selectedProvince, set: setSelectedProvince, opts: provinces, ph: "จังหวัด"},
                     {val: selectedDistrict, set: setSelectedDistrict, opts: districts, ph: "อำเภอ"},
                     {val: selectedSubDistrict, set: setSelectedSubDistrict, opts: subdistricts, ph: "ตำบล"}
                   ].map((d, i) => (
                     <select key={i} value={d.val} onChange={(e) => d.set(e.target.value)} className="bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-lg p-2 outline-none min-w-[80px] flex-1">
                        {d.opts.map(o => <option key={o} value={o}>{o === "ทั้งหมด" ? d.ph : o}</option>)}
                     </select>
                   ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-3 bg-slate-50/50 pb-20 md:pb-4">
              {filteredRequests.map((req) => {
                const isDone = req.status === 'completed';
                const score = req.ai_analysis?.risk_score || 0;
                let cardBorder = isDone ? "border-l-slate-300" : (score >= 8 ? "border-l-red-500" : (score >= 5 ? "border-l-orange-400" : "border-l-emerald-500"));
                let badgeStyle = isDone ? "bg-slate-100 text-slate-500" : (score >= 8 ? "bg-red-50 text-red-600" : (score >= 5 ? "bg-orange-50 text-orange-600" : "bg-emerald-50 text-emerald-600"));
                
                return (
                  <div key={req.id} onClick={() => req.location && setSelectedLocation([req.location.lat, req.location.lng])} className={`bg-white rounded-xl p-3 shadow-sm hover:shadow-lg hover:-translate-y-0.5 border border-slate-100 ${cardBorder} border-l-[4px] transition-all cursor-pointer group`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide flex items-center gap-1 ${badgeStyle}`}>
                            {isDone ? <CheckCircle2 size={10}/> : <Activity size={10}/>} {isDone ? "DONE" : `RISK ${score}`}
                          </span>
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-full font-medium"><Clock size={10}/> {new Date(req.timestamp?.seconds * 1000).toLocaleTimeString("th-TH",{hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                          <h3 className="font-bold text-slate-800 text-sm md:text-base line-clamp-1">{req.name}</h3>
                          <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-500 mt-0.5 mb-2 font-medium">
                             <span className="flex items-center gap-0.5"><Phone size={10}/> {req.contact}</span>
                             <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                             <span className="flex items-center gap-0.5 text-blue-500 bg-blue-50 px-1.5 rounded"><Users size={10}/> {req.peopleCount}</span>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-[10px] md:text-xs text-slate-600 italic mb-2 line-clamp-2">"{req.description}"</div>
                          
                          <div className="flex gap-2 mt-auto">
                             <button onClick={(e) => openMaps(req.location!.lat, req.location!.lng, e)} className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold transition flex items-center justify-center gap-1"><Navigation size={12}/> นำทาง</button>
                             {req.status !== 'completed' && <button onClick={(e) => updateStatus(req.id, req.status === 'waiting' ? 'inprogress' : 'completed', e)} className={`flex-1 py-1.5 rounded-lg text-white text-[10px] font-bold flex items-center justify-center gap-1 ${req.status === 'waiting' ? 'bg-orange-500 shadow-orange-200 shadow-sm' : 'bg-emerald-600 shadow-emerald-200 shadow-sm'}`}>{req.status === 'waiting' ? 'รับงาน' : 'ปิดเคส'}</button>}
                          </div>
                      </div>
                      {req.imageUrl && <img src={req.imageUrl} className="w-20 h-20 rounded-xl object-cover border border-slate-100 shadow-sm" />}
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
             const score = req.ai_analysis?.risk_score || 0;
             return (
               <Marker key={req.id} position={req.location} icon={createLabelIcon(req.name, score, req.status)}>
                  {/* ✨ CUSTOM BEAUTIFUL POPUP ✨ */}
                  <Popup>
                     <div className="flex flex-col font-sans">
                        {/* 1. Header Image (ถ้ามี) */}
                        {req.imageUrl ? (
                           <div className="h-24 w-full bg-cover bg-center rounded-t-lg relative" style={{backgroundImage: `url(${req.imageUrl})`}}>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                              <span className={`absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded text-white ${req.status==='waiting'?'bg-red-600':req.status==='inprogress'?'bg-orange-500':'bg-emerald-600'}`}>
                                 {req.status==='waiting' ? `RISK ${score}` : req.status==='inprogress' ? 'WORKING' : 'DONE'}
                              </span>
                           </div>
                        ) : (
                           <div className="h-10 w-full bg-slate-100 flex items-center justify-center border-b border-slate-200">
                              <span className="text-xs text-slate-400 font-medium">ไม่มีรูปภาพ</span>
                           </div>
                        )}
                        
                        {/* 2. Content */}
                        <div className="p-3">
                           <h3 className="font-bold text-slate-800 text-sm mb-1 line-clamp-1">{req.name}</h3>
                           <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                              <span className="flex items-center gap-0.5"><Phone size={10}/> {req.contact}</span>
                              <span className="flex items-center gap-0.5 text-blue-600 bg-blue-50 px-1 rounded"><Users size={10}/> {req.peopleCount}</span>
                           </div>
                           <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 italic line-clamp-3 mb-3">"{req.description}"</p>
                           
                           {/* 3. Action Buttons */}
                           <div className="flex gap-2">
                              <button onClick={(e) => openMaps(req.location!.lat, req.location!.lng, e)} className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"><Navigation size={12}/> ไป</button>
                              {req.status !== 'completed' && (
                                 <button onClick={(e) => updateStatus(req.id, req.status === 'waiting' ? 'inprogress' : 'completed', e)} className={`flex-1 py-1.5 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 shadow-sm ${req.status==='waiting'?'bg-orange-500 hover:bg-orange-600':'bg-emerald-600 hover:bg-emerald-700'}`}>
                                    {req.status === 'waiting' ? 'รับงาน' : 'ปิดงาน'}
                                 </button>
                              )}
                           </div>
                        </div>
                     </div>
                  </Popup>
               </Marker>
             )
          })}
        </MapContainer>
        
        {/* ปุ่ม GPS กลับจุดเดิม (เสริมให้) */}
        <div className="absolute top-4 right-4 z-[500] bg-white p-2 rounded-lg shadow-lg cursor-pointer hover:bg-slate-50 border border-slate-100 text-slate-600" onClick={() => { /* Add logic if needed */}}>
           <LocateFixed size={20} />
        </div>
      </div>
    </div>
  );
}