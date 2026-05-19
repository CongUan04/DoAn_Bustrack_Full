/**
 * ParentLayout.tsx - Layout riêng cho Phụ huynh
 * Giao diện clean, mobile-friendly, không có sidebar phức tạp
 * Chỉ có header top với thông tin cơ bản và nút profile/logout
 */
import React, { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bus, Bell, LogOut, Settings, ChevronDown, Wifi, WifiOff, X, Lock, Mail, Clock, Sun, Moon, Map as MapIcon, Calendar, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { authAPI } from '../../services/api';
import { toast } from 'react-toastify';
import TelegramSettings from '../TelegramSettings';

// ── Parent Layout ─────────────────────────────────────────────
const ParentLayout: React.FC = () => {
    const { isAuthenticated, user, logout } = useAuth();
    const { connected, recentSwipes, lastRfidEvent } = useSocket();
    const [showNotif, setShowNotif] = useState(false);
    const [readIds, setReadIds] = useState<Set<string>>(new Set());
    const [currentTime, setCurrentTime] = useState(new Date());
    const [activeTab, setActiveTab] = useState<'home' | 'history' | 'settings'>('home');


    // ── Web Notification: Khi có thẻ quẹt (Giai đoạn 1 + 3) ─────────
    React.useEffect(() => {
        if (!lastRfidEvent) return;
        const { studentName, action, licensePlate, status, isAbnormal, abnormalReason } = lastRfidEvent;
        
        // Phụ huynh không nhận cảnh báo thẻ lạ
        if (status === 'error') return;

        const timeStr = lastRfidEvent.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        
        if (isAbnormal) {
            toast.error(`🚨 CẢNH BÁO: ${studentName} vừa ${action.toUpperCase()} ${licensePlate} nhưng ${abnormalReason}! Vui lòng liên hệ tài xế ngay.`, { autoClose: 15000 });
            return;
        }

        const msg = `Con bạn (${studentName}) đã ${action.toUpperCase()} ${licensePlate} lúc ${timeStr}`;

        if (action === 'lên xe') {
            toast.success(msg, { icon: '🚌' as any, autoClose: 6000 });
        } else {
            toast.info(msg, { icon: '🏫' as any, autoClose: 6000 });
        }
    }, [lastRfidEvent]);

    React.useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (user?.role !== 'parent') return <Navigate to="/" replace />;

    const notifs = recentSwipes.slice(0, 6);
    const unread = notifs.filter(n => !readIds.has(n.id)).length;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-primary)' }}>
            {/* Header */}
            <header style={{
                position: 'sticky', top: 0, zIndex: 2000,
                background: 'var(--surface)', borderBottom: '1px solid var(--border)',
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
                            <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>BusTrack</p>
                            <p style={{ margin: 0, fontSize: 10, color: 'var(--text-secondary)' }}>Phụ huynh</p>
                        </div>
                    </div>

                    {/* Live Clock */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '5px 12px', borderRadius: 20, fontSize: 13, fontWeight: 700,
                        background: 'var(--surface-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)', letterSpacing: '0.5px'
                    }}>
                        <Clock size={14} color="var(--text-secondary)" />
                        {currentTime.toLocaleTimeString('vi-VN', { hour12: false })}
                    </div>

                    {/* Live status */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600,
                        background: connected ? 'var(--success-light)' : 'var(--danger-light)',
                        color: connected ? 'var(--success)' : 'var(--danger)',
                        padding: '5px 10px', borderRadius: 20,
                    }}>
                        {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {connected ? 'Live' : 'Offline'}
                    </div>

                    {/* Bell */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowNotif(!showNotif)}
                            style={{
                                width: 36, height: 36, borderRadius: 10, border: '1px solid var(--border)',
                                background: 'var(--surface-hover)', cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)', position: 'relative',
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
                                        position: 'absolute', right: 0, top: 44, zIndex: 2001,
                                        width: 300, background: 'var(--surface)', borderRadius: 14,
                                        border: '1px solid var(--border)', boxShadow: '0 12px 40px rgba(0,0,0,0.15)', overflow: 'hidden',
                                    }}
                                >
                                    <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>
                                        Thông báo quẹt thẻ
                                    </div>
                                    {notifs.length === 0 ? (
                                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>Chưa có thông báo</div>
                                    ) : notifs.map(n => (
                                        <div key={n.id}
                                            onClick={() => setReadIds(prev => new Set([...prev, n.id]))}
                                            style={{
                                                padding: '10px 14px', borderBottom: '1px solid var(--surface-hover)',
                                                background: readIds.has(n.id) ? 'var(--surface)' : 'var(--primary-light)',
                                                cursor: 'pointer',
                                            }}>
                                            <p style={{ margin: 0, fontSize: 12.5, fontWeight: readIds.has(n.id) ? 400 : 600, color: 'var(--text-primary)' }}>
                                                {n.action === 'lên xe' ? '🟢' : '🔵'} {n.studentName} — {n.action}
                                            </p>
                                            <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--text-secondary)' }}>{n.licensePlate} · {new Date(n.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </header>

            {/* Backdrop */}
            {(showNotif) && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1999 }}
                    onClick={() => { setShowNotif(false); }} />
            )}

            {/* Page content */}
            <main style={{ paddingBottom: activeTab === 'home' ? 0 : 'calc(65px + env(safe-area-inset-bottom))' }}>
                <Outlet context={{ activeTab, setActiveTab }} />
            </main>

            {/* Bottom Navigation */}
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, 
                height: 'calc(65px + env(safe-area-inset-bottom))',
                paddingBottom: 'env(safe-area-inset-bottom)',
                background: 'var(--surface)', borderTop: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-around', alignItems: 'center',
                zIndex: 2000,
                boxShadow: '0 -2px 10px rgba(0,0,0,0.05)',
                boxSizing: 'border-box'
            }}>
                <button 
                    onClick={() => setActiveTab('home')}
                    style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 4, background: 'none', border: 'none', cursor: 'pointer',
                        color: activeTab === 'home' ? 'var(--primary)' : 'var(--text-secondary)'
                    }}
                >
                    <MapIcon size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
                    <span style={{ fontSize: 11, fontWeight: activeTab === 'home' ? 700 : 500 }}>Trang chủ</span>
                </button>

                <button 
                    onClick={() => setActiveTab('history')}
                    style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 4, background: 'none', border: 'none', cursor: 'pointer',
                        color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-secondary)'
                    }}
                >
                    <Calendar size={24} strokeWidth={activeTab === 'history' ? 2.5 : 2} />
                    <span style={{ fontSize: 11, fontWeight: activeTab === 'history' ? 700 : 500 }}>Lịch sử</span>
                </button>

                <button 
                    onClick={() => setActiveTab('settings')}
                    style={{
                        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 4, background: 'none', border: 'none', cursor: 'pointer',
                        color: activeTab === 'settings' ? 'var(--primary)' : 'var(--text-secondary)'
                    }}
                >
                    <User size={24} strokeWidth={activeTab === 'settings' ? 2.5 : 2} />
                    <span style={{ fontSize: 11, fontWeight: activeTab === 'settings' ? 700 : 500 }}>Cài đặt</span>
                </button>
            </div>
        </div>
    );
};

export default ParentLayout;
