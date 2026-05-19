/**
 * BusManagement — Quản lý xe buýt
 * UI pattern giống StudentManagement: nút Thêm trên header → mở BusModal popup
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bus, Plus, RefreshCw, Copy, CheckCircle2,
    Wifi, WifiOff, X, Loader2, AlertTriangle, Save,
    Pencil, Trash2, Search,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { busAPI, userAPI, routeAPI } from '../services/api';

// ── Types ─────────────────────────────────────────────────────
interface BusRecord {
    _id: string;
    licensePlate: string;
    name: string;
    device_mac_address?: string;
    capacity: number;
    driver_id?: { _id: string; fullName: string; phone: string };
    isOnline: boolean;
    isActive: boolean;
    createdAt: string;
    route_id?: { _id: string; routeName: string; };
}

interface BusForm {
    licensePlate: string;
    name: string;
    device_mac_address: string;
    capacity: string;
    driver_id: string;
    route_id: string;
}

const EMPTY_FORM: BusForm = {
    licensePlate: '',
    name: '',
    device_mac_address: '',
    capacity: '45',
    driver_id: '',
    route_id: '',
};

// ── Copy button ────────────────────────────────────────────────
const CopyBtn: React.FC<{ text: string }> = ({ text }) => {
    const [copied, setCopied] = useState(false);
    const handle = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button onClick={handle} title="Copy" style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: copied ? 'var(--success-light)' : 'var(--bg)',
            color: copied ? '#16A34A' : '#64748B',
            border: 'none', borderRadius: 6, padding: '3px 8px',
            cursor: 'pointer', fontSize: 11, fontWeight: 600,
            transition: 'all .15s',
        }}>
            {copied ? <CheckCircle2 size={11} /> : <Copy size={11} />}
            {copied ? 'Đã chép!' : 'Copy'}
        </button>
    );
};

// ── Bus Modal ──────────────────────────────────────────────────
const BusModal: React.FC<{
    mode: 'add' | 'edit';
    initial?: BusForm;
    saving: boolean;
    drivers: { _id: string; fullName: string; phone: string }[];
    routes: { _id: string; routeName: string; }[];
    onSave: (f: BusForm) => void;
    onClose: () => void;
}> = ({ mode, initial, saving, drivers, routes, onSave, onClose }) => {
    const [form, setForm] = useState<BusForm>(initial ?? { ...EMPTY_FORM });
    const [errors, setErrors] = useState<Record<string, string>>({});

    const set = (k: keyof BusForm, v: string) =>
        setForm(p => ({ ...p, [k]: v }));

    const validate = () => {
        const e: Record<string, string> = {};
        if (!form.licensePlate.trim()) e.licensePlate = 'Vui lòng nhập biển số xe';
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <motion.div
                className="modal"
                initial={{ opacity: 0, scale: 0.94, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 20 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="modal-header">
                    <div className="modal-title-wrap">
                        <div className="modal-title-icon"><Bus size={20} /></div>
                        <div>
                            <h2 className="modal-title">
                                {mode === 'add' ? 'Thêm xe buýt mới' : 'Chỉnh sửa xe buýt'}
                            </h2>
                            <p className="modal-subtitle">
                                {mode === 'add' ? 'Điền thông tin bên dưới' : `Đang sửa: ${initial?.licensePlate}`}
                            </p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Body */}
                <form
                    onSubmit={e => { e.preventDefault(); if (validate()) onSave(form); }}
                    className="modal-body"
                >
                    <div className="modal-grid">
                        {/* Biển số */}
                        <div className="form-group">
                            <label className="form-label">
                                Biển số xe <span className="required">*</span>
                            </label>
                            <input
                                className={`form-field ${errors.licensePlate ? 'error' : ''}`}
                                placeholder="VD: 29B-12345"
                                value={form.licensePlate}
                                onChange={e => set('licensePlate', e.target.value)}
                            />
                            {errors.licensePlate && <p className="form-error">{errors.licensePlate}</p>}
                        </div>

                        {/* Tên xe */}
                        <div className="form-group">
                            <label className="form-label">Tên xe
                                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400, marginLeft: 6 }}>
                                    (tùy chọn)
                                </span>
                            </label>
                            <input
                                className="form-field"
                                placeholder="VD: Xe số 01"
                                value={form.name}
                                onChange={e => set('name', e.target.value)}
                            />
                        </div>

                        {/* Tài xế */}
                        <div className="form-group">
                            <label className="form-label">Tài xế (tuỳ chọn)</label>
                            <select
                                className="form-field"
                                value={form.driver_id}
                                onChange={e => set('driver_id', e.target.value)}
                            >
                                <option value="">-- Chưa gán tài xế --</option>
                                {drivers.map(d => (
                                    <option key={d._id} value={d._id}>{d.fullName} ({d.phone})</option>
                                ))}
                            </select>
                        </div>
                        
                        {/* Tuyến xe */}
                        <div className="form-group">
                            <label className="form-label">Tuyến xe (tuỳ chọn)</label>
                            <select
                                className="form-field"
                                value={form.route_id}
                                onChange={e => set('route_id', e.target.value)}
                            >
                                <option value="">-- Chưa gán tuyến --</option>
                                {routes.map(r => (
                                    <option key={r._id} value={r._id}>{r.routeName}</option>
                                ))}
                            </select>
                        </div>

                        {/* MAC Address */}
                        <div className="form-group form-group-full">
                            <label className="form-label">MAC Address ESP32
                                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400, marginLeft: 6 }}>
                                    (tùy chọn — dùng để nhận dữ liệu RFID từ mạch)
                                </span>
                            </label>
                            <input
                                className="form-field"
                                placeholder="VD: A4:CF:12:BE:5D:00"
                                value={form.device_mac_address}
                                onChange={e => set('device_mac_address', e.target.value)}
                            />
                            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                                Lấy MAC bằng lệnh <code>WiFi.macAddress()</code> trong code C++ của ESP32.
                            </p>
                        </div>

                        {/* Sức chứa */}
                        <div className="form-group">
                            <label className="form-label">Sức chứa (học sinh)</label>
                            <input
                                className="form-field"
                                type="number" min={1} max={80}
                                value={form.capacity}
                                onChange={e => set('capacity', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="modal-footer">
                        <button type="button" className="btn-cancel" onClick={onClose}>Huỷ bỏ</button>
                        <motion.button
                            type="submit"
                            className="btn-save"
                            disabled={saving}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            {saving ? <Loader2 size={15} className="spin" /> : <Save size={16} />}
                            {mode === 'add' ? 'Thêm xe' : 'Lưu thay đổi'}
                        </motion.button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

// ── Delete Confirm ─────────────────────────────────────────────
const DeleteConfirm: React.FC<{
    bus: BusRecord; onConfirm: () => void; onClose: () => void;
}> = ({ bus, onConfirm, onClose }) => (
    <div className="modal-backdrop" onClick={onClose}>
        <motion.div
            className="modal modal-sm"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.2 }}
            onClick={e => e.stopPropagation()}
        >
            <div className="delete-confirm">
                <div className="delete-icon"><AlertTriangle size={28} /></div>
                <h3>Xác nhận xoá</h3>
                <p>Bạn có chắc muốn xoá xe <strong>{bus.licensePlate}</strong>?<br />Hành động này không thể khôi phục.</p>
                <div className="modal-footer">
                    <button className="btn-cancel" onClick={onClose}>Huỷ</button>
                    <button className="btn-delete" onClick={onConfirm}>
                        <Trash2 size={15} /> Xoá xe
                    </button>
                </div>
            </div>
        </motion.div>
    </div>
);

