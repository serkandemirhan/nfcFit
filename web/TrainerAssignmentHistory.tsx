import React,{useEffect,useState} from 'react';
import {DataTable} from './components/trainer-ui/data-table';
import {Button,Badge} from './components/trainer-ui/primitives';
type Audit={id:string;plan_id:string;version:number;actor_name:string;created_at:string;reason:string;program_name:string;start_date:string;event_type:'assigned'|'edited'|'cancelled'};
export default function TrainerAssignmentHistory({api,tenantId,athleteId,refreshTick}:{api:<T>(path:string)=>Promise<T>;tenantId:string;athleteId:string;refreshTick:number}){
 const[open,setOpen]=useState(false),[page,setPage]=useState(1),[size,setSize]=useState(()=>window.innerWidth<768?5:10),[result,setResult]=useState<{items:Audit[];total:number}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{if(!open)return;let live=true;setBusy(true);setError('');api<{items:Audit[];total:number;page:number}>('/trainer/assignment-history?'+new URLSearchParams({tenant_id:tenantId,athlete_id:athleteId,page:String(page),page_size:String(size)})).then(d=>{if(live){setResult(d);if(d.page!==page)setPage(d.page)}}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setBusy(false)});return()=>{live=false}},[open,tenantId,athleteId,page,size,refreshTick,retry]);
 return <details className="nfc-assignment-audit" open={open} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Program atama geçmişi</summary><p>Atama, düzenleme ve iptal işlemleri; işlem yapan kişi ve gerekçesi.</p>{error&&<div role="alert">{error}<Button variant="outline" onClick={()=>setRetry(n=>n+1)}>Geçmişi yeniden yükle</Button></div>}{open&&<DataTable label="Program atama geçmişi" data={busy?[]:result?.items??[]} remote={{page,pageSize:size,total:result?.total??0,loading:busy,onPage:setPage,onPageSize:n=>{setSize(n);setPage(1)}}} columns={[
 {id:'time',header:'İşlem zamanı (yerel)',cell:({row})=>new Date(row.original.created_at).toLocaleString('tr-TR')},
 {id:'program',header:'Program',cell:({row})=><span><strong>{row.original.program_name}</strong><small>Başlangıç: {row.original.start_date} · Sürüm {row.original.version}</small></span>},
 {id:'event',header:'İşlem',cell:({row})=><Badge>{{assigned:'Atandı',edited:'Düzenlendi',cancelled:'İptal edildi'}[row.original.event_type]}</Badge>},
 {id:'actor',header:'İşlemi yapan',cell:({row})=>row.original.actor_name},
 {id:'reason',header:'Gerekçe',cell:({row})=>row.original.reason||'İlk program ataması'}
 ]}/>}</details>
}
