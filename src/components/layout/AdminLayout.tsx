import React, { useState } from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Map, ClipboardList, GraduationCap,
    Bus, Bell, ChevronLeft, ChevronRight, LogOut,
    Route, Users, Search, ChevronDown, User, Settings,
    AlertTriangle, CheckCircle, Info, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import ProfileModal from './ProfileModal';

const ADMIN_MENU = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard',        color: '#3B82F6' },
    { path: '/admin/map',       icon: Map,             label: 'Bản đồ Live',      color: '#10B981' },
    { path: '/admin/attendance',icon: ClipboardList,   label: 'Điểm danh',        color: '#F59E0B' },
    { path: '/admin/students',  icon: GraduationCap,   label: 'Quản lý Học sinh', color: '#8B5CF6' },
    { path: '/admin/buses',     icon: Bus,             label: 'Quản lý Xe',       color: '#EC4899' },
    { path: '/admin/routes',    icon: Route,           label: 'Quản lý Tuyến',    color: '#0EA5E9' },
    { path: '/admin/alerts',    icon: Bell,            label: 'Cảnh báo',         color: '#EF4444' },
    { path: '/admin/users',     icon: Users,           label: 'Tài khoản',        color: '#6366F1' },
];

// ── Admin Sidebar ─────────────────────────────────────────────
const AdminSidebar: React.FC<{ collapsed: boolean; onToggle: () => void }> = ({ collapsed, onToggle }) => {
    const location = useLocation();
    const { logout, user } = useAuth();

    return (
        <motion.aside
            className="admin-sidebar"
            animate={{ width: collapsed ? 72 : 260 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{
                position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100,
                background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '4px 0 24px rgba(0,0,0,0.2)',
            }}
        >
            {/* Logo */}
            <div style={{
                padding: collapsed ? '20px 16px' : '20px 20px',
                display: 'flex', alignItems: 'center', gap: 12,
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                minHeight: 72, flexShrink: 0,
            }}>
                <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg,#3B82F6,#2563EB)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(59,130,246,0.4)',
                }}>
                    <Bus size={20} color="white" />
                </div>
                <AnimatePresence>
                    {!collapsed && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
                            <p style={{ margin: 0, color: 'white', fontWeight: 800, fontSize: 16, letterSpacing: 0.5 }}>BusTrack</p>
                            <p style={{ margin: 0, color: '#64748b', fontSize: 10, fontWeight: 500 }}>Quản trị hệ thống</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Toggle */}
            <button
                onClick={onToggle}
                style={{
                    position: 'absolute', top: 20, right: -12, zIndex: 10,
                    width: 24, height: 24, borderRadius: '50%',
                    background: '#3B82F6', border: '2px solid #0f172a',
                    color: 'white', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
            >
                {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            </button>

            {/* Nav label */}
            <AnimatePresence>
                {!collapsed && (
                    <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ margin: '16px 20px 8px', fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: 1.2, textTransform: 'uppercase' }}>
                        Menu chính
                    </motion.p>
                )}
            </AnimatePresence>

            {/* Nav items */}
            <nav style={{ flex: 1, padding: '0 10px', overflowY: 'auto' }}>
                {ADMIN_MENU.map(item => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                        <NavLink key={item.path} to={item.path}
                            title={collapsed ? item.label : ''}
                            style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}
                        >
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: collapsed ? '11px 14px' : '11px 14px',
                                borderRadius: 10, position: 'relative', cursor: 'pointer',
                                background: isActive ? `${item.color}22` : 'transparent',
                                border: isActive ? `1px solid ${item.color}40` : '1px solid transparent',
                                transition: 'all 0.2s',
                            }}>
                                {isActive && (
                                    <div style={{
                                        position: 'absolute', left: 0, top: '20%', bottom: '20%',
                                        width: 3, borderRadius: 4, background: item.color,
                                    }} />
                                )}
                                <span style={{ color: isActive ? item.color : '#94a3b8', flexShrink: 0 }}>
                                    <Icon size={19} />
                                </span>
                                <AnimatePresence>
                                    {!collapsed && (
                                        <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                            style={{ fontSize: 13.5, fontWeight: isActive ? 700 : 500, color: isActive ? 'white' : '#94a3b8', whiteSpace: 'nowrap' }}>
                                            {item.label}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </div>
                        </NavLink>
                    );
                })}
            </nav>

            {/* Bottom: user + logout */}
            <div style={{
                padding: '12px 10px',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                flexShrink: 0,
            }}>
                <AnimatePresence>
                    {!collapsed && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 6, borderRadius: 10, background: 'rgba(255,255,255,0.05)' }}>
                            <div style={{
                                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                                background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: 700, fontSize: 14,
                            }}>
                                {user?.fullName?.charAt(0)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, color: 'white', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.fullName}</p>
                                <p style={{ margin: 0, color: '#64748b', fontSize: 10 }}>Quản trị viên</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <button onClick={logout}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center',
                        gap: 10, padding: '10px 12px', borderRadius: 10,
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: '#ef4444', transition: 'background 0.2s',
                    }}
                    title={collapsed ? 'Đăng xuất' : ''}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                    <LogOut size={18} style={{ flexShrink: 0 }} />
                    <AnimatePresence>
                        {!collapsed && (
                            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                                Đăng xuất
                            </motion.span>
                        )}
                    </AnimatePresence>
                </button>
            </div>
        </motion.aside>
    );
};

