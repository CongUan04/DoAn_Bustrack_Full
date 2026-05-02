/**
 * ParentLogin.tsx – Trang đăng nhập dành riêng cho Phụ huynh
 * Giao diện thân thiện, màu xanh lá, đăng nhập bằng số điện thoại
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Users, Lock, Phone, AlertCircle, Loader2, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';

const ParentLogin: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) { setError('Vui lòng nhập đầy đủ thông tin!'); return; }
        setLoading(true); setError('');
        const result = await login(username, password);
        setLoading(false);
        if (result.success) {
            if (result.role !== 'parent') {
                setError('Tài khoản này không phải Phụ huynh. Vui lòng dùng cổng đăng nhập phù hợp.');
                return;
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
        width: '100%', height: 50, padding: '0 44px',
        background: focused === field ? '#fff' : '#f8fafc',
        border: `2px solid ${focused === field ? '#10B981' : '#e2e8f0'}`,
        borderRadius: 12, color: '#0f172a', fontSize: 14.5, outline: 'none',
        boxShadow: focused === field ? '0 0 0 4px rgba(16,185,129,0.1)' : 'none',
        transition: 'all 0.2s', fontFamily: 'inherit',
    });

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', background: '#f8fafc', position: 'relative', overflow: 'hidden',
        }}>
            {/* Left: Login Form */}
            <div style={{
                width: 500, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '40px 56px',
                background: 'white',
                boxShadow: '4px 0 40px rgba(0,0,0,0.06)',
                position: 'relative', zIndex: 1,
            }}>
                <motion.div
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    style={{ width: '100%' }}
                >
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
                        <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#10B981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' }}>
                            <Users size={22} color="white" />
                        </div>
                        <div>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#0f172a' }}>BusTrack</p>
                            <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Cổng dành cho Phụ huynh</p>
                        </div>
                    </div>

                    <AnimatePresence mode="wait">
                        {fpFlow === 'none' ? (
                            <motion.div key="login" initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }} transition={{ duration: 0.3 }}>
                                <div style={{ marginBottom: 28 }}>
                                    <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: '#0f172a' }}>Chào bạn! 👋</h1>
                                    <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Đăng nhập bằng số điện thoại hoặc email đã đăng ký</p>
                                </div>

                                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div>
                                        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 7 }}>Số điện thoại / Email</label>
                                        <div style={{ position: 'relative' }}>
                                            <Phone size={16} style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: focused === 'u' ? '#10B981' : '#94a3b8', transition: 'color 0.2s' }} />
                                            <input type="text" value={username} onChange={e => { setUsername(e.target.value); setError(''); }}
                                                onFocus={() => setFocused('u')} onBlur={() => setFocused(null)}
                                                placeholder="VD: 0901234567 hoặc email..."
                                                style={inputStyle('u')} />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 7 }}>Mật khẩu</label>
                                        <div style={{ position: 'relative' }}>
                                            <Lock size={16} style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: focused === 'p' ? '#10B981' : '#94a3b8', transition: 'color 0.2s' }} />
                                            <input type={showPassword ? 'text' : 'password'} value={password}
                                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                                onFocus={() => setFocused('p')} onBlur={() => setFocused(null)}
                                                placeholder="Nhập mật khẩu..."
                                                style={{ ...inputStyle('p'), paddingRight: 44 }} />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {error && (
                                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#DC2626', fontSize: 13 }}>
                                                <AlertCircle size={15} /><span>{error}</span>
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
                                            marginTop: 4,
                                        }}>
                                        {loading ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /><span>Đang đăng nhập...</span></> : <span>👨‍👩‍👧 Đăng nhập</span>}
                                    </motion.button>

                                    <div style={{ textAlign: 'center' }}>
                                        <button type="button" onClick={() => { setFpFlow('identify'); setFpError(''); setFpSuccess(''); }}
                                            style={{ fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
                                            onMouseEnter={e => (e.currentTarget.style.color = '#10B981')}
                                            onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}>
                                            Quên mật khẩu?
                                        </button>
                                    </div>
                                </form>

                                <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                                    <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 10 }}>Chưa có tài khoản? Liên hệ nhà trường để được cấp tài khoản</p>
                                    <button onClick={() => navigate('/login')}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#10B981')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}>
                                        <ArrowLeft size={13} /> Quay lại trang chọn vai trò
                                    </button>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div key="fp" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 15 }} transition={{ duration: 0.3 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                                    <button onClick={() => setFpFlow('none')}
                                        style={{ width: 36, height: 36, borderRadius: 10, background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <ArrowLeft size={16} />
                                    </button>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Khôi phục mật khẩu</h2>
                                        <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                                            {fpFlow === 'identify' && 'Nhập SĐT hoặc email để nhận OTP'}
                                            {fpFlow === 'otp' && 'Nhập mã xác nhận đã gửi về điện thoại/email'}
                                            {fpFlow === 'reset' && 'Tạo mật khẩu mới cho tài khoản'}
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {fpFlow === 'identify' && (
                                        <form onSubmit={handleIdentify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                            <div>
                                                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 7 }}>SĐT hoặc Email</label>
                                                <div style={{ position: 'relative' }}>
                                                    <Phone size={16} style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                    <input type="text" value={fpIdentity} onChange={e => setFpIdentity(e.target.value)} placeholder="VD: 09012..." style={inputStyle('fpi')} onFocus={() => setFocused('fpi')} onBlur={() => setFocused(null)} />
                                                </div>
                                            </div>
                                            <button type="submit" disabled={fpLoading} style={{ height: 48, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                {fpLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <><Send size={15} /> Gửi mã OTP</>}
                                            </button>
                                        </form>
                                    )}
                                    {fpFlow === 'otp' && (
                                        <form onSubmit={handleOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                            <div>
                                                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 7 }}>Mã OTP</label>
                                                <div style={{ position: 'relative' }}>
                                                    <Lock size={16} style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                    <input type="text" value={fpOtp} onChange={e => setFpOtp(e.target.value)} placeholder="Nhập mã 6 số..." style={inputStyle('otp')} onFocus={() => setFocused('otp')} onBlur={() => setFocused(null)} />
                                                </div>
                                            </div>
                                            <button type="submit" disabled={fpLoading} style={{ height: 48, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                {fpLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Xác nhận OTP'}
                                            </button>
                                        </form>
                                    )}
                                    {fpFlow === 'reset' && (
                                        <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                            <div>
                                                <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 7 }}>Mật khẩu mới</label>
                                                <div style={{ position: 'relative' }}>
                                                    <Lock size={16} style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                                    <input type={showPassword ? 'text' : 'password'} value={fpNewPassword} onChange={e => setFpNewPassword(e.target.value)} placeholder="Ít nhất 6 ký tự..." style={{ ...inputStyle('np'), paddingRight: 44 }} onFocus={() => setFocused('np')} onBlur={() => setFocused(null)} />
                                                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                </div>
                                            </div>
                                            <button type="submit" disabled={fpLoading} style={{ height: 48, borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                                {fpLoading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : 'Đặt lại mật khẩu'}
                                            </button>
                                        </form>
                                    )}

                                    <AnimatePresence>
                                        {fpError && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#DC2626', fontSize: 13 }}><AlertCircle size={15} /><span>{fpError}</span></motion.div>}
                                        {fpSuccess && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, color: '#059669', fontSize: 13 }}><CheckCircle2 size={15} /><span>{fpSuccess}</span></motion.div>}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>

            {/* Right: Decorative panel */}
            <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px',
                background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 100%)',
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', inset: 0, opacity: 0.07, backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />
                <div style={{ position: 'absolute', top: '20%', right: '15%', width: 280, height: 280, background: 'radial-gradient(circle, rgba(52,211,153,0.2) 0%, transparent 70%)', borderRadius: '50%' }} />
                <div style={{ position: 'absolute', bottom: '20%', left: '10%', width: 200, height: 200, background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)', borderRadius: '50%' }} />

                <motion.div
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    style={{ position: 'relative', zIndex: 1, maxWidth: 400, textAlign: 'center' }}
                >
                    <div style={{ fontSize: 72, marginBottom: 24 }}>👨‍👩‍👧</div>
                    <h2 style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 800, color: 'white' }}>
                        Theo dõi con yêu<br />mọi lúc, mọi nơi
                    </h2>
                    <p style={{ margin: '0 0 36px', fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>
                        Biết ngay khi con lên xe, xuống xe.<br />Xem lộ trình xe trực tiếp trên bản đồ.
                    </p>

                    {[
                        { icon: '📍', text: 'Theo dõi vị trí xe real-time trên bản đồ' },
                        { icon: '🔔', text: 'Thông báo ngay khi con lên/xuống xe' },
                        { icon: '📋', text: 'Xem lịch sử điểm danh theo ngày' },
                        { icon: '📞', text: 'Liên hệ trực tiếp tài xế khi cần' },
                    ].map((f, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.1 }}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(255,255,255,0.07)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', marginBottom: 8, textAlign: 'left' }}>
                            <span style={{ fontSize: 20 }}>{f.icon}</span>
                            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{f.text}</span>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

export default ParentLogin;
