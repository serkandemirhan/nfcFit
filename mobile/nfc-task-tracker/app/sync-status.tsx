import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getSurfaceColors } from '@/constants/tasks';
import { offlineStore } from '@/lib/offline-store';
import { offlineChanged,syncOffline } from '@/lib/offline-sync';
import { OfflineSyncStatus } from '@/components/offline-sync-status';
import { ManagementButton as Button,ManagementCard as Card,ManagementMessage as Message,ui,unitLabels } from '@/components/management-ui';
import { ThemedText } from '@/components/themed-text';
export default function SyncStatusScreen(){
 const {user}=useAuth();const id=user?.id??'';const palette=getSurfaceColors(useColorScheme());const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const query=useQuery({queryKey:['offline-outbox',id],queryFn:()=>offlineStore.outbox(id),enabled:Boolean(id),networkMode:'always',staleTime:Infinity});
 const run=async(request?:string)=>{if(busy)return;setBusy(true);setError('');try{if(request)await offlineStore.retry(id,request);offlineChanged(id);await syncOffline(id);}catch{setError('Eşitleme tamamlanamadı. Kayıtların telefonunda korunuyor.');}finally{setBusy(false);}};
 return <SafeAreaView style={{flex:1,backgroundColor:palette.background}}><ScrollView contentContainerStyle={ui.content}>
  <ThemedText style={ui.title}>Eşitleme durumu</ThemedText><OfflineSyncStatus />
  <Button title={busy?'Kontrol ediliyor…':'Şimdi eşitle'} disabled={busy} onPress={()=>void run()} />
  {error!==''&&<Message error message={error} />}
  {query.data?.map(row=>{const p=JSON.parse(row.payload);return <Card key={row.id} title={p.exercise_name??(row.kind==='goal'?'Günlük hedef değişikliği':'Egzersiz kaydı')} hint={row.state==='rejected'?'Sunucu kabul etmedi · yerel kayıt korunuyor':'Telefona kaydedildi · eşitleme bekliyor'}>
    <ThemedText>{p.quantity??p.target_quantity} {unitLabels[p.unit]??p.unit}</ThemedText>{p.occurred_at&&<ThemedText>{new Date(p.occurred_at).toLocaleString('tr-TR')}</ThemedText>}
    {row.error&&<Message error message={row.error} />}
    {row.state==='rejected'&&row.kind==='goal'&&<Button title="Hedeflerde düzenle" secondary onPress={()=>router.push('/(drawer)/fitness')} />}
    {row.state==='rejected'&&row.kind==='activity'&&<Button title="Değişiklik sonrası yeniden kontrol et" secondary disabled={busy} onPress={()=>void run(row.id)} />}
   </Card>;})}
  {query.isPending&&<ThemedText>Telefondaki kayıtlar kontrol ediliyor…</ThemedText>}
  {query.error&&<Message error message="Bekleyen kayıtlar görüntülenemedi. Yeniden deneyin; telefonundaki kayıtlar korunuyor." />}
  {query.error&&<Button title="Yeniden dene" secondary onPress={()=>void query.refetch()} />}
  {query.data&&!query.error&&!query.data.length&&<ThemedText>Gönderilmeyi bekleyen veya kontrol gerektiren kayıt yok.</ThemedText>}
  <Button title="Bugün ekranına dön" secondary onPress={()=>router.replace('/(drawer)' as never)} />
 </ScrollView></SafeAreaView>;
}
