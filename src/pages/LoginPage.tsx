import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Bus, Lock, User, AlertCircle, Loader2, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    // ── Login State ──────────────
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [focusedField, setFocusedField] = useState<string | null>(null);

    // ── Forgot Password State ────
    const [fpFlow, setFpFlow] = useState<'none' | 'identify' | 'otp' | 'reset'>('none');
    const [fpIdentity, setFpIdentity] = useState(''); // Email or Phone
    const [fpOtp, setFpOtp] = useState('');
    const [fpNewPassword, setFpNewPassword] = useState('');
    const [fpLoading, setFpLoading] = useState(false);
    const [fpError, setFpError] = useState('');
    const [fpSuccess, setFpSuccess] = useState('');

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) {
            setError('Vui lòng nhập đầy đủ thông tin!');
            return;
        }
        setLoading(true);
        setError('');

        const result = await login(username, password);
        setLoading(false);

        if (result.success) {
            if (result.role === 'admin') {
                navigate('/dashboard');
            } else {
                navigate('/map');
            }
        } else {
            setError(result.error || 'Đăng nhập thất bại');
        }
    };

    // ── Forgot Password Handlers ──
    const handleIdentifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fpIdentity) return setFpError('Vui lòng nhập email hoặc số điện thoại.');
        setFpLoading(true);
        setFpError('');
        try {
            const res = await authAPI.forgotPassword(fpIdentity);
            setFpSuccess(res.data.message);
            setFpFlow('otp');
            setFpError('');
        } catch (err: any) {
            setFpError(err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại.');
            setFpSuccess('');
        } finally {
            setFpLoading(false);
        }
    };

    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fpOtp) return setFpError('Vui lòng nhập mã OTP.');
        setFpLoading(true);
        setFpError('');
        try {
            const res = await authAPI.verifyOtp(fpIdentity, fpOtp);
            setFpSuccess(res.data.message);
            setFpFlow('reset');
            setFpError('');
        } catch (err: any) {
            setFpError(err.response?.data?.message || 'Mã OTP không hợp lệ.');
            setFpSuccess('');
        } finally {
            setFpLoading(false);
        }
    };

    const handleResetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (fpNewPassword.length < 6) return setFpError('Mật khẩu phải từ 6 ký tự.');
        setFpLoading(true);
        setFpError('');
        try {
            const res = await authAPI.resetPassword(fpIdentity, fpOtp, fpNewPassword);
            setFpSuccess(res.data.message);
            setFpError('');
            // Reset state and go back to login after short delay
            setTimeout(() => {
                setFpFlow('none');
                setFpIdentity('');
                setFpOtp('');
                setFpNewPassword('');
                setFpSuccess('');
            }, 3000);
        } catch (err: any) {
            setFpError(err.response?.data?.message || 'Đổi mật khẩu thất bại.');
            setFpSuccess('');
        } finally {
            setFpLoading(false);
        }
    };

    return (
        <div className="login-bg">
            <div className="bg-bubbles">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className={`bubble bubble-${i + 1}`} />
                ))}
            </div>
            <div className="login-overlay" />
            <div className="login-grid" />

            <div className="login-container">
                <motion.div
                    className="login-card"
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    <motion.div
                        className="login-brand"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2, duration: 0.5 }}
                    >
                        <div className="brand-icon">
                            <Bus size={32} strokeWidth={2} />
                        </div>
                        <div className="brand-text">
                            <h1 className="brand-name">BusTrack</h1>
                            <p className="brand-tagline">Hệ thống Theo dõi Xe Đưa đón Học sinh</p>
                        </div>
                    </motion.div>

                    <div className="login-divider" />

                    <AnimatePresence mode="wait">
                        {fpFlow === 'none' ? (
                            <motion.div
                                key="login-form"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="login-welcome">
                                    <h2>Chào mừng trở lại 👋</h2>
                                    <p>Đăng nhập để tiếp tục quản lý</p>
                                </div>

                                <form onSubmit={handleLoginSubmit} className="login-form">
                                    <div className={`input-group ${focusedField === 'username' ? 'focused' : ''} ${username ? 'has-value' : ''}`}>
                                        <label htmlFor="username" className="input-label">Tên đăng nhập / Email</label>
                                        <div className="input-wrapper">
                                            <User className="input-icon" size={18} />
                                            <input
                                                id="username"
                                                type="text"
                                                className="form-input"
                                                placeholder="Nhập tên đăng nhập hoặc email..."
                                                value={username}
                                                onChange={e => { setUsername(e.target.value); setError(''); }}
                                                onFocus={() => setFocusedField('username')}
                                                onBlur={() => setFocusedField(null)}
                                            />
                                        </div>
                                    </div>

                                    <div className={`input-group ${focusedField === 'password' ? 'focused' : ''} ${password ? 'has-value' : ''}`}>
                                        <label htmlFor="password" className="input-label">Mật khẩu</label>
                                        <div className="input-wrapper">
                                            <Lock className="input-icon" size={18} />
                                            <input
                                                id="password"
                                                type={showPassword ? 'text' : 'password'}
                                                className="form-input"
                                                placeholder="Nhập mật khẩu..."
                                                value={password}
                                                onChange={e => { setPassword(e.target.value); setError(''); }}
                                                onFocus={() => setFocusedField('password')}
                                                onBlur={() => setFocusedField(null)}
                                            />
                                            <button
                                                type="button"
                                                className="password-toggle"
                                                onClick={() => setShowPassword(!showPassword)}
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {error && (
                                            <motion.div
                                                className="error-message"
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                            >
                                                <AlertCircle size={16} /><span>{error}</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <button
                                        type="submit"
                                        className="login-btn"
                                        disabled={loading}
                                    >
                                        {loading ? <><Loader2 size={20} className="spin" /><span>Đang đăng nhập...</span></> : <span>Đăng nhập</span>}
                                    </button>

                                    <div className="forgot-password">
                                        <a href="#" onClick={(e) => { e.preventDefault(); setFpFlow('identify'); setFpError(''); setFpSuccess(''); }}>
                                            Quên mật khẩu?
                                        </a>
                                    </div>
                                </form>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="fp-form"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="fp-header">
                                    <button className="back-btn" onClick={() => setFpFlow('none')}>
                                        <ArrowLeft size={20} />
                                    </button>
                                    <div className="fp-title">
                                        <h2>Khôi phục mật khẩu</h2>
                                        <p>
                                            {fpFlow === 'identify' && 'Nhập email hoặc số điện thoại của bạn'}
                                            {fpFlow === 'otp' && 'Nhập mã xác nhận (OTP) đã gửi'}
                                            {fpFlow === 'reset' && 'Tạo mật khẩu mới cho tài khoản'}
                                        </p>
                                    </div>
                                </div>

                                <div className="login-form">
                                    {fpFlow === 'identify' && (
                                        <form onSubmit={handleIdentifySubmit}>
                                            <div className={`input-group ${focusedField === 'fpIdentity' ? 'focused' : ''} ${fpIdentity ? 'has-value' : ''}`}>
                                                <label className="input-label">Email hoặc Số điện thoại</label>
                                                <div className="input-wrapper">
                                                    <User className="input-icon" size={18} />
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="VD: parent@gmail.com hoặc 09..."
                                                        value={fpIdentity}
                                                        onChange={e => setFpIdentity(e.target.value)}
                                                        onFocus={() => setFocusedField('fpIdentity')}
                                                        onBlur={() => setFocusedField(null)}
                                                    />
                                                </div>
                                            </div>
                                            <button type="submit" className="login-btn" disabled={fpLoading}>
                                                {fpLoading ? <Loader2 size={20} className="spin" /> : <><Send size={18} className="send-icon" /><span>Gửi</span></>}
                                            </button>
                                        </form>
                                    )}

                                    {fpFlow === 'otp' && (
                                        <form onSubmit={handleOtpSubmit}>
                                            <div className={`input-group ${focusedField === 'fpOtp' ? 'focused' : ''} ${fpOtp ? 'has-value' : ''}`}>
                                                <label className="input-label">Mã OTP</label>
                                                <div className="input-wrapper">
                                                    <Lock className="input-icon" size={18} />
                                                    <input
                                                        type="text"
                                                        className="form-input"
                                                        placeholder="Nhập mã 6 số..."
                                                        value={fpOtp}
                                                        onChange={e => setFpOtp(e.target.value)}
                                                        onFocus={() => setFocusedField('fpOtp')}
                                                        onBlur={() => setFocusedField(null)}
                                                    />
                                                </div>
                                            </div>
                                            <button type="submit" className="login-btn" disabled={fpLoading}>
                                                {fpLoading ? <Loader2 size={20} className="spin" /> : <span>Xác nhận OTP</span>}
                                            </button>
                                        </form>
                                    )}

                                    {fpFlow === 'reset' && (
                                        <form onSubmit={handleResetSubmit}>
                                            <div className={`input-group ${focusedField === 'fpNewPw' ? 'focused' : ''} ${fpNewPassword ? 'has-value' : ''}`}>
                                                <label className="input-label">Mật khẩu mới</label>
                                                <div className="input-wrapper">
                                                    <Lock className="input-icon" size={18} />
                                                    <input
                                                        type={showPassword ? 'text' : 'password'}
                                                        className="form-input"
                                                        placeholder="Mật khẩu ít nhất 6 ký tự..."
                                                        value={fpNewPassword}
                                                        onChange={e => setFpNewPassword(e.target.value)}
                                                        onFocus={() => setFocusedField('fpNewPw')}
                                                        onBlur={() => setFocusedField(null)}
                                                    />
                                                    <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                            </div>
                                            <button type="submit" className="login-btn" disabled={fpLoading}>
                                                {fpLoading ? <Loader2 size={20} className="spin" /> : <span>Khôi phục Mật khẩu</span>}
                                            </button>
                                        </form>
                                    )}

                                    <AnimatePresence>
                                        {fpError && (
                                            <motion.div
                                                className="error-message"
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                            >
                                                <AlertCircle size={16} /><span>{fpError}</span>
                                            </motion.div>
                                        )}
                                        {fpSuccess && (
                                            <motion.div
                                                className="error-message"
                                                style={{ backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                            >
                                                <CheckCircle2 size={16} /><span>{fpSuccess}</span>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>

                <motion.p
                    className="login-footer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                >
                    © 2026 BusTrack — Hệ thống quản lý xe đưa đón học sinh
                </motion.p>
            </div>
        </div>
    );
};

export default LoginPage;
