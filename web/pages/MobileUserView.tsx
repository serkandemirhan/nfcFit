import React, { FC, useState, useMemo, useRef } from 'react';
import { useTranslation } from '../i18n/context';
import { User, Task, Location, NfcCard, TaskStatus } from '../types';
import { Icons } from '../components/Icons';
import { Modal } from '../components/Modal';
import { DynamicTaskStatusLabel } from '../components/DynamicTaskStatusLabel';
import { supabase } from '../supabaseClient';

const parseExerciseLogAsTask = (raw: any): Task => {
    const createdAt = new Date(raw.createdat ?? new Date().toISOString());
    return {
        id: raw.log_id ?? raw.id,
        title: `${raw.quantity ?? 0} ${formatUnit(raw.unit)} ${raw.exercise_name ?? 'Egzersiz'}`,
        description: 'NFC tag ile kaydedildi',
        status: TaskStatus.Completed,
        locationId: raw.location_id ?? '',
        locationid: raw.location_id ?? '',
        userId: raw.user_id ?? '',
        userid: raw.user_id ?? '',
        createdAt,
        createdat: createdAt,
        dueDate: createdAt,
        duedate: createdAt,
        lastCompletedAt: createdAt,
        lastcompletedat: createdAt,
        attachments: [],
        active: true,
        repeat: null,
    } as Task;
};

