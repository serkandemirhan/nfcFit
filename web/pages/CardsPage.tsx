import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../i18n/context';
import { Location, NfcCard } from '../types';
import { Icons } from '../components/Icons';
import { Modal } from '../components/Modal';
import { supabase } from '../supabaseClient';
import { useVirtualizer } from '@tanstack/react-virtual';

type StatusKey = 'assigned' | 'free' | 'inactive';

interface CardListItem extends NfcCard {
    status: StatusKey;
    locationName: string;
    assignedlocationid?: string | null;
}

type VirtualEntry =
    | { type: 'header'; status: StatusKey; count: number; groupIndex: number }
    | { type: 'card'; status: StatusKey; card: CardListItem; groupIndex: number };

interface CardFormState {
    id: string;
    alias: string;
    uid: string;
    locationId: string;
    lifecycleStatus: string;
    securityMode: string;
    ndefPayload: string;
    active: boolean;
}

const statusConfig: Record<StatusKey, { label: string; badge: string; text: string }> = {
    assigned: { label: 'Atandı', badge: 'bg-green-500/15 border border-green-500/30 text-green-200', text: 'text-green-300' },
    free: { label: 'Boşta', badge: 'bg-amber-500/15 border border-amber-500/30 text-amber-200', text: 'text-amber-300' },
    inactive: { label: 'Pasif', badge: 'bg-gray-600/30 border border-gray-500/40 text-gray-300', text: 'text-gray-300' },
};

const defaultFormState: CardFormState = {
    id: '',
    alias: '',
    uid: '',
    locationId: '',
    lifecycleStatus: 'active',
    securityMode: 'static_uid',
    ndefPayload: '',
    active: true,
};

const getLocationId = (card: NfcCard): string | null =>
    (card as any).assignedlocationid ?? card.assignedLocationId ?? null;

const getLocationCardId = (location: Location): string | null =>
    (location as any).nfccardid ?? location.nfcCardId ?? null;

