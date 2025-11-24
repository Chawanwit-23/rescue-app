import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMap } from "react-leaflet"; // ใช้ useMap

// --- แก้บั๊กไอคอนหมุดของ Leaflet ใน React ---
const iconDefault = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
// ------------------------------------------

function LocationMarker({ location, setLocation }: any) {
  const map = useMap();
  
  // บินไปหาจุดเมื่อค่า location เปลี่ยน (เช่น กดปุ่ม GPS)
  // ห้ามใส่ใน useEffect เพราะจะทำให้เกิด loop
  map.setView(location, map.getZoom()); 

  useMapEvents({
    click(e) {
      // ดึงเฉพาะตัวเลข lat, lng เพื่อป้องกัน Error Firebase
      setLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  return location ? (
    <Marker position={location} icon={iconDefault} />
  ) : null;
}

export default function MapPicker({ location, setLocation }: any) {
  return (
    <MapContainer 
      // กำหนด center ที่ state ล่าสุด
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