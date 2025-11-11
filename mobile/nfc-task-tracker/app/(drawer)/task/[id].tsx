import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  getActionColors,
  getStatusBadgeColors,
  getSurfaceColors,
} from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Task,
  TaskStatus,
  TaskUpdateInput,
  fetchTasks,
  fetchUsers,
  fetchLocations,
  updateTask,
  updateTaskStatus,
} from '@/lib/api';

type StatusAction = {
  label: string;
  target: TaskStatus;
  visible: (task: Task) => boolean;
  icon: keyof typeof Ionicons.glyphMap;
};

const STATUS_ACTIONS: StatusAction[] = [
  {
    label: 'Start',
    target: 'in_progress',
    icon: 'play-outline',
    visible: (task) => task.status === 'not_started',
  },
  {
    label: 'Done',
    target: 'completed',
    icon: 'checkmark-done-outline',
    visible: (task) => task.status !== 'completed',
  },
];

type SurfacePalette = ReturnType<typeof getSurfaceColors>;
type ActionPalette = ReturnType<typeof getActionColors>;

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const surface = getSurfaceColors(colorScheme);
  const actionColors = getActionColors(colorScheme);

  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: fetchTasks });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const locationsQuery = useQuery({ queryKey: ['locations'], queryFn: fetchLocations });
  const task = tasksQuery.data?.find((t) => t.id === id);
  const users = usersQuery.data ?? [];
  const locations = locationsQuery.data ?? [];

  // Create a map of user IDs to user names
  const usersMap = new Map(
    users.map((user) => [user.id, user.name || user.username || user.email || user.id])
  );

  // Create a map of location IDs to location names
  const locationsMap = new Map(locations.map((loc) => [loc.id, loc.name]));

  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    userid: '',
    locationid: '',
    repeat_unit: 'none' as 'none' | 'hours' | 'days',
    repeat_frequency: 1,
  });
  const [localError, setLocalError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  // Initialize form when task is loaded
  useEffect(() => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? '',
        dueDate: formatDateForInput(task.duedate ?? task.nextdueat),
        userid: task.userid ?? '',
        locationid: task.locationid ?? '',
        repeat_unit: (task.repeat_unit as 'none' | 'hours' | 'days') ?? 'none',
        repeat_frequency: task.repeat_frequency ?? 1,
      });
      setIsEditing(false);
    }
  }, [id]);

  const updateStatus = useMutation({
    mutationFn: ({ status }: { status: TaskStatus }) => updateTaskStatus(id!, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: () => Alert.alert('Error', 'Failed to update status'),
  });

  const updateTaskMutation = useMutation({
    mutationFn: (payload: TaskUpdateInput) => updateTask(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsEditing(false);
      setLocalError(null);
    },
    onError: () => {
      setLocalError('Failed to update task');
    },
  });

  const handleSave = () => {
    if (!form.title.trim()) {
      setLocalError('Title is required');
      return;
    }

    const payload: TaskUpdateInput = {
      title: form.title.trim(),
      description: form.description.trim() ? form.description.trim() : null,
      duedate: parseDateInput(form.dueDate),
      userid: form.userid || null,
      locationid: form.locationid || null,
      repeat_unit: form.repeat_unit === 'none' ? null : form.repeat_unit,
      repeat_frequency: form.repeat_unit === 'none' ? null : form.repeat_frequency,
    };

    updateTaskMutation.mutate(payload);
  };

  const handleCancel = () => {
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? '',
        dueDate: formatDateForInput(task.duedate ?? task.nextdueat),
        userid: task.userid ?? '',
        locationid: task.locationid ?? '',
        repeat_unit: (task.repeat_unit as 'none' | 'hours' | 'days') ?? 'none',
        repeat_frequency: task.repeat_frequency ?? 1,
      });
    }
    setLocalError(null);
    setIsEditing(false);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || tempDate;
    setShowDatePicker(Platform.OS === 'ios');
    setTempDate(currentDate);
    setForm((prev) => ({ ...prev, dueDate: currentDate.toISOString() }));
  };

// Helper functions
function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return 'No due date';
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateStr;
  }
}

