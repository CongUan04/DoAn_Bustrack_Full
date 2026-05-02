/**
 * AlertsPage — Real API version
 * Dữ liệu từ /api/alerts — acknowledge gọi API thật
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AlertTriangle, AlertCircle, Info, CheckCircle2,
    Clock, Bus, User, WifiOff, Wifi,
    Send, Bell, BellOff, Search, X,
    ShieldCheck, Zap, Thermometer, RefreshCw, Loader2,
} from 'lucide-react';
import { alertAPI } from '../services/api';

// ── Types ─────────────────────────────────────────────────────
type Severity = 'danger' | 'warning' | 'info';

interface AlertDoc {
    _id: string;
    alert_type: string;
    severity: Severity;
    message: string;
    timestamp: string;
    isResolved: boolean;
    bus_id?: { licensePlate: string };
    student_id?: { fullName: string; studentCode: string };
    resolvedBy?: { fullName: string };
    resolvedAt?: string;
}

// ── Severity config ────────────────────────────────────────────
const SEV: Record<Severity, {
    label: string; color: string; bg: string; border: string;
    rowBg: string; icon: React.ElementType;
}> = {
    danger: { label: 'Nguy hiểm', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', rowBg: 'rgba(254,226,226,0.55)', icon: AlertTriangle },
    warning: { label: 'Cảnh báo', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', rowBg: 'rgba(254,243,199,0.5)', icon: AlertCircle },
    info: { label: 'Thông tin', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', rowBg: 'rgba(239,246,255,0.5)', icon: Info },
};

const TYPE_LABELS: Record<string, string> = {
    OVERSPEED: 'Quá tốc độ', STUDENT_FORGOTTEN: 'Bỏ quên học sinh',
    GPS_LOST: 'Mất GPS', DEVICE_OFFLINE: 'Thiết bị offline',
    LATE_ARRIVAL: 'Trễ giờ', WRONG_RFID: 'RFID sai tuyến',
    ABNORMAL_SCAN: 'Quẹt thẻ bất thường', TELEGRAM_SENT: 'Telegram đã gửi',
    OTHER: 'Khác',
};

const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const fmtDate = (ts: string) => new Date(ts).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
const relTime = (ts: string) => {
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return `${s}s trước`;
    if (s < 3600) return `${Math.floor(s / 60)}ph trước`;
    return `${Math.floor(s / 3600)}h trước`;
};

// ── Alert type icon ────────────────────────────────────────────
const AlertTypeIcon: React.FC<{ type: string }> = ({ type }) => {
    if (type === 'OVERSPEED' || type === 'LATE_ARRIVAL') return <Zap size={14} color="#D97706" />;
    if (type === 'GPS_LOST' || type === 'DEVICE_OFFLINE') return <WifiOff size={14} color="#6B7280" />;
    if (type === 'STUDENT_FORGOTTEN' || type === 'WRONG_RFID') return <User size={14} color="#DC2626" />;
    if (type === 'TELEGRAM_SENT') return <Send size={14} color="#7C3AED" />;
    if (type.includes('TEMP')) return <Thermometer size={14} color="#EF4444" />;
    return <Bus size={14} color="#3B82F6" />;
};

// ── Main ──────────────────────────────────────────────────────
const AlertsPage: React.FC = () => {
    const [alerts, setAlerts] = useState<AlertDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connected, setConnected] = useState(false);
    const [, tick] = useState(0);

    const [search, setSearch] = useState('');
    const [filterSev, setFilterSev] = useState<'' | Severity>('');
    const [filterStatus, setFilterStatus] = useState<'' | 'unresolved' | 'acknowledged'>('');

    // ── Fetch ────────────────────────────────────────────────
    const fetchAlerts = useCallback(async () => {
        try {
            const params: Record<string, string> = { limit: '100' };
            if (filterSev) params.severity = filterSev;
            if (filterStatus === 'unresolved') params.isResolved = 'false';
            if (filterStatus === 'acknowledged') params.isResolved = 'true';

            const res = await alertAPI.getAll(params);
            setAlerts(res.data.data as AlertDoc[]);
            setConnected(true);
            setError(null);
        } catch {
            setConnected(false);
            setError('Không thể tải cảnh báo từ server');
        } finally {
            setLoading(false);
        }
    }, [filterSev, filterStatus]);

    useEffect(() => { setLoading(true); fetchAlerts(); }, [filterSev, filterStatus, fetchAlerts]);

    // Relative time ticker
    useEffect(() => {
        const t = setInterval(() => tick(n => n + 1), 15000);
        return () => clearInterval(t);
    }, []);

    // Auto-refresh every 30s
    useEffect(() => {
        const t = setInterval(fetchAlerts, 30000);
        return () => clearInterval(t);
    }, [fetchAlerts]);

    // ── Acknowledge ──────────────────────────────────────────
    const acknowledge = async (id: string) => {
        try {
            await alertAPI.acknowledge(id);
            setAlerts(prev => prev.map(a => a._id === id ? { ...a, isResolved: true, resolvedAt: new Date().toISOString() } : a));
        } catch { /* silent */ }
    };

    const acknowledgeAll = async () => {
        try {
            await alertAPI.acknowledgeAll();
            setAlerts(prev => prev.map(a => ({ ...a, isResolved: true, resolvedAt: new Date().toISOString() })));
        } catch { /* silent */ }
    };

    // ── Filter ───────────────────────────────────────────────
    const filtered = alerts.filter(a => {
        const q = search.toLowerCase();
        return (!q
            || (TYPE_LABELS[a.alert_type] ?? a.alert_type).toLowerCase().includes(q)
            || a.message.toLowerCase().includes(q)
            || a.bus_id?.licensePlate?.toLowerCase().includes(q)
            || a.student_id?.fullName?.toLowerCase().includes(q)
        );
    });

    // KPI counts
    const dangerCount = alerts.filter(a => a.severity === 'danger' && !a.isResolved).length;
    const warningCount = alerts.filter(a => a.severity === 'warning' && !a.isResolved).length;
    const infoCount = alerts.filter(a => a.severity === 'info' && !a.isResolved).length;
    const resolvedCount = alerts.filter(a => a.isResolved).length;
    const totalCount = alerts.length;

    return (
        <div className="alerts-page">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Cảnh báo & Bất thường</h1>
                    <p className="page-subtitle">{dangerCount + warningCount} chưa xử lý · dữ liệu thực từ MongoDB</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="att-action-filter" onClick={fetchAlerts} title="Làm mới"><RefreshCw size={14} /></button>
                    {dangerCount + warningCount > 0 && (
                        <motion.button className="ack-all-btn" onClick={acknowledgeAll}
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                            <ShieldCheck size={15} /> Xác nhận tất cả ({dangerCount + warningCount})
                        </motion.button>
                    )}
                </div>
            </div>

            {/* KPI Strip */}
            <div className="alerts-kpi-strip">
                {[
                    { label: 'Nguy hiểm chưa xử lý', value: dangerCount, icon: AlertTriangle, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
                    { label: 'Cảnh báo chưa xử lý', value: warningCount, icon: AlertCircle, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                    { label: 'Thông tin chưa đọc', value: infoCount, icon: Info, color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
                    { label: 'Đã xử lý', value: resolvedCount, icon: CheckCircle2, color: '#059669', bg: '#F0FDF4', border: '#BBF7D0' },
                    { label: 'Tổng cảnh báo', value: totalCount, icon: Bell, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
                ].map(k => (
                    <motion.div key={k.label} className="alerts-kpi-card"
                        style={{ borderColor: k.border, background: `linear-gradient(135deg, white, ${k.bg})` }}
                        whileHover={{ y: -2, boxShadow: `0 8px 20px ${k.color}22` }}>
                        <div className="alerts-kpi-icon" style={{ background: k.bg, color: k.color }}><k.icon size={18} /></div>
                        <div>
                            <p className="alerts-kpi-value" style={{ color: k.value > 0 ? k.color : '#94A3B8' }}>{k.value}</p>
                            <p className="alerts-kpi-label">{k.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="att-toolbar">
                <div className="crud-search-wrap" style={{ maxWidth: 280 }}>
                    <Search size={15} className="crud-search-icon" />
                    <input className="crud-search" placeholder="Tìm loại lỗi, biển số, HS..."
                        value={search} onChange={e => setSearch(e.target.value)} />
                    {search && <button className="crud-search-clear" onClick={() => setSearch('')}><X size={13} /></button>}
                </div>
                <div className="att-filter-btns">
                    {([
                        { v: '', label: 'Tất cả' },
                        { v: 'danger', label: '🔴 Nguy hiểm' },
                        { v: 'warning', label: '🟡 Cảnh báo' },
                        { v: 'info', label: '🔵 Thông tin' },
                    ] as const).map(({ v, label }) => (
                        <button key={v}
                            className={`att-action-filter ${filterSev === v ? 'active' : ''}`}
                            style={filterSev === v && v ? { background: SEV[v as Severity].color, borderColor: SEV[v as Severity].color, color: 'white' } : {}}
                            onClick={() => setFilterSev(v as '' | Severity)}>{label}</button>
                    ))}
                </div>
                <select className="att-select" value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value as '' | 'unresolved' | 'acknowledged')}>
                    <option value="">Tất cả trạng thái</option>
                    <option value="unresolved">Chưa xử lý</option>
                    <option value="acknowledged">Đã xử lý</option>
                </select>
                <span className="result-count">{filtered.length} cảnh báo</span>
                <div style={{ marginLeft: 'auto' }}>
                    <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
                        {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
                        <span>{connected ? 'MongoDB thực' : 'Mất kết nối'}</span>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card alerts-card">
                <div className="att-log-header">
                    <div className="att-log-title"><Bell size={16} /> Nhật ký cảnh báo hệ thống</div>
                    <div className="realtime-badge"><span className="live-dot" /> Cập nhật mỗi 30s</div>
                </div>

                <div className="att-log-body">
                    <table className="data-table alerts-table">
                        <thead>
                            <tr>
                                <th>Mức độ</th><th>Thời gian</th><th>Loại cảnh báo</th>
                                <th>Đối tượng</th><th>Mô tả</th><th>Trạng thái</th><th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout" initial={false}>
                                {loading ? (
                                    <tr key="loading">
                                        <td colSpan={7} className="empty-row">
                                            <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }} />
                                            Đang tải cảnh báo...
                                        </td>
                                    </tr>
                                ) : error ? (
                                    <tr key="error">
                                        <td colSpan={7} className="empty-row" style={{ color: '#EF4444' }}>
                                            {error} — <button onClick={fetchAlerts} style={{ textDecoration: 'underline' }}>Thử lại</button>
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr key="empty">
                                        <td colSpan={7} className="empty-row">
                                            <BellOff size={36} style={{ opacity: 0.25, display: 'block', margin: '0 auto 8px' }} />
                                            Không có cảnh báo phù hợp
                                        </td>
                                    </tr>
                                ) : filtered.slice(0, 60).map(alert => {
                                    const cfg = SEV[alert.severity];
                                    const SevIcon = cfg.icon;
                                    return (
                                        <motion.tr key={alert._id} layout
                                            initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0, backgroundColor: alert.isResolved ? 'transparent' : cfg.rowBg }}
                                            exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3 }}
                                            className={`alert-row severity-${alert.severity} ${alert.isResolved ? 'acknowledged' : ''}`}>
                                            <td>
                                                <div className="severity-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
                                                    <SevIcon size={13} /><span>{cfg.label}</span>
                                                </div>
                                            </td>
                                            <td className="alert-time-cell">
                                                <p className="att-time">{fmtTime(alert.timestamp)}</p>
                                                <p className="att-date-small">{fmtDate(alert.timestamp)} · {relTime(alert.timestamp)}</p>
                                            </td>
                                            <td>
                                                <div className="alert-type-cell">
                                                    <AlertTypeIcon type={alert.alert_type} />
                                                    <span className="alert-type-label">{TYPE_LABELS[alert.alert_type] ?? alert.alert_type}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <p className="alert-subject">{alert.bus_id?.licensePlate ?? alert.student_id?.fullName ?? '—'}</p>
                                                <p className="alert-subject-detail">{alert.student_id?.studentCode ?? ''}</p>
                                            </td>
                                            <td className="alert-desc">{alert.message}</td>
                                            <td>
                                                {alert.isResolved ? (
                                                    <div className="ack-status">
                                                        <CheckCircle2 size={13} />
                                                        <div>
                                                            <p>Đã xử lý</p>
                                                            {alert.resolvedAt && <p style={{ fontSize: 10.5, color: '#94A3B8' }}>{fmtTime(alert.resolvedAt)}</p>}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="unresolved-status" style={{ color: cfg.color }}>
                                                        <Clock size={12} /><span>Chưa xử lý</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                {!alert.isResolved ? (
                                                    <motion.button className="ack-btn"
                                                        style={{ borderColor: cfg.color, color: cfg.color }}
                                                        onClick={() => acknowledge(alert._id)}
                                                        whileHover={{ background: cfg.color, color: '#fff' }} whileTap={{ scale: 0.96 }}>
                                                        <ShieldCheck size={13} /> Đã xử lý
                                                    </motion.button>
                                                ) : (
                                                    <span className="acked-label"><CheckCircle2 size={12} /> OK</span>
                                                )}
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AlertsPage;
