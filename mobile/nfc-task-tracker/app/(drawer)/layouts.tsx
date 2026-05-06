import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Alert, Image, ImageSourcePropType, Pressable, RefreshControl, ScrollView, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useLayoutEffect, useMemo } from 'react';
import { router, useNavigation } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Layout, fetchLayouts, fetchLocations } from '@/lib/api';

type LayoutSummary = Layout & { hotspotCount: number; assignedCards: number };

const localLayoutImages: Record<string, ImageSourcePropType> = {
  'layout1.jpg': require('@/assets/images/layout1.jpg'),
  'layout2.jpg': require('@/assets/images/layout2.jpg'),
};

function resolveLayoutImageSource(imageUrl?: string | null): ImageSourcePropType | null {
  if (!imageUrl) return null;
  if (localLayoutImages[imageUrl]) return localLayoutImages[imageUrl];
  if (/^https?:\/\//i.test(imageUrl)) return { uri: imageUrl };
  return null;
}

export default function LayoutsScreen() {
  const { t } = useTranslation();
  const surface = getSurfaceColors(useColorScheme());
  const navigation = useNavigation();
  const layoutsQuery = useQuery({ queryKey: ['layouts'], queryFn: fetchLayouts });
  const locationsQuery = useQuery({ queryKey: ['locations'], queryFn: fetchLocations });

  const refreshing = layoutsQuery.isRefetching || locationsQuery.isRefetching;
  const onRefresh = () => {
    layoutsQuery.refetch();
    locationsQuery.refetch();
  };

  const summaries = useMemo<LayoutSummary[]>(() => {
    const locations = locationsQuery.data ?? [];
    const grouped = new Map<string, { hotspotCount: number; assignedCards: number }>();
    locations.forEach((location) => {
      const entry = grouped.get(location.layoutid) ?? { hotspotCount: 0, assignedCards: 0 };
      entry.hotspotCount += 1;
      if (location.nfccardid) entry.assignedCards += 1;
      grouped.set(location.layoutid, entry);
    });

    return (layoutsQuery.data ?? []).map((layout) => {
      const stats = grouped.get(layout.id) ?? { hotspotCount: 0, assignedCards: 0 };
      return { ...layout, ...stats };
    });
  }, [layoutsQuery.data, locationsQuery.data]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => Alert.alert('Yeni Yerleşim', 'Bu özellik yakında eklenecektir.')}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
          <ThemedText style={styles.headerActionLabel}>{t('layouts.addLayout')}</ThemedText>
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  if (layoutsQuery.isLoading || locationsQuery.isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Yerleşimler yükleniyor…</ThemedText>
      </ThemedView>
    );
  }

  if (layoutsQuery.error || locationsQuery.error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">Yerleşim verileri alınamadı</ThemedText>
        <ThemedText style={styles.errorHint} onPress={onRefresh}>
          Yeniden dene
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <ThemedText style={[styles.subtitle, { color: surface.mutedText }]}>
            Yerleşim planlarını oluşturup nokta ekleyin.
          </ThemedText>
        </View>

        {summaries.length === 0 ? (
          <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
            <ThemedText style={{ color: surface.mutedText }}>Henüz plan yüklenmemiş.</ThemedText>
          </View>
        ) : (
          summaries.map((layout) => (
            <LayoutCard key={layout.id} layout={layout} surface={surface} onPress={() => router.push(`/layout/${layout.id}`)} />
          ))
        )}
      </ScrollView>
    </ThemedView>
  );
}

function LayoutCard({
  layout,
  surface,
  onPress,
}: {
  layout: LayoutSummary;
  surface: ReturnType<typeof getSurfaceColors>;
  onPress: () => void;
}) {
  const imageSource = resolveLayoutImageSource(layout.imageurl);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.layoutCard,
        {
          backgroundColor: surface.card,
          borderColor: surface.border,
        },
      ]}>
      <View style={styles.layoutHeader}>
        <View>
          <ThemedText style={styles.layoutName}>{layout.name}</ThemedText>
          <ThemedText style={styles.layoutSubtitle}>
            {layout.hotspotCount} nokta · {layout.assignedCards} kart
          </ThemedText>
        </View>
        <Ionicons name="map-outline" size={20} color="#2563eb" />
      </View>
      {imageSource ? (
        <Image source={imageSource} style={styles.layoutPreview} resizeMode="cover" />
      ) : null}
      <View style={styles.layoutActions}>
        <LayoutAction icon="add-circle-outline" label="Yeni Nokta" />
        <LayoutAction icon="resize-outline" label="Planı Güncelle" />
      </View>
    </Pressable>
  );
}

function LayoutAction({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.layoutAction}>
      <Ionicons name={icon} size={16} color="#2563eb" />
      <ThemedText style={styles.layoutActionText}>{label}</ThemedText>
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
    gap: 12,
  },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  subtitle: {
    fontSize: 13,
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
  layoutCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  layoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  layoutName: {
    fontSize: 17,
    fontWeight: '700',
  },
  layoutSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  layoutPreview: {
    width: '100%',
    height: 120,
    borderRadius: 14,
    backgroundColor: 'rgba(148,163,184,0.16)',
  },
  layoutActions: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  layoutAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.08)',
  },
  layoutActionText: {
    fontWeight: '600',
  },
});
