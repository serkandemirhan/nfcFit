import { offlineStore } from './offline-store';
import { hasConnection, syncOffline } from './offline-sync';
import { scanTenantTag, resolveTagLink } from './tenant-console';
export async function readMemberCard(user:string,uid:string,signal?:AbortSignal){
  const local=await offlineStore.scan(user,uid);if(local)return local;
  if(!await hasConnection())throw new Error('Bu kartın tesis paketi telefona henüz indirilmemiş. İlk kullanım için internete bağlanıp eşitle.');
  const remote=await scanTenantTag(uid,signal);
  if(remote&&!signal?.aborted){await syncOffline(user);if(!await offlineStore.scan(user,uid))await syncOffline(user);}
  return remote;
}
export async function readMemberLink(user:string,id:string){
  const local=await offlineStore.resolve(user,id,true);if(local)return local;
  if(!await hasConnection())throw new Error('Bu bağlantının tesis paketi indirilmemiş. İlk kullanım için internete bağlan.');
  return resolveTagLink(id);
}
