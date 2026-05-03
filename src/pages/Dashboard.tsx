import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bus, Users, AlertTriangle, Bell,
    Wifi, WifiOff, CreditCard, ArrowUpCircle, ArrowDownCircle,
    TrendingUp, TrendingDown, Minus, Clock, RefreshCw,
    XCircle,
} from 'lucide-react';
import { dashboardAPI } from '../services/api';
import { useSocket, RfidSwipe } from '../contexts/SocketContext';

// ── Types ─────────────────────────────────────────────────────
interface KpiData {
    activeBuses: number;
    offlineBuses: number;
    totalBuses: number;
    studentsOnBus: number;
    totalStudents: number;
    unresolvedAlerts: number;
    dangerAlerts: number;
    warningAlerts: number;
    todayAttendance: number;
}

// ── Toast Notifications using react-toastify ─────────────────────

// ── Animated Counter ─────────────────────────────────────────
const AnimatedNumber: React.FC<{ value: number; duration?: number }> = ({ value, duration = 600 }) => {
    const [display, setDisplay] = useState(value);
    const prevRef = useRef(value);

    useEffect(() => {
        const start = prevRef.current;
        const end = value;
        if (start === end) return;
        const startTime = performance.now();
        const step = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(start + (end - start) * eased));
            if (progress < 1) requestAnimationFrame(step);
            else prevRef.current = end;
        };
        requestAnimationFrame(step);
    }, [value, duration]);

    return <>{display.toLocaleString('vi-VN')}</>;
};

// ── KPI Card ─────────────────────────────────────────────────
interface KpiCardProps {
    label: string; value: number; unit?: string;
    icon: React.ElementType; color: string; bg: string; gradient: string;
    trend?: number; subtext?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, unit, icon: Icon, color, bg, gradient, trend, subtext }) => {
    const TrendIcon = trend === undefined || trend === 0 ? Minus : trend > 0 ? TrendingUp : TrendingDown;
    const trendColor = trend === undefined || trend === 0 ? '#94A3B8' : trend > 0 ? '#10B981' : '#EF4444';
    return (
        <motion.div
            className="kpi-card"
            style={{ '--kpi-color': color, '--kpi-bg': bg } as React.CSSProperties}
            whileHover={{ y: -4, boxShadow: '0 12px 28px -6px rgba(0,0,0,0.12)' }}
            transition={{ duration: 0.2 }}
        >
            <div className="kpi-card-accent" style={{ background: gradient }} />
            <div className="kpi-header">
                <div className="kpi-icon-wrap" style={{ background: bg, color }}><Icon size={24} strokeWidth={2} /></div>
                {trend !== undefined && (
                    <div className="kpi-trend" style={{ color: trendColor }}>
                        <TrendIcon size={14} /><span>{Math.abs(trend)}</span>
                    </div>
                )}
            </div>
            <div className="kpi-value-wrap">
                <span className="kpi-value"><AnimatedNumber value={value} /></span>
                {unit && <span className="kpi-unit">{unit}</span>}
            </div>
            <p className="kpi-label">{label}</p>
            {subtext && <p className="kpi-subtext">{subtext}</p>}
        </motion.div>
    );
};

// ── Time formatter ────────────────────────────────────────────
const formatTime = (ts: string | Date) => {
    const date = new Date(ts);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return `${diffSec} giây trước`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};

const EMPTY_KPI: KpiData = {
    activeBuses: 0, offlineBuses: 0, totalBuses: 0,
    studentsOnBus: 0, totalStudents: 0,
    unresolvedAlerts: 0, dangerAlerts: 0, warningAlerts: 0,
    todayAttendance: 0,
};

