import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { offlineStore } from '@/lib/offline-store';
export function useMemberActivities() {
  const {user}=useAuth();const id=user?.id??'';
  return useQuery({queryKey:['tenant-activities',id],queryFn:()=>offlineStore.activities(id),enabled:Boolean(id),networkMode:'always',staleTime:Infinity});
}