export const MobileUserView: FC<{
    currentUser: User;
    tasks: Task[];
    locations: Location[];
    nfcCards: NfcCard[];
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    onLogout: () => void;
    onViewAttachments: (task: Task) => void;
}> = ({ currentUser, tasks, locations, nfcCards, setTasks, onLogout, onViewAttachments }) => {
    const { t } = useTranslation();
    const myActiveTasks = useMemo(
        () => tasks
            .filter(task => task.userid === currentUser.id && (task.active ?? true) && ![TaskStatus.Completed, TaskStatus.Canceled].includes(task.status))
            .sort((a,b) => a.duedate.getTime() - b.duedate.getTime()),
        [tasks, currentUser.id]
    );
    const myCompletedTasks = useMemo(() => tasks.filter(t => t.userid === currentUser.id && t.status === TaskStatus.Completed).sort((a, b) => (b.lastcompletedat?.getTime() || 0) - (a.lastcompletedat?.getTime() || 0)).slice(0, 10), [tasks, currentUser.id]);

    const [isNfcModalOpen, setIsNfcModalOpen] = useState(false);
    const [scannedLocation, setScannedLocation] = useState<Location | null>(null);
    const [loggedExercise, setLoggedExercise] = useState<any | null>(null);
    const [nfcStatus, setNfcStatus] = useState<'idle' | 'scanning' | 'error' | 'unsupported'>('idle');
    const [nfcError, setNfcError] = useState('');
    const nfcAbortController = useRef<AbortController | null>(null);

    const isInIframe = useMemo(() => { try { return window.self !== window.top; } catch (e) { return true; } }, []);
    const handleOpenInNewTab = () => window.open(window.location.href, '_blank', 'noopener,noreferrer');

    const closeNfcModal = () => {
        if (nfcAbortController.current) {
            nfcAbortController.current.abort();
            nfcAbortController.current = null;
        }
        setIsNfcModalOpen(false);
        setNfcStatus('idle');
        setLoggedExercise(null);
    };

    const startNfcScan = async () => {
        if (isInIframe) {
            setNfcStatus('unsupported');
            setNfcError('NFC tarama bu önizleme penceresinde çalışmaz. Lütfen bu pencereyi kapatıp "Yeni Sekmede Aç" butonunu kullanın.');
            setIsNfcModalOpen(true);
            return;
        }
        
        if (!('NDEFReader' in window)) {
            setNfcStatus('unsupported');
            setNfcError('Web NFC bu cihazda veya tarayıcıda desteklenmiyor. Lütfen Android ve Chrome kullandığınızdan emin olun.');
            setIsNfcModalOpen(true);
            return;
        }

        setNfcStatus('scanning');
        setScannedLocation(null);
        setLoggedExercise(null);
        setIsNfcModalOpen(true);

        try {
            nfcAbortController.current = new AbortController();
            // @ts-ignore
            const reader = new NDEFReader();
            
            reader.onreading = async (event: any) => {
                const decoder = new TextDecoder();
                const scannedUid = event.serialNumber;
                let ndefPayload: string | null = null;

                for (const record of event.message.records) {
                    if (record.data) {
                        ndefPayload = decoder.decode(record.data).trim();
                        break;
                    }
                }

                try {
                    const { data, error } = await supabase.rpc('log_exercise_from_nfc', {
                        p_uid: scannedUid,
                        p_ndef_payload: ndefPayload,
                        p_user_id: currentUser.id,
                    });
                    if (error) throw error;

                    const result = Array.isArray(data) ? data[0] : data;
                    if (result?.result === 'logged') {
                        const location = locations.find(l => l.id === result.location_id) ?? {
                            id: result.location_id,
                            name: result.location_name ?? 'Antrenman Alanı',
                            layoutId: '',
                            layoutid: '',
                            nfcCardId: result.tag_id,
                            nfccardid: result.tag_id,
                            x: 0,
                            y: 0,
                        } as Location;
                        setLoggedExercise(result);
                        setScannedLocation(location);
                        setTasks(prev => [parseExerciseLogAsTask({ ...result, user_id: currentUser.id }), ...prev]);
                        setNfcStatus('idle');
                        nfcAbortController.current?.abort();
                        return;
                    }

                    setNfcStatus('error');
                    setNfcError('Bu NFC tag aktif bir egzersiz tag’i ile eşleşmiyor veya kullanıcıya atanmadı.');
                } catch (e) {
                    console.error("Kullanıcı görünümünde veri okuma hatası:", e);
                    setNfcStatus('error');
                    setNfcError('Egzersiz kaydı oluşturulamadı.');
                }
            };
            
            await reader.scan({ signal: nfcAbortController.current.signal });

        } catch (error: any) {
            if (error.name === 'AbortError') return;
            setNfcStatus('error');
            setNfcError(`Tarama sırasında bir hata oluştu: ${error.message}`);
        }
    };
    
    const timeFormatter = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
            <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <img src={currentUser.avatarurl} alt={currentUser.name} className="w-10 h-10 rounded-full" />
                    <div>
                        <p className="text-sm text-gray-400">{t('userView.welcome')}</p>
                        <h1 className="text-lg font-bold text-white">{currentUser.name}</h1>
                    </div>
                </div>
                <button onClick={onLogout} title={t('btn.logout')}><Icons.Logout /></button>
            </header>
            
            <main className="flex-1 p-4 pb-32">
                <h2 className="text-xl font-semibold text-white mb-4">Aktif Görevlerin ({myActiveTasks.length})</h2>
                {myActiveTasks.length > 0 ? (
                    <ul className="space-y-3">
                        {myActiveTasks.map(task => (
                            <li key={task.id} className="bg-gray-800 p-4 rounded-lg shadow-sm border-l-4 border-blue-500">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 min-w-0"><p className="font-bold text-white break-words">{task.title}</p><p className="text-sm text-gray-400 mt-1">{locations.find(l => l.id === task.locationid)?.name}</p></div>
                                    <div className="flex-shrink-0 ml-2"><DynamicTaskStatusLabel task={task} /></div>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                     <p className="text-xs text-yellow-400">Bitiş: {timeFormatter.format(task.duedate)}</p>
                                      {task.attachments && task.attachments.length > 0 && (<button onClick={() => onViewAttachments(task)} className="flex items-center space-x-1 text-cyan-400 hover:text-cyan-300"><Icons.Attachment /><span className="text-xs">{task.attachments.length}</span></button>)}
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="text-center text-gray-500 mt-10"><p>{t('userView.noActiveTasks')}</p><p className="text-sm mt-2">{t('userView.wellDone')}</p></div>
                )}

                <div className="mt-8 pt-6 border-t border-gray-700/50">
                    <h2 className="text-xl font-semibold text-white mb-4">{t('userView.recentCompleted')}</h2>
                    {myCompletedTasks.length > 0 ? (
                        <ul className="space-y-3">
                            {myCompletedTasks.map(task => (
                                <li key={task.id} className="bg-gray-800/70 p-4 rounded-lg shadow-sm border-l-4 border-green-500 opacity-80">
                                    <div className="flex justify-between items-start">
                                        <div><p className="font-bold text-gray-300 line-through">{task.title}</p><p className="text-sm text-gray-500 mt-1">{locations.find(l => l.id === task.locationid)?.name}</p></div>
                                        <DynamicTaskStatusLabel task={task} />
                                    </div>
                                    {task.lastcompletedat && <p className="text-xs text-gray-400 mt-2">Tamamlandı: {timeFormatter.format(task.lastcompletedat)}</p>}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center text-gray-500 mt-10"><p>{t('userView.noCompletedTasks')}</p></div>
                    )}
                </div>
            </main>

            <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700">
                 {isInIframe && <div className="mb-3 text-center bg-yellow-900/50 border border-yellow-700 text-yellow-300 p-3 rounded-lg text-sm"><p className="font-semibold">{t('userView.iframeError.title')}</p><p className="text-xs mt-1 mb-2 text-yellow-400">{t('userView.iframeError.description')}</p><button onClick={handleOpenInNewTab} className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-3 rounded-md transition-colors">{t('cards.scan.openNewTab')}</button></div>}
                <button onClick={startNfcScan} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-lg inline-flex items-center justify-center space-x-3 transition-colors text-lg shadow-lg"><Icons.Nfc /><span>{t('userView.scanNfc')}</span></button>
            </div>

            <Modal isOpen={isNfcModalOpen} onClose={closeNfcModal} title="NFC Tarama">
                {nfcStatus === 'scanning' && <div className="text-center p-4"><div className="flex justify-center items-center mb-4"><div className="relative flex h-20 w-20"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-20 w-20 bg-blue-500 items-center justify-center"><Icons.Nfc /></span></div></div><p className="text-lg text-white">{t('cards.scan.instructions')}</p><button onClick={closeNfcModal} className="mt-6 text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button></div>}
                {(nfcStatus === 'error' || nfcStatus === 'unsupported') && <div className="text-center p-4"><p className="text-lg text-red-400 mb-2">{t('cards.scan.errorTitle')}</p><p className="text-gray-300">{nfcError}</p><button onClick={closeNfcModal} className="mt-4 text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.close')}</button></div>}
                {scannedLocation && loggedExercise && (
                    <div>
                        <h3 className="text-lg font-bold text-blue-400 mb-3">{scannedLocation.name}</h3>
                        <div className="bg-gray-700 p-3 rounded-lg">
                            <p className="font-semibold text-white">{loggedExercise.exercise_name}</p>
                            <p className="text-sm text-gray-300 my-2">
                                {loggedExercise.quantity} {formatUnit(loggedExercise.unit)} kaydedildi
                                {loggedExercise.calorie_estimate != null ? ` · ${loggedExercise.calorie_estimate} kcal` : ''}
                            </p>
                            <button onClick={closeNfcModal} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-md transition-colors mt-3">{t('btn.close')}</button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

function formatUnit(unit?: string | null) {
    if (unit === 'seconds') return 'sn';
    if (unit === 'minutes') return 'dk';
    if (unit === 'meters') return 'm';
    return 'tekrar';
}
