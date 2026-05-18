/**
 * src/services/api.ts
 * Axios instance trung tâm — dùng cho tất cả API calls
 */
/// <reference types="vite/client" />
import axios from 'axios';

// Base URL: cố định gọi thẳng đến Render
const API_BASE = 'https://bustrack-backend-vq38.onrender.com/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' },
    timeout: 10000,
});

// ── Request interceptor: tự đính JWT vào header ───────────────
api.interceptors.request.use(config => {
    const token = localStorage.getItem('bustrack_token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ── Response interceptor: handle 401 tự động logout ──────────
api.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401 && err.config && err.config.url !== '/auth/login') {
            localStorage.removeItem('bustrack_token');
            localStorage.removeItem('bustrack_user');
            window.location.href = '/login';
        }
        return Promise.reject(err);
    }
);

export default api;

// ── Auth ──────────────────────────────────────────────────────
export const authAPI = {
    login: (email: string, password: string) =>
        api.post('/auth/login', { email, password }),
    getMe: () =>
        api.get('/auth/me'),
    updateProfile: (data: { fullName?: string; email?: string; currentPassword?: string; newPassword?: string }) =>
        api.put('/auth/profile', data),
    forgotPassword: (identity: string) =>
        api.post('/auth/forgot-password', { identity }),
    verifyOtp: (identity: string, otp: string) =>
        api.post('/auth/verify-otp', { identity, otp }),
    resetPassword: (identity: string, otp: string, newPassword: string) =>
        api.post('/auth/reset-password', { identity, otp, newPassword }),
};

// ── Dashboard ─────────────────────────────────────────────────
export const dashboardAPI = {
    getStats: () =>
        api.get('/dashboard/stats'),
};

// ── Students ──────────────────────────────────────────────────
export const studentAPI = {
    getAll: (params?: Record<string, string>) => api.get('/students', { params }),
    getById: (id: string) => api.get(`/students/${id}`),
    getMyChildren: () => api.get('/students/my-children'),
    create: (data: unknown) => api.post('/students', data),
    update: (id: string, data: unknown) => api.put(`/students/${id}`, data),
    remove: (id: string) => api.delete(`/students/${id}`),
    markAbsent: (id: string, reason?: string) => api.put(`/students/${id}/absent`, { reason }),
    updateStudyDays: (id: string, studyDays: number[]) => api.put(`/students/${id}/study-days`, { studyDays }),
};

// ── Attendance ────────────────────────────────────────────────
export const attendanceAPI = {
    getLogs: (params?: Record<string, string>) => api.get('/attendance', { params }),
    getKpi: () => api.get('/attendance/kpi'),
    getBusStudentsToday: (busId: string) => api.get(`/attendance/bus/${busId}/today`),
};

// ── Alerts ────────────────────────────────────────────────────
export const alertAPI = {
    getAll: (params?: Record<string, string>) => api.get('/alerts', { params }),
    acknowledge: (id: string) => api.patch(`/alerts/${id}/acknowledge`),
    acknowledgeAll: () => api.patch('/alerts/acknowledge-all'),
    createAlert: (data: { type: string; message: string; severity?: string }) =>
        api.post('/alerts', data),
};


// ── Buses ─────────────────────────────────────────────────────
export const busAPI = {
    getAll: (params?: Record<string, string>) => api.get('/buses', { params }),
    getById: (id: string) => api.get(`/buses/${id}`),
    create: (data: { licensePlate: string; name?: string; device_mac_address?: string; capacity?: number }) =>
        api.post('/buses', data),
    update: (id: string, data: { licensePlate?: string; name?: string; device_mac_address?: string; capacity?: number }) =>
        api.patch(`/buses/${id}`, data),
    updateLocation: (id: string, data: { lat: number; lng: number; speed?: number; heading?: number }) =>
        api.patch(`/buses/${id}/location`, data),
};

// ── Routes ────────────────────────────────────────────────────
export const routeAPI = {
    getAll: () => api.get('/routes'),
    getById: (id: string) => api.get(`/routes/${id}`),
    create: (data: unknown) => api.post('/routes', data),
    update: (id: string, data: unknown) => api.put(`/routes/${id}`, data),
    remove: (id: string) => api.delete(`/routes/${id}`),
};

// ── Users (Admin only) ────────────────────────────────────────
export const userAPI = {
    getAll: (params?: Record<string, string>) => api.get('/users', { params }),
    getById: (id: string) => api.get(`/users/${id}`),
    update: (id: string, data: unknown) => api.put(`/users/${id}`, data),
    resetPassword: (id: string) => api.post(`/users/${id}/reset-password`),
    remove: (id: string) => api.delete(`/users/${id}`),
    // Phụ huynh tự cập nhật Telegram Chat ID của mình
    updateTelegram: (telegramChatId: string) =>
        api.patch('/users/update-telegram', { telegramChatId }),
    // Phụ huynh gửi tin nhắn test Telegram
    testTelegram: () =>
        api.post('/users/test-telegram'),
    // Admin gửi tin nhắn test tới một user
    testTelegramAdmin: (id: string) =>
        api.post(`/users/${id}/test-telegram`),
};

