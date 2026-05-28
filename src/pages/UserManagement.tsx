import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search, X, Pencil, Trash2, RefreshCw, Loader2, Save,
    Users, ShieldCheck, User, Bus, KeyRound, CheckCircle2,
    AlertTriangle, ToggleLeft, ToggleRight, Copy, ChevronLeft, ChevronRight, BellRing,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { userAPI, busAPI, getMediaUrl } from '../services/api';

// ── Types ─────────────────────────────────────────────────────
interface UserDoc {
    _id: string;
    fullName: string;
    email: string;
    role: 'Admin' | 'Parent' | 'Driver';
    phone?: string;
    telegram_chat_id?: string;
    isActive: boolean;
    createdAt: string;
    avatar?: string;
}

const PAGE_SZ = 10;

const ROLE_META: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    Admin:  { label: 'Admin',    color: '#7C3AED', icon: ShieldCheck },
    Parent: { label: 'Phụ huynh', color: '#0891b2', icon: User },
    Driver: { label: 'Tài xế',   color: '#059669', icon: Bus },
};

// ── Edit Modal ────────────────────────────────────────────────
const EditModal: React.FC<{
    user: UserDoc; saving: boolean;
    onSave: (data: Partial<UserDoc>) => void; onClose: () => void;
}> = ({ user, saving, onSave, onClose }) => {
    const [form, setForm] = useState({
        fullName: user.fullName,
        phone: user.phone ?? '',
        role: user.role,
        isActive: user.isActive,
        telegram_chat_id: user.telegram_chat_id ?? '',
        password: '',
    });
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <motion.div className="modal modal-sm" onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.93, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.93, y: 20 }} transition={{ duration: 0.25 }}>
                <div className="modal-header">
                    <div className="modal-title-wrap">
                        <div className="modal-title-icon"><Users size={20} /></div>
                        <div>
                            <h2 className="modal-title">Chỉnh sửa tài khoản</h2>
                            <p className="modal-subtitle">{user.email}</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose}><X size={18} /></button>
                </div>
                <div className="modal-body">
                    <div className="modal-grid">
                        <div className="form-group form-group-full">
                            <label className="form-label">Họ tên</label>
                            <input className="form-field" value={form.fullName}
                                onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Số điện thoại</label>
                            <input className="form-field" placeholder="09xxxxxxxx" value={form.phone}
                                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Vai trò</label>
                            <select className="form-field form-select" value={form.role}
                                onChange={e => setForm(p => ({ ...p, role: e.target.value as UserDoc['role'] }))}>
                                <option value="Parent">Phụ huynh</option>
                                <option value="Driver">Tài xế</option>
                            </select>
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label">Mật khẩu hiện tại</label>
                            <input className="form-field" type="text" value="******** (Đã được mã hoá bảo mật)" disabled
                                style={{ background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed', fontStyle: 'italic' }}
                                title="Mật khẩu đã được mã hoá một chiều (Bcrypt) nên không thể hiển thị." />
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label">Mật khẩu mới (Để trống nếu không đổi)</label>
                            <input className="form-field" type="text" placeholder="Nhập mật khẩu mới để thay đổi..." value={form.password}
                                onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label">Telegram Chat ID</label>
                            <input className="form-field" placeholder="Để trống nếu chưa liên kết" value={form.telegram_chat_id}
                                onChange={e => setForm(p => ({ ...p, telegram_chat_id: e.target.value }))} />
                        </div>
                        <div className="form-group form-group-full">
                            <label className="form-label">Trạng thái tài khoản</label>
                            <div className="toggle-group">
                                {([true, false] as const).map(v => (
                                    <button key={String(v)} type="button"
                                        className={`toggle-option ${form.isActive === v ? 'selected' : ''} toggle-${v ? 'active' : 'inactive'}`}
                                        onClick={() => setForm(p => ({ ...p, isActive: v }))}>
                                        {v ? ' Hoạt động' : ' Đã khóa'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn-cancel" onClick={onClose}>Huỷ</button>
                    <motion.button className="btn-save" onClick={() => onSave(form)} disabled={saving}
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Lưu thay đổi
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
};

// ── PasswordModal ──────────────────────────────────────────────
const PasswordModal: React.FC<{ password: string; email: string; onClose: () => void }> = ({ password, email, onClose }) => {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(`Email: ${email}\nMật khẩu mới: ${password}`);
        setCopied(true); setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="modal-backdrop" onClick={onClose}>
            <motion.div className="modal modal-sm" onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.93 }} transition={{ duration: 0.22 }}>
                <div className="modal-header" style={{ background: 'linear-gradient(135deg,#7C3AED,#0891b2)', borderRadius: '14px 14px 0 0' }}>
                    <div className="modal-title-wrap">
                        <div className="modal-title-icon"><KeyRound size={20} /></div>
                        <div>
                            <h2 className="modal-title" style={{ color: '#fff' }}>Mật khẩu mới</h2>
                            <p className="modal-subtitle" style={{ color: 'rgba(255,255,255,.75)' }}>Sao chép và gửi cho người dùng</p>
                        </div>
                    </div>
                    <button className="modal-close" onClick={onClose} style={{ color: '#fff' }}><X size={18} /></button>
                </div>
                <div className="modal-body">
                    <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', margin: '8px 0 12px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 }}>Mật khẩu tạm thời</span>
                        <p style={{ fontFamily: 'monospace', fontSize: 22, color: '#7C3AED', fontWeight: 700, marginTop: 6, letterSpacing: 3 }}>{password}</p>
                    </div>
                    <p style={{ fontSize: 12, color: '#94a3b8' }}>💡 Người dùng nên đổi mật khẩu ngay sau khi đăng nhập.</p>
                </div>
                <div className="modal-footer">
                    <motion.button className="btn-save" style={{ background: 'linear-gradient(135deg,#7C3AED,#0891b2)' }}
                        onClick={copy} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        {copied ? <><CheckCircle2 size={15} /> Đã sao chép!</> : <><Copy size={15} /> Sao chép</>}
                    </motion.button>
                    <button className="btn-cancel" onClick={onClose}>Đóng</button>
                </div>
            </motion.div>
        </div>
    );
};

