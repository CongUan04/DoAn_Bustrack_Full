/**
 * ParentView.tsx - Giao diện Phụ huynh
 * - Thông tin học sinh con em
 * - Live map theo dõi xe
 * - Lịch sử điểm danh hôm nay
 * - Banner nhắc cập nhật Gmail nếu chưa có
 * - Modal chỉnh sửa thông tin tài khoản
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import {
    ArrowUpCircle, ArrowDownCircle, Bus, CreditCard,
    MapPin, Calendar, RefreshCw,
    Loader2, Wifi, WifiOff, CheckCircle, Clock,
    GraduationCap, Route, User, Mail, Lock, X, AlertTriangle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { attendanceAPI, busAPI, studentAPI, routeAPI, authAPI } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SCHOOL_ICON = L.divIcon({
    className: '',
    html: `<div style="font-size:26px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">🏫</div>`,
    iconSize: [30, 30], iconAnchor: [15, 30],
});
const makeBusIcon = (online: boolean) => L.divIcon({
    className: '',
    html: `<div style="width:32px;height:32px;background:white;border:3px solid ${online ? '#10B981' : '#9CA3AF'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 3px 10px rgba(0,0,0,0.2)">🚌</div>`,
    iconSize: [32, 32], iconAnchor: [16, 16],
});

// ── Types ───────────────────────────────────────────────────────
interface StudentInfo {
    _id: string;
    studentCode: string;
    fullName: string;
    class: string;
    rfid_uid?: string;
    currentStatus?: string;
    fatherPhone?: string;
    motherPhone?: string;
    route_id?: { _id: string; routeName: string; stops: { lat: number; lng: number; order: number }[]; schoolPos?: { lat: number; lng: number } } | null;
}

interface LogEntry {
    _id: string;
    student_id: { _id: string; fullName: string; studentCode: string; class: string } | null;
    bus_id: { licensePlate: string } | null;
    scan_time: string;
    action_type: 'Boarding' | 'Dropping';
}

interface BusInfo {
    _id: string;
    licensePlate: string;
    name?: string;
    currentLat?: number | null;
    currentLng?: number | null;
    currentSpeed?: number;
    isOnline: boolean;
    route_id?: { _id: string; routeName: string } | null;
}

interface RouteData {
    _id: string;
    routeName: string;
    stops: { lat: number; lng: number; order: number }[];
    schoolPos?: { lat: number; lng: number };
}

const fmtTime = (ts: string) =>
    new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const fmtDate = (ts: string) =>
    new Date(ts).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });

// ── Main Component ──────────────────────────────────────────────
const ParentView: React.FC = () => {
    const { user, updateUser } = useAuth();
    const { connected: socketConnected, recentSwipes, gpsUpdates } = useSocket();

    const [children, setChildren] = useState<StudentInfo[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [buses, setBuses] = useState<BusInfo[]>([]);
    const [routes, setRoutes] = useState<RouteData[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    // ── Profile modal state ─────────────────────────────────────
    const [showProfile, setShowProfile] = useState(false);
    const [profileForm, setProfileForm] = useState({ fullName: '', email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [dismissBanner, setDismissBanner] = useState(false);

    const needEmailSetup = !user?.isEmailSet && !dismissBanner;

    // Mở modal và prefill từ user hiện tại
    const openProfile = () => {
        setProfileForm({ fullName: user?.fullName ?? '', email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
        setProfileMsg(null);
        setShowProfile(true);
    };

    const handleProfileSave = async () => {
        if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) {
            setProfileMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp' });
            return;
        }
        setProfileLoading(true);
        setProfileMsg(null);
        try {
            const payload: Record<string, string> = {};
            if (profileForm.fullName && profileForm.fullName !== user?.fullName) payload.fullName = profileForm.fullName;
            if (profileForm.email) payload.email = profileForm.email;
            if (profileForm.newPassword) { payload.currentPassword = profileForm.currentPassword; payload.newPassword = profileForm.newPassword; }

            const res = await authAPI.updateProfile(payload);
            const updated = res.data.data;
            updateUser({ fullName: updated.fullName, email: updated.email, isEmailSet: updated.isEmailSet });
            setProfileMsg({ type: 'success', text: 'Cập nhật thành công!' });
            setProfileForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Lỗi cập nhật';
            setProfileMsg({ type: 'error', text: msg });
        } finally {
            setProfileLoading(false);
        }
    };

    const todayISO = new Date().toISOString().slice(0, 10);
    const childIds = children.map(c => c._id);

    const fetchData = useCallback(async () => {
        try {
            const [childRes, busRes, routeRes] = await Promise.all([
                studentAPI.getMyChildren(),
                busAPI.getAll(),
                routeAPI.getAll(),
            ]);
            const fetchedChildren: StudentInfo[] = childRes.data.data;
            setChildren(fetchedChildren);
            setBuses(busRes.data.data);
            setRoutes(routeRes.data.data);

            // Load attendance logs for each child
            if (fetchedChildren.length > 0) {
                const logPromises = fetchedChildren.map(c =>
                    attendanceAPI.getLogs({ student_id: c._id, from: todayISO, to: todayISO, limit: '50' })
                );
                const logResults = await Promise.all(logPromises);
                const allLogs: LogEntry[] = logResults.flatMap(r => r.data.data);
                allLogs.sort((a, b) => new Date(b.scan_time).getTime() - new Date(a.scan_time).getTime());
                setLogs(allLogs);
            }

            setLastUpdate(new Date());
        } catch {
            // silent fail
        } finally {
            setLoading(false);
        }
    }, [todayISO]);

    useEffect(() => {
        fetchData();
        const t = setInterval(fetchData, 30000);
        return () => clearInterval(t);
    }, [fetchData]);

    // Real-time GPS update
    useEffect(() => {
        if (Object.keys(gpsUpdates).length === 0) return;
        setBuses(prev => prev.map(bus => {
            const upd = gpsUpdates[bus._id];
            if (!upd) return bus;
            return { ...bus, currentLat: upd.lat, currentLng: upd.lng, currentSpeed: upd.speed, isOnline: true, lastSeen: upd.timestamp };
        }));
    }, [gpsUpdates]);

    // Real-time RFID toast (only for own children)
    const latestSwipe = recentSwipes[0];
    const prevSwipeRef = useRef<typeof latestSwipe>(undefined);
    useEffect(() => {
        if (!latestSwipe || latestSwipe === prevSwipeRef.current) return;
        prevSwipeRef.current = latestSwipe;
        const isMyChild = childIds.includes(latestSwipe.studentId ?? '');
        if (!isMyChild && children.length > 0) return;
        if (latestSwipe.action === 'lên xe') {
            toast.success(`🟢 Lên xe · ${latestSwipe.licensePlate ?? ''}\n${latestSwipe.studentName}`);
        } else {
            toast.info(`🔵 Xuống xe · ${latestSwipe.licensePlate ?? ''}\n${latestSwipe.studentName}`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [latestSwipe]);

    const latestLog = logs[0];
    const onlineBuses = buses.filter(b => b.isOnline);

    // Map center: dùng vị trí trường học của tuyến con em, hoặc trung tâm mặc định
    const mapCenter: [number, number] = (() => {
        for (const child of children) {
            if (child.route_id?.schoolPos) {
                return [child.route_id.schoolPos.lat, child.route_id.schoolPos.lng];
            }
        }
        return [20.9764, 105.7777];
    })();

    return (
        <div style={{ padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
            {/* ── Banner nhắc cập nhật Gmail ─────────────────── */}
            <AnimatePresence>
                {needEmailSetup && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                            marginBottom: 18, padding: '14px 18px', borderRadius: 14,
                            background: 'linear-gradient(135deg,#fffbeb,#fef3c7)',
                            border: '1.5px solid #fbbf24',
                            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                        }}
                    >
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <AlertTriangle size={20} color="white" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#92400e' }}>⚠️ Tài khoản chưa có Gmail thật</p>
                            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#78350f', opacity: 0.85 }}>
                                Vui lòng cập nhật Gmail để có thể đặt lại mật khẩu và nhận thông báo quan trọng từ hệ thống.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            <button onClick={openProfile} style={{
                                padding: '8px 16px', borderRadius: 10, border: 'none',
                                background: '#f59e0b', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                            }}>
                                <Mail size={13} style={{ display: 'inline', marginRight: 5 }} />
                                Cập nhật Gmail
                            </button>
                            <button onClick={() => setDismissBanner(true)} style={{
                                padding: '8px 10px', borderRadius: 10, border: '1px solid #fbbf24',
                                background: 'transparent', color: '#92400e', cursor: 'pointer',
                            }}>
                                <X size={14} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
                        Xin chào, {user?.fullName?.split(' ').pop()} 👋
                    </h1>
                    <p style={{ margin: '4px 0 0', opacity: 0.55, fontSize: 13 }}>Theo dõi con em và xe buýt trường</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                        background: socketConnected ? '#f0fdf4' : '#fef2f2',
                        color: socketConnected ? '#059669' : '#dc2626',
                        padding: '6px 12px', borderRadius: 20, fontWeight: 500,
                    }}>
                        {socketConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {socketConnected ? 'Live' : 'Mất kết nối'}
                    </div>

                    <button onClick={fetchData} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px', borderRadius: 10,
                        background: '#fff', border: '1px solid #e2e8f0',
                        cursor: 'pointer', fontSize: 13, fontWeight: 500,
                    }}>
                        <RefreshCw size={13} /> Cập nhật
                    </button>
                </div>
            </div>

            {/* ── KPI cards ─────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
                <motion.div whileHover={{ y: -2 }} style={{
                    background: latestLog?.action_type === 'Boarding'
                        ? 'linear-gradient(135deg,#059669,#10b981)'
                        : latestLog?.action_type === 'Dropping'
                            ? 'linear-gradient(135deg,#2563eb,#3b82f6)'
                            : 'linear-gradient(135deg,#64748b,#94a3b8)',
                    color: 'white', borderRadius: 14, padding: '18px 20px',
                    boxShadow: '0 4px 18px rgba(0,0,0,0.13)',
                }}>
                    <p style={{ margin: 0, opacity: 0.85, fontSize: 12 }}>Trạng thái hôm nay</p>
                    <p style={{ margin: '8px 0 0', fontSize: 18, fontWeight: 700 }}>
                        {latestLog?.action_type === 'Boarding' ? '🟢 Đã lên xe'
                            : latestLog?.action_type === 'Dropping' ? '🔵 Đã xuống xe'
                                : '⚪ Chưa có dữ liệu'}
                    </p>
                    {latestLog && <p style={{ margin: '4px 0 0', fontSize: 11, opacity: 0.85 }}>{fmtTime(latestLog.scan_time)} · Xe {latestLog.bus_id?.licensePlate ?? '—'}</p>}
                </motion.div>
                <motion.div whileHover={{ y: -2 }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <p style={{ margin: 0, opacity: 0.5, fontSize: 12 }}>Xe đang hoạt động</p>
                            <p style={{ margin: '8px 0 0', fontSize: 26, fontWeight: 700, color: '#2563eb' }}>{onlineBuses.length}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, opacity: 0.5 }}>/ {buses.length} xe tổng cộng</p>
                        </div>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Bus size={20} color="#2563eb" />
                        </div>
                    </div>
                </motion.div>
                <motion.div whileHover={{ y: -2 }} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <p style={{ margin: 0, opacity: 0.5, fontSize: 12 }}>Cập nhật lúc</p>
                            <p style={{ margin: '8px 0 0', fontSize: 18, fontWeight: 700 }}>{fmtTime(lastUpdate.toISOString())}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, opacity: 0.5 }}>{fmtDate(new Date().toISOString())}</p>
                        </div>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Clock size={20} color="#059669" />
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* ── Thông tin học sinh con em ──────────────────────── */}
            <div style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontWeight: 700, fontSize: 16 }}>
                    <GraduationCap size={18} color="#7c3aed" />
                    Học sinh của bạn
                </div>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                        <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                    </div>
                ) : children.length === 0 ? (
                    <div style={{ padding: '20px', background: '#f8fafc', borderRadius: 12, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                        Chưa có học sinh nào liên kết với tài khoản này
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                        {children.map(child => {
                            const latestChildLog = logs.find(l => l.student_id?._id === child._id);
                            const isOnBus = child.currentStatus === 'On_Bus';
                            return (
                                <motion.div key={child._id} whileHover={{ y: -2 }} style={{
                                    background: '#fff', borderRadius: 14,
                                    border: `2px solid ${isOnBus ? '#bbf7d0' : '#e2e8f0'}`,
                                    padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                            background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'white', fontWeight: 700, fontSize: 18,
                                        }}>
                                            {child.fullName.split(' ').pop()?.charAt(0)}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.fullName}</p>
                                            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: 10, background: '#ede9fe', color: '#7c3aed', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>Lớp {child.class}</span>
                                                <span style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', padding: '2px 7px', borderRadius: 20 }}>{child.studentCode}</span>
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                                            background: isOnBus ? '#dcfce7' : '#f1f5f9',
                                            color: isOnBus ? '#059669' : '#64748b',
                                            flexShrink: 0,
                                        }}>
                                            {isOnBus ? '🟢 Trên xe' : '⚪ Chưa lên'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#64748b' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <CreditCard size={12} color="#94a3b8" />
                                            <span>{child.rfid_uid || 'Chưa có thẻ'}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <Route size={12} color="#94a3b8" />
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.route_id?.routeName || '—'}</span>
                                        </div>
                                    </div>
                                    {latestChildLog && (
                                        <div style={{ marginTop: 10, padding: '8px 10px', background: latestChildLog.action_type === 'Boarding' ? '#f0fdf4' : '#eff6ff', borderRadius: 8, fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}>
                                            {latestChildLog.action_type === 'Boarding'
                                                ? <ArrowUpCircle size={13} color="#059669" />
                                                : <ArrowDownCircle size={13} color="#2563eb" />}
                                            <span style={{ color: latestChildLog.action_type === 'Boarding' ? '#059669' : '#2563eb', fontWeight: 600 }}>
                                                {latestChildLog.action_type === 'Boarding' ? 'Lên xe' : 'Xuống xe'}
                                            </span>
                                            <span style={{ color: '#64748b' }}>lúc {fmtTime(latestChildLog.scan_time)}</span>
                                        </div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Live Map + Danh sách điểm danh ───────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18, marginBottom: 20 }}>
                {/* Live Map */}
                <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <div style={{ padding: '14px 18px 0', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}>
                        <MapPin size={16} color="#2563eb" />
                        Bản đồ theo dõi xe
                        {socketConnected && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#059669', display: 'inline-block', marginLeft: 4, boxShadow: '0 0 0 3px rgba(5,150,105,0.2)', animation: 'pulse 2s infinite' }} />}
                    </div>
                    <div style={{ height: 340 }}>
                        <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
                        <MapContainer center={mapCenter} zoom={13} style={{ width: '100%', height: '100%' }} zoomControl={true}>
                            <TileLayer
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {/* School markers */}
                            {routes.filter(r => r.schoolPos?.lat && r.schoolPos?.lng).map(r => (
                                <Marker key={`school-${r._id}`} position={[r.schoolPos!.lat, r.schoolPos!.lng]} icon={SCHOOL_ICON}>
                                    <Popup><div style={{ padding: '8px 12px' }}><b>🏫 Trường học</b><br /><span style={{ fontSize: 11, color: '#64748b' }}>Tuyến: {r.routeName}</span></div></Popup>
                                </Marker>
                            ))}
                            {/* Route polylines */}
                            {routes.map((r, ri) => {
                                const sorted = [...r.stops].sort((a, b) => a.order - b.order);
                                if (sorted.length < 2) return null;
                                const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];
                                return <Polyline key={r._id} positions={sorted.map(s => [s.lat, s.lng])} color={colors[ri % colors.length]} weight={2} opacity={0.5} dashArray="6,4" />;
                            })}
                            {/* Bus markers */}
                            {buses.filter(b => b.currentLat && b.currentLng).map(bus => (
                                <Marker key={bus._id} position={[bus.currentLat!, bus.currentLng!]} icon={makeBusIcon(bus.isOnline)}>
                                    <Popup>
                                        <div style={{ padding: '10px 14px', minWidth: 160 }}>
                                            <p style={{ fontWeight: 700, margin: '0 0 4px' }}>🚌 {bus.licensePlate}</p>
                                            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{bus.route_id?.routeName ?? 'Chưa có tuyến'}</p>
                                            <p style={{ fontSize: 12, margin: '4px 0 0', color: bus.isOnline ? '#059669' : '#dc2626', fontWeight: 600 }}>{bus.isOnline ? `● Online · ${Math.round(bus.currentSpeed ?? 0)} km/h` : '● Offline'}</p>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
                </div>

                {/* Lịch sử điểm danh hôm nay */}
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}>
                            <Calendar size={16} color="#7c3aed" />
                            Điểm danh hôm nay
                        </div>
                        <span style={{ fontSize: 12, background: '#ede9fe', color: '#7c3aed', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
                            {logs.length} lượt
                        </span>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', maxHeight: 310, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                                <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                            </div>
                        ) : logs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px 0', opacity: 0.45, fontSize: 13 }}>
                                Chưa có lượt điểm danh hôm nay
                            </div>
                        ) : (
                            <AnimatePresence initial={false}>
                                {logs.map((log, i) => (
                                    <motion.div key={log._id}
                                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i < 5 ? i * 0.04 : 0 }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                            background: log.action_type === 'Boarding' ? '#dcfce7' : '#eff6ff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {log.action_type === 'Boarding' ? <ArrowUpCircle size={15} color="#059669" /> : <ArrowDownCircle size={15} color="#2563eb" />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {log.student_id?.fullName ?? 'Không xác định'}
                                            </p>
                                            <p style={{ margin: '1px 0 0', fontSize: 10, opacity: 0.55 }}>
                                                {log.bus_id?.licensePlate ?? '—'}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{fmtTime(log.scan_time)}</p>
                                            <p style={{ margin: '1px 0 0', fontSize: 10, fontWeight: 600, color: log.action_type === 'Boarding' ? '#059669' : '#2563eb' }}>
                                                {log.action_type === 'Boarding' ? '↑ Lên' : '↓ Xuống'}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </div>

            {/* Thông tin tài khoản */}
            <div style={{
                padding: '14px 18px', borderRadius: 12,
                background: '#fff', border: '1px solid #e2e8f0',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            }}>
                <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0,
                }}>
                    <User size={18} />
                </div>
                <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{user?.fullName}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, opacity: 0.5 }}>Phụ huynh · {user?.email}</p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <CheckCircle size={13} color="#059669" />
                    <span style={{ color: '#059669', fontWeight: 500 }}>Tài khoản hoạt động</span>
                </div>
            </div>

            {/* ── Profile Modal ─────────────────────────────────── */}
            <AnimatePresence>
                {showProfile && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setShowProfile(false)}
                            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 8000, backdropFilter: 'blur(3px)' }}
                        />
                        {/* Modal */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 30 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            style={{
                                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                                zIndex: 8001, width: '100%', maxWidth: 480,
                                background: '#fff', borderRadius: 20, padding: '28px 28px 24px',
                                boxShadow: '0 25px 60px rgba(0,0,0,0.2)',
                            }}
                        >
                            {/* Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <User size={20} color="white" />
                                    </div>
                                    <div>
                                        <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>Thông tin tài khoản</p>
                                        <p style={{ margin: 0, fontSize: 11, opacity: 0.5 }}>Đăng nhập bằng số ĐT: {user?.username}</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowProfile(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#64748b' }}>
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Fields */}
                            {[
                                { label: 'Họ và tên', icon: <User size={14} />, key: 'fullName', type: 'text', placeholder: 'Nhập họ tên...' },
                                { label: 'Gmail', icon: <Mail size={14} />, key: 'email', type: 'email', placeholder: user?.isEmailSet ? user?.email : '📧 Nhập Gmail thật của bạn...' },
                                { label: 'Mật khẩu hiện tại', icon: <Lock size={14} />, key: 'currentPassword', type: 'password', placeholder: 'Nhập mật khẩu đang dùng...' },
                                { label: 'Mật khẩu mới', icon: <Lock size={14} />, key: 'newPassword', type: 'password', placeholder: 'Để trống nếu không đổi...' },
                                { label: 'Xác nhận mật khẩu mới', icon: <Lock size={14} />, key: 'confirmPassword', type: 'password', placeholder: 'Nhập lại mật khẩu mới...' },
                            ].map(f => (
                                <div key={f.key} style={{ marginBottom: 14 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                                        {f.icon} {f.label}
                                        {f.key === 'email' && !user?.isEmailSet && (
                                            <span style={{ marginLeft: 4, fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '1px 7px', borderRadius: 20, fontWeight: 700 }}>Chưa cập nhật</span>
                                        )}
                                    </label>
                                    <input
                                        type={f.type}
                                        value={profileForm[f.key as keyof typeof profileForm]}
                                        onChange={e => setProfileForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                        placeholder={f.placeholder}
                                        style={{
                                            width: '100%', padding: '9px 12px', borderRadius: 10,
                                            border: `1.5px solid ${f.key === 'email' && !user?.isEmailSet ? '#fbbf24' : '#e2e8f0'}`,
                                            fontSize: 13, outline: 'none', boxSizing: 'border-box',
                                            background: f.key === 'email' && !user?.isEmailSet ? '#fffbeb' : '#f8fafc',
                                        }}
                                    />
                                </div>
                            ))}

                            {/* Message */}
                            <AnimatePresence>
                                {profileMsg && (
                                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                        style={{
                                            padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600,
                                            background: profileMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
                                            color: profileMsg.type === 'success' ? '#059669' : '#dc2626',
                                            border: `1px solid ${profileMsg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                                        }}
                                    >
                                        {profileMsg.type === 'success' ? '✅ ' : '❌ '}{profileMsg.text}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 10 }}>
                                <button onClick={() => setShowProfile(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                                    Huỷ
                                </button>
                                <button onClick={handleProfileSave} disabled={profileLoading} style={{
                                    flex: 2, padding: '10px', borderRadius: 10, border: 'none',
                                    background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: 'white',
                                    cursor: profileLoading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                    opacity: profileLoading ? 0.7 : 1,
                                }}>
                                    {profileLoading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                                    {profileLoading ? 'Đang lưu...' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ParentView;