function formatDateForInput(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    // Ensure the date is valid before formatting
    if (isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:00.000Z`; // ISO 8601 format for consistency
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

  if (tasksQuery.isLoading) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <ThemedText style={styles.loadingText}>{t('common.loading')}</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!task) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
        <View style={styles.centered}>
          <ThemedText type="subtitle">Task not found</ThemedText>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}>
            <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={surface.text} />
            <ThemedText style={styles.backButtonText}>Back</ThemedText>
          </Pressable>
        </View>

        {/* Task Card */}
        <View
          style={[
            styles.taskCard,
            { backgroundColor: surface.card, borderColor: surface.border },
          ]}>
          {/* Status Badge */}
          <View style={styles.statusRow}>
            <ThemedText style={styles.label}>{t('tasks.status')}:</ThemedText>
            <StatusBadge status={task.status} />
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: surface.border }]} />

          {/* Edit/View Mode */}
          {isEditing ? (
            <View style={styles.editSection}>
              {/* Title */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Ionicons name="text-outline" size={18} color="#2563EB" />
                  <ThemedText style={styles.labelText}>Title *</ThemedText>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    { borderColor: surface.border, color: surface.text ?? '#0F172A' },
                  ]}
                  placeholder="Enter task title"
                  placeholderTextColor={surface.mutedText}
                  value={form.title}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, title: text }))}
                />
              </View>

              {/* Description */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Ionicons name="document-text-outline" size={18} color="#2563EB" />
                  <ThemedText style={styles.labelText}>Description</ThemedText>
                </View>
                <TextInput
                  style={[
                    styles.input,
                    styles.multilineInput,
                    { borderColor: surface.border, color: surface.text ?? '#0F172A' },
                  ]}
                  placeholder="Add details..."
                  placeholderTextColor={surface.mutedText}
                  multiline
                  numberOfLines={3}
                  value={form.description}
                  onChangeText={(text) => setForm((prev) => ({ ...prev, description: text }))}
                />
              </View>

              {/* Due Date */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Ionicons name="calendar-outline" size={18} color="#2563EB" />
                  <ThemedText style={styles.labelText}>Due Date</ThemedText>
                </View>
                <Pressable
                  style={[
                    styles.input,
                    styles.datePickerButton,
                    { borderColor: surface.border, backgroundColor: surface.card },
                  ]}
                  onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar" size={18} color={surface.mutedText} />
                  <ThemedText style={{ color: form.dueDate ? surface.text : surface.mutedText, flex: 1 }}>
                    {form.dueDate || 'Select date and time'}
                  </ThemedText>
                  <Ionicons name="chevron-forward" size={18} color={surface.mutedText} />
                </Pressable>
                {showDatePicker && (
                  <DateTimePicker
                    value={form.dueDate ? new Date(form.dueDate) : new Date()}
                    mode="datetime"
                    is24Hour={true}
                    display="default"
                    onChange={handleDateChange}
                  />
                )}
              </View>

              {/* Assigned To */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Ionicons name="person-outline" size={18} color="#2563EB" />
                  <ThemedText style={styles.labelText}>Assigned To</ThemedText>
                </View>
                <View style={[styles.pickerContainer, { borderColor: surface.border }]}>
                  <Picker
                    selectedValue={form.userid}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, userid: value }))}
                    style={styles.picker}>
                    <Picker.Item label="Unassigned" value="" />
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

              {/* Location */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Ionicons name="location-outline" size={18} color="#2563EB" />
                  <ThemedText style={styles.labelText}>Location</ThemedText>
                </View>
                <View style={[styles.pickerContainer, { borderColor: surface.border }]}>
                  <Picker
                    selectedValue={form.locationid}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, locationid: value }))}
                    style={styles.picker}>
                    <Picker.Item label="No Location" value="" />
                    {locations.map((location) => (
                      <Picker.Item key={location.id} label={location.name} value={location.id} />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* Repeat */}
              <View style={styles.formGroup}>
                <View style={styles.labelRow}>
                  <Ionicons name="repeat-outline" size={18} color="#2563EB" />
                  <ThemedText style={styles.labelText}>Repeat</ThemedText>
                </View>
                <View style={[styles.pickerContainer, { borderColor: surface.border }]}>
                  <Picker
                    selectedValue={form.repeat_unit}
                    onValueChange={(value) =>
                      setForm((prev) => ({ ...prev, repeat_unit: value as 'none' | 'hours' | 'days' }))
                    }
                    style={styles.picker}>
                    <Picker.Item label="No Repeat" value="none" />
                    <Picker.Item label="Every X Hours" value="hours" />
                    <Picker.Item label="Every X Days" value="days" />
                  </Picker>
                </View>
                {form.repeat_unit !== 'none' && (
                  <View style={styles.repeatFrequencyRow}>
                    <View style={styles.repeatInputContainer}>
                      <ThemedText style={[styles.labelText, { marginRight: 8 }]}>Every</ThemedText>
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
                      <ThemedText style={[styles.labelText, { marginLeft: 8 }]}>
                        {form.repeat_unit}
                      </ThemedText>
                    </View>
                  </View>
                )}
              </View>

              {localError ? (
                <ThemedText style={styles.errorText}>{localError}</ThemedText>
              ) : null}

              <View style={styles.editActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={handleCancel}>
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.buttonPressed,
                    updateTaskMutation.isPending && styles.buttonDisabled,
                  ]}
                  disabled={updateTaskMutation.isPending}
                  onPress={handleSave}>
                  <ThemedText style={styles.saveButtonText}>
                    {updateTaskMutation.isPending ? 'Saving…' : 'Save'}
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.viewSection}>
              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Title</ThemedText>
                <ThemedText style={styles.valueText}>{task.title}</ThemedText>
              </View>

              {task.description ? (
                <View style={styles.formGroup}>
                  <ThemedText style={styles.label}>Description</ThemedText>
                  <ThemedText style={[styles.valueText, { color: surface.mutedText }]}>
                    {task.description}
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Due Date</ThemedText>
                <View style={styles.metaItem}>
                  <Ionicons name="calendar-outline" size={16} color={surface.mutedText} />
                  <ThemedText style={[styles.valueText, { color: surface.mutedText }]}>
                    {formatDueDate(task.duedate ?? task.nextdueat)}
                  </ThemedText>
                </View>
              </View>

              {task.locationid ? (
                <View style={styles.formGroup}>
                  <ThemedText style={styles.label}>Location</ThemedText>
                  <View style={styles.metaItem}>
                    <Ionicons name="pin-outline" size={16} color={surface.mutedText} />
                    <ThemedText style={[styles.valueText, { color: surface.mutedText }]}>
                      {locationsMap.get(task.locationid) || task.locationid}
                    </ThemedText>
                  </View>
                </View>
              ) : null}

              {task.userid ? (
                <View style={styles.formGroup}>
                  <ThemedText style={styles.label}>{t('tasks.assignedTo')}</ThemedText>
                  <View style={styles.metaItem}>
                    <Ionicons name="person-outline" size={16} color={surface.mutedText} />
                    <ThemedText style={[styles.valueText, { color: surface.mutedText }]}>
                      {usersMap.get(task.userid) || task.userid}
                    </ThemedText>
                  </View>
                </View>
              ) : null}

              {task.repeat_unit && task.repeat_unit !== 'none' ? (
                <View style={styles.formGroup}>
                  <ThemedText style={styles.label}>Repeat</ThemedText>
                  <View style={styles.metaItem}>
                    <Ionicons name="repeat-outline" size={16} color={surface.mutedText} />
                    <ThemedText style={[styles.valueText, { color: surface.mutedText }]}>
                      Every {task.repeat_frequency} {task.repeat_unit}
                    </ThemedText>
                  </View>
                </View>
              ) : null}
            </View>
          )}

          {/* Action Buttons */}
          {!isEditing && (
            <View style={styles.actionsRow}>
              {STATUS_ACTIONS.filter((action) => action.visible(task)).map((action) => (
                <ActionButton
                  key={action.target}
                  label={updateStatus.isPending ? t('common.updating') : action.label}
                  icon={action.icon}
                  disabled={updateStatus.isPending}
                  actionColors={actionColors}
                  surface={surface}
                  onPress={() => updateStatus.mutate({ status: action.target })}
                />
              ))}
              <ActionButton
                label={t('common.edit')}
                icon="create-outline"
                disabled={false}
                actionColors={actionColors}
                surface={surface}
                onPress={() => {
                  if (task) {
                    setForm({
                      title: task.title,
                      description: task.description ?? '',
                      dueDate: formatDateForInput(task.duedate ?? task.nextdueat),
                      userid: task.userid ?? '',
                      locationid: task.locationid ?? '',
                      repeat_unit: (task.repeat_unit as 'none' | 'hours' | 'days') ?? 'none',
                      repeat_frequency: task.repeat_frequency ?? 1,
                    });
                  }
                  setIsEditing(true);
                }}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const colorScheme = useColorScheme();
  const badge = getStatusBadgeColors(status, colorScheme);
  return (
    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
      <ThemedText style={[styles.statusBadgeText, { color: badge.text }]}>
        {badge.label}
      </ThemedText>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  disabled,
  actionColors,
  surface,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled: boolean;
  actionColors: ActionPalette;
  surface: SurfacePalette;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: actionColors.bg,
          borderColor: actionColors.border,
        },
        pressed && !disabled && styles.actionButtonPressed,
        disabled && styles.buttonDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}>
      <Ionicons
        name={icon}
        size={16}
        color={disabled ? surface.mutedText : actionColors.icon}
      />
      <ThemedText
        style={[
          styles.actionButtonText,
          { color: disabled ? surface.mutedText : actionColors.text },
        ]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

// Helper functions
function formatDueDate(dateStr: string | null): string {
  if (!dateStr) return 'No due date';
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateStr;
  }
}

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
    padding: 16,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  header: {
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 12,
  },
  taskCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    opacity: 0.3,
  },
  editSection: {
    gap: 20,
  },
  viewSection: {
    gap: 16,
  },
  formGroup: {
    gap: 10,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  labelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
  },
  valueText: {
    fontSize: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
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
    height: 50,
  },
  multilineInput: {
    minHeight: 90,
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
  readonlyInput: {
    backgroundColor: '#F9FAFB',
    opacity: 0.7,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
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
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    zIndex: 1000,
    elevation: 5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButtonPressed: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
