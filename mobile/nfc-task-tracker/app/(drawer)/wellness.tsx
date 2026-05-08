import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { AppBottomNav, bottomNavHeight } from '@/components/app-bottom-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { createWellnessLog, fetchWellnessGoals, fetchWellnessLogs, fetchWellnessTypes, WellnessType } from '@/lib/api';

type Period = 'day' | 'week' | 'month';

const quickAmounts: Record<string, number> = {
  water: 500,
  coffee: 1,
  meditation: 5,
  walk_break: 1,
  vitamins: 1,
};

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  water: 'water-outline',
  coffee: 'cafe-outline',
  meditation: 'leaf-outline',
  walk_break: 'walk-outline',
  vitamins: 'shield-checkmark-outline',
};

export default function WellnessScreen() {
  const surface = getSurfaceColors(useColorScheme());
  const { user } = useAuth();
  const userId = user?.id ?? 'u1';
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('day');
  const typesQuery = useQuery({ queryKey: ['wellness_types'], queryFn: fetchWellnessTypes });
  const goalsQuery = useQuery({ queryKey: ['wellness_goals', userId], queryFn: () => fetchWellnessGoals(userId) });
  const logsQuery = useQuery({ queryKey: ['wellness_logs', userId], queryFn: () => fetchWellnessLogs(userId) });
  const start = getPeriodStart(period);
  const logs = (logsQuery.data ?? []).filter((log) => new Date(log.createdat) >= start);
  const rows = useMemo(() => (typesQuery.data ?? []).map((type) => {
    const goal = (goalsQuery.data ?? []).find((item) => item.wellness_type_id === type.id);
    const completed = logs
      .filter((log) => log.wellness_type_id === type.id)
      .reduce((sum, log) => sum + Number(log.quantity ?? 0), 0);
    return { type, goal, completed };
  }), [goalsQuery.data, logs, typesQuery.data]);
  const refreshing = typesQuery.isRefetching || goalsQuery.isRefetching || logsQuery.isRefetching;
  const logMutation = useMutation({
    mutationFn: (type: WellnessType) => createWellnessLog({
      userId,
      wellnessTypeId: type.id,
      quantity: quickAmounts[type.id] ?? 1,
      unit: type.unit,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wellness_logs', userId] });
    },
  });

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          typesQuery.refetch();
          goalsQuery.refetch();
          logsQuery.refetch();
        }} />}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Wellness</ThemedText>
        </View>

        <View style={[styles.segment, { backgroundColor: surface.card, borderColor: surface.border }]}>
          {(['day', 'week', 'month'] as const).map((value) => (
            <Pressable key={value} onPress={() => setPeriod(value)} style={[styles.segmentButton, period === value && styles.segmentButtonActive]}>
              <ThemedText style={[styles.segmentText, period === value && styles.segmentTextActive]}>
                {value === 'day' ? 'Day' : value === 'week' ? 'Week' : 'Month'}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          {rows.map(({ type, goal, completed }) => {
            const target = Number(goal?.target_quantity ?? 0);
            const progress = target > 0 ? Math.min(1, completed / target) : 0;
            return (
              <View key={type.id} style={[styles.row, { borderColor: surface.border }]}>
                <View style={styles.rowTop}>
                  <View style={styles.iconTitle}>
                    <Ionicons name={iconMap[type.id] ?? 'add-circle-outline'} size={24} color="#8b5cf6" />
                    <View>
                      <ThemedText style={styles.rowTitle}>{type.name}</ThemedText>
                      <ThemedText style={[styles.rowMeta, { color: surface.mutedText }]}>
                        {formatQuantity(completed, type.unit)} / {target ? formatQuantity(target, goal?.unit ?? type.unit) : 'No goal'}
                      </ThemedText>
                    </View>
                  </View>
                  <Pressable
                    onPress={() => logMutation.mutate(type)}
                    disabled={logMutation.isPending}
                    style={styles.addButton}>
                    <Ionicons name="add" size={18} color="#fff" />
                  </Pressable>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <AppBottomNav />
    </ThemedView>
  );
}

function getPeriodStart(period: Period) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (period === 'week') {
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
  }
  if (period === 'month') date.setDate(1);
  return date;
}

function formatQuantity(quantity: number, unit?: string | null) {
  const value = Number(quantity ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  if (unit === 'ml') return `${value} ml`;
  if (unit === 'cups') return `${value} cups`;
  if (unit === 'minutes') return `${value} min`;
  return `${value}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 14, paddingBottom: bottomNavHeight + 24, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '900' },
  segment: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 4 },
  segmentButton: { flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center' },
  segmentButtonActive: { backgroundColor: '#8b5cf6' },
  segmentText: { fontSize: 12, fontWeight: '800', opacity: 0.7 },
  segmentTextActive: { color: '#fff', opacity: 1 },
  section: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 10, gap: 8 },
  row: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, backgroundColor: 'rgba(11,31,50,0.92)', padding: 12, gap: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  iconTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  addButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 7, borderRadius: 999, backgroundColor: 'rgba(148,163,184,0.24)', overflow: 'hidden' },
  progressFill: { height: 7, borderRadius: 999, backgroundColor: '#8b5cf6' },
});
