import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, Filter, Plus, Pencil, Trash2, X, Save,
    CreditCard, ChevronDown, GraduationCap,
    Phone, Bus, AlertTriangle, CheckCircle2, Loader2,
    ChevronLeft, ChevronRight, RefreshCw, Scan, Copy, ShieldCheck, User, MapPin,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { studentAPI, routeAPI, uploadAPI, getMediaUrl } from '../services/api';
import { io as ioClient, Socket } from 'socket.io-client';

// ── Types ────────────────────────────────────────────────────
interface StudentDoc {
    _id: string;
    studentCode: string;
    fullName: string;
    class: string;
    rfid_uid: string;
    isActive: boolean;
    fatherPhone?: string;
    motherPhone?: string;
    parent_id?: { fullName: string; phone: string };
    route_id?: { _id: string; routeName: string };
    classStartTime?: string;
    classEndTime?: string;
    assigned_stop?: string;
    studyDays?: number[];
    photoUrl?: string;
}

interface ParentCredentials {
    username: string;      // SĐT phụ huynh (dùng để đăng nhập)
    email: string;         // Email thật (nếu có) — đã gửi thông báo Gmail
    password: string;
    emailSent: boolean;    // true nếu backend đã gửi welcome email
    note: string;
}

interface FormData {
    studentCode: string;
    fullName: string;
    class: string;
    rfid_uid: string;
    fatherPhone: string;
    motherPhone: string;
    parentName: string;
    parentEmail: string;
    route_id: string;
    isActive: boolean;
    classStartTime: string;
    classEndTime: string;
    assigned_stop: string;
    studyDays: number[];
    photoUrl: string;
}

const GRADES = ['6A', '6B', '6C', '7A', '7B', '7C', '8A', '8B', '8C', '9A', '9B', '9C'];
const PAGE_SZ = 8;

interface RouteOption { _id: string; routeName: string; stops?: { stopName: string }[]; }

const EMPTY: FormData = {
    studentCode: '', fullName: '', class: '6A', rfid_uid: '',
    fatherPhone: '', motherPhone: '', parentName: '', parentEmail: '', route_id: '', isActive: true,
    classStartTime: '07:30', classEndTime: '16:30', assigned_stop: '', studyDays: [1, 2, 3, 4, 5], photoUrl: '',
};

