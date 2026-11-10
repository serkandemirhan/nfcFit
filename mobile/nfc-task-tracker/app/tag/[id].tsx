import { WorkoutNfcContext,useWorkoutNfcContext } from '@/components/workout-nfc-context';
import { offlineStore } from '@/lib/offline-store';
import { readMemberLink } from '@/lib/offline-member';
import { syncOffline } from '@/lib/offline-sync';
import { ActivityRecorder } from '@/components/activity-recorder';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ManagementButton as Button, ManagementCard as Card, ManagementMessage as Message, errorMessage, ui, unitLabels } from '@/components/management-ui';
import { ThemedText } from '@/components/themed-text';
import { getSurfaceColors } from '@/constants/tasks';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { isTagId } from '@/lib/tag-link';
import { requestTagMembership } from '@/lib/tenant-console';

export default function TagLinkScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === 'string' ? params.id.toLowerCase() : '';
  const valid = isTagId(id);
  const { user } = useAuth();
  const palette = getSurfaceColors(useColorScheme());
  const key = ['tag-link', user?.id, id] as const;
  const query = useQuery({ queryKey: key, queryFn: () => readMemberLink(user?.id ?? '', id), enabled: valid && Boolean(user), retry: 0, networkMode: 'always', staleTime: Infinity });

  const [notice, setNotice] = useState('');
  useEffect(() => { setNotice(''); }, [id, user?.id]);
  const mutation = useMutation({
    mutationFn: async (action: 'join' | 'record') => {
      if (action === 'join') {
        const result = await requestTagMembership(id);
        await syncOffline(user?.id ?? '');
        if(!await offlineStore.resolve(user?.id ?? '',id,true))await syncOffline(user?.id ?? '');
        setNotice(result.result === 'join_request_pending' ? 'Katılım isteği gönderildi. Salon yöneticinizin onayı bekleniyor.' : 'Üyeliğiniz aktif.');
      }
      if (action === 'join') void query.refetch();
    },
  });
  const data = query.data;
  const context=useWorkoutNfcContext(id);
  return <SafeAreaView style={{ flex: 1, backgroundColor: palette.background }}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.content}>
      <ThemedText style={ui.title}>NFCFit kartı</ThemedText>
      {!valid ? <Message error message="Kart bağlantısı geçerli değil." /> : query.isPending ? <View style={{ gap: 10 }}><ActivityIndicator color={palette.green} /><ThemedText>Kartın egzersizi getiriliyor…</ThemedText></View> : query.error ?
        <Card title="Kart açılamadı"><Message error message={errorMessage(query.error)} /><Button title="Yeniden dene" disabled={query.isFetching} onPress={() => void query.refetch()} /></Card> : data && <Card title={data.tenant.name} hint={data.tag.name}>
          <ThemedText style={ui.hint}>{user?.email}</ThemedText>
          {data.exercise && data.membership_status !== 'active' ? <><ThemedText style={ui.cardTitle}>{data.exercise.name}</ThemedText><ThemedText>{data.exercise.default_quantity} {unitLabels[data.exercise.unit]}</ThemedText></> :
            <ThemedText>{!data.exercise ? context.equipment?'Kart ekipmana bağlı.':'Kart tanımlı. Salon yöneticiniz henüz egzersiz atamamış.' : ''}</ThemedText>}
          <WorkoutNfcContext context={context}/>
          {!context.matches.length && data.membership_status === 'active' && data.exercise && (data.exercise.active ? <ActivityRecorder key={`${user?.id}:${id}:${data.exercise.id}:${data.exercise.unit}`} intent={{ tagId: id, exercise: data.exercise.name, exerciseId: data.exercise.id, unit: data.exercise.unit, quantity: data.exercise.default_quantity, tenant: data.tenant.name }} /> : <Message error message="Bu egzersiz şu anda pasif. Salon yöneticinize başvurun." />)}
          {(data.membership_status === 'none' || data.membership_status === 'rejected') && <Button title="Salona katılım isteği gönder" disabled={mutation.isPending} onPress={() => mutation.mutate('join')} />}
          {data.membership_status === 'pending' && <Message message="Katılım isteğiniz salon yöneticisinin onayını bekliyor." />}
          {data.membership_status === 'suspended' && <Message error message="Salon üyeliğiniz askıda. Salon yöneticinizle iletişime geçin." />}
          {notice !== '' && <Message message={notice} />}
          {mutation.error && <Message error message={errorMessage(mutation.error)} />}
          <Button title="Durumu yenile" secondary disabled={query.isFetching || mutation.isPending} onPress={() => void query.refetch()} />
        </Card>}
      <Button title="Ana sayfaya dön" secondary disabled={mutation.isPending} onPress={() => router.replace('/(drawer)' as never)} />
    </ScrollView>
  </SafeAreaView>;
}
