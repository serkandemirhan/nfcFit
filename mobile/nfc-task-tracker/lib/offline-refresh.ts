import type { QueryClient } from '@tanstack/react-query';
import type { ConsoleIdentity } from './tenant-console';
const localKeys=['tenant-activities','member-fitness','local-receipt','offline-outbox','offline-availability','offline-legacy','tag-link','coaching','coaching-library','coaching-workout','coaching-jobs'];
/** A local set entry must not launch another authenticated identity round trip. */
export async function refreshOfflineQueries(client: QueryClient, user: string, source: 'local'|'remote'|'foreground', identity:()=>Promise<ConsoleIdentity|null>, current:()=>boolean=()=>true) {
  for(const key of localKeys) void client.invalidateQueries({queryKey:[key,user]});
  if(source==='foreground') {void client.invalidateQueries({queryKey:['console-identity',user]});return;}
  if(source==='remote') {
    const verified=await identity();
    if(verified&&current()) client.setQueryData(['console-identity',user],verified);
  }
}