// ── Parent Modal (Nested) ────────────────────────────────────
const ParentModal: React.FC<{
    mode: 'add' | 'edit';
    initial: { parentName: string; parentEmail: string; fatherPhone: string; motherPhone: string };
    onSave: (data: { parentName: string; parentEmail: string; fatherPhone: string; motherPhone: string }) => void;
    onClose: () => void;
}> = ({ mode, initial, onSave, onClose }) => {
    const [pForm, setPForm] = useState(initial);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Regex kiểm tra đúng định dạng Gmail (phải kết thúc bằng @gmail.com)
    const GMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@gmail\.com$/i;

    const save = () => {
        const errs: Record<string, string> = {};

        if (!pForm.fatherPhone.trim() && !pForm.motherPhone.trim()) {
            errs.phone = 'Phải cung cấp ít nhất một số điện thoại';
        }
        // Kiểm tra Gmail nếu có nhập (không bắt buộc, nhưng nếu nhập phải đúng định dạng Gmail)
        if (pForm.parentEmail.trim() && !GMAIL_REGEX.test(pForm.parentEmail.trim())) {
            errs.email = 'Địa chỉ email phải đúng định dạng Gmail (kết thúc bằng @gmail.com)';
        }

        if (Object.keys(errs).length > 0) {
            setErrors(errs);
            return;
        }
        onSave(pForm);
    };

    return (
        <div className="modal-backdrop" style={{ zIndex: 1100 }} onClick={onClose}>
            <motion.div className="modal modal-sm" onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 20 }} transition={{ duration: 0.2 }}>
                <div className="modal-header" style={{ background: 'linear-gradient(135deg,#0f766e,#0891b2)', borderRadius: '14px 14px 0 0' }}>
                    <div className="modal-title-wrap">
                        <div className="modal-title-icon"><User size={20} /></div>
                        <div>
                            <h2 className="modal-title" style={{ color: '#fff' }}>Thông tin Phụ huynh</h2>
                            <p className="modal-subtitle" style={{ color: 'rgba(255,255,255,.75)' }}>Điền thông tin liên lạc</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose} style={{ color: '#fff' }}><X size={18} /></button>
                </div>
                <div className="modal-body">
                    <div className="modal-grid" style={{ gridTemplateColumns: '1fr' }}>
                        {mode === 'add' && (
                            <>
                                <div className="form-group">
                                    <label className="form-label">Tên phụ huynh <span style={{fontSize: 11, color: '#94A3B8', fontWeight: 400}}>(tùy chọn)</span></label>
                                    <input className="form-field" placeholder="VD: Nguyễn Văn B"
                                        value={pForm.parentName} onChange={e => setPForm(p => ({...p, parentName: e.target.value}))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email phụ huynh
                                        <span style={{fontSize: 11, color: '#0f766e', fontWeight: 500, marginLeft: 6}}>✉️ Nhập để tự động gửi mật khẩu qua Gmail</span>
                                    </label>
                                    <input
                                        className={`form-field ${errors.email ? 'error' : ''}`}
                                        placeholder="vd: phuhuynh@gmail.com"
                                        type="email"
                                        value={pForm.parentEmail}
                                        onChange={e => {
                                            setPForm(p => ({...p, parentEmail: e.target.value}));
                                            // Xóa lỗi khi người dùng sửa lại
                                            if (errors.email) setErrors(p => ({...p, email: ''}));
                                        }}
                                    />
                                    {errors.email && (
                                        <p className="form-error" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            ⚠️ {errors.email}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                        <div className="form-group">
                            <label className="form-label"><Phone size={13} /> SĐT Bố <span className="required">*</span></label>
                            <input className="form-field" placeholder="0901234567"
                                value={pForm.fatherPhone} onChange={e => setPForm(p => ({...p, fatherPhone: e.target.value}))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label"><Phone size={13} /> SĐT Mẹ</label>
                            <input className="form-field" placeholder="0907654321"
                                value={pForm.motherPhone} onChange={e => setPForm(p => ({...p, motherPhone: e.target.value}))} />
                        </div>
                        {errors.phone && <p className="form-error">{errors.phone}</p>}
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn-cancel" onClick={onClose}>Huỷ</button>
                    <motion.button className="btn-save" onClick={save} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        Xác nhận
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
};

// ── Modal ────────────────────────────────────────────────────
const StudentModal: React.FC<{
    mode: 'add' | 'edit'; initial?: FormData; saving: boolean;
    routes: RouteOption[];
    onSave: (f: FormData) => void; onClose: () => void;
}> = ({ mode, initial, saving, routes, onSave, onClose }) => {
    const [form, setForm] = useState<FormData>(initial ?? { ...EMPTY });
    const [showParentModal, setShowParentModal] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isWaitingForCard, setIsWaitingForCard] = useState(false);
    const [cardScanned, setCardScanned] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const socketRef = useRef<Socket | null>(null);

    // Cleanup socket on unmount
    useEffect(() => {
        return () => {
            socketRef.current?.disconnect();
        };
    }, []);

    const set = (k: keyof FormData, v: string | boolean) =>
        setForm(p => ({ ...p, [k]: v }));

    const handleStartScan = () => {
        if (isWaitingForCard) {
            // Cancel scan
            socketRef.current?.disconnect();
            socketRef.current = null;
            setIsWaitingForCard(false);
            return;
        }

        setIsWaitingForCard(true);
        setCardScanned(false);

        const socket = ioClient(
            (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace('/api', ''),
            { transports: ['websocket', 'polling'] }
        );
        socketRef.current = socket;

        socket.on('new_card_scanned', (data: { rfid_uid: string }) => {
            set('rfid_uid', data.rfid_uid);
            setIsWaitingForCard(false);
            setCardScanned(true);
            setTimeout(() => setCardScanned(false), 3000);
            socket.disconnect();
            socketRef.current = null;
        });

        // Auto-cancel after 30 seconds
        setTimeout(() => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setIsWaitingForCard(false);
            }
        }, 30000);
    };

    const validate = () => {
        const e: Record<string, string> = {};
        if (!form.fullName.trim()) e.fullName = 'Vui lòng nhập họ tên';
        if (!form.studentCode.trim()) e.studentCode = 'Vui lòng nhập mã học sinh';
        if (!form.fatherPhone.trim() && !form.motherPhone.trim()) {
            e.phone = 'Phải cung cấp ít nhất một số điện thoại phụ huynh';
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // Lấy danh sách stops của tuyến đang chọn
    const currentRouteStops = form.route_id ? routes.find(r => r._id === form.route_id)?.stops || [] : [];

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <motion.div className="modal"
                initial={{ opacity: 0, scale: 0.94, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 20 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-header">
                    <div className="modal-title-wrap">
                        <div className="modal-title-icon"><GraduationCap size={20} /></div>
                        <div>
                            <h2 className="modal-title">{mode === 'add' ? 'Thêm học sinh mới' : 'Chỉnh sửa học sinh'}</h2>
                            <p className="modal-subtitle">{mode === 'add' ? 'Điền thông tin bên dưới' : `Đang sửa: ${initial?.fullName}`}</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>

                <form onSubmit={e => { e.preventDefault(); if (validate()) onSave(form); }} className="modal-body">
                    <div className="modal-grid">
                        <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{
                                    width: 80, height: 80, borderRadius: 16,
                                    background: 'var(--primary-light)', color: 'var(--primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 700, overflow: 'hidden'
                                }}>
                                    {isUploading ? (
                                        <Loader2 size={32} className="spin" color="var(--primary)" />
                                    ) : form.photoUrl ? (
                                        <img src={getMediaUrl(form.photoUrl)} alt="student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        form.fullName ? form.fullName.split(' ').pop()?.charAt(0) : <User size={32} />
                                    )}
                                </div>
                                <label style={{
                                    position: 'absolute', bottom: -5, right: -5, width: 28, height: 28, borderRadius: '50%',
                                    background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', border: '2px solid var(--surface)', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                }} title="Tải lên ảnh học sinh">
                                    <Plus size={16} />
                                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            if (file.size > 2 * 1024 * 1024) {
                                                toast.error('Ảnh quá lớn. Vui lòng chọn ảnh dưới 2MB.');
                                                return;
                                            }
                                            setIsUploading(true);
                                            uploadAPI.uploadImage(file)
                                                .then(res => {
                                                    set('photoUrl', res.data.data.url);
                                                })
                                                .catch(err => {
                                                    toast.error(err.response?.data?.message || 'Lỗi tải ảnh lên');
                                                })
                                                .finally(() => setIsUploading(false));
                                        }
                                    }} />
                                </label>
                            </div>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Ảnh học sinh</h3>
                                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Định dạng JPG, PNG. Tối đa 2MB.</p>
                                {form.photoUrl && (
                                    <button type="button" onClick={() => set('photoUrl', '')} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--danger)', fontSize: 13, cursor: 'pointer', padding: 0 }}>Xóa ảnh</button>
                                )}
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Mã học sinh <span className="required">*</span></label>
                            <input className={`form-field ${errors.studentCode ? 'error' : ''}`}
                                placeholder="HS013" value={form.studentCode}
                                onChange={e => set('studentCode', e.target.value)} />
                            {errors.studentCode && <p className="form-error">{errors.studentCode}</p>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Họ và tên <span className="required">*</span></label>
                            <input className={`form-field ${errors.fullName ? 'error' : ''}`}
                                placeholder="Nguyễn Văn A" value={form.fullName}
                                onChange={e => set('fullName', e.target.value)} />
                            {errors.fullName && <p className="form-error">{errors.fullName}</p>}
                        </div>
                        <div className="form-group">
                            <label className="form-label">Lớp</label>
                            <div className="select-wrap">
                                <select className="form-field form-select" value={form.class}
                                    onChange={e => set('class', e.target.value)}>
                                    {GRADES.map(g => <option key={g}>{g}</option>)}
                                </select>
                                <ChevronDown size={14} className="select-icon" />
                            </div>
                        </div>
                        <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            <div>
                                <label className="form-label">Giờ vào học</label>
                                <input type="time" className="form-field"
                                    value={form.classStartTime}
                                    onChange={e => set('classStartTime', e.target.value)} />
                            </div>
                            <div>
                                <label className="form-label">Giờ tan học</label>
                                <input type="time" className="form-field"
                                    value={form.classEndTime}
                                    onChange={e => set('classEndTime', e.target.value)} />
                            </div>
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label">Lịch đi xe buýt (Tuần)</label>
                            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                {[
                                    { v: 1, l: 'T2' }, { v: 2, l: 'T3' }, { v: 3, l: 'T4' },
                                    { v: 4, l: 'T5' }, { v: 5, l: 'T6' }, { v: 6, l: 'T7' }, { v: 0, l: 'CN' }
                                ].map(day => {
                                    const isActive = form.studyDays.includes(day.v);
                                    return (
                                        <button
                                            key={day.v}
                                            type="button"
                                            onClick={() => {
                                                const updated = isActive ? form.studyDays.filter(d => d !== day.v) : [...form.studyDays, day.v].sort();
                                                setForm(p => ({ ...p, studyDays: updated }));
                                            }}
                                            style={{
                                                flex: 1, height: 36, borderRadius: 8,
                                                border: `1.5px solid ${isActive ? '#0f766e' : 'var(--border)'}`,
                                                background: isActive ? '#f0fdfa' : 'var(--surface)',
                                                color: isActive ? '#0f766e' : 'var(--text-secondary)',
                                                fontWeight: isActive ? 700 : 500, fontSize: 13,
                                                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {day.l}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label"><Bus size={13} /> Tuyến xe</label>
                            <div className="select-wrap">
                                <select className="form-field form-select" value={form.route_id}
                                    onChange={e => {
                                        set('route_id', e.target.value);
                                        set('assigned_stop', ''); // reset điểm dừng khi đổi tuyến
                                    }}>
                                    <option value="">— Chưa chọn tuyến —</option>
                                    {routes.map((r: RouteOption) => <option key={r._id} value={r._id}>{r.routeName}</option>)}
                                </select>
                                <ChevronDown size={14} className="select-icon" />
                            </div>
                        </div>

                        {/* Điểm dừng */}
                        <div className="form-group form-group-full">
                            <label className="form-label"><MapPin size={13} /> Điểm dừng (tuỳ chọn)</label>
                            <div className="select-wrap">
                                <select className="form-field form-select" value={form.assigned_stop}
                                    disabled={!form.route_id || currentRouteStops.length === 0}
                                    onChange={e => set('assigned_stop', e.target.value)}>
                                    <option value="">— Chưa chọn điểm dừng —</option>
                                    {currentRouteStops.map((s, i) => (
                                        <option key={i} value={s.stopName}>{s.stopName}</option>
                                    ))}
                                </select>
                                <ChevronDown size={14} className="select-icon" />
                            </div>
                        </div>

                        <div className="form-group form-group-full" style={{ marginTop: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: 8, marginBottom: 12 }}>
                                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <User size={15} /> Thông tin Phụ huynh <span className="required">*</span>
                                </h3>
                                <button type="button" onClick={() => setShowParentModal(true)} style={{ background: '#0f766e', color: 'white', border: 'none', padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {form.fatherPhone || form.motherPhone ? <><Pencil size={12} /> Chỉnh sửa</> : <><Plus size={12} /> Nhập thông tin</>}
                                </button>
                            </div>
                            
                            <div style={{ background: 'var(--surface-hover)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 13 }}>
                                {!(form.fatherPhone || form.motherPhone) ? (
                                    <span style={{ color: 'var(--danger)', display:'flex', alignItems:'center', gap: 6, fontWeight: 500 }}>
                                        <AlertTriangle size={15} /> Chưa có thông tin liên lạc (Bắt buộc)
                                    </span>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                        {mode === 'add' && <p><strong>Tên phụ huynh:</strong> {form.parentName || <span style={{color:'#94a3b8', fontStyle:'italic'}}>Tạo tự động</span>}</p>}
                                        {mode === 'add' && <p><strong>Email phụ huynh:</strong> {form.parentEmail || <span style={{color:'#94a3b8', fontStyle:'italic'}}>Tạo tự động</span>}</p>}
                                        <p><strong>SĐT Bố:</strong> {form.fatherPhone || '—'}</p>
                                        <p><strong>SĐT Mẹ:</strong> {form.motherPhone || '—'}</p>
                                    </div>
                                )}
                                {errors.phone && <p className="form-error" style={{marginTop: 8}}>{errors.phone}</p>}
                            </div>
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label"><CreditCard size={13} /> UID thẻ RFID
                                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400, marginLeft: 6 }}>(tùy chọn)</span>
                            </label>
                            <div className="rfid-input-row">
                                <input
                                    className={`form-field rfid-field ${errors.rfid_uid ? 'error' : ''} ${cardScanned ? 'success' : ''}`}
                                    placeholder="VD: A1B2C3D4"
                                    value={form.rfid_uid}
                                    readOnly={isWaitingForCard}
                                    onChange={e => { set('rfid_uid', e.target.value.toUpperCase()); setCardScanned(false); }}
                                />
                                <motion.button
                                    type="button"
                                    onClick={handleStartScan}
                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 6,
                                        padding: '8px 14px', borderRadius: 8, border: 'none',
                                        cursor: 'pointer', fontSize: 13, fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        background: isWaitingForCard ? 'var(--warning-light)' : cardScanned ? 'var(--success-light)' : 'var(--primary-light)',
                                        color: isWaitingForCard ? '#D97706' : cardScanned ? '#059669' : '#2563EB',
                                        outline: isWaitingForCard ? '2px solid var(--warning)' : 'none',
                                    }}
                                >
                                    {isWaitingForCard ? (
                                        <><Loader2 size={15} className="spin" /> Hủy quét</>
                                    ) : cardScanned ? (
                                        <><CheckCircle2 size={15} /> Đã quét!</>
                                    ) : (
                                        <><Scan size={15} /> Quét thẻ</>
                                    )}
                                </motion.button>
                            </div>

                            {/* Live status message */}
                            <AnimatePresence>
                                {isWaitingForCard && (
                                    <motion.p
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        style={{
                                            fontSize: 12, color: '#D97706', marginTop: 6,
                                            display: 'flex', alignItems: 'center', gap: 6
                                        }}
                                    >
                                        <span style={{
                                            width: 8, height: 8, borderRadius: '50%',
                                            background: 'var(--warning)', display: 'inline-block',
                                            animation: 'pulse 1s infinite'
                                        }} />
                                        Đang chờ quét thẻ... Đưa thẻ vào đầu đọc RFID trên ESP32
                                    </motion.p>
                                )}
                                {cardScanned && (
                                    <motion.p
                                        initial={{ opacity: 0, y: -4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0 }}
                                        style={{ fontSize: 12, color: '#059669', marginTop: 6, fontWeight: 600 }}
                                    >
                                        Đã đọc UID từ thẻ thật!
                                    </motion.p>
                                )}
                            </AnimatePresence>

                            {!isWaitingForCard && !cardScanned && (
                                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                                    Nhấn “Quét thẻ” rồi đưa thẻ RFID vào đầu đọc — UID sẽ tự điền. Hoặc nhập thủ công.
                                </p>
                            )}
                            {errors.rfid_uid && <p className="form-error">{errors.rfid_uid}</p>}
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label">Trạng thái</label>
                            <div className="toggle-group">
                                {([true, false] as const).map(v => (
                                    <button key={String(v)} type="button"
                                        className={`toggle-option ${form.isActive === v ? 'selected' : ''} toggle-${v ? 'active' : 'inactive'}`}
                                        onClick={() => set('isActive', v)}>
                                        {v ? 'Đang theo học' : 'Nghỉ học'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn-cancel" onClick={onClose}>Huỷ bỏ</button>
                        <motion.button type="submit" className="btn-save" disabled={saving}
                            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            {saving ? <Loader2 size={15} className="spin" /> : <Save size={16} />}
                            {mode === 'add' ? 'Thêm học sinh' : 'Lưu thay đổi'}
                        </motion.button>
                    </div>
                </form>
                
                <AnimatePresence>
                    {showParentModal && (
                        <ParentModal
                            mode={mode}
                            initial={{ parentName: form.parentName, parentEmail: form.parentEmail, fatherPhone: form.fatherPhone, motherPhone: form.motherPhone }}
                            onSave={data => {
                                setForm(p => ({ ...p, ...data }));
                                setShowParentModal(false);
                            }}
                            onClose={() => setShowParentModal(false)}
                        />
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};

// ── Delete Confirm ───────────────────────────────────────────
const DeleteConfirm: React.FC<{
    student: StudentDoc; onConfirm: () => void; onClose: () => void;
}> = ({ student, onConfirm, onClose }) => (
    <div className="modal-backdrop" onClick={onClose}>
        <motion.div className="modal modal-sm"
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.2 }}
            onClick={e => e.stopPropagation()}>
            <div className="delete-confirm">
                <div className="delete-icon"><AlertTriangle size={28} /></div>
                <h3>Xác nhận xoá</h3>
                <p>Bạn có chắc muốn xoá <strong>{student.fullName}</strong>?<br />Hành động này không thể khôi phục.</p>
                <div className="modal-footer">
                    <button className="btn-cancel" onClick={onClose}>Huỷ</button>
                    <button className="btn-delete" onClick={onConfirm}><Trash2 size={15} /> Xoá học sinh</button>
                </div>
            </div>
        </motion.div>
    </div>
);

// ── CredentialsModal ─────────────────────────────────────────
const CredentialsModal: React.FC<{
    creds: ParentCredentials; studentName: string; onClose: () => void;
}> = ({ creds, studentName, onClose }) => {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(
            `Tên đăng nhập: ${creds.username}\nMật khẩu: ${creds.password}${
                creds.email ? `\nEmail: ${creds.email}` : ''
            }`
        );
        setCopied(true); setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <motion.div className="modal modal-sm" onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92 }} transition={{ duration: 0.25 }}>
                <div className="modal-header" style={{ background: 'linear-gradient(135deg,#0f766e,#0891b2)', borderRadius: '14px 14px 0 0' }}>
                    <div className="modal-title-wrap">
                        <div className="modal-title-icon"><ShieldCheck size={20} /></div>
                        <div>
                            <h2 className="modal-title" style={{ color: '#fff' }}>Tài khoản Phụ huynh</h2>
                            <p className="modal-subtitle" style={{ color: 'rgba(255,255,255,.75)' }}>Đã tự động tạo cho HS {studentName}</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose} style={{ color: '#fff' }}><X size={18} /></button>
                </div>
                <div className="modal-body">
                    {/* Badge thông báo đã gửi email */}
                    {creds.emailSent ? (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: '#ecfdf5', border: '1px solid #6ee7b7',
                            borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                            fontSize: 13, color: '#065f46', fontWeight: 500,
                        }}>
                            <CheckCircle2 size={16} color="#059669" />
                            Đã gửi thông báo tự động đến <strong style={{ marginLeft: 4 }}>{creds.email}</strong>
                        </div>
                    ) : (
                        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14, lineHeight: 1.6 }}>
                            📋 Vui lòng <strong>sao chép và gửi</strong> thông tin này cho phụ huynh.
                            Mật khẩu chỉ hiển thị <strong>một lần</strong> duy nhất.
                        </p>
                    )}

                    <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginBottom: 12 }}>
                        {/* Tên đăng nhập */}
                        <div style={{ marginBottom: 12 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 1 }}>👤 Tên đăng nhập (SĐT)</span>
                            <p style={{ fontFamily: 'monospace', fontSize: 15, color: '#0f172a', marginTop: 4, fontWeight: 700 }}>{creds.username}</p>
                        </div>
                        {/* Email (nếu có) */}
                        {creds.email && (
                            <div style={{ marginBottom: 12 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 1 }}>✉️ Email phụ huynh</span>
                                <p style={{ fontFamily: 'monospace', fontSize: 13, color: '#334155', marginTop: 4, wordBreak: 'break-all' as const }}>{creds.email}</p>
                            </div>
                        )}
                        {/* Mật khẩu */}
                        <div>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 1 }}>🔑 Mật khẩu tạm thời</span>
                            <p style={{ fontFamily: 'monospace', fontSize: 20, color: '#0f766e', fontWeight: 700, marginTop: 4, letterSpacing: 3 }}>{creds.password}</p>
                        </div>
                    </div>
                    <p style={{ fontSize: 11, color: '#94a3b8' }}>💡 {creds.note}</p>
                </div>
                <div className="modal-footer">
                    <motion.button className="btn-save" style={{ background: 'linear-gradient(135deg,#0f766e,#0891b2)' }}
                        onClick={copy} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        {copied ? <><CheckCircle2 size={15} /> Đã sao chép!</> : <><Copy size={15} /> Sao chép thông tin</>}
                    </motion.button>
                    <button className="btn-cancel" onClick={onClose}>Đóng</button>
                </div>
            </motion.div>
        </div>
    );
};

// ── StudentDetailModal ───────────────────────────────────────
const StudentDetailModal: React.FC<{
    student: StudentDoc; onClose: () => void;
}> = ({ student, onClose }) => {
    return (
        <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
            <motion.div className="modal" onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 20 }} transition={{ duration: 0.25 }}>
                <div className="modal-header" style={{ background: 'linear-gradient(135deg,#1e293b,#0f172a)' }}>
                    <div className="modal-title-wrap">
                        <div className="modal-title-icon" style={{ background: 'rgba(255,255,255,0.1)' }}><User size={20} color="#fff" /></div>
                        <div>
                            <h2 className="modal-title" style={{ color: '#fff' }}>Chi tiết Học sinh</h2>
                            <p className="modal-subtitle" style={{ color: '#cbd5e1' }}>Mã: {student.studentCode}</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose} style={{ color: '#fff' }}><X size={18} /></button>
                </div>
                <div className="modal-body" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', alignItems: 'center' }}>
                        <div style={{ 
                            width: 64, height: 64, borderRadius: '50%', background: '#e2e8f0', 
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#475569', overflow: 'hidden'
                        }}>
                            {student.photoUrl ? (
                                <img src={getMediaUrl(student.photoUrl)} alt="student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                student.fullName.split(' ').pop()?.charAt(0)
                            )}
                        </div>
                        <div>
                            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{student.fullName}</h3>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                <span className="grade-badge" style={{ fontSize: 12 }}>Lớp {student.class}</span>
                                <span className="grade-badge" style={{ fontSize: 12, background: 'var(--primary-light)', color: 'var(--primary)' }}>🕒 {student.classStartTime || '07:30'}</span>
                                <span className={`status-badge ${student.isActive ? 'status-active' : 'status-inactive'}`} style={{ fontSize: 12 }}>
                                    {student.isActive ? 'Đang học' : 'Nghỉ học'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Bus size={14} /> Thông tin Tuyến</h4>
                            <p style={{ fontSize: 14, color: '#334155', marginBottom: 8 }}><strong>Tuyến xe:</strong> {student.route_id?.routeName || '—'}</p>
                            <p style={{ fontSize: 14, color: '#334155', marginBottom: 8 }}><strong>Điểm dừng:</strong> {student.assigned_stop ? <span style={{ color: '#0f766e', fontWeight: 600 }}>📍 {student.assigned_stop}</span> : '—'}</p>
                            <p style={{ fontSize: 14, color: '#334155' }}><strong>Thẻ RFID:</strong> <span className="rfid-chip" style={{ display: 'inline-flex', marginTop: 0 }}>{student.rfid_uid || '—'}</span></p>
                        </div>
                        
                        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
                            <h4 style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={14} /> Liên lạc Phụ huynh</h4>
                            <p style={{ fontSize: 14, color: '#334155', marginBottom: 8 }}><strong>Tên:</strong> {student.parent_id?.fullName || '—'}</p>
                            <p style={{ fontSize: 14, color: '#334155', marginBottom: 8 }}><strong>SĐT:</strong> {student.parent_id?.phone || '—'}</p>
                            <p style={{ fontSize: 14, color: '#334155' }}><strong>SĐT Bố:</strong> {student.fatherPhone || '—'} <span style={{margin: '0 4px', color: '#cbd5e1'}}>|</span> <strong>SĐT Mẹ:</strong> {student.motherPhone || '—'}</p>
                        </div>
                    </div>
                </div>
                <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn-cancel" onClick={onClose}>Đóng</button>
                </div>
            </motion.div>
        </div>
    );
};

// ── Main ─────────────────────────────────────────────────────
const StudentManagement: React.FC = () => {
    const [students, setStudents] = useState<StudentDoc[]>([]);
    const [routes, setRoutes] = useState<RouteOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [filterRoute, setFilterRoute] = useState('');
    const [showFilter, setShowFilter] = useState(false);
    const [page, setPage] = useState(1);
    const [modal, setModal] = useState<null | { mode: 'add' | 'edit' | 'view'; student?: StudentDoc }>(null);
    const [del, setDel] = useState<StudentDoc | null>(null);
    const [credentials, setCredentials] = useState<{ creds: ParentCredentials; name: string } | null>(null);

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        toast[type](text);
    };

    // ── Fetch ─────────────────────────────────────────────
    const fetchStudents = useCallback(async () => {
        setLoading(true);
        try {
            const [stuRes, rteRes] = await Promise.all([
                studentAPI.getAll(),
                routeAPI.getAll(),
            ]);
            setStudents(stuRes.data.data as StudentDoc[]);
            setRoutes(rteRes.data.data as RouteOption[]);
        } catch {
            showToast('❌ Không thể tải dữ liệu', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStudents(); }, [fetchStudents]);

    // ── Filter client-side (search + route) ───────────────
    const filtered = useMemo(() => {
        const q = search.toLowerCase();
        return students.filter(s => {
            const matchQ = !q
                || s.fullName.toLowerCase().includes(q)
                || s.studentCode.toLowerCase().includes(q)
                || s.rfid_uid?.toLowerCase().includes(q);
            const matchR = !filterRoute || s.route_id?.routeName === filterRoute;
            return matchQ && matchR;
        });
    }, [students, search, filterRoute]);

    const totalPages = Math.ceil(filtered.length / PAGE_SZ);
    const paged = filtered.slice((page - 1) * PAGE_SZ, page * PAGE_SZ);

    // ── Save (create or update) ────────────────────────────
    const handleSave = async (form: FormData) => {
        setSaving(true);
        try {
            const payload = {
                studentCode: form.studentCode,
                fullName: form.fullName,
                class: form.class,
                rfid_uid: form.rfid_uid || undefined,
                route_id: form.route_id || undefined,
                isActive: form.isActive,
                fatherPhone: form.fatherPhone || undefined,
                motherPhone: form.motherPhone || undefined,
                parentName: form.parentName || undefined,
                parentEmail: form.parentEmail || undefined,
                classStartTime: form.classStartTime,
                assigned_stop: form.assigned_stop || undefined,
                studyDays: form.studyDays,
                photoUrl: form.photoUrl || undefined,
            };
            if (modal?.mode === 'add') {
                const res = await studentAPI.create(payload);
                setModal(null);

                // ── Kiểm tra xem backend có tạo/cập nhật tài khoản phụ huynh không ──
                const parentInfo = res.data?.parentInfo;
                const isNewParent = parentInfo?.isNew === true;
                const emailSentTo: string | null = parentInfo?.emailSentTo ?? null;
                const emailError: string | null = parentInfo?.emailError ?? null;

                if (isNewParent) {
                    // Username luôn là SĐT (fatherPhone ưu tiên, hoặc motherPhone)
                    const parentPhone = form.fatherPhone || form.motherPhone;
                    setCredentials({
                        name: form.fullName,
                        creds: {
                            username: parentPhone,
                            email: emailSentTo || form.parentEmail || '',
                            password: '123456',
                            emailSent: !!emailSentTo,
                            note: emailSentTo
                                ? 'Thông tin đã được gửi tự động qua Gmail. Phụ huynh nên đổi mật khẩu ngay sau lần đăng nhập đầu tiên.'
                                : emailError
                                    ? `Gửi email thất bại: ${emailError}. Vui lòng thông báo thông tin này trực tiếp.`
                                    : 'Hệ thống chưa có email phụ huynh — vui lòng thông báo thông tin này trực tiếp. Phụ huynh nên cập nhật email trong phần Hồ sơ.',
                        },
                    });
                }

                // Toast thông báo kết quả
                if (emailSentTo) {
                    showToast(` Đã thêm ${form.fullName} & gửi email đến ${emailSentTo}`);
                } else if (emailError) {
                    showToast(`⚠️ Đã thêm ${form.fullName} nhưng gửi email thất bại: ${emailError}`, 'error');
                } else {
                    showToast(` Đã thêm học sinh ${form.fullName}`);
                }
            } else if (modal?.student) {
                await studentAPI.update(modal.student._id, payload);
                setModal(null);
                showToast(` Đã cập nhật ${form.fullName}`);
            }
            await fetchStudents();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Lỗi lưu dữ liệu';
            showToast(`❌ ${msg}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ─────────────────────────────────────────────
    const handleDelete = async () => {
        if (!del) return;
        try {
            await studentAPI.remove(del._id);
            showToast(`Đã xoá học sinh ${del.fullName}`);
            setDel(null);
            await fetchStudents();
        } catch {
            showToast('Không thể xoá học sinh', 'error');
        }
    };

    const toForm = (s: StudentDoc): FormData => ({
        studentCode: s.studentCode, fullName: s.fullName, class: s.class,
        rfid_uid: s.rfid_uid ?? '',
        fatherPhone: s.fatherPhone ?? '',
        motherPhone: s.motherPhone ?? '',
        parentName: s.parent_id?.fullName ?? '',
        parentEmail: '', // Usually don't populate parentEmail for edit to prevent accidental overwrites, or fetch from parent_id if needed
        route_id: s.route_id?._id ?? '', isActive: s.isActive,
        classStartTime: s.classStartTime || '07:30',
        classEndTime: s.classEndTime || '16:30',
        assigned_stop: s.assigned_stop || '',
        studyDays: s.studyDays ?? [1, 2, 3, 4, 5],
        photoUrl: s.photoUrl || '',
    });

    return (
        <div className="crud-page">

            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Quản lý Học sinh</h1>
                    <p className="page-subtitle">
                        {loading ? 'Đang tải...' : `${students.length} học sinh · ${students.filter(s => s.isActive).length} đang theo học`}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-filter" onClick={fetchStudents} title="Làm mới">
                        <RefreshCw size={15} />
                    </button>
                    <motion.button className="btn-primary" onClick={() => setModal({ mode: 'add' })}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Plus size={18} /> Thêm Học sinh
                    </motion.button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="crud-toolbar">
                <div className="crud-search-wrap">
                    <Search size={16} className="crud-search-icon" />
                    <input className="crud-search" placeholder="Tìm theo tên, mã HS hoặc UID thẻ..."
                        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                    {search && <button className="crud-search-clear" onClick={() => setSearch('')}><X size={14} /></button>}
                </div>
                <div style={{ position: 'relative' }}>
                    <button className={`btn-filter ${filterRoute ? 'active' : ''}`} onClick={() => setShowFilter(!showFilter)}>
                        <Filter size={15} /> Bộ lọc {filterRoute && <span className="filter-count">!</span>}
                    </button>
                    <AnimatePresence>
                        {showFilter && (
                            <motion.div className="filter-dropdown"
                                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                                <p className="filter-section-label">Lọc theo Tuyến xe</p>
                                <div className="filter-chips">
                                    <button className={`chip ${!filterRoute ? 'active' : ''}`} onClick={() => setFilterRoute('')}>Tất cả</button>
                                    {routes.map((r: RouteOption) => (
                                        <button key={r._id} className={`chip ${filterRoute === r._id ? 'active' : ''}`}
                                            onClick={() => { setFilterRoute(r._id); setPage(1); setShowFilter(false); }}>
                                            {r.routeName}
                                        </button>
                                    ))}
                                </div>
                                {filterRoute && <button className="filter-clear" onClick={() => setFilterRoute('')}>Xóa bộ lọc</button>}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <span className="result-count">{filtered.length} kết quả</span>
            </div>

            {/* Table */}
            <div className="card table-card">
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>STT</th><th>Mã HS</th><th>Họ và Tên</th><th>Lớp</th>
                                <th>UID Thẻ RFID</th><th>SĐT Phụ huynh</th>
                                <th>Tuyến xe</th><th>Trạng thái</th><th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout">
                                {loading ? (
                                    <tr key="loading">
                                        <td colSpan={9} className="empty-row">
                                            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }} />
                                            Đang tải dữ liệu từ MongoDB...
                                        </td>
                                    </tr>
                                ) : paged.length === 0 ? (
                                    <tr key="empty">
                                        <td colSpan={9} className="empty-row">
                                            <GraduationCap size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                                            Không tìm thấy học sinh nào
                                        </td>
                                    </tr>
                                ) : paged.map((s, idx) => (
                                    <motion.tr key={s._id}
                                        onDoubleClick={() => setModal({ mode: 'view', student: s })}
                                        style={{ cursor: 'pointer', userSelect: 'none' }}
                                        title="Double click để xem chi tiết"
                                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ delay: idx * 0.04, duration: 0.25 }} layout>
                                        <td className="row-num">{(page - 1) * PAGE_SZ + idx + 1}</td>
                                        <td><span className="code-chip">{s.studentCode}</span></td>
                                        <td>
                                            <div className="student-cell">
                                                <div className="student-avatar" style={{ overflow: 'hidden' }}>
                                                    {s.photoUrl ? (
                                                        <img src={getMediaUrl(s.photoUrl)} alt="student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        s.fullName.split(' ').pop()?.charAt(0)
                                                    )}
                                                </div>
                                                <span className="student-name">{s.fullName}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                                                <span className="grade-badge">{s.class}</span>
                                                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>🕒 {s.classStartTime || '07:30'}</span>
                                            </div>
                                        </td>
                                        <td><span className="rfid-chip"><CreditCard size={12} />{s.rfid_uid ?? '—'}</span></td>
                                        <td className="phone-cell"><Phone size={12} />{s.parent_id?.phone ?? '—'}</td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                                                <span className="route-chip">{s.route_id?.routeName ?? '—'}</span>
                                                {s.assigned_stop && <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>📍 {s.assigned_stop}</span>}
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`status-badge ${s.isActive ? 'status-active' : 'status-inactive'}`}>
                                                {s.isActive ? 'Đang học' : 'Nghỉ học'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-btns">
                                                <button className="action-btn edit" onClick={() => setModal({ mode: 'edit', student: s })} title="Sửa">
                                                    <Pencil size={15} />
                                                </button>
                                                <button className="action-btn delete" onClick={() => setDel(s)} title="Xoá">
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

                {totalPages > 1 && (
                    <div className="pagination">
                        <span className="pagination-info">Trang {page} / {totalPages} ({filtered.length} học sinh)</span>
                        <div className="pagination-btns">
                            <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} onClick={() => setPage(p)}>{p}</button>
                            ))}
                            <button className="page-btn" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
                        </div>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {modal && (modal.mode === 'add' || modal.mode === 'edit') && <StudentModal mode={modal.mode as 'add' | 'edit'} initial={modal.student ? toForm(modal.student) : undefined}
                    routes={routes} saving={saving} onSave={handleSave} onClose={() => setModal(null)} />}
                {modal && modal.mode === 'view' && modal.student && <StudentDetailModal student={modal.student} onClose={() => setModal(null)} />}
                {del && <DeleteConfirm student={del} onConfirm={handleDelete} onClose={() => setDel(null)} />}
                {credentials && <CredentialsModal creds={credentials.creds} studentName={credentials.name}
                    onClose={() => setCredentials(null)} />}
            </AnimatePresence>
            {showFilter && <div className="filter-backdrop" onClick={() => setShowFilter(false)} />}
        </div>
    );
};

export default StudentManagement;
