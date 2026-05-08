import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';
import { useMemo } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppUser, deleteUserById, fetchUsers, updateUserPassword } from '@/lib/api';

export default function UsersScreen() {
  const surface = getSurfaceColors(useColorScheme());
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      updateUserPassword(id, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      Alert.alert('Başarılı', 'Parola 123456 olarak sıfırlandı.');
    },
    onError: (error) =>
      Alert.alert('Hata', error instanceof Error ? error.message : 'Parola değiştirilemedi.'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => deleteUserById(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      Alert.alert('Tamamlandı', 'Kullanıcı silindi.');
    },
    onError: (error) =>
      Alert.alert('Hata', error instanceof Error ? error.message : 'Kullanıcı silinemedi.'),
  });

  const refreshing = usersQuery.isRefetching;
  const onRefresh = () => usersQuery.refetch();

  const totalUsers = useMemo(() => (usersQuery.data ?? []).length, [usersQuery.data]);

  if (usersQuery.isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Kullanıcılar yükleniyor…</ThemedText>
      </ThemedView>
    );
  }

  if (usersQuery.error) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">Kullanıcı listesi alınamadı</ThemedText>
        <ThemedText style={styles.errorHint} onPress={onRefresh}>
          Yeniden dene
        </ThemedText>
      </ThemedView>
    );
  }

  const users = usersQuery.data ?? [];

  return (
    <ThemedView style={[styles.container, { backgroundColor: surface.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          <ThemedText style={styles.summaryText}>
            Toplam {totalUsers} kullanıcı var.
          </ThemedText>
        </View>

        <View style={[styles.section, { backgroundColor: surface.card, borderColor: surface.border }]}>
          {users.length === 0 ? (
            <ThemedText style={{ color: surface.mutedText }}>Henüz kullanıcı kaydı yok.</ThemedText>
          ) : (
            users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                surfaceMuted={surface.mutedText}
                busy={resetPasswordMutation.isPending || deleteUserMutation.isPending}
                onPress={() => handleUserOptions(user)}
                onChangePassword={() => confirmResetPassword(user)}
                onDelete={() => confirmDeleteUser(user)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
  function confirmResetPassword(user: AppUser) {
    Alert.alert(
      'Parola Sıfırla',
      `"${user.name ?? user.username ?? 'Kullanıcı'}" kullanıcısının parolasını 123456 yapacaksınız.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sıfırla',
          onPress: () => resetPasswordMutation.mutate({ id: user.id, password: '123456' }),
        },
      ]
    );
  }

  function confirmDeleteUser(user: AppUser) {
    Alert.alert(
      'Kullanıcıyı Sil',
      `"${user.name ?? user.username ?? 'Kullanıcı'}" kalıcı olarak silinecek.`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => deleteUserMutation.mutate(user.id),
        },
      ]
    );
  }

  function handleUserOptions(user: AppUser) {
    Alert.alert(user.name ?? user.username ?? 'Kullanıcı', 'Bir işlem seçin', [
      { text: 'Parola Sıfırla', onPress: () => confirmResetPassword(user) },
      { text: 'Kullanıcıyı Sil', style: 'destructive', onPress: () => confirmDeleteUser(user) },
      { text: 'Kapat', style: 'cancel' },
    ]);
  }
}

function UserRow({
  user,
  surfaceMuted,
  busy,
  onPress,
  onChangePassword,
  onDelete,
}: {
  user: AppUser;
  surfaceMuted: string;
  busy: boolean;
  onPress: () => void;
  onChangePassword: () => void;
  onDelete: () => void;
}) {
  const initials = getInitials(user.name || user.email || user.username || '?');
  return (
    <Pressable
      style={({ pressed }) => [
        styles.userRow,
        { backgroundColor: pressed ? 'rgba(148,163,184,0.12)' : 'transparent' },
      ]}
      android_ripple={{ color: 'rgba(148,163,184,0.15)' }}
      onPress={onPress}
    >
      <View style={styles.avatar}>
        <ThemedText style={styles.avatarText}>{initials}</ThemedText>
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.userName}>
          {user.name || user.username || user.email || 'Bilinmeyen'}
        </ThemedText>
        <ThemedText style={[styles.userEmail, { color: surfaceMuted }]}>
          {user.username ? `@${user.username}` : 'Kullanıcı adı yok'}
        </ThemedText>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity
          onPress={onChangePassword}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 5 }}
          disabled={busy}
        >
          <Ionicons name="key-outline" size={16} color="#2563eb" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 10, bottom: 10, left: 5, right: 10 }}
          disabled={busy}
        >
          <Ionicons name="trash-outline" size={16} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </Pressable>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 14,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 16,
    marginBottom: 6,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(37,99,235,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 13,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 12,
    marginRight: 12,
  },
});