export const CardsPage: FC<{
    cards: NfcCard[];
    locations: Location[];
    setNfcCards: React.Dispatch<React.SetStateAction<NfcCard[]>>;
    setLocations: React.Dispatch<React.SetStateAction<Location[]>>;
}> = ({ cards, locations, setNfcCards, setLocations }) => {
    const { t } = useTranslation();
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusKey | 'all'>('all');
    const [locationFilter, setLocationFilter] = useState<string>('all');
    const [visibleCount, setVisibleCount] = useState(30);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<StatusKey, boolean>>({
        assigned: false,
        free: false,
        inactive: false,
    });

    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [pullDistance, setPullDistance] = useState(0);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [formState, setFormState] = useState<CardFormState>(defaultFormState);
    const [editingCard, setEditingCard] = useState<NfcCard | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const [confirmState, setConfirmState] = useState<{ type: 'delete' | 'unassign' | null; card: NfcCard | null }>({
        type: null,
        card: null,
    });

    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const listParentRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3200);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    useEffect(() => {
        setLastSyncTime(new Date());
    }, [cards]);

    useEffect(() => {
        setVisibleCount(30);
    }, [cards, searchTerm, statusFilter, locationFilter]);

    const stats = useMemo(() => {
        const total = cards.length;
        const free = cards.filter(card => !getLocationId(card)).length;
        const inactive = cards.filter(card => (card as any).active === false || (card as any).lifecycle_status !== 'active').length;
        return { total, free, inactive };
    }, [cards]);

    const locationMap = useMemo(() => {
        const map = new Map<string, Location>();
        locations.forEach(location => map.set(location.id, location));
        return map;
    }, [locations]);

    const enrichedCards: CardListItem[] = useMemo(() => {
        return cards
            .map(card => {
                const locationId = getLocationId(card);
                const locationName = locationId ? (locationMap.get(locationId)?.name ?? 'Bilinmeyen') : 'Atanmamış';
                const active = ((card as any).active ?? true) && ((card as any).lifecycle_status ?? 'active') === 'active';
                const status: StatusKey = !active ? 'inactive' : locationId ? 'assigned' : 'free';
                return { ...card, status, locationName, assignedlocationid: locationId };
            })
            .sort((a, b) => (a.alias || a.id).localeCompare(b.alias || b.id, 'tr'));
    }, [cards, locationMap]);

    const filteredCards = useMemo(() => {
        return enrichedCards.filter(card => {
            const matchesSearch = [card.alias, card.id, card.locationName, card.uid]
                .filter(Boolean)
                .some(value => value!.toString().toLowerCase().includes(searchTerm.toLowerCase()));
            if (!matchesSearch) return false;
            if (statusFilter !== 'all' && card.status !== statusFilter) return false;
            if (locationFilter !== 'all' && card.assignedlocationid !== locationFilter) return false;
            return true;
        });
    }, [enrichedCards, locationFilter, searchTerm, statusFilter]);

    const limitedCards = useMemo(() => filteredCards.slice(0, visibleCount), [filteredCards, visibleCount]);
    const hasMore = filteredCards.length > limitedCards.length;

    const groupedCards = useMemo(() => {
        const groups: Record<StatusKey, CardListItem[]> = { assigned: [], free: [], inactive: [] };
        limitedCards.forEach(card => groups[card.status].push(card));
        return groups;
    }, [limitedCards]);

    const activeGroups = useMemo(
        () => (Object.keys(groupedCards) as StatusKey[]).filter(status => groupedCards[status].length > 0),
        [groupedCards]
    );

    const virtualEntries = useMemo(() => {
        const entries: VirtualEntry[] = [];
        activeGroups.forEach((status, groupIndex) => {
            const cardsForGroup = groupedCards[status];
            entries.push({ type: 'header', status, count: cardsForGroup.length, groupIndex });
            if (!collapsedGroups[status]) {
                cardsForGroup.forEach(card => entries.push({ type: 'card', status, card, groupIndex }));
            }
        });
        return entries;
    }, [activeGroups, groupedCards, collapsedGroups]);

    const listVirtualizer = useVirtualizer({
        count: virtualEntries.length,
        getScrollElement: () => listParentRef.current,
        estimateSize: index => (virtualEntries[index]?.type === 'header' ? 56 : 212),
        overscan: 6,
    });

    const formatTime = useCallback((date: Date | null) => {
        if (!date) return '--';
        return new Intl.DateTimeFormat('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    }, []);

    const showToast = (type: 'success' | 'error', message: string) => setToast({ type, message });

    const updateLocalLocationState = useCallback(
        (cardId: string, nextLocationId: string | null, previousLocationId: string | null) => {
            setLocations(prev =>
                prev.map(location => {
                    const assignedCardId = getLocationCardId(location);
                    if (previousLocationId && location.id === previousLocationId && previousLocationId !== nextLocationId) {
                        return { ...location, nfccardid: null, nfcCardId: null };
                    }
                    if (location.id === nextLocationId) {
                        return { ...location, nfccardid: cardId, nfcCardId: cardId };
                    }
                    if (assignedCardId === cardId && location.id !== nextLocationId) {
                        return { ...location, nfccardid: null, nfcCardId: null };
                    }
                    return location;
                })
            );
        },
        [setLocations]
    );

    const persistLocationAssignment = useCallback(
        async (cardId: string, nextLocationId: string | null, previousLocationId: string | null) => {
            const mutations: Promise<void>[] = [];
            if (previousLocationId && previousLocationId !== nextLocationId) {
                mutations.push(
                    (async () => {
                        const { error } = await supabase.from('locations').update({ nfccardid: null }).eq('id', previousLocationId);
                        if (error) throw error;
                    })()
                );
            }
            if (nextLocationId && nextLocationId !== previousLocationId) {
                mutations.push(
                    (async () => {
                        const { error } = await supabase.from('locations').update({ nfccardid: cardId }).eq('id', nextLocationId);
                        if (error) throw error;
                    })()
                );
            }
            if (mutations.length) {
                await Promise.all(mutations);
            }
            updateLocalLocationState(cardId, nextLocationId, previousLocationId);
        },
        [updateLocalLocationState]
    );

    const upsertCardWithAssignment = useCallback(
        (incoming: NfcCard, nextLocationId: string | null) => {
            const normalized: NfcCard = {
                ...incoming,
                assignedlocationid: nextLocationId,
                assignedLocationId: nextLocationId,
            };
            setNfcCards(prev => {
                let found = false;
                const updated = prev.map(card => {
                    if (card.id === normalized.id) {
                        found = true;
                        return normalized;
                    }
                    if (nextLocationId && getLocationId(card) === nextLocationId && card.id !== normalized.id) {
                        return { ...card, assignedlocationid: null, assignedLocationId: null } as NfcCard;
                    }
                    return card;
                });
                return found ? updated : [...updated, normalized];
            });
        },
        [setNfcCards]
    );

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            const { data, error } = await supabase.from('cards').select('*').order('id');
            if (error) throw error;
            setNfcCards(data as NfcCard[]);
            showToast('success', 'Kart listesi yenilendi');
        } catch (error: any) {
            console.error('Kartlar yenilenemedi:', error);
            showToast('error', error.message || 'Kartlar yenilenemedi');
        } finally {
            setIsRefreshing(false);
        }
    }, [setNfcCards]);

    const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
        if (window.scrollY > 0) return;
        setTouchStart(event.touches[0].clientY);
    };

    const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
        if (touchStart == null) return;
        const distance = event.touches[0].clientY - touchStart;
        setPullDistance(distance > 0 ? distance : 0);
    };

    const handleTouchEnd = () => {
        if (pullDistance > 90 && !isRefreshing) {
            handleRefresh();
        }
        setTouchStart(null);
        setPullDistance(0);
    };

    const openCreateModal = () => {
        setFormMode('create');
        setFormState(defaultFormState);
        setEditingCard(null);
        setIsFormOpen(true);
    };

    const openEditModal = (card: NfcCard) => {
        setFormMode('edit');
        setEditingCard(card);
        setFormState({
            id: card.id,
            alias: card.alias,
            uid: card.uid || '',
            locationId: getLocationId(card) || '',
            lifecycleStatus: (card as any).lifecycle_status ?? 'active',
            securityMode: (card as any).security_mode ?? 'static_uid',
            ndefPayload: (card as any).ndef_payload ?? '',
            active: (card as any).active ?? true,
        });
        setIsFormOpen(true);
    };

    const closeFormModal = () => {
        setIsFormOpen(false);
        setFormState(defaultFormState);
        setEditingCard(null);
    };

    const handleFormChange = (field: keyof CardFormState, value: string | boolean) => {
        setFormState(prev => ({ ...prev, [field]: value }));
    };

    const ensureUniqueId = (id: string) => !cards.some(card => card.id === id);

    const handleSaveCard = async () => {
        if (!formState.alias.trim() || !formState.id.trim()) {
            showToast('error', 'Kart adı ve ID zorunludur');
            return;
        }
        if (formMode === 'create' && !ensureUniqueId(formState.id.trim())) {
            showToast('error', 'Bu Kart ID zaten kullanılıyor');
            return;
        }

        setIsSaving(true);
        const previousLocationId =
            formMode === 'edit' && editingCard ? getLocationId(editingCard) : null;
        const payload: Record<string, any> = {
            alias: formState.alias.trim(),
            uid: formState.uid.trim() || null,
            assignedlocationid: formState.locationId || null,
            lifecycle_status: formState.lifecycleStatus,
            security_mode: formState.securityMode,
            ndef_payload: formState.ndefPayload.trim() || null,
            active: formState.active,
        };

        try {
            let data: NfcCard | null = null;
            if (formMode === 'create') {
                const insertPayload = {
                    ...payload,
                    id: formState.id.trim().toUpperCase(),
                    secretcode: `manual_${Date.now()}`,
                };
                const { data: created, error } = await supabase.from('cards').insert(insertPayload).select().single();
                if (error) throw error;
                data = created as NfcCard;
            } else if (editingCard) {
                const { data: updated, error } = await supabase
                    .from('cards')
                    .update(payload)
                    .eq('id', editingCard.id)
                    .select()
                    .single();
                if (error) throw error;
                data = updated as NfcCard;
            }

            if (data) {
                await persistLocationAssignment(data.id, payload.assignedlocationid, previousLocationId);
                upsertCardWithAssignment(data, payload.assignedlocationid);
            }
            showToast('success', formMode === 'create' ? 'Kart eklendi' : 'Kart güncellendi');
            closeFormModal();
        } catch (error: any) {
            console.error('Kart kaydedilemedi:', error);
            showToast('error', error.message || 'Kart kaydedilemedi');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleActive = async (card: NfcCard, nextActive: boolean) => {
        const previousLocationId = getLocationId(card);
        try {
            const updatePayload: Record<string, any> = { active: nextActive };
            if (!nextActive) updatePayload.assignedlocationid = null;
            const { data, error } = await supabase
                .from('cards')
                .update(updatePayload)
                .eq('id', card.id)
                .select()
                .single();
            if (error) throw error;
            const updated = data as NfcCard;
            if (!nextActive && previousLocationId) {
                await persistLocationAssignment(card.id, null, previousLocationId);
            }
            const nextLocationId = nextActive ? getLocationId(updated) : null;
            upsertCardWithAssignment(updated, nextLocationId);
            showToast('success', nextActive ? 'Kart aktifleştirildi' : 'Kart pasifleştirildi');
        } catch (error: any) {
            console.error('Toggle failed', error);
            showToast('error', error.message || 'Kart güncellenemedi');
        }
    };

    const handleDeleteCard = async () => {
        if (!confirmState.card) return;
        try {
            const previousLocationId = getLocationId(confirmState.card);
            if (previousLocationId) {
                await persistLocationAssignment(confirmState.card!.id, null, previousLocationId);
            }
            const { error } = await supabase.from('cards').delete().eq('id', confirmState.card.id);
            if (error) throw error;
            setNfcCards(prev => prev.filter(card => card.id !== confirmState.card!.id));
            showToast('success', 'Kart silindi');
        } catch (error: any) {
            console.error('Kart silinemedi:', error);
            showToast('error', error.message || 'Kart silinemedi');
        } finally {
            setConfirmState({ type: null, card: null });
        }
    };

    const handleUnassignCard = async () => {
        if (!confirmState.card) return;
        const previousLocationId = getLocationId(confirmState.card);
        try {
            const { data, error } = await supabase
                .from('cards')
                .update({ assignedlocationid: null })
                .eq('id', confirmState.card.id)
                .select()
                .single();
            if (error) throw error;
            if (previousLocationId) {
                await persistLocationAssignment(confirmState.card.id, null, previousLocationId);
            }
            upsertCardWithAssignment(data as NfcCard, null);
            showToast('success', 'Atama kaldırıldı');
        } catch (error: any) {
            console.error('Atama kaldırılamadı:', error);
            showToast('error', error.message || 'Atama kaldırılamadı');
        } finally {
            setConfirmState({ type: null, card: null });
        }
    };

    const getLocationOptionLabel = (location: Location) => {
        const currentCardId = (location as any).nfccardid ?? location.nfcCardId ?? null;
        return currentCardId ? `${location.name} (dolu)` : location.name;
    };

    const renderCard = (card: CardListItem) => {
        const badge = statusConfig[card.status];
        const locationId = card.assignedlocationid;
        const isActive = (card as any).active !== false;
        const locationText = isActive ? (locationId ? card.locationName : 'Atanmamış') : 'Pasif kart';
        const uidText = isActive ? card.uid || '—' : '—';
        const securityText = (card as any).security_mode || 'static_uid';
        const lifecycleText = (card as any).lifecycle_status || 'active';

        return (
            <div
                role="listitem"
                key={card.id}
                className="bg-gray-800 rounded-2xl p-4 space-y-3 shadow-md border border-gray-700/60 cursor-pointer hover:bg-gray-800/80 transition"
                onClick={() => openEditModal(card)}
                onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openEditModal(card);
                    }
                }}
                tabIndex={0}
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-white font-semibold text-base">{card.alias || card.id}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{card.id}</p>
                    </div>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${badge.badge}`}>{badge.label}</span>
                </div>
                <div className="space-y-1 text-sm text-gray-300">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs uppercase tracking-wide">Konum</span>
                        <span className="font-medium">{locationText}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs uppercase tracking-wide">UID</span>
                        <span className="font-mono text-sm text-gray-200">{uidText}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs uppercase tracking-wide">Güvenlik</span>
                        <span className="font-mono text-xs text-gray-200">{securityText}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs uppercase tracking-wide">Yaşam</span>
                        <span className="font-mono text-xs text-gray-200">{lifecycleText}</span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-700/70">
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            openEditModal(card);
                        }}
                        className="flex items-center gap-1 text-sm font-medium text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-full transition-colors"
                    >
                        ✎ Düzenle
                    </button>
                    {card.status === 'assigned' && isActive && (
                        <button
                            onClick={e => {
                                e.stopPropagation();
                                setConfirmState({ type: 'unassign', card });
                            }}
                            className="flex items-center gap-1 text-sm font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-full transition-colors"
                        >
                            🔗 Atamayı Kaldır
                        </button>
                    )}
                    <button
                        onClick={e => {
                            e.stopPropagation();
                            setConfirmState({ type: 'delete', card });
                        }}
                        className="flex items-center gap-1 text-sm font-medium text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-full transition-colors"
                    >
                        <Icons.Trash /> Sil
                    </button>
                    <button
                        role="switch"
                        aria-checked={isActive}
                        aria-label="Aktif/Pasif"
                        onClick={e => {
                            e.stopPropagation();
                            handleToggleActive(card, !isActive);
                        }}
                        className={`ml-auto relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                            isActive ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                isActive ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
            </div>
        );
    };

    const renderGroupHeader = (statusKey: StatusKey, count: number, groupIndex: number) => (
        <div className={groupIndex > 0 ? 'pt-4 mt-4 border-t border-gray-800' : ''}>
            <button
                className="flex w-full items-center justify-between text-left"
                onClick={() => setCollapsedGroups(prev => ({ ...prev, [statusKey]: !prev[statusKey] }))}
            >
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${statusConfig[statusKey].text} bg-current`}></span>
                    <h2 className="text-white font-semibold">{statusConfig[statusKey].label}</h2>
                    <span className="text-xs text-gray-400">({count})</span>
                </div>
                <span className="text-gray-500">{collapsedGroups[statusKey] ? '▼' : '▲'}</span>
            </button>
        </div>
    );

    return (
        <div
            className="space-y-6"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {toast && (
                <div
                    className={`fixed top-6 right-6 z-20 px-4 py-2 rounded-lg shadow-lg text-sm ${
                        toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                    }`}
                >
                    {toast.message}
                </div>
            )}

            <header className="flex items-center justify-between gap-3 bg-gray-800/70 px-4 py-3 rounded-2xl border border-gray-700">
                <div className="flex items-center gap-3">
                    <button
                        aria-label="Geri dön"
                        className="p-2 rounded-full bg-gray-700/60 hover:bg-gray-600 transition"
                        onClick={() => window.history.back()}
                    >
                        ←
                    </button>
                    <div>
                        <p className="text-xs uppercase tracking-widest text-gray-400">Kartlar</p>
                        <h1 className="text-xl font-bold text-white">NFC Kart Yönetimi</h1>
                    </div>
                </div>
                <button
                    aria-label="Menüyü aç"
                    className="p-2 rounded-full bg-gray-700/60 hover:bg-gray-600 transition"
                    onClick={() => document.dispatchEvent(new CustomEvent('toggle-sidebar'))}
                >
                    ☰
                </button>
            </header>

            <div className="grid grid-cols-3 gap-3 summary-row">
                <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
                    <p className="text-xs text-gray-400 uppercase">Toplam</p>
                    <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
                    <p className="text-xs text-gray-400 uppercase">Boşta</p>
                    <p className="text-2xl font-bold text-amber-300">{stats.free}</p>
                </div>
                <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
                    <p className="text-xs text-gray-400 uppercase">Son Senk.</p>
                    <p className="text-lg font-semibold text-white">{formatTime(lastSyncTime)}</p>
                </div>
            </div>

            <div className="flex items-center gap-2 controls-row">
                <div className="flex-1 relative">
                    <input
                        type="search"
                        placeholder="Kart adı, UID veya konum ara"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-2xl py-3 pl-4 pr-10 text-sm text-white placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
                </div>
                <button
                    aria-label="Filtreleri aç"
                    onClick={() => setFiltersOpen(prev => !prev)}
                    className="p-3 rounded-2xl bg-gray-800 border border-gray-700 text-white hover:bg-gray-700 transition"
                >
                    ⚙️
                </button>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-2xl font-semibold transition"
                >
                    <Icons.Plus /> Yeni Kart
                </button>
            </div>

            {filtersOpen && (
                <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700 space-y-3">
                    <div>
                        <label className="text-xs uppercase text-gray-400 mb-1 block">Durum</label>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value as StatusKey | 'all')}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2 text-white text-sm"
                        >
                            <option value="all">Tümü</option>
                            <option value="assigned">Atandı</option>
                            <option value="free">Boşta</option>
                            <option value="inactive">Pasif</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs uppercase text-gray-400 mb-1 block">Konum</label>
                        <select
                            value={locationFilter}
                            onChange={e => setLocationFilter(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2 text-white text-sm"
                        >
                            <option value="all">Tümü</option>
                            {locations.map(location => (
                                <option key={location.id} value={location.id}>
                                    {location.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                <div>
                    {isRefreshing ? 'Yenileniyor...' : pullDistance > 50 ? 'Bırak ve yenile' : 'Aşağı çekerek yenile'}
                </div>
                <button
                    className="text-blue-300 font-semibold"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                >
                    {isRefreshing ? 'Bekleyin…' : 'Yenile'}
                </button>
            </div>

            <div className="space-y-4">
                {virtualEntries.length > 0 ? (
                    <div
                        ref={listParentRef}
                        className="bg-gray-900/40 rounded-2xl border border-gray-800 max-h-[70vh] overflow-y-auto"
                        role="list"
                    >
                        <div
                            style={{
                                height: `${listVirtualizer.getTotalSize()}px`,
                                position: 'relative',
                            }}
                        >
                            {listVirtualizer.getVirtualItems().map(virtualRow => {
                                const entry = virtualEntries[virtualRow.index];
                                if (!entry) return null;
                                const key =
                                    entry.type === 'header'
                                        ? `header-${entry.status}`
                                        : `card-${entry.card.id}`;
                                return (
                                    <div
                                        key={key}
                                        data-index={virtualRow.index}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            transform: `translateY(${virtualRow.start}px)`,
                                            padding: entry.type === 'header' ? '0.5rem 1rem 0 1rem' : '0 1rem 0.75rem 1rem',
                                        }}
                                    >
                                        {entry.type === 'header'
                                            ? renderGroupHeader(entry.status, entry.count, entry.groupIndex)
                                            : renderCard(entry.card)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-gray-500 py-10 bg-gray-900/30 rounded-2xl border border-dashed border-gray-700">
                        Eşleşen kart bulunamadı.
                    </div>
                )}
                <div className="text-center pt-2">
                    {hasMore ? (
                        <button
                            onClick={() => setVisibleCount(prev => prev + 20)}
                            className="px-4 py-2 bg-gray-800 text-white rounded-full border border-gray-700 hover:bg-gray-700 transition"
                        >
                            Daha fazla yükle
                        </button>
                    ) : (
                        <p className="text-xs text-gray-500">Liste sonu</p>
                    )}
                </div>
            </div>

            <Modal
                isOpen={isFormOpen}
                onClose={closeFormModal}
                title={formMode === 'create' ? 'Yeni Kart Ekle' : 'Kartı Düzenle'}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Kart Adı</label>
                        <input
                            type="text"
                            value={formState.alias}
                            onChange={e => handleFormChange('alias', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2 text-white"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Kart ID</label>
                        <input
                            type="text"
                            value={formState.id}
                            onChange={e => handleFormChange('id', e.target.value.toUpperCase())}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2 text-white"
                            required
                            readOnly={formMode === 'edit'}
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">UID (opsiyonel)</label>
                        <input
                            type="text"
                            value={formState.uid}
                            onChange={e => handleFormChange('uid', e.target.value)}
                            placeholder="04:6a:..."
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2 text-white font-mono"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Konum (opsiyonel)</label>
                        <select
                            value={formState.locationId}
                            onChange={e => handleFormChange('locationId', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2 text-white"
                        >
                            <option value="">Seçilmedi</option>
                            {locations.map(location => (
                                <option
                                    key={location.id}
                                    value={location.id}
                                    disabled={
                                        (location as any).nfccardid &&
                                        (location as any).nfccardid !== (editingCard?.id ?? null)
                                    }
                                >
                                    {getLocationOptionLabel(location)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Kart Yaşam Durumu</label>
                        <select
                            value={formState.lifecycleStatus}
                            onChange={e => handleFormChange('lifecycleStatus', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2 text-white"
                        >
                            <option value="pending">Pending</option>
                            <option value="active">Active</option>
                            <option value="lost">Lost</option>
                            <option value="revoked">Revoked</option>
                            <option value="damaged">Damaged</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">Güvenlik Modu</label>
                        <select
                            value={formState.securityMode}
                            onChange={e => handleFormChange('securityMode', e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2 text-white"
                        >
                            <option value="static_uid">ISO 14443-3A UID / Static UID</option>
                            <option value="static_ndef">Static NDEF Secret</option>
                            <option value="rolling_token">Rolling Token</option>
                            <option value="mifare_ultralight_aes">MIFARE Ultralight AES</option>
                            <option value="ntag424_sun">NTAG 424 DNA SUN</option>
                            <option value="desfire">MIFARE DESFire</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-300 mb-1">NDEF Payload / Token</label>
                        <input
                            type="text"
                            value={formState.ndefPayload}
                            onChange={e => handleFormChange('ndefPayload', e.target.value)}
                            placeholder="Optional token written to the card"
                            className="w-full bg-gray-900 border border-gray-700 rounded-xl p-2 text-white font-mono"
                        />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                        <input
                            type="checkbox"
                            checked={formState.active}
                            onChange={e => handleFormChange('active', e.target.checked)}
                        />
                        Kartı aktif yap
                    </label>
                    <div className="flex justify-end gap-2 pt-2 modal-actions">
                        <button
                            onClick={closeFormModal}
                            className="px-4 py-2 rounded-xl border border-gray-600 text-gray-200"
                        >
                            İptal
                        </button>
                        <button
                            onClick={handleSaveCard}
                            disabled={isSaving}
                            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-50"
                        >
                            {isSaving ? 'Kaydediliyor…' : formMode === 'create' ? 'Ekle' : 'Güncelle'}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={confirmState.type === 'delete'}
                onClose={() => setConfirmState({ type: null, card: null })}
                title="Kartı Sil?"
            >
                <p className="text-sm text-gray-300 mb-4">
                    Bu kartı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
                </p>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => setConfirmState({ type: null, card: null })}
                        className="px-4 py-2 rounded-xl border border-gray-600 text-gray-200"
                    >
                        Vazgeç
                    </button>
                    <button
                        onClick={handleDeleteCard}
                        className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold"
                    >
                        Sil
                    </button>
                </div>
            </Modal>

            <Modal
                isOpen={confirmState.type === 'unassign'}
                onClose={() => setConfirmState({ type: null, card: null })}
                title="Atamayı Kaldır?"
            >
                <p className="text-sm text-gray-300 mb-4">Kartın atamasını kaldırmak istiyor musunuz?</p>
                <div className="flex justify-end gap-2">
                    <button
                        onClick={() => setConfirmState({ type: null, card: null })}
                        className="px-4 py-2 rounded-xl border border-gray-600 text-gray-200"
                    >
                        İptal
                    </button>
                    <button
                        onClick={handleUnassignCard}
                        className="px-4 py-2 rounded-xl bg-amber-600 text-white font-semibold"
                    >
                        Atamayı Kaldır
                    </button>
                </div>
            </Modal>
        </div>
    );
};
