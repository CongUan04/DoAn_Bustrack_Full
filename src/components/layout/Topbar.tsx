import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, ChevronDown, LogOut, User, Settings, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ProfileModal from './ProfileModal';
import { useSocket } from '../../contexts/SocketContext';
import { alertAPI } from '../../services/api';
import { Link } from 'react-router-dom';

interface TopbarNotif {
    id: string;
    text: string;
    time: string;
    timestamp: string;
    read: boolean;
    type: 'info' | 'warning' | 'danger' | 'success';
}

const relTime = (ts: string) => {
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return `Vừa xong`;
    if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
    return `${Math.floor(s / 3600)} giờ trước`;
};

const Topbar: React.FC = () => {
    const { user, logout } = useAuth();
    const { lastAlert } = useSocket();
    const [showNotif, setShowNotif] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [notifications, setNotifications] = useState<TopbarNotif[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Fetch initial alerts
    useEffect(() => {
        if (!user) return;
        const fetchAlerts = async () => {
            try {
                const res = await alertAPI.getAll({ isResolved: 'false', limit: '5' });
                const alerts = res.data.data.map((a: any) => ({
                    id: a._id,
                    text: a.message,
                    time: relTime(a.timestamp),
                    timestamp: a.timestamp,
                    read: false,
                    type: a.severity === 'danger' ? 'danger' : a.severity === 'warning' ? 'warning' : 'info'
                }));
                setNotifications(alerts);
            } catch (err) {
                console.error('Failed to fetch initial alerts', err);
            }
        };
        fetchAlerts();
    }, [user?.role]);

    // Handle incoming real-time alerts
    useEffect(() => {
        if (!user || !lastAlert) return;
        const newNotif: TopbarNotif = {
            id: lastAlert._id || Date.now().toString(),
            text: lastAlert.message,
            time: 'Vừa xong',
            timestamp: lastAlert.timestamp || new Date().toISOString(),
            read: false,
            type: lastAlert.severity === 'danger' ? 'danger' : lastAlert.severity === 'warning' ? 'warning' : 'info'
        };
        setNotifications(prev => [newNotif, ...prev.filter(n => n.id !== newNotif.id)].slice(0, 5));
    }, [lastAlert, user?.role]);

    // Update relative time periodically
    useEffect(() => {
        const timer = setInterval(() => {
            setNotifications(prev => prev.map(n => ({ ...n, time: relTime(n.timestamp) })));
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAllRead = async () => {
        try {
            if (user?.role === 'admin') await alertAPI.acknowledgeAll();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        } catch (err) {}
    };

    return (
        <header className="topbar">
            {/* Left: Search */}
            <div className="topbar-search">
                <Search size={16} className="topbar-search-icon" />
                <input
                    type="text"
                    placeholder="Tìm kiếm học sinh, xe, tuyến đường..."
                    className="topbar-search-input"
                />
            </div>

            {/* Right: Actions */}
            <div className="topbar-actions">
                {/* Live Clock */}
                <div className="topbar-clock" style={{ fontSize: '15px', fontWeight: 600, color: '#334155', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}>
                    <Clock size={16} color="#64748B" />
                    {currentTime.toLocaleTimeString('vi-VN', { hour12: false })}
                </div>
                
                {/* Divider */}
                <div className="topbar-divider" />

                {/* Bell notification */}
                <div className="topbar-action-wrapper">
                    <button
                        className="topbar-icon-btn"
                        onClick={() => { setShowNotif(!showNotif); setShowProfile(false); }}
                        aria-label="Thông báo"
                        id="notification-bell"
                    >
                        <Bell size={20} />
                        {unreadCount > 0 && (
                            <motion.span
                                className="notif-badge"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                key={unreadCount}
                            >
                                {unreadCount}
                            </motion.span>
                        )}
                    </button>

                    {/* Notification dropdown */}
                    <AnimatePresence>
                        {showNotif && (
                            <motion.div
                                className="notif-dropdown"
                                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="notif-header">
                                    <span className="notif-title">Thông báo</span>
                                    {unreadCount > 0 && (
                                        <button className="notif-mark-read" onClick={markAllRead}>
                                            Đánh dấu tất cả đã đọc
                                        </button>
                                    )}
                                </div>
                                <div className="notif-list">
                                    {notifications.map(notif => (
                                        <div key={notif.id} className={`notif-item ${!notif.read ? 'unread' : ''} notif-${notif.type}`}>
                                            <div className={`notif-dot notif-dot-${notif.type}`} />
                                            <div className="notif-content">
                                                <p className="notif-text">{notif.text}</p>
                                                <p className="notif-time">{notif.time}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="notif-footer">
                                    {user?.role === 'admin' ? (
                                        <Link to="/admin/alerts" onClick={() => setShowNotif(false)}>Xem tất cả cảnh báo</Link>
                                    ) : (
                                        <span></span>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Divider */}
                <div className="topbar-divider" />

                {/* User profile */}
                <div className="topbar-action-wrapper">
                    <button
                        className="topbar-profile-btn"
                        onClick={() => { setShowProfile(!showProfile); setShowNotif(false); }}
                        id="profile-menu"
                    >
                        <div className="topbar-avatar">
                            {user?.fullName.charAt(0)}
                        </div>
                        <div className="topbar-user-info">
                            <span className="topbar-user-name">{user?.fullName}</span>
                            <span className="topbar-user-role">
                                {user?.role === 'admin' ? 'Quản trị viên' : 'Phụ huynh'}
                            </span>
                        </div>
                        <ChevronDown size={16} className={`topbar-chevron ${showProfile ? 'rotated' : ''}`} />
                    </button>

                    {/* Profile dropdown */}
                    <AnimatePresence>
                        {showProfile && (
                            <motion.div
                                className="profile-dropdown"
                                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="profile-dropdown-header">
                                    <div className="profile-dropdown-avatar">{user?.fullName.charAt(0)}</div>
                                    <div>
                                        <p className="profile-dropdown-name">{user?.fullName}</p>
                                        <p className="profile-dropdown-email">{user?.email}</p>
                                    </div>
                                </div>
                                <div className="profile-dropdown-menu">
                                    <button 
                                        className="profile-menu-item"
                                        onClick={() => {
                                            setShowProfileModal(true);
                                            setShowProfile(false);
                                        }}
                                    >
                                        <User size={16} /> Hồ sơ cá nhân
                                    </button>
                                    <button className="profile-menu-item">
                                        <Settings size={16} /> Cài đặt
                                    </button>
                                    <div className="profile-menu-divider" />
                                    <button className="profile-menu-item danger" onClick={logout}>
                                        <LogOut size={16} /> Đăng xuất
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* Backdrop to close dropdowns */}
            {(showNotif || showProfile) && (
                <div
                    className="topbar-backdrop"
                    onClick={() => { setShowNotif(false); setShowProfile(false); }}
                />
            )}

            {/* Profile Modal */}
            <ProfileModal 
                isOpen={showProfileModal} 
                onClose={() => setShowProfileModal(false)} 
            />
        </header>
    );
};

export default Topbar;
