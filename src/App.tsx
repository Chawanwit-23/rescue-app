import { useState, Suspense, lazy, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";
import "leaflet/dist/leaflet.css";
import * as LucideIcons from "lucide-react"; 

// --- Icons ---
const { 
  MapPin, Camera, Send, AlertTriangle, User, Phone, FileText, 
  Loader2, Crosshair, ShieldCheck, Home, Users, Droplets, Info, Heart,
  Edit3 
} = LucideIcons as any;

// --- Lazy Load Map ---
const MapPicker = lazy(() => import("./components/MapPicker") as any); 

// 🟢 ฟังก์ชัน 1: แปลงพิกัด -> ที่อยู่ (Reverse Geocoding)
const getAddressFromCoords = async (lat: number, lng: number) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=th`);
    const data = await res.json();
    const addr = data.address || {};
    
    // สร้างคำบรรยายรายละเอียด (ตัดจังหวัด/อำเภอออก เพราะมีช่องแยกแล้ว)
    const detailsParts = [];
    if (addr.house_number) detailsParts.push(`บ้านเลขที่ ${addr.house_number}`);
    if (addr.village) detailsParts.push(`หมู่บ้าน${addr.village}`);
    if (addr.moo) detailsParts.push(`หมู่ ${addr.moo}`);
    if (addr.soi) detailsParts.push(`ซอย${addr.soi}`);
    if (addr.road) detailsParts.push(`ถนน${addr.road}`);
    if (addr.landmark) detailsParts.push(addr.landmark);
    
    return {
      details: detailsParts.join(" ") || "", 
      subdistrict: addr.tambon || addr.suburb || addr.quarter || "", 
      district: addr.amphoe || addr.district || addr.city_district || "", 
      province: addr.province || addr.state || "", 
      postcode: addr.postcode || "",
      full: data.display_name
    };
  } catch (error) {
    console.error("Reverse Geocode Error:", error);
    return { details: "", subdistrict: "", district: "", province: "", postcode: "", full: "" };
  }
};

// 🟢 ฟังก์ชัน 2: แปลงที่อยู่ -> พิกัด (Forward Geocoding)
const getCoordsFromAddress = async (address: string) => {
  try {
    // ค้นหาจาก OpenStreetMap
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=th`);
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
    return null;
  } catch (error) {
    console.error("Forward Geocode Error:", error);
    return null;
  }
};