// ── Delete Confirm ─────────────────────────────────────────────
const DeleteConfirm: React.FC<{ user: UserDoc; onConfirm: () => void; onClose: () => void }> = ({ user, onConfirm, onClose }) => (
    <div className="modal-backdrop" onClick={onClose}>
        <motion.div className="modal modal-sm" onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.93 }} transition={{ duration: 0.2 }}>
            <div className="delete-confirm">
                <div className="delete-icon"><AlertTriangle size={28} /></div>
                <h3>Xác nhận xoá tài khoản</h3>
                <p>Bạn có chắc muốn xoá tài khoản <strong>{user.fullName}</strong>?<br />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{user.email}</span><br />Hành động này không thể khôi phục.</p>
                <div className="modal-footer">
                    <button className="btn-cancel" onClick={onClose}>Huỷ</button>
                    <button className="btn-delete" onClick={onConfirm}><Trash2 size={15} /> Xoá tài khoản</button>
                </div>
            </div>
        </motion.div>
    </div>
);

// ── Main Page ──────────────────────────────────────────────────
const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<UserDoc[]>([]);
    const [buses, setBuses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [page, setPage] = useState(1);
    const [editUser, setEditUser] = useState<UserDoc | null>(null);
    const [delUser, setDelUser] = useState<UserDoc | null>(null);
    const [newPassword, setNewPassword] = useState<{ pw: string; email: string } | null>(null);

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        toast[type](text);
    };

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (filterRole) params.role = filterRole;
            if (search) params.search = search;
            const res = await userAPI.getAll(params);
            const filteredUsers = (res.data.data as UserDoc[]).filter(u => u.role !== 'Admin');
            setUsers(filteredUsers);

            try {
                const busRes = await busAPI.getAll();
                setBuses(busRes.data.data);
            } catch (e) {
                // silent
            }
        } catch {
            showToast(' Không thể tải danh sách tài khoản', 'error');
        } finally { setLoading(false); }
    }, [filterRole, search]);

    useEffect(() => { fetch(); }, [fetch]);

    // Phân trang client-side (không cần filter thêm vì đã filter ở server)
    const totalPages = Math.ceil(users.length / PAGE_SZ);
    const paged = users.slice((page - 1) * PAGE_SZ, page * PAGE_SZ);

    const handleSave = async (data: Partial<UserDoc>) => {
        if (!editUser) return;
        setSaving(true);
        try {
            await userAPI.update(editUser._id, data);
            showToast(`Đã cập nhật ${editUser.fullName}`);
            setEditUser(null); await fetch();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Lỗi cập nhật';
            showToast(`${msg}`, 'error');
        } finally { setSaving(false); }
    };

    const handleReset = async (u: UserDoc) => {
        try {
            const res = await userAPI.resetPassword(u._id);
            setNewPassword({ pw: res.data.newPassword, email: u.email });
            showToast(`Đã reset mật khẩu cho ${u.fullName}`);
        } catch {
            showToast('Không thể reset mật khẩu', 'error');
        }
    };

    const handleToggleActive = async (u: UserDoc) => {
        try {
            await userAPI.update(u._id, { isActive: !u.isActive });
            showToast(u.isActive ? `Đã khóa ${u.fullName}` : `Đã mở khóa ${u.fullName}`);
            await fetch();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Lỗi';
            showToast(`${msg}`, 'error');
        }
    };

    const handleDelete = async () => {
        if (!delUser) return;
        try {
            await userAPI.remove(delUser._id);
            showToast(`Đã xoá ${delUser.fullName}`);
            setDelUser(null); await fetch();
        } catch {
            showToast('Không thể xoá tài khoản', 'error');
        }
    };

    const handleTestTelegramAdmin = async (u: UserDoc) => {
        try {
            await userAPI.testTelegramAdmin(u._id);
            showToast(`Đã gửi tin nhắn test đến Telegram của ${u.fullName}`);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Lỗi gửi tin test';
            showToast(`${msg}`, 'error');
        }
    };

    // Thống kê theo role
    const stats = useMemo(() => ({
        total: users.length,
        parent: users.filter(u => u.role === 'Parent').length,
        driver: users.filter(u => u.role === 'Driver').length,
    }), [users]);

    // Map tài xế -> biển số xe
    const driverBuses = useMemo(() => {
        const map: Record<string, string> = {};
        buses.forEach(b => {
            if (b.driver_id && b.driver_id._id) {
                map[b.driver_id._id] = b.licensePlate;
            } else if (b.driver_id && typeof b.driver_id === 'string') {
                map[b.driver_id] = b.licensePlate;
            }
        });
        return map;
    }, [buses]);

    return (
        <div className="crud-page">

            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Quản lý tài khoản</h1>
                    <p className="page-subtitle">
                        {loading ? 'Đang tải...' : `${stats.total} tài khoản · ${stats.parent} Phụ huynh · ${stats.driver} Tài xế`}
                    </p>
                </div>
                <button className="btn-filter" onClick={fetch} title="Làm mới"><RefreshCw size={15} /></button>
            </div>

            {/* Stats cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
                {[
                    { label: 'Tổng tài khoản', value: stats.total, color: '#6366F1', icon: Users },
                    { label: 'Phụ huynh', value: stats.parent, color: '#0891b2', icon: User },
                    { label: 'Tài xế', value: stats.driver, color: '#059669', icon: Bus },
                ].map(s => (
                    <motion.div key={s.label} className="card"
                        style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}
                        whileHover={{ y: -2 }} transition={{ duration: 0.2 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>
                            <s.icon size={20} />
                        </div>
                        <div>
                            <p style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</p>
                            <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>{s.label}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="crud-toolbar">
                <div className="crud-search-wrap">
                    <Search size={16} className="crud-search-icon" />
                    <input className="crud-search" placeholder="Tìm theo tên, email, SĐT..."
                        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
                    {search && <button className="crud-search-clear" onClick={() => setSearch('')}><X size={14} /></button>}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {['', 'Parent', 'Driver'].map(r => (
                        <button key={r}
                            className={`chip ${filterRole === r ? 'active' : ''}`}
                            onClick={() => { setFilterRole(r); setPage(1); }}>
                            {r || 'Tất cả'}
                        </button>
                    ))}
                </div>
                <span className="result-count">{users.length} tài khoản</span>
            </div>

            {/* Table */}
            <div className="card table-card">
                <div className="table-wrapper">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>STT</th>
                                <th>Họ tên</th>
                                <th>Email</th>
                                <th>Vai trò</th>
                                <th>SĐT</th>
                                <th>Telegram</th>
                                <th>Trạng thái</th>
                                <th>Ngày tạo</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            <AnimatePresence mode="popLayout">
                                {loading ? (
                                    <tr key="loading">
                                        <td colSpan={9} className="empty-row">
                                            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 8px' }} />
                                            Đang tải...
                                        </td>
                                    </tr>
                                ) : paged.length === 0 ? (
                                    <tr key="empty">
                                        <td colSpan={9} className="empty-row">
                                            <Users size={40} style={{ opacity: 0.3, display: 'block', margin: '0 auto 8px' }} />
                                            Không tìm thấy tài khoản nào
                                        </td>
                                    </tr>
                                ) : paged.map((u, idx) => {
                                    const rm = ROLE_META[u.role] ?? ROLE_META.Parent;
                                    const RoleIcon = rm.icon;
                                    return (
                                        <motion.tr key={u._id}
                                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, height: 0 }} layout
                                            transition={{ delay: idx * 0.03, duration: 0.22 }}
                                            onDoubleClick={() => setEditUser(u)}
                                            style={{ cursor: 'pointer' }}
                                            title="Click đúp để xem và chỉnh sửa chi tiết">
                                            <td className="row-num">{(page - 1) * PAGE_SZ + idx + 1}</td>
                                            <td>
                                                <div className="student-cell">
                                                    <div className="student-avatar" style={{ background: `${rm.color}22`, color: rm.color, overflow: 'hidden' }}>
                                                        {u.avatar ? (
                                                            <img src={getMediaUrl(u.avatar)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            u.fullName.split(' ').pop()?.charAt(0)
                                                        )}
                                                    </div>
                                                    <span className="student-name">{u.fullName}</span>
                                                </div>
                                            </td>
                                            <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{u.email}</td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                                                    <span style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                                        padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                                        background: `${rm.color}18`, color: rm.color,
                                                    }}>
                                                        <RoleIcon size={12} />{rm.label}
                                                    </span>
                                                    {u.role === 'Driver' && driverBuses[u._id] && (
                                                        <span style={{
                                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                                            padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
                                                            background: '#10B98115', color: '#059669',
                                                        }}>
                                                            <Bus size={10} /> Xe: {driverBuses[u._id]}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ fontSize: 13 }}>{u.phone ?? '—'}</td>
                                            <td>
                                                {u.telegram_chat_id
                                                    ? <span style={{ fontSize: 12, color: '#0891b2', fontFamily: 'monospace' }}>{u.telegram_chat_id}</span>
                                                    : <span style={{ color: '#cbd5e1', fontSize: 12 }}>Chưa liên kết</span>}
                                            </td>
                                            <td>
                                                <button title={u.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
                                                    onClick={() => handleToggleActive(u)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                                    {u.isActive
                                                        ? <ToggleRight size={24} color="#10b981" />
                                                        : <ToggleLeft size={24} color="#cbd5e1" />}
                                                </button>
                                            </td>
                                            <td style={{ fontSize: 12, color: '#94a3b8' }}>
                                                {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                                            </td>
                                            <td>
                                                <div className="action-btns">
                                                    {u.telegram_chat_id && (
                                                        <button className="action-btn" title="Gửi tin nhắn test Telegram"
                                                            style={{ color: '#059669', background: '#05966912' }}
                                                            onClick={() => handleTestTelegramAdmin(u)}>
                                                            <BellRing size={15} />
                                                        </button>
                                                    )}
                                                    <button className="action-btn edit" title="Sửa" onClick={() => setEditUser(u)}>
                                                        <Pencil size={15} />
                                                    </button>
                                                    <button className="action-btn" title="Reset mật khẩu"
                                                        style={{ color: '#7C3AED', background: '#7C3AED12' }}
                                                        onClick={() => handleReset(u)}>
                                                        <KeyRound size={15} />
                                                    </button>
                                                    <button className="action-btn delete" title="Xoá" onClick={() => setDelUser(u)}>
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="pagination">
                        <span className="pagination-info">Trang {page} / {totalPages} ({users.length} tài khoản)</span>
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

            {/* Modals */}
            <AnimatePresence>
                {editUser && <EditModal user={editUser} saving={saving} onSave={handleSave} onClose={() => setEditUser(null)} />}
                {delUser && <DeleteConfirm user={delUser} onConfirm={handleDelete} onClose={() => setDelUser(null)} />}
                {newPassword && <PasswordModal password={newPassword.pw} email={newPassword.email} onClose={() => setNewPassword(null)} />}
            </AnimatePresence>
        </div>
    );
};

export default UserManagement;
