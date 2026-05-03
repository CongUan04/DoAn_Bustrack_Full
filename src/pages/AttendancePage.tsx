/**
 * AttendancePage — Real API version
 * Dữ liệu từ /api/attendance và /api/attendance/kpi
 * Auto-refresh mỗi 20s, không còn setInterval mock
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowUpCircle, ArrowDownCircle, Users, Bus,
    CreditCard, Calendar, RefreshCw, Loader2,
    Search, X, Pause, Play, Download, Printer,
    Wifi, WifiOff,
} from 'lucide-react';
import { attendanceAPI } from '../services/api';
import { useSocket } from '../contexts/SocketContext';

// ── Types ─────────────────────────────────────────────────────
interface LogEntry {
    _id: string;
    student_id: { fullName: string; studentCode: string; class: string } | null;
    bus_id: { licensePlate: string } | null;
    scan_time: string;
    action_type: 'Boarding' | 'Dropping';
    stop_name: string | null;
    isAbnormal: boolean;
}

interface KpiData {
    totalToday: number;
    boardingToday: number;
    droppingToday: number;
    uniqueStudents: number;
    uniqueBuses: number;
}

const fmtTime = (ts: string) =>
    new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDate = (ts: string) => new Date(ts).toLocaleDateString('vi-VN');
const todayISO = () => new Date().toISOString().slice(0, 10);

// ── Main component ────────────────────────────────────────────
const AttendancePage: React.FC = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [kpi, setKpi] = useState<KpiData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [paused, setPaused] = useState(false);
    const [connected, setConnected] = useState(false);
    const { connected: socketConnected } = useSocket();

    // Filters
    const [search, setSearch] = useState('');
    const [actionF, setActionF] = useState('');
    const [dateFrom, setDateFrom] = useState(todayISO());
    const [dateTo, setDateTo] = useState(todayISO());

    // ── Fetch logs ───────────────────────────────────────────
    const fetchLogs = useCallback(async () => {
        if (paused) return;
        try {
            const params: Record<string, string> = { limit: '60', from: dateFrom, to: dateTo };
            if (actionF) params.action_type = actionF;

            const [logsRes, kpiRes] = await Promise.all([
                attendanceAPI.getLogs(params),
                attendanceAPI.getKpi(),
            ]);
            setLogs(logsRes.data.data as LogEntry[]);
            setKpi(kpiRes.data.data as KpiData);
            setConnected(true);
            setError(null);
        } catch {
            setConnected(false);
            setError('Không thể tải dữ liệu điểm danh');
        } finally {
            setLoading(false);
        }
    }, [paused, dateFrom, dateTo, actionF]);

    useEffect(() => {
        setLoading(true);
        fetchLogs();
    }, [dateFrom, dateTo, actionF, fetchLogs]);

    // Auto-refresh mỗi 20s
    useEffect(() => {
        const t = setInterval(fetchLogs, 20000);
        return () => clearInterval(t);
    }, [fetchLogs]);

    // ── Socket.io: Refresh ngay khi ESP32 quẹt thẻ ──────────
    const { recentSwipes } = useSocket();
    const latestSwipe = recentSwipes[0];
    useEffect(() => {
        if (!latestSwipe || paused) return;
        // recentSwipes thay đổi → có lần quẹt mới
        fetchLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [latestSwipe]);

    // ── Client-side search filter ───────────────────────────
    const filtered = logs.filter(l => {
        const q = search.toLowerCase();
        return !q
            || l.student_id?.fullName?.toLowerCase().includes(q)
            || l.student_id?.studentCode?.toLowerCase().includes(q)
            || l.bus_id?.licensePlate?.toLowerCase().includes(q)
            || l.stop_name?.toLowerCase().includes(q);
    });

    // ── Export CSV ──────────────────────────────────────────
    const exportCSV = () => {
        const header = 'Thời gian,Học sinh,Mã HS,Lớp,Xe,Điểm dừng,Hành động\n';
        const rows = filtered.map(l =>
            [fmtTime(l.scan_time), l.student_id?.fullName ?? '', l.student_id?.studentCode ?? '',
            l.student_id?.class ?? '', l.bus_id?.licensePlate ?? '', l.stop_name ?? '',
            l.action_type === 'Boarding' ? 'Lên xe' : 'Xuống xe'].join(',')
        ).join('\n');
        const blob = new Blob(['\uFEFF' + header + rows], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `diemdanh_${dateFrom}_${dateTo}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="att-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Điểm danh & Báo cáo</h1>
                    <p className="page-subtitle">Nhật ký quẹt thẻ RFID từ MongoDB · {dateFrom === dateTo ? dateFrom : `${dateTo}`}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
                        {socketConnected ? <Wifi size={13} /> : <WifiOff size={13} />}
                        <span>{socketConnected ? 'Live · ESP32 thật' : 'Mất kết nối'}</span>
                    </div>
                    <motion.button className={`live-toggle ${paused ? 'paused' : ''}`}
                        onClick={() => setPaused(p => !p)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                        {paused ? <><Play size={13} /> Tiếp tục</> : <><Pause size={13} /> Tạm dừng</>}
                    </motion.button>
                </div>
            </div>

            {/* KPI strip */}
            <div className="att-kpi-strip">
                {[
                    { label: 'Tổng lượt hôm nay', value: kpi?.totalToday ?? 0, icon: CreditCard, color: '#2563EB', bg: '#EFF6FF' },
                    { label: 'Lên xe', value: kpi?.boardingToday ?? 0, icon: ArrowUpCircle, color: '#059669', bg: '#F0FDF4' },
                    { label: 'Xuống xe', value: kpi?.droppingToday ?? 0, icon: ArrowDownCircle, color: '#DC2626', bg: '#FEF2F2' },
                    { label: 'Học sinh', value: kpi?.uniqueStudents ?? 0, icon: Users, color: '#7C3AED', bg: '#F5F3FF' },
                    { label: 'Xe hoạt động', value: kpi?.uniqueBuses ?? 0, icon: Bus, color: '#D97706', bg: '#FFFBEB' },
                ].map(k => (
                    <motion.div key={k.label} className="att-kpi-card"
                        style={{ borderLeft: `3px solid ${k.color}`, background: k.bg }}
                        whileHover={{ y: -2 }}>
                        <k.icon size={18} style={{ color: k.color }} />
                        <div>
                            <p className="att-kpi-num" style={{ color: k.color }}>{k.value}</p>
                            <p className="att-kpi-lbl">{k.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="att-toolbar">
                <div className="crud-search-wrap" style={{ maxWidth: 280 }}>
                    <Search size={14} className="crud-search-icon" />
                    <input className="crud-search" placeholder="Tìm học sinh, xe, điểm dừng..."
                        value={search} onChange={e => setSearch(e.target.value)} />
                    {search && <button className="crud-search-clear" onClick={() => setSearch('')}><X size={13} /></button>}
                </div>

                <div className="att-filter-btns">
                    {(['', 'Boarding', 'Dropping'] as const).map(v => (
                        <button key={v} className={`att-action-filter ${actionF === v ? 'active' : ''}`}
                            onClick={() => setActionF(v)}>
                            {v === '' ? 'Tất cả' : v === 'Boarding' ? '↑ Lên xe' : '↓ Xuống xe'}
                        </button>
                    ))}
                </div>

                {/* Date range */}
                <div className="att-date-range">
                    <Calendar size={14} /><span>Từ</span>
                    <input type="date" className="att-date-input" value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)} />
                    <span>đến</span>
                    <input type="date" className="att-date-input" value={dateTo}
                        onChange={e => setDateTo(e.target.value)} />
                </div>

                <button className="att-action-filter" onClick={fetchLogs} title="Làm mới">
                    <RefreshCw size={13} />
                </button>

                <span className="result-count">{filtered.length} lượt</span>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <motion.button className="export-btn excel" onClick={exportCSV} whileHover={{ scale: 1.02 }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                        <Download size={14} /> Xuất Excel
                    </motion.button>
                    <motion.button className="export-btn pdf" onClick={() => window.print()} whileHover={{ scale: 1.02 }}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                        <Printer size={14} /> Xuất PDF
                    </motion.button>
                </div>
            </div>

            {/* Log table */}
            <div className="card att-log-card">
                <div className="att-log-header">
                    <div className="att-log-title"><CreditCard size={15} /> Nhật ký điểm danh</div>
                    <div className="realtime-badge">
                        <span className={`live-dot ${paused ? '' : 'pulsing'}`} />
                        <span>{paused ? 'Đã tạm dừng' : 'Dữ liệu thực từ MongoDB'}</span>
                    </div>
                </div>

                <div className="att-log-body">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Thời gian</th><th>Ngày</th><th>Học sinh</th>
                                <th>Lớp</th><th>Xe</th><th>Điểm dừng</th><th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout" initial={false}>
                                {loading ? (
                                    <tr key="loading">
                                        <td colSpan={7} className="empty-row">
                                            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }} />
                                            Đang tải dữ liệu...
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr key="error">
                                        <td colSpan={7} className="empty-row" style={{ color: '#EF4444' }}>
                                            {error} — <button onClick={fetchLogs} style={{ textDecoration: 'underline', cursor: 'pointer' }}>Thử lại</button>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr key="empty">
                                        <td colSpan={7} className="empty-row">Chưa có dữ liệu điểm danh trong khoảng thời gian này</td>
                                    </tr>
                                ) : filtered.map((l, i) => (
                                    <motion.tr key={l._id}
                                        layout
                                        initial={{ opacity: 0, y: -12, backgroundColor: 'rgba(59,130,246,0.08)' }}
                                        animate={{ opacity: 1, y: 0, backgroundColor: 'transparent' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3, delay: i < 5 ? 0 : 0 }}
                                        className={l.isAbnormal ? 'abnormal-row' : ''}>
                                        <td><span className="att-time">{fmtTime(l.scan_time)}</span></td>
                                        <td><span className="att-date-small">{fmtDate(l.scan_time)}</span></td>
                                        <td>
                                            <div className="student-cell">
                                                <div className="student-avatar">{(l.student_id?.fullName ?? '?').split(' ').pop()?.charAt(0)}</div>
                                                <div>
                                                    <p className="student-name">{l.student_id?.fullName ?? 'Không xác định'}</p>
                                                    <p className="student-id">{l.student_id?.studentCode ?? '---'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td><span className="grade-badge">{l.student_id?.class ?? '—'}</span></td>
                                        <td><span className="bus-badge">{l.bus_id?.licensePlate ?? '—'}</span></td>
                                        <td className="stop-cell">{l.stop_name ?? '—'}</td>
                                        <td>
                                            <div className={`action-badge action-${l.action_type === 'Boarding' ? 'on' : 'off'}`}>
                                                {l.action_type === 'Boarding' ? <ArrowUpCircle size={13} /> : <ArrowDownCircle size={13} />}
                                                <span>{l.action_type === 'Boarding' ? 'Lên xe' : 'Xuống xe'}</span>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AttendancePage;
