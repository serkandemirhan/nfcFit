import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useMemo, useState } from 'react';

import { AppBottomNav, bottomNavHeight } from '@/components/app-bottom-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ExerciseLog, fetchExerciseLogs, fetchWellnessLogs, WellnessLog } from '@/lib/api';

export default function HistoryScreen() {
  const surface = getSurfaceColors(useColorScheme());
  const { user } = useAuth();
  const userId = user?.id ?? 'u1';
  const [filter, setFilter] = useState<'all' | 'fitness' | 'wellness'>('all');
  const logsQuery = useQuery({ queryKey: ['exercise_logs', userId], queryFn: () => fetchExerciseLogs(userId) });
  const wellnessQuery = useQuery({ queryKey: ['wellness_logs', userId], queryFn: () => fetchWellnessLogs(userId) });
  const logs = useMemo(() => {
    const fitness = (logsQuery.data ?? []).map((log) => ({ type: 'fitness' as const, date: log.createdat, log }));
    const wellness = (wellnessQuery.data ?? []).map((log) => ({ type: 'wellness' as const, date: log.createdat, log }));
    return [...fitness, ...wellness]
      .filter((item) => filter === 'all' || item.type === filter)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filter, logsQuery.data, wellnessQuery.data]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={logsQuery.isRefetching || wellnessQuery.isRefetching} onRefresh={() => {
          logsQuery.refetch();
          wellnessQuery.refetch();
        }} />}>
        <View style={styles.header}>
          <ThemedText style={styles.title}>Egzersiz Geçmişi</ThemedText>
          <ThemedText style={[styles.subtitle, { color: surface.mutedText }]}>NFC ve manuel kayıtlar</ThemedText>
        </View>

        <View style={[styles.filters, { backgroundColor: surface.card, borderColor: surface.border }]}>
          {(['all', 'fitness', 'wellness'] as const).map((value) => (
            <ThemedText
              key={value}
              onPress={() => setFilter(value)}
              style={[styles.filterChip, filter === value && styles.filterChipActive]}>
              {value === 'all' ? 'All' : value === 'fitness' ? 'Fitness' : 'Wellness'}
            </ThemedText>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          {logs.length === 0 ? (
            <ThemedText style={{ color: surface.mutedText }}>Henüz egzersiz kaydı yok.</ThemedText>
          ) : (
            logs.map((item) => item.type === 'fitness'
              ? <FitnessHistoryRow key={`f-${item.log.id}`} log={item.log as ExerciseLog} muted={surface.mutedText} />
              : <WellnessHistoryRow key={`w-${item.log.id}`} log={item.log as WellnessLog} muted={surface.mutedText} />)
          )}
        </View>
      </ScrollView>
      <AppBottomNav />
    </ThemedView>
  );
}

function FitnessHistoryRow({ log, muted }: { log: ExerciseLog; muted: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.iconWrap}>
        <Ionicons name={log.source === 'nfc' ? 'radio-outline' : 'create-outline'} size={18} color="#2563eb" />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.rowTitle}>{formatQuantity(log.quantity, log.unit)} {log.exercise_name}</ThemedText>
        <ThemedText style={[styles.rowMeta, { color: muted }]}>
          {formatDate(log.createdat)} · {log.source === 'nfc' ? 'NFC Tag ile kaydedildi' : 'Manuel kaydedildi'}
        </ThemedText>
      </View>
      <ThemedText style={styles.kcal}>{Math.round(Number(log.calorie_estimate ?? 0))} kcal</ThemedText>
    </View>
  );
}

function WellnessHistoryRow({ log, muted }: { log: WellnessLog; muted: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
        <Ionicons name={log.wellness_type_id === 'water' ? 'water-outline' : 'add-circle-outline'} size={18} color="#8b5cf6" />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.rowTitle}>{formatWellnessQuantity(log.quantity, log.unit)} {log.wellness_name}</ThemedText>
        <ThemedText style={[styles.rowMeta, { color: muted }]}>
          {formatDate(log.createdat)} · Wellness
        </ThemedText>
      </View>
    </View>
  );
}

function formatQuantity(quantity?: number | null, unit?: string | null) {
  const value = Number(quantity ?? 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 });
  if (unit === 'seconds') return `${value} sn`;
  if (unit === 'minutes') return `${value} dk`;
  if (unit === 'meters') return `${value} m`;
  return `${value} tekrar`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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
  header: { gap: 3 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 13 },
  filters: { flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 4, gap: 4 },
  filterChip: { flex: 1, textAlign: 'center', paddingVertical: 8, borderRadius: 9, fontSize: 12, fontWeight: '800', opacity: 0.7 },
  filterChipActive: { backgroundColor: '#22c55e', color: '#fff', opacity: 1 },
  section: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(148,163,184,0.22)' },
  iconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(37,99,235,0.1)', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '800' },
  rowMeta: { fontSize: 12, marginTop: 2 },
  kcal: { color: '#2563eb', fontSize: 12, fontWeight: '900' },
});
