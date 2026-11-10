import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ManagementCard as Card, ManagementButton as Button } from './management-ui';
import { ThemedText } from './themed-text';
import { useMemberFitness } from '@/hooks/use-member-fitness';
import { weeklyTrend } from '@/lib/activity-workflow';
import { getSurfaceColors } from '@/constants/tasks';
import { useColorScheme } from '@/hooks/use-color-scheme';
export function MemberWeeklyTrend({ personal }: { personal: { createdat: string }[] }) {
  const query = useMemberFitness(); const palette = getSurfaceColors(useColorScheme()); const [selected, setSelected] = useState<string | null>(null);
  const trend = weeklyTrend(query.data?.timeline ?? [], personal);
  const max = Math.max(1, ...trend.days.map(day => day.count));
  const chosen = trend.days.find(day => day.day === selected);
  return <Card title="Haftalık ilerlemen" hint="Son 7 gün · Bir güne dokunarak kayıt sayısını görebilirsin.">
    {query.isLoading ? <ActivityIndicator /> : !query.data?.timeline ? <><ThemedText>Haftalık ilerleme alınamadı.</ThemedText><Button title="Yenile" secondary disabled={query.isFetching} onPress={() => void query.refetch()} /></> : <>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', minHeight: 144 }}>
        {trend.days.map(day => <Pressable key={day.day} accessibilityRole="button" accessibilityLabel={`${day.day}: ${day.count} egzersiz kaydı`} accessibilityState={{ selected: selected === day.day }} onPress={() => setSelected(day.day)} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <ThemedText style={{ fontSize: 12 }}>{day.count}</ThemedText>
          <View style={{ height: Math.max(4, day.count / max * 78), width: '75%', borderRadius: 6, backgroundColor: selected === day.day ? palette.text : day.count ? palette.green : palette.border }} />
          <ThemedText style={{ fontSize: 11 }}>{new Date(`${day.day}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'short' })}</ThemedText>
        </Pressable>)}
      </View>
      <ThemedText>{chosen ? `${new Date(`${chosen.day}T12:00:00`).toLocaleDateString('tr-TR')} · ${chosen.count} kayıt` : `${trend.activeDays}/7 aktif gün · ${trend.total} egzersiz kaydı`}</ThemedText>
      <ThemedText>{trend.change == null ? trend.total ? 'Önceki 7 günde kayıt yoktu. Bu hafta iyi bir başlangıç yaptın.' : 'İlk egzersizinle bu grafiği doldurmaya başlayabilirsin.' : trend.change === 0 ? 'Önceki 7 günle aynı sayıda kayıt.' : `Önceki 7 güne göre %${Math.abs(trend.change)} ${trend.change > 0 ? 'daha fazla' : 'daha az'} kayıt.`}</ThemedText>
      {query.isError && <ThemedText>Güncelleme yapılamadı; son alınan veriler gösteriliyor.</ThemedText>}
    </>}
  </Card>;
}
