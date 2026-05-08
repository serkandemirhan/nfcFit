import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image, ImageSourcePropType, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useMemo } from 'react';
import { router } from 'expo-router';

import { AppBottomNav, bottomNavHeight } from '@/components/app-bottom-nav';
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
  const surface = getSurfaceColors(useColorScheme());
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
      <AppBottomNav />
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
    </Pressable>
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
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  subtitle: {
    fontSize: 13,
  },
  layoutCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  layoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  layoutName: {
    fontSize: 16,
    fontWeight: '700',
  },
  layoutSubtitle: {
    fontSize: 13,
    color: '#6b7280',
  },
  layoutPreview: {
    width: '100%',
    height: 132,
    borderRadius: 10,
    backgroundColor: 'rgba(148,163,184,0.16)',
  },
});
