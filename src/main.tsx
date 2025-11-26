import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Import หน้าต่างๆ
import App from './App.tsx'
import Dashboard from './Dashboard.tsx'
import Login from './Login.tsx'
import Evacuation from './Evacuation.tsx'
import Admin from './admin.tsx' // 🟢 สำคัญ! ต้อง Import ไฟล์ Admin เข้ามา

import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* หน้าแรก (แจ้งเหตุ) */}
        <Route path="/" element={<App />} />
        
        {/* หน้า Login */}
        <Route path="/login" element={<Login />} />
        
        {/* หน้า War Room */}
        <Route path="/dashboard" element={<Dashboard />} />
        
        {/* หน้าจุดอพยพ */}
        <Route path="/evacuation" element={<Evacuation />} />
        
        {/* 🟢 หน้า Admin (เส้นทางลับ) */}
        <Route path="/admin" element={<Admin />} />
        
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)