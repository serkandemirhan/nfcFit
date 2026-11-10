import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { offlineStore } from '@/lib/offline-store';
import { localDay } from '@/lib/activity-workflow';
export function useMemberFitness(){
  const {user}=useAuth();const id=user?.id??'';const key=['member-fitness',id,localDay(new Date()),-new Date().getTimezoneOffset()] as const;
  const query=useQuery({queryKey:key,queryFn:()=>offlineStore.fitness(id),enabled:Boolean(id),networkMode:'always',staleTime:Infinity});
  return {...query,fitnessKey:key};
}
