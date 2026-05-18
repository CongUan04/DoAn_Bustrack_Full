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
    Loader2, Wifi, WifiOff, CheckCircle,
    GraduationCap, Route, User, Mail, X, AlertTriangle, XCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import { attendanceAPI, busAPI, studentAPI, routeAPI } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useOutletContext } from 'react-router-dom';

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
    html: `<div style="width:32px;height:32px;background:var(--surface);border:3px solid ${online ? '#10B981' : '#9CA3AF'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 3px 10px rgba(0,0,0,0.2)">🚌</div>`,
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
    studyDays?: number[]; // 0=CN,1=T2,...,6=T7
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

// ── Main Component ──────────────────────────────────────────────
const ParentView: React.FC = () => {
    const { user } = useAuth();
    const { connected: socketConnected, recentSwipes, gpsUpdates } = useSocket();
    const { openProfile } = useOutletContext<{ openProfile: () => void }>();

    const [children, setChildren] = useState<StudentInfo[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [buses, setBuses] = useState<BusInfo[]>([]);
    const [routes, setRoutes] = useState<RouteData[]>([]);
    const [loading, setLoading] = useState(true);

    const [dismissBanner, setDismissBanner] = useState(false);
    const needEmailSetup = !user?.isEmailSet && !dismissBanner;

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

        } catch {
            // silent fail
        } finally {
            setLoading(false);
        }
    }, [todayISO]);

    const handleMarkAbsent = async (childId: string, childName: string) => {
        if (!window.confirm(`Bạn có chắc chắn muốn báo vắng mặt hôm nay cho học sinh ${childName} không? Xe buýt sẽ không đón học sinh này.`)) return;
        try {
            await studentAPI.markAbsent(childId);
            toast.success(`Đã báo vắng mặt cho ${childName}. Tài xế đã được thông báo.`);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi báo vắng mặt');
        }
    };

    const handleToggleStudyDay = async (child: StudentInfo, day: number) => {
        const current = child.studyDays ?? [1, 2, 3, 4, 5];
        const updated = current.includes(day)
            ? current.filter(d => d !== day)
            : [...current, day].sort();
        try {
            await studentAPI.updateStudyDays(child._id, updated);
            setChildren(prev => prev.map(c => c._id === child._id ? { ...c, studyDays: updated } : c));
            toast.success('Đã cập nhật lịch học!');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Lỗi cập nhật lịch học');
        }
    };

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
                            background: 'var(--warning-light)',
                            border: '1.5px solid rgba(245, 158, 11, 0.4)',
                            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                        }}
                    >
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <AlertTriangle size={20} color="white" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--warning)' }}>⚠️ Tài khoản chưa có Gmail thật</p>
                            <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
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
                                padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.4)',
                                background: 'transparent', color: 'var(--warning)', cursor: 'pointer',
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
                        background: socketConnected ? 'var(--success-light)' : 'var(--danger-light)',
                        color: socketConnected ? 'var(--success)' : 'var(--danger)',
                        padding: '6px 12px', borderRadius: 20, fontWeight: 500, border: `1px solid ${socketConnected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`
                    }}>
                        {socketConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {socketConnected ? 'Live' : 'Mất kết nối'}
                    </div>


                    <button onClick={fetchData} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px', borderRadius: 10, color: 'var(--text-primary)',
                        background: 'var(--surface)', border: '1px solid var(--border)',
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
                <motion.div whileHover={{ y: -2 }} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <p style={{ margin: 0, opacity: 0.5, fontSize: 12, color: 'var(--text-primary)' }}>Xe đang hoạt động</p>
                            <p style={{ margin: '8px 0 0', fontSize: 26, fontWeight: 700, color: 'var(--primary)' }}>{onlineBuses.length}</p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, opacity: 0.5, color: 'var(--text-primary)' }}>/ {buses.length} xe tổng cộng</p>
                        </div>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Bus size={20} color="var(--primary)" />
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
                    <div style={{ padding: '20px', background: 'var(--surface-hover)', borderRadius: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        Chưa có học sinh nào liên kết với tài khoản này
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                        {children.map(child => {
                            const latestChildLog = logs.find(l => l.student_id?._id === child._id);
                            const isOnBus = child.currentStatus === 'On_Bus';
                            return (
                                <motion.div key={child._id} whileHover={{ y: -2 }} style={{
                                    background: 'var(--surface)', borderRadius: 14,
                                    border: `2px solid ${isOnBus ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
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
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>{child.fullName}</p>
                                            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: 10, background: 'var(--purple-light)', color: '#7c3aed', padding: '2px 7px', borderRadius: 20, fontWeight: 600 }}>Lớp {child.class}</span>
                                                <span style={{ fontSize: 10, background: 'var(--bg)', color: 'var(--text-secondary)', padding: '2px 7px', borderRadius: 20 }}>{child.studentCode}</span>
                                            </div>
                                        </div>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
                                            background: child.currentStatus === 'Absent' ? 'var(--danger-light)' : isOnBus ? 'var(--success-light)' : 'var(--bg)',
                                            color: child.currentStatus === 'Absent' ? 'var(--danger)' : isOnBus ? 'var(--success)' : 'var(--text-secondary)',
                                            flexShrink: 0, border: child.currentStatus === 'Absent' ? '1px solid rgba(239,68,68,0.3)' : isOnBus ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
                                        }}>
                                            {child.currentStatus === 'Absent' ? '🔴 Nghỉ phép' : isOnBus ? '🟢 Trên xe' : '⚪ Chưa lên'}
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
                                        <div style={{ marginTop: 10, padding: '8px 10px', background: latestChildLog.action_type === 'Boarding' ? 'var(--success-light)' : 'var(--primary-light)', borderRadius: 8, fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}>
                                            {latestChildLog.action_type === 'Boarding'
                                                ? <ArrowUpCircle size={13} color="var(--success)" />
                                                : <ArrowDownCircle size={13} color="var(--primary)" />}
                                            <span style={{ color: latestChildLog.action_type === 'Boarding' ? 'var(--success)' : 'var(--primary)', fontWeight: 600 }}>
                                                {latestChildLog.action_type === 'Boarding' ? 'Lên xe' : 'Xuống xe'}
                                            </span>
                                            <span style={{ color: 'var(--text-secondary)' }}>lúc {fmtTime(latestChildLog.scan_time)}</span>
                                        </div>
                                    )}

                                    {/* ── Thời khóa biểu ── */}
                                    {(() => {
                                        const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                                        const todayDow = new Date().getDay();
                                        const studyDays = child.studyDays ?? [1, 2, 3, 4, 5];
                                        const hasTodayClass = studyDays.includes(todayDow);
                                        return (
                                            <div style={{ marginTop: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>
                                                        📅 Lịch học trong tuần
                                                    </span>
                                                    {!hasTodayClass && child.currentStatus !== 'Absent' && (
                                                        <span style={{ fontSize: 10, background: 'var(--warning-light)', color: 'var(--warning)', padding: '2px 7px', borderRadius: 10, fontWeight: 700 }}>
                                                            ⚠️ Hôm nay không học
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                                    {DAY_LABELS.map((label, dow) => {
                                                        const isStudy = studyDays.includes(dow);
                                                        const isToday = dow === todayDow;
                                                        return (
                                                            <button
                                                                key={dow}
                                                                onClick={() => handleToggleStudyDay(child, dow)}
                                                                title={isStudy ? 'Bấm để bỏ ngày học' : 'Bấm để thêm ngày học'}
                                                                style={{
                                                                    width: 34, height: 28, borderRadius: 7,
                                                                    border: isToday ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                                                                    background: isStudy
                                                                        ? isToday ? 'var(--primary)' : 'var(--primary-light)'
                                                                        : 'var(--bg)',
                                                                    color: isStudy
                                                                        ? isToday ? 'white' : 'var(--primary)'
                                                                        : 'var(--text-muted)',
                                                                    fontSize: 10, fontWeight: isToday ? 800 : 600,
                                                                    cursor: 'pointer',
                                                                    opacity: isStudy ? 1 : 0.45,
                                                                    transition: 'all 0.15s',
                                                                }}
                                                            >
                                                                {label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {child.currentStatus !== 'Absent' && !isOnBus && (
                                        <button
                                            onClick={() => handleMarkAbsent(child._id, child.fullName)}
                                            style={{
                                                marginTop: 12, width: '100%', padding: '8px 10px',
                                                background: 'var(--danger-light)', color: 'var(--danger)',
                                                border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                cursor: 'pointer', fontWeight: 600, fontSize: 12
                                            }}
                                        >
                                            <XCircle size={14} />
                                            Báo vắng mặt hôm nay
                                        </button>
                                    )}
                                    {child.currentStatus === 'Absent' && (
                                        <div style={{
                                            marginTop: 12, width: '100%', padding: '8px 10px',
                                            background: 'var(--surface-hover)', color: 'var(--text-secondary)',
                                            border: '1px solid var(--border)', borderRadius: 8,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                            fontWeight: 600, fontSize: 12
                                        }}>
                                            <XCircle size={14} />
                                            Đã báo vắng mặt
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
                <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
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
                                            <p style={{ fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>🚌 {bus.licensePlate}</p>
                                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>{bus.route_id?.routeName ?? 'Chưa có tuyến'}</p>
                                            <p style={{ fontSize: 12, margin: '4px 0 0', color: bus.isOnline ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{bus.isOnline ? `● Online · ${Math.round(bus.currentSpeed ?? 0)} km/h` : '● Offline'}</p>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
                </div>

                {/* Lịch sử điểm danh hôm nay */}
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                            <Calendar size={16} color="#7c3aed" />
                            Điểm danh hôm nay
                        </div>
                        <span style={{ fontSize: 12, background: 'var(--purple-light)', color: '#7c3aed', padding: '3px 10px', borderRadius: 20, fontWeight: 600 }}>
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
                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, background: 'var(--surface-hover)', border: '1px solid var(--border)' }}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                            background: log.action_type === 'Boarding' ? 'var(--success-light)' : 'var(--primary-light)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${log.action_type === 'Boarding' ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`
                                        }}>
                                            {log.action_type === 'Boarding' ? <ArrowUpCircle size={15} color="var(--success)" /> : <ArrowDownCircle size={15} color="var(--primary)" />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                                                {log.student_id?.fullName ?? 'Không xác định'}
                                            </p>
                                            <p style={{ margin: '1px 0 0', fontSize: 10, opacity: 0.55, color: 'var(--text-primary)' }}>
                                                {log.bus_id?.licensePlate ?? '—'}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{fmtTime(log.scan_time)}</p>
                                            <p style={{ margin: '1px 0 0', fontSize: 10, fontWeight: 600, color: log.action_type === 'Boarding' ? 'var(--success)' : 'var(--primary)' }}>
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
            <div onClick={openProfile} style={{
                padding: '14px 18px', borderRadius: 12, cursor: 'pointer',
                background: 'var(--surface)', border: '1px solid var(--border)',
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
                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{user?.fullName}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, opacity: 0.5, color: 'var(--text-primary)' }}>Phụ huynh · {user?.email}</p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <CheckCircle size={13} color="#059669" />
                    <span style={{ color: '#059669', fontWeight: 500 }}>Tài khoản hoạt động</span>
                </div>
            </div>

        </div>
    );
};

export default ParentView;
