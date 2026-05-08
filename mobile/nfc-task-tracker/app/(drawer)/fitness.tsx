import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppBottomNav, bottomNavHeight } from '@/components/app-bottom-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchExerciseLogs, fetchExerciseTypes, fetchUserExercises } from '@/lib/api';

export default function FitnessScreen() {
  const surface = getSurfaceColors(useColorScheme());
  const { user } = useAuth();
  const userId = user?.id ?? 'u1';
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const logsQuery = useQuery({ queryKey: ['exercise_logs', userId], queryFn: () => fetchExerciseLogs(userId) });
  const typesQuery = useQuery({ queryKey: ['exercise_types'], queryFn: fetchExerciseTypes });
  const userExercisesQuery = useQuery({ queryKey: ['user_exercises', userId], queryFn: () => fetchUserExercises(userId) });
  const selectedIds = useMemo(
    () => new Set((userExercisesQuery.data ?? []).filter((item) => item.active !== false).map((item) => item.exercise_type_id)),
    [userExercisesQuery.data]
  );
  const selectedExercises = useMemo(
    () => (typesQuery.data ?? []).filter((exercise) => selectedIds.has(exercise.id)),
    [selectedIds, typesQuery.data]
  );
  const start = getPeriodStart(period);
  const periodLogs = (logsQuery.data ?? []).filter((log) => new Date(log.createdat) >= start);
  const rows = selectedExercises.map((exercise) => {
    const logs = periodLogs.filter((log) => log.exercise_type_id === exercise.id);
    return {
      exercise,
      count: logs.length,
      quantity: logs.reduce((sum, log) => sum + Number(log.quantity ?? 0), 0),
      calories: logs.reduce((sum, log) => sum + Number(log.calorie_estimate ?? 0), 0),
    };
  });
  const totalWorkouts = periodLogs.length;
  const totalCalories = rows.reduce((sum, row) => sum + row.calories, 0);
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const activeMinutes = totalWorkouts * 15;
  const refreshing = logsQuery.isRefetching || typesQuery.isRefetching || userExercisesQuery.isRefetching;

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          logsQuery.refetch();
          typesQuery.refetch();
          userExercisesQuery.refetch();
        }} />}>
        <View style={styles.header}>
          <ThemedText style={styles.eyebrow}>Activity</ThemedText>
          <ThemedText style={styles.title}>Fitness</ThemedText>
        </View>

        <View style={[styles.segment, { backgroundColor: surface.card, borderColor: surface.border }]}>
          {(['day', 'week', 'month'] as const).map((value) => (
            <Pressable key={value} onPress={() => setPeriod(value)} style={[styles.segmentButton, period === value && styles.segmentButtonActive]}>
              <ThemedText style={[styles.segmentText, period === value && styles.segmentTextActive]}>
                {value === 'day' ? 'Gün' : value === 'week' ? 'Hafta' : 'Ay'}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={[styles.activityCard, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <ThemedText style={styles.sectionTitle}>Activity</ThemedText>
          <View style={styles.activityBody}>
            <View style={styles.donutOuter}>
              <View style={styles.donutMiddle}>
                <ThemedText style={styles.donutValue}>{Math.round(totalCalories)}</ThemedText>
                <ThemedText style={styles.donutLabel}>kcal</ThemedText>
              </View>
            </View>
            <View style={styles.legend}>
              <LegendDot color="#9B5CE5" label="Workouts" value={`${totalWorkouts}`} />
              <LegendDot color="#35D353" label="Active Time" value={`${activeMinutes} min`} />
              <LegendDot color="#4AA3FF" label="Volume" value={String(Math.round(totalQuantity))} />
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <ThemedText style={styles.sectionTitle}>Top Exercises</ThemedText>
          {rows.length === 0 ? (
            <ThemedText style={{ color: surface.mutedText }}>Önce Egzersizler ekranından egzersiz seç.</ThemedText>
          ) : (
            rows.slice().sort((a, b) => b.quantity - a.quantity).map((row) => (
              <View key={row.exercise.id} style={styles.row}>
                <Ionicons name="fitness-outline" size={22} color="#F59E0B" />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.rowTitle}>{row.exercise.name}</ThemedText>
                  <ThemedText style={[styles.rowMeta, { color: surface.mutedText }]}>
                    {row.count} kayıt · {formatQuantity(row.quantity, row.exercise.unit)}
                  </ThemedText>
                </View>
                <ThemedText style={styles.kcal}>{Math.round(row.calories)} kcal</ThemedText>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      <AppBottomNav />
    </ThemedView>
  );
}

function LegendDot({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.legendLabel}>{label}</ThemedText>
        <ThemedText style={styles.legendValue}>{value}</ThemedText>
      </View>
    </View>
  );
}

function getPeriodStart(period: 'day' | 'week' | 'month') {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (period === 'week') {
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
  }
  if (period === 'month') date.setDate(1);
  return date;
}

function formatQuantity(quantity?: number | null, unit?: string | null) {
  const value = Number(quantity ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  if (unit === 'seconds') return `${value} sn`;
  if (unit === 'minutes') return `${value} dk`;
  if (unit === 'meters') return `${value} m`;
  return `${value} tekrar`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 14, paddingBottom: bottomNavHeight + 24, gap: 14 },
  header: { gap: 2 },
  eyebrow: { color: '#35D353', fontSize: 13, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '900' },
  segment: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 4 },
  segmentButton: { flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  segmentButtonActive: { backgroundColor: '#35D353' },
  segmentText: { fontSize: 12, fontWeight: '800', opacity: 0.7 },
  segmentTextActive: { color: '#fff', opacity: 1 },
  activityCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, gap: 14 },
  section: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 12, paddingTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  activityBody: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  donutOuter: { width: 132, height: 132, borderRadius: 66, borderWidth: 18, borderTopColor: '#EF4444', borderRightColor: '#35D353', borderBottomColor: '#4AA3FF', borderLeftColor: '#9B5CE5', alignItems: 'center', justifyContent: 'center' },
  donutMiddle: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#071827', alignItems: 'center', justifyContent: 'center' },
  donutValue: { fontSize: 24, fontWeight: '900' },
  donutLabel: { fontSize: 12, opacity: 0.7, fontWeight: '800' },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { fontSize: 12, opacity: 0.78, fontWeight: '700' },
  legendValue: { fontSize: 13, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(148,163,184,0.22)' },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  kcal: { color: '#F59E0B', fontSize: 12, fontWeight: '900' },
});
