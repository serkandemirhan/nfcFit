import { useQuery } from '@tanstack/react-query';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AppUser, fetchUsers } from '@/lib/api';

export default function UsersScreen() {
  const surface = getSurfaceColors(useColorScheme());
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

  const refreshing = usersQuery.isRefetching;
  const onRefresh = () => usersQuery.refetch();

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
        <ThemedText style={[styles.errorHint, { color: surface.green }]} onPress={onRefresh}>
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
          <ThemedText style={styles.summaryText}>Hesabım</ThemedText>
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
                accent={surface.green}
              />
            ))
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function UserRow({
  user,
  surfaceMuted,
  accent,
}: {
  user: AppUser;
  surfaceMuted: string;
  accent: string;
}) {
  const initials = getInitials(user.name || user.email || user.username || '?');
  return (
    <View style={styles.userRow}>
      <View style={[styles.avatar, { backgroundColor: `${accent}20` }]}>
        <ThemedText style={styles.avatarText}>{initials}</ThemedText>
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText style={styles.userName}>
          {user.name || user.username || user.email || 'Bilinmeyen'}
        </ThemedText>
        <ThemedText style={[styles.userEmail, { color: surfaceMuted }]}>
          {user.email ?? (user.username ? `@${user.username}` : 'E-posta yok')}
        </ThemedText>
      </View>
      <ThemedText style={styles.userEmail}>Etkin</ThemedText>
    </View>
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
    fontWeight: '700',
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
