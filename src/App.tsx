import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Camera, MapPin, Send, AlertTriangle, User, Phone, FileText, Loader2, Crosshair, LayoutDashboard, ShieldCheck } from "lucide-react";
// --- แก้ไอคอนหมุด ---
const iconDefault = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34]
});

// --- Component จัดการแผนที่ ---
function LocationMarker({ location, setLocation }: any) {
  const map = useMap();

  useEffect(() => {
    if (location) {
      map.flyTo(location, 16, { duration: 1.5 });
    }
  }, [location, map]);

  useMapEvents({
    click(e) {
      setLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  return location ? <Marker position={location} icon={iconDefault} /> : null;
}

// --- หน้าเว็บหลัก ---
export default function App() {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState({ lat: 13.7563, lng: 100.5018 });
  const [imageBase64, setImageBase64] = useState("");

  const handleGetLocation = (e: any) => {
    e.preventDefault();
    if (!navigator.geolocation) return alert("เบราว์เซอร์ไม่รองรับ GPS");
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => alert("กรุณากดอนุญาตสิทธิ์ GPS")
    );
  };

  const handleImage = (e: any) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev: any) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const scale = 800 / img.width;
          canvas.width = 800;
          canvas.height = img.height * scale;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          setImageBase64(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!imageBase64) return alert("📸 กรุณาถ่ายรูปหน้างาน!");
    setLoading(true);
    try {
      await addDoc(collection(db, "requests"), {
        name: e.target.name.value,
        contact: e.target.contact.value,
        description: e.target.description.value,
        location: location,
        imageUrl: imageBase64,
        status: "waiting",
        timestamp: new Date()
      });
      alert("✅ แจ้งเหตุเรียบร้อย! เจ้าหน้าที่กำลังตรวจสอบ");
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-4 flex justify-center items-center font-sans">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 relative">
        
        {/* Header */}
        <div className="bg-slate-800 p-6 text-white text-center relative">
          
          {/* 👇 แก้ตรงนี้ครับ: ปุ่มเจ้าหน้าที่ชัดเจนขึ้น 👇 */}
          <Link to="/dashboard" className="absolute top-4 right-4 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full text-[10px] font-bold transition-all backdrop-blur-sm border border-white/10 group">
            <ShieldCheck size={14} className="text-green-400" />
            สำหรับเจ้าหน้าที่
          </Link>

          <div className="flex justify-center items-center gap-2 mb-1 mt-2">
             <AlertTriangle className="text-red-500 fill-current" size={32} />
             <h1 className="text-2xl font-bold">แจ้งเหตุฉุกเฉิน</h1>
          </div>
          <p className="text-slate-400 text-xs">ระบบ AI ช่วยเหลือผู้ประสบภัย</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          <div className="space-y-2">
             <div className="flex justify-between items-end">
                <label className="font-bold text-slate-700 flex items-center gap-2">
                  <MapPin size={18} className="text-red-600" /> ตำแหน่งของคุณ
                </label>
                <button type="button" onClick={handleGetLocation} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-blue-700 transition shadow-sm">
                  <Crosshair size={14} /> GPS ปัจจุบัน
                </button>
             </div>
             
             <div className="h-56 rounded-xl overflow-hidden border-2 border-slate-200 shadow-inner relative z-0">
               <MapContainer center={[13.7563, 100.5018]} zoom={13} style={{ height: "100%", width: "100%" }}>
                 <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                 <LocationMarker location={location} setLocation={setLocation} />
               </MapContainer>
             </div>
             <div className="text-center"><span className="text-[10px] bg-slate-100 px-2 py-1 rounded text-slate-500">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span></div>
          </div>

          <hr className="border-slate-100" />

          <div className="grid grid-cols-2 gap-3">
            <div>
               <label className="text-xs font-bold text-slate-500 ml-1">ชื่อผู้แจ้ง</label>
               <div className="relative mt-1">
                 <User className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                 <input name="name" className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="ชื่อ-นามสกุล" />
               </div>
            </div>
            <div>
               <label className="text-xs font-bold text-slate-500 ml-1">เบอร์ติดต่อ</label>
               <div className="relative mt-1">
                 <Phone className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                 <input name="contact" className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" required placeholder="08x-xxx-xxxx" />
               </div>
            </div>
          </div>
          
          <div>
             <label className="text-xs font-bold text-slate-500 ml-1">รายละเอียด</label>
             <div className="relative mt-1">
                <FileText className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                <textarea name="description" className="w-full pl-9 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm h-20 focus:ring-2 focus:ring-blue-500 outline-none resize-none" required placeholder="เกิดอะไรขึ้น? ต้องการความช่วยเหลือด่วนแค่ไหน?" />
             </div>
          </div>

          <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all relative overflow-hidden group ${imageBase64 ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'}`}>
            <input type="file" onChange={handleImage} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="image/*" />
            {imageBase64 ? (
               <img src={imageBase64} className="h-28 mx-auto rounded shadow-sm object-cover" />
            ) : (
               <div className="py-2">
                 <Camera className="w-8 h-8 mx-auto text-slate-400 mb-2 group-hover:text-blue-500 transition-colors" />
                 <span className="text-xs text-slate-500 font-bold">ถ่ายรูปหน้างาน (จำเป็น)</span>
               </div>
            )}
          </div>

          <button disabled={loading} className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg flex justify-center items-center gap-2 transition-all active:scale-95">
            {loading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> ส่งแจ้งเหตุ</>}
          </button>

        </form>
      </div>
    </div>
  );
}