import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth"; 
import { auth } from "./firebase"; 
import * as LucideIcons from "lucide-react";

const { 
  ShieldCheck, Lock, User, ArrowRight, Loader2, AlertCircle, Siren 
} = LucideIcons as any;

export default function Login() {
  const navigate = useNavigate();
  
  // ใช้ username แทน email
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(""); 
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 🟢 เทคนิค: เอาชื่อที่กรอก มาเติมโดเมนปลอมต่อท้าย
      // เช่น กรอก "admin" -> ระบบจะส่ง "admin@rescue.app" ไปให้ Firebase
      const fakeEmail = `${formData.username}@rescue.app`; 

      await signInWithEmailAndPassword(auth, fakeEmail, formData.password);
      
      navigate("/dashboard"); 
      
    } catch (err: any) {
      console.error("Login Error:", err.code);
      
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-email') {
        setError("ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง");
      } else if (err.code === 'auth/too-many-requests') {
        setError("ลองบ่อยเกินไป กรุณารอสักครู่");
      } else {
        setError("เกิดข้อผิดพลาด: " + err.message);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans relative overflow-hidden">
      
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800/50 to-slate-900 z-0"></div>
      <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5 z-0 pointer-events-none"></div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-300">
        
        <div className="bg-slate-800 p-8 pb-6 text-center relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500"></div>
           <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-700 rounded-2xl mb-4 shadow-lg shadow-slate-900/50 border border-slate-600">
              <Siren className="text-red-500 animate-pulse" size={32} />
           </div>
           <h1 className="text-2xl font-black text-white tracking-tight">WAR ROOM ACCESS</h1>
           <p className="text-slate-400 text-xs mt-1 tracking-wide uppercase">สำหรับเจ้าหน้าที่กู้ภัยเท่านั้น</p>
        </div>

        <form onSubmit={handleLogin} className="p-8 pt-6 space-y-5">
           
           {error && (
             <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg flex items-center gap-2 border border-red-100 animate-in slide-in-from-top-2">
                <AlertCircle size={16} /> {error}
             </div>
           )}

           <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Username</label>
              <div className="relative group">
                 <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                 <input 
                    name="username"
                    type="text" 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-700"
                    placeholder="UserName" // เปลี่ยน placeholder
                    value={formData.username}
                    onChange={handleChange}
                    required
                    autoFocus
                 />
              </div>
           </div>

           <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 ml-1 uppercase tracking-wider">Password</label>
              <div className="relative group">
                 <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={18} />
                 <input 
                    name="password"
                    type="password" 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-medium text-slate-700"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                 />
              </div>
           </div>

           <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-white font-bold rounded-xl shadow-lg flex justify-center items-center gap-2 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
           >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <>เข้าสู่ระบบ <ArrowRight size={18} /></>}
           </button>

           <div className="text-center pt-4">
              <Link to="/" className="text-xs text-slate-400 hover:text-slate-600 transition font-medium flex items-center justify-center gap-1">
                 ← กลับไปหน้าแจ้งเหตุ
              </Link>
           </div>

        </form>
        
        <div className="bg-slate-50 p-3 text-center border-t border-slate-100">
           <p className="text-[10px] text-slate-400 font-semibold flex items-center justify-center gap-1">
              <ShieldCheck size={12} className="text-emerald-500"/> Secure System by Flood Rescue AI
           </p>
        </div>

      </div>
    </div>
  );
}