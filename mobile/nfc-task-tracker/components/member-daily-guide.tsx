import { router } from 'expo-router';
import { ManagementButton as Button, ManagementCard as Card, unitLabels } from './management-ui';
import { ThemedText } from './themed-text';
import { useMemberFitness } from '@/hooks/use-member-fitness';
import { goalProgress } from '@/lib/activity-workflow';
export function MemberDailyGuide() {
  const query = useMemberFitness();
  const goals = (query.data?.exercises ?? []).filter(row => row.target_quantity && row.can_edit);
  const next = goals.filter(row => row.day.quantity < row.target_quantity!).sort((a, b) => b.day.quantity / b.target_quantity! - a.day.quantity / a.target_quantity!)[0];
  const progress = next ? goalProgress(next.day.quantity, next.target_quantity) : null;
  return <Card title={query.isLoading ? 'Günün hazırlanıyor…' : next ? `Sıradaki hedefin: ${next.name}` : goals.length ? 'Bugünkü salon hedeflerin tamamlandı ✓' : 'Bugün kendin için bir adım at'}>
    {next && progress ? <><ThemedText>{next.day.quantity.toLocaleString('tr-TR')} / {next.target_quantity?.toLocaleString('tr-TR')} {unitLabels[next.unit]} · %{progress.percent} tamamlandı</ThemedText><ThemedText>{progress.remaining.toLocaleString('tr-TR')} {unitLabels[next.unit]} kaldı · {next.tenant_name}</ThemedText></> : <ThemedText>{goals.length ? `${goals.length} hedefini tamamladın. Dilersen yeni egzersiz kaydedebilirsin.` : 'Kartını okut, miktarı onayla ve ilerlemeni gör. İlk kayıttan sonra günlük hedef belirleyebilirsin.'}</ThemedText>}
    {query.error && <ThemedText>Hedeflerin şu anda alınamadı. Kartını yine de okutabilirsin.</ThemedText>}
    <Button title="Kart okut" onPress={() => router.push({ pathname: '/(drawer)/nfc', params: { start: String(Date.now()) } })} />
  </Card>;
}
