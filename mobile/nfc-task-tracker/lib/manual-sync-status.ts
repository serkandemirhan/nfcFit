/** Presentation only: does not retry, acknowledge or change queued records. */
export type SyncSnapshot = { last: string | null; error: string | null; jobs: {state:string}[] };
export type SyncNotice = { kind: 'success'|'offline'|'network'|'cancelled'|'timeout'|'server'|'session'|'interrupted'|'unconfirmed'|'busy'; message:string; at?:string };
export function syncFailure(error: unknown): SyncNotice {
  const value=error as {kind?:string;status?:number;name?:string;message?:string}|null;
  const message=typeof error==='string'?error:value?.message??'';
  if(value?.kind==='cancelled')return {kind:'cancelled',message:'Eşitleme iptal edildi. Kayıtların telefonunda korunuyor; yeniden deneyebilirsin.'};
  if(value?.kind==='timeout'||/zamanında|zaman aşımı/i.test(message))return {kind:'timeout',message:'Sunucu zamanında yanıt vermedi. Kayıtların korunuyor; yeniden eşitle.'};
  if(value?.kind==='network'||/network request failed|failed to fetch|sunucuya ulaşılamadı/i.test(message))return {kind:'network',message:'Sunucuya ulaşılamadı. Bağlantını kontrol edip yeniden eşitle.'};
  if(value?.status===401||/yeniden giriş/i.test(message))return {kind:'session',message:'Oturum doğrulanamadı. Kayıtların korunuyor; yeniden giriş yaptıktan sonra eşitle.'};
  if(value?.status&&value.status>=500)return {kind:'server',message:'Sunucu eşitlemeyi tamamlayamadı. Kayıtların korunuyor; biraz sonra yeniden dene.'};
  if(value?.name==='AbortError'||/^aborted$/i.test(message.trim()))return {kind:'interrupted',message:'Önceki eşitleme isteği kesildi. Kayıtların korunuyor; yeniden eşitle.'};
  return {kind:'server',message:'Eşitleme tamamlanamadı. Telefonundaki kayıtlar korunuyor; yeniden dene.'};
}
export function syncRecordCounts(jobs: {state:string}[]) {
  return {pending:jobs.filter(j=>j.state==='pending').length,failed:jobs.filter(j=>j.state==='rejected').length};
}
export function createManualSync(deps: {online:()=>Promise<boolean>;read:()=>Promise<SyncSnapshot>;sync:()=>Promise<void>}) {
  let running=false;
  return {
    get running(){return running;},
    async run():Promise<SyncNotice> {
      if(running)return {kind:'busy',message:'Eşitleme zaten sürüyor.'};
      running=true;
      try {
        if(!await deps.online())return {kind:'offline',message:'İnternet bağlantısı yok. Kayıtların telefonunda; bağlantı geldiğinde yeniden eşitle.'};
        const before=await deps.read();
        await deps.sync();
        const after=await deps.read();
        if(after.error)return syncFailure(after.error);
        // A no-op (offline/another process owns the lease) is never a successful sync.
        if(!after.last||after.last===before.last)return {kind:'unconfirmed',message:'Eşitleme sonucu henüz doğrulanmadı. Biraz sonra yeniden dene.'};
        const counts=syncRecordCounts(after.jobs);
        return {kind:'success',at:after.last,message:counts.failed||counts.pending?'Sunucudan güncel bilgiler alındı. Bekleyen ve inceleme gereken kayıtları aşağıdan kontrol et.':'Sunucuyla eşitleme tamamlandı. Bekleyen kayıt yok.'};
      }catch(error){return syncFailure(error);}
      finally{running=false;}
    },
  };
}
