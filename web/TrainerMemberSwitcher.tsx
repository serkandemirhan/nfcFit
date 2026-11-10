import React,{useEffect,useState} from 'react';
import {Input,NativeSelect,Label} from './components/trainer-ui/primitives';
import type {MemberPage,TrainerMember} from './lib/trainer-workspace';
export default function TrainerMemberSwitcher({current,select,api,tenantId}:{current:TrainerMember;select:(m:TrainerMember|null)=>void;api:<T>(p:string)=>Promise<T>;tenantId:string}){
 const[query,setQuery]=useState(''),[rows,setRows]=useState<TrainerMember[]>([]),[error,setError]=useState('');
 useEffect(()=>{let live=true;const t=setTimeout(()=>void api<MemberPage>('/trainer/members?'+new URLSearchParams({tenant_id:tenantId,q:query,page_size:'25'})).then(d=>{if(live){setRows(d.items);setError('')}}).catch(e=>{if(live)setError(e.message)}),200);return()=>{live=false;clearTimeout(t)}},[query,tenantId]);
 return <div className="nfc-member-switcher"><div><Label htmlFor="member-lookup">Üye bul</Label><Input id="member-lookup" type="search" placeholder="Üye değiştir: adla ara…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div><Label htmlFor="member-pick">Üye seç</Label><NativeSelect id="member-pick" value={current.athlete_id} onChange={e=>select([current,...rows].find(m=>m.athlete_id===e.target.value)??null)}><option value="">Tüm üyeler</option>{[current,...rows.filter(m=>m.athlete_id!==current.athlete_id)].map(m=><option key={m.athlete_id} value={m.athlete_id}>{m.name}</option>)}</NativeSelect></div>{error&&<p role="alert">{error}</p>}</div>;
}
