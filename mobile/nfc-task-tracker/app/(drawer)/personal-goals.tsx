import { OfflineSyncStatus } from '@/components/offline-sync-status';
import { MemberDailyGuide } from '@/components/member-daily-guide';
import { MemberTenantGoals } from '@/components/member-tenant-goals';
import { useMemberFitness } from '@/hooks/use-member-fitness';
import { useMemberActivities } from '@/hooks/use-member-activities';
import { combineMemberExerciseLogs, recordedMinutes } from '@/lib/member-activity';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router } from 'expo-router';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import { AppBottomNav, bottomNavHeight } from '@/components/app-bottom-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { canOpenManagement, isCoach, useTenantIdentity } from '@/hooks/use-tenant-identity';
import { tenantConsoleConfigured } from '@/lib/tenant-console';
import { ManagementButton, ManagementCard, ManagementMessage, errorMessage } from '@/components/management-ui';
import {
  DailyGoalProgress,
  ExerciseLog,
  ExerciseType,
  UserExercise,
  WellnessGoal,
  WellnessLog,
  fetchDailyGoalProgress,
  fetchExerciseLogs,
  fetchExerciseTypes,
  fetchUserExercises,
  fetchWellnessLogs,
  fetchWellnessGoals,
  updateDailyGoal,
} from '@/lib/api';

const emptyExerciseLogs: ExerciseLog[] = [];
const emptyGoalProgress: DailyGoalProgress[] = [];
const emptyExerciseTypes: ExerciseType[] = [];
const emptyUserExercises: UserExercise[] = [];
const emptyWellnessLogs: WellnessLog[] = [];
const emptyWellnessGoals: WellnessGoal[] = [];

export default function HomeScreen() {
  const surface = getSurfaceColors(useColorScheme());
  const identity = useTenantIdentity();

  if (tenantConsoleConfigured && identity.isPending) return <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
    <ActivityIndicator color={surface.green} /><ThemedText>Hesap yetkileri kontrol ediliyor…</ThemedText>
  </ThemedView>;
  if (isCoach(identity.data)) return <Redirect href={'/coach' as never} />;
  if (canOpenManagement(identity.data)) return <Redirect href={'/(drawer)/management' as never} />;
  if (identity.error) return <ThemedView style={{ flex: 1, backgroundColor: surface.background }}>
    <View style={{ padding: 16, gap: 14 }}><ManagementCard title="Hesap yetkileri doğrulanamadı" hint="Yönetici veya üye görünümünüz henüz belirlenemedi.">
      <ManagementMessage error message={errorMessage(identity.error)} />
      <ManagementButton title={identity.isFetching ? 'Kontrol ediliyor…' : 'Yeniden dene'} disabled={identity.isFetching} onPress={() => void identity.refetch()} />
      <ManagementButton title="Profil ve oturum bilgileri" secondary onPress={() => router.push('/(drawer)/settings' as never)} />
    </ManagementCard></View><AppBottomNav />
  </ThemedView>;
  return <TodayScreen />;
}

