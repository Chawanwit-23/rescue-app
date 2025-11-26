import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { 
  ShieldAlert, Lock, Key, Trash2, Edit, Save, X, Search, 
  LayoutDashboard, Tent, FileText, LogOut, Database, 
  Download, Activity, Map as MapIcon, Users, Siren, CheckCircle2,
  AlertTriangle, Filter, Code, Megaphone
} from "lucide-react";

// 🔐 รหัสลับ
const SUPER_ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

// --- Helper Icons ---
const reqIcon = (color: string) => L.divIcon({
  className: "custom-icon",
  html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const centerIcon = L.divIcon({
  className: "custom-icon",
  html: `<div style="background-color: #059669; color: white; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16"/><path d="M3 21h18"/><path d="M10 12h4"/></svg></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

// --- Components ---
const StatCard = ({ title, value, icon, color, subtext }: any) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-start justify-between hover:shadow-md transition-all group">
     <div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{title}</p>
        <h3 className="text-3xl font-black text-slate-800 group-hover:scale-105 transition-transform origin-left">{value}</h3>
        {subtext && <p className="text-xs text-slate-400 mt-2">{subtext}</p>}
     </div>
     <div className={`p-3 rounded-xl ${color} text-white shadow-lg group-hover:rotate-12 transition-transform`}>
        {icon}
     </div>
  </div>
);

const CapacityBar = ({ current, max }: { current: number, max: number }) => {
  const percent = Math.min(100, (current / max) * 100);
  let color = "bg-emerald-500";
  if(percent > 80) color = "bg-red-500";
  else if(percent > 50) color = "bg-orange-500";
  return (
    <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2 overflow-hidden">
      <div className={`h-2.5 rounded-full ${color} transition-all duration-500`} style={{ width: `${percent}%` }}></div>
    </div>
  );
};

export default function Admin() {
  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Data
  const [activeTab, setActiveTab] = useState<'dashboard' | 'map' | 'requests' | 'centers'>('dashboard');
  const [requests, setRequests] = useState<any[]>([]);
  const [centers, setCenters] = useState<any[]>([]);
  
  // Filter & Search
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Editing
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isJsonMode, setIsJsonMode] = useState(false); // 🟢 โหมดแก้ JSON ดิบ
  const [jsonError, setJsonError] = useState("");

  // Fetch Data
  useEffect(() => {
    const unsubReq = onSnapshot(query(collection(db, "requests")), (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubCenters = onSnapshot(query(collection(db, "evacuation_centers")), (snap) => {
      setCenters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubReq(); unsubCenters(); };
  }, []);

  // Logic
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === SUPER_ADMIN_PASSWORD) { setIsAuthenticated(true); setAuthError(""); } 
    else { setAuthError("Access Denied: รหัสผ่านผิดพลาด"); }
  };

  const handleDelete = async (col: string, id: string) => {
    if (!confirm(`⚠️ ยืนยันการลบข้อมูล ID: ${id}?`)) return;
    try { await deleteDoc(doc(db, col, id)); } catch (e) { alert("Error"); }
  };

  const saveEdit = async () => {
    if (!editingItem) return;
    try {
      let dataToUpdate = { ...editForm };
      
      // ถ้าอยู่ในโหมด JSON ให้ parse ข้อมูลก่อนส่ง
      if (isJsonMode) {
         try {
            dataToUpdate = JSON.parse(editForm.jsonString);
         } catch (e) {
            setJsonError("Invalid JSON Format");
            return;
         }
      }

      const col = activeTab === 'requests' ? 'requests' : 'evacuation_centers';
      const { id, ...data } = dataToUpdate; // แยก ID ออก
      await updateDoc(doc(db, col, id || editingItem.id), data); // ใช้ ID เดิม
      
      setEditingItem(null);
      setIsJsonMode(false);
      setJsonError("");
      alert("บันทึกเรียบร้อย");
    } catch (e) { console.error(e); alert("Error saving data"); }
  };

  const handleExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ requests, centers }, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `rescue_data_${new Date().toISOString()}.json`);
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
  };

  // Stats
  const stats = useMemo(() => {
    return {
      totalReq: requests.length,
      waiting: requests.filter(r => r.status === 'waiting').length,
      working: requests.filter(r => r.status === 'inprogress').length,
      completed: requests.filter(r => r.status === 'completed').length,
      critical: requests.filter(r => r.ai_analysis?.risk_score >= 8).length,
      black: requests.filter(r => r.isBlackCase).length,
      totalCenters: centers.length,
      totalCapacity: centers.reduce((acc, c) => acc + (parseInt(c.capacity) || 0), 0),
      currentOccupancy: centers.reduce((acc, c) => acc + (c.currentPeople || 0), 0)
    }
  }, [requests, centers]);

  // Filtering
  const getData = () => activeTab === 'requests' ? requests : centers;
  const filteredData = getData().filter(item => {
     const matchesSearch = JSON.stringify(item).toLowerCase().includes(searchTerm.toLowerCase());
     const matchesStatus = filterStatus === "all" || item.status === filterStatus || (filterStatus === "black" && item.isBlackCase);
     return matchesSearch && matchesStatus;
  });

  // Open Edit Modal
  const openEditModal = (item: any) => {
     setEditingItem(item);
     setEditForm({ ...item });
     setIsJsonMode(false); // Default to Form mode
  };

  // Switch to JSON Mode
  const toggleJsonMode = () => {
     if (!isJsonMode) {
        // Switch to JSON: Convert object to string
        setEditForm({ ...editForm, jsonString: JSON.stringify(editForm, null, 4) });
     } else {
        // Switch back to Form: Try parse
        try {
           const parsed = JSON.parse(editForm.jsonString);
           setEditForm(parsed);
           setJsonError("");
        } catch (e) {
           setJsonError("Cannot switch back: Invalid JSON");
           return;
        }
     }
     setIsJsonMode(!isJsonMode);
  };


  // ==========================================
  // 🔒 LOGIN
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-mono relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_#ef4444_0%,_transparent_50%)]"></div>
        <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl text-center relative z-10">
           <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-slate-700 shadow-[0_0_40px_rgba(239,68,68,0.3)]">
              <ShieldAlert size={48} className="text-red-500 animate-pulse" />
           </div>
           <h1 className="text-3xl font-black text-white tracking-[0.2em] mb-2">TOP SECRET</h1>
           <p className="text-slate-500 text-xs mb-8 uppercase tracking-wider">Authorized Personnel Only</p>
           <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative group">
                 <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-red-500 transition-colors" size={18}/>
                 <input type="password" autoFocus className="w-full bg-slate-950 border border-slate-700 text-white pl-10 pr-4 py-4 rounded-xl focus:ring-2 focus:ring-red-500 outline-none placeholder-slate-600 tracking-widest text-center transition-all" placeholder="ENTER PASSCODE" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}/>
              </div>
              {authError && <div className="text-red-400 text-xs font-bold bg-red-900/20 p-3 rounded border border-red-900/50">{authError}</div>}
              <button className="w-full py-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold rounded-xl transition shadow-lg shadow-red-900/30 tracking-wider">AUTHENTICATE</button>
           </form>
           <Link to="/" className="block mt-8 text-slate-600 text-xs hover:text-slate-400 transition">← Abort Mission (Back to Home)</Link>
        </div>
      </div>
    );
  }

  // ==========================================
  // 🎛️ ADMIN DASHBOARD
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col h-screen overflow-hidden text-slate-800">
      
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 px-6 flex justify-between items-center shadow-lg z-30 border-b border-slate-800">
         <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-red-500 to-orange-600 p-2.5 rounded-xl shadow-lg shadow-red-900/50"><Database size={24} /></div>
            <div>
               <h1 className="font-black text-xl tracking-tight leading-none">COMMAND CENTER</h1>
               <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">SYSTEM ADMIN CONSOLE v3.0</p>
            </div>
         </div>
         <div className="flex items-center gap-3">
            <button onClick={handleExport} className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition border border-slate-700"><Download size={14}/> Backup Data</button>
            <div className="h-8 w-[1px] bg-slate-700 mx-2"></div>
            <button onClick={() => setIsAuthenticated(false)} className="p-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg transition shadow-lg shadow-red-900/20" title="Logout"><LogOut size={18}/></button>
         </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
         
         {/* Sidebar */}
         <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-20 hidden md:flex shadow-sm">
            <div className="p-4 space-y-1">
               <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 pl-2">Main Menu</div>
               <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'dashboard' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard size={18}/> Dashboard</button>
               <button onClick={() => setActiveTab('map')} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'map' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'text-slate-500 hover:bg-slate-50'}`}><MapIcon size={18}/> Map Overview</button>
               <button onClick={() => setActiveTab('requests')} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'requests' ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-slate-500 hover:bg-slate-50'}`}><FileText size={18}/> Requests <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${activeTab === 'requests' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>{requests.length}</span></button>
               <button onClick={() => setActiveTab('centers')} className={`w-full flex items-center gap-3 p-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'centers' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200' : 'text-slate-500 hover:bg-slate-50'}`}><Tent size={18}/> Centers <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${activeTab === 'centers' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>{centers.length}</span></button>
            </div>
         </aside>

         {/* Main Content */}
         <main className="flex-1 flex flex-col bg-slate-50/30 overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px] opacity-50 pointer-events-none"></div>

            {/* --- DASHBOARD TAB --- */}
            {activeTab === 'dashboard' && (
               <div className="flex-1 overflow-y-auto p-6 relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                     <StatCard title="จำนวนรายการ" value={stats.totalReq} icon={<FileText size={24}/>} color="bg-gradient-to-br from-blue-500 to-blue-600" subtext="All time records" />
                     <StatCard title="วิกฤต" value={stats.critical} icon={<AlertTriangle size={24}/>} color="bg-gradient-to-br from-red-500 to-red-600" subtext="High risk score (8+)" />
                     <StatCard title="Black Cases" value={stats.black} icon={<Siren size={24}/>} color="bg-gradient-to-br from-slate-700 to-slate-800" subtext="Confirmed Deceased" />
                     <StatCard title="จำนวนคนศูนย์อพยพ" value={`${stats.currentOccupancy}`} icon={<Tent size={24}/>} color="bg-gradient-to-br from-emerald-500 to-emerald-600" subtext={`Capacity: ${stats.totalCapacity}`} />
                  </div>
                  
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                     <h3 className="font-bold text-lg text-slate-700 mb-4">การทำงานของระบบ</h3>
                     <div className="flex items-center gap-2 text-sm text-emerald-600 font-bold bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                        <CheckCircle2 size={16}/> All Systems Operational
                     </div>
                     <div className="mt-4 grid grid-cols-2 gap-4">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                           <div className="text-xs text-slate-500 uppercase font-bold">AI Worker</div>
                           <div className="text-lg font-black text-slate-800 mt-1">กำลังทำงาน</div>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                           <div className="text-xs text-slate-500 uppercase font-bold">Database</div>
                           <div className="text-lg font-black text-slate-800 mt-1">เชื่อมต่อเรียบร้อย</div>
                        </div>
                     </div>
                  </div>
               </div>
            )}

            {/* --- MAP OVERVIEW TAB (NEW) --- */}
            {activeTab === 'map' && (
               <div className="flex-1 relative z-10 h-full">
                  <MapContainer center={[13.7563, 100.5018]} zoom={6} style={{ height: "100%", width: "100%" }}>
                     <TileLayer url="http://mt0.google.com/vt/lyrs=m&hl=th&x={x}&y={y}&z={z}" attribution='&copy; Google Maps' />
                     {requests.map(req => req.location && (
                        <Marker key={req.id} position={req.location} icon={reqIcon(req.isBlackCase ? 'black' : req.status==='waiting'?'red':req.status==='inprogress'?'orange':'gray')}>
                           <Popup><b className="text-sm">{req.name}</b><br/>{req.status}</Popup>
                        </Marker>
                     ))}
                     {centers.map(c => (
                        <Marker key={c.id} position={c.location} icon={centerIcon}>
                           <Popup><b className="text-sm text-emerald-600">{c.name}</b><br/>{c.currentPeople}/{c.capacity}</Popup>
                        </Marker>
                     ))}
                  </MapContainer>
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-3 rounded-xl shadow-lg z-[1000] text-xs space-y-2">
                     <div className="font-bold text-slate-500 uppercase mb-1">Legend</div>
                     <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"></span> Waiting</div>
                     <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Working</div>
                     <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-black"></span> Black Case</div>
                     <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Center</div>
                  </div>
               </div>
            )}

            {/* --- DATA TABLES (Requests / Centers) --- */}
            {(activeTab === 'requests' || activeTab === 'centers') && (
               <div className="flex flex-col h-full relative z-10">
                  <div className="p-4 bg-white/80 backdrop-blur border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 sticky top-0 z-20">
                     <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        {activeTab === 'requests' ? <FileText className="text-blue-500"/> : <Tent className="text-emerald-500"/>}
                        {activeTab === 'requests' ? 'Request Database' : 'Center Database'}
                     </h2>
                     <div className="flex gap-2 w-full md:w-auto">
                        {/* Filter Dropdown */}
                        {activeTab === 'requests' && (
                           <div className="relative">
                              <select value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value)} className="h-10 pl-3 pr-8 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer">
                                 <option value="all">ALL STATUS</option>
                                 <option value="waiting">WAITING</option>
                                 <option value="inprogress">IN PROGRESS</option>
                                 <option value="completed">COMPLETED</option>
                                 <option value="black">BLACK CASE</option>
                              </select>
                              <Filter size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                           </div>
                        )}
                        <div className="relative flex-1 md:w-64">
                           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                           <input value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 h-10 bg-slate-100 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-300 outline-none" placeholder="Search ID, Name..." />
                        </div>
                     </div>
                  </div>

                  <div className="flex-1 overflow-auto p-4">
                     <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-left text-sm">
                           <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-[10px]">
                              <tr>
                                 <th className="p-4">ID / Name</th>
                                 <th className="p-4">Status / Info</th>
                                 <th className="p-4">Location / Details</th>
                                 <th className="p-4 text-right">Control</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100">
                              {filteredData.map((item) => (
                                 <tr key={item.id} className="hover:bg-slate-50/80 transition group">
                                    <td className="p-4">
                                       <div className="font-bold text-slate-800">{item.name}</div>
                                       <div className="text-xs text-slate-400 font-mono mt-0.5">{item.id.substring(0, 6)}...</div>
                                    </td>
                                    <td className="p-4">
                                       {activeTab === 'requests' ? (
                                          <div className="flex flex-wrap gap-2">
                                             <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide ${item.status==='waiting'?'bg-red-100 text-red-600':item.status==='inprogress'?'bg-orange-100 text-orange-600':'bg-emerald-100 text-emerald-600'}`}>
                                                {item.status}
                                             </span>
                                             {item.isBlackCase && <span className="px-2 py-1 rounded-md text-[10px] font-bold uppercase bg-slate-800 text-white">BLACK</span>}
                                             <span className="text-xs text-slate-500 ml-1 font-mono">Risk: {item.ai_analysis?.risk_score || '-'}</span>
                                          </div>
                                       ) : (
                                          <div className="w-40">
                                             <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1"><span>Occupancy</span><span>{item.currentPeople} / {item.capacity}</span></div>
                                             <CapacityBar current={item.currentPeople} max={item.capacity} />
                                          </div>
                                       )}
                                    </td>
                                    <td className="p-4 text-xs text-slate-500">
                                       {activeTab === 'requests' ? (item.address ? `${item.address.district}, ${item.address.province}` : 'N/A') : `Lat: ${item.location?.lat?.toFixed(4)}, Lng: ${item.location?.lng?.toFixed(4)}`}
                                    </td>
                                    <td className="p-4 text-right">
                                       <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                          <button onClick={() => openEditModal(item)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"><Edit size={16}/></button>
                                          <button onClick={() => handleDelete(activeTab === 'requests' ? 'requests' : 'evacuation_centers', item.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"><Trash2 size={16}/></button>
                                       </div>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               </div>
            )}
         </main>
      </div>

      {/* ================= EDIT MODAL (With JSON Mode) ================= */}
      {editingItem && (
         <div className="fixed inset-0 z-[100] bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] scale-100 animate-in zoom-in-95">
               <div className="bg-slate-900 p-5 text-white flex justify-between items-center shrink-0">
                  <div>
                     <h3 className="font-bold text-lg flex items-center gap-2"><Edit size={20}/> {isJsonMode ? 'Advanced JSON Editor' : 'แก้ไขข้อมูล'}</h3>
                     <p className="text-[10px] text-slate-400 font-mono mt-1">ID: {editingItem.id}</p>
                  </div>
                  <div className="flex gap-2">
                      <button onClick={toggleJsonMode} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition ${isJsonMode ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
                          <Code size={14}/> {isJsonMode ? 'Form View' : 'JSON View'}
                      </button>
                      <button onClick={() => setEditingItem(null)} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white transition"><X size={20}/></button>
                  </div>
               </div>
               
               <div className="p-6 overflow-y-auto flex-1 space-y-4 bg-slate-50">
                  {jsonError && <div className="bg-red-100 text-red-700 p-3 rounded-lg text-xs font-bold flex items-center gap-2 mb-4"><AlertTriangle size={16}/> {jsonError}</div>}

                  {/* 🟡 JSON MODE */}
                  {isJsonMode ? (
                      <div className="h-full flex flex-col">
                          <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs p-3 rounded-lg mb-2 flex items-start gap-2">
                              <AlertTriangle size={14} className="mt-0.5 shrink-0"/> 
                              <span>Warning: Editing raw JSON can break the application if the structure is invalid. Use with caution.</span>
                          </div>
                          <textarea 
                              className="w-full flex-1 p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl outline-none border border-slate-700 focus:border-blue-500 min-h-[300px]"
                              value={editForm.jsonString}
                              onChange={(e) => setEditForm({...editForm, jsonString: e.target.value})}
                          ></textarea>
                      </div>
                  ) : (
                      /* 🟡 FORM MODE */
                      <div className="grid grid-cols-1 gap-4">
                          {Object.keys(editForm).map((key) => {
                             if(['id','timestamp','location','address','ai_analysis','residents','facilities','jsonString'].includes(key)) return null;
                             
                             if (typeof editForm[key] === 'boolean') {
                                return (
                                    <div key={key} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
                                        <label className="text-xs font-bold text-slate-600 uppercase">{key}</label>
                                        <input type="checkbox" className="w-5 h-5 accent-blue-600" checked={editForm[key]} onChange={(e) => setEditForm({...editForm, [key]: e.target.checked})}/>
                                    </div>
                                );
                             }
                             return (
                                <div key={key}>
                                   <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1 block">{key}</label>
                                   <input className="w-full p-3 border border-slate-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-blue-500 outline-none transition" value={editForm[key] || ""} onChange={(e) => setEditForm({...editForm, [key]: e.target.value})}/>
                                </div>
                             )
                          })}
                          
                          {/* Status Dropdown for Requests */}
                          {activeTab === 'requests' && (
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1 block">Status Override</label>
                                  <select className="w-full p-3 border border-slate-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500" value={editForm.status} onChange={(e) => setEditForm({...editForm, status: e.target.value})}>
                                     <option value="waiting">Waiting</option>
                                     <option value="inprogress">In Progress</option>
                                     <option value="completed">Completed</option>
                                  </select>
                              </div>
                          )}
                      </div>
                  )}
               </div>

               <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
                  <button onClick={() => setEditingItem(null)} className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition">Cancel</button>
                  <button onClick={saveEdit} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 shadow-lg shadow-slate-900/20 flex items-center gap-2 transition"><Save size={16}/> Save Changes</button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
}