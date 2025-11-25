import { MapContainer, TileLayer, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import * as LucideIcons from "lucide-react"; 
import { useEffect, useState } from "react";

const { MapPin } = LucideIcons as any;

// ตัวคุมการลากแผนที่
function MapController({ setLocation, centerPos, onMoveStart }: any) {
  const map = useMap();
  
  useMapEvents({
    movestart: () => {
      onMoveStart(true); // เริ่มลาก -> ยกหมุดขึ้น
    },
    moveend: () => {
      onMoveStart(false); // หยุดลาก -> วางหมุดลง
      const center = map.getCenter();
      setLocation({ lat: center.lat, lng: center.lng });
    },
  });

  // บินไปหาพิกัด (ถ้ามีการกดปุ่ม GPS)
  useEffect(() => {
    if (centerPos) {
        const currentCenter = map.getCenter();
        const dist = map.distance(currentCenter, [centerPos.lat, centerPos.lng]);
        if (dist > 10) { 
            map.flyTo([centerPos.lat, centerPos.lng], 17, { duration: 1.5 });
        }
    }
  }, [centerPos, map]);

  return null;
}

export default function MapPicker({ location, setLocation }: any) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="relative w-full h-full bg-slate-200">
        <MapContainer 
            center={[location.lat, location.lng]} 
            zoom={17} 
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
        >
            {/* 🟢 ใช้ Google Maps Roadmap (แบบปกติ เห็นถนนชัด) */}
            <TileLayer 
                url="http://mt0.google.com/vt/lyrs=m&hl=th&x={x}&y={y}&z={z}" 
                attribution='&copy; Google Maps' 
            />
            
            <MapController 
                setLocation={setLocation} 
                centerPos={location} 
                onMoveStart={setIsDragging}
            />
        </MapContainer>

        {/* 🎯 เป้าปักหมุดตรงกลาง (Animation นุ่มนวล) */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none flex flex-col items-center justify-end pb-8">
            <div className={`transition-transform duration-200 ${isDragging ? '-translate-y-3 scale-110' : 'translate-y-0'}`}>
                <MapPin size={42} className="text-red-600 fill-red-600 drop-shadow-2xl" />
            </div>
            <div className={`w-3 h-1.5 bg-black/40 rounded-full blur-[2px] transition-opacity duration-200 ${isDragging ? 'opacity-30 scale-75' : 'opacity-60 scale-100'}`}></div>
        </div>

        <div className="absolute bottom-3 left-0 right-0 flex justify-center z-[1000] pointer-events-none">
            <span className="bg-white/90 text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-full shadow-md border border-slate-200">
                เลื่อนแผนที่ให้ตรงจุดเกิดเหตุ
            </span>
        </div>
    </div>
  );
}