// ── Main Component ─────────────────────────────────────────────
const BusManagement: React.FC = () => {
    const [buses, setBuses] = useState<BusRecord[]>([]);
    const [drivers, setDrivers] = useState<{ _id: string; fullName: string; phone: string }[]>([]);
    const [routes, setRoutes] = useState<{ _id: string; routeName: string; }[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState<null | { mode: 'add' | 'edit'; bus?: BusRecord }>(null);
    const [del, setDel] = useState<BusRecord | null>(null);

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        toast[type](text);
    };

    // ── Fetch buses ───────────────────────────────────────────
    const fetchBuses = useCallback(async () => {
        setLoading(true);
        try {
            const [busRes, driverRes, routeRes] = await Promise.all([
                busAPI.getAll(),
                userAPI.getAll({ role: 'Driver' }),
                routeAPI.getAll()
            ]);
            setBuses(busRes.data.data as BusRecord[]);
            setDrivers(driverRes.data.data);
            setRoutes(routeRes.data.data);
        } catch {
            showToast('❌ Không thể tải danh sách xe', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchBuses(); }, [fetchBuses]);

    // ── Save (add or edit) ────────────────────────────────────
    const handleSave = async (form: BusForm) => {
        setSaving(true);
        try {
            const payload = {
                licensePlate: form.licensePlate.trim(),
                name: form.name.trim() || '',
                // Luôn đính kèm device_mac_address — kể cả khi rỗng ""
                // để backend nhận biết cần xoá MAC address cũ (set null)
                device_mac_address: form.device_mac_address.trim(),
                capacity: Number(form.capacity) || 45,
                driver_id: form.driver_id || null,
                route_id: form.route_id || null,
            };

            if (modal?.mode === 'add') {
                await busAPI.create(payload);
                showToast(`✅ Đã thêm xe ${payload.licensePlate.toUpperCase()}`);
            } else if (modal?.mode === 'edit' && modal.bus) {
                await busAPI.update(modal.bus._id, payload);
                showToast(`✅ Đã cập nhật xe ${payload.licensePlate.toUpperCase()}`);
            }

            setModal(null);
            await fetchBuses();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Lỗi lưu dữ liệu';
            showToast(`❌ ${msg}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ─────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!del) return;
        try {
            // NOTE: delete API can be added if needed
            showToast(`🗑️ Tính năng xoá xe sẽ được bổ sung sau`);
            setDel(null);
        } catch {
            showToast('❌ Không thể xoá xe', 'error');
        }
    };

    // ── Client-side search ─────────────────────────────────────
    const filtered = buses.filter(b => {
        const q = search.toLowerCase();
        return !q
            || b.licensePlate.toLowerCase().includes(q)
            || b.name?.toLowerCase().includes(q)
            || b.device_mac_address?.toLowerCase().includes(q);
    });

    const toForm = (b: BusRecord): BusForm => ({
        licensePlate: b.licensePlate,
        name: b.name ?? '',
        device_mac_address: b.device_mac_address ?? '',
        capacity: String(b.capacity),
        driver_id: b.driver_id?._id || '',
        route_id: b.route_id?._id || '',
    });

    return (
        <div className="crud-page">
            {/* ── Page Header ──────────────────────────────── */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Quản lý Xe buýt</h1>
                    <p className="page-subtitle">
                        {loading ? 'Đang tải...' : `${buses.length} xe · ${buses.filter(b => b.isOnline).length} đang online`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-filter" onClick={fetchBuses} title="Làm mới">
                        <RefreshCw size={15} />
                    </button>
                    <motion.button
                        className="btn-primary"
                        onClick={() => setModal({ mode: 'add' })}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    >
                        <Plus size={18} /> Thêm Xe
                    </motion.button>
                </div>
            </div>

            {/* ── Toolbar ──────────────────────────────────── */}
            <div className="crud-toolbar">
                <div className="crud-search-wrap">
                    <Search size={16} className="crud-search-icon" />
                    <input
                        className="crud-search"
                        placeholder="Tìm theo biển số, tên xe, MAC address..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    {search && (
                        <button className="crud-search-clear" onClick={() => setSearch('')}>
                            <X size={14} />
                        </button>
                    )}
                </div>
                <span className="result-count">{filtered.length} kết quả</span>
            </div>

            {/* ── Table ────────────────────────────────────── */}
            <div className="card table-card">
                {/* Hướng dẫn copy ID */}
                <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 16px', background: 'var(--warning-light)',
                    borderBottom: '1px solid #FDE68A',
                    fontSize: 12.5, color: '#92400E', lineHeight: 1.5,
                }}>
                    <span style={{ fontSize: 16 }}>💡</span>
                    <span>
                        Cột <strong>MongoDB ID</strong> là <code>_id</code> do MongoDB tự sinh.
                        Dùng nút <strong>Copy</strong> để lấy giá trị rồi điền vào biến <code>BUS_ID</code> trong code C++ ESP32.
                    </span>
                </div>

                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>MongoDB ID <span style={{ color: 'var(--warning)', fontSize: 10 }}>← ESP32</span></th>
                                <th>Biển số</th>
                                <th>Tên xe</th>
                                <th>Tuyến đang chạy</th>
                                <th>Tài xế</th>
                                <th>MAC ESP32</th>
                                <th>Sức chứa</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout">
                                {loading ? (
                                    <tr key="loading">
                                        <td colSpan={8} className="empty-row">
                                            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }} />
                                            Đang tải dữ liệu từ MongoDB...
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr key="empty">
                                        <td colSpan={8} className="empty-row">
                                            <Bus size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                                            {search ? 'Không tìm thấy xe nào' : 'Chưa có xe nào. Nhấn "Thêm Xe" để bắt đầu.'}
                                        </td>
                                    </tr>
                                ) : filtered.map((bus, idx) => (
                                    <motion.tr key={bus._id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ delay: idx * 0.04, duration: 0.25 }}
                                        layout
                                    >
                                        <td className="row-num">{idx + 1}</td>

                                        {/* MongoDB _id — highlighted */}
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <code style={{
                                                    fontSize: 11, fontFamily: 'Consolas, monospace',
                                                    background: 'var(--purple-light)', border: '1px solid rgba(139, 92, 246, 0.3)',
                                                    borderRadius: 4, padding: '2px 6px', color: '#7C3AED',
                                                }}>
                                                    {bus._id}
                                                </code>
                                                <CopyBtn text={bus._id} />
                                            </div>
                                        </td>

                                        <td><span className="bus-badge">{bus.licensePlate}</span></td>

                                        <td style={{
                                            color: bus.name ? '#0F172A' : '#94A3B8',
                                            fontStyle: bus.name ? 'normal' : 'italic',
                                        }}>
                                            {bus.name || '—'}
                                        </td>
                                        
                                        <td>
                                            {bus.route_id ? (
                                                <span style={{ 
                                                    background: 'var(--primary-light)', color: 'var(--primary)', 
                                                    padding: '4px 8px', borderRadius: '6px', fontSize: 12, fontWeight: 600 
                                                }}>
                                                    {bus.route_id.routeName}
                                                </span>
                                            ) : (
                                                <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: 12 }}>Chưa gán</span>
                                            )}
                                        </td>

                                        <td>
                                            {bus.driver_id ? (
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: 13, fontWeight: 600 }}>{bus.driver_id.fullName}</span>
                                                    <span style={{ fontSize: 11, color: '#64748B' }}>{bus.driver_id.phone}</span>
                                                </div>
                                            ) : (
                                                <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: 12 }}>Chưa gán</span>
                                            )}
                                        </td>

                                        <td>
                                            {bus.device_mac_address ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <code style={{
                                                        fontSize: 11, fontFamily: 'Consolas, monospace',
                                                        background: 'var(--bg)', borderRadius: 4,
                                                        padding: '2px 6px', color: '#374151',
                                                    }}>
                                                        {bus.device_mac_address}
                                                    </code>
                                                    <CopyBtn text={bus.device_mac_address} />
                                                </div>
                                            ) : (
                                                <span style={{ color: '#94A3B8', fontStyle: 'italic', fontSize: 12 }}>Chưa gán</span>
                                            )}
                                        </td>

                                        <td style={{ textAlign: 'center' }}>{bus.capacity}</td>

                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                                {bus.isOnline
                                                    ? <><Wifi size={12} color="var(--success)" /><span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>Online</span></>
                                                    : <><WifiOff size={12} color="#9CA3AF" /><span style={{ fontSize: 12, color: '#6B7280' }}>Offline</span></>
                                                }
                                            </div>
                                        </td>

                                        <td>
                                            <div className="action-btns">
                                                <button
                                                    className="action-btn edit"
                                                    onClick={() => setModal({ mode: 'edit', bus })}
                                                    title="Sửa"
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                                <button
                                                    className="action-btn delete"
                                                    onClick={() => setDel(bus)}
                                                    title="Xoá"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Modals ───────────────────────────────────── */}
            <AnimatePresence>
                {modal && (
                    <BusModal
                        mode={modal.mode}
                        initial={modal.bus ? toForm(modal.bus) : undefined}
                        saving={saving}
                        drivers={drivers}
                        routes={routes}
                        onSave={handleSave}
                        onClose={() => setModal(null)}
                    />
                )}
                {del && (
                    <DeleteConfirm
                        bus={del}
                        onConfirm={handleDelete}
                        onClose={() => setDel(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default BusManagement;
