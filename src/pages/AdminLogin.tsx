/**
 * AdminLogin.tsx – Trang đăng nhập dành riêng cho Quản trị viên
 * Giao diện chuyên nghiệp, màu xanh navy, tập trung vào bảo mật
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Shield, Lock, User, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AdminLogin: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [focused, setFocused] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) { setError('Vui lòng nhập đầy đủ thông tin!'); return; }
        setLoading(true); setError('');
        const result = await login(username, password);
        setLoading(false);
        if (result.success) {
            if (result.role !== 'admin') {
                setError('Tài khoản này không có quyền Admin. Vui lòng dùng cổng đăng nhập phù hợp.');
                return;
            }
            navigate('/admin/dashboard');
        } else {
            setError(result.error || 'Đăng nhập thất bại');
        }
    };

    const inputStyle = (field: string): React.CSSProperties => ({
        width: '100%', height: 50, padding: '0 44px',
        background: 'rgba(255,255,255,0.06)',
        border: `1.5px solid ${focused === field ? 'rgba(147,197,253,0.6)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 12, color: '#FFFFFF', fontSize: 14.5, outline: 'none',
        boxShadow: focused === field ? '0 0 0 3px rgba(59,130,246,0.2)' : 'none',
        transition: 'all 0.2s',
        fontFamily: 'inherit',
    });

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
        }}>
            {/* Left decorative panel */}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', padding: '40px',
                position: 'relative',
            }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                <div style={{ position: 'absolute', top: '30%', left: '20%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '25%', right: '25%', width: 200, height: 200, background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', borderRadius: '50%' }} />

                <motion.div
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    style={{ position: 'relative', zIndex: 1, maxWidth: 420, textAlign: 'center' }}
                >
                    <div style={{
                        width: 90, height: 90, borderRadius: 24, margin: '0 auto 28px',
                        background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 12px 40px rgba(59,130,246,0.35)',
                    }}>
                        <Shield size={44} color="white" />
                    </div>
                    <h2 style={{ margin: '0 0 12px', fontSize: 32, fontWeight: 800, color: 'white' }}>
                        Cổng Quản trị
                    </h2>
                    <p style={{ margin: '0 0 40px', fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7 }}>
                        Khu vực dành riêng cho quản trị viên hệ thống. Chỉ tài khoản có quyền Admin mới được phép truy cập.
                    </p>

                    {/* Feature list */}
                    {[
                        { icon: '📊', text: 'Tổng quan & Báo cáo thời gian thực' },
                        { icon: '🗺️', text: 'Theo dõi toàn bộ xe trên bản đồ' },
                        { icon: '👥', text: 'Quản lý học sinh, tài xế, phụ huynh' },
                        { icon: '🔔', text: 'Cảnh báo & Xử lý sự cố tức thì' },
                    ].map((f, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.4 + i * 0.1 }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                                background: 'rgba(255,255,255,0.04)', borderRadius: 10,
                                border: '1px solid rgba(255,255,255,0.07)',
                                marginBottom: 8, textAlign: 'left',
                            }}
                        >
                            <span style={{ fontSize: 18 }}>{f.icon}</span>
                            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{f.text}</span>
                        </motion.div>
                    ))}

                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.9 }}
                        onClick={() => navigate('/')}
                        style={{
                            marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 6,
                            fontSize: 13, color: 'rgba(255,255,255,0.4)',
                            background: 'none', border: 'none', cursor: 'pointer',
                        }}
                        whileHover={{ color: 'rgba(255,255,255,0.75)' }}
                    >
                        <ArrowLeft size={14} /> Quay lại trang chọn vai trò
                    </motion.button>
                </motion.div>
            </div>

            {/* Right login form */}
            <div style={{
                width: 480, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '40px 48px',
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(20px)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
            }}>
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    style={{ width: '100%' }}
                >
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 36 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg,#3B82F6,#60A5FA)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(59,130,246,0.4)' }}>
                            <Shield size={20} color="white" />
                        </div>
                        <div>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: 'white' }}>BusTrack Admin</p>
                            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Cổng Quản trị Hệ thống</p>
                        </div>
                    </div>

                                <h2 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 700, color: 'white' }}>Đăng nhập</h2>
                                <p style={{ margin: '0 0 28px', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Nhập thông tin tài khoản Admin của bạn</p>

                                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div>
                                        <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 6 }}>Tên đăng nhập</label>
                                        <div style={{ position: 'relative' }}>
                                            <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: focused === 'u' ? '#93C5FD' : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }} />
                                            <input type="text" value={username} onChange={e => { setUsername(e.target.value); setError(''); }}
                                                onFocus={() => setFocused('u')} onBlur={() => setFocused(null)}
                                                placeholder="Nhập tên đăng nhập hoặc email..."
                                                style={inputStyle('u')} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: 6 }}>Mật khẩu</label>
                                        <div style={{ position: 'relative' }}>
                                            <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: focused === 'p' ? '#93C5FD' : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }} />
                                            <input type={showPassword ? 'text' : 'password'} value={password}
                                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                                onFocus={() => setFocused('p')} onBlur={() => setFocused(null)}
                                                placeholder="Nhập mật khẩu..."
                                                style={{ ...inputStyle('p'), paddingRight: 44 }} />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {error && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, color: '#FCA5A5', fontSize: 13 }}>
                                                <AlertCircle size={15} /><span>{error}</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                        style={{
                                            width: '100%', height: 50, borderRadius: 12, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                                            background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)',
                                            color: 'white', fontSize: 15, fontWeight: 700,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                            boxShadow: '0 8px 20px rgba(59,130,246,0.4)', opacity: loading ? 0.75 : 1,
                                            marginTop: 4,
                                        }}>
                                        {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /><span>Đang xác thực...</span></> : <span>🛡️ Đăng nhập Admin</span>}
                                    </motion.button>
                                </form>


                    <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
                            🔐 Kết nối được mã hóa SSL · BusTrack v2.0
                        </p>
                    </div>
                </motion.div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default AdminLogin;