// ── Dashboard Page ────────────────────────────────────────────
const Dashboard: React.FC = () => {
    const [kpi, setKpi] = useState<KpiData>(EMPTY_KPI);
    const [prevKpi, setPrevKpi] = useState<KpiData>(EMPTY_KPI);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [, setTick] = useState(0);

    // ── Socket.io real-time ────────────────────────────────────
    const {
        recentSwipes: socketSwipes,
        connected: socketConnected,
    } = useSocket();

    // ── REST fallback swipes (initial load) ───────────────────
    const [restSwipes, setRestSwipes] = useState<RfidSwipe[]>([]);

    // Merge: socket swipes (real-time) take priority, then REST fallback
    const displaySwipes = socketSwipes.length > 0 ? socketSwipes : restSwipes;

    // Fetch stats from real API
    const fetchStats = useCallback(async () => {
        try {
            const res = await dashboardAPI.getStats();
            const { kpi: newKpi, recentSwipes: swipes } = res.data.data as {
                kpi: KpiData;
                recentSwipes: Array<{
                    id: string; studentName: string; studentId: string;
                    grade: string; busId: string; action: string; timestamp: string;
                }>;
            };
            setPrevKpi(prev => ({ ...prev }));
            setKpi(newKpi);
            // Convert REST swipes to RfidSwipe format (fallback)
            setRestSwipes(swipes.map(s => ({
                id: s.id,
                studentName: s.studentName,
                studentId: s.studentId,
                studentCode: '',
                grade: s.grade,
                busId: s.busId,
                licensePlate: s.busId,
                action: s.action as 'lên xe' | 'xuống xe',
                timestamp: new Date(s.timestamp),
                status: 'success' as const,
            })));
            setLastUpdate(new Date());
            setError(null);
        } catch (err) {
            setError('Không thể kết nối đến server. Đang thử lại...');
            console.error('[Dashboard] fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial fetch + auto-refresh every 30s (KPI only, swipes come from socket)
    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, [fetchStats]);

    // Tick for relative timestamps
    useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 10000);
        return () => clearInterval(t);
    }, []);

    const today = new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

    const kpiCards: KpiCardProps[] = [
        {
            label: 'Xe đang hoạt động', value: kpi.activeBuses,
            unit: `/ ${kpi.totalBuses} xe`, icon: Bus,
            color: '#2563EB', bg: '#EFF6FF',
            gradient: 'linear-gradient(90deg, #3B82F6, #60A5FA)',
            trend: kpi.activeBuses - prevKpi.activeBuses,
            subtext: 'Cập nhật thời gian thực',
        },
        {
            label: 'Học sinh đang trên xe', value: kpi.studentsOnBus,
            unit: 'em', icon: Users,
            color: '#059669', bg: '#F0FDF4',
            gradient: 'linear-gradient(90deg, #10B981, #34D399)',
            trend: kpi.studentsOnBus - prevKpi.studentsOnBus,
            subtext: kpi.totalStudents > 0
                ? `${Math.round((kpi.studentsOnBus / kpi.totalStudents) * 100)}% tổng học sinh`
                : '',
        },
        {
            label: 'Điểm danh hôm nay', value: kpi.todayAttendance,
            unit: 'lượt', icon: Clock,
            color: '#D97706', bg: '#FFFBEB',
            gradient: 'linear-gradient(90deg, #F59E0B, #FCD34D)',
            subtext: 'Tổng số lượt quẹt thẻ',
        },
        {
            label: 'Cảnh báo chưa xử lý', value: kpi.unresolvedAlerts,
            unit: 'cảnh báo', icon: Bell,
            color: '#DC2626', bg: '#FEF2F2',
            gradient: 'linear-gradient(90deg, #EF4444, #F87171)',
            trend: kpi.unresolvedAlerts - prevKpi.unresolvedAlerts,
            subtext: kpi.unresolvedAlerts === 0 ? 'Không có cảnh báo ✓' : `${kpi.dangerAlerts} nguy hiểm cần xử lý`,
        },
    ];

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: '#94A3B8' }}>
                <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Đang tải dữ liệu từ server...</span>
            </div>
        );
    }

    return (
        <div className="dashboard">
            {/* ── Page Header ─── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Tổng quan hệ thống</h1>
                    <p className="page-subtitle">{today}</p>
                </div>
                <div className="page-header-actions">
                    {error && (
                        <div className="connection-status disconnected">
                            <WifiOff size={14} /><span>{error}</span>
                        </div>
                    )}
                    {!error && (
                        <div className={`connection-status ${socketConnected ? 'connected' : 'disconnected'}`}>
                            {socketConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                            <span>{socketConnected ? 'Socket.io đang kết nối' : 'Đang kết nối Socket...'}</span>
                            {socketConnected && <span className="live-dot" />}
                        </div>
                    )}
                    <button
                        className="map-refresh-btn"
                        onClick={fetchStats}
                        title="Làm mới"
                        style={{ marginLeft: 4 }}
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>
            </div>

            {/* ── KPI Cards ─── */}
            <div className="kpi-grid">
                {kpiCards.map((card, i) => (
                    <motion.div
                        key={card.label}
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <KpiCard {...card} />
                    </motion.div>
                ))}
            </div>

            {/* ── Bottom Section ─── */}
            <div className="dashboard-bottom">
                {/* Recent RFID Swipes — now real-time via Socket.io */}
                <div className="card rfid-card">
                    <div className="card-header">
                        <h2 className="card-title"><CreditCard size={18} /> Lịch sử quẹt thẻ RFID</h2>
                        <div className="realtime-badge">
                            <span className={`live-dot ${socketConnected ? '' : 'offline'}`} />
                            <span>{socketConnected ? 'Real-time qua Socket.io' : 'Dữ liệu từ REST API'}</span>
                        </div>
                    </div>
                    <div className="table-wrapper">
                        <table className="data-table rfid-table">
                            <thead>
                                <tr>
                                    <th>#</th><th>Học sinh</th><th>Lớp</th>
                                    <th>Xe</th><th>Thao tác</th><th>Thời gian</th>
                                </tr>
                            </thead>
                            <tbody>
                                <AnimatePresence mode="popLayout">
                                    {displaySwipes.length === 0 ? (
                                        <tr key="empty">
                                            <td colSpan={6} className="empty-row">Chưa có dữ liệu điểm danh hôm nay</td>
                                        </tr>
                                    ) : displaySwipes.slice(0, 10).map((swipe, idx) => (
                                        <motion.tr
                                            key={swipe.id}
                                            initial={{ opacity: 0, backgroundColor: swipe.status === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(59,130,246,0.08)' }}
                                            animate={{ opacity: 1, backgroundColor: 'rgba(59,130,246,0)' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.5 }}
                                            layout
                                            className={swipe.status === 'error' ? 'row-error' : ''}
                                        >
                                            <td className="row-num">{idx + 1}</td>
                                            <td>
                                                <div className="student-cell">
                                                    <div className={`student-avatar ${swipe.status === 'error' ? 'avatar-error' : ''}`}>
                                                        {swipe.status === 'error' ? '?' : swipe.studentName.split(' ').pop()?.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="student-name">{swipe.studentName}</p>
                                                        <p className="student-id">{swipe.studentCode || swipe.studentId}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td><span className="grade-badge">{swipe.grade}</span></td>
                                            <td><span className="bus-badge">{swipe.licensePlate || swipe.busId}</span></td>
                                            <td>
                                                {swipe.status === 'error' ? (
                                                    <div className="action-badge action-error">
                                                        <XCircle size={13} />
                                                        <span>Thẻ lạ</span>
                                                    </div>
                                                ) : (
                                                    <div className={`action-badge action-${swipe.action === 'lên xe' ? 'on' : 'off'}`}>
                                                        {swipe.action === 'lên xe' ? <ArrowUpCircle size={13} /> : <ArrowDownCircle size={13} />}
                                                        <span>{swipe.action}</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="time-cell">{formatTime(swipe.timestamp)}</td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Right panel */}
                <div className="dashboard-right-panel">
                    {/* Bus status */}
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title"><Bus size={16} /> Trạng thái xe</h2>
                        </div>
                        <div className="bus-status-list">
                            {[
                                { label: 'Đang online', count: kpi.activeBuses, color: '#10B981', bg: '#F0FDF4' },
                                { label: 'Offline', count: kpi.offlineBuses, color: '#EF4444', bg: '#FEF2F2' },
                            ].map(item => (
                                <div key={item.label} className="bus-status-row">
                                    <div className="bus-status-left">
                                        <span className="bus-status-dot" style={{ background: item.color }} />
                                        <span className="bus-status-label">{item.label}</span>
                                    </div>
                                    <div className="bus-status-right">
                                        <div className="bus-status-bar-wrap">
                                            <div
                                                className="bus-status-bar-fill"
                                                style={{ width: `${kpi.totalBuses > 0 ? (item.count / kpi.totalBuses) * 100 : 0}%`, background: item.color }}
                                            />
                                        </div>
                                        <span className="bus-status-count" style={{ color: item.color }}>{item.count}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Alert summary */}
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title"><AlertTriangle size={16} /> Cảnh báo</h2>
                        </div>
                        <div className="alert-summary-list">
                            {[
                                { type: 'Nguy hiểm', count: kpi.dangerAlerts, color: '#EF4444' },
                                { type: 'Cảnh báo', count: kpi.warningAlerts, color: '#F59E0B' },
                                { type: 'Chưa xử lý', count: kpi.unresolvedAlerts, color: '#8B5CF6' },
                                { type: 'Điểm danh', count: kpi.todayAttendance, color: '#3B82F6' },
                            ].map(item => (
                                <div key={item.type} className="alert-summary-row">
                                    <span className="alert-summary-type">{item.type}</span>
                                    <span
                                        className="alert-summary-count"
                                        style={{
                                            background: item.count > 0 ? item.color + '20' : '#F1F5F9',
                                            color: item.count > 0 ? item.color : '#94A3B8',
                                        }}
                                    >
                                        {item.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
