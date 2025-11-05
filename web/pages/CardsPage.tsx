import React, { FC, useState, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from '../i18n/context';
import { NfcCard, Location } from '../types';
import { Icons } from '../components/Icons';
import { Modal } from '../components/Modal';
import { supabase } from '../supabaseClient';


export const CardsPage: FC<{ cards: NfcCard[], locations: Location[], setNfcCards: React.Dispatch<React.SetStateAction<NfcCard[]>> }> = ({ cards, locations, setNfcCards }) => {
    const { t } = useTranslation();
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [cardId, setCardId] = useState('');
    const [secretCode, setSecretCode] = useState('');
    const [alias, setAlias] = useState('');
    const [editingCard, setEditingCard] = useState<NfcCard | null>(null);

    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'scanned' | 'error' | 'unsupported'>('idle');
    const [scanError, setScanError] = useState('');
    const [scanLog, setScanLog] = useState<string[]>([]);
    const [scannedSecretCode, setScannedSecretCode] = useState<string | null>(null);
    const [scannedUid, setScannedUid] = useState<string | null>(null);
    const [scannedCardId, setScannedCardId] = useState('');
    const scanAbortController = useRef<AbortController | null>(null);

    const isInIframe = useMemo(() => {
        try { return window.self !== window.top; } catch (e) { return true; }
    }, []);

    const handleOpenInNewTab = () => {
        window.open(window.location.href, '_blank', 'noopener,noreferrer');
    };

    const openNewCardModal = () => {
        setCardId('');
        setSecretCode('');
        setAlias('');
        setEditingCard(null);
        setIsCardModalOpen(true);
    };

    const handleSaveCard = async () => {
        // secretCode is auto-generated now, so we only check for cardId and alias
        if (!cardId || !alias) {
            alert('Takma Ad ve Kart ID alanları zorunludur.');
            return;
        }
        if (cards.some(c => c.id === cardId)) {
            alert('Bu Kart ID zaten mevcut.');
            return;
        }
        try {
            // Auto-generate a secret code if it's empty
            const finalSecretCode = secretCode || `manual_${Date.now()}`;
            const newCard = { id: cardId, secretcode: finalSecretCode, alias: alias };
            const { data, error } = await supabase.from('cards').insert(newCard).select().single();
            if (error) throw error;
            setNfcCards(prevCards => [...prevCards, data as NfcCard]);
            setIsCardModalOpen(false);
        } catch (e: any) {
            console.error("Kart kaydedilemedi:", e);
            alert(`Kart kaydedilemedi: ${e.message}`);
        }
    };

    const handleUpdateCard = async () => {
        if (!editingCard || !alias) {
            alert('Takma ad boş bırakılamaz.');
            return;
        }
        try {
            const { data, error } = await supabase
                .from('cards')
                .update({ alias: alias })
                .eq('id', editingCard.id)
                .select()
                .single();
            
            if (error) throw error;

            setNfcCards(prev => prev.map(c => c.id === editingCard.id ? data as NfcCard : c));
            setIsCardModalOpen(false);
            setEditingCard(null);
        } catch (e: any) {
            console.error("Kart güncellenemedi:", e);
            alert(`Kart güncellenemedi: ${e.message}`);
        }
    };

    const openEditCardModal = (card: NfcCard) => {
        setEditingCard(card);
        setCardId(card.id);
        setAlias(card.alias || '');
        setSecretCode(card.secretcode || '');
        setIsCardModalOpen(true);
    };

    const findLocationName = (locationId: string | null) => {
        if (!locationId) return <span className="text-gray-500">Atanmamış</span>;
        return locations.find(l => l.id === locationId)?.name || <span className="text-red-400">Bilinmeyen Nokta</span>;
    };
    
    const closeScanModal = useCallback(() => {
        if (scanAbortController.current) {
            scanAbortController.current.abort();
            scanAbortController.current = null;
        }
        setIsScanModalOpen(false);
        setScanStatus('idle');
        setScanLog([]);
    }, []);

    const openScanModal = async () => {
        setScannedCardId('');
        setScannedSecretCode(null);
        setScannedUid(null);
        setScanError('');
        setScanLog([]);
        setIsScanModalOpen(true);

        if (isInIframe) {
            setScanStatus('unsupported');
            setScanError('NFC tarama bu önizleme penceresinde çalışmaz. Lütfen uygulamayı yeni bir sekmede açın.');
            return;
        }

        if (!('NDEFReader' in window)) {
            setScanStatus('unsupported');
            setScanError('Web NFC bu cihazda veya tarayıcıda desteklenmiyor. Lütfen Android ve Chrome kullandığınızdan emin olun.');
            return;
        }
        
        setScanStatus('scanning');

        try {
            scanAbortController.current = new AbortController();
            // @ts-ignore
            const reader = new NDEFReader();

            const scanTimeout = setTimeout(() => {
                scanAbortController.current?.abort();
                setScanStatus('error');
                setScanError('Tarama zaman aşımına uğradı. Lütfen tekrar deneyin ve kartı cihaza yakın tuttuğunuzdan emin olun.');
            }, 30000);

            reader.onreading = (event: any) => {
                clearTimeout(scanTimeout);
                const { message, serialNumber } = event;
                const newUid = serialNumber;
                
                if (!newUid) {
                    setScanStatus('error');
                    setScanError('Kartın seri numarası (UUID) okunamadı. Lütfen farklı bir kartla tekrar deneyin.');
                    return;
                }

                if (cards.some(c => c.uid && c.uid === newUid)) {
                    setScanStatus('error');
                    setScanError('Bu kart (UID ile) zaten sisteme kayıtlı.');
                    return;
                }
                
                setScannedUid(newUid);
                // Otomatik olarak UUID'den bir secret code üretelim.
                setScannedSecretCode(`uid_${newUid.replace(/:/g, '').slice(-8)}`);
                setScanStatus('scanned');
                setScannedCardId(`NFC${String(cards.length + 1).padStart(3, '0')}`);
                scanAbortController.current?.abort();
            };
            
            reader.onreadingerror = () => {
                clearTimeout(scanTimeout);
                setScanStatus('error');
                setScanError('Kart okunurken bir hata oluştu. Lütfen tekrar deneyin.');
            };
            
            await reader.scan({ signal: scanAbortController.current.signal });

        } catch (error: any) {
            let errorMessage = `Tarama başlatılamadı: ${error.message}`;
            if (error.name === 'NotAllowedError') errorMessage = 'NFC taraması için izin verilmedi. Lütfen tarayıcı ayarlarından bu site için NFC iznini kontrol edin.';
            else if (error.name === 'NotSupportedError') errorMessage = 'Web NFC bu cihazda veya tarayıcıda desteklenmiyor.';
            else if (error.name === 'AbortError') return;
            setScanStatus('error');
            setScanError(errorMessage);
        }
    };

    const handleSaveScannedCard = async () => {
        if (!scannedCardId || !scannedSecretCode) {
            alert('Kart ID ve taranan kod olmadan kaydedilemez.');
            return;
        }
        if (cards.some(c => c.id === scannedCardId)) {
            alert('Bu Kart ID zaten mevcut.');
            return;
        }
        try {
            const newCard = { id: scannedCardId, secretcode: scannedSecretCode, uid: scannedUid || undefined, alias: `Scanned Card ${scannedCardId}` };
            const { data, error } = await supabase.from('cards').insert(newCard).select().single();
            if (error) throw error;
            setNfcCards(prevCards => [...prevCards, data as NfcCard]);
            closeScanModal();
        } catch (e: any) {
            console.error("Taranan kart kaydedilemedi:", e);
            alert(`Taranan kart kaydedilemedi: ${e.message}`);
        }
    };

    const handleDeleteCard = async (cardToDelete: NfcCard) => {
        if (cardToDelete.assignedlocationid) {
            alert('Bu kart bir noktaya atanmış. Önce noktadan kart atamasını kaldırın.');
            return;
        }
        if (!window.confirm(`'${cardToDelete.alias || cardToDelete.id}' kartını silmek istediğinizden emin misiniz?`)) return;

        try {
            const { error } = await supabase.from('cards').delete().eq('id', cardToDelete.id);
            if (error) throw error;
            setNfcCards(prev => prev.filter(c => c.id !== cardToDelete.id));
        } catch (e: any) { console.error("Kart silinemedi:", e); alert(`Kart silinemedi: ${e.message}`); }
    };

    const ScanLogDisplay = () => (
        scanLog.length > 0 ? (
            <div className="mt-4 p-3 bg-gray-900/70 border border-gray-600 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-300 mb-2">Tarama Detayları:</h4>
                <div className="text-xs text-gray-400 font-mono space-y-1">
                    {scanLog.map((log, index) => <p key={index}>{log}</p>)}
                </div>
            </div>
        ) : null
    );

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-white">{t('cards.title')}</h1>
                <div className="flex space-x-2">
                    <button onClick={openScanModal} className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center space-x-2 transition-colors"><Icons.Nfc /><span>{t('btn.scanAndAdd')}</span></button>
                    <button onClick={openNewCardModal} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center space-x-2 transition-colors"><Icons.Plus /><span>{t('btn.addCard')}</span></button>
                </div>
            </div>
            <div className="bg-gray-800 rounded-lg shadow-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-300">
                    <thead className="text-xs text-gray-400 uppercase bg-gray-700/50">
                        <tr>
                            <th scope="col" className="px-6 py-3">{t('cards.table.alias')}</th>
                            <th scope="col" className="px-6 py-3">{t('cards.table.cardId')}</th>
                            <th scope="col" className="px-6 py-3">{t('cards.table.uid')}</th>
                            <th scope="col" className="px-6 py-3">{t('cards.table.assignedLocation')}</th>
                            <th scope="col" className="px-6 py-3"><span className="sr-only">Eylemler</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {cards.map(card => (
                            <tr key={card.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50">
                                <td className="px-6 py-4 font-medium text-white">{card.alias}</td>
                                <td className="px-6 py-4 font-mono text-gray-400">{card.id}</td>
                                <td className="px-6 py-4 font-mono text-gray-400">{card.uid || t('cards.table.notAvailable')}</td>
                                <td className="px-6 py-4">{findLocationName(card.assignedlocationid)}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end space-x-2">
                                        <button onClick={() => openEditCardModal(card)} className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded">{t('btn.edit')}</button>
                                        <button onClick={() => handleDeleteCard(card)} className="text-sm bg-red-800 hover:bg-red-700 text-white px-3 py-1.5 rounded">{t('btn.delete')}</button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Modal isOpen={isCardModalOpen} onClose={() => setIsCardModalOpen(false)} title={editingCard ? t('modals.card.editTitle') : t('modals.card.manualTitle')}>
                 <div className="space-y-4">
                    <div><label htmlFor="cardAlias" className="block mb-2 text-sm font-medium text-gray-300">Takma Ad</label><input type="text" id="cardAlias" value={alias} onChange={e => setAlias(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="Örn: Giriş Kapısı Kartı" required /></div>
                    <div><label htmlFor="cardId" className="block mb-2 text-sm font-medium text-gray-300">Kart ID</label><input type="text" id="cardId" value={cardId} onChange={e => setCardId(e.target.value.toUpperCase())} className="bg-gray-700 border-gray-600 text-gray-400 text-sm rounded-lg block w-full p-2.5" placeholder="NFC006" required readOnly={!!editingCard} /></div>
                    <div><label htmlFor="secretCode" className="block mb-2 text-sm font-medium text-gray-300">Özel Kod (Otomatik)</label><input type="text" id="secretCode" value={secretCode} onChange={e => setSecretCode(e.target.value)} className="bg-gray-700 border-gray-600 text-gray-400 text-sm rounded-lg block w-full p-2.5" placeholder="a1b2c3d4" required readOnly={!!editingCard} /></div>
                     <div className="flex justify-end items-center pt-2 space-x-2">
                        <button onClick={() => setIsCardModalOpen(false)} className="text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button>
                        <button onClick={editingCard ? handleUpdateCard : handleSaveCard} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">{editingCard ? t('btn.saveChanges') : t('btn.saveCard')}</button>
                    </div>
                </div>
            </Modal>
            <Modal isOpen={isScanModalOpen} onClose={closeScanModal} title={t('modals.card.scanTitle')}>
                {scanStatus === 'scanning' && <div className="text-center p-4"><div className="flex justify-center items-center mb-4"><div className="relative flex h-20 w-20"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-20 w-20 bg-blue-500 items-center justify-center"><Icons.Nfc /></span></div></div><p className="text-lg text-white">{t('cards.scan.instructions')}</p><p className="text-sm text-gray-400 mt-2">{t('cards.scan.autoStart')}</p><button onClick={closeScanModal} className="mt-6 text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button></div>}
                {(scanStatus === 'error' || scanStatus === 'unsupported') && <div className="p-4"><div className="text-center bg-red-900/50 border border-red-700 text-red-300 p-3 rounded-lg"><p className="font-semibold mb-2">{t('cards.scan.errorTitle')}</p><p className="text-sm">{scanError}</p></div><ScanLogDisplay />{isInIframe && <button onClick={handleOpenInNewTab} className="mt-4 w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-3 rounded-md transition-colors">{t('cards.scan.openNewTab')}</button>}<button onClick={closeScanModal} className="mt-4 w-full text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.close')}</button></div>}
                {scanStatus === 'scanned' && <div className="space-y-4"><div className="text-center bg-green-900/50 border border-green-700 text-green-300 p-3 rounded-lg"><p className="font-semibold">{t('cards.scan.success')}</p></div><ScanLogDisplay /><div><label htmlFor="scannedUid" className="block mb-2 text-sm font-medium text-gray-300">{t('cards.scan.uidLabel')}</label><input type="text" id="scannedUid" value={scannedUid || ''} className="bg-gray-900 border border-gray-600 text-gray-400 font-mono text-sm rounded-lg block w-full p-2.5" readOnly /></div><div><label htmlFor="scannedCardId" className="block mb-2 text-sm font-medium text-gray-300">{t('cards.scan.newIdLabel')}</label><input type="text" id="scannedCardId" value={scannedCardId} onChange={e => setScannedCardId(e.target.value.toUpperCase())} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="Örn: NFC007" required /></div><div className="flex justify-end items-center pt-2 space-x-2"><button onClick={closeScanModal} className="text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button><button onClick={handleSaveScannedCard} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.saveScannedCard')}</button></div></div>}
            </Modal>
        </div>
    );
};