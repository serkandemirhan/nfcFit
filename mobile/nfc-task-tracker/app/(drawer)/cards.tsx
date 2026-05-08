import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { AppBottomNav, bottomNavHeight } from '@/components/app-bottom-nav';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Card, fetchCards } from '@/lib/api';

type CardStatus = 'linked' | 'unassigned' | 'inactive';

export default function CardsScreen() {
  const { t } = useTranslation();
  const surface = getSurfaceColors(useColorScheme());
  const cardsQuery = useQuery({ queryKey: ['cards'], queryFn: fetchCards });

  const STATUS_META: Record<CardStatus, { label: string; color: string; bg: string }> = {
    linked: { label: 'Hazır', color: '#0F5132', bg: '#D1FAE5' },
    unassigned: { label: 'Kurulum gerekli', color: '#92400E', bg: '#FEF3C7' },
    inactive: { label: t('cards.inactive'), color: '#991B1B', bg: '#FEE2E2' },
  };

  const refreshing = cardsQuery.isRefetching;
  const onRefresh = () => {
    cardsQuery.refetch();
  };

  const cards = cardsQuery.data ?? [];
  const totalCards = cards.length;
  const idleCards = cards.filter((card) => getCardStatus(card) === 'unassigned').length;
  const inactiveCards = cards.filter((card) => getCardStatus(card) === 'inactive').length;
  if (cardsQuery.isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>{t('common.loading')}</ThemedText>
      </ThemedView>
    );
  }

  if (cardsQuery.error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">{t('cards.errors.loadFailed')}</ThemedText>
        <ThemedText style={styles.errorHint} onPress={onRefresh}>
          {t('common.retry')}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={[styles.statsRow, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <StatCard label={t('common.all')} value={String(totalCards)} icon="layers-outline" />
          <StatCard label="Kurulum" value={String(idleCards)} icon="alert-circle-outline" />
          <StatCard label={t('cards.inactive')} value={String(inactiveCards)} icon="remove-circle-outline" />
        </View>

        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          {cards.length === 0 ? (
            <ThemedText style={{ color: surface.mutedText }}>{t('cards.noCards')}</ThemedText>
          ) : (
            cards.map((card) => (
              <CardRow
                key={card.id}
                card={card}
                surfaceMuted={surface.mutedText}
                statusMeta={STATUS_META}
              />
            ))
          )}
        </View>
      </ScrollView>
      <Pressable style={styles.fab} onPress={() => router.push('/(drawer)/new-tag' as never)}>
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
      <AppBottomNav />
    </ThemedView>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={20} color="#2563eb" />
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText style={styles.statLabel}>{label}</ThemedText>
    </View>
  );
}

function CardRow({
  card,
  surfaceMuted,
  statusMeta,
}: {
  card: Card;
  surfaceMuted: string;
  statusMeta: Record<CardStatus, { label: string; color: string; bg: string }>;
}) {
  const { t } = useTranslation();
  const status = getCardStatus(card);
  const actionName = card.action_domain === 'wellness' ? card.wellness_name : card.exercise_name;
  const actionLabel = card.action_domain === 'wellness' ? 'Wellness' : card.action_domain === 'fitness' ? 'Fitness' : '';
  const meta = actionName
    ? `${actionLabel} · ${actionName}${card.quantity ? ` · ${card.quantity} ${formatUnit(card.unit)}` : ''}`
    : 'Henüz aksiyona bağlı değil';
  return (
    <TouchableOpacity
      style={styles.cardRow}
      onPress={() => router.push(`/(drawer)/card/${card.id}`)}
      activeOpacity={0.7}>
      <View style={styles.cardTitleRow}>
        <View style={styles.cardHeaderText}>
          <ThemedText style={styles.cardAlias} numberOfLines={1}>
            {card.alias || t('cards.cardName')}
          </ThemedText>
          <ThemedText style={[styles.cardMeta, { color: surfaceMuted }]} numberOfLines={1}>
            {meta}
          </ThemedText>
        </View>
        <StatusChip status={status} statusMeta={statusMeta} />
      </View>
      <ThemedText style={[styles.cardMeta, { color: surfaceMuted }]} numberOfLines={1}>
        {shortUid(card.uid)}
      </ThemedText>
    </TouchableOpacity>
  );
}

function formatUnit(unit?: string | null) {
  if (unit === 'seconds') return 'sn';
  if (unit === 'minutes') return 'dk';
  if (unit === 'meters') return 'm';
  if (unit === 'ml') return 'ml';
  if (unit === 'cups') return 'bardak';
  if (unit === 'count') return 'adet';
  return 'tekrar';
}

function getCardStatus(card: Card): CardStatus {
  if (card.active === false || ['lost', 'revoked', 'damaged'].includes(card.lifecycle_status ?? '')) {
    return 'inactive';
  }
  return card.action_domain === 'fitness' || card.action_domain === 'wellness' ? 'linked' : 'unassigned';
}

function shortUid(uid?: string | null) {
  if (!uid) return 'UID yok';
  if (uid.length <= 12) return `UID ${uid}`;
  return `UID ${uid.slice(0, 6)}...${uid.slice(-4)}`;
}

function StatusChip({
  status,
  statusMeta,
}: {
  status: CardStatus;
  statusMeta: Record<CardStatus, { label: string; color: string; bg: string }>;
}) {
  const meta = statusMeta[status];
  return (
    <View style={[styles.statusChip, { backgroundColor: meta.bg }]}>
      <ThemedText style={[styles.statusChipText, { color: meta.color }]}>{meta.label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  errorHint: {
    color: '#2563eb',
  },
  content: {
    padding: 14,
    paddingBottom: bottomNavHeight + 24,
    gap: 12,
  },
  subtitle: {
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(37,99,235,0.08)',
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    opacity: 0.7,
  },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  cardRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.25)',
    gap: 5,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
    marginRight: 8,
  },
  cardAlias: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: 12,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: bottomNavHeight + 14,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
});
