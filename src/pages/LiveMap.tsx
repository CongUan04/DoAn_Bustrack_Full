/**
 * LiveMap — Real-time GPS Tracking với Leaflet + Socket.io thực tế
 * Layout: 80% bản đồ (trái) + 20% sidebar (phải)
 * Dữ liệu xe & tuyến đường lấy từ MongoDB qua REST API.
 * Vị trí xe cập nhật realtime qua Socket.io (sự kiện gps_update).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Navigation, Users, Clock, Bus, Radio,
    AlertTriangle, RefreshCw, Wifi, WifiOff, Phone,
    MapPin, Gauge, GraduationCap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { busAPI, routeAPI, attendanceAPI } from '../services/api';
// import { toast } from 'react-toastify';

// ── Fix Leaflet default icon path (Vite issue) ───────────────
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
    order: number;
    expected_time?: string;
}

interface RouteData {
    _id: string;
    routeName: string;
    stops: Stop[];
    schoolPos?: { lat: number; lng: number };
}

interface BusData {
    _id: string;
    licensePlate: string;
    capacity: number;
    isOnline: boolean;
    currentLat: number | null;
    currentLng: number | null;
    currentSpeed: number;
    lastSeen: string | null;
    driver_id: { fullName: string; phone: string } | null;
    route_id: RouteData | null;
}

// Derived display type
interface BusDisplay extends BusData {
    lat: number;
    lng: number;
    speed: number;
    status: 'active' | 'idle' | 'offline';
    lastUpdate: Date;
    distanceToSchool?: number;
    etaMins?: number;
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; hex: string }> = {
    active: { label: 'Đang chạy', color: '#059669', bg: 'var(--success-light)', hex: '#10B981' },
    idle: { label: 'Dừng chờ', color: '#6B7280', bg: 'var(--surface-hover)', hex: '#9CA3AF' },
    offline: { label: 'Offline', color: '#DC2626', bg: 'var(--danger-light)', hex: '#EF4444' },
};

// default school
const SCHOOL_POS: [number, number] = [20.9764, 105.7777];

// ── Custom bus DivIcon ────────────────────────────────────────
const makeBusIcon = (status: string, selected: boolean) => {
    const hex = STATUS_CFG[status]?.hex ?? '#9CA3AF';
    const size = selected ? 44 : 36;
    return L.divIcon({
        className: '',
        html: `
      <div style="
        width:${size}px; height:${size}px;
        background:white;
        border:3px solid ${hex};
        border-radius:50%;
        display:flex; align-items:center; justify-content:center;
        font-size:${selected ? 20 : 16}px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.22);
        ${selected ? `box-shadow: 0 0 0 4px ${hex}44, 0 6px 20px rgba(0,0,0,0.25);` : ''}
      ">🚌</div>
      ${status === 'active' ? `
        <div style="
          position:absolute; inset:-6px; border:2px solid ${hex};
          border-radius:50%; opacity:0.35;
          animation:ripple 2s ease-out infinite;
        "></div>` : ''}
    `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -(size / 2 + 6)],
    });
};

const SCHOOL_ICON = L.divIcon({
    className: '',
    html: `<div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">🏫</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
});

const STOP_ICON = L.divIcon({
    className: '',
    html: `<div style="width:10px;height:10px;background:#3B82F6;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
});

// ── Route colors ─────────────────────────────────────────────
const ROUTE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#EF4444'];

// ── Fly to selected bus ───────────────────────────────────────
const FlyTo: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
    const map = useMap();
    useEffect(() => {
        // Dùng panTo thay vì flyTo để theo dõi xe mượt mà hơn khi GPS cập nhật liên tục
        map.panTo([lat, lng], { animate: true, duration: 0.5 });
    }, [lat, lng, map]);
    return null;
};

// ── Format relative time ──────────────────────────────────────
const relativeTime = (date: Date) => {
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return `${diff}s trước`;
    return `${Math.floor(diff / 60)} phút trước`;
};

// ── Calculate Distance (Haversine) ───────────────────────────
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// ── Convert BusData → BusDisplay ─────────────────────────────
const toBusDisplay = (bus: BusData): BusDisplay => {
    const hasGps = bus.currentLat != null && bus.currentLng != null;
    const status: BusDisplay['status'] = !hasGps || !bus.isOnline
        ? 'offline'
        : bus.currentSpeed > 0 ? 'active' : 'idle';
        
    let distanceToSchool: number | undefined;
    let etaMins: number | undefined;

    if (hasGps && bus.route_id?.schoolPos) {
        distanceToSchool = calculateDistance(bus.currentLat!, bus.currentLng!, bus.route_id.schoolPos.lat, bus.route_id.schoolPos.lng);
        const speedToUse = Math.max(bus.currentSpeed, 20); // min 20km/h estimation
        etaMins = (distanceToSchool / speedToUse) * 60;
    }

    return {
        ...bus,
        lat: bus.currentLat ?? SCHOOL_POS[0],
        lng: bus.currentLng ?? SCHOOL_POS[1],
        speed: bus.currentSpeed,
        status,
        lastUpdate: bus.lastSeen ? new Date(bus.lastSeen) : new Date(),
        distanceToSchool,
        etaMins
    };
};

// ── Main Component ────────────────────────────────────────────
const LiveMap: React.FC = () => {
    const { user } = useAuth();
    const { gpsUpdates, connected, recentSwipes } = useSocket();
    const isAdmin = user?.role === 'admin';

    const [buses, setBuses] = useState<BusDisplay[]>([]);
    const [routes, setRoutes] = useState<RouteData[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [busStudents, setBusStudents] = useState<{ student: { _id: string; fullName: string; studentCode: string; class: string }; action_type: string; scan_time: string }[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [, setTick] = useState(0);
    const popupRefs = useRef<Record<string, L.Popup | null>>({});

    // ── Fetch buses on mount ──────────────────────────────────
    const fetchBuses = useCallback(async () => {
        try {
            const [busRes, routeRes] = await Promise.all([
                busAPI.getAll(),
                routeAPI.getAll(),
            ]);
            const raw: BusData[] = busRes.data.data;
            const displayed = isAdmin ? raw : raw.slice(0, 1);
            const converted = displayed.map(toBusDisplay);
            setBuses(converted);
            setRoutes(routeRes.data.data as RouteData[]);
            if (converted.length > 0 && !selectedId) {
                setSelectedId(converted[0]._id);
            }
        } catch (err) {
            console.error('[LiveMap] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [isAdmin, selectedId]);

    useEffect(() => {
        fetchBuses();
        // Refresh bus list every 60s (GPS positions come via socket)
        const t = setInterval(fetchBuses, 60000);
        return () => clearInterval(t);
    }, [fetchBuses]);

    // ── Apply GPS socket updates to bus positions in real-time ─
    useEffect(() => {
        if (Object.keys(gpsUpdates).length === 0) return;
        setBuses(prev => prev.map(bus => {
            const update = gpsUpdates[bus._id];
            if (!update) return bus;
            
            let distanceToSchool: number | undefined = bus.distanceToSchool;
            let etaMins: number | undefined = bus.etaMins;

            if (bus.route_id?.schoolPos) {
                distanceToSchool = calculateDistance(update.lat, update.lng, bus.route_id.schoolPos.lat, bus.route_id.schoolPos.lng);
                const speedToUse = Math.max(update.speed, 20);
                etaMins = (distanceToSchool / speedToUse) * 60;
            }

            return {
                ...bus,
                lat: update.lat,
                lng: update.lng,
                speed: update.speed,
                status: update.speed > 0 ? 'active' : 'idle',
                lastUpdate: new Date(update.timestamp),
                distanceToSchool,
                etaMins
            };
        }));
    }, [gpsUpdates]);

    // Tick for relative timestamps
    useEffect(() => {
        const t = setInterval(() => setTick(n => n + 1), 10000);
        return () => clearInterval(t);
    }, []);

    // ── Notify when near or arrived at school ─────────────────
    const notifiedRef = useRef<Record<string, { near: boolean; arrived: boolean }>>({});
    useEffect(() => {
        buses.forEach(bus => {
            if (bus.distanceToSchool === undefined || bus.etaMins === undefined || bus.status === 'offline') return;

            if (!notifiedRef.current[bus._id]) {
                notifiedRef.current[bus._id] = { near: false, arrived: false };
            }
            const state = notifiedRef.current[bus._id];

            if (bus.distanceToSchool <= 0.1 && !state.arrived) {
                // Không hiển thị toast để tránh spam màn hình Admin
                state.arrived = true;
                state.near = true;
            } else if (bus.distanceToSchool > 0.1 && bus.etaMins <= 5 && !state.near) {
                // Không hiển thị toast để tránh spam màn hình Admin
                state.near = true;
            } else if (bus.distanceToSchool > 1) {
                state.near = false;
                state.arrived = false;
            }
        });
    }, [buses]);

    const selected = buses.find(b => b._id === selectedId) ?? buses[0] ?? null;

    // Fetch students on bus when selection changes or new swipe occurs
    const fetchStudents = useCallback(() => {
        if (!selected) { setBusStudents([]); return; }
        setLoadingStudents(true);
        attendanceAPI.getBusStudentsToday(selected._id)
            .then(res => setBusStudents(res.data.data))
            .catch(() => setBusStudents([]))
            .finally(() => setLoadingStudents(false));
    }, [selected?._id]);

    useEffect(() => {
        fetchStudents();
    }, [fetchStudents]);

    const prevSwipeRef = useRef<any>(null);
    useEffect(() => {
        const latestSwipe = recentSwipes[0];
        if (!latestSwipe || latestSwipe === prevSwipeRef.current) return;
        prevSwipeRef.current = latestSwipe;
        if (selected && latestSwipe.busId === selected._id) {
            fetchStudents(); // Refresh student list when someone boards/drops
        }
    }, [recentSwipes, selected, fetchStudents]);

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: '#94A3B8' }}>
                <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Đang tải dữ liệu từ server...</span>
            </div>
        );
    }

    return (
        <div className="livemap-full">
            {/* ── Leaflet map (80%) ─── */}
            <div className="leaflet-wrap">
                <style>{`
          @keyframes ripple {
            0%   { transform: scale(1);   opacity: 0.35; }
            100% { transform: scale(1.9); opacity: 0; }
          }
          .leaflet-popup-content-wrapper {
            border-radius: 14px !important;
            box-shadow: 0 8px 24px rgba(0,0,0,0.15) !important;
            border: none !important;
            padding: 0 !important;
            overflow: hidden;
          }
          .leaflet-popup-content { margin: 0 !important; width: auto !important; }
          .leaflet-popup-tip-container { display: none; }
          .leaflet-container { font-family: 'Inter', sans-serif; }
        `}</style>

                <MapContainer
                    center={[20.9764, 105.7900]}
                    zoom={13}
                    style={{ width: '100%', height: '100%' }}
                    zoomControl={false}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Fly to selected bus */}
                    {selected && selected.status !== 'offline' && (
                        <FlyTo lat={selected.lat} lng={selected.lng} />
                    )}

                    {/* School markers — from routes with schoolPos */}
                    {routes.filter(r => r.schoolPos?.lat && r.schoolPos?.lng).map(route => (
                        <Marker
                            key={`school-${route._id}`}
                            position={[route.schoolPos!.lat, route.schoolPos!.lng]}
                            icon={SCHOOL_ICON}
                        >
                            <Popup>
                                <div style={{ padding: '10px 14px', minWidth: 180 }}>
                                    <p style={{ fontWeight: 700, color: '#0F172A', marginBottom: 2 }}>🏫 Trường học</p>
                                    <p style={{ fontSize: 11, color: '#94A3B8' }}>Tuyến: {route.routeName}</p>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Route polylines from DB */}
                    {buses.map((bus, idx) => {
                        const route = bus.route_id;
                        if (!route || route.stops.length < 2) return null;
                        const sortedStops = [...route.stops].sort((a, b) => a.order - b.order);
                        const positions: [number, number][] = sortedStops.map(s => [s.lat, s.lng]);
                        const color = ROUTE_COLORS[idx % ROUTE_COLORS.length];
                        return (
                            <React.Fragment key={`route-${bus._id}`}>
                                <Polyline
                                    positions={positions}
                                    color={color}
                                    weight={3}
                                    opacity={0.6}
                                    dashArray="8,4"
                                />
                                {/* Stop markers */}
                                {sortedStops.map((stop, si) => (
                                    <Marker key={`stop-${si}`} position={[stop.lat, stop.lng]} icon={STOP_ICON}>
                                        <Popup>
                                            <div style={{ padding: '8px 12px', minWidth: 160 }}>
                                                <p style={{ fontWeight: 600, fontSize: 13, color: '#0F172A' }}>
                                                    📍 {stop.stopName}
                                                </p>
                                                {stop.expected_time && (
                                                    <p style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                                                        Giờ dự kiến: {stop.expected_time}
                                                    </p>
                                                )}
                                            </div>
                                        </Popup>
                                    </Marker>
                                ))}
                            </React.Fragment>
                        );
                    })}

                    {/* Bus markers */}
                    {buses.map(bus => (
                        <Marker
                            key={bus._id}
                            position={[bus.lat, bus.lng]}
                            icon={makeBusIcon(bus.status, bus._id === selectedId)}
                            eventHandlers={{
                                click: () => {
                                    if (selectedId === bus._id) fetchStudents();
                                    else setSelectedId(bus._id);
                                },
                                popupopen: (e) => { 
                                    popupRefs.current[bus._id] = e.popup; 
                                    if (selectedId === bus._id) fetchStudents();
                                },
                            }}
                        >
                            <Popup>
                                <BusPopup 
                                    bus={bus} 
                                    isSelected={bus._id === selectedId}
                                    students={bus._id === selectedId ? busStudents : []}
                                    loadingStudents={bus._id === selectedId ? loadingStudents : false}
                                />
                            </Popup>
                        </Marker>
                    ))}
                </MapContainer>

                {/* Legend */}
                <div className="map-legend">
                    {Object.entries(STATUS_CFG).map(([key, cfg]) => (
                        <div key={key} className="legend-item">
                            <span className="legend-dot" style={{ background: cfg.hex }} />
                            <span>{cfg.label}</span>
                        </div>
                    ))}
                </div>

                {/* Connection badge */}
                <div className={`map-connection-badge ${connected ? '' : 'disconnected-badge'}`}>
                    {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                    <span>{connected ? 'GPS Live' : 'Đang kết nối...'}</span>
                    {connected && <span className="map-live-dot" />}
                </div>
            </div>

            {/* ── Right sidebar (20%) ─── */}
            <aside className="map-sidebar">
                <div className="map-sidebar-header">
                    <div>
                        <h2 className="map-sidebar-title">
                            {isAdmin ? 'Xe đang hoạt động' : 'Xe của con'}
                        </h2>
                        <p className="map-sidebar-sub">
                            {buses.filter(b => b.status === 'active').length} / {buses.length} trên đường
                        </p>
                    </div>
                    <button className="map-refresh-btn" onClick={fetchBuses} title="Làm mới">
                        <RefreshCw size={14} />
                    </button>
                </div>

                <div className="map-bus-list">
                    {buses.length === 0 ? (
                        <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                            <Bus size={28} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                            <p>Chưa có xe nào trong hệ thống</p>
                        </div>
                    ) : buses.map(bus => {
                        const cfg = STATUS_CFG[bus.status];
                        const isSelected = bus._id === selectedId;
                        return (
                            <motion.div
                                key={bus._id}
                                className={`map-bus-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => setSelectedId(bus._id)}
                                whileHover={{ x: 2 }}
                                transition={{ duration: 0.15 }}
                            >
                                <div className="map-bus-stripe" style={{ background: cfg.hex }} />
                                <div className="map-bus-card-body">
                                    <div className="map-bus-top">
                                        <div>
                                            <p className="map-bus-id">{bus.licensePlate}</p>
                                            <p className="map-bus-plate">{bus.route_id?.routeName ?? 'Chưa có tuyến'}</p>
                                        </div>
                                        <span className="status-badge" style={{ color: cfg.color, background: cfg.bg, padding: '3px 10px' }}>
                                            {cfg.label}
                                        </span>
                                    </div>

                                    <div className="map-bus-rows">
                                        {bus.driver_id && (
                                            <div className="map-bus-row">
                                                <Navigation size={11} />
                                                <span>{bus.driver_id.fullName} - {bus.driver_id.phone}</span>
                                            </div>
                                        )}
                                        <div className="map-bus-row">
                                            <Clock size={11} />
                                            <span>{relativeTime(bus.lastUpdate)}</span>
                                        </div>
                                    </div>

                                    <div className="map-bus-footer">
                                        <div className="speed-chip">
                                            <Gauge size={11} />
                                            <span>{Math.round(bus.speed)} km/h</span>
                                        </div>
                                        <div className="mini-capacity-bar">
                                            <div
                                                className="mini-capacity-fill"
                                                style={{ width: `${bus.status === 'offline' ? 0 : 60}%`, background: cfg.hex }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Selected bus detail */}
                <AnimatePresence mode="wait">
                    {selected && (
                        <motion.div
                            className="map-detail-panel"
                            key={selected._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.25 }}
                        >
                            <p className="detail-panel-title">Chi tiết chuyến xe</p>
                            <div className="detail-grid">
                                <div className="detail-item">
                                    <Bus size={14} color="#3B82F6" />
                                    <div>
                                        <p className="detail-label">Biển số</p>
                                        <p className="detail-val">{selected.licensePlate}</p>
                                    </div>
                                </div>
                                {selected.driver_id && (
                                    <>
                                        <div className="detail-item">
                                            <Radio size={14} color="#10B981" />
                                            <div>
                                                <p className="detail-label">Tài xế</p>
                                                <p className="detail-val">{selected.driver_id.fullName}</p>
                                            </div>
                                        </div>
                                        <div className="detail-item">
                                            <Phone size={14} color="#10B981" />
                                            <div>
                                                <p className="detail-label">Liên hệ</p>
                                                <p className="detail-val">{selected.driver_id.phone}</p>
                                            </div>
                                        </div>
                                    </>
                                )}
                                {selected.route_id && (
                                    <div className="detail-item">
                                        <MapPin size={14} color="#F59E0B" />
                                        <div>
                                            <p className="detail-label">Tuyến đường</p>
                                            <p className="detail-val">{selected.route_id.routeName}</p>
                                        </div>
                                    </div>
                                )}
                                <div className="detail-item">
                                    <Gauge size={14} color="#8B5CF6" />
                                    <div>
                                        <p className="detail-label">Tốc độ</p>
                                        <p className="detail-val">{Math.round(selected.speed)} km/h</p>
                                    </div>
                                </div>
                                {selected.etaMins !== undefined && selected.distanceToSchool !== undefined && (
                                    <div className="detail-item">
                                        <Clock size={14} color="#F43F5E" />
                                        <div>
                                            <p className="detail-label">Đến trường</p>
                                            <p className="detail-val">
                                                {selected.distanceToSchool <= 0.1 
                                                    ? 'Đã đến nơi' 
                                                    : `~${Math.ceil(selected.etaMins)} phút (${selected.distanceToSchool.toFixed(1)} km)`}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {selected.status === 'offline' && (
                                <div className="detail-warning">
                                    <AlertTriangle size={14} />
                                    Xe đang offline — mất tín hiệu GPS
                                </div>
                            )}
                            {!isAdmin && selected.driver_id && (
                                <a href={`tel:${selected.driver_id.phone}`} className="call-btn" style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                                    📞 Gọi tài xế ngay
                                </a>
                            )}

                            {/* Danh sách học sinh đã quẹt thẻ hôm nay */}
                            <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                                {(() => {
                                    const currentStudentsOnBus = busStudents.filter(item => item.action_type === 'Boarding');
                                    return (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                                                <GraduationCap size={13} color="#7c3aed" />
                                                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Đang trên xe</p>
                                                <span style={{ marginLeft: 'auto', fontSize: 10, background: 'var(--purple-light)', color: '#7c3aed', padding: '2px 7px', borderRadius: 20, fontWeight: 700 }}>
                                                    {currentStudentsOnBus.length} / {selected.capacity}
                                                </span>
                                            </div>
                                            {loadingStudents ? (
                                                <div style={{ textAlign: 'center', padding: '10px 0', color: '#94a3b8', fontSize: 12 }}>Đang tải...</div>
                                            ) : currentStudentsOnBus.length === 0 ? (
                                                <div style={{ textAlign: 'center', padding: '10px 0', color: 'var(--text-muted)', fontSize: 12 }}>Chưa có học sinh trên xe</div>
                                            ) : (
                                                <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                    {currentStudentsOnBus.map((item, i) => (
                                                        <div key={i} style={{
                                                            display: 'flex', alignItems: 'center', gap: 8,
                                                            padding: '7px 9px', borderRadius: 8,
                                                            background: 'var(--success-light)',
                                                            border: '1px solid rgba(16,185,129,0.3)',
                                                        }}>
                                                            <div style={{
                                                                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                                                                background: '#059669',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                color: 'white', fontSize: 10, fontWeight: 700,
                                                            }}>
                                                                {item.student.fullName.split(' ').pop()?.charAt(0)}
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <p style={{ margin: 0, fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {item.student.fullName}
                                                                </p>
                                                                <p style={{ margin: '1px 0 0', fontSize: 10, color: 'var(--text-muted)' }}>
                                                                    {item.student.class} · {item.student.studentCode}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </aside>
        </div>
    );
};

// ── Bus Popup Component ──────────────────────────────────────
const BusPopup: React.FC<{ bus: BusDisplay; isSelected?: boolean; students?: any[]; loadingStudents?: boolean }> = ({ bus, isSelected, students, loadingStudents }) => {
    const cfg = STATUS_CFG[bus.status];
    return (
        <div className="bus-popup">
            <div className="bus-popup-header" style={{ borderColor: cfg.hex }}>
                <div className="bus-popup-icon" style={{ background: cfg.bg, color: cfg.color }}>
                    <Bus size={16} />
                </div>
                <div>
                    <p className="bus-popup-id">{bus.licensePlate}</p>
                    <span className="bus-popup-status" style={{ color: cfg.color }}>● {cfg.label}</span>
                </div>
            </div>
            <div className="bus-popup-body">
                <div className="popup-row"><Gauge size={13} /><span><strong>{Math.round(bus.speed)}</strong> km/h</span></div>
                {bus.etaMins !== undefined && bus.distanceToSchool !== undefined && (
                    <div className="popup-row"><Clock size={13} color="#F43F5E" /><span>Cách trường: <strong style={{color: '#F43F5E'}}>{bus.distanceToSchool <= 0.1 ? 'Đã đến' : `~${Math.ceil(bus.etaMins)} phút (${bus.distanceToSchool.toFixed(1)} km)`}</strong></span></div>
                )}
                {bus.driver_id && (
                    <>
                        <div className="popup-row"><Radio size={13} /><span><strong>{bus.driver_id.fullName}</strong></span></div>
                        <div className="popup-row"><Phone size={13} /><span><a href={`tel:${bus.driver_id.phone}`} style={{textDecoration: 'none', color: '#3B82F6'}}>{bus.driver_id.phone}</a></span></div>
                    </>
                )}
                {bus.route_id && <div className="popup-row"><Navigation size={13} /><span>{bus.route_id.routeName}</span></div>}
                <div className="popup-row"><Users size={13} /><span>Sức chứa: {bus.capacity} học sinh</span></div>
                
                {isSelected && (
                    <div style={{ marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
                        {(() => {
                            const currentStudents = students?.filter(item => item.action_type === 'Boarding') || [];
                            return (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                        <GraduationCap size={13} color="#7c3aed" />
                                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                                            Đang trên xe ({currentStudents.length}/{bus.capacity})
                                        </p>
                                    </div>
                                    {loadingStudents ? (
                                        <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>Đang tải...</div>
                                    ) : currentStudents.length > 0 ? (
                                        <div style={{ maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, paddingRight: 4 }}>
                                            {currentStudents.map((item, idx) => (
                                                <div key={idx} style={{ 
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                                    fontSize: 11, padding: '5px 8px', 
                                                    background: 'var(--success-light)', 
                                                    border: '1px solid rgba(16,185,129,0.3)',
                                                    borderRadius: 6 
                                                }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.student.fullName}</span>
                                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{item.student.class}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>Chưa có học sinh</div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveMap;
