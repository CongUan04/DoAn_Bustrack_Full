export type UserRole = 'admin' | 'parent' | 'driver';

export interface User {
    id: string;
    username: string;
    email: string;
    role: UserRole;
    fullName: string;
    avatar?: string;
    isEmailSet?: boolean;
}

export interface Student {
    id: string;
    name: string;
    grade: string;
    rfidUid: string;
    parentId: string;
    busId: string;
    photo?: string;
    status: 'onboard' | 'dropped_off' | 'absent';
}

export interface Bus {
    id: string;
    licensePlate: string;
    driverName: string;
    capacity: number;
    currentStudents: number;
    status: 'active' | 'idle' | 'delayed' | 'offline';
    lastLocation?: { lat: number; lng: number };
}

export interface Alert {
    id: string;
    type: 'speeding' | 'offline' | 'geofence' | 'attendance';
    message: string;
    busId: string;
    timestamp: string;
    severity: 'low' | 'medium' | 'high';
    read: boolean;
}
