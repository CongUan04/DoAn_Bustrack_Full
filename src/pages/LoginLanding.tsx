/**
 * LoginLanding.tsx – Trang chọn vai trò (Landing Page)
 * Cho phép người dùng chọn Admin / Phụ huynh / Tài xế trước khi đăng nhập
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Bus, ArrowRight, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Chỉ hiển thị 2 role công khai – Admin đăng nhập qua /admin
const roles = [
    {
        key: 'parent',
        label: 'Phụ huynh',
        desc: 'Theo dõi xe của con, xem điểm danh và lịch sử hành trình',
        icon: Users,
        color: '#10B981',
        colorDark: '#059669',
        bg: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #059669 100%)',
        badge: 'Parent',
        badgeColor: '#6EE7B7',
        path: '/login/parent',
        emoji: '👨‍👩‍👧',
    },
    {
        key: 'driver',
        label: 'Tài xế',
        desc: 'Điều khiển chuyến xe, quản lý điểm danh học sinh',
        icon: Bus,
        color: '#F59E0B',
        colorDark: '#D97706',
        bg: 'linear-gradient(135deg, #451a03 0%, #92400e 50%, #b45309 100%)',
        badge: 'Driver',
        badgeColor: '#FCD34D',
        path: '/login/driver',
        emoji: '🚌',
    },
];

const LoginLanding: React.FC = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();

    // Nếu đã đăng nhập thì redirect về trang chính
    if (isAuthenticated) {
        const home = user?.role === 'admin' ? '/dashboard' : user?.role === 'driver' ? '/driver' : '/parent';
        navigate(home, { replace: true });
        return null;
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #0f172a 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Background Grid */}
            <div style={{
                position: 'absolute', inset: 0, opacity: 0.04,
                backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                pointerEvents: 'none',
            }} />

            {/* Glow blobs */}
            <div style={{ position: 'absolute', top: '20%', left: '15%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '15%', right: '10%', width: 350, height: 350, background: 'radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1000 }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    style={{ textAlign: 'center', marginBottom: 60 }}
                >
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 14,
                        background: 'rgba(59,130,246,0.15)',
                        border: '1px solid rgba(59,130,246,0.3)',
                        borderRadius: 20, padding: '10px 20px', marginBottom: 28,
                    }}>
                        <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: 'linear-gradient(135deg, #3B82F6, #60A5FA)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 16px rgba(59,130,246,0.4)',
                        }}>
                            <MapPin size={22} color="white" />
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}>BusTrack</p>
                            <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.5px' }}>Hệ thống theo dõi xe đưa đón</p>
                        </div>
                    </div>

                    <h1 style={{ margin: '0 0 12px', fontSize: 38, fontWeight: 800, color: 'white', letterSpacing: '-1px', lineHeight: 1.15 }}>
                        Xin chào! 👋
                    </h1>
                    <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 500, margin: '0 auto' }}>
                        Chọn vai trò của bạn để tiếp tục đăng nhập
                    </p>
                </motion.div>

                {/* Role Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: 20,
                    marginBottom: 40,
                }}>
                    {roles.map((role, i) => (
                        <motion.div
                            key={role.key}
                            initial={{ opacity: 0, y: 40 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                            whileHover={{ y: -8, scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate(role.path)}
                            style={{
                                cursor: 'pointer',
                                background: 'rgba(255,255,255,0.04)',
                                backdropFilter: 'blur(20px)',
                                border: '1px solid rgba(255,255,255,0.10)',
                                borderRadius: 24,
                                padding: '32px 28px',
                                position: 'relative',
                                overflow: 'hidden',
                                transition: 'border-color 0.3s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = `${role.color}60`)}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
                        >
                            {/* Card gradient glow */}
                            <div style={{
                                position: 'absolute', inset: 0, opacity: 0,
                                background: `radial-gradient(ellipse at top left, ${role.color}20, transparent 60%)`,
                                transition: 'opacity 0.3s',
                            }} />

                            {/* Top stripe */}
                            <div style={{
                                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                                background: `linear-gradient(90deg, ${role.color}, ${role.colorDark})`,
                                borderRadius: '24px 24px 0 0',
                            }} />

                            {/* Badge */}
                            <div style={{
                                position: 'absolute', top: 18, right: 18,
                                fontSize: 10, fontWeight: 700, letterSpacing: '0.8px',
                                padding: '3px 10px', borderRadius: 20,
                                background: `${role.color}20`,
                                color: role.badgeColor,
                                border: `1px solid ${role.color}40`,
                                textTransform: 'uppercase',
                            }}>
                                {role.badge}
                            </div>

                            {/* Icon */}
                            <div style={{
                                width: 64, height: 64, borderRadius: 18,
                                background: `linear-gradient(135deg, ${role.color}30, ${role.colorDark}20)`,
                                border: `1px solid ${role.color}40`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                marginBottom: 20, fontSize: 28,
                            }}>
                                <span>{role.emoji}</span>
                            </div>

                            {/* Text */}
                            <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: 'white' }}>
                                {role.label}
                            </h3>
                            <p style={{ margin: '0 0 24px', fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                                {role.desc}
                            </p>

                            {/* CTA */}
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 8,
                                fontSize: 13, fontWeight: 700,
                                color: role.badgeColor,
                            }}>
                                <span>Đăng nhập ngay</span>
                                <ArrowRight size={15} />
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Footer */}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.2)', margin: 0 }}
                >
                    © 2026 BusTrack · Hệ thống Quản lý Xe Đưa đón Học sinh · Phiên bản 2.0
                </motion.p>
            </div>
        </div>
    );
};

export default LoginLanding;
