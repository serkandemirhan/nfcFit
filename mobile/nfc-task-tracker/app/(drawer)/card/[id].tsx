import Ionicons from '@expo/vector-icons/Ionicons';
import { Picker } from '@react-native-picker/picker';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import type React from 'react';

import { AppBottomNav, bottomNavHeight } from '@/components/app-bottom-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Card,
  ExerciseUnit,
  TagActionDomain,
  TagUnit,
  WellnessUnit,
  fetchCardById,
  fetchExerciseTypes,
  fetchUserExercises,
  fetchWellnessTypes,
  updateCardAction,
} from '@/lib/api';

type CardForm = {
  name: string;
  actionDomain: TagActionDomain;
  exerciseTypeId: string;
  wellnessTypeId: string;
  quantity: string;
  unit: TagUnit;
  isActive: boolean;
};

const fitnessUnits: { value: ExerciseUnit; label: string }[] = [
  { value: 'repetition', label: 'tekrar' },
  { value: 'seconds', label: 'saniye' },
  { value: 'minutes', label: 'dakika' },
  { value: 'meters', label: 'metre' },
];

const wellnessUnits: { value: WellnessUnit; label: string }[] = [
  { value: 'ml', label: 'ml' },
  { value: 'cups', label: 'bardak' },
  { value: 'minutes', label: 'dakika' },
  { value: 'count', label: 'adet' },
];

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const surface = getSurfaceColors(colorScheme);
  const textColor = colorScheme === 'dark' ? '#ECEFF7' : '#0F172A';
  const userId = user?.id ?? 'u1';

  const [form, setForm] = useState<CardForm>({
    name: '',
    actionDomain: 'fitness',
    exerciseTypeId: '',
    wellnessTypeId: '',
    quantity: '10',
    unit: 'repetition',
    isActive: true,
  });

  const cardQuery = useQuery({ queryKey: ['card', id], queryFn: () => fetchCardById(id ?? ''), enabled: Boolean(id) });
  const exerciseTypesQuery = useQuery({ queryKey: ['exercise_types'], queryFn: fetchExerciseTypes });
  const userExercisesQuery = useQuery({ queryKey: ['user_exercises', userId], queryFn: () => fetchUserExercises(userId) });
  const wellnessTypesQuery = useQuery({ queryKey: ['wellness_types'], queryFn: fetchWellnessTypes });

  const exerciseTypes = useMemo(() => {
    const selected = new Set((userExercisesQuery.data ?? []).filter((item) => item.active !== false).map((item) => item.exercise_type_id));
    const types = exerciseTypesQuery.data ?? [];
    const userTypes = types.filter((type) => selected.has(type.id));
    return userTypes.length > 0 ? userTypes : types;
  }, [exerciseTypesQuery.data, userExercisesQuery.data]);
  const wellnessTypes = wellnessTypesQuery.data ?? [];

  useEffect(() => {
    const card = cardQuery.data;
    if (!card) return;
    const nextDomain = card.action_domain === 'wellness' || card.action_domain === 'fitness' ? card.action_domain : 'fitness';
    const nextExercise = card.exercise_type_id ?? exerciseTypes[0]?.id ?? '';
    const nextWellness = card.wellness_type_id ?? wellnessTypes[0]?.id ?? '';
    const selectedExercise = exerciseTypes.find((type) => type.id === nextExercise);
    const selectedWellness = wellnessTypes.find((type) => type.id === nextWellness);

    setForm({
      name: card.alias || card.name || '',
      actionDomain: nextDomain,
      exerciseTypeId: nextExercise,
      wellnessTypeId: nextWellness,
      quantity: card.quantity ? String(card.quantity) : nextDomain === 'wellness' ? '500' : '10',
      unit: (card.unit as TagUnit | null) ?? (nextDomain === 'wellness' ? selectedWellness?.unit ?? 'ml' : selectedExercise?.unit ?? 'repetition'),
      isActive: card.active !== false,
    });
  }, [cardQuery.data, exerciseTypes, wellnessTypes]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const quantity = Number(form.quantity);
      if (!form.name.trim() || quantity <= 0) {
        throw new Error('Tag ismi ve miktar zorunludur.');
      }
      if (form.actionDomain === 'fitness' && !form.exerciseTypeId) {
        throw new Error('Bir egzersiz seçmelisin.');
      }
      if (form.actionDomain === 'wellness' && !form.wellnessTypeId) {
        throw new Error('Bir wellness aksiyonu seçmelisin.');
      }
      const selectedExercise = exerciseTypes.find((type) => type.id === form.exerciseTypeId);
      return updateCardAction({
        id: id ?? '',
        name: form.name.trim(),
        actionDomain: form.actionDomain,
        exerciseTypeId: form.actionDomain === 'fitness' ? form.exerciseTypeId : null,
        wellnessTypeId: form.actionDomain === 'wellness' ? form.wellnessTypeId : null,
        quantity,
        unit: form.unit,
        calorieEstimate:
          form.actionDomain === 'fitness'
            ? Number((quantity * Number(selectedExercise?.default_calorie_per_unit ?? 0)).toFixed(2))
            : null,
        isActive: form.isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card', id] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      Alert.alert('Başarılı', 'NFC tag güncellendi');
    },
    onError: (error: Error) => Alert.alert('Hata', error.message || 'NFC tag güncellenemedi'),
  });

  const card = cardQuery.data as Card | null | undefined;

  if (!id || cardQuery.isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>{id ? 'Yükleniyor...' : 'NFC tag bulunamadı'}</ThemedText>
      </ThemedView>
    );
  }

  if (cardQuery.error || !card) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">NFC tag getirilemedi</ThemedText>
        <ThemedText style={styles.retry} onPress={() => cardQuery.refetch()}>Tekrar dene</ThemedText>
      </ThemedView>
    );
  }

  const selectedExercise = exerciseTypes.find((type) => type.id === form.exerciseTypeId);
  const selectedWellness = wellnessTypes.find((type) => type.id === form.wellnessTypeId);
  const unitOptions = form.actionDomain === 'wellness' ? wellnessUnits : fitnessUnits;
  const actionName = card.action_domain === 'wellness' ? card.wellness_name : card.exercise_name;

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.headerCard, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color={textColor} />
            </Pressable>
            <View style={styles.headerText}>
              <ThemedText style={styles.title}>{card.alias || 'Yeni NFC Tag'}</ThemedText>
              <ThemedText style={[styles.subtitle, { color: surface.mutedText }]}>
                {actionName ? `${formatDomain(card.action_domain)} · ${actionName}` : 'Henüz aksiyona bağlı değil'}
              </ThemedText>
            </View>
            <StatusChip card={card} />
          </View>
        </View>

        <View style={[styles.formCard, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <Field label="Tag adı">
            <TextInput
              value={form.name}
              onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
              placeholder="Su Tag'i"
              placeholderTextColor={surface.mutedText}
              style={[styles.input, { borderColor: surface.border, color: surface.text }]}
            />
          </Field>

          <View style={styles.segment}>
            <SegmentButton active={form.actionDomain === 'fitness'} label="Fitness" onPress={() => {
              const nextType = selectedExercise ?? exerciseTypes[0];
              setForm((prev) => ({ ...prev, actionDomain: 'fitness', unit: nextType?.unit ?? 'repetition', quantity: prev.quantity || '10' }));
            }} />
            <SegmentButton active={form.actionDomain === 'wellness'} label="Wellness" onPress={() => {
              const nextType = selectedWellness ?? wellnessTypes[0];
              setForm((prev) => ({ ...prev, actionDomain: 'wellness', unit: nextType?.unit ?? 'ml', quantity: prev.quantity || '500' }));
            }} />
          </View>

          {form.actionDomain === 'fitness' ? (
            <Field label="Egzersiz">
              <View style={[styles.pickerWrap, { borderColor: surface.border }]}>
                <Picker
                  selectedValue={form.exerciseTypeId}
                  onValueChange={(value) => {
                    const nextType = exerciseTypes.find((type) => type.id === value);
                    setForm((prev) => ({ ...prev, exerciseTypeId: value, unit: nextType?.unit ?? prev.unit }));
                  }}>
                  {exerciseTypes.map((type) => <Picker.Item key={type.id} label={type.name} value={type.id} />)}
                </Picker>
              </View>
            </Field>
          ) : (
            <Field label="Wellness aksiyonu">
              <View style={[styles.pickerWrap, { borderColor: surface.border }]}>
                <Picker
                  selectedValue={form.wellnessTypeId}
                  onValueChange={(value) => {
                    const nextType = wellnessTypes.find((type) => type.id === value);
                    setForm((prev) => ({ ...prev, wellnessTypeId: value, unit: nextType?.unit ?? prev.unit }));
                  }}>
                  {wellnessTypes.map((type) => <Picker.Item key={type.id} label={type.name} value={type.id} />)}
                </Picker>
              </View>
            </Field>
          )}

          <View style={styles.twoCol}>
            <Field label="Miktar">
              <TextInput
                value={form.quantity}
                onChangeText={(quantity) => setForm((prev) => ({ ...prev, quantity }))}
                keyboardType="numeric"
                style={[styles.input, { borderColor: surface.border, color: surface.text }]}
              />
            </Field>
            <Field label="Birim">
              <View style={[styles.pickerWrap, { borderColor: surface.border }]}>
                <Picker selectedValue={form.unit} onValueChange={(unit) => setForm((prev) => ({ ...prev, unit }))}>
                  {unitOptions.map((option) => <Picker.Item key={option.value} label={option.label} value={option.value} />)}
                </Picker>
              </View>
            </Field>
          </View>

          <View style={styles.activeRow}>
            <View>
              <ThemedText style={styles.label}>Aktif</ThemedText>
              <ThemedText style={[styles.hint, { color: surface.mutedText }]}>Kapalı olursa okutunca kayıt oluşturmaz.</ThemedText>
            </View>
            <Switch value={form.isActive} onValueChange={(isActive) => setForm((prev) => ({ ...prev, isActive }))} />
          </View>

          <Pressable style={styles.saveButton} onPress={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <ThemedText style={styles.saveText}>{saveMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}</ThemedText>
          </Pressable>
        </View>

        <View style={[styles.miniCard, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <Ionicons name="card-outline" size={18} color={surface.mutedText} />
          <ThemedText style={[styles.uidText, { color: surface.mutedText }]}>{shortUid(card.uid)}</ThemedText>
        </View>
      </ScrollView>
      <AppBottomNav />
    </ThemedView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      {children}
    </View>
  );
}

function SegmentButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.segmentButton, active && styles.segmentButtonActive]} onPress={onPress}>
      <ThemedText style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</ThemedText>
    </Pressable>
  );
}

