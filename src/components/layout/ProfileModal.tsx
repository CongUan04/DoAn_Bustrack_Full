import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, User, Mail, Lock, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../services/api';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth(); // login function update the user context usually? Wait, useAuth might have a refresh or update.
    
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && user) {
            setFullName(user.fullName || '');
            setEmail(user.email || '');
            setCurrentPassword('');
            setNewPassword('');
        }
    }, [isOpen, user]);

    const showToast = (text: string, type: 'success' | 'error' = 'success') => {
        toast[type](text);
    };

    const handleSave = async () => {
        if (!email.trim() || !fullName.trim()) {
            showToast('Vui lòng nhập đầy đủ họ tên và email', 'error');
            return;
        }

        setSaving(true);
        try {
            const data: any = { email };
            if (newPassword) {
                if (!currentPassword) {
                    showToast('Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu mới', 'error');
                    setSaving(false);
                    return;
                }
                data.currentPassword = currentPassword;
                data.newPassword = newPassword;
            }

            const res = await authAPI.updateProfile(data);
            showToast('Cập nhật hồ sơ thành công', 'success');
            
            // Cập nhật lại context user bằng cách reload hoặc lưu token mới
            if (res.data.data.token) {
                localStorage.setItem('bustrack_token', res.data.data.token);
            }
            localStorage.setItem('bustrack_user', JSON.stringify(res.data.data));
            
            // Reload page to reflect changes in layout after 1s
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (err: any) {
            const msg = err.response?.data?.message || 'Lỗi cập nhật hồ sơ';
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
                    <motion.div 
                        className="modal modal-md" 
                        onClick={e => e.stopPropagation()}
                    initial={{ opacity: 0, scale: 0.93, y: 20 }} 
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.93, y: 20 }} 
                    transition={{ duration: 0.25 }}
                    style={{ maxWidth: 500 }}
                >

                    <div className="modal-header">
                        <div className="modal-title-wrap">
                            <div className="modal-title-icon"><User size={20} /></div>
                            <div>
                                <h2 className="modal-title">Hồ sơ cá nhân</h2>
                            </div>
                        </div>
                        <button className="modal-close" onClick={onClose}><X size={18} /></button>
                    </div>

                    <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                        <div className="modal-grid">
                            <div className="form-group form-group-full">
                                <label className="form-label">Họ và tên</label>
                                <div className="input-with-icon">
                                    <User size={16} className="input-icon" />
                                    <input 
                                        className="form-field has-icon" 
                                        value={user?.fullName || ''}
                                        readOnly
                                        disabled
                                        style={{ paddingLeft: 38, background: '#f8fafc', color: '#94a3b8', cursor: 'not-allowed' }}
                                    />
                                </div>
                            </div>

                            <div className="form-group form-group-full">
                                <label className="form-label">Email</label>
                                <div className="input-with-icon">
                                    <Mail size={16} className="input-icon" />
                                    <input 
                                        type="email"
                                        className="form-field has-icon" 
                                        value={email}
                                        onChange={e => setEmail(e.target.value)} 
                                        style={{ paddingLeft: 38 }}
                                    />
                                </div>
                            </div>
                            
                            <div className="form-group form-group-full" style={{ marginTop: 10, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Lock size={16} /> Đổi mật khẩu
                                </h3>
                                
                                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                                    Để trống nếu bạn không muốn thay đổi mật khẩu.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div>
                                        <label className="form-label" style={{ fontSize: 12 }}>Mật khẩu hiện tại</label>
                                        <input 
                                            type="password"
                                            className="form-field" 
                                            placeholder="Nhập mật khẩu cũ..."
                                            value={currentPassword}
                                            onChange={e => setCurrentPassword(e.target.value)} 
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label" style={{ fontSize: 12 }}>Mật khẩu mới</label>
                                        <input 
                                            type="password"
                                            className="form-field" 
                                            placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)..."
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button className="btn-cancel" onClick={onClose}>Huỷ</button>
                        <motion.button 
                            className="btn-save" 
                            onClick={handleSave} 
                            disabled={saving}
                            whileHover={{ scale: 1.02 }} 
                            whileTap={{ scale: 0.98 }}
                        >
                            {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Cập nhật
                        </motion.button>
                    </div>
                </motion.div>
            </div>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
};

export default ProfileModal;