// ── Admin Topbar ──────────────────────────────────────────────
const AdminTopbar: React.FC<{ sidebarCollapsed: boolean }> = ({ sidebarCollapsed }) => {
    const { user, logout } = useAuth();
    const { recentSwipes, connected } = useSocket();
    const [showNotif, setShowNotif] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [readIds, setReadIds] = useState<Set<string>>(new Set());

    const notifs = recentSwipes.slice(0, 8).map(s => ({
        id: s.id,
        text: `${s.studentName} — ${s.action === 'lên xe' ? '🟢 Lên xe' : '🔵 Xuống xe'} · ${s.licensePlate}`,
        time: new Date(s.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        type: s.status === 'error' ? 'warning' : s.action === 'lên xe' ? 'success' : 'info',
    }));

    const unread = notifs.filter(n => !readIds.has(n.id)).length;

    const markAllRead = () => {
        setReadIds(new Set(notifs.map(n => n.id)));
    };

    return (
        <header style={{
            position: 'fixed', top: 0, right: 0, zIndex: 90,
            left: sidebarCollapsed ? 72 : 260,
            height: 64, background: 'white',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 24px', gap: 16,
            boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
            transition: 'left 0.3s cubic-bezier(0.22,1,0.36,1)',
        }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, maxWidth: 420 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm học sinh, xe, tuyến đường..."
                    style={{
                        width: '100%', padding: '9px 14px 9px 36px',
                        background: '#f8fafc', border: '1.5px solid #e2e8f0',
                        borderRadius: 10, fontSize: 13, outline: 'none',
                        boxSizing: 'border-box', transition: 'border-color 0.2s',
                    }}
                    onFocus={e => (e.target.style.borderColor = '#3B82F6')}
                    onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Connection badge */}
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: connected ? '#f0fdf4' : '#fef2f2',
                    color: connected ? '#059669' : '#dc2626',
                }}>
                    <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: connected ? '#059669' : '#dc2626',
                        display: 'inline-block',
                        animation: connected ? 'pulse 2s infinite' : 'none',
                    }} />
                    {connected ? 'Live' : 'Offline'}
                </div>

                {/* Bell */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => { setShowNotif(!showNotif); setShowProfile(false); }}
                        style={{
                            width: 38, height: 38, borderRadius: 10,
                            background: showNotif ? '#EFF6FF' : '#f8fafc',
                            border: '1.5px solid #e2e8f0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', position: 'relative', color: '#475569',
                        }}
                    >
                        <Bell size={18} />
                        {unread > 0 && (
                            <span style={{
                                position: 'absolute', top: -4, right: -4,
                                background: '#ef4444', color: 'white',
                                fontSize: 10, fontWeight: 700,
                                width: 17, height: 17, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: '2px solid white',
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
                                    position: 'absolute', right: 0, top: 46, zIndex: 200,
                                    width: 340, background: 'white', borderRadius: 14,
                                    border: '1px solid #e2e8f0', boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                                    overflow: 'hidden',
                                }}
                            >
                                <div style={{ padding: '14px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, fontSize: 14 }}>Thông báo real-time</span>
                                    {unread > 0 && (
                                        <button onClick={markAllRead} style={{ fontSize: 11, color: '#3B82F6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                                            Đánh dấu đã đọc
                                        </button>
                                    )}
                                </div>
                                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                                    {notifs.length === 0 ? (
                                        <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                                            Chưa có thông báo mới
                                        </div>
                                    ) : (
                                        notifs.map(n => {
                                            const isRead = readIds.has(n.id);
                                            const iconMap = { success: <CheckCircle size={14} color="#059669" />, warning: <AlertTriangle size={14} color="#f59e0b" />, info: <Info size={14} color="#3B82F6" /> };
                                            return (
                                                <div key={n.id} style={{
                                                    display: 'flex', gap: 10, padding: '10px 16px',
                                                    background: isRead ? 'white' : '#f0f9ff',
                                                    borderBottom: '1px solid #f8fafc',
                                                    cursor: 'pointer',
                                                }}
                                                    onClick={() => setReadIds(prev => new Set([...prev, n.id]))}
                                                >
                                                    <div style={{ marginTop: 2, flexShrink: 0 }}>{iconMap[n.type as keyof typeof iconMap]}</div>
                                                    <div style={{ flex: 1 }}>
                                                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: isRead ? 400 : 600 }}>{n.text}</p>
                                                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>{n.time}</p>
                                                    </div>
                                                    {!isRead && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#3B82F6', flexShrink: 0, marginTop: 4 }} />}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                                <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', textAlign: 'center' }}>
                                    <a href="/admin/alerts" style={{ fontSize: 12, color: '#3B82F6', textDecoration: 'none', fontWeight: 600 }}>Xem tất cả cảnh báo →</a>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Profile */}
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => { setShowProfile(!showProfile); setShowNotif(false); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '5px 10px 5px 5px', borderRadius: 10,
                            background: showProfile ? '#EFF6FF' : '#f8fafc',
                            border: '1.5px solid #e2e8f0', cursor: 'pointer',
                        }}
                    >
                        <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: 700, fontSize: 13,
                        }}>
                            {user?.fullName?.charAt(0)}
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>{user?.fullName}</p>
                            <p style={{ margin: 0, fontSize: 10, color: '#64748b' }}>Quản trị viên</p>
                        </div>
                        <ChevronDown size={14} color="#94a3b8" style={{ transform: showProfile ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>

                    <AnimatePresence>
                        {showProfile && (
                            <motion.div
                                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                style={{
                                    position: 'absolute', right: 0, top: 46, zIndex: 200,
                                    width: 220, background: 'white', borderRadius: 12,
                                    border: '1px solid #e2e8f0', boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                                    overflow: 'hidden',
                                }}
                            >
                                <div style={{ padding: '14px', borderBottom: '1px solid #f1f5f9' }}>
                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{user?.fullName}</p>
                                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>{user?.email}</p>
                                </div>
                                {[
                                    { icon: <User size={14} />, label: 'Hồ sơ cá nhân', action: () => { setShowProfileModal(true); setShowProfile(false); } },
                                    { icon: <Settings size={14} />, label: 'Cài đặt', action: () => setShowProfile(false) },
                                    { icon: <RefreshCw size={14} />, label: 'Làm mới trang', action: () => window.location.reload() },
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
                                <div style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
                                <button onClick={logout}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '10px 14px', background: 'none', border: 'none',
                                        cursor: 'pointer', fontSize: 13, color: '#ef4444', textAlign: 'left',
                                        marginBottom: 4,
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

            {/* Backdrop */}
            {(showNotif || showProfile) && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 199 }}
                    onClick={() => { setShowNotif(false); setShowProfile(false); }} />
            )}

            <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
        </header>
    );
};

// ── AdminLayout ───────────────────────────────────────────────
const AdminLayout: React.FC = () => {
    const { isAuthenticated, user } = useAuth();
    const [collapsed, setCollapsed] = useState(false);

    if (!isAuthenticated) return <Navigate to="/admin" replace />;
    if (user?.role !== 'admin') return <Navigate to="/" replace />;

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
            <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(p => !p)} />
            <div style={{
                flex: 1,
                marginLeft: collapsed ? 72 : 260,
                transition: 'margin-left 0.3s cubic-bezier(0.22,1,0.36,1)',
                display: 'flex', flexDirection: 'column', minHeight: '100vh',
            }}>
                <AdminTopbar sidebarCollapsed={collapsed} />
                <main style={{
                    marginTop: 64,
                    flex: 1,
                    padding: '24px',
                    overflowY: 'auto',
                }}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
