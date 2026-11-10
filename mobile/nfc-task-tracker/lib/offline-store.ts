import { COACHING_SCHEMA } from './coaching-store-core';
import * as SQLite from 'expo-sqlite';
import 'react-native-get-random-values';
import { createOfflineStore, OFFLINE_SCHEMA, SqlOps } from './offline-store-core';
export function localUuid() { const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; }
let connection:Promise<SQLite.SQLiteDatabase>|null=null;
async function database(){if(!connection)connection=(async()=>{const db=await SQLite.openDatabaseAsync('nfcfit-offline-v1.db');await db.execAsync('PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;'+OFFLINE_SCHEMA+COACHING_SCHEMA);return db;})().catch(error=>{connection=null;throw error;});return connection;}
let writes:Promise<unknown>=Promise.resolve();
export const offlineDatabase={
  runAsync:async(sql:string,...params:any[])=>(await database()).runAsync(sql,...params),
  getAllAsync:async<T>(sql:string,...params:any[])=>(await database()).getAllAsync<T>(sql,...params),
  getFirstAsync:async<T>(sql:string,...params:any[])=>(await database()).getFirstAsync<T>(sql,...params),
  transaction<T>(fn:(tx:SqlOps)=>Promise<T>):Promise<T>{const next=writes.catch(()=>undefined).then(async()=>{const db=await database();let result:T;await db.withExclusiveTransactionAsync(async tx=>{await tx.execAsync('PRAGMA busy_timeout=5000');result=await fn(tx);});return result!;});writes=next;return next;},
};
export const offlineStore=createOfflineStore(offlineDatabase,localUuid);
