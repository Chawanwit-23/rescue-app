import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from './App.tsx'
import Dashboard from './Dashboard.tsx'
import Login from './Login.tsx' // 🟢 เพิ่ม import
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* หน้าแจ้งเหตุ (หน้าแรก) */}
        <Route path="/" element={<App />} />
        
        {/* 🟢 เพิ่มหน้า Login */}
        <Route path="/login" element={<Login />} />

        {/* หน้าแดชบอร์ด */}
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)