function TodayScreen() {
  const surface = getSurfaceColors(useColorScheme());
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';
  const logsQuery = useQuery({ queryKey: ['exercise_logs', userId], queryFn: () => fetchExerciseLogs(userId) });
  const fitnessQuery = useMemberFitness();
  const goalsQuery = useQuery({ queryKey: ['daily_goal_progress', userId], queryFn: () => fetchDailyGoalProgress(userId) });
  const exerciseTypesQuery = useQuery({ queryKey: ['exercise_types'], queryFn: fetchExerciseTypes });
  const userExercisesQuery = useQuery({ queryKey: ['user_exercises', userId], queryFn: () => fetchUserExercises(userId) });
  const wellnessLogsQuery = useQuery({ queryKey: ['wellness_logs', userId], queryFn: () => fetchWellnessLogs(userId) });
  const wellnessGoalsQuery = useQuery({ queryKey: ['wellness_goals', userId], queryFn: () => fetchWellnessGoals(userId) });
  const [goalDrafts, setGoalDrafts] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<'overview' | 'fitness' | 'wellness'>('overview');

  const tenantActivitiesQuery = useMemberActivities();
  const logs = logsQuery.data ?? emptyExerciseLogs;
  const goals = goalsQuery.data ?? emptyGoalProgress;
  const exerciseTypes = exerciseTypesQuery.data ?? emptyExerciseTypes;
  const userExercises = userExercisesQuery.data ?? emptyUserExercises;
  const wellnessLogs = wellnessLogsQuery.data ?? emptyWellnessLogs;
  const wellnessGoals = wellnessGoalsQuery.data ?? emptyWellnessGoals;
  const selectedExerciseIds = useMemo(
    () => new Set(userExercises.filter((item) => item.active !== false).map((item) => item.exercise_type_id)),
    [userExercises]
  );
  const selectedExercises = useMemo(
    () => exerciseTypes.filter((exercise) => selectedExerciseIds.has(exercise.id)),
    [exerciseTypes, selectedExerciseIds]
  );
  const todayLogs = logs.filter((log) => isToday(log.createdat));
  const activityLogs = combineMemberExerciseLogs(logs, tenantActivitiesQuery.data ?? [], userId);
  const todayActivityLogs = activityLogs.filter(log => isToday(log.createdat));
  const hasUnknownCalories = todayActivityLogs.some(log => log.calorie_estimate == null);
  const totalCalories = todayActivityLogs.reduce((sum, log) => sum + Number(log.calorie_estimate ?? 0), 0);
  const todayWellnessLogs = wellnessLogs.filter((log) => isToday(log.createdat));
  const waterTotal = todayWellnessLogs
    .filter((log) => log.wellness_type_id === 'water')
    .reduce((sum, log) => sum + Number(log.quantity ?? 0), 0);
  const wellnessDone = todayWellnessLogs.length;
  const lastTag = activityLogs.find(log => log.source === 'nfc');
  const refreshing = fitnessQuery.isRefetching || tenantActivitiesQuery.isRefetching || logsQuery.isRefetching || goalsQuery.isRefetching || exerciseTypesQuery.isRefetching || userExercisesQuery.isRefetching || wellnessLogsQuery.isRefetching || wellnessGoalsQuery.isRefetching;

  useEffect(() => {
    setGoalDrafts((prev) => {
      const next: Record<string, string> = { ...prev };
      let changed = false;

      selectedExercises.forEach((exercise) => {
        const goal = goals.find((item) => item.exercise_type_id === exercise.id);

        const newValue =
          goal?.target_quantity !== undefined && goal?.target_quantity !== null
            ? String(goal.target_quantity)
            : '';

        if (next[exercise.id] !== newValue) {
          next[exercise.id] = newValue;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [selectedExercises, goals]);

  const goalMutation = useMutation({
    mutationFn: ({ exercise, target }: { exercise: ExerciseType; target: number }) =>
      updateDailyGoal({ userId, exerciseTypeId: exercise.id, targetQuantity: target, unit: exercise.unit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily_goal_progress', userId] });
    },
  });

  const onRefresh = () => {
    if (tenantConsoleConfigured) { void tenantActivitiesQuery.refetch(); void fitnessQuery.refetch(); }
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
          <ThemedText style={styles.eyebrow}>Merhaba{user?.name ? `, ${user.name}` : ''} 👋</ThemedText>
          <ThemedText style={styles.title}>Kişisel hedefler ve önceki kayıtlar</ThemedText>
        </View>

        <MemberDailyGuide />
        <OfflineSyncStatus />

        <View style={[styles.tabs, { backgroundColor: surface.card, borderColor: surface.border }]}>
          {(['overview', 'fitness', 'wellness'] as const).map((value) => (
            <Pressable key={value} onPress={() => setTab(value)} style={[styles.tabButton, tab === value && { backgroundColor: surface.green }]}>
              <ThemedText style={[styles.tabText, tab === value && styles.tabTextActive]}>
                {value === 'overview' ? 'Özet' : value === 'fitness' ? 'Egzersiz' : 'İyi yaşam'}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {tenantActivitiesQuery.isError && <ThemedText style={{ color: '#ef4444' }}>Salon aktiviteleri yüklenemedi. Yenilemek için aşağı çekin.</ThemedText>}
        <ThemedText style={styles.blockLabel}>Günün özeti</ThemedText>
        <View style={styles.summaryGrid}>
          <SummaryCard icon="flame" label="Kalori" value={hasUnknownCalories ? '—' : `${Math.round(totalCalories)} kcal`} accent={surface.green} raised={surface.cardRaised} border={surface.border} />
          <SummaryCard icon="timer-outline" label="Kayıtlı süre" value={`${recordedMinutes(todayActivityLogs).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} dk`} accent={surface.green} raised={surface.cardRaised} border={surface.border} />
          <SummaryCard icon="walk" label="Egzersiz kayıtları" value={String(todayActivityLogs.length)} accent={surface.green} raised={surface.cardRaised} border={surface.border} />
          <SummaryCard icon="water" label="Su" value={`${formatNumber(waterTotal / 1000)} L`} accent={surface.green} raised={surface.cardRaised} border={surface.border} />
        </View>



        {(tab === 'overview' || tab === 'fitness') && <MemberTenantGoals />}
        {(tab === 'overview' || tab === 'fitness') && selectedExercises.length > 0 && <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <ThemedText style={styles.sectionTitle}>Kişisel egzersiz hedeflerim</ThemedText>
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
                      style={[styles.goalSaveButton, { backgroundColor: surface.green }, goalMutation.isPending && styles.goalSaveButtonDisabled]}
                      disabled={goalMutation.isPending || !Number.isFinite(Number(goalDrafts[exercise.id])) || Number(goalDrafts[exercise.id]) <= 0 || Number(goalDrafts[exercise.id]) > 100000}
                      onPress={() => goalMutation.mutate({ exercise, target: Number(goalDrafts[exercise.id]) })}>
                      <ThemedText style={styles.goalSaveText}>Kaydet</ThemedText>
                    </Pressable>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: surface.green }]} />
                  </View>
                </View>
              );
            })
          )}
        </View>}

        {((tab === 'overview' && (wellnessGoals.length > 0 || todayWellnessLogs.length > 0)) || tab === 'wellness') && <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <ThemedText style={styles.sectionTitle}>İyi yaşam hedeflerin</ThemedText>
          {wellnessGoals.slice(0, 5).map((goal) => {
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
                  <View style={[styles.progressFillPurple, { width: `${progress * 100}%`, backgroundColor: surface.green }]} />
                </View>
              </View>
            );
          })}
          {wellnessDone === 0 && <ThemedText style={[styles.emptyText, { color: surface.mutedText }]}>Bugün iyi yaşam kaydı yok.</ThemedText>}
        </View>}

        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <ThemedText style={styles.sectionTitle}>Son kaydettiğin kart</ThemedText>
          {lastTag ? (
            <View style={styles.lastTagRow}>
              <Ionicons name="radio-outline" size={22} color={surface.green} />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.lastTagTitle}>{lastTag.exercise_name}</ThemedText>
                <ThemedText style={[styles.lastTagMeta, { color: surface.mutedText }]}>
                  {formatQuantity(lastTag.quantity, lastTag.unit)} · {formatTime(lastTag.createdat)}
                </ThemedText>
              </View>
            </View>
          ) : (
            <ThemedText style={[styles.emptyText, { color: surface.mutedText }]}>Henüz kartla egzersiz kaydetmedin.</ThemedText>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <ThemedText style={styles.sectionTitle}>Bugünkü aktiviteler</ThemedText>
          {todayActivityLogs.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: surface.mutedText }]}>{tenantActivitiesQuery.isLoading || logsQuery.isLoading ? 'Kayıtlar yükleniyor…' : 'İlk egzersizi kaydetmek için NFC Tara.'}</ThemedText>
          ) : (
            todayActivityLogs.slice(0, 5).map((log) => (
              <View key={log.id} style={styles.activityRow}>
                <ThemedText style={styles.activityTitle}>{formatQuantity(log.quantity, log.unit)} {log.exercise_name}</ThemedText>
                <ThemedText style={[styles.activityMeta, { color: surface.mutedText }]}>{log.tenant_name ? `${log.tenant_name} · ` : ''}{formatTime(log.createdat)} · {log.source === 'nfc' ? 'Kartla' : 'Manuel'}</ThemedText>
              </View>
            ))
          )}
          <Pressable onPress={() => router.push('/(drawer)/history')}><ThemedText style={{ color: surface.green, fontWeight: '700' }}>Tüm kayıtlarımı gör →</ThemedText></Pressable>
        </View>
      </ScrollView>
      <AppBottomNav />
    </ThemedView>
  );
}

