import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, MapPin, Bus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LoginLanding: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    
    const clicksRef = useRef(0);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Auto-Redirect logic
    if (isAuthenticated) {
        const home = user?.role === 'admin' ? '/admin/dashboard' : user?.role === 'driver' ? '/driver' : '/parent';
        navigate(home, { replace: true });
        return null;
    }

    const handleHaptic = () => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(50);
        }
    };

    const handleAdminSecret = () => {
        clicksRef.current += 1;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        timeoutRef.current = setTimeout(() => {
            clicksRef.current = 0;
        }, 2000);

        if (clicksRef.current >= 3) {
            clicksRef.current = 0;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            navigate('/admin');
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-between p-6 relative overflow-hidden font-sans">
            
            {/* Background Texture & Glows */}
            <div 
                className="absolute inset-0 pointer-events-none opacity-[0.03]" 
                style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }} 
            />
            <div className="absolute top-0 left-0 w-72 h-72 bg-emerald-600/20 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-72 h-72 bg-amber-600/20 rounded-full blur-[100px] pointer-events-none" />

            {/* Phần 1: Khối Tiêu đề (Hero Header) */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7 }}
                className="relative z-10 w-full flex flex-col items-center text-center mt-8 sm:mt-16"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.4)]">
                        <MapPin size={24} className="text-white" />
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">BusTrack</h1>
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-emerald-300 mb-2">
                    Giám sát an toàn. Mọi lúc, mọi nơi.
                </h2>
                <p className="text-slate-400 text-sm sm:text-base font-light">
                    Vui lòng chọn vai trò của bạn để tiếp tục.
                </p>
            </motion.div>

            {/* Phần 2: Khối Chức năng lõi (The Role Cards) */}
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl my-auto py-8">
                
                {/* Thẻ 1: Phụ huynh */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    onClick={() => { handleHaptic(); navigate('/login/parent'); }}
                    className="group cursor-pointer p-8 sm:p-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl hover:-translate-y-2 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.3)] transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-bl-full blur-2xl -mr-10 -mt-10 pointer-events-none transition-opacity duration-300 group-hover:opacity-100 opacity-0" />
                    <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-emerald-500/20">
                        <Users size={32} className="text-emerald-400" />
                    </div>
                    <h3 className="text-3xl text-white font-bold tracking-wide mb-3">Phụ huynh</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Giám sát lộ trình, xem điểm danh và báo nghỉ trực tuyến.
                    </p>
                </motion.div>

                {/* Thẻ 2: Tài xế */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    onClick={() => { handleHaptic(); navigate('/login/driver'); }}
                    className="group cursor-pointer p-8 sm:p-10 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl hover:-translate-y-2 hover:border-amber-500/50 hover:bg-amber-500/10 hover:shadow-[0_0_40px_-10px_rgba(245,158,11,0.3)] transition-all duration-300 flex flex-col items-center text-center relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/20 rounded-bl-full blur-2xl -mr-10 -mt-10 pointer-events-none transition-opacity duration-300 group-hover:opacity-100 opacity-0" />
                    <div className="w-20 h-20 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 border border-amber-500/20">
                        <Bus size={40} className="text-amber-400" />
                    </div>
                    <h3 className="text-3xl text-white font-bold tracking-wide mb-3">Tài xế</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                        Kích hoạt chuyến đi và quản lý danh sách học sinh trên xe.
                    </p>
                </motion.div>

            </div>

            {/* Phần 3: Chân trang (Footer & Hidden Security) */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="relative z-10 text-slate-500 text-xs sm:text-sm text-center mb-4"
            >
                <p className="mb-2">© 2026 BusTrack System</p>
                <button 
                    onClick={handleAdminSecret}
                    className="bg-transparent border-none p-0 cursor-default hover:text-slate-400 focus:outline-none transition-colors"
                    style={{ WebkitTapHighlightColor: 'transparent', userSelect: 'none' }}
                >
                    Phiên bản 2.0
                </button>
            </motion.div>
            
        </div>
    );
};

export default LoginLanding;
