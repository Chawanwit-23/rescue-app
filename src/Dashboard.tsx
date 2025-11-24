import { useState, useEffect } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, query, doc, updateDoc } from "firebase/firestore";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
// เพิ่มไอคอน Activity, Users
import { AlertTriangle, Phone, Clock, RefreshCw, CheckCircle, Navigation, ArrowRightCircle, Activity, Users } from "lucide-react";

// --- Icons ---
const createIcon = (url: string) => new L.Icon({
  iconUrl: url, shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});
const redIcon = createIcon("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png");
const orangeIcon = createIcon("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png");
const greenIcon = createIcon("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png");
const greyIcon = createIcon("https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png");

function MapFlyTo({ location }: { location: [number, number] }) {
  const map = useMap();
  useEffect(() => { if (location) map.flyTo(location, 15, { duration: 1.5 }); }, [location, map]);
  return null;
}

// Component การ์ดตัวเลขเล็กๆ
function StatCard({ label, count, color, icon }: any) {
  return (
    <div className="bg-white/10 rounded-lg p-2 flex items-center justify-between border border-white/10">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${color} text-white`}>{icon}</div>
        <span className="text-xs text-slate-300">{label}</span>
      </div>
      <span className="text-lg font-bold text-white">{count}</span>
    </div>
  );
}

export default function Dashboard() {
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<[number, number] | null>(null);

  // ตัวแปรเก็บยอดรวม (Stats)
  const stats = {
    waiting: requests.filter(r => r.status === 'waiting').length,
    critical: requests.filter(r => r.ai_analysis?.risk_score >= 8 && r.status !== 'completed').length,
    working: requests.filter(r => r.status === 'inprogress').length,
    completed: requests.filter(r => r.status === 'completed').length,
  };

  useEffect(() => {
    const q = query(collection(db, "requests"));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sorted = data.sort((a: any, b: any) => {
        if (a.status === "completed" && b.status !== "completed") return 1;
        if (a.status !== "completed" && b.status === "completed") return -1;
        return (b.ai_analysis?.risk_score || 0) - (a.ai_analysis?.risk_score || 0);
      });
      setRequests(sorted);
    });
    return () => unsub();
  }, []);

  const updateStatus = async (id: string, newStatus: string, e: any) => {
    e.stopPropagation();
    try { await updateDoc(doc(db, "requests", id), { status: newStatus }); } catch (err) { console.error(err); }
  };

  const openGoogleMaps = (lat: number, lng: number, e: any) => {
    e.stopPropagation();
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <div className="w-1/3 min-w-[400px] bg-white shadow-2xl z-20 flex flex-col border-r border-gray-200">
        
        {/* Header + Stats Panel */}
        <div className="p-5 bg-slate-900 text-white shadow-md">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold flex items-center gap-2 text-red-500">
              <Activity className="animate-pulse" /> WAR ROOM
            </h1>
            <div className="text-[10px] bg-slate-800 px-2 py-1 rounded-full text-slate-400 border border-slate-700">
              Live Update
            </div>
          </div>

          {/* 📊 Grid แสดงยอดรวม */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="รอช่วยเหลือ" count={stats.waiting} color="bg-blue-500" icon={<Users size={14}/>} />
            <StatCard label="วิกฤต!" count={stats.critical} color="bg-red-600" icon={<AlertTriangle size={14}/>} />
            <StatCard label="กำลังช่วย" count={stats.working} color="bg-orange-500" icon={<Navigation size={14}/>} />
            <StatCard label="เสร็จสิ้น" count={stats.completed} color="bg-green-600" icon={<CheckCircle size={14}/>} />
          </div>
        </div>
        
        {/* Request List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
          {requests.map((req) => {
            const isDone = req.status === 'completed';
            const isWorking = req.status === 'inprogress';
            const score = req.ai_analysis?.risk_score || 0;
            
            let borderClass = "border-gray-300";
            if (!isDone) {
                if (score >= 8) borderClass = "border-red-600 bg-red-50/40";
                else if (score >= 5) borderClass = "border-orange-400 bg-orange-50/40";
                else borderClass = "border-green-500 bg-white";
            } else {
                borderClass = "border-slate-200 bg-slate-100 opacity-60";
            }

            return (
              <div key={req.id} 
                onClick={() => req.location && setSelectedLocation([req.location.lat, req.location.lng])}
                className={`p-3 rounded-xl border-l-4 shadow-sm cursor-pointer hover:shadow-md transition-all group ${borderClass}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {!isDone ? (
                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white 
                           ${score >= 8 ? 'bg-red-600' : score >= 5 ? 'bg-orange-500' : 'bg-green-600'}`}>
                           RISK {score}/10
                         </span>
                      ) : (
                         <span className="text-[10px] bg-slate-500 text-white px-2 py-0.5 rounded flex items-center gap-1">
                           <CheckCircle size={10}/> จบงาน
                         </span>
                      )}
                      {isWorking && !isDone && <span className="text-[10px] text-orange-600 font-bold flex items-center gap-1"><RefreshCw size={10} className="animate-spin"/> กำลังช่วย</span>}
                    </div>

                    <h3 className="font-bold text-gray-800">{req.name}</h3>
                    <p className="text-xs text-gray-600 line-clamp-1">{req.description}</p>
                    
                    <div className="flex gap-2 mt-3">
                        <button onClick={(e) => openGoogleMaps(req.location.lat, req.location.lng, e)} 
                          className="px-2 py-1.5 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 text-xs flex items-center gap-1 border border-blue-200 transition-colors">
                          <Navigation size={12} /> นำทาง
                        </button>

                        {req.status === 'waiting' && (
                           <button onClick={(e) => updateStatus(req.id, 'inprogress', e)} 
                             className="px-2 py-1.5 bg-orange-50 text-orange-600 rounded-md hover:bg-orange-100 text-xs flex items-center gap-1 border border-orange-200 transition-colors">
                             <ArrowRightCircle size={12} /> รับงาน
                           </button>
                        )}
                        {req.status === 'inprogress' && (
                           <button onClick={(e) => updateStatus(req.id, 'completed', e)} 
                             className="px-2 py-1.5 bg-green-50 text-green-600 rounded-md hover:bg-green-100 text-xs flex items-center gap-1 border border-green-200 transition-colors">
                             <CheckCircle size={12} /> ปิดเคส
                           </button>
                        )}
                    </div>
                  </div>
                  {req.imageUrl && <img src={req.imageUrl} className="w-16 h-16 rounded-lg object-cover border bg-white" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative z-0">
        <MapContainer center={[13.7563, 100.5018]} zoom={10} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />
          {selectedLocation && <MapFlyTo location={selectedLocation} />}

          {requests.map((req) => {
            if (!req.location) return null;
            const score = req.ai_analysis?.risk_score || 0;
            let icon = greenIcon;
            if (req.status === 'completed') icon = greyIcon;
            else if (req.status === 'inprogress') icon = orangeIcon;
            else if (score >= 8) icon = redIcon;

            return (
              <Marker key={req.id} position={req.location} icon={icon}>
                <Popup>
                  <div className="text-center min-w-[120px]">
                    <b className={req.status === 'completed' ? "text-gray-400 line-through" : ""}>{req.name}</b>
                    <div className="text-xs mt-1">{req.status === 'waiting' ? 'รอการช่วยเหลือ' : req.status === 'inprogress' ? '🚑 กำลังเดินทาง' : '✅ เรียบร้อยแล้ว'}</div>
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