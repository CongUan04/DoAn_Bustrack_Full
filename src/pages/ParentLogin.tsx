import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Users, Lock, AlertCircle, Loader2, ArrowLeft, Send, CheckCircle2, MapPin, Bell, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 900);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 900);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    return isMobile;
};

const ParentLogin: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const isMobile = useIsMobile();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [focused, setFocused] = useState<string | null>(null);

    const [fpFlow, setFpFlow] = useState<'none' | 'identify' | 'otp' | 'reset'>('none');
    const [fpIdentity, setFpIdentity] = useState('');
    const [fpOtp, setFpOtp] = useState('');
    const [fpNewPassword, setFpNewPassword] = useState('');
    const [fpLoading, setFpLoading] = useState(false);
    const [fpError, setFpError] = useState('');
    const [fpSuccess, setFpSuccess] = useState('');

    useEffect(() => {
        const savedUsername = localStorage.getItem('bustrack_parent_remember_me');
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
            if (result.role !== 'parent') {
                setError('Tài khoản này không phải Phụ huynh. Vui lòng dùng cổng đăng nhập phù hợp.');
                return;
            }
            if (rememberMe) {
                localStorage.setItem('bustrack_parent_remember_me', username);
            } else {
                localStorage.removeItem('bustrack_parent_remember_me');
            }
            navigate('/parent');
        } else {
            setError(result.error || 'Đăng nhập thất bại');
        }
    };

    const handleIdentify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fpIdentity) return setFpError('Vui lòng nhập email hoặc số điện thoại.');
        setFpLoading(true); setFpError('');
        try { const res = await authAPI.forgotPassword(fpIdentity); setFpSuccess(res.data.message); setFpFlow('otp'); }
        catch (err: any) { setFpError(err.response?.data?.message || 'Có lỗi xảy ra.'); }
        finally { setFpLoading(false); }
    };

    const handleOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fpOtp) return setFpError('Vui lòng nhập mã OTP.');
        setFpLoading(true); setFpError('');
        try { const res = await authAPI.verifyOtp(fpIdentity, fpOtp); setFpSuccess(res.data.message); setFpFlow('reset'); }
        catch (err: any) { setFpError(err.response?.data?.message || 'Mã OTP không hợp lệ.'); }
        finally { setFpLoading(false); }
    };

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (fpNewPassword.length < 6) return setFpError('Mật khẩu phải từ 6 ký tự.');
        setFpLoading(true); setFpError('');
        try {
            const res = await authAPI.resetPassword(fpIdentity, fpOtp, fpNewPassword);
            setFpSuccess(res.data.message);
            setTimeout(() => { setFpFlow('none'); setFpIdentity(''); setFpOtp(''); setFpNewPassword(''); setFpSuccess(''); }, 3000);
        }
        catch (err: any) { setFpError(err.response?.data?.message || 'Thất bại.'); }
        finally { setFpLoading(false); }
    };

    const inputStyle = (field: string): React.CSSProperties => ({
        width: '100%', height: 52, padding: '0 44px',
        background: focused === field ? '#ffffff' : '#f8fafc',
        border: `2px solid ${focused === field ? '#10B981' : '#e2e8f0'}`,
        borderRadius: 14, color: '#0f172a', fontSize: 14.5, outline: 'none',
        boxShadow: focused === field ? '0 0 0 4px rgba(16,185,129,0.1)' : 'none',
        transition: 'all 0.2s ease', fontFamily: 'inherit',
    });

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #022c22 0%, #064e3b 40%, #047857 100%)',
            position: 'relative',
            overflow: 'hidden',
            padding: isMobile ? '20px' : '40px'
        }}>
            {/* Animated Background Bubbles */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(40px)', animation: 'float 10s ease-in-out infinite' }} />
                <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.2) 0%, transparent 70%)', borderRadius: '50%', filter: 'blur(50px)', animation: 'float 12s ease-in-out infinite reverse' }} />
                <div style={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
            </div>

            {/* Main Glassmorphism Card */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                style={{
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    width: '100%',
                    maxWidth: 1000,
                    background: 'rgba(255, 255, 255, 0.03)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    borderRadius: 24,
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 30px 60px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
                    overflow: 'hidden',
                    zIndex: 10
                }}
            >
                {/* Left/Top: Decorative Info Panel */}
                <div style={{
                    flex: 1,
                    padding: isMobile ? '32px 24px' : '48px',
                    background: 'linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 100%)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    borderRight: isMobile ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    borderBottom: isMobile ? '1px solid rgba(255,255,255,0.1)' : 'none',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                        <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg,#34D399,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px rgba(16,185,129,0.4)' }}>
                            <Users size={24} color="white" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>BusTrack</h2>
                            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Dành cho Phụ huynh</p>
                        </div>
                    </div>

                    <h1 style={{ margin: '0 0 16px', fontSize: isMobile ? 28 : 36, fontWeight: 800, color: 'white', lineHeight: 1.2 }}>
                        Đồng hành cùng<br />hành trình của con
                    </h1>
                    <p style={{ margin: '0 0 36px', fontSize: 15, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
                        Trải nghiệm sự an tâm tuyệt đối với hệ thống giám sát và thông báo thông minh từ BusTrack.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {[
                            { icon: <MapPin size={20} />, title: 'Định vị thời gian thực', desc: 'Theo dõi chính xác vị trí xe bus' },
                            { icon: <Bell size={20} />, title: 'Thông báo tức thì', desc: 'Nhận cảnh báo khi con lên/xuống xe' },
                            { icon: <ShieldCheck size={20} />, title: 'An tâm tuyệt đối', desc: 'Kết nối trực tiếp với nhà trường & tài xế' },
                        ].map((feature, idx) => (
                            <motion.div key={idx} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + idx * 0.1 }}
                                style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34D399', flexShrink: 0 }}>
                                    {feature.icon}
                                </div>
                                <div>
                                    <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'white' }}>{feature.title}</h4>
                                    <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{feature.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Right/Bottom: Form Panel */}
                <div style={{
                    width: isMobile ? '100%' : 480,
                    flexShrink: 0,
                    padding: isMobile ? '32px 24px' : '48px',
                    background: '#ffffff',
                    position: 'relative'
                }}>
                    <AnimatePresence mode="wait">
                        {fpFlow === 'none' ? (
                            <motion.div key="login" initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.3 }}>
                                <div style={{ marginBottom: 32 }}>
                                    <h2 style={{ margin: '0 0 8px', fontSize: 26, fontWeight: 800, color: '#0f172a' }}>Chào mừng trở lại! 👋</h2>
                                    <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Đăng nhập bằng Gmail để tiếp tục</p>
                                </div>

                                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                    <div>
                                        <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8 }}>Địa chỉ Email</label>
                                        <div style={{ position: 'relative' }}>
                                            <Users size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: focused === 'u' ? '#10B981' : '#94a3b8', transition: 'color 0.2s' }} />
                                            <input type="text" value={username} onChange={e => { setUsername(e.target.value); setError(''); }}
                                                onFocus={() => setFocused('u')} onBlur={() => setFocused(null)}
                                                placeholder="VD: abc@gmail.com..." style={inputStyle('u')} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8 }}>Mật khẩu</label>
                                        <div style={{ position: 'relative' }}>
                                            <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: focused === 'p' ? '#10B981' : '#94a3b8', transition: 'color 0.2s' }} />
                                            <input type={showPassword ? 'text' : 'password'} value={password}
                                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                                onFocus={() => setFocused('p')} onBlur={() => setFocused(null)}
                                                placeholder="Nhập mật khẩu..." style={{ ...inputStyle('p'), paddingRight: 44 }} />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -6 }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                                            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} style={{ cursor: 'pointer', accentColor: '#10B981', width: 16, height: 16, borderRadius: 4 }} />
                                            Ghi nhớ đăng nhập
                                        </label>
                                        <button type="button" onClick={() => { setFpFlow('identify'); setFpError(''); setFpSuccess(''); }}
                                            style={{ fontSize: 13, fontWeight: 600, color: '#10B981', background: 'none', border: 'none', cursor: 'pointer' }}
                                            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                                            Quên mật khẩu?
                                        </button>
                                    </div>

                                    <AnimatePresence>
                                        {error && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'var(--danger-light)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12, color: 'var(--danger)', fontSize: 13, fontWeight: 500 }}>
                                                <AlertCircle size={16} style={{ flexShrink: 0 }} /><span>{error}</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                        style={{
                                            width: '100%', height: 52, borderRadius: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                                            background: 'linear-gradient(135deg, #10B981, #059669)',
                                            color: 'white', fontSize: 15, fontWeight: 700,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                            boxShadow: '0 8px 20px rgba(16,185,129,0.35)', opacity: loading ? 0.75 : 1,
                                            marginTop: 8,
                                        }}>
                                        {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /><span>Đang đăng nhập...</span></> : <span>Đăng nhập</span>}
                                    </motion.button>
                                </form>

                                <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                                    <button onClick={() => navigate('/')}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s' }}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#0f172a')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}>
                                        <ArrowLeft size={14} /> Trở về trang chủ
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key="fp" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 15 }} transition={{ duration: 0.3 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                                    <button onClick={() => setFpFlow('none')}
                                        style={{ width: 38, height: 38, borderRadius: 12, background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#0f172a'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#64748b'; }}>
                                        <ArrowLeft size={18} />
                                    </button>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Khôi phục mật khẩu</h2>
                                        <p style={{ margin: '2px 0 0', fontSize: 13, color: '#64748b' }}>
                                            {fpFlow === 'identify' && 'Nhập Email (để nhận qua Gmail) hoặc SĐT (để nhận qua Telegram)'}
                                            {fpFlow === 'otp' && 'Nhập mã 6 số được gửi đến Email/Telegram'}
                                            {fpFlow === 'reset' && 'Tạo mật khẩu mới cho tài khoản'}
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    {fpFlow === 'identify' && (
                                        <form onSubmit={handleIdentify} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            <div>
                                                <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8 }}>Email hoặc Số điện thoại</label>
                                                <div style={{ position: 'relative' }}>
                                                    <Users size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: focused === 'fpi' ? '#10B981' : '#94a3b8' }} />
                                                    <input type="text" value={fpIdentity} onChange={e => setFpIdentity(e.target.value)} placeholder="Nhập Email hoặc SĐT..." style={inputStyle('fpi')} onFocus={() => setFocused('fpi')} onBlur={() => setFocused(null)} />
                                                </div>
                                            </div>
                                            <button type="submit" disabled={fpLoading} style={{ height: 52, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, boxShadow: '0 8px 20px rgba(16,185,129,0.35)' }}>
                                                {fpLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Send size={16} /> Gửi mã OTP</>}
                                            </button>
                                        </form>
                                    )}
                                    {fpFlow === 'otp' && (
                                        <form onSubmit={handleOtp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            <div>
                                                <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8 }}>Mã xác nhận (OTP)</label>
                                                <div style={{ position: 'relative' }}>
                                                    <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: focused === 'otp' ? '#10B981' : '#94a3b8' }} />
                                                    <input type="text" value={fpOtp} onChange={e => setFpOtp(e.target.value)} placeholder="Nhập mã 6 số..." style={inputStyle('otp')} onFocus={() => setFocused('otp')} onBlur={() => setFocused(null)} />
                                                </div>
                                            </div>
                                            <button type="submit" disabled={fpLoading} style={{ height: 52, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, boxShadow: '0 8px 20px rgba(16,185,129,0.35)' }}>
                                                {fpLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Xác nhận OTP'}
                                            </button>
                                        </form>
                                    )}
                                    {fpFlow === 'reset' && (
                                        <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                            <div>
                                                <label style={{ fontSize: 13, fontWeight: 700, color: '#334155', display: 'block', marginBottom: 8 }}>Mật khẩu mới</label>
                                                <div style={{ position: 'relative' }}>
                                                    <Lock size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: focused === 'np' ? '#10B981' : '#94a3b8' }} />
                                                    <input type={showPassword ? 'text' : 'password'} value={fpNewPassword} onChange={e => setFpNewPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự..." style={{ ...inputStyle('np'), paddingRight: 44 }} onFocus={() => setFocused('np')} onBlur={() => setFocused(null)} />
                                                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                            </div>
                                            <button type="submit" disabled={fpLoading} style={{ height: 52, borderRadius: 14, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, boxShadow: '0 8px 20px rgba(16,185,129,0.35)' }}>
                                                {fpLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Lưu mật khẩu mới'}
                                            </button>
                                        </form>
                                    )}

                                    <AnimatePresence>
                                        {fpError && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'var(--danger-light)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 12, color: 'var(--danger)', fontSize: 13, fontWeight: 500 }}><AlertCircle size={16} style={{ flexShrink: 0 }} /><span>{fpError}</span></motion.div>}
                                        {fpSuccess && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'var(--success-light)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 12, color: 'var(--success)', fontSize: 13, fontWeight: 500 }}><CheckCircle2 size={16} style={{ flexShrink: 0 }} /><span>{fpSuccess}</span></motion.div>}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            <style>{`
                @keyframes float {
                    0% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-20px) rotate(5deg); }
                    100% { transform: translateY(0px) rotate(0deg); }
                }
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

export default ParentLogin;
