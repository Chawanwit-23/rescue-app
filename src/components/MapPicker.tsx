// src/components/MapPicker.tsx (ฉบับแก้ไข)
import { useEffect } from "react"; // 🟢 เพิ่ม import useEffect
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// ... (ส่วน iconDefault เหมือนเดิม ไม่ต้องแก้) ...
const iconDefault = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

function LocationMarker({ location, setLocation }: any) {
  const map = useMap();

  // ✅ แก้ไข: ใช้ useEffect เพื่อป้องกัน Loop นรก
  useEffect(() => {
    if (location) {
      // ใช้ flyTo แทน setView เพื่อให้แผนที่เลื่อนไปแบบนุ่มๆ
      map.flyTo(location, map.getZoom(), {
        animate: true,
        duration: 1.5 // ใช้เวลา 1.5 วิในการบินไป
      });
    }
  }, [location, map]); // ทำงานเมื่อ location เปลี่ยนเท่านั้น

  useMapEvents({
    click(e) {
      setLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  return location ? (
    <Marker position={location} icon={iconDefault} />
  ) : null;
}

export default function MapPicker({ location, setLocation }: any) {
  // ... (ส่วน return MapContainer เหมือนเดิม) ...
  return (
    <MapContainer 
      center={[location.lat, location.lng]} 
      zoom={13} 
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer 
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" 
      />
      <LocationMarker location={location} setLocation={setLocation} />
    </MapContainer>
  );
}