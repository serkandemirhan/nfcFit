import type {PlanContent,PlanDay} from '../../mobile/nfc-task-tracker/lib/coaching-types';
export type DraftSnapshot={schema:1;owner:string;tenant:string;mode:string;savedAt:number;content:PlanContent|null;workout:PlanDay|null;dirty:boolean;workoutDirty:boolean;base:{id:string;version:number;athlete_id?:string|null}|null;templateBase:{id:string;version:number}|null;planId:string;workoutId:string;week:number;day:number;programView:'week'|'day'|'overview';selectedExercise:string};
export const recoveryKey=(owner:string,tenant:string,mode:string)=>`nfcfit:trainer-recovery:v1:${owner}:${tenant}:${mode}`;
const validDay=(d:any)=>d&&typeof d.id==='string'&&typeof d.name==='string'&&Array.isArray(d.dates)&&d.dates.every((x:any)=>typeof x==='string')&&Array.isArray(d.exercises)&&d.exercises.every((e:any)=>e&&typeof e.id==='string'&&typeof e.exercise_id==='string');
export function readRecovery(storage:Pick<Storage,'getItem'|'removeItem'>,owner:string,tenant:string,mode:string,at=Date.now()):DraftSnapshot|null{
 const key=recoveryKey(owner,tenant,mode);
 try{const raw=storage.getItem(key);if(!raw)return null;const s=JSON.parse(raw);if(s.schema!==1||s.owner!==owner||s.tenant!==tenant||s.mode!==mode||!Number.isFinite(s.savedAt)||s.savedAt>at+60000||at-s.savedAt>7*86400000||typeof s.planId!=='string'||typeof s.workoutId!=='string'||!Number.isInteger(s.week)||s.week<0||!Number.isInteger(s.day)||s.day<0||s.day>6||!['week','day','overview'].includes(s.programView)||typeof s.selectedExercise!=='string'||(!s.dirty&&!s.workoutDirty)||(!s.content&&!s.workout))throw Error('invalid');
 if(s.content&&(!Array.isArray(s.content.days)||!s.content.days.every(validDay)||typeof s.content.name!=='string'||typeof s.content.start_date!=='string'||!Number.isInteger(s.content.weeks)||s.content.weeks<1||s.week>=s.content.weeks))throw Error('invalid');
 if(s.workout&&!validDay(s.workout))throw Error('invalid');
 for(const b of [s.base,s.templateBase])if(b&&(typeof b.id!=='string'||!Number.isInteger(b.version)||b.version<1))throw Error('invalid');
 return s;
 }catch{try{storage.removeItem(key)}catch{}return null;}
}
