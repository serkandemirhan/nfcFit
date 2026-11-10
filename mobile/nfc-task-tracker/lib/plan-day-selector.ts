import type { PlanDay } from './coaching-types';
export const builderDayLabels=['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'] as const;
/** Uses the plan's existing date-only values; does not rewrite dates or session IDs. */
export function dayForWeekday(days:PlanDay[],weekday:number,currentId?:string):PlanDay|undefined {
  const matches=(day:PlanDay)=>day.dates.some(date=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;
    const value=new Date(date+'T12:00:00Z');
    return Number.isFinite(value.getTime())&&value.toISOString().slice(0,10)===date&&(value.getUTCDay()+6)%7===weekday;
  });
  return days.find(day=>day.id===currentId&&matches(day))??days.find(matches);
}
export function builderNameError(name:string):string|null {
  return name.trim()?null:'Program adını girin.';
}
