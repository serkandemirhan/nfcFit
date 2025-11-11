import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLayoutEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { router, useNavigation } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Card, Location, fetchCards, fetchLocations } from '@/lib/api';

type CardStatus = 'assigned' | 'unlinked';

export default function CardsScreen() {
  const { t } = useTranslation();
  const surface = getSurfaceColors(useColorScheme());
  const navigation = useNavigation();
  const cardsQuery = useQuery({ queryKey: ['cards'], queryFn: fetchCards });
  const locationsQuery = useQuery({ queryKey: ['locations'], queryFn: fetchLocations });

  const STATUS_META: Record<CardStatus, { label: string; color: string; bg: string }> = {
    assigned: { label: t('cards.active'), color: '#0F5132', bg: '#D1FAE5' },
    unlinked: { label: t('cards.inactive'), color: '#92400E', bg: '#FEF3C7' },
  };

  const refreshing = cardsQuery.isRefetching || locationsQuery.isRefetching;
  const onRefresh = () => {
    cardsQuery.refetch();
    locationsQuery.refetch();
  };

  const locationsMap = useMemo(() => {
    const map = new Map<string, Location>();
    (locationsQuery.data ?? []).forEach((location) => {
      map.set(location.id, location);
    });
    return map;
  }, [locationsQuery.data]);

  const cards = cardsQuery.data ?? [];
  const totalCards = cards.length;
  const idleCards = cards.filter((card) => !card.assignedlocationid).length;
  const lastSync = cardsQuery.dataUpdatedAt
    ? new Intl.DateTimeFormat('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      }).format(cardsQuery.dataUpdatedAt)
    : '—';

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => router.push('/(drawer)/nfc')}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
          <ThemedText style={styles.headerActionLabel}>{t('cards.addCard')}</ThemedText>
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  if (cardsQuery.isLoading || locationsQuery.isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>{t('common.loading')}</ThemedText>
      </ThemedView>
    );
  }

  if (cardsQuery.error || locationsQuery.error) {
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
          <StatCard label={t('cards.inactive')} value={String(idleCards)} icon="alert-circle-outline" />
          <StatCard label={t('cards.lastScanned')} value={lastSync} icon="time-outline" />
        </View>

        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          {cards.length === 0 ? (
            <ThemedText style={{ color: surface.mutedText }}>{t('cards.noCards')}</ThemedText>
          ) : (
            cards.map((card) => (
              <CardRow
                key={card.id}
                card={card}
                location={locationsMap.get(card.assignedlocationid ?? '')?.name}
                surfaceMuted={surface.mutedText}
                statusMeta={STATUS_META}
              />
            ))
          )}
        </View>
      </ScrollView>
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
  location,
  surfaceMuted,
  statusMeta,
}: {
  card: Card;
  location?: string;
  surfaceMuted: string;
  statusMeta: Record<CardStatus, { label: string; color: string; bg: string }>;
}) {
  const { t } = useTranslation();
  const status: CardStatus = card.assignedlocationid ? 'assigned' : 'unlinked';
  return (
    <TouchableOpacity
      style={styles.cardRow}
      onPress={() => router.push(`/(drawer)/card/${card.id}`)}
      activeOpacity={0.7}>
      <View style={styles.cardTitleRow}>
        <View style={styles.cardHeaderText}>
          <ThemedText style={styles.cardAlias}>{card.alias || t('cards.cardName')}</ThemedText>
          <ThemedText style={[styles.cardMeta, { color: surfaceMuted }]}>
            ID: {card.id.slice(0, 8)}...
          </ThemedText>
        </View>
        <StatusChip status={status} statusMeta={statusMeta} />
      </View>
      <ThemedText style={[styles.cardMeta, { color: surfaceMuted }]} numberOfLines={1}>
        {location ? `${t('tasks.location')}: ${location}` : t('tasks.noLocation')} · UID:{' '}
        {card.uid ?? '—'}
      </ThemedText>
    </TouchableOpacity>
  );
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
    padding: 16,
    gap: 16,
  },
  subtitle: {
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
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
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  cardRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.25)',
    gap: 4,
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
    fontWeight: '600',
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
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2563eb',
    marginRight: 8,
  },
  headerActionLabel: {
    color: '#2563eb',
    fontWeight: '600',
  },
});
