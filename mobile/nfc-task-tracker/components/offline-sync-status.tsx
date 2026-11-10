import { useEffect,useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { offlineStore } from '@/lib/offline-store';
import { subscribeOfflineSync,syncStatus } from '@/lib/offline-sync';
import { ManagementButton as Button,ManagementCard as Card,ManagementMessage as Message } from './management-ui';
import { ThemedText } from './themed-text';
export function OfflineSyncStatus(){
 const {user}=useAuth();const id=user?.id??'';const [status,setStatus]=useState(()=>syncStatus(id));
 useEffect(()=>{setStatus(syncStatus(id));return subscribeOfflineSync((changed,value)=>{if(changed===id)setStatus(value);});},[id]);
 const queue=useQuery({queryKey:['offline-outbox',id],queryFn:()=>offlineStore.outbox(id),enabled:Boolean(id),networkMode:'always',staleTime:Infinity});
 const availability=useQuery({queryKey:['offline-availability',id],queryFn:()=>offlineStore.availability(id),enabled:Boolean(id),networkMode:'always',staleTime:Infinity});
 const legacy=useQuery({queryKey:['offline-legacy',id],queryFn:()=>offlineStore.getDoc<{message:string}>(id,'legacy-pending'),enabled:Boolean(id),networkMode:'always',staleTime:Infinity});
 const pending=queue.data?.filter(row=>row.state==='pending').length??0;const rejected=queue.data?.filter(row=>row.state==='rejected').length??0;
 const busy=status.phase==='pulling'||status.phase==='pushing';
 return <Card title={busy?'Arka planda eşitleniyor…':!availability.data?.ready?'Tesis paketi henüz hazır değil':!availability.data.active?'Tesis indirildi · onay bekleniyor':status.online?'Telefonundaki veriler hazır':'Çevrimdışı kullanıma hazır'}>
   {!availability.data?.ready&&<ThemedText>İlk indirme ve üyelik onayı için internete bağlanıp eşitle.</ThemedText>}
   <ThemedText>{pending?`${pending} kayıt / hedef telefonda · eşitleme bekliyor`:'Bekleyen gönderim yok.'}</ThemedText>
   {status.lastSync&&<ThemedText>Son eşitleme: {new Date(status.lastSync).toLocaleString('tr-TR')}</ThemedText>}
   {legacy.data&&<Message error message={legacy.data.message} />}
   {status.error&&<Message error message={status.error} />}
   {rejected>0&&<Message error message={`${rejected} kayıt / hedef kontrol edilmeli. Hiçbiri sessizce silinmedi.`} />}
   <Button title="Eşitleme ayrıntıları" secondary onPress={()=>router.push('/sync-status' as never)} />
 </Card>;
}
