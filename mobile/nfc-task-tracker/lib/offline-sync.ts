import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineStore,localUuid } from './offline-store';
import { pullOfflineData, pushOfflineData, recordTenantActivity } from './tenant-console';
export type SyncStatus={phase:'idle'|'pulling'|'pushing'|'error';online:boolean;error?:string;lastSync?:string};
const listeners=new Set<(user:string,status:SyncStatus)=>void>();
export type OfflineChangeSource = 'local'|'remote'|'foreground';
const changes=new Set<(user:string,source:OfflineChangeSource)=>void>();
const flights=new Map<string,Promise<void>>();
const statuses=new Map<string,SyncStatus>();
export function subscribeOfflineSync(fn:(user:string,status:SyncStatus)=>void){listeners.add(fn);return()=>{listeners.delete(fn);};}
export function subscribeOfflineChanges(fn:(user:string,source:OfflineChangeSource)=>void){changes.add(fn);return()=>{changes.delete(fn);};}
export function offlineChanged(user:string,source:OfflineChangeSource='local'){for(const fn of changes)fn(user,source);}
export function syncStatus(user:string){return statuses.get(user)??{phase:'idle',online:false};}
function publish(user:string,patch:Partial<SyncStatus>){const next={...syncStatus(user),...patch};statuses.set(user,next);for(const fn of listeners)fn(user,next);}
export async function hasConnection(){const state=await NetInfo.fetch();return state.isConnected!==false&&state.isInternetReachable!==false;}
export function syncOffline(user:string):Promise<void>{
  if(!user)return Promise.resolve();
  const running=flights.get(user);if(running)return running;
  const owner=localUuid();
  let acquired=false;
  const ensureLease=async()=>{if(!await offlineStore.renewSync(user,owner))throw new Error('Eşitleme başka bir işleme devredildi.');};
  const task=(async()=>{
    if(!await hasConnection()){publish(user,{online:false,phase:'idle'});return;}
    try{
      acquired=await offlineStore.acquireSync(user,owner);if(!acquired)return;
      publish(user,{online:true,phase:'pulling',error:undefined});
      // Finish the complete history snapshot before advancing its watermark.
      let more=true;let pages=0;
      while(more){
        const result=await pullOfflineData(user,await offlineStore.manifest(user));
        await ensureLease();await offlineStore.applyPull(user,result);offlineChanged(user,'remote');more=Boolean(result.history_page);
        if(++pages>=100)throw new Error('Geçmiş indirilmeye devam ediyor. Sonraki eşitlemede kaldığı yerden sürecek.');
      }
      // Upgrade the previous release's single uncertain request without changing its ID.
      const oldKey=`nfcfit:pending-activity:${user}`;const raw=await AsyncStorage.getItem(oldKey);
      if(raw){const old=JSON.parse(raw);try{await offlineStore.enqueue(user,old.tagId,old.quantity,undefined,old.requestId,true);await AsyncStorage.removeItem(oldKey);await offlineStore.putDoc(user,'legacy-pending',null);}catch{await offlineStore.putDoc(user,'legacy-pending',{...old,message:'Önceki sürümden bekleyen bir kayıt var. Üyelik veya tesis paketi uygun olduğunda aynı kimlikle tekrar denenecek.'});offlineChanged(user);}}
      publish(user,{phase:'pushing'});
      const pending=(await offlineStore.outbox(user)).filter(row=>row.state==='pending');
      for(let offset=0;offset<pending.length;offset+=50){
        const batch=pending.slice(offset,offset+50);const normal=batch.filter(row=>!JSON.parse(row.payload).legacy);
        for(const row of batch.filter(row=>JSON.parse(row.payload).legacy)){
          const p=JSON.parse(row.payload);
          try{const receipt=await recordTenantActivity(p.tag_id,p.quantity,p.request_id,user);await offlineStore.applyPush(user,[{request_id:row.id,kind:'activity',status:'accepted',receipt}],batch);}
          catch(error){const status=(error as {status?:number}).status;if(status&&status>=400&&status<500&&![401,408,429].includes(status))await offlineStore.applyPush(user,[{request_id:row.id,kind:'activity',status:'rejected',reason:'Önceki sürümdeki kayıt sunucuyla uzlaştırılamadı. Tesis yöneticisiyle kontrol et.'}],batch);else throw error;}
        }
        if(normal.length){const result=await pushOfflineData(user,{activities:normal.filter(row=>row.kind==='activity').map(row=>JSON.parse(row.payload)),goals:normal.filter(row=>row.kind==='goal').map(row=>JSON.parse(row.payload))});await ensureLease();await offlineStore.applyPush(user,result.results,normal);}
        offlineChanged(user);
      }
      // Pull authoritative receipts and goals after sending; accepted events merge by request ID.
      if(pending.length){const final=await pullOfflineData(user,await offlineStore.manifest(user));await ensureLease();await offlineStore.applyPull(user,final);offlineChanged(user,'remote');}
      publish(user,{phase:'idle',error:undefined,lastSync:await offlineStore.getDoc<string>(user,'last-sync')??undefined});
    }catch(error){publish(user,{phase:'error',error:(error as {status?:number}).status===401?'Oturum yenilenemedi. Yerel kayıtların duruyor; eşitlemek için yeniden giriş yap.':'Eşitleme tamamlanamadı. Yerel kayıtların korunuyor; bağlantı gelince yeniden denenecek.'});throw error;}
  })().finally(async()=>{try{if(acquired)await offlineStore.releaseSync(user,owner);}finally{flights.delete(user);}});flights.set(user,task);return task;
}
