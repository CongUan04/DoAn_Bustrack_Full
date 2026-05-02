import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard,
    Map,
    ClipboardList,
    GraduationCap,
    Bus,
    Bell,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Route,
    Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// allowedRoles: undefined = tất cả role; mảng = chỉ role trong mảng đó
const menuItems: {
    path: string; icon: React.ElementType; label: string; color: string;
    allowedRoles?: string[];
}[] = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',          color: '#3B82F6', allowedRoles: ['admin'] },
    { path: '/parent',    icon: Map,             label: 'Tổng quan',           color: '#10B981', allowedRoles: ['parent'] },
    { path: '/driver',    icon: Bus,             label: 'Bảng điều khiển',    color: '#10B981', allowedRoles: ['driver'] },
    { path: '/map',       icon: Map,             label: 'Bản đồ Live',         color: '#10B981', allowedRoles: ['admin'] },
    { path: '/attendance',icon: ClipboardList,   label: 'Điểm danh',           color: '#F59E0B', allowedRoles: ['admin'] },
    { path: '/students',  icon: GraduationCap,   label: 'Quản lý Học sinh',    color: '#8B5CF6', allowedRoles: ['admin'] },
    { path: '/buses',     icon: Bus,             label: 'Quản lý Xe',          color: '#EC4899', allowedRoles: ['admin'] },
    { path: '/routes',    icon: Route,           label: 'Quản lý Tuyến',       color: '#0EA5E9', allowedRoles: ['admin'] },
    { path: '/alerts',    icon: Bell,            label: 'Cảnh báo',            color: '#EF4444', allowedRoles: ['admin'] },
    { path: '/users',     icon: Users,           label: 'Quản lý tài khoản',   color: '#6366F1', allowedRoles: ['admin'] },
];

const Sidebar: React.FC = () => {
    const [collapsed, setCollapsed] = useState(false);
    const location = useLocation();
    const { logout, user } = useAuth();

    return (
        <motion.aside
            className="sidebar"
            animate={{ width: collapsed ? 72 : 260 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
            {/* Logo */}
            <div className="sidebar-logo">
                <div className="sidebar-logo-icon">
                    <Bus size={22} />
                </div>
                <AnimatePresence>
                    {!collapsed && (
                        <motion.span
                            className="sidebar-logo-text"
                            initial={{ opacity: 0, width: 0 }}
                            animate={{ opacity: 1, width: 'auto' }}
                            exit={{ opacity: 0, width: 0 }}
                            transition={{ duration: 0.25 }}
                        >
                            BusTrack
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            {/* Collapse toggle */}
            <button
                className="sidebar-toggle"
                onClick={() => setCollapsed(!collapsed)}
                aria-label={collapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
            >
                {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            {/* Nav section label */}
            <AnimatePresence>
                {!collapsed && (
                    <motion.p
                        className="sidebar-section-label"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        MENU CHÍNH
                    </motion.p>
                )}
            </AnimatePresence>

            {/* Nav items */}
            <nav className="sidebar-nav">
                {menuItems.map((item) => {
                    // Lọc menu theo allowedRoles
                    if (item.allowedRoles && !item.allowedRoles.includes(user?.role ?? '')) {
                        return null;
                    }
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                            title={collapsed ? item.label : ''}
                        >
                            {isActive && (
                                <motion.div
                                    className="sidebar-nav-active-bg"
                                    layoutId="activeNav"
                                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                />
                            )}
                            <span
                                className="sidebar-nav-icon"
                                style={{ color: isActive ? item.color : undefined }}
                            >
                                <Icon size={20} />
                            </span>
                            <AnimatePresence>
                                {!collapsed && (
                                    <motion.span
                                        className="sidebar-nav-label"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {item.label}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                        </NavLink>
                    );
                })}
            </nav>

            {/* Bottom section */}
            <div className="sidebar-bottom">
                <AnimatePresence>
                    {!collapsed && (
                        <motion.div
                            className="sidebar-user-mini"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <div className="sidebar-user-avatar">
                                {user?.fullName.charAt(0)}
                            </div>
                            <div className="sidebar-user-info">
                                <p className="sidebar-user-name">{user?.fullName}</p>
                                <p className="sidebar-user-role">
                                    {user?.role === 'admin' ? 'Quản trị viên'
                                     : user?.role === 'driver' ? 'Tài xế'
                                     : 'Phụ huynh'}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <button
                    className="sidebar-nav-item logout-btn"
                    onClick={logout}
                    title={collapsed ? 'Đăng xuất' : ''}
                >
                    <span className="sidebar-nav-icon"><LogOut size={19} /></span>
                    <AnimatePresence>
                        {!collapsed && (
                            <motion.span
                                className="sidebar-nav-label"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                            >
                                Đăng xuất
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </div>
        </motion.aside>
    );
};

export default Sidebar;
