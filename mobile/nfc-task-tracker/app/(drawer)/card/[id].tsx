import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useState } from 'react';
import { Picker } from '@react-native-picker/picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Card, fetchCardById, fetchLocations, updateCard } from '@/lib/api';

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const surface = getSurfaceColors(colorScheme);
  const textColor = colorScheme === 'dark' ? '#ECEFF7' : '#0F172A';

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ alias: '', assignedlocationid: '' });

  const cardQuery = useQuery({
    queryKey: ['card', id],
    queryFn: () => fetchCardById(id ?? ''),
    enabled: Boolean(id),
  });

  const locationsQuery = useQuery({ queryKey: ['locations'], queryFn: fetchLocations });
  const locations = locationsQuery.data ?? [];

  const updateMutation = useMutation({
    mutationFn: (payload: { alias: string; assignedlocationid: string }) =>
      updateCard(id ?? '', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['card', id] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      setIsEditing(false);
      Alert.alert('Başarılı', 'Kart güncellendi');
    },
    onError: (error: Error) => {
      Alert.alert('Hata', error.message || 'Kart güncellenemedi');
    },
  });

  const handleEdit = () => {
    if (cardQuery.data) {
      setForm({
        alias: cardQuery.data.alias || '',
        assignedlocationid: cardQuery.data.assignedlocationid || '',
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setForm({ alias: '', assignedlocationid: '' });
  };

  if (!id) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Kart bulunamadı</ThemedText>
      </ThemedView>
    );
  }

  if (cardQuery.isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Yükleniyor…</ThemedText>
      </ThemedView>
    );
  }

  if (cardQuery.error || !cardQuery.data) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">Kart getirilemedi</ThemedText>
        <ThemedText style={styles.retry} onPress={() => cardQuery.refetch()}>
          Tekrar dene
        </ThemedText>
      </ThemedView>
    );
  }

  const card = cardQuery.data as Card;
  const infoItems = buildInfoItems(card);

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color={textColor} />
            </Pressable>
            <View style={styles.titleContainer}>
              <ThemedText style={styles.title}>{card.alias || 'İsimsiz Kart'}</ThemedText>
            </View>
            {!isEditing && (
              <Pressable onPress={handleEdit}>
                <Ionicons name="create-outline" size={22} color="#2563eb" />
              </Pressable>
            )}
          </View>
        </View>

        {isEditing ? (
          <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Kart İsmi</ThemedText>
              <TextInput
                style={[styles.input, { borderColor: surface.border, color: textColor }]}
                value={form.alias}
                onChangeText={(text) => setForm((prev) => ({ ...prev, alias: text }))}
                placeholder="Kart ismi girin"
                placeholderTextColor={surface.mutedText}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Atanan Lokasyon</ThemedText>
              <View style={[styles.pickerContainer, { borderColor: surface.border }]}>
                <Picker
                  selectedValue={form.assignedlocationid}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, assignedlocationid: value }))}
                  style={styles.picker}>
                  <Picker.Item label="Lokasyon Yok" value="" />
                  {locations.map((location) => (
                    <Picker.Item key={location.id} label={location.name} value={location.id} />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.editActions}>
              <Pressable style={styles.cancelButton} onPress={handleCancel}>
                <ThemedText style={styles.cancelButtonText}>İptal</ThemedText>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSave} disabled={updateMutation.isPending}>
                <ThemedText style={styles.saveButtonText}>
                  {updateMutation.isPending ? 'Kaydediliyor...' : 'Kaydet'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
            {infoItems.map((item) => (
              <View key={item.label} style={styles.infoRow}>
                <Ionicons name={item.icon} size={20} color={surface.mutedText} />
                <View style={styles.infoTextContainer}>
                  <ThemedText style={styles.infoLabel}>{item.label}</ThemedText>
                  <ThemedText style={styles.infoValue}>{item.value}</ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function buildInfoItems(card: Card) {
  return [
    {
      icon: 'person-outline',
      label: 'Atanan Kullanıcı',
      value: card.assigneduserid ?? '—',
    },
    {
      icon: 'pin-outline',
      label: 'Atanan Lokasyon',
      value: card.assignedlocationid ?? '—',
    },
    {
      icon: 'time-outline',
      label: 'Oluşturulma',
      value: formatDate(card.createdat),
    },
    {
      icon: 'card-outline',
      label: 'UID',
      value: card.uid ?? '—',
    },
    {
      icon: 'checkmark-done-outline',
      label: 'Atanan Görev',
      value: card.assignedtaskid ?? '—',
    },
  ];
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
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
    gap: 8,
  },
  retry: {
    color: '#2563eb',
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
  titleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.3)',
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});