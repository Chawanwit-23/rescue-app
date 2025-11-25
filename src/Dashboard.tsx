// src/Dashboard.tsx (ฉบับ Responsive มือถือ + Desktop)
import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, query, doc, updateDoc } from "firebase/firestore";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import * as LucideIcons from "lucide-react"; 
import { Link } from "react-router-dom";

const { AlertTriangle, Phone, Clock, RefreshCw, CheckCircle, Navigation, ArrowRightCircle, Activity, Users, MapPin, Search, Home, Droplets, User } = LucideIcons as any;

// 🟢 ฟังก์ชันสร้างหมุด (เหมือนเดิม)
const createLabelIcon = (name: string, score: number, status: string) => {
  let borderColor = "#22c55e"; 
  let textColor = "#15803d";
  let bgColor = "white";
  
  if (status === 'completed') {
    borderColor = "#64748b"; 
    textColor = "#64748b";
    bgColor = "#f1f5f9";
  } else if (status === 'inprogress') {
    borderColor = "#f97316"; 
    textColor = "#c2410c";
  } else if (score >= 8) {
    borderColor = "#ef4444"; 
    textColor = "#b91c1c";
  } else if (score >= 5) {
    borderColor = "#f97316"; 
    textColor = "#c2410c";
  }

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

function MapFlyTo({ location }: { location: [number, number] }) {
  const map = useMap();
  useEffect(() => { if (location) map.flyTo(location, 16, { duration: 1.5 }); }, [location, map]);
  return null;
}

function StatCard({ label, count, color, icon }: any) {
  return (
    <div className="bg-white/10 rounded-lg p-2 flex items-center justify-between border border-white/10">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${color} text-white`}>{icon}</div>
        <span className="text-[10px] md:text-xs text-slate-300">{label}</span>
      </div>
      <span className="text-sm md:text-lg font-bold text-white">{count}</span>
    </div>
  );
}

export default function Dashboard() {
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("ทั้งหมด");
  const [selectedDistrict, setSelectedDistrict] = useState("ทั้งหมด");
  const [selectedSubDistrict, setSelectedSubDistrict] = useState("ทั้งหมด");

  useEffect(() => {
    const q = query(collection(db, "requests"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
    });
    return () => unsub();
  }, []);

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

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.address?.details?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProvince = selectedProvince === "ทั้งหมด" || req.address?.province === selectedProvince;
    const matchesDistrict = selectedDistrict === "ทั้งหมด" || req.address?.district === selectedDistrict;
    const matchesSubDistrict = selectedSubDistrict === "ทั้งหมด" || req.address?.subdistrict === selectedSubDistrict;

    return matchesSearch && matchesProvince && matchesDistrict && matchesSubDistrict;
  }).sort((a: any, b: any) => {
    if (a.status === "completed") return 1;
    if (b.status === "completed") return -1;
    return (b.ai_analysis?.risk_score || 0) - (a.ai_analysis?.risk_score || 0);
  });

  const stats = {
    waiting: filteredRequests.filter(r => r.status === 'waiting').length,
    critical: filteredRequests.filter(r => r.ai_analysis?.risk_score >= 8 && r.status !== 'completed').length,
    working: filteredRequests.filter(r => r.status === 'inprogress').length,
    completed: filteredRequests.filter(r => r.status === 'completed').length,
  };

  const updateStatus = async (id: string, newStatus: string, e: any) => {
    e.stopPropagation();
    try { await updateDoc(doc(db, "requests", id), { status: newStatus }); } catch (err) { console.error(err); }
  };

  const openGoogleMaps = (lat: number, lng: number, e: any) => {
    e.stopPropagation();
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank');
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    return new Date(timestamp.seconds * 1000).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' });
  };

  return (
    // 🔴 แก้ไข Layout หลัก: ใช้ flex-col บนมือถือ และ md:flex-row บนคอม
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 overflow-hidden font-sans">
      
      {/* --- ส่วน Sidebar (รายการ) --- */}
      {/* บนมือถือ: สูง 50% ของหน้าจอ / บนคอม: กว้าง 1/3 ของหน้าจอ และสูงเต็ม */}
      <div className="w-full h-[50vh] md:w-1/3 md:h-full md:min-w-[400px] bg-white shadow-2xl z-20 flex flex-col border-b md:border-b-0 md:border-r border-gray-200">
        
        {/* Header ส่วนบน */}
        <div className="p-4 md:p-5 bg-slate-900 text-white shadow-md flex-shrink-0">
          <div className="flex justify-between items-center mb-3">
            <h1 className="text-lg md:text-xl font-bold flex items-center gap-2 text-red-500">
              <Activity className="animate-pulse" /> WAR ROOM
            </h1>
            <Link to="/" className="text-[10px] md:text-xs bg-slate-800 px-3 py-1.5 rounded-full text-slate-400 border border-slate-700 hover:bg-slate-700 transition">
                ← แจ้งเหตุ
            </Link>
          </div>

          {/* Stat Cards (ปรับ grid ให้แน่นขึ้นในมือถือ) */}
          <div className="grid grid-cols-4 md:grid-cols-2 gap-2 mb-3">
            <StatCard label="รอช่วย" count={stats.waiting} color="bg-blue-500" icon={<Users size={12}/>} />
            <StatCard label="วิกฤต" count={stats.critical} color="bg-red-600" icon={<AlertTriangle size={12}/>} />
            <StatCard label="กำลังช่วย" count={stats.working} color="bg-orange-500" icon={<Navigation size={12}/>} />
            <StatCard label="เสร็จ" count={stats.completed} color="bg-green-600" icon={<CheckCircle size={12}/>} />
          </div>

          {/* Filter Dropdowns */}
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
          </div>
        </div>
        
        {/* ช่องค้นหา */}
        <div className="p-2 md:p-3 border-b border-gray-100 bg-white sticky top-0 z-10 flex-shrink-0">
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"/>
                <input type="text" placeholder="ค้นหา..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-1.5 md:py-2 text-sm border border-gray-200 rounded-lg focus:ring-blue-500 outline-none bg-gray-50"/>
            </div>
        </div>

        {/* List รายการ (Scroll ได้) */}
        <div className="flex-1 overflow-y-auto p-2 md:p-3 space-y-2 md:space-y-3 bg-slate-50">
          {filteredRequests.length === 0 && (
             <div className="text-center py-10 text-gray-400 text-sm">ไม่พบข้อมูล</div>
          )}

          {filteredRequests.map((req) => {
            const isDone = req.status === 'completed';
            const isWorking = req.status === 'inprogress';
            const score = req.ai_analysis?.risk_score || 0;
            let borderClass = isDone ? "border-slate-200 bg-slate-50 opacity-60" : (score >= 8 ? "border-red-600 bg-red-50/40" : (score >= 5 ? "border-orange-400 bg-orange-50/40" : "border-green-500 bg-white"));

            return (
              <div key={req.id} onClick={() => req.location && setSelectedLocation([req.location.lat, req.location.lng])} className={`p-3 rounded-xl border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all group ${borderClass}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {!isDone ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${score >= 8 ? 'bg-red-600' : score >= 5 ? 'bg-orange-500' : 'bg-green-600'}`}>RISK {score}</span>
                      ) : (<span className="text-[10px] bg-slate-500 text-white px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle size={10}/> จบ</span>)}
                      {isWorking && !isDone && <span className="text-[10px] text-orange-600 font-bold flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> กำลังช่วย</span>}
                    </div>
                    <h3 className="font-bold text-sm md:text-base text-gray-800 line-clamp-1">{req.name}</h3>
                    
                    {req.address?.details && <p className="text-[10px] text-slate-500 line-clamp-1"><MapPin size={10} className="inline"/> {req.address.details}</p>}

                    <p className="text-xs text-gray-500 line-clamp-1 mt-1 border-l-2 border-slate-200 pl-1">"{req.description}"</p>
                    
                    <div className="flex gap-2 mt-2">
                        <button onClick={(e) => openGoogleMaps(req.location.lat, req.location.lng, e)} className="px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-[10px] flex items-center gap-1 border border-blue-200"><Navigation size={10} /> นำทาง</button>
                        {req.status === 'waiting' && <button onClick={(e) => updateStatus(req.id, 'inprogress', e)} className="px-2 py-1 bg-orange-50 text-orange-600 rounded hover:bg-orange-100 text-[10px] flex items-center gap-1 border border-orange-200">รับงาน</button>}
                        {req.status === 'inprogress' && <button onClick={(e) => updateStatus(req.id, 'completed', e)} className="px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 text-[10px] flex items-center gap-1 border border-green-200">ปิดเคส</button>}
                    </div>
                  </div>
                  {req.imageUrl && <img src={req.imageUrl} className="w-12 h-12 md:w-16 md:h-16 rounded-lg object-cover border bg-white" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- ส่วน Map --- */}
      {/* บนมือถือ: สูง 50% ของหน้าจอ / บนคอม: เต็มพื้นที่ที่เหลือ */}
      <div className="flex-1 w-full h-[50vh] md:h-full relative z-0">
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
                  <div className="text-center min-w-[150px]">
                    <b className="text-sm">{req.name}</b>
                    <br/>
                    <span className="text-xs text-slate-500">{req.status}</span>
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