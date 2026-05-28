/**
 * ParentView.tsx - Giao diện Phụ huynh
 * - Thông tin học sinh con em
 * - Live map theo dõi xe
 * - Lịch sử điểm danh hôm nay
 * - Banner nhắc cập nhật Gmail nếu chưa có
 * - Modal chỉnh sửa thông tin tài khoản
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import {
    ArrowUpCircle, ArrowDownCircle, CreditCard,
    Calendar, RefreshCw,
    Loader2,
    Route, Mail, X, AlertTriangle, XCircle,
    Lock, Sun, Moon, LogOut, Settings, Send
} from 'lucide-react';
import { toast } from 'react-toastify';
import { attendanceAPI, busAPI, studentAPI, routeAPI, authAPI, uploadAPI, getMediaUrl } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useOutletContext } from 'react-router-dom';
import TelegramSettings from '../components/TelegramSettings';

// Fix Leaflet icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SCHOOL_ICON = L.divIcon({
    className: '',
    html: `<div style="font-size:26px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))">🏫</div>`,
    iconSize: [30, 30], iconAnchor: [15, 30],
});
const makeBusIcon = (online: boolean) => L.divIcon({
    className: '',
    html: `<div style="width:32px;height:32px;background:var(--surface);border:3px solid ${online ? '#10B981' : '#9CA3AF'};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 3px 10px rgba(0,0,0,0.2)">🚌</div>`,
    iconSize: [32, 32], iconAnchor: [16, 16],
});

// ── Types ───────────────────────────────────────────────────────
interface StudentInfo {
    _id: string;
    studentCode: string;
    fullName: string;
    class: string;
    rfid_uid?: string;
    currentStatus?: string;
    fatherPhone?: string;
    motherPhone?: string;
    studyDays?: number[]; // 0=CN,1=T2,...,6=T7
    photoUrl?: string;
    route_id?: { _id: string; routeName: string; stops: { lat: number; lng: number; order: number }[]; schoolPos?: { lat: number; lng: number } } | null;
}

interface LogEntry {
    _id: string;
    student_id: { _id: string; fullName: string; studentCode: string; class: string } | null;
    bus_id: { licensePlate: string } | null;
    scan_time: string;
    action_type: 'Boarding' | 'Dropping';
    stop_name?: string | null;
}

interface BusInfo {
    _id: string;
    licensePlate: string;
    name?: string;
    currentLat?: number | null;
    currentLng?: number | null;
    currentSpeed?: number;
    isOnline: boolean;
    route_id?: { _id: string; routeName: string } | null;
    capacity: number;
    driver_id?: { fullName: string; phone: string } | null;
}

interface RouteData {
    _id: string;
    routeName: string;
    stops: { lat: number; lng: number; order: number }[];
    schoolPos?: { lat: number; lng: number };
}

const fmtTime = (ts: string) =>
    new Date(ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

// ── Preset absence reasons ──────────────────────────────────────
const PRESET_REASONS = [
    { emoji: '🤒', label: 'Ốm / bệnh' },
    { emoji: '🏥', label: 'Đi khám bệnh' },
    { emoji: '👨‍👩‍👧', label: 'Việc gia đình' },
    { emoji: '🚗', label: 'Phương tiện gặp sự cố' },
    { emoji: '🌧️', label: 'Thời tiết xấu' },
    { emoji: '📝', label: 'Khác' },
];

// ── Absence Modal Component ─────────────────────────────────────
const AbsenceModal: React.FC<{
    childName: string;
    onConfirm: (reason: string, date: string) => void;
    onClose: () => void;
    loading: boolean;
}> = ({ childName, onConfirm, onClose, loading }) => {
    const todayStr = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).substring(0, 10);
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const [selected, setSelected] = useState('');
    const [custom, setCustom] = useState('');

    const finalReason = selected === 'Khác' ? custom.trim() : selected;
    const canSubmit = selected !== '' && (selected !== 'Khác' || custom.trim() !== '');

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, zIndex: 9000,
                    background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
                }}
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.9, y: 20, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                        background: 'var(--surface)', borderRadius: 20, padding: '24px',
                        width: '100%', maxWidth: 420,
                        boxShadow: '0 30px 80px rgba(0,0,0,0.2)',
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                        <div style={{
                            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                            background: 'var(--danger-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <XCircle size={22} color="var(--danger)" />
                        </div>
                        <div>
                            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Báo vắng mặt</p>
                            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{childName}</p>
                        </div>
                        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-secondary)' }}>
                            <X size={18} />
                        </button>
                    </div>

                    {/* Date Picker */}
                    <div style={{ marginBottom: 16 }}>
                        <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                            Chọn ngày vắng
                        </p>
                        <input 
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            min={todayStr}
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: 10,
                                border: '1.5px solid var(--border)', background: 'var(--bg)',
                                color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit'
                            }}
                        />
                    </div>

                    {/* Reason presets */}
                    <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        Chọn lý do
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                        {PRESET_REASONS.map(r => (
                            <button
                                key={r.label}
                                onClick={() => setSelected(r.label)}
                                style={{
                                    padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600,
                                    border: `2px solid ${selected === r.label ? 'var(--danger)' : 'var(--border)'}`,
                                    background: selected === r.label ? 'var(--danger-light)' : 'var(--bg)',
                                    color: selected === r.label ? 'var(--danger)' : 'var(--text-primary)',
                                    transition: 'all 0.15s',
                                    textAlign: 'left',
                                }}
                            >
                                <span style={{ fontSize: 18 }}>{r.emoji}</span>
                                {r.label}
                            </button>
                        ))}
                    </div>

                    {/* Custom input if "Khác" */}
                    <AnimatePresence>
                        {selected === 'Khác' && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                style={{ overflow: 'hidden', marginBottom: 14 }}
                            >
                                <textarea
                                    autoFocus
                                    value={custom}
                                    onChange={e => setCustom(e.target.value)}
                                    placeholder="Nhập lý do cụ thể..."
                                    rows={2}
                                    style={{
                                        width: '100%', padding: '10px 12px', borderRadius: 10,
                                        border: '1.5px solid var(--border)', background: 'var(--bg)',
                                        color: 'var(--text-primary)', fontSize: 13, resize: 'none',
                                        outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                                    }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={onClose} style={{
                            flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--border)',
                            background: 'var(--surface-hover)', cursor: 'pointer', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)',
                        }}>
                            Huỷ
                        </button>
                        <button
                            onClick={() => canSubmit && onConfirm(finalReason, selectedDate)}
                            disabled={!canSubmit || loading}
                            style={{
                                flex: 2, padding: '11px', borderRadius: 10, border: 'none',
                                background: canSubmit ? 'var(--danger)' : 'var(--border)',
                                color: 'white', fontWeight: 700, fontSize: 13,
                                cursor: canSubmit && !loading ? 'pointer' : 'not-allowed',
                                opacity: loading ? 0.7 : 1, transition: 'all 0.15s',
                            }}
                        >
                            {loading ? 'Đang gửi...' : '✓ Xác nhận báo vắng'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

// ── Settings Component ───────────────────────────────────────────
const ParentSettings: React.FC = () => {
    const { user, updateUser, logout } = useAuth();
    const [form, setForm] = useState({ email: '', currentPassword: '', newPassword: '', confirmPassword: '' });
    const [loading, setLoading] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark-theme'));

    const toggleTheme = () => {
        const next = !isDarkMode;
        setIsDarkMode(next);
        if (next) {
            document.documentElement.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
        }
    };

    const handleSave = async () => {
        if (form.newPassword && form.newPassword !== form.confirmPassword) {
            setMsg({ type: 'error', text: 'Mật khẩu xác nhận không khớp' });
            return;
        }
        setLoading(true);
        setMsg(null);
        try {
            const payload: Record<string, string> = {};
            if (form.email) payload.email = form.email;
            if (form.newPassword) { payload.currentPassword = form.currentPassword; payload.newPassword = form.newPassword; }
            if (pendingAvatar) payload.avatar = pendingAvatar;

            const res = await authAPI.updateProfile(payload);
            const updated = res.data.data;
            updateUser({ email: updated.email, isEmailSet: updated.isEmailSet, avatar: updated.avatar });
            setMsg({ type: 'success', text: 'Cập nhật thành công!' });
            setForm(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Lỗi cập nhật';
            setMsg({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: 40 }}>
            {/* Profile Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px', background: 'var(--surface)', borderRadius: 16, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ position: 'relative' }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 16,
                        background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: 28, overflow: 'hidden'
                    }}>
                        {(pendingAvatar || (user as any)?.avatar) ? (
                            <img src={getMediaUrl(pendingAvatar || (user as any).avatar)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            user?.fullName?.split(' ').pop()?.charAt(0)
                        )}
                    </div>
                    <label style={{
                        position: 'absolute', bottom: -6, right: -6, width: 28, height: 28, borderRadius: '50%',
                        background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                        {uploadingAvatar ? <Loader2 size={14} className="spin" /> : <Settings size={14} />}
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploadingAvatar(true);
                            try {
                                const res = await uploadAPI.uploadImage(file);
                                const avatarUrl = res.data.data.url;
                                setPendingAvatar(avatarUrl);
                            } catch (err: any) {
                                toast.error(err.response?.data?.message || 'Lỗi tải ảnh lên');
                            } finally {
                                setUploadingAvatar(false);
                            }
                        }} />
                    </label>
                </div>
                <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>{user?.fullName}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: user?.isEmailSet ? '#059669' : '#f59e0b', fontWeight: 600 }}>
                        {user?.isEmailSet ? `✅ ${user?.email}` : '⚠️ Chưa cập nhật Gmail'}
                    </p>
                </div>
            </div>

            {/* Theme Toggle */}
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)', padding: '16px 18px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                        {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
                    </div>
                    <div>
                        <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Chế độ Tối (Dark Mode)</p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>Giảm chói mắt khi xem ban đêm</p>
                    </div>
                </div>
                <div onClick={toggleTheme} style={{
                    width: 48, height: 26, borderRadius: 13, background: isDarkMode ? '#10B981' : '#cbd5e1',
                    position: 'relative', cursor: 'pointer', transition: '0.3s'
                }}>
                    <div style={{
                        width: 22, height: 22, borderRadius: '50%', background: 'white',
                        position: 'absolute', top: 2, left: isDarkMode ? 24 : 2, transition: '0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }} />
                </div>
            </div>

            {/* Account Settings */}
            <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 20 }}>
                <p style={{ margin: '0 0 16px', fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Bảo mật tài khoản</p>
                {[
                    { key: 'email', label: 'Gmail mới', type: 'email', icon: <Mail size={16} />, placeholder: 'Nhập Gmail thật của bạn...' },
                    { key: 'currentPassword', label: 'Mật khẩu hiện tại', type: 'password', icon: <Lock size={16} />, placeholder: 'Nhập mật khẩu đang dùng...' },
                    { key: 'newPassword', label: 'Mật khẩu mới', type: 'password', icon: <Lock size={16} />, placeholder: 'Để trống nếu không đổi...' },
                    { key: 'confirmPassword', label: 'Xác nhận mật khẩu', type: 'password', icon: <Lock size={16} />, placeholder: 'Nhập lại mật khẩu mới...' },
                ].map(f => (
                    <div key={f.key} style={{ marginBottom: 14 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                            {f.icon} {f.label}
                            {f.key === 'email' && !user?.isEmailSet && (
                                <span style={{ marginLeft: 4, fontSize: 10, background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 20, fontWeight: 700 }}>Chưa cập nhật</span>
                            )}
                        </label>
                        <input
                            type={f.type}
                            value={form[f.key as keyof typeof form]}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                            placeholder={f.placeholder}
                            style={{
                                width: '100%', padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box',
                                border: `1.5px solid ${f.key === 'email' && !user?.isEmailSet ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                                fontSize: 14, outline: 'none',
                                background: f.key === 'email' && !user?.isEmailSet ? 'var(--warning-light)' : 'var(--bg)',
                                color: 'var(--text-primary)'
                            }}
                        />
                    </div>
                ))}

                <AnimatePresence>
                    {msg && (
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            style={{
                                padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 13, fontWeight: 600,
                                background: msg.type === 'success' ? 'var(--success-light)' : 'var(--danger-light)',
                                color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                                border: `1px solid ${msg.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                            }}>
                            {msg.type === 'success' ? '✅ ' : '❌ '}{msg.text}
                        </motion.div>
                    )}
                </AnimatePresence>

                <button onClick={handleSave} disabled={loading} style={{
                    width: '100%', padding: '12px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: 'white',
                    cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14,
                    opacity: loading ? 0.7 : 1,
                }}>
                    {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
            </div>

            {/* Telegram Settings */}
            <div style={{ background: 'var(--surface)', padding: '20px', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', marginBottom: 20 }}>
                <TelegramSettings
                    currentChatId={user?.telegramChatId}
                    onSaved={(id) => updateUser({ telegramChatId: id || undefined })}
                />
            </div>

            {/* Logout Button */}
            <button onClick={logout} style={{
                width: '100%', padding: '14px', borderRadius: 16, border: '1px solid rgba(239,68,68,0.3)',
                background: 'var(--danger-light)', color: 'var(--danger)', fontWeight: 700, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer'
            }}>
                <LogOut size={18} />
                Đăng xuất
            </button>
        </div>
    );
};


// ── Main Component ──────────────────────────────────────────────
const ParentView: React.FC = () => {
    const { user } = useAuth();
    const { gpsUpdates } = useSocket();
    const { activeTab, setActiveTab } = useOutletContext<{ activeTab: string, setActiveTab: (t: string) => void }>();

    const [children, setChildren] = useState<StudentInfo[]>([]);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [buses, setBuses] = useState<BusInfo[]>([]);
    const [routes, setRoutes] = useState<RouteData[]>([]);
    const [loading, setLoading] = useState(true);
    const [busStudentsCount, setBusStudentsCount] = useState<Record<string, number>>({});

    // Absent modal state
    const [absentModal, setAbsentModal] = useState<{ childId: string; childName: string } | null>(null);
    const [absentLoading, setAbsentLoading] = useState(false);

    // Bottom Sheet state
    const [sheetOpen, setSheetOpen] = useState(false);

    const [dismissBanner, setDismissBanner] = useState(false);
    const needEmailSetup = !user?.isEmailSet && !dismissBanner;

    const [dismissTgBanner, setDismissTgBanner] = useState(false);
    const needTgSetup = !user?.telegramChatId && !dismissTgBanner;

    const todayISO = new Date().toISOString().slice(0, 10);
    // const childIds = children.map(c => c._id);

    const fetchData = useCallback(async () => {
        try {
            const [childRes, busRes, routeRes] = await Promise.all([
                studentAPI.getMyChildren(),
                busAPI.getAll(),
                routeAPI.getAll(),
            ]);
            const fetchedChildren: StudentInfo[] = childRes.data.data;
            setChildren(fetchedChildren);
            setBuses(busRes.data.data);
            setRoutes(routeRes.data.data);

            // Load attendance logs for each child
            if (fetchedChildren.length > 0) {
                const logPromises = fetchedChildren.map(c =>
                    attendanceAPI.getLogs({ student_id: c._id, from: todayISO, to: todayISO, limit: '50' })
                );
                const logResults = await Promise.all(logPromises);
                const allLogs: LogEntry[] = logResults.flatMap(r => r.data.data);
                allLogs.sort((a, b) => new Date(b.scan_time).getTime() - new Date(a.scan_time).getTime());
                setLogs(allLogs);
            }

        } catch {
            // silent fail
        } finally {
            setLoading(false);
        }
    }, [todayISO]);

    const handleMarkAbsent = (childId: string, childName: string) => {
        setAbsentModal({ childId, childName });
    };

    const handleConfirmAbsent = async (reason: string, date: string) => {
        if (!absentModal) return;
        setAbsentLoading(true);
        try {
            await studentAPI.markAbsent(absentModal.childId, reason, date);
            toast.success(`✅ Đã báo vắng mặt cho ${absentModal.childName} ngày ${date.split('-').reverse().join('/')}.`);
            setAbsentModal(null);
            fetchData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi báo vắng mặt');
        } finally {
            setAbsentLoading(false);
        }
    };

    // const handleToggleStudyDay = async (child: StudentInfo, day: number) => {
    //     const current = child.studyDays ?? [1, 2, 3, 4, 5];
    //     const updated = current.includes(day)
    //         ? current.filter(d => d !== day)
    //         : [...current, day].sort();
    //     try {
    //         await studentAPI.updateStudyDays(child._id, updated);
    //         setChildren(prev => prev.map(c => c._id === child._id ? { ...c, studyDays: updated } : c));
    //         toast.success('Đã cập nhật lịch học!');
    //     } catch (err: any) {
    //         toast.error(err.response?.data?.message || 'Lỗi cập nhật lịch học');
    //     }
    // };

    useEffect(() => {
        fetchData();
        const t = setInterval(fetchData, 30000);
        return () => clearInterval(t);
    }, [fetchData]);

    // Real-time GPS update
    useEffect(() => {
        if (Object.keys(gpsUpdates).length === 0) return;
        setBuses(prev => prev.map(bus => {
            const upd = gpsUpdates[bus._id];
            if (!upd) return bus;
            return { ...bus, currentLat: upd.lat, currentLng: upd.lng, currentSpeed: upd.speed, isOnline: true, lastSeen: upd.timestamp };
        }));
    }, [gpsUpdates]);

    const latestLog = logs[0];
    // const onlineBuses = buses.filter(b => b.isOnline);

    // Map center: dùng vị trí trường học của tuyến con em, hoặc trung tâm mặc định
    const mapCenter: [number, number] = (() => {
        for (const child of children) {
            if (child.route_id?.schoolPos) {
                return [child.route_id.schoolPos.lat, child.route_id.schoolPos.lng];
            }
        }
        return [20.9764, 105.7777];
    })();

    return (
        <>
            <div style={{ padding: activeTab === 'home' ? 0 : '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
                {/* ── Banner nhắc cập nhật Gmail ─────────────────── */}
                <AnimatePresence>
                    {needEmailSetup && activeTab === 'settings' && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{
                                marginBottom: 18, padding: '14px 18px', borderRadius: 14,
                                background: 'var(--warning-light)',
                                border: '1.5px solid rgba(245, 158, 11, 0.4)',
                                display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                            }}
                        >
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <AlertTriangle size={20} color="white" />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--warning)' }}>⚠️ Tài khoản chưa có Gmail thật</p>
                                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                                    Vui lòng cập nhật Gmail để có thể đặt lại mật khẩu và nhận thông báo.
                                </p>
                            </div>
                            <button onClick={() => setDismissBanner(true)} style={{
                                padding: '8px', borderRadius: 10, border: '1px solid rgba(245, 158, 11, 0.4)',
                                background: 'transparent', color: 'var(--warning)', cursor: 'pointer', flexShrink: 0
                            }}>
                                <X size={14} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── TABS RENDERING ── */}
                {activeTab === 'home' && (
                    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 60px - 65px - env(safe-area-inset-bottom))', overflow: 'hidden' }}>
                        {/* Telegram Banner on Map */}
                        <AnimatePresence>
                            {needTgSetup && (
                                <motion.div
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    style={{
                                        position: 'absolute', top: 16, left: 16, right: 16, zIndex: 2000,
                                        background: 'var(--surface)', borderRadius: 16,
                                        boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                                        border: '1.5px solid #bae6fd', padding: '16px',
                                    }}
                                >
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <div style={{ width: 40, height: 40, borderRadius: 12, background: '#0088cc', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Send size={20} color="white" />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Nhận thông báo qua Telegram</p>
                                            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>Liên kết Telegram để nhận thông báo bé lên/xuống xe theo thời gian thực.</p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                                        <button onClick={() => setDismissTgBanner(true)} style={{ flex: 1, padding: '8px', borderRadius: 10, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                            Để sau
                                        </button>
                                        <button onClick={() => setActiveTab('settings')} style={{ flex: 1, padding: '8px', borderRadius: 10, background: '#0088cc', border: 'none', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                            Thêm ngay
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <MapContainer center={mapCenter} zoom={14} style={{ width: '100%', height: '100%' }} zoomControl={false}>
                            <TileLayer
                                attribution='&copy; OpenStreetMap'
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            />
                            {/* School markers */}
                            {routes.filter(r => r.schoolPos?.lat && r.schoolPos?.lng).map(r => (
                                <Marker key={`school-${r._id}`} position={[r.schoolPos!.lat, r.schoolPos!.lng]} icon={SCHOOL_ICON}>
                                    <Popup><div style={{ padding: '8px 12px' }}><b>🏫 Trường học</b><br /><span style={{ fontSize: 11, color: '#64748b' }}>Tuyến: {r.routeName}</span></div></Popup>
                                </Marker>
                            ))}
                            {/* Route polylines */}
                            {routes.map((r, ri) => {
                                const sorted = [...r.stops].sort((a, b) => a.order - b.order);
                                if (sorted.length < 2) return null;
                                const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];
                                return <Polyline key={r._id} positions={sorted.map(s => [s.lat, s.lng])} color={colors[ri % colors.length]} weight={3} opacity={0.6} dashArray="8,6" />;
                            })}
                            {/* Bus markers */}
                            {buses.filter(b => b.currentLat && b.currentLng).map(bus => (
                                <Marker 
                                    key={bus._id} 
                                    position={[bus.currentLat!, bus.currentLng!]} 
                                    icon={makeBusIcon(bus.isOnline)}
                                    eventHandlers={{
                                        popupopen: async () => {
                                            try {
                                                const res = await attendanceAPI.getBusStudentsToday(bus._id);
                                                const currentStudents = res.data.data.filter((item: any) => item.action_type === 'Boarding');
                                                setBusStudentsCount(prev => ({ ...prev, [bus._id]: currentStudents.length }));
                                            } catch (e) {}
                                        }
                                    }}
                                >
                                    <Popup>
                                        <div style={{ padding: '10px 14px', minWidth: 180 }}>
                                            <p style={{ fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>🚌 {bus.licensePlate}</p>
                                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 6px' }}>{bus.route_id?.routeName ?? 'Chưa có tuyến'}</p>
                                            
                                            {bus.driver_id && (
                                                <div style={{ marginBottom: 6, fontSize: 12, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                                                    <p style={{ margin: '0 0 2px', fontWeight: 600, color: 'var(--text-primary)' }}>👨‍✈️ {bus.driver_id.fullName}</p>
                                                    <p style={{ margin: 0, color: '#3b82f6' }}><a href={`tel:${bus.driver_id.phone}`} style={{textDecoration: 'none', color: '#3B82F6'}}>📞 {bus.driver_id.phone}</a></p>
                                                </div>
                                            )}

                                            <div style={{ marginBottom: 6, fontSize: 12, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                                                <p style={{ margin: 0, color: 'var(--text-primary)' }}>👥 Trên xe: <strong>{busStudentsCount[bus._id] ?? '...'} / {bus.capacity || 45}</strong></p>
                                            </div>

                                            <p style={{ fontSize: 12, margin: '6px 0 0', color: bus.isOnline ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>{bus.isOnline ? `● Online · ${Math.round(bus.currentSpeed ?? 0)} km/h` : '● Offline'}</p>
                                        </div>
                                    </Popup>
                                </Marker>
                            ))}
                        </MapContainer>

                        {/* Bottom Sheet for Status */}
                        <motion.div
                            drag="y"
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={0.5}
                            onDragEnd={(_e, info) => {
                                const isSwipeDown = info.offset.y > 50 || info.velocity.y > 300;
                                const isSwipeUp = info.offset.y < -50 || info.velocity.y < -300;
                                if (isSwipeDown) setSheetOpen(false);
                                else if (isSwipeUp) setSheetOpen(true);
                            }}
                            animate={{ y: sheetOpen ? 0 : 'calc(100% - 85px)' }}
                            initial={{ y: 'calc(100% - 85px)' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            style={{
                                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 1000,
                                background: 'var(--surface)', borderRadius: '24px 24px 0 0',
                                boxShadow: '0 -10px 40px rgba(0,0,0,0.15)',
                                display: 'flex', flexDirection: 'column',
                                height: '75%',
                            }}
                        >
                            <div
                                onClick={() => setSheetOpen(!sheetOpen)}
                                style={{ padding: '16px 0', display: 'flex', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                            >
                                <div style={{ width: 48, height: 6, background: 'var(--border)', borderRadius: 4 }} />
                            </div>

                            {/* Collapsed view (Always visible at top of sheet) */}
                            <div style={{ padding: '0 24px 14px', flexShrink: 0 }} onClick={() => setSheetOpen(true)}>
                                {children.length === 0 ? (
                                    <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>Chưa có học sinh</p>
                                ) : children.map(child => {
                                    const isOnBus = child.currentStatus === 'On_Bus';
                                    return (
                                        <p key={child._id} style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>
                                            {isOnBus ? '🟢' : '⚪'} Bé {child.fullName} - <span style={{ color: isOnBus ? 'var(--success)' : 'var(--text-secondary)' }}>{isOnBus ? 'Đang trên xe' : 'Chưa lên xe'}</span>
                                        </p>
                                    );
                                })}
                            </div>

                            {/* Expanded Content (Children details) */}
                            <div style={{ padding: '10px 24px 24px', overflowY: 'auto', flex: 1, opacity: sheetOpen ? 1 : 0, pointerEvents: sheetOpen ? 'auto' : 'none', borderTop: '1px solid var(--border)' }}>
                                {children.map(child => {
                                    const isOnBus = child.currentStatus === 'On_Bus';
                                    // Determine the bus from logs or match child's route
                                    const bus = isOnBus ? buses.find(b => b.isOnline) : null;
                                    const latestChildLog = logs.find(l => l.student_id?._id === child._id);

                                    return (
                                        <div key={child._id} style={{ marginBottom: 16, padding: '16px', background: 'var(--bg)', borderRadius: 16, border: '1px solid var(--border)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                                                <div style={{
                                                    width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                                                    background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: 'white', fontWeight: 700, fontSize: 20, overflow: 'hidden'
                                                }}>
                                                    {child.photoUrl ? (
                                                        <img src={getMediaUrl(child.photoUrl)} alt={child.fullName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        child.fullName.split(' ').pop()?.charAt(0)
                                                    )}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{child.fullName}</p>
                                                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: 11, background: 'var(--purple-light)', color: '#7c3aed', padding: '3px 8px', borderRadius: 20, fontWeight: 600 }}>Lớp {child.class}</span>
                                                        <span style={{ fontSize: 11, background: 'var(--surface-hover)', color: 'var(--text-secondary)', padding: '3px 8px', borderRadius: 20 }}>{child.studentCode}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <CreditCard size={14} />
                                                    <span>{child.rfid_uid || 'Chưa có thẻ'}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Route size={14} />
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{child.route_id?.routeName || '—'}</span>
                                                </div>
                                            </div>

                                            {/* Weekly Schedule */}
                                            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px dashed var(--border)' }}>
                                                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Calendar size={15} color="#7c3aed" /> Lịch đi xe buýt
                                                </p>
                                                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                                                    {[
                                                        { v: 1, l: 'T2' }, { v: 2, l: 'T3' }, { v: 3, l: 'T4' },
                                                        { v: 4, l: 'T5' }, { v: 5, l: 'T6' }, { v: 6, l: 'T7' }, { v: 0, l: 'CN' }
                                                    ].map(day => {
                                                        const isActive = (child.studyDays ?? [1, 2, 3, 4, 5]).includes(day.v);
                                                        return (
                                                            <div
                                                                key={day.v}
                                                                style={{
                                                                    flexShrink: 0, width: 34, height: 34, borderRadius: 10,
                                                                    border: `1.5px solid ${isActive ? '#7c3aed' : 'var(--border)'}`,
                                                                    background: isActive ? 'var(--purple-light)' : 'var(--surface)',
                                                                    color: isActive ? '#7c3aed' : 'var(--text-secondary)',
                                                                    fontWeight: isActive ? 700 : 500, fontSize: 13,
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                }}
                                                            >
                                                                {day.l}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {latestChildLog && (
                                                <div style={{ marginTop: 14, padding: '10px 12px', background: latestChildLog.action_type === 'Boarding' ? 'var(--success-light)' : 'var(--primary-light)', borderRadius: 10, fontSize: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                    {latestChildLog.action_type === 'Boarding'
                                                        ? <ArrowUpCircle size={16} color="var(--success)" />
                                                        : <ArrowDownCircle size={16} color="var(--primary)" />}
                                                    <span style={{ color: latestChildLog.action_type === 'Boarding' ? 'var(--success)' : 'var(--primary)', fontWeight: 600 }}>
                                                        {latestChildLog.action_type === 'Boarding' ? 'Lên xe' : 'Xuống xe'}
                                                    </span>
                                                    {latestChildLog.stop_name && (
                                                        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                                                            tại {latestChildLog.stop_name}
                                                        </span>
                                                    )}
                                                    <span style={{ color: 'var(--text-secondary)' }}>lúc {fmtTime(latestChildLog.scan_time)}</span>
                                                </div>
                                            )}

                                            {isOnBus && bus && (
                                                <div style={{ marginTop: 12, padding: '12px', background: 'var(--success-light)', borderRadius: 10 }}>
                                                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>🚍 Biển số xe: {bus.licensePlate}</p>
                                                    <p style={{ margin: '6px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--success)' }}>⚡ Tốc độ: {Math.round(bus.currentSpeed || 0)} km/h</p>
                                                    {bus.driver_id && (
                                                        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                                            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>👨‍✈️ Tài xế: {bus.driver_id.fullName}</p>
                                                            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>📞 SĐT: <a href={`tel:${bus.driver_id.phone}`} style={{ textDecoration: 'none', color: 'var(--success)' }}>{bus.driver_id.phone}</a></p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {!isOnBus && (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                                                    {child.currentStatus === 'Absent' && (
                                                        <div style={{
                                                            width: '100%', padding: '10px',
                                                            background: 'var(--surface-hover)', color: 'var(--text-secondary)',
                                                            border: '1px solid var(--border)', borderRadius: 10,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                            fontWeight: 600, fontSize: 12
                                                        }}>
                                                            <XCircle size={14} />
                                                            Đã báo vắng mặt hôm nay
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => handleMarkAbsent(child._id, child.fullName)}
                                                        style={{
                                                            width: '100%', padding: '12px',
                                                            background: 'var(--danger-light)', color: 'var(--danger)',
                                                            border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                                            cursor: 'pointer', fontWeight: 600, fontSize: 13
                                                        }}
                                                    >
                                                        <XCircle size={16} />
                                                        Xin nghỉ phép (báo vắng mặt)
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <>
                        {/* Header */}
                        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                            <div>
                                <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Lịch sử hoạt động</h1>
                                <p style={{ margin: '4px 0 0', opacity: 0.55, fontSize: 13 }}>Hôm nay</p>
                            </div>
                            <button onClick={fetchData} style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '7px 14px', borderRadius: 10, color: 'var(--text-primary)',
                                background: 'var(--surface)', border: '1px solid var(--border)',
                                cursor: 'pointer', fontSize: 13, fontWeight: 500,
                            }}>
                                <RefreshCw size={13} /> Cập nhật
                            </button>
                        </div>

                        {/* KPI cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
                            <motion.div whileHover={{ y: -2 }} style={{
                                background: latestLog?.action_type === 'Boarding'
                                    ? 'linear-gradient(135deg,#059669,#10b981)'
                                    : latestLog?.action_type === 'Dropping'
                                        ? 'linear-gradient(135deg,#2563eb,#3b82f6)'
                                        : 'linear-gradient(135deg,#64748b,#94a3b8)',
                                color: 'white', borderRadius: 16, padding: '18px 20px',
                                boxShadow: '0 4px 18px rgba(0,0,0,0.13)',
                            }}>
                                <p style={{ margin: 0, opacity: 0.85, fontSize: 13 }}>Trạng thái mới nhất</p>
                                <p style={{ margin: '8px 0 0', fontSize: 18, fontWeight: 700 }}>
                                    {latestLog?.action_type === 'Boarding' ? '🟢 Đã lên xe'
                                        : latestLog?.action_type === 'Dropping' ? '🔵 Đã xuống xe'
                                            : '⚪ Chưa có dữ liệu'}
                                </p>
                                {latestLog && <p style={{ margin: '4px 0 0', fontSize: 12, opacity: 0.85 }}>{fmtTime(latestLog.scan_time)} · Xe {latestLog.bus_id?.licensePlate ?? '—'}</p>}
                            </motion.div>
                            <motion.div whileHover={{ y: -2 }} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <div>
                                        <p style={{ margin: 0, opacity: 0.5, fontSize: 13, color: 'var(--text-primary)' }}>Lượt quét thẻ</p>
                                        <p style={{ margin: '8px 0 0', fontSize: 26, fontWeight: 700, color: 'var(--primary)' }}>{logs.length}</p>
                                    </div>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <CreditCard size={22} color="var(--primary)" />
                                    </div>
                                </div>
                            </motion.div>
                        </div>

                        {/* Lịch sử điểm danh hôm nay */}
                        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', marginBottom: 16 }}>
                                <Calendar size={18} color="#7c3aed" />
                                Chi tiết điểm danh
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {loading ? (
                                    <div style={{ textAlign: 'center', padding: '30px 0', color: '#94a3b8' }}>
                                        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px' }} />
                                    </div>
                                ) : logs.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.45, fontSize: 14 }}>
                                        Chưa có lượt điểm danh hôm nay
                                    </div>
                                ) : (
                                    <AnimatePresence initial={false}>
                                        {logs.map((log, i) => (
                                            <motion.div key={log._id}
                                                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i < 5 ? i * 0.04 : 0 }}
                                                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'var(--surface-hover)', border: '1px solid var(--border)' }}>
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                                    background: log.action_type === 'Boarding' ? 'var(--success-light)' : 'var(--primary-light)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${log.action_type === 'Boarding' ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`
                                                }}>
                                                    {log.action_type === 'Boarding' ? <ArrowUpCircle size={18} color="var(--success)" /> : <ArrowDownCircle size={18} color="var(--primary)" />}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ margin: 0, fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                                                        {log.student_id?.fullName ?? 'Không xác định'}
                                                    </p>
                                                    <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.55, color: 'var(--text-primary)' }}>
                                                        {log.bus_id?.licensePlate ?? '—'}
                                                    </p>
                                                </div>
                                                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{fmtTime(log.scan_time)}</p>
                                                    <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 600, color: log.action_type === 'Boarding' ? 'var(--success)' : 'var(--primary)' }}>
                                                        {log.action_type === 'Boarding' ? '↑ Lên' : '↓ Xuống'}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'settings' && (
                    <ParentSettings />
                )}
            </div>

            {/* ── Absence Modal ── */}
            {absentModal && (
                <AbsenceModal
                    childName={absentModal.childName}
                    onConfirm={handleConfirmAbsent}
                    onClose={() => setAbsentModal(null)}
                    loading={absentLoading}
                />
            )}
        </>
    );
};

export default ParentView;
