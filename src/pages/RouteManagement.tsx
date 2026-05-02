/**
 * RouteManagement — Trang quản lý tuyến đường cho Admin
 * Layout: panel trái (danh sách + form) | bản đồ Leaflet (phải)
 * - Click vào bản đồ → thêm điểm dừng (lat/lng tự động)
 * - Kéo marker trường học → cập nhật vị trí trường
 * - Vẽ Polyline nối các điểm dừng
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, Save, Map as MapIcon, Route,
    ChevronRight, ChevronDown, Edit3, X, Loader2,
    GripVertical, Clock,
} from 'lucide-react';
import { routeAPI } from '../services/api';

// ── Fix Leaflet icon ─────────────────────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Types ────────────────────────────────────────────────────
interface Stop {
    stopName: string;
    lat: number;
    lng: number;
    expected_time: string;
    order: number;
}

interface RouteDoc {
    _id: string;
    routeName: string;
    description: string;
    stops: Stop[];
    schoolPos?: { lat: number; lng: number };
}

// ── Icons ─────────────────────────────────────────────────────
const makeStopIcon = (index: number, isSelected: boolean) => L.divIcon({
    className: '',
    html: `<div style="
        width:${isSelected ? 32 : 26}px; height:${isSelected ? 32 : 26}px;
        background:${isSelected ? '#2563EB' : '#3B82F6'};
        color:white; border:2px solid white;
        border-radius:50%; display:flex; align-items:center;
        justify-content:center; font-size:11px; font-weight:700;
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
    ">${index + 1}</div>`,
    iconSize: [isSelected ? 32 : 26, isSelected ? 32 : 26],
    iconAnchor: [isSelected ? 16 : 13, isSelected ? 16 : 13],
});

const SCHOOL_ICON = L.divIcon({
    className: '',
    html: `<div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">🏫</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
});

const ROUTE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444'];
const DEFAULT_CENTER: [number, number] = [20.9764, 105.7777];

// ── Map click handler ─────────────────────────────────────────
interface MapClickHandlerProps {
    onClick: (lat: number, lng: number) => void;
}
const MapClickHandler: React.FC<MapClickHandlerProps> = ({ onClick }) => {
    useMapEvents({
        click(e) { onClick(e.latlng.lat, e.latlng.lng); },
    });
    return null;
};

// ── Main Component ────────────────────────────────────────────
const RouteManagement: React.FC = () => {
    const [routes, setRoutes] = useState<RouteDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null); // null = new

    // Form state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formName, setFormName] = useState('');
    const [formDesc, setFormDesc] = useState('');
    const [formStops, setFormStops] = useState<Stop[]>([]);
    const [schoolPos, setSchoolPos] = useState<[number, number]>(DEFAULT_CENTER);
    const [selectedStopIdx, setSelectedStopIdx] = useState<number | null>(null);
    const [mapMode, setMapMode] = useState<'add_stop' | 'move_school' | 'view'>('add_stop');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const nameRef = useRef<HTMLInputElement>(null);

    // ── Fetch routes ──────────────────────────────────────────
    const fetchRoutes = useCallback(async () => {
        try {
            const res = await routeAPI.getAll();
            setRoutes(res.data.data);
        } catch {
            setError('Không thể tải danh sách tuyến');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRoutes(); }, [fetchRoutes]);

    // ── Open form for new route ───────────────────────────────
    const openNew = () => {
        setEditingId(null);
        setFormName('');
        setFormDesc('');
        setFormStops([]);
        setSchoolPos(DEFAULT_CENTER);
        setSelectedStopIdx(null);
        setMapMode('add_stop');
        setError('');
        setIsFormOpen(true);
        setTimeout(() => nameRef.current?.focus(), 100);
    };

    // ── Open form to edit existing route ─────────────────────
    const openEdit = (route: RouteDoc) => {
        setEditingId(route._id);
        setFormName(route.routeName);
        setFormDesc(route.description ?? '');
        setFormStops(route.stops.map((s, i) => ({ ...s, order: i })));
        setSchoolPos(route.schoolPos ? [route.schoolPos.lat, route.schoolPos.lng] : DEFAULT_CENTER);
        setSelectedStopIdx(null);
        setMapMode('view');
        setError('');
        setIsFormOpen(true);
    };

    // ── Map click: add stop or move school ───────────────────
    const handleMapClick = (lat: number, lng: number) => {
        if (mapMode === 'add_stop') {
            const newStop: Stop = {
                stopName: `Điểm dừng ${formStops.length + 1}`,
                lat,
                lng,
                expected_time: '',
                order: formStops.length,
            };
            setFormStops(prev => [...prev, newStop]);
        } else if (mapMode === 'move_school') {
            setSchoolPos([lat, lng]);
            setMapMode('view');
        }
    };

    // ── Remove stop ───────────────────────────────────────────
    const removeStop = (idx: number) => {
        setFormStops(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));
        if (selectedStopIdx === idx) setSelectedStopIdx(null);
    };

    // ── Update stop field ─────────────────────────────────────
    const updateStop = (idx: number, field: keyof Stop, value: string | number) => {
        setFormStops(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
    };

    // ── Save route ────────────────────────────────────────────
    const saveRoute = async () => {
        if (!formName.trim()) { setError('Vui lòng nhập tên tuyến'); return; }
        setSaving(true);
        setError('');
        try {
            const payload = { routeName: formName.trim(), description: formDesc.trim(), stops: formStops, schoolPos: { lat: schoolPos[0], lng: schoolPos[1] } };
            if (editingId) {
                await routeAPI.update(editingId, payload);
            } else {
                await routeAPI.create(payload);
            }
            setSuccess(editingId ? 'Đã cập nhật tuyến!' : 'Đã tạo tuyến mới!');
            setIsFormOpen(false);
            fetchRoutes();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            setError(msg ?? 'Lưu thất bại');
        } finally {
            setSaving(false);
        }
    };

    // ── Delete route ──────────────────────────────────────────
    const deleteRoute = async (id: string) => {
        if (!confirm('Xóa tuyến đường này?')) return;
        try {
            await routeAPI.remove(id);
            fetchRoutes();
        } catch { setError('Xóa thất bại'); }
    };

    const polyline: [number, number][] = formStops.map(s => [s.lat, s.lng]);

    return (
        <div style={{ display: 'flex', height: '100%', gap: 0, overflow: 'hidden' }}>
            {/* ── Left panel ─────────────────────────────────── */}
            <div style={{
                width: isFormOpen ? 380 : 320, minWidth: isFormOpen ? 380 : 300,
                background: 'white', borderRight: '1px solid #E2E8F0',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                transition: 'width 0.3s ease',
            }}>
                {/* Header */}
                <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 36, height: 36, background: '#EFF6FF', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Route size={18} color="#2563EB" />
                            </div>
                            <div>
                                <h1 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Quản lý Tuyến</h1>
                                <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{routes.length} tuyến đang hoạt động</p>
                            </div>
                        </div>
                        {!isFormOpen && (
                            <button onClick={openNew} style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                                background: '#2563EB', color: 'white', border: 'none', borderRadius: 8,
                                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                            }}>
                                <Plus size={14} /> Tuyến mới
                            </button>
                        )}
                    </div>

                    {/* Success/Error banners */}
                    <AnimatePresence>
                        {success && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                style={{ marginTop: 10, padding: '8px 12px', background: '#F0FDF4', borderRadius: 8, fontSize: 13, color: '#059669', border: '1px solid #BBF7D0' }}>
                                ✓ {success}
                            </motion.div>
                        )}
                        {error && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                style={{ marginTop: 10, padding: '8px 12px', background: '#FEF2F2', borderRadius: 8, fontSize: 13, color: '#DC2626', border: '1px solid #FECACA' }}>
                                ✗ {error}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                    {/* ── Edit Form ──────────────────────────────── */}
                    <AnimatePresence>
                        {isFormOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                style={{ background: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #E2E8F0' }}
                            >
                                {/* Form header */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Edit3 size={14} color="#2563EB" />
                                        <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                                            {editingId ? 'Chỉnh sửa tuyến' : 'Tuyến mới'}
                                        </span>
                                    </div>
                                    <button onClick={() => setIsFormOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Route name */}
                                <div style={{ marginBottom: 10 }}>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Tên tuyến *</label>
                                    <input
                                        ref={nameRef}
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        placeholder="VD: Tuyến 1 - Hà Đông"
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div style={{ marginBottom: 14 }}>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Mô tả</label>
                                    <input
                                        value={formDesc}
                                        onChange={e => setFormDesc(e.target.value)}
                                        placeholder="Mô tả tuyến đường (tùy chọn)"
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>

                                {/* Map mode buttons */}
                                <div style={{ marginBottom: 12 }}>
                                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Chế độ bản đồ:</p>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        {[
                                            { mode: 'add_stop' as const, label: '📍 Thêm điểm dừng' },
                                            { mode: 'move_school' as const, label: '🏫 Đặt trường học' },
                                            { mode: 'view' as const, label: '👁 Xem' },
                                        ].map(btn => (
                                            <button
                                                key={btn.mode}
                                                onClick={() => setMapMode(btn.mode)}
                                                style={{
                                                    flex: 1, padding: '6px 4px', borderRadius: 7, border: '1.5px solid',
                                                    borderColor: mapMode === btn.mode ? '#2563EB' : '#E2E8F0',
                                                    background: mapMode === btn.mode ? '#EFF6FF' : 'white',
                                                    color: mapMode === btn.mode ? '#2563EB' : '#6B7280',
                                                    fontSize: 10, flexShrink: 0, cursor: 'pointer',
                                                }}
                                            >
                                                {btn.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                                        {mapMode === 'add_stop' && '↖ Click vào bản đồ để thêm điểm dừng'}
                                        {mapMode === 'move_school' && '↖ Click vào bản đồ để đặt vị trí trường học'}
                                        {mapMode === 'view' && 'Click vào điểm dừng trên danh sách để xem trên bản đồ'}
                                    </p>
                                </div>

                                {/* Stops list */}
                                <div style={{ marginBottom: 14 }}>
                                    <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                                        Điểm dừng ({formStops.length})
                                    </p>
                                    {formStops.length === 0 ? (
                                        <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: 12, border: '1.5px dashed #E2E8F0', borderRadius: 8 }}>
                                            <MapIcon size={20} style={{ margin: '0 auto 6px', opacity: 0.5 }} />
                                            <p>Chưa có điểm dừng.<br />Chọn "Thêm điểm dừng" rồi click bản đồ.</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {formStops.map((stop, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.96 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    onClick={() => setSelectedStopIdx(idx === selectedStopIdx ? null : idx)}
                                                    style={{
                                                        background: selectedStopIdx === idx ? '#EFF6FF' : 'white',
                                                        border: `1.5px solid ${selectedStopIdx === idx ? '#BFDBFE' : '#E2E8F0'}`,
                                                        borderRadius: 8, cursor: 'pointer',
                                                    }}
                                                >
                                                    <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <GripVertical size={12} color="#CBD5E1" />
                                                        <div style={{
                                                            width: 22, height: 22, background: '#2563EB', color: 'white',
                                                            borderRadius: '50%', fontSize: 11, fontWeight: 700,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                        }}>{idx + 1}</div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <input
                                                                value={stop.stopName}
                                                                onChange={e => { e.stopPropagation(); updateStop(idx, 'stopName', e.target.value); }}
                                                                onClick={e => e.stopPropagation()}
                                                                style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 12, fontWeight: 600, color: '#0F172A', outline: 'none' }}
                                                            />
                                                            <p style={{ fontSize: 10, color: '#94A3B8', margin: 0 }}>
                                                                {stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); removeStop(idx); }}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2 }}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                    {selectedStopIdx === idx && (
                                                        <div style={{ padding: '0 10px 10px', borderTop: '1px solid #E0F2FE' }}>
                                                            <label style={{ fontSize: 11, color: '#374151', display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                                                                <Clock size={11} /> Giờ dự kiến:
                                                            </label>
                                                            <input
                                                                type="time"
                                                                value={stop.expected_time}
                                                                onChange={e => updateStop(idx, 'expected_time', e.target.value)}
                                                                style={{ marginTop: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid #E2E8F0', fontSize: 12 }}
                                                            />
                                                        </div>
                                                    )}
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Save button */}
                                <button
                                    onClick={saveRoute}
                                    disabled={saving}
                                    style={{
                                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        padding: '10px', background: saving ? '#94A3B8' : '#2563EB', color: 'white',
                                        border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 600,
                                        cursor: saving ? 'not-allowed' : 'pointer',
                                    }}
                                >
                                    {saving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Đang lưu...</> : <><Save size={15} /> Lưu tuyến</>}
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Routes list ───────────────────────────── */}
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: 24, color: '#94A3B8' }}>
                            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                            <p style={{ fontSize: 13 }}>Đang tải...</p>
                        </div>
                    ) : routes.length === 0 && !isFormOpen ? (
                        <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>
                            <Route size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                            <p style={{ fontSize: 14, fontWeight: 600 }}>Chưa có tuyến nào</p>
                            <p style={{ fontSize: 12, marginTop: 4 }}>Nhấn "Tuyến mới" để bắt đầu</p>
                        </div>
                    ) : routes.map((route, ri) => {
                        const isExpanded = expandedId === route._id;
                        const color = ROUTE_COLORS[ri % ROUTE_COLORS.length];
                        return (
                            <motion.div key={route._id} layout style={{ marginBottom: 10, background: 'white', borderRadius: 12, border: '1.5px solid #E2E8F0', overflow: 'hidden' }}>
                                {/* Route header */}
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}
                                    onClick={() => setExpandedId(isExpanded ? null : route._id)}
                                >
                                    <div style={{ width: 6, height: 32, background: color, borderRadius: 3, flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {route.routeName}
                                        </p>
                                        <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{route.stops.length} điểm dừng</p>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                        <button
                                            onClick={e => { e.stopPropagation(); openEdit(route); }}
                                            style={{ background: '#F1F5F9', border: 'none', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: '#374151' }}
                                            title="Chỉnh sửa"
                                        >
                                            <Edit3 size={13} />
                                        </button>
                                        <button
                                            onClick={e => { e.stopPropagation(); deleteRoute(route._id); }}
                                            style={{ background: '#FEF2F2', border: 'none', borderRadius: 6, padding: '5px 7px', cursor: 'pointer', color: '#EF4444' }}
                                            title="Xóa"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                        {isExpanded ? <ChevronDown size={15} color="#94A3B8" /> : <ChevronRight size={15} color="#94A3B8" />}
                                    </div>
                                </div>

                                {/* Stops dropdown */}
                                <AnimatePresence>
                                    {isExpanded && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            style={{ borderTop: '1px solid #F1F5F9', padding: '8px 14px 12px' }}
                                        >
                                            {route.stops.length === 0 ? (
                                                <p style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>Chưa có điểm dừng</p>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    {[...route.stops].sort((a, b) => a.order - b.order).map((stop, si) => (
                                                        <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 7, background: '#F8FAFC' }}>
                                                            <span style={{
                                                                width: 20, height: 20, background: color, color: 'white',
                                                                borderRadius: '50%', fontSize: 10, fontWeight: 700,
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                flexShrink: 0,
                                                            }}>{si + 1}</span>
                                                            <div style={{ flex: 1 }}>
                                                                <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: 0 }}>{stop.stopName}</p>
                                                                {stop.expected_time && (
                                                                    <p style={{ fontSize: 10, color: '#94A3B8', margin: 0 }}>{stop.expected_time}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* ── Right: Leaflet Map ──────────────────────────── */}
            <div style={{ flex: 1, position: 'relative' }}>
                <style>{`
                    @keyframes spin { to { transform: rotate(360deg); } }
                    .leaflet-popup-content-wrapper {
                        border-radius: 12px !important;
                        box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important;
                    }
                    .leaflet-popup-tip-container { display: none; }
                `}</style>

                {/* Map mode indicator overlay */}
                {isFormOpen && (
                    <div style={{
                        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
                        zIndex: 1000, background: 'rgba(37,99,235,0.92)', backdropFilter: 'blur(8px)',
                        color: 'white', padding: '8px 18px', borderRadius: 24, fontSize: 13, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 8,
                        boxShadow: '0 4px 20px rgba(37,99,235,0.4)',
                        pointerEvents: 'none',
                    }}>
                        {mapMode === 'add_stop' && <><span style={{ width: 8, height: 8, background: '#86EFAC', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} /> Click bản đồ để thêm điểm dừng</>}
                        {mapMode === 'move_school' && '🏫 Click để đặt vị trí trường học'}
                        {mapMode === 'view' && '👁 Chế độ xem'}
                    </div>
                )}

                <MapContainer
                    center={DEFAULT_CENTER}
                    zoom={13}
                    style={{ width: '100%', height: '100%' }}
                    zoomControl={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Click handler — only active in form mode */}
                    {isFormOpen && mapMode !== 'view' && (
                        <MapClickHandler onClick={handleMapClick} />
                    )}

                    {/* Editable School marker — only shown during edit */}
                    {isFormOpen && (
                        <Marker
                            position={schoolPos}
                            icon={SCHOOL_ICON}
                            draggable={isFormOpen && mapMode === 'move_school'}
                            eventHandlers={{
                                dragend: (e) => {
                                    const m = e.target as L.Marker;
                                    const p = m.getLatLng();
                                    setSchoolPos([p.lat, p.lng]);
                                },
                            }}
                        >
                            <Popup>
                                <div style={{ padding: '8px 12px' }}>
                                    <p style={{ fontWeight: 700 }}>🏫 Trường học</p>
                                    <p style={{ fontSize: 11, color: '#64748B' }}>{schoolPos[0].toFixed(5)}, {schoolPos[1].toFixed(5)}</p>
                                </div>
                            </Popup>
                        </Marker>
                    )}

                    {/* ── Form editing: current stops on map ───── */}
                    {isFormOpen && (
                        <>
                            {formStops.length >= 2 && (
                                <Polyline positions={polyline} color="#2563EB" weight={3} dashArray="8,4" />
                            )}
                            {formStops.map((stop, idx) => (
                                <Marker
                                    key={`edit-${idx}`}
                                    position={[stop.lat, stop.lng]}
                                    icon={makeStopIcon(idx, selectedStopIdx === idx)}
                                    eventHandlers={{ click: () => setSelectedStopIdx(idx === selectedStopIdx ? null : idx) }}
                                >
                                    <Popup>
                                        <div style={{ padding: '8px 12px', minWidth: 150 }}>
                                            <p style={{ fontWeight: 700, fontSize: 13 }}>{stop.stopName}</p>
                                            <p style={{ fontSize: 11, color: '#64748B' }}>{stop.lat.toFixed(5)}, {stop.lng.toFixed(5)}</p>
                                            <button
                                                onClick={() => removeStop(idx)}
                                                style={{ marginTop: 6, padding: '4px 10px', background: '#FEF2F2', color: '#EF4444', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                                            >
                                                🗑 Xóa điểm này
                                            </button>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </>
                    )}

                    {/* ── Existing routes rendered on map ────────── */}
                    {!isFormOpen && routes.map((route, ri) => {
                        const color = ROUTE_COLORS[ri % ROUTE_COLORS.length];
                        const sorted = [...route.stops].sort((a, b) => a.order - b.order);
                        const positions: [number, number][] = sorted.map(s => [s.lat, s.lng]);
                        return (
                            <React.Fragment key={route._id}>
                                {route.schoolPos && (
                                     <Marker position={[route.schoolPos.lat, route.schoolPos.lng]} icon={SCHOOL_ICON}>
                                         <Popup>
                                             <div style={{ padding: '8px 12px' }}>
                                                 <p style={{ fontWeight: 700 }}>🏫 Trường học</p>
                                                 <p style={{ fontSize: 11, color: '#64748B' }}>Tuyến: {route.routeName}</p>
                                             </div>
                                         </Popup>
                                     </Marker>
                                )}
                                {positions.length >= 2 && (
                                    <Polyline positions={positions} color={color} weight={3} opacity={0.65} dashArray="8,4" />
                                )}
                                {sorted.map((stop, si) => (
                                    <Marker key={`${route._id}-${si}`} position={[stop.lat, stop.lng]} icon={makeStopIcon(si, false)}>
                                        <Popup>
                                            <div style={{ padding: '8px 12px' }}>
                                                <p style={{ fontWeight: 700, fontSize: 13 }}>{stop.stopName}</p>
                                                <p style={{ fontSize: 11, color: '#64748B' }}>{route.routeName}</p>
                                                {stop.expected_time && <p style={{ fontSize: 11, color: '#94A3B8' }}>⏰ {stop.expected_time}</p>}
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </React.Fragment>
                        );
                    })}
                </MapContainer>
            </div>
        </div>
    );
};

export default RouteManagement;