export default function App() {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState({ lat: 13.7563, lng: 100.5018 });
  const [imageBase64, setImageBase64] = useState("");
  
  // State สถานะการโหลด
  const [isResolvingAddress, setIsResolvingAddress] = useState(false); // กำลังดึงที่อยู่จากหมุด
  const [isResolvingCoords, setIsResolvingCoords] = useState(false);   // กำลังดึงหมุดจากที่อยู่

  // Refs สำหรับป้องกัน Loop (สำคัญมาก!)
  const isInternalLocationUpdate = useRef(false); // เปลี่ยนพิกัดโดยโปรแกรม (จากการพิมพ์)
  const isInternalAddressUpdate = useRef(false);  // เปลี่ยนที่อยู่โดยโปรแกรม (จากการลาก)

  // State ข้อมูลฟอร์ม
  const [addressData, setAddressData] = useState({ 
      province: "", 
      district: "", 
      subdistrict: "", 
      details: "" 
  });
  
  const [peopleCount, setPeopleCount] = useState(1); 
  const [waterLevel, setWaterLevel] = useState("ท่วมทางเท้า/ถนน");
  const [reporterType, setReporterType] = useState("ผู้ประสบภัยเอง"); 

  // ------------------------------------------------------------
  // 🔄 1. Effect: เมื่อพิกัดเปลี่ยน (ลากแมพ) -> อัปเดตที่อยู่ text
  // ------------------------------------------------------------
  useEffect(() => {
      // ถ้าเป็นการเปลี่ยนพิกัดจากการพิมพ์ที่อยู่ (Forward Geo) ให้ข้ามการดึงที่อยู่ซ้ำ
      if (isInternalLocationUpdate.current) {
          isInternalLocationUpdate.current = false;
          return;
      }

      const timeoutId = setTimeout(async () => {
          setIsResolvingAddress(true);
          const addr = await getAddressFromCoords(location.lat, location.lng);
          
          // ล็อคไม่ให้ Effect ที่ 2 ทำงาน
          isInternalAddressUpdate.current = true;
          
          setAddressData({
              province: addr.province,
              district: addr.district,
              subdistrict: addr.subdistrict,
              details: addr.details 
          });
          
          setIsResolvingAddress(false);
      }, 800); // Debounce 0.8s

      return () => clearTimeout(timeoutId);
  }, [location.lat, location.lng]);

  // ------------------------------------------------------------
  // 🔄 2. Effect: เมื่อที่อยู่เปลี่ยน (พิมพ์เอง) -> อัปเดตพิกัด map
  // ------------------------------------------------------------
  useEffect(() => {
      // ถ้าเป็นการเปลี่ยนที่อยู่จากการลากแมพ (Reverse Geo) ให้ข้ามการย้ายหมุดซ้ำ
      if (isInternalAddressUpdate.current) {
          isInternalAddressUpdate.current = false;
          return;
      }

      // ต้องกรอกให้ครบระดับนึงก่อนค่อยค้นหา (เช่น จังหวัด+อำเภอ)
      const query = `${addressData.subdistrict} ${addressData.district} ${addressData.province}`.trim();
      if (query.length < 5) return;

      const timeoutId = setTimeout(async () => {
          setIsResolvingCoords(true);
          const coords = await getCoordsFromAddress(query);
          
          if (coords) {
              // ล็อคไม่ให้ Effect ที่ 1 ทำงาน
              isInternalLocationUpdate.current = true;
              setLocation(coords);
          }
          setIsResolvingCoords(false);
      }, 1500); // Debounce 1.5s (รอนานหน่อย กันแมพบินว่อนตอนพิมพ์)

      return () => clearTimeout(timeoutId);
  }, [addressData.province, addressData.district, addressData.subdistrict]);


  // --- Handlers ---

  const handleGetLocation = (e: any) => {
    e.preventDefault();
    if (!navigator.geolocation) return alert("อุปกรณ์ไม่รองรับ GPS");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
          // การกด GPS ถือเป็น Manual Action ให้ Trigger การดึงที่อยู่ใหม่ได้เลย
          setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => alert("กรุณาเปิด GPS หรืออนุญาตการเข้าถึงตำแหน่ง")
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
    if (!imageBase64) return alert("⚠️ กรุณาถ่ายรูปหน้างาน");
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
      alert("✅ แจ้งเหตุสำเร็จ!");
      window.location.reload();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center py-6 px-4 font-sans overflow-y-auto">
      
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 relative mb-6">
        
        <div className="bg-slate-900 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-slate-800 to-slate-900 opacity-50"></div>
          <Link to="/dashboard" className="absolute top-4 right-4 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border border-white/10 z-10">
            <ShieldCheck size={14} className="text-emerald-400" /> จนท.
          </Link>
          <div className="relative z-10 flex flex-col items-center">
             <div className="bg-red-600 p-3 rounded-full shadow-lg shadow-red-900/50 mb-3 animate-pulse">
                <AlertTriangle className="text-white" size={32} />
             </div>
             <h1 className="text-2xl font-black tracking-tight">แจ้งเหตุฉุกเฉิน</h1>
             <p className="text-slate-400 text-xs mt-1">ระบบ AI กู้ภัยอัจฉริยะ (Flood Rescue)</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          
          {/* 1. Map Section */}
          <div className="space-y-2">
             <div className="flex justify-between items-end px-1">
                <label className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <MapPin size={18} className="text-red-600" /> 1. ระบุตำแหน่ง
                </label>
                <button type="button" onClick={handleGetLocation} className="text-[10px] bg-blue-50 text-blue-600 border border-blue-100 px-3 py-1.5 rounded-full hover:bg-blue-100 flex items-center gap-1 font-bold transition-colors">
                  <Crosshair size={12} /> พิกัดปัจจุบัน
                </button>
             </div>
             
             <div className="h-64 rounded-2xl overflow-hidden border-2 border-slate-200 shadow-inner relative z-0 group">
               <Suspense fallback={<div className="h-full flex items-center justify-center bg-slate-50 text-slate-400 text-xs">กำลังโหลดแผนที่...</div>}>
                 <MapPicker location={location} setLocation={setLocation} />
               </Suspense>
               <div className="absolute top-2 left-2 bg-white/90 backdrop-blur text-[10px] px-2 py-1 rounded text-slate-700 font-bold z-[500] pointer-events-none border border-slate-200 shadow-sm">
                  เลื่อนหมุดให้ตรงจุด
               </div>
               {isResolvingCoords && (
                   <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-[600] flex items-center justify-center text-xs font-bold text-blue-600 animate-pulse">
                       กำลังย้ายหมุดไปที่อยู่...
                   </div>
               )}
             </div>
             
             <div className="flex justify-between items-center px-2 text-[10px] text-slate-400">
                <span>Lat: {location.lat.toFixed(5)}, Lng: {location.lng.toFixed(5)}</span>
                {isResolvingAddress && <span className="flex items-center gap-1 text-orange-500 font-bold"><Loader2 size={10} className="animate-spin"/> ดึงชื่อสถานที่...</span>}
             </div>
          </div>

          <hr className="border-slate-100" />

          {/* 2. Address Form */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
             <label className="font-bold text-slate-700 text-sm flex items-center gap-2">
               <Home size={18} className="text-orange-500" /> 2. ที่อยู่ (แก้ไขได้)
             </label>
             <p className="text-[10px] text-slate-400 ml-6 -mt-2 mb-2">*พิมพ์ชื่อจังหวัด/อำเภอ หมุดจะขยับตาม</p>
             
             <div className="relative">
                <label className="text-[10px] text-slate-500 font-semibold ml-1 mb-0.5 block">บ้านเลขที่ / ซอย / จุดสังเกต</label>
                <div className="relative">
                    <input 
                        value={addressData.details} 
                        onChange={e => setAddressData({...addressData, details: e.target.value})} 
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-all pr-8" 
                        placeholder="กรอกรายละเอียด..." 
                        required 
                    />
                    <Edit3 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"/>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[10px] text-slate-500 font-semibold ml-1 mb-0.5 block">แขวง / ตำบล</label>
                    <input value={addressData.subdistrict} onChange={e => setAddressData({...addressData, subdistrict: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none" placeholder="ตำบล" required/>
                </div>
                <div>
                    <label className="text-[10px] text-slate-500 font-semibold ml-1 mb-0.5 block">เขต / อำเภอ</label>
                    <input value={addressData.district} onChange={e => setAddressData({...addressData, district: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none" placeholder="อำเภอ" required/>
                </div>
                <div className="col-span-2">
                    <label className="text-[10px] text-slate-500 font-semibold ml-1 mb-0.5 block">จังหวัด</label>
                    <input value={addressData.province} onChange={e => setAddressData({...addressData, province: e.target.value})} className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-orange-500 outline-none" placeholder="จังหวัด" required/>
                </div>
             </div>
          </div>

          {/* 3. Details */}
          <div className="space-y-4 bg-blue-50 p-4 rounded-2xl border border-blue-100/60">
             <label className="font-bold text-slate-700 text-sm flex items-center gap-2">
               <Info size={18} className="text-blue-500" /> 3. ข้อมูลสถานการณ์
             </label>
             
             <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-blue-100">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-2 pl-2"><Users size={16} className="text-blue-400"/> ผู้ประสบภัย (คน)</label>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setPeopleCount(Math.max(1, peopleCount - 1))} className="w-8 h-8 flex items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition font-bold">-</button>
                    <span className="w-10 text-center font-bold text-lg text-slate-700">{peopleCount}</span>
                    <button type="button" onClick={() => setPeopleCount(peopleCount + 1)} className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition font-bold shadow-sm shadow-blue-200">+</button>
                </div>
             </div>

             <div>
                <label className="text-[10px] font-bold text-slate-500 ml-1 mb-1 block">ระดับน้ำปัจจุบัน</label>
                <div className="relative">
                    <Droplets className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 w-4 h-4" />
                    <select value={waterLevel} onChange={(e) => setWaterLevel(e.target.value)} className="w-full pl-9 p-2.5 bg-white border border-blue-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                        <option value="ท่วมทางเท้า/ถนน">ท่วมทางเท้า / ถนน</option>
                        <option value="ท่วมถึงเข่า">ท่วมถึงเข่า (0.5 เมตร)</option>
                        <option value="ท่วมถึงเอว">ท่วมถึงเอว (1 เมตร)</option>
                        <option value="ท่วมถึงอก/มิดหัว">ท่วมถึงอก / มิดหัว (วิกฤต)</option>
                        <option value="มิดหลังคา">มิดหลังคา (ต้องการเรือด่วน)</option>
                    </select>
                </div>
             </div>

             <div>
                <label className="text-[10px] font-bold text-slate-500 ml-1 mb-1 block">สถานะผู้แจ้ง</label>
                <div className="flex gap-2">
                    {['ผู้ประสบภัยเอง', 'ญาติ/คนรู้จัก', 'พลเมืองดี'].map((type) => (
                        <button key={type} type="button" onClick={() => setReporterType(type)} className={`flex-1 py-2 text-[10px] font-bold rounded-lg border transition-all ${reporterType === type ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-blue-50'}`}>{type}</button>
                    ))}
                </div>
             </div>
          </div>

          {/* 4. Contact */}
          <div className="space-y-3">
             <div className="grid grid-cols-2 gap-3">
                <div>
                   <label className="text-[10px] font-bold text-slate-500 ml-1">ชื่อผู้แจ้ง</label>
                   <div className="relative mt-1">
                     <User className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                     <input name="name" className="w-full pl-9 p-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-400" required placeholder="ชื่อ-นามสกุล" />
                   </div>
                </div>
                <div>
                   <label className="text-[10px] font-bold text-slate-500 ml-1">เบอร์ติดต่อ</label>
                   <div className="relative mt-1">
                     <Phone className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
                     <input name="contact" type="tel" className="w-full pl-9 p-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-slate-400" required placeholder="08x-xxx-xxxx" />
                   </div>
                </div>
             </div>
             <div>
                 <label className="text-[10px] font-bold text-slate-500 ml-1">รายละเอียดเพิ่มเติม</label>
                 <div className="relative mt-1">
                    <FileText className="absolute left-3 top-3 text-slate-400 w-4 h-4" />
                    <textarea name="description" className="w-full pl-9 p-3 bg-white border border-slate-200 rounded-xl text-sm h-20 outline-none focus:ring-2 focus:ring-slate-400 resize-none" placeholder="เช่น ผู้ป่วยติดเตียง, คนชรา, อาหารหมด, ตัดไฟแล้ว..." />
                 </div>
             </div>
          </div>

          {/* 5. Photo */}
          <div className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer relative group transition-all ${imageBase64 ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/30'}`}>
            <input type="file" onChange={handleImage} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" accept="image/*" />
            {imageBase64 ? (
               <div className="relative">
                   <img src={imageBase64} className="h-40 mx-auto rounded-lg shadow-md object-cover" />
                   <div className="absolute bottom-2 right-1/2 translate-x-1/2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-full backdrop-blur-sm">แตะเพื่อเปลี่ยนรูป</div>
               </div>
            ) : (
               <div className="py-2">
                 <div className="w-12 h-12 bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform"><Camera size={24} /></div>
                 <h3 className="text-sm font-bold text-slate-700">ถ่ายรูปหน้างาน (จำเป็น)</h3>
                 <p className="text-xs text-slate-400 mt-1">เพื่อให้ AI ประเมินความรุนแรง</p>
               </div>
            )}
          </div>

          <button disabled={loading} className="w-full py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold text-lg rounded-2xl shadow-lg shadow-red-200 flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
            {loading ? <Loader2 className="animate-spin" size={24} /> : <><Send size={20} /> ส่งแจ้งเหตุทันที</>}
          </button>

        </form>
      </div>

      <footer className="text-center text-slate-400 text-[10px] font-medium opacity-80 pb-6">
         <p>&copy; {new Date().getFullYear()} Flood Rescue AI System</p>
         <p className="flex items-center justify-center gap-1 mt-1">Developed with <Heart size={10} className="text-red-400 fill-current animate-pulse" /> by <span className="text-slate-600 font-bold">Chawanwit</span></p>
      </footer>
    </div>
  );
}