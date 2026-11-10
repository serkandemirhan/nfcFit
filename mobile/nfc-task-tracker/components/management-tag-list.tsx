import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ManagementButton, ManagementCard, statusLabels, ui } from '@/components/management-ui';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ManagedTag } from '@/lib/tenant-console';

const pageSize = 10;
export function ManagementTagList({ tags, search, onSelect, disabled }: { tags: ManagedTag[]; search: string; onSelect: (tag: ManagedTag) => void; disabled: boolean }) {
  const palette = getSurfaceColors(useColorScheme());
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [search]);
  const needle = search.trim().toLocaleLowerCase('tr');
  const filtered = tags.filter(tag => `${tag.name} ${tag.uid} ${tag.exercise?.name ?? ''}`.toLocaleLowerCase('tr').includes(needle));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages - 1);
  const start = currentPage * pageSize;
  return <ManagementCard title={`Kartlar (${filtered.length})`}>
    {!filtered.length && <ThemedText style={ui.hint}>{tags.length ? 'Aramanızla eşleşen kart yok.' : 'Henüz salon kartı tanımlanmadı.'}</ThemedText>}
    {filtered.slice(start, start + pageSize).map(tag => <Pressable key={tag.id} accessibilityRole="button" accessibilityLabel={`${tag.name}, kart işlemlerini aç`} disabled={disabled} onPress={() => onSelect(tag)}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2, borderBottomWidth: 1, borderColor: palette.border, opacity: pressed || disabled ? 0.55 : 1 })}>
      <Ionicons name="card-outline" size={22} color={palette.green} />
      <View style={{ flex: 1, gap: 2 }}>
        <ThemedText style={[ui.label, { fontSize: 15 }]} numberOfLines={1}>{tag.name}</ThemedText>
        <ThemedText style={[ui.hint, { color: palette.mutedText }]} numberOfLines={1}>{tag.uid} · {statusLabels[tag.active ? 'active' : 'inactive']}</ThemedText>
        <ThemedText style={[ui.hint, { color: palette.mutedText }]} numberOfLines={1}>{tag.exercise?.name ?? 'Egzersiz atanmamış'}</ThemedText>
      </View>
      <Ionicons name="ellipsis-horizontal" size={20} color={palette.mutedText} />
    </Pressable>)}
    {filtered.length > 0 && <View style={[ui.row, { justifyContent: 'space-between' }]}>
      <ManagementButton title="Önceki" secondary disabled={disabled || currentPage === 0} onPress={() => setPage(currentPage - 1)} />
      <ThemedText style={ui.hint}>{start + 1}–{Math.min(start + pageSize, filtered.length)} / {filtered.length}</ThemedText>
      <ManagementButton title="Sonraki" secondary disabled={disabled || currentPage + 1 >= pages} onPress={() => setPage(currentPage + 1)} />
    </View>}
  </ManagementCard>;
}
