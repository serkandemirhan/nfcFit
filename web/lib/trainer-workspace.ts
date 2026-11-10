import type { Workout } from '../../mobile/nfc-task-tracker/lib/coaching-types';
export type TrainerMember = { id:string; athlete_id:string; tenant_id:string; name:string; active_plans:number; upcoming_plans?:number; next_start_date?:string|null; program_state?:'active'|'scheduled'|'needs_program'; completion_rate:number|null; missed:number; unreviewed_changes:number; unread_messages:number; pending_reports:number; attention_count?:number; recent_workouts?:Workout[] };
export type MemberPage = { recent_activity?:{name:string;athlete_id:string;workout:Workout}[]; items:TrainerMember[]; total:number; page:number; page_size:number; stats:{ assigned:number; with_program:number; needs_program:number; scheduled_program?:number; attention:number } };
export type MemberView = 'program'|'progress'|'history';
export function attentionReasons(member:TrainerMember) {
 const reasons:{key:string;label:string;action:string;view:MemberView|'messages'|'reports'|'assign'}[]=[];
 if(member.unread_messages)reasons.push({key:'messages',label:`${member.unread_messages} okunmamış mesaj`,action:'Mesajı aç',view:'messages'});
 if(member.pending_reports)reasons.push({key:'reports',label:`${member.pending_reports} rapor inceleme bekliyor`,action:'Raporu incele',view:'reports'});
 if(member.unreviewed_changes)reasons.push({key:'changes',label:`${member.unreviewed_changes} program değişikliği`,action:'Programı incele',view:'program'});
 if(member.missed)reasons.push({key:'missed',label:`${member.missed} kaçırılan antrenman`,action:'İlerlemeyi aç',view:'progress'});
 if(!member.active_plans&&!member.upcoming_plans)reasons.push({key:'program',label:'Aktif programı yok',action:'Program ata',view:'assign'});
 return reasons;
}
