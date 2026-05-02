/**
 * TelegramSettings.tsx
 * Component cho Phụ huynh liên kết Telegram để nhận thông báo điểm danh.
 * Dùng trong trang Settings / ParentView.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, CheckCircle2, Loader2,
    MessageCircle, Copy, ExternalLink, ShieldCheck, Trash2, BellRing,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { userAPI } from '../services/api';

// ── Tên Bot Telegram của nhà trường ──────────────────────────────────────────
const BOT_NAME = 'BusTrackSchoolBot';
const BOT_URL  = `https://t.me/${BOT_NAME}`;

// ── Types ─────────────────────────────────────────────────────────────────────
interface TelegramSettingsProps {
    /** Chat ID hiện tại từ user profile (nếu đã liên kết) */
    currentChatId?: string | null;
    /** Callback khi lưu thành công để cập nhật state cha */
    onSaved?: (newChatId: string | null) => void;
}

// ── Component chính ───────────────────────────────────────────────────────────
const TelegramSettings: React.FC<TelegramSettingsProps> = ({ currentChatId, onSaved }) => {
    const [chatId, setChatId]     = useState(currentChatId ?? '');
    const [loading, setLoading]   = useState(false);
    const [copied, setCopied]     = useState(false);

    const isLinked  = !!currentChatId;
    const isChanged = chatId.trim() !== (currentChatId ?? '');
    const showToast = (msg: string, type: 'success' | 'error') => {
        toast[type](msg);
    };

    // ── Sao chép lệnh /myid ────────────────────────────────────
    const copyCommand = () => {
        navigator.clipboard.writeText('/myid');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // ── Validate đơn giản ──────────────────────────────────────
    const validate = (): string | null => {
        const val = chatId.trim();
        if (!val) return null; // cho phép để trống (gỡ liên kết)
        if (!/^\d+$/.test(val)) return 'Chat ID chỉ được chứa các chữ số (VD: 5614436258)';
        if (val.length < 5 || val.length > 15) return 'Chat ID thường có từ 5-15 chữ số';
        return null;
    };

    // ── Gửi API ────────────────────────────────────────────────
    const handleSave = async () => {
        const err = validate();
        if (err) { showToast(err, 'error'); return; }

        setLoading(true);
        try {
            const res = await userAPI.updateTelegram(chatId.trim());
            showToast(res.data?.message ?? 'Đã lưu thành công!', 'success');
            onSaved?.(chatId.trim() || null);
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } })
                ?.response?.data?.message ?? 'Lỗi kết nối, vui lòng thử lại.';
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── Gỡ liên kết ───────────────────────────────────────────
    const handleUnlink = async () => {
        setLoading(true);
        try {
            const res = await userAPI.updateTelegram('');
            setChatId('');
            showToast(res.data?.message ?? 'Đã gỡ liên kết Telegram.', 'success');
            onSaved?.(null);
        } catch {
            showToast('Không thể gỡ liên kết, vui lòng thử lại.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // ── Gửi tin nhắn test ──────────────────────────────────────
    const handleTestMessage = async () => {
        setLoading(true);
        try {
            const res = await userAPI.testTelegram();
            showToast(res.data?.message ?? 'Đã gửi tin thử nghiệm!', 'success');
        } catch (e: unknown) {
            const msg = (e as { response?: { data?: { message?: string } } })
                ?.response?.data?.message ?? 'Lỗi khi gửi, vui lòng thử lại.';
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ position: 'relative' }}>
            {/* ── Card chính ────────────────────────────────────── */}
            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                style={{
                    background: '#fff',
                    borderRadius: 16,
                    border: '1.5px solid #e2e8f0',
                    overflow: 'hidden',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                }}
            >
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #0088cc 0%, #229ed9 100%)',
                    padding: '20px 24px',
                    display: 'flex', alignItems: 'center', gap: 14,
                }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: 'rgba(255,255,255,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <MessageCircle size={24} color="#fff" />
                    </div>
                    <div>
                        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 }}>
                            Nhận thông báo qua Telegram
                        </h3>
                        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, margin: '3px 0 0' }}>
                            Điểm danh lên/xuống xe — gửi ngay lập tức
                        </p>
                    </div>
                    {isLinked && (
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
                            background: 'rgba(255,255,255,0.2)', padding: '5px 12px',
                            borderRadius: 20, color: '#fff', fontSize: 12, fontWeight: 600 }}>
                            <ShieldCheck size={14} /> Đã liên kết
                        </div>
                    )}
                </div>

                <div style={{ padding: '24px' }}>

                    {/* ── Hướng dẫn 3 bước ──────────────────────── */}
                    <div style={{
                        background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)',
                        border: '1.5px solid #bae6fd',
                        borderRadius: 12,
                        padding: '18px 20px',
                        marginBottom: 20,
                    }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#0369a1',
                            textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
                            📋 Hướng dẫn thiết lập
                        </p>

                        {/* Step 1 */}
                        <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                            <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                                background: '#0088cc', color: '#fff', fontSize: 12, fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                                1
                            </span>
                            <div>
                                <p style={{ fontSize: 13, color: '#1e40af', fontWeight: 600, margin: '0 0 3px' }}>
                                    Mở Telegram và tìm bot của chúng tôi
                                </p>
                                <a
                                    href={BOT_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5,
                                        color: '#0088cc', fontSize: 13, fontWeight: 600,
                                        textDecoration: 'none', background: '#fff',
                                        padding: '4px 10px', borderRadius: 8,
                                        border: '1px solid #bae6fd' }}
                                >
                                    <Send size={13} /> @{BOT_NAME}
                                    <ExternalLink size={11} />
                                </a>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                            <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                                background: '#0088cc', color: '#fff', fontSize: 12, fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                                2
                            </span>
                            <div>
                                <p style={{ fontSize: 13, color: '#1e40af', fontWeight: 600, margin: '0 0 4px' }}>
                                    Nhấn <strong>/start</strong> hoặc gõ lệnh <strong>/myid</strong>
                                </p>
                                <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                                    Bot sẽ gửi lại một dãy số gọi là <strong>Chat ID</strong> của bạn.
                                </p>
                                <button onClick={copyCommand} style={{
                                    marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5,
                                    background: copied ? '#ecfdf5' : '#fff', color: copied ? '#059669' : '#0088cc',
                                    border: `1px solid ${copied ? '#6ee7b7' : '#bae6fd'}`,
                                    padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                                    fontSize: 12, fontWeight: 600, transition: 'all 0.2s',
                                }}>
                                    {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                                    {copied ? 'Đã sao chép!' : 'Copy lệnh /myid'}
                                </button>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <span style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                                background: '#0088cc', color: '#fff', fontSize: 12, fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                                3
                            </span>
                            <p style={{ fontSize: 13, color: '#1e40af', fontWeight: 600, margin: '3px 0 0', lineHeight: 1.5 }}>
                                Sao chép dãy số đó và dán vào ô bên dưới, rồi nhấn <strong>Lưu thay đổi</strong>.
                            </p>
                        </div>
                    </div>

                    {/* ── Chat ID hiện tại (nếu đã liên kết) ──────── */}
                    <AnimatePresence>
                        {isLinked && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                style={{
                                    background: '#ecfdf5', border: '1.5px solid #6ee7b7',
                                    borderRadius: 10, padding: '10px 14px',
                                    marginBottom: 14, display: 'flex',
                                    alignItems: 'center', justifyContent: 'space-between',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <CheckCircle2 size={16} color="#059669" />
                                    <span style={{ fontSize: 13, color: '#065f46', fontWeight: 500 }}>
                                        Đang liên kết Chat ID:&nbsp;
                                        <strong style={{ fontFamily: 'monospace', fontSize: 14 }}>
                                            {currentChatId}
                                        </strong>
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <button
                                        onClick={handleTestMessage}
                                        disabled={loading}
                                        title="Gửi tin nhắn test"
                                        style={{
                                            background: '#059669', border: 'none', cursor: 'pointer',
                                            color: '#fff', padding: '6px 12px', borderRadius: 8,
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            fontSize: 12, fontWeight: 600,
                                            boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
                                            opacity: loading ? 0.7 : 1, transition: 'all 0.2s',
                                        }}
                                    >
                                        <BellRing size={13} /> Gửi tin thử
                                    </button>
                                    <button
                                        onClick={handleUnlink}
                                        disabled={loading}
                                        title="Gỡ liên kết Telegram"
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            color: '#dc2626', padding: '6px 8px', borderRadius: 6,
                                            display: 'flex', alignItems: 'center', gap: 4,
                                            fontSize: 12, fontWeight: 600,
                                            opacity: loading ? 0.5 : 1, transition: 'all 0.2s',
                                        }}
                                    >
                                        <Trash2 size={13} /> Gỡ liên kết
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Input + Nút lưu ──────────────────────────── */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                            <MessageCircle
                                size={16}
                                style={{
                                    position: 'absolute', left: 14, top: '50%',
                                    transform: 'translateY(-50%)', color: '#94a3b8',
                                    pointerEvents: 'none',
                                }}
                            />
                            <input
                                id="telegram-chat-id-input"
                                type="text"
                                inputMode="numeric"
                                placeholder="Nhập Telegram Chat ID của bạn..."
                                value={chatId}
                                onChange={e => setChatId(e.target.value.replace(/\D/g, ''))}
                                style={{
                                    width: '100%',
                                    padding: '11px 14px 11px 40px',
                                    borderRadius: 10,
                                    border: '1.5px solid #e2e8f0',
                                    fontSize: 14,
                                    fontFamily: chatId ? 'monospace' : 'inherit',
                                    fontWeight: chatId ? 600 : 400,
                                    color: '#0f172a',
                                    outline: 'none',
                                    transition: 'border-color 0.2s, box-shadow 0.2s',
                                    boxSizing: 'border-box',
                                }}
                                onFocus={e => {
                                    e.target.style.borderColor = '#0088cc';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(0,136,204,0.12)';
                                }}
                                onBlur={e => {
                                    e.target.style.borderColor = '#e2e8f0';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>

                        <motion.button
                            id="telegram-save-btn"
                            onClick={handleSave}
                            disabled={loading || !isChanged}
                            whileHover={{ scale: loading || !isChanged ? 1 : 1.02 }}
                            whileTap={{ scale: loading || !isChanged ? 1 : 0.97 }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 7,
                                padding: '11px 20px',
                                borderRadius: 10, border: 'none',
                                cursor: loading || !isChanged ? 'not-allowed' : 'pointer',
                                fontSize: 14, fontWeight: 600,
                                whiteSpace: 'nowrap',
                                background: loading || !isChanged
                                    ? '#e2e8f0'
                                    : 'linear-gradient(135deg, #0088cc, #229ed9)',
                                color: loading || !isChanged ? '#94a3b8' : '#fff',
                                boxShadow: loading || !isChanged
                                    ? 'none'
                                    : '0 4px 12px rgba(0,136,204,0.35)',
                                transition: 'background 0.2s, color 0.2s, box-shadow 0.2s',
                            }}
                        >
                            {loading
                                ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Đang lưu...</>
                                : <><Send size={15} /> Lưu thay đổi</>
                            }
                        </motion.button>
                    </div>

                    {/* Gợi ý */}
                    <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 8, lineHeight: 1.5 }}>
                        💡 Chat ID chỉ gồm chữ số. Input đã tự lọc ký tự không hợp lệ.{' '}
                        {!isLinked && 'Chưa liên kết — thông báo sẽ không gửi đến bạn.'}
                    </p>

                </div>
            </motion.div>
        </div>
    );
};

export default TelegramSettings;
