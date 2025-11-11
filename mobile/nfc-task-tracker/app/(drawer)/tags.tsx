import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Tag, createTag, deleteTag, fetchTags, updateTag } from '@/lib/api';

const PRESET_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#EAB308', // Yellow
  '#84CC16', // Lime
  '#22C55E', // Green
  '#10B981', // Emerald
  '#14B8A6', // Teal
  '#06B6D4', // Cyan
  '#0EA5E9', // Sky
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#A855F7', // Purple
  '#D946EF', // Fuchsia
  '#EC4899', // Pink
];

export default function TagsScreen() {
  const { t } = useTranslation();
  const surface = getSurfaceColors(useColorScheme());
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(PRESET_COLORS[0]);

  const tagsQuery = useQuery({ queryKey: ['tags'], queryFn: fetchTags });
  const tags = tagsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      resetForm();
      Alert.alert('Başarılı', 'Tag oluşturuldu');
    },
    onError: (error: Error) => {
      Alert.alert('Hata', error.message || 'Tag oluşturulamadı');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; color: string } }) =>
      updateTag(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      resetForm();
      Alert.alert('Başarılı', 'Tag güncellendi');
    },
    onError: (error: Error) => {
      Alert.alert('Hata', error.message || 'Tag güncellenemedi');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      Alert.alert('Başarılı', 'Tag silindi');
    },
    onError: (error: Error) => {
      Alert.alert('Hata', error.message || 'Tag silinemedi');
    },
  });

  const resetForm = () => {
    setFormName('');
    setFormColor(PRESET_COLORS[0]);
    setEditingTag(null);
    setShowCreateModal(false);
  };

  const handleSave = () => {
    if (!formName.trim()) {
      Alert.alert('Hata', 'Tag ismi zorunludur');
      return;
    }

    if (editingTag) {
      updateMutation.mutate({
        id: editingTag.id,
        payload: { name: formName.trim(), color: formColor },
      });
    } else {
      createMutation.mutate({ name: formName.trim(), color: formColor });
    }
  };

  const handleEdit = (tag: Tag) => {
    setEditingTag(tag);
    setFormName(tag.name);
    setFormColor(tag.color || PRESET_COLORS[0]);
    setShowCreateModal(true);
  };

  const handleDelete = (tag: Tag) => {
    Alert.alert('Emin misiniz?', `"${tag.name}" tag'ini silmek istediğinizden emin misiniz?`, [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deleteMutation.mutate(tag.id) },
    ]);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => setShowCreateModal(true)}
          activeOpacity={0.7}>
          <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
          <ThemedText style={styles.headerActionLabel}>Yeni Tag</ThemedText>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  if (tagsQuery.isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>{t('common.loading')}</ThemedText>
      </ThemedView>
    );
  }

  if (tagsQuery.error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">Tag'ler yüklenemedi</ThemedText>
        <ThemedText style={styles.retry} onPress={() => tagsQuery.refetch()}>
          {t('common.retry')}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={tagsQuery.isRefetching} onRefresh={tagsQuery.refetch} />
        }>
        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          {tags.length === 0 ? (
            <ThemedText style={{ color: surface.mutedText }}>Henüz tag eklenmemiş</ThemedText>
          ) : (
            tags.map((tag) => (
              <View key={tag.id} style={styles.tagRow}>
                <View style={styles.tagInfo}>
                  <View style={[styles.tagColorDot, { backgroundColor: tag.color || '#6B7280' }]} />
                  <ThemedText style={styles.tagName}>{tag.name}</ThemedText>
                </View>
                <View style={styles.tagActions}>
                  <Pressable onPress={() => handleEdit(tag)} style={styles.iconButton}>
                    <Ionicons name="create-outline" size={20} color="#2563EB" />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(tag)} style={styles.iconButton}>
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Create/Edit Modal */}
      <Modal visible={showCreateModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: surface.card }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>
                {editingTag ? 'Tag Düzenle' : 'Yeni Tag'}
              </ThemedText>
              <Pressable onPress={resetForm}>
                <Ionicons name="close" size={24} color={surface.text} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Tag İsmi *</ThemedText>
                <TextInput
                  style={[styles.input, { borderColor: surface.border, color: surface.text }]}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="Örn: Acil, Ofis, Temizlik"
                  placeholderTextColor={surface.mutedText}
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Renk</ThemedText>
                <View style={styles.colorGrid}>
                  {PRESET_COLORS.map((color) => (
                    <Pressable
                      key={color}
                      style={[
                        styles.colorOption,
                        { backgroundColor: color },
                        formColor === color && styles.colorOptionSelected,
                      ]}
                      onPress={() => setFormColor(color)}>
                      {formColor === color && <Ionicons name="checkmark" size={20} color="#FFF" />}
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.modalActions}>
                <Pressable style={styles.cancelButton} onPress={resetForm}>
                  <ThemedText style={styles.cancelButtonText}>İptal</ThemedText>
                </Pressable>
                <Pressable
                  style={styles.saveButton}
                  onPress={handleSave}
                  disabled={createMutation.isPending || updateMutation.isPending}>
                  <ThemedText style={styles.saveButtonText}>
                    {createMutation.isPending || updateMutation.isPending
                      ? 'Kaydediliyor...'
                      : 'Kaydet'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
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
  retry: {
    color: '#2563eb',
  },
  content: {
    padding: 16,
    gap: 16,
  },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.25)',
  },
  tagInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  tagColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  tagName: {
    fontSize: 15,
    fontWeight: '600',
  },
  tagActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 4,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.25)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: 16,
    gap: 20,
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
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
});
