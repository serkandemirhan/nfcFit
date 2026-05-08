import React, { FC, useMemo, useState } from 'react';
import { ExerciseType, User, UserExercise } from '../types';
import { Icons } from '../components/Icons';
import { supabase } from '../supabaseClient';

type ExerciseCategory = ExerciseType['category'];
type ExerciseUnit = ExerciseType['unit'];

const categoryLabels: Record<ExerciseCategory, string> = {
    strength: 'Güç',
    core: 'Core',
    cardio: 'Kardiyo',
    mobility: 'Mobilite',
    rehab: 'Rehabilitasyon',
    other: 'Diğer',
};

const unitLabels: Record<ExerciseUnit, string> = {
    repetition: 'tekrar',
    seconds: 'sn',
    minutes: 'dk',
    meters: 'm',
};

export const ExercisesPage: FC<{
    exerciseTypes: ExerciseType[];
    userExercises: UserExercise[];
    users: User[];
    setUserExercises: React.Dispatch<React.SetStateAction<UserExercise[]>>;
}> = ({ exerciseTypes, userExercises, users, setUserExercises }) => {
    const activeUserId = users[0]?.id ?? 'u1';
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<ExerciseCategory | 'all'>('all');
    const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const selectedIds = useMemo(
        () => new Set(userExercises.filter(item => item.user_id === activeUserId && item.active !== false).map(item => item.exercise_type_id)),
        [activeUserId, userExercises]
    );

    const myExercises = useMemo(
        () => exerciseTypes.filter(exercise => selectedIds.has(exercise.id)).sort((a, b) => a.name.localeCompare(b.name, 'tr')),
        [exerciseTypes, selectedIds]
    );

    const libraryExercises = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        return exerciseTypes
            .filter(exercise => {
                if (selectedIds.has(exercise.id)) return false;
                if (categoryFilter !== 'all' && exercise.category !== categoryFilter) return false;
                if (!normalizedSearch) return true;
                return [exercise.name, exercise.category, exercise.unit].some(value => value.toLowerCase().includes(normalizedSearch));
            })
            .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    }, [categoryFilter, exerciseTypes, searchTerm, selectedIds]);

    const showToast = (type: 'success' | 'error', message: string) => {
        setToast({ type, message });
        window.setTimeout(() => setToast(null), 3200);
    };

    const addExercise = async (exercise: ExerciseType) => {
        setSavingExerciseId(exercise.id);
        const payload: UserExercise = {
            user_id: activeUserId,
            exercise_type_id: exercise.id,
            active: true,
        };
        try {
            const { data, error } = await supabase
                .from('user_exercises')
                .upsert(payload, { onConflict: 'user_id,exercise_type_id' })
                .select()
                .single();
            if (error) throw error;
            setUserExercises(prev => [
                ...prev.filter(item => !(item.user_id === activeUserId && item.exercise_type_id === exercise.id)),
                (data as UserExercise) ?? payload,
            ]);
            showToast('success', `${exercise.name} listene eklendi.`);
        } catch (error: any) {
            const message = String(error?.message ?? '');
            const isLocalBackendGap = message.includes('/api/user_exercises') || message.includes('404') || message.includes('Failed to fetch');
            if (isLocalBackendGap) {
                setUserExercises(prev => [
                    ...prev.filter(item => !(item.user_id === activeUserId && item.exercise_type_id === exercise.id)),
                    payload,
                ]);
                showToast('success', `${exercise.name} listene eklendi. Supabase env baglaninca kalici kaydedilir.`);
            } else {
                showToast('error', message || 'Egzersiz eklenemedi. Supabase schema güncel mi kontrol et.');
            }
        } finally {
            setSavingExerciseId(null);
        }
    };

    const removeExercise = async (exercise: ExerciseType) => {
        setSavingExerciseId(exercise.id);
        try {
            const { error } = await supabase
                .from('user_exercises')
                .delete()
                .eq('user_id', activeUserId)
                .eq('exercise_type_id', exercise.id);
            if (error) throw error;
            setUserExercises(prev => prev.filter(item => !(item.user_id === activeUserId && item.exercise_type_id === exercise.id)));
            showToast('success', `${exercise.name} listenden çıkarıldı.`);
        } catch (error: any) {
            const message = String(error?.message ?? '');
            const isLocalBackendGap = message.includes('/api/user_exercises') || message.includes('404') || message.includes('Failed to fetch');
            if (isLocalBackendGap) {
                setUserExercises(prev => prev.filter(item => !(item.user_id === activeUserId && item.exercise_type_id === exercise.id)));
                showToast('success', `${exercise.name} listenden çıkarıldı. Supabase env baglaninca kalici kaydedilir.`);
            } else {
                showToast('error', message || 'Egzersiz listenden çıkarılamadı.');
            }
        } finally {
            setSavingExerciseId(null);
        }
    };

    const ExerciseMeta: FC<{ exercise: ExerciseType }> = ({ exercise }) => (
        <div className="flex flex-wrap gap-2 mt-2 text-xs">
            <span className="px-2 py-1 rounded-md bg-gray-900 text-gray-300">{categoryLabels[exercise.category]}</span>
            <span className="px-2 py-1 rounded-md bg-gray-900 text-gray-300">{unitLabels[exercise.unit]}</span>
            <span className="px-2 py-1 rounded-md bg-gray-900 text-gray-300">{exercise.default_calorie_per_unit ?? 0} kcal / birim</span>
        </div>
    );

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                    <p className="text-sm font-semibold text-blue-300">Hazır egzersiz kütüphanesi</p>
                    <h1 className="text-3xl font-bold text-white">Egzersizler</h1>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px] gap-2 w-full md:w-auto">
                    <input
                        type="search"
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                        placeholder="Kütüphanede ara"
                        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-blue-500 focus:border-blue-500"
                    />
                    <select
                        value={categoryFilter}
                        onChange={event => setCategoryFilter(event.target.value as ExerciseCategory | 'all')}
                        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="all">Tüm kategoriler</option>
                        {Object.entries(categoryLabels).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {toast && (
                <div className={`mb-5 rounded-lg px-4 py-3 text-sm border ${toast.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-200' : 'bg-red-500/10 border-red-500/30 text-red-200'}`}>
                    {toast.message}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
                <section className="bg-gray-800 rounded-lg p-5 shadow-lg">
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <h2 className="text-lg font-semibold text-white">Benim Egzersizlerim</h2>
                        <span className="text-sm text-gray-400">{myExercises.length}</span>
                    </div>
                    {myExercises.length === 0 ? (
                        <p className="text-gray-400">Kütüphaneden yaptığın egzersizleri seç.</p>
                    ) : (
                        <div className="space-y-3">
                            {myExercises.map(exercise => (
                                <div key={exercise.id} className="bg-gray-900/55 border border-gray-700 rounded-lg p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-white">{exercise.name}</p>
                                            <ExerciseMeta exercise={exercise} />
                                        </div>
                                        <button
                                            onClick={() => removeExercise(exercise)}
                                            disabled={savingExerciseId === exercise.id}
                                            className="px-3 py-1.5 rounded-md bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-sm text-white"
                                        >
                                            Çıkar
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="bg-gray-800 rounded-lg shadow-lg overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between gap-4">
                        <h2 className="text-lg font-semibold text-white">Genel Kütüphane</h2>
                        <span className="text-sm text-gray-400">{libraryExercises.length} seçilebilir</span>
                    </div>
                    {libraryExercises.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">Filtreye uygun seçilebilir egzersiz yok.</div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-5">
                            {libraryExercises.map(exercise => (
                                <div key={exercise.id} className="bg-gray-900/55 border border-gray-700 rounded-lg p-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-white">{exercise.name}</p>
                                            <ExerciseMeta exercise={exercise} />
                                        </div>
                                        <button
                                            onClick={() => addExercise(exercise)}
                                            disabled={savingExerciseId === exercise.id}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold text-white"
                                        >
                                            <Icons.Plus />
                                            Seç
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
