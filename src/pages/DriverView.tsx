/**
 * DriverView.tsx – Giao diện Tài xế
 * Bản đồ hiển thị trên cùng, thông tin + RFID bên dưới, không dùng tab
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, Square, AlertTriangle, Users,
    Bus, CreditCard, Route,
    CheckCircle, ArrowUpCircle, ArrowDownCircle,
    Loader2, MapPin, Clock, Phone,
} from 'lucide-react';
import { attendanceAPI, busAPI, alertAPI, routeAPI } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import DriverMap from '../components/DriverMap';
import { toast } from 'react-toastify';

interface LogEntry {
    _id: string;
    student_id: { fullName: string; studentCode: string; class: string } | null;
    bus_id: { licensePlate: string } | null;
    scan_time: string;
    action_type: 'Boarding' | 'Dropping';
}

interface BusInfo {
    _id: string;
    licensePlate: string;
    name?: string;
    isOnline: boolean;
    currentSpeed?: number;
    currentLat?: number;
    currentLng?: number;
    capacity?: number;
    driver_id?: { _id: string; fullName: string } | null;
    route_id?: {
        _id: string;
        routeName: string;
        // stops được populate đầy đủ từ routeAPI.getById
        stops?: { stopName: string; order: number; lat: number; lng: number; expected_time?: string }[];
        schoolPos?: { lat: number; lng: number };
    } | null;
}

const fmtTime = (ts: string) =>
    new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
    <div style={{
        background: '#1e293b',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        ...style,
    }}>
        {children}
    </div>
);

const DriverView: React.FC = () => {
    const { user } = useAuth();
    const { connected: socketConnected, recentSwipes, gpsUpdates } = useSocket();

    const [tripActive, setTripActive] = useState(false);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [myBus, setMyBus] = useState<BusInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [sosLoading, setSosLoading] = useState(false);
    const [sosSent, setSosSent] = useState(false);
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [elapsed, setElapsed] = useState('00:00:00');
    const [sosMsg, setSosMsg] = useState('');
    const [showSosInput, setShowSosInput] = useState(false);

    const [allRoutes, setAllRoutes] = useState<any[]>([]);
    const [selectedRouteId, setSelectedRouteId] = useState<string>('');

    const todayISO = new Date().toISOString().slice(0, 10);

    // Lấy danh sách tuyến trên mount
    useEffect(() => {
        routeAPI.getAll().then(res => setAllRoutes(res.data.data)).catch(console.error);
    }, []);

    // Đếm giờ chạy chuyến
    useEffect(() => {
        if (!tripActive || !startTime) return;
        const interval = setInterval(() => {
            const diff = Date.now() - startTime.getTime();
            const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
            const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            setElapsed(`${h}:${m}:${s}`);
        }, 1000);
        return () => clearInterval(interval);
    }, [tripActive, startTime]);

    const fetchData = useCallback(async () => {
        try {
            const [logsRes, busRes] = await Promise.all([
                attendanceAPI.getLogs({ limit: '60', from: todayISO, to: todayISO }),
                busAPI.getAll(),
            ]);
            setLogs(logsRes.data.data as LogEntry[]);
            const buses = busRes.data.data as BusInfo[];
            const assigned = buses.find(b =>
                b.driver_id && (b.driver_id._id === user?.id || b.driver_id.fullName === user?.fullName)
            ) ?? buses[0] ?? null;

            if (assigned) {
                let targetRouteId: string | undefined = selectedRouteId;
                if (!targetRouteId) {
                    targetRouteId = typeof assigned.route_id === 'string'
                        ? assigned.route_id
                        : assigned.route_id?._id;
                }
                
                // Fallback nếu vẫn không có (xe chưa gán tuyến)
                if (!targetRouteId) {
                    if (allRoutes && allRoutes.length > 0) {
                        targetRouteId = allRoutes[0]._id;
                    } else {
                        try {
                            const allRoutesRes = await routeAPI.getAll();
                            const routesList = allRoutesRes.data.data;
                            if (routesList && routesList.length > 0) {
                                targetRouteId = routesList[0]._id;
                            }
                        } catch (e) {}
                    }
                }
                
                if (targetRouteId) {
                    try {
                        const routeRes = await routeAPI.getById(targetRouteId);
                        const fullRoute = routeRes.data.data;
                        assigned.route_id = {
                            _id: fullRoute._id,
                            routeName: fullRoute.routeName,
                            stops: fullRoute.stops ?? [],
                            schoolPos: fullRoute.schoolPos,
                        };
                        
                        if (!selectedRouteId) {
                            setSelectedRouteId(fullRoute._id);
                        }
                    } catch (err) {
                        console.error('[DriverView] ❌ Lỗi fetch route:', err);
                    }
                }
            }

            console.log('[DriverView] Final assigned bus:', assigned);
            setMyBus(assigned);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [todayISO, user, selectedRouteId, allRoutes]);

    useEffect(() => {
        fetchData();
        const t = setInterval(fetchData, 15000);
        return () => clearInterval(t);
    }, [fetchData]);

    const prevSwipe = useRef<typeof recentSwipes[0]>(undefined);
    useEffect(() => {
        const latest = recentSwipes[0];
        if (!latest || latest === prevSwipe.current) return;
        prevSwipe.current = latest;
        fetchData();
    }, [recentSwipes, fetchData]);

    const { lastStudentStatus } = useSocket();
    const prevStatus = useRef<typeof lastStudentStatus>(null);
    useEffect(() => {
        if (!lastStudentStatus || lastStudentStatus === prevStatus.current) return;
        prevStatus.current = lastStudentStatus;
        if (lastStudentStatus.status === 'Absent') {
            const reasonText = lastStudentStatus.reason ? ` · Lý do: ${lastStudentStatus.reason}` : '';
            toast.warning(`⚠️ Học sinh ${lastStudentStatus.studentName} đã báo vắng mặt hôm nay${reasonText}. Vui lòng bỏ qua điểm đón này.`, { autoClose: 10000 });
        }
    }, [lastStudentStatus]);

    const handleTripToggle = () => {
        if (!tripActive) { setStartTime(new Date()); setElapsed('00:00:00'); }
        else { setStartTime(null); }
        setTripActive(p => !p);
    };

    const handleSOS = async () => {
        if (sosLoading || sosSent) return;
        setSosLoading(true);
        try {
            await alertAPI.createAlert({
                type: 'SOS',
                message: `🆘 SOS từ tài xế ${user?.fullName ?? ''} · Xe ${myBus?.licensePlate ?? '?'} · ${sosMsg || 'Khẩn cấp cần hỗ trợ'} · ${new Date().toLocaleTimeString('vi-VN')}`,
                severity: 'danger',
            });
        } catch { /* vẫn hiện feedback */ }
        finally {
            setSosLoading(false); setSosSent(true);
            setShowSosInput(false); setSosMsg('');
            setTimeout(() => setSosSent(false), 15000);
        }
    };

    const boardingMap: Record<string, number> = {};
    logs.forEach(l => {
        const key = l.student_id?.studentCode ?? l._id;
        boardingMap[key] = (boardingMap[key] ?? 0) + (l.action_type === 'Boarding' ? 1 : -1);
    });
    const onBusNow = Object.values(boardingMap).filter(v => v > 0).length;
    const totalBoardings = logs.filter(l => l.action_type === 'Boarding').length;
    const totalDroppings = logs.filter(l => l.action_type === 'Dropping').length;

    return (
        <div style={{ color: 'white', minHeight: 'calc(100vh - 64px)', background: '#0f172a' }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse-green { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); } 50% { box-shadow: 0 0 0 10px rgba(16,185,129,0); } }
            `}</style>

            {/* ══ BẢN ĐỒ — luôn hiển thị trên cùng ══ */}
            <div style={{ position: 'relative' }}>
                <DriverMap
                    busLat={myBus?.currentLat}
                    busLng={myBus?.currentLng}
                    busPlate={myBus?.licensePlate}
                    busId={myBus?._id}
                    gpsUpdates={gpsUpdates}
                    routeData={myBus?.route_id && typeof myBus.route_id !== 'string' ? {
                        _id: myBus.route_id._id,
                        routeName: myBus.route_id.routeName,
                        stops: myBus.route_id.stops ?? [],
                        schoolPos: myBus.route_id.schoolPos,
                    } : null}
                    tripActive={tripActive}
                />

                {/* Trạng thái chuyến — overlay góc trái bản đồ */}
                <div style={{
                    position: 'absolute', top: 12, left: 12, zIndex: 1002,
                    background: tripActive ? 'rgba(5,150,105,0.9)' : 'rgba(15,23,42,0.85)',
                    backdropFilter: 'blur(8px)',
                    border: tripActive ? '1px solid rgba(16,185,129,0.6)' : '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10, padding: '6px 14px',
                    display: 'flex', alignItems: 'center', gap: 10,
                }}>
                    {tripActive && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', display: 'inline-block', animation: 'pulse-green 2s infinite' }} />}
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>
                        {tripActive ? elapsed : '⚪ Chưa bắt đầu'}
                    </span>
                    <motion.button
                        onClick={handleTripToggle}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            background: tripActive ? '#ef4444' : '#10B981',
                            color: 'white', fontWeight: 700, fontSize: 12,
                        }}
                    >
                        {tripActive ? <><Square size={12} /> Kết thúc</> : <><Play size={12} /> Bắt đầu</>}
                    </motion.button>
                </div>
            </div>

            {/* ══ PHẦN BÊN DƯỚI BẢN ĐỒ ══ */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* KPI strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    {[
                        { label: 'Đang trên xe', value: onBusNow, icon: Users, color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
                        { label: 'Đã lên xe', value: totalBoardings, icon: ArrowUpCircle, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
                        { label: 'Đã xuống xe', value: totalDroppings, icon: ArrowDownCircle, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
                    ].map(card => (
                        <motion.div key={card.label} whileHover={{ y: -2 }} style={{
                            padding: '14px', borderRadius: 12, background: card.bg,
                            border: `1px solid ${card.color}30`, textAlign: 'center',
                        }}>
                            <card.icon size={20} color={card.color} style={{ display: 'block', margin: '0 auto 6px' }} />
                            <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: card.color }}>{card.value}</p>
                            <p style={{ margin: '3px 0 0', fontSize: 11, color: '#64748b' }}>{card.label}</p>
                        </motion.div>
                    ))}
                </div>

                {/* Thông tin xe + SOS */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                    <Card style={{ padding: '14px 18px' }}>
                        {loading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b' }}>
                                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                                <span style={{ fontSize: 13 }}>Đang tải thông tin xe...</span>
                            </div>
                        ) : myBus ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                                    background: myBus.isOnline ? 'linear-gradient(135deg,#059669,#10B981)' : '#334155',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Bus size={22} color="white" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{myBus.name ?? myBus.licensePlate}</p>
                                    <div style={{ display: 'flex', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                                        {allRoutes.length > 0 && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
                                                <Route size={10} />
                                                <select
                                                    value={selectedRouteId}
                                                    onChange={(e) => setSelectedRouteId(e.target.value)}
                                                    style={{
                                                        background: 'transparent', border: 'none',
                                                        color: '#3B82F6', outline: 'none', cursor: 'pointer',
                                                        fontWeight: 600, fontSize: 12, padding: 0
                                                    }}
                                                >
                                                    {allRoutes.map(r => (
                                                        <option key={r._id} value={r._id} style={{ color: 'black' }}>
                                                            {r.routeName}
                                                        </option>
                                                    ))}
                                                </select>
                                            </span>
                                        )}
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
                                            <MapPin size={10} /> {Math.round(myBus.currentSpeed ?? 0)} km/h
                                        </span>
                                        {myBus.capacity && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#94a3b8' }}>
                                                <Users size={10} /> {onBusNow}/{myBus.capacity} chỗ
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
                                    background: myBus.isOnline ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.2)',
                                    color: myBus.isOnline ? '#10B981' : '#64748b',
                                }}>
                                    {myBus.isOnline ? 'ONLINE' : 'OFFLINE'}
                                </span>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b' }}>
                                <Bus size={16} /><span style={{ fontSize: 13 }}>Chưa được phân công xe</span>
                            </div>
                        )}
                    </Card>

                    {/* SOS Button */}
                    <motion.button
                        onClick={() => sosSent ? undefined : setShowSosInput(p => !p)}
                        whileHover={{ scale: sosSent ? 1 : 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={sosLoading}
                        style={{
                            padding: '0 20px', borderRadius: 14, minWidth: 80,
                            background: sosSent ? 'rgba(16,185,129,0.15)' : showSosInput ? '#dc2626' : '#ef4444',
                            color: sosSent ? '#10B981' : 'white',
                            border: sosSent ? '1px solid rgba(16,185,129,0.4)' : 'none',
                            cursor: sosSent ? 'default' : 'pointer',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: 5,
                            fontWeight: 700, fontSize: 13,
                            boxShadow: sosSent ? 'none' : '0 4px 20px rgba(239,68,68,0.5)',
                        }}
                    >
                        {sosSent ? <><CheckCircle size={20} /><span>Đã gửi</span></> :
                            sosLoading ? <><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span>Gửi...</span></> :
                                <><AlertTriangle size={20} /><span>SOS</span></>}
                    </motion.button>
                </div>

                {/* SOS input panel */}
                <AnimatePresence>
                    {showSosInput && !sosSent && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ overflow: 'hidden' }}
                        >
                            <Card style={{ padding: '14px 16px', border: '1px solid rgba(239,68,68,0.4)' }}>
                                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <AlertTriangle size={14} /> Gửi cảnh báo SOS tới Admin
                                </p>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        type="text" value={sosMsg} onChange={e => setSosMsg(e.target.value)}
                                        placeholder="Mô tả tình huống (tuỳ chọn)..."
                                        style={{
                                            flex: 1, padding: '9px 12px', borderRadius: 8,
                                            background: '#0f172a', border: '1px solid rgba(239,68,68,0.4)',
                                            color: 'white', fontSize: 13, outline: 'none',
                                        }}
                                        onKeyDown={e => e.key === 'Enter' && handleSOS()}
                                    />
                                    <motion.button
                                        onClick={handleSOS}
                                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                        style={{
                                            padding: '9px 16px', borderRadius: 8, border: 'none',
                                            background: '#ef4444', color: 'white', fontWeight: 700,
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13,
                                        }}
                                    >
                                        <Phone size={13} /> Gửi SOS
                                    </motion.button>
                                </div>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Nhật ký RFID */}
                <Card style={{ padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
                            <CreditCard size={15} color="#3B82F6" /> Nhật ký RFID hôm nay
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 11, background: 'rgba(59,130,246,0.15)', color: '#3B82F6', padding: '2px 9px', borderRadius: 20, fontWeight: 600, border: '1px solid rgba(59,130,246,0.3)' }}>
                                {logs.length} lượt
                            </span>
                            {socketConnected && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#10B981' }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} /> Live
                                </span>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px', color: '#3B82F6' }} />
                            <span style={{ fontSize: 12, color: '#64748b' }}>Đang tải...</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <CreditCard size={32} style={{ opacity: 0.15, display: 'block', margin: '0 auto 8px', color: '#94a3b8' }} />
                            <p style={{ margin: 0, color: '#64748b', fontSize: 12 }}>Chưa có lượt quẹt thẻ nào hôm nay</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
                            <AnimatePresence initial={false}>
                                {logs.slice(0, 40).map((log, i) => (
                                    <motion.div
                                        key={log._id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i < 5 ? i * 0.04 : 0 }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10,
                                            padding: '9px 12px', borderRadius: 10,
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.06)',
                                        }}
                                    >
                                        <div style={{
                                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                            background: log.action_type === 'Boarding' ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {log.action_type === 'Boarding'
                                                ? <ArrowUpCircle size={14} color="#10B981" />
                                                : <ArrowDownCircle size={14} color="#3B82F6" />}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontWeight: 600, fontSize: 12, color: 'white' }}>
                                                {log.student_id?.fullName ?? 'Không xác định'}
                                            </p>
                                            <p style={{ margin: '1px 0 0', fontSize: 10, color: '#64748b' }}>
                                                {log.student_id?.class ?? '—'} · {log.student_id?.studentCode ?? '—'}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <p style={{ margin: 0, fontSize: 12, display: 'flex', alignItems: 'center', gap: 3, color: '#94a3b8' }}>
                                                <Clock size={10} /> {fmtTime(log.scan_time)}
                                            </p>
                                            <p style={{ margin: '1px 0 0', fontSize: 10, fontWeight: 700, color: log.action_type === 'Boarding' ? '#10B981' : '#3B82F6' }}>
                                                {log.action_type === 'Boarding' ? '↑ Lên xe' : '↓ Xuống xe'}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
};

export default DriverView;