function SummaryCard({ icon, label, value, accent, raised, border }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; accent: string; raised: string; border: string }) {
  return (
    <View style={[styles.summaryCard, { backgroundColor: raised, borderColor: border }]}>
      <Ionicons name={icon} size={22} color={accent} />
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
  if (id === 'water') return 'Su';
  if (id === 'coffee') return 'Kahve';
  if (id === 'meditation') return 'Meditasyon';
  if (id === 'walk_break') return 'Yürüyüş molası';
  if (id === 'vitamins') return 'Vitamin';
  return id;
}

function formatWellnessQuantity(quantity?: number | null, unit?: string | null) {
  const value = Number(quantity ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  if (unit === 'ml') return `${value} ml`;
  if (unit === 'cups') return `${value} fincan`;
  if (unit === 'minutes') return `${value} dk`;
  return value;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 14, paddingBottom: bottomNavHeight + 24, gap: 14 },
  header: { gap: 2 },
  eyebrow: { fontSize: 14, fontWeight: '800' },
  title: { fontSize: 13, fontWeight: '700', opacity: 0.72 },
  tabs: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 4 },
  tabButton: { flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  tabText: { fontSize: 12, fontWeight: '800', opacity: 0.7 },
  tabTextActive: { color: '#fff', opacity: 1 },
  blockLabel: { fontSize: 13, fontWeight: '900', marginTop: 2 },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryCard: { width: '48%', borderRadius: 14, padding: 12, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryValue: { fontSize: 17, fontWeight: '900' },
  summaryLabel: { fontSize: 11, opacity: 0.7, marginBottom: 2 },
  scanButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  scanButtonText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  section: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  emptyText: { fontSize: 13 },
  goalRow: { gap: 7 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  goalName: { fontWeight: '700' },
  goalValue: { fontSize: 12, fontWeight: '700' },
  goalEditRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  goalInput: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontWeight: '700' },
  goalSaveButton: { minHeight: 40, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  goalSaveButtonDisabled: { opacity: 0.5 },
  goalSaveText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: 'rgba(148,163,184,0.22)', overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 999, backgroundColor: '#35D353' },
  progressFillPurple: { height: 8, borderRadius: 999, backgroundColor: '#35D353' },
  lastTagRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lastTagTitle: { fontSize: 15, fontWeight: '800' },
  lastTagMeta: { fontSize: 12 },
  activityRow: { paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(148,163,184,0.22)', gap: 2 },
  activityTitle: { fontWeight: '800' },
  activityMeta: { fontSize: 12 },
});
