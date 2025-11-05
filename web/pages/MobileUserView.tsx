import React, { FC, useState, useMemo, useRef } from 'react';
import { useTranslation } from '../i18n/context';
import { User, Task, Location, NfcCard, TaskStatus } from '../types';
import { Icons } from '../components/Icons';
import { Modal } from '../components/Modal';
import { DynamicTaskStatusLabel } from '../components/DynamicTaskStatusLabel';
import { supabase } from '../supabaseClient';

const parseTask = (raw: any): Task => ({
    ...raw,
    createdAt: new Date(raw.createdat),
    dueDate: new Date(raw.duedate),
    lastCompletedAt: raw.lastcompletedat ? new Date(raw.lastcompletedat) : undefined,
});

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
    const myActiveTasks = useMemo(() => tasks.filter(t => t.userId === currentUser.id && t.status !== TaskStatus.Completed).sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime()), [tasks, currentUser.id]);
    const myCompletedTasks = useMemo(() => tasks.filter(t => t.userId === currentUser.id && t.status === TaskStatus.Completed).sort((a, b) => (b.lastCompletedAt?.getTime() || 0) - (a.lastCompletedAt?.getTime() || 0)).slice(0, 10), [tasks, currentUser.id]);

    const [isNfcModalOpen, setIsNfcModalOpen] = useState(false);
    const [scannedLocation, setScannedLocation] = useState<Location | null>(null);
    const [tasksForLocation, setTasksForLocation] = useState<Task[]>([]);
    const [nfcStatus, setNfcStatus] = useState<'idle' | 'scanning' | 'error' | 'unsupported'>('idle');
    const [nfcError, setNfcError] = useState('');
    const [completionNotes, setCompletionNotes] = useState<{ [key: string]: string }>({});
    const nfcAbortController = useRef<AbortController | null>(null);

    const isInIframe = useMemo(() => { try { return window.self !== window.top; } catch (e) { return true; } }, []);
    const handleOpenInNewTab = () => window.open(window.location.href, '_blank', 'noopener,noreferrer');

    const handleCompleteTask = async (taskId: string, notes: string) => {
        try {
            // This would be a call to a Supabase Edge Function to handle completion logic securely
            const { data, error } = await supabase.from('tasks').update({ status: TaskStatus.Completed, lastcompletedat: new Date().toISOString(), completionnotes: notes }).eq('id', taskId).select().single();
            if (error) throw error;

            // Simplified logic, a real app would refetch or handle repeated tasks
            setTasks(prev => prev.map(t => t.id === taskId ? parseTask(data) : t));
            setCompletionNotes(prev => ({ ...prev, [taskId]: '' }));
        } catch (e) {
            console.error('Complete failed', e);
            alert('Görev tamamlanamadı.');
        } finally {
            closeNfcModal();
        }
    };
    
    const closeNfcModal = () => {
        if (nfcAbortController.current) {
            nfcAbortController.current.abort();
            nfcAbortController.current = null;
        }
        setIsNfcModalOpen(false);
        setNfcStatus('idle');
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
        setTasksForLocation([]);
        setCompletionNotes({});
        setIsNfcModalOpen(true);

        try {
            nfcAbortController.current = new AbortController();
            // @ts-ignore
            const reader = new NDEFReader();
            
            reader.onreading = (event: any) => {
                const decoder = new TextDecoder();
                const scannedUid = event.serialNumber;
                let foundMatch = false;

                for (const record of event.message.records) {
                    if (record.data) {
                        try {
                            const secretCode = decoder.decode(record.data).trim();
                            const foundCard = nfcCards.find(c => c.secretCode === secretCode && c.uid === scannedUid);

                            if (foundCard && foundCard.assignedLocationId) {
                                const location = locations.find(l => l.id === foundCard.assignedLocationId);
                                if (location) {
                                    const userTasksAtLocation = tasks.filter(t => t.locationId === location.id && t.userId === currentUser.id && t.status !== TaskStatus.Completed);
                                    setScannedLocation(location);
                                    setTasksForLocation(userTasksAtLocation);
                                    setNfcStatus('idle');
                                    foundMatch = true;
                                    nfcAbortController.current?.abort();
                                    return;
                                }
                            }
                        } catch (e) { console.error("Kullanıcı görünümünde veri okuma hatası:", e); }
                    }
                }

                if (!foundMatch) {
                     setNfcStatus('error');
                     setNfcError('Geçerli bir NFC kartı okutulmadı. Kartın UID ve Özel Kodu sistemdekiyle eşleşmiyor veya kart bir noktaya atanmamış.');
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
                    <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-10 h-10 rounded-full" />
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
                                    <div className="flex-1 min-w-0"><p className="font-bold text-white break-words">{task.title}</p><p className="text-sm text-gray-400 mt-1">{locations.find(l => l.id === task.locationId)?.name}</p></div>
                                    <div className="flex-shrink-0 ml-2"><DynamicTaskStatusLabel task={task} /></div>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                     <p className="text-xs text-yellow-400">Bitiş: {timeFormatter.format(task.dueDate)}</p>
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
                                        <div><p className="font-bold text-gray-300 line-through">{task.title}</p><p className="text-sm text-gray-500 mt-1">{locations.find(l => l.id === task.locationId)?.name}</p></div>
                                        <DynamicTaskStatusLabel task={task} />
                                    </div>
                                    {task.lastCompletedAt && <p className="text-xs text-gray-400 mt-2">Tamamlandı: {timeFormatter.format(task.lastCompletedAt)}</p>}
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
                {scannedLocation && (
                    <div>
                        <h3 className="text-lg font-bold text-blue-400 mb-3">{scannedLocation.name}</h3>
                        {tasksForLocation.length > 0 ? (
                            <ul className="space-y-3">
                                {tasksForLocation.map(task => (
                                    <li key={task.id} className="bg-gray-700 p-3 rounded-lg">
                                        <p className="font-semibold text-white">{task.title}</p><p className="text-sm text-gray-300 my-2">{task.description}</p>
                                        <div className="mt-3">
                                            <label htmlFor={`notes-${task.id}`} className="block mb-1 text-xs font-medium text-gray-400">{t('tasks.form.completionNotes')}</label>
                                            <textarea id={`notes-${task.id}`} rows={2} value={completionNotes[task.id] || ''} onChange={(e) => setCompletionNotes(prev => ({ ...prev, [task.id]: e.target.value }))} className="bg-gray-800 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2" placeholder="Örn: Cihazda sızıntı tespit edildi." />
                                        </div>
                                        <button onClick={() => handleCompleteTask(task.id, completionNotes[task.id] || '')} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-md transition-colors mt-3">{t('btn.completeTask')}</button>
                                    </li>
                                ))}
                            </ul>
                        ) : <p className="text-gray-400 text-center py-4">{t('userView.noTasksAtLocation')}</p>}
                    </div>
                )}
            </Modal>
        </div>
    );
};