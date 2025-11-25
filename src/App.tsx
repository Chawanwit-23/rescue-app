// src/App.tsx (User Reporting Form + Footer)
import { useState, Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";
import "leaflet/dist/leaflet.css";
import * as LucideIcons from "lucide-react"; 

// ดึงไอคอนที่ใช้
const { 
  MapPin, Camera, Send, AlertTriangle, User, Phone, FileText, 
  Loader2, Crosshair, ShieldCheck, Home, Users, Droplets, Info, Heart 
} = LucideIcons as any;

// Load Map แบบ Lazy
const MapPicker = lazy(() => import("./components/MapPicker") as any); 

// ฟังก์ชันดึงที่อยู่ละเอียด (Reverse Geocoding)
const getAddressFromCoords = async (lat: number, lng: number) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=th`);
    const data = await res.json();
    const addr = data.address || {};
    const details = [
      addr.house_number ? `บ้านเลขที่ ${addr.house_number}` : '',
      addr.road ? `ถ.${addr.road}` : '',
      addr.soi ? `ซ.${addr.soi}` : '',
      addr.village ? `หมู่บ้าน${addr.village}` : ''
    ].filter(Boolean).join(' ');

    return {
      details: details || "ไม่มีรายละเอียดถนน",
      subdistrict: addr.tambon || addr.suburb || addr.quarter || "-",
      district: addr.amphoe || addr.district || addr.city_district || "-",
      province: addr.province || addr.state || "-",
      postcode: addr.postcode || "",
      road: details,
      full: data.display_name
    };
  } catch (error) {
    console.error("Geocode Error:", error);
    return { details: "", subdistrict: "-", district: "-", province: "-", postcode: "", full: "", road: "" };
  }
};

export default function App() {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState({ lat: 13.7563, lng: 100.5018 });
  const [imageBase64, setImageBase64] = useState("");
  const [isGeocoding, setIsGeocoding] = useState(false);

  // State ข้อมูล
  const [addressData, setAddressData] = useState({ province: "", district: "", subdistrict: "", details: "" });
  const [peopleCount, setPeopleCount] = useState(1); 
  const [waterLevel, setWaterLevel] = useState("ไม่ระบุ");
  const [reporterType, setReporterType] = useState("ผู้ประสบภัยเอง"); 

  const handleLocationChange = async (lat: number, lng: number) => {
    setLocation({ lat, lng });
    setIsGeocoding(true);
    const addr = await getAddressFromCoords(lat, lng);
    setAddressData(prev => ({
      ...prev,
      province: addr.province,
      district: addr.district,
      subdistrict: addr.subdistrict,
      details: prev.details ? prev.details : addr.road 
    }));
    setIsGeocoding(false);
  };

  const handleGetLocation = (e: any) => {
    e.preventDefault();
    if (!navigator.geolocation) return alert("GPS ไม่รองรับ");
    navigator.geolocation.getCurrentPosition(
      (pos) => handleLocationChange(pos.coords.latitude, pos.coords.longitude),
      () => alert("กรุณาเปิด GPS")
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
      const form = e.target;
      await addDoc(collection(db, "requests"), {
        name: form.name.value,
        contact: form.contact.value,
        description: form.description.value,
        peopleCount: peopleCount,
        waterLevel: waterLevel,
        reporterType: reporterType,
        location: location,
        address: {
            province: addressData.province,
            district: addressData.district,
            subdistrict: addressData.subdistrict,
            details: addressData.details 
        },
        imageUrl: imageBase64,
        status: "waiting",
        timestamp: new Date()
      });
      alert("✅ แจ้งเหตุสำเร็จ! เจ้าหน้าที่กำลังตรวจสอบ");
      window.location.reload();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-300 flex flex-col items-center py-10 px-4 font-sans overflow-y-auto">
      
      {/* Main Card */}
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 relative mb-6">
        
        {/* Header */}
        <div className="bg-slate-800 p-5 text-white text-center relative">
          <Link to="/dashboard" className="absolute top-4 right-4 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border border-white/10">
            <ShieldCheck size={14} className="text-green-400" /> จนท.
          </Link>
          <div className="flex justify-center items-center gap-2 mb-1 mt-2">
             <AlertTriangle className="text-red-500 fill-current animate-pulse" size={28} />
             <h1 className="text-2xl font-bold">แจ้งเหตุฉุกเฉิน</h1>
          </div>
          <p className="text-slate-400 text-xs">ระบบ AI กู้ภัยอัจฉริยะ (Flood Rescue AI)</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* 1. Map */}
          <div className="space-y-2">
             <div className="flex justify-between items-end">
                <label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <MapPin size={16} className="text-red-600" /> 1. ปักหมุดจุดเกิดเหตุ
                </label>
                <button type="button" onClick={handleGetLocation} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-full hover:bg-blue-700 flex items-center gap-1 shadow-sm">
                  <Crosshair size={12} /> ใช้ตำแหน่งปัจจุบัน
                </button>
             </div>
             <div className="h-48 rounded-xl overflow-hidden border-2 border-slate-200 shadow-inner relative z-0">
               <Suspense fallback={<div className="h-full flex items-center justify-center bg-gray-50 text-xs">โหลดแผนที่...</div>}>
                 <MapPicker location={location} setLocation={(loc: any) => handleLocationChange(loc.lat, loc.lng)} />
               </Suspense>
             </div>
             <div className="text-center text-[10px] text-slate-400">
                พิกัด: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
             </div>
          </div>

          <hr className="border-slate-100" />

          {/* 2. Address */}
          <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
             <label className="font-bold text-slate-700 text-sm flex items-center gap-2">
               <Home size={16} className="text-orange-500" /> 2. รายละเอียดที่อยู่
             </label>
             <div className="grid grid-cols-3 gap-2">
                <div>
                    <label className="text-[10px] text-slate-500">จังหวัด</label>
                    <input value={isGeocoding ? "..." : addressData.province} onChange={e => setAddressData({...addressData, province: e.target.value})} className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" placeholder="จังหวัด"/>
                </div>
                <div>
                    <label className="text-[10px] text-slate-500">อำเภอ/เขต</label>
                    <input value={isGeocoding ? "..." : addressData.district} onChange={e => setAddressData({...addressData, district: e.target.value})} className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" placeholder="อำเภอ"/>
                </div>
                <div>
                    <label className="text-[10px] text-slate-500">ตำบล/แขวง</label>
                    <input value={isGeocoding ? "..." : addressData.subdistrict} onChange={e => setAddressData({...addressData, subdistrict: e.target.value})} className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none" placeholder="ตำบล"/>
                </div>
             </div>
             <div>
                <label className="text-[10px] text-slate-500">บ้านเลขที่ / ซอย / จุดสังเกต</label>
                <input value={addressData.details} onChange={e => setAddressData({...addressData, details: e.target.value})} className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="เช่น 123 หมู่ 4 ซอยวัด..." required />
             </div>
          </div>

          {/* 3. Details */}
          <div className="space-y-3 bg-blue-50 p-3 rounded-xl border border-blue-100">
             <label className="font-bold text-slate-700 text-sm flex items-center gap-2">
               <Info size={16} className="text-blue-500" /> 3. ข้อมูลสถานการณ์
             </label>
             <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1"><Users size={14}/> จำนวนผู้ประสบภัย</label>
                <div className="flex items-center bg-white rounded-lg border border-blue-200">
                    <button type="button" onClick={() => setPeopleCount(Math.max(1, peopleCount - 1))} className="px-3 py-1 text-blue-600 hover:bg-blue-100 rounded-l-lg">-</button>
                    <span className="px-3 text-sm font-bold w-8 text-center">{peopleCount}</span>
                    <button type="button" onClick={() => setPeopleCount(peopleCount + 1)} className="px-3 py-1 text-blue-600 hover:bg-blue-100 rounded-r-lg">+</button>
                </div>
             </div>
             <div>
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1"><Droplets size={14}/> ระดับน้ำปัจจุบัน</label>
                <select value={waterLevel} onChange={(e) => setWaterLevel(e.target.value)} className="w-full p-2 bg-white border border-blue-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="ท่วมทางเท้า/ถนน">ท่วมทางเท้า / ถนน</option>
                    <option value="ท่วมถึงเข่า">ท่วมถึงเข่า (0.5 เมตร)</option>
                    <option value="ท่วมถึงเอว">ท่วมถึงเอว (1 เมตร)</option>
                    <option value="ท่วมถึงอก/มิดหัว">ท่วมถึงอก / มิดหัว</option>
                    <option value="มิดหลังคา">มิดหลังคา (ต้องการเรือ)</option>
                </select>
             </div>
             <div>
                <label className="text-xs font-bold text-slate-600 flex items-center gap-1 mb-1"><User size={14}/> คุณคือ...</label>
                <div className="flex gap-2">
                    {['ผู้ประสบภัยเอง', 'ญาติ/คนรู้จัก', 'พลเมืองดี'].map((type) => (
                        <button key={type} type="button" onClick={() => setReporterType(type)} className={`flex-1 py-1.5 text-xs rounded-lg border ${reporterType === type ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-blue-200 hover:bg-blue-50'}`}>{type}</button>
                    ))}
                </div>
             </div>
          </div>

          {/* 4. Contact Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
               <label className="text-xs font-bold text-slate-500 ml-1">ชื่อผู้แจ้ง</label>
               <div className="relative mt-1">
                 <User className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                 <input name="name" className="w-full pl-9 p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required placeholder="ชื่อ-นามสกุล" />
               </div>
            </div>
            <div>
               <label className="text-xs font-bold text-slate-500 ml-1">เบอร์ติดต่อ</label>
               <div className="relative mt-1">
                 <Phone className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                 <input name="contact" className="w-full pl-9 p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required placeholder="เบอร์โทร" />
               </div>
            </div>
          </div>
          
          {/* 5. Description */}
          <div>
             <label className="text-xs font-bold text-slate-500 ml-1">รายละเอียดเพิ่มเติม</label>
             <div className="relative mt-1">
                <FileText className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                <textarea name="description" className="w-full pl-9 p-2.5 bg-white border border-slate-200 rounded-lg text-sm h-16 outline-none focus:ring-2 focus:ring-blue-500 resize-none" placeholder="เช่น ผู้ป่วยติดเตียง, ไม่มีไฟฟ้า, ต้องการยา..." />
             </div>
          </div>

          {/* 6. Photo */}
          <div className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer relative group ${imageBase64 ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-blue-400'}`}>
            <input type="file" onChange={handleImage} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="image/*" />
            {imageBase64 ? (
               <img src={imageBase64} className="h-24 mx-auto rounded shadow-sm object-cover" />
            ) : (
               <div className="py-1">
                 <Camera className="w-6 h-6 mx-auto text-slate-400 mb-1 group-hover:text-blue-500 transition-colors" />
                 <span className="text-xs text-slate-500 font-bold">ถ่ายรูปหน้างาน (จำเป็น)</span>
               </div>
            )}
          </div>

          <button disabled={loading} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg flex justify-center items-center gap-2 transition-all active:scale-95">
            {loading ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> ส่งแจ้งเหตุ</>}
          </button>

        </form>
      </div>

      {/* 🟢 FOOTER (เพิ่มตรงนี้ครับ) */}
      <footer className="text-center text-slate-500 text-[10px] font-medium opacity-80">
         <p>&copy; {new Date().getFullYear()} Flood Rescue AI System</p>
         <p className="flex items-center justify-center gap-1 mt-1">
            Developed with <Heart size={10} className="text-red-400 fill-current" /> by <span className="text-slate-700 font-bold">Chawanwit</span>
         </p>
      </footer>

    </div>
  );
}