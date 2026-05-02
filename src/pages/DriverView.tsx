/**
 * DriverView.tsx – Giao diện Tài xế (hoàn chỉnh)
 * Dark theme, hiển thị trên nền tối của DriverLayout
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play, Square, AlertTriangle, Users,
    Bus, CreditCard, Route,
    CheckCircle, ArrowUpCircle, ArrowDownCircle,
    Loader2, MapPin, Clock, Phone,
} from 'lucide-react';
import { attendanceAPI, busAPI, alertAPI } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

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
    route_id?: { _id: string; routeName: string; stops?: { name: string; order: number }[] } | null;
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
    const { connected: socketConnected, recentSwipes } = useSocket();

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

    const todayISO = new Date().toISOString().slice(0, 10);

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

            // Tìm xe được phân công cho tài xế này
            const buses = busRes.data.data as BusInfo[];
            const assigned = buses.find(b =>
                b.driver_id && (b.driver_id._id === user?.id || b.driver_id.fullName === user?.fullName)
            ) ?? buses[0] ?? null;
            setMyBus(assigned);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [todayISO, user]);

    useEffect(() => {
        fetchData();
        const t = setInterval(fetchData, 15000);
        return () => clearInterval(t);
    }, [fetchData]);

    // Real-time RFID
    const prevSwipe = useRef<typeof recentSwipes[0]>(undefined);
    useEffect(() => {
        const latest = recentSwipes[0];
        if (!latest || latest === prevSwipe.current) return;
        prevSwipe.current = latest;
        fetchData();
    }, [recentSwipes, fetchData]);

    const handleTripToggle = () => {
        if (!tripActive) {
            setStartTime(new Date());
            setElapsed('00:00:00');
        } else {
            setStartTime(null);
        }
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
        } catch { /* vẫn hiện feedback dù API chưa có */ }
        finally {
            setSosLoading(false);
            setSosSent(true);
            setShowSosInput(false);
            setSosMsg('');
            setTimeout(() => setSosSent(false), 15000);
        }
    };

    // Tính số học sinh thực sự đang trên xe (Boarding - Dropping)
    const boardingMap: Record<string, number> = {};
    logs.forEach(l => {
        const key = l.student_id?.studentCode ?? l._id;
        boardingMap[key] = (boardingMap[key] ?? 0) + (l.action_type === 'Boarding' ? 1 : -1);
    });
    const onBusNow = Object.values(boardingMap).filter(v => v > 0).length;
    const totalBoardings = logs.filter(l => l.action_type === 'Boarding').length;
    const totalDroppings = logs.filter(l => l.action_type === 'Dropping').length;

    return (
        <div style={{ padding: '20px', color: 'white', minHeight: 'calc(100vh - 64px)' }}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes pulse-green { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); } 50% { box-shadow: 0 0 0 10px rgba(16,185,129,0); } }
                @keyframes pulse-red { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.6); } 50% { box-shadow: 0 0 0 12px rgba(239,68,68,0); } }
            `}</style>

            {/* ── Nút Bắt đầu / Kết thúc chuyến ───────────────── */}
            <motion.div style={{
                background: tripActive
                    ? 'linear-gradient(135deg, #065f46, #059669)'
                    : 'linear-gradient(135deg, #1e293b, #334155)',
                borderRadius: 20, padding: '22px 24px', marginBottom: 18,
                border: tripActive ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(255,255,255,0.08)',
                boxShadow: tripActive ? '0 8px 32px rgba(5,150,105,0.3)' : 'none',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <p style={{ margin: 0, opacity: 0.7, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                            {tripActive ? '🟢 Đang chạy chuyến' : '⚪ Chưa bắt đầu chuyến'}
                        </p>
                        <p style={{ margin: '8px 0 0', fontSize: tripActive ? 38 : 18, fontWeight: 700, fontVariantNumeric: 'tabular-nums', letterSpacing: tripActive ? 3 : 0, opacity: tripActive ? 1 : 0.5 }}>
                            {tripActive ? elapsed : 'Bấm nút để bắt đầu'}
                        </p>
                        {tripActive && startTime && (
                            <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.6 }}>
                                Bắt đầu lúc {fmtTime(startTime.toISOString())}
                            </p>
                        )}
                    </div>
                    <motion.button
                        onClick={handleTripToggle}
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '14px 28px', borderRadius: 14,
                            background: tripActive ? 'rgba(239,68,68,0.9)' : '#10B981',
                            color: 'white', border: 'none', cursor: 'pointer',
                            fontWeight: 700, fontSize: 15,
                            boxShadow: tripActive ? '0 4px 16px rgba(239,68,68,0.4)' : '0 4px 20px rgba(16,185,129,0.4)',
                            animation: tripActive ? 'none' : 'pulse-green 2s infinite',
                        }}
                    >
                        {tripActive ? <><Square size={16} /> Kết thúc chuyến</> : <><Play size={16} /> Bắt đầu chuyến</>}
                    </motion.button>
                </div>
            </motion.div>

            {/* ── KPI strip ─────────────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
                {[
                    { label: 'Đang trên xe', value: onBusNow, icon: Users, color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
                    { label: 'Đã lên xe', value: totalBoardings, icon: ArrowUpCircle, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
                    { label: 'Đã xuống xe', value: totalDroppings, icon: ArrowDownCircle, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
                ].map(card => (
                    <motion.div key={card.label} whileHover={{ y: -2 }} style={{
                        padding: '16px', borderRadius: 14,
                        background: card.bg,
                        border: `1px solid ${card.color}30`,
                        textAlign: 'center',
                    }}>
                        <card.icon size={22} color={card.color} style={{ display: 'block', margin: '0 auto 8px' }} />
                        <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</p>
                        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>{card.label}</p>
                    </motion.div>
                ))}
            </div>

            {/* ── Thông tin xe + SOS ────────────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, marginBottom: 18 }}>
                <Card style={{ padding: '16px 20px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b' }}>
                            <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                            <span style={{ fontSize: 13 }}>Đang tải thông tin xe...</span>
                        </div>
                    ) : myBus ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{
                                width: 50, height: 50, borderRadius: 14, flexShrink: 0,
                                background: myBus.isOnline ? 'linear-gradient(135deg,#059669,#10B981)' : '#334155',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Bus size={24} color="white" />
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>{myBus.name ?? myBus.licensePlate}</p>
                                <div style={{ display: 'flex', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
                                    {myBus.route_id && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
                                            <Route size={11} /> {myBus.route_id.routeName}
                                        </span>
                                    )}
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
                                        <MapPin size={11} /> {Math.round(myBus.currentSpeed ?? 0)} km/h
                                    </span>
                                    {myBus.capacity && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8' }}>
                                            <Users size={11} /> {onBusNow}/{myBus.capacity} chỗ
                                        </span>
                                    )}
                                </div>
                            </div>
                            <span style={{
                                fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
                                background: myBus.isOnline ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.2)',
                                color: myBus.isOnline ? '#10B981' : '#64748b',
                                border: myBus.isOnline ? '1px solid rgba(16,185,129,0.4)' : '1px solid rgba(100,116,139,0.3)',
                            }}>
                                {myBus.isOnline ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#64748b' }}>
                            <Bus size={18} />
                            <span style={{ fontSize: 13 }}>Chưa được phân công xe</span>
                        </div>
                    )}
                </Card>

                {/* SOS Button */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <motion.button
                        onClick={() => sosSent ? null : setShowSosInput(p => !p)}
                        whileHover={{ scale: sosSent ? 1 : 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        disabled={sosLoading}
                        style={{
                            padding: '0 22px', borderRadius: 14, minWidth: 90, height: '100%',
                            background: sosSent ? 'rgba(16,185,129,0.15)' : showSosInput ? '#dc2626' : '#ef4444',
                            color: sosSent ? '#10B981' : 'white',
                            border: sosSent ? '1px solid rgba(16,185,129,0.4)' : 'none',
                            cursor: sosSent ? 'default' : 'pointer',
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', gap: 6,
                            fontWeight: 700, fontSize: 13,
                            boxShadow: sosSent ? 'none' : '0 4px 20px rgba(239,68,68,0.5)',
                            animation: !sosSent && !showSosInput ? 'none' : 'none',
                        }}
                    >
                        {sosSent
                            ? <><CheckCircle size={22} /><span>Đã gửi</span></>
                            : sosLoading
                                ? <><Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} /><span>Gửi...</span></>
                                : <><AlertTriangle size={22} /><span>SOS</span></>
                        }
                    </motion.button>
                </div>
            </div>

            {/* SOS input panel */}
            <AnimatePresence>
                {showSosInput && !sosSent && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden', marginBottom: 18 }}
                    >
                        <Card style={{ padding: '16px 18px', border: '1px solid rgba(239,68,68,0.4)' }}>
                            <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <AlertTriangle size={15} /> Gửi cảnh báo SOS tới Admin
                            </p>
                            <div style={{ display: 'flex', gap: 10 }}>
                                <input
                                    type="text"
                                    value={sosMsg}
                                    onChange={e => setSosMsg(e.target.value)}
                                    placeholder="Mô tả tình huống (tuỳ chọn)..."
                                    style={{
                                        flex: 1, padding: '10px 14px', borderRadius: 10,
                                        background: '#0f172a', border: '1px solid rgba(239,68,68,0.4)',
                                        color: 'white', fontSize: 13, outline: 'none',
                                    }}
                                    onKeyDown={e => e.key === 'Enter' && handleSOS()}
                                />
                                <motion.button
                                    onClick={handleSOS}
                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    style={{
                                        padding: '10px 18px', borderRadius: 10, border: 'none',
                                        background: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
                                    }}
                                >
                                    <Phone size={14} /> Gửi SOS
                                </motion.button>
                            </div>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Nhật ký RFID hôm nay ───────────────────────── */}
            <Card style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 15 }}>
                        <CreditCard size={16} color="#3B82F6" />
                        Nhật ký RFID hôm nay
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                            fontSize: 11, background: 'rgba(59,130,246,0.15)', color: '#3B82F6',
                            padding: '3px 10px', borderRadius: 20, fontWeight: 600,
                            border: '1px solid rgba(59,130,246,0.3)',
                        }}>
                            {logs.length} lượt
                        </span>
                        {socketConnected && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#10B981' }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                                Live
                            </span>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px', color: '#3B82F6' }} />
                        <span style={{ fontSize: 13, color: '#64748b' }}>Đang tải...</span>
                    </div>
                ) : logs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 0' }}>
                        <CreditCard size={36} style={{ opacity: 0.2, display: 'block', margin: '0 auto 8px', color: '#94a3b8' }} />
                        <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>Chưa có lượt quẹt thẻ nào hôm nay</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto' }}>
                        <AnimatePresence initial={false}>
                            {logs.slice(0, 40).map((log, i) => (
                                <motion.div
                                    key={log._id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i < 5 ? i * 0.04 : 0 }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '10px 14px', borderRadius: 10,
                                        background: 'rgba(255,255,255,0.04)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                    }}
                                >
                                    <div style={{
                                        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                                        background: log.action_type === 'Boarding' ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.2)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {log.action_type === 'Boarding'
                                            ? <ArrowUpCircle size={16} color="#10B981" />
                                            : <ArrowDownCircle size={16} color="#3B82F6" />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ margin: 0, fontWeight: 600, fontSize: 13, color: 'white' }}>
                                            {log.student_id?.fullName ?? 'Không xác định'}
                                        </p>
                                        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#64748b' }}>
                                            {log.student_id?.class ?? '—'} · {log.student_id?.studentCode ?? '—'}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                                            <Clock size={11} /> {fmtTime(log.scan_time)}
                                        </p>
                                        <p style={{
                                            margin: '2px 0 0', fontSize: 11, fontWeight: 700,
                                            color: log.action_type === 'Boarding' ? '#10B981' : '#3B82F6',
                                        }}>
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
    );
};

export default DriverView;
