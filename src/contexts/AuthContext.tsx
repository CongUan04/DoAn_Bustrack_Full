import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User, UserRole } from '../types/index';
import { authAPI } from '../services/api';

interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; role?: UserRole; error?: string }>;
    logout: () => void;
    updateUser: (updated: Partial<User>) => void;
    token: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Khôi phục user + token từ localStorage khi reload
    const [user, setUser] = useState<User | null>(() => {
        const stored = localStorage.getItem('bustrack_user');
        return stored ? JSON.parse(stored) : null;
    });
    const [token, setToken] = useState<string | null>(() =>
        localStorage.getItem('bustrack_token')
    );

    // ── Login: gọi real API ───────────────────────────────────
    const login = useCallback(async (email: string, password: string) => {
        try {
            const res = await authAPI.login(email, password);
            const { data: payload } = res.data as {
                success: boolean;
                data: {
                    _id: string;
                    fullName: string;
                    email: string;
                    username?: string;
                    role: string;
                    phone?: string;
                    isEmailSet?: boolean;
                    telegramChatId?: string;
                    token: string;
                };
            };

            // Map backend role (Admin/Parent/Driver) → frontend role (admin/parent/driver)
            const roleMap: Record<string, UserRole> = {
                Admin: 'admin',
                Parent: 'parent',
                Driver: 'driver',
            };
            const mappedRole: UserRole = roleMap[payload.role] ?? 'parent';

            const userObj: User = {
                id: payload._id,
                username: payload.username ?? payload.email,
                email: payload.email,
                fullName: payload.fullName,
                role: mappedRole,
                isEmailSet: payload.isEmailSet ?? true,
                telegramChatId: payload.telegramChatId,
            };

            // Lưu vào state + localStorage
            setUser(userObj);
            setToken(payload.token);
            localStorage.setItem('bustrack_user', JSON.stringify(userObj));
            localStorage.setItem('bustrack_token', payload.token);

            return { success: true, role: mappedRole };
        } catch (err: unknown) {
            return { success: false, error: 'Sai mật khẩu hoặc tên đăng nhập' };
        }
    }, []);

    // ── Cập nhật user trong state + localStorage (sau khi đổi profile) ──
    const updateUser = useCallback((updated: Partial<User>) => {
        setUser(prev => {
            if (!prev) return prev;
            const next = { ...prev, ...updated };
            localStorage.setItem('bustrack_user', JSON.stringify(next));
            return next;
        });
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('bustrack_user');
        localStorage.removeItem('bustrack_token');
    }, []);

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user && !!token, login, logout, updateUser, token }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};
