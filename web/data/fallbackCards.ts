import { NfcCard } from '../types';

export const fallbackCards: NfcCard[] = [
    {
        id: 'NFC001',
        secretcode: 'a1b2c3d4',
        alias: 'Ana Giriş Kartı',
        uid: '04:6a:9c:8d:a8:67:80',
        assignedLocationId: 'loc1',
        assignedlocationid: 'loc1',
        active: true,
    },
    {
        id: 'NFC002',
        secretcode: 'e5f6g7h8',
        alias: 'CNC Makinesi Kartı',
        uid: '04:6a:9c:8d:a8:67:81',
        assignedLocationId: 'loc2',
        assignedlocationid: 'loc2',
        active: true,
    },
    {
        id: 'NFC003',
        secretcode: 'i9j0k1l2',
        alias: 'Kalite Kontrol Kartı',
        uid: '04:6a:9c:8d:a8:67:82',
        assignedLocationId: 'loc3',
        assignedlocationid: 'loc3',
        active: true,
    },
    {
        id: 'NFC004',
        secretcode: 'm3n4o5p6',
        alias: 'Yedek Kart 1',
        uid: '04:6a:9c:8d:a8:67:83',
        assignedLocationId: null,
        assignedlocationid: null,
        active: true,
    },
    {
        id: 'NFC005',
        secretcode: 'q7r8s9t0',
        alias: 'Yedek Kart 2',
        uid: '04:6a:9c:8d:a8:67:84',
        assignedLocationId: null,
        assignedlocationid: null,
        active: true,
    },
];
