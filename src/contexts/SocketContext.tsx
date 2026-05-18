/**
 * SocketContext — Kết nối thực sự với Socket.io backend
 * Phát sự kiện gps_update, rfid_scan, alert_new theo thời gian thực
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';

// ── Types ────────────────────────────────────────────────────
export interface GpsUpdate {
    busId: string;
    licensePlate: string;
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    routeName: string | null;
    timestamp: string;
}

export interface KpiData {
    activeBuses: number;
    studentsOnboard: number;
    delayedBuses: number;
    unresolvedAlerts: number;
}

export interface RfidSwipe {
    id: string;
    studentName: string;
    studentId: string;
    studentCode: string;
    grade: string;
    busId: string;
    licensePlate: string;
    action: 'lên xe' | 'xuống xe';
    timestamp: Date;
    status: 'success' | 'error';
    isAbnormal?: boolean;
    abnormalReason?: string;
}

interface SocketContextType {
    kpi: KpiData;
    recentSwipes: RfidSwipe[];
    connected: boolean;
    lastUpdate: Date;
    gpsUpdates: Record<string, GpsUpdate>; // busId → latest GPS
    lastRfidEvent: RfidSwipe | null; // latest RFID event for toast trigger
    lastAlert: any; // latest alert from backend
    lastStudentStatus: { studentId: string; status: string; studentName: string } | null;
}

const SOCKET_URL = 'https://bustrack-backend-vq38.onrender.com';

// ── Default KPI (sẽ bị thay bởi REST polling từ Dashboard) ───
const INITIAL_KPI: KpiData = {
    activeBuses: 0,
    studentsOnboard: 0,
    delayedBuses: 0,
    unresolvedAlerts: 0,
};

// ── Context ──────────────────────────────────────────────────
const SocketContext = createContext<SocketContextType | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [kpi, setKpi] = useState<KpiData>(INITIAL_KPI);
    const [recentSwipes, setRecentSwipes] = useState<RfidSwipe[]>([]);
    const [connected, setConnected] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [gpsUpdates, setGpsUpdates] = useState<Record<string, GpsUpdate>>({});
    const [lastRfidEvent, setLastRfidEvent] = useState<RfidSwipe | null>(null);
    const [lastAlert, setLastAlert] = useState<any>(null);
    const [lastStudentStatus, setLastStudentStatus] = useState<{ studentId: string; status: string; studentName: string } | null>(null);

    // ── Connect / Disconnect ──────────────────────────────────
    // Dependencies [] = socket chỉ tạo 1 lần
    useEffect(() => {
        const s = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
        });

        s.on('connect', () => {
            console.log('[Socket] ✅ Đã kết nối:', s.id);
            setConnected(true);
        });
        s.on('connect_error', (err) => {
            console.error('[Socket] ❌ Lỗi kết nối:', err.message);
        });
        s.on('disconnect', (reason) => {
            console.log('[Socket] ❌ Ngắt kết nối. Lý do:', reason);
            setConnected(false);
        });

        s.on('gps_update', (data: GpsUpdate) => {
            setGpsUpdates(prev => ({ ...prev, [data.busId]: data }));
            setLastUpdate(new Date());
        });

        s.on('rfid_scan', (data: {
            studentName: string; studentId: string; studentCode: string; grade: string;
            busId: string; licensePlate: string; action: string; timestamp: string;
            isAbnormal?: boolean; abnormalReason?: string;
        }) => {
            const swipe: RfidSwipe = {
                id: `sw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                studentName: data.studentName,
                studentId: data.studentId,
                studentCode: data.studentCode ?? '',
                grade: data.grade,
                busId: data.busId,
                licensePlate: data.licensePlate ?? '',
                action: data.action === 'Boarding' ? 'lên xe' : 'xuống xe',
                timestamp: new Date(data.timestamp),
                status: 'success',
                isAbnormal: data.isAbnormal,
                abnormalReason: data.abnormalReason,
            };
            setRecentSwipes(prev => [swipe, ...prev].slice(0, 20));
            setLastRfidEvent(swipe);
            setLastUpdate(new Date());
        });

        // Thẻ lạ / chưa gán
        s.on('new_card_scanned', (data: { rfid_uid: string; scanned_at: string }) => {
            const errSwipe: RfidSwipe = {
                id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                studentName: 'Thẻ không xác định',
                studentId: '',
                studentCode: data.rfid_uid,
                grade: '—',
                busId: '',
                licensePlate: '—',
                action: 'lên xe',
                timestamp: new Date(data.scanned_at),
                status: 'error',
            };
            setRecentSwipes(prev => [errSwipe, ...prev].slice(0, 20));
            setLastRfidEvent(errSwipe);
            setLastUpdate(new Date());
        });

        s.on('kpi_update', (data: KpiData) => {
            setKpi(data);
            setLastUpdate(new Date());
        });

        s.on('new_alert', (data: any) => {
            setLastAlert(data);
            setLastUpdate(new Date());
        });

        s.on('student_status_update', (data: { studentId: string; status: string; studentName: string }) => {
            setLastStudentStatus(data);
            setLastUpdate(new Date());
        });

        return () => {
            s.disconnect();
        };
    }, []); // ← [] đảm bảo chỉ tạo 1 socket duy nhất


    return (
        <SocketContext.Provider value={{ kpi, recentSwipes, connected, lastUpdate, gpsUpdates, lastRfidEvent, lastAlert, lastStudentStatus }}>
            {children}
        </SocketContext.Provider>
    );
};

export const useSocket = () => {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error('useSocket must be used within SocketProvider');
    return ctx;
};
