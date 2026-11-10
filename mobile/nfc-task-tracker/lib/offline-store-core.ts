import type { ConsoleIdentity, MemberFitness, MemberFitnessExercise, RecordedTenantActivity, TenantActivity, TenantScanResult } from './tenant-console';
import { localDay } from './activity-workflow';
export type SqlValue = string | number | null;
export interface SqlOps {
  runAsync(sql: string, ...params: SqlValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
}
export interface OfflineDatabase extends SqlOps { transaction<T>(fn: (tx: SqlOps) => Promise<T>): Promise<T> }
export type CatalogEntry = { hash: string; data: Record<string, any> };
export type PullResult = { catalogs: { tenant_id: string; tenant_name: string; membership_status: string; tenant_status: string; tags: {upsert: CatalogEntry[]; delete: string[]; version: string}; exercises: {upsert: CatalogEntry[]; delete: string[]; version: string} }[];
  identity: ConsoleIdentity; history: RecordedTenantActivity[]; goals: {exercise_id: string; unit: string; target_quantity: number}[];
  history_until: string; history_page: {time: string; id: string} | null; server_time: string };
export type OutboxRow = { id: string; kind: 'activity' | 'goal'; payload: string; state: 'pending' | 'rejected'; error: string | null };
type Entity = { tenant_id: string; kind: string; id: string; hash: string; payload: string; uid: string | null };
type Member = { tenant_id: string; payload: string; status: string; ready: number };
type LocalActivity = TenantActivity & { request_id?: string | null; received_at?: string | null; sync_state: 'pending' | 'synced' | 'rejected'; sync_error?: string | null };
export const OFFLINE_SCHEMA = `
CREATE TABLE IF NOT EXISTS offline_sync_locks(user_id TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS offline_docs(user_id TEXT NOT NULL, key TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(user_id,key));
CREATE TABLE IF NOT EXISTS offline_memberships(user_id TEXT NOT NULL, tenant_id TEXT NOT NULL, status TEXT NOT NULL, ready INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(user_id,tenant_id));
CREATE TABLE IF NOT EXISTS offline_entities(user_id TEXT NOT NULL, tenant_id TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL, hash TEXT NOT NULL, uid TEXT, payload TEXT NOT NULL, PRIMARY KEY(user_id,tenant_id,kind,id));
CREATE TABLE IF NOT EXISTS offline_tombstones(user_id TEXT NOT NULL, id TEXT NOT NULL, tenant_id TEXT NOT NULL, uid TEXT, PRIMARY KEY(user_id,id));
CREATE INDEX IF NOT EXISTS offline_deleted_uid ON offline_tombstones(user_id,uid);
CREATE INDEX IF NOT EXISTS offline_uid ON offline_entities(user_id,uid);
CREATE TABLE IF NOT EXISTS offline_activities(user_id TEXT NOT NULL, id TEXT NOT NULL, server_id TEXT, request_id TEXT, tenant_id TEXT NOT NULL, exercise_id TEXT NOT NULL, unit TEXT NOT NULL, quantity REAL NOT NULL, occurred_at TEXT NOT NULL, state TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(user_id,id), UNIQUE(user_id,server_id), UNIQUE(user_id,request_id));
CREATE TABLE IF NOT EXISTS offline_goals(user_id TEXT NOT NULL, exercise_id TEXT NOT NULL, unit TEXT NOT NULL, target REAL NOT NULL, server_target REAL, PRIMARY KEY(user_id,exercise_id,unit));
CREATE TABLE IF NOT EXISTS offline_outbox(user_id TEXT NOT NULL, id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL, error TEXT, PRIMARY KEY(user_id,id));
`;
export function normalizeOfflineUid(uid: string) { const compact = uid.trim().replace(/[:\s-]/g, ''); return /^[a-fA-F0-9]+$/.test(compact) && compact.length % 2 === 0 ? compact.toUpperCase() : uid.trim(); }
const parse = <T>(row: {payload: string}): T => JSON.parse(row.payload);
export function createOfflineStore(db: OfflineDatabase, uuid: () => string, now: () => Date = () => new Date()) {
  const putDoc = (tx: SqlOps, user: string, key: string, value: unknown) => tx.runAsync('INSERT OR REPLACE INTO offline_docs(user_id,key,payload) VALUES(?,?,?)',user,key,JSON.stringify(value));
  async function getDoc<T>(user: string, key: string): Promise<T | null> { const row = await db.getFirstAsync<{payload: string}>('SELECT payload FROM offline_docs WHERE user_id=? AND key=?',user,key); return row ? parse<T>(row) : null; }
  async function mergeReceipt(tx: SqlOps, user: string, receipt: RecordedTenantActivity) {
    const existing = await tx.getFirstAsync<{id: string; payload: string}>('SELECT id,payload FROM offline_activities WHERE user_id=? AND (server_id=? OR request_id=?)',user,receipt.id,receipt.request_id ?? null);
    const old = existing ? parse<LocalActivity>(existing) : null;
    const activity: LocalActivity = { ...receipt, tenant_name: receipt.tenant_name ?? receipt.tenant, sync_state:'synced', sync_error:null, received_at:receipt.received_at ?? receipt.created_at };
    // Keep the recorded exercise label even if the facility subsequently renamed it.
    if (old) { activity.exercise = old.exercise; activity.tag = old.tag; }
    await tx.runAsync('INSERT OR REPLACE INTO offline_activities(user_id,id,server_id,request_id,tenant_id,exercise_id,unit,quantity,occurred_at,state,payload) VALUES(?,?,?,?,?,?,?,?,?,?,?)',user,existing?.id ?? `server:${receipt.id}`,receipt.id,receipt.request_id ?? null,receipt.tenant_id,receipt.exercise_id,receipt.unit,receipt.quantity,receipt.created_at,'synced',JSON.stringify(activity));
    if (receipt.request_id) await tx.runAsync('DELETE FROM offline_outbox WHERE user_id=? AND id=?',user,receipt.request_id);
  }
  async function applyPull(user: string, result: PullResult) {
    await db.transaction(async tx => {
      const keep = new Set(result.catalogs.map(c=>c.tenant_id));
      const previous = await tx.getAllAsync<Member>('SELECT * FROM offline_memberships WHERE user_id=?',user);
      for (const row of previous) if (!keep.has(row.tenant_id)) {
        await tx.runAsync('DELETE FROM offline_memberships WHERE user_id=? AND tenant_id=?',user,row.tenant_id);
        await tx.runAsync("INSERT OR REPLACE INTO offline_tombstones(user_id,id,tenant_id,uid) SELECT user_id,id,tenant_id,uid FROM offline_entities WHERE user_id=? AND tenant_id=? AND kind='tags'",user,row.tenant_id);
        await tx.runAsync('DELETE FROM offline_entities WHERE user_id=? AND tenant_id=?',user,row.tenant_id);
      }
      for (const catalog of result.catalogs) {
        for (const kind of ['tags','exercises'] as const) {
          for (const id of catalog[kind].delete) {
            if(kind==='tags')await tx.runAsync("INSERT OR REPLACE INTO offline_tombstones(user_id,id,tenant_id,uid) SELECT user_id,id,tenant_id,uid FROM offline_entities WHERE user_id=? AND tenant_id=? AND kind='tags' AND id=?",user,catalog.tenant_id,id);
            await tx.runAsync('DELETE FROM offline_entities WHERE user_id=? AND tenant_id=? AND kind=? AND id=?',user,catalog.tenant_id,kind,id);
          }
          for (const item of catalog[kind].upsert) { if(kind==='tags')await tx.runAsync('DELETE FROM offline_tombstones WHERE user_id=? AND (id=? OR uid=?)',user,item.data.id,normalizeOfflineUid(item.data.uid)); await tx.runAsync('INSERT OR REPLACE INTO offline_entities(user_id,tenant_id,kind,id,hash,uid,payload) VALUES(?,?,?,?,?,?,?)',user,catalog.tenant_id,kind,item.data.id,item.hash,kind==='tags'?normalizeOfflineUid(item.data.uid):null,JSON.stringify(item.data)); }
        }
        const entries = await tx.getAllAsync<Entity>('SELECT * FROM offline_entities WHERE user_id=? AND tenant_id=?',user,catalog.tenant_id);
        const exerciseIds = new Set(entries.filter(e=>e.kind==='exercises').map(e=>e.id));
        const complete = entries.filter(e=>e.kind==='tags').every(e=>{const tag=parse<any>(e);return !tag.exercise_id || exerciseIds.has(tag.exercise_id);});
        await tx.runAsync('INSERT OR REPLACE INTO offline_memberships(user_id,tenant_id,status,ready,payload) VALUES(?,?,?,?,?)',user,catalog.tenant_id,catalog.membership_status,complete?1:0,JSON.stringify({...catalog,tags:undefined,exercises:undefined,verified_at:result.server_time,catalog_versions:{tags:catalog.tags.version,exercises:catalog.exercises.version}}));
      }
      await putDoc(tx,user,'identity',result.identity);
      for (const receipt of result.history) await mergeReceipt(tx,user,receipt);
      const pendingGoals = await tx.getAllAsync<OutboxRow>("SELECT * FROM offline_outbox WHERE user_id=? AND kind='goal' AND state='pending'",user);
      const protectedGoals = new Set(pendingGoals.map(row=>{const p=JSON.parse(row.payload);return `${p.exercise_id}:${p.unit}`;}));
      const serverGoals = new Set(result.goals.map(g=>`${g.exercise_id}:${g.unit}`));
      const localGoals = await tx.getAllAsync<{exercise_id:string;unit:string}>('SELECT exercise_id,unit FROM offline_goals WHERE user_id=?',user);
      for (const row of localGoals) if (!serverGoals.has(`${row.exercise_id}:${row.unit}`) && !protectedGoals.has(`${row.exercise_id}:${row.unit}`)) await tx.runAsync('DELETE FROM offline_goals WHERE user_id=? AND exercise_id=? AND unit=?',user,row.exercise_id,row.unit);
      for (const goal of result.goals) {
        if (protectedGoals.has(`${goal.exercise_id}:${goal.unit}`)) await tx.runAsync('UPDATE offline_goals SET server_target=? WHERE user_id=? AND exercise_id=? AND unit=?',goal.target_quantity,user,goal.exercise_id,goal.unit);
        else await tx.runAsync('INSERT OR REPLACE INTO offline_goals(user_id,exercise_id,unit,target,server_target) VALUES(?,?,?,?,?)',user,goal.exercise_id,goal.unit,goal.target_quantity,goal.target_quantity);
      }
      await putDoc(tx,user,'history-cursor', result.history_page ? { ...await getDoc<any>(user,'history-cursor'), page:result.history_page, until:result.history_until } : { since: result.history_until });
      await putDoc(tx,user,'last-sync',result.server_time);
    });
  }
  async function manifest(user: string) {
    const entries=await db.getAllAsync<Entity>('SELECT * FROM offline_entities WHERE user_id=?',user);
    const catalogs:Record<string,{tags:Record<string,string>;exercises:Record<string,string>}>={};
    for(const e of entries) { catalogs[e.tenant_id] ??= {tags:{},exercises:{}}; catalogs[e.tenant_id][e.kind as 'tags'|'exercises'][e.id]=e.hash; }
    const cursor=await getDoc<any>(user,'history-cursor');
    return {catalogs,history_since:cursor?.since,history_page:cursor?.page,history_until:cursor?.until};
  }
  async function resolve(user: string, value: string, byId=false) {
    const rows=await db.getAllAsync<Entity>(`SELECT * FROM offline_entities WHERE user_id=? AND kind='tags' AND ${byId?'id':'uid'}=?`,user,byId?value:normalizeOfflineUid(value));
    if(rows.length>1) throw new Error('Bu UID için birden fazla kart tanımı var. Tesis yöneticisine başvur.');
    if(!rows.length){const deleted=await db.getFirstAsync<{id:string}>(`SELECT id FROM offline_tombstones WHERE user_id=? AND ${byId?'id':'uid'}=?`,user,byId?value:normalizeOfflineUid(value));if(deleted)throw new Error('Bu kartın tesis tanımı kaldırılmış veya üyeliğin kapatılmış. Yeni bir tanım için tesis yöneticisine başvur.');return null;}
    const row=rows[0]; const tag=parse<any>(row);
    const membership=await db.getFirstAsync<Member>('SELECT * FROM offline_memberships WHERE user_id=? AND tenant_id=?',user,row.tenant_id);
    if(!membership) return null;
    const member=parse<any>(membership);
    if(member.tenant_status!=='active' || !['active','pending'].includes(membership.status)) throw new Error('Bu tesisteki üyeliğin veya tesis şu anda aktif değil.');
    if(!membership.ready) throw new Error('Tesis paketi tamamlanmamış. İnternete bağlanıp eşitle.');
    if(!tag.active) throw new Error('Bu kart pasifleştirilmiş.');
    const erow=tag.exercise_id ? await db.getFirstAsync<Entity>("SELECT * FROM offline_entities WHERE user_id=? AND tenant_id=? AND kind='exercises' AND id=?",user,row.tenant_id,tag.exercise_id):null;
    const exercise=erow?parse<any>(erow):null;
    if(exercise && !exercise.active) throw new Error('Bu egzersiz pasifleştirilmiş.');
    return {tag,exercise,tenant:{id:row.tenant_id,name:member.tenant_name},membership_status:membership.status};
  }
  async function scan(user:string, uid:string):Promise<TenantScanResult|null> {
    const data=await resolve(user,uid); if(!data) return null;
    return {...data,result:data.membership_status==='pending'?'join_request_pending':data.exercise?'activity_confirmation_required':'tag_unassigned'} as TenantScanResult;
  }
  async function enqueue(user:string, tagId:string, quantity:number, expectedExercise?:string, existingRequest?:string, legacy=false, expectedUnit?:string) {
    if(!user || !Number.isFinite(quantity)||quantity<=0||quantity>100000) throw new Error('Geçerli bir miktar gir.');
    return db.transaction(async tx=>{
      const existing = existingRequest ? await tx.getFirstAsync<{payload:string}>('SELECT payload FROM offline_activities WHERE user_id=? AND request_id=?',user,existingRequest):null;
      if(existing) return parse<RecordedTenantActivity>(existing);
      const data=await resolve(user,tagId,true);
      if(!data || data.membership_status!=='active' || !data.exercise) throw new Error('Aktif üyelik ve indirilmiş egzersiz tanımı gerekli. İnternete bağlanıp üyelik onayını eşitle.');
      if(expectedExercise && expectedExercise!==data.exercise.id || expectedUnit && expectedUnit!==data.exercise.unit) throw new Error('Kartın egzersizi veya birimi değişmiş. Kartı yeniden okut.');
      const request=existingRequest??uuid(); const occurred=now().toISOString();
      const receipt: RecordedTenantActivity={id:request,request_id:request,tenant_id:data.tenant.id,tenant_name:data.tenant.name,tenant:data.tenant.name,exercise_id:data.exercise.id,exercise:data.exercise.name,tag_id:data.tag.id,tag:data.tag.name,unit:data.exercise.unit,quantity,source:'nfc',created_at:occurred,received_at:null,sync_state:'pending'};
      const payload={request_id:request,tag_id:data.tag.id,exercise_id:data.exercise.id,unit:data.exercise.unit,quantity,occurred_at:occurred,exercise_name:data.exercise.name,tenant_name:data.tenant.name,...(legacy?{legacy:true}:{})};
      await tx.runAsync('INSERT INTO offline_activities(user_id,id,request_id,tenant_id,exercise_id,unit,quantity,occurred_at,state,payload) VALUES(?,?,?,?,?,?,?,?,?,?)',user,request,request,data.tenant.id,data.exercise.id,data.exercise.unit,quantity,occurred,'pending',JSON.stringify(receipt));
      await tx.runAsync("INSERT INTO offline_outbox(user_id,id,kind,payload,state) VALUES(?,?,'activity',?,'pending')",user,request,JSON.stringify(payload));
      return receipt;
    });
  }
  async function activities(user:string) { return (await db.getAllAsync<{payload:string}>('SELECT payload FROM offline_activities WHERE user_id=? ORDER BY occurred_at DESC,id DESC',user)).map(row=>parse<LocalActivity>(row)); }
  async function fitness(user:string):Promise<MemberFitness> {
    const today=now(); today.setHours(0,0,0,0); const week=new Date(today); week.setDate(week.getDate()-((week.getDay()+6)%7)); const month=new Date(today);month.setDate(1);
    const end=new Date(today); end.setDate(end.getDate()+1);
    const logs=(await activities(user)).filter(row=>row.sync_state!=='rejected');
    const entities=await db.getAllAsync<Entity>("SELECT * FROM offline_entities WHERE user_id=? AND kind='exercises'",user);
    const entityMap=new Map(entities.map(row=>[row.id,{...parse<any>(row),tenant_id:row.tenant_id}]));
    const members=new Map((await db.getAllAsync<Member>('SELECT * FROM offline_memberships WHERE user_id=?',user)).map(row=>[row.tenant_id,{...parse<any>(row),ready:row.ready}]));
    const goals=await db.getAllAsync<{exercise_id:string;unit:string;target:number}>('SELECT * FROM offline_goals WHERE user_id=?',user);
    const rows=new Map<string,MemberFitnessExercise>();
    const ensure=(id:string,unit:string,log?:LocalActivity)=>{
      const key=`${id}:${unit}`; let row=rows.get(key); if(row)return row;
      const exercise=entityMap.get(id); const member=members.get(exercise?.tenant_id??log?.tenant_id);
      row={exercise_id:id,unit,tenant_id:exercise?.tenant_id??log?.tenant_id??'',tenant_name:member?.tenant_name??log?.tenant_name??'',name:exercise?.name??log?.exercise??'Egzersiz',target_quantity:null,can_edit:Boolean(exercise?.active && exercise.unit===unit && member?.membership_status==='active' && member.ready===1 && member.tenant_status==='active'),day:{count:0,quantity:0},week:{count:0,quantity:0},month:{count:0,quantity:0}};
      rows.set(key,row);return row;
    };
    for(const log of logs){ const row=ensure(log.exercise_id!,log.unit,log); const date=new Date(log.created_at); for(const [period,start] of [['day',today],['week',week],['month',month]] as const) if(date>=start&&date<end){row[period].count++;row[period].quantity+=log.quantity;} }
    for(const goal of goals)ensure(goal.exercise_id,goal.unit).target_quantity=goal.target;
    const timeline=Array.from({length:14},(_,index)=>{const d=new Date(today);d.setDate(d.getDate()-13+index); const day=localDay(d);return {day,count:logs.filter(log=>localDay(new Date(log.created_at))===day).length};});
    return {day:localDay(today),exercises:[...rows.values()].sort((a,b)=>a.name.localeCompare(b.name,'tr')),timeline};
  }
  async function saveGoal(user:string, exerciseId:string, unit:string, target:number) {
    if(!Number.isFinite(target)||target<=0||target>100000)throw new Error('Geçerli bir hedef gir.');
    await db.transaction(async tx=>{
      const entity=await tx.getFirstAsync<Entity>("SELECT * FROM offline_entities WHERE user_id=? AND kind='exercises' AND id=?",user,exerciseId);
      if(!entity)throw new Error('Egzersiz tanımı indirilmemiş.');
      const exercise=parse<any>(entity);const member=await tx.getFirstAsync<Member>('SELECT * FROM offline_memberships WHERE user_id=? AND tenant_id=?',user,entity.tenant_id);
      if(!member || !member.ready || member.status!=='active' || parse<any>(member).tenant_status!=='active' || exercise.unit!==unit || !exercise.active)throw new Error('Bu egzersiz için üyelik veya tanım aktif değil.');
      const old=await tx.getFirstAsync<{server_target:number|null}>('SELECT server_target FROM offline_goals WHERE user_id=? AND exercise_id=? AND unit=?',user,exerciseId,unit);
      const prior=(await tx.getAllAsync<OutboxRow>("SELECT * FROM offline_outbox WHERE user_id=? AND kind='goal'",user)).find(row=>{const p=JSON.parse(row.payload);return p.exercise_id===exerciseId&&p.unit===unit;});
      const request=prior?.id??uuid();const base=prior?.state==='pending'?JSON.parse(prior.payload).base_target:old?.server_target??null;
      await tx.runAsync('INSERT OR REPLACE INTO offline_goals(user_id,exercise_id,unit,target,server_target) VALUES(?,?,?,?,?)',user,exerciseId,unit,target,old?.server_target??null);
      await tx.runAsync("INSERT OR REPLACE INTO offline_outbox(user_id,id,kind,payload,state,error) VALUES(?,?,'goal',?,'pending',NULL)",user,request,JSON.stringify({request_id:request,exercise_id:exerciseId,unit,target_quantity:target,base_target:base,exercise_name:exercise.name}));
    });
    return {exercise_id:exerciseId,unit,target_quantity:target};
  }
  async function outbox(user:string) { return db.getAllAsync<OutboxRow>('SELECT * FROM offline_outbox WHERE user_id=? ORDER BY rowid',user); }
  async function applyPush(user:string, results:any[], sent:OutboxRow[]) {
    await db.transaction(async tx=>{
      for(const result of results){
        const original=sent.find(row=>row.id===result.request_id);if(!original)continue;
        const current=await tx.getFirstAsync<OutboxRow>('SELECT * FROM offline_outbox WHERE user_id=? AND id=?',user,original.id);
        if(!current)continue;
        if(current.payload!==original.payload){
          if(result.kind==='goal'&&result.status==='accepted'){
            const next=JSON.parse(current.payload);next.base_target=result.goal.target_quantity;
            await tx.runAsync('UPDATE offline_outbox SET payload=? WHERE user_id=? AND id=?',JSON.stringify(next),user,current.id);
            await tx.runAsync('UPDATE offline_goals SET server_target=? WHERE user_id=? AND exercise_id=? AND unit=?',result.goal.target_quantity,user,next.exercise_id,next.unit);
          }
          continue;
        }
        if(result.status==='accepted'){
          if(result.kind==='activity')await mergeReceipt(tx,user,result.receipt);
          else { const p=result.goal;await tx.runAsync('UPDATE offline_goals SET target=?,server_target=? WHERE user_id=? AND exercise_id=? AND unit=?',p.target_quantity,p.target_quantity,user,p.exercise_id,p.unit);await tx.runAsync('DELETE FROM offline_outbox WHERE user_id=? AND id=?',user,original.id); }
        }else{
          const reason=result.reason??'Sunucu bu kaydı kabul etmedi.';
          await tx.runAsync("UPDATE offline_outbox SET state='rejected',error=? WHERE user_id=? AND id=?",reason,user,original.id);
          if(result.kind==='activity'){
            const a=await tx.getFirstAsync<{payload:string}>('SELECT payload FROM offline_activities WHERE user_id=? AND request_id=?',user,original.id);
            if(a)await tx.runAsync("UPDATE offline_activities SET state='rejected',payload=? WHERE user_id=? AND request_id=?",JSON.stringify({...parse<any>(a),sync_state:'rejected',sync_error:reason}),user,original.id);
          }else{
            const p=JSON.parse(original.payload);const g=await tx.getFirstAsync<{server_target:number|null}>('SELECT server_target FROM offline_goals WHERE user_id=? AND exercise_id=? AND unit=?',user,p.exercise_id,p.unit);
            if(g?.server_target!=null)await tx.runAsync('UPDATE offline_goals SET target=server_target WHERE user_id=? AND exercise_id=? AND unit=?',user,p.exercise_id,p.unit);
            else await tx.runAsync('DELETE FROM offline_goals WHERE user_id=? AND exercise_id=? AND unit=?',user,p.exercise_id,p.unit);
          }
        }
      }
    });
  }
  async function retry(user:string,id:string){await db.transaction(async tx=>{await tx.runAsync("UPDATE offline_outbox SET state='pending',error=NULL WHERE user_id=? AND id=?",user,id);const a=await tx.getFirstAsync<{payload:string}>('SELECT payload FROM offline_activities WHERE user_id=? AND request_id=?',user,id);if(a)await tx.runAsync("UPDATE offline_activities SET state='pending',payload=? WHERE user_id=? AND request_id=?",JSON.stringify({...parse<any>(a),sync_state:'pending',sync_error:null}),user,id);});}
  async function acquireSync(user:string,owner:string){return db.transaction(async tx=>{const time=now().getTime();await tx.runAsync('INSERT INTO offline_sync_locks(user_id,owner,expires_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE offline_sync_locks.expires_at<? OR offline_sync_locks.expires_at>?',user,owner,time+300000,time,time+600000);const row=await tx.getFirstAsync<{owner:string}>('SELECT owner FROM offline_sync_locks WHERE user_id=?',user);return row?.owner===owner;});}
  async function renewSync(user:string,owner:string){return db.transaction(async tx=>{await tx.runAsync('UPDATE offline_sync_locks SET expires_at=? WHERE user_id=? AND owner=?',now().getTime()+300000,user,owner);const row=await tx.getFirstAsync<{owner:string}>('SELECT owner FROM offline_sync_locks WHERE user_id=?',user);return row?.owner===owner;});}
  async function releaseSync(user:string,owner:string){await db.transaction(tx=>tx.runAsync('DELETE FROM offline_sync_locks WHERE user_id=? AND owner=?',user,owner));}
  return {availability:async(user:string)=>{const rows=await db.getAllAsync<Member>('SELECT * FROM offline_memberships WHERE user_id=?',user);return {total:rows.length,ready:rows.filter(row=>row.ready&&parse<any>(row).tenant_status==='active').length,active:rows.filter(row=>row.ready&&row.status==='active'&&parse<any>(row).tenant_status==='active').length};},acquireSync,renewSync,releaseSync,getDoc,putDoc:async(user:string,key:string,value:unknown)=>db.transaction(tx=>putDoc(tx,user,key,value)),applyPull,manifest,resolve,scan,enqueue,activities,fitness,saveGoal,outbox,applyPush,retry,
    receipt:async(user:string,request:string)=>{const row=await db.getFirstAsync<{payload:string}>('SELECT payload FROM offline_activities WHERE user_id=? AND request_id=?',user,request);return row?parse<RecordedTenantActivity>(row):null;}};
}
