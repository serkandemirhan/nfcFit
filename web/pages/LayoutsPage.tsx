import React, { FC, useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from '../i18n/context';
import { Location, NfcCard, Layout } from '../types';
import { Modal } from '../components/Modal';

export const LayoutsPage: FC<{
    locations: Location[];
    cards: NfcCard[];
    layouts: Layout[];
    setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
    setNfcCards: React.Dispatch<React.SetStateAction<NfcCard[]>>;
    setLayouts: React.Dispatch<React.SetStateAction<Layout[]>>;
}> = ({ locations, cards, layouts, setLocations, setNfcCards, setLayouts }) => {
    const { t } = useTranslation();
    const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(layouts[0]?.id || null);
    const [isPlacementMode, setIsPlacementMode] = useState(false);
    
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
    const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
    const [newPointCoords, setNewPointCoords] = useState<{ x: number, y: number } | null>(null);

    const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
    const [editingLayout, setEditingLayout] = useState<Layout | null>(null);

    const [draggingMarker, setDraggingMarker] = useState<Location | null>(null);

    const mapRef = useRef<HTMLDivElement>(null);

    const [locationName, setLocationName] = useState('');
    const [assignedCardId, setAssignedCardId] = useState<string | ''>('');
    const [layoutName, setLayoutName] = useState('');
    const [layoutImageUrl, setLayoutImageUrl] = useState('');

    const selectedLayout = useMemo(() => layouts.find(l => l.id === selectedLayoutId), [layouts, selectedLayoutId]);
    const filteredLocations = useMemo(() => locations.filter(loc => loc.layoutId === selectedLayoutId), [locations, selectedLayoutId]);
    const unassignedCards = useMemo(() => cards.filter(c => c.assignedlocationid == null), [cards]);

    const availableCardsForDropdown = useMemo(() => {
        if (selectedLocation && selectedLocation.nfccardid) {
            const currentCard = cards.find(c => c.id === selectedLocation.nfccardid);
            return currentCard ? [currentCard, ...unassignedCards] : unassignedCards;
        }
        return unassignedCards;
    }, [unassignedCards, selectedLocation, cards]);

    const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isPlacementMode || !mapRef.current || !selectedLayoutId) return;
        const rect = mapRef.current.getBoundingClientRect();
        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
        setNewPointCoords({ x, y });
        setSelectedLocation(null);
        setLocationName('');
        setAssignedCardId('');
        setIsLocationModalOpen(true);
    };

    const handleMarkerClick = (location: Location) => {
        setIsPlacementMode(false);
        setNewPointCoords(null);
        setSelectedLocation(location);
        setLocationName(location.name);
        setAssignedCardId(location.nfccardid || '');
        setIsLocationModalOpen(true);
    };
    
    const closeLocationModal = () => {
        setIsLocationModalOpen(false);
        setSelectedLocation(null);
        setNewPointCoords(null);
    };

    const handleSaveLocation = () => {
        if(!selectedLayoutId) return;

        let updatedLocations = [...locations];
        let updatedCards = [...cards];

        const handleCardUpdates = (oldCardId: string | null, newCardId: string | null, locationId: string) => {
             if (oldCardId && oldCardId !== newCardId) {
                const oldCardIndex = updatedCards.findIndex(c => c.id === oldCardId);
                if (oldCardIndex > -1) updatedCards[oldCardIndex] = { ...updatedCards[oldCardIndex], assignedlocationid: null };
            }
             if (newCardId) {
                 const newCardIndex = updatedCards.findIndex(c => c.id === newCardId);
                 if (newCardIndex > -1) updatedCards[newCardIndex] = { ...updatedCards[newCardIndex], assignedlocationid: locationId };
            }
        }
        
        if (selectedLocation) {
            const locIndex = updatedLocations.findIndex(l => l.id === selectedLocation.id);
            if (locIndex > -1) {
                const originalLocation = updatedLocations[locIndex];
                handleCardUpdates(originalLocation.nfccardid, assignedCardId || null, selectedLocation.id);
                updatedLocations[locIndex] = { ...originalLocation, name: locationName, nfccardid: assignedCardId || null };
            }
        } else if (newPointCoords) {
            const newLocation: Location = {
                id: `loc_${Date.now()}`,
                name: locationName,
                layoutId: selectedLayoutId,
                nfccardid: assignedCardId || null,
                ...newPointCoords
            };
            updatedLocations.push(newLocation);
            handleCardUpdates(null, assignedCardId || null, newLocation.id);
        }

        setLocations(updatedLocations);
        setNfcCards(updatedCards);
        closeLocationModal();
    };

    const handleDeleteLocation = () => {
        if (!selectedLocation) return;
        const updatedCards = cards.map(card => card.id === selectedLocation.nfccardid ? { ...card, assignedlocationid: null } : card);
        const updatedLocations = locations.filter(loc => loc.id !== selectedLocation.id);
        setLocations(updatedLocations);
        setNfcCards(updatedCards);
        closeLocationModal();
    };

    const openNewLayoutModal = () => {
        setEditingLayout(null);
        setLayoutName('');
        setLayoutImageUrl('');
        setIsLayoutModalOpen(true);
    };

    const openEditLayoutModal = () => {
        if (!selectedLayout) return;
        setEditingLayout(selectedLayout);
        setLayoutName(selectedLayout.name);
        setLayoutImageUrl(selectedLayout.imageUrl);
        setIsLayoutModalOpen(true);
    };

    const handleSaveLayout = () => {
        if (editingLayout) {
            const updatedLayouts = layouts.map(l => l.id === editingLayout.id ? { ...l, name: layoutName, imageUrl: layoutImageUrl } : l);
            setLayouts(updatedLayouts);
        } else {
            const newLayout: Layout = {
                id: `layout_${Date.now()}`,
                name: layoutName,
                imageUrl: layoutImageUrl,
            };
            const updatedLayouts = [...layouts, newLayout];
            setLayouts(updatedLayouts);
            setSelectedLayoutId(newLayout.id);
        }
        setIsLayoutModalOpen(false);
    };

    const handleDeleteLayout = () => {
        if (!editingLayout || !window.confirm(`'${editingLayout.name}' yerleşimini silmek istediğinizden emin misiniz? Bu yerleşime ait tüm noktalar da silinecektir.`)) return;
        
        const locationsToDelete = locations.filter(l => l.layoutId === editingLayout.id);
        const cardIdsToUnassign = locationsToDelete.map(l => l.nfccardid).filter(Boolean);

        const updatedCards = cards.map(c => cardIdsToUnassign.includes(c.id as string) ? { ...c, assignedlocationid: null } : c);
        const updatedLocations = locations.filter(l => l.layoutId !== editingLayout.id);
        const updatedLayouts = layouts.filter(l => l.id !== editingLayout.id);

        setNfcCards(updatedCards);
        setLocations(updatedLocations);
        setLayouts(updatedLayouts);
        
        if(selectedLayoutId === editingLayout.id) {
            setSelectedLayoutId(updatedLayouts[0]?.id || null);
        }
        setIsLayoutModalOpen(false);
    };
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                alert('Lütfen bir resim dosyası seçin.');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setLayoutImageUrl(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleMarkerDragStart = (e: React.MouseEvent, location: Location) => {
        e.preventDefault();
        e.stopPropagation();
        setDraggingMarker(location);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!draggingMarker || !mapRef.current) return;
        const rect = mapRef.current.getBoundingClientRect();
        let x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        let y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
        x = Math.max(0, Math.min(100, x));
        y = Math.max(0, Math.min(100, y));

        setLocations(currentLocations =>
            currentLocations.map(loc =>
                loc.id === draggingMarker.id ? { ...loc, x, y } : loc
            )
        );
    };

    const handleMouseUp = () => {
        setDraggingMarker(null);
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => handleMouseMove(e as any);
        const onMouseUp = () => handleMouseUp();
        if (draggingMarker) {
            document.addEventListener('mouseup', onMouseUp);
            document.addEventListener('mousemove', onMouseMove);
        }
        return () => {
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('mousemove', onMouseMove);
        };
    }, [draggingMarker]);

    return (
        <div>
            <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-white">{t('layouts.title')}</h1>
                <div className="flex items-center space-x-4">
                     <span className={`text-sm ${isPlacementMode ? 'text-blue-400' : 'text-gray-400'}`}>{isPlacementMode ? t('layouts.placementMode.on') : t('layouts.placementMode.off')}</span>
                    <label htmlFor="placementToggle" className="flex items-center cursor-pointer">
                        <span className="mr-3 text-white font-medium">{t('layouts.placementMode.label')}</span>
                        <div className="relative">
                            <input type="checkbox" id="placementToggle" className="sr-only" checked={isPlacementMode} onChange={() => setIsPlacementMode(!isPlacementMode)} disabled={!selectedLayoutId} />
                            <div className={`block w-14 h-8 rounded-full ${!selectedLayoutId ? 'bg-gray-700' : 'bg-gray-600'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${isPlacementMode ? 'transform translate-x-full bg-blue-400' : ''}`}></div>
                        </div>
                    </label>
                </div>
            </div>
            <div className="flex flex-wrap items-center bg-gray-800/50 p-4 rounded-lg mb-6 gap-4">
                <div className="flex-1 min-w-[200px]">
                    <label htmlFor="layout-select" className="text-sm font-medium text-gray-300 mr-2">{t('layouts.selectLabel')}:</label>
                    <select id="layout-select" value={selectedLayoutId || ''} onChange={e => setSelectedLayoutId(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5">
                        {layouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        {layouts.length === 0 && <option>Yerleşim planı yok</option>}
                    </select>
                </div>
                <div className="flex space-x-2">
                    <button onClick={openNewLayoutModal} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">{t('btn.newLayout')}</button>
                    <button onClick={openEditLayoutModal} disabled={!selectedLayout} className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{t('btn.editLayout')}</button>
                </div>
            </div>
            <div ref={mapRef} onClick={handleMapClick} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} className={`relative bg-gray-800 rounded-lg shadow-lg aspect-video bg-cover bg-center overflow-hidden transition-all ${isPlacementMode ? 'cursor-crosshair' : 'cursor-default'} ${!selectedLayout?.imageUrl ? 'flex items-center justify-center' : ''}`} style={{ backgroundImage: `url('${selectedLayout?.imageUrl || ''}')` }}>
                {!selectedLayout?.imageUrl && <p className="text-gray-400">{t('layouts.preview.empty')}</p>}
                {filteredLocations.map(loc => (
                    <div key={loc.id} className="absolute transform -translate-x-1/2 -translate-y-1/2 group" style={{ left: `${loc.x}%`, top: `${loc.y}%` }} onClick={(e) => { e.stopPropagation(); handleMarkerClick(loc); }} onMouseDown={(e) => handleMarkerDragStart(e, loc)}>
                        <div className={`w-6 h-6 bg-red-500 rounded-full border-2 border-white ring-4 ring-red-500/80 hover:ring-8 hover:ring-red-400/90 transition-all shadow-lg ${draggingMarker?.id === loc.id ? 'cursor-grabbing animate-pulse' : 'cursor-grab'}`}></div>
                         <div className="absolute bottom-full mb-2 w-max p-2 text-xs text-white bg-gray-900/80 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none transform -translate-x-1/2 left-1/2">
                            {loc.name}
                            <div className="text-gray-400">{loc.nfccardid || "Kart Yok"}</div>
                        </div>
                    </div>
                ))}
            </div>
            <Modal isOpen={isLocationModalOpen} onClose={closeLocationModal} title={selectedLocation ? t('modals.location.editTitle') : t('modals.location.newTitle')}>
                 <div className="space-y-4">
                    <div>
                        <label htmlFor="locationName" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.location.name')}</label>
                        <input type="text" id="locationName" value={locationName} onChange={(e) => setLocationName(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="Örn: Giriş Kapısı" />
                    </div>
                     <div>
                        <label htmlFor="nfcCard" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.location.assignCard')}</label>
                        <select id="nfcCard" value={assignedCardId} onChange={(e) => setAssignedCardId(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                            <option value="">{t('forms.location.noCardAssigned')}</option>
                            {availableCardsForDropdown.map(card => (<option key={card.id} value={card.id}>{card.alias || card.id}</option>))}
                        </select>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                        <div>{selectedLocation && (<button onClick={handleDeleteLocation} className="text-red-500 hover:text-red-400 font-medium transition-colors">{t('btn.delete')}</button>)}</div>
                        <div className="flex space-x-2">
                             <button onClick={closeLocationModal} className="text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button>
                             <button onClick={handleSaveLocation} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.save')}</button>
                        </div>
                    </div>
                 </div>
            </Modal>
            <Modal isOpen={isLayoutModalOpen} onClose={() => setIsLayoutModalOpen(false)} title={editingLayout ? t('modals.layout.editTitle') : t('modals.layout.newTitle')}>
                 <div className="space-y-4">
                    <div>
                        <label htmlFor="layoutName" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.layout.name')}</label>
                        <input type="text" id="layoutName" value={layoutName} onChange={(e) => setLayoutName(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="Örn: Zemin Kat" />
                    </div>
                     <div>
                        <label htmlFor="layoutImageUrl" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.layout.imageUrl')}</label>
                        <input type="text" id="layoutImageUrl" value={layoutImageUrl} onChange={(e) => setLayoutImageUrl(e.target.value)} className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" placeholder="https://example.com/plan.png" />
                    </div>
                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-gray-600"></div><span className="flex-shrink mx-4 text-gray-400 text-xs">{t('forms.or')}</span><div className="flex-grow border-t border-gray-600"></div>
                    </div>
                    <div>
                        <label htmlFor="layoutImageFile" className="block mb-2 text-sm font-medium text-gray-300">{t('forms.layout.upload')}</label>
                        <input type="file" id="layoutImageFile" accept="image/*" onChange={handleImageUpload} className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-600 file:text-gray-200 hover:file:bg-gray-500 cursor-pointer" />
                    </div>
                    {layoutImageUrl && (
                        <div>
                            <p className="text-sm font-medium text-gray-300 mb-2">{t('forms.preview')}:</p>
                            <div className="border border-gray-600 rounded-lg p-2 bg-gray-900/50"><img src={layoutImageUrl} alt="Yerleşim planı önizlemesi" className="max-h-40 w-full object-contain rounded-md" /></div>
                        </div>
                    )}
                    <div className="flex justify-between items-center pt-2">
                        <div>{editingLayout && (<button onClick={handleDeleteLayout} className="text-red-500 hover:text-red-400 font-medium transition-colors">{t('btn.delete')}</button>)}</div>
                        <div className="flex space-x-2">
                             <button onClick={() => setIsLayoutModalOpen(false)} className="text-gray-300 bg-gray-600 hover:bg-gray-500 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.cancel')}</button>
                             <button onClick={handleSaveLayout} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-5 py-2.5">{t('btn.save')}</button>
                        </div>
                    </div>
                 </div>
            </Modal>
        </div>
    );
};