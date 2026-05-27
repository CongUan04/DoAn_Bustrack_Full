/**
 * DriverLayout.tsx - Layout riêng cho Tài xế (role: driver)
 * Giao diện tối, focus vào thông tin chuyến xe
 * Mobile-first, không cần sidebar phức tạp
 */
import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, Bell, LogOut, User, ChevronDown, Wifi, WifiOff, AlertTriangle, CheckCircle, X, KeyRound, Loader2, Save, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { authAPI, uploadAPI, getMediaUrl } from '../../services/api';
import { toast } from 'react-toastify';

const DriverProfileModal: React.FC<{ onClose: () => void, user: any }> = ({ onClose, user }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
    const [phone, setPhone] = useState(user?.phone || '');
    const { login, updateUser } = useAuth(); // Để cập nhật lại user data

    const handleSave = async () => {
        if (newPassword && !currentPassword) {
            toast.error('Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu');
            return;
        }
        if (newPassword && newPassword.length < 6) {
            toast.error('Mật khẩu mới phải từ 6 ký tự');
            return;
        }
        setSaving(true);
        try {
            const dataToUpdate: any = {};
            if (newPassword) {
                dataToUpdate.currentPassword = currentPassword;
                dataToUpdate.newPassword = newPassword;
            }
            if (pendingAvatar) {
                dataToUpdate.avatar = pendingAvatar;
            }
            if (phone !== (user?.phone || '')) {
                dataToUpdate.phone = phone;
            }

            if (Object.keys(dataToUpdate).length === 0) {
                toast.info('Không có thay đổi nào');
                setSaving(false);
                return;
            }

            const res = await authAPI.updateProfile(dataToUpdate);
            
            // Cập nhật lại localStorage và auth context (đơn giản bằng cách set lại token & user từ response)
            if (res.data?.data) {
                const userData = res.data.data;
                const token = userData.token || localStorage.getItem('bustrack_token');
                if (token) localStorage.setItem('bustrack_token', token);
                updateUser({ avatar: userData.avatar, fullName: userData.fullName, phone: userData.phone || phone });
            }

            toast.success('Cập nhật thông tin thành công');
            onClose();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }} onClick={onClose}>
            <motion.div style={{
                background: '#1e293b', width: '100%', maxWidth: 400,
                borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)'
            }} onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
            >
                <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ position: 'relative' }}>
                            <div style={{ width: 52, height: 52, borderRadius: 12, background: 'linear-gradient(135deg,#10B981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20, fontWeight: 'bold', overflow: 'hidden' }}>
                                {(pendingAvatar || user?.avatar) ? (
                                    <img src={getMediaUrl(pendingAvatar || user.avatar)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    user?.fullName?.charAt(0)
                                )}
                            </div>
                            <label style={{
                                position: 'absolute', bottom: -5, right: -5, width: 24, height: 24, borderRadius: '50%',
                                background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#94a3b8'
                            }}>
                                {uploadingAvatar ? <Loader2 size={12} className="spin" /> : <Settings size={12} />}
                                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setUploadingAvatar(true);
                                    try {
                                        const res = await uploadAPI.uploadImage(file);
                                        const avatarUrl = res.data.data.url;
                                        setPendingAvatar(avatarUrl);
                                    } catch (err: any) {
                                        toast.error(err.response?.data?.message || 'Lỗi tải ảnh lên');
                                    } finally {
                                        setUploadingAvatar(false);
                                    }
                                }} />
                            </label>
                        </div>
                        <div>
                            <h3 style={{ margin: 0, color: 'white', fontSize: 16 }}>{user?.fullName}</h3>
                            <p style={{ margin: 0, color: '#10B981', fontSize: 12 }}>Tài xế {user?.phone ? `- ${user.phone}` : ''}</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><X size={20} /></button>
                </div>
                
                <div style={{ padding: 20 }}>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Họ và tên</label>
                        <input value={user?.fullName || ''} readOnly style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 14px', borderRadius: 8, fontSize: 14 }} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Email đăng nhập</label>
                        <input value={user?.email || ''} readOnly style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 14px', borderRadius: 8, fontSize: 14 }} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Số điện thoại</label>
                        <input value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '10px 14px', borderRadius: 8, fontSize: 14 }} />
                    </div>
                    
                    <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '20px 0' }} />
                    
                    <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
                            <KeyRound size={14} /> Mật khẩu hiện tại (nhập nếu muốn đổi)
                        </label>
                        <input type="password" placeholder="Nhập mật khẩu hiện tại..." value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '10px 14px', borderRadius: 8, fontSize: 14 }} />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: 'block', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>Mật khẩu mới</label>
                        <input type="password" placeholder="Nhập mật khẩu mới..." value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '10px 14px', borderRadius: 8, fontSize: 14 }} />
                    </div>
                </div>
                
                <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', gap: 10, background: 'rgba(0,0,0,0.2)' }}>
                    <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 13, cursor: 'pointer' }}>Đóng</button>
                    <button onClick={handleSave} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, background: '#10B981', border: 'none', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {saving ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Cập nhật
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

const DriverLayout: React.FC = () => {
    const { isAuthenticated, user, logout } = useAuth();
    const { connected, recentSwipes } = useSocket();
    const [showMenu, setShowMenu] = useState(false);
    const [showNotif, setShowNotif] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [readIds, setReadIds] = useState<Set<string>>(new Set());

    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (user?.role !== 'driver') return <Navigate to="/" replace />;

    const notifs = recentSwipes.slice(0, 8);
    const unread = notifs.filter(n => !readIds.has(n.id)).length;

    return (
        <div style={{ minHeight: '100vh', background: '#0f172a' }}>
            {/* Header */}
            <header style={{
                position: 'sticky', top: 0, zIndex: 2000,
                background: 'linear-gradient(180deg,#1e293b,#0f172a)',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}>
                <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Logo */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 'auto' }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: 'linear-gradient(135deg,#10B981,#059669)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(16,185,129,0.4)',
                        }}>
                            <Bus size={20} color="white" />
                        </div>
                        <div>
                            <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: 'white' }}>BusTrack</p>
                            <p style={{ margin: 0, fontSize: 10, color: '#64748b' }}>Tài xế</p>
                        </div>
                    </div>

                    {/* Connection */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                        background: connected ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: connected ? '#10B981' : '#ef4444',
                        padding: '5px 12px', borderRadius: 20,
                        border: `1px solid ${connected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    }}>
                        {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {connected ? 'RFID Live' : 'Offline'}
                    </div>

                    {/* Bell */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => { setShowNotif(!showNotif); setShowMenu(false); }}
                            style={{
                                width: 38, height: 38, borderRadius: 10,
                                border: '1px solid rgba(255,255,255,0.1)',
                                background: showNotif ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: '#94a3b8', position: 'relative',
                            }}
                        >
                            <Bell size={17} />
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
                                        position: 'absolute', right: 0, top: 46, zIndex: 2001,
                                        width: 300, background: '#1e293b', borderRadius: 14,
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        boxShadow: '0 12px 40px rgba(0,0,0,0.4)', overflow: 'hidden',
                                    }}
                                >
                                    <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', fontWeight: 700, fontSize: 13, color: 'white' }}>
                                        Thông báo RFID
                                    </div>
                                    {notifs.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>Chưa có quẹt thẻ</div>
                                    ) : notifs.map(n => (
                                        <div key={n.id}
                                            onClick={() => setReadIds(prev => new Set([...prev, n.id]))}
                                            style={{
                                                padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                                                background: readIds.has(n.id) ? 'transparent' : 'rgba(16,185,129,0.08)',
                                                cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start',
                                            }}>
                                            <span style={{ marginTop: 2 }}>
                                                {n.status === 'success'
                                                    ? <CheckCircle size={13} color={n.action === 'lên xe' ? '#10B981' : '#3B82F6'} />
                                                    : <AlertTriangle size={13} color="#f59e0b" />}
                                            </span>
                                            <div>
                                                <p style={{ margin: 0, fontSize: 12.5, fontWeight: readIds.has(n.id) ? 400 : 600, color: 'white' }}>
                                                    {n.studentName}
                                                </p>
                                                <p style={{ margin: '2px 0 0', fontSize: 10, color: '#64748b' }}>
                                                    {n.action === 'lên xe' ? '↑ Lên xe' : '↓ Xuống xe'} · {n.licensePlate} · {new Date(n.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Profile */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => { setShowMenu(!showMenu); setShowNotif(false); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px 5px 5px',
                                borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
                                background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
                            }}
                        >
                            <div style={{
                                width: 30, height: 30, borderRadius: 8,
                                background: 'linear-gradient(135deg,#10B981,#059669)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: 700, fontSize: 13, overflow: 'hidden'
                            }}>
                                {user?.avatar ? (
                                    <img src={getMediaUrl(user.avatar)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    user?.fullName?.charAt(0)
                                )}
                            </div>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'white' }}>
                                {user?.fullName?.split(' ').slice(-1)[0]}
                            </span>
                            <ChevronDown size={13} color="#64748b" style={{ transform: showMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>

                        <AnimatePresence>
                            {showMenu && (
                                <motion.div
                                    initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                    style={{
                                        position: 'absolute', right: 0, top: 44, zIndex: 2001,
                                        width: 200, background: '#1e293b', borderRadius: 12,
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        boxShadow: '0 12px 40px rgba(0,0,0,0.4)', overflow: 'hidden',
                                    }}
                                >
                                    <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'white' }}>{user?.fullName}</p>
                                        <p style={{ margin: '1px 0 0', fontSize: 11, color: '#64748b' }}>Tài xế {user?.phone ? `• ${user.phone}` : ''}</p>
                                    </div>
                                    <button onClick={() => { setShowMenu(false); setShowProfile(true); }}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '10px 14px', background: 'none', border: 'none',
                                            cursor: 'pointer', fontSize: 13, color: '#94a3b8', textAlign: 'left',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                                    >
                                        <User size={14} /> Thông tin tài xế
                                    </button>
                                    <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />
                                    <button onClick={logout}
                                        style={{
                                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '10px 14px', background: 'none', border: 'none',
                                            cursor: 'pointer', fontSize: 13, color: '#ef4444', textAlign: 'left', marginBottom: 4,
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
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
                <div style={{ position: 'fixed', inset: 0, zIndex: 1999 }}
                    onClick={() => { setShowMenu(false); setShowNotif(false); }} />
            )}

            <main style={{ maxWidth: 900, margin: '0 auto' }}>
                <Outlet />
            </main>

            <AnimatePresence>
                {showProfile && <DriverProfileModal user={user} onClose={() => setShowProfile(false)} />}
            </AnimatePresence>
        </div>
    );
};

export default DriverLayout;
