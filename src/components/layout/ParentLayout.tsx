/**
 * ParentLayout.tsx - Layout riêng cho Phụ huynh
 * Giao diện clean, mobile-friendly, không có sidebar phức tạp
 * Chỉ có header top với thông tin cơ bản và nút profile/logout
 */
import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, Bell, LogOut, User, Settings, ChevronDown, Wifi, WifiOff, X, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { authAPI } from '../../services/api';

// ── Quick Profile Modal (parent-specific) ─────────────────────
const ParentQuickProfile: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { user, updateUser } = useAuth();
    const [form, setForm] = useState({ email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleSave = async () => {
        if (form.newPassword && form.newPassword !== form.confirmPassword) {
            setMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp' });
            return;
        }
        setLoading(true);
        setMsg(null);
        try {
            const payload: Record<string, string> = {};
            if (form.email) payload.email = form.email;
            if (form.newPassword) { payload.currentPassword = form.currentPassword; payload.newPassword = form.newPassword; }

            const res = await authAPI.updateProfile(payload);
            const updated = res.data.data;
            updateUser({ email: updated.email, isEmailSet: updated.isEmailSet });
            setMsg({ type: 'success', text: 'Cập nhật thành công!' });
            setForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Lỗi cập nhật';
            setMsg({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                className="modal-backdrop"
                style={{ zIndex: 8000, backdropFilter: 'blur(4px)' }}
            >
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    zIndex: 8001, width: '90%', maxWidth: 440,
                    background: 'white', borderRadius: 20, padding: '28px',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
                    position: 'relative'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 18 }}>Thông tin tài khoản</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Phụ huynh · {user?.username}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px', background: '#f8fafc', borderRadius: 12, marginBottom: 20 }}>
                    <div style={{
                        width: 50, height: 50, borderRadius: 14,
                        background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: 20,
                    }}>
                        {user?.fullName?.split(' ').pop()?.charAt(0)}
                    </div>
                    <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{user?.fullName}</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: user?.isEmailSet ? '#059669' : '#f59e0b' }}>
                            {user?.isEmailSet ? `✅ ${user?.email}` : '⚠️ Chưa cập nhật Gmail'}
                        </p>
                    </div>
                </div>

                {/* Fields */}
                {[
                    { key: 'email', label: 'Gmail mới', type: 'email', icon: <Mail size={14} />, placeholder: 'Nhập Gmail thật của bạn...' },
                    { key: 'currentPassword', label: 'Mật khẩu hiện tại', type: 'password', icon: <Lock size={14} />, placeholder: 'Nhập mật khẩu đang dùng...' },
                    { key: 'newPassword', label: 'Mật khẩu mới', type: 'password', icon: <Lock size={14} />, placeholder: 'Để trống nếu không đổi...' },
                    { key: 'confirmPassword', label: 'Xác nhận mật khẩu', type: 'password', icon: <Lock size={14} />, placeholder: 'Nhập lại mật khẩu mới...' },
                ].map(f => (
                    <div key={f.key} style={{ marginBottom: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                            {f.icon} {f.label}
                            {f.key === 'email' && !user?.isEmailSet && (
                                <span style={{ marginLeft: 4, fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 20, fontWeight: 700 }}>Chưa cập nhật</span>
                            )}
                        </label>
                        <input
                            type={f.type}
                            value={form[f.key as keyof typeof form]}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            style={{
                                width: '100%', padding: '9px 12px', borderRadius: 10, boxSizing: 'border-box',
                                border: `1.5px solid ${f.key === 'email' && !user?.isEmailSet ? '#fbbf24' : '#e2e8f0'}`,
                                fontSize: 13, outline: 'none',
                                background: f.key === 'email' && !user?.isEmailSet ? '#fffbeb' : '#f8fafc',
                            }}
                        />
                    </div>
                ))}

                <AnimatePresence>
                    {msg && (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{
                                padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600,
                                background: msg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                                color: msg.type === 'success' ? '#059669' : '#dc2626',
                                border: `1px solid ${msg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                            }}>
                            {msg.type === 'success' ? '✅ ' : '❌ '}{msg.text}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                        Huỷ
                    </button>
                    <button onClick={handleSave} disabled={loading} style={{
                        flex: 2, padding: '10px', borderRadius: 10, border: 'none',
                        background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: 'white',
                        cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13,
                        opacity: loading ? 0.7 : 1,
                    }}>
                        {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                </div>
            </motion.div>
            </motion.div>
        </>
    );
};

// ── Parent Layout ─────────────────────────────────────────────
const ParentLayout: React.FC = () => {
    const { isAuthenticated, user, logout } = useAuth();
    const { connected, recentSwipes } = useSocket();
    const [showMenu, setShowMenu] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showNotif, setShowNotif] = useState(false);
    const [readIds, setReadIds] = useState<Set<string>>(new Set());

    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (user?.role !== 'parent') return <Navigate to="/" replace />;

    const notifs = recentSwipes.slice(0, 6);
    const unread = notifs.filter(n => !readIds.has(n.id)).length;

    return (
        <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
            {/* Header */}
            <header style={{
                position: 'sticky', top: 0, zIndex: 100,
                background: 'white', borderBottom: '1px solid #e2e8f0',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}>
                <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 'auto' }}>
                        <div style={{
                            width: 34, height: 34, borderRadius: 10,
                            background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Bus size={18} color="white" />
                        </div>
                        <div>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#7c3aed' }}>BusTrack</p>
                            <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>Phụ huynh</p>
                        </div>
                    </div>

                    {/* Live status */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                        background: connected ? '#f0fdf4' : '#fef2f2',
                        color: connected ? '#059669' : '#dc2626',
                        padding: '5px 10px', borderRadius: 20,
                    }}>
                        {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {connected ? 'Live' : 'Offline'}
                    </div>

                    {/* Bell */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => { setShowNotif(!showNotif); setShowMenu(false); }}
                            style={{
                                width: 36, height: 36, borderRadius: 10, border: '1px solid #e2e8f0',
                                background: '#f8fafc', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', color: '#475569', position: 'relative',
                            }}
                        >
                            <Bell size={16} />
                            {unread > 0 && (
                                <span style={{
                                    position: 'absolute', top: -4, right: -4,
                                    background: '#ef4444', color: 'white',
                                    fontSize: 9, fontWeight: 700,
                                    width: 16, height: 16, borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>{unread}</span>
                            )}
                        </button>
                        <AnimatePresence>
                            {showNotif && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                    style={{
                                        position: 'absolute', right: 0, top: 44, zIndex: 200,
                                        width: 300, background: 'white', borderRadius: 14,
                                        border: '1px solid #e2e8f0', boxShadow: '0 12px 40px rgba(0,0,0,0.15)', overflow: 'hidden',
                                    }}
                                >
                                    <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 13 }}>
                                        Thông báo quẹt thẻ
                                    </div>
                                    {notifs.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>Chưa có thông báo</div>
                                    ) : notifs.map(n => (
                                        <div key={n.id}
                                            onClick={() => setReadIds(prev => new Set([...prev, n.id]))}
                                            style={{
                                                padding: '10px 14px', borderBottom: '1px solid #f8fafc',
                                                background: readIds.has(n.id) ? 'white' : '#f5f3ff',
                                                cursor: 'pointer',
                                            }}>
                                            <p style={{ margin: 0, fontSize: 12.5, fontWeight: readIds.has(n.id) ? 400 : 600 }}>
                                                {n.action === 'lên xe' ? '🟢' : '🔵'} {n.studentName} — {n.action}
                                            </p>
                                            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#94a3b8' }}>{n.licensePlate} · {new Date(n.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Profile menu */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => { setShowMenu(!showMenu); setShowNotif(false); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 4px 4px',
                                borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer',
                            }}
                        >
                            <div style={{
                                width: 30, height: 30, borderRadius: 8,
                                background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: 700, fontSize: 13,
                            }}>
                                {user?.fullName?.split(' ').pop()?.charAt(0)}
                            </div>
                            <ChevronDown size={13} color="#94a3b8" style={{ transform: showMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>

                        <AnimatePresence>
                            {showMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                    style={{
                                        position: 'absolute', right: 0, top: 44, zIndex: 200,
                                        width: 200, background: 'white', borderRadius: 12,
                                        border: '1px solid #e2e8f0', boxShadow: '0 12px 40px rgba(0,0,0,0.15)', overflow: 'hidden',
                                    }}
                                >
                                    <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
                                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{user?.fullName}</p>
                                        <p style={{ margin: '1px 0 0', fontSize: 11, color: '#64748b' }}>Phụ huynh</p>
                                    </div>
                                    {[
                                        { icon: <User size={14} />, label: 'Hồ sơ tài khoản', action: () => { setShowProfile(true); setShowMenu(false); } },
                                        { icon: <Settings size={14} />, label: 'Cài đặt thông báo', action: () => setShowMenu(false) },
                                    ].map(item => (
                                        <button key={item.label} onClick={item.action}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '10px 14px', background: 'none', border: 'none',
                                                cursor: 'pointer', fontSize: 13, color: '#374151', textAlign: 'left',
                                            }}
                                            onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                        >
                                            <span style={{ color: '#94a3b8' }}>{item.icon}</span>
                                            {item.label}
                                        </button>
                                    ))}
                                    <div style={{ height: 1, background: '#f1f5f9' }} />
                                    <button onClick={logout}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '10px 14px', background: 'none', border: 'none',
                                            cursor: 'pointer', fontSize: 13, color: '#ef4444', textAlign: 'left', marginBottom: 4,
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                    >
                                        <LogOut size={14} /> Đăng xuất
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>

            {/* Backdrop */}
            {(showMenu || showNotif) && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                    onClick={() => { setShowMenu(false); setShowNotif(false); }} />
            )}

            {/* Profile modal */}
            <AnimatePresence>
                {showProfile && <ParentQuickProfile onClose={() => setShowProfile(false)} />}
            </AnimatePresence>

            {/* Page content */}
            <main>
                <Outlet />
            </main>
        </div>
    );
};

export default ParentLayout;
