import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useNavigation } from 'expo-router';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, View, TouchableOpacity } from 'react-native';
import { useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getActionColors, getStatusBadgeColors, getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  Task,
  TaskStatus,
  fetchTasks,
  fetchUsers,
  updateTaskStatus,
  fetchTags,
  fetchAllTaskTags,
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

export default function TasksScreen() {
  const queryClient = useQueryClient();
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const surface = getSurfaceColors(colorScheme);
  const actionColors = getActionColors(colorScheme);
  const tasksQuery = useQuery({ queryKey: ['tasks'], queryFn: fetchTasks });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const tagsQuery = useQuery({ queryKey: ['tags'], queryFn: fetchTags });
  const taskTagsQuery = useQuery({ queryKey: ['task_tags'], queryFn: fetchAllTaskTags });
  const [filter, setFilter] = useState<'active' | 'completed'>('active');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const tasks = tasksQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const tags = tagsQuery.data ?? [];
  const taskTags = taskTagsQuery.data ?? [];

  // Create a map of user IDs to user names
  const usersMap = new Map(
    users.map((user) => [user.id, user.name || user.username || user.email || user.id])
  );

  // Helper function to normalize status (support both Turkish and English)
  const isActiveTask = (task: Task) => {
    const status = task.status.toLowerCase();
    return (
      status === 'not_started' ||
      status === 'yapılacak' ||
      status === 'in_progress' ||
      status === 'devam ediyor'
    );
  };

  const isCompletedTask = (task: Task) => {
    const status = task.status.toLowerCase();
    return status === 'completed' || status === 'tamamlandı';
  };

  // Filter tasks based on status (support both Turkish and English)
  let filteredTasks =
    filter === 'completed'
      ? tasks.filter((task) => isCompletedTask(task))
      : tasks.filter((task) => isActiveTask(task));

  // Filter by selected tags if any are selected
  if (selectedTagIds.length > 0) {
    filteredTasks = filteredTasks.filter((task) => {
      const taskTagIds = taskTags.filter((tt) => tt.taskid === task.id).map((tt) => tt.tagid);
      // Task must have at least one of the selected tags
      return selectedTagIds.some((tagId) => taskTagIds.includes(tagId));
    });
  }

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => updateTaskStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (err: unknown) => Alert.alert(t('tasks.errors.updateFailed'), err instanceof Error ? err.message : t('tasks.errors.unknownError')),
  });

  const onActionPress = (task: Task, status: TaskStatus) => {
    updateStatus.mutate({ id: task.id, status });
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.headerAction}
          onPress={() => router.push('/(drawer)/create-task')}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={20} color="#2563eb" />
          <ThemedText style={styles.headerActionLabel}>{t('tasks.createTask')}</ThemedText>
        </TouchableOpacity>
      ),
    });
  }, [navigation, t]);

  if (tasksQuery.isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>{t('common.loading')}</ThemedText>
      </ThemedView>
    );
  }

  if (tasksQuery.error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">{t('tasks.errors.loadFailed')}</ThemedText>
        <ThemedText onPress={() => tasksQuery.refetch()} style={styles.retry}>
          {t('common.retry')}
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <View style={styles.filterRow}>
        <FilterChip
          label={t('tasks.active')}
          count={tasks.filter((task) => isActiveTask(task)).length}
          active={filter === 'active'}
          onPress={() => setFilter('active')}
        />
        <FilterChip
          label={t('tasks.completed')}
          count={tasks.filter((task) => isCompletedTask(task)).length}
          active={filter === 'completed'}
          onPress={() => setFilter('completed')}
        />
      </View>
      {tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagFilterRow}
          style={styles.tagFilterScrollView}>
          <Pressable
            style={[
              styles.tagFilterChip,
              {
                backgroundColor:
                  selectedTagIds.length === 0 ? 'rgba(37,99,235,0.1)' : 'rgba(148,163,184,0.1)',
                borderColor: selectedTagIds.length === 0 ? '#2563eb' : 'rgba(148,163,184,0.4)',
              },
            ]}
            onPress={() => setSelectedTagIds([])}>
            <ThemedText
              style={[
                styles.tagFilterChipText,
                { color: selectedTagIds.length === 0 ? '#2563eb' : surface.mutedText },
              ]}>
              Tümü
            </ThemedText>
          </Pressable>
          {tags.map((tag) => {
            const isSelected = selectedTagIds.includes(tag.id);
            return (
              <Pressable
                key={tag.id}
                style={[
                  styles.tagFilterChip,
                  {
                    backgroundColor: isSelected ? tag.color || '#6B7280' : 'rgba(148,163,184,0.1)',
                    borderColor: tag.color || '#6B7280',
                  },
                ]}
                onPress={() => {
                  setSelectedTagIds((prev) =>
                    prev.includes(tag.id)
                      ? prev.filter((id) => id !== tag.id)
                      : [...prev, tag.id]
                  );
                }}>
                <View style={[styles.tagDot, { backgroundColor: tag.color || '#6B7280' }]} />
                <ThemedText
                  style={[
                    styles.tagFilterChipText,
                    { color: isSelected ? '#FFFFFF' : surface.text },
                  ]}>
                  {tag.name}
                </ThemedText>
                {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          filteredTasks.length === 0 ? styles.listEmpty : styles.listContent
        }
        refreshControl={
          <RefreshControl refreshing={tasksQuery.isRefetching} onRefresh={tasksQuery.refetch} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ThemedText type="subtitle">
              {filter === 'completed' ? t('tasks.noCompletedTasks') : t('tasks.noActiveTasks')}
            </ThemedText>
          </View>
        }
        ListFooterComponent={<View style={{ height: 32 }} />}
        renderItem={({ item }) => (
          <TaskCard
            key={item.id}
            task={item}
            surface={surface}
            actionColors={actionColors}
            isUpdatingStatus={updateStatus.isPending && updateStatus.variables?.id === item.id}
            onActionPress={onActionPress}
            usersMap={usersMap}
          />
        )}
      />
    </ThemedView>
  );
}

type TaskCardProps = {
  task: Task;
  surface: SurfacePalette;
  actionColors: ActionPalette;
  isUpdatingStatus: boolean;
  onActionPress: (task: Task, status: TaskStatus) => void;
  usersMap: Map<string, string>;
};

function TaskCard({
  task,
  surface,
  actionColors,
  isUpdatingStatus,
  onActionPress,
  usersMap,
}: TaskCardProps) {
  const { t } = useTranslation();
  const description = task.description?.trim();
  const dueString = formatDueDate(task.duedate ?? task.nextdueat);

  return (
    <Pressable
      style={[
        styles.taskCard,
        {
          backgroundColor: surface.card,
          borderColor: surface.border,
        },
      ]}
      onPress={() => router.push(`/(drawer)/task/${task.id}`)}>
      <View style={styles.taskHeader}>
        <ThemedText style={styles.taskTitle}>{task.title}</ThemedText>
        <StatusBadge status={task.status} />
      </View>
      {description ? (
        <ThemedText style={[styles.taskDescription, { color: surface.mutedText }]}>
          {description}
        </ThemedText>
      ) : null}
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={16} color={surface.mutedText} />
          <ThemedText style={[styles.metaValue, { color: surface.mutedText }]}>
            {dueString}
          </ThemedText>
        </View>
        {task.locationid ? (
          <View style={styles.metaItem}>
            <Ionicons name="pin-outline" size={16} color={surface.mutedText} />
            <ThemedText
              style={[styles.metaValue, { color: surface.mutedText }]}
              numberOfLines={1}>
              {task.locationid}
            </ThemedText>
          </View>
        ) : null}
        {task.userid ? (
          <View style={styles.metaItem}>
            <Ionicons name="person-outline" size={16} color={surface.mutedText} />
            <ThemedText
              style={[styles.metaValue, { color: surface.mutedText }]}
              numberOfLines={1}>
              {usersMap.get(task.userid) || task.userid}
            </ThemedText>
          </View>
        ) : null}
      </View>
      <View style={styles.actionsRow}>
        {STATUS_ACTIONS.filter((action) => action.visible(task)).map((action) => (
          <TaskActionButton
            key={action.target}
            label={isUpdatingStatus ? 'Updating…' : action.label}
            icon={action.icon}
            disabled={isUpdatingStatus}
            actionColors={actionColors}
            surface={surface}
            onPress={() => onActionPress(task, action.target)}
          />
        ))}
      </View>
    </Pressable>
  );
}

type TaskActionButtonProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled: boolean;
  actionColors: ActionPalette;
  surface: SurfacePalette;
  onPress: () => void;
};

function TaskActionButton({
  label,
  icon,
  disabled,
  actionColors,
  surface,
  onPress,
}: TaskActionButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionButton,
        {
          backgroundColor: actionColors.background,
          borderColor: surface.border,
        },
        pressed && styles.actionButtonPressed,
        disabled && styles.actionButtonDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}>
      <Ionicons name={icon} size={16} color={actionColors.text} />
      <ThemedText style={[styles.actionButtonText, { color: actionColors.text }]}>{label}</ThemedText>
    </Pressable>
  );
}

