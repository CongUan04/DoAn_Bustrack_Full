import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Settings as SettingsIcon, Moon, Sun, Bell, Save, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [notifications, setNotifications] = useState(true);
    const [sound, setSound] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Load initial settings
        const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'light';
        const savedNotif = localStorage.getItem('notifications') !== 'false';
        const savedSound = localStorage.getItem('sound') !== 'false';
        
        setTheme(savedTheme);
        setNotifications(savedNotif);
        setSound(savedSound);
    }, [isOpen]);

    const handleSave = () => {
        setSaving(true);
        setTimeout(() => {
            localStorage.setItem('notifications', String(notifications));
            localStorage.setItem('sound', String(sound));

            toast.success('Đã lưu cài đặt', { autoClose: 2000 });
            setSaving(false);
            onClose();
        }, 600);
    };

    const handleThemeChange = (newTheme: 'light' | 'dark') => {
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark-theme');
        } else {
            document.documentElement.classList.remove('dark-theme');
        }
    };

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999, position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <motion.div 
                        className="modal modal-md" 
                        onClick={e => e.stopPropagation()}
                        initial={{ opacity: 0, scale: 0.93, y: 20 }} 
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.93, y: 20 }} 
                        transition={{ duration: 0.25 }}
                        style={{ background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 450, overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}
                    >
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <SettingsIcon size={20} />
                                </div>
                                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Cài đặt hệ thống</h2>
                            </div>
                            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}>
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
                            {/* Giao diện */}
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Giao diện</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                    {[
                                        { id: 'light', icon: <Sun size={18} />, label: 'Sáng' },
                                        { id: 'dark', icon: <Moon size={18} />, label: 'Tối' }
                                    ].map(t => (
                                        <div 
                                            key={t.id}
                                            onClick={() => handleThemeChange(t.id as 'light' | 'dark')}
                                            style={{ 
                                                border: `2px solid ${theme === t.id ? '#3B82F6' : 'var(--border)'}`,
                                                background: theme === t.id ? 'rgba(59,130,246,0.1)' : 'var(--surface)',
                                                borderRadius: 12, padding: '12px', cursor: 'pointer',
                                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ color: theme === t.id ? '#3B82F6' : 'var(--text-secondary)' }}>{t.icon}</div>
                                            <span style={{ fontSize: 13, fontWeight: 600, color: theme === t.id ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{t.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Thông báo */}
                            <div>
                                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Thông báo</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface-hover)', borderRadius: 12, border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ color: '#3B82F6' }}><Bell size={18} /></div>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Thông báo đẩy</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Nhận thông báo khi có sự kiện mới</div>
                                            </div>
                                        </div>
                                        <div 
                                            onClick={() => setNotifications(!notifications)}
                                            style={{ 
                                                width: 44, height: 24, borderRadius: 12, background: notifications ? '#10B981' : '#cbd5e1', 
                                                position: 'relative', cursor: 'pointer', transition: 'background 0.3s' 
                                            }}
                                        >
                                            <div style={{ 
                                                width: 20, height: 20, borderRadius: '50%', background: 'white', 
                                                position: 'absolute', top: 2, left: notifications ? 22 : 2, 
                                                transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
                                            }} />
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--surface-hover)', borderRadius: 12, border: '1px solid var(--border)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{ color: '#8B5CF6' }}>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Âm thanh</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Phát âm thanh khi có cảnh báo SOS</div>
                                            </div>
                                        </div>
                                        <div 
                                            onClick={() => setSound(!sound)}
                                            style={{ 
                                                width: 44, height: 24, borderRadius: 12, background: sound ? '#10B981' : '#cbd5e1', 
                                                position: 'relative', cursor: 'pointer', transition: 'background 0.3s' 
                                            }}
                                        >
                                            <div style={{ 
                                                width: 20, height: 20, borderRadius: '50%', background: 'white', 
                                                position: 'absolute', top: 2, left: sound ? 22 : 2, 
                                                transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
                                            }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--surface-hover)' }}>
                            <button onClick={onClose} style={{ padding: '10px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                                Hủy bỏ
                            </button>
                            <button onClick={handleSave} disabled={saving} style={{ padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'white', background: '#3B82F6', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                                {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                                Lưu cài đặt
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
};

export default SettingsModal;
