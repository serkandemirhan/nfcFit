import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import { AppBottomNav, bottomNavHeight } from '@/components/app-bottom-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ExerciseType, fetchDailyGoalProgress, fetchExerciseLogs, fetchExerciseTypes, fetchUserExercises, fetchWellnessLogs, fetchWellnessGoals, updateDailyGoal } from '@/lib/api';

export default function TodayScreen() {
  const surface = getSurfaceColors(useColorScheme());
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? 'u1';
  const logsQuery = useQuery({ queryKey: ['exercise_logs', userId], queryFn: () => fetchExerciseLogs(userId) });
  const goalsQuery = useQuery({ queryKey: ['daily_goal_progress', userId], queryFn: () => fetchDailyGoalProgress(userId) });
  const exerciseTypesQuery = useQuery({ queryKey: ['exercise_types'], queryFn: fetchExerciseTypes });
  const userExercisesQuery = useQuery({ queryKey: ['user_exercises', userId], queryFn: () => fetchUserExercises(userId) });
  const wellnessLogsQuery = useQuery({ queryKey: ['wellness_logs', userId], queryFn: () => fetchWellnessLogs(userId) });
  const wellnessGoalsQuery = useQuery({ queryKey: ['wellness_goals', userId], queryFn: () => fetchWellnessGoals(userId) });
  const [goalDrafts, setGoalDrafts] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'overview' | 'fitness' | 'wellness'>('overview');

  const logs = logsQuery.data ?? [];
  const goals = goalsQuery.data ?? [];
  const selectedExerciseIds = useMemo(
    () => new Set((userExercisesQuery.data ?? []).filter((item) => item.active !== false).map((item) => item.exercise_type_id)),
    [userExercisesQuery.data]
  );
  const selectedExercises = useMemo(
    () => (exerciseTypesQuery.data ?? []).filter((exercise) => selectedExerciseIds.has(exercise.id)),
    [exerciseTypesQuery.data, selectedExerciseIds]
  );
  const todayLogs = logs.filter((log) => isToday(log.createdat));
  const totalQuantity = todayLogs.reduce((sum, log) => sum + Number(log.quantity ?? 0), 0);
  const totalCalories = todayLogs.reduce((sum, log) => sum + Number(log.calorie_estimate ?? 0), 0);
  const todayWellnessLogs = (wellnessLogsQuery.data ?? []).filter((log) => isToday(log.createdat));
  const waterTotal = todayWellnessLogs
    .filter((log) => log.wellness_type_id === 'water')
    .reduce((sum, log) => sum + Number(log.quantity ?? 0), 0);
  const wellnessDone = todayWellnessLogs.length;
  const lastTag = todayLogs.find((log) => log.source === 'nfc') ?? logs.find((log) => log.source === 'nfc');
  const refreshing = logsQuery.isRefetching || goalsQuery.isRefetching || exerciseTypesQuery.isRefetching || userExercisesQuery.isRefetching || wellnessLogsQuery.isRefetching || wellnessGoalsQuery.isRefetching;

  useEffect(() => {
    setGoalDrafts((prev) => {
      const next = { ...prev };
      selectedExercises.forEach((exercise) => {
        const goal = goals.find((item) => item.exercise_type_id === exercise.id);
        if (next[exercise.id] == null) next[exercise.id] = goal?.target_quantity ? String(Number(goal.target_quantity)) : '';
      });
      return next;
    });
  }, [goals, selectedExercises]);

  const goalMutation = useMutation({
    mutationFn: ({ exercise, target }: { exercise: ExerciseType; target: number }) =>
      updateDailyGoal({ userId, exerciseTypeId: exercise.id, targetQuantity: target, unit: exercise.unit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily_goal_progress', userId] });
    },
  });

  const onRefresh = () => {
    logsQuery.refetch();
    goalsQuery.refetch();
    exerciseTypesQuery.refetch();
    userExercisesQuery.refetch();
    wellnessLogsQuery.refetch();
    wellnessGoalsQuery.refetch();
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}> 
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.header}>
          <ThemedText style={styles.eyebrow}>Good Morning, {user?.name ?? 'Serkan'} 👋</ThemedText>
          <ThemedText style={styles.title}>Bugün</ThemedText>
        </View>

        <View style={[styles.tabs, { backgroundColor: surface.card, borderColor: surface.border }]}>
          {(['overview', 'fitness', 'wellness'] as const).map((value) => (
            <Pressable key={value} onPress={() => setTab(value)} style={[styles.tabButton, tab === value && styles.tabButtonActive]}>
              <ThemedText style={[styles.tabText, tab === value && styles.tabTextActive]}>
                {value === 'overview' ? 'Overview' : value === 'fitness' ? 'Fitness' : 'Wellness'}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText style={styles.blockLabel}>Today Summary</ThemedText>
        <View style={styles.summaryGrid}>
          <SummaryCard icon="flame" label="Workouts" value={`${Math.round(totalCalories)} kcal`} />
          <SummaryCard icon="timer-outline" label="Active Time" value={`${todayLogs.length * 15} min`} />
          <SummaryCard icon="walk" label="Steps" value={formatNumber(totalQuantity)} />
          <SummaryCard icon="water" label="Water" value={`${formatNumber(waterTotal / 1000)} L`} />
        </View>

        <Pressable style={styles.scanButton} onPress={() => router.push('/(drawer)/nfc')}>
          <Ionicons name="scan-outline" size={30} color="#fff" />
          <ThemedText style={styles.scanButtonText}>NFC Tara</ThemedText>
        </Pressable>

        {(tab === 'overview' || tab === 'fitness') && <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}> 
          <ThemedText style={styles.sectionTitle}>Günlük hedef ilerlemesi</ThemedText>
          {selectedExercises.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: surface.mutedText }]}>Önce Egzersizler ekranından egzersiz seç.</ThemedText>
          ) : (
            selectedExercises.map((exercise) => {
              const goal = goals.find((item) => item.exercise_type_id === exercise.id);
              const completed = Number(goal?.completed_quantity ?? todayLogs
                .filter((log) => log.exercise_type_id === exercise.id)
                .reduce((sum, log) => sum + Number(log.quantity ?? 0), 0));
              const target = Number(goal?.target_quantity ?? 0);
              const unit = goal?.unit ?? exercise.unit;
              const progress = target > 0 ? Math.min(1, completed / target) : 0;
              return (
                <View key={exercise.id} style={styles.goalRow}>
                  <View style={styles.goalHeader}>
                    <ThemedText style={styles.goalName}>{exercise.name}</ThemedText>
                    <ThemedText style={[styles.goalValue, { color: surface.mutedText }]}> 
                      {target > 0 ? `${formatQuantity(completed, unit)} / ${formatQuantity(target, unit)}` : `${formatQuantity(completed, unit)} bugün`}
                    </ThemedText>
                  </View>
                  <View style={styles.goalEditRow}>
                    <TextInput
                      value={goalDrafts[exercise.id] ?? ''}
                      onChangeText={(value) => setGoalDrafts((prev) => ({ ...prev, [exercise.id]: value }))}
                      keyboardType="numeric"
                      placeholder="Hedef"
                      placeholderTextColor={surface.mutedText}
                      style={[styles.goalInput, { borderColor: surface.border, color: surface.text }]}
                    />
                    <Pressable
                      style={[styles.goalSaveButton, goalMutation.isPending && styles.goalSaveButtonDisabled]}
                      disabled={goalMutation.isPending || Number(goalDrafts[exercise.id]) <= 0}
                      onPress={() => goalMutation.mutate({ exercise, target: Number(goalDrafts[exercise.id]) })}>
                      <ThemedText style={styles.goalSaveText}>Kaydet</ThemedText>
                    </Pressable>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                  </View>
                </View>
              );
            })
          )}
        </View>}

        {(tab === 'overview' || tab === 'wellness') && <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}> 
          <ThemedText style={styles.sectionTitle}>Wellness ilerlemesi</ThemedText>
          {(wellnessGoalsQuery.data ?? []).slice(0, 5).map((goal) => {
            const completed = todayWellnessLogs
              .filter((log) => log.wellness_type_id === goal.wellness_type_id)
              .reduce((sum, log) => sum + Number(log.quantity ?? 0), 0);
            const progress = goal.target_quantity > 0 ? Math.min(1, completed / Number(goal.target_quantity)) : 0;
            return (
              <View key={goal.wellness_type_id} style={styles.goalRow}>
                <View style={styles.goalHeader}>
                  <ThemedText style={styles.goalName}>{formatWellnessName(goal.wellness_type_id)}</ThemedText>
                  <ThemedText style={[styles.goalValue, { color: surface.mutedText }]}>
                    {formatWellnessQuantity(completed, goal.unit)} / {formatWellnessQuantity(goal.target_quantity, goal.unit)}
                  </ThemedText>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFillPurple, { width: `${progress * 100}%` }]} />
                </View>
              </View>
            );
          })}
          {wellnessDone === 0 && <ThemedText style={[styles.emptyText, { color: surface.mutedText }]}>Bugün wellness kaydı yok.</ThemedText>}
        </View>}

        <View style={[styles.section, { backgroundColor: 'rgba(7,24,39,0.90)', borderColor: surface.border }]}> 
          <ThemedText style={styles.sectionTitle}>Son okutulan NFC tag</ThemedText>
          {lastTag ? (
            <View style={styles.lastTagRow}>
              <Ionicons name="radio-outline" size={22} color="#2563eb" />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.lastTagTitle}>{lastTag.exercise_name}</ThemedText>
                <ThemedText style={[styles.lastTagMeta, { color: surface.mutedText }]}> 
                  {formatQuantity(lastTag.quantity, lastTag.unit)} · {formatTime(lastTag.createdat)}
                </ThemedText>
              </View>
            </View>
          ) : (
            <ThemedText style={[styles.emptyText, { color: surface.mutedText }]}>Bugün NFC tag okutulmadı.</ThemedText>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}> 
          <ThemedText style={styles.sectionTitle}>Bugünkü aktiviteler</ThemedText>
          {todayLogs.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: surface.mutedText }]}>İlk egzersizi kaydetmek için NFC Tara.</ThemedText>
          ) : (
            todayLogs.slice(0, 5).map((log) => (
              <View key={log.id} style={styles.activityRow}>
                <ThemedText style={styles.activityTitle}>{formatQuantity(log.quantity, log.unit)} {log.exercise_name}</ThemedText>
                <ThemedText style={[styles.activityMeta, { color: surface.mutedText }]}>{formatTime(log.createdat)} · {log.source === 'nfc' ? 'NFC Tag' : 'Manuel'}</ThemedText>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <AppBottomNav />
    </ThemedView>
  );
}

function SummaryCard({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.summaryCard}>
      <Ionicons name={icon} size={24} color={icon === 'water' ? '#4AA3FF' : icon === 'flame' ? '#F59E0B' : '#35D353'} />
      <View>
        <ThemedText style={styles.summaryLabel}>{label}</ThemedText>
        <ThemedText style={styles.summaryValue}>{value}</ThemedText>
      </View>
    </View>
  );
}

