import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layouts (tách biệt theo role)
import AdminLayout from './components/layout/AdminLayout';
import ParentLayout from './components/layout/ParentLayout';
import DriverLayout from './components/layout/DriverLayout';

// Pages – Admin (tất cả prefix /admin/)
import Dashboard from './pages/Dashboard';
import LiveMap from './pages/LiveMap';
import StudentManagement from './pages/StudentManagement';
import AttendancePage from './pages/AttendancePage';
import AlertsPage from './pages/AlertsPage';
import RouteManagement from './pages/RouteManagement';
import BusManagement from './pages/BusManagement';
import UserManagement from './pages/UserManagement';

// Pages – Role-specific
import ParentView from './pages/ParentView';
import DriverView from './pages/DriverView';

// Auth – Tách riêng theo role
import LoginLanding from './pages/LoginLanding';   // / (public: parent + driver)
import AdminLogin from './pages/AdminLogin';         // /admin (ẩn, chỉ admin biết)
import ParentLogin from './pages/ParentLogin';       // /login/parent
import DriverLogin from './pages/DriverLogin';       // /login/driver

// ── Guard cho Admin ───────────────────────────────────────────
// Chặn truy cập /admin/* nếu chưa đăng nhập hoặc không phải admin
const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, user } = useAuth();
    if (!isAuthenticated) return <Navigate to="/admin" replace />;
    if (user?.role !== 'admin') return <Navigate to="/" replace />;
    return <>{children}</>;
};

const AppRoutes: React.FC = () => {
    const { isAuthenticated, user } = useAuth();

    // Home mặc định sau khi login
    const home = user?.role === 'admin'
        ? '/admin/dashboard'
        : user?.role === 'driver'
            ? '/driver'
            : '/parent';

    return (
        <Routes>
            {/* ══════════════════════════════════════════════════
                PUBLIC ROUTES – Phụ huynh & Tài xế
            ══════════════════════════════════════════════════ */}

            {/* / → Landing page (chọn Phụ huynh hoặc Tài xế) */}
            <Route
                path="/"
                element={
                    isAuthenticated
                        ? <Navigate to={home} replace />
                        : <LoginLanding />
                }
            />

            {/* /login/parent → Đăng nhập Phụ huynh */}
            <Route
                path="/login/parent"
                element={
                    isAuthenticated && user?.role === 'parent'
                        ? <Navigate to="/parent" replace />
                        : <ParentLogin />
                }
            />

            {/* /login/driver → Đăng nhập Tài xế */}
            <Route
                path="/login/driver"
                element={
                    isAuthenticated && user?.role === 'driver'
                        ? <Navigate to="/driver" replace />
                        : <DriverLogin />
                }
            />

            {/* ══════════════════════════════════════════════════
                ADMIN ROUTES – Ẩn hoàn toàn, chỉ biết URL mới vào
            ══════════════════════════════════════════════════ */}

            {/* /admin → Trang đăng nhập Admin (URL bí mật) */}
            <Route
                path="/admin"
                element={
                    isAuthenticated && user?.role === 'admin'
                        ? <Navigate to="/admin/dashboard" replace />
                        : <AdminLogin />
                }
            />

            {/* /admin/* → Tất cả trang quản trị (có guard bảo vệ) */}
            <Route
                element={
                    <RequireAdmin>
                        <AdminLayout />
                    </RequireAdmin>
                }
            >
                <Route path="/admin/dashboard" element={<Dashboard />} />
                <Route path="/admin/map"        element={<LiveMap />} />
                <Route path="/admin/attendance" element={<AttendancePage />} />
                <Route path="/admin/students"   element={<StudentManagement />} />
                <Route path="/admin/buses"      element={<BusManagement />} />
                <Route path="/admin/routes"     element={<RouteManagement />} />
                <Route path="/admin/alerts"     element={<AlertsPage />} />
                <Route path="/admin/users"      element={<UserManagement />} />
            </Route>

            {/* ══════════════════════════════════════════════════
                PARENT / DRIVER ROUTES
            ══════════════════════════════════════════════════ */}
            <Route element={<ParentLayout />}>
                <Route path="/parent" element={<ParentView />} />
            </Route>

            <Route element={<DriverLayout />}>
                <Route path="/driver" element={<DriverView />} />
            </Route>

            {/* /login cũ → redirect về / */}
            <Route path="/login" element={<Navigate to="/" replace />} />

            {/* Catch-all */}
            <Route
                path="*"
                element={<Navigate to={isAuthenticated ? home : '/'} replace />}
            />
        </Routes>
    );
};

const App: React.FC = () => {
    React.useEffect(() => {
        const theme = localStorage.getItem('theme');
        if (theme === 'dark') {
            document.documentElement.classList.add('dark-theme');
        } else {
            document.documentElement.classList.remove('dark-theme');
        }
    }, []);

    return (
        <AuthProvider>
            <SocketProvider>
                <BrowserRouter>
                    <ToastContainer position="top-center" autoClose={3000} hideProgressBar={false} newestOnTop closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="colored" />
                    <AppRoutes />
                </BrowserRouter>
            </SocketProvider>
        </AuthProvider>
    );
};

export default App;
