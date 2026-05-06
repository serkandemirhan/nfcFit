import React, { FC, useState, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from '../i18n/context';
import { Location, NfcCard, Layout } from '../types';
import { Modal } from '../components/Modal';
import { supabase } from '../supabaseClient';

const LAYOUT_BUCKET = 'layout-images';

const normalizeLocation = (row: any): Location => ({
    ...row,
    layoutId: row.layoutId ?? row.layoutid,
    nfcCardId: row.nfcCardId ?? row.nfccardid ?? null,
    nfccardid: row.nfcCardId ?? row.nfccardid ?? null,
});

const normalizeLayout = (row: any): Layout => ({
    ...row,
    imageUrl: row.imageUrl ?? row.imageurl ?? '',
});

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
    const latestDragPositionRef = useRef<{ id: string; x: number; y: number } | null>(null);
    const dragStartPositionRef = useRef<{ id: string; x: number; y: number } | null>(null);
    const [viewTransform, setViewTransform] = useState({ scale: 1, x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef<{ clientX: number; clientY: number; x: number; y: number } | null>(null);

    const mapRef = useRef<HTMLDivElement>(null);

    const [locationName, setLocationName] = useState('');
    const [assignedCardId, setAssignedCardId] = useState<string | ''>('');
    const [layoutName, setLayoutName] = useState('');
    const [layoutImageUrl, setLayoutImageUrl] = useState('');
    const [draftLayoutId, setDraftLayoutId] = useState<string>('');
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    const [uploadError, setUploadError] = useState<string>('');

    const selectedLayout = useMemo(() => layouts.find(l => l.id === selectedLayoutId), [layouts, selectedLayoutId]);
    const filteredLocations = useMemo(() => locations.filter(loc => loc.layoutId === selectedLayoutId), [locations, selectedLayoutId]);
    const unassignedCards = useMemo(() => cards.filter(c => c.assignedlocationid == null), [cards]);
    const isZoomed = viewTransform.scale > 1;

    const availableCardsForDropdown = useMemo(() => {
        if (selectedLocation && selectedLocation.nfccardid) {
            const currentCard = cards.find(c => c.id === selectedLocation.nfccardid);
            return currentCard ? [currentCard, ...unassignedCards] : unassignedCards;
        }
        return unassignedCards;
    }, [unassignedCards, selectedLocation, cards]);

    const getMapPercentFromClient = (clientX: number, clientY: number) => {
        if (!mapRef.current) return null;
        const rect = mapRef.current.getBoundingClientRect();
        const contentX = (clientX - rect.left - viewTransform.x) / viewTransform.scale;
        const contentY = (clientY - rect.top - viewTransform.y) / viewTransform.scale;
        const x = Math.max(0, Math.min(100, Math.round((contentX / rect.width) * 100)));
        const y = Math.max(0, Math.min(100, Math.round((contentY / rect.height) * 100)));
        return { x, y };
    };

    useEffect(() => {
        if (!selectedLayoutId && layouts[0]?.id) {
            setSelectedLayoutId(layouts[0].id);
            return;
        }
        if (selectedLayoutId && layouts.length > 0 && !layouts.some(layout => layout.id === selectedLayoutId)) {
            setSelectedLayoutId(layouts[0].id);
        }
    }, [layouts, selectedLayoutId]);

    const clampTransform = (scale: number, x: number, y: number) => {
        if (!mapRef.current || scale <= 1) return { scale: 1, x: 0, y: 0 };
        const rect = mapRef.current.getBoundingClientRect();
        const minX = rect.width * (1 - scale);
        const minY = rect.height * (1 - scale);
        return {
            scale,
            x: Math.min(0, Math.max(minX, x)),
            y: Math.min(0, Math.max(minY, y)),
        };
    };

    const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isPlacementMode || !selectedLayoutId || isPanning) return;
        const coords = getMapPercentFromClient(e.clientX, e.clientY);
        if (!coords) return;
        const { x, y } = coords;
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

    const handleSaveLocation = async () => {
        if(!selectedLayoutId) return;
        const trimmedName = locationName.trim();
        if (!trimmedName) {
            alert('Konum adı zorunludur.');
            return;
        }

        let updatedLocations = [...locations];
        let updatedCards = [...cards];

        const handleLocalCardUpdates = (oldCardId: string | null, newCardId: string | null, locationId: string) => {
             if (oldCardId && oldCardId !== newCardId) {
                const oldCardIndex = updatedCards.findIndex(c => c.id === oldCardId);
                if (oldCardIndex > -1) updatedCards[oldCardIndex] = { ...updatedCards[oldCardIndex], assignedlocationid: null };
            }
             if (newCardId) {
                 const newCardIndex = updatedCards.findIndex(c => c.id === newCardId);
                 if (newCardIndex > -1) updatedCards[newCardIndex] = { ...updatedCards[newCardIndex], assignedlocationid: locationId };
            }
        }

        try {
            if (selectedLocation) {
                const locIndex = updatedLocations.findIndex(l => l.id === selectedLocation.id);
                if (locIndex > -1) {
                    const originalLocation = updatedLocations[locIndex];
                    const nextCardId = assignedCardId || null;
                    const { data, error } = await supabase
                        .from('locations')
                        .update({ name: trimmedName, nfccardid: nextCardId })
                        .eq('id', selectedLocation.id)
                        .select()
                        .single();
                    if (error) throw error;

                    if (originalLocation.nfccardid && originalLocation.nfccardid !== nextCardId) {
                        const { error: oldCardError } = await supabase
                            .from('cards')
                            .update({ assignedlocationid: null })
                            .eq('id', originalLocation.nfccardid);
                        if (oldCardError) throw oldCardError;
                    }
                    if (nextCardId) {
                        const { error: newCardError } = await supabase
                            .from('cards')
                            .update({ assignedlocationid: selectedLocation.id })
                            .eq('id', nextCardId);
                        if (newCardError) throw newCardError;
                    }

                    handleLocalCardUpdates(originalLocation.nfccardid, nextCardId, selectedLocation.id);
                    updatedLocations[locIndex] = normalizeLocation(data ?? { ...originalLocation, name: trimmedName, nfccardid: nextCardId });
                }
            } else if (newPointCoords) {
                const newLocation: Location = {
                    id: `loc_${Date.now()}`,
                    name: trimmedName,
                    layoutId: selectedLayoutId,
                    nfccardid: assignedCardId || null,
                    ...newPointCoords
                };
                const { data, error } = await supabase
                    .from('locations')
                    .insert({
                        id: newLocation.id,
                        name: newLocation.name,
                        layoutid: newLocation.layoutId,
                        nfccardid: newLocation.nfccardid,
                        x: newLocation.x,
                        y: newLocation.y,
                    })
                    .select()
                    .single();
                if (error) throw error;

                const savedLocation = normalizeLocation(data ?? newLocation);
                updatedLocations.push(savedLocation);
                if (assignedCardId) {
                    const { error: cardError } = await supabase
                        .from('cards')
                        .update({ assignedlocationid: savedLocation.id })
                        .eq('id', assignedCardId);
                    if (cardError) throw cardError;
                }
                handleLocalCardUpdates(null, assignedCardId || null, savedLocation.id);
            }

            setLocations(updatedLocations);
            setNfcCards(updatedCards);
            closeLocationModal();
        } catch (err) {
            console.error('Location save failed', err);
            alert('Konum kaydedilemedi.');
        }
    };

    const handleDeleteLocation = async () => {
        if (!selectedLocation) return;
        try {
            if (selectedLocation.nfccardid) {
                const { error: cardError } = await supabase
                    .from('cards')
                    .update({ assignedlocationid: null })
                    .eq('id', selectedLocation.nfccardid);
                if (cardError) throw cardError;
            }
            const { error } = await supabase.from('locations').delete().eq('id', selectedLocation.id);
            if (error) throw error;

            const updatedCards = cards.map(card => card.id === selectedLocation.nfccardid ? { ...card, assignedlocationid: null } : card);
            const updatedLocations = locations.filter(loc => loc.id !== selectedLocation.id);
            setLocations(updatedLocations);
            setNfcCards(updatedCards);
            closeLocationModal();
        } catch (err) {
            console.error('Location delete failed', err);
            alert('Konum silinemedi.');
        }
    };

    const openNewLayoutModal = () => {
        setEditingLayout(null);
        const newId = `layout_${Date.now()}`;
        setEditingLayout(null);
        setLayoutName('');
        setLayoutImageUrl('');
        setDraftLayoutId(newId);
        setIsLayoutModalOpen(true);
    };

    const openEditLayoutModal = () => {
        if (!selectedLayout) return;
        setEditingLayout(selectedLayout);
        setLayoutName(selectedLayout.name);
        setLayoutImageUrl(selectedLayout.imageUrl);
        setDraftLayoutId(selectedLayout.id);
        setIsLayoutModalOpen(true);
    };

    const handleSaveLayout = async () => {
        const targetId = editingLayout?.id ?? (draftLayoutId || `layout_${Date.now()}`);
        const trimmedName = layoutName.trim();
        if (!trimmedName) {
            alert('Yerleşim adı zorunludur.');
            return;
        }

        try {
            if (editingLayout) {
                const { data, error } = await supabase
                    .from('layouts')
                    .update({ name: trimmedName, imageurl: layoutImageUrl })
                    .eq('id', editingLayout.id)
                    .select()
                    .single();
                if (error) throw error;
                const savedLayout = normalizeLayout(data ?? { ...editingLayout, name: trimmedName, imageUrl: layoutImageUrl });
                const updatedLayouts = layouts.map(l => l.id === editingLayout.id ? savedLayout : l);
                setLayouts(updatedLayouts);
            } else {
                const { data, error } = await supabase
                    .from('layouts')
                    .insert({ id: targetId, name: trimmedName, imageurl: layoutImageUrl })
                    .select()
                    .single();
                if (error) throw error;
                const newLayout = normalizeLayout(data ?? { id: targetId, name: trimmedName, imageUrl: layoutImageUrl });
                const updatedLayouts = [...layouts, newLayout];
                setLayouts(updatedLayouts);
                setSelectedLayoutId(newLayout.id);
            }
            setDraftLayoutId('');
            setIsLayoutModalOpen(false);
        } catch (err) {
            console.error('Layout save failed', err);
            alert('Yerleşim kaydedilemedi.');
        }
    };

    const handleDeleteLayout = async () => {
        if (!editingLayout || !window.confirm(`'${editingLayout.name}' yerleşimini silmek istediğinizden emin misiniz? Bu yerleşime ait tüm noktalar da silinecektir.`)) return;
        
        const locationsToDelete = locations.filter(l => l.layoutId === editingLayout.id);
        const cardIdsToUnassign = locationsToDelete.map(l => l.nfccardid).filter(Boolean);
        try {
            if (cardIdsToUnassign.length > 0) {
                const { error: cardError } = await supabase
                    .from('cards')
                    .update({ assignedlocationid: null })
                    .in('id', cardIdsToUnassign);
                if (cardError) throw cardError;
            }
            const { error } = await supabase.from('layouts').delete().eq('id', editingLayout.id);
            if (error) throw error;

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
        } catch (err) {
            console.error('Layout delete failed', err);
            alert('Yerleşim silinemedi.');
        }
    };
    
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Lütfen bir resim dosyası seçin.');
            return;
        }
        const layoutId = editingLayout?.id ?? (draftLayoutId || `layout_${Date.now()}`);
        if (!draftLayoutId && !editingLayout) {
            setDraftLayoutId(layoutId);
        }
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const objectPath = `layouts/${layoutId}.${extension}`;
        setIsUploadingImage(true);
        setUploadError('');
        try {
            const { error } = await supabase.storage
                .from(LAYOUT_BUCKET)
                .upload(objectPath, file, { cacheControl: '3600', upsert: true, contentType: file.type });
            if (error) throw error;
            const { data } = supabase.storage.from(LAYOUT_BUCKET).getPublicUrl(objectPath);
            setLayoutImageUrl(data.publicUrl);
        } catch (err: any) {
            console.error('Layout image upload failed', err);
            setUploadError('Resim yüklenemedi. Bucket izinlerini kontrol edin.');
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleMarkerDragStart = (e: React.MouseEvent, location: Location) => {
        e.stopPropagation();
        latestDragPositionRef.current = { id: location.id, x: location.x, y: location.y };
        dragStartPositionRef.current = { id: location.id, x: location.x, y: location.y };
        setDraggingMarker(location);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning && panStartRef.current) {
            const panStart = panStartRef.current;
            const deltaX = e.clientX - panStart.clientX;
            const deltaY = e.clientY - panStart.clientY;
            setViewTransform(current =>
                clampTransform(current.scale, panStart.x + deltaX, panStart.y + deltaY)
            );
            return;
        }

        if (!draggingMarker) return;
        const coords = getMapPercentFromClient(e.clientX, e.clientY);
        if (!coords) return;
        const { x, y } = coords;
        latestDragPositionRef.current = { id: draggingMarker.id, x, y };

        setLocations(currentLocations =>
            currentLocations.map(loc =>
                loc.id === draggingMarker.id ? { ...loc, x, y } : loc
            )
        );
    };

    const handleMouseUp = async () => {
        if (isPanning) {
            setIsPanning(false);
            panStartRef.current = null;
            return;
        }

        const finalPosition = latestDragPositionRef.current;
        const startPosition = dragStartPositionRef.current;
        const markerId = draggingMarker?.id;
        setDraggingMarker(null);
        latestDragPositionRef.current = null;
        dragStartPositionRef.current = null;

        if (!finalPosition || !markerId || finalPosition.id !== markerId) return;

        if (startPosition?.x === finalPosition.x && startPosition?.y === finalPosition.y) return;

        const { error } = await supabase
            .from('locations')
            .update({ x: finalPosition.x, y: finalPosition.y })
            .eq('id', markerId);

        if (error) {
            console.error('Location position save failed', error);
            alert('Nokta konumu kaydedilemedi.');
            if (startPosition) {
                setLocations(currentLocations =>
                    currentLocations.map(loc =>
                        loc.id === markerId ? { ...loc, x: startPosition.x, y: startPosition.y } : loc
                    )
                );
            }
        }
    };

    const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isZoomed || draggingMarker || isPlacementMode || e.button !== 0) return;
        setIsPanning(true);
        panStartRef.current = {
            clientX: e.clientX,
            clientY: e.clientY,
            x: viewTransform.x,
            y: viewTransform.y,
        };
    };

    const zoomBy = (delta: number) => {
        setViewTransform(current => {
            const nextScale = Math.max(1, Math.min(4, current.scale + delta));
            return clampTransform(nextScale, current.x, current.y);
        });
    };

    const resetView = () => {
        setViewTransform({ scale: 1, x: 0, y: 0 });
        setIsPanning(false);
        panStartRef.current = null;
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => handleMouseMove(e as any);
        const onMouseUp = () => handleMouseUp();
        if (draggingMarker || isPanning) {
            document.addEventListener('mouseup', onMouseUp);
            document.addEventListener('mousemove', onMouseMove);
        }
        return () => {
            document.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('mousemove', onMouseMove);
        };
    }, [draggingMarker, isPanning]);

    useEffect(() => {
        const element = mapRef.current;
        if (!element) return;

        const onWheel = (e: WheelEvent) => {
            const rect = element.getBoundingClientRect();
            const pointerX = e.clientX - rect.left;
            const pointerY = e.clientY - rect.top;

            setViewTransform(current => {
                const nextScale = Math.max(1, Math.min(4, current.scale + (e.deltaY < 0 ? 0.2 : -0.2)));
                const scaleRatio = nextScale / current.scale;
                return clampTransform(
                    nextScale,
                    nextScale === 1 ? 0 : pointerX - (pointerX - current.x) * scaleRatio,
                    nextScale === 1 ? 0 : pointerY - (pointerY - current.y) * scaleRatio,
                );
            });
        };

        element.addEventListener('wheel', onWheel, { passive: false });
        return () => element.removeEventListener('wheel', onWheel);
    }, []);

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
            <div className="relative">
                <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md bg-gray-900/85 p-1 shadow-lg">
                    <button type="button" onClick={() => zoomBy(-0.25)} disabled={viewTransform.scale <= 1} className="h-8 w-8 rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-40" title="Uzaklaştır">-</button>
                    <span className="w-14 text-center text-xs font-medium text-gray-200">{Math.round(viewTransform.scale * 100)}%</span>
                    <button type="button" onClick={() => zoomBy(0.25)} disabled={viewTransform.scale >= 4} className="h-8 w-8 rounded bg-gray-700 text-white hover:bg-gray-600 disabled:opacity-40" title="Yakınlaştır">+</button>
                    <button type="button" onClick={resetView} className="h-8 rounded bg-gray-700 px-2 text-xs font-medium text-white hover:bg-gray-600" title="Görünümü sıfırla">Reset</button>
                </div>
                <div
                    ref={mapRef}
                    onClick={handleMapClick}
                    onMouseDown={handlePanStart}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className={`relative bg-gray-800 rounded-lg shadow-lg aspect-video overflow-hidden transition-all select-none ${isPlacementMode ? 'cursor-crosshair' : isPanning ? 'cursor-grabbing' : isZoomed ? 'cursor-grab' : 'cursor-default'}`}
                >
                    <div
                        className="absolute inset-0 origin-top-left bg-cover bg-center"
                        style={{
                            backgroundImage: `url('${selectedLayout?.imageUrl || ''}')`,
                            transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`,
                        }}
                    >
                        {!selectedLayout?.imageUrl && <p className="absolute inset-0 flex items-center justify-center text-gray-400">{t('layouts.preview.empty')}</p>}
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
                </div>
                {isZoomed && !isPlacementMode && (
                    <div className="absolute bottom-3 left-3 rounded bg-gray-900/80 px-2 py-1 text-xs text-gray-300">
                        Boş alanda sürükleyerek gez
                    </div>
                )}
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
                        {isUploadingImage && <p className="text-xs text-blue-300 mt-2">Resim yükleniyor...</p>}
                        {uploadError && <p className="text-xs text-red-400 mt-2">{uploadError}</p>}
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
