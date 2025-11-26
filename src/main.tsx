import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from './App.tsx'
import Dashboard from './Dashboard.tsx'
import Login from './Login.tsx'
import Evacuation from './Evacuation.tsx' // 🟢 เพิ่ม import

import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* 🟢 เพิ่มเส้นทางใหม่ */}
        <Route path="/evacuation" element={<Evacuation />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)