function FilterChip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.filterChip, active && styles.filterChipActive]}
      onPress={onPress}>
      <ThemedText style={[styles.filterChipLabel, active && styles.filterChipLabelActive]}>
        {label} · {count}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  retry: {
    color: '#0a7ea4',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  listContent: {
    paddingBottom: 16,
    gap: 10,
  },
  listEmpty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyState: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 48,
  },
  taskCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardPressed: {
    opacity: 0.95,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  taskDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  metaValue: {
    fontSize: 13,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    minWidth: 120,
    justifyContent: 'center',
  },
  actionButtonPressed: {
    opacity: 0.85,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  filterChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  filterChipActive: {
    backgroundColor: 'rgba(37,99,235,0.1)',
    borderColor: '#2563eb',
  },
  filterChipLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  filterChipLabelActive: {
    color: '#2563eb',
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

function StatusBadge({ status }: { status: TaskStatus }) {
  const colorScheme = useColorScheme();
  const { bg, text, label } = getStatusBadgeColors(status, colorScheme);
  return (
    <View style={[styles.statusPill, { backgroundColor: bg }]}>
      <ThemedText style={[styles.statusPillText, { color: text }]}>{label}</ThemedText>
    </View>
  );
}

function formatDueDate(dateString?: string | null) {
  if (!dateString) return 'No due date';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'No due date';

  const formatter = new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return formatter.format(date);
}
