import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  TaskCreateInput,
  createTask,
  fetchCards,
  fetchUsers,
  fetchLocations,
  fetchTags,
  setTaskTags,
} from '@/lib/api';

export default function CreateTaskScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const surface = getSurfaceColors(colorScheme);

  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    userid: '',
    locationid: '',
    cardid: '',
    priority: 'normal' as 'low' | 'normal' | 'high' | 'urgent',
    repeat_unit: 'none' as
      | 'none'
      | 'daily'
      | 'weekdays'
      | 'weekly'
      | 'monthly'
      | 'yearly'
      | 'custom'
      | 'hours'
      | 'days'
      | 'weeks'
      | 'months',
    repeat_frequency: 1,
    custom_unit: 'days' as 'hours' | 'days' | 'weeks' | 'months', // For custom repeat option
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const locationsQuery = useQuery({ queryKey: ['locations'], queryFn: fetchLocations });
  const cardsQuery = useQuery({ queryKey: ['cards'], queryFn: fetchCards });
  const tagsQuery = useQuery({ queryKey: ['tags'], queryFn: fetchTags });
  const users = usersQuery.data ?? [];
  const locations = locationsQuery.data ?? [];
  const cards = cardsQuery.data ?? [];
  const tags = tagsQuery.data ?? [];

  const applyTemplate = (template: 'daily' | 'cleaning' | 'maintenance') => {
    const templates = {
      daily: {
        title: 'Günlük kontrol',
        description: 'Alan kontrolünü tamamla ve sonucu notlara ekle.',
        repeat_unit: 'daily' as const,
        priority: 'normal' as const,
      },
      cleaning: {
        title: 'Temizlik kontrolü',
        description: 'Alanı temizle, eksik sarf malzemesi varsa bildir.',
        repeat_unit: 'daily' as const,
        priority: 'normal' as const,
      },
      maintenance: {
        title: 'Bakım checklist',
        description: 'Makine/alan bakım adımlarını kontrol et.',
        repeat_unit: 'weekly' as const,
        priority: 'high' as const,
      },
    }[template];

    setForm((prev) => ({
      ...prev,
      ...templates,
    }));
  };

  const createTaskMutation = useMutation({
    mutationFn: async (payload: TaskCreateInput) => {
      const task = await createTask(payload);
      // Add tags to the task if any selected
      if (selectedTags.length > 0) {
        await setTaskTags(task.id, selectedTags);
      }
      return task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      Alert.alert('Başarılı', 'Görev oluşturuldu', [
        {
          text: 'Tamam',
          onPress: () => router.back(),
        },
      ]);
    },
    onError: (error: Error) => {
      setLocalError(error.message || 'Görev oluşturulamadı');
    },
  });

  const handleSave = () => {
    if (!form.title.trim()) {
      setLocalError('Başlık zorunludur');
      return;
    }

    // Convert repeat options to database format
    let repeat_unit: 'hours' | 'days' | null = null;
    let repeat_frequency: number | null = null;

    if (form.repeat_unit !== 'none') {
      switch (form.repeat_unit) {
        case 'daily':
          repeat_unit = 'days';
          repeat_frequency = 1;
          break;
        case 'weekdays':
          repeat_unit = 'days';
          repeat_frequency = 1; // Note: Weekday logic should be handled by backend
          break;
        case 'weekly':
          repeat_unit = 'days';
          repeat_frequency = 7;
          break;
        case 'monthly':
          repeat_unit = 'days';
          repeat_frequency = 30;
          break;
        case 'yearly':
          repeat_unit = 'days';
          repeat_frequency = 365;
          break;
        case 'hours':
          repeat_unit = 'hours';
          repeat_frequency = form.repeat_frequency;
          break;
        case 'days':
          repeat_unit = 'days';
          repeat_frequency = form.repeat_frequency;
          break;
        case 'weeks':
          repeat_unit = 'days';
          repeat_frequency = form.repeat_frequency * 7;
          break;
        case 'months':
          repeat_unit = 'days';
          repeat_frequency = form.repeat_frequency * 30;
          break;
        case 'custom':
          // For custom, the sub-picker (custom_unit) determines the actual unit
          if (form.custom_unit === 'hours') {
            repeat_unit = 'hours';
            repeat_frequency = form.repeat_frequency;
          } else if (form.custom_unit === 'days') {
            repeat_unit = 'days';
            repeat_frequency = form.repeat_frequency;
          } else if (form.custom_unit === 'weeks') {
            repeat_unit = 'days';
            repeat_frequency = form.repeat_frequency * 7;
          } else if (form.custom_unit === 'months') {
            repeat_unit = 'days';
            repeat_frequency = form.repeat_frequency * 30;
          }
          break;
        default:
          repeat_unit = 'days';
          repeat_frequency = form.repeat_frequency;
      }
    }

    const payload: TaskCreateInput = {
      title: form.title.trim(),
      description: form.description.trim() ? form.description.trim() : null,
      duedate: parseDateInput(form.dueDate),
      userid: form.userid || null,
      locationid: form.locationid || null,
      repeat_unit,
      repeat_frequency,
      status: 'not_started',
    };

    createTaskMutation.mutate(payload);
  };

  const handleCancel = () => {
    router.back();
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      // Android'de picker'ı kapat
      setShowDatePicker(false);
      // Sadece kullanıcı bir tarih seçtiyse güncelle (cancel etmediyse)
      if (event.type === 'set' && selectedDate) {
        setTempDate(selectedDate);
        setForm((prev) => ({ ...prev, dueDate: formatDateForInput(selectedDate.toISOString()) }));
      }
    } else if (Platform.OS === 'ios' && selectedDate) {
      // iOS'ta her değişiklikte hem tempDate hem de form'u güncelle
      setTempDate(selectedDate);
      setForm((prev) => ({ ...prev, dueDate: formatDateForInput(selectedDate.toISOString()) }));
    }
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={surface.text} />
            <ThemedText style={styles.backButtonText}>Geri</ThemedText>
          </Pressable>
        </View>

        <View style={styles.templateRow}>
          <TemplateChip label="Günlük kontrol" onPress={() => applyTemplate('daily')} />
          <TemplateChip label="Temizlik" onPress={() => applyTemplate('cleaning')} />
          <TemplateChip label="Bakım" onPress={() => applyTemplate('maintenance')} />
        </View>

        {/* Form Card */}
        <View
          style={[
            styles.formCard,
            { backgroundColor: surface.card, borderColor: surface.border },
          ]}>
          <ThemedText style={styles.pageTitle}>Yeni Görev</ThemedText>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: surface.border }]} />

          <View style={styles.formSection}>
            {/* Title */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="text-outline" size={18} color="#2563EB" />
                <ThemedText style={styles.labelText}>Başlık *</ThemedText>
              </View>
              <TextInput
                style={[
                  styles.input,
                  { borderColor: surface.border, color: surface.text ?? '#0F172A' },
                ]}
                placeholder="Görev başlığını girin"
                placeholderTextColor={surface.mutedText}
                value={form.title}
                onChangeText={(text) => setForm((prev) => ({ ...prev, title: text }))}
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="document-text-outline" size={18} color="#2563EB" />
                <ThemedText style={styles.labelText}>Açıklama</ThemedText>
              </View>
              <TextInput
                style={[
                  styles.input,
                  styles.multilineInput,
                  { borderColor: surface.border, color: surface.text ?? '#0F172A' },
                ]}
                placeholder="Detayları ekleyin..."
                placeholderTextColor={surface.mutedText}
                multiline
                numberOfLines={3}
                value={form.description}
                onChangeText={(text) => setForm((prev) => ({ ...prev, description: text }))}
              />
            </View>

            <View style={styles.compactRow}>
              {/* Due Date */}
              <View style={[styles.formGroup, styles.halfField]}>
                <View style={styles.labelRow}>
                  <Ionicons name="calendar-outline" size={16} color="#2563EB" />
                  <ThemedText style={styles.labelText}>Tarih</ThemedText>
                </View>
                <Pressable
                  style={[
                    styles.input,
                    styles.datePickerButton,
                    { borderColor: surface.border, backgroundColor: surface.card },
                  ]}
                  onPress={() => {
                    if (form.dueDate) {
                      const existingDate = new Date(parseDateInput(form.dueDate) || new Date());
                      setTempDate(existingDate);
                    }
                    setShowDatePicker(true);
                  }}>
                  <ThemedText
                    style={{ color: form.dueDate ? surface.text : surface.mutedText, flex: 1 }}
                    numberOfLines={1}>
                    {form.dueDate || 'Seç'}
                  </ThemedText>
                </Pressable>
              </View>

              <View style={[styles.formGroup, styles.halfField]}>
                <View style={styles.labelRow}>
                  <Ionicons name="flag-outline" size={16} color="#2563EB" />
                  <ThemedText style={styles.labelText}>Öncelik</ThemedText>
                </View>
                <View style={[styles.pickerContainer, { borderColor: surface.border }]}>
                  <Picker
                    selectedValue={form.priority}
                    onValueChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        priority: value as 'low' | 'normal' | 'high' | 'urgent',
                      }))
                    }
                    style={styles.picker}>
                    <Picker.Item label="Düşük" value="low" />
                    <Picker.Item label="Normal" value="normal" />
                    <Picker.Item label="Yüksek" value="high" />
                    <Picker.Item label="Acil" value="urgent" />
                  </Picker>
                </View>
              </View>
            </View>

            {showDatePicker && (
              <>
                <DateTimePicker
                  value={tempDate}
                  mode="datetime"
                  is24Hour={true}
                  display="default"
                  onChange={handleDateChange}
                />
                {Platform.OS === 'ios' && (
                  <Pressable
                    style={[styles.saveButton, { marginTop: 8 }]}
                    onPress={() => setShowDatePicker(false)}>
                    <ThemedText style={styles.saveButtonText}>Tamam</ThemedText>
                  </Pressable>
                )}
              </>
            )}

            {/* Assigned To */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="person-outline" size={18} color="#2563EB" />
                <ThemedText style={styles.labelText}>Atanan Kişi</ThemedText>
              </View>
              <View style={[styles.pickerContainer, { borderColor: surface.border }]}>
                <Picker
                  selectedValue={form.userid}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, userid: value }))}
                  style={styles.picker}>
                  <Picker.Item label="Atanmadı" value="" />
                  {users.map((user) => (
                    <Picker.Item
                      key={user.id}
                      label={user.name || user.username || user.email || user.id}
                      value={user.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>

            <View style={styles.compactRow}>
              {/* Location */}
              <View style={[styles.formGroup, styles.halfField]}>
                <View style={styles.labelRow}>
                  <Ionicons name="location-outline" size={16} color="#2563EB" />
                  <ThemedText style={styles.labelText}>Lokasyon</ThemedText>
                </View>
                <View style={[styles.pickerContainer, { borderColor: surface.border }]}>
                  <Picker
                    selectedValue={form.locationid}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, locationid: value }))}
                    style={styles.picker}>
                    <Picker.Item label="Yok" value="" />
                    {locations.map((location) => (
                      <Picker.Item key={location.id} label={location.name} value={location.id} />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={[styles.formGroup, styles.halfField]}>
                <View style={styles.labelRow}>
                  <Ionicons name="card-outline" size={16} color="#2563EB" />
                  <ThemedText style={styles.labelText}>NFC Kart</ThemedText>
                </View>
                <View style={[styles.pickerContainer, { borderColor: surface.border }]}>
                  <Picker
                    selectedValue={form.cardid}
                    onValueChange={(value) => {
                      const card = cards.find((item) => item.id === value);
                      setForm((prev) => ({
                        ...prev,
                        cardid: value,
                        locationid: card?.assignedlocationid || prev.locationid,
                      }));
                    }}
                    style={styles.picker}>
                    <Picker.Item label="Yok" value="" />
                    {cards.map((card) => (
                      <Picker.Item key={card.id} label={card.alias || card.id} value={card.id} />
                    ))}
                  </Picker>
                </View>
              </View>
            </View>

            {/* Repeat */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="repeat-outline" size={18} color="#2563EB" />
                <ThemedText style={styles.labelText}>Tekrar</ThemedText>
              </View>
              <View style={[styles.pickerContainer, { borderColor: surface.border }]}>
                <Picker
                  selectedValue={form.repeat_unit}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      repeat_unit: value as
                        | 'none'
                        | 'daily'
                        | 'weekdays'
                        | 'weekly'
                        | 'monthly'
                        | 'yearly'
                        | 'custom',
                      // Reset frequency to 1 when switching to preset options
                      repeat_frequency: value === 'custom' ? prev.repeat_frequency : 1,
                    }))
                  }
                  style={styles.picker}>
                  <Picker.Item label="Tekrarlanmayan" value="none" />
                  <Picker.Item label="📅 Her gün" value="daily" />
                  <Picker.Item label="🗓️ Hafta içi" value="weekdays" />
                  <Picker.Item label="📆 Her hafta" value="weekly" />
                  <Picker.Item label="📊 Her ay" value="monthly" />
                  <Picker.Item label="🎉 Her yıl" value="yearly" />
                  <Picker.Item label="⚙️ Özel" value="custom" />
                </Picker>
              </View>
              {form.repeat_unit === 'custom' && (
                <View style={styles.repeatFrequencyRow}>
                  <View style={styles.repeatInputContainer}>
                    <ThemedText style={[styles.labelText, { marginRight: 8 }]}>Her</ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        styles.repeatInput,
                        { borderColor: surface.border, color: surface.text },
                      ]}
                      keyboardType="number-pad"
                      value={String(form.repeat_frequency)}
                      onChangeText={(text) => {
                        const num = parseInt(text, 10) || 1;
                        setForm((prev) => ({ ...prev, repeat_frequency: Math.max(1, num) }));
                      }}
                    />
                    <View style={[styles.pickerContainer, { borderColor: surface.border, flex: 1 }]}>
                      <Picker
                        selectedValue={form.custom_unit}
                        onValueChange={(value) =>
                          setForm((prev) => ({
                            ...prev,
                            custom_unit: value as 'hours' | 'days' | 'weeks' | 'months',
                          }))
                        }
                        style={[styles.picker, { height: 40 }]}>
                        <Picker.Item label="saat" value="hours" />
                        <Picker.Item label="gün" value="days" />
                        <Picker.Item label="hafta" value="weeks" />
                        <Picker.Item label="ay" value="months" />
                      </Picker>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {/* Tags */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Ionicons name="pricetag-outline" size={18} color="#2563EB" />
                <ThemedText style={styles.labelText}>Etiketler</ThemedText>
              </View>
              {tagsQuery.isLoading ? (
                <ThemedText style={{ color: surface.mutedText, fontSize: 14 }}>
                  Etiketler yükleniyor...
                </ThemedText>
              ) : tags.length === 0 ? (
                <ThemedText style={{ color: surface.mutedText, fontSize: 14 }}>
                  Henüz etiket eklenmemiş. Yönetici panelinden etiket oluşturabilirsiniz.
                </ThemedText>
              ) : (
                <View style={styles.tagsContainer}>
                  {tags.map((tag) => {
                    const isSelected = selectedTags.includes(tag.id);
                    return (
                      <Pressable
                        key={tag.id}
                        style={[
                          styles.tagChip,
                          {
                            backgroundColor: isSelected
                              ? tag.color || '#6B7280'
                              : 'rgba(148, 163, 184, 0.1)',
                            borderColor: tag.color || '#6B7280',
                            borderWidth: 1.5,
                          },
                        ]}
                        onPress={() => {
                          setSelectedTags((prev) =>
                            prev.includes(tag.id)
                              ? prev.filter((id) => id !== tag.id)
                              : [...prev, tag.id]
                          );
                        }}>
                        <ThemedText
                          style={[
                            styles.tagChipText,
                            { color: isSelected ? '#FFFFFF' : surface.text },
                          ]}>
                          {tag.name}
                        </ThemedText>
                        {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {localError ? <ThemedText style={styles.errorText}>{localError}</ThemedText> : null}

            <View style={styles.editActions}>
              <Pressable
                style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
                onPress={handleCancel}>
                <ThemedText style={styles.cancelButtonText}>İptal</ThemedText>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.buttonPressed,
                  createTaskMutation.isPending && styles.buttonDisabled,
                ]}
                disabled={createTaskMutation.isPending}
                onPress={handleSave}>
                <ThemedText style={styles.saveButtonText}>
                  {createTaskMutation.isPending ? 'Oluşturuluyor…' : 'Oluştur'}
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function TemplateChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.templateChip} onPress={onPress}>
      <ThemedText style={styles.templateChipText}>{label}</ThemedText>
    </Pressable>
  );
}

// Helper functions
function formatDateForInput(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch {
    return '';
  }
}

function parseDateInput(input: string): string | null {
  if (!input.trim()) return null;
  try {
    const date = new Date(input);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
  },
  header: {
    marginBottom: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  templateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  templateChip: {
    borderRadius: 999,
    backgroundColor: 'rgba(37,99,235,0.1)',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  templateChipText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '800',
  },
  formCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    opacity: 0.3,
  },
  formSection: {
    gap: 13,
  },
  formGroup: {
    gap: 7,
  },
  compactRow: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: {
    height: 44,
  },
  multilineInput: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  repeatFrequencyRow: {
    marginTop: 10,
  },
  repeatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
    padding: 12,
    borderRadius: 10,
  },
  repeatInput: {
    flex: 1,
    textAlign: 'center',
    padding: 10,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  saveButton: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
