import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Search, ChevronDown, LogOut, User, Settings, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import ProfileModal from './ProfileModal';

const MOCK_NOTIFICATIONS = [
    { id: 1, text: 'Xe số 01 đã đến trường', time: '2 phút trước', read: false, type: 'info' },
    { id: 2, text: 'Học sinh Nguyễn An chưa lên xe', time: '5 phút trước', read: false, type: 'warning' },
    { id: 3, text: 'Phát hiện tốc độ cao tại đường Lê Lợi', time: '12 phút trước', read: false, type: 'danger' },
    { id: 4, text: 'Điểm danh buổi sáng hoàn tất', time: '1 giờ trước', read: true, type: 'success' },
];

const Topbar: React.FC = () => {
    const { user, logout } = useAuth();
    const [showNotif, setShowNotif] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAllRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
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
                                    <a href="#">Xem tất cả thông báo</a>
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
