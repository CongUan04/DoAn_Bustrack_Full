/**
 * DriverMap.tsx — Bản đồ dành cho Tài xế
 * - Hiển thị vị trí xe real-time (GPS từ SocketContext)
 * - Hiển thị tuyến đường + các điểm dừng
 * - Chỉ đường tới điểm dừng tiếp theo qua OSRM (free)
 * - Nút điều hướng turn-by-turn
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Navigation, MapPin, Route, ChevronRight, ChevronLeft,
    Loader2, RefreshCw, CheckCircle, ArrowUp, Users,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { studentAPI } from '../services/api';

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── Custom Icons ────────────────────────────────────────────────
const busIcon = L.divIcon({
    className: '',
    html: `<div style="
        width:44px;height:44px;border-radius:50%;
        background:linear-gradient(135deg,#10B981,#059669);
        border:3px solid white;
        box-shadow:0 4px 16px rgba(16,185,129,0.6);
        display:flex;align-items:center;justify-content:center;
        font-size:22px;
    ">🚌</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
});

const makeStopIcon = (idx: number, done: boolean, isCurrent: boolean) => L.divIcon({
    className: '',
    html: `<div style="
        width:${isCurrent ? 36 : 30}px;height:${isCurrent ? 36 : 30}px;
        border-radius:50%;
        background:${done ? '#10B981' : isCurrent ? '#F59E0B' : '#3B82F6'};
        border:2px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.3)${isCurrent ? ',0 0 0 6px rgba(245,158,11,0.3)' : ''};
        display:flex;align-items:center;justify-content:center;
        color:white;font-weight:700;font-size:${isCurrent ? 14 : 12}px;
    ">${done ? '✓' : idx + 1}</div>`,
    iconSize: [isCurrent ? 36 : 30, isCurrent ? 36 : 30],
    iconAnchor: [isCurrent ? 18 : 15, isCurrent ? 18 : 15],
});

// ── Fly to position ─────────────────────────────────────────────
const FlyTo: React.FC<{ lat: number; lng: number; zoom?: number }> = ({ lat, lng, zoom = 15 }) => {
    const map = useMap();
    useEffect(() => { map.flyTo([lat, lng], zoom, { duration: 1.2 }); }, [lat, lng, zoom, map]);
    return null;
};

// ── Center on Bus when moving ───────────────────────────────────
const CenterOnBus: React.FC<{ lat: number; lng: number; active: boolean }> = ({ lat, lng, active }) => {
    const map = useMap();
    useEffect(() => {
        if (active) {
            // Dùng panTo thay vì flyTo để theo dõi xe mượt mà hơn khi GPS cập nhật liên tục
            map.panTo([lat, lng], { animate: true, duration: 0.5 });
        }
    }, [lat, lng, active, map]);
    return null;
};

// ── Types ───────────────────────────────────────────────────────
interface Stop {
    stopName: string;   // field name từ admin (RouteManagement lưu stopName)
    order: number;
    lat?: number;
    lng?: number;
    expected_time?: string;
}

interface RouteData {
    _id: string;
    routeName: string;
    stops: Stop[];
    schoolPos?: { lat: number; lng: number };
}

interface Props {
    busLat?: number;
    busLng?: number;
    busPlate?: string;
    routeData?: RouteData | null;
    gpsUpdates?: Record<string, { lat: number; lng: number; speed: number; busId: string }>;
    busId?: string;
    tripActive?: boolean;
}

// ── OSRM routing ────────────────────────────────────────────────
async function fetchRoute(from: [number, number], to: [number, number]): Promise<{ path: [number, number][], duration: number, steps: any[] }> {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.code !== 'Ok') return { path: [from, to], duration: 0, steps: [] };

    const route = json.routes[0];
    const path = (route.geometry.coordinates as [number, number][]).map(([lng, lat]) => [lat, lng] as [number, number]);
    const duration = route.duration;
    const steps = route.legs[0]?.steps || [];

    return { path, duration, steps };
}

// ── Main Component ──────────────────────────────────────────────
const DriverMap: React.FC<Props> = ({ busLat, busLng, busPlate, routeData, gpsUpdates = {}, busId, tripActive = false }) => {
    // Lấy GPS từ socket nếu có, fallback về prop
    const liveGps = busId ? gpsUpdates[busId] : undefined;
    const lat = liveGps?.lat ?? busLat ?? 10.8231; // fallback HCM
    const lng = liveGps?.lng ?? busLng ?? 106.6297;
    const speed = liveGps?.speed ?? 0;

    const [currentStopIdx, setCurrentStopIdx] = useState(0);
    const [doneStops, setDoneStops] = useState<Set<number>>(new Set());
    const [routePolyline, setRoutePolyline] = useState<[number, number][]>([]);
    const [navPolyline, setNavPolyline] = useState<[number, number][]>([]);
    const [osrmETA, setOsrmETA] = useState<number>(0);
    const [nextInstruction, setNextInstruction] = useState<string>('');
    const [spokenInstructions, setSpokenInstructions] = useState<Set<string>>(new Set());

    // Dùng ref để tránh re-create fetchNav liên tục khi lat/lng thay đổi
    const posRef = useRef({ lat, lng });
    useEffect(() => {
        posRef.current = { lat, lng };
    }, [lat, lng]);

    const [loadingRoute, setLoadingRoute] = useState(false);
    const [showPanel, setShowPanel] = useState(true);
    const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [routeStudents, setRouteStudents] = useState<any[]>([]);

    useEffect(() => {
        if (!routeData?._id) return;
        const fetchStudents = () => {
            studentAPI.getAll({ route_id: routeData._id }).then(res => {
                setRouteStudents(res.data.data);
            }).catch(console.error);
        };
        fetchStudents();
        const interval = setInterval(fetchStudents, 15000); // 15s refresh
        return () => clearInterval(interval);
    }, [routeData?._id]);

    const stops = routeData?.stops
        ? [...routeData.stops].sort((a, b) => a.order - b.order)
        : [];

    // Stops có tọa độ
    const stopsWithCoords = stops.filter(s => s.lat && s.lng);

    // Debug
    useEffect(() => {
        console.log("DriverMap routeData:", routeData);
        console.log("DriverMap stopsWithCoords:", stopsWithCoords);
    }, [routeData?._id, stopsWithCoords.length]);

    // Vẽ polyline tuyến đường đầy đủ từ OSRM
    useEffect(() => {
        if (stopsWithCoords.length < 2) return;
        setLoadingRoute(true);
        const fetchFull = async () => {
            try {
                const segments: [number, number][] = [];
                for (let i = 0; i < stopsWithCoords.length - 1; i++) {
                    const from: [number, number] = [stopsWithCoords[i].lat!, stopsWithCoords[i].lng!];
                    const to: [number, number] = [stopsWithCoords[i + 1].lat!, stopsWithCoords[i + 1].lng!];
                    const { path } = await fetchRoute(from, to);
                    segments.push(...path);
                }
                setRoutePolyline(segments);
            } catch { /* ignore */ }
            finally { setLoadingRoute(false); }
        };
        fetchFull();
    }, [routeData?._id, JSON.stringify(stopsWithCoords)]);

    // Chỉ đường từ xe → điểm dừng tiếp theo
    const fetchNav = useCallback(async () => {
        const target = stopsWithCoords[currentStopIdx];
        if (!target) return;
        try {
            const { lat: currentLat, lng: currentLng } = posRef.current;
            const { path, duration, steps } = await fetchRoute([currentLat, currentLng], [target.lat!, target.lng!]);
            setNavPolyline(path);
            setOsrmETA(duration);

            // Lấy instruction tiếp theo
            if (steps && steps.length > 0) {
                // Step đầu tiên thường là "Depart...", ta lấy step thứ 2 hoặc maneuver chính
                const nextStep = steps.find((s: any) => s.distance > 0 && s.maneuver?.type !== 'depart');
                if (nextStep) {
                    const dist = Math.round(nextStep.distance);
                    const modifier = nextStep.maneuver?.modifier;
                    const type = nextStep.maneuver?.type;
                    let action = 'Đi thẳng';
                    if (modifier?.includes('right')) action = 'Rẽ phải';
                    else if (modifier?.includes('left')) action = 'Rẽ trái';
                    else if (type === 'roundabout') action = 'Đi vào vòng xuyến';
                    else if (type === 'arrive') action = 'Điểm đến ở phía trước';

                    const instStr = `${action} sau ${dist} mét`;
                    setNextInstruction(instStr);

                    // Voice navigation (Text to speech) - Đọc nếu chưa đọc và đang bật trip
                    if (tripActive && dist < 150 && dist > 20) {
                        const voiceKey = `${target.stopName}_${instStr}`;
                        if (!spokenInstructions.has(voiceKey)) {
                            setSpokenInstructions(prev => new Set([...prev, voiceKey]));
                            const utterance = new SpeechSynthesisUtterance(instStr);
                            utterance.lang = 'vi-VN';
                            window.speechSynthesis.speak(utterance);
                        }
                    }
                } else {
                    setNextInstruction('Đi thẳng đến trạm');
                }
            }
        } catch { /* ignore */ }
    }, [currentStopIdx, stopsWithCoords, tripActive, spokenInstructions]);

    // Gọi lần đầu khi chuyển trạm
    useEffect(() => { fetchNav(); }, [currentStopIdx, stopsWithCoords.length]);

    // Cập nhật OSRM mỗi 10 giây khi đang chạy
    useEffect(() => {
        if (!tripActive) return;
        const interval = setInterval(() => {
            fetchNav();
        }, 10000);
        return () => clearInterval(interval);
    }, [fetchNav, tripActive]);

    const handleMarkDone = () => {
        setDoneStops(prev => new Set([...prev, currentStopIdx]));
        if (currentStopIdx < stopsWithCoords.length - 1) {
            setCurrentStopIdx(p => p + 1);
        }
    };

    const handleGoToStop = (idx: number) => {
        setCurrentStopIdx(idx);
        const s = stopsWithCoords[idx];
        if (s) setFlyTarget({ lat: s.lat!, lng: s.lng!, zoom: 16 });
    };

    const currentStop = stopsWithCoords[currentStopIdx];
    const distanceM = currentStop
        ? Math.round(
            Math.sqrt(
                Math.pow((lat - currentStop.lat!) * 111000, 2) +
                Math.pow((lng - currentStop.lng!) * 111000 * Math.cos(lat * Math.PI / 180), 2)
            )
        )
        : null;

    // Tự động chuyển điểm khi đến gần (< 100m)
    useEffect(() => {
        if (distanceM !== null && distanceM <= 100 && !doneStops.has(currentStopIdx)) {
            toast.success(`Đã tự động đến điểm: ${currentStop?.stopName}`);
            handleMarkDone();
        }
    }, [distanceM, currentStopIdx, doneStops, currentStop]);

    return (
        <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
            {/* ── Bản đồ ── */}
            <MapContainer
                center={[lat, lng]}
                zoom={14}
                style={{ height: expanded ? 520 : 340, width: '100%' }}
                zoomControl={false}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />

                <CenterOnBus lat={lat} lng={lng} active={tripActive} />

                {/* Xe */}
                <Marker position={[lat, lng]} icon={busIcon}>
                    <Popup>
                        <b>🚌 {busPlate ?? 'Xe của bạn'}</b><br />
                        Tốc độ: {Math.round(speed)} km/h
                    </Popup>
                </Marker>

                {/* Vùng xung quanh xe */}
                <Circle center={[lat, lng]} radius={80} color="#10B981" fillOpacity={0.08} weight={1} />

                {/* Các điểm dừng */}
                {stopsWithCoords.map((s, i) => (
                    <Marker
                        key={i}
                        position={[s.lat!, s.lng!]}
                        icon={makeStopIcon(i, doneStops.has(i), i === currentStopIdx)}
                    >
                        <Popup>
                            <b>{i + 1}. {s.stopName}</b><br />
                            {doneStops.has(i) ? '✅ Đã đến' : i === currentStopIdx ? '🎯 Điểm tiếp theo' : '⏳ Chưa đến'}
                            {s.expected_time && <><br />⏰ {s.expected_time}</>}
                        </Popup>
                    </Marker>
                ))}

                {/* Tuyến đường đầy đủ */}
                {routePolyline.length > 1 && (
                    <Polyline positions={routePolyline} color="#3B82F6" weight={4} opacity={0.4} dashArray="8,6" />
                )}

                {/* Chỉ đường tới điểm kế tiếp */}
                {navPolyline.length > 1 && (
                    <Polyline positions={navPolyline} color="#F59E0B" weight={5} opacity={0.85} />
                )}

                {/* Marker trường học */}
                {routeData?.schoolPos && (
                    <Marker
                        position={[routeData.schoolPos.lat, routeData.schoolPos.lng]}
                        icon={L.divIcon({
                            className: '',
                            html: `<div style="font-size:28px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.4))">🏫</div>`,
                            iconSize: [34, 34],
                            iconAnchor: [17, 34],
                        })}
                    >
                        <Popup>
                            <b>🏫 Trường học</b><br />
                            {routeData.routeName}
                        </Popup>
                    </Marker>
                )}

                {/* FlyTo khi chọn điểm dừng */}
                {flyTarget && <FlyTo lat={flyTarget.lat} lng={flyTarget.lng} zoom={flyTarget.zoom} />}
            </MapContainer>


            {/* ── Overlay: Tuyến đường label ── */}
            {routeData && (
                <div style={{
                    position: 'absolute', top: 60, left: 12, zIndex: 1000,
                    background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)',
                    borderRadius: 10, padding: '7px 14px', border: '1px solid rgba(255,255,255,0.12)',
                    display: 'flex', alignItems: 'center', gap: 8,
                }}>
                    <Route size={14} color="#3B82F6" />
                    <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>{routeData.routeName}</span>
                    {loadingRoute && <Loader2 size={12} color="#94a3b8" style={{ animation: 'spin 1s linear infinite' }} />}
                </div>
            )}

            {/* ── Overlay: Tốc độ ── */}
            <div style={{
                position: 'absolute', top: 12, right: 12, zIndex: 1000,
                background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)',
                borderRadius: 10, padding: '7px 14px', border: '1px solid rgba(255,255,255,0.12)',
                textAlign: 'center',
            }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: speed > 0 ? '#10B981' : '#94a3b8' }}>{Math.round(speed)}</p>
                <p style={{ margin: 0, fontSize: 10, color: '#64748b' }}>km/h</p>
            </div>

            {/* ── Nút refresh chỉ đường ── */}
            <button
                onClick={fetchNav}
                style={{
                    position: 'absolute', top: 80, right: 12, zIndex: 1001,
                    background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 8, padding: '6px 10px', color: 'white', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                }}
            >
                <RefreshCw size={11} /> Cập nhật đường
            </button>

            {/* ── Khối điều khiển dưới cùng (Buttons + Panel) ── */}
            <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
                display: 'flex', flexDirection: 'column', pointerEvents: 'none'
            }}>
                {/* Hàng nút nổi */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', padding: '0 12px 12px 12px', pointerEvents: 'auto'
                }}>
                    <button
                        onClick={() => setShowPanel(p => !p)}
                        style={{
                            background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 8, padding: '6px 10px', color: 'white', cursor: 'pointer',
                            fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        }}
                    >
                        {showPanel ? <><ArrowUp size={11} /> Ẩn panel</> : <><Navigation size={11} /> Điều hướng</>}
                    </button>

                    <button
                        onClick={() => setExpanded(p => !p)}
                        style={{
                            background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: 8, padding: '6px 10px', color: 'white', cursor: 'pointer', fontSize: 11,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        }}
                    >
                        {expanded ? '⬆ Thu nhỏ' : '⬇ Mở rộng'}
                    </button>
                </div>

                {/* Panel điều hướng */}
                <AnimatePresence>
                    {showPanel && (
                        <motion.div
                            initial={{ y: 200, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: 200, opacity: 0 }}
                            style={{
                                background: 'rgba(15,23,42,0.95)', backdropFilter: 'blur(12px)',
                                borderTop: '1px solid rgba(255,255,255,0.1)', pointerEvents: 'auto'
                            }}
                        >
                            {/* Điểm tiếp theo */}
                            {currentStop ? (
                                <div style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                                            background: 'linear-gradient(135deg,#F59E0B,#D97706)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <Navigation size={20} color="white" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>Điểm dừng tiếp theo</p>
                                            <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700, color: 'white' }}>{currentStop.stopName}</p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#F59E0B' }}>
                                                {distanceM !== null ? (distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)} km` : `${distanceM} m`) : '—'}
                                            </p>
                                            <p style={{ margin: '2px 0 0', fontSize: 10, color: '#64748b' }}>
                                                ~{osrmETA > 0 ? `${Math.ceil(osrmETA / 60)} phút` : '? phút'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Instruction text */}
                                    {nextInstruction && tripActive && (
                                        <div style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Navigation size={14} color="#3B82F6" />
                                            <span style={{ color: '#60A5FA', fontSize: 12, fontWeight: 600 }}>{nextInstruction}</span>
                                        </div>
                                    )}

                                    {/* Danh sách học sinh ở điểm này */}
                                    {(() => {
                                        const studentsAtThisStop = routeStudents.filter(s => s.assigned_stop === currentStop.stopName);
                                        if (studentsAtThisStop.length > 0) {
                                            return (
                                                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>
                                                        <Users size={14} /> Danh sách tại điểm này ({studentsAtThisStop.length})
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                                                        {studentsAtThisStop.map(s => (
                                                            <div key={s._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: 6 }}>
                                                                <span style={{ color: 'white', fontWeight: 500 }}>{s.fullName}</span>
                                                                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 12, 
                                                                    background: s.currentStatus === 'On_Bus' ? 'rgba(59,130,246,0.2)' : s.currentStatus === 'Absent' ? 'rgba(239,68,68,0.2)' : s.currentStatus === 'Dropped_Off' ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.2)',
                                                                    color: s.currentStatus === 'On_Bus' ? '#60A5FA' : s.currentStatus === 'Absent' ? '#F87171' : s.currentStatus === 'Dropped_Off' ? '#C084FC' : '#34D399',
                                                                    fontWeight: 600
                                                                }}>
                                                                    {s.currentStatus === 'On_Bus' ? 'Trên xe' : s.currentStatus === 'Absent' ? 'Nghỉ' : s.currentStatus === 'Dropped_Off' ? 'Đã xuống' : 'Chưa lên'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* Điều hướng nút */}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            onClick={() => currentStopIdx > 0 && handleGoToStop(currentStopIdx - 1)}
                                            disabled={currentStopIdx === 0}
                                            style={{
                                                flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                                                background: 'rgba(255,255,255,0.07)', color: '#94a3b8', cursor: currentStopIdx === 0 ? 'not-allowed' : 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 12, opacity: currentStopIdx === 0 ? 0.4 : 1,
                                            }}
                                        >
                                            <ChevronLeft size={14} /> Quay lại
                                        </button>
                                        <button
                                            onClick={() => handleGoToStop(Math.min(currentStopIdx + 1, stopsWithCoords.length - 1))}
                                            disabled={currentStopIdx >= stopsWithCoords.length - 1}
                                            style={{
                                                flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                                                background: 'rgba(255,255,255,0.07)', color: '#94a3b8', cursor: currentStopIdx >= stopsWithCoords.length - 1 ? 'not-allowed' : 'pointer',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 12, opacity: currentStopIdx >= stopsWithCoords.length - 1 ? 0.4 : 1,
                                            }}
                                        >
                                            Bỏ qua điểm này <ChevronRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: '14px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                                    <MapPin size={16} style={{ display: 'inline', marginRight: 6 }} />
                                    {stopsWithCoords.length === 0 ? 'Tuyến chưa có tọa độ điểm dừng' : '✅ Đã hoàn thành tuyến đường!'}
                                </div>
                            )}

                            {/* Danh sách điểm dừng */}
                            {stopsWithCoords.length > 0 && (
                                <div style={{
                                    maxHeight: 90, overflowY: 'auto',
                                    borderTop: '1px solid rgba(255,255,255,0.06)',
                                    padding: '8px 12px', display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto',
                                }}>
                                    {stopsWithCoords.map((s, i) => (
                                        <button
                                            key={i}
                                            onClick={() => handleGoToStop(i)}
                                            style={{
                                                flexShrink: 0, padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                                                background: doneStops.has(i)
                                                    ? 'rgba(16,185,129,0.2)'
                                                    : i === currentStopIdx
                                                        ? 'rgba(245,158,11,0.25)'
                                                        : 'rgba(255,255,255,0.06)',
                                                color: doneStops.has(i) ? '#10B981' : i === currentStopIdx ? '#F59E0B' : '#94a3b8',
                                                fontSize: 11, fontWeight: i === currentStopIdx ? 700 : 500,
                                                display: 'flex', alignItems: 'center', gap: 5,
                                                border: i === currentStopIdx ? '1px solid rgba(245,158,11,0.4)' : '1px solid rgba(255,255,255,0.06)',
                                            }}
                                        >
                                            {doneStops.has(i) ? <CheckCircle size={10} /> : <MapPin size={10} />}
                                            {s.stopName}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                .leaflet-container { font-family: inherit; }
            `}</style>
        </div>
    );
};

export default DriverMap;
