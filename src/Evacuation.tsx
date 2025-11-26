import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import { collection, addDoc, query, onSnapshot, updateDoc, doc, arrayUnion } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth"; // 🟢 เพิ่ม signOut
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import * as LucideIcons from "lucide-react";
import { Link } from "react-router-dom";

// --- Icons ---
const { 
  MapPin, Search, Tent, Users, Phone, Plus, X, UserCheck, ShieldCheck, Home, LayoutList, Clock, LogOut 
} = LucideIcons as any; // 🟢 เพิ่ม LogOut

// --- Interface ---
interface Resident {
  name: string;
  phone: string;
  timestamp: any;
}

interface EvacuationCenter {
  id: string;
  name: string;
  location: { lat: number, lng: number };
  capacity: number;
  currentPeople: number;
  facilities: string[];
  contact: string;
  residents?: Resident[];
}

// --- Custom Icon ---
const centerIcon = L.divIcon({
  className: "custom-div-icon",
  html: `<div style="background-color:#10b981; color:white; border-radius:50%; padding:8px; box-shadow:0 4px 10px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center; width:40px; height:40px; border: 2px solid white;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16"/><path d="M3 21h18"/><path d="M10 12h4"/></svg></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40]
});

// Helper Map Fly
function MapFlyTo({ location }: { location: [number, number] | null }) {
  const map = useMap();
  useEffect(() => { if (location) map.flyTo(location, 16, { duration: 1.5 }); }, [location, map]);
  return null;
}

// ==========================================
// 🏕️ EVACUATION PAGE MAIN COMPONENT
// ==========================================
export default function Evacuation() {
  const [centers, setCenters] = useState<EvacuationCenter[]>([]);
  const [isAdmin, setIsAdmin] = useState(false); // เช็คสถานะ Login
  const [selectedCenter, setSelectedCenter] = useState<EvacuationCenter | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  
  // Search States
  const [centerSearchTerm, setCenterSearchTerm] = useState(""); 
  const [residentSearchTerm, setResidentSearchTerm] = useState(""); 

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showResidentsModal, setShowResidentsModal] = useState(false);

  // Forms
  const [newCenterForm, setNewCenterForm] = useState({ name: "", lat: "", lng: "", capacity: "", contact: "", facilities: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", phone: "" });

  // --- Init Data & Auth ---
  useEffect(() => {
    // 🟢 ตรวจสอบ Login (กรอง Anonymous ออก เพื่อความชัวร์ว่าเป็นเจ้าหน้าที่จริง)
    const unsubAuth = onAuthStateChanged(auth, (user) => {
        if (user && !user.isAnonymous) {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
        }
    });
    
    // ดึงข้อมูลศูนย์อพยพแบบ Realtime
    const q = query(collection(db, "evacuation_centers"));
    const unsubData = onSnapshot(q, (snapshot) => {
      setCenters(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EvacuationCenter)));
    });

    return () => { unsubAuth(); unsubData(); };
  }, []);

  // --- Filter Logics ---
  const filteredCenters = centers.filter(c => c.name.toLowerCase().includes(centerSearchTerm.toLowerCase()));

  const filteredResidents = selectedCenter?.residents?.filter(r => 
    r.name.toLowerCase().includes(residentSearchTerm.toLowerCase()) || 
    r.phone.includes(residentSearchTerm)
  ) || [];

  // --- Handlers ---

  // 🟢 Logout Function
  const handleLogout = async () => {
      if(confirm("ต้องการออกจากระบบ?")) {
          await signOut(auth);
          setIsAdmin(false); // บังคับ state ให้เป็น false ทันที
      }
  };

  // 1. เพิ่มศูนย์อพยพ (Admin Only)
  const handleAddCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCenterForm.name || !newCenterForm.lat || !newCenterForm.lng) return alert("กรุณากรอกข้อมูลให้ครบ");
    
    try {
      await addDoc(collection(db, "evacuation_centers"), {
        name: newCenterForm.name,
        location: { lat: parseFloat(newCenterForm.lat), lng: parseFloat(newCenterForm.lng) },
        capacity: parseInt(newCenterForm.capacity) || 100,
        currentPeople: 0,
        contact: newCenterForm.contact,
        facilities: newCenterForm.facilities.split(",").map(s => s.trim()),
        residents: [] // เริ่มต้นไม่มีคน
      });
      setShowAddModal(false);
      setNewCenterForm({ name: "", lat: "", lng: "", capacity: "", contact: "", facilities: "" });
      alert("✅ เพิ่มศูนย์อพยพเรียบร้อย");
    } catch (err) { console.error(err); alert("เกิดข้อผิดพลาด"); }
  };

  // 2. ลงทะเบียนเข้าพัก (Public)
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCenter || !registerForm.name || !registerForm.phone) return;
    
    try {
      const centerRef = doc(db, "evacuation_centers", selectedCenter.id);
      await updateDoc(centerRef, {
        residents: arrayUnion({
          name: registerForm.name,
          phone: registerForm.phone,
          timestamp: new Date()
        }),
        currentPeople: (selectedCenter.currentPeople || 0) + 1
      });
      setShowRegisterModal(false);
      setRegisterForm({ name: "", phone: "" });
      alert("✅ ลงทะเบียนเข้าพักสำเร็จ! ปลอดภัยแล้วนะครับ");
    } catch (err) { console.error(err); alert("ลงทะเบียนไม่สำเร็จ"); }
  };

  // 3. ใช้ GPS ปัจจุบัน
  const getCurrentLocation = () => {
    navigator.geolocation.getCurrentPosition(pos => {
      setNewCenterForm(prev => ({ ...prev, lat: pos.coords.latitude.toString(), lng: pos.coords.longitude.toString() }));
    });
  };

  const openResidentsModal = (center: EvacuationCenter) => {
      setSelectedCenter(center);
      setResidentSearchTerm("");
      setShowResidentsModal(true);
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 font-sans overflow-hidden">
      
      {/* ================= SIDEBAR ================= */}
      <div className="w-full md:w-[420px] bg-white flex flex-col shadow-xl z-20 h-[55vh] md:h-full border-r border-slate-200 order-2 md:order-1">
        
        {/* Header */}
        <div className="p-5 bg-emerald-700 text-white shadow-md">
           <div className="flex justify-between items-center mb-4">
              <h1 className="text-xl font-black flex items-center gap-2"><Tent className="text-yellow-300" /> จุดอพยพ (Safe Zones)</h1>
              
              <div className="flex gap-2 items-center">
                 <Link to="/" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition" title="หน้าแจ้งเหตุ"><Home size={16}/></Link>
                 <Link to="/dashboard" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition" title="War Room"><LayoutList size={16}/></Link>
                 
                 {/* 🟢 Logic ปุ่ม Login/Logout */}
                 {isAdmin ? (
                    <div className="flex items-center gap-1 bg-yellow-400/20 p-1 rounded-full border border-yellow-400/30">
                        <span className="px-2 py-0.5 text-yellow-200 text-[10px] font-bold flex items-center gap-1">
                            <ShieldCheck size={12}/> Admin
                        </span>
                        <button onClick={handleLogout} className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition" title="ออกจากระบบ">
                            <LogOut size={12} />
                        </button>
                    </div>
                 ) : (
                    <Link to="/login" className="px-3 py-1.5 bg-emerald-800 text-emerald-100 text-[10px] font-bold rounded-full hover:bg-emerald-900 border border-emerald-600 transition">
                        Login จนท.
                    </Link>
                 )}
              </div>
           </div>
           
           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-200" size={16} />
              <input 
                value={centerSearchTerm} onChange={e => setCenterSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-emerald-800/50 border border-emerald-600 rounded-xl text-sm text-white placeholder-emerald-300 focus:outline-none focus:bg-emerald-800 focus:border-emerald-400 transition-all" 
                placeholder="ค้นหาศูนย์อพยพ..." 
              />
           </div>
        </div>

        {/* Center List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
           
           {/* 🟢 แสดงเฉพาะตอน Login */}
           {isAdmin && (
             <button onClick={() => setShowAddModal(true)} className="w-full py-3 border-2 border-dashed border-emerald-400 text-emerald-700 bg-emerald-50/50 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-100 font-bold transition-all">
                <Plus size={18}/> เพิ่มจุดอพยพใหม่
             </button>
           )}

           {filteredCenters.length === 0 && <div className="text-center text-slate-400 mt-10 text-sm">ไม่พบศูนย์อพยพ</div>}
           
           {filteredCenters.map(center => (
             <div key={center.id} onClick={() => { setSelectedCenter(center); setMapCenter([center.location.lat, center.location.lng]); }} 
                  className={`p-4 bg-white rounded-2xl shadow-sm border cursor-pointer transition-all hover:shadow-md active:scale-[0.98] ${selectedCenter?.id === center.id ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/30' : 'border-slate-200'}`}>
                
                <div className="flex justify-between items-start mb-2">
                   <h3 className="font-bold text-slate-800 text-lg">{center.name}</h3>
                   <span className={`text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1 ${center.currentPeople >= center.capacity ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                      <Users size={10}/> {center.currentPeople} / {center.capacity}
                   </span>
                </div>
                
                {center.facilities.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-3">
                        {center.facilities.map((f,i) => <span key={i} className="bg-slate-100 text-[10px] px-2 py-0.5 rounded text-slate-500 border border-slate-200">{f}</span>)}
                    </div>
                )}

                <div className="flex gap-2 border-t border-slate-100 pt-3">
                   <button onClick={(e) => { e.stopPropagation(); setSelectedCenter(center); setShowRegisterModal(true); }} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center gap-1"><UserCheck size={14}/> ลงทะเบียนเข้า</button>
                   <button onClick={(e) => { e.stopPropagation(); openResidentsModal(center); }} className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"><Search size={14}/> ค้นหารายชื่อ</button>
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* ================= MAP ================= */}
      <div className="flex-1 h-[45vh] md:h-full relative z-0 order-1 md:order-2">
         <MapContainer center={[13.7563, 100.5018]} zoom={10} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer url="http://mt0.google.com/vt/lyrs=m&hl=th&x={x}&y={y}&z={z}" attribution='&copy; Google Maps' />
            <MapFlyTo location={mapCenter} />
            
            {filteredCenters.map(center => (
               <Marker key={center.id} position={[center.location.lat, center.location.lng]} icon={centerIcon}>
                  <Popup>
                     <div className="text-center p-1 min-w-[150px]">
                        <b className="text-sm text-emerald-700 block mb-1">{center.name}</b>
                        <div className="text-xs text-slate-500 mb-2 flex items-center justify-center gap-1"><Phone size={10}/> {center.contact}</div>
                        <button onClick={() => { setSelectedCenter(center); setShowRegisterModal(true); }} className="w-full py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">ลงทะเบียนที่นี่</button>
                     </div>
                  </Popup>
               </Marker>
            ))}
         </MapContainer>
      </div>

      {/* ================= MODALS ================= */}

      {/* 1. MODAL: เพิ่มจุดอพยพ (Admin Only) */}
      {showAddModal && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="bg-slate-800 p-4 text-white flex justify-between items-center">
                 <h3 className="font-bold flex items-center gap-2"><Plus size={18}/> เพิ่มจุดอพยพใหม่</h3>
                 <button onClick={() => setShowAddModal(false)} className="opacity-70 hover:opacity-100"><X size={20}/></button>
              </div>
              <form onSubmit={handleAddCenter} className="p-5 space-y-3">
                 <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs p-2 rounded-lg mb-2">
                    💡 ใช้ Google Maps หาพิกัด แล้วนำมากรอก หรือกดปุ่มหมุดเพื่อใช้ตำแหน่งปัจจุบัน
                 </div>
                 <input required placeholder="ชื่อศูนย์อพยพ" className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" value={newCenterForm.name} onChange={e=>setNewCenterForm({...newCenterForm, name: e.target.value})}/>
                 <div className="flex gap-2">
                    <input required placeholder="Lat (ละติจูด)" className="flex-1 p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" value={newCenterForm.lat} onChange={e=>setNewCenterForm({...newCenterForm, lat: e.target.value})}/>
                    <input required placeholder="Lng (ลองจิจูด)" className="flex-1 p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" value={newCenterForm.lng} onChange={e=>setNewCenterForm({...newCenterForm, lng: e.target.value})}/>
                    <button type="button" onClick={getCurrentLocation} className="p-3 bg-blue-100 text-blue-600 rounded-xl hover:bg-blue-200 transition" title="ใช้พิกัดปัจจุบัน"><MapPin size={18}/></button>
                 </div>
                 <div className="flex gap-2">
                    <input placeholder="ความจุ (คน)" type="number" className="flex-1 p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" value={newCenterForm.capacity} onChange={e=>setNewCenterForm({...newCenterForm, capacity: e.target.value})}/>
                    <input placeholder="เบอร์ติดต่อศูนย์" className="flex-1 p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" value={newCenterForm.contact} onChange={e=>setNewCenterForm({...newCenterForm, contact: e.target.value})}/>
                 </div>
                 <input placeholder="สิ่งอำนวยความสะดวก (เช่น อาหาร, ยา, ที่นอน)" className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-500" value={newCenterForm.facilities} onChange={e=>setNewCenterForm({...newCenterForm, facilities: e.target.value})}/>
                 <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition">บันทึกข้อมูล</button>
              </form>
           </div>
        </div>
      )}

      {/* 2. MODAL: ลงทะเบียนเข้าพัก */}
      {showRegisterModal && selectedCenter && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="bg-emerald-600 p-4 text-white flex justify-between items-center">
                 <h3 className="font-bold flex items-center gap-2"><UserCheck size={18}/> ลงทะเบียนเข้าพัก</h3>
                 <button onClick={() => setShowRegisterModal(false)} className="opacity-70 hover:opacity-100"><X size={20}/></button>
              </div>
              <div className="p-4 bg-emerald-50 border-b border-emerald-100 text-center">
                 <p className="text-xs text-emerald-800 mb-1">ท่านกำลังลงทะเบียนเข้าสู่:</p>
                 <h2 className="font-bold text-emerald-700 text-lg">{selectedCenter.name}</h2>
              </div>
              <form onSubmit={handleRegister} className="p-5 space-y-4">
                 <div>
                    <label className="text-xs font-bold text-slate-500 ml-1">ชื่อ-นามสกุล (ผู้ลงทะเบียน)</label>
                    <input required className="w-full p-3 border border-slate-200 rounded-xl text-sm mt-1 bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none" value={registerForm.name} onChange={e=>setRegisterForm({...registerForm, name: e.target.value})}/>
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 ml-1">เบอร์โทรศัพท์ (สำหรับติดต่อ)</label>
                    <input required type="tel" className="w-full p-3 border border-slate-200 rounded-xl text-sm mt-1 bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none" value={registerForm.phone} onChange={e=>setRegisterForm({...registerForm, phone: e.target.value})}/>
                 </div>
                 <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-lg shadow-emerald-200 transition">ยืนยันการเข้าพัก</button>
              </form>
           </div>
        </div>
      )}

      {/* 3. MODAL: รายชื่อผู้อพยพ + ค้นหา */}
      {showResidentsModal && selectedCenter && (
        <div className="fixed inset-0 z-[2000] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
           <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl h-[75vh] flex flex-col animate-in zoom-in-95 duration-200">
              <div className="bg-slate-800 p-4 text-white flex justify-between items-center shrink-0">
                 <div className="flex flex-col">
                    <h3 className="font-bold flex items-center gap-2 text-lg"><Users size={20}/> รายชื่อผู้อพยพ</h3>
                    <span className="text-xs text-slate-400">{selectedCenter.name} ({selectedCenter.residents?.length || 0} คน)</span>
                 </div>
                 <button onClick={() => setShowResidentsModal(false)} className="p-1 bg-white/10 rounded-full hover:bg-white/20 transition"><X size={20}/></button>
              </div>
              
              {/* 🟢 SEARCH BAR สำหรับรายชื่อ */}
              <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0">
                 <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    <input 
                        autoFocus
                        value={residentSearchTerm}
                        onChange={(e) => setResidentSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                        placeholder="ค้นหาชื่อ หรือ เบอร์โทร..."
                    />
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
                 {filteredResidents.length > 0 ? (
                    filteredResidents.map((person, idx) => (
                       <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm hover:shadow-md transition-all">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 text-sm font-bold shrink-0">{idx+1}</div>
                             <div>
                                <p className="text-sm font-bold text-slate-800">{person.name}</p>
                                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                                    <Clock size={10}/> {new Date(person.timestamp?.seconds * 1000).toLocaleString("th-TH")}
                                </div>
                             </div>
                          </div>
                          <div className="text-right">
                             {/* แสดงเบอร์แบบเซ็นเซอร์นิดหน่อย เพื่อความเป็นส่วนตัว */}
                             <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200 block">
                                {person.phone.substring(0, 3)}-xxx-{person.phone.slice(-4)}
                             </span>
                          </div>
                       </div>
                    ))
                 ) : (
                    <div className="flex flex-col items-center justify-center h-40 text-slate-400 space-y-2">
                        <Search size={40} className="text-slate-300 opacity-50"/>
                        <span className="text-sm">ไม่พบรายชื่อที่ค้นหา</span>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

    </div>
  );
}