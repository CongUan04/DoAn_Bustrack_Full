import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '../../contexts/AuthContext';

const MasterLayout: React.FC = () => {
    const { isAuthenticated } = useAuth();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="master-layout">
            <Sidebar />
            <div className="main-content">
                <Topbar />
                <main className="page-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default MasterLayout;
