import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, ImageSourcePropType, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { fetchLayoutById, fetchLocationsByLayout, updateLayout } from '@/lib/api';

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

export default function LayoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const surface = getSurfaceColors(useColorScheme());
  const queryClient = useQueryClient();

  const layoutQuery = useQuery({
    queryKey: ['layout', id],
    queryFn: () => fetchLayoutById(id ?? ''),
    enabled: Boolean(id),
  });

  const locationsQuery = useQuery({
    queryKey: ['layout-locations', id],
    queryFn: () => fetchLocationsByLayout(id ?? ''),
    enabled: Boolean(id),
  });

  const [editMode, setEditMode] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (layoutQuery.data) {
      setImageUrl(layoutQuery.data.imageurl ?? '');
    }
  }, [layoutQuery.data]);

  const updateImage = useMutation({
    mutationFn: (url: string) => updateLayout(id ?? '', { imageurl: url || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['layout', id] });
      setEditMode(false);
    },
  });

  if (!id) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Yerleşim bulunamadı</ThemedText>
      </ThemedView>
    );
  }

  if (layoutQuery.isLoading || locationsQuery.isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Yükleniyor…</ThemedText>
      </ThemedView>
    );
  }

  const layout = layoutQuery.data;
  const locations = locationsQuery.data ?? [];

  if (!layout) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Bu yerleşim silinmiş olabilir.</ThemedText>
      </ThemedView>
    );
  }

  const imageSource = resolveLayoutImageSource(layout.imageurl);

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <View style={styles.headerRow}>
            <Ionicons name="arrow-back" size={22} color={surface.text} onPress={() => router.back()} />
            <ThemedText style={styles.detailTitle}>{layout.name}</ThemedText>
            <View style={{ width: 22 }} />
          </View>
          <View style={styles.editRow}>
            <ThemedText style={styles.subtitle}>Düzenleme modu</ThemedText>
            <Switch value={editMode} onValueChange={setEditMode} />
          </View>
          {editMode ? (
            <View style={styles.formArea}>
              <TextInput
                style={[styles.input, { borderColor: surface.border, color: surface.text }]}
                placeholder="Plan görseli URL"
                placeholderTextColor={surface.mutedText}
                value={imageUrl}
                onChangeText={setImageUrl}
              />
              <View style={styles.editActions}>
                <PressableText label="İptal" onPress={() => {
                  setEditMode(false);
                  setImageUrl(layout.imageurl ?? '');
                }} />
                <PressableText
                  label={updateImage.isPending ? 'Kaydediliyor…' : 'Kaydet'}
                  primary
                  disabled={updateImage.isPending}
                  onPress={() => updateImage.mutate(imageUrl)}
                />
              </View>
            </View>
          ) : null}
          {imageSource ? (
            <View style={styles.mapPreview}>
              <Image source={imageSource} style={styles.previewImage} resizeMode="cover" />
              {locations.map((loc) => (
                <View
                  key={loc.id}
                  pointerEvents="none"
                  style={[
                    styles.mapMarkerWrap,
                    {
                      left: `${Math.max(0, Math.min(100, loc.x ?? 0))}%`,
                      top: `${Math.max(0, Math.min(100, loc.y ?? 0))}%`,
                    },
                  ]}>
                  <View style={styles.mapMarker}>
                    <Ionicons name="location" size={16} color="#fff" />
                  </View>
                  <View style={styles.mapMarkerLabel}>
                    <ThemedText numberOfLines={1} style={styles.mapMarkerLabelText}>
                      {loc.name}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={[styles.mapPreview, styles.previewPlaceholder]}>
              <Ionicons name="image-outline" size={32} color={surface.mutedText} />
              <ThemedText style={{ color: surface.mutedText }}>Plan görüntüsü yok</ThemedText>
            </View>
          )}
        </View>

        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <ThemedText style={styles.subtitle}>Noktalar</ThemedText>
          {locations.length === 0 ? (
            <ThemedText style={{ color: surface.mutedText }}>Bu yerleşimde kayıtlı nokta yok.</ThemedText>
          ) : (
            locations.map((loc) => (
              <View key={loc.id} style={styles.hotspotRow}>
                <Ionicons name="radio-button-on-outline" size={16} color="#2563eb" />
                <ThemedText style={styles.hotspotLabel}>{loc.name}</ThemedText>
                <ThemedText style={[styles.hotspotCoords, { color: surface.mutedText }]}>
                  x:{loc.x ?? '?'} · y:{loc.y ?? '?'}
                </ThemedText>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function PressableText({
  label,
  onPress,
  primary,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <View
      style={[
        styles.actionButton,
        primary && styles.actionButtonPrimary,
        disabled && { opacity: 0.5 },
      ]}>
      <ThemedText
        style={[
          styles.actionButtonLabel,
          primary && styles.actionButtonLabelPrimary,
        ]}
        onPress={disabled ? undefined : onPress}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formArea: {
    gap: 10,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionButtonPrimary: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  actionButtonLabel: {
    fontWeight: '600',
  },
  actionButtonLabelPrimary: {
    color: '#fff',
  },
  mapPreview: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(148,163,184,0.16)',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  mapMarkerWrap: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -18 }, { translateY: -34 }],
    maxWidth: 120,
  },
  mapMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#dc2626',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  mapMarkerLabel: {
    marginTop: 4,
    maxWidth: 120,
    borderRadius: 8,
    backgroundColor: 'rgba(15,23,42,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  mapMarkerLabelText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  previewPlaceholder: {
    backgroundColor: 'rgba(148,163,184,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  hotspotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.25)',
  },
  hotspotLabel: {
    flex: 1,
    fontWeight: '500',
  },
  hotspotCoords: {
    fontSize: 12,
  },
});