function isToday(value: string) {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

function formatQuantity(quantity?: number | null, unit?: string | null) {
  const value = formatNumber(quantity ?? 0);
  if (unit === 'seconds') return `${value} sn`;
  if (unit === 'minutes') return `${value} dk`;
  if (unit === 'meters') return `${value} m`;
  return `${value} tekrar`;
}

function formatNumber(value: number) {
  return Number(value).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatWellnessName(id: string) {
  if (id === 'water') return 'Water';
  if (id === 'coffee') return 'Coffee';
  if (id === 'meditation') return 'Meditation';
  if (id === 'walk_break') return 'Walk Breaks';
  if (id === 'vitamins') return 'Vitamins';
  return id;
}

function formatWellnessQuantity(quantity?: number | null, unit?: string | null) {
  const value = Number(quantity ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  if (unit === 'ml') return `${value} ml`;
  if (unit === 'cups') return `${value} cups`;
  if (unit === 'minutes') return `${value} min`;
  return value;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 14, paddingBottom: bottomNavHeight + 24, gap: 14 },
  header: { gap: 2 },
  eyebrow: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  title: { fontSize: 13, fontWeight: '700', color: '#8EA0B8' },
  tabs: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 4 },
  tabButton: { flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  tabButtonActive: { backgroundColor: '#35D353' },
  tabText: { fontSize: 12, fontWeight: '800', opacity: 0.7 },
  tabTextActive: { color: '#fff', opacity: 1 },
  blockLabel: { fontSize: 13, fontWeight: '900', marginTop: 2 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: { width: '48.8%', borderRadius: 10, padding: 12, backgroundColor: 'rgba(11,31,50,0.92)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(148,163,184,0.14)', flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryValue: { fontSize: 17, fontWeight: '900' },
  summaryLabel: { fontSize: 11, opacity: 0.7, marginBottom: 2 },
  scanButton: { minHeight: 66, borderRadius: 14, backgroundColor: '#35D353', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  scanButtonText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  section: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 14, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  emptyText: { fontSize: 13 },
  goalRow: { gap: 7 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  goalName: { fontWeight: '700' },
  goalValue: { fontSize: 12, fontWeight: '700' },
  goalEditRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  goalInput: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontWeight: '700' },
  goalSaveButton: { borderRadius: 10, backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 9 },
  goalSaveButtonDisabled: { opacity: 0.5 },
  goalSaveText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: 'rgba(148,163,184,0.22)', overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: '#35D353' },
  progressFillPurple: { height: 8, borderRadius: 999, backgroundColor: '#8b5cf6' },
  lastTagRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lastTagTitle: { fontSize: 15, fontWeight: '800' },
  lastTagMeta: { fontSize: 12 },
  activityRow: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(148,163,184,0.22)', gap: 2 },
  activityTitle: { fontWeight: '800' },
  activityMeta: { fontSize: 12 },
});
