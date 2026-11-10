import { OfflineSyncStatus } from '@/components/offline-sync-status';
import { MemberWeeklyTrend } from '@/components/member-weekly-trend';
import { useMemberFitness } from '@/hooks/use-member-fitness';
import { MemberTenantGoals } from '@/components/member-tenant-goals';
import { combineMemberExerciseLogs, recordedMinutes, summarizeMemberExercises } from '@/lib/member-activity';
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
import { tenantConsoleConfigured } from '@/lib/tenant-console';

export default function FitnessScreen() {
  const surface = getSurfaceColors(useColorScheme());
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const logsQuery = useQuery({ queryKey: ['exercise_logs', userId], queryFn: () => fetchExerciseLogs(userId) });
  const typesQuery = useQuery({ queryKey: ['exercise_types'], queryFn: fetchExerciseTypes });
  const userExercisesQuery = useQuery({ queryKey: ['user_exercises', userId], queryFn: () => fetchUserExercises(userId) });
  const tenantActivitiesQuery = useMemberFitness();
  const selectedIds = useMemo(
    () => new Set((userExercisesQuery.data ?? []).filter((item) => item.active !== false).map((item) => item.exercise_type_id)),
    [userExercisesQuery.data]
  );
  const selectedExercises = useMemo(
    () => (typesQuery.data ?? []).filter((exercise) => selectedIds.has(exercise.id)),
    [selectedIds, typesQuery.data]
  );
  const start = getPeriodStart(period);
  const periodLogs = combineMemberExerciseLogs(logsQuery.data ?? [], [], userId)
    .filter(log => new Date(log.createdat) >= start);
  const tenantRows = (tenantActivitiesQuery.data?.exercises ?? []).filter(row => row[period].count > 0).map(row => ({
    key: `tenant:${row.tenant_id}:${row.exercise_id}:${row.unit}`, name: row.name, unit: row.unit,
    count: row[period].count, quantity: row[period].quantity, calories: null, tenant_name: row.tenant_name,
  }));
  const rows = [...summarizeMemberExercises(periodLogs, selectedExercises), ...tenantRows].sort((a, b) => b.count - a.count);
  const totalWorkouts = rows.reduce((sum, row) => sum + row.count, 0);
  const totalCalories = periodLogs.reduce((sum, log) => sum + Number(log.calorie_estimate ?? 0), 0);
  const hasUnknownCalories = tenantRows.length > 0 || periodLogs.some(log => log.calorie_estimate == null);
  const activeMinutes = recordedMinutes(periodLogs) + tenantRows.reduce((sum, row) => sum + (row.unit === 'seconds' ? row.quantity / 60 : row.unit === 'minutes' ? row.quantity : 0), 0);
  const refreshing = logsQuery.isRefetching || typesQuery.isRefetching || userExercisesQuery.isRefetching || tenantActivitiesQuery.isRefetching;

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          logsQuery.refetch();
          typesQuery.refetch();
          userExercisesQuery.refetch();
          if (tenantConsoleConfigured) tenantActivitiesQuery.refetch();
        }} />}>
        <View style={styles.header}>
          <ThemedText style={[styles.eyebrow, { color: surface.green }]}>Aktivite</ThemedText>
          <ThemedText style={styles.title}>Egzersizler</ThemedText>
        </View>

        <MemberWeeklyTrend personal={logsQuery.data ?? []} />

        <View style={[styles.segment, { backgroundColor: surface.card, borderColor: surface.border }]}>
          {(['day', 'week', 'month'] as const).map((value) => (
            <Pressable key={value} onPress={() => setPeriod(value)} style={[styles.segmentButton, period === value && { backgroundColor: surface.green }]}>
              <ThemedText style={[styles.segmentText, period === value && styles.segmentTextActive]}>
                {value === 'day' ? 'Gün' : value === 'week' ? 'Hafta' : 'Ay'}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {tenantActivitiesQuery.isLoading && <ThemedText>Salon aktiviteleri yükleniyor…</ThemedText>}
        {tenantActivitiesQuery.isError && <ThemedText style={{ color: '#ef4444' }}>Salon aktiviteleri yüklenemedi. Yenilemek için aşağı çekin.</ThemedText>}
        {hasUnknownCalories && <ThemedText style={{ color: surface.mutedText }}>Salon aktivitelerinde kalori bilgisi bulunmuyor.</ThemedText>}
        <View style={[styles.activityCard, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <ThemedText style={styles.sectionTitle}>Aktivite</ThemedText>
          <View style={styles.activityBody}>
            <View style={styles.donutOuter}>
              <View style={[styles.donutMiddle, { backgroundColor: surface.card }]}>
                <ThemedText style={styles.donutValue}>{hasUnknownCalories ? '—' : Math.round(totalCalories)}</ThemedText>
                <ThemedText style={styles.donutLabel}>kcal</ThemedText>
              </View>
            </View>
            <View style={styles.legend}>
              <LegendDot color={surface.green} label="Egzersiz kayıtları" value={`${totalWorkouts}`} />
              <LegendDot color={surface.green} label="Kayıtlı süre" value={`${activeMinutes.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} dk`} />
              <LegendDot color={surface.mutedText} label="Egzersiz çeşidi" value={String(rows.filter(row => row.count > 0).length)} />
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <ThemedText style={styles.sectionTitle}>Egzersiz raporum</ThemedText>
          {rows.length === 0 ? (
            <ThemedText style={{ color: surface.mutedText }}>Bu dönemde egzersiz kaydı yok.</ThemedText>
          ) : (
            rows.map((row) => (
              <View key={row.key} style={styles.row}>
                <Ionicons name="fitness-outline" size={22} color={surface.green} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.rowTitle}>{row.name}</ThemedText>
                  <ThemedText style={[styles.rowMeta, { color: surface.mutedText }]}>
                    {row.tenant_name ? `${row.tenant_name} · ` : ''}{row.count} kayıt · {formatQuantity(row.quantity, row.unit)}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.kcal, { color: surface.green }]}>{row.calories == null ? '—' : `${Math.round(row.calories)} kcal`}</ThemedText>
              </View>
            ))
          )}
        </View>
        <MemberTenantGoals />
        <OfflineSyncStatus />
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
  eyebrow: { fontSize: 13, fontWeight: '800' },
  title: { fontSize: 28, fontWeight: '900' },
  segment: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 4 },
  segmentButton: { flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  segmentText: { fontSize: 12, fontWeight: '800', opacity: 0.7 },
  segmentTextActive: { color: '#fff', opacity: 1 },
  activityCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14, gap: 14 },
  section: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 12, paddingTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900' },
  activityBody: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  donutOuter: { width: 132, height: 132, borderRadius: 66, borderWidth: 18, borderTopColor: '#35D353', borderRightColor: '#35D353', borderBottomColor: 'rgba(148,163,184,0.28)', borderLeftColor: 'rgba(148,163,184,0.28)', alignItems: 'center', justifyContent: 'center' },
  donutMiddle: { width: 86, height: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center' },
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
  kcal: { fontSize: 12, fontWeight: '900' },
});
