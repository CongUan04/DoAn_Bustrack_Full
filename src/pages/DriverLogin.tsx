/**
 * DriverLogin.tsx – Trang đăng nhập dành riêng cho Tài xế
 * Giao diện tối, mobile-first, tập trung vào đăng nhập nhanh
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Bus, Lock, User, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const DriverLogin: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [focused, setFocused] = useState<string | null>(null);

    React.useEffect(() => {
        const savedUsername = localStorage.getItem('bustrack_driver_remember_me');
        if (savedUsername) {
            setUsername(savedUsername);
            setRememberMe(true);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) { setError('Vui lòng nhập đầy đủ thông tin!'); return; }
        if (!username.includes('@')) { setError('Chỉ hỗ trợ đăng nhập bằng địa chỉ Email (VD: @gmail.com)!'); return; }
        setLoading(true); setError('');
        const result = await login(username, password);
        setLoading(false);
        if (result.success) {
            if (result.role !== 'driver') {
                setError('Tài khoản này không phải Tài xế. Vui lòng dùng cổng đăng nhập phù hợp.');
                return;
            }
            if (rememberMe) {
                localStorage.setItem('bustrack_driver_remember_me', username);
            } else {
                localStorage.removeItem('bustrack_driver_remember_me');
            }
            navigate('/driver');
        } else {
            setError(result.error || 'Đăng nhập thất bại');
        }
    };

    const inputStyle = (field: string): React.CSSProperties => ({
        width: '100%', height: 54, padding: '0 48px',
        background: focused === field ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)',
        border: `2px solid ${focused === field ? '#F59E0B' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 14, color: '#FFFFFF', fontSize: 15, outline: 'none',
        boxShadow: focused === field ? '0 0 0 4px rgba(245,158,11,0.15)' : 'none',
        transition: 'all 0.2s', fontFamily: 'inherit', letterSpacing: '0.2px',
    });

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(160deg, #0f172a 0%, #1c1917 50%, #0f172a 100%)',
            padding: '24px 16px', position: 'relative', overflow: 'hidden',
        }}>
            {/* Background effects */}
            <div style={{ position: 'absolute', inset: 0, opacity: 0.035, backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            <div style={{ position: 'absolute', top: '15%', left: '10%', width: 300, height: 300, background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)', borderRadius: '50%' }} />
            <div style={{ position: 'absolute', bottom: '10%', right: '8%', width: 250, height: 250, background: 'radial-gradient(circle, rgba(251,191,36,0.06) 0%, transparent 70%)', borderRadius: '50%' }} />

            <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
                {/* Back button */}
                <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    onClick={() => navigate('/login')}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 28,
                        fontSize: 13, color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                >
                    <ArrowLeft size={15} /> Quay lại
                </motion.button>

                <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        backdropFilter: 'blur(24px)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        borderRadius: 28, padding: '40px 36px',
                        boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
                    }}
                >
                    {/* Top bar accent */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #F59E0B, #FBBF24, #F59E0B)', borderRadius: '28px 28px 0 0' }} />

                    {/* Icon */}
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                        style={{
                            width: 80, height: 80, borderRadius: 22, margin: '0 auto 20px',
                            background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(251,191,36,0.15))',
                            border: '1px solid rgba(245,158,11,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38,
                            boxShadow: '0 8px 24px rgba(245,158,11,0.2)',
                        }}
                    >
                        <Bus size={45} className="text-amber-400" />
                    </motion.div>

                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>
                            Cổng Tài xế
                        </h1>
                        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                            Đăng nhập để bắt đầu ca làm việc
                        </p>
                    </div>

                    {/* Status chips */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 28, justifyContent: 'center' }}>
                        {['🔒 Bảo mật', '⚡ Nhanh chóng', '📡 Real-time'].map(t => (
                            <span key={t} style={{ fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', color: '#FCD34D', border: '1px solid rgba(245,158,11,0.2)' }}>{t}</span>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', display: 'block', marginBottom: 7, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Địa chỉ Email</label>
                            <div style={{ position: 'relative' }}>
                                <User size={17} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: focused === 'u' ? '#FBBF24' : 'rgba(255,255,255,0.25)', transition: 'color 0.2s' }} />
                                <input type="text" value={username}
                                    onChange={e => { setUsername(e.target.value); setError(''); }}
                                    onFocus={() => setFocused('u')} onBlur={() => setFocused(null)}
                                    placeholder="VD: taixe@gmail.com..."
                                    style={inputStyle('u')} />
                            </div>
                        </div>

                        <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', display: 'block', marginBottom: 7, letterSpacing: '0.3px', textTransform: 'uppercase' }}>Mật khẩu</label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={17} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: focused === 'p' ? '#FBBF24' : 'rgba(255,255,255,0.25)', transition: 'color 0.2s' }} />
                                <input type={showPassword ? 'text' : 'password'} value={password}
                                    onChange={e => { setPassword(e.target.value); setError(''); }}
                                    onFocus={() => setFocused('p')} onBlur={() => setFocused(null)}
                                    placeholder="Nhập mật khẩu..."
                                    style={{ ...inputStyle('p'), paddingRight: 48 }} />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                                </button>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: -4 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ cursor: 'pointer', accentColor: '#F59E0B', width: 14, height: 14 }} />
                                Ghi nhớ đăng nhập
                            </label>
                        </div>

                        <AnimatePresence>
                            {error && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, color: '#FCA5A5', fontSize: 13 }}>
                                    <AlertCircle size={15} /><span>{error}</span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <motion.button type="submit" disabled={loading}
                            whileHover={{ scale: loading ? 1 : 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            style={{
                                width: '100%', height: 54, borderRadius: 14, border: 'none',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                background: loading ? 'rgba(245,158,11,0.5)' : 'linear-gradient(135deg, #F59E0B, #D97706)',
                                color: 'white', fontSize: 16, fontWeight: 800,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                                boxShadow: loading ? 'none' : '0 8px 28px rgba(245,158,11,0.35)',
                                marginTop: 4, letterSpacing: '0.2px',
                            }}>
                            {loading
                                ? <><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span>Đang xác thực...</span></>
                                : <><Bus size={20} /><span>Bắt đầu ca làm việc</span></>
                            }
                        </motion.button>
                    </form>

                    <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
                            Liên hệ quản trị viên nếu bạn quên mật khẩu
                        </p>
                    </div>
                </motion.div>

                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
                    style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.18)', marginTop: 20 }}>
                    © 2026 BusTrack · Cổng Tài xế
                </motion.p>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default DriverLogin;
