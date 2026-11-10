import { refreshOfflineQueries } from "@/lib/offline-refresh";
import { offlineStore } from "@/lib/offline-store";
import type { ConsoleIdentity } from "@/lib/tenant-console";
import { syncCoaching } from '@/lib/coaching';
import { useEffect, ReactNode } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { offlineChanged, subscribeOfflineChanges, syncOffline } from '@/lib/offline-sync';
import { registerOfflineBackgroundSync } from '@/lib/offline-background';
export function OfflineSyncProvider({children}:{children:ReactNode}){
  const {user}=useAuth();const client=useQueryClient();
  useEffect(()=>{
    if(!user?.id)return;const id=user.id;
    let active=true, identityGeneration=0;
    const off=subscribeOfflineChanges((changed,source)=>{if(changed===id){const generation=source==='local'?identityGeneration:++identityGeneration;void refreshOfflineQueries(client,id,source,()=>offlineStore.getDoc<ConsoleIdentity>(id,'identity'),()=>active&&generation===identityGeneration).catch(()=>undefined);}});
    let timer:ReturnType<typeof setTimeout>|null=null;
    const run=()=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>{void Promise.allSettled([syncOffline(id),syncCoaching(id)]);},300);};
    const network=NetInfo.addEventListener(()=>run());
    const app=AppState.addEventListener('change',state=>{if(state==='active'){offlineChanged(id,'foreground');run();}});
    const periodic=setInterval(()=>{offlineChanged(id,'foreground');run();},60_000);run();void registerOfflineBackgroundSync().catch(()=>undefined);
    return()=>{active=false;off();network();app.remove();clearInterval(periodic);if(timer)clearTimeout(timer);};
  },[user?.id,client]);
  return children;
}