function StatusChip({ card }: { card: Card }) {
  const active = card.active !== false;
  const ready = active && (card.action_domain === 'fitness' || card.action_domain === 'wellness');
  const label = !active ? 'Pasif' : ready ? 'Hazır' : 'Kurulum';
  const style = !active ? styles.statusInactive : ready ? styles.statusReady : styles.statusPending;
  return (
    <View style={[styles.statusChip, style]}>
      <ThemedText style={styles.statusText}>{label}</ThemedText>
    </View>
  );
}

function formatDomain(domain?: string | null) {
  if (domain === 'wellness') return 'Wellness';
  if (domain === 'fitness') return 'Fitness';
  return 'Kurulum';
}

function shortUid(uid?: string | null) {
  if (!uid) return 'UID yok';
  if (uid.length <= 18) return `UID ${uid}`;
  return `UID ${uid.slice(0, 8)}...${uid.slice(-6)}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  retry: { color: '#2563eb', fontWeight: '700' },
  content: { padding: 14, paddingBottom: bottomNavHeight + 24, gap: 12 },
  headerCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  statusReady: { backgroundColor: '#22c55e' },
  statusPending: { backgroundColor: '#f59e0b' },
  statusInactive: { backgroundColor: '#ef4444' },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  formCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 14 },
  field: { flex: 1, gap: 7 },
  label: { fontSize: 13, fontWeight: '800' },
  hint: { fontSize: 12, marginTop: 2 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  pickerWrap: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  segment: { flexDirection: 'row', padding: 4, borderRadius: 12, backgroundColor: 'rgba(148,163,184,0.18)', gap: 4 },
  segmentButton: { flex: 1, borderRadius: 9, paddingVertical: 10, alignItems: 'center' },
  segmentButtonActive: { backgroundColor: '#22c55e' },
  segmentText: { fontSize: 13, fontWeight: '800', opacity: 0.75 },
  segmentTextActive: { color: '#fff', opacity: 1 },
  twoCol: { flexDirection: 'row', gap: 10 },
  activeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  saveButton: { backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  miniCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  uidText: { fontSize: 12 },
});
